/* core/draw.js — 2D chizish yordamchilari va sahna palitrasi */
(function (App) {
    'use strict';
    const { TAU, hsl, isEmoji } = App.util;

    const FONT = '"Inter","Segoe UI","Helvetica Neue",Arial,"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';

    // Sahna palitrasi: bitta qora fon, bitta iliq oq matn, bitta urg'u rangi.
    const PAL = {
        bg: '#0d0d10',
        panel: '#17171c',
        line: '#2b2b33',
        ink: '#f5f2ea',
        mute: '#8d8b95',
        accent: '#ff5a36',
        good: '#5be37d',
        bad: '#ff4d5e',
    };

    const D = {
        FONT, PAL,

        text(ctx, s, x, y, o = {}) {
            const { size = 32, color = PAL.ink, align = 'center', weight = 700, baseline = 'middle', alpha = 1 } = o;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.font = `${weight} ${size}px ${FONT}`;
            ctx.textAlign = align;
            ctx.textBaseline = baseline;
            ctx.fillStyle = color;
            ctx.fillText(s, x, y);
            ctx.restore();
        },

        rr(ctx, x, y, w, h, r) {
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, r);
        },

        /** Matnni kenglikka sig'dirib qisqartiradi (…). */
        fit(ctx, s, maxW, size, weight = 700) {
            ctx.font = `${weight} ${size}px ${FONT}`;
            if (ctx.measureText(s).width <= maxW) return s;
            while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
            return s + '…';
        },

        /** Avval shrift kichraytiriladi (minSize gacha), faqat shunda ham sig'masa "…" qo'yiladi. */
        fitSize(ctx, s, maxW, size, weight = 700, minSize = 14) {
            let sz = size;
            ctx.font = `${weight} ${sz}px ${FONT}`;
            while (sz > minSize && ctx.measureText(s).width > maxW) { sz -= 1; ctx.font = `${weight} ${sz}px ${FONT}`; }
            return { text: ctx.measureText(s).width <= maxW ? s : D.fit(ctx, s, maxW, sz, weight), size: sz };
        },

        /** Matnni so'z bo'yicha qatorlarga bo'ladi; sig'masa shrift kichrayadi. Qaytaradi {lines, size}. */
        wrap(ctx, s, maxW, size, weight = 700, maxLines = 2, minSize = 15) {
            for (let sz = size; sz >= minSize; sz--) {
                ctx.font = `${weight} ${sz}px ${FONT}`;
                const words = s.split(' '), lines = [];
                let cur = '';
                for (const w of words) {
                    const t = cur ? cur + ' ' + w : w;
                    if (ctx.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; }
                }
                if (cur) lines.push(cur);
                if (lines.length <= maxLines && lines.every(l => ctx.measureText(l).width <= maxW)) return { lines, size: sz };
            }
            return { lines: [D.fit(ctx, s, maxW, minSize, weight)], size: minSize };
        },

        /** Ishtirokchi belgisi: emoji bo'lsa emoji, aks holda bosh harflar. */
        mark(ctx, p, x, y, size) {
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            if (p.emoji) {
                ctx.font = `${size}px ${FONT}`;
                ctx.fillStyle = '#fff';
                ctx.fillText(p.label, x, y + size * 0.06);
            } else {
                ctx.font = `800 ${size * 0.62}px ${FONT}`;
                ctx.fillStyle = '#0d0d10';
                ctx.fillText(p.label, x, y + size * 0.03);
            }
            ctx.restore();
        },

        /** Ishtirokchi shari: rangli doira + belgi. */
        token(ctx, p, x, y, r, o = {}) {
            const { ring = true, fill } = o;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, TAU);
            ctx.fillStyle = fill || (p.emoji ? PAL.panel : hsl(p.hue, 70, 62));
            ctx.fill();
            if (ring) {
                ctx.lineWidth = Math.max(2, r * 0.14);
                ctx.strokeStyle = hsl(p.hue, 80, 66);
                ctx.stroke();
            }
            D.mark(ctx, p, x, y, r * 1.1);
        },

        /** Holat chizig'i (HP va h.k.). */
        bar(ctx, x, y, w, h, frac, color, back = 'rgba(255,255,255,.14)') {
            ctx.fillStyle = back;
            ctx.fillRect(x, y, w, h);
            ctx.fillStyle = color;
            ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
        },

        /** O'yin maydonining ramkasi. */
        frame(ctx, a, color = PAL.line, w = 2) {
            ctx.strokeStyle = color;
            ctx.lineWidth = w;
            ctx.strokeRect(a.x, a.y, a.w, a.h);
        },

        clip(ctx, a) {
            ctx.beginPath();
            ctx.rect(a.x, a.y, a.w, a.h);
            ctx.clip();
        },

        isEmoji,
    };

    App.draw = D;
})(window.App = window.App || {});
