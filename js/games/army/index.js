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
        { key: 'total', label: 'Eng ko\'pi bilan', type: 'range', min: 2, max: 120, step: 2, default: 60, hint: (v) => { const h = Math.round((v.total || 60) / 2); return `Yarmi qizil, yarmi ko'k (${h} + ${h})` + (App.roster.names.length ? ` · Ro'yxatda: ${App.roster.names.length} ta` : ''); } },
        { key: 'classes', label: 'Jangchi turi', type: 'segment', default: 'viewer', options: [['viewer', 'Obunachi tanlaydi'], ['random', 'Tasodifiy']], hint: 'Komment: "nik ritsar", "nik:kamonchi", ritsar, kamonchi, jodugar, otliq, shifokor' },
        { group: 'Jamoalar', key: 'aName', label: 'Qizil jamoa nomi', type: 'text', default: 'QIZIL ARMIYA' },
        { key: 'bName', label: 'Ko\'k jamoa nomi', type: 'text', default: 'KO\'K ARMIYA' },
        {
            key: 'autoBalance',
            label: 'Odamlar sonini taqsimlash',
            type: 'button',
            buttonText: '⚖️ Avto taqsimlash (50 / 50)',
            hint: () => {
                const R = App.roster;
                let c0 = 0, c1 = 0;
                for (const e of R.names) {
                    const t = R.profile(R.split(e).name).team;
                    if (t === 0) c0++; else if (t === 1) c1++;
                }
                const un = R.names.length - c0 - c1;
                return `Hozir: Qizil ${c0} ta, Ko'k ${c1} ta` + (un > 0 ? `, noma'lum ${un} ta` : '') + '. Bosilsa obunachilar ikkala armiyaga teng 50/50 taqsimlanadi.';
            },
            onClick: ({ refresh }) => {
                App.roster.autoDistributeTeams();
                if (refresh) refresh();
            },
        },
        { group: 'Ko\'rinish', key: 'camera', label: 'Kamera', type: 'segment', default: 'cinema', options: [['cinema', 'Kino'], ['orbit', 'Aylanma'], ['top', 'Yuqoridan']] },
        { key: 'names', label: 'Ism yorliqlari', type: 'toggle', default: true },
        { key: 'prompt', label: 'Tur tanlash eslatmasi', type: 'toggle', default: true },
        { key: 'remember', label: 'Jamoa va turni eslab qolish', type: 'toggle', default: true, hint: 'Obunachi har safar o\'sha jamoa va jangchida chiqadi (Obunachilar tabida ko\'rinadi)' },
    ];

    const WEIGHTS = [
        ['knight', 0.18], ['archer', 0.14], ['mage', 0.10], ['cavalry', 0.10], ['healer', 0.08],
        ['king', 0.04], ['king_father', 0.03], ['dragon', 0.04], ['giant', 0.04], ['godzilla', 0.03],
        ['commander', 0.05], ['programmer', 0.04], ['banker', 0.04], ['blogger', 0.04],
        ['dark_knight', 0.05], ['builder', 0.04],
    ];

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
        const power = m => { const c = NS.CLASSES[m.cls]; return c.hp + (c.dmg || 0) / c.cd * 12 + (c.heal || 0) / c.cd * 8; };
        const strengths = [0, 0];
        for (const m of people) if (m.team >= 0) strengths[m.team] += power(m);
        free.sort ( (a, b) => power(b) - power(a) );
        for (const m of free) {
            m.team = cnt[0] !== cnt[1] ? (cnt[0] < cnt[1] ? 0 : 1) : (strengths[0] <= strengths[1] ? 0 : 1);
            cnt[m.team]++; strengths[m.team] += power(m);
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
        const rnd = (a, b) => a + rand() * (b - a);
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
                if (env.tick - endTick > 300) {
                    finished = true;
                    const w = battle.winner;
                    for (const u of battle.units) if (u.p.nick) App.roster.recordGame(u.p.name, { won: u.team === w, kills: u.kills, team: u.team });
                    const mvp = battle.units.reduce((m, u) => (u.kills > m.kills ? u : m), battle.units[0]);
                    const winnersList = battle.units.filter(u => u.team === w).sort((a, b) => (b.alive ? 1 : 0) - (a.alive ? 1 : 0) || b.kills - a.kills);
                    env.finish({
                        kicker: 'G\'OLIB ARMIYA', title: names[w],
                        sub: `${battle.alive(w)} ta jangchi tirik qoldi · MVP ${mvp.kills ? App.roster.display(mvp.p) : '—'}`,
                        color: TEAM_HEX[w],
                        winners: winnersList.map(u => ({
                            name: App.roster.display(u.p),
                            icon: u.c.icon,
                            clsName: u.c.name,
                            kills: u.kills,
                            alive: u.alive
                        })),
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

            // ism yorliqlari va jon chiziqlari (barcha obunachilar ko'rinadi)
            const camPos = world.camera.position;
            const vis = [];
            for (const u of battle.units) {
                if (!u.alive) continue;
                const headY = u.cls === 'cavalry' ? 3.4 : 3.6;
                const sp = world.project(u.x, headY, u.z);
                if (!sp || sp.x < 4 || sp.x > W - 4 || sp.y < 70 || sp.y > 1260) continue;
                const dist = Math.hypot(u.x - camPos.x, headY - camPos.y, u.z - camPos.z);
                vis.push({ u, sp, dist });
            }

            // Orqadagi jangchilardan oldingilarga qarab chizish (yaqindagi yorliqlar ustma-ust chiroyli chiqadi)
            vis.sort((a, b) => b.dist - a.dist);

            for (const { u, sp, dist } of vis) {
                // Masofaga qarab proporsional masshtab (uzoqdagi jangchilar ekranni to'sib qo'ymaydi)
                const sc = clamp(44 / dist, 0.62, 1.15);

                // Ekran chetlarida yumshoq so'nish
                let alpha = 1;
                if (sp.y < 210) alpha = clamp((sp.y - 95) / 105, 0, 1);
                else if (sp.y > 1200) alpha = clamp((1260 - sp.y) / 60, 0, 1);
                if (alpha <= 0.04) continue;

                if (cfg.names) {
                    const fontSize = Math.round(15 * sc);
                    const rawName = App.roster.display(u.p);
                    const label = fit(ctx, rawName, Math.round(110 * sc), fontSize, 700);
                    ctx.font = `700 ${fontSize}px ${FONT}`;
                    const textW = ctx.measureText(label).width;

                    const padDot = 9 * sc;
                    const dotToIcon = 12 * sc;
                    const iconToText = 13 * sc;
                    const padRight = 10 * sc;
                    const pillW = Math.round(padDot + dotToIcon + iconToText + textW + padRight);
                    const pillH = Math.round(22 * sc);
                    const pillR = Math.round(pillH / 2);
                    const pillX = Math.round(sp.x - pillW / 2);
                    const pillY = Math.round(sp.y - pillH - (u.hp < u.max ? 6 * sc : 2 * sc));
                    const midY = pillY + pillH / 2;

                    ctx.save();
                    ctx.globalAlpha = alpha;

                    // Fon yorlig'i
                    ctx.fillStyle = 'rgba(12,14,18,.82)';
                    rr(ctx, pillX, pillY, pillW, pillH, pillR);
                    ctx.fill();

                    // Nozik kontur
                    ctx.strokeStyle = 'rgba(255,255,255,.14)';
                    ctx.lineWidth = 1;
                    ctx.stroke();

                    // Jamoa doirasi (qizil / ko'k)
                    ctx.fillStyle = TEAM_HEX[u.team];
                    ctx.beginPath();
                    ctx.arc(pillX + padDot, midY, 3.5 * sc, 0, Math.PI * 2);
                    ctx.fill();

                    // Jangchi turi belgisi (⚔️, 🏹, 🔮, 🐎, 💚)
                    text(ctx, u.c.icon, pillX + padDot + dotToIcon, midY, { size: Math.round(12 * sc) });

                    // Ism
                    text(ctx, label, pillX + padDot + dotToIcon + iconToText, midY + 0.5, {
                        size: fontSize,
                        weight: 700,
                        align: 'left',
                        color: '#ffffff',
                    });

                    // Jon chizig'i (zararlanganda yorliq ostida aniq ko'rinadi)
                    if (u.hp < u.max) {
                        const bw = Math.max(22 * sc, Math.round(pillW * 0.76));
                        const bh = Math.max(2.5, Math.round(3.2 * sc));
                        const bx = Math.round(sp.x - bw / 2);
                        const by = Math.round(pillY + pillH + 2 * sc);
                        ctx.fillStyle = 'rgba(0,0,0,.65)';
                        rr(ctx, bx, by, bw, bh, bh / 2);
                        ctx.fill();
                        ctx.fillStyle = TEAM_HEX[u.team];
                        rr(ctx, bx, by, Math.max(bh, bw * (u.hp / u.max)), bh, bh / 2);
                        ctx.fill();
                    }

                    ctx.restore();
                } else if (u.hp < u.max) {
                    ctx.save();
                    ctx.globalAlpha = alpha;
                    const bw = Math.round(26 * sc);
                    const bh = Math.max(3, Math.round(4 * sc));
                    const bx = Math.round(sp.x - bw / 2);
                    const by = Math.round(sp.y - 4 * sc);
                    ctx.fillStyle = 'rgba(0,0,0,.65)';
                    rr(ctx, bx, by, bw, bh, bh / 2);
                    ctx.fill();
                    ctx.fillStyle = TEAM_HEX[u.team];
                    rr(ctx, bx, by, Math.max(bh, bw * (u.hp / u.max)), bh, bh / 2);
                    ctx.fill();
                    ctx.restore();
                }
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
                const k = Math.floor(env.tick / 200) % 4;
                const txt = k === 0 ? 'Kommentga yoz:  nik + jangchi turi' :
                            k === 1 ? '⚔️ ritsar · 🏹 kamonchi · 🔮 jodugar · 🐎 otliq · 💚 shifokor' :
                            k === 2 ? '👑 qirol · 🐉 ajdaho · 🗿 dev · 🦖 godzilla · 🎖️ qo\'mondon' :
                                      '💻 dasturchi · 💰 bankir · 📱 bloger · 🖤 qora ritsar · 🔨 quruvchi';
                text(ctx, txt, W / 2, 252, { size: 16, weight: 700, color: PAL.ink, alpha: 0.95 });
            }

            // G'oliblar ro'yxati taxtasi (obunachilar o'zini va natijasini ko'rishi uchun)
            if (battle.winner >= 0) drawVictoryBoard();
        }

        function drawVictoryBoard() {
            const w = battle.winner;
            if (w < 0) return;
            const winElapsed = env.tick - slowStart;
            const alpha = clamp(winElapsed / 22, 0, 1);
            if (alpha <= 0.01) return;

            // Bayramona uchqunlar (confetti sparks)
            if (env.tick % 10 === 0) {
                fx.burst(rnd(100, W - 100), rnd(280, 520), 16, {
                    hue: w === 0 ? 12 : 215,
                    speed: 230,
                    life: 0.65,
                    size: 5
                });
            }

            const winners = battle.units.filter(u => u.team === w);
            // Saralash: tirik qolganlar oldinda, keyin eng ko'p dushman yiqitganlar
            winners.sort((a, b) => {
                if (a.alive !== b.alive) return b.alive ? 1 : -1;
                return b.kills - a.kills;
            });

            const mvp = winners.reduce((m, u) => (u.kills > m.kills ? u : m), winners[0] || {});

            ctx.save();
            ctx.globalAlpha = alpha;

            // Asosiy g'oliblar taxtasi (frosted card)
            const cardX = 30, cardW = W - 60;
            const cardY = 270;
            const cardH = 880;

            ctx.fillStyle = 'rgba(10, 13, 20, 0.92)';
            rr(ctx, cardX, cardY, cardW, cardH, 24);
            ctx.fill();

            // Kontur (jamoa rangida)
            ctx.strokeStyle = TEAM_HEX[w];
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // Yuqori jamoa lentasi
            ctx.fillStyle = TEAM_HEX[w];
            rr(ctx, cardX, cardY, cardW, 10, 10);
            ctx.fill();

            // Sarlavhalar
            text(ctx, '🏆 G\'OLIBLAR RO\'YXATI', W / 2, cardY + 36, { size: 16, weight: 800, color: '#f59e0b' });
            text(ctx, names[w].toUpperCase() + ' G\'ALABA QOZONDI!', W / 2, cardY + 70, { size: 28, weight: 800, color: '#ffffff' });
            text(ctx, `${battle.alive(w)} ta tirik qahramon · Jami ${winners.length} ta g'olib jangchi`, W / 2, cardY + 102, { size: 14, weight: 600, color: PAL.mute });

            // Chiziq
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            ctx.fillRect(cardX + 24, cardY + 118, cardW - 48, 1);

            // Obunachilar ro'yxati (Grid)
            const listTop = cardY + 130;
            const listBottom = cardY + cardH - 58;
            const listH = listBottom - listTop;

            const cols = winners.length > 14 ? 2 : 1;
            const gap = 8;
            const colW = (cardW - 48 - (cols - 1) * gap) / cols;
            const rowH = cols === 1 ? 48 : 42;
            const rowsPerPage = Math.floor(listH / (rowH + gap));
            const totalRows = Math.ceil(winners.length / cols);

            let scrollY = 0;
            if (totalRows > rowsPerPage) {
                const maxScroll = (totalRows - rowsPerPage) * (rowH + gap);
                const scrollTime = Math.max(0, winElapsed - 40);
                scrollY = Math.min(maxScroll, scrollTime * 0.85);
            }

            ctx.save();
            ctx.beginPath();
            ctx.rect(cardX + 20, listTop, cardW - 40, listH);
            ctx.clip();

            for (let i = 0; i < winners.length; i++) {
                const u = winners[i];
                const col = i % cols;
                const row = Math.floor(i / cols);
                const itemX = cardX + 24 + col * (colW + gap);
                const itemY = listTop + row * (rowH + gap) - scrollY;

                if (itemY + rowH < listTop - 10 || itemY > listBottom + 10) continue;

                const isMvp = u === mvp && u.kills > 0;

                // Kartochka foni
                ctx.fillStyle = isMvp ? 'rgba(245, 158, 11, 0.18)' : u.alive ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.035)';
                rr(ctx, itemX, itemY, colW, rowH, 10);
                ctx.fill();

                ctx.strokeStyle = isMvp ? '#f59e0b' : u.alive ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.06)';
                ctx.lineWidth = isMvp ? 1.8 : 1;
                ctx.stroke();

                const midItemY = itemY + rowH / 2;
                const iconX = itemX + 18;
                text(ctx, u.c.icon, iconX, midItemY, { size: cols === 1 ? 18 : 15 });

                const textStartX = iconX + 20;
                const rawName = App.roster.display(u.p);
                const nameMaxW = colW - (cols === 1 ? 190 : 130);
                const fitNm = fit(ctx, rawName, nameMaxW, cols === 1 ? 16 : 14, 800);

                text(ctx, fitNm, textStartX, midItemY - (cols === 1 ? 7 : 6), {
                    size: cols === 1 ? 16 : 14,
                    weight: 800,
                    align: 'left',
                    color: isMvp ? '#fbbf24' : '#ffffff'
                });

                const subLabel = `${u.c.name}` + (isMvp ? ' · 👑 MVP' : '');
                text(ctx, subLabel, textStartX, midItemY + (cols === 1 ? 9 : 8), {
                    size: 11,
                    weight: 600,
                    align: 'left',
                    color: isMvp ? '#f59e0b' : '#94a3b8'
                });

                const rightEndX = itemX + colW - 12;
                if (u.alive) {
                    ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
                    const pillW = cols === 1 ? 64 : 52;
                    rr(ctx, rightEndX - pillW, midItemY - 11, pillW, 22, 6);
                    ctx.fill();
                    text(ctx, cols === 1 ? '❤️ Tirik' : '❤️', rightEndX - pillW / 2, midItemY, {
                        size: 11,
                        weight: 700,
                        color: '#4ade80'
                    });
                } else {
                    ctx.fillStyle = 'rgba(148, 163, 184, 0.12)';
                    const pillW = cols === 1 ? 68 : 46;
                    rr(ctx, rightEndX - pillW, midItemY - 11, pillW, 22, 6);
                    ctx.fill();
                    text(ctx, cols === 1 ? '⚔️ Qahramon' : 'Qahramon', rightEndX - pillW / 2, midItemY, {
                        size: 10,
                        weight: 600,
                        color: '#94a3b8'
                    });
                }

                if (u.kills > 0) {
                    const killW = cols === 1 ? 60 : 44;
                    const killX = rightEndX - (u.alive ? (cols === 1 ? 70 : 58) : (cols === 1 ? 74 : 52)) - killW;
                    ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
                    rr(ctx, killX, midItemY - 11, killW, 22, 6);
                    ctx.fill();
                    text(ctx, `⚔️ ${u.kills}`, killX + killW / 2, midItemY, {
                        size: 11,
                        weight: 800,
                        color: '#fbbf24'
                    });
                }
            }
            ctx.restore();

            // Pastki CTA chaqiruvi
            const ctaY = cardY + cardH - 30;
            const pulse = 0.5 + 0.5 * Math.sin(env.tick / 8);
            text(ctx, '💬 O\'z ismingizni ko\'rdingizmi? Kommentga yozing!', W / 2, ctaY, {
                size: 15,
                weight: 800,
                color: '#ffffff',
                alpha: 0.85 + pulse * 0.15
            });

            ctx.restore();
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
