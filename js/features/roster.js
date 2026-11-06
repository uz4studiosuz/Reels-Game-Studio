/* features/roster.js — obunachilar nik ro'yxati.
 * Obunachilar kommentga nikini yozadi -> siz bu yerga qo'yasiz -> nikdagi o'yinchilar o'yinda qatnashadi.
 * Format: "nik" yoki "nik:tur" / "nik ritsar" (jangchi turini o'zi tanlaydi — Armiya jangi uchun).
 */
(function (App) {
    'use strict';
    const { shuffle } = App.util;

    const KEY = 'rl.roster.v1';
    const REAL_KEY = 'rl.roster.realOnly';
    const MAX_LEN = 14;
    const FALLBACK = ['🐶', '🐱', '🦊', '🐼', '🐸', '🦁', '🐵', '🐯', '🐷', '🐰', '🐨', '🐮', '🐔', '🐧', '🦄', '🐙', '🐢', '🦉', '🐳', '🦋', '🐝', '🦀', '🐞', '🦖'];

    // jangchi turlari va ularning sinonimlari
    const CLASSES = {
        ritsar: 'knight', knight: 'knight', jangchi: 'knight', tank: 'knight',
        kamonchi: 'archer', archer: 'archer', mergan: 'archer', ovchi: 'archer',
        jodugar: 'mage', mage: 'mage', sehrgar: 'mage', wizard: 'mage',
        otliq: 'cavalry', cavalry: 'cavalry', chavandoz: 'cavalry',
        shifokor: 'healer', healer: 'healer', doktor: 'healer', vrach: 'healer',
    };
    const CLASS_LIST = ['knight', 'archer', 'mage', 'cavalry', 'healer'];

    const Roster = {
        names: [],
        realOnly: false,
        CLASSES, CLASS_LIST,
        _subs: [],

        load() {
            try { this.names = JSON.parse(localStorage.getItem(KEY) || '[]').filter(Boolean); } catch (e) { this.names = []; }
            try { this.realOnly = JSON.parse(localStorage.getItem(REAL_KEY) || 'false'); } catch (e) { this.realOnly = false; }
        },
        save() {
            try {
                localStorage.setItem(KEY, JSON.stringify(this.names));
                localStorage.setItem(REAL_KEY, JSON.stringify(this.realOnly));
            } catch (e) { /* xotira yopiq bo'lishi mumkin */ }
        },
        onChange(fn) { this._subs.push(fn); },
        _emit() { this.save(); this._subs.forEach(fn => fn(this.names, this.realOnly)); },
        setRealOnly(val) {
            this.realOnly = !!val;
            this._emit();
        },

        /** "nik" yoki "nik:tur" yozuvini {name, cls} ga ajratadi. */
        split(entry) {
            const i = entry.lastIndexOf(':');
            if (i > 0 && CLASS_LIST.includes(entry.slice(i + 1))) return { name: entry.slice(0, i), cls: entry.slice(i + 1) };
            return { name: entry, cls: null };
        },

        /** Erkin matn (komment nusxasi) -> toza, takrorlanmaydigan ro'yxat (har yozuv "nik" yoki "nik:tur"). */
        parse(text) {
            const seen = new Set();
            const out = [];
            for (let raw of String(text || '').split(/[\n,;\t]+/)) {
                raw = raw.trim().replace(/^@+/, '');
                let cls = null;
                const m = raw.match(/^(.*?)[\s:|\-–]+([A-Za-zʻ'’]+)$/);
                if (m) {
                    const key = m[2].toLowerCase().replace(/[ʻ'’]/g, '');
                    if (CLASSES[key]) { cls = CLASSES[key]; raw = m[1].trim(); }
                }
                const name = raw.replace(/[:\s]+/g, '_').slice(0, MAX_LEN);
                if (!name) continue;
                const k = name.toLowerCase();
                if (seen.has(k)) continue;
                seen.add(k);
                out.push(cls ? name + ':' + cls : name);
            }
            return out;
        },

        set(list) { this.names = list; this._emit(); },
        add(text) { this.set(this.parse(this.names.join('\n') + '\n' + text)); },
        remove(name) { this.set(this.names.filter(n => this.split(n).name !== name)); },
        clear() { this.set([]); },
        sampleFill(n) {
            const demo = [];
            for (let i = 0; i < n; i++) demo.push('obunachi' + (i + 1) + (i % 3 === 0 ? ':' + CLASS_LIST[(i / 3) % CLASS_LIST.length | 0] : ''));
            this.set(this.parse(this.names.join('\n') + '\n' + demo.join('\n')));
        },

        /**
         * O'yin uchun n ta ishtirokchi tayyorlaydi.
         * "Real obunachilar" yoqilgan bo'lsa — faqat va faqat ro'yxatdagi obunachilar qatnashadi (botlar bo'lmaydi).
         * "Bot bilan to'ldirish" yoqilgan bo'lsa — yetmagan o'rinlar botlar bilan to'ldiriladi.
         * @returns {{name:string,label:string,emoji:boolean,nick:boolean,hue:number,cls:string|null}[]}
         */
        participants(n, useRoster, rand, opts = {}) {
            const r = rand || Math.random;
            const isRealOnly = opts.realOnly !== undefined ? !!opts.realOnly : !!this.realOnly;
            const shouldFillBots = !isRealOnly && (opts.fillBots !== undefined ? !!opts.fillBots : false);

            const out = [];
            if (useRoster && this.names.length) {
                const limit = opts.max ? Math.min(opts.max, n) : n;
                const pool = shuffle(this.names.slice(), r).slice(0, limit);
                for (const entry of pool) {
                    const { name, cls } = this.split(entry);
                    const prof = this.profile(name);
                    out.push({ name, label: name.slice(0, 2).toUpperCase(), emoji: false, nick: true, cls, team: prof.team });
                }
            }
            if (shouldFillBots && out.length < n) {
                const fill = shuffle(FALLBACK.slice(), r);
                const need = n - out.length;
                for (let i = 0; i < need; i++) {
                    const em = fill[i % fill.length];
                    out.push({ name: em, label: em, emoji: true, nick: false, cls: null, team: null });
                }
            } else if (!useRoster && shouldFillBots && out.length === 0) {
                const fill = shuffle(FALLBACK.slice(), r);
                for (let i = 0; i < n; i++) {
                    const em = fill[i % fill.length];
                    out.push({ name: em, label: em, emoji: true, nick: false, cls: null, team: null });
                }
            }
            shuffle(out, r);
            out.forEach((p, i) => { p.hue = Math.round((i * 137.508 + 14) % 360); p.index = i; });
            return out;
        },

        /** Ekranga chiqariladigan ko'rinish: nik -> @nik, emoji -> emoji. */
        display(p) { return p.nick ? '@' + p.name : p.name; },

        /** Ovoz chiqarish uchun: "ali_01" -> "ali 01". */
        spoken(p) { return p.nick ? p.name.replace(/_/g, ' ').replace(/(\d+)/g, ' $1 ').trim() : 'bot'; },
    };

    // ---------- obunachi profillari: jamoa va statistika (brauzerda saqlanadi) ----------
    const PKEY = 'rl.profiles.v1';
    Object.assign(Roster, {
        profiles: {},

        loadProfiles() {
            try { this.profiles = JSON.parse(localStorage.getItem(PKEY) || '{}') || {}; } catch (e) { this.profiles = {}; }
        },
        saveProfiles() {
            try { localStorage.setItem(PKEY, JSON.stringify(this.profiles)); } catch (e) { /* e'tiborsiz */ }
        },

        /** Nik uchun profil (yo'q bo'lsa yaratiladi): {team:0|1|null, wins, games, kills}. */
        profile(name) {
            const k = String(name).toLowerCase();
            return this.profiles[k] || (this.profiles[k] = { team: null, wins: 0, games: 0, kills: 0 });
        },

        setTeam(name, team) { this.profile(name).team = team; this.saveProfiles(); this._subs.forEach(fn => fn(this.names)); },

        /** Jangchi turini ro'yxat yozuviga yozadi ("nik:tur"). */
        setClass(name, cls) {
            this.names = this.names.map(e => (this.split(e).name === name ? (cls ? name + ':' + cls : name) : e));
            this._emit();
        },

        /** O'yin tugagach: ishtirok, g'alaba va "o'ldirgan" sonlarini qo'shadi. */
        recordGame(name, { won = false, kills = 0, team = null } = {}) {
            const p = this.profile(name);
            p.games++; p.kills += kills; if (won) p.wins++;
            if (team !== null && p.team === null) p.team = team;
            this.saveProfiles();
            this._subs.forEach(fn => fn(this.names));
        },

        resetTeams() { for (const k in this.profiles) this.profiles[k].team = null; this.saveProfiles(); this._subs.forEach(fn => fn(this.names)); },

        /**
         * Barcha obunachilarni Qizil (0) va Ko'k (1) jamoalariga teng (50/50) taqsimlaydi.
         * Jangchi turlari (ritsar, kamonchi va h.k.) ham ikkala jamoaga muvozanatli taqsimlanadi.
         */
        autoDistributeTeams(rand = Math.random) {
            const list = this.names.slice();
            if (!list.length) return { team0: 0, team1: 0, total: 0 };

            const byClass = {};
            for (const entry of list) {
                const { name, cls } = this.split(entry);
                const k = cls || '_none';
                (byClass[k] = byClass[k] || []).push(name);
            }

            const cnt = [0, 0];
            for (const k of Object.keys(byClass)) {
                const names = shuffle(byClass[k], rand);
                for (const name of names) {
                    const t = cnt[0] < cnt[1] ? 0 : cnt[1] < cnt[0] ? 1 : (rand() < 0.5 ? 0 : 1);
                    this.profile(name).team = t;
                    cnt[t]++;
                }
            }

            this.saveProfiles();
            this._subs.forEach(fn => fn(this.names));
            return { team0: cnt[0], team1: cnt[1], total: list.length };
        },
        resetStats() { for (const k in this.profiles) Object.assign(this.profiles[k], { wins: 0, games: 0, kills: 0 }); this.saveProfiles(); this._subs.forEach(fn => fn(this.names)); },
    });

    Roster.load();
    Roster.loadProfiles();
    App.roster = Roster;
})(window.App = window.App || {});
