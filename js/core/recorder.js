/* core/recorder.js — canvasdan video (+ovoz) yozish */
(function (App) {
    'use strict';

    const MIMES = [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
    ];

    class Recorder {
        constructor(canvas) {
            this.canvas = canvas;
            this.rec = null;
            this.chunks = [];
            this.active = false;
        }

        static supported() { return !!(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream); }

        /**
         * @param {{display?: MediaStream}} o  display: getDisplayMedia oqimi (tab audio) — diktor ovozi shu orqali yoziladi
         * @returns {boolean} ovoz manbai sifatida tab audio ishlatildimi
         */
        start(o = {}) {
            App.audio.init();
            const tracks = [...this.canvas.captureStream(60).getVideoTracks()];
            this.display = o.display || null;
            const dispAudio = this.display ? this.display.getAudioTracks() : [];
            const usedTab = dispAudio.length > 0;
            if (usedTab) tracks.push(...dispAudio); // tab audio ichida sfx ham, diktor ham bor
            else if (App.audio.stream) tracks.push(...App.audio.stream.getAudioTracks());
            const bps = this.canvas.width > 800 ? 14e6 : 8e6;
            const mimeType = MIMES.find(m => MediaRecorder.isTypeSupported(m)) || '';
            this.rec = new MediaRecorder(new MediaStream(tracks), mimeType ? { mimeType, videoBitsPerSecond: bps } : { videoBitsPerSecond: bps });
            this.chunks = [];
            this.rec.ondataavailable = (e) => { if (e.data && e.data.size) this.chunks.push(e.data); };
            this.rec.start(250);
            this.active = true;
            this.startedAt = performance.now();
            return usedTab;
        }

        /** @returns {Promise<{url:string,ext:string,size:number,seconds:number}>} */
        stop() {
            return new Promise((resolve) => {
                if (!this.rec || this.rec.state === 'inactive') { this.active = false; resolve(null); return; }
                this.rec.onstop = async () => {
                    if (this.display) { this.display.getTracks().forEach(t => t.stop()); this.display = null; }
                    const type = (this.rec.mimeType || 'video/webm').split(';')[0];
                    const seconds = (performance.now() - this.startedAt) / 1000;
                    let blob = new Blob(this.chunks, { type });
                    this.active = false;
                    // Brauzer yozgan fayl davomiyligi 0 / bo'laklangan bo'ladi — pleyerlar "2 soniya" ko'rsatadi.
                    // Faylni oddiy MP4 ga qayta yig'amiz (WebM ga Duration yozamiz).
                    let fixed = false;
                    try {
                        const ab = await blob.arrayBuffer();
                        const out = type.includes('mp4') ? App.mp4fix.defragment(ab) : App.mp4fix.webmDuration(ab, seconds * 1000);
                        blob = new Blob([out], { type });
                        fixed = true;
                    } catch (e) { console.warn('Video davomiyligini tuzatib bo\'lmadi:', e); }
                    resolve({
                        url: URL.createObjectURL(blob),
                        ext: type.includes('mp4') ? 'mp4' : 'webm',
                        size: blob.size,
                        seconds,
                        fixed,
                    });
                };
                this.rec.stop();
            });
        }
    }

    App.Recorder = Recorder;
})(window.App = window.App || {});
