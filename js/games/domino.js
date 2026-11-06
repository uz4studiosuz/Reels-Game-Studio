/* games/domino.js — "Domino": yuzlab dominolar ketma-ket yiqiladi (spiral, ilon, yurak). Tinchlantiruvchi ASMR. */
(function (App) {
    'use strict';
    const { clamp, TAU, hsl } = App.util;
    const { text, PAL } = App.draw;

    const SETTINGS = [
        { group: 'Shakl', key: 'shape', label: 'Yo\'l shakli', type: 'segment', default: 'spiral', options: [['spiral', 'Spiral'], ['snake', 'Ilon'], ['heart', 'Yurak']] },
        { key: 'count', label: 'Dominolar soni', type: 'range', min: 60, max: 420, step: 10, default: 220 },
        { group: 'Ko\'rinish', key: 'rainbow', label: 'Kamalak ranglar', type: 'toggle', default: true },
        { key: 'sound', label: 'Taqillash ovozi', type: 'toggle', default: true },
    ];

    /** Shakl bo'ylab teng oraliqli nuqtalar (x, y, yo'nalish). */
    function pathPoints(shape, n, A) {
        const cx = A.x + A.w / 2, cy = A.y + A.h / 2 + 20;
        const raw = [];
        const S = 3000;
        for (let i = 0; i <= S; i++) {
            const t = i / S;
            let x, y;
            if (shape === 'spiral') { const a = t * TAU * 4.2, r = 30 + t * 270; x = cx + Math.cos(a) * r; y = cy + Math.sin(a) * r * 1.15; }
            else if (shape === 'heart') { const a = t * TAU; x = cx + 17 * Math.pow(Math.sin(a), 3) * 17.5; y = cy - 40 - (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) * 18.5; }
            else { const rows = 7, row = Math.min(rows - 1, Math.floor(t * rows)), u = t * rows - row; x = A.x + 60 + (row % 2 ? 1 - u : u) * (A.w - 120); y = A.y + 120 + row * ((A.h - 240) / (rows - 1)) + Math.sin(u * Math.PI) * 18; }
            raw.push([x, y]);
        }
        // yoy uzunligi bo'yicha teng taqsimlash
        const len = [0];
        for (let i = 1; i < raw.length; i++) len.push(len[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]));
        const total = len[len.length - 1], out = [];
        let j = 0;
        for (let k = 0; k < n; k++) {
            const d = (k / (n - 1)) * total;
            while (j < len.length - 2 && len[j + 1] < d) j++;
            const p = raw[j], q = raw[j + 1];
            out.push({ x: p[0], y: p[1], a: Math.atan2(q[1] - p[1], q[0] - p[0]), f: 0, t0: -1 });
        }
        return { pts: out, spacing: total / n };
    }

    function create(env) {
        const { ctx, W, arena: A, cfg, audio } = env;
        const { pts, spacing } = pathPoints(cfg.shape, cfg.count, A);
        const L = clamp(spacing * 1.25, 10, 26), T = clamp(spacing * 0.32, 3, 7);  // domino o'lchami
        const hue0 = Math.round(env.rnd(0, 360));
        // yiqilish tezligi: hammasi tanlangan vaqtning ~85% ida yiqilsin
        const rate = cfg.count / (env.targetSec * 0.85);
        let front = 0, t = 0, done = false, endT = 0;

        function update() {
            const dt = env.speed / 60;
            t += dt;
            if (t > 0.8) front = Math.min(cfg.count, front + rate * dt);       // birinchisini kichik turtki bilan boshlaymiz
            const fi = Math.floor(front);
            for (let i = 0; i < fi; i++) {
                const p = pts[i];
                if (p.t0 < 0) {
                    p.t0 = t;
                    if (cfg.sound) audio.tone(900 + (i % 12) * 35 + Math.sin(i * 0.3) * 60, 0.03, 'square', 0.025);
                }
                p.f = clamp((t - p.t0) / 0.16, 0, 1);
            }
            if (!done && fi >= cfg.count && pts[cfg.count - 1].f >= 1) {
                if (++endT > 50) { done = true; env.finish({ kicker: 'HAMMASI YIQILDI', title: `${cfg.count} ta domino`, sub: 'Yoqdimi? Obuna bo\'l', color: PAL.accent }); }
            }
        }

        function draw() {
            ctx.fillStyle = '#14161c'; ctx.fillRect(A.x, A.y, A.w, A.h);
            pts.forEach((p, i) => {
                const col = cfg.rainbow ? hsl((hue0 + i * (300 / cfg.count)) % 360, 75, 58) : '#f5f2ea';
                ctx.save();
                ctx.translate(p.x, p.y); ctx.rotate(p.a);
                // tik turgan domino: yo'lga ko'ndalang ingichka; yiqilganda yo'l bo'ylab uzayadi
                const len = T + (L - T) * p.f, wid = L - (L - T) * p.f;
                ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(-1 + p.f * 3, -wid / 2 + 3, len, wid);
                ctx.fillStyle = col;
                ctx.globalAlpha = 1 - p.f * 0.25;
                ctx.fillRect(0, -wid / 2, len, wid);
                ctx.restore();
            });
            // turtki beruvchi shar
            if (t < 1.2) {
                const p = pts[0], k = clamp(t / 0.8, 0, 1);
                ctx.fillStyle = PAL.accent; ctx.beginPath(); ctx.arc(p.x - Math.cos(p.a) * (60 * (1 - k) + 14), p.y - Math.sin(p.a) * (60 * (1 - k) + 14), 10, 0, TAU); ctx.fill();
            }
            text(ctx, `${Math.floor(front)} / ${cfg.count}`, W / 2, 156, { size: 72, weight: 300 });
            text(ctx, 'domino yiqildi', W / 2, 210, { size: 18, weight: 600, color: PAL.mute });
        }

        return { update, draw };
    }

    App.registry.register({
        id: 'domino',
        name: 'Domino',
        tagline: 'Yuzlab domino ketma-ket yiqiladi — spiral, ilon yoki yurak',
        help: 'Dominolar tanlangan shakl bo\'ylab ketma-ket yiqiladi, har biri taqillaydi. Shakl, soni va ranglarni sozlang. Davomiylik avtomatik moslanadi.',
        group: 'satisfying',
        tags: ['ASMR'],
        settings: SETTINGS,
        create,
    });
})(window.App = window.App || {});
