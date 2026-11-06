/* games/sumo.js — "Sumo": nik-sharlar dumaloq platformada bir-birini itarib tushiradi, platforma torayadi. */
(function (App) {
    'use strict';
    const { clamp, lerp, TAU } = App.util;
    const { text, fit, token, PAL } = App.draw;

    const SETTINGS = [
        { group: 'Ishtirokchilar', key: 'players', label: 'O\'yinchilar', type: 'range', min: 4, max: 20, step: 1, default: 12 },
        { key: 'useRoster', label: 'Obunachi nikidan foydalanish', type: 'toggle', default: true },
        { key: 'names', label: 'Ismlar ko\'rinsin', type: 'toggle', default: true },
        { group: 'Jang', key: 'power', label: 'Zarba kuchi', type: 'range', min: 0.5, max: 2, step: 0.1, default: 1, unit: '×' },
        { key: 'mass', label: 'Og\'irlik farqi', type: 'range', min: 0, max: 1, step: 0.1, default: 0.5, hint: 'Og\'ir shar kam itariladi, lekin sekinroq' },
        { key: 'shrink', label: 'Platforma torayadi', type: 'toggle', default: true },
    ];

    function create(env) {
        const { ctx, W, cfg, fx, audio, rnd } = env;
        const CX = W / 2, CY = 690, R0 = 310;
        const n = cfg.players;
        const base = clamp(R0 * 0.62 / Math.sqrt(n) * 0.9, 17, 34);
        const B = env.participants(n).map((p, i) => {
            const m = 1 + (rnd(0, 1) - 0.5) * cfg.mass * 1.4;
            const a = (i / n) * TAU + rnd(-0.2, 0.2), d = 110 + rnd(0, 70);
            return { p, i, m, r: base * Math.sqrt(m), x: CX + Math.cos(a) * d, y: CY + Math.sin(a) * d, vx: 0, vy: 0, alive: true, fall: 0, dash: rnd(30, 90), flash: 0 };
        });
        let R = R0, out = 0, over = false, endT = 0, lastOut = null;
        const alive = () => B.filter(b => b.alive).length;

        function update() {
            const sp = env.speed, s = env.sched();
            if (cfg.shrink) R = lerp(R0, s > 1 ? 105 : 160, clamp((s - 0.18) / 0.72, 0, 1));
            const prog = out / Math.max(1, n - 1);
            const pm = clamp(1 + (s - prog) * 3, 0.55, 2.2) * cfg.power; // jadvalga yaqin

            for (const b of B) {
                if (b.flash > 0) b.flash = Math.max(0, b.flash - 0.08);
                if (b.fall) { b.fall++; b.x += b.vx * sp; b.y += b.vy * sp; if (b.fall > 40) { b.fall = 0; b.gone = true; } continue; }
                if (!b.alive) continue;
                // sun'iy aql: ba'zan eng yaqin yoki tasodifiy raqibga tashlanadi
                b.dash -= sp;
                if (b.dash <= 0) {
                    const foes = B.filter(o => o.alive && o !== b && !o.fall);
                    if (foes.length) {
                        let t = foes[Math.floor(rnd(0, foes.length))];
                        if (rnd(0, 1) < 0.55) t = foes.reduce((a, o) => (Math.hypot(o.x - b.x, o.y - b.y) < Math.hypot(a.x - b.x, a.y - b.y) ? o : a));
                        const d = Math.hypot(t.x - b.x, t.y - b.y) || 1;
                        const f = (3.6 + rnd(0, 2.2)) * pm / Math.sqrt(b.m);
                        b.vx += (t.x - b.x) / d * f; b.vy += (t.y - b.y) / d * f;
                        audio.tone(200 + b.i * 8, 0.05, 'triangle', 0.03);
                    }
                    b.dash = rnd(35, 95);
                }
                b.vx *= Math.pow(0.975, sp); b.vy *= Math.pow(0.975, sp);
                b.x += b.vx * sp; b.y += b.vy * sp;
            }
            // to'qnashuvlar (massaga bog'liq)
            for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
                const a = B[i], c = B[j];
                if (!a.alive || !c.alive || a.fall || c.fall) continue;
                const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy), min = a.r + c.r;
                if (d >= min || d === 0) continue;
                const nx = dx / d, ny = dy / d, tm = a.m + c.m, ov = min - d;
                a.x -= nx * ov * (c.m / tm); a.y -= ny * ov * (c.m / tm);
                c.x += nx * ov * (a.m / tm); c.y += ny * ov * (a.m / tm);
                const rv = (a.vx - c.vx) * nx + (a.vy - c.vy) * ny;
                if (rv > 0) {
                    const j2 = (1.85 * rv) / (1 / a.m + 1 / c.m);
                    a.vx -= j2 / a.m * nx; a.vy -= j2 / a.m * ny; c.vx += j2 / c.m * nx; c.vy += j2 / c.m * ny;
                    a.flash = c.flash = 1;
                    if (rv > 1.2) { audio.hit(rv); if (rv > 4) fx.burst((a.x + c.x) / 2, (a.y + c.y) / 2, 5, { hue: 40, speed: 200, life: 0.3, size: 3, grav: 0 }); }
                }
            }
            // platformadan tushish
            for (const b of B) {
                if (!b.alive || b.fall) continue;
                if (Math.hypot(b.x - CX, b.y - CY) > R + b.r * 0.25) {
                    b.alive = false; b.fall = 1; out++; lastOut = b;
                    fx.kick(6); audio.lose();
                    if (b.p.nick) env.say(App.tts.pick([`${App.roster.spoken(b.p)} platformadan tushib ketdi`, `${App.roster.spoken(b.p)} itarib tushirildi!`, `Ketdi! ${App.roster.spoken(b.p)} chiqdi`]), { key: 'fall', cooldown: 5000 });
                }
            }
            if (!over && alive() <= 1) { over = true; }
            if (over && ++endT === 45) {
                const w = B.find(b => b.alive) || lastOut;
                env.finish({ winner: w.p, kicker: 'PLATFORMADA QOLDI', title: App.roster.display(w.p), sub: `${n} kishidan`, color: App.util.hsl(w.p.hue, 75, 60) });
            }
        }

        function draw() {
            // platforma
            ctx.beginPath(); ctx.arc(CX, CY, R, 0, TAU);
            ctx.fillStyle = '#1b1b21'; ctx.fill();
            ctx.lineWidth = 8; ctx.strokeStyle = PAL.ink; ctx.stroke();
            ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(245,242,234,.12)';
            for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.arc(CX, CY, R * k / 4, 0, TAU); ctx.stroke(); }
            for (const b of B) {
                if (b.gone) continue;
                const sc = b.fall ? Math.max(0, 1 - b.fall / 40) : 1;
                ctx.save(); ctx.translate(b.x, b.y); ctx.scale(sc, sc);
                token(ctx, b.p, 0, 0, b.r, { fill: b.flash > 0.5 ? '#fff' : undefined });
                ctx.restore();
                if (cfg.names && b.alive) text(ctx, fit(ctx, App.roster.display(b.p), 110, 15, 700), b.x, b.y + b.r + 15, { size: 15, weight: 700, alpha: 0.85 });
            }
            text(ctx, String(alive()), W / 2 - 4, 150, { size: 84, weight: 300, align: 'right' });
            text(ctx, `/ ${n}`, W / 2 + 4, 162, { size: 30, weight: 600, color: PAL.mute, align: 'left' });
            text(ctx, 'platformada', W / 2, 206, { size: 18, weight: 600, color: PAL.mute });
        }

        return { update, draw };
    }

    App.registry.register({
        id: 'sumo',
        name: 'Sumo',
        tagline: 'Platformadan itarib tushir — oxirgisi qoladi',
        help: 'Sharlar dumaloq platformada bir-birini itaradi, platforma torayadi. Zarba kuchi va og\'irlik farqini sozlang.',
        group: 'nick',
        roster: true,
        tags: ['jang'],
        settings: SETTINGS,
        create,
    });
})(window.App = window.App || {});
