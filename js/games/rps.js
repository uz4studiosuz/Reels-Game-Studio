/* games/rps.js — "Tosh-qaychi-qog'oz": belgilar to'p kabi tasodifiy tomonga otiladi, devor va bir-biriga
 * burchak bilan urilib qaytadi. Teginganda yutgan tur yutqazganni o'ziga aylantiradi. Bittasi qolguncha. */
(function (App) {
    'use strict';
    const { clamp, TAU } = App.util;
    const { text, frame, PAL } = App.draw;

    // type i ... (i+2)%3 turni yutadi:  0 -> 2, 1 -> 0, 2 -> 1
    const SETS = {
        rps: [['🪨', 'TOSH', '#ff5a36'], ['📄', 'QOG\'OZ', '#4f8cff'], ['✂️', 'QAYCHI', '#ffc94d']],
        nature: [['🔥', 'OLOV', '#ff5a36'], ['💧', 'SUV', '#4f8cff'], ['🌿', 'O\'T', '#5be37d']],
        animals: [['🐭', 'SICHQON', '#b9b6c0'], ['🐱', 'MUSHUK', '#ffc94d'], ['🧀', 'PISHLOQ', '#ff9a3d']],
    };

    const SETTINGS = [
        { group: 'Belgilar', key: 'set', label: 'To\'plam', type: 'segment', default: 'rps', options: [['rps', '🪨📄✂️'], ['nature', '🔥💧🌿'], ['animals', '🐭🐱🧀']] },
        { key: 'count', label: 'Har turdan', type: 'range', min: 3, max: 60, step: 1, default: 24 },
        { key: 'size', label: 'Belgi o\'lchami', type: 'range', min: 10, max: 30, step: 1, default: 17 },
        { group: 'Harakat', key: 'speed', label: 'Tezlik', type: 'range', min: 1, max: 8, step: 0.2, default: 3.6 },
        { key: 'jitter', label: 'Tasodifiy og\'ish', type: 'range', min: 0, max: 1, step: 0.05, default: 0.2, hint: 'Urilganda yo\'nalish biroz o\'zgaradi (0 = sof qaytish)' },
        { key: 'start', label: 'Boshlanish', type: 'segment', default: 'groups', options: [['groups', 'Guruh-guruh'], ['mixed', 'Aralash']] },
        { group: 'Ko\'rinish', key: 'trails', label: 'Iz qoldirish', type: 'toggle', default: false },
        { key: 'sound', label: 'Urilish ovozi', type: 'toggle', default: true },
    ];

    function create(env) {
        const { ctx, W, arena: A, cfg, fx, audio, rnd } = env;
        const types = SETS[cfg.set];
        const items = [];
        // Davomiylik: tezlik tanlangan davomiylikka teskari mutanosib
        const BASE = cfg.speed * (52 / env.targetSec) * 0.42;
        let SPEED = BASE;
        for (let t = 0; t < 3; t++) for (let i = 0; i < cfg.count; i++) {
            const a = rnd(0, TAU);                                   // tasodifiy tomonga otiladi
            let x, y;
            if (cfg.start === 'mixed') { x = rnd(A.x + 40, A.x + A.w - 40); y = rnd(A.y + 40, A.y + A.h - 40); }
            else {
                const bx = [A.x + A.w * 0.25, A.x + A.w * 0.75, A.x + A.w * 0.5][t], by = [A.y + A.h * 0.3, A.y + A.h * 0.3, A.y + A.h * 0.72][t];
                x = clamp(bx + rnd(-110, 110), A.x + 40, A.x + A.w - 40); y = clamp(by + rnd(-110, 110), A.y + 40, A.y + A.h - 40);
            }
            items.push({ type: t, x, y, vx: Math.cos(a) * SPEED, vy: Math.sin(a) * SPEED, r: cfg.size, trail: [] });
        }
        const N = items.length;
        let counts = [cfg.count, cfg.count, cfg.count], done = false;

        // tezlik vektorini biroz burish (urilgandan keyingi tasodifiy og'ish)
        const wobble = (o) => {
            if (!cfg.jitter) return;
            const da = (rnd(0, 1) - 0.5) * cfg.jitter * 0.5, c = Math.cos(da), s = Math.sin(da);
            const vx = o.vx * c - o.vy * s, vy = o.vx * s + o.vy * c; o.vx = vx; o.vy = vy;
        };

        function update() {
            const sp = env.speed;
            // vaqt tugab qolsa (o'yin cho'zilsa) harakat asta-sekin tezlashadi: o'yin baribir tugaydi
            SPEED = BASE * (1 + Math.max(0, env.sched() - 0.9) * 8);
            for (const a of items) {
                a.x += a.vx * sp; a.y += a.vy * sp;
                // devorlardan burchak bilan qaytish
                let hit = false;
                if (a.x - a.r < A.x + 4) { a.x = A.x + 4 + a.r; a.vx = Math.abs(a.vx); hit = true; }
                else if (a.x + a.r > A.x + A.w - 4) { a.x = A.x + A.w - 4 - a.r; a.vx = -Math.abs(a.vx); hit = true; }
                if (a.y - a.r < A.y + 4) { a.y = A.y + 4 + a.r; a.vy = Math.abs(a.vy); hit = true; }
                else if (a.y + a.r > A.y + A.h - 4) { a.y = A.y + A.h - 4 - a.r; a.vy = -Math.abs(a.vy); hit = true; }
                if (hit) { wobble(a); if (cfg.sound) audio.tone(200 + a.type * 60, 0.025, 'sine', 0.02); }
                if (cfg.trails) { a.trail.push([a.x, a.y]); if (a.trail.length > 10) a.trail.shift(); } else a.trail.length = 0;
            }
            // to'qnashuvlar: markazlar chizig'i bo'ylab elastik qaytish
            for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
                const a = items[i], b = items[j], dx = b.x - a.x, dy = b.y - a.y;
                const min = a.r + b.r;
                if (dx > min || dx < -min || dy > min || dy < -min) continue;
                const d = Math.hypot(dx, dy);
                if (d >= min || d === 0) continue;
                const nx = dx / d, ny = dy / d, ov = (min - d) / 2;
                a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
                const va = a.vx * nx + a.vy * ny, vb = b.vx * nx + b.vy * ny;
                if (va - vb > 0) { // bir-biriga yaqinlashayotgan bo'lsa
                    a.vx += (vb - va) * nx; a.vy += (vb - va) * ny;
                    b.vx += (va - vb) * nx; b.vy += (va - vb) * ny;
                    wobble(a); wobble(b);
                }
                if (a.type !== b.type) {
                    // teginganda darrov o'zgaradi
                    const aWins = (a.type + 2) % 3 === b.type;
                    const loser = aWins ? b : a, nt = aWins ? a.type : b.type;
                    counts[loser.type]--; counts[nt]++;
                    loser.type = nt;
                    fx.burst(loser.x, loser.y, 7, { hue: 40, speed: 170, life: 0.4, size: 4 });
                    if (cfg.sound) audio.tone(300 + nt * 120, 0.05, 'sine', 0.04, 0.6);
                }
            }
            // tezlikni doimiy tutamiz (urilish va og'ishdan keyin ham)
            for (const a of items) { const m = Math.hypot(a.vx, a.vy) || 1; a.vx *= SPEED / m; a.vy *= SPEED / m; }
            counts = [0, 0, 0];
            for (const it of items) counts[it.type]++;
            if (!done) {
                const w = counts.findIndex(c => c === N);
                if (w >= 0) { done = true; env.finish({ kicker: 'G\'OLIB TUR', title: types[w][1], sub: `${types[w][0]} hammani yutdi`, color: types[w][2] }); }
            }
        }

        function draw() {
            ctx.fillStyle = PAL.panel; ctx.fillRect(A.x, A.y, A.w, A.h);
            for (let t = 0; t < 3; t++) {
                const x = [130, W / 2, W - 130][t];
                text(ctx, types[t][0] + ' ' + types[t][1], x, 128, { size: 18, weight: 800, color: types[t][2] });
                text(ctx, String(counts[t]), x, 180, { size: 52, weight: 300 });
            }
            for (const it of items) {
                if (cfg.trails) for (let k = 0; k < it.trail.length; k++) {
                    ctx.globalAlpha = k / it.trail.length * 0.25; ctx.fillStyle = types[it.type][2];
                    ctx.beginPath(); ctx.arc(it.trail[k][0], it.trail[k][1], it.r * 0.6 * (k / it.trail.length), 0, TAU); ctx.fill();
                }
                ctx.globalAlpha = 1;
                ctx.beginPath(); ctx.arc(it.x, it.y, it.r, 0, TAU);
                ctx.fillStyle = PAL.bg; ctx.fill();
                ctx.lineWidth = 2.5; ctx.strokeStyle = types[it.type][2]; ctx.stroke();
                text(ctx, types[it.type][0], it.x, it.y + 1, { size: it.r * 1.25 });
            }
            frame(ctx, A, PAL.line);
        }

        return { update, draw, debug: () => ({ items, counts }) };
    }

    App.registry.register({
        id: 'rps',
        name: 'Tosh · Qaychi · Qog\'oz',
        tagline: 'Belgilar to\'p kabi urilib qaytadi — tegsa darrov o\'zgaradi',
        help: 'Belgilar to\'p kabi tasodifiy tomonga otiladi va burchak bilan urilib qaytadi. Teginganda yutgan tur yutqazganni o\'ziga aylantiradi.',
        group: 'battle',
        tags: ['VS'],
        settings: SETTINGS,
        create,
    });
})(window.App = window.App || {});
