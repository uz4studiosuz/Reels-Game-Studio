/* games/red-light.js — "Qizil chiroq, yashil chiroq": yashilda yuguriladi, qizilda to'xtash kerak. Qimirlaganlar chiqadi. */
(function (App) {
    'use strict';
    const { clamp, lerp, TAU } = App.util;
    const { text, fit, token, frame, PAL } = App.draw;

    const SETTINGS = [
        { group: 'Ishtirokchilar', key: 'fillBots', label: 'Bot bilan to\'ldirish', type: 'toggle', default: false, hint: () => App.roster.realOnly ? 'Obunachilar bo\'limida "Real obunachilar" yoqilgan (botlar o\'chiq)' : 'Obunachi yetmasa, botlar bilan to\'ldiriladi', active: () => !App.roster.realOnly },
        { key: 'players', label: 'Eng ko\'pi bilan', type: 'range', min: 2, max: 16, step: 1, default: 10, active: (v) => !App.roster.realOnly && !!v.fillBots },
        { group: 'Qoida', key: 'risk', label: 'Xavf', type: 'segment', default: 'normal', options: [['low', 'Past'], ['normal', 'O\'rta'], ['high', 'Yuqori']], hint: 'Yuqori = ko\'proq odam qizilda qimirlab qoladi' },
        { key: 'mercy', label: 'Kamida bittasi qoladi', type: 'toggle', default: true },
    ];

    function create(env) {
        const { ctx, W, arena: A, cfg, fx, audio, rnd } = env;
        const people = env.participants(cfg.players, { min: 1, max: 16 });
        if (people.length < 1) return env.emptyScreen('Qizil chiroq', 1);
        const n = people.length;
        const laneW = A.w / n, r = clamp(laneW * 0.38, 12, 24);
        const top = A.y + 120, bot = A.y + A.h - 50, DIST = bot - top;
        const grace = { low: 34, normal: 26, high: 18 }[cfg.risk];
        // tezlik: eng tez yuguruvchi tanlangan davomiylikning ~85% ida yetib kelsin
        const T = env.targetSec * 60 * 1.3, greenShare = 0.6;
        const baseV = DIST / (T * greenShare);
        const R = people.map((p, i) => ({
            p, i, x: A.x + laneW * (i + 0.5), y: bot, v: baseV * rnd(0.82, 1.18),
            react: 0, reactMax: 4 + Math.pow(rnd(0, 1), 2) * 30, moving: false, alive: true, dead: 0, done: false, step: 0,
        }));
        let light = 'green', timer = 90, redAge = 0, warn = false, over = false, endT = 0;
        const gSec = () => rnd(1.5, 3.2) * 60, rSec = () => rnd(1.1, 2.1) * 60;
        timer = gSec();

        function setLight(next) {
            light = next;
            if (next === 'red') {
                redAge = 0;
                for (const q of R) q.react = q.alive ? q.reactMax : 0;
                audio.tone(180, 0.35, 'sawtooth', 0.1, 0.6);
            } else {
                timer = gSec();
                audio.tone(620, 0.18, 'triangle', 0.1, 1.5);
            }
        }

        function update() {
            const sp = env.speed;
            timer -= sp;
            warn = light === 'green' && timer < 28;
            if (light === 'green' && timer <= 0) { setLight('red'); timer = rSec(); }
            else if (light === 'red') { redAge += sp; if (timer <= 0) setLight('green'); }

            const lead = R.filter(q => q.alive).reduce((m, q) => Math.min(m, q.y), bot);
            const behindBoost = env.sched() > 0.9 && !over ? 1.5 : 1;
            for (const q of R) {
                if (q.dead) { q.dead = Math.min(1, q.dead + 0.04); continue; }
                if (!q.alive || q.done) continue;
                q.moving = false;
                if (light === 'green') {
                    q.y -= q.v * sp * behindBoost * (1 + (q.y - lead) / 900); // ortda qolganlar biroz tezlashadi
                    q.moving = true;
                } else if (q.react > 0) {
                    q.react -= sp;
                    q.y -= q.v * sp * 0.6; // to'xtayotgan paytda hali inersiya
                    q.moving = true;
                }
                // qizil chiroq: javob berish juda sekin bo'lsa — chiqadi
                if (light === 'red' && q.moving && redAge > grace) {
                    const others = R.filter(o => o.alive && !o.done && o !== q).length;
                    if (cfg.mercy && others === 0) { q.moving = false; q.react = 0; continue; }
                    q.alive = false; q.dead = 0.01;
                    fx.burst(q.x, q.y, 18, { hue: 355, speed: 380 });
                    fx.float('✕', q.x, q.y - 30, { color: PAL.bad, size: 36 });
                    fx.kick(7); audio.lose();
                    if (q.p.nick) env.say(App.tts.pick([`${App.roster.spoken(q.p)} qimirladi, chiqdi`, `Ouch! ${App.roster.spoken(q.p)} to'xtay olmadi`, `${App.roster.spoken(q.p)} ushlandi`]), { key: 'out', cooldown: 4500 });
                    continue;
                }
                if (q.y <= top) {
                    q.y = top; q.done = true;
                    if (!over) {
                        over = true;
                        env.finish({ winner: q.p, kicker: 'BIRINCHI MARRA', title: App.roster.display(q.p), sub: `${R.filter(o => !o.alive).length} kishi chiqdi`, color: PAL.good });
                    }
                }
            }
            if (!over && R.every(q => !q.alive)) { over = true; env.finish({ kicker: 'NATIJA', title: 'Hamma chiqdi', sub: '', color: PAL.bad }); }
            const alive = R.filter(q => q.alive && !q.done);
            if (!over && alive.length === 1 && R.some(q => !q.alive)) { // oxirgi tirik: yugurib borishi shart emas
                if (++endT > 90) { over = true; env.finish({ kicker: 'OXIRGI QOLGAN', title: App.roster.display(alive[0].p), sub: 'Hammadan omadli', color: PAL.good }); }
            }
        }

        function draw() {
            ctx.fillStyle = PAL.panel; ctx.fillRect(A.x, A.y, A.w, A.h);
            // yo'laklar
            ctx.strokeStyle = 'rgba(245,242,234,.07)'; ctx.lineWidth = 1.5;
            for (let i = 1; i < n; i++) { ctx.beginPath(); ctx.moveTo(A.x + laneW * i, top); ctx.lineTo(A.x + laneW * i, bot + 30); ctx.stroke(); }
            // marra
            for (let k = 0; k < A.w / 24; k++) { ctx.fillStyle = k % 2 ? '#f5f2ea' : '#16161a'; ctx.fillRect(A.x + k * 24, top - 30, 24, 14); ctx.fillStyle = k % 2 ? '#16161a' : '#f5f2ea'; ctx.fillRect(A.x + k * 24, top - 16, 24, 14); }
            for (const q of R) {
                if (q.dead >= 1) { text(ctx, '✕', q.x, q.y, { size: 24, weight: 800, color: PAL.bad, alpha: 0.7 }); continue; }
                ctx.save(); ctx.globalAlpha = q.dead ? 1 - q.dead : 1;
                token(ctx, q.p, q.x, q.y, r);
                ctx.restore();
                if (q.alive && n <= 10) text(ctx, fit(ctx, App.roster.display(q.p), laneW + 20, 13, 700), q.x, q.y + r + 12, { size: 13, weight: 700, alpha: 0.75 });
            }
            frame(ctx, A, PAL.line);

            // chiroq
            const col = light === 'green' ? PAL.good : PAL.bad;
            const pulse = warn ? 0.5 + 0.5 * Math.sin(env.tick / 2) : 1;
            ctx.beginPath(); ctx.arc(W / 2, 150, 46, 0, TAU);
            ctx.fillStyle = col; ctx.globalAlpha = 0.35 + 0.65 * pulse; ctx.fill(); ctx.globalAlpha = 1;
            text(ctx, light === 'green' ? 'YUGUR' : 'TO\'XTA', W / 2, 150, { size: 20, weight: 800, color: '#0d0d10' });
            text(ctx, `${R.filter(q => q.alive).length} / ${n}`, A.x + 8, 150, { size: 26, weight: 300, align: 'left' });
        }

        return { update, draw };
    }

    App.registry.register({
        id: 'redlight',
        name: 'Qizil chiroq',
        tagline: 'Yashilda yugur, qizilda to\'xta — qimirlaganlar chiqadi',
        help: 'Yashilda yuguriladi, qizilda to\'xtash kerak; qimirlaganlar chiqadi. Xavf darajasi necha kishi qoqilishini belgilaydi.',
        group: 'nick',
        roster: true,
        tags: ['Squid Game'],
        settings: SETTINGS,
        create,
    });
})(window.App = window.App || {});
