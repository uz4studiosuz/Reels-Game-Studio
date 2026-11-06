/* games/bomb.js — "Bomba": bomba odamdan odamga o'tadi, portlaganda qo'lidagi chiqib ketadi. Oxirgisi yutadi. */
(function (App) {
    'use strict';
    const { clamp, lerp, TAU } = App.util;
    const { text, fit, token, PAL } = App.draw;

    const SETTINGS = [
        { group: 'Ishtirokchilar', key: 'fillBots', label: 'Bot bilan to\'ldirish', type: 'toggle', default: false, hint: () => App.roster.realOnly ? 'Obunachilar bo\'limida "Real obunachilar" yoqilgan (botlar o\'chiq)' : 'Obunachi yetmasa, botlar bilan to\'ldiriladi', active: () => !App.roster.realOnly },
        { key: 'players', label: 'Eng ko\'pi bilan', type: 'range', min: 4, max: 20, step: 1, default: 10, active: (v) => !App.roster.realOnly && !!v.fillBots },
        { group: 'Qoida', key: 'mode', label: 'Bomba qanday o\'tadi', type: 'segment', default: 'random', options: [['random', 'Tasodifiy'], ['next', 'Qo\'shniga']] },
        { key: 'fuse', label: 'Pilik uzunligi', type: 'range', min: 0.5, max: 2, step: 0.1, default: 1, unit: '×', hint: 'Har raund necha soniya davom etadi' },
    ];

    function create(env) {
        const { ctx, W, cfg, fx, audio, rnd } = env;
        const people = env.participants(cfg.players, { min: 2, max: 20 });
        if (people.length < 2) return env.emptyScreen('Bomba', 2);
        const P = people.map(p => ({ p, alive: true, ang: 0, tAng: 0, sc: 1 }));
        const CX = W / 2, CY = 690, RR = 232;
        const r = clamp((TAU * RR / P.length) * 0.34, 20, 38);
        let alive = P.length, holder = Math.floor(rnd(0, P.length)), flight = null, passT = 30, left = 0, total = 0, pause = 50, over = false, endT = 0;

        const layout = () => P.filter(x => x.alive).forEach((x, i, a) => { x.tAng = -Math.PI / 2 + i * TAU / a.length; });
        layout(); P.forEach(x => { x.ang = x.tAng; });
        const pos = (x) => [CX + Math.cos(x.ang) * RR, CY + Math.sin(x.ang) * RR];

        function startRound() {
            // har raund orasida ~1.2 s tanaffus bor; qolgan vaqt raundlarga bo'linadi
            const sec = clamp((env.targetSec * 0.85) / Math.max(1, P.length - 1) - 1.2, 1.6, 9) * cfg.fuse * rnd(0.75, 1.25);
            total = left = sec * 60;
            passT = 30;
        }
        startRound();

        const aliveIdx = () => P.map((x, i) => i).filter(i => P[i].alive);
        function target() {
            const al = aliveIdx();
            if (cfg.mode === 'next') return al[(al.indexOf(holder) + 1) % al.length];
            const others = al.filter(i => i !== holder);
            return others[Math.floor(rnd(0, others.length))];
        }

        function explode() {
            const x = P[holder], [px, py] = pos(x);
            x.alive = false; alive--;
            fx.burst(px, py, 34, { hue: 20, speed: 520 });
            fx.float('💥', px, py - 40, { size: 56 });
            fx.kick(14);
            audio.boom();
            if (x.p.nick) env.say(App.tts.pick([`Bomba ${App.roster.spoken(x.p)} qo'lida portladi!`, `Baxtsizlik! ${App.roster.spoken(x.p)} chiqib ketdi`, `${App.roster.spoken(x.p)} ulgurmadi, bomba portladi`]), { key: 'boom', cooldown: 3000 });
            layout();
            if (alive <= 1) { over = true; return; }
            const al = aliveIdx();
            holder = al[Math.floor(rnd(0, al.length))];
            pause = 70;
            startRound();
        }

        function update() {
            const sp = env.speed;
            for (const x of P) { x.ang = lerp(x.ang, x.tAng, 0.12); if (!x.alive) x.sc = Math.max(0, x.sc - 0.06); }
            if (over) {
                if (++endT === 50) {
                    const w = P.find(x => x.alive);
                    env.finish({ winner: w.p, kicker: 'OXIRGI QOLGAN', title: App.roster.display(w.p), sub: `${P.length} kishidan`, color: App.util.hsl(w.p.hue, 75, 60) });
                }
                return;
            }
            if (pause > 0) { pause -= sp; return; }
            if (flight) {
                flight.t += sp / 11;
                if (flight.t >= 1) { holder = flight.to; flight = null; passT = lerp(0.85, 0.22, 1 - left / total) * 60; audio.tick(holder); }
                return;
            }
            left -= sp; passT -= sp;
            if (left <= 0) { explode(); return; }
            if (passT <= 0) {
                flight = { from: holder, to: target(), t: 0 };
                audio.tone(500 + (1 - left / total) * 700, 0.06, 'square', 0.05);
            }
        }

        function draw() {
            ctx.strokeStyle = 'rgba(245,242,234,.08)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(CX, CY, RR, 0, TAU); ctx.stroke();

            P.forEach((x, i) => {
                if (x.sc <= 0) return;
                const [px, py] = pos(x);
                ctx.save();
                ctx.translate(px, py); ctx.scale(x.sc, x.sc);
                const hot = i === holder && x.alive;
                if (hot) { ctx.beginPath(); ctx.arc(0, 0, r + 8 + Math.sin(env.tick / 5) * 2, 0, TAU); ctx.strokeStyle = PAL.accent; ctx.lineWidth = 4; ctx.stroke(); }
                token(ctx, x.p, 0, 0, r, { ring: !hot });
                ctx.restore();
                if (x.alive) {
                    const lx = CX + Math.cos(x.ang) * (RR + r + 24), ly = CY + Math.sin(x.ang) * (RR + r + 24);
                    text(ctx, fit(ctx, App.roster.display(x.p), 116, 17, 700), lx, ly, { size: 17, weight: 700, alpha: hot ? 1 : 0.7 });
                }
            });

            // bomba
            if (!over) {
                let bx, by;
                if (flight) {
                    const a = pos(P[flight.from]), b = pos(P[flight.to]);
                    bx = lerp(a[0], b[0], flight.t); by = lerp(a[1], b[1], flight.t) - Math.sin(flight.t * Math.PI) * 60;
                } else { const a = pos(P[holder]); bx = a[0]; by = a[1] - r - 20; }
                const frac = 1 - left / total;
                const pulse = 1 + 0.12 * Math.sin(env.tick / (7 - 5 * frac));
                ctx.save();
                ctx.translate(bx, by); ctx.scale(pulse, pulse);
                ctx.fillStyle = '#0d0d10'; ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.fill();
                ctx.lineWidth = 3; ctx.strokeStyle = PAL.ink; ctx.stroke();
                ctx.strokeStyle = PAL.ink; ctx.beginPath(); ctx.moveTo(6, -13); ctx.quadraticCurveTo(12, -22, 18, -18); ctx.stroke();
                ctx.fillStyle = frac > 0.7 && env.tick % 6 < 3 ? '#fff' : PAL.accent;
                ctx.beginPath(); ctx.arc(18, -18, 4 + frac * 3, 0, TAU); ctx.fill();
                ctx.restore();
            }

            text(ctx, String(alive), CX, CY - 8, { size: 120, weight: 300 });
            text(ctx, 'tirik', CX, CY + 62, { size: 18, weight: 600, color: PAL.mute });
            text(ctx, 'BOMBA', W / 2, 150, { size: 20, weight: 800, color: PAL.mute });
        }

        return { update, draw };
    }

    App.registry.register({
        id: 'bomb',
        name: 'Bomba',
        tagline: 'Bomba qo\'ldan-qo\'lga o\'tadi — portlaganda kimda bo\'lsa chiqadi',
        help: 'Bomba qo\'ldan-qo\'lga o\'tadi, portlaganda kimda bo\'lsa chiqadi. Pilik uzunligi raund davomiyligini belgilaydi.',
        group: 'nick',
        roster: true,
        tags: ['suspense'],
        settings: SETTINGS,
        create,
    });
})(window.App = window.App || {});
