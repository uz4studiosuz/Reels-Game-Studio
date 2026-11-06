/* games/multiply.js — "To'plar ko'payishi": istalgan to'p devorga urilsa, ikkiga bo'linadi.
 * Ko'rinadigan to'plar soni chegaralangan (600); undan keyin har urilish yashirin to'plarni ham hisobga qo'shadi. */
(function (App) {
    'use strict';
    const { clamp, TAU, hsl } = App.util;
    const { text, PAL } = App.draw;

    const VISUAL_CAP = 600;

    const SETTINGS = [
        { group: 'Maqsad', key: 'target', label: 'Maqsad son', type: 'range', min: 100, max: 5000, step: 50, default: 1000 },
        { group: 'Shakl', key: 'sides', label: 'Burchaklar', type: 'range', min: 3, max: 8, step: 1, default: 6 },
        { key: 'spin', label: 'Aylanish tezligi', type: 'range', min: 0, max: 0.03, step: 0.002, default: 0.01 },
        { key: 'gravity', label: 'Og\'irlik', type: 'range', min: 0, max: 0.12, step: 0.005, default: 0.04 },
        { key: 'rainbow', label: 'Rangli', type: 'toggle', default: true },
    ];

    function create(env) {
        const { ctx, W, arena: A, cfg, audio, fx, rnd } = env;
        const cx = A.x + A.w / 2, cy = A.y + A.h * 0.52, Rad = 300, N = cfg.sides;
        const ap = Rad * Math.cos(Math.PI / N);
        const hue0 = Math.round(rnd(0, 360));
        // Tezlik: har urilish sonni 2 baravar oshiradi, demak log2(maqsad) marta urilish kerak.
        // Urilishlar oralig'i tanlangan davomiylikka mos bo'lishi uchun to'p tezligi hisoblanadi.
        const doublings = Math.log2(cfg.target);
        const hitSec = (1.8 * env.targetSec) / doublings;
        const V = clamp((ap * 1.5) / (hitSec * 60), 0.3, 7);
        let rot = 0, count = 1, disp = 1, pulse = 0, done = false;

        // boshida to'plar tezroq (ko'payish darrov ko'rinsin), keyin asl tezlikka tushadi
        const vNow = () => V * (count < 16 ? 4 : count < 64 ? 2.4 : count < 256 ? 1.5 : 1);
        const mk = (x, y, idx, ang) => {
            const a = ang !== undefined ? ang : rnd(0, TAU), v = vNow();
            return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 8, hue: cfg.rainbow ? (hue0 + idx * 0.7) % 360 : 40, trail: [], flash: 0 };
        };
        const balls = [mk(cx, cy - 20, 1)];
        const first = balls[0]; // birinchi to'p tezligini tekshirish uchun (debug)

        // jadval: o'sish tanlangan vaqtga mos eksponentsial egri chiziqdan ancha oldinga o'tib ketmasin
        // (boshida bir necha marta tez ikkilanishga ruxsat: tomoshabin darrov ko'rsin)
        const allowed = () => Math.pow(cfg.target, clamp((env.sched() + 0.3) / 1.2, 0, 1)) * 1.6 + 4;

        function update() {
            const sp = env.speed, S = 2, h = sp / S;
            rot += cfg.spin * sp;
            pulse = Math.max(0, pulse - 0.06);
            disp += (count - disp) * 0.2;
            const hits = [];
            const n0 = balls.length;
            for (let st = 0; st < S; st++) {
                for (let bi = 0; bi < n0; bi++) {
                    const b = balls[bi];
                    b.x += b.vx * h; b.y += b.vy * h; b.vy += cfg.gravity * h * (V / 4);
                    b.flash = Math.max(0, b.flash - 0.05);
                    let dx = b.x - cx, dy = b.y - cy;
                    for (let i = 0; i < N; i++) {
                        const th = rot + (i + 0.5) * TAU / N, nx = Math.cos(th), ny = Math.sin(th);
                        const d = dx * nx + dy * ny;
                        if (d + b.r <= ap) continue;
                        const pen = d + b.r - ap;
                        b.x -= nx * pen; b.y -= ny * pen; dx = b.x - cx; dy = b.y - cy;
                        const wvx = -cfg.spin * dy, wvy = cfg.spin * dx;
                        let rvx = b.vx - wvx, rvy = b.vy - wvy;
                        const vn = rvx * nx + rvy * ny;
                        if (vn > 0) {
                            rvx -= 2 * vn * nx; rvy -= 2 * vn * ny;
                            b.vx = rvx + wvx; b.vy = rvy + wvy;
                            if (vn > V * 0.25) hits.push({ b, nx, ny });
                        }
                    }
                    const v = Math.hypot(b.vx, b.vy);
                    const hi = V * 4.6, lo = V * 0.8;
                    if (v > hi) { b.vx *= hi / v; b.vy *= hi / v; } else if (v < lo) { b.vx *= lo / (v || 1); b.vy *= lo / (v || 1); }
                }
            }
            // HAR QAYSI to'p urilsa — ikkiga bo'linadi
            for (const hit of hits) {
                if (done || count >= cfg.target) break;
                if (count >= allowed()) continue;
                const b = hit.b;
                b.flash = 1;
                if (balls.length < VISUAL_CAP) {
                    // yangi to'p urilgan to'pning o'rnidan, biroz boshqa burchak bilan chiqadi
                    const ang = Math.atan2(b.vy, b.vx) + (rnd(0, 1) < 0.5 ? -1 : 1) * rnd(0.5, 1.1);
                    const nb = mk(b.x - hit.nx * 12, b.y - hit.ny * 12, count, ang);
                    nb.flash = 1;
                    balls.push(nb);
                    count++;
                } else {
                    // ko'rinmaydigan to'plar ham bo'linadi: nisbat bo'yicha qo'shiladi
                    count = Math.min(cfg.target, count + Math.max(1, Math.floor(count / balls.length)));
                }
                pulse = 1;
                if (count % 2 === 0) audio.note(Math.floor(count / 4) % 24, 0.16, 'sine', 0.08);
            }
            const trails = balls.length < 160;
            for (const b of balls) {
                if (trails) { b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > 7) b.trail.shift(); } else b.trail.length = 0;
            }
            if (!done && count >= cfg.target) {
                done = true;
                for (let k = 0; k < 8; k++) fx.burst(rnd(A.x + 100, A.x + A.w - 100), rnd(A.y + 150, A.y + 600), 24, { hue: rnd(0, 360) });
                env.finish({ kicker: 'MAQSADGA YETDI', title: `${cfg.target} ta to'p`, sub: '1 ta to\'pdan boshlandi', color: PAL.accent });
            }
        }

        function draw() {
            const hueC = (hue0 + count * 0.4) % 360;
            ctx.save();
            ctx.beginPath();
            for (let i = 0; i <= N; i++) {
                const a = rot + i * TAU / N, x = cx + Math.cos(a) * Rad, y = cy + Math.sin(a) * Rad;
                if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
            }
            ctx.closePath(); ctx.lineJoin = 'round';
            ctx.lineWidth = 6 + pulse * 5;
            ctx.strokeStyle = cfg.rainbow ? hsl(hueC, 85, 62) : PAL.ink;
            ctx.stroke();
            ctx.globalCompositeOperation = 'lighter';
            for (const b of balls) {
                for (let t = 0; t < b.trail.length; t++) {
                    ctx.fillStyle = hsl(b.hue, 90, 55, 0.07 * t);
                    ctx.beginPath(); ctx.arc(b.trail[t].x, b.trail[t].y, b.r * (t / b.trail.length), 0, TAU); ctx.fill();
                }
                ctx.fillStyle = hsl(b.hue, 90, 62 + b.flash * 25, 0.9);
                ctx.beginPath(); ctx.arc(b.x, b.y, b.r + b.flash * 3, 0, TAU); ctx.fill();
            }
            ctx.restore();
            text(ctx, String(Math.round(disp)), W / 2, 156, { size: 96 + pulse * 8, weight: 300 });
            text(ctx, `maqsad ${cfg.target}`, W / 2, 218, { size: 18, weight: 600, color: PAL.mute });
        }

        return { update, draw, debug: () => ({ balls, count, first }) };
    }

    App.registry.register({
        id: 'multiply',
        name: 'To\'plar ko\'payishi',
        tagline: 'Har urilgan to\'p ikkiga bo\'linadi — 1 dan minglabgacha',
        help: 'Devorga urilgan har bir to\'p ikkiga bo\'linadi. Maqsad son va shakl (burchaklar) sozlanadi.',
        group: 'satisfying',
        tags: ['ASMR'],
        settings: SETTINGS,
        create,
    });
})(window.App = window.App || {});
