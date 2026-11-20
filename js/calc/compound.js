import { num, numOrNull } from './_util.js';

const monthlyRate = (annualPct) => Math.pow(1 + num(annualPct) / 100, 1 / 12) - 1;

/**
 * Compound growth. Annual rate is an effective annual rate (monthly rate = (1+r)^(1/12)-1);
 * the monthly contribution is added at the END of each month. Rows are year 1..years.
 */
export function compound({ principal, monthly, ratePct, years } = {}) {
  const p = num(principal), m = num(monthly), i = monthlyRate(ratePct);
  const n = Math.max(0, Math.floor(num(years)));
  const rows = [];
  let v = p;
  for (let y = 1; y <= n; y++) {
    for (let k = 0; k < 12; k++) v = v * (1 + i) + m;
    rows.push({ year: y, invested: p + m * 12 * y, value: v });
  }
  return rows;
}

/**
 * Dividend snowball, simulated monthly. Year-t yield on current value =
 * yieldPct * ((1+divGrowth)/(1+priceGrowth))^(t-1) (dividend/share grows at divGrowthPct,
 * price at priceGrowthPct). Each month: dividend = value*yield/12, taxed taxPct; price
 * growth applied to value; net dividend added to value when reinvest (else only counted in
 * divYear); contribution added at month end. `invested` = start + contributions only.
 */
export function snowball({ start, monthly, yieldPct, divGrowthPct, priceGrowthPct, years, reinvest = true, taxPct = 10 } = {}) {
  const m = num(monthly), s = num(start);
  const dg = num(divGrowthPct) / 100, pg = num(priceGrowthPct) / 100;
  const pm = Math.pow(1 + pg, 1 / 12) - 1;
  const tax = num(taxPct) / 100;
  const n = Math.max(0, Math.floor(num(years)));
  const rows = [];
  let v = s;
  for (let y = 1; y <= n; y++) {
    const yld = (num(yieldPct) / 100) * Math.pow((1 + dg) / (1 + pg), y - 1);
    let divYear = 0;
    for (let k = 0; k < 12; k++) {
      const net = v * (yld / 12) * (1 - tax);
      divYear += net;
      v = v * (1 + pm) + (reinvest ? net : 0) + m;
    }
    rows.push({ year: y, value: v, invested: s + m * 12 * y, divYear, divMonth: divYear / 12 });
  }
  return rows;
}

/** Capital needed to live on yield: monthlyExpense*12 / yield. null if yield <= 0. */
export function fire({ monthlyExpense, yieldPct } = {}) {
  const y = num(yieldPct);
  return y > 0 ? (num(monthlyExpense) * 12) / (y / 100) : null;
}

/** Years (float, month resolution) until start grows to target; null if not within 100 years. */
export function yearsTo({ target, start, monthly, ratePct } = {}) {
  const t = numOrNull(target);
  if (t === null) return null;
  let v = num(start);
  if (v >= t) return 0;
  const m = num(monthly), i = monthlyRate(ratePct);
  for (let k = 1; k <= 1200; k++) {
    v = v * (1 + i) + m;
    if (v >= t) return k / 12;
  }
  return null;
}

function cleanMonthly(monthly) {
  const t = (monthly && monthly.t) || [], c = (monthly && monthly.c) || [];
  const out = [];
  for (let i = 0; i < t.length; i++) {
    const close = numOrNull(c[i]);
    if (close !== null && close > 0) out.push({ t: t[i], c: close });
  }
  return out;
}

const emptyBt = { invested: 0, value: 0, units: 0, returnPct: 0, series: [] };

/** Buy `amount` at every monthly close; value marked at the last close. */
export function dcaBacktest(monthly, amount) {
  const pts = cleanMonthly(monthly), a = num(amount);
  if (!pts.length || !(a > 0)) return { ...emptyBt, series: [] };
  let units = 0, invested = 0;
  const series = pts.map((p) => {
    units += a / p.c; invested += a;
    return { t: p.t, invested, value: units * p.c };
  });
  const value = units * pts[pts.length - 1].c;
  return { invested, value, units, returnPct: (value / invested - 1) * 100, series };
}

/** Invest `amount` once at the first monthly close. */
export function lumpBacktest(monthly, amount) {
  const pts = cleanMonthly(monthly), a = num(amount);
  if (!pts.length || !(a > 0)) return { ...emptyBt, series: [] };
  const units = a / pts[0].c;
  const series = pts.map((p) => ({ t: p.t, invested: a, value: units * p.c }));
  const value = units * pts[pts.length - 1].c;
  return { invested: a, value, units, returnPct: (value / a - 1) * 100, series };
}

/**
 * Risk-based position size: shares = floor(capital*riskPct% / |entry - stop|).
 * exceedsCapital flags positionValue > capital.
 */
export function positionSize({ capital, riskPct, entry, stop } = {}) {
  const cap = num(capital);
  const riskAmount = cap * (num(riskPct) / 100);
  const per = Math.abs(num(entry) - num(stop));
  const shares = per > 0 ? Math.floor(riskAmount / per + 1e-9) : 0;
  const positionValue = shares * num(entry);
  return { shares, riskAmount, positionValue, exceedsCapital: positionValue > cap };
}
