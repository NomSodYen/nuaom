import { num, numOrNull, short, CLS_NAME } from './_util.js';

const list = (x) => (Array.isArray(x) ? x.filter(Boolean) : []);
const totalOf = (hs) => hs.reduce((s, h) => s + num(h.valueTHB), 0);
const weightOf = (h, total) => (Number.isFinite(+h.weight) && h.weight !== null && h.weight !== '' && h.weight !== undefined
  ? +h.weight : (total > 0 ? (num(h.valueTHB) / total) * 100 : 0));

/**
 * Concentration of non-cash positions. top1/top3 = % weight of the biggest 1/3 positions,
 * hhi = sum of squared % weights (0-10000), over = positions with weight > maxPct.
 */
export function concentration(holdings, maxPct) {
  const hs = list(holdings);
  const total = totalOf(hs);
  const ws = hs.filter((h) => h.cls !== 'CASH' && h.cls !== 'GOLD')
    .map((h) => ({ symbol: h.symbol, weight: weightOf(h, total) }))
    .sort((a, b) => b.weight - a.weight);
  const m = numOrNull(maxPct);
  return {
    top1: ws.length ? ws[0].weight : 0,
    top3: ws.slice(0, 3).reduce((s, w) => s + w.weight, 0),
    hhi: ws.reduce((s, w) => s + w.weight * w.weight, 0),
    over: m === null ? [] : ws.filter((w) => w.weight > m),
  };
}

export function currency(holdings) {
  const hs = list(holdings);
  const total = totalOf(hs);
  const m = new Map();
  for (const h of hs) m.set(h.ccy || 'THB', (m.get(h.ccy || 'THB') || 0) + num(h.valueTHB));
  return [...m.entries()]
    .map(([ccy, valueTHB]) => ({ ccy, valueTHB, pct: total > 0 ? (valueTHB / total) * 100 : 0 }))
    .sort((a, b) => b.valueTHB - a.valueTHB);
}

export const DEFAULT_SHOCKS = { TH: -30, US: -30, CRYPTO: -60, GOLD: 5, CASH: 0, OTHER: -20 };

/** Apply % shocks per asset class. lossTHB/lossPct are positive when the portfolio loses. */
export function stress(holdings, shocks) {
  const sh = { ...DEFAULT_SHOCKS, ...(shocks || {}) };
  const hs = list(holdings);
  const by = new Map();
  for (const h of hs) {
    const cls = h.cls || 'OTHER';
    const before = num(h.valueTHB);
    const after = before * (1 + num(sh[cls], 0) / 100);
    const r = by.get(cls) || { cls, before: 0, after: 0 };
    r.before += before; r.after += after;
    by.set(cls, r);
  }
  const byCls = [...by.values()].sort((a, b) => b.before - a.before);
  const before = byCls.reduce((s, r) => s + r.before, 0);
  const after = byCls.reduce((s, r) => s + r.after, 0);
  return { before, after, lossTHB: before - after, lossPct: before > 0 ? ((before - after) / before) * 100 : 0, byCls };
}

/** US-situs assets in USD vs the USD 60,000 US estate-tax exemption for non-resident aliens. */
export function usEstate(holdings, fxUSD) {
  const us = list(holdings).filter((h) => h.cls === 'US');
  const fx = num(fxUSD);
  const usd = fx > 0 ? us.reduce((s, h) => s + num(h.valueTHB), 0) / fx
    : us.reduce((s, h) => s + num(h.valueCcy), 0);
  const limit = 60000;
  return { usd, limit, over: usd > limit, pct: (usd / limit) * 100 };
}

/** Max drawdown. maxDDPct is a POSITIVE percent (23.4 = fell 23.4% from peak). */
export function drawdown(values) {
  const v = (Array.isArray(values) ? values : []).map((x) => numOrNull(x));
  let peak = -Infinity, peakI = -1, maxDD = 0, pI = 0, tI = 0;
  for (let i = 0; i < v.length; i++) {
    if (v[i] === null) continue;
    if (v[i] > peak) { peak = v[i]; peakI = i; }
    if (peak > 0) {
      const dd = ((peak - v[i]) / peak) * 100;
      if (dd > maxDD) { maxDD = dd; pI = peakI; tI = i; }
    }
  }
  return { maxDDPct: maxDD, peakIdx: pI, troughIdx: tI };
}

/** Annualised volatility (percent) from sample std-dev of log returns. null if < 3 closes. */
export function volatility(closes, periodsPerYear = 252) {
  const c = (Array.isArray(closes) ? closes : []).map(numOrNull).filter((x) => x !== null && x > 0);
  if (c.length < 3) return null;
  const r = [];
  for (let i = 1; i < c.length; i++) r.push(Math.log(c[i] / c[i - 1]));
  const mean = r.reduce((s, x) => s + x, 0) / r.length;
  const sd = Math.sqrt(r.reduce((s, x) => s + (x - mean) ** 2, 0) / (r.length - 1));
  return sd * Math.sqrt(num(periodsPerYear, 252)) * 100;
}

/** Pearson correlation of two equal-position series (shorter length used); null if undefined. */
export function correlation(a, b) {
  const x = Array.isArray(a) ? a : [], y = Array.isArray(b) ? b : [];
  const n = Math.min(x.length, y.length);
  const px = [], py = [];
  for (let i = 0; i < n; i++) {
    const u = numOrNull(x[i]), w = numOrNull(y[i]);
    if (u !== null && w !== null) { px.push(u); py.push(w); }
  }
  if (px.length < 2) return null;
  const mx = px.reduce((s, v) => s + v, 0) / px.length;
  const my = py.reduce((s, v) => s + v, 0) / py.length;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < px.length; i++) {
    sxy += (px[i] - mx) * (py[i] - my); sxx += (px[i] - mx) ** 2; syy += (py[i] - my) ** 2;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}

const DEFAULT_SETTINGS = {
  max_position_pct: 15, max_crypto_pct: 10, max_short_pct: 20,
  target_alloc: { TH: 40, US: 35, CRYPTO: 5, GOLD: 10, CASH: 10 },
};

/** The owner's own rules vs reality. Returns Thai [{level:'warn'|'info', text}] (warn first). */
export function rulesCheck(totals, holdings, settings) {
  const s = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  const t = totals || {};
  const hs = list(holdings);
  const total = num(t.valueTHB) || totalOf(hs);
  const warn = [], info = [];
  if (!(total > 0)) return [];

  const maxPos = numOrNull(s.max_position_pct);
  if (maxPos !== null) {
    for (const h of hs.filter((x) => x.cls !== 'CASH' && x.cls !== 'GOLD')
      .map((x) => ({ symbol: x.symbol, w: weightOf(x, total) }))
      .sort((a, b) => b.w - a.w)) {
      if (h.w > maxPos) {
        warn.push({ level: 'warn', text: `${String(h.symbol).replace(/\.BK$/, '')} มีสัดส่วน ${short(h.w, 1)}% เกินเพดาน ${short(maxPos, 1)}% ที่ตั้งไว้` });
      }
    }
  }
  const crypto = num(t.byCls && t.byCls.CRYPTO && t.byCls.CRYPTO.pct);
  const maxCrypto = numOrNull(s.max_crypto_pct);
  if (maxCrypto !== null && crypto > maxCrypto) {
    warn.push({ level: 'warn', text: `คริปโตมีสัดส่วน ${short(crypto, 1)}% เกินเพดาน ${short(maxCrypto, 1)}% ที่ตั้งไว้` });
  }
  const shortPct = num(t.byBucket && t.byBucket.SHORT && t.byBucket.SHORT.pct);
  const maxShort = numOrNull(s.max_short_pct);
  if (maxShort !== null && shortPct > maxShort) {
    warn.push({ level: 'warn', text: `เงินก้อนระยะสั้นมีสัดส่วน ${short(shortPct, 1)}% เกินเพดาน ${short(maxShort, 1)}% ที่ตั้งไว้` });
  }
  const target = s.target_alloc && typeof s.target_alloc === 'object' ? s.target_alloc : {};
  for (const cls of Object.keys(target)) {
    const tg = numOrNull(target[cls]);
    if (tg === null) continue;
    const actual = num(t.byCls && t.byCls[cls] && t.byCls[cls].pct);
    const diff = actual - tg;
    if (Math.abs(diff) > 5) {
      info.push({
        level: 'info',
        text: `${CLS_NAME[cls] || cls}${diff > 0 ? 'สูงกว่า' : 'ต่ำกว่า'}เป้าหมาย ${short(Math.abs(diff), 1)} จุด (ตอนนี้ ${short(actual, 1)}% เป้า ${short(tg, 1)}%)`,
      });
    }
  }
  return [...warn, ...info];
}
