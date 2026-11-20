import { num, parseDate, isoDate, todayDate } from './_util.js';

const CLASSES = ['TH', 'US', 'CRYPTO', 'GOLD', 'CASH', 'OTHER'];
const defCcy = (cls) => (cls === 'US' ? 'USD' : 'THB');

function rateOf(ccy, fx) {
  if (!ccy || ccy === 'THB') return 1;
  const r = num(fx && fx[ccy]);
  return r > 0 ? r : 1;
}

function txFx(t, ccy, fx) {
  const r = num(t.fx);
  return r > 0 ? r : rateOf(ccy, fx);
}

function findQuote(quotes, symbol, cls) {
  if (!quotes) return null;
  if (quotes[symbol]) return quotes[symbol];
  if (cls === 'TH') {
    const alt = symbol.endsWith('.BK') ? symbol.slice(0, -3) : symbol + '.BK';
    if (quotes[alt]) return quotes[alt];
  }
  return null;
}

/**
 * Average-cost holdings. See SPEC §6.
 * Gold day change: gold.latest.changeToday is assumed to be THB per baht-weight.
 */
export function computeHoldings(tx, quotes, fx, gold) {
  const list = Array.isArray(tx) ? tx.filter(Boolean).slice() : [];
  list.sort((a, b) => {
    const da = String(a.date ?? ''), db = String(b.date ?? '');
    if (da !== db) return da < db ? -1 : 1;
    const ca = String(a.created ?? ''), cb = String(b.created ?? '');
    return ca < cb ? -1 : ca > cb ? 1 : 0;
  });

  const pos = new Map();
  const getPos = (key, cls, symbol, ccy) => {
    if (!pos.has(key)) {
      pos.set(key, {
        key, cls, symbol, ccy, qty: 0, costCcy: 0, costTHB: 0,
        realizedTHB: 0, divNetTHB: 0, bucket: 'LONG', lastPrice: null,
      });
    }
    return pos.get(key);
  };

  for (const t of list) {
    const type = String(t.type ?? '').toUpperCase();
    let cls = String(t.cls ?? '').toUpperCase() || 'OTHER';
    let symbol = String(t.symbol ?? '').trim();
    let ccy = String(t.ccy ?? '').toUpperCase();
    let p;
    if (type === 'DEPOSIT' || type === 'WITHDRAW') {
      cls = 'CASH'; symbol = 'CASH'; ccy = ccy || 'THB';
      p = getPos(`CASH:${ccy}`, cls, symbol, ccy);
      const q = num(t.qty);
      p.qty += type === 'DEPOSIT' ? q : -q;
      continue;
    }
    if (!symbol) continue;
    ccy = ccy || defCcy(cls);
    p = getPos(`${cls}:${symbol}`, cls, symbol, ccy);
    const q = num(t.qty), price = num(t.price), fee = num(t.fee);
    const r = txFx(t, p.ccy, fx);

    if (type === 'BUY') {
      const c = q * price + fee;
      p.qty += q; p.costCcy += c; p.costTHB += c * r;
      if (t.bucket) p.bucket = String(t.bucket).toUpperCase();
      p.lastPrice = price;
    } else if (type === 'SELL') {
      const proceeds = q * price - fee;
      let removedTHB = 0, removedCcy = 0;
      if (p.qty > 0) {
        const frac = Math.min(q, p.qty) / p.qty;
        removedTHB = p.costTHB * frac; removedCcy = p.costCcy * frac;
      }
      p.realizedTHB += proceeds * r - removedTHB;
      p.costTHB -= removedTHB; p.costCcy -= removedCcy;
      p.qty = Math.max(0, p.qty - q);
      p.lastPrice = price;
    } else if (type === 'SPLIT') {
      if (q > 0) p.qty *= q; // cost unchanged -> avgCost divides
    } else if (type === 'DIV') {
      const shares = q || p.qty;
      p.divNetTHB += (shares * price - num(t.tax)) * r;
    }
  }

  const holdings = [];
  let realizedTHB = 0, divNetTHB = 0;
  for (const p of pos.values()) {
    realizedTHB += p.realizedTHB;
    divNetTHB += p.divNetTHB;
    if (Math.abs(p.qty) < 1e-9) continue;

    const rate = rateOf(p.ccy, fx);
    const quote = findQuote(quotes, p.symbol, p.cls);
    let price = 0, priceMissing = false, costCcy = p.costCcy, costTHB = p.costTHB;
    let dayPct = 0;

    if (p.cls === 'CASH') {
      price = 1; costCcy = p.qty; costTHB = p.qty * rate;
    } else {
      if (p.cls === 'GOLD') {
        price = num(gold && gold.latest && gold.latest.barBuy);
        if (!(price > 0)) price = num(quote && quote.price);
        const ch = num(gold && gold.latest && gold.latest.changeToday);
        const base = price - ch;
        if (price > 0 && base > 0) dayPct = (ch / base) * 100;
      } else if (p.cls === 'OTHER') {
        price = num(p.lastPrice);
      } else {
        price = num(quote && quote.price);
      }
      if (p.cls !== 'GOLD') dayPct = num(quote && quote.changePct);
    }

    let valueCcy;
    if (p.cls !== 'CASH' && !(price > 0)) {
      priceMissing = true;
      valueCcy = costCcy;
      price = p.qty !== 0 ? costCcy / p.qty : 0;
      dayPct = 0;
    } else {
      valueCcy = p.qty * price;
    }
    const valueTHB = valueCcy * rate;
    const unrealizedTHB = valueTHB - costTHB;
    const prevTHB = 1 + dayPct / 100 !== 0 ? valueTHB / (1 + dayPct / 100) : valueTHB;
    const h = {
      key: p.key, cls: p.cls, symbol: p.symbol,
      name: p.cls === 'CASH' ? `เงินสด ${p.ccy}` : (quote && quote.name) || p.symbol,
      qty: p.qty, avgCost: p.qty !== 0 ? costCcy / p.qty : 0, ccy: p.ccy,
      costCcy, costTHB, price, valueCcy, valueTHB,
      unrealizedTHB, unrealizedPct: costTHB > 0 ? (unrealizedTHB / costTHB) * 100 : 0,
      dayChangePct: dayPct, dayChangeTHB: valueTHB - prevTHB,
      realizedTHB: p.realizedTHB, divNetTHB: p.divNetTHB,
      bucket: p.bucket, weight: 0,
    };
    if (priceMissing) h.priceMissing = true;
    holdings.push(h);
  }

  const total = holdings.reduce((s, h) => s + h.valueTHB, 0);
  for (const h of holdings) h.weight = total > 0 ? (h.valueTHB / total) * 100 : 0;
  holdings.sort((a, b) => b.valueTHB - a.valueTHB);

  const costTHB = holdings.reduce((s, h) => s + h.costTHB, 0);
  const dayChangeTHB = holdings.reduce((s, h) => s + h.dayChangeTHB, 0);
  const cashTHB = holdings.filter((h) => h.cls === 'CASH').reduce((s, h) => s + h.valueTHB, 0);
  const unrealizedTHB = total - costTHB;

  const byCls = {};
  for (const c of CLASSES) byCls[c] = { valueTHB: 0, pct: 0 };
  const byBucket = { LONG: { valueTHB: 0, pct: 0 }, SHORT: { valueTHB: 0, pct: 0 } };
  for (const h of holdings) {
    (byCls[h.cls] || (byCls[h.cls] = { valueTHB: 0, pct: 0 })).valueTHB += h.valueTHB;
    byBucket[h.bucket === 'SHORT' ? 'SHORT' : 'LONG'].valueTHB += h.valueTHB;
  }
  for (const g of [...Object.values(byCls), ...Object.values(byBucket)]) {
    g.pct = total > 0 ? (g.valueTHB / total) * 100 : 0;
  }
  const prevTotal = total - dayChangeTHB;

  return {
    holdings,
    totals: {
      valueTHB: total, costTHB, unrealizedTHB,
      unrealizedPct: costTHB > 0 ? (unrealizedTHB / costTHB) * 100 : 0,
      realizedTHB, divNetTHB, dayChangeTHB,
      dayChangePct: prevTotal > 0 ? (dayChangeTHB / prevTotal) * 100 : 0,
      cashTHB, byCls, byBucket, count: holdings.length,
    },
  };
}

export function allocation(holdings, by = 'cls') {
  const field = { cls: 'cls', symbol: 'symbol', bucket: 'bucket', ccy: 'ccy' }[by] || 'cls';
  const m = new Map();
  let total = 0;
  for (const h of Array.isArray(holdings) ? holdings : []) {
    const v = num(h.valueTHB);
    total += v;
    const k = h[field] ?? '';
    m.set(k, (m.get(k) || 0) + v);
  }
  return [...m.entries()]
    .map(([key, valueTHB]) => ({ key, valueTHB, pct: total > 0 ? (valueTHB / total) * 100 : 0 }))
    .sort((a, b) => b.valueTHB - a.valueTHB);
}

/** Annualised money-weighted return as a rate (0.081 = 8.1%). null when no sign change. */
export function xirr(flows) {
  const fl = (Array.isArray(flows) ? flows : [])
    .map((f) => ({ d: parseDate(f && f.date), a: num(f && f.amount) }))
    .filter((f) => f.d && f.a !== 0);
  if (fl.length < 2) return null;
  if (!fl.some((f) => f.a > 0) || !fl.some((f) => f.a < 0)) return null;
  const d0 = Math.min(...fl.map((f) => f.d.getTime()));
  const pts = fl.map((f) => ({ t: (f.d.getTime() - d0) / 86400000 / 365, a: f.a }));
  const npv = (r) => pts.reduce((s, p) => s + p.a / Math.pow(1 + r, p.t), 0);
  const dnpv = (r) => pts.reduce((s, p) => s - (p.t * p.a) / Math.pow(1 + r, p.t + 1), 0);

  let r = 0.1;
  for (let i = 0; i < 100; i++) {
    const f = npv(r), df = dnpv(r);
    if (!Number.isFinite(f) || !Number.isFinite(df) || df === 0) break;
    const nr = r - f / df;
    if (!(nr > -0.999999)) break;
    if (Math.abs(nr - r) < 1e-12) return nr;
    r = nr;
  }
  if (Number.isFinite(r) && r > -0.999999 && Math.abs(npv(r)) < 1e-6) return r;

  let lo = -0.999999, hi = 1000;
  let flo = npv(lo), fhi = npv(hi);
  if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo * fhi > 0) return null;
  for (let i = 0; i < 300; i++) {
    const mid = (lo + hi) / 2, fm = npv(mid);
    if (flo * fm <= 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
  }
  return (lo + hi) / 2;
}

/**
 * Cash flows (THB) for xirr: BUY negative, SELL/DIV positive, plus the current
 * portfolio value as a final positive flow. Cash holdings (DEPOSIT/WITHDRAW)
 * are not investment flows, so their value is excluded from the final value.
 * `totals.date` (YYYY-MM-DD) may override "today".
 */
export function portfolioFlows(tx, fx, totals) {
  const flows = [];
  for (const t of Array.isArray(tx) ? tx : []) {
    if (!t) continue;
    const type = String(t.type ?? '').toUpperCase();
    const cls = String(t.cls ?? '').toUpperCase();
    if (cls === 'CASH' && type !== 'DIV') continue;
    const ccy = String(t.ccy ?? '').toUpperCase() || defCcy(cls);
    const r = txFx(t, ccy, fx);
    const q = num(t.qty), p = num(t.price), fee = num(t.fee);
    let amount = 0;
    if (type === 'BUY') amount = -(q * p + fee) * r;
    else if (type === 'SELL') amount = (q * p - fee) * r;
    else if (type === 'DIV') amount = (q * p - num(t.tax)) * r;
    else continue;
    if (amount !== 0 && t.date) flows.push({ date: String(t.date).slice(0, 10), amount });
  }
  const finalValue = num(totals && totals.valueTHB) - num(totals && totals.cashTHB);
  if (finalValue !== 0) {
    flows.push({ date: (totals && totals.date) || isoDate(todayDate()), amount: finalValue });
  }
  return flows;
}
