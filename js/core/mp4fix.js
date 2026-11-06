/* core/mp4fix.js — brauzer yozgan videoni pleyerlar to'g'ri o'qiydigan qilish.
 *
 * MediaRecorder (Chrome/Edge) MP4 ni "fragmented" ko'rinishda yozadi: umumiy davomiylik 0, video esa
 * ~2 soniyalik bo'laklar (moof+mdat). Ko'p pleyerlar, telefon galereyasi va Instagram faqat birinchi bo'lakni
 * ko'radi — video "2 soniya" bo'lib qoladi. Bu modul faylni oddiy MP4 ga qayta yig'adi:
 *   ftyp + moov (to'liq namuna jadvallari, to'g'ri davomiylik) + bitta mdat  ("faststart": moov boshida).
 * WebM uchun esa Segment/Info ga Duration elementi yoziladi.
 * Tashqi kutubxona ishlatilmaydi.
 */
(function (App) {
    'use strict';

    // ---------------- MP4 o'qish ----------------
    const T = (u8, o) => String.fromCharCode(u8[o], u8[o + 1], u8[o + 2], u8[o + 3]);
    const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'mvex', 'moof', 'traf', 'edts', 'dinf']);

    function parse(u8, dv, start, end) {
        const out = [];
        let o = start;
        while (o + 8 <= end) {
            let size = dv.getUint32(o), hdr = 8;
            if (size === 1) { size = Number(dv.getBigUint64(o + 8)); hdr = 16; }
            else if (size === 0) size = end - o;
            if (size < hdr || o + size > end) break;
            const b = { type: T(u8, o + 4), start: o, size, hdr, data: o + hdr, end: o + size };
            if (CONTAINERS.has(b.type)) b.kids = parse(u8, dv, b.data, b.end);
            out.push(b);
            o += size;
        }
        return out;
    }
    const find = (list, type) => (list || []).find(b => b.type === type);
    const findAll = (list, type) => (list || []).filter(b => b.type === type);

    // ---------------- MP4 yozish ----------------
    function cat(parts) {
        let n = 0; for (const p of parts) n += p.length;
        const out = new Uint8Array(n); let o = 0;
        for (const p of parts) { out.set(p, o); o += p.length; }
        return out;
    }
    function u32(...vals) { const b = new Uint8Array(vals.length * 4), d = new DataView(b.buffer); vals.forEach((v, i) => d.setUint32(i * 4, v >>> 0)); return b; }
    function box(type, ...parts) {
        const body = cat(parts), b = new Uint8Array(8 + body.length), d = new DataView(b.buffer);
        d.setUint32(0, b.length);
        for (let i = 0; i < 4; i++) b[4 + i] = type.charCodeAt(i);
        b.set(body, 8);
        return b;
    }
    const fullBox = (type, version, flags, ...parts) => box(type, u32(((version & 255) << 24) | (flags & 0xffffff)), ...parts);
    const raw = (u8, b) => u8.slice(b.start, b.end);

    /** Asl qutichani nusxalab, "duration" maydonini almashtiradi (mvhd/mdhd: off=12|20, tkhd: off=20|28). */
    function patchDuration(u8, b, dur, v0off, v1off) {
        const c = raw(u8, b), d = new DataView(c.buffer), v = c[b.hdr];
        if (v === 1) d.setBigUint64(b.hdr + v1off, BigInt(Math.round(dur)));
        else d.setUint32(b.hdr + v0off, Math.min(0xffffffff, Math.round(dur)));
        return c;
    }

    /**
     * Fragmentlangan MP4 -> oddiy MP4.
     * @param {ArrayBuffer} ab
     * @returns {Uint8Array}
     */
    function defragment(ab) {
        const u8 = new Uint8Array(ab), dv = new DataView(ab);
        const top = parse(u8, dv, 0, u8.length);
        const ftyp = find(top, 'ftyp'), moov = find(top, 'moov');
        if (!ftyp || !moov) throw new Error('MP4 tuzilishi tanilmadi');
        const moofs = findAll(top, 'moof');
        if (!moofs.length) return u8;                         // allaqachon oddiy MP4

        // trex: track bo'yicha standart qiymatlar
        const trex = {};
        for (const t of findAll(find(moov.kids, 'mvex') && find(moov.kids, 'mvex').kids, 'trex')) {
            const o = t.data + 4;
            trex[dv.getUint32(o)] = { dur: dv.getUint32(o + 8), size: dv.getUint32(o + 12), flags: dv.getUint32(o + 16) };
        }

        // treklar
        const tracks = {};
        for (const tk of findAll(moov.kids, 'trak')) {
            const tkhd = find(tk.kids, 'tkhd'), v = u8[tkhd.data];
            const id = dv.getUint32(tkhd.data + (v === 1 ? 20 : 12));
            const mdia = find(tk.kids, 'mdia'), mdhd = find(mdia.kids, 'mdhd'), mv = u8[mdhd.data];
            const timescale = dv.getUint32(mdhd.data + (mv === 1 ? 20 : 12));
            const hdlr = find(mdia.kids, 'hdlr');
            tracks[id] = { id, trak: tk, tkhd, mdia, mdhd, hdlr, timescale, handler: T(u8, hdlr.data + 8), samples: [], chunks: [] };
        }

        // bo'laklardan namunalarni yig'ish
        const chunkOrder = [];
        for (const moof of moofs) {
            let prevEnd = moof.start;
            for (const traf of findAll(moof.kids, 'traf')) {
                const tfhd = find(traf.kids, 'tfhd');
                const tf = dv.getUint32(tfhd.data) & 0xffffff;
                let o = tfhd.data + 4;
                const id = dv.getUint32(o); o += 4;
                const tr = tracks[id], def = trex[id] || { dur: 0, size: 0, flags: 0 };
                if (!tr) continue;
                let base = moof.start;
                if (tf & 0x1) { base = Number(dv.getBigUint64(o)); o += 8; } else if (!(tf & 0x20000)) base = prevEnd;
                if (tf & 0x2) o += 4;
                const dDur = tf & 0x8 ? dv.getUint32(o) : def.dur; if (tf & 0x8) o += 4;
                const dSize = tf & 0x10 ? dv.getUint32(o) : def.size; if (tf & 0x10) o += 4;
                const dFlags = tf & 0x20 ? dv.getUint32(o) : def.flags;
                let cursor = base;
                for (const trun of findAll(traf.kids, 'trun')) {
                    const ver = u8[trun.data], fl = dv.getUint32(trun.data) & 0xffffff;
                    let p = trun.data + 4;
                    const n = dv.getUint32(p); p += 4;
                    if (fl & 0x1) { cursor = base + dv.getInt32(p); p += 4; }
                    let firstFlags = null;
                    if (fl & 0x4) { firstFlags = dv.getUint32(p); p += 4; }
                    const chunk = { track: tr, first: tr.samples.length, count: n };
                    for (let i = 0; i < n; i++) {
                        const dur = fl & 0x100 ? dv.getUint32(p) : dDur; if (fl & 0x100) p += 4;
                        const size = fl & 0x200 ? dv.getUint32(p) : dSize; if (fl & 0x200) p += 4;
                        let flags = fl & 0x400 ? dv.getUint32(p) : (i === 0 && firstFlags !== null ? firstFlags : dFlags); if (fl & 0x400) p += 4;
                        const cto = fl & 0x800 ? (ver === 1 ? dv.getInt32(p) : dv.getUint32(p)) : 0; if (fl & 0x800) p += 4;
                        tr.samples.push({ off: cursor, size, dur, sync: !((flags >>> 16) & 1), cto });
                        cursor += size;
                    }
                    if (n) { tr.chunks.push(chunk); chunkOrder.push(chunk); }
                }
                prevEnd = cursor;
            }
        }

        // namuna jadvallari va yangi moov
        const mvhd = find(moov.kids, 'mvhd'), mvv = u8[mvhd.data];
        const movieTs = dv.getUint32(mvhd.data + (mvv === 1 ? 20 : 12));
        let movieDur = 0;
        const buildTrak = (tr, offsets) => {
            const S = tr.samples;
            const mediaDur = S.reduce((s, x) => s + x.dur, 0);
            const tkDur = (mediaDur / tr.timescale) * movieTs;
            movieDur = Math.max(movieDur, tkDur);
            // stts
            const stts = []; for (const s of S) { const l = stts[stts.length - 1]; if (l && l[1] === s.dur) l[0]++; else stts.push([1, s.dur]); }
            // ctts (faqat kerak bo'lsa)
            const anyCto = S.some(s => s.cto !== 0), neg = S.some(s => s.cto < 0);
            const ctts = []; if (anyCto) for (const s of S) { const l = ctts[ctts.length - 1]; if (l && l[1] === s.cto) l[0]++; else ctts.push([1, s.cto]); }
            // stss (video, hammasi kalit kadr bo'lmasa)
            const sync = []; S.forEach((s, i) => { if (s.sync) sync.push(i + 1); });
            // stsc
            const stsc = []; tr.chunks.forEach((c, i) => { const l = stsc[stsc.length - 1]; if (!l || l[1] !== c.count) stsc.push([i + 1, c.count, 1]); });
            const stblKids = find(find(find(tr.mdia.kids, 'minf').kids, 'stbl').kids, 'stsd');
            const parts = [
                raw(u8, stblKids),
                fullBox('stts', 0, 0, u32(stts.length), ...stts.map(e => u32(e[0], e[1]))),
            ];
            if (anyCto) parts.push(fullBox('ctts', neg ? 1 : 0, 0, u32(ctts.length), ...ctts.map(e => u32(e[0], e[1]))));
            if (tr.handler === 'vide' && sync.length && sync.length < S.length) parts.push(fullBox('stss', 0, 0, u32(sync.length), u32(...sync)));
            parts.push(fullBox('stsc', 0, 0, u32(stsc.length), ...stsc.map(e => u32(...e))));
            parts.push(fullBox('stsz', 0, 0, u32(0, S.length), u32(...S.map(s => s.size))));
            parts.push(fullBox('stco', 0, 0, u32(offsets.length), u32(...offsets)));
            const minf = find(tr.mdia.kids, 'minf');
            const minfParts = minf.kids.filter(b => b.type !== 'stbl').map(b => raw(u8, b));
            return box('trak',
                patchDuration(u8, tr.tkhd, tkDur, 20, 28),
                box('mdia', patchDuration(u8, tr.mdhd, mediaDur, 16, 24), raw(u8, tr.hdlr), box('minf', ...minfParts, box('stbl', ...parts))));
        };
        const list = Object.values(tracks).filter(t => t.samples.length);
        const buildMoov = (offsetsByTrack) => {
            movieDur = 0;
            const traks = list.map(t => buildTrak(t, offsetsByTrack.get(t)));
            const other = moov.kids.filter(b => !['mvhd', 'trak', 'mvex', 'iods'].includes(b.type)).map(b => raw(u8, b));
            return box('moov', patchDuration(u8, mvhd, movieDur, 16, 24), ...traks, ...other);
        };

        // 1-o'tish: moov o'lchamini aniqlash (offset qiymatlari o'lchamga ta'sir qilmaydi)
        const zero = new Map(list.map(t => [t, t.chunks.map(() => 0)]));
        const ftypRaw = raw(u8, ftyp);
        const moovSize = buildMoov(zero).length;
        let dataStart = ftypRaw.length + moovSize + 8;
        // 2-o'tish: haqiqiy offsetlar
        const offs = new Map(list.map(t => [t, []]));
        let pos = dataStart, total = 0;
        for (const c of chunkOrder) {
            offs.get(c.track).push(pos);
            for (let i = 0; i < c.count; i++) { const s = c.track.samples[c.first + i]; pos += s.size; total += s.size; }
        }
        const moovFinal = buildMoov(offs);
        if (moovFinal.length !== moovSize) throw new Error('moov o\'lchami mos kelmadi');
        // mdat
        const mdat = new Uint8Array(8 + total);
        new DataView(mdat.buffer).setUint32(0, mdat.length);
        mdat.set([0x6d, 0x64, 0x61, 0x74], 4);
        let w = 8;
        for (const c of chunkOrder) for (let i = 0; i < c.count; i++) { const s = c.track.samples[c.first + i]; mdat.set(u8.subarray(s.off, s.off + s.size), w); w += s.size; }
        return cat([ftypRaw, moovFinal, mdat]);
    }

    // ---------------- WebM: Duration qo'shish ----------------
    function vint(u8, p) {
        const b = u8[p]; let len = 1, mask = 0x80;
        while (len <= 8 && !(b & mask)) { mask >>= 1; len++; }
        let val = b & (mask - 1);
        for (let i = 1; i < len; i++) val = val * 256 + u8[p + i];
        return { len, val, unknown: val === Math.pow(2, 7 * len) - 1 };
    }
    function idLen(b) { let len = 1, mask = 0x80; while (len <= 4 && !(b & mask)) { mask >>= 1; len++; } return len; }
    function encSize(val, len) { const out = new Uint8Array(len); let v = val; for (let i = len - 1; i >= 0; i--) { out[i] = v & 255; v = Math.floor(v / 256); } out[0] |= 0x80 >> (len - 1); return out; }
    const readId = (u8, p) => { const l = idLen(u8[p]); let id = 0; for (let i = 0; i < l; i++) id = id * 256 + u8[p + i]; return { id, len: l }; };

    /** WebM ga davomiylik (ms) yozadi. */
    function webmDuration(ab, ms) {
        const u8 = new Uint8Array(ab);
        let p = 0;
        const ebml = readId(u8, p), es = vint(u8, p + ebml.len); p += ebml.len + es.len + es.val;
        const seg = readId(u8, p); if (seg.id !== 0x18538067) throw new Error('Segment topilmadi');
        const segSize = vint(u8, p + seg.len), segData = p + seg.len + segSize.len;
        let q = segData;
        while (q < u8.length) {
            const id = readId(u8, q), sz = vint(u8, q + id.len), data = q + id.len + sz.len;
            if (id.id === 0x1549A966) { // Info
                let r = data, scale = 1e6, durPos = -1, durLen = 0;
                while (r < data + sz.val) {
                    const cid = readId(u8, r), cs = vint(u8, r + cid.len), cd = r + cid.len + cs.len;
                    if (cid.id === 0x2AD7B1) { scale = 0; for (let i = 0; i < cs.val; i++) scale = scale * 256 + u8[cd + i]; }
                    if (cid.id === 0x4489) { durPos = cd; durLen = cs.val; }
                    r = cd + cs.val;
                }
                const units = ms * 1e6 / scale;
                if (durPos >= 0) {
                    const d = new DataView(ab);
                    if (durLen === 8) d.setFloat64(durPos, units); else d.setFloat32(durPos, units);
                    return u8;
                }
                const el = new Uint8Array(11); el.set([0x44, 0x89, 0x88]); new DataView(el.buffer).setFloat64(3, units);
                const newInfoSize = encSize(sz.val + 11, sz.len);
                const parts = [u8.subarray(0, q + id.len), newInfoSize, u8.subarray(data, data + sz.val), el, u8.subarray(data + sz.val)];
                // Segment o'lchami ma'lum bo'lsa, uni ham kattalashtiramiz
                if (!segSize.unknown) parts[0] = cat([u8.subarray(0, p + seg.len), encSize(segSize.val + 11, segSize.len), u8.subarray(segData, q + id.len)]);
                return cat(parts);
            }
            if (sz.unknown) break;
            q = data + sz.val;
        }
        return u8;
    }

    App.mp4fix = { defragment, webmDuration };
})(window.App = window.App || {});
