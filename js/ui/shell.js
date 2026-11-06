/* ui/shell.js — ilova qobig'i: bosh sahifa, studiya, yozish, obunachilar paneli.
 * O'yinlarning ichki tuzilishini bilmaydi: faqat registry va Session bilan gaplashadi. */
(function (App) {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const LS = {
        get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
        set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* xotira yopiq */ } },
    };

    // Bosh sahifa ikki toifaga bo'linadi: obunachilarni kommentga undaydigan va obunachisiz (ASMR) o'yinlar
    const SECTIONS = [
        { title: 'Obunachilar bilan', note: 'Komment yozdiring — nik o\'yinda qatnashadi', test: d => d.roster },
        { title: 'ASMR · obunachisiz', note: 'Tinch, hipnotik, hech kim kerak emas', test: d => !d.roster },
    ];

    const Shell = {
        session: null,
        recorder: null,
        def: null,
        cfg: null,
        video: null,
        recTimerId: 0,
        _restartT: 0,

        init() {
            this.session = new App.Session($('stage'));
            this.recorder = App.Recorder.supported() ? new App.Recorder($('stage')) : null;
            this.video = Object.assign(App.videoSettings.defaults(), LS.get('rl.video', {}));
            this.video.speed = this.video.speed || 1;

            this._renderIndex();
            if (App.tts.supported && speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', () => { if (this.def) this._renderVoice(); });
            this._bindChrome();
            this._bindRoster();
            this.session.on('ended', () => { if (this.recorder && this.recorder.active && this.video.autoStop) this._stopRec(); });

            window.addEventListener('hashchange', () => this._route());
            this._route();
        },

        // ---------- yo'naltirish ----------
        _route() {
            const m = location.hash.match(/^#\/game\/([\w-]+)/);
            const def = m && App.registry.get(m[1]);
            if (def) this._openGame(def);
            else this._openHome();
        },

        _openHome() {
            this.session.stop();
            if (this.recorder && this.recorder.active) this._stopRec();
            $('studio').hidden = true;
            $('home').hidden = false;
            $('homeRosterCount').textContent = App.roster.names.length;
        },

        _openGame(def) {
            this.def = def;
            $('home').hidden = true;
            $('studio').hidden = false;
            $('gameName').textContent = def.name;
            $('gameTagline').textContent = def.tagline;
            $('saveLink').hidden = true;

            this.cfg = Object.assign(App.registry.defaults(def), LS.get('rl.cfg.' + def.id, {}));
            App.form.render($('panelGame'), def.settings, this.cfg, () => { LS.set('rl.cfg.' + def.id, this.cfg); this._scheduleRestart(); });
            if (def.help) {
                const h = document.createElement('div');
                h.className = 'game-help';
                h.textContent = def.help;
                $('panelGame').prepend(h);
            }
            App.form.render($('panelVideo'), App.videoSettings.SCHEMA, this.video, (key) => {
                LS.set('rl.video', this.video);
                if (key === 'intro' || key === 'quality') this._scheduleRestart(); // qolganlari jonli o'zgaradi
            });
            this._renderVoice();
            this._tab('game');
            this._start();
        },

        /** Sahnani tayyorlaydi (birinchi kadr ko'rinadi), lekin boshlamaydi — foydalanuvchi tanlaydi. */
        _prepare() {
            if (this.recorder && this.recorder.active) this._stopRec();
            this.session.start(this.def, this.cfg, this.video);
            this.session.paused = true;
            $('btnPause').textContent = 'Pauza';
            $('gate').hidden = false;
        },

        /** Tanlovdan keyin o'yinni boshlaydi (intro ham yozuvga tushadi). */
        async _go(record) {
            App.audio.init();
            $('gate').hidden = true;
            $('recNote').textContent = '';
            // diktor ovozini yozuvga olish uchun brauzer oynasining audiosi kerak
            let display = null;
            // Azure ovozi o'yin ovoz yo'lidan o'tadi — tab audio kerak emas
            if (record && this.recorder && App.tts.enabled && !App.tts.recordsItself() && App.tts.record) display = await this._captureTab();
            this.session.restart();
            if (record && this.recorder) this._beginRec(display);
            this.session.paused = false;
        },

        async _captureTab() {
            $('recNote').textContent = App.tts.captureMode === 'system'
                ? 'Brauzer so\'raydi: "Butun ekran"ni tanlab, "Tizim ovozini ulashish"ni yoqing.'
                : 'Brauzer so\'raydi: shu oynani tanlab, "Tab audio"ni yoqing.';
            try {
                const opts = App.tts.captureMode === 'system'
                    ? { video: true, audio: true, systemAudio: 'include' }
                    : { video: true, audio: true, preferCurrentTab: true, selfBrowserSurface: 'include', systemAudio: 'include' };
                const ds = await navigator.mediaDevices.getDisplayMedia(opts);
                $('recNote').textContent = '';
                return ds;
            } catch (e) {
                $('recNote').textContent = 'Audio ruxsati berilmadi: yozuvda faqat o\'yin ovozlari bo\'ladi (diktor matni ekranda sarlavha bo\'ladi).';
                return null;
            }
        },

        _start() { this._prepare(); },

        _scheduleRestart() {
            clearTimeout(this._restartT);
            this._restartT = setTimeout(() => { if (this.def && !$('studio').hidden) this._start(); }, 280);
        },

        _tab(name) {
            document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === name));
            $('panelGame').hidden = name !== 'game';
            $('panelVideo').hidden = name !== 'video';
            $('panelVoice').hidden = name !== 'video';
            $('panelRoster').hidden = name !== 'roster';
            if (name === 'game' && this.def) {
                App.form.render($('panelGame'), this.def.settings, this.cfg, () => {
                    LS.set('rl.cfg.' + this.def.id, this.cfg);
                    this._scheduleRestart();
                });
            }
        },

        // ---------- ovozli diktor paneli ----------
        _renderVoice() {
            const root = $('panelVoice'), t = App.tts;
            root.innerHTML = '';
            const info = t.describe();
            const rank = (v) => (/^uz/i.test(v.lang) ? 0 : /^tr/i.test(v.lang) ? 1 : 2);
            const all = t.voices().slice().sort((a, b) => rank(a) - rank(b));
            const az = (v) => v.engine === 'azure', br = (v) => v.engine === 'browser';
            const schema = [
                { group: 'Ovozli diktor (o\'zbekcha)', key: 'enabled', label: 'Diktor gapirsin', type: 'toggle', default: false },
                { key: 'engine', label: 'Ovoz manbai', type: 'segment', default: 'browser', options: [['azure', 'Azure'], ['espeak', 'eSpeak (oflayn)'], ['browser', 'Brauzer']], hint: 'Azure va eSpeak ovozi MP4 ga avtomatik yoziladi. Azure — tabiiy neyron ovoz (Sardor, Madina; bepul rejada oyiga 500 ming belgi, kalit kerak). eSpeak — internet va kalitsiz, lekin robotroq. Brauzer ovozi videoga tushmaydi.' },
                { key: 'azureKey', label: 'Azure kaliti (KEY 1)', type: 'password', default: '', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', visible: az, hint: 'portal.azure.com → "Speech service" yarating (Pricing: Free F0) → "Keys and Endpoint". Kalit faqat shu kompyuterda saqlanadi.' },
                { key: 'azureRegion', label: 'Region', type: 'text', default: 'westeurope', placeholder: 'westeurope', visible: az, hint: '"Keys and Endpoint" sahifasidagi Location/Region (masalan: westeurope, eastus).' },
                { key: 'gender', label: 'Ovoz jinsi', type: 'segment', default: 'male', options: [['male', 'Erkak (Sardor)'], ['female', 'Ayol (Madina)']] },
                { key: 'voiceName', label: 'Ovoz', type: 'select', default: '', visible: br, options: [['', 'Avto (o\'zbek, bo\'lmasa turk)'], ...all.map(v => [v.name, `${v.name} · ${v.lang}`])] },
                { key: 'fallback', label: 'Zaxira turk ovozi', type: 'toggle', default: true, visible: br, hint: 'O\'zbek ovozi bo\'lmasa, turkcha ovoz o\'zbek matnini o\'qiydi' },
                { key: 'rate', label: 'Tezlik', type: 'range', min: 0.8, max: 1.3, step: 0.05, default: 1, unit: '×' },
                { key: 'record', label: 'Brauzer ovozini videoga qo\'shishga urinish', type: 'toggle', default: true, visible: br, hint: 'Yozish boshlanganda brauzer audiosini ulashish so\'raladi. Har kompyuterda ham ishlamaydi — ishonchli yo\'l: Azure.' },
                { key: 'captureMode', label: 'Ovoz olish usuli', type: 'segment', default: 'tab', visible: br, options: [['tab', 'Shu oyna (tab)'], ['system', 'Butun tizim ovozi']], hint: 'Tab: ro\'yxatda shu oynani tanlab, "Tab audio"ni yoqing. Bo\'lmasa — "Butun ekran" + "Tizim ovozini ulashish".' },
            ];
            App.form.render(root, schema, t, () => { t.save(); this._renderVoice(); });
            const status = document.createElement('div');
            status.className = 'rost-note';
            status.style.color = info.ok ? '#2f7d4f' : 'var(--accent)';
            status.textContent = info.text;
            root.insertBefore(status, root.children[1] || null);
            const btn = document.createElement('button');
            btn.className = 'btn';
            btn.style.marginTop = '14px';
            btn.textContent = 'Ovozni sinash';
            btn.addEventListener('click', () => {
                App.audio.init();
                t.lastError = '';
                const was = t.enabled; t.enabled = true;
                const tried = t.say('Salom! Nikingni kommentga yoz, obuna bo\'l va o\'yinda qatnash.', { interrupt: true });
                t.enabled = was;
                setTimeout(() => {
                    status.style.color = tried && !t.lastError ? '#2f7d4f' : 'var(--accent)';
                    status.textContent = !tried ? t.describe().text : (t.lastError ? `Xato: ${t.lastError}.` + (t.engine === 'azure' ? ' Kalit va regionni tekshiring.' : t.engine === 'espeak' ? ' lib/espeak papkasi joyida ekanini tekshiring.' : ' Boshqa ovoz tanlang yoki Edge\'da oching.') : t.describe().text + ' — eshitdingizmi?');
                }, t.engine === 'espeak' ? 5000 : t.engine === 'azure' ? 2500 : 1200);
            });
            root.appendChild(btn);
        },

        // ---------- bosh sahifa ----------
        _renderIndex() {
            const root = $('index');
            let n = 0;
            for (const sec of SECTIONS) {
                const defs = App.registry.list.filter(sec.test);
                if (!defs.length) continue;
                const h = document.createElement('div');
                h.className = 'group-title';
                h.innerHTML = `${sec.title}<span class="group-note">${sec.note}</span>`;
                root.appendChild(h);
                for (const d of defs) {
                    n++;
                    const b = document.createElement('button');
                    b.className = 'row';
                    b.innerHTML = `<span class="n">${String(n).padStart(2, '0')}</span>
                        <span class="name">${d.name}<span class="sub">${d.tagline}</span></span>
                        <span class="tags">${d.roster ? '<span class="tag hot">nik</span>' : ''}${d.tags.map(t => `<span class="tag">${t}</span>`).join('')}</span>
                        <span class="go">→</span>`;
                    b.addEventListener('click', () => { location.hash = '#/game/' + d.id; });
                    root.appendChild(b);
                }
            }
        },

        // ---------- boshqaruv ----------
        _bindChrome() {
            $('navHome').addEventListener('click', () => { location.hash = ''; });
            $('btnBack').addEventListener('click', () => { location.hash = ''; });
            $('navMute').addEventListener('click', () => {
                App.audio.muted = !App.audio.muted;
                $('navMute').textContent = 'Ovoz: ' + (App.audio.muted ? 'o\'chiq' : 'yoqilgan');
            });
            $('btnRestart').addEventListener('click', () => this._prepare());
            $('gateRec').addEventListener('click', () => this._go(true));
            $('gatePlay').addEventListener('click', () => this._go(false));
            $('btnPause').addEventListener('click', () => {
                this.session.paused = !this.session.paused;
                $('btnPause').textContent = this.session.paused ? 'Davom' : 'Pauza';
            });
            $('btnRec').addEventListener('click', () => (this.recorder && this.recorder.active ? this._stopRec() : this._startRec()));
            document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => this._tab(t.dataset.tab)));
            if (!this.recorder) { $('btnRec').disabled = true; $('btnRec').title = 'Brauzer video yozishni qo\'llamaydi'; }
        },

        // ---------- yozish ----------
        _startRec() {
            this._go(true); // intro bilan boshidan
        },

        _beginRec(display) {
            $('saveLink').hidden = true;
            $('srtLink').hidden = true;
            const usedTab = this.recorder.start({ display });
            if (display && !usedTab) $('recNote').textContent = 'Audio ulashilmadi (katakcha belgilanmagan): diktor ovozi yozuvga tushmaydi. Qayta yozing va audio katakchasini yoqing; matn esa ekranda sarlavha bo\'ladi.';
            else if (usedTab) $('recNote').textContent = 'Diktor ovozi yozuvga ulandi.';
            $('btnRec').textContent = 'To\'xtatish';
            $('btnRec').classList.add('live');
            const t0 = performance.now();
            this.recTimerId = setInterval(() => {
                const s = Math.floor((performance.now() - t0) / 1000);
                $('recTimer').textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
            }, 500);
            $('recTimer').textContent = '00:00';
        },

        async _stopRec() {
            clearInterval(this.recTimerId);
            $('btnRec').textContent = 'Yozish';
            $('btnRec').classList.remove('live');
            const r = await this.recorder.stop();
            if (!r) return;
            const a = $('saveLink');
            a.href = r.url;
            a.download = `reels-${this.def.id}-${Date.now()}.${r.ext}`;
            a.textContent = `Saqlash · ${r.ext.toUpperCase()} · ${(r.size / 1048576).toFixed(1)} MB`;
            a.hidden = false;
            // diktor matni (.srt): montaj dasturida (CapCut va h.k.) subtitr yoki ovoz uchun
            const s = $('srtLink');
            if (this.session.cues && this.session.cues.length) {
                s.href = URL.createObjectURL(new Blob([this.session.srt()], { type: 'text/plain' }));
                s.download = `reels-${this.def.id}-diktor.srt`;
                s.hidden = false;
            } else s.hidden = true;
        },

        // ---------- obunachilar ----------
        /** Obunachilar jadvali: har biri uchun jangchi turi, jamoa va statistika. */
        _renderRosterTable() {
            const root = $('rosterTable'), R = App.roster;
            if (!root) return;
            const MAX = 150;
            const classes = App.army ? App.army.CLASSES : {};
            const clsOpts = '<option value="">Tasodifiy</option>' + Object.entries(classes).map(([k, c]) => `<option value="${k}">${c.icon} ${c.name}</option>`).join('');

            let cnt0 = 0, cnt1 = 0, cntAuto = 0;
            R.names.forEach(e => {
                const { name } = R.split(e);
                const t = R.profile(name).team;
                if (t === 0) cnt0++;
                else if (t === 1) cnt1++;
                else cntAuto++;
            });
            const summary = R.names.length
                ? `<div class="rost-help" style="margin: 0 0 8px; font-weight: 600;">Jamoalar: <b style="color:#e8452a">Qizil: ${cnt0}</b> · <b style="color:#3b78e8">Ko'k: ${cnt1}</b>${cntAuto ? ` · <span style="color:var(--mute)">Avto: ${cntAuto}</span>` : ''}</div>`
                : '';

            const rows = [`<div class="rost-row head"><span>Nik</span><span>Jangchi</span><span>Jamoa</span><span style="text-align:right">G / O / K</span></div>`];
            R.names.slice(0, MAX).forEach((e, i) => {
                const { name, cls } = R.split(e), pr = R.profile(name);
                const dot = pr.team === 0 ? '#e8452a' : pr.team === 1 ? '#3b78e8' : '#b8b5ab';
                rows.push(`<div class="rost-row" data-name="${name.replace(/"/g, '&quot;')}">
                    <span class="nm"><span class="dot" style="background:${dot}"></span>@${name}</span>
                    <select data-k="cls">${clsOpts.replace(`value="${cls || ''}"`, `value="${cls || ''}" selected`)}</select>
                    <select data-k="team"><option value=""${pr.team === null ? ' selected' : ''}>Avto</option><option value="0"${pr.team === 0 ? ' selected' : ''}>Qizil</option><option value="1"${pr.team === 1 ? ' selected' : ''}>Ko'k</option></select>
                    <span class="st" title="g'alaba / o'yin / o'ldirgan">${pr.wins}/${pr.games}/${pr.kills}</span>
                </div>`);
            });
            if (R.names.length > MAX) rows.push(`<div class="rost-help">… yana ${R.names.length - MAX} ta (jadvalda faqat birinchi ${MAX} ta ko'rsatiladi)</div>`);
            if (!R.names.length) rows.push('<div class="rost-help">Hozircha obunachi yo\'q.</div>');
            root.innerHTML = summary + rows.join('');
            root.querySelectorAll('.rost-row[data-name] select').forEach(sel => sel.addEventListener('change', () => {
                const name = sel.closest('.rost-row').dataset.name;
                if (sel.dataset.k === 'cls') R.setClass(name, sel.value || null);
                else R.setTeam(name, sel.value === '' ? null : parseInt(sel.value, 10));
            }));
        },

        _bindRoster() {
            const sync = () => {
                const n = App.roster.names.length;
                $('rosterCount').textContent = n;
                $('homeRosterCount').textContent = n;
                if (document.activeElement !== $('rosterText')) $('rosterText').value = App.roster.names.join('\n');
                if ($('rosterRealOnly')) $('rosterRealOnly').checked = !!App.roster.realOnly;
                this._renderRosterTable();
                if (this.def && !$('panelGame').hidden) {
                    App.form.render($('panelGame'), this.def.settings, this.cfg, () => {
                        LS.set('rl.cfg.' + this.def.id, this.cfg);
                        this._scheduleRestart();
                    });
                }
            };
            App.roster.onChange(sync);
            sync();
            if ($('rosterRealOnly')) {
                $('rosterRealOnly').addEventListener('change', () => {
                    App.roster.setRealOnly($('rosterRealOnly').checked);
                    this._scheduleRestart();
                });
            }

            // zaxira: faylga saqlash va tiklash
            const note = (t, bad) => { $('rosterNote').textContent = t; $('rosterNote').style.color = bad ? 'var(--accent)' : '#2f7d4f'; };
            $('rosterExport').addEventListener('click', () => {
                const n = App.backup.download();
                note(`Saqlandi: ${n} ta obunachi. Faylni boshqa kompyuterga ko'chiring.`);
            });
            let mode = 'merge';
            $('rosterImport').addEventListener('click', () => { mode = 'merge'; $('rosterFile').click(); });
            $('rosterImportReplace').addEventListener('click', () => {
                if (!confirm('Hozirgi ro\'yxat, jamoa va sozlamalar fayldagisi bilan to\'liq almashtiriladi. Davom etasizmi?')) return;
                mode = 'replace'; $('rosterFile').click();
            });
            $('rosterFile').addEventListener('change', async (e) => {
                const f = e.target.files[0]; e.target.value = '';
                if (!f) return;
                try {
                    const r = App.backup.restore(await f.text(), mode);
                    note(`Tiklandi: ${r.roster} ta obunachi, ${r.profiles} ta profil.` + (mode === 'replace' ? ' Sozlamalar uchun sahifani yangilang.' : ''));
                    this._scheduleRestart();
                } catch (err) { note(err.message, true); }
            });
            if ($('teamsBalance')) {
                $('teamsBalance').addEventListener('click', () => {
                    const r = App.roster.autoDistributeTeams();
                    if (!r.total) {
                        note('Ro\'yxatda obunachilar yo\'q. Avval nik qo\'shing.', true);
                        return;
                    }
                    note(`Taqsimlandi: ${r.team0} ta Qizil, ${r.team1} ta Ko'k (${r.total} ta obunachi).`);
                    this._scheduleRestart();
                });
            }
            $('teamsReset').addEventListener('click', () => { App.roster.resetTeams(); note('Jamoalar tozalandi: keyingi jangda qayta bo\'linadi.'); });
            $('statsReset').addEventListener('click', () => { if (confirm('Barcha g\'alaba va statistika nolga tushiriladi.')) { App.roster.resetStats(); note('Statistika tozalandi.'); } });
            $('rosterText').addEventListener('change', () => { App.roster.set(App.roster.parse($('rosterText').value)); $('rosterText').value = App.roster.names.join('\n'); this._scheduleRestart(); });
            $('rosterShuffle').addEventListener('click', () => { App.roster.set(App.util.shuffle(App.roster.names.slice())); this._scheduleRestart(); });
            $('rosterDemo').addEventListener('click', () => { App.roster.sampleFill(12); this._scheduleRestart(); });
            $('rosterClear').addEventListener('click', () => { App.roster.clear(); this._scheduleRestart(); });
            $('homeRoster').addEventListener('click', () => {
                const first = App.registry.list.find(d => d.roster) || App.registry.list[0];
                location.hash = '#/game/' + first.id;
                setTimeout(() => this._tab('roster'), 80);
            });
        },
    };

    window.addEventListener('DOMContentLoaded', () => Shell.init());
    App.shell = Shell;
})(window.App = window.App || {});
