/* games/tug.js — "Arqon tortish": obunachilar ikki jamoaga bo'linib arqon tortadi. Belgi chiziqdan o'tsa — g'alaba.
 * Jamoa obunachi profilida saqlanadi (Armiya jangi bilan bir xil jamoa). */
(function (App) {
    'use strict';
    const { clamp, lerp, TAU, hsl } = App.util;
    const { text, rr, fit, token, PAL } = App.draw;
    const TEAM = ['#ff5a36', '#4f8cff'];

    const SETTINGS = [
        { group: 'Ishtirokchilar', key: 'fillBots', label: 'Bot bilan to\'ldirish', type: 'toggle', default: false, hint: () => App.roster.realOnly ? 'Obunachilar bo\'limida "Real obunachilar" yoqilgan (botlar o\'chiq)' : 'Obunachi yetmasa, botlar bilan to\'ldiriladi', active: () => !App.roster.realOnly },
        { key: 'players', label: 'Eng ko\'pi bilan', type: 'range', min: 2, max: 40, step: 2, default: 16, hint: 'Yarmi qizil, yarmi ko\'k jamoada', active: (v) => !App.roster.realOnly && !!v.fillBots },
        { key: 'remember', label: 'Saqlangan jamoani ishlatish', type: 'toggle', default: true, hint: 'Obunachi Armiya jangidagi jamoasida chiqadi' },
        { group: 'Jamoalar', key: 'aName', label: 'Chap jamoa', type: 'text', default: 'QIZILLAR' },
        { key: 'bName', label: 'O\'ng jamoa', type: 'text', default: 'KO\'KLAR' },
        { group: 'Tortish', key: 'surges', label: 'Kuchli tortishlar', type: 'toggle', default: true, hint: 'Vaqti-vaqti bilan kimdir keskin tortadi' },
        { key: 'names', label: 'Ismlar ko\'rinsin', type: 'toggle', default: true },
    ];

    function create(env) {
        const { ctx, W, arena: A, cfg, fx, audio, rnd } = env;
        const people = env.participants(cfg.players, { min: 2, max: 40 });
        if (people.length < 2) return env.emptyScreen('Arqon tortish', 2);
        // jamoalar: saqlangan jamoa saqlanadi, qolganlar kichik jamoaga
        const cnt = [0, 0];
        const M = people.map(p => ({ p, team: -1, str: rnd(0.7, 1.3), ph: rnd(0, TAU), f: rnd(1.2, 2.4), surge: 0, total: 0 }));
        for (const m of M) if (cfg.remember && m.p.nick && (m.p.team === 0 || m.p.team === 1)) { m.team = m.p.team; cnt[m.team]++; }
        for (const m of M) if (m.team < 0) { m.team = cnt[0] <= cnt[1] ? 0 : 1; cnt[m.team]++; if (cfg.remember && m.p.nick) App.roster.profile(m.p.name).team = m.team; }
        if (cfg.remember) App.roster.saveProfiles();
        const teams = [M.filter(m => m.team === 0), M.filter(m => m.team === 1)];
        const names = [cfg.aName || 'A', cfg.bName || 'B'];
        const CX = W / 2, RY = 700, SPAN = 250;
        let pos = 0, vel = 0, t = 0, done = false, endT = 0, winner = -1, lastNote = -99;
        const feed = [];

        function update() {
            const sp = env.speed, dt = sp / 60, s = env.sched();
            t += dt;
            const F = [0, 0];
            for (const m of M) {
                m.surge = Math.max(0, m.surge - dt * 1.2);
                if (cfg.surges && !done && rnd(0, 1) < 0.0028 * sp) {
                    m.surge = 1;
                    if (m.p.nick && t - lastNote > 1.2) {
                        lastNote = t;
                        feed.unshift({ text: `💪 ${App.roster.display(m.p)} kuchli tortdi`, at: env.tick, team: m.team });
                        if (feed.length > 3) feed.pop();
                        env.say(`${App.roster.spoken(m.p)} kuchli tortdi!`, { key: 'surge', cooldown: 6000 });
                    }
                    audio.tone(m.team ? 330 : 260, 0.12, 'triangle', 0.06, 1.4);
                }
                const f = m.str * (0.75 + 0.25 * Math.sin(t * m.f + m.ph)) * (1 + m.surge * 0.9);
                F[m.team] += f; m.total += f * dt;
            }
            // markazga qaytaruvchi kuch: boshida kuchli (tarang), oxirida yo'qoladi; jadvaldan oshsa farq kuchayadi
            const diff = (F[1] - F[0]) / Math.max(1, F[0] + F[1]);
            const center = 2.6 * Math.max(0, 1 - s / 0.85);
            const boost = s > 0.85 ? 1 + (s - 0.85) * 7 : 1;
            // vaqt tugay boshlasa — oldindagi jamoa tomonga qo'shimcha siljish (o'yin baribir tugaydi)
            const late = s > 0.85 ? Math.sign(pos || diff || 1) * (s - 0.85) * 3.5 : 0;
            const acc = diff * 3.2 * boost - pos * center + late + (rnd(0, 1) - 0.5) * 0.4;
            if (!done) {
                vel = (vel + acc * dt) * Math.pow(0.95, sp);
                pos += vel * dt;
                if (Math.abs(pos) >= 1) {
                    pos = Math.sign(pos); done = true; winner = pos > 0 ? 1 : 0;
                    fx.kick(12); audio.boom();
                    for (const m of teams[1 - winner]) fx.burst(CX + pos * SPAN, RY, 6, { hue: winner ? 220 : 12 });
                }
            } else if (++endT === 50) {
                const mvp = teams[winner].reduce((a, b) => (b.total > a.total ? b : a));
                env.finish({
                    winners: teams[winner].map(m => m.p), kicker: 'G\'OLIB JAMOA', title: names[winner],
                    sub: `MVP ${App.roster.display(mvp.p)}`, color: TEAM[winner],
                    speak: `${names[winner]} g'alaba qozondi! Eng kuchli: ${App.roster.spoken(mvp.p)}.`,
                });
            }
        }

        function draw() {
            // maydon: ikki tomon, markaz va g'alaba chiziqlari
            for (const k of [0, 1]) {
                ctx.fillStyle = k ? 'rgba(79,140,255,.10)' : 'rgba(255,90,54,.10)';
                ctx.fillRect(k ? CX : A.x, A.y, A.w / 2, A.h);
            }
            ctx.fillStyle = 'rgba(245,242,234,.35)'; ctx.fillRect(CX - 1.5, A.y, 3, A.h);
            for (const k of [-1, 1]) {
                ctx.fillStyle = TEAM[k > 0 ? 1 : 0];
                ctx.fillRect(CX + k * SPAN - 3, A.y + 140, 6, A.h - 280);
                text(ctx, 'G\'ALABA', CX + k * SPAN, A.y + 120, { size: 15, weight: 800, color: TEAM[k > 0 ? 1 : 0] });
            }
            // loy chuqurchasi (markaz)
            ctx.fillStyle = '#3a2a1c'; rr(ctx, CX - 40, RY - 120, 80, 240, 30); ctx.fill();

            const off = pos * SPAN;
            // arqon (bir oz tebranib turadi)
            ctx.strokeStyle = '#d9b77a'; ctx.lineWidth = 7; ctx.lineCap = 'round';
            ctx.beginPath();
            for (let x = A.x + 10; x <= A.x + A.w - 10; x += 12) {
                const y = RY + Math.sin(x * 0.05 + t * 9) * Math.abs(vel) * 6;
                if (x === A.x + 10) ctx.moveTo(x + off * 0, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
            // belgi (lenta)
            ctx.fillStyle = PAL.accent; ctx.fillRect(CX + off - 5, RY - 26, 10, 52);
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(CX + off, RY - 26); ctx.lineTo(CX + off + 22, RY - 18); ctx.lineTo(CX + off, RY - 10); ctx.fill();

            // o'yinchilar arqon bo'ylab
            for (const k of [0, 1]) {
                const list = teams[k], n = list.length, gap = Math.min(52, 270 / Math.max(1, Math.ceil(n / 2)));
                list.forEach((m, i) => {
                    const dir = k ? 1 : -1, col = Math.floor(i / 2), side = i % 2 ? 1 : -1;
                    const x = CX + off + dir * (70 + col * gap), y = RY + side * 30;
                    const lean = (k ? 1 : -1) * (6 + m.surge * 8);
                    ctx.strokeStyle = TEAM[k]; ctx.lineWidth = 4;
                    ctx.beginPath(); ctx.moveTo(x + lean, y); ctx.lineTo(x, RY); ctx.stroke();
                    const r = 15 + m.surge * 4;
                    token(ctx, m.p, x + lean, y, r);
                    if (cfg.names && n <= 16 && m.p.nick) text(ctx, fit(ctx, '@' + m.p.name, 90, 12, 700), x + lean, y + side * (r + 12), { size: 12, weight: 700, alpha: 0.85 });
                });
            }

            // sarlavha va kuch chizig'i
            for (const k of [0, 1]) {
                const cx = k ? W - 170 : 170;
                text(ctx, fit(ctx, names[k], 280, 22, 800), cx, 128, { size: 22, weight: 800, color: TEAM[k] });
                text(ctx, String(teams[k].length), cx, 178, { size: 52, weight: 300 });
            }
            text(ctx, 'VS', W / 2, 160, { size: 20, weight: 800, color: PAL.mute });
            const bw = A.w, bx = A.x, mid = bx + bw / 2 + pos * (bw / 2);
            ctx.fillStyle = TEAM[0]; ctx.fillRect(bx, 214, mid - bx, 8);
            ctx.fillStyle = TEAM[1]; ctx.fillRect(mid, 214, bx + bw - mid, 8);
            feed.forEach((f, i) => {
                const age = (env.tick - f.at) / 60;
                if (age < 4) text(ctx, fit(ctx, f.text, 600, 20, 700), W / 2, A.y + 40 + i * 30, { size: 20, weight: 700, color: TEAM[f.team], alpha: clamp(1 - (age - 3) , 0, 1) });
            });
        }

        return { update, draw };
    }

    App.registry.register({
        id: 'tug',
        name: 'Arqon tortish',
        tagline: 'Obunachilar ikki jamoada arqon tortadi — kim kuchli?',
        help: 'Obunachilar ikki jamoaga bo\'linadi (Armiya jangidagi jamoasi saqlanadi) va arqon tortadi. Belgi g\'alaba chizig\'idan o\'tsa — o\'sha jamoa yutadi. Vaqti-vaqti bilan kimdir kuchli tortadi.',
        group: 'nick',
        roster: true,
        tags: ['jamoa'],
        settings: SETTINGS,
        create,
    });
})(window.App = window.App || {});
