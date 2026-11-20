// หนูออม — app state + actions (owner: Opus). Pages read store.get() and subscribe().
import api from './api.js';
import * as calc from './calc/index.js';

const BOOT_CACHE = 'nuaom.boot.v1';
const MEMO_PREFIX = 'nuaom.memo.';

let state = {
  ready: false, demo: !api.configured(), loading: false, error: null,
  settings: {}, tx: [], watch: [], alerts: [], journal: [], news: [], snapshots: [],
  quotes: {}, fx: { USD: 0, THB: 1 }, gold: { latest: null }, lineReady: false,
  derived: { holdings: [], totals: {} },
  updated: null,
};
const subs = new Set();

function derive(s) {
  try {
    const d = calc.portfolio.computeHoldings(s.tx, s.quotes, s.fx, s.gold);
    return d && d.holdings ? d : { holdings: [], totals: {} };
  } catch (e) {
    console.error('computeHoldings', e);
    return { holdings: [], totals: {} };
  }
}

function set(patch, { recompute = true, persist = true } = {}) {
  state = { ...state, ...patch };
  if (recompute) state.derived = derive(state);
  if (persist && state.ready && !state.demo) {
    try {
      const { derived, loading, error, ...rest } = state;
      localStorage.setItem(BOOT_CACHE, JSON.stringify(rest));
    } catch (e) { /* storage full → ignore */ }
  }
  for (const fn of subs) { try { fn(state); } catch (e) { console.error(e); } }
}

function applyBoot(data) {
  return {
    settings: data.settings || {}, tx: data.tx || [], watch: data.watch || [], alerts: data.alerts || [],
    journal: data.journal || [], news: data.news || [], snapshots: data.snapshots || [],
    quotes: data.quotes || {}, fx: data.fx || { USD: 0, THB: 1 }, gold: data.gold || { latest: null },
    lineReady: !!data.lineReady, updated: new Date().toISOString(),
  };
}

// ---------- memoised remote reads ----------
const memo = new Map();
async function cached(key, ttlSec, loader) {
  const now = Date.now();
  const m = memo.get(key);
  if (m && now - m.t < ttlSec * 1000) return m.v;
  const lsKey = MEMO_PREFIX + (state.demo ? 'd.' : '') + key;
  try {
    const raw = JSON.parse(localStorage.getItem(lsKey));
    if (raw && now - raw.t < ttlSec * 1000) { memo.set(key, raw); return raw.v; }
  } catch (e) { /* ignore */ }
  const v = await loader();
  const rec = { t: now, v };
  memo.set(key, rec);
  try { localStorage.setItem(lsKey, JSON.stringify(rec)); } catch (e) { pruneMemo(); }
  return v;
}
function pruneMemo() {
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(MEMO_PREFIX));
    keys.slice(0, Math.ceil(keys.length / 2)).forEach((k) => localStorage.removeItem(k));
  } catch (e) { /* ignore */ }
}

// ---------- public store ----------
export const store = {
  get: () => state,
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },

  async load() {
    const demo = !api.configured();
    if (!demo && !state.ready) {
      try {
        const cachedBoot = JSON.parse(localStorage.getItem(BOOT_CACHE));
        if (cachedBoot && cachedBoot.tx) set({ ...cachedBoot, ready: true, demo: false }, { persist: false });
      } catch (e) { /* ignore */ }
    }
    set({ loading: true, error: null, demo }, { recompute: false, persist: false });
    try {
      const data = await api.call('bootstrap');
      set({ ...applyBoot(data), ready: true, loading: false, demo });
    } catch (e) {
      set({ loading: false, error: e.message, ready: state.ready || false }, { recompute: false, persist: false });
      throw e;
    }
  },
  refresh() { memo.clear(); return store.load(); },

  async addTx(row) { const r = await api.call('tx.add', { row }); set({ tx: [...state.tx, r] }); return r; },
  async updateTx(row) { const r = await api.call('tx.update', { row }); set({ tx: state.tx.map((t) => (t.id === row.id ? { ...t, ...r } : t)) }); return r; },
  async deleteTx(id) { await api.call('tx.delete', { id }); set({ tx: state.tx.filter((t) => t.id !== id) }); },
  async addTxMany(rows) { const r = await api.call('tx.addMany', { rows }); await store.load(); return r; },

  async upsertWatch(row) {
    const r = await api.call('watch.upsert', { row });
    const i = state.watch.findIndex((w) => w.symbol === r.symbol);
    set({ watch: i >= 0 ? state.watch.map((w, j) => (j === i ? { ...w, ...r } : w)) : [...state.watch, r] }, { recompute: false });
    return r;
  },
  async deleteWatch(symbol) { await api.call('watch.delete', { symbol }); set({ watch: state.watch.filter((w) => w.symbol !== symbol) }, { recompute: false }); },
  async upsertAlert(row) {
    const r = await api.call('alerts.upsert', { row });
    const i = state.alerts.findIndex((a) => a.id === r.id);
    set({ alerts: i >= 0 ? state.alerts.map((a, j) => (j === i ? { ...a, ...r } : a)) : [...state.alerts, r] }, { recompute: false });
    return r;
  },
  async deleteAlert(id) { await api.call('alerts.delete', { id }); set({ alerts: state.alerts.filter((a) => a.id !== id) }, { recompute: false }); },
  async upsertJournal(row) {
    const r = await api.call('journal.upsert', { row });
    const i = state.journal.findIndex((j) => j.id === r.id);
    set({ journal: i >= 0 ? state.journal.map((x, k) => (k === i ? { ...x, ...r } : x)) : [...state.journal, r] }, { recompute: false });
    return r;
  },
  async deleteJournal(id) { await api.call('journal.delete', { id }); set({ journal: state.journal.filter((j) => j.id !== id) }, { recompute: false }); },
  async saveSettings(obj) { const r = await api.call('settings.save', { settings: obj }); set({ settings: { ...state.settings, ...r } }, { recompute: false }); return r; },
  async setSecrets(obj) { const r = await api.call('secrets.set', obj); set({ lineReady: !!r.lineReady }, { recompute: false }); return r; },

  history: (symbol, cls, range = '1y', interval = '1d') =>
    cached(`h.${symbol}.${range}.${interval}`, interval === '1d' && (range === '1mo' || range === '6mo') ? 900 : 6 * 3600,
      () => api.call('history', { symbol, cls, range, interval })),
  dividends: (symbol) => cached(`d.${symbol}`, 24 * 3600, () => api.call('dividends', { symbol })),
  fundamentals: (symbol) => cached(`f.${symbol}`, 24 * 3600, () => api.call('fundamentals', { symbol })),
  goldData: () => cached('gold', 900, () => api.call('gold', { days: 365 })),
  screener: () => cached('screener', 3 * 3600, () => api.call('screener')),
  async quotes(symbols) {
    const q = await api.call('quotes', { symbols });
    set({ quotes: { ...state.quotes, ...q } });
    return q;
  },
  /** quote for any symbol (fetches if missing) */
  async quote(symbol, cls) {
    if (state.quotes[symbol]) return state.quotes[symbol];
    const q = await store.quotes([{ symbol, cls }]);
    return q[symbol] || null;
  },
};

export default store;
