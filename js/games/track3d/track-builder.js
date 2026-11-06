/* games/track3d/track-builder.js — yo'lni dasturiy ravishda quradi (sof geometriya, three.js yo'q).
 *
 * "Toshbaqa" (turtle) usuli: yo'nalish (yaw), qiyalik (pitch) va yon og'ish (bank) o'zgartirilib,
 * har 0.8 birlikda bitta kadr (p, f, r, u) saqlanadi. Shar shu kadrlar bo'ylab "relsda" yuradi.
 */
(function (App) {
    'use strict';
    const NS = (App.track3d = App.track3d || {});
    const { TAU, smooth } = App.util;

    const DS = 0.8;       // kadrlar orasidagi masofa
    const WIDTH = 6.4;    // yo'l kengligi
    const WALL = 0.55;    // yon devor balandligi

    // Bo'lim turiga qarab devor rangi (tushunarli vizual ritm)
    const HUE = { start: 210, straight: 210, curve: 200, scurve: 190, drop: 14, booster: 140, bumpers: 330, wave: 175, spiral: 275, hill: 28, gap: 48, mud: 30, finish: 50 };

    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

    /**
     * @param {{sections:number, chaos:number, spirals:boolean, jumps:boolean, hills:boolean}} opts
     * @param {()=>number} rand
     */
    function build(opts, rand) {
        const UP = [0, 1, 0];
        const samples = [], boosters = [], bumpers = [], gaps = [], zones = [], items = [], movers = [];
        let pos = [0, 0, 0], yaw = 0, pitch = -0.1, bank = 0;
        const curS = () => (samples.length - 1) * DS;

        function pushFrame(f, tag, yawRate, gap) {
            const r0 = norm(cross(UP, f));
            const u0 = cross(f, r0);
            const cb = Math.cos(bank), sb = Math.sin(bank);
            samples.push({
                p: pos.slice(), f,
                r: [r0[0] * cb - u0[0] * sb, r0[1] * cb - u0[1] * sb, r0[2] * cb - u0[2] * sb],
                u: [u0[0] * cb + r0[0] * sb, u0[1] * cb + r0[1] * sb, u0[2] * cb + r0[2] * sb],
                yawRate, gap: !!gap, tag,
            });
        }

        function emit(len, o = {}) {
            const n = Math.max(1, Math.round(len / DS));
            const p0 = pitch, b0 = bank;
            const pt = o.pitch !== undefined ? o.pitch : pitch;
            const bt = o.bank !== undefined ? o.bank : bank;
            const dyaw = o.dyaw || 0;
            const yr = dyaw / (n * DS);
            const tag = o.tag || 'straight';
            for (let i = 1; i <= n; i++) {
                const e = smooth(i / n);
                yaw += dyaw / n;
                pitch = p0 + (pt - p0) * e;
                bank = b0 + (bt - b0) * e;
                const f = [Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw)];
                pos[0] += f[0] * DS; pos[1] += f[1] * DS; pos[2] += f[2] * DS;
                pushFrame(f, tag, yr, o.gap);
            }
        }

        // boshlang'ich kadr
        pushFrame([Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw)], 'start', 0, false);

        const chaos = (opts.chaos || 0) / 100;
        const dirR = () => (rand() < 0.5 ? -1 : 1);
        const pad = (s, x) => boosters.push({ s, x, w: 1.5 });
        const bump = (s, x) => bumpers.push({ s, x, r: 0.6 });

        // start rampasi
        emit(14, { pitch: -0.34, tag: 'start' });
        emit(18, { pitch: -0.1, tag: 'start' });

        const pool = ['curve', 'scurve', 'drop', 'booster', 'bumpers', 'wave'];
        if (opts.spirals) pool.push('spiral', 'spiral');
        if (opts.jumps) pool.push('gap');
        if (opts.hills) pool.push('hill');
        if (chaos > 0.2) pool.push('mud', 'mud');
        if (opts.movers) pool.push('sweepers', 'sweepers');
        let prev = 'start';

        for (let i = 0; i < opts.sections; i++) {
            let kind;
            do { kind = pool[Math.floor(rand() * pool.length)]; }
            while (kind === prev || (kind === 'hill' && prev !== 'drop' && prev !== 'booster') || (kind === 'gap' && prev === 'bumpers'));
            const s0 = curS();
            const d = dirR();

            if (kind === 'curve') {
                emit(40, { dyaw: d * (0.9 + rand() * 0.7), pitch: -0.1, bank: d * 0.28, tag: kind });
                emit(8, { pitch: -0.08, bank: 0, tag: kind });
            } else if (kind === 'scurve') {
                const a = 0.7 + rand() * 0.5;
                emit(26, { dyaw: d * a, pitch: -0.1, bank: d * 0.25, tag: kind });
                emit(26, { dyaw: -d * a, bank: -d * 0.25, tag: kind });
                emit(6, { bank: 0, tag: kind });
            } else if (kind === 'drop') {
                emit(10, { pitch: -0.12, tag: kind });
                emit(26, { pitch: -0.62, tag: kind });
                emit(18, { pitch: -0.1, tag: kind });
            } else if (kind === 'booster') {
                emit(8, { pitch: -0.1, tag: kind });
                const base = curS();
                pad(base + 3, -1.3); pad(base + 3, 1.3);
                if (chaos > 0.4) pad(base + 8, 0);
                emit(16, { tag: kind });
            } else if (kind === 'bumpers') {
                emit(10, { pitch: -0.1, tag: kind });
                const n = 2 + Math.round(chaos * 4);
                const base = curS();
                for (let k = 0; k < n; k++) bump(base + 4 + k * 6, (k % 2 ? 1 : -1) * (0.6 + rand() * 1.3));
                emit(6 * n + 8, { tag: kind });
            } else if (kind === 'sweepers') {
                // yon tomonga oldinga-orqaga yurib turuvchi to'siqlar
                emit(10, { pitch: -0.1, tag: 'bumpers' });
                const base = curS(), n = 2 + Math.round(chaos * 2);
                for (let k = 0; k < n; k++) movers.push({ s: base + 5 + k * 8, x0: 0, amp: 1.9, w: 1.3 + rand() * 1.3, ph: rand() * TAU, r: 0.55 });
                emit(8 * n + 8, { tag: 'bumpers' });
            } else if (kind === 'mud') {
                emit(10, { pitch: -0.1, tag: 'straight' });
                emit(22, { pitch: -0.1, tag: kind });
                emit(8, { tag: 'straight' });
            } else if (kind === 'wave') {
                for (let k = 0; k < 2; k++) {
                    emit(12, { pitch: -0.3, tag: kind });
                    emit(12, { pitch: 0.0, tag: kind });
                }
            } else if (kind === 'spiral') {
                emit(80, { dyaw: d * TAU * 0.95, pitch: -0.2, bank: d * 0.42, tag: kind });
                emit(8, { pitch: -0.08, bank: 0, tag: kind });
            } else if (kind === 'hill') {
                pad(curS() - 2, 0);
                emit(14, { pitch: 0.3, tag: kind });
                emit(8, { pitch: 0.0, tag: kind });
                emit(14, { pitch: -0.5, tag: kind });
                emit(10, { pitch: -0.1, tag: kind });
            } else if (kind === 'gap') {
                emit(12, { pitch: -0.14, tag: kind });
                const a = curS();
                emit(8, { pitch: -0.14, gap: true, tag: kind });
                gaps.push({ s0: a, s1: curS(), hump: 1.5 });
                emit(12, { pitch: -0.1, tag: kind });
            }
            zones.push({ kind, s0, s1: curS() });
            prev = kind;
        }

        // finish
        emit(24, { pitch: -0.08, bank: 0, tag: 'finish' });
        const finishS = curS();
        emit(26, { pitch: 0.0, tag: 'finish' });

        // sovg'a qutilari: har ~50 birlikda, sakrash va to'siq joylaridan tashqarida
        if (opts.items) {
            for (let s = 46 + rand() * 12; s < finishS - 28; s += 44 + rand() * 18) {
                const near = (arr) => arr.some(o => Math.abs(o.s - s) < 5);
                const inGap = gaps.some(g => s > g.s0 - 4 && s < g.s1 + 4);
                if (inGap || near(bumpers) || near(movers)) continue;
                items.push({ s, x: (rand() * 2 - 1) * 1.8, next: 0 });
            }
        }
        // nazorat nuqtalari (saralash): yo'lning 30%, 52% va 74% joyida
        const checkpoints = opts.elimination ? [0.3, 0.52, 0.74].map(f => Math.round(finishS * f)) : [];

        let minY = Infinity;
        for (const s of samples) minY = Math.min(minY, s.p[1]);

        return { samples, boosters, bumpers, gaps, zones, items, movers, checkpoints, finishS, length: curS(), minY, DS, WIDTH, WALL, HUE };
    }

    NS.DS = DS;
    NS.WIDTH = WIDTH;
    NS.WALL = WALL;
    NS.HUE = HUE;
    NS.build = build;
})(window.App = window.App || {});
