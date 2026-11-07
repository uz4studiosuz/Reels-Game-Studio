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
        const pantsMat = cls === 'archer' ? L(0x35502f) :
            cls === 'healer' ? white :
            cls === 'knight' || cls === 'cavalry' ? leatherD :
            cls === 'dark_knight' ? P(0x121316) :
            cls === 'builder' ? L(0x28436b) :
            cls === 'programmer' ? L(0x1e222d) :
            cls === 'banker' ? L(0x18191c) :
            cls === 'commander' ? L(0x202924) :
            cls === 'king' || cls === 'king_father' ? L(0x24142e) :
            cls === 'giant' ? leather : L(0x3d342c);
        mats.push(pantsMat);

        const shirt = cls === 'archer' ? L(0x4a7a42) :
            cls === 'healer' ? white :
            cls === 'mage' ? L(0x4a37b8) :
            cls === 'dark_knight' ? P(0x18191e) :
            cls === 'builder' ? L(0xed6c02) :
            cls === 'programmer' ? L(0x2e384d) :
            cls === 'banker' ? L(0x22242a) :
            cls === 'commander' ? L(0x2f3e36) :
            cls === 'king' ? L(0x8b152b) :
            cls === 'king_father' ? L(0x5a189a) :
            cls === 'blogger' ? cloth :
            cls === 'giant' ? skin : cloth;
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
        const sleeve = (cls === 'knight' || cls === 'cavalry') ? steelD :
            cls === 'dark_knight' ? P(0x15161a) :
            cls === 'mage' ? L(0x4a37b8) :
            cls === 'healer' ? white :
            cls === 'archer' ? L(0x4a7a42) :
            cls === 'builder' ? L(0xed6c02) :
            cls === 'programmer' ? L(0x2e384d) :
            cls === 'banker' ? L(0x22242a) :
            cls === 'commander' ? L(0x2f3e36) :
            cls === 'king' ? P(0xd4af37) :
            cls === 'king_father' ? L(0x5a189a) : skin;
        mats.push(sleeve);
        const glove = (cls === 'knight' || cls === 'cavalry') ? steel :
            cls === 'dark_knight' ? P(0x1a1a20) :
            cls === 'king' ? P(0xffd700) :
            cls === 'builder' ? leather :
            cls === 'archer' ? leather : skin;
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
        } else if (cls === 'king') {
            part(rider, GEO.cyl, P(0xffd700), 0, 2.05, 0, 0.16, 0.08, 0.16);
            for (let i = 0; i < 5; i++) {
                const a = i * Math.PI * 2 / 5;
                part(rider, GEO.cone, P(0xffd700), Math.cos(a) * 0.13, 2.14, Math.sin(a) * 0.13, 0.035, 0.11, 0.035);
            }
            for (const s of [-1, 1]) part(rider, GEO.sph, P(0xffd700), s * 0.38, 1.62, 0, 0.14, 0.09, 0.14);
            part(rider, GEO.box, cloth, 0, 1.25, -0.2, 0.48, 0.95, 0.05);
            part(rider, GEO.box, white, 0, 1.68, -0.15, 0.52, 0.12, 0.14);
            part(rider, GEO.box, P(0xd4af37), 0, 1.4, 0.02, 0.5, 0.36, 0.33);
            const sw = (ud.weapon = joint(ud.elbowR, 0, -0.32, 0));
            part(sw, GEO.box, P(0xffdf70), 0, 0, 0.55, 0.06, 0.015, 0.95);
            part(sw, GEO.box, P(0xd4af37), 0, 0, 0.08, 0.24, 0.04, 0.05);
            part(sw, GEO.box, leather, 0, 0, -0.02, 0.045, 0.045, 0.2);
            part(sw, GEO.sph, B(0xe81b23), 0, 0, -0.14, 0.06, 0.06, 0.06);
        } else if (cls === 'king_father') {
            part(rider, GEO.cyl, P(0xffc107), 0, 2.06, 0, 0.165, 0.1, 0.165);
            for (let i = 0; i < 6; i++) {
                const a = i * Math.PI * 2 / 6;
                part(rider, GEO.cone, P(0xffc107), Math.cos(a) * 0.14, 2.16, Math.sin(a) * 0.14, 0.038, 0.12, 0.038);
            }
            const beard = part(rider, GEO.cone, white, 0, 1.62, 0.13, 0.13, 0.42, 0.1); beard.rotation.x = Math.PI - 0.2;
            part(rider, GEO.box, white, 0, 1.76, 0.14, 0.18, 0.08, 0.06);
            part(rider, GEO.cone, L(0x5a189a), 0, 0.78, 0, 0.46, 1.25, 0.4);
            part(rider, GEO.box, white, 0, 1.68, -0.15, 0.54, 0.14, 0.16);
            const sw = (ud.weapon = joint(ud.elbowR, 0, -0.32, 0));
            part(sw, GEO.cyl, P(0xffc107), 0, 0, 0.5, 0.035, 1.4, 0.035).rotation.x = Math.PI / 2;
            part(sw, GEO.sph, B(0x9d4edd), 0, 0, 1.22, 0.14, 0.14, 0.14);
        } else if (cls === 'dark_knight') {
            part(rider, GEO.box, P(0x18191e), 0, 1.4, 0.02, 0.52, 0.38, 0.35);
            for (const s of [-1, 1]) {
                part(rider, GEO.sph, P(0x18191e), s * 0.38, 1.62, 0, 0.14, 0.1, 0.14);
                const spk = part(rider, GEO.cone, P(0x22242b), s * 0.42, 1.76, 0, 0.05, 0.18, 0.05); spk.rotation.z = -s * 0.4;
            }
            part(rider, GEO.sph, P(0x15161a), 0, 1.9, 0, 0.18, 0.2, 0.18);
            part(rider, GEO.box, B(0xff002b), -0.055, 1.89, 0.145, 0.035, 0.015, 0.02);
            part(rider, GEO.box, B(0xff002b), 0.055, 1.89, 0.145, 0.035, 0.015, 0.02);
            for (const s of [-1, 1]) {
                const h = part(rider, GEO.cone, P(0x111215), s * 0.15, 2.12, -0.02, 0.045, 0.26, 0.045);
                h.rotation.z = -s * 0.45; h.rotation.x = -0.2;
            }
            part(rider, GEO.box, L(0x111116), 0, 1.15, -0.2, 0.48, 0.95, 0.04);
            const sw = (ud.weapon = joint(ud.elbowR, 0, -0.32, 0));
            part(sw, GEO.box, P(0x282a32), 0, 0, 0.6, 0.065, 0.015, 1.1);
            part(sw, GEO.box, B(0xff1744), 0, 0, 0.6, 0.015, 0.018, 0.8);
            part(sw, GEO.box, P(0x18191e), 0, 0, 0.08, 0.26, 0.04, 0.05);
            part(sw, GEO.box, leatherD, 0, 0, -0.04, 0.045, 0.045, 0.22);
        } else if (cls === 'giant') {
            part(rider, GEO.box, leather, 0, 1.0, 0, 0.54, 0.22, 0.36);
            part(rider, GEO.box, steelD, 0, 1.04, 0.18, 0.12, 0.1, 0.05);
            part(rider, GEO.box, leatherD, 0, 1.34, 0.02, 0.62, 0.1, 0.34);
            for (const s of [-1, 1]) part(rider, GEO.sph, skin, s * 0.42, 1.62, 0, 0.17, 0.14, 0.16);
            part(rider, GEO.tor, leather, 0, 1.95, 0, 0.16, 0.03, 0.16).rotation.x = Math.PI / 2;
            const cl = (ud.weapon = joint(ud.elbowR, 0, -0.32, 0));
            part(cl, GEO.cyl, leatherD, 0, 0, 0.6, 0.07, 1.5, 0.07).rotation.x = Math.PI / 2;
            part(cl, GEO.box, L(0x525659), 0, 0, 1.25, 0.36, 0.34, 0.55);
            for (let i = 0; i < 4; i++) {
                const a = i * Math.PI / 2;
                part(cl, GEO.cone, L(0x3a3c3e), Math.cos(a) * 0.18, Math.sin(a) * 0.18, 1.25, 0.08, 0.18, 0.08);
            }
        } else if (cls === 'commander') {
            part(rider, GEO.cyl, L(0x223326), 0, 2.05, 0.04, 0.18, 0.09, 0.2);
            part(rider, GEO.box, P(0x111111), 0, 1.99, 0.16, 0.22, 0.02, 0.12);
            part(rider, GEO.sph, P(0xffd700), 0, 2.05, 0.18, 0.03, 0.03, 0.03);
            for (const s of [-1, 1]) {
                part(rider, GEO.box, P(0xdfaf37), s * 0.38, 1.62, 0, 0.16, 0.04, 0.14);
                part(rider, GEO.box, P(0xdfaf37), s * 0.44, 1.57, 0, 0.04, 0.08, 0.12);
            }
            for (let i = 0; i < 3; i++) {
                part(rider, GEO.sph, P(0xffd700), -0.07, 1.48 - i * 0.12, 0.16, 0.02, 0.02, 0.02);
                part(rider, GEO.sph, P(0xffd700), 0.07, 1.48 - i * 0.12, 0.16, 0.02, 0.02, 0.02);
            }
            const sw = (ud.weapon = joint(ud.elbowR, 0, -0.32, 0));
            part(sw, GEO.box, P(0xdcdfe4), 0, 0, 0.48, 0.04, 0.012, 0.88);
            part(sw, GEO.tor, P(0xffd700), 0, 0, 0.05, 0.09, 0.02, 0.09);
        } else if (cls === 'programmer') {
            part(rider, GEO.sph, L(0x232733), 0, 1.9, -0.04, 0.2, 0.22, 0.2);
            part(rider, GEO.box, P(0x3a4b60), 0, 1.9, 0.14, 0.22, 0.05, 0.04);
            part(rider, GEO.box, B(0x5ce1e6), -0.06, 1.9, 0.15, 0.06, 0.04, 0.01);
            part(rider, GEO.box, B(0x5ce1e6), 0.06, 1.9, 0.15, 0.06, 0.04, 0.01);
            // Ixcham kapyushon va noutbukdagi kod satrlari.
            part(rider, GEO.box, L(0x394454), 0, 1.45, 0.17, 0.22, 0.035, 0.02);
            const lap = (ud.weapon = joint(rider, 0, 1.25, 0.35));
            part(lap, GEO.box, P(0x1c1e24), 0, 0, 0, 0.38, 0.02, 0.28);
            const scr = joint(lap, 0, 0.01, -0.13); scr.rotation.x = -1.9;
            part(scr, GEO.box, P(0x1c1e24), 0, 0.14, 0, 0.38, 0.28, 0.02);
            ud.glow = part(scr, GEO.box, B(0x183d43), 0, 0.14, 0.015, 0.34, 0.24, 0.01);
            for (let i = 0; i < 3; i++) part(scr, GEO.box, B(0x69d6bd), -0.06 + i * 0.015, 0.20 - i * 0.06, 0.022, 0.17 - i * 0.025, 0.012, 0.005);
        } else if (cls === 'banker') {
            part(rider, GEO.cyl, L(0x15161a), 0, 2.0, 0, 0.24, 0.03, 0.24);
            part(rider, GEO.cyl, L(0x1c1e24), 0, 2.12, 0, 0.15, 0.20, 0.15);
            part(rider, GEO.cyl, cloth, 0, 2.05, 0, 0.155, 0.04, 0.155);
            part(rider, GEO.box, white, 0, 1.58, 0.155, 0.12, 0.14, 0.02);
            part(rider, GEO.box, L(0x8b152b), 0, 1.63, 0.165, 0.08, 0.04, 0.02);
            part(ud.elbowL, GEO.box, L(0x3e2312), 0, -0.32, 0, 0.14, 0.28, 0.36);
            part(ud.elbowL, GEO.cyl, P(0xffd700), 0, -0.16, 0, 0.02, 0.12, 0.02).rotation.z = Math.PI / 2;
            part(rider, GEO.box, L(0x8b152b), 0, 1.48, 0.18, 0.035, 0.16, 0.025);
            const bag = (ud.weapon = joint(ud.elbowR, 0, -0.32, 0));
            part(bag, GEO.sph, L(0xc29b38), 0, -0.05, 0, 0.12, 0.15, 0.12);
            ud.glow = part(bag, GEO.cyl, B(0xffd700), 0, 0.08, 0, 0.06, 0.03, 0.06);
        } else if (cls === 'blogger') {
            part(rider, GEO.sph, cloth, 0, 1.95, -0.01, 0.15, 0.12, 0.16);
            part(rider, GEO.box, cloth, 0, 1.92, -0.16, 0.14, 0.02, 0.1);
            part(rider, GEO.tor, L(0x111111), 0, 1.76, 0.02, 0.18, 0.03, 0.18).rotation.x = Math.PI / 2;
            const st = (ud.weapon = joint(ud.elbowR, 0, -0.32, 0));
            part(st, GEO.cyl, P(0x444444), 0, 0, 0.55, 0.015, 1.1, 0.015).rotation.x = Math.PI / 2;
            part(st, GEO.box, P(0x18191c), 0, 0.08, 1.05, 0.08, 0.16, 0.02);
            part(st, GEO.box, B(0x222222), 0, 0.08, 1.04, 0.07, 0.14, 0.01);
            ud.glow = part(st, GEO.sph, B(0xffffff), 0, 0.14, 1.06, 0.04, 0.04, 0.04);
        } else if (cls === 'builder') {
            part(rider, GEO.sph, P(0xffc700), 0, 1.98, 0, 0.17, 0.15, 0.17);
            part(rider, GEO.cyl, P(0xffc700), 0, 1.92, 0.02, 0.22, 0.03, 0.24);
            part(rider, GEO.box, L(0xff6600), 0, 1.33, 0.01, 0.52, 0.65, 0.32);
            part(rider, GEO.box, white, 0, 1.33, 0.175, 0.44, 0.08, 0.01);
            part(rider, GEO.box, white, 0, 1.15, 0.175, 0.44, 0.08, 0.01);
            const hm = (ud.weapon = joint(ud.elbowR, 0, -0.32, 0));
            part(hm, GEO.cyl, L(0x8a5a2b), 0, 0, 0.5, 0.035, 1.25, 0.035).rotation.x = Math.PI / 2;
            part(hm, GEO.box, P(0x4a4e54), 0, 0, 1.05, 0.22, 0.2, 0.35);
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

        if (cls === 'dragon') {
            rider.visible = false;
            const beast = (ud.beast = new THREE.Group()); g.add(beast);
            const dc = L(u.team === 0 ? 0xbd2a2a : 0x2255a4);
            const dcD = L(u.team === 0 ? 0x5a1212 : 0x12244a);
            const horn = P(0xe8ddcb);
            part(beast, GEO.sph, dc, 0, 1.1, 0, 0.55, 0.48, 0.85);
            for (let i = -3; i <= 3; i++) {
                const spk = part(beast, GEO.cone, horn, 0, 1.55 - Math.abs(i) * 0.06, i * 0.22, 0.06, 0.2, 0.06);
                spk.rotation.x = -0.3;
            }
            const neck = joint(beast, 0, 1.2, 0.7);
            part(neck, GEO.cyl, dc, 0, 0.35, 0.25, 0.24, 0.75, 0.24).rotation.x = 0.65;
            const headG = joint(neck, 0, 0.75, 0.55);
            part(headG, GEO.box, dc, 0, 0, 0.25, 0.32, 0.24, 0.5);
            part(headG, GEO.box, dcD, 0, -0.1, 0.25, 0.28, 0.08, 0.46);
            part(headG, GEO.sph, B(0xffd000), -0.14, 0.08, 0.3, 0.04, 0.04, 0.04);
            part(headG, GEO.sph, B(0xffd000), 0.14, 0.08, 0.3, 0.04, 0.04, 0.04);
            for (const s of [-1, 1]) {
                const hn = part(headG, GEO.cone, horn, s * 0.12, 0.18, -0.05, 0.05, 0.35, 0.05);
                hn.rotation.x = -0.7; hn.rotation.z = -s * 0.3;
            }
            ud.glow = part(headG, GEO.sph, B(0xff7700), 0, -0.02, 0.5, 0.08, 0.08, 0.08);
            ud.wingL = joint(beast, -0.45, 1.35, 0.1);
            ud.wingR = joint(beast, 0.45, 1.35, 0.1);
            for (const [w, s] of [[ud.wingL, -1], [ud.wingR, 1]]) {
                part(w, GEO.box, dcD, s * 0.7, 0.35, 0, 1.4, 0.04, 0.75).rotation.z = s * 0.25;
                part(w, GEO.cyl, horn, s * 0.6, 0.4, 0.35, 0.03, 1.3, 0.03).rotation.z = s * 0.8;
            }
            ud.tail = joint(beast, 0, 1.0, -0.75);
            part(ud.tail, GEO.cyl, dc, 0, 0, -0.65, 0.18, 1.3, 0.18).rotation.x = Math.PI / 2 + 0.15;
            part(ud.tail, GEO.cone, horn, 0, 0, -1.35, 0.12, 0.35, 0.12).rotation.x = -Math.PI / 2;
            ud.dragonLegs = [];
            for (const [x, z] of [[-0.4, 0.45], [0.4, 0.45], [-0.4, -0.45], [0.4, -0.45]]) {
                const leg = joint(beast, x, 0.85, z);
                part(leg, GEO.box, dcD, 0, -0.38, 0, 0.18, 0.8, 0.2);
                part(leg, GEO.box, horn, 0, -0.78, 0.08, 0.22, 0.1, 0.28);
                ud.dragonLegs.push(leg);
            }
        } else if (cls === 'godzilla') {
            rider.visible = false;
            const beast = (ud.beast = new THREE.Group()); g.add(beast);
            const scColor = L(0x23272a);
            const spineColor = B(0x00f0ff);
            part(beast, GEO.box, scColor, 0, 1.3, 0, 0.8, 1.1, 0.65);
            part(beast, GEO.sph, scColor, 0, 1.4, 0.25, 0.45, 0.5, 0.35);
            const gzHead = joint(beast, 0, 2.05, 0.2);
            part(gzHead, GEO.box, scColor, 0, 0, 0.2, 0.46, 0.36, 0.55);
            part(gzHead, GEO.box, L(0x16181b), 0, -0.14, 0.2, 0.4, 0.12, 0.5);
            part(gzHead, GEO.sph, spineColor, -0.21, 0.08, 0.25, 0.05, 0.05, 0.05);
            part(gzHead, GEO.sph, spineColor, 0.21, 0.08, 0.25, 0.05, 0.05, 0.05);
            ud.glow = part(gzHead, GEO.sph, spineColor, 0, -0.05, 0.42, 0.06, 0.035, 0.02);
            ud.spines = [];
            for (let i = 0; i < 7; i++) {
                const spk = part(beast, GEO.cone, spineColor, 0, 1.95 - i * 0.18, -0.35 - i * 0.12, 0.09, 0.28 + (3 - Math.abs(i - 2)) * 0.08, 0.05);
                spk.rotation.x = -0.6;
                ud.spines.push(spk);
            }
            ud.tail = joint(beast, 0, 0.85, -0.5);
            part(ud.tail, GEO.cyl, scColor, 0, -0.15, -0.75, 0.32, 1.6, 0.3).rotation.x = Math.PI / 2 + 0.2;
            for (let i = 0; i < 4; i++) {
                const sp = part(ud.tail, GEO.cone, spineColor, 0, 0.12, -0.4 - i * 0.3, 0.06, 0.2, 0.04);
                sp.rotation.x = -0.5;
            }
            // Tumshuq va oyoqlarda tanadan ajralib turadigan sodda detallar.
            part(gzHead, GEO.box, L(0x343b3c), 0, -0.04, 0.46, 0.32, 0.12, 0.18);
            ud.legL = joint(beast, -0.42, 0.95, 0); ud.legR = joint(beast, 0.42, 0.95, 0);
            for (const lg of [ud.legL, ud.legR]) {
                part(lg, GEO.box, scColor, 0, -0.4, 0.05, 0.34, 0.85, 0.42);
                part(lg, GEO.box, L(0x181a1c), 0, -0.85, 0.2, 0.38, 0.24, 0.52);
            }
            ud.armL = joint(beast, -0.45, 1.55, 0.25); ud.armR = joint(beast, 0.45, 1.55, 0.25);
            for (const [ar, s] of [[ud.armL, -1], [ud.armR, 1]]) {
                part(ar, GEO.box, scColor, s * 0.08, -0.22, 0.15, 0.16, 0.45, 0.18).rotation.x = -0.5;
                part(ar, GEO.box, scColor, s * 0.08, -0.45, 0.28, 0.14, 0.12, 0.14);
            }
        }
        return g;
    }

    /** Har kadr: yurish, hujum va tinch holat animatsiyasi. */
    function animate(u, m, T, hit, moving) {
        const ud = m.userData, cls = u.cls;
        const ph = T * (cls === 'cavalry' ? 12 : 9) + u.id * 1.7;
        const sw = Math.sin(ph) * 0.8 * moving;
        const t = 1 - hit;                                            // hujumda 0 -> 1

        if (cls === 'dragon') {
            const wFlap = Math.sin(T * 8 + u.id) * 0.38 + hit * 0.5;
            if (ud.wingL) ud.wingL.rotation.z = -0.25 + wFlap;
            if (ud.wingR) ud.wingR.rotation.z = 0.25 - wFlap;
            if (ud.tail) ud.tail.rotation.y = Math.sin(T * 4 + u.id) * 0.25;
            if (ud.dragonLegs) {
                ud.dragonLegs.forEach((l, i) => {
                    const o = i % 2 ? Math.PI : 0;
                    l.rotation.x = Math.sin(ph + o) * 0.6 * moving;
                });
            }
            if (ud.beast) ud.beast.position.y = Math.sin(T * 4 + u.id) * 0.12;
            if (ud.glow) ud.glow.scale.setScalar(0.08 * (1 + hit * 3.5));
            return;
        }
        if (cls === 'godzilla') {
            const gzSw = Math.sin(ph * 0.7) * 0.55 * moving;
            if (ud.legL) ud.legL.rotation.x = gzSw;
            if (ud.legR) ud.legR.rotation.x = -gzSw;
            if (ud.tail) ud.tail.rotation.y = Math.sin(T * 3 + u.id) * 0.32;
            if (ud.armL) ud.armL.rotation.x = -0.4 - hit * 0.8;
            if (ud.armR) ud.armR.rotation.x = -0.4 - hit * 0.8;
            if (ud.glow) ud.glow.scale.setScalar(0.12 * (1 + hit * 4));
            if (ud.spines) {
                const pulse = 1 + Math.sin(T * 10 + u.id) * 0.2 + hit * 0.6;
                ud.spines.forEach(s => s.scale.set(pulse, pulse, pulse));
            }
            return;
        }

        if (cls === 'cavalry') {
            ud.horseLegs.forEach((l, i) => {
                const o = (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0);
                l.hip.rotation.x = Math.sin(ph + o) * 0.75 * moving;
                l.knee.rotation.x = Math.max(0, -Math.sin(ph + o)) * 1.1 * moving;
            });
            ud.rider.position.y = 0.72 + Math.abs(Math.sin(ph)) * 0.07 * moving;
        } else if (cls !== 'mage' && cls !== 'healer' && cls !== 'king_father') {
            ud.legL.rotation.x = sw; ud.legR.rotation.x = -sw;
            ud.rider.position.y = Math.abs(Math.sin(ph)) * 0.05 * moving;
        } else {
            ud.rider.position.y = Math.abs(Math.sin(ph)) * 0.05 * moving;
        }

        let twist = 0;
        if (cls === 'knight' || cls === 'king' || cls === 'king_father' || cls === 'dark_knight') {
            if (hit > 0) {
                ud.armR.rotation.x = -2.55 + 2.2 * smooth(t); ud.elbowR.rotation.x = -0.5 - 0.5 * t;
                twist = (0.5 - t) * 0.5;
            } else { ud.armR.rotation.x = -0.35 - sw * 0.15; ud.elbowR.rotation.x = -1.3; }
            ud.armL.rotation.x = -0.45 + sw * 0.1; ud.elbowL.rotation.x = -1.1;
        } else if (cls === 'giant') {
            if (hit > 0) {
                ud.armR.rotation.x = -2.6 + 2.4 * smooth(t); ud.elbowR.rotation.x = -0.4;
                ud.armL.rotation.x = -2.4 + 2.2 * smooth(t); ud.elbowL.rotation.x = -0.4;
                twist = (0.5 - t) * 0.4;
            } else {
                ud.armR.rotation.x = -0.5 - sw * 0.15; ud.elbowR.rotation.x = -0.6;
                ud.armL.rotation.x = -0.5 + sw * 0.15; ud.elbowL.rotation.x = -0.6;
            }
        } else if (cls === 'builder') {
            if (hit > 0) {
                ud.armR.rotation.x = -2.7 + 2.5 * smooth(t); ud.elbowR.rotation.x = -0.8;
                ud.armL.rotation.x = -2.5 + 2.3 * smooth(t); ud.elbowL.rotation.x = -0.8;
                twist = (0.5 - t) * 0.45;
            } else {
                ud.armR.rotation.x = -0.4 - sw * 0.15; ud.elbowR.rotation.x = -0.8;
                ud.armL.rotation.x = -0.4 + sw * 0.15; ud.elbowL.rotation.x = -0.8;
            }
        } else if (cls === 'commander') {
            if (hit > 0) {
                ud.armR.rotation.x = -2.2 + 2.0 * smooth(t); ud.elbowR.rotation.x = -0.3;
                twist = (0.5 - t) * 0.4;
            } else {
                ud.armR.rotation.x = -0.4 - sw * 0.15; ud.elbowR.rotation.x = -0.8;
            }
            ud.armL.rotation.x = -0.3 + sw * 0.1; ud.elbowL.rotation.x = -0.6;
        } else if (cls === 'programmer') {
            ud.armR.rotation.x = -1.1 + Math.sin(T * 16) * 0.12; ud.elbowR.rotation.x = -1.1;
            ud.armL.rotation.x = -1.1 - Math.sin(T * 16) * 0.12; ud.elbowL.rotation.x = -1.1;
            if (ud.glow) ud.glow.scale.setScalar(1 + hit * 0.8 + Math.sin(T * 14) * 0.2);
        } else if (cls === 'banker') {
            if (hit > 0) {
                ud.armR.rotation.x = -1.8 + 1.6 * smooth(t); ud.elbowR.rotation.x = -0.4;
                twist = (0.5 - t) * 0.3;
            } else {
                ud.armR.rotation.x = -0.35 - sw * 0.15; ud.elbowR.rotation.x = -0.6;
            }
            ud.armL.rotation.x = -0.2; ud.elbowL.rotation.x = -0.3;
            if (ud.glow) ud.glow.scale.setScalar(1 + hit * 2);
        } else if (cls === 'blogger') {
            ud.armR.rotation.x = -1.35 - hit * 0.25; ud.elbowR.rotation.x = -0.2;
            ud.armL.rotation.x = -0.4 + sw * 0.1; ud.elbowL.rotation.x = -0.6;
            if (ud.glow) ud.glow.scale.setScalar(0.04 * (1 + hit * 3.5));
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
        // tayoq / hassa doim tik turadi (qo'l og'sa ham)
        if ((cls === 'mage' || cls === 'healer' || cls === 'king_father') && ud.weapon) ud.weapon.rotation.x = -(ud.armR.rotation.x + ud.elbowR.rotation.x);
        // nayza oldinga gorizontal (biroz pastga), hujumda oldinga otiladi
        if (cls === 'cavalry' && ud.weapon) ud.weapon.rotation.x = -(ud.armR.rotation.x + ud.elbowR.rotation.x) + 0.12 - hit * 0.1;
    }

    NS.unitMesh = unitMesh;
    NS.animateUnit = animate;
    NS.UNIT_BASE = {
        knight: 1.0,
        archer: 0.96,
        mage: 1.0,
        healer: 0.96,
        cavalry: 0.62,
        king: 1.08,
        king_father: 1.12,
        dragon: 1.35,
        giant: 1.45,
        godzilla: 1.5,
        commander: 1.02,
        programmer: 0.96,
        banker: 0.98,
        blogger: 0.96,
        dark_knight: 1.06,
        builder: 1.0,
    };
})(window.App = window.App || {});
