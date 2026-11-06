/* games/track3d/index.js — "Yo'l poygasi": 5-6 shar uzun 3D yo'lda poygalashadi.
 * Qoidalar va HUD shu yerda; fizika (rail-physics), geometriya (track-builder), ko'rinish (scene) alohida.
 *
 * Qiziqarli elementlar: sovg'a qutilari (turbo, raketa, qalqon, moy), harakatlanuvchi to'siqlar,
 * saralash (har nazorat nuqtasida oxirgi shar chiqib ketadi), boosterlar, loy, sakrash joylari. */
(function (App) {
    'use strict';
    const NS = App.track3d;
    const { clamp, hsl, TAU } = App.util;
    const { text, rr, fit, PAL, FONT } = App.draw;

    const SECTIONS = { short: 8, medium: 14, long: 22 };
    const ICON = { turbo: '⚡', rocket: '🚀', shield: '🛡️', oil: '🛢️' };

    const SETTINGS = [
        { group: 'Ishtirokchilar', key: 'fillBots', label: 'Bot bilan to\'ldirish', type: 'toggle', default: false, hint: () => App.roster.realOnly ? 'Obunachilar bo\'limida "Real obunachilar" yoqilgan (botlar o\'chiq)' : 'Obunachi yetmasa, botlar bilan to\'ldiriladi', active: () => !App.roster.realOnly },
        { key: 'balls', label: 'Eng ko\'pi bilan', type: 'range', min: 2, max: 12, step: 1, default: 7, active: (v) => !App.roster.realOnly && !!v.fillBots },
        { group: 'Qiziqarli qoidalar', key: 'elimination', label: 'Saralash', type: 'toggle', default: true, hint: 'Nazorat nuqtalarida oxirgi shar chiqib ketadi (kamida 3 ta qoladi)' },
        { key: 'items', label: 'Sovg\'a qutilari', type: 'toggle', default: true, hint: '⚡ turbo · 🚀 raketa · 🛡️ qalqon · 🛢️ moy' },
        { key: 'movers', label: 'Harakatlanuvchi to\'siqlar', type: 'toggle', default: true },
        { group: 'Yo\'l', key: 'length', label: 'Yo\'l uzunligi', type: 'segment', default: 'auto', options: [['auto', 'Avto'], ['short', 'Qisqa'], ['medium', 'O\'rta'], ['long', 'Uzun']], hint: 'Avto = tanlangan davomiylikka moslanadi' },
        { key: 'chaos', label: 'To\'siq va boosterlar', type: 'range', min: 0, max: 100, step: 5, default: 50, unit: '%' },
        { key: 'spirals', label: 'Spirallar', type: 'toggle', default: true },
        { key: 'jumps', label: 'Sakrash joylari', type: 'toggle', default: true },
        { key: 'hills', label: 'Tepaliklar', type: 'toggle', default: true },
        { key: 'seed', label: 'Yo\'l kodi', type: 'text', default: '', placeholder: 'ixtiyoriy', hint: 'Bir xil kod — bir xil yo\'l' },
        { group: 'Ko\'rinish', key: 'camera', label: 'Kamera', type: 'segment', default: 'cinema', options: [['chase', 'Ortidan'], ['pack', 'Uzoqdan'], ['cinema', 'Kino']] },
        { key: 'tags', label: 'Ism yorliqlari', type: 'toggle', default: true },
    ];

    function create(env) {
        const { ctx, W, H, cfg, rand } = env;
        const people = env.participants(cfg.balls, { min: 2, max: 12 });
        if (people.length < 2) return env.emptyScreen('Yo\'l poygasi', 2);
        const nSections = cfg.length === 'auto' ? Math.round(env.targetSec / 3.1) : SECTIONS[cfg.length];
        const elimination = cfg.elimination && people.length >= 5;
        const track = NS.build({ sections: nSections, chaos: cfg.chaos, spirals: cfg.spirals, jumps: cfg.jumps, hills: cfg.hills, items: cfg.items, movers: cfg.movers, elimination }, rand);

        const world = new NS.World(track, people);
        const rig = new NS.CameraRig(world, null);
        const race = new NS.Race(track, people, rand, onEvent, { elimination });
        rig.rail = race.rail;

        const frame = NS.Rail.frame();
        const wp = [0, 0, 0], wp2 = [0, 0, 0];
        let lastLeader = -1;
        let firstFinishTick = 0;
        let done = false;
        const sparks = [], bursts = [], feed = [];
        const nm = (b) => App.roster.display(b.person);
        const say = (b) => App.roster.spoken(b.person);
        const note = (t) => { feed.unshift({ t, at: env.tick }); if (feed.length > 4) feed.pop(); };

        function onEvent(type, b, c) {
            const A = env.audio;
            if (type === 'wall') { sparks.push(b); A.hit(Math.min(6, c)); }
            else if (type === 'stumble') A.tone(180, 0.12, 'triangle', 0.05, 0.6);
            else if (type === 'boost') A.tone(520 + b.i * 20, 0.18, 'sawtooth', 0.07, 2);
            else if (type === 'bump') A.hit(3);
            else if (type === 'clash') A.tick(b.i);
            else if (type === 'finish') A.note(8 + b.fin * 2, 0.4, 'triangle', 0.18);
            else if (type === 'pickup') { A.tone(880, 0.1, 'sine', 0.09, 1.5); A.tone(1320, 0.12, 'sine', 0.06); }
            else if (type === 'turbo') { A.tone(300, 0.35, 'sawtooth', 0.08, 3); note(`⚡ ${nm(b)} turbo yoqdi`); }
            else if (type === 'shield') { A.tone(700, 0.25, 'triangle', 0.08); note(`🛡️ ${nm(b)} qalqon oldi`); }
            else if (type === 'oil') { world.addSlick(b.s - 3, 6); A.tone(160, 0.3, 'sine', 0.08, 0.5); note(`🛢️ ${nm(b)} moy to'kdi`); }
            else if (type === 'rocket') {
                race.worldPos(b, wp, frame); race.worldPos(c, wp2, frame);
                world.addRocket(wp.slice(), wp2.slice());
                A.tone(500, 0.3, 'sawtooth', 0.09, 0.3);
                note(`🚀 ${nm(b)} → ${nm(c)}`);
                if (b.person.nick && c.person.nick) env.say(`${say(b)} raketa bilan ${say(c)}ni urdi!`, { key: 'rocket', cooldown: 8000 });
                bursts.push({ ball: c, hue: 22, n: 12 });
            } else if (type === 'block') { A.tone(900, 0.2, 'square', 0.07, 0.6); note(`🛡️ ${nm(b)} himoyalandi`); bursts.push({ ball: b, hue: 195, n: 10 }); }
            else if (type === 'checkpoint') { A.note(12, 0.4, 'triangle', 0.15); }
            else if (type === 'elim') {
                A.boom(); env.fx.kick(10);
                note(`💥 ${nm(b)} chiqib ketdi`);
                bursts.push({ ball: b, hue: 8, n: 30 });
                if (b.person.nick) env.say(App.tts.pick([`${say(b)} chiqib ketdi`, `Saralash! ${say(b)} chiqdi`, `${say(b)} oxirgi o'rinda qoldi va chiqdi`]), { key: 'elim', cooldown: 4000 });
            }
        }

        // jadvalga yaqin yurish: ortda qolsa tezlashadi, oldinga o'tib ketsa sekinlashadi
        function paceFactor() {
            const p = race.leader.s / track.finishS;
            return clamp(1 + (env.sched() - p) * 1.4, 0.5, 1.8);
        }

        const tmpPos = [0, 0, 0], tmpFrame = NS.Rail.frame();
        const wpos = (b) => race.worldPos(b, tmpPos, tmpFrame);

        function update() {
            // marra paytida sekin harakat (slow-motion)
            const slow = firstFinishTick ? clamp((env.tick - firstFinishTick) / 150, 0.3, 1) : 1;
            const dt = (1 / 60) * env.speed * paceFactor() * slow;
            const sub = Math.ceil(dt / 0.02);
            for (let i = 0; i < sub; i++) race.step(dt / sub, env.drama);
            // marraga yetganda: sekinlashtirilgan "kino" kadr
            rig.force = firstFinishTick ? (env.tick - firstFinishTick < 130 ? 'front' : 'side') : null;
            world.setFocus(race.leader.s ? wpos(race.leader) : [0, 0, 0]);
            rig.update(cfg.camera, race, env.tick);

            const lead = race.leader;
            if (lead.i !== lastLeader) {
                if (lastLeader >= 0) { env.audio.tick(lead.i); if (lead.person.nick) env.say(App.tts.pick([`${say(lead)} oldinga chiqdi!`, `Yangi peshqadam: ${say(lead)}`, `${say(lead)} birinchi o'rinda`]), { key: 'lead', cooldown: 9000 }); }
                lastLeader = lead.i;
            }
            if (race.finCount > 0 && !firstFinishTick) firstFinishTick = env.tick;
            const need = Math.min(3, race.aliveCount, people.length);
            if (!done && firstFinishTick && (race.finCount >= need || env.tick - firstFinishTick > 220)) {
                done = true;
                const w = race.standings()[0];
                env.finish({ winner: w.person, kicker: '1-O\'RIN', title: nm(w), sub: `${w.finTime.toFixed(1)} soniya` + (elimination ? ` · ${race.elimCount} kishi chiqib ketdi` : ''), color: PAL.accent });
            }
        }

        function draw() {
            race.balls.forEach((b, i) => {
                race.worldPos(b, wp, frame);
                world.placeBall(i, wp, frame, (b.v * (1 / 60) * env.speed) / 0.5, b.glow);
            });
            world.updateDynamic(race, 1 / 60);
            world.render(0.8);
            ctx.drawImage(NS.glCanvas(), 0, 0, W, H);

            // devorga urilgan joyda uchqunlar, raketa va saralash portlashlari
            for (const b of sparks) {
                race.worldPos(b, wp, frame);
                const sp = world.project(wp);
                if (sp) env.fx.burst(sp.x, sp.y, 7, { hue: 38, speed: 260, life: 0.35, size: 3, grav: 0 });
            }
            sparks.length = 0;
            for (const e of bursts) {
                race.worldPos(e.ball, wp, frame);
                const sp = world.project(wp);
                if (sp) env.fx.burst(sp.x, sp.y, e.n, { hue: e.hue, speed: 420, life: 0.7, size: 6 });
            }
            bursts.length = 0;

            const order = race.standings();
            const lead = race.leader;
            // sarlavha zonasi
            const left = Math.max(0, Math.round(track.finishS - lead.s));
            text(ctx, race.finCount ? 'MARRA!' : `${left} m`, W / 2, 138, { size: 64, weight: 300 });
            text(ctx, race.finCount ? '' : (elimination ? `${race.aliveCount} shar qoldi · nazorat nuqtasida oxirgisi chiqadi` : 'finishgacha'), W / 2, 190, { size: 18, weight: 600, color: PAL.mute });

            // ism yorliqlari
            if (cfg.tags) {
                for (const b of race.balls) {
                    if (b.elim) continue;
                    race.worldPos(b, wp, frame);
                    wp[1] += 0.9;
                    const sp = world.project(wp);
                    if (!sp || sp.x < 10 || sp.x > W - 10 || sp.y < 230 || sp.y > H - 130 || sp.depth > 0.992) continue;
                    const label = fit(ctx, (b.item ? ICON[b.item] + ' ' : '') + nm(b), 170, 20, 700);
                    ctx.font = `700 20px ${FONT}`;
                    const w = ctx.measureText(label).width + 22;
                    ctx.fillStyle = b === lead ? PAL.accent : 'rgba(13,13,16,.72)';
                    rr(ctx, sp.x - w / 2, sp.y - 16, w, 32, 16);
                    ctx.fill();
                    text(ctx, label, sp.x, sp.y + 1, { size: 20, weight: 700, color: b === lead ? '#fff' : PAL.ink });
                }
            }

            // reyting (sovg'a belgisi bilan; chiqqanlar kulrang)
            const rows = Math.min(6, order.length);
            ctx.fillStyle = 'rgba(13,13,16,.62)';
            rr(ctx, 24, 236, 262, 16 + rows * 38, 16);
            ctx.fill();
            for (let i = 0; i < rows; i++) {
                const b = order[i], y = 262 + i * 38, dead = !!b.elim;
                text(ctx, dead ? '✕' : String(i + 1), 46, y, { size: 16, weight: 800, color: dead ? PAL.bad : i === 0 ? PAL.accent : PAL.mute });
                ctx.fillStyle = dead ? '#555' : hsl(b.person.hue, 75, 62);
                ctx.beginPath(); ctx.arc(76, y, 8, 0, TAU); ctx.fill();
                text(ctx, fit(ctx, nm(b), 140, 20, 700), 94, y + 1, { size: 20, weight: 700, align: 'left', alpha: dead ? 0.4 : 1 });
                if (b.item) text(ctx, ICON[b.item], 268, y + 1, { size: 20, align: 'right' });
                else if (b.shield) text(ctx, '🛡️', 268, y + 1, { size: 18, align: 'right' });
            }

            // voqealar lentasi (oxirgi 4 ta)
            feed.forEach((f, i) => {
                const age = (env.tick - f.at) / 60;
                if (age > 5) return;
                text(ctx, fit(ctx, f.t, 360, 19, 700), 28, 258 + rows * 38 + 30 + i * 30, { size: 19, weight: 700, align: 'left', alpha: clamp(1 - (age - 3.5) / 1.5, 0, 1) * (1 - i * 0.12) });
            });

            // o'ng chetda yo'l chizig'i (nazorat nuqtalari belgilanadi)
            const x = W - 28, y0 = 270, y1 = 1000;
            ctx.strokeStyle = 'rgba(245,242,234,.25)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
            for (const cs of track.checkpoints) {
                const py = y0 + (y1 - y0) * (cs / track.finishS);
                ctx.fillStyle = PAL.accent; ctx.fillRect(x - 9, py - 1.5, 18, 3);
            }
            for (const b of race.balls) {
                const py = y0 + (y1 - y0) * clamp(b.s / track.finishS, 0, 1);
                ctx.fillStyle = b.elim ? '#555' : hsl(b.person.hue, 75, 62);
                ctx.beginPath(); ctx.arc(x, py, b === lead ? 8 : 6, 0, TAU); ctx.fill();
            }
        }

        function dispose() { world.dispose(); }

        return { update, draw, dispose, debug: () => ({ race, track, people }) };
    }

    App.registry.register({
        id: 'track3d',
        name: 'Yo\'l poygasi 3D',
        tagline: 'Sharlar uzun 3D yo\'lda — sovg\'alar, raketalar, saralash',
        help: 'Sharlar uzun 3D yo\'lda poygalashadi. Sovg\'a qutilaridan turbo, raketa, qalqon yoki moy oladi; harakatlanuvchi to\'siqlar bor; nazorat nuqtalarida oxirgi shar chiqib ketadi (kamida 3 ta qoladi).',
        group: 'race',
        roster: true,
        tags: ['3D', 'poyga'],
        settings: SETTINGS,
        create,
    });
})(window.App = window.App || {});
