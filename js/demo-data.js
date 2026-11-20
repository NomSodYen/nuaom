// หนูออม — demo backend (ข้อมูลสมมติ) used when the app is not connected to Google yet,
// and by builders to test pages. Implements the same actions as the real API (SPEC §4).
const KEY = 'nuaom.demo.v1';
const today = new Date();
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysAgo = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return d; };
const nowIso = () => new Date().toISOString();

function rng(seedStr) {
  let h = 2166136261;
  for (const ch of String(seedStr)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const QUOTES = {
  'PTT.BK': { name: 'PTT Public Company Limited', price: 34.25, prevClose: 34.0, ccy: 'THB', cls: 'TH' },
  'ADVANC.BK': { name: 'Advanced Info Service', price: 288, prevClose: 289, ccy: 'THB', cls: 'TH' },
  'TISCO.BK': { name: 'TISCO Financial Group', price: 101.5, prevClose: 101, ccy: 'THB', cls: 'TH' },
  'CPALL.BK': { name: 'CP ALL', price: 52.25, prevClose: 53, ccy: 'THB', cls: 'TH' },
  'KBANK.BK': { name: 'Kasikornbank', price: 151.5, prevClose: 150.5, ccy: 'THB', cls: 'TH' },
  'BBL.BK': { name: 'Bangkok Bank', price: 148, prevClose: 148.5, ccy: 'THB', cls: 'TH' },
  'KO': { name: 'Coca-Cola Co', price: 69.8, prevClose: 69.35, ccy: 'USD', cls: 'US' },
  'SCHD': { name: 'Schwab US Dividend Equity ETF', price: 27.6, prevClose: 27.52, ccy: 'USD', cls: 'US' },
  'MSFT': { name: 'Microsoft Corp', price: 505, prevClose: 509.4, ccy: 'USD', cls: 'US' },
  'O': { name: 'Realty Income Corp', price: 56.9, prevClose: 57.2, ccy: 'USD', cls: 'US' },
  'VOO': { name: 'Vanguard S&P 500 ETF', price: 612, prevClose: 609, ccy: 'USD', cls: 'US' },
  'BTC': { name: 'Bitcoin', price: 2093530, prevClose: 2131700, ccy: 'THB', cls: 'CRYPTO' },
  'ETH': { name: 'Ethereum', price: 58818, prevClose: 60110, ccy: 'THB', cls: 'CRYPTO' },
  'GC=F': { name: 'Gold futures', price: 3729, prevClose: 3741, ccy: 'USD', cls: 'OTHER' },
  'THB=X': { name: 'USD/THB', price: 33.9, prevClose: 33.95, ccy: 'THB', cls: 'OTHER' },
};

const DIV_PATTERN = {
  'PTT.BK': { months: [3, 8], base: 0.9, growth: 0.02, ccy: 'THB' },
  'ADVANC.BK': { months: [3, 7], base: 4.5, growth: 0.06, ccy: 'THB' },
  'TISCO.BK': { months: [4], base: 6.5, growth: 0.03, ccy: 'THB' },
  'CPALL.BK': { months: [4], base: 0.75, growth: 0.08, ccy: 'THB' },
  'KBANK.BK': { months: [3, 8], base: 2.0, growth: 0.07, ccy: 'THB' },
  'BBL.BK': { months: [3, 8], base: 2.5, growth: 0.06, ccy: 'THB' },
  'KO': { months: [2, 5, 8, 11], base: 0.38, growth: 0.04, ccy: 'USD' },
  'SCHD': { months: [2, 5, 8, 11], base: 0.16, growth: 0.1, ccy: 'USD' },
  'MSFT': { months: [1, 4, 7, 10], base: 0.39, growth: 0.1, ccy: 'USD' },
  'O': { months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], base: 0.21, growth: 0.04, ccy: 'USD' },
  'VOO': { months: [2, 5, 8, 11], base: 1.2, growth: 0.06, ccy: 'USD' },
};

function seedState() {
  const tx = [
    ['2023-03-10', 'BUY', 'TH', 'PTT.BK', 2000, 33.5, 'THB', 117, 0, 1, 'LONG', 'หุ้นปันผลพลังงาน'],
    ['2023-08-02', 'BUY', 'TH', 'ADVANC.BK', 200, 210, 'THB', 66, 0, 1, 'LONG', ''],
    ['2024-01-15', 'BUY', 'TH', 'TISCO.BK', 300, 98, 'THB', 46, 0, 1, 'LONG', 'ปันผลสูง'],
    ['2025-09-01', 'BUY', 'TH', 'CPALL.BK', 500, 58, 'THB', 45, 0, 1, 'SHORT', 'ลองเก็งรอบสั้น'],
    ['2023-05-01', 'BUY', 'US', 'KO', 30, 58, 'USD', 1, 0, 35.2, 'LONG', ''],
    ['2024-11-01', 'BUY', 'US', 'SCHD', 60, 26, 'USD', 1, 0, 34.5, 'LONG', 'ETF ปันผล'],
    ['2024-06-01', 'BUY', 'US', 'MSFT', 5, 410, 'USD', 1, 0, 36, 'LONG', ''],
    ['2025-08-01', 'SELL', 'US', 'MSFT', 1, 480, 'USD', 1, 0, 33, 'LONG', 'ขายทำกำไรบางส่วน'],
    ['2025-03-01', 'BUY', 'CRYPTO', 'BTC', 0.02, 1900000, 'THB', 95, 0, 1, 'SHORT', ''],
    ['2024-06-10', 'BUY', 'GOLD', 'GOLD965', 2, 41000, 'THB', 0, 0, 1, 'LONG', 'ทองแท่ง 2 บาท'],
    ['2023-01-05', 'DEPOSIT', 'CASH', 'CASH', 50000, 1, 'THB', 0, 0, 1, 'LONG', 'เงินสำรอง'],
    ['2025-09-12', 'DIV', 'TH', 'PTT.BK', 2000, 1.0, 'THB', 0, 200, 1, 'LONG', ''],
    ['2026-04-28', 'DIV', 'TH', 'PTT.BK', 2000, 1.2, 'THB', 0, 240, 1, 'LONG', ''],
    ['2026-05-20', 'DIV', 'TH', 'TISCO.BK', 300, 7.75, 'THB', 0, 232.5, 1, 'LONG', ''],
    ['2026-04-25', 'DIV', 'TH', 'ADVANC.BK', 200, 7.6, 'THB', 0, 152, 1, 'LONG', ''],
    ['2026-07-01', 'DIV', 'US', 'KO', 30, 0.51, 'USD', 0, 2.3, 33.6, 'LONG', ''],
    ['2026-10-01', 'DIV', 'US', 'KO', 30, 0.51, 'USD', 0, 2.3, 33.8, 'LONG', ''],
    ['2026-09-30', 'DIV', 'US', 'SCHD', 60, 0.26, 'USD', 0, 2.34, 33.7, 'LONG', ''],
    ['2026-09-11', 'DIV', 'US', 'MSFT', 4, 0.83, 'USD', 0, 0.5, 33.7, 'LONG', ''],
  ].map((r, i) => ({
    id: 'demo' + (i + 1), date: r[0], type: r[1], cls: r[2], symbol: r[3], qty: r[4], price: r[5], ccy: r[6],
    fee: r[7], tax: r[8], fx: r[9], bucket: r[10], note: r[11], created: r[0] + 'T10:00:00+07:00',
  }));
  return {
    settings: {
      display_name: 'นักออม', dividend_goal_month: 4000,
      target_alloc: { TH: 40, US: 35, CRYPTO: 5, GOLD: 10, CASH: 10 },
      max_position_pct: 15, max_crypto_pct: 10, max_short_pct: 20, emergency_months: 6,
      rules_text: '1. ซื้อหุ้นปันผลเมื่ออัตราปันผล ≥ 5%\n2. หุ้นตัวเดียวไม่เกิน 15% ของพอร์ต\n3. คริปโตไม่เกิน 10%\n4. ตลาดร่วงแรง ห้ามขายตามคนอื่น ทบทวนเหตุผลก่อน',
      line_enabled: false, wht: { TH: 10, US: 15 }, checklist_on_buy: true,
    },
    tx,
    watch: [
      { symbol: 'KBANK.BK', cls: 'TH', name: 'Kasikornbank', note: 'รอปันผลเกิน 6%', min_yield: 6, max_pe: 9, price_below: '', price_above: '', added: '2026-10-02' },
      { symbol: 'BBL.BK', cls: 'TH', name: 'Bangkok Bank', note: '', min_yield: 6, max_pe: '', price_below: 140, price_above: '', added: '2026-09-15' },
      { symbol: 'O', cls: 'US', name: 'Realty Income', note: 'REIT จ่ายรายเดือน', min_yield: 5.5, max_pe: '', price_below: 55, price_above: '', added: '2026-08-20' },
      { symbol: 'VOO', cls: 'US', name: 'Vanguard S&P 500', note: 'DCA ทุกเดือน', min_yield: '', max_pe: '', price_below: 590, price_above: '', added: '2026-07-01' },
    ],
    alerts: [
      { id: 'al1', symbol: 'GOLD965', cls: 'GOLD', kind: 'GOLD_BELOW', value: 58000, active: true, last_fired: '', note: 'ทองย่อจะซื้อเพิ่ม' },
      { id: 'al2', symbol: 'PTT.BK', cls: 'TH', kind: 'PRICE_BELOW', value: 32, active: true, last_fired: '', note: '' },
      { id: 'al3', symbol: 'BTC', cls: 'CRYPTO', kind: 'CHANGE_PCT', value: 5, active: true, last_fired: '', note: 'วันไหนขยับแรงให้เตือน' },
    ],
    journal: [
      { id: 'j1', date: '2025-09-01', symbol: 'CPALL.BK', action: 'BUY', reason: 'ราคาลงมาเยอะ คิดว่าจะเด้งช่วงไตรมาส 4', exit_plan: 'ขายถ้าขึ้น 10% หรือตัดขาดทุนที่ −7%', confidence: 3, emotion: 'ตื่นเต้น', checklist: '{"why":true,"exit":true,"size":true,"news":false,"emergency":true}', review_date: '2025-12-01', review_note: '', created: '2025-09-01T10:00:00+07:00' },
      { id: 'j2', date: '2024-11-01', symbol: 'SCHD', action: 'BUY', reason: 'อยากได้กระแสปันผลจากหุ้นอเมริกาที่กระจายตัว', exit_plan: 'ถือยาว ทบทวนปีละครั้ง', confidence: 4, emotion: 'มั่นใจ', checklist: '{"why":true,"exit":true,"size":true,"news":true,"emergency":true}', review_date: '2025-11-01', review_note: 'ปันผลเข้าตามคาด ถือต่อ', created: '2024-11-01T10:00:00+07:00' },
    ],
    news: demoNews(),
    lineReady: false,
  };
}

function demoNews() {
  const d0 = iso(today);
  const sat = new Date(today); sat.setDate(sat.getDate() - ((sat.getDay() + 1) % 7));
  return [
    {
      id: 'n1', date: d0, kind: 'DAILY', title: 'ข่าวเช้า ' + d0, summary: 'ตลาดโลกนิ่ง ทองย่อ คริปโตอ่อนตัว', created: d0 + 'T08:31:00+07:00',
      body: {
        headline: 'ตลาดโลกนิ่งก่อนตัวเลขเงินเฟ้อสหรัฐฯ ทองย่อลงเล็กน้อย (ตัวอย่าง)', mood: 'calm',
        sections: [
          { key: 'global', title: 'ตลาดโลก', items: [
            { text: 'ดัชนีหุ้นสหรัฐฯ ปิดแกว่งแคบ นักลงทุนรอตัวเลขเงินเฟ้อ', impact: 'neutral', source: 'ตัวอย่าง', url: 'https://example.com' },
            { text: 'ดอลลาร์อ่อนค่าเล็กน้อย เงินบาทแข็งขึ้นมาที่ 33.9', impact: 'down', source: 'ตัวอย่าง', url: 'https://example.com' } ] },
          { key: 'thai', title: 'ตลาดไทย', items: [
            { text: 'นักลงทุนต่างชาติซื้อสุทธิ 3 วันติดกัน กลุ่มธนาคารนำตลาด', impact: 'up', source: 'ตัวอย่าง', url: 'https://example.com' } ] },
          { key: 'portfolio', title: 'เกี่ยวกับพอร์ตคุณ', items: [
            { text: 'KO ประกาศจ่ายปันผลไตรมาสถัดไปเท่าเดิม 0.51 ดอลลาร์', impact: 'neutral', source: 'ตัวอย่าง', url: 'https://example.com' },
            { text: 'CPALL ยังต่ำกว่าต้นทุน 10% ใกล้จุดตัดขาดทุนที่คุณเขียนไว้ในบันทึก', impact: 'down', source: 'ตัวอย่าง', url: 'https://example.com' } ] },
          { key: 'gold_crypto', title: 'ทองและคริปโต', items: [
            { text: 'ทองแท่งลง 850 บาทจากเมื่อวาน', impact: 'down', source: 'สมาคมค้าทองคำ', url: 'https://www.goldtraders.or.th/' } ] },
        ],
        rule_hits: [{ symbol: 'KBANK.BK', rule: 'min_yield', detail: 'อัตราปันผล 6.1% สูงกว่าเกณฑ์ 6% ที่คุณตั้งไว้ (ตัวอย่าง)' }],
        calendar: [{ date: d0, event: 'ตัวเลขเงินเฟ้อสหรัฐฯ (CPI)' }],
        critic: 'ข่าวดีของกลุ่มธนาคารอาจถูกสะท้อนในราคาไปแล้ว อย่าเพิ่งรีบไล่ราคา',
        disclaimer: 'ข้อมูลเพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน',
      },
    },
    {
      id: 'n2', date: iso(sat), kind: 'WEEKLY', title: 'สรุปสัปดาห์ + เรดาร์ธีม', summary: 'ธีมที่ตลาดพูดถึงสัปดาห์นี้ (ตัวอย่าง)', created: iso(sat) + 'T09:05:00+07:00',
      body: {
        headline: 'สัปดาห์นี้พอร์ตทรงตัว ปันผลเข้า 2 ตัว (ตัวอย่าง)', mood: 'good',
        sections: [{ key: 'portfolio', title: 'พอร์ตสัปดาห์นี้', items: [{ text: 'มูลค่าพอร์ต +0.6% จากสัปดาห์ก่อน', impact: 'up' }] }],
        themes: [
          { name: 'หุ้นปันผลกลุ่มธนาคารไทย', heat: 3, evidence: [{ text: 'ต่างชาติซื้อสุทธิกลุ่มธนาคาร', url: 'https://example.com' }], bull: ['อัตราปันผลสูง', 'มูลค่าไม่แพง'], bear: ['หนี้เสียอาจเพิ่ม', 'ดอกเบี้ยขาลงกดกำไร'], related: ['KBANK.BK', 'BBL.BK'] },
          { name: 'ทองคำ', heat: 4, evidence: [{ text: 'ธนาคารกลางหลายประเทศซื้อทองต่อเนื่อง', url: 'https://example.com' }], bull: ['ช่วยกระจายความเสี่ยง'], bear: ['ราคาขึ้นมาแรง ผันผวนสูง'], related: ['GOLD965'] },
          { name: 'คริปโต', heat: 5, evidence: [{ text: 'ราคาเหวี่ยงแรงทั้งสองทาง', url: 'https://example.com' }], bull: ['เงินทุนสถาบันไหลเข้า'], bear: ['คนแห่เยอะ เสี่ยงซื้อแล้วติดดอย'], related: ['BTC'] },
        ],
        upcoming_xd: [
          { symbol: 'KO', xd: iso(daysAgo(-12)), amount: 0.51, pay: iso(daysAgo(-26)), url: 'https://example.com', confirmed: true },
        ],
        critic: 'ธีมที่ร้อนระดับ 5 มักขึ้นมาเยอะแล้ว ถ้าจะเข้า ควรแบ่งไม้และมีจุดตัดขาดทุน',
        disclaimer: 'ข้อมูลเพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน',
      },
    },
  ];
}

function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.tx) return s; } catch (e) { /* ignore */ }
  return seedState();
}
let state = null;
const st = () => (state ||= load());
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } };

function quote(symbol) {
  const q = QUOTES[symbol];
  if (!q) return null;
  return { symbol, cls: q.cls, name: q.name, price: q.price, prevClose: q.prevClose, changePct: ((q.price - q.prevClose) / q.prevClose) * 100, ccy: q.ccy, updated: nowIso(), source: 'demo' };
}

const GOLD = { time: iso(today) + 'T09:30:00', barBuy: 59700, barSell: 59900, ornBuy: 58502.44, ornSell: 60700, spotUsd: 3729, thbUsd: 33.9, changeToday: -850 };

function points(range, interval) {
  const tbl = { '1mo': 22, '6mo': 126, '1y': 250, '5y': 260, '10y': 520, max: 600 };
  let n = tbl[range] || 250;
  let stepDays = 1.4;
  if (interval === '1wk') { n = { '1y': 52, '5y': 260, '10y': 520, max: 600 }[range] || 52; stepDays = 7; }
  if (interval === '1mo') { n = { '1y': 12, '5y': 60, '10y': 120, max: 180 }[range] || 60; stepDays = 30.4; }
  return { n, stepDays };
}

function history(symbol, range = '1y', interval = '1d') {
  const q = QUOTES[symbol] || (symbol === 'GOLD965' ? { price: GOLD.barBuy } : { price: 100 });
  const { n, stepDays } = points(range, interval);
  const r = rng(symbol + range + interval);
  const vol = symbol === 'BTC' || symbol === 'ETH' ? 0.035 : 0.012;
  const drift = 0.0004 * stepDays;
  const c = [q.price];
  for (let i = 1; i < n; i++) {
    const prev = c[i - 1];
    const shock = (r() - 0.5) * 2 * vol * Math.sqrt(stepDays);
    c.push(Math.max(0.01, prev / (1 + drift + shock)));
  }
  c.reverse();
  const t = c.map((_, i) => Math.round((Date.now() - (n - 1 - i) * stepDays * 86400000) / 1000));
  return { t, c: c.map((x) => Math.round(x * 100) / 100), ccy: (QUOTES[symbol] || {}).ccy || 'THB' };
}

function dividends(symbol) {
  const p = DIV_PATTERN[symbol];
  if (!p) return { ccy: (QUOTES[symbol] || {}).ccy || 'THB', events: [] };
  const events = [];
  const y0 = today.getFullYear() - 10;
  for (let y = y0; y <= today.getFullYear(); y++) {
    const amt = p.base * Math.pow(1 + p.growth, y - y0) / p.months.length * (p.months.length > 2 ? p.months.length / 4 : 1);
    for (const m of p.months) {
      const d = new Date(y, m, 12);
      if (d > today) continue;
      events.push({ date: iso(d), amount: Math.round(amt * 1000) / 1000 });
    }
  }
  return { ccy: p.ccy, events };
}

function fundamentals(symbol) {
  const q = QUOTES[symbol];
  if (!q || q.cls === 'CRYPTO' || q.cls === 'OTHER') return { ccy: q?.ccy || 'THB', years: [], eps: [], revenue: [], netIncome: [], equity: [], totalDebt: [], fcf: [], shares: [], cash: [] };
  const r = rng('f' + symbol);
  const years = [2021, 2022, 2023, 2024, 2025];
  const shares = q.cls === 'TH' ? 2.8e9 + r() * 2e10 : 4e8 + r() * 7e9;
  const eps0 = q.price / (12 + r() * 10);
  const eps = years.map((_, i) => +(eps0 * Math.pow(1.05 + r() * 0.04, i - 4) * (0.92 + r() * 0.16)).toFixed(3));
  const netIncome = eps.map((e) => e * shares);
  const revenue = netIncome.map((ni) => ni * (6 + r() * 6));
  const equity = netIncome.map((ni, i) => ni * (7 + i * 0.3));
  const totalDebt = equity.map((e) => e * (0.3 + r() * 0.7));
  const fcf = netIncome.map((ni) => ni * (0.7 + r() * 0.5));
  const cash = equity.map((e) => e * 0.12);
  return { ccy: q.ccy, years, eps, revenue, netIncome, equity, totalDebt, fcf, shares: years.map(() => shares), cash };
}

function screener() {
  const rows = [
    ['PTT.BK', 'TH', 'PTT', 'พลังงาน', 34.25, 'THB', 6.4, 2.2, 15, 3.1, 62, 10.2, 0.85, 8.9, 0.75, 1.8],
    ['ADVANC.BK', 'TH', 'Advanced Info Service', 'สื่อสาร', 288, 'THB', 4.1, 11.8, 20, 6.5, 85, 20.5, 8.2, 38.0, 1.2, 9.4],
    ['TISCO.BK', 'TH', 'TISCO Financial', 'ธนาคาร', 101.5, 'THB', 7.6, 7.75, 18, 2.8, 79, 10.8, 1.75, 16.5, 5.9, 1.2],
    ['CPALL.BK', 'TH', 'CP ALL', 'ค้าปลีก', 52.25, 'THB', 2.6, 1.35, 12, 9.0, 52, 18.4, 3.6, 19.1, 2.4, 14.0],
    ['KBANK.BK', 'TH', 'Kasikornbank', 'ธนาคาร', 151.5, 'THB', 6.1, 9.25, 14, 12.0, 45, 7.6, 0.68, 9.2, 6.1, 11.5],
    ['BBL.BK', 'TH', 'Bangkok Bank', 'ธนาคาร', 148, 'THB', 5.4, 8.0, 16, 9.5, 37, 6.9, 0.48, 7.1, 5.3, 8.0],
    ['SCB.BK', 'TH', 'SCB X', 'ธนาคาร', 118, 'THB', 8.1, 9.6, 10, 15.0, 82, 9.9, 0.86, 9.0, 4.8, 6.0],
    ['INTUCH.BK', 'TH', 'Intouch Holdings', 'สื่อสาร', 98.75, 'THB', 3.9, 3.85, 17, 4.1, 90, 23.0, 7.4, 33.0, 0.1, 8.8],
    ['LH.BK', 'TH', 'Land and Houses', 'อสังหาฯ', 4.9, 'THB', 9.2, 0.45, 20, -3.0, 98, 10.6, 0.95, 9.0, 1.3, -6.0],
    ['KO', 'US', 'Coca-Cola', 'สินค้าอุปโภค', 69.8, 'USD', 2.9, 2.04, 60, 4.5, 72, 25.1, 10.2, 40.0, 1.7, 6.2],
    ['PEP', 'US', 'PepsiCo', 'สินค้าอุปโภค', 152, 'USD', 3.7, 5.6, 50, 7.0, 78, 21.0, 11.0, 50.0, 2.4, 3.0],
    ['JNJ', 'US', 'Johnson & Johnson', 'สุขภาพ', 186, 'USD', 2.8, 5.2, 60, 5.3, 48, 17.9, 6.1, 33.0, 0.5, 7.5],
    ['O', 'US', 'Realty Income', 'อสังหาฯ (REIT)', 56.9, 'USD', 5.7, 3.22, 30, 3.6, 290, 51.0, 1.3, 2.4, 0.7, 1.0],
    ['MSFT', 'US', 'Microsoft', 'เทคโนโลยี', 505, 'USD', 0.7, 3.32, 21, 10.2, 25, 36.5, 11.4, 32.0, 0.2, 15.6],
    ['SCHD', 'US', 'Schwab US Dividend ETF', 'กองทุน ETF', 27.6, 'USD', 3.8, 1.05, 13, 11.0, null, null, null, null, null, null],
    ['VZ', 'US', 'Verizon', 'สื่อสาร', 43.2, 'USD', 6.3, 2.71, 19, 2.0, 58, 10.0, 1.8, 18.0, 1.6, 2.5],
  ];
  return {
    updated: iso(today) + 'T05:12:00+07:00',
    rows: rows.map((r) => ({ symbol: r[0], cls: r[1], name: r[2], sector: r[3], price: r[4], ccy: r[5], div_yield: r[6], dps_ttm: r[7], div_years: r[8], div_cagr5: r[9], payout: r[10], pe: r[11], pb: r[12], roe: r[13], de: r[14], eps_cagr3: r[15], updated: iso(today) })),
  };
}

function snapshots() {
  const r = rng('snap');
  const out = [];
  let v = 520000;
  for (let i = 400; i >= 0; i--) {
    v = v * (1 + (r() - 0.47) * 0.012);
    const d = daysAgo(i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    out.push({ date: iso(d), value_thb: Math.round(v), cost_thb: 470000 + Math.round((400 - i) * 80), by_cls: {} });
  }
  const last = out[out.length - 1];
  const scale = 589000 / last.value_thb;
  return out.map((s) => ({ ...s, value_thb: Math.round(s.value_thb * scale) }));
}

const uid = () => Math.random().toString(36).slice(2, 12);

export async function demoCall(a, p = {}) {
  await new Promise((r) => setTimeout(r, 120));
  // like a real network call: callers always get fresh copies, never the demo database's own objects
  const out = demoInner(a, structuredClone(p));
  return out === undefined ? out : structuredClone(out);
}

function demoInner(a, p) {
  const s = st();
  const upsert = (arr, key, row) => { const i = arr.findIndex((x) => x[key] === row[key]); if (i >= 0) arr[i] = { ...arr[i], ...row }; else arr.push(row); return row; };
  switch (a) {
    case 'ping': return { version: 'demo', time: nowIso() };
    case 'bootstrap': {
      const syms = new Set([...s.tx.map((t) => t.symbol), ...s.watch.map((w) => w.symbol)]);
      const quotes = {};
      for (const x of syms) { const q = quote(x); if (q) quotes[x] = q; }
      // return copies: the store must never share arrays with the demo "database"
      return structuredClone({ settings: s.settings, tx: s.tx, watch: s.watch, alerts: s.alerts, journal: s.journal, news: s.news, quotes, fx: { USD: 33.9, THB: 1 }, gold: { latest: GOLD }, snapshots: snapshots(), lineReady: s.lineReady });
    }
    case 'quotes': { const out = {}; for (const x of p.symbols || []) { const q = quote(x.symbol); if (q) out[x.symbol] = q; } return out; }
    case 'history': return history(p.symbol, p.range, p.interval);
    case 'dividends': return dividends(p.symbol);
    case 'fundamentals': return fundamentals(p.symbol);
    case 'gold': {
      const hs = history('GOLD965', '1y', '1d');
      const hist = hs.c.map((c, i) => ({ time: new Date(hs.t[i] * 1000).toISOString(), bar_buy: Math.round(c / 50) * 50, bar_sell: Math.round(c / 50) * 50 + 200, orn_buy: Math.round(c * 0.98), orn_sell: Math.round(c * 1.017), spot_usd: Math.round(c / 16), thb_usd: 33.9 }));
      return { latest: GOLD, history: hist, world: history('GC=F', '1y', '1d') };
    }
    case 'screener': return screener();
    case 'news': return s.news.filter((n) => !p.kind || n.kind === p.kind).slice(0, p.limit || 30);
    case 'tx.add': { const row = { ...p.row, id: uid(), created: nowIso() }; s.tx.push(row); save(); return row; }
    case 'tx.update': { upsert(s.tx, 'id', p.row); save(); return p.row; }
    case 'tx.addMany': { for (const r of p.rows || []) s.tx.push({ ...r, id: uid(), created: nowIso() }); save(); return { count: (p.rows || []).length }; }
    case 'tx.delete': { s.tx = s.tx.filter((t) => t.id !== p.id); save(); return { id: p.id }; }
    case 'watch.upsert': { const row = { added: iso(today), ...p.row, symbol: String(p.row.symbol).toUpperCase() }; upsert(s.watch, 'symbol', row); save(); return row; }
    case 'watch.delete': { s.watch = s.watch.filter((w) => w.symbol !== p.symbol); save(); return { symbol: p.symbol }; }
    case 'alerts.upsert': { const row = { active: true, ...p.row, id: p.row.id || uid() }; upsert(s.alerts, 'id', row); save(); return row; }
    case 'alerts.delete': { s.alerts = s.alerts.filter((x) => x.id !== p.id); save(); return { id: p.id }; }
    case 'journal.upsert': { const row = { ...p.row, id: p.row.id || uid(), created: p.row.created || nowIso() }; if (typeof row.checklist === 'object') row.checklist = JSON.stringify(row.checklist); upsert(s.journal, 'id', row); save(); return row; }
    case 'journal.delete': { s.journal = s.journal.filter((x) => x.id !== p.id); save(); return { id: p.id }; }
    case 'settings.save': { s.settings = { ...s.settings, ...p.settings }; save(); return s.settings; }
    case 'secrets.set': { s.lineReady = !!(p.LINE_TOKEN || s.lineReady); save(); return { lineReady: s.lineReady }; }
    case 'line.test': return { sent: false, demo: true };
    case 'line.quota': return { limit: 300, used: 12 };
    case 'news.post': { const row = { ...p.item, id: uid(), created: nowIso() }; s.news.unshift(row); save(); return row; }
    case 'export': return { Transactions: s.tx, Watchlist: s.watch, Alerts: s.alerts, Journal: s.journal, News: s.news, Settings: s.settings };
    default: throw new Error('โหมดตัวอย่างยังไม่รองรับคำสั่ง ' + a);
  }
}

export function resetDemo() { localStorage.removeItem(KEY); state = null; }
