// หนูออม — app shell + router (owner: Opus)
import ui from './ui.js';
import fmt from './fmt.js';
import api from './api.js';
import store from './store.js';
import * as calc from './calc/index.js';

const { h, icon } = ui;
export const BUILD = '2026-11-20.3';

const TABS = [
  { path: '', icon: 'home', label: 'หน้าแรก' },
  { path: 'portfolio', icon: 'briefcase', label: 'พอร์ต' },
  { path: 'dividends', icon: 'coin', label: 'ปันผล' },
  { path: 'news', icon: 'news', label: 'ข่าว' },
  { path: 'menu', icon: 'layout-grid', label: 'เมนู' },
];
const PAGES = ['home', 'portfolio', 'dividends', 'gold', 'watch', 'news', 'stock', 'screener', 'valuation', 'tools', 'risk', 'journal', 'learn', 'settings', 'menu'];

// ---------- charts (Chart.js UMD loaded in index.html) ----------
let liveCharts = [];
function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function chart(container, config) {
  const C = window.Chart;
  if (!C) { container.append(h('div', { class: 'faint' }, 'โหลดกราฟไม่ได้')); return null; }
  C.defaults.font.family = "'IBM Plex Sans Thai', system-ui, sans-serif";
  C.defaults.font.size = 12;
  C.defaults.color = css('--ink-2');
  C.defaults.borderColor = css('--line');
  C.defaults.plugins.legend.labels.usePointStyle = true;
  C.defaults.plugins.legend.labels.boxWidth = 8;
  C.defaults.plugins.tooltip.backgroundColor = css('--ink');
  C.defaults.plugins.tooltip.titleColor = css('--bg');
  C.defaults.plugins.tooltip.bodyColor = css('--bg');
  C.defaults.plugins.tooltip.cornerRadius = 10;
  C.defaults.plugins.tooltip.padding = 10;
  C.defaults.elements.line.tension = 0.3;
  C.defaults.elements.line.borderWidth = 2;
  C.defaults.elements.point.radius = 0;
  C.defaults.elements.point.hoverRadius = 4;
  C.defaults.elements.bar.borderRadius = 6;
  C.defaults.maintainAspectRatio = false;
  C.defaults.animation.duration = 450;
  let canvas = container.querySelector('canvas');
  if (!canvas) { canvas = h('canvas'); container.append(canvas); }
  const c = new C(canvas, config);
  liveCharts.push(c);
  return c;
}
chart.colors = ui.PALETTE;
chart.cls = ui.CLS_COLOR;
chart.css = css;

// ---------- theme (auto | light | dark), saved per device ----------
export function applyTheme(mode) {
  const m = mode || (() => { try { return localStorage.getItem('nuaom.theme') || 'auto'; } catch (e) { return 'auto'; } })();
  if (m === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = m;
  try { localStorage.setItem('nuaom.theme', m); } catch (e) { /* ignore */ }
}
applyTheme();

// ---------- shell ----------
const app = document.getElementById('app');
const topTitle = h('div', { class: 'title' }, 'หนูออม');
const backBtn = h('button', { class: 'icon-btn hidden', 'aria-label': 'ย้อนกลับ', onClick: () => history.length > 1 ? history.back() : nav('') }, icon('chevron-left'));
const logo = h('span', { class: 'logo', style: { cursor: 'pointer' }, onClick: () => nav('') }, ui.mascot('happy', 38));
const offline = h('span', { class: 'offline-dot hidden', title: 'ออฟไลน์' });
const refreshBtn = h('button', { class: 'icon-btn', 'aria-label': 'รีเฟรชข้อมูล', onClick: () => doRefresh() }, icon('refresh'));
const searchBtn = h('button', { class: 'icon-btn', 'aria-label': 'ค้นหาหุ้น', onClick: () => openSearch() }, icon('search'));
const topbar = h('header', { class: 'topbar' }, backBtn, logo, topTitle, offline, searchBtn, refreshBtn);
const banner = h('div', { class: 'banner hidden', role: 'status', style: { cursor: 'pointer' }, onClick: () => nav('settings') });
const pageEl = h('main', { class: 'page', id: 'page', tabindex: '-1' });
const tabbar = h('nav', { class: 'tabbar', 'aria-label': 'เมนูหลัก' },
  TABS.map((t) => h('a', { href: '#/' + t.path, 'data-path': t.path }, icon(t.icon), t.label)));
app.append(topbar, banner, pageEl, tabbar);

export function nav(path) { location.hash = '#/' + path; }

function updateBanner() {
  const s = store.get();
  if (s.demo) {
    banner.className = 'banner';
    banner.replaceChildren(icon('flask'), h('span', { class: 'grow' }, 'โหมดตัวอย่าง: ตัวเลขทั้งหมดเป็นข้อมูลสมมติ แตะเพื่อเชื่อมข้อมูลจริง'));
  } else if (s.error && s.ready) {
    banner.className = 'banner';
    banner.replaceChildren(icon('cloud-off'), h('span', { class: 'grow' }, 'แสดงข้อมูลล่าสุดที่เก็บไว้ (' + s.error + ')'));
  } else {
    banner.className = 'banner hidden';
  }
}

async function doRefresh() {
  refreshBtn.disabled = true;
  refreshBtn.firstChild.classList.add('spin');
  try { await store.refresh(); ui.toast('อัปเดตแล้ว'); } catch (e) { ui.toast(e.message, 'down'); }
  refreshBtn.disabled = false;
  refreshBtn.firstChild.classList.remove('spin');
}

// ---------- symbol search ----------
function openSearch() {
  const s = store.get();
  let cls = 'TH';
  const input = h('input', { placeholder: 'เช่น PTT, KO, BTC', autocomplete: 'off', autocapitalize: 'characters', 'aria-label': 'ชื่อย่อหุ้น' });
  const results = h('div', { class: 'list' });
  const known = new Map();
  const add = (symbol, c, name) => { if (symbol && !known.has(symbol) && c !== 'CASH') known.set(symbol, { symbol, cls: c, name }); };
  s.derived.holdings.forEach((x) => add(x.symbol, x.cls, x.name));
  s.watch.forEach((w) => add(w.symbol, w.cls, w.name));
  const draw = () => {
    const q = input.value.trim().toUpperCase();
    const items = [...known.values()].filter((k) => !q || k.symbol.includes(q) || String(k.name || '').toUpperCase().includes(q)).slice(0, 8);
    results.replaceChildren(...items.map((k) => ui.listItem({
      avatar: fmt.sym(k.symbol), avatarTone: fmt.clsTone(k.cls), title: fmt.sym(k.symbol), sub: `${fmt.clsName(k.cls)} · ${k.name || ''}`,
      onClick: () => { m.close(); nav('stock/' + encodeURIComponent(k.symbol)); },
    })));
  };
  const go = () => {
    const raw = input.value.trim();
    if (!raw) return;
    const sym = fmt.normSym(raw, cls);
    m.close();
    nav('stock/' + encodeURIComponent(sym));
  };
  input.addEventListener('input', draw);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  const m = ui.sheet({
    title: 'ส่องหุ้น',
    body: h('div', null,
      ui.segment([{ value: 'TH', label: 'หุ้นไทย' }, { value: 'US', label: 'หุ้นอเมริกา' }, { value: 'CRYPTO', label: 'คริปโต' }], cls, (v) => { cls = v; }),
      h('div', { class: 'search-box', style: { margin: '12px 0' } }, icon('search'), input),
      results),
    actions: [{ text: 'ดูหุ้นตัวนี้', variant: 'primary', icon: 'arrow-right', onClick: () => { go(); return false; } }],
  });
  draw();
  setTimeout(() => input.focus(), 50);
}

// ---------- router ----------
let cleanup = null;
let renderSeq = 0;
const ctx = { store, api, ui, fmt, calc, nav, chart };

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path] = raw.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const name = parts[0] || 'home';
  return { name, params: parts.slice(1), tabPath: parts[0] || '' };
}

async function render() {
  const seq = ++renderSeq;
  const { name, params, tabPath } = parseHash();
  if (typeof cleanup === 'function') { try { cleanup(); } catch (e) { console.error(e); } }
  cleanup = null;
  liveCharts.forEach((c) => { try { c.destroy(); } catch (e) { /* ignore */ } });
  liveCharts = [];
  const isTab = TABS.some((t) => t.path === tabPath) || name === 'home';
  backBtn.classList.toggle('hidden', isTab);
  logo.classList.toggle('hidden', !isTab);
  tabbar.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.path === (name === 'home' ? '' : tabPath)));
  pageEl.replaceChildren(ui.skeleton(4));
  window.scrollTo(0, 0);
  if (!PAGES.includes(name)) {
    topTitle.textContent = 'ไม่พบหน้านี้';
    pageEl.replaceChildren(ui.empty({ mood: 'worried', title: 'หนูออมหาหน้านี้ไม่เจอ', action: ui.button('กลับหน้าแรก', { variant: 'soft', onClick: () => nav('') }) }));
    return;
  }
  try {
    const mod = (await import(`./pages/${name}.js`)).default;
    if (seq !== renderSeq) return;
    topTitle.textContent = typeof mod.title === 'function' ? mod.title(params) : (mod.title || 'หนูออม');
    document.title = `${topTitle.textContent} · หนูออม`;
    const root = h('div', { class: 'page-enter' });
    pageEl.replaceChildren(root);
    const ret = await mod.render(root, params, ctx);
    if (seq !== renderSeq) { if (typeof ret === 'function') ret(); return; }
    cleanup = ret;
  } catch (e) {
    console.error(e);
    if (seq !== renderSeq) return;
    pageEl.replaceChildren(ui.errorBox(e, () => render()));
  }
}

window.addEventListener('hashchange', render);
window.addEventListener('online', () => offline.classList.add('hidden'));
window.addEventListener('offline', () => offline.classList.remove('hidden'));
if (!navigator.onLine) offline.classList.remove('hidden');
store.subscribe(updateBanner);

(async function start() {
  try { await store.load(); } catch (e) { console.warn('load', e); }
  updateBanner();
  render();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('sw', e));
  }
})();

// refresh quotes when app comes back to foreground (≥ 10 min since last update)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const u = store.get().updated;
  if (u && Date.now() - new Date(u).getTime() > 10 * 60 * 1000) store.load().catch(() => {});
});
