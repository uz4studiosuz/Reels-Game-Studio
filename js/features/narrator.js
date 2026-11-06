/* features/narrator.js — ovozli diktor: brauzer ovozi (Web Speech API), Azure Speech yoki oflayn eSpeak-NG.
 *
 * Tanlash tartibi: foydalanuvchi tanlagan ovoz -> o'zbek ovozi -> (zaxira yoqilgan bo'lsa) turk ovozi.
 * Turk tili o'zbekchaga eng yaqin: matn turkcha imloga moslab o'qitiladi (o' -> o, sh -> ş, ch -> ç ...).
 * Microsoft Edge'da bepul "Microsoft Madina/Sardor Online (Natural) – Uzbek" ovozlari bor.
 */
(function (App) {
    'use strict';

    const KEY = 'rl.tts.v2';
    const SS = window.speechSynthesis;

    const Narrator = {
        supported: !!SS,
        enabled: false,
        record: true,         // ovozni yozuvga ham qo'shish (brauzer audiosi orqali)
        captureMode: 'tab',   // 'tab' = shu oyna audiosi, 'system' = butun tizim ovozi
        fallback: true,       // o'zbek ovozi yo'q bo'lsa turk ovozidan foydalanish
        gender: 'male',       // avto tanlashda qaysi jins: 'male' | 'female'
        voiceName: '',        // '' = avto
        rate: 1.05,
        lastError: '',
        _last: {},

        // --- Azure Speech (rasmiy API). Ovoz audio sifatida keladi va o'yin ovozlari bilan birga MP4 ga yoziladi.
        engine: 'browser',            // 'browser' = brauzer ovozi (yozuvga tushmaydi), 'azure' = Azure Speech, 'espeak' = oflayn eSpeak-NG
        _espeak: null,
        azureKey: '',
        azureRegion: 'westeurope',
        _cache: new Map(),
        _src: null,
        _token: 0,
        busyUntil: 0,

        load() {
            try { Object.assign(this, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* e'tiborsiz */ }
        },
        save() {
            try { localStorage.setItem(KEY, JSON.stringify({ engine: this.engine, azureKey: this.azureKey, azureRegion: this.azureRegion, enabled: this.enabled, record: this.record, captureMode: this.captureMode, fallback: this.fallback, gender: this.gender, voiceName: this.voiceName, rate: this.rate })); } catch (e) { /* e'tiborsiz */ }
        },

        voices() { return SS ? SS.getVoices() : []; },

        /** Ovoz sifati: tanlangan jins (erkak/ayol) birinchi, keyin "Natural/Online" ovozlar. */
        _score(v) {
            const male = /sardor|ahmet|tolga|emre|kemal|\bmale\b|david|mark|george|guy|daniel|james|ryan/i.test(v.name);
            const female = /madina|emel|zira|hazel|susan|female|aria|jenny|sara|nilufar/i.test(v.name);
            const want = this.gender === 'female' ? female : male;
            const wrong = this.gender === 'female' ? male : female;
            return (want ? 4 : 0) - (wrong ? 4 : 0) + (/natural/i.test(v.name) ? 2 : 0) + (/online/i.test(v.name) ? 1 : 0);
        },
        uzbekVoices() {
            return this.voices().filter(v => /^uz/i.test(v.lang) || /uzbek|o'zbek/i.test(v.name)).sort((a, b) => this._score(b) - this._score(a));
        },
        turkishVoices() {
            return this.voices().filter(v => /^tr/i.test(v.lang) || /turk/i.test(v.name)).sort((a, b) => this._score(b) - this._score(a));
        },

        /** Hozir ishlatiladigan ovoz va turi: {voice, kind:'uz'|'fallback'|'chosen'} yoki null. */
        current() {
            const all = this.voices();
            const chosen = this.voiceName && all.find(v => v.name === this.voiceName);
            if (chosen) return { voice: chosen, kind: /^uz/i.test(chosen.lang) ? 'uz' : (/^tr/i.test(chosen.lang) ? 'fallback' : 'chosen') };
            const uz = this.uzbekVoices()[0];
            if (uz) return { voice: uz, kind: 'uz' };
            const tr = this.fallback ? this.turkishVoices()[0] : null;
            return tr ? { voice: tr, kind: 'fallback' } : null;
        },

        /** Panel uchun qisqa holat matni. */
        /** Azure ovozining nomi (jinsga qarab). */
        azureVoice() { return this.gender === 'female' ? 'uz-UZ-MadinaNeural' : 'uz-UZ-SardorNeural'; },

        /** Ovoz audio bufer bo'lib keladimi (demak o'yin ovozi bilan birga MP4 ga yoziladi). */
        recordsItself() { return this.engine === 'azure' || this.engine === 'espeak'; },

        describe() {
            if (this.engine === 'espeak') {
                if (this.lastError) return { ok: false, text: `eSpeak xatosi: ${this.lastError}` };
                return { ok: true, text: `Oflayn eSpeak (o'zbek, ${this.gender === 'female' ? 'ayol' : 'erkak'}). Internet va kalit kerak emas, ovoz MP4 ga avtomatik yoziladi. Ovozi robotroq.` };
            }
            if (this.engine === 'azure') {
                if (!this.azureKey) return { ok: false, text: 'Azure kaliti kiritilmagan. Azure portal → "Speech service" (F0 — bepul) → "Keys and Endpoint" dan KEY 1 va Region ni qo\'ying.' };
                if (this.lastError) return { ok: false, text: `Azure xatosi: ${this.lastError}` };
                return { ok: true, text: `Azure tayyor: ${this.azureVoice()} (${this.azureRegion}). Ovoz MP4 ga avtomatik yoziladi.` };
            }
            if (!this.supported) return { ok: false, text: 'Bu brauzer ovoz sintezini qo\'llamaydi.' };
            const c = this.current();
            const n = this.voices().length;
            if (!n) return { ok: false, text: 'Brauzerda hech qanday ovoz topilmadi (ovozlar yuklanmoqda bo\'lishi mumkin).' };
            if (!c) return { ok: false, text: `O'zbek ovozi topilmadi (${n} ta boshqa ovoz bor). Microsoft Edge'da oching: u yerda bepul "Madina/Sardor Online (Natural)" bor. Yoki zaxira turk ovozini yoqing.` };
            if (c.kind === 'uz') return { ok: true, text: `Tayyor: ${c.voice.name}` };
            if (c.kind === 'fallback') return { ok: true, text: `O'zbek ovozi yo'q — zaxira turk ovozi ishlatiladi: ${c.voice.name}. Aytilishi o'zbekchaga yaqin.` };
            return { ok: true, text: `Tanlangan ovoz: ${c.voice.name} (${c.voice.lang}). O'zbekcha matn noto'g'ri o'qilishi mumkin.` };
        },

        /** Ovozdan tozalangan matn: emoji, @, _ olib tashlanadi. */
        clean(t) {
            return String(t).replace(/\p{Extended_Pictographic}/gu, '').replace(/[@#*]/g, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
        },

        /** O'zbek lotin imlosini turkchaga yaqinlashtirish (zaxira ovoz uchun). */
        toTurkish(t) {
            return t.replace(/[oO][ʻ'’`]/g, m => (m[0] === 'O' ? 'O' : 'o')).replace(/[gG][ʻ'’`]/g, m => (m[0] === 'G' ? 'Ğ' : 'ğ'))
                .replace(/sh/g, 'ş').replace(/Sh/g, 'Ş').replace(/ch/g, 'ç').replace(/Ch/g, 'Ç').replace(/[ʻ'’`]/g, '');
        },

        /**
         * @param {string} text
         * @param {{key?:string, cooldown?:number, interrupt?:boolean}} o  key bo'yicha qayta-qayta aytmaslik
         * @returns {boolean} aytishga urinildimi
         */
        say(text, o = {}) {
            if (this.recordsItself()) return this._sayAudio(text, o);
            if (!this.enabled || !SS) return false;
            const c = this.current();
            if (!c) return false;
            const now = performance.now();
            if (o.key && now - (this._last[o.key] || 0) < (o.cooldown || 4000)) return false;
            if (o.key) this._last[o.key] = now;
            let t = this.clean(text);
            if (!t) return false;
            if (c.kind === 'fallback') t = this.toTurkish(t);
            if (o.interrupt) SS.cancel();
            else if (SS.pending && SS.speaking) return false; // navbat to'planib qolmasin
            const u = new SpeechSynthesisUtterance(t);
            u.voice = c.voice; u.lang = c.voice.lang; u.rate = this.rate; u.volume = 1;
            u.pitch = this.gender === 'male' && !/sardor|ahmet|tolga|emre|male|david|mark/i.test(c.voice.name) ? 0.85 : 1; // ovoz erkak emas bo'lsa — pastroq ton
            u.onerror = (e) => { this.lastError = e.error || 'xato'; };
            u.onstart = () => { this.lastError = ''; };
            SS.speak(u);
            return true;
        },

        /** Gap variantlaridan tasodifiysini tanlaydi (takrorlanmasin). */
        pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },

        stop() {
            if (SS) SS.cancel();
            this._token++;
            if (this._src) { try { this._src.stop(); } catch (e) { /* allaqachon to'xtagan */ } this._src = null; }
            this.busyUntil = 0;
        },

        // ---------------- Azure Speech ----------------
        _esc(s) { return s.replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c])); },

        /** Matnni Azure orqali audio bufferga aylantiradi (natija keshlanadi). */
        async _azureFetch(text) {
            const key = this.azureVoice() + '|' + this.rate + '|' + text;
            if (this._cache.has(key)) return this._cache.get(key);
            const pct = Math.round((this.rate - 1) * 100);
            const ssml = `<speak version='1.0' xml:lang='uz-UZ'><voice name='${this.azureVoice()}'><prosody rate='${pct >= 0 ? '+' : ''}${pct}%'>${this._esc(text)}</prosody></voice></speak>`;
            const r = await fetch(`https://${this.azureRegion.trim()}.tts.speech.microsoft.com/cognitiveservices/v1`, {
                method: 'POST',
                headers: {
                    'Ocp-Apim-Subscription-Key': this.azureKey.trim(),
                    'Content-Type': 'application/ssml+xml',
                    'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
                },
                body: ssml,
            });
            if (!r.ok) throw new Error(r.status === 401 ? 'kalit noto\'g\'ri (401)' : r.status === 429 ? 'limit tugadi (429)' : 'HTTP ' + r.status);
            App.audio.init();
            const buf = await App.audio.ctx.decodeAudioData(await r.arrayBuffer());
            this._cache.set(key, buf);
            return buf;
        },

        /** Audio bufferni o'yin ovoz yo'li orqali o'ynatadi — shuning uchun yozuvga tushadi. */
        _play(buf) {
            const ctx = App.audio.ctx;
            if (this._src) { try { this._src.stop(); } catch (e) { /* e'tiborsiz */ } }
            const src = ctx.createBufferSource();
            const g = ctx.createGain();
            g.gain.value = 1.6;                         // diktor o'yin ovozlaridan balandroq
            src.buffer = buf;
            src.connect(g); g.connect(App.audio.master);
            src.start();
            this._src = src;
            this.busyUntil = performance.now() + buf.duration * 1000;
            src.onended = () => { if (this._src === src) { this._src = null; this.busyUntil = 0; } };
        },

        /** Kesh uchun oldindan tayyorlab qo'yish (intro/outro gaplari). */
        prefetch(texts) {
            if (!this.recordsItself() || !this.enabled || (this.engine === 'azure' && !this.azureKey)) return;
            for (const t of texts) { const c = this.clean(t); if (c) this._fetch(c).catch(() => {}); }
        },

        _fetch(t) { return this.engine === 'espeak' ? this._espeakFetch(t) : this._azureFetch(t); },

        // ---------------- eSpeak-NG (oflayn, WebAssembly) ----------------
        /** lib/espeak ni bir marta yuklab, WebAssembly modulini kompilyatsiya qiladi. */
        _espeakLoad() {
            if (this._espeak) return this._espeak;
            const me = document.querySelector('script[src*="narrator.js"]');
            const url = (f) => new URL('../../lib/espeak/' + f, me ? me.src : location.href).href;
            const load = (src) => new Promise((res, rej) => {
                const s = document.createElement('script');
                s.src = src; s.onload = res; s.onerror = () => rej(new Error('lib/espeak fayli topilmadi'));
                document.head.appendChild(s);
            });
            this._espeak = (async () => {
                if (!window.ESpeakNG) await load(url('espeak-ng.js'));
                if (!window.ESPEAK_WASM_B64) await load(url('espeak-ng.wasm.js'));
                const bin = atob(window.ESPEAK_WASM_B64), n = bin.length, u8 = new Uint8Array(n);
                for (let i = 0; i < n; i++) u8[i] = bin.charCodeAt(i);
                window.ESPEAK_WASM_B64 = null;                                // 25 MB matnni xotiradan bo'shatish
                return WebAssembly.compile(u8);
            })();
            this._espeak.catch(() => { this._espeak = null; });
            return this._espeak;
        },

        /** eSpeak uchun o'zbek imlosi: turli apostroflar bitta ko'rinishga. */
        _uzForEspeak(t) { return t.replace(/[ʻʼ’‘`]/g, "'"); },

        async _espeakFetch(text) {
            const voice = this.gender === 'female' ? 'uz+f3' : 'uz+m3';
            const key = 'es|' + voice + '|' + this.rate + '|' + text;
            if (this._cache.has(key)) return this._cache.get(key);
            const mod = await this._espeakLoad();
            const args = ['-v', voice, '-s', String(Math.round(150 * this.rate)), '-p', this.gender === 'female' ? '58' : '40', '-g', '2', '-w', '/out.wav', this._uzForEspeak(text)];
            const inst = await window.ESpeakNG({
                arguments: args,
                print() {}, printErr() {},
                instantiateWasm(imports, ok) { WebAssembly.instantiate(mod, imports).then(i => ok(i, mod)); return {}; },
            });
            const wav = inst.FS.readFile('/out.wav');
            App.audio.init();
            const buf = await App.audio.ctx.decodeAudioData(wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength));
            this._cache.set(key, buf);
            return buf;
        },

        _sayAudio(text, o) {
            if (!this.enabled || !App.audio.ctx || (this.engine === 'azure' && !this.azureKey)) return false;
            const t = this.clean(text);
            if (!t) return false;
            if (!o.interrupt && performance.now() < this.busyUntil) return false;   // gap ustiga gap chiqmasin
            const token = ++this._token;
            if (o.interrupt) { if (this._src) { try { this._src.stop(); } catch (e) { /* e'tiborsiz */ } this._src = null; } }
            this.busyUntil = performance.now() + 1500;                               // yuklanayotgan payt ham band
            this._fetch(t).then((buf) => {
                if (token !== this._token) return;                                    // bu orada boshqa gap keldi
                this.lastError = '';
                this._play(buf);
            }).catch((e) => { this.lastError = (e && e.message) || String(e) || 'xato'; this.busyUntil = 0; });
            return true;
        },
    };

    Narrator.load();
    App.tts = Narrator;
})(window.App = window.App || {});
