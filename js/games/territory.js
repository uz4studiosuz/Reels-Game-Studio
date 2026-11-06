/* games/territory.js — "Hudud jangi": to'plar urilgan katakchalarni o'z rangiga bo'yaydi. Vaqt tugasa — ko'pi yutadi. */
(function (App) {
    'use strict';
    const { clamp } = App.util;
    const { text, fit, frame, PAL } = App.draw;
    const VS = App.vs;

    const SETTINGS = [
        { group: 'Maydon', key: 'res', label: 'Katak o\'lchami', type: 'segment', default: 'coarse', options: [['coarse', 'Katta'], ['fine', 'Mayda']] },
        { key: 'speed', label: 'To\'plar tezligi', type: 'range', min: 3, max: 12, step: 0.5, default: 7.5 },        { group: 'Chap jamoa', key: 'aName', label: 'Nom', type: 'text', default: '3 KATTA TO\'P' },
        { key: 'aBalls', label: 'To\'plar soni', type: 'range', min: 1, max: 60, step: 1, default: 3 },
        { key: 'aSize', label: 'To\'p o\'lchami', type: 'range', min: 5, max: 26, step: 1, default: 18 },
        { group: 'O\'ng jamoa', key: 'bName', label: 'Nom', type: 'text', default: '18 KICHIK TO\'P' },
        { key: 'bBalls', label: 'To\'plar soni', type: 'range', min: 1, max: 60, step: 1, default: 18 },
        { key: 'bSize', label: 'To\'p o\'lchami', type: 'range', min: 5, max: 26, step: 1, default: 8 },
    ];

    function create(env) {
        const { ctx, W, arena: A, cfg, audio, rnd } = env;
        const cols = cfg.res === 'fine' ? 40 : 28, rows = cfg.res === 'fine' ? 60 : 42;
        const cw = A.w / cols, ch = A.h / rows;
        const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, (_, c) => (c < cols / 2 ? 0 : 1)));
        const names = [cfg.aName || 'A', cfg.bName || 'B'];
        const mk = (team, n, size) => Array.from({ length: n }, () => {
            const ang = (team ? Math.PI : 0) + rnd(-0.7, 0.7);
            return { team, r: size, x: A.x + (team ? A.w * 0.6 : 30) + rnd(0, A.w * 0.35), y: A.y + 40 + rnd(0, A.h - 80), vx: Math.cos(ang) * cfg.speed, vy: Math.sin(ang) * cfg.speed };
        });
        const balls = [...mk(0, cfg.aBalls, cfg.aSize), ...mk(1, cfg.bBalls, cfg.bSize)];
        const total = rows * cols;
        let cells = [total / 2, total / 2], done = false;

        function update() {
            const sp = env.speed;
            for (const b of balls) {
                b.x += b.vx * sp; b.y += b.vy * sp;
                if (b.x - b.r < A.x + 3) { b.x = A.x + 3 + b.r; b.vx = Math.abs(b.vx); }
                if (b.x + b.r > A.x + A.w - 3) { b.x = A.x + A.w - 3 - b.r; b.vx = -Math.abs(b.vx); }
                if (b.y - b.r < A.y + 3) { b.y = A.y + 3 + b.r; b.vy = Math.abs(b.vy); }
                if (b.y + b.r > A.y + A.h - 3) { b.y = A.y + A.h - 3 - b.r; b.vy = -Math.abs(b.vy); }
                // to'p butun doira bo'ylab bo'yaydi: qancha katta bo'lsa, shuncha ko'p hudud oladi
                const c0 = Math.max(0, Math.floor((b.x - b.r - A.x) / cw)), c1 = Math.min(cols - 1, Math.floor((b.x + b.r - A.x) / cw));
                const r0 = Math.max(0, Math.floor((b.y - b.r - A.y) / ch)), r1 = Math.min(rows - 1, Math.floor((b.y + b.r - A.y) / ch));
                let n = 0, sx = 0, sy = 0;
                for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
                    if (grid[r][c] === b.team) continue;
                    const ccx = A.x + (c + 0.5) * cw, ccy = A.y + (r + 0.5) * ch;
                    if (Math.hypot(ccx - b.x, ccy - b.y) > b.r + 0.35 * cw) continue;
                    grid[r][c] = b.team; n++; sx += ccx - b.x; sy += ccy - b.y;
                }
                if (n) {
                    // bosib olingan tomondan qaytadi
                    if (Math.abs(sx) > Math.abs(sy)) b.vx = -Math.sign(sx) * Math.abs(b.vx) + rnd(-0.4, 0.4);
                    else b.vy = -Math.sign(sy) * Math.abs(b.vy) + rnd(-0.4, 0.4);
                    audio.tone(300 + b.team * 100 + rnd(0, 90) - b.r * 4, 0.04, 'sine', 0.035, 0.5);
                }
            }
            let a = 0;
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (grid[r][c] === 0) a++;
            cells = [a, total - a];
            if (done) return;
            const win = cells[0] >= total * 0.96 ? 0 : cells[1] >= total * 0.96 ? 1 : (env.tick >= env.targetSec * 60 ? (cells[0] >= cells[1] ? 0 : 1) : -1);
            if (win >= 0) { done = true; env.finish({ kicker: 'HUDUD', title: names[win], sub: `${(cells[win] / total * 100).toFixed(1)}% egallandi`, color: VS.COL[win].main }); }
        }

        function draw() {
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                ctx.fillStyle = VS.COL[grid[r][c]].dim;
                ctx.fillRect(A.x + c * cw, A.y + r * ch, cw + 0.6, ch + 0.6);
            }
            for (const b of balls) {
                ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
                ctx.fillStyle = VS.COL[b.team].main; ctx.fill();
                ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke();
            }
            frame(ctx, A, PAL.ink, 2);
            const pa = (cells[0] / total * 100).toFixed(1), pb = (cells[1] / total * 100).toFixed(1);
            text(ctx, fit(ctx, names[0].toUpperCase(), 280, 22, 800), 170, 128, { size: 22, weight: 800, color: VS.COL[0].main });
            text(ctx, fit(ctx, names[1].toUpperCase(), 280, 22, 800), W - 170, 128, { size: 22, weight: 800, color: VS.COL[1].main });
            text(ctx, pa + '%', 170, 180, { size: 52, weight: 300 });
            text(ctx, pb + '%', W - 170, 180, { size: 52, weight: 300 });
            const rw = A.w * cells[0] / total;
            ctx.fillStyle = VS.COL[0].main; ctx.fillRect(A.x, 214, rw, 6);
            ctx.fillStyle = VS.COL[1].main; ctx.fillRect(A.x + rw, 214, A.w - rw, 6);
        }

        return { update, draw };
    }

    App.registry.register({
        id: 'territory',
        name: 'Hudud jangi',
        tagline: 'Ikki jamoa maydonni bo\'yab oladi — 50% vs 50%',
        help: 'To\'plar urilgan katakchalarni o\'z rangiga bo\'yaydi; to\'p qancha katta bo\'lsa, shuncha ko\'p hudud oladi. Vaqt tugasa ko\'pi yutadi.',
        group: 'battle',
        tags: ['VS'],
        settings: SETTINGS,
        create,
    });
})(window.App = window.App || {});
