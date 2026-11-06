/* games/glass-bridge.js — "Shisha ko'prik": o'yinchilar navbat bilan sakraydi, noto'g'ri plita sinadi. */
(function (App) {
    'use strict';
    const { clamp, lerp, TAU } = App.util;
    const { text, rr, fit, token, frame, clip, PAL } = App.draw;

    const SETTINGS = [
        { group: 'Ishtirokchilar', key: 'players', label: 'O\'yinchilar', type: 'range', min: 4, max: 14, step: 1, default: 10 },
        { key: 'useRoster', label: 'Obunachi nikidan foydalanish', type: 'toggle', default: true },
        { group: 'Ko\'prik', key: 'rows', label: 'Qatorlar (0 = avto)', type: 'range', min: 0, max: 10, step: 1, default: 0 },
        { key: 'tension', label: 'Hayajon (o\'ylanish)', type: 'segment', default: 'normal', options: [['fast', 'Tez'], ['normal', 'O\'rta'], ['slow', 'Sekin']], hint: 'Sekin = ko\'proq kutish, ko\'proq tarang' },
        { key: 'mercy', label: 'Oxirgilarga omad', type: 'toggle', default: true, hint: 'Hamma yiqilib ketmasligi uchun' },
    ];

    function create(env) {
        const { ctx, W, arena: A, cfg, fx, audio, rnd, rand } = env;
        const people = env.participants(cfg.players);
        const n = people.length;
        const rows = cfg.rows > 0 ? cfg.rows : clamp(n - 2, 3, 9);
        const GAP = 124, DX = 112, TW = 192, TH = 92, CX = A.x + A.w / 2;
        const safe = Array.from({ length: rows }, () => (rand() < 0.5 ? 0 : 1));
        const known = Array(rows).fill(false);
        const broken = Array.from({ length: rows }, () => [false, false]);
        const glow = Array.from({ length: rows }, () => [0, 0]);
        // o'ylanish vaqti: tanlangan davomiylikka moslangan koeffitsiyent
        const K = (1 + (env.targetSec - 28) * 0.0926) * { fast: 0.6, normal: 1, slow: 1.5 }[cfg.tension];

        const cols = Math.min(5, n);
        const P = people.map((p, i) => {
            const sx = CX + ((i % cols) - (cols - 1) / 2) * 62, sy = 96 + Math.floor(i / cols) * 58;
            return { p, i, st: 'queue', row: -1, wx: sx, wy: sy, sx, sy, sc: 1, rot: 0, vy: 0, side: 0, t: 0 };
        });
        let idx = 0, phase = 'enter', timer = 30, cam = 0, dead = 0, ended = false;

        const tileX = (side) => CX + (side ? 1 : -1) * DX;
        const tileY = (row) => -(row + 1) * GAP;
        const screenY = (wy) => A.y + A.h * 0.6 + (wy - cam);

        function lose() { if (!ended) { ended = true; env.finish({ kicker: 'NATIJA', title: 'Hamma yiqildi', sub: 'Keyingi safar omad', color: PAL.bad }); } }

        function update() {
            if (ended) return;
            const sp = env.speed, P0 = P[idx];
            if (!P0) { lose(); return; }
            for (const g of glow) { g[0] = Math.max(0, g[0] - 0.03 * sp); g[1] = Math.max(0, g[1] - 0.03 * sp); }
            cam = lerp(cam, P0.wy, 0.07);

            if (phase === 'enter') {
                P0.t += sp / 24;
                const t = Math.min(1, P0.t);
                P0.wx = lerp(P0.sx, CX, t); P0.wy = lerp(P0.sy, 30, t);
                if (t >= 1) { P0.st = 'idle'; P0.t = 0; phase = 'think'; timer = (known[P0.row + 1] ? 16 : 55) * K; }
            } else if (phase === 'think') {
                timer -= sp;
                if (timer <= 0) {
                    const r = P0.row + 1;
                    if (r >= rows) { Object.assign(P0, { fromX: P0.wx, fromY: P0.wy, toX: CX, toY: tileY(rows) - 10, finish: true }); }
                    else {
                        let side;
                        if (known[r]) side = safe[r];
                        else {
                            const unknown = rows - r, left = n - idx;
                            side = ((cfg.mercy && left <= unknown) || rand() < 0.5) ? safe[r] : 1 - safe[r];
                        }
                        Object.assign(P0, { side, finish: false, fromX: P0.wx, fromY: P0.wy, toX: tileX(side), toY: tileY(r) });
                    }
                    P0.t = 0; P0.st = 'jump'; phase = 'jump';
                    audio.tone(380, 0.14, 'sine', 0.1, 1.8);
                }
            } else if (phase === 'jump') {
                P0.t += sp / 30;
                const t = Math.min(1, P0.t);
                P0.wx = lerp(P0.fromX, P0.toX, t);
                P0.wy = lerp(P0.fromY, P0.toY, t) - Math.sin(t * Math.PI) * 46;
                if (t >= 1) {
                    P0.wy = P0.toY;
                    if (P0.finish) {
                        P0.st = 'win'; ended = true;
                        env.finish({ winner: P0.p, kicker: 'O\'TDI', title: App.roster.display(P0.p), sub: `${dead} kishi yiqildi`, color: PAL.good });
                        return;
                    }
                    const r = P0.row + 1;
                    known[r] = true;
                    if (P0.side === safe[r]) {
                        P0.row = r; glow[r][P0.side] = 1;
                        audio.note(r * 2 + 3, 0.2, 'triangle', 0.18);
                        P0.st = 'idle'; P0.t = 0; phase = 'think';
                        timer = (r + 1 >= rows ? 20 : (known[r + 1] ? 14 : 55)) * K;
                    } else {
                        broken[r][P0.side] = true;
                        fx.burst(P0.wx, screenY(P0.wy), 26, { hue: 195, sat: 70, l: 78, speed: 300 });
                        fx.kick(8);
                        audio.boom();
                        if (P0.p.nick) env.say(App.tts.pick([`${App.roster.spoken(P0.p)} yiqildi`, `Shisha sindi! ${App.roster.spoken(P0.p)} tushib ketdi`, `${App.roster.spoken(P0.p)} noto'g'ri plitani tanladi`]), { key: 'fall', cooldown: 4000 });
                        P0.st = 'fall'; P0.t = 0; P0.vy = 0; phase = 'fall';
                    }
                }
            } else if (phase === 'fall') {
                P0.t += sp; P0.vy += 0.5 * sp; P0.wy += P0.vy * sp; P0.rot += 0.18 * sp;
                P0.sc = Math.max(0, 1 - P0.t / 70);
                if (P0.t >= 70) {
                    P0.st = 'dead'; dead++; idx++;
                    if (idx < n) { phase = 'enter'; P[idx].t = 0; }
                    else lose();
                }
            }
        }

        function draw() {
            ctx.save();
            clip(ctx, A);
            ctx.fillStyle = '#0a0f14';
            ctx.fillRect(A.x, A.y, A.w, A.h);
            // chuqurlikni his qildiruvchi chiziqlar
            ctx.strokeStyle = 'rgba(120,200,255,.06)'; ctx.lineWidth = 2;
            for (let i = 0; i < 12; i++) {
                const y = A.y + (((i * 90 - cam * 0.5) % (A.h + 90)) + A.h + 90) % (A.h + 90);
                ctx.beginPath(); ctx.moveTo(A.x, y); ctx.lineTo(A.x + A.w, y); ctx.stroke();
            }
            // start va finish
            let y = screenY(-40);
            ctx.fillStyle = '#2a2f38'; rr(ctx, CX - 300, y, 600, 330, 18); ctx.fill();
            text(ctx, 'START', CX, y + 22, { size: 16, weight: 800, color: PAL.mute });
            const fy = screenY(tileY(rows) - 70);
            ctx.fillStyle = PAL.ink; rr(ctx, CX - 300, fy - 60, 600, 150, 18); ctx.fill();
            text(ctx, 'FINISH', CX, fy + 12, { size: 38, weight: 800, color: '#111' });
            // plitalar
            for (let r = 0; r < rows; r++) {
                const ty = screenY(tileY(r));
                if (ty < A.y - 80 || ty > A.y + A.h + 80) continue;
                for (let s = 0; s < 2; s++) {
                    if (broken[r][s]) continue;
                    const x = tileX(s);
                    const ok = known[r] && safe[r] === s;
                    ctx.fillStyle = ok ? 'rgba(91,227,125,.28)' : 'rgba(150,210,255,.2)';
                    rr(ctx, x - TW / 2, ty - TH / 2, TW, TH, 12); ctx.fill();
                    ctx.lineWidth = 3;
                    ctx.strokeStyle = glow[r][s] > 0 ? '#c8ffd6' : 'rgba(200,235,255,.7)';
                    ctx.stroke();
                    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(x - TW / 2 + 24, ty + TH / 2 - 14); ctx.lineTo(x - TW / 2 + 62, ty - TH / 2 + 14);
                    ctx.moveTo(x - TW / 2 + 50, ty + TH / 2 - 14); ctx.lineTo(x - TW / 2 + 78, ty - TH / 2 + 14);
                    ctx.stroke();
                }
            }
            // o'yinchilar
            for (const q of P) {
                if (q.st === 'dead' || q.sc <= 0) continue;
                const x = q.wx, py = screenY(q.wy);
                if (py < A.y - 60 || py > A.y + A.h + 60) continue;
                ctx.save();
                ctx.translate(x, py); ctx.rotate(q.rot); ctx.scale(q.sc, q.sc);
                token(ctx, q.p, 0, 0, 25, { ring: true });
                ctx.restore();
                if (q.i === idx && q.st !== 'fall') {
                    text(ctx, fit(ctx, App.roster.display(q.p), 160, 17, 700), x, py - 42, { size: 17, weight: 700 });
                    if (phase === 'think' && !known[q.row + 1] && q.row + 1 < rows) text(ctx, '?', x + 34, py - 30 + Math.sin(env.tick / 6) * 4, { size: 28, weight: 800, color: '#ffc94d' });
                }
            }
            ctx.restore();
            frame(ctx, A, PAL.line);
            const reached = Math.max(0, ...P.map(q => q.row + 1));
            text(ctx, `${reached} / ${rows}`, W / 2, 150, { size: 72, weight: 300 });
            text(ctx, 'qadam', W / 2, 206, { size: 18, weight: 600, color: PAL.mute });
            text(ctx, `navbatda ${Math.max(0, n - idx - 1)}`, A.x + 6, 150, { size: 20, weight: 600, color: PAL.mute, align: 'left' });
            text(ctx, `yiqildi ${dead}`, A.x + A.w - 6, 150, { size: 20, weight: 600, color: PAL.bad, align: 'right' });
        }

        return { update, draw };
    }

    App.registry.register({
        id: 'glass',
        name: 'Shisha ko\'prik',
        tagline: 'Squid Game uslubi: to\'g\'ri plitani top yoki yiqil',
        help: 'O\'yinchilar navbat bilan shisha plitalardan sakraydi, noto\'g\'risi sinadi. Qatorlar soni va hayajon (o\'ylanish) vaqtini sozlang.',
        group: 'nick',
        roster: true,
        tags: ['suspense'],
        settings: SETTINGS,
        create,
    });
})(window.App = window.App || {});
