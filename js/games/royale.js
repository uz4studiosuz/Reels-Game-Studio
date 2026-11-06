/* games/royale.js — "Oxirgi tirik": nik-sharlar toraygan maydonda bir-biriga uriladi, oxirgisi yutadi. */
(function (App) {
    'use strict';
    const { clamp, lerp, TAU } = App.util;
    const { text, rr, fit, token, frame, clip, PAL, FONT } = App.draw;

    const SETTINGS = [
        { group: 'Ishtirokchilar', key: 'fillBots', label: 'Bot bilan to\'ldirish', type: 'toggle', default: false, hint: () => App.roster.realOnly ? 'Obunachilar bo\'limida "Real obunachilar" yoqilgan (botlar o\'chiq)' : 'Obunachi yetmasa, botlar bilan to\'ldiriladi', active: () => !App.roster.realOnly },
        { key: 'players', label: 'Eng ko\'pi bilan', type: 'range', min: 2, max: 24, step: 1, default: 12, active: (v) => !App.roster.realOnly && !!v.fillBots },
        { key: 'names', label: 'Ismlar ko\'rinsin', type: 'toggle', default: true },
        { group: 'Jang', key: 'hp', label: 'Boshlang\'ich jon', type: 'range', min: 60, max: 300, step: 10, default: 120 },
        { key: 'power', label: 'Zarba kuchi', type: 'range', min: 0.5, max: 2.5, step: 0.1, default: 1, unit: '×' },
        { key: 'pickups', label: 'Davolovchi paketlar', type: 'toggle', default: true, hint: 'Maydonda paydo bo\'ladi, +35% jon' },
        { key: 'zone', label: 'Torayuvchi zona', type: 'toggle', default: true, hint: 'O\'chirilsa, tugashi sekinroq bo\'ladi' },
    ];

    function create(env) {
        const { ctx, W, arena: A, cfg, fx, audio, rnd } = env;
        const people = env.participants(cfg.players, { min: 2, max: 24 });
        if (people.length < 2) return env.emptyScreen('Oxirgi tirik', 2);
        const R = people.length > 16 ? 21 : 26;
        const B = [];
        people.forEach((p, i) => {
            let x, y, k = 0;
            do { x = rnd(A.x + 60, A.x + A.w - 60); y = rnd(A.y + 60, A.y + A.h - 60); k++; }
            while (k < 60 && B.some(o => Math.hypot(o.x - x, o.y - y) < R * 2.6));
            const a = rnd(0, TAU), s = rnd(3, 4.5);
            B.push({ p, i, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: R, hp: cfg.hp * rnd(0.5, 1), max: cfg.hp, atk: rnd(0.85, 1.25), alive: true, flash: 0, by: null });
        });
        let alive = B.length, endT = 0, lastDead = null;
        const feed = [], last = {}, pickups = [];
        const Z = { x0: A.x, y0: A.y, x1: A.x + A.w, y1: A.y + A.h };

        // jadval: o'limlar tanlangan davomiylikka mos tushsin
        function pace() {
            const prog = (B.length - alive) / Math.max(1, B.length - 1);
            return clamp(1 + (env.sched() - prog) * 4, 0.15, 2.6);
        }

        function update() {
            const sp = env.speed, s = env.sched();
            if (cfg.zone) {
                const p = clamp((s - 0.15) / 0.7, 0, 1), crush = s > 1.02 ? 0.6 : 1;
                const fw = 300 * crush, fh = 380 * crush, cx = A.x + A.w / 2, cy = A.y + A.h / 2;
                Z.x0 = lerp(A.x, cx - fw / 2, p); Z.x1 = lerp(A.x + A.w, cx + fw / 2, p);
                Z.y0 = lerp(A.y, cy - fh / 2, p); Z.y1 = lerp(A.y + A.h, cy + fh / 2, p);
            }
            const m = pace() * cfg.power;
            for (let sub = 0; sub < 2; sub++) {
                for (const b of B) {
                    if (!b.alive) continue;
                    b.x += b.vx * sp * 0.5; b.y += b.vy * sp * 0.5;
                    if (b.x < Z.x0 + b.r) { b.x = Z.x0 + b.r; b.vx = Math.abs(b.vx); }
                    if (b.x > Z.x1 - b.r) { b.x = Z.x1 - b.r; b.vx = -Math.abs(b.vx); }
                    if (b.y < Z.y0 + b.r) { b.y = Z.y0 + b.r; b.vy = Math.abs(b.vy); }
                    if (b.y > Z.y1 - b.r) { b.y = Z.y1 - b.r; b.vy = -Math.abs(b.vy); }
                }
                for (let i = 0; i < B.length; i++) {
                    const a = B[i];
                    if (!a.alive) continue;
                    for (let j = i + 1; j < B.length; j++) {
                        const c = B[j];
                        if (!c.alive) continue;
                        const dx = c.x - a.x, dy = c.y - a.y, min = a.r + c.r;
                        if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
                        const d = Math.hypot(dx, dy);
                        if (d >= min || d === 0) continue;
                        const nx = dx / d, ny = dy / d, ov = (min - d) / 2;
                        a.x -= nx * ov; a.y -= ny * ov; c.x += nx * ov; c.y += ny * ov;
                        const rv = (a.vx - c.vx) * nx + (a.vy - c.vy) * ny;
                        if (rv > 0) {
                            a.vx -= rv * nx; a.vy -= rv * ny; c.vx += rv * nx; c.vy += rv * ny;
                            const key = a.i * 32 + c.i;
                            if (rv > 0.6 && env.tick - (last[key] || -99) > 14) {
                                last[key] = env.tick;
                                const dmg = (rv * 1.6 + 2) * m;
                                a.hp -= dmg * c.atk; c.hp -= dmg * a.atk;
                                a.by = c; c.by = a;
                                a.flash = c.flash = 1;
                                audio.hit(rv);
                            }
                        }
                    }
                }
            }
            // paketlar
            if (cfg.pickups && env.tick % 330 === 0 && pickups.length < 3) {
                pickups.push({ x: rnd(Z.x0 + 30, Z.x1 - 30), y: rnd(Z.y0 + 30, Z.y1 - 30), r: 15 });
            }
            for (const b of B) {
                if (!b.alive) continue;
                for (let k = pickups.length - 1; k >= 0; k--) {
                    const pk = pickups[k];
                    if (Math.hypot(pk.x - b.x, pk.y - b.y) < b.r + pk.r) {
                        b.hp = Math.min(b.max, b.hp + b.max * 0.35);
                        fx.float('+jon', b.x, b.y - 36, { color: PAL.good, size: 26 });
                        audio.pop();
                        pickups.splice(k, 1);
                    }
                }
                if (b.flash > 0) b.flash = Math.max(0, b.flash - 0.1);
                const v = Math.hypot(b.vx, b.vy) || 1;
                const t = clamp(v, 2.8, 7);
                b.vx *= t / v; b.vy *= t / v;
                if (b.hp <= 0) {
                    b.alive = false; b.hp = 0; alive--; lastDead = b;
                    fx.burst(b.x, b.y, 22, { hue: b.p.hue });
                    fx.kick(6);
                    audio.boom();
                    const killer = b.by && b.by.alive ? App.roster.display(b.by.p) : null;
                    feed.unshift(`${App.roster.display(b.p)}${killer ? '  ←  ' + killer : ''}`);
                    if (b.p.nick) env.say(App.tts.pick([`${App.roster.spoken(b.p)} chiqib ketdi. ${alive} kishi qoldi`, `${App.roster.spoken(b.p)} yiqildi!`, `Voy, ${App.roster.spoken(b.p)} o'yindan chiqdi. ${alive} kishi qoldi`]), { key: 'death', cooldown: 5500 });
                    if (feed.length > 3) feed.pop();
                }
            }
            if (alive <= 1) {
                endT++;
                if (endT > 40) {
                    const w = B.find(b => b.alive) || lastDead;
                    env.finish({ winner: w.p, kicker: 'OXIRGI TIRIK', title: App.roster.display(w.p), sub: `${B.length} kishidan`, color: App.util.hsl(w.p.hue, 75, 60) });
                }
            }
        }

        function draw() {
            ctx.fillStyle = PAL.panel;
            ctx.fillRect(A.x, A.y, A.w, A.h);
            ctx.save();
            clip(ctx, A);
            if (cfg.zone) {
                ctx.fillStyle = 'rgba(255,77,94,.13)';
                ctx.beginPath(); ctx.rect(A.x, A.y, A.w, A.h); ctx.rect(Z.x0, Z.y0, Z.x1 - Z.x0, Z.y1 - Z.y0); ctx.fill('evenodd');
                ctx.strokeStyle = PAL.bad; ctx.lineWidth = 3;
                ctx.strokeRect(Z.x0, Z.y0, Z.x1 - Z.x0, Z.y1 - Z.y0);
            }
            for (const pk of pickups) {
                ctx.fillStyle = PAL.good;
                ctx.beginPath(); ctx.arc(pk.x, pk.y, pk.r, 0, TAU); ctx.fill();
                ctx.fillStyle = PAL.bg; ctx.fillRect(pk.x - 8, pk.y - 2.5, 16, 5); ctx.fillRect(pk.x - 2.5, pk.y - 8, 5, 16);
            }
            for (const b of B) {
                if (!b.alive) continue;
                token(ctx, b.p, b.x, b.y, b.r, { fill: b.flash > 0.4 ? '#fff' : undefined });
                const bw = b.r * 2;
                ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(b.x - bw / 2, b.y - b.r - 13, bw, 6);
                const f = b.hp / b.max;
                ctx.fillStyle = f > 0.5 ? PAL.good : (f > 0.25 ? '#ffc94d' : PAL.bad);
                ctx.fillRect(b.x - bw / 2, b.y - b.r - 13, bw * f, 6);
                if (cfg.names && b.p.nick) text(ctx, fit(ctx, '@' + b.p.name, 110, 15, 700), b.x, b.y + b.r + 14, { size: 15, weight: 700 });
            }
            ctx.restore();
            frame(ctx, A, PAL.line);
            text(ctx, `${alive}`, W / 2 - 4, 150, { size: 84, weight: 300, align: 'right' });
            text(ctx, `/ ${B.length}`, W / 2 + 4, 162, { size: 30, weight: 600, color: PAL.mute, align: 'left' });
            text(ctx, 'tirik', W / 2, 206, { size: 18, weight: 600, color: PAL.mute });
            feed.forEach((f, i) => text(ctx, fit(ctx, f, 300, 18, 600), A.x + 14, A.y + 24 + i * 26, { size: 18, weight: 600, align: 'left', alpha: 1 - i * 0.28 }));
        }

        return { update, draw };
    }

    App.registry.register({
        id: 'royale',
        name: 'Oxirgi tirik',
        tagline: 'Nik-sharlar toraygan maydonda — oxirgisi yutadi',
        help: 'Nik-sharlar toraygan maydonda uriladi, jon tugaganlar chiqadi. Jon, zarba kuchi, davolovchi paketlar va zonani sozlang.',
        group: 'nick',
        roster: true,
        tags: ['jang'],
        settings: SETTINGS,
        create,
    });
})(window.App = window.App || {});
