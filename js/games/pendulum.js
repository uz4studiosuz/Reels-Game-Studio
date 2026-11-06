/* games/pendulum.js — "Mayatnik to'lqini": turli uzunlikdagi mayatniklar bir vaqtda boshlanadi va chiroyli to'lqin
 * hosil qiladi; oxirida hammasi yana bir chiziqqa tekislanadi. Har o'tishda nota chalinadi (ASMR). */
(function (App) {
    'use strict';
    const { clamp, TAU, hsl } = App.util;
    const { text, PAL } = App.draw;

    const SETTINGS = [
        { group: 'Mayatniklar', key: 'count', label: 'Soni', type: 'range', min: 8, max: 36, step: 1, default: 22 },
        { key: 'amp', label: 'Tebranish kengligi', type: 'range', min: 0.1, max: 0.5, step: 0.02, default: 0.26 },
        { group: 'Ovoz', key: 'sound', label: 'Nota chalish', type: 'toggle', default: true },
        { key: 'trails', label: 'Iz qoldirish', type: 'toggle', default: true },
        { key: 'rainbow', label: 'Rangli', type: 'toggle', default: true },
    ];

    function create(env) {
        const { ctx, W, arena: A, cfg, audio } = env;
        const n = cfg.count;
        const Tc = env.targetSec;                 // bitta to'liq davr: shu vaqtdan keyin hammasi tekislanadi
        const N0 = Math.round(Tc / 2.1);
        const y0 = A.y + 70, L0 = 720;
        const hue0 = Math.round(env.rnd(0, 360));
        const P = Array.from({ length: n }, (_, i) => {
            const osc = N0 + i;
            return { i, w: TAU * osc / Tc, L: L0 * Math.pow(N0 / osc, 2), x: A.x + 40 + (A.w - 80) * (i / (n - 1)), prev: 1, trail: [] };
        });
        let tsec = 0, done = false, notes = 0;

        function update() {
            tsec += env.speed / 60;
            for (const p of P) {
                const th = cfg.amp * Math.cos(p.w * tsec);
                const side = Math.sign(Math.sin(p.w * tsec)) || 1; // markazdan o'tish
                const crossing = Math.sign(th) !== Math.sign(p.prev) && Math.abs(th) < cfg.amp * 0.5;
                if (crossing && cfg.sound) { audio.note(Math.round((n - p.i) * 0.9), 0.5, 'sine', 0.07); notes++; }
                p.prev = th;
                p.th = th;
                p.bx = p.x + p.L * Math.sin(th);
                p.by = y0 + p.L * Math.cos(th);
                p.flash = crossing ? 1 : Math.max(0, (p.flash || 0) - 0.05);
                if (cfg.trails) { p.trail.push([p.bx, p.by]); if (p.trail.length > 18) p.trail.shift(); }
            }
            if (!done && tsec >= Tc) {
                done = true;
                env.finish({ kicker: 'TUGADI', title: 'Mukammal ritm', sub: `${notes} ta nota chalindi`, color: PAL.accent });
            }
        }

        function draw() {
            ctx.fillStyle = PAL.ink; ctx.fillRect(A.x + 20, y0 - 6, A.w - 40, 6);
            for (const p of P) {
                const hue = cfg.rainbow ? (hue0 + p.i * (300 / n)) % 360 : 40;
                ctx.strokeStyle = 'rgba(245,242,234,.18)'; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.moveTo(p.x, y0); ctx.lineTo(p.bx, p.by); ctx.stroke();
                if (cfg.trails) for (let k = 0; k < p.trail.length; k++) {
                    ctx.fillStyle = hsl(hue, 85, 62, (k / p.trail.length) * 0.22);
                    ctx.beginPath(); ctx.arc(p.trail[k][0], p.trail[k][1], 10 * (k / p.trail.length), 0, TAU); ctx.fill();
                }
                ctx.fillStyle = hsl(hue, 85, 62 + p.flash * 25);
                ctx.beginPath(); ctx.arc(p.bx, p.by, 13 + p.flash * 5, 0, TAU); ctx.fill();
            }
            text(ctx, String(Math.max(0, Math.ceil(Tc - tsec))), W / 2, 150, { size: 84, weight: 300 });
            text(ctx, 'soniyada tekislanadi', W / 2, 206, { size: 18, weight: 600, color: PAL.mute });
        }

        return { update, draw };
    }

    App.registry.register({
        id: 'pendulum',
        name: 'Mayatnik to\'lqini',
        tagline: 'Hipnotik to\'lqin va notalar — oxirida hammasi tekislanadi',
        help: 'Turli uzunlikdagi mayatniklar to\'lqin hosil qiladi, oxirida hammasi tekislanadi. Har o\'tishda nota chalinadi.',
        group: 'satisfying',
        tags: ['ASMR', 'musiqa'],
        settings: SETTINGS,
        create,
    });
})(window.App = window.App || {});
