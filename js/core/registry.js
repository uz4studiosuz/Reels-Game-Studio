/* core/registry.js — o'yinlar ro'yxati.
 *
 * Har bir o'yin quyidagi shartnomani bajaradi (qolgan hamma narsa — Session va UI — o'yinning ichki
 * tuzilishini bilmaydi):
 *
 *   App.registry.register({
 *     id, name, tagline, group, tags:[], roster:boolean,
 *     settings: [ { key, label, type, default, ... } ],   // faqat shu o'yinga tegishli sozlamalar
 *     create(env) -> { update(), draw(), pointer?(type,x,y), dispose?() }
 *   });
 *
 * env — Session beradigan cheklangan interfeys (qarang: core/session.js).
 */
(function (App) {
    'use strict';

    const Registry = {
        list: [],
        byId: {},

        register(def) {
            if (!def || !def.id || typeof def.create !== 'function') throw new Error('Noto\'g\'ri o\'yin ta\'rifi');
            def.settings = def.settings || [];
            def.tags = def.tags || [];
            this.list.push(def);
            this.byId[def.id] = def;
        },

        get(id) { return this.byId[id]; },

        /** Sozlamalarning boshlang'ich qiymatlari. */
        defaults(def) {
            const o = {};
            for (const s of def.settings) o[s.key] = s.default;
            return o;
        },
    };

    App.registry = Registry;
})(window.App = window.App || {});
