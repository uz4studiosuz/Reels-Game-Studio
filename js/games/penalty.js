/* games/penalty.js — "Penalti seriyasi": har bir obunachi navbat bilan penalti tepadi.
 * Saralash rejimida gol urganlar keyingi raundga o'tadi, oxirida bittasi qoladi. */
(function (App) {
    'use strict';
    const { clamp, lerp, TAU, easeOut } = App.util;
    const { text, rr, fit, token, PAL } = App.draw;

    const SETTINGS = [
        { group: 'Ishtirokchilar', key: 'fillBots', label: 'Bot bilan to\'ldirish', type: 'toggle', default: false, hint: () => App.roster.realOnly ? 'Obunachilar bo\'limida "Real obunachilar" yoqilgan (botlar o\'chiq)' : 'Obunachi yetmasa, botlar bilan to\'ldiriladi', active: () => !App.roster.realOnly },
        { key: 'players', label: 'Eng ko\'pi bilan', type: 'range', min: 2, max: 20, step: 1, default: 8, active: (v) => !App.roster.realOnly && !!v.fillBots },
        { group: 'Qoida', key: 'mode', label: 'Rejim', type: 'segment', default: 'knockout', options: [['knockout', 'Saralash'], ['single', 'Bitta raund']], hint: 'Saralash: gol urganlar keyingi raundga o\'tadi, bittasi qolguncha' },
        { key: 'keeper', label: 'Darvozabon mahorati', type: 'range', min: 0.1, max: 0.9, step: 0.05, default: 0.45 },
        { key: 'miss', label: 'Darvozadan chetga chiqish', type: 'range', min: 0, max: 0.3, step: 0.02, default: 0.1 },
    ];

    function create(env) {
        const { ctx, W, arena: A, cfg, fx, audio, rnd, rand } = env;
        const people = env.participants(cfg.players, { min: 1, max: 20 });
        if (people.length < 1) return env.emptyScreen('Penalti', 1);
        const GX = W / 2, GT = A.y + 150, GW = 420, GH = 170;   // darvoza
        const SPOT = { x: GX, y: A.y + A.h - 170 };
        // davomiylik: taxminiy zarbalar soniga qarab bitta zarba tezligi
        const est = cfg.mode === 'knockout' ? people.length * 1.9 : people.length;
        const TS = clamp((env.targetSec * 0.9) / (est * 1.75), 0.55, 1.8);   // 1 = ~2.3 s bitta zarba

        let round = 1, queue = people.slice(), scored = [], log = [];
        let cur = null, phase = 'walk', pt = 0, done = false, endT = 0, banner = null;
        let keeper = { x: 0, y: 0, rot: 0 };

        function nextShot() {
            if (!queue.length) {
                // raund tugadi
                if (cfg.mode === 'single') return finish(scored);
                if (scored.length === 1) return finish(scored);
                const next = scored.length ? scored : log.map(l => l.p);            // hech kim urmasa — hammasi qayta
                banner = { text: scored.length ? `${round + 1}-RAUND` : 'Hech kim urmadi — qaytadan!', at: env.tick };
                round++; queue = next.slice(); scored = []; log = [];
                env.say(`${round}-raund! ${queue.length} kishi qoldi`, { key: 'round', cooldown: 2000 });
            }
            const p = queue.shift();
            // nishon: darvoza ichida (tx: -1..1, ty: 0..1 balandlik)
            const miss = rand() < cfg.miss;
            const tx = miss ? (rand() < 0.5 ? -1 : 1) * (1.12 + rand() * 0.2) : (rand() * 2 - 1) * 0.92;
            const ty = miss && rand() < 0.4 ? 1.2 : rand() * 0.95;
            // darvozabon: mahoratga qarab to'g'ri tomonga sakraydi
            const guess = rand() < 0.5 + cfg.keeper * 0.4 ? tx : -tx * rand();
            const kx = clamp(guess + (rand() - 0.5) * (1 - cfg.keeper) * 0.8, -1, 1);
            const reach = 0.3 + cfg.keeper * 0.18;
            const res = miss ? 'miss' : (Math.abs(tx - kx) < reach && ty < 0.88 ? 'save' : 'goal');
            cur = { p, tx, ty, kx, res };
            phase = 'walk'; pt = 0;
        }

        function finish(list) {
            done = true;
            if (cfg.mode === 'single') {
                env.finish({ winners: list, kicker: 'GOL URGANLAR', title: `${list.length} ta gol`, sub: list.slice(0, 5).map(p => App.roster.display(p)).join(' · ') || 'Hech kim', color: PAL.good });
            } else {
                const w = list[0];
                env.finish({ winner: w, kicker: 'PENALTI QIROLI', title: App.roster.display(w), sub: `${round} raunddan keyin`, color: PAL.good });
            }
        }

        nextShot();

        function update() {
            if (done) return;
            const dt = env.speed / 60 / TS;
            pt += dt;
            if (phase === 'walk' && pt > 0.55) { phase = 'kick'; pt = 0; audio.tone(140, 0.08, 'square', 0.1, 0.5); }
            else if (phase === 'kick' && pt > 0.12) { phase = 'fly'; pt = 0; }
            else if (phase === 'fly' && pt > 0.55) {
                phase = 'result'; pt = 0;
                const c = cur, name = App.roster.spoken(c.p);
                log.push({ p: c.p, res: c.res });
                if (c.res === 'goal') {
                    scored.push(c.p);
                    fx.burst(GX + c.tx * GW / 2, GT + (1 - c.ty) * GH, 30, { hue: 120, speed: 420 });
                    audio.win();
                    if (c.p.nick) env.say(App.tts.pick([`${name} gol urdi!`, `Gol! ${name}`, `${name} aniq tepdi!`]), { key: 'shot', cooldown: 1500 });
                } else if (c.res === 'save') {
                    fx.kick(6); audio.hit(4);
                    env.say(App.tts.pick(['Darvozabon qaytardi!', `${name} urolmadi`, 'Ajoyib seyv!']), { key: 'shot', cooldown: 1500 });
                } else {
                    audio.lose();
                    env.say(App.tts.pick([`${name} tashqariga tepdi`, 'Darvozadan chetga!']), { key: 'shot', cooldown: 1500 });
                }
            } else if (phase === 'result' && pt > 0.85) nextShot();
            // darvozabon harakati
            const kt = phase === 'fly' ? easeOut(clamp(pt / 0.4, 0, 1)) : phase === 'result' ? 1 : 0;
            keeper.x = lerp(0, cur.kx, kt) * GW / 2;
            keeper.rot = lerp(0, cur.kx, kt) * 1.1;
            keeper.y = -Math.sin(kt * Math.PI) * 20;
        }

        function draw() {
            // maydon
            const g = ctx.createLinearGradient(0, A.y, 0, A.y + A.h);
            g.addColorStop(0, '#2f6b33'); g.addColorStop(1, '#3f8a3f');
            ctx.fillStyle = g; ctx.fillRect(A.x, A.y, A.w, A.h);
            for (let i = 0; i < 10; i++) { if (i % 2) { ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.fillRect(A.x, A.y + i * A.h / 10, A.w, A.h / 10); } }
            ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 4;
            ctx.strokeRect(GX - 280, GT + GH, 560, 280);                       // jarima maydoni
            ctx.beginPath(); ctx.arc(SPOT.x, SPOT.y, 5, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
            // darvoza: to'r va ustunlar
            ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1.5;
            for (let x = -GW / 2; x <= GW / 2; x += 21) { ctx.beginPath(); ctx.moveTo(GX + x, GT); ctx.lineTo(GX + x, GT + GH); ctx.stroke(); }
            for (let y = 0; y <= GH; y += 21) { ctx.beginPath(); ctx.moveTo(GX - GW / 2, GT + y); ctx.lineTo(GX + GW / 2, GT + y); ctx.stroke(); }
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 10; ctx.lineCap = 'square';
            ctx.beginPath(); ctx.moveTo(GX - GW / 2, GT + GH); ctx.lineTo(GX - GW / 2, GT); ctx.lineTo(GX + GW / 2, GT); ctx.lineTo(GX + GW / 2, GT + GH); ctx.stroke();

            // darvozabon
            ctx.save();
            ctx.translate(GX + keeper.x, GT + GH - 55 + keeper.y); ctx.rotate(keeper.rot);
            ctx.fillStyle = '#ffc94d'; rr(ctx, -22, -40, 44, 80, 12); ctx.fill();
            ctx.fillStyle = '#ffc94d'; ctx.fillRect(-60, -38, 120, 14);          // qo'llar
            ctx.fillStyle = '#f0cfa8'; ctx.beginPath(); ctx.arc(0, -54, 16, 0, TAU); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.fillRect(-66, -40, 12, 18); ctx.fillRect(54, -40, 12, 18);   // qo'lqoplar
            ctx.restore();

            // tepuvchi va to'p
            if (cur) {
                const walk = phase === 'walk' ? pt / 0.55 : 1;
                const px = SPOT.x - 70 + walk * 50, py = SPOT.y + 110 - walk * 80;
                token(ctx, cur.p, px, py, 30);
                let bx = SPOT.x, by = SPOT.y, sc = 1;
                if (phase === 'fly' || phase === 'result') {
                    const k = phase === 'fly' ? easeOut(clamp(pt / 0.55, 0, 1)) : 1;
                    const tx = GX + cur.tx * GW / 2, ty = GT + (1 - cur.ty) * GH;
                    // seyv bo'lsa to'p darvozabondan qaytadi
                    const stopK = cur.res === 'save' ? 0.85 : 1;
                    bx = lerp(SPOT.x, tx, k * stopK); by = lerp(SPOT.y, ty, k * stopK) - Math.sin(k * Math.PI) * 60;
                    sc = 1 - 0.5 * k;
                    if (phase === 'result' && cur.res === 'save') { bx += pt * 300 * Math.sign(cur.tx || 1); by += pt * 200; }
                }
                ctx.beginPath(); ctx.arc(bx, by, 16 * sc, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
                ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(bx, by, 5 * sc, 0, TAU); ctx.fill();
                text(ctx, fit(ctx, App.roster.display(cur.p), 300, 26, 800), GX, A.y + A.h - 40, { size: 26, weight: 800 });
                if (phase === 'result') {
                    const label = cur.res === 'goal' ? 'GOL!' : cur.res === 'save' ? 'SEYV!' : 'TASHQARIGA!';
                    const col = cur.res === 'goal' ? PAL.good : cur.res === 'save' ? '#ffc94d' : PAL.bad;
                    const s = 1 + Math.max(0, 0.3 - pt) * 2;
                    ctx.save(); ctx.translate(GX, A.y + 470); ctx.scale(s, s);
                    text(ctx, label, 0, 0, { size: 88, weight: 900, color: col });
                    ctx.restore();
                }
            }

            // yuqori panel: raund va natijalar
            text(ctx, `${round}-RAUND`, W / 2, 128, { size: 22, weight: 800, color: PAL.accent });
            text(ctx, `${scored.length} gol · ${queue.length + (cur && phase !== 'result' ? 1 : 0)} navbatda`, W / 2, 178, { size: 34, weight: 300 });
            const items = log.slice(-12);
            items.forEach((l, i) => {
                const x = A.x + 24 + (i % 6) * 108, y = A.y + A.h - 112 + Math.floor(i / 6) * 30;
                text(ctx, (l.res === 'goal' ? '✓ ' : '✕ ') + fit(ctx, l.p.nick ? l.p.name : l.p.name, 80, 15, 700), x, y, { size: 15, weight: 700, align: 'left', color: l.res === 'goal' ? PAL.good : PAL.bad });
            });
            if (banner && env.tick - banner.at < 110) text(ctx, banner.text, W / 2, A.y + 560, { size: 46, weight: 800, alpha: clamp((110 - (env.tick - banner.at)) / 30, 0, 1) });
        }

        return { update, draw };
    }

    App.registry.register({
        id: 'penalty',
        name: 'Penalti seriyasi',
        tagline: 'Har bir obunachi penalti tepadi — oxirgi qolgan yutadi',
        help: 'Obunachilar navbat bilan penalti tepadi. Saralash rejimida gol urganlar keyingi raundga o\'tadi, bittasi qolguncha. Darvozabon mahorati va chetga chiqish ehtimolini sozlang.',
        group: 'nick',
        roster: true,
        tags: ['futbol'],
        settings: SETTINGS,
        create,
    });
})(window.App = window.App || {});
