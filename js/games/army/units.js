/* games/army/units.js — jangchilar modeli va animatsiyasi (three.js).
 * Inson nisbatlari: bo'y ~2.0, 4 bo'g'inli qo'l (yelka+tirsak), oyoq, etik, zirh. Qurol qo'lda to'g'ri ushlanadi:
 * qilich pichog'i yuqoriga qaragan, hujumda tepadan pastga zarba beradi. */
(function (App) {
    'use strict';
    const NS = (App.army = App.army || {});
    const TEAM = [0xe8452a, 0x3b78e8];
    const SKINS = [0xf0cfa8, 0xdcae86, 0xbd8760, 0x8f5d3d];

    const L = (c, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o));
    const P = (c) => new THREE.MeshPhongMaterial({ color: c, shininess: 80, specular: 0x8a8f99 });
    const B = (c) => new THREE.MeshBasicMaterial({ color: c });

    const GEO = {
        box: new THREE.BoxGeometry(1, 1, 1),
        sph: new THREE.SphereGeometry(1, 14, 10),
        cone: new THREE.ConeGeometry(1, 1, 12),
        cyl: new THREE.CylinderGeometry(1, 1, 1, 14),
        tor: new THREE.TorusGeometry(1, 0.06, 6, 24),
    };
    NS.GEO = GEO;

    function part(parent, geo, mat, x, y, z, sx, sy, sz) {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true;
        parent.add(m);
        return m;
    }
    const joint = (parent, x, y, z) => { const j = new THREE.Group(); j.position.set(x, y, z); parent.add(j); return j; };
    const smooth = (t) => t * t * (3 - 2 * t);

    /** Qo'l: yelka -> tirsak. Qaytaradi {sh, el}. Qo'lning uchida (tirsak lokal y=-0.32) kaft turadi. */
    function arm(parent, side, sleeve, skin, glove) {
        const sh = joint(parent, side * 0.35, 1.58, 0);
        part(sh, GEO.box, sleeve, 0, -0.16, 0, 0.13, 0.34, 0.13);
        const el = joint(sh, 0, -0.32, 0);
        part(el, GEO.box, sleeve === skin ? skin : (glove || sleeve), 0, -0.15, 0, 0.11, 0.3, 0.11);
        part(el, GEO.sph, glove || skin, 0, -0.33, 0, 0.065, 0.065, 0.065);
        return { sh, el };
    }

    function unitMesh(u) {
        const g = new THREE.Group();
        const tc = TEAM[u.team];
        const skin = L(SKINS[u.id % SKINS.length]);
        const cloth = L(tc), clothD = L(new THREE.Color(tc).multiplyScalar(0.6).getHex());
        const steel = P(0xc3cad6), steelD = P(0x7d8696);
        const leather = L(0x5a3b22), leatherD = L(0x3a2616);
        const white = L(0xf3efe7);
        const mats = [skin, cloth, clothD, steel, steelD, leather, leatherD, white];
        const ud = (g.userData = { mats, horseLegs: [] });
        const rider = (ud.rider = new THREE.Group()); g.add(rider);

        const cls = u.cls;
        const pantsMat = cls === 'archer' ? L(0x35502f) : cls === 'healer' ? white : cls === 'knight' || cls === 'cavalry' ? leatherD : L(0x3d342c);
        mats.push(pantsMat);
        const shirt = cls === 'archer' ? L(0x4a7a42) : cls === 'healer' ? white : cls === 'mage' ? L(0x4a37b8) : cloth;
        mats.push(shirt);

        // oyoqlar (etik bilan)
        ud.legL = joint(rider, -0.12, 0.98, 0); ud.legR = joint(rider, 0.12, 0.98, 0);
        for (const lg of [ud.legL, ud.legR]) {
            part(lg, GEO.box, pantsMat, 0, -0.4, 0, 0.17, 0.8, 0.2);
            part(lg, GEO.box, leatherD, 0, -0.86, 0.03, 0.19, 0.24, 0.32);
        }
        // tos, tana, bo'yin, bosh
        part(rider, GEO.box, leatherD, 0, 1.0, 0, 0.44, 0.1, 0.28);                       // kamar
        part(rider, GEO.box, shirt, 0, 1.33, 0, 0.5, 0.64, 0.3);                          // tana
        part(rider, GEO.cyl, skin, 0, 1.7, 0, 0.065, 0.1, 0.065);                         // bo'yin
        const head = part(rider, GEO.sph, skin, 0, 1.87, 0.01, 0.135, 0.16, 0.145);
        part(rider, GEO.sph, B(0x17110d), -0.055, 1.89, 0.13, 0.02, 0.026, 0.02);          // ko'zlar
        part(rider, GEO.sph, B(0x17110d), 0.055, 1.89, 0.13, 0.02, 0.026, 0.02);
        part(rider, GEO.sph, L(0x2c1d12), 0, 1.99, -0.01, 0.145, 0.1, 0.15);               // soch
        ud.head = head;

        // qo'llar
        const sleeve = cls === 'knight' || cls === 'cavalry' ? steelD : cls === 'mage' ? L(0x4a37b8) : cls === 'healer' ? white : cls === 'archer' ? L(0x4a7a42) : skin;
        mats.push(sleeve);
        const glove = cls === 'knight' || cls === 'cavalry' ? steel : cls === 'archer' ? leather : skin;
        const R = arm(rider, 1, sleeve, skin, glove), Lf = arm(rider, -1, sleeve, skin, glove);
        ud.armR = R.sh; ud.elbowR = R.el; ud.armL = Lf.sh; ud.elbowL = Lf.el;

        if (cls === 'knight' || cls === 'cavalry') {
            part(rider, GEO.box, steel, 0, 1.4, 0.02, 0.5, 0.36, 0.33);                   // ko'krak zirhi
            part(rider, GEO.box, steelD, 0, 1.13, 0.01, 0.46, 0.18, 0.31);                // qorin plastinalari
            part(rider, GEO.box, cloth, 0, 0.78, 0.17, 0.3, 0.52, 0.03);                  // tabard (old)
            part(rider, GEO.box, cloth, 0, 0.78, -0.17, 0.3, 0.52, 0.03);                 // tabard (orqa)
            for (const s of [-1, 1]) part(rider, GEO.sph, steel, s * 0.37, 1.62, 0, 0.13, 0.085, 0.13); // yelka zirhi
            part(rider, GEO.sph, steel, 0, 1.9, 0, 0.17, 0.19, 0.17);                      // dubulg'a
            part(rider, GEO.box, steelD, 0, 1.86, 0.15, 0.2, 0.04, 0.03);                   // ko'zoynak
            part(rider, GEO.box, steelD, 0, 1.93, 0.17, 0.03, 0.17, 0.02);                  // burun himoyasi
            part(rider, GEO.box, cloth, 0, 2.1, -0.02, 0.04, 0.16, 0.34);                   // par
            part(rider, GEO.box, cloth, 0, 1.2, -0.2, 0.46, 0.9, 0.04);                     // plash
            if (cls === 'knight') {
                // qalqon chap qo'lda
                const sh = part(ud.elbowL, GEO.cyl, steel, 0, -0.14, 0.17, 0.27, 0.035, 0.27); sh.rotation.x = Math.PI / 2;
                const em = part(ud.elbowL, GEO.cyl, cloth, 0, -0.14, 0.2, 0.15, 0.03, 0.15); em.rotation.x = Math.PI / 2;
                part(ud.elbowL, GEO.sph, steelD, 0, -0.14, 0.22, 0.05, 0.05, 0.05);
            }
        }
        if (cls === 'knight') {
            // qilich o'ng qo'lda: pichoq tirsak lokal +z da (tirsak bukilganda yuqoriga qaraydi)
            const sw = (ud.weapon = joint(ud.elbowR, 0, -0.32, 0));
            part(sw, GEO.box, P(0xeef2f8), 0, 0, 0.5, 0.05, 0.012, 0.86);                  // pichoq
            part(sw, GEO.box, steelD, 0, 0, 0.08, 0.22, 0.035, 0.04);                       // himoya
            part(sw, GEO.box, leather, 0, 0, -0.02, 0.04, 0.04, 0.18);                      // dasta
            part(sw, GEO.sph, steelD, 0, 0, -0.12, 0.045, 0.045, 0.045);
        } else if (cls === 'cavalry') {
            const sw = (ud.weapon = joint(ud.elbowR, 0, -0.32, 0));
            part(sw, GEO.cyl, L(0xe0d6c0), 0, 0, 0.8, 0.03, 1.9, 0.03).rotation.x = Math.PI / 2;   // nayza (o'qi z bo'ylab)
            part(sw, GEO.cone, P(0xf2f4f8), 0, 0, 1.85, 0.06, 0.28, 0.06).rotation.x = Math.PI / 2;
            part(sw, GEO.box, cloth, 0.1, 0, 1.55, 0.02, 0.2, 0.34);                         // bayroqcha
        } else if (cls === 'archer') {
            part(rider, GEO.cone, L(0x2d5a33), 0, 2.02, -0.02, 0.17, 0.3, 0.17);            // qalpoq uchi
            part(rider, GEO.sph, L(0x2d5a33), 0, 1.93, -0.04, 0.17, 0.15, 0.17);             // qalpoq
            part(rider, GEO.box, L(0x2d5a33), 0, 1.15, -0.19, 0.46, 0.8, 0.04);              // plash
            part(rider, GEO.box, leather, 0, 1.33, 0.16, 0.5, 0.5, 0.02);                     // charm kamzul
            part(rider, GEO.box, leatherD, 0, 1.3, 0.0, 0.06, 0.7, 0.34).rotation.z = 0.7;    // kamar-bog'ich
            const q = part(rider, GEO.cyl, leather, 0.12, 1.36, -0.24, 0.07, 0.5, 0.07); q.rotation.z = 0.2;   // o'q qini
            for (let i = 0; i < 4; i++) part(rider, GEO.cyl, white, 0.15 + i * 0.015, 1.66, -0.24 + (i - 1.5) * 0.02, 0.012, 0.16, 0.012);
            // kamon chap qo'lda (vertikal, yoyi oldinga)
            const bow = part(ud.elbowL, GEO.tor, L(0x8a5a2b), 0, -0.32, 0, 0.55, 0.55, 0.55);
            bow.rotation.set(0, -Math.PI / 2, -Math.PI / 2);
            ud.weapon = bow;
        } else if (cls === 'mage') {
            part(rider, GEO.cone, L(0x4a37b8), 0, 0.78, 0, 0.45, 1.25, 0.4);                  // uzun to'n
            part(rider, GEO.box, L(0xd8b23a), 0, 1.0, 0, 0.46, 0.07, 0.32);                   // kamar
            part(rider, GEO.cone, L(0x4a37b8), 0, 2.2, 0, 0.19, 0.55, 0.19);                  // shlyapa
            part(rider, GEO.cyl, L(0x372990), 0, 2.0, 0, 0.3, 0.03, 0.3);                     // hoshiya
            const beard = part(rider, GEO.cone, white, 0, 1.72, 0.1, 0.09, 0.3, 0.07); beard.rotation.x = Math.PI;
            const staff = (ud.weapon = joint(ud.elbowR, 0, -0.32, 0));
            part(staff, GEO.cyl, L(0x6b4a2a), 0, 0.3, 0, 0.03, 1.7, 0.03);
            ud.glow = part(staff, GEO.sph, B(0xffa23a), 0, 1.2, 0, 0.12, 0.12, 0.12);
        } else if (cls === 'healer') {
            part(rider, GEO.cone, white, 0, 0.75, 0, 0.42, 1.25, 0.38);
            part(rider, GEO.cone, white, 0, 1.97, -0.03, 0.17, 0.3, 0.17);                    // qalpoq
            part(rider, GEO.sph, white, 0, 1.93, -0.04, 0.16, 0.14, 0.16);
            part(rider, GEO.box, B(0x4dff88), 0, 1.4, 0.16, 0.2, 0.05, 0.02);                 // xoch
            part(rider, GEO.box, B(0x4dff88), 0, 1.4, 0.16, 0.05, 0.2, 0.02);
            part(rider, GEO.box, cloth, 0, 1.0, 0, 0.46, 0.07, 0.32);
            const staff = (ud.weapon = joint(ud.elbowR, 0, -0.32, 0));
            part(staff, GEO.cyl, L(0xd8c58a), 0, 0.3, 0, 0.03, 1.6, 0.03);
            ud.glow = part(staff, GEO.sph, B(0x4dff88), 0, 1.15, 0, 0.11, 0.11, 0.11);
            const halo = part(rider, GEO.tor, B(0x8dffb0), 0, 2.2, 0, 0.26, 0.26, 0.26); halo.rotation.x = Math.PI / 2; ud.halo = halo;
        }

        if (cls === 'cavalry') {
            // ot
            const horse = (ud.horse = new THREE.Group()); g.add(horse);
            const hc = L(0x7b5233), hd = L(0x3a2616);
            const barrel = part(horse, GEO.cyl, hc, 0, 1.0, 0, 0.34, 1.3, 0.34); barrel.rotation.x = Math.PI / 2;
            part(horse, GEO.sph, hc, 0, 1.03, 0.62, 0.4, 0.42, 0.4);                           // ko'krak
            part(horse, GEO.sph, hc, 0, 1.03, -0.6, 0.38, 0.4, 0.4);                           // dumba
            const neck = part(horse, GEO.box, hc, 0, 1.45, 0.92, 0.22, 0.7, 0.3); neck.rotation.x = -0.55;
            const hd2 = part(horse, GEO.box, hc, 0, 1.72, 1.3, 0.17, 0.2, 0.52); hd2.rotation.x = 0.5;
            part(horse, GEO.box, hd, 0, 1.64, 1.55, 0.14, 0.15, 0.14);                          // tumshuq
            for (const s of [-1, 1]) part(horse, GEO.cone, hc, s * 0.07, 1.88, 1.15, 0.03, 0.12, 0.03);
            const mane = part(horse, GEO.box, hd, 0, 1.55, 0.78, 0.05, 0.62, 0.1); mane.rotation.x = -0.55;
            const tail = part(horse, GEO.box, hd, 0, 0.95, -0.95, 0.07, 0.62, 0.1); tail.rotation.x = 0.35;
            part(horse, GEO.box, cloth, 0, 1.38, -0.05, 0.62, 0.05, 0.62);                      // to'shak (jamoa rangida)
            part(horse, GEO.box, leather, 0, 1.4, -0.05, 0.3, 0.06, 0.34);                      // egar
            for (const [x, z] of [[-0.2, -0.55], [0.2, -0.55], [-0.2, 0.55], [0.2, 0.55]]) {
                const hip = joint(horse, x, 0.82, z); part(hip, GEO.box, hc, 0, -0.2, 0, 0.14, 0.42, 0.14);
                const knee = joint(hip, 0, -0.4, 0); part(knee, GEO.box, hc, 0, -0.2, 0, 0.1, 0.4, 0.1); part(knee, GEO.box, hd, 0, -0.42, 0, 0.12, 0.08, 0.14);
                ud.horseLegs.push({ hip, knee });
            }
            rider.position.y = 0.72;
            ud.legL.rotation.x = 1.25; ud.legR.rotation.x = 1.25;
        }
        return g;
    }

    /** Har kadr: yurish, hujum va tinch holat animatsiyasi. */
    function animate(u, m, T, hit, moving) {
        const ud = m.userData, cls = u.cls;
        const ph = T * (cls === 'cavalry' ? 12 : 9) + u.id * 1.7;
        const sw = Math.sin(ph) * 0.8 * moving;
        const t = 1 - hit;                                            // hujumda 0 -> 1

        if (cls === 'cavalry') {
            ud.horseLegs.forEach((l, i) => {
                const o = (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0);
                l.hip.rotation.x = Math.sin(ph + o) * 0.75 * moving;
                l.knee.rotation.x = Math.max(0, -Math.sin(ph + o)) * 1.1 * moving;
            });
            ud.rider.position.y = 0.72 + Math.abs(Math.sin(ph)) * 0.07 * moving;
        } else if (cls !== 'mage' && cls !== 'healer') {
            ud.legL.rotation.x = sw; ud.legR.rotation.x = -sw;
            ud.rider.position.y = Math.abs(Math.sin(ph)) * 0.05 * moving;
        } else {
            ud.rider.position.y = Math.abs(Math.sin(ph)) * 0.05 * moving;
        }

        let twist = 0;
        if (cls === 'knight') {
            // tinch: qilich yuqorida, qalqon oldinda. Hujum: tepadan pastga chopadi.
            if (hit > 0) {
                ud.armR.rotation.x = -2.55 + 2.2 * smooth(t); ud.elbowR.rotation.x = -0.5 - 0.5 * t;
                twist = (0.5 - t) * 0.5;
            } else { ud.armR.rotation.x = -0.35 - sw * 0.15; ud.elbowR.rotation.x = -1.3; }
            ud.armL.rotation.x = -0.45 + sw * 0.1; ud.elbowL.rotation.x = -1.1;
        } else if (cls === 'cavalry') {
            ud.armR.rotation.x = -1.3 - hit * 0.35; ud.elbowR.rotation.x = -0.15;
            ud.armL.rotation.x = -0.7; ud.elbowL.rotation.x = -0.9;
        } else if (cls === 'archer') {
            ud.armL.rotation.x = -1.5; ud.elbowL.rotation.x = -0.05;
            if (hit > 0) { ud.armR.rotation.x = -1.45; ud.elbowR.rotation.x = -2.5 * hit - 0.2; } else { ud.armR.rotation.x = -0.4 - sw * 0.2; ud.elbowR.rotation.x = -0.7; }
            twist = hit * -0.25;
        } else if (cls === 'mage' || cls === 'healer') {
            ud.armR.rotation.x = -0.25 - hit * 0.5; ud.elbowR.rotation.x = -0.5;
            ud.armL.rotation.x = -0.5 - hit * 1.5 - sw * 0.1; ud.elbowL.rotation.x = -0.9 - hit * 0.3;
            if (ud.glow) ud.glow.scale.setScalar(0.12 * (1 + Math.sin(T * 6 + u.id) * 0.18 + hit * 0.8));
            if (ud.halo) { ud.halo.rotation.z = T * 2; ud.halo.scale.setScalar(0.26 + hit * 0.1); }
        }
        ud.rider.rotation.y = twist;
        // tayoq doim tik turadi (qo'l og'sa ham)
        if ((cls === 'mage' || cls === 'healer') && ud.weapon) ud.weapon.rotation.x = -(ud.armR.rotation.x + ud.elbowR.rotation.x);
        // nayza oldinga gorizontal (biroz pastga), hujumda oldinga otiladi
        if (cls === 'cavalry' && ud.weapon) ud.weapon.rotation.x = -(ud.armR.rotation.x + ud.elbowR.rotation.x) + 0.12 - hit * 0.1;
    }

    NS.unitMesh = unitMesh;
    NS.animateUnit = animate;
    NS.UNIT_BASE = { knight: 1.0, archer: 0.96, mage: 1.0, healer: 0.96, cavalry: 0.62 };
})(window.App = window.App || {});
