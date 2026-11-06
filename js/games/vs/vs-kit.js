/* games/vs/vs-kit.js — ikki tomonli (A vs B) o'yinlar uchun umumiy qismlar:
 * sozlamalar sxemasi, tomon obyekti, to'plar soni, bonus qoidalari, sarlavha va sur'at boshqaruvi. */
(function (App) {
    'use strict';
    const { clamp, fmt } = App.util;
    const { text, fit, PAL } = App.draw;

    const COL = [
        { main: '#ff5a36', dim: '#7c2a19', pale: '#ffb8a6' },
        { main: '#4f8cff', dim: '#1d3a73', pale: '#b9d2ff' },
    ];

    const BONUS = [['double', 'To\'plar ×2'], ['plus50', '+50 to\'p'], ['plus300', '+300 to\'p'], ['power2x', 'Kuch ×2'], ['none', 'O\'zgarmaydi']];

    /** Bir tomonning sozlamalari: kalitlar `a...` yoki `b...` bilan boshlanadi. */
    function sideSettings(p, label, d) {
        return [
            { group: label, key: p + 'Name', label: 'Nom', type: 'text', default: d.name },
            { key: p + 'Balls', label: 'Boshlang\'ich to\'plar', type: 'number', min: 1, max: 5000, default: d.balls },
            { key: p + 'Power', label: 'Zarba kuchi', type: 'number', min: 1, max: 1000, default: d.power },
            { key: p + 'Radius', label: 'To\'p o\'lchami', type: 'range', min: 4, max: 26, step: 1, default: d.radius },
            { key: p + 'Bonus', label: 'Bosqichdan keyin', type: 'select', default: d.bonus, options: BONUS },
        ];
    }

    function boxes(A) {
        const w = (A.w - 16) / 2;
        return [{ x: A.x, y: A.y, w, h: A.h }, { x: A.x + w + 16, y: A.y, w, h: A.h }];
    }

    function makeSide(i, box, cfg) {
        const p = i ? 'b' : 'a';
        return {
            i, box, col: COL[i],
            name: cfg[p + 'Name'] || (i ? 'B' : 'A'),
            logical: Math.max(1, cfg[p + 'Balls']),
            power: Math.max(1, cfg[p + 'Power']),
            radius: clamp(cfg[p + 'Radius'], 4, 26),
            bonus: cfg[p + 'Bonus'],
            balls: [],
        };
    }

    /** Ko'rinadigan to'plar sonini mantiqiy songa moslaydi (maks. `cap`). */
    function sync(side, cap, spawn, initial) {
        const target = Math.min(side.logical, cap);
        while (side.balls.length < target) side.balls.push(spawn(side, initial));
        if (side.balls.length > target) side.balls.length = target;
    }

    function applyBonus(side, cap, spawn) {
        if (side.bonus === 'double') side.logical = Math.min(999999, side.logical * 2);
        else if (side.bonus === 'plus50') side.logical += 50;
        else if (side.bonus === 'plus300') side.logical += 300;
        else if (side.bonus === 'power2x') side.power *= 2;
        sync(side, cap, spawn, false);
    }

    /** Ko'rinmaydigan to'plar o'rniga zarba kuchi mutanosib oshadi. */
    const weight = (side) => Math.max(1, side.logical / Math.max(1, side.balls.length));

    /**
     * Sur'at boshqaruvi: o'yin tanlangan davomiylikda tugashi uchun oldindagini sekinlashtiradi,
     * orqadagini tezlashtiradi. "Yaqin poyga" yoqilsa, orqadagiga qo'shimcha yordam.
     * @returns {number} zarba/o'sish koeffitsiyenti
     */
    function pace(env, self, other) {
        const sched = env.sched();
        let m = 1;
        if (self > sched) m *= Math.max(0.003, Math.exp(-(self - sched) * 45));
        else if (self < sched - 0.04) m *= 1 + Math.min(2.5, (sched - self) * 5);
        if (env.drama) {
            if (other > self + 0.08) m *= 1 + Math.min(0.9, other - self);
            else if (self > other + 0.08) m *= 0.85;
        }
        return m;
    }

    function drawBalls(ctx, side) {
        const r = side.radius, few = side.balls.length <= 15;
        for (const b of side.balls) {
            if (few && b.trail) {
                b.trail.push({ x: b.x, y: b.y });
                if (b.trail.length > 8) b.trail.shift();
                for (let t = 0; t < b.trail.length; t++) {
                    ctx.globalAlpha = t / b.trail.length * 0.35;
                    ctx.fillStyle = side.col.main;
                    ctx.beginPath(); ctx.arc(b.trail[t].x, b.trail[t].y, r * (t / b.trail.length), 0, Math.PI * 2); ctx.fill();
                }
                ctx.globalAlpha = 1;
            }
            ctx.fillStyle = side.col.main;
            ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = side.col.pale;
            ctx.beginPath(); ctx.arc(b.x - r * 0.28, b.y - r * 0.28, Math.max(1.2, r * 0.3), 0, Math.PI * 2); ctx.fill();
        }
    }

    function frameBox(ctx, side) {
        ctx.strokeStyle = side.col.main; ctx.lineWidth = 2;
        ctx.strokeRect(side.box.x, side.box.y, side.box.w, side.box.h);
    }

    /** Har ustun tepasidagi nom + katta son + kichik izoh. */
    function header(ctx, side, sub) {
        const cx = side.box.x + side.box.w / 2;
        text(ctx, fit(ctx, side.name.toUpperCase(), side.box.w - 20, 22, 800), cx, 128, { size: 22, weight: 800, color: side.col.main });
        text(ctx, fmt(side.logical), cx, 178, { size: 52, weight: 300 });
        if (sub) text(ctx, sub, cx, 218, { size: 16, weight: 600, color: PAL.mute });
    }

    App.vs = { COL, sideSettings, boxes, makeSide, sync, applyBonus, weight, pace, drawBalls, frameBox, header };
})(window.App = window.App || {});
