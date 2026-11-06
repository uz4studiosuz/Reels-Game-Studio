/* games/army/index.js — "Armiya jangi": obunachilar ikki jamoaga bo'linadi (qizil/ko'k) va 3D jangda
 * bir-biri bilan kurashadi. Dushmanning barcha jangchilarini yiqitgan jamoa g'olib bo'ladi. */
(function (App) {
    'use strict';
    const NS = App.army;
    const { clamp } = App.util;
    const { text, rr, fit, PAL, FONT } = App.draw;

    const TEAM_HEX = ['#ff5a36', '#4f8cff'];

    const SETTINGS = [
        { group: 'Qatnashuvchilar', key: 'fillBots', label: 'Bot bilan to\'ldirish', type: 'toggle', default: false, hint: () => App.roster.realOnly ? 'Obunachilar bo\'limida "Real obunachilar" yoqilgan (botlar o\'chiq)' : 'Obunachi yetmasa, botlar bilan to\'ldiriladi', active: () => !App.roster.realOnly },
        { key: 'total', label: 'Eng ko\'pi bilan', type: 'range', min: 2, max: 120, step: 2, default: 60, hint: 'Yarmi qizil, yarmi ko\'k', active: (v) => !App.roster.realOnly && !!v.fillBots },
        { key: 'classes', label: 'Jangchi turi', type: 'segment', default: 'viewer', options: [['viewer', 'Obunachi tanlaydi'], ['random', 'Tasodifiy']], hint: 'Komment: "nik ritsar", "nik:kamonchi", jodugar, otliq, shifokor' },
        { group: 'Jamoalar', key: 'aName', label: 'Qizil jamoa nomi', type: 'text', default: 'QIZIL ARMIYA' },
        { key: 'bName', label: 'Ko\'k jamoa nomi', type: 'text', default: 'KO\'K ARMIYA' },
        { group: 'Ko\'rinish', key: 'camera', label: 'Kamera', type: 'segment', default: 'cinema', options: [['cinema', 'Kino'], ['orbit', 'Aylanma'], ['top', 'Yuqoridan']] },
        { key: 'names', label: 'Ism yorliqlari', type: 'toggle', default: true },
        { key: 'prompt', label: 'Tur tanlash eslatmasi', type: 'toggle', default: true },
        { key: 'remember', label: 'Jamoa va turni eslab qolish', type: 'toggle', default: true, hint: 'Obunachi har safar o\'sha jamoa va jangchida chiqadi (Obunachilar tabida ko\'rinadi)' },
    ];

    const WEIGHTS = [['knight', 0.3], ['archer', 0.25], ['mage', 0.15], ['cavalry', 0.15], ['healer', 0.15]];

    /** Obunachi yetmaganda: ko'rsatma ekrani chiqadi. */
    function emptyScreen(env) {
        const { ctx, W } = env;
        return {
            update() {},
            draw() {
                text(ctx, 'ARMIYA JANGI', W / 2, 380, { size: 22, weight: 800, color: PAL.mute });
                text(ctx, 'Obunachilar kerak', W / 2, 470, { size: 56, weight: 300 });
                const lines = ['Bu o\'yinda faqat obunachilar jang qiladi.', 'Kamida 2 ta nik qo\'shing:', 'Obunachilar tabi → ro\'yxatga joylang', '', 'jangchi turi bilan:  ali ritsar', 'sevara:kamonchi · jodugar · otliq · shifokor'];
                lines.forEach((s, i) => text(ctx, s, W / 2, 570 + i * 44, { size: 24, weight: 600, color: i === 4 || i === 5 ? PAL.accent : PAL.ink, alpha: s ? 0.9 : 0 }));
            },
        };
    }

    function create(env) {
        const { ctx, W, cfg, fx, audio, rand } = env;
        const pplAll = env.participants(cfg.total, { min: 2, max: 120 });
        if (pplAll.length < 2) return emptyScreen(env);
        const remember = cfg.remember !== false;
        const people = pplAll.map((p) => {
            let cls = cfg.classes === 'viewer' ? p.cls : null;
            if (!cls) {
                let r = rand(), acc = 0; cls = 'knight';
                for (const [k, w] of WEIGHTS) { acc += w; if (r < acc) { cls = k; break; } }
                if (remember && p.nick && cfg.classes === 'viewer') App.roster.setClass(p.name, cls);
            }
            return { p, cls, team: -1 };
        });

        // Jamoalar: teng bo'linadi
        const cnt = [0, 0];
        for (const m of people) if (remember && m.p.nick && (m.p.team === 0 || m.p.team === 1)) { m.team = m.p.team; cnt[m.team]++; }
        const free = people.filter(m => m.team < 0);
        for (let i = free.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [free[i], free[j]] = [free[j], free[i]]; }
        for (const m of free) {
            m.team = cnt[0] <= cnt[1] ? 0 : 1; cnt[m.team]++;
            if (remember && m.p.nick) { App.roster.profile(m.p.name).team = m.team; }
        }
        if (remember) App.roster.saveProfiles();
        const names = [cfg.aName || 'QIZIL', cfg.bName || 'KO\'K'];
        const initialCount = [people.filter(m => m.team === 0).length, people.filter(m => m.team === 1).length];

        const battle = new NS.Battle(people, {
            rand,
            combatScale: clamp(34 / env.targetSec, 0.35, 1.1),
            onEvent(type, a, b) { handle(type, a, b); },
        });
        const world = new NS.ArmyWorld(battle);
        const rig = new NS.ArmyCamera(world);
        let slowStart = 0, endTick = 0, finished = false;

        const sparks = [];
        const pick = (arr) => arr[Math.floor(rand() * arr.length)];

        function handle(type, a, b) {
            if (type === 'death') {
                sparks.push({ x: a.x, y: 1.4, z: a.z, n: 16, hue: a.team ? 220 : 12 });
                audio.boom();
                const nm = App.roster.spoken(a.p);
                if (b && b.kills && [3, 5, 8, 12].includes(b.kills) && b.p && b.p.nick) {
                    env.say(`${App.roster.spoken(b.p)} ${b.kills} ta dushmanni yiqitdi!`, { key: 'streak', cooldown: 5000 });
                } else if (a.p && a.p.nick) {
                    env.say(pick([`${nm} yiqildi`, `${nm} jang maydonini tark etdi`, `${nm} mag'lub bo'ldi`]), { key: 'death', cooldown: 7000 });
                }
                const rem = battle.alive(a.team);
                if (rem === 3 || rem === 1) {
                    env.say(`${names[a.team]} armiyasida atigi ${rem} ta jangchi qoldi!`, { key: 'few', cooldown: 6000 });
                }
            } else if (type === 'armyDefeated') {
                slowStart = env.tick;
                fx.kick(18);
                audio.boom();
                sparks.push({ x: 0, y: 3, z: 0, n: 55, hue: b ? 220 : 12 });
                env.say(`${names[b]} armiyasi dushmanni to'liq mag'lub etdi!`, { interrupt: true });
            } else if (type === 'hit') {
                if (env.tick % 3 === 0) sparks.push({ x: a.x, y: 1.2, z: a.z, n: 4, hue: 40, small: true });
                audio.hit(2);
            } else if (type === 'aoe') {
                world.ring(a.tx, a.tz, a.aoe * 1.1);
                sparks.push({ x: a.tx, y: 1, z: a.tz, n: 14, hue: 22 });
                audio.tone(140, 0.25, 'sawtooth', 0.08, 0.4);
            } else if (type === 'shoot') {
                if (b === 'arrow' && env.tick % 4 === 0) audio.tone(900, 0.04, 'triangle', 0.025, 0.5);
            } else if (type === 'heal') {
                sparks.push({ x: a.x, y: 1.6, z: a.z, n: 5, hue: 135, small: true });
            }
        }

        function paceMul() {
            const s = env.sched();
            const dead0 = 1 - battle.alive(0) / Math.max(1, initialCount[0]);
            const dead1 = 1 - battle.alive(1) / Math.max(1, initialCount[1]);
            const prog = Math.max(dead0, dead1);
            const crush = s > 1 ? 1 + (s - 1) * 8 : 1;
            return clamp(1 + (s - prog) * 2.5, 0.6, 2.5) * crush;
        }

        function update() {
            const slow = battle.winner >= 0 ? clamp((env.tick - slowStart) / 140, 0.3, 1) : 1;
            const dt = (1 / 60) * env.speed * slow;
            const sub = Math.ceil(dt / 0.03);
            const mul = paceMul();
            for (let i = 0; i < sub; i++) battle.step(dt / sub, mul);
            world.sync(dt);
            rig.update(cfg.camera, battle, env.tick);

            if (battle.winner >= 0 && !finished) {
                if (!endTick) endTick = env.tick;
                if (env.tick - endTick > 130) {
                    finished = true;
                    const w = battle.winner;
                    for (const u of battle.units) if (u.p.nick) App.roster.recordGame(u.p.name, { won: u.team === w, kills: u.kills, team: u.team });
                    const mvp = battle.units.reduce((m, u) => (u.kills > m.kills ? u : m), battle.units[0]);
                    env.finish({
                        kicker: 'G\'OLIB ARMIYA', title: names[w],
                        sub: `${battle.alive(w)} ta jangchi tirik qoldi · MVP ${mvp.kills ? App.roster.display(mvp.p) : '—'}`,
                        color: TEAM_HEX[w],
                        speak: `${names[w]} g'alaba qozondi! ` + (mvp.kills ? `Eng zo'r jangchi ${App.roster.spoken(mvp.p)}, ${mvp.kills} ta dushmanni yiqitdi.` : 'Dushman armiyasi to\'liq mag\'lub etildi.'),
                    });
                }
            }
        }

        function draw() {
            world.render(0.7);
            ctx.drawImage(App.gl.canvas, 0, 0, W, 1280);

            // 3D nuqtalardan 2D zarralar
            for (const s of sparks) {
                const sp = world.project(s.x, s.y, s.z);
                if (sp) fx.burst(sp.x, sp.y, s.n, { hue: s.hue, speed: s.small ? 160 : 300, life: s.small ? 0.3 : 0.6, size: s.small ? 3 : 6, grav: s.small ? 0 : 500 });
            }
            sparks.length = 0;

            // ism yorliqlari va jon chiziqlari
            const vis = [];
            for (const u of battle.units) {
                if (!u.alive) continue;
                const sp = world.project(u.x, u.cls === 'cavalry' ? 3.3 : 3.7, u.z);
                if (!sp || sp.x < 6 || sp.x > W - 6 || sp.y < 235 || sp.y > 1150) continue;
                vis.push({ u, sp });
                if (u.hp < u.max) {
                    const bw = 26;
                    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(sp.x - bw / 2, sp.y + 6, bw, 4);
                    ctx.fillStyle = TEAM_HEX[u.team]; ctx.fillRect(sp.x - bw / 2, sp.y + 6, bw * u.hp / u.max, 4);
                }
            }
            if (cfg.names) {
                vis.filter(v => v.u.p.nick).sort((a, b) => a.sp.depth - b.sp.depth).slice(0, 12).forEach(({ u, sp }) => {
                    const label = fit(ctx, App.roster.display(u.p), 120, 17, 700);
                    ctx.font = `700 17px ${FONT}`;
                    const w = ctx.measureText(label).width + 36;
                    ctx.fillStyle = 'rgba(13,13,16,.72)';
                    rr(ctx, sp.x - w / 2, sp.y - 14, w, 26, 13); ctx.fill();
                    ctx.fillStyle = TEAM_HEX[u.team]; ctx.beginPath(); ctx.arc(sp.x - w / 2 + 13, sp.y - 1, 5, 0, Math.PI * 2); ctx.fill();
                    text(ctx, u.c.icon, sp.x - w / 2 + 28, sp.y, { size: 14 });
                    text(ctx, label, sp.x + 12, sp.y + 1, { size: 17, weight: 700, color: '#fff' });
                });
            }

            // yuqori panel (armiya kuchi va tirik qolgan jangchilar soni)
            const hg = ctx.createLinearGradient(0, 0, 0, 270);
            hg.addColorStop(0, 'rgba(8,10,16,.82)'); hg.addColorStop(1, 'rgba(8,10,16,0)');
            ctx.fillStyle = hg; ctx.fillRect(0, 0, W, 270);
            for (const t of [0, 1]) {
                const cx = t ? W - 170 : 170;
                text(ctx, fit(ctx, names[t].toUpperCase(), 280, 22, 800), cx, 112, { size: 22, weight: 800, color: TEAM_HEX[t] });
                text(ctx, String(battle.alive(t)), cx, 164, { size: 52, weight: 300 });
                const tot = initialCount[t] || 1;
                const bw = 240, x = cx - bw / 2;
                const ratio = Math.max(0, battle.alive(t) / tot);
                ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(x, 194, bw, 6);
                ctx.fillStyle = TEAM_HEX[t]; ctx.fillRect(x, 194, bw * ratio, 6);
                text(ctx, `${battle.alive(t)} / ${tot} jangchi`, cx, 216, { size: 13, weight: 600, color: PAL.mute });
            }
            text(ctx, 'VS', W / 2, 150, { size: 20, weight: 800, color: PAL.mute });
            if (cfg.prompt && battle.winner < 0) {
                const k = Math.floor(env.tick / 240) % 2;
                text(ctx, k ? '⚔️ ritsar · 🏹 kamonchi · 🔮 jodugar · 🐎 otliq · 💚 shifokor' : 'Kommentga yoz:  nik + jangchi turi', W / 2, 252, { size: 17, weight: 700, color: PAL.ink, alpha: 0.9 });
            }
        }

        function dispose() { world.dispose(); }

        return { update, draw, dispose, debug: () => ({ battle, people, world, rig }) };
    }

    App.registry.register({
        id: 'army',
        name: 'Armiya jangi 3D',
        tagline: 'Obunachilar ikki jamoaga bo\'linib to\'liq jang qiladi — oxirgi tirik armiya yutadi',
        help: 'Obunachilar qizil va ko\'k armiyalarga bo\'linadi. Har kim kommentda jangchi turini tanlaydi. Qaysi jamoaning barcha jangchilari yiqilsa, ikkinchi jamoa g\'alaba qozonadi.',
        group: 'nick',
        roster: true,
        voiceIntro: 'Jang boshlanadi! Qizil va ko\'k armiya to\'qnashadi. Oxirgi qolgan jamoa g\'olib bo\'ladi. Jangchi turingizni kommentga yozing!',
        tags: ['3D', 'RTS'],
        settings: SETTINGS,
        create,
    });
})(window.App = window.App || {});
