/* features/backup.js — ma'lumotlarni fayl qilib saqlash va boshqa kompyuterda tiklash.
 * Saqlanadi: obunachilar ro'yxati (+jangchi turi), profillar (jamoa, g'alaba, o'ldirgan), video va o'yin sozlamalari. */
(function (App) {
    'use strict';

    const VERSION = 1;
    const KEYS_PREFIX = ['rl.cfg.'];

    function collectSettings() {
        const cfg = {};
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (KEYS_PREFIX.some(p => k.startsWith(p))) cfg[k] = JSON.parse(localStorage.getItem(k));
            }
        } catch (e) { /* e'tiborsiz */ }
        return cfg;
    }

    const Backup = {
        /** Hamma ma'lumot bitta obyektda. */
        snapshot() {
            let video = {};
            try { video = JSON.parse(localStorage.getItem('rl.video') || '{}'); } catch (e) { /* e'tiborsiz */ }
            return {
                app: 'reels-lab', version: VERSION, savedAt: new Date().toISOString(),
                roster: App.roster.names,
                realOnly: !!App.roster.realOnly,
                profiles: App.roster.profiles,
                video,
                games: collectSettings(),
            };
        },

        /** JSON faylni yuklab oladi. */
        download() {
            const blob = new Blob([JSON.stringify(this.snapshot(), null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `reels-lab-zaxira-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 4000);
            return this.snapshot().roster.length;
        },

        /**
         * Fayldan tiklash.
         * @param {string} text  JSON matn
         * @param {'replace'|'merge'} mode  merge: mavjud ro'yxatga qo'shadi, statistikani yig'adi
         * @returns {{roster:number, profiles:number}}
         */
        restore(text, mode = 'merge') {
            let d;
            try { d = JSON.parse(text); } catch (e) { throw new Error('Fayl JSON emas'); }
            if (!d || d.app !== 'reels-lab') throw new Error('Bu Reels Lab zaxira fayli emas');

            const R = App.roster;
            if (mode === 'replace') {
                R.names = Array.isArray(d.roster) ? d.roster : [];
                R.profiles = d.profiles || {};
                if (d.realOnly !== undefined) R.realOnly = !!d.realOnly;
            } else {
                R.names = R.parse(R.names.join('\n') + '\n' + (d.roster || []).join('\n'));
                for (const [k, p] of Object.entries(d.profiles || {})) {
                    const cur = R.profiles[k];
                    if (!cur) R.profiles[k] = p;
                    else Object.assign(cur, { team: cur.team !== null && cur.team !== undefined ? cur.team : p.team, wins: Math.max(cur.wins, p.wins || 0), games: Math.max(cur.games, p.games || 0), kills: Math.max(cur.kills, p.kills || 0) });
                }
            }
            R.saveProfiles();
            R._emit();

            // sozlamalar (faqat to'liq tiklashda)
            if (mode === 'replace') {
                try {
                    if (d.video) localStorage.setItem('rl.video', JSON.stringify(d.video));
                    for (const [k, v] of Object.entries(d.games || {})) if (KEYS_PREFIX.some(p => k.startsWith(p))) localStorage.setItem(k, JSON.stringify(v));
                } catch (e) { /* e'tiborsiz */ }
            }
            return { roster: R.names.length, profiles: Object.keys(R.profiles).length };
        },
    };

    App.backup = Backup;
})(window.App = window.App || {});
