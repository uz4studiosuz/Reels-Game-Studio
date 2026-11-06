/* games/army/scene.js — Armiya jangining three.js sahnasi: kunduzgi tabiat, tafsilotli jangchilar,
 * minoralar, snaryadlar, kino kamera. Mantiq `sim.js` da, bu yerda faqat ko'rinish. */
(function (App) {
    'use strict';
    const NS = App.army;
    const { FIELD } = NS;
    const TEAM = [0xe8452a, 0x3b78e8];
    const SKIN = 0xf0cfa8;
    const SKY = 0xbfe0ff;
    const UNIT_SCALE = 1.6;

    const L = (c, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o));
    const B = (c) => new THREE.MeshBasicMaterial({ color: c });

    const G = {
        box: new THREE.BoxGeometry(1, 1, 1),
        sph: new THREE.SphereGeometry(1, 14, 10),
        cone: new THREE.ConeGeometry(1, 1, 12),
        cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
        tor: new THREE.TorusGeometry(1, 0.08, 6, 20),
    };
    const SHARED = new Set([...Object.values(G), ...Object.values(NS.GEO)]);

    /** Qisqa yordamchi: mesh yaratib, joylab, qo'shadi. */
    function part(parent, geo, mat, x, y, z, sx, sy, sz, shadow = true) {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x, y, z); m.scale.set(sx, sy, sz);
        m.castShadow = shadow;
        parent.add(m);
        return m;
    }
    /** Bo'g'in (shu nuqta atrofida aylanadi) — ichiga mesh offset bilan qo'yiladi. */
    function joint(parent, x, y, z) { const j = new THREE.Group(); j.position.set(x, y, z); parent.add(j); return j; }

    function towerMesh(team) {
        const g = new THREE.Group();
        const c = TEAM[team];
        const stone = L(0xa9a49a), stoneD = L(0x8a857b);
        part(g, G.cyl, stoneD, 0, 1.2, 0, 4.4, 2.4, 4.4);                                            // poydevor
        const base = part(g, G.cyl, stone, 0, 6.2, 0, 3.4, 9.0, 3.4);                                // gavda
        for (let i = 0; i < 10; i++) {                                                                // tishlar
            const a = i / 10 * Math.PI * 2;
            part(g, G.box, stone, Math.cos(a) * 3.5, 11.2, Math.sin(a) * 3.5, 0.9, 1.1, 0.9);
        }
        part(g, G.cyl, stoneD, 0, 10.7, 0, 3.7, 0.5, 3.7);
        part(g, G.cone, L(c), 0, 13.6, 0, 3.2, 3.4, 3.2);                                            // tom
        part(g, G.cyl, B(c), 0, 8.2, 0, 3.45, 0.35, 3.45, false);                                    // jamoa belbog'i
        part(g, G.box, L(0x4a321c), 0, 2.4, 3.3, 1.5, 2.6, 0.3);                                     // eshik
        part(g, G.cyl, L(0xdddddd), 0, 17.2, 0, 0.1, 3.4, 0.1);
        const flag = part(g, G.box, new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide }), 1.2, 18.2, 0, 2.2, 1.3, 0.05);
        g.userData = { flag, base };
        return g;
    }

    class ArmyWorld {
        constructor(battle) {
            App.gl.init();
            this.battle = battle;
            const scene = (this.scene = new THREE.Scene());
            scene.background = new THREE.Color(SKY);
            scene.fog = new THREE.Fog(0xcfe6ff, 130, 420);
            this.camera = new THREE.PerspectiveCamera(50, 720 / 1280, 0.5, 900);
            const W2 = FIELD.hw, H2 = FIELD.hl;
            const rnd = (a, b) => a + Math.random() * (b - a);

            // osmon: tepadan to'q ko'k, ufqda och
            {
                const sg = new THREE.SphereGeometry(600, 24, 16);
                const pos = sg.attributes.position, col = [];
                const top = new THREE.Color(0x3d8bff), hor = new THREE.Color(0xcfe9ff), c = new THREE.Color();
                for (let i = 0; i < pos.count; i++) c.copy(hor).lerp(top, Math.pow(Math.max(0, pos.getY(i) / 600), 0.6)), col.push(c.r, c.g, c.b);
                sg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
                scene.add(new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })));
            }

            // yorug'lik
            scene.add(new THREE.HemisphereLight(0xdbe9ff, 0x5b7f46, 0.62));
            const sun = new THREE.DirectionalLight(0xfff0d0, 0.92);
            sun.position.set(70, 120, -50);
            sun.castShadow = true;
            sun.shadow.mapSize.set(3072, 3072);
            const sc = sun.shadow.camera;
            sc.left = -W2 - 14; sc.right = W2 + 14; sc.top = H2 + 12; sc.bottom = -H2 - 12; sc.near = 20; sc.far = 320;
            sun.shadow.bias = -0.0006;
            scene.add(sun);

            // yer: tashqi maysa + maydon (chiziq-chiziq o'rilgan)
            const outer = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), L(0x3f7a30));
            outer.rotation.x = -Math.PI / 2; outer.position.y = -0.1; outer.receiveShadow = true; scene.add(outer);
            const stripes = 16, sw = (H2 * 2 + 16) / stripes;
            for (let i = 0; i < stripes; i++) {
                const m = new THREE.Mesh(new THREE.PlaneGeometry(W2 * 2 + 16, sw), L(i % 2 ? 0x4f9a3c : 0x468f35));
                m.rotation.x = -Math.PI / 2; m.position.set(0, 0, -H2 - 8 + sw * (i + 0.5)); m.receiveShadow = true; scene.add(m);
            }
            for (const t of [0, 1]) { // jamoa hududlari (och tus)
                const half = new THREE.Mesh(new THREE.PlaneGeometry(W2 * 2 + 16, H2 + 8), new THREE.MeshBasicMaterial({ color: TEAM[t], transparent: true, opacity: 0.11, depthWrite: false }));
                half.rotation.x = -Math.PI / 2; half.position.set(0, 0.04, t ? H2 / 2 + 4 : -H2 / 2 - 4); scene.add(half);
            }
            const mid = new THREE.Mesh(new THREE.PlaneGeometry(W2 * 2 + 16, 0.5), B(0xffffff));
            mid.rotation.x = -Math.PI / 2; mid.position.y = 0.06; scene.add(mid);
            const circ = new THREE.Mesh(new THREE.RingGeometry(9.2, 9.7, 48), B(0xffffff));
            circ.rotation.x = -Math.PI / 2; circ.position.y = 0.06; scene.add(circ);

            // to'siq (yog'och panjara)
            const rail = L(0xe9e2d2);
            for (const z of [-H2 - 8, H2 + 8]) part(scene, G.box, rail, 0, 0.9, z, W2 * 2 + 16, 0.25, 0.25);
            for (const x of [-W2 - 8, W2 + 8]) part(scene, G.box, rail, x, 0.9, 0, 0.25, 0.25, H2 * 2 + 16);

            // daraxtlar, tepaliklar, bulutlar
            const trunkMat = L(0x6a4a2a);
            for (let i = 0; i < 90; i++) {
                const side = i % 2 ? 1 : -1, x = side * rnd(W2 + 14, W2 + 70), z = rnd(-H2 - 40, H2 + 60);
                const s = rnd(0.9, 1.9), hue = 0.3 + rnd(-0.03, 0.04);
                part(scene, G.cyl, trunkMat, x, 1.2 * s, z, 0.45 * s, 2.4 * s, 0.45 * s);
                const crown = new THREE.Color().setHSL(hue, 0.5, rnd(0.3, 0.42));
                if (i % 3) part(scene, G.cone, L(crown), x, 5.2 * s, z, 2.1 * s, 5.4 * s, 2.1 * s);
                else part(scene, G.sph, L(crown), x, 4.2 * s, z, 2.6 * s, 2.4 * s, 2.6 * s);
            }
            for (let i = 0; i < 14; i++) {
                const side = i % 2 ? 1 : -1;
                const h = part(scene, G.sph, L(new THREE.Color().setHSL(0.27 + rnd(-0.02, 0.03), 0.42, rnd(0.38, 0.5))), side * rnd(140, 260), -6, rnd(-200, 260), rnd(40, 90), rnd(16, 34), rnd(40, 90), false);
                h.receiveShadow = false;
            }
            this.clouds = [];
            for (let i = 0; i < 12; i++) {
                const cg = new THREE.Group();
                for (let k = 0; k < 5; k++) part(cg, G.sph, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 }), rnd(-14, 14), rnd(-2, 3), rnd(-5, 5), rnd(7, 13), rnd(4, 7), rnd(6, 10), false);
                cg.position.set(rnd(-260, 260), rnd(85, 130), rnd(-200, 260));
                scene.add(cg); this.clouds.push(cg);
            }

            // minoralar
            this.towers = battle.towers.map(t => { const m = towerMesh(t.team); m.position.set(t.x, 0, t.z); scene.add(m); return m; });

            // jangchilar
            this.meshes = new Map();
            for (const u of battle.units) { const m = NS.unitMesh(u); m.position.set(u.x, 0, u.z); m.rotation.y = u.face; scene.add(m); this.meshes.set(u, m); }

            this.projMesh = new Map();
            this.rings = [];
            this.t = 0;
        }

        /** Mantiq holatini sahnaga ko'chiradi. */
        sync(dt) {
            this.t += dt;
            const b = this.battle, T = this.t;
            for (const c of this.clouds) { c.position.x += dt * 1.2; if (c.position.x > 280) c.position.x = -280; }

            for (const [u, m] of this.meshes) {
                const ud = m.userData;
                const s = (NS.UNIT_BASE[u.cls] * UNIT_SCALE);
                if (!u.alive) {
                    const k = Math.min(1, u.dying / 0.5);
                    m.rotation.x = k * 1.5 * (u.id % 2 ? 1 : -1);
                    m.position.y = -k * 0.3 * s - Math.max(0, u.dying - 3) * 0.5;
                    if (u.dying > 6 && m.parent) { this.scene.remove(m); ud.mats.forEach(x => x.dispose()); }
                    continue;
                }
                const moving = Math.min(1, Math.hypot(u.vx, u.vz) / 2.5);
                NS.animateUnit(u, m, T, u.atk, moving);
                m.position.set(u.x, 0, u.z);
                let d = u.face - m.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
                m.rotation.y += d * Math.min(1, dt * 12);
                m.scale.set(s, s, s);
                const f = u.flash;
                for (const mt of ud.mats) if (mt.emissive) mt.emissive.setRGB(f * 0.7, f * 0.7, f * 0.7);
            }
            // minoralar
            b.towers.forEach((t, i) => {
                const m = this.towers[i];
                const frac = t.hp / t.max;
                if (t.down) {
                    // minora yerga cho'kadi va biroz og'adi (yassilanmaydi)
                    m.position.y = Math.max(-13, m.position.y - dt * 4.5);
                    m.rotation.z = Math.min(0.22, m.rotation.z + dt * 0.2) * (i ? -1 : 1);
                    m.position.x = Math.sin(T * 70) * Math.max(0, 1 + m.position.y / 13) * 0.3;
                } else {
                    m.scale.y = 0.6 + 0.4 * frac;
                    m.position.x = Math.sin(T * 90) * t.flash * 0.15;
                }
                m.userData.flag.rotation.y = Math.sin(T * 3 + i) * 0.35;
                m.userData.base.material.emissive.setRGB(t.flash * 0.6, t.flash * 0.25, t.flash * 0.1);
            });
            // snaryadlar
            const seen = new Set();
            for (const p of b.proj) {
                seen.add(p);
                let m = this.projMesh.get(p);
                if (!m) {
                    if (p.kind === 'fire') m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), B(0xff8a2a));
                    else if (p.kind === 'bolt') m = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), B(0xffe27a));
                    else { m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 5), B(0x7a4a22)); m.rotation.order = 'YXZ'; }
                    this.scene.add(m); this.projMesh.set(p, m);
                }
                const arc = p.kind === 'arrow' ? Math.sin(Math.min(1, p.life * 1.1) * Math.PI) * 2.2 : 0;
                m.position.set(p.x, 2.0 + arc, p.z);
                if (p.kind === 'arrow') m.rotation.set(Math.PI / 2, Math.atan2(p.dirx, p.dirz), 0);
            }
            for (const [p, m] of this.projMesh) if (!seen.has(p)) { this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); this.projMesh.delete(p); }
            // zarba halqalari
            for (let i = this.rings.length - 1; i >= 0; i--) {
                const r = this.rings[i]; r.t += dt;
                const k = r.t / 0.55;
                r.mesh.scale.setScalar(0.4 + k * r.r);
                r.mesh.material.opacity = Math.max(0, 0.9 - k);
                if (k >= 1) { this.scene.remove(r.mesh); r.mesh.geometry.dispose(); r.mesh.material.dispose(); this.rings.splice(i, 1); }
            }
        }

        ring(x, z, r, color = 0xff8a2a) {
            const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
            m.rotation.x = -Math.PI / 2; m.position.set(x, 0.12, z);
            this.scene.add(m); this.rings.push({ mesh: m, t: 0, r });
        }

        render() { App.gl.render(this.scene, this.camera, { bloom: 0.22, threshold: 0.93 }); }

        project(x, y, z) {
            const v = new THREE.Vector3(x, y, z).project(this.camera);
            if (v.z > 1 || v.z < -1) return null;
            return { x: (v.x * 0.5 + 0.5) * 720, y: (-v.y * 0.5 + 0.5) * 1280, depth: v.z };
        }

        dispose() {
            this.scene.traverse((o) => {
                if (o.geometry && !SHARED.has(o.geometry)) o.geometry.dispose();
                if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
            });
        }
    }

    /** Kino kamera. Minora va daraxtlar ichiga kirib ketmaydi. */
    class ArmyCamera {
        constructor(world) {
            this.w = world;
            this.pos = new THREE.Vector3(0, 52, -FIELD.hl - 14);
            this.look = new THREE.Vector3(0, 0, 6);
            this.hero = null;
            this.shot = -1;
        }

        /** Kamerani minoralardan kamida 16 birlik narida tutadi. */
        _avoid(p, battle) {
            for (const t of battle.towers) {
                const dx = p.x - t.x, dz = p.z - t.z, d = Math.hypot(dx, dz);
                if (d < 17 && p.y < 24) { const k = 17 / (d || 1); p.x = t.x + dx * k; p.z = t.z + dz * k; }
            }
            p.y = Math.max(4, p.y);
            return p;
        }

        update(mode, battle, tick) {
            const cam = this.w.camera, HL = FIELD.hl, HW = FIELD.hw;
            let p, l;
            const aliveU = battle.units.filter(u => u.alive);
            const cx = aliveU.reduce((s, u) => s + u.x, 0) / (aliveU.length || 1), cz = aliveU.reduce((s, u) => s + u.z, 0) / (aliveU.length || 1);
            if (battle.winner >= 0) {
                const t = battle.towers[1 - battle.winner], a = tick * 0.004, side = t.z < 0 ? 1 : -1;
                p = new THREE.Vector3(t.x + Math.sin(a) * 26, 30, t.z + side * 40 + Math.cos(a) * 5);
                l = new THREE.Vector3(t.x, 5, t.z);
            } else if (mode === 'top') {
                p = new THREE.Vector3(0, 150, cz - 14); l = new THREE.Vector3(0, 0, cz);
            } else if (mode === 'orbit') {
                const a = tick * 0.0035;
                p = new THREE.Vector3(Math.sin(a) * 92, 54, Math.cos(a) * 92); l = new THREE.Vector3(0, 0, 0);
            } else {
                const shot = Math.floor(tick / 330) % 5;
                if (shot !== this.shot) { this.shot = shot; this.hero = aliveU.length ? aliveU[Math.floor(Math.random() * aliveU.length)] : null; }
                if (shot === 0) { p = new THREE.Vector3(0, 52, -HL - 14); l = new THREE.Vector3(0, 0, HL * 0.06); }
                else if (shot === 1) { const sd = (Math.floor(tick / 1650) % 2) ? 1 : -1; p = new THREE.Vector3(sd * (HW + 36), 30, cz); l = new THREE.Vector3(cx, 0, cz); }
                else if (shot === 2 && this.hero && this.hero.alive) {
                    const h = this.hero; p = new THREE.Vector3(h.x - Math.sin(h.face) * 15, 9, h.z - Math.cos(h.face) * 15); l = new THREE.Vector3(h.x + Math.sin(h.face) * 6, 2.2, h.z + Math.cos(h.face) * 6);
                } else if (shot === 3) { p = new THREE.Vector3(0, 130, cz - 16); l = new THREE.Vector3(0, 0, cz); }
                else { p = new THREE.Vector3(24, 30, cz + 52); l = new THREE.Vector3(cx, 0, cz); }
            }
            this._avoid(p, battle);
            this.pos.lerp(p, battle.winner >= 0 ? 0.03 : 0.035);
            this._avoid(this.pos, battle);
            this.look.lerp(l, 0.07);
            cam.position.copy(this.pos);
            cam.lookAt(this.look);
        }
    }

    NS.ArmyWorld = ArmyWorld;
    NS.ArmyCamera = ArmyCamera;
})(window.App = window.App || {});
