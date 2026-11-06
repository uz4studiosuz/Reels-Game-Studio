/* core/fx.js — zarralar, konfetti, ko'tariluvchi yozuvlar, ekran silkinishi */
(function (App) {
    'use strict';
    const { TAU, hsl } = App.util;

    class FX {
        constructor(W, H) {
            this.W = W;
            this.H = H;
            this.parts = [];
            this.floats = [];
            this.shake = 0;
        }

        reset() { this.parts.length = 0; this.floats.length = 0; this.shake = 0; }

        burst(x, y, n = 16, o = {}) {
            const { hue = 40, spread = TAU, angle = 0, speed = 360, life = 0.7, size = 7, grav = 900, sat = 85, l = 62 } = o;
            for (let i = 0; i < n; i++) {
                const a = angle + (Math.random() - 0.5) * spread;
                const s = speed * (0.35 + Math.random() * 0.65);
                this.parts.push({
                    x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life,
                    size: size * (0.5 + Math.random() * 0.8), g: grav,
                    color: hsl(Math.round(hue + (Math.random() - 0.5) * 36), sat, l),
                });
            }
        }

        confetti(n = 90) {
            for (let i = 0; i < n; i++) {
                const life = 1.6 + Math.random() * 1.4;
                this.parts.push({
                    x: Math.random() * this.W, y: -20 - Math.random() * 200,
                    vx: (Math.random() - 0.5) * 220, vy: 120 + Math.random() * 380, life, max: life,
                    size: 6 + Math.random() * 8, g: 160, rect: true,
                    color: hsl(Math.round(Math.random() * 360), 85, 62),
                });
            }
        }

        float(text, x, y, o = {}) {
            this.floats.push({ text, x, y, life: o.life || 1, max: o.life || 1, color: o.color || '#fff', size: o.size || 34 });
        }

        kick(amount = 10) { this.shake = Math.max(this.shake, amount); }

        update(dt) {
            for (let i = this.parts.length - 1; i >= 0; i--) {
                const p = this.parts[i];
                p.vy += p.g * dt;
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.life -= dt;
                if (p.life <= 0) this.parts.splice(i, 1);
            }
            for (let i = this.floats.length - 1; i >= 0; i--) {
                const f = this.floats[i];
                f.y -= 46 * dt;
                f.life -= dt;
                if (f.life <= 0) this.floats.splice(i, 1);
            }
            if (this.shake > 0) this.shake *= Math.pow(0.002, dt);
            if (this.shake < 0.4) this.shake = 0;
        }

        /** Sahna siljishi (silkinish) — kadr boshida chaqiriladi. */
        applyShake(ctx) {
            if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
        }

        draw(ctx) {
            for (const p of this.parts) {
                ctx.globalAlpha = Math.max(0, p.life / p.max);
                ctx.fillStyle = p.color;
                if (p.rect) ctx.fillRect(p.x, p.y, p.size, p.size * 0.55);
                else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill(); }
            }
            ctx.globalAlpha = 1;
            for (const f of this.floats) {
                ctx.globalAlpha = Math.min(1, f.life / f.max * 1.6);
                ctx.font = `800 ${f.size}px ${App.draw.FONT}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = f.color;
                ctx.fillText(f.text, f.x, f.y);
            }
            ctx.globalAlpha = 1;
        }
    }

    App.FX = FX;
})(window.App = window.App || {});
