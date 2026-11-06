/* games/army/scene.js — Armiya jangining three.js sahnasi: tabiiy ochiq jang maydoni,
 * tafsilotli jangchilar, bayroqlar, snaryadlar, kino kamera. */
(function (App) {
    'use strict';
    const NS = App.army;
    const { FIELD } = NS;
    const TEAM = [0xe8452a, 0x3b78e8];
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
        disc: new THREE.CircleGeometry(1, 24),
    };
    const SHARED = new Set([...Object.values(G), ...Object.values(NS.GEO)]);

    function part(parent, geo, mat, x, y, z, sx, sy, sz, shadow = true) {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x, y, z); m.scale.set(sx, sy, sz);
        m.castShadow = shadow;
        parent.add(m);
        return m;
    }

    /** Har bir jamoa uchun o'rta asr harbiy bayrog'i (standard / banner). */
    function createBanner(team, x, z) {
        const g = new THREE.Group();
        const c = TEAM[team];
        const wood = L(0x422a16);
        const metal = L(0x777777);
        // baland yog'och nayza ustuni
        part(g, G.cyl, wood, 0, 4.5, 0, 0.14, 9.0, 0.14);
        // nayza uchi (temir uchlik)
        part(g, G.cone, metal, 0, 9.4, 0, 0.3, 1.0, 0.3);
        // ko'ndalang yog'och to'sin
        part(g, G.cyl, wood, 0.8, 8.4, 0, 0.08, 2.0, 0.08);
        g.children[g.children.length - 1].rotation.z = Math.PI / 2;
        // osilib turgan mato bayroq (heraldik pennant)
        const flagMat = new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide });
        const flag = part(g, G.box, flagMat, 0.8, 6.7, 0, 1.8, 3.2, 0.04);
        // poydevordagi toshlar
        part(g, G.sph, L(0x5c5750), 0, 0.3, 0, 0.9, 0.6, 0.9);
        g.position.set(x, 0, z);
        g.userData = { flag, team };
        return g;
    }

    /** O'rta asr yog'och to'sig'i (cheval de frise / uchli qoziqlar). */
    function createSpikeBarrier(x, z, rotY) {
        const g = new THREE.Group();
        const wood = L(0x48321a);
        const tip = L(0x604526);
        for (let i = 0; i < 3; i++) {
            const sp = new THREE.Group();
            part(sp, G.cyl, wood, 0, 1.4, 0, 0.18, 2.8, 0.18);
            part(sp, G.cone, tip, 0, 2.9, 0, 0.22, 0.6, 0.22);
            sp.rotation.z = (i === 1 ? -1 : 1) * 0.65;
            sp.rotation.x = (i - 1) * 0.45;
            sp.position.x = (i - 1) * 0.7;
            g.add(sp);
        }
        g.position.set(x, 0, z);
        g.rotation.y = rotY;
        return g;
    }

    class ArmyWorld {
        constructor(battle) {
            App.gl.init();
            this.battle = battle;
            const scene = (this.scene = new THREE.Scene());
            scene.background = new THREE.Color(SKY);
            scene.fog = new THREE.Fog(0xc5dff8, 120, 400);
            this.camera = new THREE.PerspectiveCamera(50, 720 / 1280, 0.5, 900);
            const W2 = FIELD.hw, H2 = FIELD.hl;
            const rnd = (a, b) => a + Math.random() * (b - a);

            // osmon
            {
                const sg = new THREE.SphereGeometry(600, 24, 16);
                const pos = sg.attributes.position, col = [];
                const top = new THREE.Color(0x3582f0), hor = new THREE.Color(0xcbe5ff), c = new THREE.Color();
                for (let i = 0; i < pos.count; i++) {
                    c.copy(hor).lerp(top, Math.pow(Math.max(0, pos.getY(i) / 600), 0.55));
                    col.push(c.r, c.g, c.b);
                }
                sg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
                scene.add(new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })));
            }

            // yorug'lik
            scene.add(new THREE.HemisphereLight(0xdde8ff, 0x556e40, 0.65));
            const sun = new THREE.DirectionalLight(0xffedd0, 0.95);
            sun.position.set(65, 115, -45);
            sun.castShadow = true;
            sun.shadow.mapSize.set(3072, 3072);
            const sc = sun.shadow.camera;
            sc.left = -W2 - 16; sc.right = W2 + 16; sc.top = H2 + 16; sc.bottom = -H2 - 16; sc.near = 20; sc.far = 320;
            sun.shadow.bias = -0.0006;
            scene.add(sun);

            // ---------------- TABIIY OCHIQ JANG MAYDONI (Stadion emas!) ----------------
            // 1. Katta tashqi kenglik (dasht / cho'zilgan tabiat)
            const outer = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), L(0x344d24));
            outer.rotation.x = -Math.PI / 2; outer.position.y = -0.15; outer.receiveShadow = true; scene.add(outer);

            // 2. Asosiy jang hududi: tabiiy yovvoyi maysa
            const fieldPlane = new THREE.Mesh(new THREE.PlaneGeometry(W2 * 2 + 40, H2 * 2 + 40), L(0x3b5727));
            fieldPlane.rotation.x = -Math.PI / 2; fieldPlane.position.y = -0.05; fieldPlane.receiveShadow = true; scene.add(fieldPlane);

            // 3. To'qnashuv va jang markazidagi tuproq, loy va oyoq osti bo'lgan yer qatlamlari
            const dirtMatMain = L(0x4a3a24);
            const dirtMatLight = L(0x56442c);
            const dirtMatDark = L(0x3c2e1c);

            // Markaziy katta to'qnashuv maydoni (noodatiy shaklda ezilgan qora tuproq)
            const centerDirt = new THREE.Mesh(G.disc, dirtMatMain);
            centerDirt.rotation.x = -Math.PI / 2;
            centerDirt.position.set(0, 0.02, 0);
            centerDirt.scale.set(W2 * 0.92, H2 * 0.62, 1);
            centerDirt.receiveShadow = true;
            scene.add(centerDirt);

            // Qo'shimcha loy va tuproq dog'lari (jang kechgan tabiiy izlar)
            for (let i = 0; i < 28; i++) {
                const mat = i % 2 ? dirtMatLight : dirtMatDark;
                const d = new THREE.Mesh(G.disc, mat);
                d.rotation.x = -Math.PI / 2;
                d.position.set(rnd(-W2 * 0.75, W2 * 0.75), 0.03 + (i % 5) * 0.005, rnd(-H2 * 0.65, H2 * 0.65));
                const rx = rnd(5, 14), rz = rnd(4, 11);
                d.scale.set(rx, rz, 1);
                d.rotation.z = rnd(0, Math.PI);
                d.receiveShadow = true;
                scene.add(d);
            }

            // 4. Tabiiy toshlar va qoyalar (chegaralarda va maydon atrofida)
            const stoneMat1 = L(0x5e5a52), stoneMat2 = L(0x4a4740), stoneMat3 = L(0x6e6960);
            for (let i = 0; i < 46; i++) {
                const sm = [stoneMat1, stoneMat2, stoneMat3][i % 3];
                const side = i % 2 ? 1 : -1;
                const bx = side * rnd(W2 * 0.65, W2 + 18);
                const bz = rnd(-H2 - 8, H2 + 8);
                const bsx = rnd(1.4, 4.2), bsy = rnd(0.9, 2.8), bsz = rnd(1.4, 4.0);
                const rock = part(scene, G.sph, sm, bx, bsy * 0.4, bz, bsx, bsy, bsz);
                rock.rotation.set(rnd(0, 1), rnd(0, 3), rnd(0, 1));
            }

            // 5. O'rta asr harbiy bayroqlari (Qizil va Ko'k jamoalarning jang standartlari)
            this.banners = [];
            // Qizil jamoa bayroqlari (orqa chiziq)
            for (let i = 0; i < 5; i++) {
                const bx = ((i - 2) * (W2 * 0.38)) + rnd(-1.5, 1.5);
                const b = createBanner(0, bx, -H2 + 4 + rnd(-1, 2));
                scene.add(b);
                this.banners.push(b);
            }
            // Ko'k jamoa bayroqlari (orqa chiziq)
            for (let i = 0; i < 5; i++) {
                const bx = ((i - 2) * (W2 * 0.38)) + rnd(-1.5, 1.5);
                const b = createBanner(1, bx, H2 - 4 + rnd(-2, 1));
                scene.add(b);
                this.banners.push(b);
            }

            // 6. Qanotlardagi o'rta asr yog'och to'siqlari / nayzali qoziqlar (cheval de frise)
            for (let i = 0; i < 14; i++) {
                const side = i % 2 ? 1 : -1;
                const z = ((i >> 1) - 3) * (H2 * 0.28);
                const bar = createSpikeBarrier(side * (W2 + 1.5), z, side * (Math.PI / 2 + rnd(-0.2, 0.2)));
                scene.add(bar);
            }

            // 7. Daraxtlar va o'rmon vodiysi (tabiiy o'rab turuvchi archa va emanlar)
            const trunkMat = L(0x56381e);
            for (let i = 0; i < 110; i++) {
                const side = i % 2 ? 1 : -1;
                const x = side * rnd(W2 + 10, W2 + 85);
                const z = rnd(-H2 - 50, H2 + 70);
                const s = rnd(0.9, 2.1), hue = 0.29 + rnd(-0.04, 0.04);
                part(scene, G.cyl, trunkMat, x, 1.3 * s, z, 0.42 * s, 2.6 * s, 0.42 * s);
                const crown = new THREE.Color().setHSL(hue, 0.48, rnd(0.28, 0.40));
                if (i % 3) {
                    part(scene, G.cone, L(crown), x, 5.4 * s, z, 2.2 * s, 5.6 * s, 2.2 * s);
                } else {
                    part(scene, G.sph, L(crown), x, 4.4 * s, z, 2.8 * s, 2.6 * s, 2.8 * s);
                }
            }

            // Tepaliklar
            for (let i = 0; i < 16; i++) {
                const side = i % 2 ? 1 : -1;
                const h = part(scene, G.sph, L(new THREE.Color().setHSL(0.26 + rnd(-0.02, 0.03), 0.38, rnd(0.32, 0.44))), side * rnd(140, 270), -8, rnd(-210, 270), rnd(45, 95), rnd(18, 36), rnd(45, 95), false);
                h.receiveShadow = false;
            }

            // Bulutlar
            this.clouds = [];
            for (let i = 0; i < 12; i++) {
                const cg = new THREE.Group();
                for (let k = 0; k < 5; k++) {
                    part(cg, G.sph, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 }), rnd(-14, 14), rnd(-2, 3), rnd(-5, 5), rnd(7, 13), rnd(4, 7), rnd(6, 10), false);
                }
                cg.position.set(rnd(-260, 260), rnd(85, 130), rnd(-200, 260));
                scene.add(cg);
                this.clouds.push(cg);
            }

            // Jangchilar
            this.meshes = new Map();
            for (const u of battle.units) {
                const m = NS.unitMesh(u);
                m.position.set(u.x, 0, u.z);
                m.rotation.y = u.face;
                scene.add(m);
                this.meshes.set(u, m);
            }

            this.projMesh = new Map();
            this.rings = [];
            this.t = 0;
        }

        /** Mantiq holatini sahnaga ko'chiradi. */
        sync(dt) {
            this.t += dt;
            const b = this.battle, T = this.t;

            // bulutlar harakati
            for (const c of this.clouds) {
                c.position.x += dt * 1.2;
                if (c.position.x > 280) c.position.x = -280;
            }

            // bayroqlar shamolda hilpirashi
            for (let i = 0; i < this.banners.length; i++) {
                const bn = this.banners[i];
                bn.userData.flag.rotation.y = Math.sin(T * 4 + i * 1.1) * 0.28;
                bn.userData.flag.rotation.z = Math.cos(T * 3.5 + i * 0.8) * 0.08;
            }

            // jangchilar
            for (const [u, m] of this.meshes) {
                const ud = m.userData;
                const s = (NS.UNIT_BASE[u.cls] * UNIT_SCALE);

                if (!u.alive) {
                    const k = Math.min(1, u.dying / 0.5);
                    m.rotation.x = k * 1.5 * (u.id % 2 ? 1 : -1);
                    m.position.y = -k * 0.3 * s - Math.max(0, u.dying - 3) * 0.5;
                    if (u.dying > 6 && m.parent) {
                        this.scene.remove(m);
                        ud.mats.forEach(x => x.dispose());
                    }
                    continue;
                }

                const moving = Math.min(1, Math.hypot(u.vx, u.vz) / 2.5);
                NS.animateUnit(u, m, T, u.atk, moving);

                // g'alaba nishonlash (yutgan jamoa jangchilari quvonchdan sakraydi)
                if (b.winner >= 0 && u.team === b.winner) {
                    m.position.set(u.x, Math.abs(Math.sin(T * 8 + u.id)) * 0.55, u.z);
                    m.rotation.y = Math.sin(T * 3 + u.id) * 0.4 + (u.team ? Math.PI : 0);
                } else {
                    m.position.set(u.x, 0, u.z);
                    let d = u.face - m.rotation.y;
                    d = Math.atan2(Math.sin(d), Math.cos(d));
                    m.rotation.y += d * Math.min(1, dt * 12);
                }

                m.scale.set(s, s, s);
                const f = u.flash;
                for (const mt of ud.mats) {
                    if (mt.emissive) mt.emissive.setRGB(f * 0.7, f * 0.7, f * 0.7);
                }
            }

            // snaryadlar
            const seen = new Set();
            for (const p of b.proj) {
                seen.add(p);
                let m = this.projMesh.get(p);
                if (!m) {
                    if (p.kind === 'fire') m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), B(0xff8a2a));
                    else if (p.kind === 'bolt') m = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), B(0xffe27a));
                    else {
                        m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 5), B(0x7a4a22));
                        m.rotation.order = 'YXZ';
                    }
                    this.scene.add(m);
                    this.projMesh.set(p, m);
                }
                const arc = p.kind === 'arrow' ? Math.sin(Math.min(1, p.life * 1.1) * Math.PI) * 2.2 : 0;
                m.position.set(p.x, 2.0 + arc, p.z);
                if (p.kind === 'arrow') m.rotation.set(Math.PI / 2, Math.atan2(p.dirx, p.dirz), 0);
            }
            for (const [p, m] of this.projMesh) {
                if (!seen.has(p)) {
                    this.scene.remove(m);
                    m.geometry.dispose();
                    m.material.dispose();
                    this.projMesh.delete(p);
                }
            }

            // zarba halqalari
            for (let i = this.rings.length - 1; i >= 0; i--) {
                const r = this.rings[i];
                r.t += dt;
                const k = r.t / 0.55;
                r.mesh.scale.setScalar(0.4 + k * r.r);
                r.mesh.material.opacity = Math.max(0, 0.9 - k);
                if (k >= 1) {
                    this.scene.remove(r.mesh);
                    r.mesh.geometry.dispose();
                    r.mesh.material.dispose();
                    this.rings.splice(i, 1);
                }
            }
        }

        ring(x, z, r, color = 0xff8a2a) {
            const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
            m.rotation.x = -Math.PI / 2;
            m.position.set(x, 0.12, z);
            this.scene.add(m);
            this.rings.push({ mesh: m, t: 0, r });
        }

        render() {
            App.gl.render(this.scene, this.camera, { bloom: 0.22, threshold: 0.93 });
        }

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

    /** Kino kamera. Qahramonlar va jangga tabiiy moslashadi. */
    class ArmyCamera {
        constructor(world) {
            this.w = world;
            this.pos = new THREE.Vector3(0, 52, -FIELD.hl - 14);
            this.look = new THREE.Vector3(0, 0, 6);
            this.hero = null;
            this.shot = -1;
        }

        update(mode, battle, tick) {
            const cam = this.w.camera, HL = FIELD.hl, HW = FIELD.hw;
            let p, l;
            const aliveU = battle.units.filter(u => u.alive);
            const cx = aliveU.reduce((s, u) => s + u.x, 0) / (aliveU.length || 1);
            const cz = aliveU.reduce((s, u) => s + u.z, 0) / (aliveU.length || 1);

            if (battle.winner >= 0) {
                // G'olib armiya qahramonlari atrofida tantanali aylanma kamera!
                const winners = battle.units.filter(u => u.alive && u.team === battle.winner);
                const wcx = winners.length ? winners.reduce((s, u) => s + u.x, 0) / winners.length : cx;
                const wcz = winners.length ? winners.reduce((s, u) => s + u.z, 0) / winners.length : cz;
                const a = tick * 0.008;
                p = new THREE.Vector3(wcx + Math.sin(a) * 24, 16, wcz + Math.cos(a) * 24);
                l = new THREE.Vector3(wcx, 2.2, wcz);
            } else if (mode === 'top') {
                p = new THREE.Vector3(0, 150, cz - 14);
                l = new THREE.Vector3(0, 0, cz);
            } else if (mode === 'orbit') {
                const a = tick * 0.0035;
                p = new THREE.Vector3(Math.sin(a) * 92, 54, Math.cos(a) * 92);
                l = new THREE.Vector3(0, 0, 0);
            } else {
                const shot = Math.floor(tick / 330) % 5;
                if (shot !== this.shot) {
                    this.shot = shot;
                    this.hero = aliveU.length ? aliveU[Math.floor(Math.random() * aliveU.length)] : null;
                }
                if (shot === 0) {
                    p = new THREE.Vector3(0, 50, -HL - 12);
                    l = new THREE.Vector3(0, 0, HL * 0.06);
                } else if (shot === 1) {
                    const sd = (Math.floor(tick / 1650) % 2) ? 1 : -1;
                    p = new THREE.Vector3(sd * (HW + 32), 28, cz);
                    l = new THREE.Vector3(cx, 0, cz);
                } else if (shot === 2 && this.hero && this.hero.alive) {
                    const h = this.hero;
                    p = new THREE.Vector3(h.x - Math.sin(h.face) * 15, 9, h.z - Math.cos(h.face) * 15);
                    l = new THREE.Vector3(h.x + Math.sin(h.face) * 6, 2.2, h.z + Math.cos(h.face) * 6);
                } else if (shot === 3) {
                    p = new THREE.Vector3(0, 125, cz - 16);
                    l = new THREE.Vector3(0, 0, cz);
                } else {
                    p = new THREE.Vector3(22, 28, cz + 48);
                    l = new THREE.Vector3(cx, 0, cz);
                }
            }

            p.y = Math.max(3.5, p.y);
            this.pos.lerp(p, battle.winner >= 0 ? 0.03 : 0.035);
            this.look.lerp(l, 0.07);
            cam.position.copy(this.pos);
            cam.lookAt(this.look);
        }
    }

    NS.ArmyWorld = ArmyWorld;
    NS.ArmyCamera = ArmyCamera;
})(window.App = window.App || {});
