/* games/vs/floors.js — "Qavatlarni sindirish": ikki tomon bir xil qavatlarni sindiradi, birinchi tugatgan yutadi. */
(function (App) {
    'use strict';
    const VS = App.vs;
    const { text, PAL } = App.draw;
    const { fmt, clamp } = App.util;

    const SETTINGS = [
        { group: 'Qavatlar', key: 'floors', label: 'Qavat jonlari', type: 'text', default: '100, 500, 1000, 1500, 2000, 3000, 4000, 5000, 6000, 7000', hint: 'Vergul bilan; har biri bir qavat' },
        ...VS.sideSettings('a', 'Chap tomon', { name: 'X100', balls: 1, power: 25, radius: 11, bonus: 'double' }),
        ...VS.sideSettings('b', 'O\'ng tomon', { name: '+300', balls: 1500, power: 1, radius: 5, bonus: 'plus300' }),
    ];
    const CAP = 420;

    function create(env) {
        const { ctx, arena: A, cfg, fx, audio, rnd } = env;
        let hpList = cfg.floors.split(',').map(s => parseInt(s.trim(), 10)).filter(n => n > 0);
        if (!hpList.length) hpList = [100, 500, 1000, 2000, 5000];
        const [bl, br] = VS.boxes(A);
        const sides = [VS.makeSide(0, bl, cfg), VS.makeSide(1, br, cfg)];
        for (const s of sides) {
            const gap = s.box.h / (hpList.length + 1);
            s.floors = hpList.map((hp, i) => ({ y: s.box.y + gap * (i + 1), hp, max: hp, broken: false, flash: 0 }));
        }
        const spawn = (s, initial) => {
            const act = s.floors.find(f => !f.broken);
            const maxY = act ? Math.max(s.box.y + 30, act.y - s.radius - 6) : s.box.y + 120;
            return {
                x: s.box.x + s.radius + 8 + rnd(0, s.box.w - s.radius * 2 - 16),
                y: s.box.y + s.radius + 8 + rnd(0, Math.max(15, maxY - s.box.y - 24)),
                vx: rnd(-3.5, 3.5), vy: rnd(-2.5, 2.5), trail: [],
            };
        };
        sides.forEach(s => VS.sync(s, CAP, spawn, true));
        let won = false;

        const progress = (s) => {
            const done = s.floors.filter(f => f.broken).length, cur = s.floors.find(f => !f.broken);
            return (done + (cur ? 1 - cur.hp / cur.max : 0)) / s.floors.length;
        };

        function update() {
            const spd = env.speed, g = 0.25 * spd;
            for (const s of sides) {
                const other = sides[1 - s.i];
                const r = s.radius, box = s.box, wr = VS.weight(s);
                const act = s.floors.find(f => !f.broken);
                const mul = VS.pace(env, progress(s), progress(other));
                for (const b of s.balls) {
                    b.vy = Math.min(13.5, b.vy + g);
                    b.x += b.vx * spd; b.y += b.vy * spd;
                    if (b.x - r < box.x + 4) { b.x = box.x + 4 + r; b.vx = Math.abs(b.vx) * 0.98 + 0.4; }
                    else if (b.x + r > box.x + box.w - 4) { b.x = box.x + box.w - 4 - r; b.vx = -Math.abs(b.vx) * 0.98 - 0.4; }
                    if (b.y - r < box.y + 4) { b.y = box.y + 4 + r; b.vy = Math.abs(b.vy) * 0.95 + 1.2; }
                    if (act && !act.broken) {
                        if (b.y + r >= act.y - 11) {
                            b.y = act.y - 11 - r;
                            b.vy = -(6.2 + rnd(0, 4.2));
                            b.vx += rnd(-1.5, 1.5);
                            if (Math.abs(b.vx) > 8.5) b.vx *= 0.8;
                            act.hp -= s.power * wr * mul;
                            act.flash = 1;
                            audio.tone(280 + s.i * 110 + rnd(0, 110), 0.045, 'sine', 0.05, 0.4);
                            if (act.hp <= 0) {
                                act.hp = 0; act.broken = true;
                                fx.burst(box.x + box.w / 2, act.y, 26, { hue: s.i ? 220 : 12, spread: Math.PI, angle: -Math.PI / 2, speed: 420 });
                                fx.kick(5);
                                audio.boom();
                                VS.applyBonus(s, CAP, spawn);
                                if (s.floors.every(f => f.broken) && !won) {
                                    won = true;
                                    env.finish({ kicker: 'G\'OLIB', title: s.name, sub: `${fmt(s.logical)} ta to'p bilan`, color: s.col.main });
                                }
                                break;
                            }
                        }
                    } else if (b.y + r > box.y + box.h - 6) { b.y = box.y + box.h - 6 - r; b.vy = -Math.abs(b.vy) * 0.85; }
                }
                for (const f of s.floors) f.flash = Math.max(0, f.flash - 0.12);
            }
        }

        function draw() {
            for (const s of sides) {
                const { box } = s;
                const cur = s.floors.find(f => !f.broken);
                VS.header(ctx, s, `qavat ${Math.min(s.floors.length, s.floors.filter(f => f.broken).length + 1)} / ${s.floors.length}`);
                VS.frameBox(ctx, s);
                for (const f of s.floors) {
                    if (f.broken) continue;
                    ctx.fillStyle = f.flash > 0.2 ? s.col.pale : (f === cur ? s.col.main : s.col.dim);
                    ctx.fillRect(box.x + 2, f.y - 11, box.w - 4, 22);
                    text(ctx, fmt(Math.ceil(f.hp)), box.x + box.w / 2, f.y + 1, { size: 15, weight: 800, color: '#fff' });
                }
                VS.drawBalls(ctx, s);
            }
            text(ctx, 'VS', A.x + A.w / 2, 160, { size: 20, weight: 800, color: PAL.mute });
        }

        return { update, draw };
    }

    App.registry.register({
        id: 'floors',
        name: 'Qavatlarni sindirish',
        tagline: 'Kim birinchi barcha qavatni sindiradi — X100 vs +300',
        help: 'Ikki tomon bir xil qavatlarni sindiradi, birinchi tugatgan yutadi. Qavat jonlari, to\'plar soni, kuchi va bonus qoidasini har tomon uchun sozlang.',
        group: 'battle',
        tags: ['VS'],
        settings: SETTINGS,
        create,
    });
})(window.App = window.App || {});
