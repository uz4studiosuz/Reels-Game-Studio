/* games/nick-plinko.js — "Nik Plinko": har bir obunachining sharlari qoziqlardan tushib, ball yig'adi. */
(function (App) {
    'use strict';
    const { clamp, TAU, hsl } = App.util;
    const { text, rr, fit, token, frame, clip, PAL } = App.draw;

    const TABLES = {
        low: [40, 30, 20, 10, 10, 20, 30, 40],
        mid: [100, 50, 20, 5, 5, 20, 50, 100],
        high: [500, 100, 20, 0, 0, 20, 100, 500],
    };

    const SETTINGS = [
        { group: 'Ishtirokchilar', key: 'fillBots', label: 'Bot bilan to\'ldirish', type: 'toggle', default: false, hint: () => App.roster.realOnly ? 'Obunachilar bo\'limida "Real obunachilar" yoqilgan (botlar o\'chiq)' : 'Obunachi yetmasa, botlar bilan to\'ldiriladi', active: () => !App.roster.realOnly },
        { key: 'players', label: 'Eng ko\'pi bilan', type: 'range', min: 2, max: 24, step: 1, default: 10, active: (v) => !App.roster.realOnly && !!v.fillBots },
        { key: 'drops', label: 'Har biriga sharlar', type: 'range', min: 1, max: 5, step: 1, default: 3 },
        { group: 'Taxta', key: 'risk', label: 'Xavf darajasi', type: 'segment', default: 'mid', options: [['low', 'Past'], ['mid', 'O\'rta'], ['high', 'Yuqori']], hint: 'Yuqori = chetlarda katta ball, o\'rtada 0' },
        { key: 'bounce', label: 'Sakrovchanlik', type: 'range', min: 0.3, max: 0.8, step: 0.05, default: 0.5 },
    ];

    function create(env) {
        const { ctx, W, arena: A, cfg, fx, audio, rnd } = env;
        const people = env.participants(cfg.players, { min: 1, max: 24 });
        if (people.length < 1) return env.emptyScreen('Plinko', 1);
        const vals = TABLES[cfg.risk];
        const L = A.x + 24, Rr = A.x + A.w - 24, BW = (Rr - L) / vals.length;
        const bucketY = A.y + A.h - 96;
        const pegs = [];
        for (let r = 0; r < 11; r++) {
            const y = A.y + 150 + r * 56, odd = r % 2;
            for (let x = L + (odd ? 28 : 0) + 28; x < Rr - 10; x += 56) pegs.push({ x, y, r: 6 });
        }
        const score = people.map(() => 0);
        const queue = [];
        for (let d = 0; d < cfg.drops; d++) people.forEach((p, i) => queue.push(i));
        for (let i = queue.length - 1; i > 0; i--) { const j = Math.floor(env.rand() * (i + 1)); [queue[i], queue[j]] = [queue[j], queue[i]]; }
        const total = queue.length;
        // tushirish oralig'i: tanlangan davomiylikning ~60% ida hammasi tushib bo'lsin
        const interval = Math.max(8, Math.round((env.targetSec * 0.82 * 60) / total));
        const balls = [];
        const flash = vals.map(() => 0);
        let done = 0, ended = false, endT = 0;

        function release() {
            const i = queue.shift();
            balls.push({ i, x: A.x + A.w / 2 + rnd(-140, 140), y: A.y + 60, vx: rnd(-0.6, 0.6), vy: 0, r: 12, still: 0 });
        }

        function update() {
            const sp = env.speed, S = 3, h = sp / S;
            if (queue.length && env.tick % interval === 0) release();
            for (let st = 0; st < S; st++) {
                for (const b of balls) {
                    if (b.gone) continue;
                    b.vy += 0.3 * h; b.x += b.vx * h; b.y += b.vy * h;
                    if (b.x < L + b.r) { b.x = L + b.r; b.vx = Math.abs(b.vx) * 0.5; }
                    if (b.x > Rr - b.r) { b.x = Rr - b.r; b.vx = -Math.abs(b.vx) * 0.5; }
                    const v = Math.hypot(b.vx, b.vy);
                    if (v > 14) { b.vx *= 14 / v; b.vy *= 14 / v; }
                    for (const pg of pegs) {
                        if (Math.abs(pg.y - b.y) > 20) continue;
                        const dx = b.x - pg.x, dy = b.y - pg.y, min = b.r + pg.r, d = Math.hypot(dx, dy);
                        if (d < min && d > 0) {
                            const nx = dx / d, ny = dy / d;
                            b.x = pg.x + nx * min; b.y = pg.y + ny * min;
                            const vn = b.vx * nx + b.vy * ny;
                            if (vn < 0) {
                                b.vx -= (1 + cfg.bounce) * vn * nx; b.vy -= (1 + cfg.bounce) * vn * ny;
                                b.vx += (env.rand() - 0.5) * 0.7; // kichik tasodifiy og'ish
                                if (-vn > 1.5) audio.tone(300 + ((pg.y / 56) | 0) * 40, 0.04, 'sine', 0.035);
                            }
                        }
                    }
                    if (b.y > bucketY + 6) {
                        const k = clamp(Math.floor((b.x - L) / BW), 0, vals.length - 1);
                        score[b.i] += vals[k];
                        flash[k] = 1;
                        b.gone = true; done++;
                        fx.float(vals[k] ? '+' + vals[k] : '0', b.x, bucketY - 14, { color: vals[k] >= 50 ? PAL.accent : PAL.ink, size: 28 });
                        if (vals[k] >= 50) { fx.burst(b.x, bucketY, 12, { hue: people[b.i].hue }); audio.note(10 + k, 0.2, 'triangle', 0.15); } else audio.pop();
                    }
                }
            }
            for (const b of balls) { // qoziqda tiqilib qolsa — turtki
                if (b.gone) continue;
                b.age = (b.age || 0) + 1;
                if (Math.hypot(b.vx, b.vy) < 0.8) b.still++; else b.still = Math.max(0, b.still - 1);
                if (b.still > 45) { b.vx += rnd(-2.5, 2.5); b.vy -= 2.5; b.still = 0; }
                if (b.age > 1500) { b.y = bucketY + 7; b.vy = 1; } // juda uzoq tursa — chelakka tushiriladi
            }
            for (let i = balls.length - 1; i >= 0; i--) if (balls[i].gone) balls.splice(i, 1);
            for (let k = 0; k < flash.length; k++) flash[k] = Math.max(0, flash[k] - 0.04);

            if (!ended && !queue.length && !balls.length) {
                endT++;
                if (endT > 50) {
                    ended = true;
                    const order = people.map((p, i) => i).sort((a, b) => score[b] - score[a]);
                    const w = people[order[0]];
                    env.finish({ winner: w, kicker: 'ENG KO\'P BALL', title: App.roster.display(w), sub: `${score[order[0]]} ball`, color: hsl(w.hue, 75, 60) });
                }
            }
        }

        function draw() {
            ctx.fillStyle = PAL.panel;
            ctx.fillRect(A.x, A.y, A.w, A.h);
            ctx.save();
            clip(ctx, A);
            ctx.fillStyle = 'rgba(245,242,234,.7)';
            for (const pg of pegs) { ctx.beginPath(); ctx.arc(pg.x, pg.y, pg.r, 0, TAU); ctx.fill(); }
            // chelaklar
            for (let k = 0; k < vals.length; k++) {
                const x = L + k * BW;
                ctx.fillStyle = vals[k] >= 100 ? `rgba(255,90,54,${0.25 + flash[k] * 0.5})` : `rgba(245,242,234,${0.06 + flash[k] * 0.4})`;
                ctx.fillRect(x + 2, bucketY, BW - 4, 90);
                text(ctx, String(vals[k]), x + BW / 2, bucketY + 46, { size: 24, weight: 800, color: vals[k] >= 100 ? PAL.accent : PAL.ink });
            }
            for (const b of balls) token(ctx, people[b.i], b.x, b.y, b.r, { ring: false });
            ctx.restore();
            frame(ctx, A, PAL.line);

            // reyting (eng yaxshi 3)
            const order = people.map((p, i) => i).sort((a, b) => score[b] - score[a]).slice(0, 3);
            order.forEach((i, r) => {
                const y = 118 + r * 38;
                text(ctx, String(r + 1), A.x + 14, y, { size: 18, weight: 800, color: r === 0 ? PAL.accent : PAL.mute, align: 'left' });
                text(ctx, fit(ctx, App.roster.display(people[i]), 300, 26, 700), A.x + 44, y + 1, { size: 26, weight: 700, align: 'left' });
                text(ctx, String(score[i]), A.x + A.w - 10, y + 1, { size: 26, weight: 300, align: 'right' });
            });
            text(ctx, `${done} / ${total}`, W / 2 + 130, 226, { size: 16, weight: 600, color: PAL.mute });
        }

        return { update, draw };
    }

    App.registry.register({
        id: 'plinko',
        name: 'Nik Plinko',
        tagline: 'Har bir obunachining sharlari — kim eng ko\'p ball yig\'adi',
        help: 'Har bir obunachining sharlari qoziqlardan tushib, chelaklarda ball yig\'adi. Xavf darajasi chelak ballarini o\'zgartiradi.',
        group: 'nick',
        roster: true,
        tags: ['ball', 'omad'],
        settings: SETTINGS,
        create,
    });
})(window.App = window.App || {});
