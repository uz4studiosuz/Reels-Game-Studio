/* games/hole.js — "Qora teshik": ikki teshik maydondagi hamma narsani yutadi, oxirida kattasi kichigini. */
(function (App) {
    'use strict';
    const { clamp, lerp, TAU, hsl } = App.util;
    const { text, fit, frame, clip, PAL } = App.draw;
    const VS = App.vs;

    const SETTINGS = [
        { group: 'Maydon', key: 'items', label: 'Narsalar soni', type: 'range', min: 120, max: 360, step: 10, default: 260 },
        { key: 'finale', label: 'Teshik teshikni yutadi', type: 'toggle', default: true, hint: 'Oxirida kattasi kichigini yutib g\'alaba qozonadi' },
        { group: 'Chap teshik', key: 'aName', label: 'Nom', type: 'text', default: 'QIZIL' },
        { group: 'O\'ng teshik', key: 'bName', label: 'Nom', type: 'text', default: 'KO\'K' },
    ];

    function create(env) {
        const { ctx, W, arena: A, cfg, fx, audio, rnd } = env;
        const items = [];
        const spawnPts = [{ x: A.x + 130, y: A.y + A.h - 150 }, { x: A.x + A.w - 130, y: A.y + A.h - 150 }];
        for (let i = 0; i < cfg.items; i++) {
            const q = rnd(0, 1);
            const r = q < 0.58 ? rnd(4, 8) : q < 0.86 ? rnd(9, 15) : q < 0.98 ? rnd(16, 22) : rnd(26, 33);
            let x, y, k = 0;
            do { x = rnd(A.x + 16 + r, A.x + A.w - 16 - r); y = rnd(A.y + 16 + r, A.y + A.h - 16 - r); k++; }
            while (k < 12 && spawnPts.some(h => Math.hypot(h.x - x, h.y - y) < 90));
            items.push({ x, y, r, hue: Math.round(rnd(0, 360)), sq: rnd(0, 1) < 0.5, rot: rnd(0, TAU), eat: 0, by: 0 });
        }
        const total = items.length;
        const H = [0, 1].map(i => ({ i, x: spawnPts[i].x, y: spawnPts[i].y, vx: 0, vy: 0, r: 26, area: 676, score: 0, target: null, retarget: 0, dead: 0 }));
        const names = [cfg.aName || 'A', cfg.bName || 'B'];
        // tezlik: tanlangan davomiylikda barcha narsa yutilishi uchun
        const SPEED = 2.7 * (cfg.items / 270) * 1.1 * (28 / env.targetSec);
        let over = false;

        function update() {
            const sp = env.speed;
            for (let i = items.length - 1; i >= 0; i--) {
                const it = items[i];
                if (!it.eat) continue;
                it.eat += 0.1 * sp;
                if (it.eat >= 1) {
                    const h = H[it.by], behind = env.drama && h.r < H[1 - h.i].r * 0.9;
                    h.area += it.r * it.r * 0.62 * (behind ? 1.4 : 1);
                    h.score++; h.r = Math.sqrt(h.area);
                    audio.note(h.score % 15 + h.i * 3, 0.12, 'sine', 0.09);
                    items.splice(i, 1);
                }
            }
            if (over) return;
            const left = items.filter(it => !it.eat);
            for (const h of H) {
                if (h.dead) { h.dead += 0.05 * sp; continue; }
                const o = H[1 - h.i], ratio = h.r / o.r, dO = Math.hypot(o.x - h.x, o.y - h.y);
                h.retarget--;
                let tx = h.x, ty = h.y;
                const late = cfg.finale && left.length < total * 0.25;
                if (ratio < 0.85 && dO < 280 && late) { const a = Math.atan2(h.y - o.y, h.x - o.x); tx = h.x + Math.cos(a) * 120; ty = h.y + Math.sin(a) * 120; }
                else if (ratio > 1.22 && late) { tx = o.x; ty = o.y; }
                else {
                    if (!h.target || h.target.eat || h.retarget <= 0) {
                        let best = null, bs = -1;
                        for (const it of left) {
                            if (it.r > h.r * 0.8) continue;
                            const dm = Math.hypot(it.x - h.x, it.y - h.y), dother = Math.hypot(it.x - o.x, it.y - o.y);
                            // raqib yaqin bo'lgan narsaga emas, o'zimizga yaqinroqqa intilamiz
                            const sc = (it.r * it.r) / (dm + 60) * (dother < dm * 0.8 ? 0.45 : 1);
                            if (sc > bs) { bs = sc; best = it; }
                        }
                        h.target = best; h.retarget = 24;
                    }
                    if (h.target) { tx = h.target.x; ty = h.target.y; } else { tx = A.x + A.w / 2; ty = A.y + A.h / 2; }
                }
                const ang = Math.atan2(ty - h.y, tx - h.x);
                const boost = env.drama ? clamp(o.r / h.r, 0.85, 1.25) : 1;
                const want = Math.hypot(tx - h.x, ty - h.y) < 4 ? 0 : SPEED * sp * boost;
                h.vx = lerp(h.vx, Math.cos(ang) * want, 0.12); h.vy = lerp(h.vy, Math.sin(ang) * want, 0.12);
                // devorga tiralganda to'xtab qolmasin: devor bo'ylab sirpansin
                const m = h.r * 0.6;
                h.x += h.vx; h.y += h.vy;
                if (h.x < A.x + m) { h.x = A.x + m; h.vx = Math.max(0, h.vx); }
                if (h.x > A.x + A.w - m) { h.x = A.x + A.w - m; h.vx = Math.min(0, h.vx); }
                if (h.y < A.y + m) { h.y = A.y + m; h.vy = Math.max(0, h.vy); }
                if (h.y > A.y + A.h - m) { h.y = A.y + A.h - m; h.vy = Math.min(0, h.vy); }
                for (const it of left) {
                    if (!it.eat && it.r <= h.r * 0.82 && Math.hypot(it.x - h.x, it.y - h.y) < h.r - it.r * 0.2) { it.eat = 0.001; it.by = h.i; }
                }
            }
            // teshiklar bir-birining ustiga chiqib qolmasin (faqat final yutishdan tashqari)
            {
                const p = H[0], q = H[1];
                const dx = q.x - p.x, dy = q.y - p.y, dd = Math.hypot(dx, dy) || 1, min = (p.r + q.r) * 0.95;
                const canEat = cfg.finale && left.length < total * 0.25 && Math.max(p.r, q.r) > Math.min(p.r, q.r) * 1.2;
                if (dd < min && !canEat) {
                    const nx = dx / dd, ny = dy / dd, push = (min - dd) / 2;
                    p.x -= nx * push; p.y -= ny * push; q.x += nx * push; q.y += ny * push;
                    p.vx -= nx * 0.6; p.vy -= ny * 0.6; q.vx += nx * 0.6; q.vy += ny * 0.6;
                    p.retarget = q.retarget = 0; // yangi nishon tanlashsin
                }
            }
            const [a, b] = H, d = Math.hypot(a.x - b.x, a.y - b.y);
            const big = a.r > b.r ? a : b, small = big === a ? b : a;
            const winner = (h) => env.finish({ kicker: 'G\'OLIB', title: names[h.i], sub: `${h.score} ta narsa yutdi`, color: VS.COL[h.i].main });
            if (cfg.finale && left.length < total * 0.25 && big.r > small.r * 1.2 && d < big.r * 0.7) { small.dead = 0.001; over = true; fx.burst(small.x, small.y, 30, { hue: small.i ? 220 : 12 }); audio.boom(); winner(big); }
            else if (left.length === 0 || env.tick > 60 * 140) { over = true; winner(a.area >= b.area ? a : b); }
        }

        function draw() {
            ctx.fillStyle = '#100d18';
            ctx.fillRect(A.x, A.y, A.w, A.h);
            ctx.save();
            clip(ctx, A);
            ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.lineWidth = 1.5;
            for (let x = A.x; x < A.x + A.w; x += 48) { ctx.beginPath(); ctx.moveTo(x, A.y); ctx.lineTo(x, A.y + A.h); ctx.stroke(); }
            for (let y = A.y; y < A.y + A.h; y += 48) { ctx.beginPath(); ctx.moveTo(A.x, y); ctx.lineTo(A.x + A.w, y); ctx.stroke(); }
            for (const it of items) {
                let x = it.x, y = it.y, sc = 1;
                if (it.eat) { const h = H[it.by], e = Math.min(1, it.eat); x = lerp(it.x, h.x, e * e); y = lerp(it.y, h.y, e * e); sc = 1 - e * 0.9; }
                ctx.save(); ctx.translate(x, y); ctx.rotate(it.rot); ctx.scale(sc, sc);
                ctx.fillStyle = hsl(it.hue, 70, 62);
                ctx.beginPath();
                if (it.sq) ctx.roundRect(-it.r, -it.r, it.r * 2, it.r * 2, it.r * 0.3); else ctx.arc(0, 0, it.r, 0, TAU);
                ctx.fill();
                ctx.restore();
            }
            for (const h of H) {
                const sc = h.dead ? Math.max(0, 1 - h.dead) : 1;
                if (sc <= 0) continue;
                const r = h.r * sc;
                ctx.beginPath(); ctx.arc(h.x, h.y, r, 0, TAU); ctx.fillStyle = '#000'; ctx.fill();
                ctx.lineWidth = 6; ctx.strokeStyle = VS.COL[h.i].main; ctx.stroke();
                text(ctx, String(h.score), h.x, h.y, { size: Math.max(18, r * 0.6), weight: 800 });
            }
            ctx.restore();
            frame(ctx, A, PAL.line);
            // sarlavha
            for (const h of H) {
                const cx = h.i ? W - 170 : 170;
                text(ctx, fit(ctx, names[h.i].toUpperCase(), 280, 22, 800), cx, 128, { size: 22, weight: 800, color: VS.COL[h.i].main });
                text(ctx, String(h.score), cx, 180, { size: 52, weight: 300 });
            }
            const tot = H[0].area + H[1].area, rw = A.w * (H[0].area / tot);
            ctx.fillStyle = VS.COL[0].main; ctx.fillRect(A.x, 214, rw, 6);
            ctx.fillStyle = VS.COL[1].main; ctx.fillRect(A.x + rw, 214, A.w - rw, 6);
        }

        return { update, draw, debug: () => ({ H, items }) };
    }

    App.registry.register({
        id: 'hole',
        name: 'Qora teshik',
        tagline: 'Ikki teshik hamma narsani yutadi, oxirida kattasi kichigini',
        help: 'Ikki teshik maydondagi narsalarni yutib o\'sadi; oxirida kattasi kichigini yutishi mumkin. Narsalar sonini sozlang.',
        group: 'battle',
        tags: ['VS', 'o\'sish'],
        settings: SETTINGS,
        create,
    });
})(window.App = window.App || {});
