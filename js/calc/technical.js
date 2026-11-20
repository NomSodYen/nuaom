// Technical indicators. Every function returns arrays aligned to the input, null during warm-up.

const valid = (x) => x !== null && x !== undefined && Number.isFinite(+x);
const nullArr = (n) => new Array(n).fill(null);

export function sma(a, n) {
  const arr = Array.isArray(a) ? a : [];
  const out = nullArr(arr.length);
  if (!(n >= 1)) return out;
  for (let i = n - 1; i < arr.length; i++) {
    let s = 0, ok = true;
    for (let j = i - n + 1; j <= i; j++) {
      if (!valid(arr[j])) { ok = false; break; }
      s += +arr[j];
    }
    if (ok) out[i] = s / n;
  }
  return out;
}

/** EMA seeded with the SMA of the first n valid consecutive values; k = 2/(n+1). */
export function ema(a, n) {
  const arr = Array.isArray(a) ? a : [];
  const out = nullArr(arr.length);
  if (!(n >= 1)) return out;
  let run = 0, s = -1;
  for (let i = 0; i < arr.length; i++) {
    run = valid(arr[i]) ? run + 1 : 0;
    if (run === n) { s = i; break; }
  }
  if (s < 0) return out;
  let prev = 0;
  for (let j = s - n + 1; j <= s; j++) prev += +arr[j];
  prev /= n;
  out[s] = prev;
  const k = 2 / (n + 1);
  for (let i = s + 1; i < arr.length; i++) {
    if (!valid(arr[i])) continue;
    prev = +arr[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Wilder RSI. First value at index n (relative to first valid value). */
export function rsi(a, n = 14) {
  const arr = Array.isArray(a) ? a : [];
  const out = nullArr(arr.length);
  const off = arr.findIndex(valid);
  if (off < 0 || !(n >= 1)) return out;
  let gain = 0, loss = 0;
  for (let i = off + 1; i < arr.length; i++) {
    if (!valid(arr[i]) || !valid(arr[i - 1])) break;
    const ch = +arr[i] - +arr[i - 1];
    const g = Math.max(ch, 0), l = Math.max(-ch, 0);
    const k = i - off;
    if (k <= n) {
      gain += g; loss += l;
      if (k < n) continue;
      gain /= n; loss /= n;
    } else {
      gain = (gain * (n - 1) + g) / n;
      loss = (loss * (n - 1) + l) / n;
    }
    out[i] = loss === 0 ? (gain === 0 ? 50 : 100) : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

export function macd(a) {
  const arr = Array.isArray(a) ? a : [];
  const e12 = ema(arr, 12), e26 = ema(arr, 26);
  const line = arr.map((_, i) => (e12[i] !== null && e26[i] !== null ? e12[i] - e26[i] : null));
  const signal = ema(line, 9);
  const hist = line.map((v, i) => (v !== null && signal[i] !== null ? v - signal[i] : null));
  return { macd: line, signal, hist };
}

/** Bollinger bands; sd is the population standard deviation of the window. */
export function bollinger(a, n = 20, k = 2) {
  const arr = Array.isArray(a) ? a : [];
  const mid = sma(arr, n);
  const up = nullArr(arr.length), low = nullArr(arr.length);
  for (let i = 0; i < arr.length; i++) {
    if (mid[i] === null) continue;
    let v = 0;
    for (let j = i - n + 1; j <= i; j++) v += (+arr[j] - mid[i]) ** 2;
    const sd = Math.sqrt(v / n);
    up[i] = mid[i] + k * sd;
    low[i] = mid[i] - k * sd;
  }
  return { mid, up, low };
}

/** High/low of the last 252 valid closes and the position of the last close in that range (%). */
export function range52w(closes) {
  const vals = (Array.isArray(closes) ? closes : []).filter(valid).map(Number).slice(-252);
  if (!vals.length) return { high: null, low: null, posPct: null };
  const high = Math.max(...vals), low = Math.min(...vals);
  const last = vals[vals.length - 1];
  return { high, low, posPct: high > low ? ((last - low) / (high - low)) * 100 : 50 };
}
