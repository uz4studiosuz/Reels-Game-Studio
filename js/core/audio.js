/* core/audio.js — WebAudio sintezator. Ovoz ham dinamikka, ham video yozuviga boradi. */
(function (App) {
    'use strict';

    const PENTA = [0, 2, 4, 7, 9];

    const Audio = {
        ctx: null,
        master: null,
        dest: null,
        muted: false,
        _last: 0,

        /** Foydalanuvchi harakatidan keyin chaqiriladi (brauzer talabi). */
        init() {
            if (!this.ctx) {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (!AC) return;
                this.ctx = new AC();
                this.master = this.ctx.createGain();
                this.master.gain.value = 0.9;
                this.master.connect(this.ctx.destination);
                this.dest = this.ctx.createMediaStreamDestination();
                this.master.connect(this.dest);
            }
            if (this.ctx.state === 'suspended') this.ctx.resume();
        },

        get stream() { return this.dest ? this.dest.stream : null; },

        tone(freq, dur = 0.12, type = 'sine', vol = 0.12, slide = 0) {
            if (!this.ctx || this.muted) return;
            const nowMs = performance.now();
            if (nowMs - this._last < 16) return; // bir kadrda ovoz to'planib qolmasin
            this._last = nowMs;
            const t = this.ctx.currentTime;
            const o = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            o.type = type;
            o.frequency.setValueAtTime(freq, t);
            if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
            g.gain.setValueAtTime(vol, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + dur);
            o.connect(g);
            g.connect(this.master);
            o.start(t);
            o.stop(t + dur + 0.02);
        },

        /** Pentatonik gamma bo'yicha nota (i — butun son, istalgan oktava). */
        note(i, dur = 0.2, type = 'triangle', vol = 0.13) {
            const oct = Math.floor(i / 5);
            const n = PENTA[((i % 5) + 5) % 5] + 12 * oct;
            this.tone(261.63 * Math.pow(2, n / 12), dur, type, vol);
        },

        // tayyor effektlar
        tick(i = 0) { this.tone(520 + (i % 8) * 40, 0.04, 'square', 0.04); },
        hit(power = 1) { this.tone(160 + power * 30, 0.07, 'square', 0.05, 0.5); },
        pop() { this.tone(520, 0.09, 'sine', 0.1, 1.6); },
        boom() { this.tone(260, 0.35, 'sawtooth', 0.12, 0.25); },
        whoosh() { this.tone(300, 0.25, 'sine', 0.06, 2.5); },
        win() { [0, 4, 7, 12].forEach((n, i) => setTimeout(() => this.tone(392 * Math.pow(2, n / 12), 0.3, 'triangle', 0.18), i * 110)); },
        lose() { this.tone(300, 0.5, 'sawtooth', 0.1, 0.3); },
    };

    App.audio = Audio;
})(window.App = window.App || {});
