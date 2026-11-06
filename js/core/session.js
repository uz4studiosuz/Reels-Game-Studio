/* core/session.js — bitta o'yin seansi: sahna, qat'iy 60 Hz sikl, intro, natija.
 *
 * Session o'yinga `env` beradi — o'yin faqat shu interfeys orqali tashqi dunyo bilan gaplashadi:
 *   env.ctx, env.W, env.H, env.arena       chizish uchun
 *   env.cfg                                 shu o'yinning sozlamalari
 *   env.speed / env.drama / env.targetSec   umumiy video sozlamalari
 *   env.tick, env.sched()                   vaqt (60 Hz) va jadval (0..1.1)
 *   env.rand(), env.rnd(a,b)                seed asosidagi tasodifiylik
 *   env.participants(n)                     nik yoki emoji ishtirokchilar
 *   env.fx, env.audio                       effektlar va ovoz
 *   env.finish({title, sub, color, kicker}) o'yin tugadi
 */
(function (App) {
    'use strict';
    const { clamp, mulberry32, hashStr } = App.util;

    const W = 720, H = 1280;
    const STEP_MS = 1000 / 60;
    const ARENA = { x: 24, y: 240, w: 672, h: 900 };
    const END_HOLD = 5 * 60;   // g'olib kartasi ko'rinib turadigan tick soni
    const OUTRO = 4 * 60;      // yakuniy ekran (logotip + obuna/komment chaqiruvi)

    class Session {
        constructor(canvas) {
            this.canvas = canvas;
            canvas.width = W;
            canvas.height = H;
            this.ctx = canvas.getContext('2d');
            this.fx = new App.FX(W, H);
            this.handlers = {};
            this.inst = null;
            this.def = null;
            this.paused = false;
            this._raf = 0;
            this._last = 0;
            this._acc = 0;
            this._loop = this._loop.bind(this);
            this._bindPointer();
        }

        on(evt, fn) { (this.handlers[evt] = this.handlers[evt] || []).push(fn); return this; }
        _emit(evt, data) { (this.handlers[evt] || []).forEach(fn => fn(data)); }

        get running() { return !!this.inst; }

        start(def, cfg, video) {
            this.stop();
            this.def = def;
            this.cfg = cfg;
            this.video = video;
            this.tick = 0;
            this.endT = 0;
            this.result = null;
            this.fx.reset();
            // sifat: 720p yoki 1080p (mantiqiy koordinatalar har doim 720x1280)
            this.scale = video.quality === '720' ? 1 : 1.5;
            this.canvas.width = Math.round(W * this.scale);
            this.canvas.height = Math.round(H * this.scale);
            if (App.gl) App.gl.setScale(this.scale);
            this.cues = [];            // diktor gaplari (ekranda sarlavha va .srt uchun)
            this.cap = null;
            this._sayLast = {};
            this.community = !!def.roster && cfg.useRoster !== false;
            this.names = App.roster.names.slice(0, 40).map(e => '@' + App.roster.split(e).name);
            this.introTotal = (parseInt(video.intro, 10) || 0) * 60;
            this.introLeft = this.introTotal;
            // Azure diktor: boshlanish va yakun gaplarini oldindan yuklab qo'yamiz (kechikish bo'lmasin)
            App.tts.prefetch([
                [video.hook, def.voiceIntro || (def.roster && cfg.useRoster !== false ? video.cta2 : ''), video.cta3].filter(Boolean).join('. '),
                video.outroSpeak || 'Obuna bo\'ling va nikingizni kommentga yozing!',
            ]);
            const seed = cfg.seed ? hashStr(String(cfg.seed)) : (Math.random() * 4294967296) >>> 0;
            const rand = mulberry32(seed);
            const self = this;

            const env = {
                W, H, ctx: this.ctx, arena: ARENA, fx: this.fx, audio: App.audio, util: App.util, cfg,
                get video() { return video; },
                get speed() { return video.speed; },
                get drama() { return !!video.drama; },
                get targetSec() { return App.videoSettings.DURATIONS[video.duration] || 52; },
                get tick() { return self.tick; },
                sched() { return Math.min(1.1, self.tick / (env.targetSec * 60)); },
                rand, rnd: (a, b) => a + rand() * (b - a),
                participants: (n) => App.roster.participants(n, cfg.useRoster !== false && !!def.roster, rand),
                finish: (r) => self._finish(r),
                // natija chiqqach o'yin gapirmaydi: g'olibni va yakuniy chaqiriqni Session o'zi aytadi
                say: (t, o) => self._say(t, o),
                get quality() { return self.scale; },
            };
            this.env = env;
            this.inst = def.create(env);
            this._acc = 0;
            this._last = 0;
            if (!this._raf) this._raf = requestAnimationFrame(this._loop);
            this._emit('start', def);
        }

        restart() { if (this.def) this.start(this.def, this.cfg, this.video); }

        stop() {
            App.tts.stop();
            if (this.inst && this.inst.dispose) this.inst.dispose();
            this.inst = null;
            this.env = null;
            this.result = null;
            this.fx.reset();
            this._clear();
        }

        _clear() {
            this.ctx.setTransform(this.scale || 1, 0, 0, this.scale || 1, 0, 0);
            this.ctx.fillStyle = App.draw.PAL.bg;
            this.ctx.fillRect(0, 0, W, H);
        }

        _finish(r) {
            if (this.result) return;
            this.result = Object.assign({ color: App.draw.PAL.accent }, r);
            // g'oliblar obunachi profiliga yoziladi (statistika)
            for (const w of (r.winners || (r.winner ? [r.winner] : []))) if (w && w.nick) App.roster.recordGame(w.name, { won: true });
            this.endT = 0;
            App.audio.win();
            this.fx.confetti(90);
            // qisqa e'lon: kartada ko'rinib turadigan vaqtga sig'adi
            this._say(this.result.speak || `G'olib: ${this.result.title}`, { interrupt: true, force: true });
            this._emit('result', this.result);
        }

        _step() {
            if (this.introLeft > 0) {
                this.introLeft--;
                if (this.introLeft === 0) this._intro();
                return;
            }
            if (this.tick === 0 && this.introTotal === 0) this._intro();
            this.tick++;
            if (this.result) {
                this.endT++;
                if (this.endT === END_HOLD) {
                    this._say(this.video.outroSpeak || 'Obuna bo\'ling va nikingizni kommentga yozing!', { interrupt: true, force: true });
                }
                // video so'nishidan oldin diktor jim bo'ladi
                if (this.endT === END_HOLD + OUTRO - 40) App.tts.stop();
                if (this.endT === END_HOLD + OUTRO) this._emit('ended', this.result);
            }
            this.inst.update();
            this.fx.update(1 / 60);
        }

        /** O'yin boshida diktor: komment va obunaga chaqiradi. */
        _intro() {
            const v = this.video;
            const lines = [];
            if (v.hook) lines.push(v.hook);
            if (this.def.voiceIntro) lines.push(this.def.voiceIntro);
            else if (this.community && v.cta2) lines.push(v.cta2);
            if (v.cta3) lines.push(v.cta3);
            this._say(lines.join('. '), { interrupt: true, force: true });
        }

        /** Yozuv boshidan o'tgan soniyalar (intro ham hisobga olinadi). */
        get elapsed() { return (this.introTotal - this.introLeft + this.tick) / 60; }

        /**
         * Diktor gapi: ekranda sarlavha bo'ladi, .srt ga yoziladi va (yoqilgan bo'lsa) ovozda aytiladi.
         * Natija chiqqach faqat Session o'zi gapiradi (force).
         */
        _say(text, o = {}) {
            if (this.result && !o.force) return;
            const now = this.elapsed;
            if (o.key && now - (this._sayLast[o.key] || -99) < (o.cooldown || 4000) / 1000) return;
            if (o.key) this._sayLast[o.key] = now;
            const clean = App.tts.clean(text);
            if (!clean) return;
            const cue = { at: now, text: clean, dur: clamp(clean.split(' ').length * 0.42 + 0.6, 1.8, 6) };
            this.cues.push(cue);
            this.cap = cue;
            App.tts.say(text, { interrupt: o.interrupt });
        }

        /** Diktor matni .srt formatida (video vaqtiga mos). */
        srt() {
            const f = (s) => { const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
            return this.cues.map((c, i) => `${i + 1}\n${f(c.at)} --> ${f(c.at + c.dur)}\n${c.text}\n`).join('\n');
        }

        _render() {
            const ctx = this.ctx;
            ctx.save();
            this.fx.applyShake(ctx);
            this._clear();
            this.inst.draw();
            this.fx.draw(ctx);
            ctx.restore();
            // restore() masshtabni qaytarib yuboradi: qatlam (lenta, vinyetka, karta) ham 1080p ga moslansin
            ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
            App.overlay.draw(ctx, {
                W, H, video: this.video, tick: this.tick, introLeft: this.introLeft,
                introTotal: this.introTotal, result: this.result, endT: this.endT,
                community: this.community, names: this.names, endHold: END_HOLD, outro: OUTRO,
                caption: this.cap && this.elapsed < this.cap.at + this.cap.dur ? this.cap : null, elapsed: this.elapsed,
            });
        }

        _loop(now) {
            this._raf = requestAnimationFrame(this._loop);
            if (!this.inst) return;
            if (!this._last) this._last = now;
            this._acc += Math.min(100, now - this._last);
            this._last = now;
            if (!this.paused) {
                let guard = 0;
                while (this._acc >= STEP_MS && guard++ < 6) { this._step(); this._acc -= STEP_MS; }
            } else this._acc = 0;
            this._render();
        }

        /** Sinov va avtomatlashtirish uchun: render qilmasdan n tick yuritadi. */
        advance(n, untilResult) {
            for (let i = 0; i < n && this.inst; i++) {
                this._step();
                if (untilResult && this.result) break;
            }
            return this.tick;
        }

        _bindPointer() {
            const map = (e) => {
                const r = this.canvas.getBoundingClientRect();
                return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height];
            };
            for (const type of ['down', 'move', 'up']) {
                this.canvas.addEventListener('pointer' + type, (e) => {
                    if (this.inst && this.inst.pointer) { const [x, y] = map(e); this.inst.pointer(type, x, y); }
                });
            }
        }
    }

    Session.W = W;
    Session.H = H;
    Session.ARENA = ARENA;
    App.Session = Session;
})(window.App = window.App || {});
