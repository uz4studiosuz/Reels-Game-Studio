/* games/wheel.js — "Omadli g'ildirak": obunachilar nikidan g'olib(lar) tanlanadi.
 * Rejimlar: bitta g'olib / bir nechta g'olib / saralash (har aylanishda biri chiqib ketadi). */
(function (App) {
    'use strict';
    const { clamp, TAU, hsl, easeOut } = App.util;
    const { text, rr, fit, PAL, FONT } = App.draw;

    const SETTINGS = [
        { group: 'Ishtirokchilar', key: 'fillBots', label: 'Bot bilan to\'ldirish', type: 'toggle', default: false, hint: () => App.roster.realOnly ? 'Obunachilar bo\'limida "Real obunachilar" yoqilgan (botlar o\'chiq)' : 'Obunachi yetmasa, botlar bilan to\'ldiriladi', active: () => !App.roster.realOnly },
        { key: 'maxNames', label: 'Eng ko\'pi bilan', type: 'range', min: 2, max: 40, step: 1, default: 16, active: (v) => !App.roster.realOnly && !!v.fillBots },
        { group: 'Qoida', key: 'mode', label: 'Rejim', type: 'segment', default: 'single', options: [['single', 'Bitta'], ['multi', 'Bir nechta'], ['elim', 'Saralash']] },
        { key: 'winners', label: 'G\'oliblar soni', type: 'range', min: 2, max: 6, step: 1, default: 3, visible: (v) => v.mode === 'multi' },
        { key: 'prize', label: 'Sovg\'a matni', type: 'text', default: '', placeholder: 'masalan: 100.000 so\'m', hint: 'Tepada ko\'rinadi' },
        { group: 'Ko\'rinish', key: 'theme', label: 'Ranglar', type: 'segment', default: 'color', options: [['color', 'Rangli'], ['mono', 'Qora-oq']] },
    ];

    function create(env) {
        const { ctx, W, arena: A, cfg, fx, audio, rand } = env;
        const rem = env.participants(cfg.maxNames, { min: 2, max: 40 });
        if (rem.length < 2) return env.emptyScreen('Omad charxi', 2);
        const winners = [];
        const out = [];
        const CX = W / 2, CY = 700, R = 290;
        const T = env.targetSec;

        let ang = rand() * TAU;
        let spin = null;       // { t, dur, from, to, idx }
        let hold = 40;         // keyingi aylanishgacha kutish
        let flap = 0, lastSlice = -1, picked = null, finished = false;

        function spinSeconds() {
            if (cfg.mode === 'elim') return clamp((T * 0.8) / Math.max(1, n0 - 1), 1.5, 6);
            if (cfg.mode === 'multi') return clamp((T * 0.7) / cfg.winners, 3.5, 12);
            return clamp(T * 0.4, 8, 30);
        }

        function startSpin() {
            const idx = Math.floor(rand() * rem.length);
            const slice = TAU / rem.length;
            if (cfg.mode !== 'elim') env.say('G\'ildirak aylanmoqda. Kim yutadi?', { key: 'spin', cooldown: 9000 });
            const center = (idx + 0.5) * slice + (rand() - 0.5) * slice * 0.7;
            const target = -Math.PI / 2 - center;
            const sec = spinSeconds();
            const turns = cfg.mode === 'elim' ? 2 + Math.floor(rand() * 2) : 5 + Math.floor(rand() * 3);
            const delta = ((target - ang) % TAU + TAU) % TAU + TAU * turns;
            spin = { t: 0, dur: sec * 60, from: ang, to: ang + delta, idx };
            picked = null;
        }

        function resolve(idx) {
            const p = rem[idx];
            picked = p;
            const sx = CX, sy = CY - R + 60;
            if (cfg.mode === 'elim') {
                rem.splice(idx, 1);
                out.unshift(p);
                env.say(`${App.roster.spoken(p)} chiqdi`, { key: 'elim', cooldown: 1500 });
                fx.burst(sx, sy, 24, { hue: p.hue, speed: 420 });
                fx.float('chiqdi', CX, CY - R - 56, { color: PAL.bad, size: 30 });
                audio.boom();
                if (rem.length === 1) finish(rem[0]);
            } else if (cfg.mode === 'multi') {
                rem.splice(idx, 1);
                winners.push(p);
                fx.burst(sx, sy, 30, { hue: p.hue, speed: 480 });
                audio.win();
                if (winners.length >= cfg.winners) finish(null);
            } else {
                winners.push(p);
                fx.burst(sx, sy, 40, { hue: p.hue, speed: 520 });
                finish(p);
            }
        }

        function finish(p) {
            finished = true;
            if (cfg.mode === 'multi') {
                env.finish({ winners, kicker: 'G\'OLIBLAR', title: `${winners.length} ta g'olib`, sub: winners.map(w => App.roster.display(w)).join(' · '), color: PAL.accent });
            } else {
                env.finish({ winner: p, kicker: cfg.mode === 'elim' ? 'OXIRGI QOLGAN' : 'G\'OLIB', title: App.roster.display(p), sub: cfg.prize || '', color: hsl(p.hue, 75, 60) });
            }
        }

        function update() {
            flap = Math.max(0, flap - 0.05);
            if (finished) return;
            if (!spin) {
                if (--hold <= 0 && rem.length > 1) startSpin();
                return;
            }
            const prev = ang;
            spin.t += env.speed;
            const k = Math.min(1, spin.t / spin.dur);
            ang = spin.from + (spin.to - spin.from) * (1 - Math.pow(1 - k, 4));
            // pointer ostidagi bo'lak o'zgarsa — "tik" ovozi va tilcha
            const slice = TAU / rem.length;
            const under = Math.floor((((-Math.PI / 2 - ang) % TAU + TAU) % TAU) / slice);
            if (under !== lastSlice) { lastSlice = under; flap = clamp(Math.abs(ang - prev) * 8, 0.15, 0.7); audio.tick(under); }
            if (k >= 1) { const idx = spin.idx; spin = null; hold = 80; resolve(idx); }
        }

        function draw() {
            const n = rem.length, slice = TAU / n;
            const mono = cfg.theme === 'mono';

            // sarlavha
            text(ctx, cfg.prize ? fit(ctx, cfg.prize, 620, 54, 800) : 'OMADLI G\'ILDIRAK', W / 2, 140, { size: cfg.prize ? 54 : 44, weight: cfg.prize ? 800 : 300 });
            text(ctx, cfg.mode === 'elim' ? `qoldi: ${n}` : cfg.mode === 'multi' ? `g'oliblar: ${winners.length} / ${cfg.winners}` : `${n} ishtirokchi`, W / 2, 196, { size: 20, weight: 600, color: PAL.mute });

            // g'ildirak
            ctx.save();
            ctx.translate(CX, CY);
            ctx.rotate(ang);
            for (let i = 0; i < n; i++) {
                const p = rem[i], a0 = i * slice, a1 = (i + 1) * slice;
                const isPick = picked === p && !spin;
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, a0, a1); ctx.closePath();
                ctx.fillStyle = mono ? (i % 2 ? '#1d1d23' : '#f5f2ea') : hsl(p.hue, 62, 56);
                ctx.fill();
                ctx.lineWidth = 2; ctx.strokeStyle = PAL.bg; ctx.stroke();
                // yozuv
                ctx.save();
                ctx.rotate(a0 + slice / 2);
                const arc = TAU * R * 0.62 / n;
                const size = clamp(arc * 0.5, 13, 30);
                ctx.font = `800 ${size}px ${FONT}`;
                ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
                ctx.fillStyle = mono ? (i % 2 ? '#f5f2ea' : '#111') : '#0d0d10';
                ctx.fillText(fit(ctx, p.nick ? p.name : p.label, R * 0.66, size, 800), R - 22, 1);
                ctx.restore();
            }
            ctx.restore();
            // gardish va markaz
            ctx.beginPath(); ctx.arc(CX, CY, R + 6, 0, TAU); ctx.lineWidth = 12; ctx.strokeStyle = PAL.ink; ctx.stroke();
            ctx.beginPath(); ctx.arc(CX, CY, 42, 0, TAU); ctx.fillStyle = PAL.bg; ctx.fill();
            ctx.lineWidth = 4; ctx.strokeStyle = PAL.ink; ctx.stroke();
            // ko'rsatkich
            ctx.save();
            ctx.translate(CX, CY - R - 10);
            ctx.rotate(-flap);
            ctx.fillStyle = PAL.accent;
            ctx.beginPath(); ctx.moveTo(-22, -26); ctx.lineTo(22, -26); ctx.lineTo(0, 34); ctx.closePath(); ctx.fill();
            ctx.restore();

            // pastda: g'oliblar yoki chiqqanlar
            const list = cfg.mode === 'multi' ? winners : out.slice(0, 4);
            list.forEach((p, i) => {
                const y = 1046 + i * 34;
                ctx.fillStyle = cfg.mode === 'multi' ? PAL.accent : PAL.mute;
                text(ctx, cfg.mode === 'multi' ? String(i + 1) : '×', A.x + 70, y, { size: 18, weight: 800, color: cfg.mode === 'multi' ? PAL.accent : PAL.mute });
                text(ctx, fit(ctx, App.roster.display(p), 400, 24, 700), A.x + 100, y + 1, { size: 24, weight: 700, align: 'left', alpha: cfg.mode === 'multi' ? 1 : 0.6 - i * 0.1 });
            });
        }

        return { update, draw };
    }

    App.registry.register({
        id: 'wheel',
        name: 'Omadli g\'ildirak',
        tagline: 'Nikdagi obunachilardan g\'olib tanlash — giveaway uchun',
        help: 'G\'ildirak nik-lardan g\'olib tanlaydi. Rejim: bitta g\'olib, bir nechta g\'olib yoki saralash (har aylanishda biri chiqadi). Sovg\'a matni tepada ko\'rinadi.',
        group: 'nick',
        roster: true,
        tags: ['giveaway'],
        settings: SETTINGS,
        create,
    });
})(window.App = window.App || {});
