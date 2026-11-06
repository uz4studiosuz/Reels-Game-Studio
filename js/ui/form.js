/* ui/form.js — sozlamalar sxemasidan (schema) forma yasaydi.
 * O'yinlar HTML yozmaydi: faqat `settings` massivini e'lon qiladi, forma shu yerda chiziladi. */
(function (App) {
    'use strict';

    function el(tag, cls, html) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (html !== undefined) e.innerHTML = html;
        return e;
    }

    function esc(s) {
        return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    }

    /**
     * @param {HTMLElement} root
     * @param {Array} schema      [{key,label,type,default,min,max,step,options,hint,group,visible(values)}]
     * @param {Object} values     joriy qiymatlar (o'zgartiriladi)
     * @param {Function} onChange (key, value, field) => void
     */
    function render(root, schema, values, onChange) {
        root.innerHTML = '';
        const rows = [];
        let lastGroup = null;

        for (const s of schema) {
            if (s.group && s.group !== lastGroup) {
                root.appendChild(el('div', 'group', esc(s.group)));
                lastGroup = s.group;
            }
            const row = el('div', 'field');
            row.dataset.key = s.key;
            const head = el('div', 'field-head');
            head.appendChild(el('label', 'field-label', esc(s.label)));
            const out = el('span', 'field-out');
            head.appendChild(out);
            row.appendChild(head);

            const set = (v) => { values[s.key] = v; onChange(s.key, v, s); refresh(); };
            let control;

            if (s.type === 'range') {
                control = el('input');
                Object.assign(control, { type: 'range', min: s.min, max: s.max, step: s.step || 1, value: values[s.key] });
                const showVal = () => { out.textContent = values[s.key] + (s.unit || ''); };
                control.addEventListener('input', () => { values[s.key] = parseFloat(control.value); showVal(); onChange(s.key, values[s.key], s); refresh(); });
                showVal();
            } else if (s.type === 'toggle') {
                control = el('label', 'switch');
                const inp = el('input');
                inp.type = 'checkbox';
                inp.checked = !!values[s.key];
                inp.addEventListener('change', () => set(inp.checked));
                control.appendChild(inp);
                control.appendChild(el('span', 'knob'));
            } else if (s.type === 'segment') {
                control = el('div', 'segment');
                for (const o of s.options) {
                    const [val, label] = Array.isArray(o) ? o : [o, o];
                    const b = el('button', 'seg', esc(label));
                    b.type = 'button';
                    b.dataset.v = String(val);
                    if (String(values[s.key]) === String(val)) b.classList.add('on');
                    b.addEventListener('click', () => {
                        control.querySelectorAll('.seg').forEach(x => x.classList.remove('on'));
                        b.classList.add('on');
                        set(val);
                    });
                    control.appendChild(b);
                }
            } else if (s.type === 'select') {
                control = el('select');
                for (const o of s.options) {
                    const [val, label] = Array.isArray(o) ? o : [o, o];
                    const op = el('option', '', esc(label));
                    op.value = String(val);
                    control.appendChild(op);
                }
                control.value = String(values[s.key]);
                control.addEventListener('change', () => set(control.value));
            } else if (s.type === 'textarea') {
                control = el('textarea');
                control.rows = s.rows || 4;
                control.value = values[s.key] || '';
                control.placeholder = s.placeholder || '';
                control.addEventListener('change', () => set(control.value));
            } else if (s.type === 'number') {
                control = el('input');
                Object.assign(control, { type: 'number', min: s.min, max: s.max, step: s.step || 1, value: values[s.key] });
                control.addEventListener('change', () => {
                    let v = parseFloat(control.value);
                    if (isNaN(v)) v = s.default;
                    v = Math.min(s.max !== undefined ? s.max : v, Math.max(s.min !== undefined ? s.min : v, v));
                    control.value = v;
                    set(v);
                });
            } else if (s.type === 'button') {
                control = el('button', 'btn solid', esc(s.buttonText || s.label));
                control.type = 'button';
                control.style.width = '100%';
                control.style.margin = '6px 0';
                control.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (typeof s.onClick === 'function') s.onClick({ values, refresh, onChange, set, btn: control });
                });
            } else { // text
                control = el('input');
                control.type = s.type === 'password' ? 'password' : 'text';
                control.autocomplete = 'off';
                control.value = values[s.key] || '';
                control.placeholder = s.placeholder || '';
                control.addEventListener('change', () => set(control.value));
            }

            row.appendChild(control);
            let hintEl = null;
            if (s.hint) {
                const hintText = typeof s.hint === 'function' ? s.hint(values) : s.hint;
                hintEl = el('div', 'field-hint', esc(hintText));
                row.appendChild(hintEl);
            }
            root.appendChild(row);
            rows.push({ s, row, hintEl });
        }

        function refresh() {
            for (const { s, row, hintEl } of rows) {
                if (s.visible) row.hidden = !s.visible(values);
                if (s.active) {
                    const isActive = !!s.active(values);
                    row.classList.toggle('is-disabled', !isActive);
                    const inps = row.querySelectorAll('input, select, textarea, button');
                    inps.forEach(i => { i.disabled = !isActive; });
                }
                if (hintEl && typeof s.hint === 'function') {
                    hintEl.textContent = s.hint(values);
                }
            }
        }
        refresh();
    }

    App.form = { render };
})(window.App = window.App || {});
