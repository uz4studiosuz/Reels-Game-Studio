/* games/track3d/scene.js — three.js sahnasi: yo'l, sharlar, kamera.
 * Faqat ko'rinish: fizika `rail-physics.js` da, qoidalar `index.js` da. */
(function (App) {
    'use strict';
    const NS = App.track3d;
    const { DS, WIDTH, WALL, HUE } = NS;
    const { smooth } = App.util;
    const R = 720, Hh = 1280;
    const BG = 0x0d0d10;


    function canvasTex(w, h, draw) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        draw(c.getContext('2d'), w, h);
        const t = new THREE.CanvasTexture(c);
        t.anisotropy = 4;
        return t;
    }

    function ballTexture(p) {
        return canvasTex(256, 128, (g, w, h) => {
            g.fillStyle = App.util.hsl(p.hue, 70, 56);
            g.fillRect(0, 0, w, h);
            g.fillStyle = 'rgba(255,255,255,.22)';
            g.fillRect(0, h * 0.42, w, h * 0.16);
            g.textAlign = 'center'; g.textBaseline = 'middle';
            g.font = `800 ${p.emoji ? 64 : 58}px ${App.draw.FONT}`;
            g.fillStyle = p.emoji ? '#fff' : '#0d0d10';
            g.fillText(p.label, w * 0.25, h * 0.52);
            g.fillText(p.label, w * 0.75, h * 0.52);
        });
    }

    function chevronTexture() {
        return canvasTex(64, 128, (g, w, h) => {
            g.fillStyle = '#1b1210'; g.fillRect(0, 0, w, h);
            g.strokeStyle = '#ff5a36'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';
            for (let k = 0; k < 2; k++) {
                const y = 26 + k * 52;
                g.beginPath(); g.moveTo(10, y + 20); g.lineTo(w / 2, y - 6); g.lineTo(w - 10, y + 20); g.stroke();
            }
        });
    }

    function bannerTexture(label = 'FINISH', accent = null) {
        return canvasTex(512, 128, (g, w, h) => {
            const s = 16;
            for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) {
                g.fillStyle = accent ? (((x + y) / s) % 2 ? accent : '#1a1208') : (((x + y) / s) % 2 ? '#f5f2ea' : '#111');
                g.fillRect(x, y, s, s);
            }
            g.fillStyle = 'rgba(13,13,16,.88)'; g.fillRect(56, 24, w - 112, h - 48);
            g.fillStyle = '#f5f2ea'; g.font = `800 ${label.length > 7 ? 44 : 58}px ${App.draw.FONT}`;
            g.textAlign = 'center'; g.textBaseline = 'middle';
            g.fillText(label, w / 2, h / 2 + 3);
        });
    }

    function itemTexture() {
        return canvasTex(128, 128, (g, w, h) => {
            g.fillStyle = '#ffb21e'; g.fillRect(0, 0, w, h);
            g.strokeStyle = '#fff3c4'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
            g.fillStyle = '#5a3b00'; g.font = `900 92px ${App.draw.FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
            g.fillText('?', w / 2, h / 2 + 6);
        });
    }

    /** Yo'l va devorlarning geometriyasi (har bir yuz o'z rangi bilan). */
    function trackGeometry(track) {
        const pos = [], col = [];
        const S = track.samples, W2 = WIDTH / 2;
        const color = new THREE.Color();
        const push = (a, b, c, d, clr) => {
            pos.push(...a, ...b, ...c, ...a, ...c, ...d);
            for (let k = 0; k < 6; k++) col.push(clr.r, clr.g, clr.b);
        };
        const edge = (s, side, up) => [
            s.p[0] + s.r[0] * W2 * side + s.u[0] * up,
            s.p[1] + s.r[1] * W2 * side + s.u[1] * up,
            s.p[2] + s.r[2] * W2 * side + s.u[2] * up,
        ];
        for (let i = 0; i < S.length - 1; i++) {
            const A = S[i], B = S[i + 1];
            if (B.gap) continue;
            const stripe = Math.floor(i / 6) % 2;
            const fin = B.tag === 'finish';
            // yo'l yuzasi
            color.set(fin ? (Math.floor(i / 3) % 2 ? 0xf5f2ea : 0x16161a)
                : B.tag === 'mud' ? (stripe ? 0x5a4630 : 0x4d3b28)
                : (stripe ? 0x34343f : 0x2a2a33));
            push(edge(A, -1, 0), edge(A, 1, 0), edge(B, 1, 0), edge(B, -1, 0), color);
            // devorlar
            color.setHSL((HUE[B.tag] || 210) / 360, 0.5, stripe ? 0.4 : 0.34);
            push(edge(A, -1, 0), edge(A, -1, WALL), edge(B, -1, WALL), edge(B, -1, 0), color);
            push(edge(A, 1, 0), edge(A, 1, WALL), edge(B, 1, WALL), edge(B, 1, 0), color);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        g.computeVertexNormals();
        return g;
    }

    /** Devor tepasidagi yorqin neon chiziq (bloom uni nur sochadigan qiladi). */
    function neonGeometry(track) {
        const pos = [], col = [];
        const S = track.samples, W2 = WIDTH / 2;
        const color = new THREE.Color();
        const pt = (s, side, k) => [
            s.p[0] + s.r[0] * W2 * side * k + s.u[0] * (WALL + 0.02),
            s.p[1] + s.r[1] * W2 * side * k + s.u[1] * (WALL + 0.02),
            s.p[2] + s.r[2] * W2 * side * k + s.u[2] * (WALL + 0.02),
        ];
        for (let i = 0; i < S.length - 1; i++) {
            const A = S[i], B = S[i + 1];
            if (B.gap) continue;
            color.setHSL((HUE[B.tag] || 210) / 360, 1, 0.62);
            for (const side of [-1, 1]) {
                const a0 = pt(A, side, 1), a1 = pt(A, side, 0.965), b0 = pt(B, side, 1), b1 = pt(B, side, 0.965);
                pos.push(...a0, ...a1, ...b1, ...a0, ...b1, ...b0);
                for (let k = 0; k < 6; k++) col.push(color.r, color.g, color.b);
            }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        return g;
    }

    function basisAt(s) {
        const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(...s.r), new THREE.Vector3(...s.u), new THREE.Vector3(...s.f));
        m.setPosition(s.p[0], s.p[1], s.p[2]);
        return m;
    }

    class World {
        constructor(track, people) {
            App.gl.init();
            this.track = track;
            const scene = (this.scene = new THREE.Scene());
            scene.background = new THREE.Color(BG);
            scene.fog = new THREE.Fog(BG, 38, 175);
            this.camera = new THREE.PerspectiveCamera(60, R / Hh, 0.3, 420);

            scene.add(new THREE.HemisphereLight(0xcfd6ff, 0x2a2438, 0.8));
            // quyosh: sharlar ortidan yurib, soya tushiradi
            const sun = (this.sun = new THREE.DirectionalLight(0xfff1dd, 0.95));
            sun.position.set(30, 80, 20);
            sun.castShadow = true;
            sun.shadow.mapSize.set(2048, 2048);
            const sc = sun.shadow.camera;
            sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 220;
            sun.shadow.bias = -0.0006;
            scene.add(sun, sun.target);

            // yo'l
            const road = new THREE.Mesh(trackGeometry(track), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
            road.receiveShadow = true;
            scene.add(road);
            scene.add(new THREE.Mesh(neonGeometry(track), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));

            // yulduzlar
            {
                const n = 700, p = new Float32Array(n * 3), mid0 = track.samples[track.samples.length >> 1].p;
                for (let i = 0; i < n; i++) {
                    p[i * 3] = mid0[0] + (Math.random() - 0.5) * 900;
                    p[i * 3 + 1] = track.minY + 40 + Math.random() * 260;
                    p[i * 3 + 2] = mid0[2] + (Math.random() - 0.5) * 900;
                }
                const sg = new THREE.BufferGeometry();
                sg.setAttribute('position', new THREE.BufferAttribute(p, 3));
                scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xbfc8ff, size: 1.6, sizeAttenuation: true, transparent: true, opacity: 0.8, fog: false })));
            }

            // ustunlar va yer
            const groundY = track.minY - 16;
            const posts = [];
            track.samples.forEach((s, i) => { if (i % 12 === 0 && !s.gap) posts.push(s); });
            const pillars = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.22, 1, 8), new THREE.MeshLambertMaterial({ color: 0x23232b }), posts.length);
            const m4 = new THREE.Matrix4();
            posts.forEach((s, i) => {
                const h = Math.max(0.5, s.p[1] - groundY - 0.1);
                m4.makeScale(1, h, 1).setPosition(s.p[0], groundY + h / 2, s.p[2]);
                pillars.setMatrixAt(i, m4);
            });
            scene.add(pillars);
            const mid = track.samples[track.samples.length >> 1].p;
            const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshBasicMaterial({ color: 0x0f0f13 }));
            ground.rotation.x = -Math.PI / 2;
            ground.position.set(mid[0], groundY, mid[2]);
            scene.add(ground);
            const grid = new THREE.GridHelper(1400, 140, 0x23232b, 0x17171c);
            grid.position.set(mid[0], groundY + 0.03, mid[2]);
            scene.add(grid);

            // boosterlar
            const chev = chevronTexture();
            chev.wrapT = THREE.RepeatWrapping;
            for (const p of track.boosters) {
                const fr = track.samples[Math.round(p.s / DS)];
                const mesh = new THREE.Mesh(new THREE.BoxGeometry(p.w * 1.9, 0.06, 2.2), new THREE.MeshBasicMaterial({ map: chev }));
                const grp = new THREE.Group();
                mesh.position.set(p.x, 0.05, 0);
                grp.add(mesh);
                grp.matrixAutoUpdate = false;
                grp.matrix.copy(basisAt(fr));
                scene.add(grp);
            }
            // to'siqlar
            for (const b of track.bumpers) {
                const fr = track.samples[Math.round(b.s / DS)];
                const mesh = new THREE.Mesh(new THREE.CylinderGeometry(b.r, b.r, 1.2, 20), new THREE.MeshLambertMaterial({ color: 0xf5f2ea }));
                mesh.position.set(b.x, 0.6, 0);
                const ring = new THREE.Mesh(new THREE.CylinderGeometry(b.r + 0.02, b.r + 0.02, 0.18, 20), new THREE.MeshBasicMaterial({ color: 0xff5a36 }));
                ring.position.set(b.x, 1.05, 0);
                const grp = new THREE.Group();
                grp.add(mesh, ring);
                grp.matrixAutoUpdate = false;
                grp.matrix.copy(basisAt(fr));
                scene.add(grp);
            }
            // marra darvozasi
            const F = track.samples[Math.round(track.finishS / DS)];
            const arch = new THREE.Group();
            const postGeo = new THREE.BoxGeometry(0.4, 5.6, 0.4), postMat = new THREE.MeshLambertMaterial({ color: 0xf5f2ea });
            for (const side of [-1, 1]) {
                const post = new THREE.Mesh(postGeo, postMat);
                post.position.set(side * (WIDTH / 2 + 0.2), 2.8, 0);
                arch.add(post);
            }
            const banner = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH + 0.8, 1.6), new THREE.MeshBasicMaterial({ map: bannerTexture(), side: THREE.DoubleSide }));
            banner.position.set(0, 5.4, 0);
            banner.rotation.y = Math.PI;
            arch.add(banner);
            // old tomondan ham to'g'ri o'qilsin: orqa yuziga ikkinchi nusxa
            const banner2 = banner.clone(); banner2.rotation.y = 0; banner2.position.z = 0.02; arch.add(banner2);
            arch.matrixAutoUpdate = false;
            arch.matrix.copy(basisAt(F));
            scene.add(arch);

            // nazorat nuqtalari (saralash): to'q sariq darvozalar
            for (const cs of track.checkpoints) {
                const Fc = track.samples[Math.round(cs / DS)];
                const g2 = new THREE.Group();
                const pm = new THREE.MeshBasicMaterial({ color: 0xffa23a });
                for (const side of [-1, 1]) { const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 5.2, 0.35), pm); p2.position.set(side * (WIDTH / 2 + 0.2), 2.6, 0); g2.add(p2); }
                const bn = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH + 0.8, 1.4), new THREE.MeshBasicMaterial({ map: bannerTexture('CHECKPOINT', '#ff8a1e'), side: THREE.DoubleSide }));
                bn.position.set(0, 5.1, 0); bn.rotation.y = Math.PI; g2.add(bn);
                const bn2 = bn.clone(); bn2.rotation.y = 0; bn2.position.z = 0.02; g2.add(bn2);
                g2.matrixAutoUpdate = false; g2.matrix.copy(basisAt(Fc)); scene.add(g2);
            }

            // harakatlanuvchi to'siqlar (har kadrda yon tomonga suriladi)
            this.moverMeshes = track.movers.map((m) => {
                const fr = track.samples[Math.round(m.s / DS)];
                const grp = new THREE.Group();
                const body = new THREE.Mesh(new THREE.CylinderGeometry(m.r, m.r, 1.3, 20), new THREE.MeshLambertMaterial({ color: 0xe8452a }));
                body.position.y = 0.65; body.castShadow = true;
                const cap = new THREE.Mesh(new THREE.CylinderGeometry(m.r + 0.04, m.r + 0.04, 0.2, 20), new THREE.MeshBasicMaterial({ color: 0xffe27a }));
                cap.position.y = 1.2;
                grp.add(body, cap);
                grp.matrixAutoUpdate = false;
                grp.userData = { base: basisAt(fr), m };
                scene.add(grp);
                return grp;
            });

            // sovg'a qutilari: aylanib turuvchi "?" kublar
            const itemTex = itemTexture();
            this.itemMeshes = track.items.map((it) => {
                const fr = track.samples[Math.round(it.s / DS)];
                const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.25, 1.25), new THREE.MeshBasicMaterial({ map: itemTex }));
                const grp = new THREE.Group();
                grp.add(mesh);
                grp.matrixAutoUpdate = false;
                grp.userData = { base: basisAt(fr), it, mesh };
                grp.matrix.copy(grp.userData.base);
                scene.add(grp);
                return grp;
            });
            this.fxMeshes = [];   // raketalar va moy dog'lari

            // sharlar
            this.balls = people.map((p) => {
                const col = new THREE.Color().setHSL(p.hue / 360, 0.7, 0.5);
                const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 28, 18), new THREE.MeshStandardMaterial({ map: ballTexture(p), roughness: 0.3, metalness: 0.15, emissive: col, emissiveIntensity: 0.18 }));
                mesh.castShadow = true;
                // qalqon: sharni o'rab turuvchi shaffof pufak
                const bub = new THREE.Mesh(new THREE.SphereGeometry(0.85, 20, 14), new THREE.MeshBasicMaterial({ color: 0x6ad8ff, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending }));
                bub.visible = false; scene.add(bub);
                mesh.userData.bubble = bub;
                scene.add(mesh);
                return mesh;
            });
            // sharlar izi: so'nib boruvchi yorqin nuqtalar
            this.TRAIL = 22;
            this.trails = people.map((p) => {
                const n = this.TRAIL, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
                const c = new THREE.Color().setHSL(p.hue / 360, 0.9, 0.6);
                for (let i = 0; i < n; i++) { const f = 1 - i / n; col[i * 3] = c.r * f; col[i * 3 + 1] = c.g * f; col[i * 3 + 2] = c.b * f; }
                const g = new THREE.BufferGeometry();
                g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
                g.setAttribute('color', new THREE.BufferAttribute(col, 3));
                const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.55, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
                pts.frustumCulled = false;
                scene.add(pts);
                return { g, pos, first: true };
            });
            this._q = new THREE.Quaternion();
            this._ax = new THREE.Vector3();
        }

        placeBall(i, pos, frame, spin, glow) {
            const m = this.balls[i];
            m.position.set(pos[0], pos[1], pos[2]);
            this._ax.set(frame.r[0], frame.r[1], frame.r[2]);
            this._q.setFromAxisAngle(this._ax, spin);
            m.quaternion.premultiply(this._q);
            const sc = 1 + glow * 0.35;
            m.scale.set(sc, sc, sc);
            // iz: eski nuqtalarni surib, boshiga yangisini qo'yamiz
            const t = this.trails[i], P = t.pos;
            if (t.first) { for (let k = 0; k < this.TRAIL; k++) { P[k * 3] = pos[0]; P[k * 3 + 1] = pos[1]; P[k * 3 + 2] = pos[2]; } t.first = false; }
            else { P.copyWithin(3, 0, (this.TRAIL - 1) * 3); P[0] = pos[0]; P[1] = pos[1]; P[2] = pos[2]; }
            t.g.attributes.position.needsUpdate = true;
        }

        /** Har kadr: harakatlanuvchi to'siqlar, sovg'a qutilari, qalqonlar, raketalar, moy dog'lari. */
        updateDynamic(race, dt) {
            const t = race.time, M = new THREE.Matrix4(), T = new THREE.Matrix4();
            for (const g of this.moverMeshes) {
                const m = g.userData.m;
                T.makeTranslation(race.moverX(m), 0, 0);
                g.matrix.copy(g.userData.base).multiply(T);
                g.matrixWorldNeedsUpdate = true;
            }
            for (const g of this.itemMeshes) {
                const { it, mesh } = g.userData;
                g.visible = race.time >= it.next;
                mesh.rotation.y = t * 2.2; mesh.rotation.x = Math.sin(t * 1.6) * 0.3;
                mesh.position.set(it.x, 1.1 + Math.sin(t * 3 + it.s) * 0.15, 0);
                g.matrixWorldNeedsUpdate = true;
            }
            race.balls.forEach((b, i) => {
                const m = this.balls[i];
                m.visible = !b.elim || (race.time - b.elimTime) < 0.15;
                this.trails[i].g.setDrawRange(0, b.elim ? 0 : this.TRAIL);
                const bub = m.userData.bubble;
                bub.visible = b.shield && !b.elim;
                if (bub.visible) { bub.position.copy(m.position); bub.scale.setScalar(1 + Math.sin(t * 8 + i) * 0.04); }
            });
            // vaqtinchalik effektlar
            for (let i = this.fxMeshes.length - 1; i >= 0; i--) {
                const f = this.fxMeshes[i]; f.t += dt;
                if (f.kind === 'rocket') {
                    const k = Math.min(1, f.t / f.dur);
                    f.mesh.position.lerpVectors(f.a, f.b, k); f.mesh.position.y += Math.sin(k * Math.PI) * 1.2;
                    if (k >= 1) this._dropFx(i);
                } else if (f.kind === 'slick') {
                    const left = 10 - f.t;
                    f.mesh.material.opacity = Math.max(0, Math.min(0.75, left / 2));
                    if (left <= 0) this._dropFx(i);
                }
            }
        }

        _dropFx(i) { const f = this.fxMeshes[i]; this.scene.remove(f.mesh); f.mesh.geometry.dispose(); f.mesh.material.dispose(); this.fxMeshes.splice(i, 1); }

        /** Raketa: A nuqtadan B nuqtaga uchib boradi (faqat ko'rinish). */
        addRocket(a, b) {
            const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff8a2a }));
            mesh.position.set(a[0], a[1], a[2]); this.scene.add(mesh);
            this.fxMeshes.push({ kind: 'rocket', mesh, t: 0, dur: 0.45, a: new THREE.Vector3(a[0], a[1], a[2]), b: new THREE.Vector3(b[0], b[1], b[2]) });
        }

        /** To'kilgan moy: yo'l ustida qora yaltiroq dog'. */
        addSlick(s, len) {
            const fr = this.track.samples[Math.round(s / DS)];
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH - 0.4, len), new THREE.MeshBasicMaterial({ color: 0x05060a, transparent: true, opacity: 0.75, depthWrite: false }));
            const m4 = basisAt(fr);
            const rot = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
            mesh.matrixAutoUpdate = false;
            mesh.matrix.copy(m4).multiply(new THREE.Matrix4().makeTranslation(0, 0.07, 0)).multiply(rot);
            this.scene.add(mesh);
            this.fxMeshes.push({ kind: 'slick', mesh, t: 0 });
        }

        /** Soya va yorug'likni peshqadam yoniga ko'chiradi. */
        setFocus(pos) {
            this.sun.target.position.set(pos[0], pos[1], pos[2]);
            this.sun.position.set(pos[0] + 22, pos[1] + 48, pos[2] + 14);
        }

        render(bloom) { App.gl.render(this.scene, this.camera, { bloom }); }

        /** Kamera ekranidagi nuqta (piksel) yoki null. */
        project(pos) {
            const v = new THREE.Vector3(pos[0], pos[1], pos[2]).project(this.camera);
            if (v.z > 1 || v.z < -1) return null;
            return { x: (v.x * 0.5 + 0.5) * R, y: (-v.y * 0.5 + 0.5) * Hh, depth: v.z };
        }

        dispose() {
            this.scene.traverse((o) => {
                if (o.geometry) o.geometry.dispose();
                if (o.material) {
                    const mats = Array.isArray(o.material) ? o.material : [o.material];
                    mats.forEach(mt => { if (mt.map) mt.map.dispose(); mt.dispose(); });
                }
            });
            if (this.scene.children.length) this.scene.remove(...this.scene.children);
        }
    }

    /** Kamera: ortidan / uzoqdan / kino (rejimlar almashib turadi). */
    class CameraRig {
        constructor(world, rail) {
            this.world = world;
            this.rail = rail;
            this.pos = new THREE.Vector3();
            this.look = new THREE.Vector3();
            this.first = true;
            this.f = NS.Rail.frame();
            this.wp = [0, 0, 0];
        }

        _target(mode, race, tick) {
            const lead = race.leader, rail = this.rail, f = this.f;
            race.worldPos(lead, this.wp, NS.Rail.frame());
            const L = new THREE.Vector3(this.wp[0], this.wp[1], this.wp[2]);
            let variant = mode;
            if (mode === 'cinema') variant = ['chase', 'side', 'chase', 'front', 'pack'][Math.floor(tick / 300) % 5];
            if (this.force) variant = this.force; // marra paytida kino kadr

            let pos, look = L.clone();
            // sharlar qanchalik yoyilgan bo'lsa, kamera shuncha uzoqlashadi — hammasi kadrda qolsin
            let avg = 0;
            for (const b of race.balls) avg += b.s;
            avg /= race.balls.length;
            const spread = Math.min(40, Math.max(0, lead.s - avg));
            if (variant === 'chase') {
                const back = 13 + spread * 0.7, hgt = 4.6 + spread * 0.22;
                rail.at(lead.s - back, f);
                pos = new THREE.Vector3(f.p[0] + f.u[0] * 2.4 + f.r[0] * lead.x * 0.4, f.p[1] + hgt + f.r[1] * lead.x * 0.4, f.p[2] + f.u[2] * 2.4 + f.r[2] * lead.x * 0.4);
                rail.at(lead.s, f);
                look.add(new THREE.Vector3(f.f[0], f.f[1], f.f[2]).multiplyScalar(Math.max(2, 9 - spread * 0.25)));
            } else if (variant === 'pack') {
                rail.at(lead.s - 20 - spread * 0.7, f);
                pos = new THREE.Vector3(f.p[0], f.p[1] + 11 + spread * 0.25, f.p[2]);
                rail.at(lead.s, f);
                look.add(new THREE.Vector3(f.f[0], f.f[1], f.f[2]).multiplyScalar(2));
            } else if (variant === 'side') {
                rail.at(lead.s + 3, f);
                const side = (Math.floor(tick / 300) % 2) ? 1 : -1;
                pos = new THREE.Vector3(f.p[0] + f.r[0] * 9 * side, f.p[1] + 2.6 + f.r[1] * 9 * side, f.p[2] + f.r[2] * 9 * side);
            } else { // front
                rail.at(lead.s + 12, f);
                pos = new THREE.Vector3(f.p[0], f.p[1] + 2.2, f.p[2]);
            }
            return { pos, look };
        }

        update(mode, race, tick) {
            const t = this._target(mode, race, tick);
            if (this.first) { this.pos.copy(t.pos); this.look.copy(t.look); this.first = false; }
            this.pos.lerp(t.pos, 0.09);
            this.look.lerp(t.look, 0.16);
            const cam = this.world.camera;
            cam.position.copy(this.pos);
            cam.up.set(0, 1, 0);
            cam.lookAt(this.look);
            // tezlikka qarab ko'rish burchagi kengayadi (tezlik hissi)
            const lead = race.leader;
            const fovT = 58 + Math.min(1, Math.max(0, (lead.v - 16) / 26)) * 16 + (lead.glow > 0 ? 5 : 0);
            cam.fov += (fovT - cam.fov) * 0.06;
            cam.updateProjectionMatrix();
        }
    }

    NS.World = World;
    NS.CameraRig = CameraRig;
    NS.glCanvas = () => App.gl.init().canvas;
})(window.App = window.App || {});
