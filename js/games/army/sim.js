/* games/army/sim.js — Armiya jangi mantiqi (renderdan mustaqil).
 * Ikki jamoa: har bir ishtirokchi bitta jangchi (ritsar, kamonchi, jodugar, otliq, shifokor).
 * G'alaba sharti: dushman jamoasidagi barcha jangchilar yiqilganda, oxirgi tirik jamoa g'olib bo'ladi. */
(function (App) {
    'use strict';
    const NS = (App.army = App.army || {});
    const { clamp } = App.util;

    const FIELD = { hw: 38, hl: 58 };

    const CLASSES = {
        knight:       { name: 'Ritsar',      icon: '⚔️', hp: 160, dmg: 14, range: 2.0, speed: 4.5, cd: 0.9, size: 0.62 },
        archer:       { name: 'Kamonchi',    icon: '🏹', hp: 75,  dmg: 10, range: 16,  speed: 4.1, cd: 1.1, size: 0.5, proj: 30, projKind: 'arrow' },
        mage:         { name: 'Jodugar',     icon: '🔮', hp: 90,  dmg: 16, range: 12,  speed: 3.8, cd: 1.9, size: 0.5, proj: 20, aoe: 3.6, projKind: 'fire' },
        cavalry:      { name: 'Otliq',       icon: '🐎', hp: 125, dmg: 13, range: 2.4, speed: 8.4, cd: 1.0, size: 0.75 },
        healer:       { name: 'Shifokor',    icon: '💚', hp: 85,  dmg: 0,  range: 11,  speed: 4.3, cd: 1.4, size: 0.5, heal: 18 },

        // Yangi qo'shilgan qahramonlar
        king:         { name: 'Qirol',       icon: '👑', hp: 260, dmg: 22, range: 2.2, speed: 4.2, cd: 0.85, size: 0.72 },
        king_father:  { name: 'Ota Qirol',   icon: '👴', hp: 320, dmg: 28, range: 2.5, speed: 3.8, cd: 0.95, size: 0.76 },
        dragon:       { name: 'Ajdaho',      icon: '🐉', hp: 500, dmg: 26, range: 15,  speed: 5.4, cd: 1.8, size: 1.15, proj: 24, aoe: 4.5, projKind: 'fire' },
        giant:        { name: 'Dev',         icon: '🗿', hp: 550, dmg: 38, range: 2.8, speed: 3.2, cd: 1.6, size: 1.25, aoe: 3.2 },
        godzilla:     { name: 'Godzilla',    icon: '🦖', hp: 650, dmg: 42, range: 16,  speed: 3.4, cd: 2.0, size: 1.35, proj: 28, aoe: 4.2, projKind: 'atomic' },
        commander:    { name: 'Qo\'mondon',  icon: '🎖️', hp: 210, dmg: 18, range: 2.2, speed: 4.8, cd: 0.8, size: 0.68 },
        programmer:   { name: 'Dasturchi',   icon: '💻', hp: 105, dmg: 20, range: 13,  speed: 4.2, cd: 1.2, size: 0.52, proj: 26, projKind: 'code' },
        banker:       { name: 'Bankir',      icon: '💰', hp: 130, dmg: 16, range: 10,  speed: 4.0, cd: 1.1, size: 0.54, proj: 22, projKind: 'coin' },
        blogger:      { name: 'Bloger',      icon: '📱', hp: 115, dmg: 17, range: 12,  speed: 4.6, cd: 1.0, size: 0.52, proj: 25, projKind: 'flash' },
        dark_knight:  { name: 'Qora Ritsar', icon: '🖤', hp: 240, dmg: 26, range: 2.2, speed: 4.8, cd: 0.85, size: 0.70 },
        builder:      { name: 'Quruvchi',    icon: '🔨', hp: 200, dmg: 19, range: 2.0, speed: 4.1, cd: 1.0, size: 0.65 },
    };
    // oldingi qatordan boshlab joylashuv
    const ROW = {
        godzilla: 10, giant: 9, dark_knight: 9, knight: 8, cavalry: 7, commander: 6, builder: 6,
        king: 4, king_father: 3, banker: 2,
        dragon: 5, archer: 2, programmer: 1, blogger: 1, mage: 0, healer: -2
    };

    class Battle {
        /**
         * @param people  [{p, team, cls}]
         * @param opts    {rand, onEvent, combatScale}
         */
        constructor(people, opts) {
            this.rand = opts.rand;
            this.cs = opts.combatScale || 1;
            this.stall = 0;
            this.onEvent = opts.onEvent || (() => {});
            this.time = 0;
            this.winner = -1;
            this.proj = [];
            this.engaged = [];
            this.units = [];
            let id = 0;
            for (const t of [0, 1]) {
                const mine = people.filter(x => x.team === t);
                const byRole = {};
                for (const m of mine) (byRole[m.cls] = byRole[m.cls] || []).push(m);
                for (const cls of Object.keys(byRole)) {
                    const arr = byRole[cls];
                    arr.forEach((m, i) => {
                        const c = CLASSES[cls], dir = t ? -1 : 1, base = t ? FIELD.hl - 16 : -FIELD.hl + 16;
                        const per = Math.ceil(arr.length / Math.max(1, Math.ceil(arr.length / 12)));
                        const row = Math.floor(i / per), col = i % per;
                        const rowN = Math.min(per, arr.length - row * per);
                        const gap = clamp(FIELD.hw * 1.7 / Math.max(rowN, 6), 2.8, 7);
                        this.units.push({
                            id: id++, p: m.p, team: t, cls, c,
                            x: (col - (rowN - 1) / 2) * gap + (this.rand() - 0.5) * 0.8,
                            z: base + dir * (ROW[cls] * 1.5 - row * 3) + (this.rand() - 0.5) * 0.8,
                            vx: 0, vz: 0, face: t ? Math.PI : 0,
                            hp: c.hp, max: c.hp, cd: this.rand() * c.cd, tgt: null, retarget: this.rand() * 0.3,
                            alive: true, dying: 0, flash: 0, charge: cls === 'cavalry', atk: 0, kills: 0,
                            dmgMul: 0.9 + this.rand() * 0.25,
                            slot: (this.rand() - 0.5) * 2.4, // nishon atrofidagi shaxsiy yondashuv burchagi
                        });
                    });
                }
            }
        }

        alive(t) {
            let n = 0;
            for (const u of this.units) if (u.alive && u.team === t) n++;
            return n;
        }

        _nearest(u, pred, maxD = 999) {
            let best = null, bd = maxD * maxD;
            for (const o of this.units) {
                if (!o.alive || !pred(o)) continue;
                const d = (o.x - u.x) ** 2 + (o.z - u.z) ** 2;
                if (d < bd) { bd = d; best = o; }
            }
            return best;
        }

        /** Dushman tanlash: yaqinlik + "band"lik (hamma bitta dushmanga yopishib olmasligi uchun). */
        _pick(u, maxD = 180) {
            let best = null, bs = Infinity;
            const lim = maxD * maxD;
            for (const o of this.units) {
                if (!o.alive || o.team === u.team) continue;
                const d2 = (o.x - u.x) ** 2 + (o.z - u.z) ** 2;
                if (d2 > lim) continue;
                const threat = o.tgt === u ? 0.7 : 1;
                const vulnerable = 0.8 + 0.2 * (o.hp / o.max);
                const sc = d2 * (1 + 0.65 * (this.engaged[o.id] || 0)) * threat * vulnerable;
                if (sc < bs) { bs = sc; best = o; }
            }
            return best || this._nearest(u, o => o.team !== u.team, 999);
        }

        _damage(src, dst, amount) {
            if (!dst || !dst.alive) return;
            dst.hp -= amount; dst.flash = 1;
            if (dst.hp <= 0) {
                dst.alive = false; dst.hp = 0;
                if (src && src.kills !== undefined) src.kills++;
                this.onEvent('death', dst, src);
            }
        }

        /**
         * @param dt       sekund
         * @param paceMul  jang koeffitsiyenti (davomiylikni boshqaradi)
         */
        step(dt, paceMul = 1) {
            this.time += dt;
            const U = this.units;

            // har bir dushmanga nechta jangchi hujum qilayotganini sanaymiz
            this.engaged.length = U.length;
            this.engaged.fill(0);
            for (const u of U) {
                if (u.alive && u.tgt && u.tgt.team !== u.team && u.tgt.alive) {
                    this.engaged[u.tgt.id]++;
                }
            }

            for (const u of U) {
                if (!u.alive) { u.dying += dt; continue; }
                u.flash = Math.max(0, u.flash - dt * 5);
                u.atk = Math.max(0, u.atk - dt * 4);
                u.cd -= dt;
                u.retarget -= dt;
                const c = u.c;

                if (u.cls === 'healer') {
                    if (!u.tgt || !u.tgt.alive || u.retarget <= 0) {
                        let best = null, bf = 0.85;
                        for (const o of U) {
                            if (o.alive && o.team === u.team && o !== u && o.hp / o.max < bf && Math.hypot(o.x - u.x, o.z - u.z) < 28) {
                                bf = o.hp / o.max; best = o;
                            }
                        }
                        u.tgt = best || this._nearest(u, o => o.team === u.team && o.cls === 'knight', 90);
                        u.retarget = 0.4;
                    }
                } else if (!u.tgt || !u.tgt.alive || u.retarget <= 0) {
                    u.tgt = this._pick(u, 180);
                    u.retarget = 0.3 + this.rand() * 0.2;
                }

                let mx = 0, mz = 0, speed = c.speed;
                const t = u.tgt;
                if (t && t.alive) {
                    const dx = t.x - u.x, dz = t.z - u.z, d = Math.hypot(dx, dz) || 1;
                    const reach = c.range + 0.9;
                    const ally = t.team === u.team;
                    if (u.cls === 'healer') {
                        if (ally && d <= c.range * 0.9 && t.hp < t.max) {
                            if (u.cd <= 0) { t.hp = Math.min(t.max, t.hp + c.heal); u.cd = c.cd; this.onEvent('heal', t, u); }
                        } else if (d > 4) { mx = dx / d; mz = dz / d; speed *= 0.85; }
                    } else if ((u.cls === 'archer' || u.cls === 'mage') && d < c.range * 0.45) {
                        mx = -dx / d; mz = -dz / d; speed *= 0.6;
                    } else if (d > reach * 0.88) {
                        // har kim nishonning o'z tomoniga boradi: atrofida halqa bo'lib joylashadi
                        const ang = Math.atan2(-dz, -dx) + u.slot, rp = Math.max(reach * 0.8, 1.5);
                        const ex = t.x + Math.cos(ang) * rp - u.x, ez = t.z + Math.sin(ang) * rp - u.z, ed = Math.hypot(ex, ez) || 1;
                        mx = ex / ed; mz = ez / ed;
                    }

                    if (d <= reach && u.cd <= 0 && u.cls !== 'healer') {
                        u.face = Math.atan2(dx, dz);
                        const mul = u.dmgMul * this.cs * paceMul;
                        if (c.proj) {
                            const kind = c.projKind || (c.aoe ? 'fire' : 'arrow');
                            this._shoot(u, t, c.dmg * mul, c.proj, c.aoe || 0, kind);
                        } else {
                            let dmg = c.dmg * mul;
                            if (u.charge) { dmg *= 2; u.charge = false; }
                            this._damage(u, t, dmg);
                            if (c.aoe) {
                                for (const o of U) {
                                    if (o.alive && o.team !== u.team && o !== t && Math.hypot(o.x - t.x, o.z - t.z) < c.aoe) {
                                        this._damage(u, o, dmg * 0.6);
                                    }
                                }
                                this.onEvent('aoe', { tx: t.x, tz: t.z, aoe: c.aoe });
                            }
                            this.onEvent('hit', t, u);
                        }
                        u.cd = c.cd * (0.9 + this.rand() * 0.2);
                        u.atk = 1;
                    }
                    if (mx || mz) u.face = Math.atan2(mx, mz);
                } else if (u.cls !== 'healer') {
                    // dushman qolmaganda: g'alaba nishonlash uchun markazda yig'iladi
                    const a = u.slot * 2.6 + u.id * 0.9, rp = 6 + (u.id % 8) * 2.2;
                    const ex = Math.cos(a) * rp - u.x, ez = Math.sin(a) * rp - u.z, ed = Math.hypot(ex, ez);
                    if (ed > 1.2) { mx = ex / ed; mz = ez / ed; speed *= 0.4; }
                }

                // bir-biriga o'tib ketmaslik (separatsiya)
                let sx = 0, sz = 0;
                for (const o of U) {
                    if (o === u || !o.alive) continue;
                    const dx = u.x - o.x, dz = u.z - o.z, d2 = dx * dx + dz * dz, min = (u.c.size + o.c.size) * 2.6;
                    if (d2 < min * min) {
                        const d = Math.sqrt(d2) || 0.01, k = (min - d) / min;
                        sx += (d2 > 1e-6 ? dx / d : this.rand() - 0.5) * k;
                        sz += (d2 > 1e-6 ? dz / d : this.rand() - 0.5) * k;
                    }
                }
                u.vx += ((mx * speed + sx * 14) - u.vx) * Math.min(1, dt * 8);
                u.vz += ((mz * speed + sz * 14) - u.vz) * Math.min(1, dt * 8);
                u.x = clamp(u.x + u.vx * dt, -FIELD.hw, FIELD.hw);
                u.z = clamp(u.z + u.vz * dt, -FIELD.hl, FIELD.hl);
            }

            // G'ALABA SHARTI: Odam qolmaganda, oxirgi tirik jamoa yutadi!
            if (this.winner < 0) {
                const a0 = this.alive(0), a1 = this.alive(1);
                if (a0 === 0 && a1 > 0) {
                    this.winner = 1;
                    this.onEvent('armyDefeated', 0, 1);
                } else if (a1 === 0 && a0 > 0) {
                    this.winner = 0;
                    this.onEvent('armyDefeated', 1, 0);
                } else if (a0 === 0 && a1 === 0) {
                    const k0 = U.filter(u => u.team === 0).reduce((s, u) => s + u.kills, 0);
                    const k1 = U.filter(u => u.team === 1).reduce((s, u) => s + u.kills, 0);
                    this.winner = k0 >= k1 ? 0 : 1;
                    this.onEvent('armyDefeated', 1 - this.winner, this.winner);
                } else {
                    // Agar faqat shifokorlar qolib jang to'xtab qolsa
                    const atk0 = U.filter(u => u.alive && u.team === 0 && u.cls !== 'healer').length;
                    const atk1 = U.filter(u => u.alive && u.team === 1 && u.cls !== 'healer').length;
                    if (atk0 === 0 || atk1 === 0) {
                        this.stall += dt;
                        if (this.stall > 3) {
                            if (atk0 === 0 && atk1 > 0) this.winner = 1;
                            else if (atk1 === 0 && atk0 > 0) this.winner = 0;
                            else this.winner = a0 >= a1 ? 0 : 1;
                            this.onEvent('armyDefeated', 1 - this.winner, this.winner);
                        }
                    } else {
                        this.stall = 0;
                    }
                }
            }

            // snaryadlar
            for (let i = this.proj.length - 1; i >= 0; i--) {
                const p = this.proj[i];
                const t = p.tgt;
                if (t && t.alive !== false) { p.tx = t.x; p.tz = t.z; }
                const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz);
                const step = p.speed * dt;
                p.dirx = dx / (d || 1); p.dirz = dz / (d || 1);
                if (d <= step + 0.4) {
                    if (p.aoe) {
                        for (const o of U) {
                            if (o.alive && o.team !== p.team && Math.hypot(o.x - p.tx, o.z - p.tz) < p.aoe) {
                                this._damage(p.src, o, p.dmg);
                            }
                        }
                        this.onEvent('aoe', p);
                    } else if (t && t.alive !== false) {
                        this._damage(p.src, t, p.dmg);
                        this.onEvent('hit', t, p.src);
                    }
                    this.proj.splice(i, 1);
                    continue;
                }
                p.x += dx / d * step; p.z += dz / d * step;
                p.life += dt;
            }
        }

        _shoot(src, tgt, dmg, speed, aoe, kind) {
            this.proj.push({ src, tgt, team: src.team, x: src.x, z: src.z, tx: tgt.x, tz: tgt.z, dmg, speed, aoe, kind, life: 0, dirx: 0, dirz: 1 });
            this.onEvent('shoot', src, kind);
        }
    }

    NS.FIELD = FIELD;
    NS.CLASSES = CLASSES;
    NS.Battle = Battle;
})(window.App = window.App || {});
