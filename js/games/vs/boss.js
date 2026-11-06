/* games/vs/boss.js — "Boss jangi": ikki tomon o'z bossini yiqitishga uringan, kim birinchi. */
(function (App) {
    'use strict';
    const VS = App.vs;
    const { fmt } = App.util;
    const { text, PAL } = App.draw;

    const SETTINGS = [
        { group: 'Boss', key: 'bossHp', label: 'Boss joni', type: 'number', min: 1000, max: 500000, step: 1000, default: 30100 },
        { key: 'bossSize', label: 'Boss o\'lchami', type: 'range', min: 40, max: 100, step: 2, default: 68 },
        ...VS.sideSettings('a', 'Chap tomon', { name: '1 MEGA SNAYPER', balls: 1, power: 120, radius: 14, bonus: 'double' }),
        ...VS.sideSettings('b', 'O\'ng tomon', { name: '500 MINI ARMIYA', balls: 500, power: 2, radius: 5, bonus: 'plus50' }),
    ];
    const CAP = 420;

    function create(env) {
        const { ctx, arena: A, cfg, fx, audio, rnd } = env;
        const [bl, br] = VS.boxes(A);
        const sides = [VS.makeSide(0, bl, cfg), VS.makeSide(1, br, cfg)];
        let won = false;
        for (const s of sides) {
            s.boss = { x: s.box.x + s.box.w / 2, y: s.box.y + s.box.h * 0.54, vx: 2.2 * (s.i ? -1 : 1), vy: 1.4, r: cfg.bossSize, hp: cfg.bossHp, flash: 0, hits: 0 };
        }
        const spawn = (s) => ({ x: s.box.x + s.radius + 6 + rnd(0, s.box.w - s.radius * 2 - 12), y: s.box.y + 60 + rnd(0, 300), vx: rnd(-3, 3), vy: rnd(-2, 2), trail: [] });
        sides.forEach(s => VS.sync(s, CAP, spawn, true));
        const progress = (s) => 1 - s.boss.hp / cfg.bossHp;

        function update() {
            const spd = env.speed;
            for (const s of sides) {
                const { boss, box } = s, other = sides[1 - s.i], r = s.radius;
                if (boss.hp <= 0) continue;
                boss.x += boss.vx * spd; boss.y += boss.vy * spd;
                if (boss.x - boss.r < box.x + 12) { boss.x = box.x + 12 + boss.r; boss.vx = Math.abs(boss.vx); }
                if (boss.x + boss.r > box.x + box.w - 12) { boss.x = box.x + box.w - 12 - boss.r; boss.vx = -Math.abs(boss.vx); }
                if (boss.y - boss.r < box.y + 120) { boss.y = box.y + 120 + boss.r; boss.vy = Math.abs(boss.vy); }
                if (boss.y + boss.r > box.y + box.h - 40) { boss.y = box.y + box.h - 40 - boss.r; boss.vy = -Math.abs(boss.vy); }
                boss.flash = Math.max(0, boss.flash - 0.1);
                const wr = VS.weight(s), mul = VS.pace(env, progress(s), progress(other));
                for (const b of s.balls) {
                    b.vy += 0.2 * spd; b.x += b.vx * spd; b.y += b.vy * spd;
                    if (b.x - r < box.x + 4) { b.x = box.x + 4 + r; b.vx = Math.abs(b.vx); }
                    if (b.x + r > box.x + box.w - 4) { b.x = box.x + box.w - 4 - r; b.vx = -Math.abs(b.vx); }
                    if (b.y - r < box.y + 4) { b.y = box.y + 4 + r; b.vy = Math.abs(b.vy); }
                    if (b.y + r > box.y + box.h - 4) { b.y = box.y + box.h - 4 - r; b.vy = -(8 + rnd(0, 6)); b.vx += rnd(-2.5, 2.5); }
                    const dx = b.x - boss.x, dy = b.y - boss.y, d = Math.hypot(dx, dy);
                    if (d < r + boss.r && d > 0) {
                        const nx = dx / d, ny = dy / d;
                        b.x = boss.x + nx * (boss.r + r + 2); b.y = boss.y + ny * (boss.r + r + 2);
                        const v = Math.max(7.5, Math.hypot(b.vx, b.vy));
                        b.vx = nx * v + rnd(-1, 1); b.vy = ny * v;
                        boss.hp -= s.power * wr * mul;
                        boss.flash = 1; boss.hits++;
                        audio.tone(280 + s.i * 110 + rnd(0, 100), 0.045, 'sine', 0.05, 0.4);
                        if (boss.hits % 25 === 0) VS.applyBonus(s, CAP, spawn);
                        if (boss.hp <= 0) {
                            boss.hp = 0;
                            fx.burst(boss.x, boss.y, 40, { hue: s.i ? 220 : 12, speed: 520 });
                            fx.kick(10);
                            audio.boom();
                            if (!won) { won = true; env.finish({ kicker: 'BOSS YIQILDI', title: s.name, sub: `${fmt(s.logical)} ta to'p bilan`, color: s.col.main }); }
                            break;
                        }
                    }
                }
            }
        }

        function draw() {
            for (const s of sides) {
                const { boss } = s;
                VS.header(ctx, s, `boss ${fmt(boss.hp)}`);
                VS.frameBox(ctx, s);
                if (boss.hp > 0) {
                    ctx.beginPath(); ctx.arc(boss.x, boss.y, boss.r, 0, Math.PI * 2);
                    ctx.fillStyle = boss.flash > 0.2 ? '#fff' : s.col.dim; ctx.fill();
                    ctx.lineWidth = 4; ctx.strokeStyle = s.col.main; ctx.stroke();
                    text(ctx, '👾', boss.x, boss.y - 12, { size: 38 });
                    text(ctx, fmt(boss.hp), boss.x, boss.y + 26, { size: 18, weight: 800 });
                }
                VS.drawBalls(ctx, s);
            }
            text(ctx, 'VS', A.x + A.w / 2, 160, { size: 20, weight: 800, color: PAL.mute });
        }

        return { update, draw };
    }

    App.registry.register({
        id: 'boss',
        name: 'Boss jangi',
        tagline: 'Bitta kuchli to\'p yoki ko\'p kichiklari — bossni kim yiqitadi',
        help: 'Har tomon o\'z bossini yiqitadi. Boss joni, o\'lchami va har tomon kuchini sozlang.',
        group: 'battle',
        tags: ['VS'],
        settings: SETTINGS,
        create,
    });
})(window.App = window.App || {});
