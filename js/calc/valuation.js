import { num, numOrNull } from './_util.js';

/** Gordon growth: next-year dividend / (r - g). null when r <= g or inputs invalid. */
export function ddm({ dps, growthPct, requiredPct } = {}) {
  const d = numOrNull(dps), g = numOrNull(growthPct), r = numOrNull(requiredPct);
  if (d === null || g === null || r === null || d <= 0) return null;
  if (r <= g) return null;
  return (d * (1 + g / 100)) / ((r - g) / 100);
}

export function dcf({ fcf, growthPct, years = 5, terminalPct = 2.5, discountPct = 9, shares, netDebt = 0 } = {}) {
  const f0 = numOrNull(fcf);
  const none = { perShare: null, equity: null, rows: [], terminalPV: null };
  if (f0 === null) return none;
  const g = num(growthPct) / 100, tg = num(terminalPct) / 100, d = num(discountPct) / 100;
  const n = Math.max(1, Math.round(num(years, 5)));
  const rows = [];
  let pvSum = 0, last = f0;
  for (let y = 1; y <= n; y++) {
    last = f0 * Math.pow(1 + g, y);
    const pv = last / Math.pow(1 + d, y);
    rows.push({ year: y, fcf: last, pv });
    pvSum += pv;
  }
  if (d <= tg) return { perShare: null, equity: null, rows, terminalPV: null };
  const terminalPV = ((last * (1 + tg)) / (d - tg)) / Math.pow(1 + d, n);
  const equity = pvSum + terminalPV - num(netDebt);
  const sh = num(shares);
  return { perShare: sh > 0 ? equity / sh : null, equity, rows, terminalPV };
}

/**
 * P/E band. monthly.t = epoch seconds (ms also accepted), monthly.c = closes.
 * EPS used for a month = EPS of the latest fiscal year strictly before that month's year.
 * sd = population standard deviation of the P/E series.
 * Bands are PRICES = (mean +/- k*sd) * latestEps, latestEps = last non-null EPS.
 */
export function peBand(monthly, epsByYear) {
  const t = (monthly && monthly.t) || [], c = (monthly && monthly.c) || [];
  const years = (epsByYear && epsByYear.years) || [], eps = (epsByYear && epsByYear.eps) || [];
  const table = years.map((y, i) => ({ y: num(y), e: numOrNull(eps[i]) })).filter((x) => x.e !== null)
    .sort((a, b) => a.y - b.y);

  let latestEps = null;
  if (table.length) latestEps = table[table.length - 1].e;

  const series = [];
  for (let i = 0; i < t.length; i++) {
    const close = numOrNull(c[i]);
    const ts = numOrNull(t[i]);
    if (close === null || ts === null || close <= 0) continue;
    const year = new Date((ts > 1e11 ? ts : ts * 1000)).getUTCFullYear();
    let e = null;
    for (const row of table) if (row.y < year) e = row.e;
    if (e === null || e <= 0) continue;
    series.push({ t: t[i], pe: close / e });
  }
  const bands = { m2: null, m1: null, mean: null, p1: null, p2: null };
  if (!series.length) return { series, mean: null, sd: null, latestEps, bands };
  const mean = series.reduce((s, x) => s + x.pe, 0) / series.length;
  const sd = Math.sqrt(series.reduce((s, x) => s + (x.pe - mean) ** 2, 0) / series.length);
  if (latestEps !== null && latestEps > 0) {
    bands.m2 = (mean - 2 * sd) * latestEps;
    bands.m1 = (mean - sd) * latestEps;
    bands.mean = mean * latestEps;
    bands.p1 = (mean + sd) * latestEps;
    bands.p2 = (mean + 2 * sd) * latestEps;
  }
  return { series, mean, sd, latestEps, bands };
}

/** Graham number sqrt(22.5 * EPS * BVPS); null unless both > 0. */
export function graham(eps, bvps) {
  const e = num(eps), b = num(bvps);
  return e > 0 && b > 0 ? Math.sqrt(22.5 * e * b) : null;
}

/** Margin of safety in percent: (fair - price) / fair * 100. null if fair is not > 0. */
export function mos(fair, price) {
  const f = numOrNull(fair), p = numOrNull(price);
  if (f === null || p === null || f <= 0) return null;
  return ((f - p) / f) * 100;
}
