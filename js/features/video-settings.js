/* features/video-settings.js — barcha o'yinlar uchun umumiy "video" sozlamalari */
(function (App) {
    'use strict';

    const SCHEMA = [
        { group: 'Matn', key: 'hook', label: 'Tepa sarlavha', type: 'text', default: '', placeholder: 'Qaysi biri yutadi? 👇', hint: 'Birinchi soniyada e\'tiborni ushlaydi' },
        { key: 'handle', label: 'Kanal nomi', type: 'text', default: '@kanal_nomi', placeholder: '@username' },
        { group: 'Obuna va komment chaqiruvi', key: 'cta2', label: 'Komment chaqiruvi', type: 'text', default: 'Nikingni kommentga yoz — o\'yinda qatnash!', hint: 'Obunachili o\'yinlarda lentada aylanib chiqadi' },
        { key: 'cta3', label: 'Obuna chaqiruvi', type: 'text', default: 'Obuna bo\'l — keyingi video senga!' },
        { key: 'cta', label: 'Qo\'shimcha chaqiriq', type: 'text', default: 'Do\'stingni belgila 👇' },
        { key: 'banner', label: 'Lenta', type: 'segment', default: 'always', options: [['always', 'Doim'], ['edges', 'Boshi/oxiri'], ['off', 'Yo\'q']] },
        { key: 'endCta', label: 'G\'olibdan keyingi yozuv', type: 'text', default: 'Kommentga yoz — keyingisida sen o\'ynaysan' },
        { group: 'Video', key: 'duration', label: 'Davomiylik', type: 'segment', default: 'medium', options: [['short', '~30 s'], ['medium', '~50 s'], ['long', '~80 s']] },
        { key: 'quality', label: 'Sifat', type: 'segment', default: '1080', options: [['720', '720p'], ['1080', '1080p']], hint: '1080p Instagram uchun yaxshiroq (yangi o\'yin boshlanganda qo\'llanadi)' },
        { key: 'captions', label: 'Diktor matni ekranda', type: 'toggle', default: true, hint: 'Gaplar sarlavha bo\'lib chiqadi: ovoz yozuvga tushmasa ham o\'qiladi' },
        { key: 'cinema', label: 'Kino effekti', type: 'toggle', default: true, hint: 'Vinyetka, sekin paydo bo\'lish va so\'nish' },
        { key: 'speed', label: 'Tezlik', type: 'range', default: 1, min: 0.6, max: 2, step: 0.1, unit: '×' },
        { key: 'intro', label: 'Boshlanish sanog\'i', type: 'segment', default: 2, options: [[0, 'Yo\'q'], [2, '2 s'], [3, '3 s']] },
        { key: 'drama', label: 'Yaqin poyga', type: 'toggle', default: true, hint: 'Orqada qolganga yordam beradi' },
        { key: 'autoStop', label: 'G\'olibdan keyin yozuvni to\'xtat', type: 'toggle', default: true },
    ];

    const DURATIONS = { short: 28, medium: 52, long: 82 };

    function defaults() {
        const o = {};
        SCHEMA.forEach(s => { o[s.key] = s.default; });
        return o;
    }

    App.videoSettings = { SCHEMA, DURATIONS, defaults };
})(window.App = window.App || {});
