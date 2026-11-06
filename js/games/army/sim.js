/* games/army/sim.js — Armiya jangi mantiqi (renderdan mustaqil).
 * Ikki jamoa: har bir ishtirokchi bitta jangchi (ritsar, kamonchi, jodugar, otliq, shifokor).
 * Maqsad: dushman minorasini yiqitish. */
(function (App) {
    'use strict';
    const NS = (App.army = App.army || {});
    const { clamp } = App.util;

    const FIELD = { hw: 40, hl: 64 };

    const CLASSES = {
        knight:  { name: 'Ritsar',   icon: '⚔️', hp: 150, dmg: 12, range: 1.9, speed: 4.3, cd: 0.9, size: 0.62 },
        archer:  { name: 'Kamonchi', icon: '🏹', hp: 70,  dmg: 9,  range: 15,  speed: 4.0, cd: 1.1, size: 0.5, proj: 28 },
        mage:    { name: 'Jodugar',  icon: '🔮', hp: 85,  dmg: 15, range: 11,  speed: 3.7, cd: 2.0, size: 0.5, proj: 18, aoe: 3.4 },
        cavalry: { name: 'Otliq',    icon: '🐎', hp: 115, dmg: 11, range: 2.2, speed: 8.2, cd: 1.0, size: 0.75 },
        healer:  { name: 'Shifokor', icon: '💚', hp: 80,  dmg: 0,  range: 10,  speed: 4.2, cd: 1.5, size: 0.5, heal: 16 },
    };
    // oldingi qatordan boshlab joylashuv (dushmanga yaqinroq = kattaroq)
    const ROW = { knight: 9, cavalry: 6, archer: 3, mage: 1, healer: -1 };

    class Battle {
        /**
         * @param people  [{p, team, cls}]
         * @param opts    {towerHp, rand, onEvent}
         */
        constructor(people, opts) {
            this.rand = opts.rand;
            this.cs = opts.combatScale || 1;   // jang tempi: kichik = janglar uzoqroq davom etadi
            this.stall = 0;
            this.onEvent = opts.onEvent || (() => {});
            this.time = 0;
            this.winner = -1;
            this.proj = [];
            this.towers = [0, 1].map(t => ({ team: t, x: 0, z: t ? FIELD.hl - 6 : -FIELD.hl + 6, hp: opts.towerHp, max: opts.towerHp, cd: 0, r: 3.4, flash: 0, down: false }));
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
                        const c = CLASSES[cls], dir = t ? -1 : 1, base = t ? FIELD.hl - 20 : -FIELD.hl + 20;
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
                            slot: (this.rand() - 0.5) * 2.4,   // nishon atrofidagi shaxsiy yondashuv burchagi
                        });
                    });
                }
            }
        }

        alive(t) { let n = 0; for (const u of this.units) if (u.alive && u.team === t) n++; return n; }

        _nearest(u, pred, maxD) {
            let best = null, bd = maxD * maxD;
            for (const o of this.units) {
                if (!o.alive || !pred(o)) continue;
                const d = (o.x - u.x) ** 2 + (o.z - u.z) ** 2;
                if (d < bd) { bd = d; best = o; }
            }
            return best;
        }

        /** Dushman tanlash: yaqinlik + "band"lik. Ko'p jangchi hujum qilayotgan nishonga kamroq boriladi,
         *  shunda hamma bitta dushman atrofida to'planib qolmaydi. */
        _pick(u, maxD) {
            let best = null, bs = Infinity;
            const lim = maxD * maxD;
            for (const o of this.units) {
                if (!o.alive || o.team === u.team) continue;
                const d2 = (o.x - u.x) ** 2 + (o.z - u.z) ** 2;
                if (d2 > lim) continue;
                const sc = d2 * (1 + 0.7 * (this.engaged[o.id] || 0));
                if (sc < bs) { bs = sc; best = o; }
            }
            return best;
        }

        _damage(src, dst, amount, towerMul) {
            if (dst.max !== undefined && dst.cls === undefined) { // minora
                dst.hp -= amount * towerMul; dst.flash = 1;
                this.onEvent('towerHit', dst);
                if (dst.hp <= 0 && !dst.down) { dst.hp = 0; dst.down = true; this.winner = 1 - dst.team; this.onEvent('towerDown', dst); }
                return;
            }
            if (!dst.alive) return;
            dst.hp -= amount; dst.flash = 1;
            if (dst.hp <= 0) {
                dst.alive = false; dst.hp = 0;
                if (src && src.kills !== undefined) src.kills++;
                this.onEvent('death', dst, src);
            }
        }

        /**
         * @param dt         sekund
         * @param towerMul   minoraga zarba koeffitsiyenti (davomiylikni boshqaradi, [A,B])
         */
        step(dt, towerMul) {
            if (this.winner >= 0) towerMul = [1, 1];
            this.time += dt;
            const U = this.units;
            // har bir dushmanga nechta jangchi hujum qilayotganini sanaymiz
            this.engaged.length = U.length; this.engaged.fill(0);
            for (const u of U) if (u.alive && u.tgt && u.tgt.cls !== undefined && u.tgt.team !== u.team) this.engaged[u.tgt.id]++;

            for (const t of this.towers) {
                t.flash = Math.max(0, t.flash - dt * 4);
                t.cd -= dt;
                if (t.cd <= 0 && !t.down) {
                    const tgt = this._nearest({ x: t.x, z: t.z }, o => o.team !== t.team, 19);
                    if (tgt) { this._shoot(t, tgt, 9 * this.cs, 24, 0, 'bolt'); t.cd = 1.3; }
                }
            }

            for (const u of U) {
                if (!u.alive) { u.dying += dt; continue; }
                u.flash = Math.max(0, u.flash - dt * 5);
                u.atk = Math.max(0, u.atk - dt * 4);
                u.cd -= dt;
                u.retarget -= dt;
                const c = u.c, enemyT = this.towers[1 - u.team], myT = this.towers[u.team];

                if (u.cls === 'healer') {
                    if (!u.tgt || !u.tgt.alive || u.retarget <= 0) {
                        let best = null, bf = 0.85;
                        for (const o of U) if (o.alive && o.team === u.team && o !== u && o.hp / o.max < bf && Math.hypot(o.x - u.x, o.z - u.z) < 24) { bf = o.hp / o.max; best = o; }
                        u.tgt = best || this._nearest(u, o => o.team === u.team && o.cls === 'knight', 80);
                        u.retarget = 0.4;
                    }
                } else if (!u.tgt || !u.tgt.alive || u.retarget <= 0) {
                    u.tgt = this._pick(u, 90) || (enemyT.down ? null : enemyT);
                    u.retarget = 0.3 + this.rand() * 0.2;
                }

                let mx = 0, mz = 0, speed = c.speed;
                const t = u.tgt;
                if (t) {
                    const dx = t.x - u.x, dz = t.z - u.z, d = Math.hypot(dx, dz) || 1;
                    const isTower = t.cls === undefined;
                    const reach = c.range + (isTower ? t.r : 0.9);
                    const ally = t.team === u.team;
                    if (u.cls === 'healer') {
                        if (ally && d <= c.range * 0.9 && t.hp < t.max) {
                            if (u.cd <= 0) { t.hp = Math.min(t.max, t.hp + c.heal); u.cd = c.cd; this.onEvent('heal', t, u); }
                        } else if (d > 4) { mx = dx / d; mz = dz / d; speed *= 0.85; }
                    } else if (d > reach * 0.88) {
                        // har kim nishonning o'z tomoniga boradi: atrofida halqa bo'lib joylashadi, to'planib qolmaydi
                        const ang = Math.atan2(-dz, -dx) + u.slot, rp = Math.max(reach * 0.8, 1.5);
                        const ex = t.x + Math.cos(ang) * rp - u.x, ez = t.z + Math.sin(ang) * rp - u.z, ed = Math.hypot(ex, ez) || 1;
                        mx = ex / ed; mz = ez / ed;
                    }
                    else if ((u.cls === 'archer' || u.cls === 'mage') && !isTower && d < c.range * 0.45) { mx = -dx / d; mz = -dz / d; speed *= 0.6; }
                    if (d <= reach && u.cd <= 0 && u.cls !== 'healer') {
                        u.face = Math.atan2(dx, dz);
                        const mul = u.dmgMul * (isTower ? towerMul[u.team] : this.cs);
                        if (c.proj) this._shoot(u, t, c.dmg * mul, c.proj, c.aoe || 0, c.aoe ? 'fire' : 'arrow', isTower ? towerMul[u.team] : 1);
                        else {
                            let dmg = c.dmg * mul;
                            if (u.charge) { dmg *= 2; u.charge = false; }
                            this._damage(u, t, dmg, 1);
                            this.onEvent('hit', t, u);
                        }
                        u.cd = c.cd * (0.9 + this.rand() * 0.2);
                        u.atk = 1;
                    }
                    if (mx || mz) u.face = Math.atan2(mx, mz);
                } else if (u.cls !== 'healer') {
                    // nishon yo'q (g'alaba): dushman minorasi atrofida keng tarqalib turadi
                    const a = u.slot * 2.6 + u.id * 0.9, rp = 9 + (u.id % 6) * 2.4;
                    const ex = enemyT.x + Math.cos(a) * rp - u.x, ez = enemyT.z + Math.sin(a) * rp - u.z, ed = Math.hypot(ex, ez);
                    if (ed > 1.2) { mx = ex / ed; mz = ez / ed; speed *= 0.5; }
                }

                // bir-biriga o'tib ketmaslik
                let sx = 0, sz = 0;
                for (const o of U) {
                    if (o === u || !o.alive) continue;
                    const dx = u.x - o.x, dz = u.z - o.z, d2 = dx * dx + dz * dz, min = (u.c.size + o.c.size) * 2.6;
                    if (d2 < min * min) {
                        const d = Math.sqrt(d2) || 0.01, k = (min - d) / min;
                        // to'liq ustma-ust tushganda tasodifiy yo'nalishga itariladi
                        sx += (d2 > 1e-6 ? dx / d : this.rand() - 0.5) * k; sz += (d2 > 1e-6 ? dz / d : this.rand() - 0.5) * k;
                    }
                }
                u.vx += ((mx * speed + sx * 14) - u.vx) * Math.min(1, dt * 8);
                u.vz += ((mz * speed + sz * 14) - u.vz) * Math.min(1, dt * 8);
                u.x = clamp(u.x + u.vx * dt, -FIELD.hw, FIELD.hw);
                u.z = clamp(u.z + u.vz * dt, -FIELD.hl, FIELD.hl);
            }

            // to'xtab qolish: hech bir tomonda hujum qila oladigan jangchi qolmasa, minorasi baquvvatroq yutadi
            if (this.winner < 0) {
                const atk = [0, 0];
                for (const u of U) if (u.alive && u.cls !== 'healer') atk[u.team]++;
                this.stall = (atk[0] === 0 && atk[1] === 0) ? this.stall + dt : 0;
                if (this.stall > 3) {
                    const lose = this.towers[0].hp / this.towers[0].max < this.towers[1].hp / this.towers[1].max ? this.towers[0] : this.towers[1];
                    lose.hp = 0; lose.down = true; this.winner = 1 - lose.team; this.onEvent('towerDown', lose);
                }
            }

            // snaryadlar
            for (let i = this.proj.length - 1; i >= 0; i--) {
                const p = this.proj[i];
                const t = p.tgt;
                if (t && (t.alive !== false)) { p.tx = t.x; p.tz = t.z; }
                const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz);
                const step = p.speed * dt;
                p.dirx = dx / (d || 1); p.dirz = dz / (d || 1);
                if (d <= step + 0.4) {
                    if (p.aoe) {
                        for (const o of U) if (o.alive && o.team !== p.team && Math.hypot(o.x - p.tx, o.z - p.tz) < p.aoe) this._damage(p.src, o, p.dmg, 1);
                        for (const tw of this.towers) if (tw.team !== p.team && Math.hypot(tw.x - p.tx, tw.z - p.tz) < p.aoe + tw.r) this._damage(p.src, tw, p.dmg, p.towerMul);
                        this.onEvent('aoe', p);
                    } else if (t && t.alive !== false) {
                        this._damage(p.src, t, p.dmg, p.towerMul);
                        this.onEvent('hit', t, p.src);
                    }
                    this.proj.splice(i, 1);
                    continue;
                }
                p.x += dx / d * step; p.z += dz / d * step;
                p.life += dt;
            }
        }

        _shoot(src, tgt, dmg, speed, aoe, kind, towerMul = 1) {
            this.proj.push({ src, tgt, team: src.team, x: src.x, z: src.z, tx: tgt.x, tz: tgt.z, dmg, speed, aoe, kind, towerMul, life: 0, dirx: 0, dirz: 1 });
            this.onEvent('shoot', src, kind);
        }
    }

    NS.FIELD = FIELD;
    NS.CLASSES = CLASSES;
    NS.Battle = Battle;
})(window.App = window.App || {});
