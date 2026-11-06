/* games/note-ring.js — "Musiqali halqa": to'plar halqa ichida sakraydi, har urilish nota chaladi va halqa nur sochadi.
 * Halqa asta torayadi — ritm tezlashadi (ASMR). */
(function (App) {
    'use strict';
    const { clamp, TAU, hsl } = App.util;
    const { text, PAL } = App.draw;

    const SCALES = {
        penta: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21],
        major: [0, 2, 4, 5, 7, 9, 11, 12, 14, 16],
        minor: [0, 2, 3, 5, 7, 8, 10, 12, 14, 15],
    };

    const SETTINGS = [
        { group: 'To\'plar', key: 'balls', label: 'To\'plar soni', type: 'range', min: 1, max: 16, step: 1, default: 6 },
        { key: 'gravity', label: 'Og\'irlik', type: 'range', min: 0.1, max: 0.5, step: 0.02, default: 0.22 },
        { group: 'Musiqa', key: 'scale', label: 'Gamma', type: 'segment', default: 'penta', options: [['penta', 'Pentatonik'], ['major', 'Major'], ['minor', 'Minor']] },
        { key: 'shrink', label: 'Halqa torayadi', type: 'toggle', default: true },
        { key: 'trails', label: 'Iz qoldirish', type: 'toggle', default: true },
    ];

    function create(env) {
        const { ctx, W, arena: A, cfg, audio, rnd } = env;
        const cx = W / 2, cy = A.y + A.h * 0.5, R0 = 300;
        const scale = SCALES[cfg.scale];
        const SEG = 36;
        const seg = new Array(SEG).fill(0);
        const hue0 = Math.round(rnd(0, 360));
        const balls = Array.from({ length: cfg.balls }, (_, i) => {
            const a = rnd(0, TAU), d = rnd(0, 120);
            return { x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d - 60, vx: rnd(-3, 3), vy: rnd(-2, 2), r: 13, hue: (hue0 + i * (360 / cfg.balls)) % 360, trail: [] };
        });
        let hits = 0, done = false;
        const R = () => (cfg.shrink ? R0 - (R0 - 170) * clamp(env.sched() / 0.95, 0, 1) : R0);

        function update() {
            const sp = env.speed, S = 2, h = sp / S, Rr = R();
            for (let k = 0; k < SEG; k++) seg[k] = Math.max(0, seg[k] - 0.03);
            for (let st = 0; st < S; st++) {
                for (const b of balls) {
                    b.vy += cfg.gravity * h; b.x += b.vx * h; b.y += b.vy * h;
                    const dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy);
                    if (d + b.r >= Rr) {
                        const nx = dx / d, ny = dy / d;
                        b.x = cx + nx * (Rr - b.r); b.y = cy + ny * (Rr - b.r);
                        const vn = b.vx * nx + b.vy * ny;
                        if (vn > 0) {
                            b.vx -= 2 * vn * nx; b.vy -= 2 * vn * ny;
                            const v = Math.hypot(b.vx, b.vy); // energiyani biroz oshirib turamiz: to'xtab qolmasin
                            const t = clamp(v * 1.02, 4, 13); b.vx *= t / v; b.vy *= t / v;
                            let ang = Math.atan2(dy, dx); if (ang < 0) ang += TAU;
                            const k = Math.floor(ang / TAU * SEG) % SEG;
                            seg[k] = 1;
                            audio.note(scale[k % scale.length] / 2 + 2 + Math.floor(k / scale.length) * 0, 0.45, 'sine', 0.09);
                            hits++;
                        }
                    }
                }
            }
            for (const b of balls) if (cfg.trails) { b.trail.push([b.x, b.y]); if (b.trail.length > 14) b.trail.shift(); }
            if (!done && env.sched() >= 1) {
                done = true;
                env.finish({ kicker: 'MELODIYA TUGADI', title: `${hits} ta nota`, sub: 'Yoqdimi? Obuna bo\'l', color: PAL.accent });
            }
        }

        function draw() {
            const Rr = R();
            for (let k = 0; k < SEG; k++) {
                const a0 = k / SEG * TAU, a1 = (k + 1) / SEG * TAU - 0.04;
                ctx.beginPath(); ctx.arc(cx, cy, Rr, a0, a1);
                ctx.lineWidth = 8 + seg[k] * 10;
                ctx.strokeStyle = seg[k] > 0.02 ? hsl((hue0 + k * 10) % 360, 90, 55 + seg[k] * 25) : 'rgba(245,242,234,.22)';
                ctx.stroke();
            }
            for (const b of balls) {
                if (cfg.trails) for (let k = 0; k < b.trail.length; k++) {
                    ctx.fillStyle = hsl(b.hue, 85, 62, (k / b.trail.length) * 0.25);
                    ctx.beginPath(); ctx.arc(b.trail[k][0], b.trail[k][1], b.r * (k / b.trail.length), 0, TAU); ctx.fill();
                }
                ctx.fillStyle = hsl(b.hue, 85, 64);
                ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
            }
            text(ctx, String(hits), W / 2, 150, { size: 84, weight: 300 });
            text(ctx, 'nota', W / 2, 206, { size: 18, weight: 600, color: PAL.mute });
        }

        return { update, draw };
    }

    App.registry.register({
        id: 'noteRing',
        name: 'Musiqali halqa',
        tagline: 'Har urilish — bitta nota. Ritm asta tezlashadi',
        help: 'To\'plar halqa ichida sakraydi, har urilish nota chaladi. Gamma va to\'plar soni musiqani o\'zgartiradi.',
        group: 'satisfying',
        tags: ['ASMR', 'musiqa'],
        settings: SETTINGS,
        create,
    });
})(window.App = window.App || {});
