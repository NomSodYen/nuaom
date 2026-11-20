// Shared tiny helpers for calc modules (not re-exported from index.js).

/** Coerce to finite number; '', null, undefined, NaN -> d. Accepts "1,234.5". */
export function num(x, d = 0) {
  if (x === null || x === undefined || x === '') return d;
  const v = typeof x === 'number' ? x : parseFloat(String(x).replace(/,/g, ''));
  return Number.isFinite(v) ? v : d;
}

/** Like num() but returns null when blank/invalid. */
export function numOrNull(x) {
  if (x === null || x === undefined || x === '') return null;
  const v = typeof x === 'number' ? x : parseFloat(String(x).replace(/,/g, ''));
  return Number.isFinite(v) ? v : null;
}

/** 'YYYY-MM-DD' (or ISO / Date) -> Date (UTC) or null. */
export function parseDate(s) {
  if (s === null || s === undefined || s === '') return null;
  if (s instanceof Date) return Number.isNaN(s.getTime()) ? null : new Date(s.getTime());
  const str = String(s);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str.slice(0, 10));
  const d = m && str.length === 10
    ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
    : new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

export function todayDate() {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
}

export function addDays(d, n) {
  return new Date(d.getTime() + n * 86400000);
}

export function addYears(d, n) {
  const r = new Date(d.getTime());
  r.setUTCFullYear(r.getUTCFullYear() + n);
  return r;
}

export function addMonths(d, n) {
  const r = new Date(d.getTime());
  r.setUTCMonth(r.getUTCMonth() + n);
  return r;
}

/** Number -> short display string for Thai texts (max 2 decimals, no trailing zeros). */
export function short(n, dec = 2) {
  return String(Number(Number(n).toFixed(dec)));
}

export const CLS_NAME = {
  TH: 'หุ้นไทย', US: 'หุ้นอเมริกา', CRYPTO: 'คริปโต',
  GOLD: 'ทองคำ', CASH: 'เงินสด', OTHER: 'อื่นๆ',
};

/** Strip ".BK" and upper-case, for symbol matching. */
export function normSym(s) {
  return String(s ?? '').trim().toUpperCase().replace(/\.BK$/, '');
}
