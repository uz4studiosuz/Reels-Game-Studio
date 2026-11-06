/* core/util.js — kichik, bog'liqliksiz yordamchilar */
(function (App) {
    'use strict';

    const TAU = Math.PI * 2;

    const U = {
        TAU,
        clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
        lerp: (a, b, t) => a + (b - a) * t,
        smooth: (t) => t * t * (3 - 2 * t),
        easeOut: (t) => 1 - Math.pow(1 - t, 3),
        hsl: (h, s, l, a) => (a === undefined ? `hsl(${h} ${s}% ${l}%)` : `hsl(${h} ${s}% ${l}% / ${a})`),

        /** Seed asosida takrorlanuvchi tasodifiy son generatori. */
        mulberry32(seed) {
            let a = seed >>> 0;
            return function () {
                a = (a + 0x6D2B79F5) | 0;
                let t = Math.imul(a ^ (a >>> 15), 1 | a);
                t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
                return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
            };
        },
        hashStr(s) {
            let h = 2166136261;
            for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
            return h >>> 0;
        },
        /** Kasr sonni ehtimol bilan yaxlitlash: 2.3 -> 2 yoki 3 (o'rtacha 2.3). */
        stochRound(x, rand) {
            const f = Math.floor(x);
            return f + ((rand || Math.random)() < x - f ? 1 : 0);
        },
        /** Raqamni 1.234.567 ko'rinishida chiqarish. */
        fmt(n) {
            return String(Math.max(0, Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        },
        shuffle(arr, rand) {
            const r = rand || Math.random;
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(r() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        },
        isEmoji: (s) => /\p{Extended_Pictographic}/u.test(s),
    };

    App.util = U;
})(window.App = window.App || {});
