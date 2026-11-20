// หนูออม — UI kit (owner: Opus). Pages build everything with these helpers + theme.css classes.
import { mascotEl, moodInfo } from './mascot.js';

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  append(el, children);
  return el;
}

function append(el, kids) {
  for (const c of kids.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export const icon = (name, extra = '') => h('i', { class: `ti ti-${name} ${extra}`.trim(), 'aria-hidden': 'true' });

export function card({ title, icon: ic, sub, action, tone, body, class: cls } = {}) {
  const head = title || ic || action
    ? h('div', { class: 'card-h' },
        ic ? icon(ic) : null,
        title ? h('h3', null, title, sub ? h('div', { class: 'sub' }, sub) : null) : h('div', { class: 'grow' }),
        action || null)
    : null;
  return h('div', { class: `card${tone ? ' tone-' + tone : ''}${cls ? ' ' + cls : ''}` }, head, body);
}

export function metric({ label, value, sub, tone = '', icon: ic, onClick } = {}) {
  return h('div', { class: `metric ${tone}`, onClick, style: onClick ? { cursor: 'pointer' } : null },
    h('div', { class: 'label' }, ic ? icon(ic) : null, label),
    h('div', { class: 'value' }, value),
    sub ? h('div', { class: `sub ${tone}` }, sub) : null);
}
export const metrics = (items) => h('div', { class: 'metrics' }, items.map(metric));

export const chip = (text, tone = '', onClick) =>
  h('span', { class: `chip${tone ? ' t-' + tone : ''}${onClick ? ' clickable' : ''}`, onClick }, text);

export function progress(pct, tone = 'mint', label) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  const bar = h('div', { class: `progress t-${tone}` }, h('i', { style: { width: p + '%' } }));
  if (!label) return bar;
  return h('div', null, h('div', { class: 'progress-label' }, label), bar);
}

export function listItem({ icon: ic, avatar, avatarTone, title, sub, right, rightSub, rightTone = '', onClick } = {}) {
  let av = null;
  if (ic || avatar) {
    const txt = ic ? '' : String(avatar).slice(0, 6);
    av = h('div', { class: 'avatar' }, ic ? icon(ic) : txt);
    if (txt.length >= 5) { av.style.fontSize = txt.length >= 6 ? '9.5px' : '10.5px'; av.style.letterSpacing = '-.4px'; }
    if (avatarTone) { av.style.background = `var(--${avatarTone}-bg)`; av.style.color = `var(--${avatarTone}-ink)`; }
  }
  return h('div', { class: `li${onClick ? ' clickable' : ''}`, onClick, role: onClick ? 'button' : null, tabindex: onClick ? '0' : null },
    av,
    h('div', { class: 'main' }, h('div', { class: 'title' }, title), sub ? h('div', { class: 'sub' }, sub) : null),
    right !== undefined && right !== null
      ? h('div', { class: 'right' }, h('div', { class: 'r1' }, right), rightSub ? h('div', { class: `r2 ${rightTone}` }, rightSub) : null)
      : null);
}
export const list = (items) => h('div', { class: 'list' }, items.map((i) => (i instanceof Node ? i : listItem(i))));

export function button(text, { variant = '', icon: ic, onClick, small = false, block = false, type = 'button', disabled } = {}) {
  return h('button', { type, class: `btn ${variant}${small ? ' small' : ''}${block ? ' block' : ''}`, onClick, disabled },
    ic ? icon(ic) : null, text);
}

export function segment(options, value, onChange) {
  const wrap = h('div', { class: 'seg', role: 'tablist' });
  const render = (v) => {
    wrap.innerHTML = '';
    for (const o of options) {
      wrap.append(h('button', {
        type: 'button', class: o.value === v ? 'on' : '', role: 'tab', 'aria-selected': o.value === v ? 'true' : 'false',
        onClick: () => { render(o.value); onChange && onChange(o.value); },
      }, o.label));
    }
  };
  render(value);
  return wrap;
}

let fieldSeq = 0;
export function field({ label, type = 'text', value, options = [], placeholder, help, step, min, max, required } = {}) {
  const id = 'f' + (++fieldSeq);
  let input;
  if (type === 'select') {
    input = h('select', { id }, options.map((o) => h('option', { value: o.value }, o.label)));
    if (value !== undefined && value !== null) input.value = value;
  } else if (type === 'textarea') {
    input = h('textarea', { id, placeholder });
    input.value = value ?? '';
  } else if (type === 'checkbox') {
    input = h('input', { id, type: 'checkbox' });
    input.checked = !!value;
  } else {
    input = h('input', { id, type, placeholder, step: step ?? (type === 'number' ? 'any' : null), min, max, inputmode: type === 'number' ? 'decimal' : null, required });
    input.value = value ?? '';
  }
  const err = h('div', { class: 'err hidden' });
  const el = type === 'checkbox'
    ? h('div', { class: 'field check' }, input, h('label', { for: id }, label))
    : h('div', { class: 'field' }, label ? h('label', { for: id }, label) : null, input, help ? h('div', { class: 'help' }, help) : null, err);
  input.addEventListener('input', () => err.classList.add('hidden'));
  return {
    el, input,
    get() {
      if (type === 'checkbox') return input.checked;
      if (type === 'number') return input.value === '' ? '' : Number(input.value);
      return input.value;
    },
    set(v) { if (type === 'checkbox') input.checked = !!v; else input.value = v ?? ''; },
    error(msg) { err.textContent = msg; err.classList.toggle('hidden', !msg); if (msg) input.focus(); },
  };
}

export function form(spec) {
  const fields = {};
  const el = h('div', { class: 'form' });
  for (const [k, s] of Object.entries(spec)) { fields[k] = field(s); el.append(fields[k].el); }
  return {
    el, fields,
    values() { const o = {}; for (const [k, f] of Object.entries(fields)) o[k] = f.get(); return o; },
    error(key, msg) { fields[key] && fields[key].error(msg); },
  };
}

function overlay({ title, body, actions = [], sheet = false, onClose }) {
  const close = () => { bd.remove(); document.removeEventListener('keydown', onKey); onClose && onClose(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const acts = actions.length
    ? h('div', { class: 'modal-actions' }, actions.map((a) => button(a.text, {
        variant: a.variant || '', icon: a.icon,
        onClick: async () => { const r = a.onClick ? await a.onClick(close) : undefined; if (r !== false && !a.keepOpen) close(); },
      })))
    : null;
  const box = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title || '' },
    sheet ? h('div', { class: 'grabber' }) : null,
    h('div', { class: 'modal-h' }, h('h3', null, title || ''), h('button', { class: 'icon-btn', 'aria-label': 'ปิด', onClick: close }, icon('x'))),
    body, acts);
  const bd = h('div', { class: `backdrop${sheet ? ' sheet-mode' : ''}`, onClick: (e) => { if (e.target === bd) close(); } }, box);
  document.body.append(bd);
  document.addEventListener('keydown', onKey);
  return { close, el: box };
}
export const modal = (o) => overlay({ ...o, sheet: false });
export const sheet = (o) => overlay({ ...o, sheet: window.innerWidth < 700 });

export function confirm(text, { okText = 'ตกลง', danger = false } = {}) {
  return new Promise((resolve) => {
    let done = false;
    overlay({
      title: 'แน่ใจไหม?', body: h('p', null, text),
      actions: [
        { text: 'ยกเลิก', variant: 'ghost', onClick: () => { done = true; resolve(false); } },
        { text: okText, variant: danger ? 'danger' : 'primary', onClick: () => { done = true; resolve(true); } },
      ],
      onClose: () => { if (!done) resolve(false); },
    });
  });
}

let toastWrap;
export function toast(text, tone = '') {
  if (!toastWrap) { toastWrap = h('div', { class: 'toast-wrap', 'aria-live': 'polite' }); document.body.append(toastWrap); }
  const t = h('div', { class: `toast${tone ? ' t-' + tone : ''}` }, text);
  toastWrap.append(t);
  setTimeout(() => t.remove(), 2600);
}

export const mascot = (mood = 'happy', size = 56, opts) => mascotEl(mood, size, opts);
export const mascotSays = (mood) => moodInfo(mood).say;

export function empty({ mood = 'sleep', title, text, action } = {}) {
  return h('div', { class: 'empty' }, mascot(mood, 88, { bob: true }), title ? h('h3', null, title) : null,
    text ? h('p', null, text) : null, action || null);
}

export function section(title, action) {
  return h('div', { class: 'section-h' }, h('h3', null, title), action || null);
}

export const disclaimer = () => h('div', { class: 'disclaimer' }, icon('info-circle'), 'ข้อมูลเพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน');

export function skeleton(lines = 3) {
  return h('div', { class: 'skeleton', 'aria-busy': 'true' },
    Array.from({ length: lines }, (_, i) => h('i', { style: { width: `${90 - (i % 3) * 18}%` } })));
}

export function errorBox(err, retry) {
  return card({ tone: 'peach', body: h('div', { class: 'row' }, mascot('worried', 44),
    h('div', { class: 'grow' }, h('b', null, 'โหลดข้อมูลไม่สำเร็จ'), h('div', { class: 'small' }, String(err?.message || err || ''))),
    retry ? button('ลองใหม่', { small: true, variant: 'soft', onClick: retry }) : null) });
}

// ---------- tiny SVG charts ----------
const SVGNS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs) => { const e = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v); return e; };

export const PALETTE = ['#F7A8C0', '#9CCBF2', '#FFD873', '#8FD9BE', '#C3B5F5', '#FFB997', '#F4C7E1', '#B5E2F0', '#E8D27A', '#CFC3C8'];
export const CLS_COLOR = { TH: '#F7A8C0', US: '#9CCBF2', CRYPTO: '#FFD873', GOLD: '#FFB997', CASH: '#8FD9BE', OTHER: '#C3B5F5' };

export function donut(segments, size = 140, { thickness = 22, center } = {}) {
  const total = segments.reduce((a, b) => a + Math.max(0, Number(b.value) || 0), 0);
  const r = (size - thickness) / 2, c = 2 * Math.PI * r;
  const svg = s('svg', { width: size, height: size, viewBox: `0 0 ${size} ${size}`, role: 'img' });
  svg.append(s('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: 'var(--gray-bg)', 'stroke-width': thickness }));
  let off = 0;
  segments.forEach((seg, i) => {
    const v = Math.max(0, Number(seg.value) || 0);
    if (!total || !v) return;
    const len = (v / total) * c;
    const circ = s('circle', {
      cx: size / 2, cy: size / 2, r, fill: 'none', stroke: seg.color || PALETTE[i % PALETTE.length],
      'stroke-width': thickness, 'stroke-dasharray': `${Math.max(0, len - 2)} ${c}`, 'stroke-dashoffset': -off,
      transform: `rotate(-90 ${size / 2} ${size / 2})`, 'stroke-linecap': 'butt',
    });
    const t = s('title', {}); t.textContent = `${seg.label}: ${((v / total) * 100).toFixed(1)}%`; circ.append(t);
    svg.append(circ);
    off += len;
  });
  if (center) {
    const tx = s('text', { x: '50%', y: '50%', 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: 'var(--ink)', 'font-size': '15', 'font-weight': '700' });
    tx.textContent = center; svg.append(tx);
  }
  return svg;
}

export function legend(segments) {
  return h('div', { class: 'legend' }, segments.map((sg, i) =>
    h('span', null, h('i', { class: 'dot', style: { background: sg.color || PALETTE[i % PALETTE.length] } }), sg.label)));
}

export function spark(values, tone, { w = 90, h: hh = 30 } = {}) {
  const v = (values || []).map(Number).filter(Number.isFinite);
  const svg = s('svg', { width: w, height: hh, viewBox: `0 0 ${w} ${hh}`, 'aria-hidden': 'true' });
  if (v.length < 2) return svg;
  const min = Math.min(...v), max = Math.max(...v), span = max - min || 1;
  const pts = v.map((y, i) => `${(i / (v.length - 1)) * w},${hh - 2 - ((y - min) / span) * (hh - 4)}`).join(' ');
  const t = tone || (v[v.length - 1] >= v[0] ? 'up' : 'down');
  svg.append(s('polyline', { points: pts, fill: 'none', stroke: `var(--${t})`, 'stroke-width': '2', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  return svg;
}

export default {
  h, icon, card, metric, metrics, chip, progress, listItem, list, button, segment, field, form, modal, sheet, confirm, toast,
  mascot, mascotSays, empty, section, disclaimer, skeleton, errorBox, donut, legend, spark, PALETTE, CLS_COLOR,
};
