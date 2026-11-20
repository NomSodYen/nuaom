import { num, parseDate, isoDate, todayDate, addDays, addYears, normSym } from './_util.js';

const DEFAULT_WHT = { TH: 10, US: 15 };

export function netAfterWht(gross, cls, wht = DEFAULT_WHT) {
  const table = wht || DEFAULT_WHT;
  const rate = num(table[cls], num(DEFAULT_WHT[cls], 0));
  return num(gross) * (1 - rate / 100);
}

function sortedEvents(events) {
  return (Array.isArray(events) ? events : [])
    .map((e) => ({ d: parseDate(e && e.date), amount: num(e && e.amount) }))
    .filter((e) => e.d && e.amount > 0)
    .sort((a, b) => a.d - b.d);
}

/**
 * Dividend statistics from per-share events [{date, amount}].
 * - ttm: sum of events with date in (today-1y, today]
 * - consecutiveYears: consecutive calendar years with a payment, counting back from the
 *   latest paying year (0 if that year is older than last calendar year)
 * - cagr3/cagr5: yearly total growth between the last COMPLETE calendar year (< current year)
 *   and 3/5 years earlier; null if either year is missing
 * - frequency: payments per year (TTM count, else count of last complete year)
 */
export function stats(events, price, today) {
  const ev = sortedEvents(events);
  const t = parseDate(today) || todayDate();
  const year = t.getUTCFullYear();
  const empty = {
    ttm: 0, yieldPct: 0, years: [], consecutiveYears: 0, cagr3: null, cagr5: null,
    frequency: 0, lastAmount: 0, lastDate: null,
  };
  if (!ev.length) return empty;

  const from = addYears(t, -1);
  const ttmEv = ev.filter((e) => e.d > from && e.d <= t);
  const ttm = ttmEv.reduce((s, e) => s + e.amount, 0);
  const p = num(price);

  const byYear = new Map(), countByYear = new Map();
  for (const e of ev) {
    const y = e.d.getUTCFullYear();
    byYear.set(y, (byYear.get(y) || 0) + e.amount);
    countByYear.set(y, (countByYear.get(y) || 0) + 1);
  }
  const years = [...byYear.entries()].sort((a, b) => a[0] - b[0]).map(([y, total]) => ({ year: y, total }));

  let consecutive = 0;
  const latest = years[years.length - 1].year;
  if (latest >= year - 1) {
    for (let y = latest; byYear.has(y); y--) consecutive++;
  }

  const lastComplete = years.filter((y) => y.year < year).pop();
  const cagr = (n) => {
    if (!lastComplete) return null;
    const a = byYear.get(lastComplete.year - n);
    if (!(a > 0) || !(lastComplete.total > 0)) return null;
    return (Math.pow(lastComplete.total / a, 1 / n) - 1) * 100;
  };

  const last = ev[ev.length - 1];
  return {
    ttm,
    yieldPct: p > 0 ? (ttm / p) * 100 : 0,
    years,
    consecutiveYears: consecutive,
    cagr3: cagr(3),
    cagr5: cagr(5),
    frequency: ttmEv.length || (lastComplete ? countByYear.get(lastComplete.year) : 0) || 0,
    lastAmount: last.amount,
    lastDate: isoDate(last.d),
  };
}

/**
 * Estimated + confirmed dividend calendar for the next `months` months.
 * Estimate: events of the last 12 months shifted +1 year (amount kept); pay = xd + 21 days.
 * Confirmed items replace estimates for the same symbol and same calendar month.
 * opts.fx (optional) is used for THB rate when a holding has no valueCcy.
 */
export function projectCalendar(holdings, eventsBySymbol, opts = {}) {
  const t = parseDate(opts.today) || todayDate();
  const months = num(opts.months, 12) || 12;
  const end = new Date(t.getTime());
  end.setUTCMonth(end.getUTCMonth() + months);
  const confirmed = Array.isArray(opts.confirmed) ? opts.confirmed : [];
  const wht = opts.wht || DEFAULT_WHT;
  const evMap = new Map();
  for (const [k, v] of Object.entries(eventsBySymbol || {})) evMap.set(normSym(k), v);

  const out = [];
  for (const h of Array.isArray(holdings) ? holdings : []) {
    if (!h || h.cls === 'CASH' || h.cls === 'GOLD') continue;
    const qty = num(h.qty);
    if (!(qty > 0)) continue;
    const key = normSym(h.symbol);
    const rate = num(h.valueCcy) > 0 ? num(h.valueTHB) / num(h.valueCcy)
      : (h.ccy && h.ccy !== 'THB' ? num(opts.fx && opts.fx[h.ccy], 1) : 1);
    const make = (xd, pay, perShare, estimated) => {
      const gross = perShare * qty * rate;
      return {
        symbol: h.symbol, cls: h.cls, xd: isoDate(xd), pay: isoDate(pay), perShare, qty,
        grossTHB: gross, netTHB: netAfterWht(gross, h.cls, wht), estimated,
      };
    };

    const ev = sortedEvents(evMap.get(key));
    const conf = confirmed.filter((c) => c && normSym(c.symbol) === key)
      .map((c) => ({ c, xd: parseDate(c.xd) }))
      .filter((x) => x.xd && x.xd >= t);
    const confMonths = new Set(conf.map((x) => x.xd.toISOString().slice(0, 7)));

    const recent = ev.filter((e) => e.d > addYears(t, -1) && e.d <= t);
    for (let k = 1; k <= Math.ceil(months / 12); k++) {
      for (const e of recent) {
        const xd = addYears(e.d, k);
        if (xd <= t || xd > end) continue;
        if (confMonths.has(xd.toISOString().slice(0, 7))) continue;
        out.push(make(xd, addDays(xd, 21), e.amount, true));
      }
    }
    for (const { c, xd } of conf) {
      const pay = parseDate(c.pay) || addDays(xd, 21);
      out.push(make(xd, pay, num(c.amount), false));
    }
  }
  return out.sort((a, b) => (a.xd < b.xd ? -1 : a.xd > b.xd ? 1 : 0));
}

function divNet(t, fx) {
  const ccy = String(t.ccy ?? '').toUpperCase() || (String(t.cls ?? '').toUpperCase() === 'US' ? 'USD' : 'THB');
  let r = num(t.fx);
  if (!(r > 0)) r = ccy === 'THB' ? 1 : num(fx && fx[ccy], 1);
  return (num(t.qty) * num(t.price) - num(t.tax)) * r;
}

/** Net dividends received per month (12 entries, THB) for `year`. */
export function receivedByMonth(tx, fx, year) {
  const out = new Array(12).fill(0);
  for (const t of Array.isArray(tx) ? tx : []) {
    if (!t || String(t.type ?? '').toUpperCase() !== 'DIV') continue;
    const d = parseDate(t.date);
    if (!d || d.getUTCFullYear() !== Number(year)) continue;
    out[d.getUTCMonth()] += divNet(t, fx);
  }
  return out;
}

export function annualIncome(tx, fx, year) {
  return receivedByMonth(tx, fx, year).reduce((s, v) => s + v, 0);
}

export function goal(annualNetTHB, goalMonth) {
  const monthlyAvg = num(annualNetTHB) / 12;
  const g = num(goalMonth);
  return { monthlyAvg, pct: g > 0 ? (monthlyAvg / g) * 100 : 0 };
}

/** Yield on cost (percent) = TTM dividend per share / average cost per share. */
export function yieldOnCost(holding, ttmPerShare) {
  const c = num(holding && holding.avgCost);
  return c > 0 ? (num(ttmPerShare) / c) * 100 : 0;
}
