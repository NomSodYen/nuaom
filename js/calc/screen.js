import { num, numOrNull, normSym, short } from './_util.js';

const isSet = (x) => numOrNull(x) !== null;

/**
 * Filter screener rows. Blank/null filters are off. A set numeric filter excludes rows whose
 * field is missing. maxPE also excludes non-positive PE. div_yield/payout/roe/cagr are percent numbers.
 */
export function filter(rows, f = {}) {
  const fl = f || {};
  const text = String(fl.text ?? '').trim().toLowerCase();
  const cls = String(fl.cls ?? '').toUpperCase();
  return (Array.isArray(rows) ? rows : []).filter((r) => {
    if (!r) return false;
    if (cls && cls !== 'ALL' && String(r.cls ?? '').toUpperCase() !== cls) return false;
    if (text && !(`${r.symbol ?? ''} ${r.name ?? ''}`.toLowerCase().includes(text))) return false;
    const chk = (flt, field, cmp) => {
      if (!isSet(flt)) return true;
      const v = numOrNull(r[field]);
      return v !== null && cmp(v, +flt);
    };
    return chk(fl.minYield, 'div_yield', (v, x) => v >= x)
      && chk(fl.maxYield, 'div_yield', (v, x) => v <= x)
      && chk(fl.maxPE, 'pe', (v, x) => v > 0 && v <= x)
      && chk(fl.minROE, 'roe', (v, x) => v >= x)
      && chk(fl.maxDE, 'de', (v, x) => v <= x)
      && chk(fl.minYears, 'div_years', (v, x) => v >= x)
      && chk(fl.maxPayout, 'payout', (v, x) => v <= x);
  });
}

/**
 * Dividend quality score 0-100 (rounded), a transparent formula - not advice. Missing data = 0 points.
 *  yield  (30): 3-8% -> 30; <3% -> 30*y/3; >8% -> 30 - 5*(y-8), floor 10 (very high yield = caution)
 *  payout (20): <=60% -> 20; 60-80% -> 20..12; 80-100% -> 12..4; >100% -> 0; 0 -> 0
 *  years  (20): 20 * min(div_years,10)/10
 *  cagr   (10): 10 * clamp(div_cagr5,0,5)/5
 *  roe    (10): 10 * clamp(roe,0,15)/15
 *  de     (10): <=0.5 -> 10; >=2 -> 0; linear in between
 */
export function divScore(row) {
  const r = row || {};
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  let s = 0;
  const y = numOrNull(r.div_yield);
  if (y !== null && y > 0) s += y < 3 ? (30 * y) / 3 : y <= 8 ? 30 : Math.max(10, 30 - 5 * (y - 8));
  const p = numOrNull(r.payout);
  if (p !== null && p > 0) {
    s += p <= 60 ? 20 : p <= 80 ? 20 - ((p - 60) / 20) * 8 : p <= 100 ? 12 - ((p - 80) / 20) * 8 : 0;
  }
  const yrs = numOrNull(r.div_years);
  if (yrs !== null) s += (20 * clamp(yrs, 0, 10)) / 10;
  const g = numOrNull(r.div_cagr5);
  if (g !== null) s += (10 * clamp(g, 0, 5)) / 5;
  const roe = numOrNull(r.roe);
  if (roe !== null) s += (10 * clamp(roe, 0, 15)) / 15;
  const de = numOrNull(r.de);
  if (de !== null && de >= 0) s += de <= 0.5 ? 10 : de >= 2 ? 0 : 10 * (1 - (de - 0.5) / 1.5);
  return Math.round(clamp(s, 0, 100));
}

/** Which of the owner's watchlist rules are currently met. Same shape as news rule_hits. */
export function ruleHits(watch, quotes, screenerRows) {
  const rows = new Map();
  for (const r of Array.isArray(screenerRows) ? screenerRows : []) if (r) rows.set(normSym(r.symbol), r);
  const hits = [];
  for (const w of Array.isArray(watch) ? watch : []) {
    if (!w || !w.symbol) continue;
    const row = rows.get(normSym(w.symbol));
    const q = quotes && (quotes[w.symbol] || quotes[`${normSym(w.symbol)}.BK`] || quotes[normSym(w.symbol)]);
    const price = numOrNull(q && q.price) ?? numOrNull(row && row.price);
    const hit = (rule, detail) => hits.push({ symbol: w.symbol, rule, detail });

    const minY = numOrNull(w.min_yield), yld = numOrNull(row && row.div_yield);
    if (minY !== null && yld !== null && yld > minY) {
      hit('min_yield', `อัตราปันผล ${short(yld, 2)}% สูงกว่าเกณฑ์ ${short(minY, 2)}% ที่คุณตั้งไว้`);
    }
    const maxPe = numOrNull(w.max_pe), pe = numOrNull(row && row.pe);
    if (maxPe !== null && pe !== null && pe > 0 && pe < maxPe) {
      hit('max_pe', `P/E ${short(pe, 2)} ต่ำกว่าเกณฑ์ ${short(maxPe, 2)} ที่คุณตั้งไว้`);
    }
    const below = numOrNull(w.price_below);
    if (below !== null && price !== null && price < below) {
      hit('price_below', `ราคา ${short(price, 2)} ต่ำกว่า ${short(below, 2)} ที่คุณตั้งไว้`);
    }
    const above = numOrNull(w.price_above);
    if (above !== null && price !== null && price > above) {
      hit('price_above', `ราคา ${short(price, 2)} สูงกว่า ${short(above, 2)} ที่คุณตั้งไว้`);
    }
  }
  return hits;
}
