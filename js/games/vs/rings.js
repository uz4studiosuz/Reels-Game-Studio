/* games/vs/rings.js — "Halqalardan qochish": to'p aylanuvchi halqalar teshigidan chiqib ketishi kerak. */
(function (App) {
    'use strict';
    const VS = App.vs;
    const { clamp, TAU, hsl } = App.util;
    const { PAL } = App.draw;

    const SETTINGS = [
        { group: 'Halqalar', key: 'rings', label: 'Halqalar soni', type: 'range', min: 4, max: 10, step: 1, default: 8 },
        { key: 'gap', label: 'Teshik kengligi', type: 'range', min: 0.3, max: 1.2, step: 0.05, default: 0.68, hint: 'Radian; kichik = qiyinroq' },
        ...VS.sideSettings('a', 'Chap tomon', { name: '1 KATTA TO\'P', balls: 1, power: 1, radius: 12, bonus: 'double' }),
        ...VS.sideSettings('b', 'O\'ng tomon', { name: '40 TEZ TO\'P', balls: 40, power: 1, radius: 6, bonus: 'none' }),
    ];
    const CAP = 90;

    function create(env) {
        const { ctx, arena: A, cfg, fx, audio, rnd } = env;
        const [bl, br] = VS.boxes(A);
        const sides = [VS.makeSide(0, bl, cfg), VS.makeSide(1, br, cfg)];
        let won = false;
        for (const s of sides) {
            s.cx = s.box.x + s.box.w / 2; s.cy = s.box.y + s.box.h * 0.4;
            s.rings = Array.from({ length: cfg.rings }, (_, i) => ({
                R: 36 + i * ((s.box.w / 2 - 14 - 36) / Math.max(1, cfg.rings - 1)),
                angle: i * 0.7, spd: (i % 2 ? -1 : 1) * (0.022 + i * 0.003), base: cfg.gap, gap: cfg.gap, broken: false, started: false,
                hue: s.i ? 215 + i * 5 : i * 5,
            }));
        }
        const spawn = (s) => {
            const a = rnd(0, TAU), v = rnd(4.5, 7);
            return { x: s.cx + rnd(-9, 9), y: s.cy + rnd(-9, 9), vx: Math.cos(a) * v, vy: Math.sin(a) * v };
        };
        sides.forEach(s => VS.sync(s, CAP, spawn, true));
        const progress = (s) => Math.min(1, (s.rings.filter(r => r.broken).length + 1) / s.rings.length);

        function update() {
            const spd = env.speed;
            for (const s of sides) {
                const other = sides[1 - s.i], box = s.box, r = s.radius;
                for (const rg of s.rings) if (!rg.broken) rg.angle = (rg.angle + rg.spd * spd) % TAU;
                const act = s.rings.find(x => !x.broken);
                if (act) {
                    const gm = clamp(VS.pace(env, progress(s), progress(other)), 0.01, 2.2);
                    const target = gm < 0.05 ? 0 : act.base * gm;
                    if (!act.started) { act.gap = target; act.started = true; } else act.gap += (target - act.gap) * 0.15;
                }
                for (const b of s.balls) {
                    b.vy += 0.14 * spd; b.x += b.vx * spd; b.y += b.vy * spd;
                    if (b.x - r < box.x + 4) { b.x = box.x + 4 + r; b.vx = Math.abs(b.vx); }
                    if (b.x + r > box.x + box.w - 4) { b.x = box.x + box.w - 4 - r; b.vx = -Math.abs(b.vx); }
                    if (b.y - r < box.y + 4) { b.y = box.y + 4 + r; b.vy = Math.abs(b.vy); }
                    if (b.y + r > box.y + box.h - 4) { b.y = box.y + box.h - 4 - r; b.vy = -Math.abs(b.vy) * 0.9; }
                    if (!act) continue;
                    const dx = b.x - s.cx, dy = b.y - s.cy, d = Math.hypot(dx, dy);
                    if (d + r < act.R) continue;
                    let a = Math.atan2(dy, dx); if (a < 0) a += TAU;
                    let diff = Math.abs(a - act.angle); if (diff > Math.PI) diff = TAU - diff;
                    if (diff < act.gap * 0.5) {
                        act.broken = true;
                        fx.burst(s.cx + Math.cos(act.angle) * act.R, s.cy + Math.sin(act.angle) * act.R, 22, { hue: act.hue, speed: 360 });
                        audio.boom();
                        VS.applyBonus(s, CAP, spawn);
                        b.x = s.cx + rnd(-7, 7); b.y = s.cy + rnd(-7, 7);
                        if (s.rings.every(x => x.broken) && !won) {
                            won = true;
                            env.finish({ kicker: 'QOCHDI', title: s.name, sub: 'barcha halqalardan', color: s.col.main });
                        }
                        break;
                    }
                    const nx = dx / (d || 1), ny = dy / (d || 1);
                    b.x = s.cx + nx * (act.R - r - 1); b.y = s.cy + ny * (act.R - r - 1);
                    const dot = b.vx * nx + b.vy * ny;
                    b.vx = b.vx - 2 * dot * nx + rnd(-0.6, 0.6); b.vy = b.vy - 2 * dot * ny + rnd(-0.6, 0.6);
                    const mag = Math.hypot(b.vx, b.vy) || 1, t = clamp(mag, 5.2, 8.5);
                    b.vx *= t / mag; b.vy *= t / mag;
                    audio.tone(300 + s.i * 120 + rnd(0, 80), 0.04, 'sine', 0.04, 0.5);
                }
            }
        }

        function draw() {
            for (const s of sides) {
                const done = s.rings.filter(r => r.broken).length;
                VS.header(ctx, s, `halqa ${Math.min(s.rings.length, done + 1)} / ${s.rings.length}`);
                VS.frameBox(ctx, s);
                for (const rg of s.rings) {
                    if (rg.broken) continue;
                    ctx.strokeStyle = hsl(rg.hue, 85, 60); ctx.lineWidth = 6; ctx.lineCap = 'round';
                    ctx.beginPath();
                    if (rg.gap <= 0.001) ctx.arc(s.cx, s.cy, rg.R, 0, TAU);
                    else ctx.arc(s.cx, s.cy, rg.R, rg.angle + rg.gap / 2, rg.angle + TAU - rg.gap / 2);
                    ctx.stroke();
                }
                VS.drawBalls(ctx, s);
            }
        }

        return { update, draw };
    }

    App.registry.register({
        id: 'rings',
        name: 'Halqalardan qochish',
        tagline: 'Aylanuvchi halqalar teshigidan kim birinchi chiqadi',
        help: 'To\'p aylanuvchi halqalar teshigidan chiqib ketishi kerak. Halqalar soni va teshik kengligi qiyinlikni belgilaydi.',
        group: 'battle',
        tags: ['VS'],
        settings: SETTINGS,
        create,
    });
})(window.App = window.App || {});
