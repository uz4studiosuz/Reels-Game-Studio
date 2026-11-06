/* features/overlay.js — har bir videoda umumiy ko'rinadigan qatlam:
 * tepa sarlavha, aylanuvchi obuna/komment lentasi, qatnashuvchilar yo'lagi, boshlanish sanog'i,
 * g'olib kartasi, yakuniy ekran (outro) va kino effektlari. O'yin kodi bu qatlamdan xabarsiz.
 * Matnlar hech qachon "…" bilan kesilmaydi: avval shrift kichrayadi yoki ikki qatorga bo'linadi. */
(function (App) {
    'use strict';
    const { clamp, easeOut, TAU } = App.util;
    const { text, rr, fit, fitSize, wrap, FONT, PAL } = App.draw;

    const PAPER = '#f5f2ea';
    const ROTATE = 210;     // bitta xabar necha tick ko'rinadi

    function label(ctx, s, x, y, color, size = 18, align = 'center') {
        ctx.save();
        ctx.letterSpacing = '4px';
        text(ctx, s, x, y, { size, color, weight: 700, align });
        ctx.restore();
    }

    const Overlay = {
        draw(ctx, S) {
            const { W, H, video, tick, introLeft, introTotal, result, endT, endHold } = S;
            const outroOn = result && endT >= endHold - 20;

            if (video.hook && !outroOn) {
                ctx.save();
                ctx.shadowColor = 'rgba(0,0,0,.6)';
                ctx.shadowBlur = 12;
                const f = fitSize(ctx, video.hook, 660, 34, 800, 20);
                text(ctx, f.text, W / 2, 66, { size: f.size, weight: 800 });
                ctx.restore();
            }

            const visible = video.banner === 'always' || (video.banner === 'edges' && (tick < 360 || result));
            if (!outroOn) {
                if (S.community && S.names.length) this._ticker(ctx, S);
                if (visible) this._banner(ctx, S);
            }

            if (introLeft > 0) {
                const sec = Math.ceil(introLeft / 60);
                const frac = (introLeft % 60) / 60 || 1;
                ctx.save();
                ctx.fillStyle = 'rgba(13,13,16,.55)';
                ctx.fillRect(0, 0, W, H);
                ctx.translate(W / 2, H / 2 - 40);
                ctx.lineWidth = 3;
                ctx.strokeStyle = 'rgba(245,242,234,.25)';
                ctx.beginPath(); ctx.arc(0, 0, 130, 0, TAU); ctx.stroke();
                ctx.strokeStyle = PAL.ink;
                ctx.beginPath(); ctx.arc(0, 0, 130, -Math.PI / 2, -Math.PI / 2 + TAU * frac); ctx.stroke();
                text(ctx, String(sec), 0, 4, { size: 170, weight: 300, alpha: 0.4 + 0.6 * frac });
                if (S.community) text(ctx, 'KOMMENT YOZ — QATNASH', 0, 190, { size: 22, weight: 800, color: PAL.accent });
                ctx.restore();
            }

            if (S.caption && video.captions !== false && !outroOn) this._caption(ctx, S);
            if (result && endT < endHold) this._endCard(ctx, S);
            if (outroOn) this._outro(ctx, S);
            if (video.cinema) this._cinema(ctx, S);
        },

        /** Diktor gapi ekranda sarlavha sifatida (ovoz yozuvga tushmasa ham tomoshabin o'qiydi). */
        _caption(ctx, S) {
            const { W, elapsed, caption } = S;
            const a = clamp(Math.min(elapsed - caption.at, caption.at + caption.dur - elapsed) / 0.25, 0, 1);
            const w = wrap(ctx, caption.text, W - 150, 28, 800, 2, 18);
            const lh = w.size * 1.25, h = w.lines.length * lh + 22, y = 1086 - h / 2;
            ctx.save();
            ctx.globalAlpha = a;
            ctx.fillStyle = 'rgba(13,13,16,.78)';
            rr(ctx, 50, y, W - 100, h, 20); ctx.fill();
            w.lines.forEach((l, i) => text(ctx, l, W / 2, y + 11 + lh / 2 + i * lh, { size: w.size, weight: 800 }));
            ctx.restore();
        },

        /** Chaqiriq xabarlari ro'yxati: [{t, kind, icon}] */
        _messages(S) {
            const v = S.video, m = [];
            if (S.community && v.cta2) m.push({ t: v.cta2, kind: 'comment', icon: '💬' });
            if (v.cta3) m.push({ t: v.cta3, kind: 'follow', icon: '🔔' });
            if (v.cta) m.push({ t: v.cta, kind: 'plain', icon: '' });
            return m;
        },

        _banner(ctx, S) {
            const { W, H, video, tick } = S;
            const msgs = this._messages(S);
            if (!msgs.length && !video.handle) return;
            const appear = clamp((tick - 20) / 22, 0, 1);
            const slide = (1 - easeOut(appear)) * 120;
            const bh = 76, y = H - 104 + slide;
            const idx = Math.floor(tick / ROTATE) % Math.max(1, msgs.length);
            const phase = tick % ROTATE;
            const fade = clamp(Math.min(phase, ROTATE - phase) / 14, 0, 1);
            const msg = msgs[idx];
            const hot = msg && msg.kind === 'comment';

            ctx.save();
            ctx.globalAlpha = appear;
            ctx.fillStyle = hot ? PAL.accent : PAPER;
            rr(ctx, 24, y, W - 48, bh, 38);
            ctx.fill();
            const pulse = 0.5 + 0.5 * Math.sin(tick / 14);
            ctx.fillStyle = hot ? '#fff' : PAL.accent;
            ctx.beginPath(); ctx.arc(24 + 34, y + bh / 2, 7 + pulse * 2.5, 0, TAU); ctx.fill();
            let x = 24 + 58;
            if (video.handle) {
                const f = fitSize(ctx, video.handle, 210, 25, 800, 16);
                text(ctx, f.text, x, y + bh / 2 + 1, { size: f.size, color: hot ? '#fff' : '#111', weight: 800, align: 'left' });
                ctx.font = `800 ${f.size}px ${FONT}`;
                x += ctx.measureText(f.text).width + 16;
            }
            if (msg) {
                const room = W - 24 - 28 - x;
                const w = wrap(ctx, (msg.icon ? msg.icon + ' ' : '') + msg.t, room, 22, 700, 2, 15);
                ctx.globalAlpha = appear * fade;
                const lh = w.size * 1.18, top = y + bh / 2 - (w.lines.length - 1) * lh / 2;
                w.lines.forEach((l, i) => text(ctx, l, x, top + i * lh + 1, { size: w.size, color: hot ? '#fff' : '#3a3841', weight: 700, align: 'left' }));
            }
            ctx.restore();
        },

        /** Qatnashuvchilar yo'lagi (bannerdan yuqorida, o'ngdan chapga aylanadi). */
        _ticker(ctx, S) {
            const { W, H, tick } = S;
            const y = H - 126;
            const line = '   ●   ' + S.names.join('   ●   ');
            ctx.save();
            ctx.beginPath(); ctx.rect(24, y - 14, W - 48, 28); ctx.clip();
            ctx.font = `700 17px ${FONT}`;
            const w = Math.max(200, ctx.measureText(line).width);
            const off = (tick * 1.4) % w;
            ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
            ctx.fillStyle = 'rgba(245,242,234,.78)';
            for (let k = -1; k < Math.ceil((W - 48) / w) + 1; k++) ctx.fillText(line, 24 - off + k * w, y);
            ctx.restore();
            label(ctx, 'QATNASHMOQDA', 24 + 62, y - 20, PAL.accent, 11, 'center');
        },

        _endCard(ctx, S) {
            const { W, video, result, endT, endHold } = S;
            const p = easeOut(clamp(endT / 16, 0, 1));
            const out = clamp((endT - (endHold - 20)) / 20, 0, 1);   // outro boshlanayotganda karta so'nadi
            const cx = W / 2, cy = 470;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(0.86 + 0.14 * p, 0.86 + 0.14 * p);
            ctx.globalAlpha = p * (1 - out);
            ctx.shadowColor = 'rgba(0,0,0,.5)';
            ctx.shadowBlur = 40;
            ctx.fillStyle = PAPER;
            rr(ctx, -310, -130, 620, 310, 28);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = result.color || PAL.accent;
            ctx.fillRect(-310, -130, 620, 8);
            label(ctx, result.kicker || 'G\'OLIB', 0, -86, '#77747e', 18);
            const t = fitSize(ctx, result.title, 560, 66, 800, 30);
            text(ctx, t.text, 0, -22, { size: t.size, color: '#111', weight: 800 });
            if (result.sub) { const s = fitSize(ctx, result.sub, 560, 26, 600, 15); text(ctx, s.text, 0, 38, { size: s.size, color: '#55525c', weight: 600 }); }
            // komment chaqiruvi tugmasi (urilib turadi), matn sig'maguncha kichrayadi yoki ikki qatorga bo'linadi
            const bump = 1 + 0.025 * Math.sin(endT / 6);
            ctx.save();
            ctx.translate(0, 112); ctx.scale(bump, bump);
            ctx.fillStyle = PAL.accent;
            rr(ctx, -270, -36, 540, 72, 36);
            ctx.fill();
            const w = wrap(ctx, '💬 ' + (video.endCta || 'Kommentga yoz'), 480, 24, 800, 2, 16);
            const lh = w.size * 1.2;
            w.lines.forEach((l, i) => text(ctx, l, 0, 1 + (i - (w.lines.length - 1) / 2) * lh, { size: w.size, color: '#fff', weight: 800 }));
            ctx.restore();
            ctx.restore();
        },

        /** Yakuniy ekran: logotip, kanal nomi, obuna va komment chaqiruvi. Video qora bilan emas, shu bilan tugaydi. */
        _outro(ctx, S) {
            const { W, H, video, endT, endHold } = S;
            const k = endT - endHold;                                    // outro boshlanganidan beri
            const a = clamp((k + 20) / 26, 0, 1);
            ctx.save();
            ctx.globalAlpha = a;
            ctx.fillStyle = '#0d0d10';
            ctx.fillRect(0, 0, W, H);

            // logotip: halqa va undan chiqib ketayotgan to'p
            const cx = W / 2, cy = 430, R = 135;
            const out = easeOut(clamp(k / 40, 0, 1));
            ctx.lineCap = 'round'; ctx.lineWidth = 9; ctx.strokeStyle = PAPER;
            ctx.beginPath(); ctx.arc(cx, cy, R, -0.42 + 0.26, -0.42 + TAU - 0.26); ctx.stroke();
            ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(245,242,234,.3)';
            ctx.beginPath(); ctx.arc(cx, cy, R * 0.68, 2.6, 2.6 + TAU * 0.72); ctx.stroke();
            const ang = -0.42, d = R * 0.2 + out * (R * 1.2);
            const bx = cx + Math.cos(ang) * d, by = cy + Math.sin(ang) * d;
            const g = ctx.createRadialGradient(bx, by, 4, bx, by, 70);
            g.addColorStop(0, 'rgba(255,90,54,.5)'); g.addColorStop(1, 'rgba(255,90,54,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, 70, 0, TAU); ctx.fill();
            ctx.fillStyle = PAL.accent; ctx.beginPath(); ctx.arc(bx, by, 24, 0, TAU); ctx.fill();
            ctx.fillStyle = PAPER; ctx.beginPath(); ctx.arc(cx - 48, cy + 52, 12, 0, TAU); ctx.fill();

            // kanal nomi va chaqiriqlar (ketma-ket paydo bo'ladi)
            const show = (t0) => easeOut(clamp((k - t0) / 22, 0, 1));
            const h = fitSize(ctx, video.handle || '@kanal', 600, 76, 800, 34);
            ctx.globalAlpha = a * show(10);
            text(ctx, h.text, cx, 700, { size: h.size, weight: 800 });

            const pill = (y, t0, filled, msg) => {
                ctx.globalAlpha = a * show(t0);
                const slide = (1 - show(t0)) * 30;
                ctx.save(); ctx.translate(0, slide);
                if (filled) { ctx.fillStyle = PAL.accent; rr(ctx, 60, y - 44, W - 120, 88, 44); ctx.fill(); }
                else { ctx.strokeStyle = PAPER; ctx.lineWidth = 3; rr(ctx, 60, y - 44, W - 120, 88, 44); ctx.stroke(); }
                const w = wrap(ctx, msg, W - 120 - 80, 30, 800, 2, 18);
                const lh = w.size * 1.2;
                w.lines.forEach((l, i) => text(ctx, l, cx, y + 1 + (i - (w.lines.length - 1) / 2) * lh, { size: w.size, weight: 800, color: filled ? '#fff' : PAPER }));
                ctx.restore();
            };
            pill(830, 30, true, '🔔 Obuna bo\'l');
            pill(950, 50, false, '💬 ' + (video.endCta || 'Nikingni kommentga yoz'));
            ctx.globalAlpha = a * show(75);
            text(ctx, 'Keyingi videoda ko\'rishguncha!', cx, 1080, { size: 24, weight: 600, color: PAL.mute });
            ctx.restore();
        },

        /** Kino effektlari: vinyetka, boshida ochilish, outro oxirida yumshoq so'nish. */
        _cinema(ctx, S) {
            const { W, H, introLeft, introTotal, tick, result, endT, endHold, outro } = S;
            const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.72);
            g.addColorStop(0, 'rgba(0,0,0,0)');
            g.addColorStop(1, 'rgba(0,0,0,.5)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, W, H);
            const elapsed = (introTotal - introLeft) + tick;
            let black = 1 - clamp(elapsed / 40, 0, 1);
            if (result) black = Math.max(black, clamp((endT - (endHold + outro - 34)) / 34, 0, 1));
            if (black > 0) { ctx.fillStyle = `rgba(0,0,0,${black})`; ctx.fillRect(0, 0, W, H); }
        },
    };

    App.overlay = Overlay;
})(window.App = window.App || {});
