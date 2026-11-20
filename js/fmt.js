// หนูออม — Thai number/date formatting (owner: Opus)
const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const TH_MONTHS_LONG = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const CLS_NAME = { TH: 'หุ้นไทย', US: 'หุ้นอเมริกา', CRYPTO: 'คริปโต', GOLD: 'ทองคำ', CASH: 'เงินสด', OTHER: 'อื่นๆ' };
const CLS_TONE = { TH: 'pink', US: 'sky', CRYPTO: 'butter', GOLD: 'peach', CASH: 'mint', OTHER: 'lavender' };

const n = (v) => {
  if (v === null || v === undefined || v === '') return NaN;
  const x = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
  return x;
};
const ok = (v) => Number.isFinite(n(v));

function num(v, dec = 2) {
  if (!ok(v)) return '–';
  return n(v).toLocaleString('th-TH', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function thb(v, { dec = 0, sign = false } = {}) {
  if (!ok(v)) return '–';
  const x = n(v);
  const s = sign && x > 0 ? '+' : x < 0 ? '−' : '';
  return `${s}฿${Math.abs(x).toLocaleString('th-TH', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
}

function money(v, ccy = 'THB', dec) {
  if (!ok(v)) return '–';
  const x = n(v);
  const d = dec ?? (Math.abs(x) < 10 ? 2 : Math.abs(x) < 1000 ? 2 : 0);
  const sym = ccy === 'USD' ? '$' : ccy === 'THB' ? '฿' : '';
  const s = x < 0 ? '−' : '';
  const body = Math.abs(x).toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d });
  return sym ? `${s}${sym}${body}` : `${s}${body} ${ccy}`;
}

function pct(v, { dec = 1, sign = false } = {}) {
  if (!ok(v)) return '–';
  const x = n(v);
  const s = sign && x > 0 ? '+' : x < 0 ? '−' : '';
  return `${s}${Math.abs(x).toFixed(dec)}%`;
}

function compact(v) {
  if (!ok(v)) return '–';
  const x = n(v), a = Math.abs(x), s = x < 0 ? '−' : '';
  if (a >= 1e12) return `${s}${(a / 1e12).toFixed(2)} ล้านล้าน`;
  if (a >= 1e9) return `${s}${(a / 1e9).toFixed(2)} พันล้าน`;
  if (a >= 1e6) return `${s}${(a / 1e6).toFixed(2)} ล้าน`;
  if (a >= 1e4) return `${s}${(a / 1e3).toFixed(1)} พัน`;
  return `${s}${a.toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;
}

function toDate(iso) {
  if (!iso) return null;
  if (iso instanceof Date) return iso;
  if (typeof iso === 'number') return new Date(iso < 1e12 ? iso * 1000 : iso);
  const s = String(iso);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function date(iso) {
  const d = toDate(iso);
  if (!d) return '–';
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${String(d.getFullYear() + 543).slice(-2)}`;
}
function dateLong(iso) {
  const d = toDate(iso);
  if (!d) return '–';
  return `${d.getDate()} ${TH_MONTHS_LONG[d.getMonth()]} ${d.getFullYear() + 543}`;
}
function month(i, long = false) { return (long ? TH_MONTHS_LONG : TH_MONTHS)[((i % 12) + 12) % 12]; }

function rel(iso) {
  const d = toDate(iso);
  if (!d) return '–';
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'เมื่อสักครู่';
  if (s < 3600) return `${Math.floor(s / 60)} นาทีที่แล้ว`;
  if (s < 86400) return `${Math.floor(s / 3600)} ชั่วโมงที่แล้ว`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} วันที่แล้ว`;
  return date(d);
}

function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function iso(d) {
  d = toDate(d);
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function sym(s) {
  const x = String(s || '');
  if (x === 'GOLD965') return 'ทองแท่ง';
  if (x === 'CASH') return 'เงินสด';
  return x.replace(/\.BK$/i, '');
}
const CRYPTO_SET = new Set(['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'USDT', 'USDC', 'DOT', 'AVAX', 'LINK', 'TRX', 'MATIC', 'POL', 'TON', 'KUB']);
/** Guess asset class from a symbol: "PTT.BK"→TH, "BTC"→CRYPTO, "GOLD965"→GOLD, "CASH"→CASH, else US. */
function guessCls(s) {
  const x = String(s || '').toUpperCase();
  if (x.endsWith('.BK')) return 'TH';
  if (x === 'GOLD965') return 'GOLD';
  if (x === 'CASH') return 'CASH';
  if (CRYPTO_SET.has(x)) return 'CRYPTO';
  return 'US';
}
/** Normalise user input to a canonical symbol for a class: ("ptt","TH")→"PTT.BK". */
function normSym(s, cls) {
  let x = String(s || '').trim().toUpperCase().replace(/\s+/g, '');
  if (cls === 'TH' && x && !x.endsWith('.BK')) x += '.BK';
  if (cls === 'GOLD') x = 'GOLD965';
  if (cls === 'CASH') x = 'CASH';
  return x;
}
function tone(v) { return !ok(v) || n(v) === 0 ? '' : n(v) > 0 ? 'up' : 'down'; }
function clsName(c) { return CLS_NAME[c] || c || ''; }
function clsTone(c) { return CLS_TONE[c] || 'gray'; }
function greeting() {
  const h = new Date().getHours();
  if (h < 11) return 'อรุณสวัสดิ์';
  if (h < 16) return 'สวัสดีตอนบ่าย';
  if (h < 19) return 'สวัสดีตอนเย็น';
  return 'สวัสดีตอนค่ำ';
}

export default {
  n, ok, num, thb, money, pct, compact, toDate, date, dateLong, month, rel, isoToday, iso, sym, guessCls, normSym, tone, clsName, clsTone, greeting,
  MONTHS: TH_MONTHS, CLASSES: Object.keys(CLS_NAME),
};
