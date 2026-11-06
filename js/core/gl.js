/* core/gl.js — barcha 3D o'yinlar uchun umumiy WebGL: bitta kontekst, soyalar, bloom (yorug'lik nuri).
 * Natija `App.gl.canvas` ga chiziladi, o'yin uni 2D sahnaga drawImage bilan qo'yadi. */
(function (App) {
    'use strict';
    const BASE_W = 720, BASE_H = 1280;

    const GL = {
        scale: 1.5,
        canvas: null,
        renderer: null,
        composer: null,
        bloom: null,
        renderPass: null,

        setScale(s) {
            this.scale = s;
            if (this.renderer) this._resize();
        },

        _resize() {
            const w = Math.round(BASE_W * this.scale), h = Math.round(BASE_H * this.scale);
            this.renderer.setSize(w, h, false);
            if (this.composer) {
                this.composer.setSize(w, h);
                this.bloom.setSize(w, h);
            }
        },

        /** Kontekstni (kerak bo'lsa) yaratadi. */
        init() {
            if (this.renderer) return this;
            const canvas = (this.canvas = document.createElement('canvas'));
            const renderer = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }));
            renderer.setPixelRatio(1);
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            const w = Math.round(BASE_W * this.scale), h = Math.round(BASE_H * this.scale);
            renderer.setSize(w, h, false);

            if (THREE.EffectComposer && THREE.UnrealBloomPass) {
                try {
                    const rt = new THREE.WebGLMultisampleRenderTarget(w, h, { format: THREE.RGBAFormat });
                    rt.samples = 4;
                    this.composer = new THREE.EffectComposer(renderer, rt);
                    this.renderPass = new THREE.RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
                    this.composer.addPass(this.renderPass);
                    this.bloom = new THREE.UnrealBloomPass(new THREE.Vector2(w, h), 0.75, 0.55, 0.78);
                    this.composer.addPass(this.bloom);
                } catch (e) {
                    this.composer = null; // bloomsiz oddiy rejim
                }
            }
            return this;
        },

        /** @param {{bloom?:number}} o */
        render(scene, camera, o = {}) {
            this.init();
            if (this.composer) {
                this.renderPass.scene = scene;
                this.renderPass.camera = camera;
                this.bloom.strength = o.bloom !== undefined ? o.bloom : 0.75;
                this.bloom.threshold = o.threshold !== undefined ? o.threshold : 0.78;
                this.composer.render();
            } else {
                this.renderer.render(scene, camera);
            }
        },
    };

    App.gl = GL;
})(window.App = window.App || {});
