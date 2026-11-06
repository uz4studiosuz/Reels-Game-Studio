/* games/track3d/rail-physics.js — sharlar yo'l (relsa) bo'ylab harakati.
 *
 * Har bir shar: s (yo'l bo'ylab masofa), v (tezlik), x (yo'lning kengligi bo'ylab joy), vx.
 * Kuchlar: og'irlik (qiyalik), ishqalanish, markazdan qochma kuch (burilishlarda), boosterlar, to'siqlar
 * va sharlarning bir-biriga urilishi. Hech qanday three.js yo'q — sof hisob-kitob.
 */
(function (App) {
    'use strict';
    const NS = App.track3d;
    const { clamp } = App.util;
    const { DS, WIDTH } = NS;

    const G = 14;
    const LIM = WIDTH / 2 - 0.55;

    const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; v[0] /= l; v[1] /= l; v[2] /= l; };

    class Rail {
        constructor(track) { this.samples = track.samples; this.n = track.samples.length - 1; }

        /** s nuqtadagi kadr (p,f,r,u,yawRate,gap) — `out` ga yoziladi (GC kamaytirish uchun). */
        at(s, out) {
            let x = s / DS;
            if (x < 0) x = 0;
            if (x > this.n - 0.001) x = this.n - 0.001;
            const i = x | 0, t = x - i;
            const A = this.samples[i], B = this.samples[i + 1];
            for (let k = 0; k < 3; k++) {
                out.p[k] = A.p[k] + (B.p[k] - A.p[k]) * t;
                out.f[k] = A.f[k] + (B.f[k] - A.f[k]) * t;
                out.r[k] = A.r[k] + (B.r[k] - A.r[k]) * t;
                out.u[k] = A.u[k] + (B.u[k] - A.u[k]) * t;
            }
            norm3(out.f); norm3(out.r); norm3(out.u);
            out.yawRate = A.yawRate;
            out.gap = A.gap;
            out.tag = A.tag;
            return out;
        }

        static frame() { return { p: [0, 0, 0], f: [0, 0, 1], r: [1, 0, 0], u: [0, 1, 0], yawRate: 0, gap: false, tag: '' }; }
    }

    class Race {
        /**
         * @param track   track-builder natijasi
         * @param people  ishtirokchilar (App.roster.participants)
         * @param rand    seed asosidagi tasodifiy
         * @param onEvent (type, ball) => void   'boost' | 'bump' | 'clash'
         */
        constructor(track, people, rand, onEvent, opts = {}) {
            this.track = track;
            this.rail = new Rail(track);
            this.rand = rand;
            this.opts = opts;               // { elimination: bool }
            this.onEvent = onEvent || (() => {});
            this.tmp = Rail.frame();
            this.time = 0;
            this.finCount = 0;
            this.slicks = [];               // to'kilgan moy dog'lari
            this.cpIdx = 0;                 // o'tilgan nazorat nuqtalari
            this.elimCount = 0;
            for (const it of track.items) it.next = 0;
            this.balls = people.map((p, i) => {
                const col = i % 4, row = Math.floor(i / 4);
                return {
                    person: p, i,
                    s: 4 - row * 1.5, v: 0, x: (col - 1.5) * 1.25, vx: 0,
                    xt: 0, retarget: 0, skill: 0.9 + rand() * 0.2,
                    fin: 0, finTime: 0, glow: 0, hit: 0, pads: new Set(), cool: 0,
                    nz: 0, evT: 3 + rand() * 6, ev: 0, evLeft: 0,
                    item: null, itemT: 0, turbo: 0, stun: 0, shield: false, shieldT: 0, elim: 0, elimTime: 0,
                };
            });
        }

        get leader() {
            let best = null;
            for (const b of this.balls) if (!b.elim && (!best || b.s > best.s)) best = b;
            return best || this.balls[0];
        }

        get aliveCount() { return this.balls.filter(b => !b.elim).length; }

        /** Harakatlanuvchi to'siqning hozirgi yon joyi. */
        moverX(m) { return m.x0 + m.amp * Math.sin(m.w * this.time + m.ph); }

        /** Tartiblangan ro'yxat: finishga yetganlar, keyin masofa bo'yicha, chiqib ketganlar eng oxirida. */
        standings() {
            const key = (b) => (b.elim ? -1e6 + b.elimTime : b.fin ? 1e6 - b.fin : b.s);
            return this.balls.slice().sort((a, b) => key(b) - key(a));
        }

        _pickItem() {
            const r = this.rand();
            return r < 0.32 ? 'turbo' : r < 0.62 ? 'rocket' : r < 0.82 ? 'shield' : 'oil';
        }

        /** Sovg'ani ishlatish: turbo, qalqon, moy yoki raketa (oldindagi raqibga). */
        _use(b) {
            const it = b.item;
            if (it === 'turbo') { b.turbo = 1.8; b.v = Math.min(50, b.v + 6); b.item = null; this.onEvent('turbo', b); }
            else if (it === 'shield') { b.shield = true; b.shieldT = 10; b.item = null; this.onEvent('shield', b); }
            else if (it === 'oil') { this.slicks.push({ s: b.s - 3, t: this.time, len: 6, owner: b }); b.item = null; this.onEvent('oil', b); }
            else if (it === 'rocket') {
                let tgt = null, bd = 1e9;
                for (const o of this.balls) {
                    if (o === b || o.elim || o.fin) continue;
                    const d = o.s - b.s;
                    if (d > 1.5 && d < 70 && d < bd) { bd = d; tgt = o; }
                }
                if (!tgt) { b.itemT = 0.6; return; }          // oldinda hech kim yo'q: biroz kutadi
                b.item = null;
                if (tgt.shield) { tgt.shield = false; this.onEvent('block', tgt, b); }
                else { tgt.stun = 1.6; tgt.v *= 0.45; tgt.hit = 0.4; this.onEvent('rocket', b, tgt); }
            }
        }

        step(dt, drama) {
            const { track, rail, tmp, balls, rand } = this;
            this.time += dt;
            let avg = 0, cnt = 0, leadS = 0;
            for (const b of balls) if (!b.fin && !b.elim) { avg += b.s; cnt++; if (b.s > leadS) leadS = b.s; }
            avg = cnt ? avg / cnt : 0;

            for (const b of balls) {
                b.glow = Math.max(0, b.glow - dt);
                b.hit = Math.max(0, b.hit - dt);
                b.cool = Math.max(0, b.cool - dt);
                if (b.elim) { b.v *= Math.pow(0.9, dt * 60); continue; }
                if (b.shield && (b.shieldT -= dt) <= 0) b.shield = false;

                if (b.fin) { // marradan keyin to'xtash
                    b.v *= Math.pow(0.9, dt * 60);
                    b.s = Math.min(b.s + b.v * dt, track.length - 3);
                    b.x = clamp(b.x + b.vx * dt, -LIM, LIM);
                    b.vx *= 0.92;
                    continue;
                }

                rail.at(b.s, tmp);
                const slope = -tmp.f[1];
                // og'irlik - dumalash ishqalanishi - havo qarshiligi (v^2) - yon sirpanish
                let a = (G * slope - 0.5 - 0.02 * b.v - 0.005 * b.v * b.v - 0.35 * Math.abs(b.vx)) * b.skill;
                // har bir sharning o'z "kayfiyati": sekin o'zgaruvchi shovqin + vaqti-vaqti bilan
                // keskin tezlashish yoki qoqilish — natija har safar boshqacha chiqadi
                b.nz = clamp(b.nz + (rand() - 0.5) * dt * 10, -1, 1);
                a += b.nz * 1.6;
                b.evT -= dt;
                if (b.evT <= 0) { b.evT = 5 + rand() * 8; b.ev = rand() < 0.5 ? 1 : -1; b.evLeft = 1.2 + rand() * 1.4; }
                if (b.evLeft > 0) {
                    b.evLeft -= dt;
                    a += b.ev * 3.8;
                    if (b.ev > 0) b.glow = Math.max(b.glow, 0.2);
                    else if (rand() < dt * 1.5) this.onEvent('stumble', b);
                }
                if (tmp.tag === 'mud') a -= 3.4 + 0.09 * b.v; // loy: tezlik tushadi
                if (b.turbo > 0) { b.turbo -= dt; a += 9; b.glow = Math.max(b.glow, 0.25); }
                if (b.stun > 0) { b.stun -= dt; a -= 5; }
                // to'kilgan moy: tezlik tushadi va shar yonga sirpanadi (egasi dastlabki 2 soniya daxlsiz)
                for (const sl of this.slicks) {
                    if (this.time - sl.t < 10 && Math.abs(b.s - sl.s) < sl.len / 2 && !(sl.owner === b && this.time - sl.t < 2)) {
                        a -= 2.5; b.vx += (rand() - 0.5) * 18 * dt;
                    }
                }
                if (drama) {
                    // yaqin poyga: peshqadamdan 10 m dan ortiq ortda qolgan shar masofaga qarab tezlashadi,
                    // peshqadam esa guruhdan juda uzoqlashsa biroz sekinlashadi
                    const back = leadS - b.s;
                    if (back > 10) a += clamp((back - 10) / 10, 0, 3) * 4;
                    else if (back < 0.01 && leadS - avg > 18) a -= 4;
                }
                b.v = clamp(b.v + a * dt, 5, b.turbo > 0 ? 54 : 44);
                if (b.stun > 0) b.v = Math.min(b.v, 14);

                // sovg'a qutilari: oladi, bir necha soniyadan keyin ishlatadi
                if (!b.item) {
                    for (const it of track.items) {
                        if (this.time >= it.next && Math.abs(b.s - it.s) < 1.2 && Math.abs(b.x - it.x) < 1.3) {
                            it.next = this.time + 9; b.item = this._pickItem(); b.itemT = 0.8 + rand() * 2.2;
                            this.onEvent('pickup', b, it);
                            break;
                        }
                    }
                } else if ((b.itemT -= dt) <= 0) this._use(b);

                // harakatlanuvchi to'siqlar
                for (const m of track.movers) {
                    const mx = this.moverX(m);
                    if (b.cool <= 0 && Math.abs(b.s - m.s) < 1.0 && Math.abs(b.x - mx) < 1.0) {
                        const dir = Math.sign(b.x - mx) || (rand() < 0.5 ? -1 : 1);
                        b.vx = dir * 7.5; b.hit = 0.3; b.cool = 0.4;
                        if (b.shield) { b.shield = false; this.onEvent('block', b, null); }
                        else { b.v *= 0.78; this.onEvent('bump', b); }
                    }
                }

                // boosterlar
                for (const pad of track.boosters) {
                    const near = Math.abs(b.s - pad.s) < 1.1 && Math.abs(b.x - pad.x) < pad.w;
                    if (near && !b.pads.has(pad)) { b.pads.add(pad); b.v = Math.min(44, b.v + 9); b.glow = 0.5; this.onEvent('boost', b); }
                    else if (!near && Math.abs(b.s - pad.s) > 2.5) b.pads.delete(pad);
                }
                // to'siqlar
                for (const bp of track.bumpers) {
                    if (b.cool <= 0 && Math.abs(b.s - bp.s) < 0.95 && Math.abs(b.x - bp.x) < 0.95) {
                        const dir = b.x === bp.x ? (rand() < 0.5 ? -1 : 1) : Math.sign(b.x - bp.x);
                        b.vx = dir * 6.5; b.v *= 0.86; b.hit = 0.3; b.cool = 0.35;
                        this.onEvent('bump', b);
                    }
                }

                // yon yo'nalish: markazdan qochma kuch + "chiziq tanlash"
                b.retarget -= dt;
                if (b.retarget <= 0) { b.xt = (rand() * 2 - 1) * (LIM - 0.4); b.retarget = 0.8 + rand() * 1.8; }
                const ax = -b.v * b.v * tmp.yawRate * 0.35 + (b.xt - b.x) * 2.2 - b.vx * 2.0;
                b.vx += ax * dt;
                b.x += b.vx * dt;
                // devorga urilish: tezlik yo'qoladi (urilish kuchiga qarab), devor bo'ylab ishqalanadi
                if (Math.abs(b.x) >= LIM) {
                    const side = Math.sign(b.x), imp = Math.abs(b.vx);
                    if (b.vx * side > 0) {
                        b.vx = -side * imp * 0.3;
                        if (imp > 0.6) {
                            b.v *= 1 - clamp(0.025 + imp * 0.022, 0, 0.17);
                            b.hit = 0.2;
                            this.onEvent('wall', b, imp);
                        }
                    }
                    b.x = side * LIM;
                    b.v *= 1 - 0.25 * dt; // devorga ishqalanish
                }

                b.s += b.v * dt;
                if (b.s >= track.finishS) {
                    b.fin = ++this.finCount;
                    b.finTime = this.time;
                    this.onEvent('finish', b);
                }
            }

            // nazorat nuqtalari: peshqadam o'tganda oxirgi shar chiqib ketadi (saralash)
            if (this.opts.elimination && this.cpIdx < track.checkpoints.length && leadS >= track.checkpoints[this.cpIdx]) {
                this.cpIdx++;
                this.onEvent('checkpoint', balls[0], this.cpIdx);
                const alive = balls.filter(b => !b.elim && !b.fin);
                if (alive.length > 3) {
                    let last = alive[0];
                    for (const b of alive) if (b.s < last.s) last = b;
                    last.elim = ++this.elimCount; last.elimTime = this.time; last.item = null;
                    this.onEvent('elim', last);
                }
            }

            // sharlar to'qnashuvi
            for (let i = 0; i < balls.length; i++) {
                const a = balls[i];
                if (a.elim) continue;
                for (let j = i + 1; j < balls.length; j++) {
                    const c = balls[j];
                    if (c.elim) continue;
                    const ds = a.s - c.s, dx = a.x - c.x;
                    if (ds > 1 || ds < -1 || dx > 1 || dx < -1) continue;
                    const d = Math.hypot(ds, dx);
                    if (d >= 1 || d === 0) continue;
                    const ns = ds / d, nx = dx / d, push = (1 - d) / 2;
                    a.s += ns * push; c.s -= ns * push;
                    a.x = clamp(a.x + nx * push, -LIM, LIM); c.x = clamp(c.x - nx * push, -LIM, LIM);
                    const rel = (a.v - c.v) * ns + (a.vx - c.vx) * nx;
                    if (rel < 0) {
                        const imp = -rel * 0.8;
                        a.v += imp * ns; c.v -= imp * ns;
                        a.vx += imp * nx; c.vx -= imp * nx;
                        if (imp > 2) this.onEvent('clash', a);
                    }
                }
            }
        }

        /** Sharning dunyodagi joyi (chiqish: out=[x,y,z]). Sakrash oralig'ida yoy bo'ylab ko'tariladi. */
        worldPos(b, out, tmp) {
            const f = this.rail.at(b.s, tmp || this.tmp);
            out[0] = f.p[0] + f.r[0] * b.x + f.u[0] * 0.5;
            out[1] = f.p[1] + f.r[1] * b.x + f.u[1] * 0.5;
            out[2] = f.p[2] + f.r[2] * b.x + f.u[2] * 0.5;
            for (const g of this.track.gaps) {
                if (b.s > g.s0 && b.s < g.s1) {
                    const u = (b.s - g.s0) / (g.s1 - g.s0);
                    out[1] += g.hump * 4 * u * (1 - u);
                }
            }
            return out;
        }
    }

    NS.Rail = Rail;
    NS.Race = Race;
})(window.App = window.App || {});
