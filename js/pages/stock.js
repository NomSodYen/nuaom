// หนูออม — ส่องหุ้น (Builder D)
import fmtMod from '../fmt.js';

const RANGES = [
  { value: '1mo', label: '1 เดือน', interval: '1d' },
  { value: '6mo', label: '6 เดือน', interval: '1d' },
  { value: '1y', label: '1 ปี', interval: '1d' },
  { value: '5y', label: '5 ปี', interval: '1wk' },
  { value: '10y', label: '10 ปี', interval: '1mo' },
];

const EXPLAIN = [
  ['P/E (ราคาต่อกำไร)', 'ราคาหุ้นหารด้วยกำไรต่อหุ้น (EPS) บอกว่าจ่ายกี่เท่าของกำไรต่อปี ตัวเลขต่ำมักถูกมองว่าราคาไม่แพง ส่วนตัวเลขสูงอาจแปลว่าตลาดคาดหวังการเติบโต ขึ้นกับอุตสาหกรรม จึงควรเทียบกับหุ้นในกลุ่มเดียวกันและกับอดีตของหุ้นเอง'],
  ['อัตราปันผล (Yield)', 'ปันผลต่อหุ้นใน 12 เดือนหารด้วยราคาปัจจุบัน ยิ่งสูงยิ่งได้เงินสดมาก แต่ถ้าสูงผิดปกติ อาจเป็นเพราะราคาหุ้นตกหนักหรือปันผลอาจลดลงในอนาคต ควรดูควบคู่กับความสม่ำเสมอ'],
  ['ROE (ผลตอบแทนต่อส่วนผู้ถือหุ้น)', 'กำไรสุทธิหารส่วนของผู้ถือหุ้น บอกว่าบริษัทใช้เงินของเจ้าของสร้างกำไรได้ดีแค่ไหน มักมองว่าตั้งแต่ 10–15% ขึ้นไปค่อนข้างดี แต่ขึ้นกับอุตสาหกรรม และถ้าบริษัทกู้เยอะ ROE ก็อาจดูสูงเกินจริง'],
  ['D/E (หนี้สินต่อทุน)', 'หนี้ที่มีดอกเบี้ยหารส่วนของผู้ถือหุ้น ยิ่งต่ำยิ่งเสี่ยงน้อย โดยทั่วไป 1–2 เท่าถือว่าพอรับได้ แต่ธนาคารและสถาบันการเงินมี D/E สูงเป็นปกติ ขึ้นกับอุตสาหกรรม'],
  ['FCF (กระแสเงินสดอิสระ)', 'เงินสดที่เหลือหลังหักเงินลงทุนในกิจการ เป็นแหล่งที่มาของปันผลและการจ่ายหนี้ ถ้าเป็นบวกต่อเนื่องมักถือว่าดี ถ้าติดลบหลายปีควรดูว่าเป็นเพราะกำลังขยายกิจการหรือไม่'],
  ['Payout (สัดส่วนจ่ายปันผล)', 'ปันผลต่อหุ้นหารกำไรต่อหุ้น ถ้าต่ำกว่า 60–80% มักมีเหลือไว้ลงทุนต่อ ถ้าเกิน 100% แปลว่าจ่ายมากกว่ากำไรที่ทำได้ ซึ่งอาจไปต่อได้ไม่นาน ขึ้นกับอุตสาหกรรม (เช่น REIT จ่ายสูงเป็นปกติ)'],
];

export default {
  title: (params) => (params && params[0] ? fmtMod.sym(String(params[0]).toUpperCase()) : 'ส่องหุ้น'),
  async render(root, params, ctx) {
    const { store, ui, fmt, calc, nav, chart } = ctx;
    const { h, icon } = ui;
    const symbol = String(params[0] || '').toUpperCase();
    let dead = false;
    let range = '1y';
    const showSma = { 50: false, 200: false };
    const D = { quote: null, hist: null, daily: null, divs: null, fund: null, loaded: false };

    if (!symbol) {
      root.append(ui.empty({ mood: 'worried', title: 'ยังไม่ได้เลือกหุ้น', text: 'กดไอคอนค้นหาด้านบนเพื่อพิมพ์ชื่อย่อหุ้น' }));
      return () => {};
    }

    const holding = () => store.get().derived.holdings.find((x) => x.symbol === symbol);
    const watchRow = () => store.get().watch.find((w) => w.symbol === symbol);
    const clsOf = () => holding()?.cls || watchRow()?.cls || fmt.guessCls(symbol);
    const fundOk = () => ['TH', 'US'].includes(clsOf());

    const headerBox = h('div');
    const chartBox = h('div');
    const techBox = h('div');
    const posBox = h('div');
    const divBox = h('div');
    const fundBox = h('div');
    const flagBox = h('div');
    const explainBox = h('div');
    const actionBox = h('div');
    root.append(headerBox, chartBox, techBox, posBox, divBox, fundBox, flagBox, explainBox, actionBox, ui.disclaimer());
    headerBox.append(ui.skeleton(3));

    // ---------- header ----------
    const drawHeader = () => {
      const q = D.quote, hd = holding(), cls = clsOf();
      const price = q?.price ?? hd?.price;
      const ccy = q?.ccy || hd?.ccy || (cls === 'US' ? 'USD' : 'THB');
      const ch = q?.changePct;
      headerBox.replaceChildren(ui.card({
        tone: fmt.clsTone(cls),
        body: h('div', null,
          h('div', { class: 'row wrap' }, h('h1', null, fmt.sym(symbol)), ui.chip(fmt.clsName(cls), fmt.clsTone(cls))),
          h('div', { class: 'muted small', style: { marginTop: '2px' } }, q?.name || hd?.name || ''),
          h('div', { class: 'row wrap', style: { marginTop: '10px', alignItems: 'baseline' } },
            h('span', { class: 'hero-value num' }, fmt.money(price, ccy)),
            fmt.ok(ch) ? h('span', { class: `num ${fmt.tone(ch)}`, style: { fontWeight: '600' } }, (ch > 0 ? '▲ ' : ch < 0 ? '▼ ' : '') + fmt.pct(Math.abs(ch), { dec: 2 })) : null),
          q?.updated ? h('div', { class: 'faint', style: { marginTop: '4px' } }, 'อัปเดต ' + fmt.rel(q.updated)) : null),
      }));
    };

    // ---------- chart ----------
    const drawChart = () => {
      const body = h('div');
      const seg = ui.segment(RANGES.map((r) => ({ value: r.value, label: r.label })), range, (v) => { range = v; loadHist(); });
      const smaRow = h('div', { class: 'row wrap', style: { margin: '10px 0 4px' } },
        [50, 200].map((n) => h('span', {
          class: `chip clickable${showSma[n] ? ' t-' + (n === 50 ? 'sky' : 'lavender') : ''}`,
          role: 'button', tabindex: '0', style: { minHeight: '32px', padding: '4px 12px' },
          onClick: () => { showSma[n] = !showSma[n]; drawChart(); },
        }, (showSma[n] ? '✓ ' : '') + 'SMA ' + n)));
      body.append(h('div', null, seg), smaRow);
      const box = h('div', { class: 'chart-box' });
      body.append(box);
      chartBox.replaceChildren(h('div', { style: { marginTop: '12px' } }, ui.card({ title: 'กราฟราคา', icon: 'chart-line', body })));
      if (!D.hist) { box.append(ui.skeleton(4)); return; }
      const c = (D.hist.c || []).map(Number);
      const labels = (D.hist.t || []).map((t) => fmt.date(t));
      if (c.length < 2) { box.replaceWith(h('div', { class: 'faint center' }, 'ยังไม่มีข้อมูลกราฟ')); return; }
      const up = c[c.length - 1] >= c[0];
      const datasets = [{ label: 'ราคา', data: c, borderColor: chart.css(up ? '--up' : '--down'), backgroundColor: 'transparent', fill: false }];
      const missing = [];
      for (const n of [50, 200]) {
        if (!showSma[n]) continue;
        const s = calc.technical.sma(c, n);
        if (s.every((x) => x === null)) { missing.push(n); continue; }
        datasets.push({ label: 'SMA ' + n, data: s, borderColor: chart.colors[n === 50 ? 1 : 4], borderWidth: 1.5 });
      }
      if (missing.length) body.append(h('div', { class: 'faint', style: { marginTop: '6px' } }, `ช่วงนี้ข้อมูลไม่พอสำหรับ SMA ${missing.join(', ')} ลองเลือกช่วงที่ยาวขึ้น`));
      chart(box, {
        type: 'line', data: { labels, datasets },
        options: {
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { display: datasets.length > 1 }, tooltip: { callbacks: { label: (i) => `${i.dataset.label}: ${fmt.num(i.parsed.y, 2)}` } } },
          scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 6, maxRotation: 0, autoSkip: true } }, y: { ticks: { maxTicksLimit: 5 } } },
        },
      });
    };

    // ---------- technical ----------
    const drawTech = () => {
      const closes = (D.daily?.c || []).map(Number);
      if (closes.length < 20) { techBox.replaceChildren(); return; }
      const rsiArr = calc.technical.rsi(closes, 14);
      const r = [...rsiArr].reverse().find((x) => x !== null);
      const rg = calc.technical.range52w(closes);
      const note = r >= 70 ? 'ราคาขึ้นเร็ว อาจร้อนแรงเกินไป' : r <= 30 ? 'ราคาลงแรง อาจถูกขายมากเกินไป' : 'อยู่ในช่วงปกติ';
      const tone = r >= 70 ? 'peach' : r <= 30 ? 'sky' : 'mint';
      const ccy = D.quote?.ccy || holding()?.ccy || 'THB';
      techBox.replaceChildren(h('div', { style: { marginTop: '12px' } }, ui.card({
        title: 'ภาพรวมทางเทคนิค', icon: 'activity', sub: 'ใช้ประกอบเท่านั้น',
        body: h('div', null,
          r != null ? h('div', { class: 'row between' },
            h('div', null, h('div', { class: 'muted small' }, 'RSI (14 วัน)'), h('div', { style: { fontSize: '24px', fontWeight: '700' }, class: 'num' }, fmt.num(r, 1))),
            ui.chip(note, tone)) : null,
          h('div', { class: 'divider' }),
          h('div', { class: 'muted small' }, 'ช่วงราคา 52 สัปดาห์'),
          h('div', { style: { margin: '8px 0 4px' } }, ui.progress(rg.posPct, 'sky')),
          h('div', { class: 'row between small num' },
            h('span', null, 'ต่ำ ' + fmt.money(rg.low, ccy)),
            h('span', { class: 'muted' }, `อยู่ที่ ${fmt.num(rg.posPct, 0)}% ของช่วง`),
            h('span', null, 'สูง ' + fmt.money(rg.high, ccy)))),
      })));
    };

    // ---------- position ----------
    const openTx = async (type) => {
      try {
        const { openTxSheet } = await import('./portfolio.js');
        const q = D.quote, hd = holding();
        await openTxSheet(ctx, { type, cls: clsOf(), symbol, ccy: q?.ccy || hd?.ccy, price: q?.price });
      } catch (e) { ui.toast('เปิดหน้าบันทึกรายการไม่ได้', 'down'); }
    };
    const drawPos = () => {
      const hd = holding(), cls = clsOf();
      const kids = [];
      if (hd) {
        kids.push(ui.card({
          title: 'ในพอร์ตของคุณ', icon: 'briefcase', tone: 'mint',
          body: h('div', null,
            h('dl', { class: 'kv', style: { margin: 0 } },
              h('dt', null, 'จำนวน'), h('dd', null, fmt.num(hd.qty, hd.qty % 1 ? 4 : 0)),
              h('dt', null, 'ต้นทุนเฉลี่ย'), h('dd', null, fmt.money(hd.avgCost, hd.ccy)),
              h('dt', null, 'มูลค่าตอนนี้'), h('dd', null, fmt.thb(hd.valueTHB)),
              h('dt', null, 'กำไร/ขาดทุน'), h('dd', { class: fmt.tone(hd.unrealizedTHB) }, `${fmt.thb(hd.unrealizedTHB, { sign: true })} (${fmt.pct(hd.unrealizedPct, { sign: true })})`),
              h('dt', null, 'ปันผลที่ได้รับ (สุทธิ)'), h('dd', null, fmt.thb(hd.divNetTHB))),
            h('div', { class: 'btn-row', style: { marginTop: '12px' } },
              ui.button('บันทึกการซื้อ', { variant: 'soft', icon: 'plus', onClick: () => openTx('BUY') }),
              ui.button('บันทึกการขาย', { variant: 'ghost', icon: 'minus', onClick: () => openTx('SELL') }))),
        }));
      } else {
        kids.push(h('div', { class: 'btn-row' }, ui.button('บันทึกการซื้อ', { variant: 'soft', icon: 'plus', onClick: () => openTx('BUY') })));
      }
      if (!watchRow()) {
        kids.push(h('div', { style: { marginTop: '10px' } }, ui.button('เพิ่มในรายการจับตา', {
          variant: 'soft', icon: 'star', block: true,
          onClick: async () => {
            try {
              await store.upsertWatch({ symbol, cls, name: D.quote?.name || holding()?.name || '' });
              ui.toast('เพิ่มในรายการจับตาแล้ว', 'up');
            } catch (e) { ui.toast(e.message, 'down'); }
          },
        })));
      }
      posBox.replaceChildren(h('div', { style: { marginTop: '12px' } }, kids));
    };

    // ---------- dividends ----------
    const drawDiv = () => {
      if (!fundOk()) { divBox.replaceChildren(); return; }
      const ev = D.divs?.events || [];
      const ccy = D.divs?.ccy || D.quote?.ccy || 'THB';
      if (!ev.length) {
        divBox.replaceChildren(h('div', { style: { marginTop: '12px' } }, ui.card({ title: 'เงินปันผล', icon: 'coin', body: h('div', { class: 'muted' }, 'ไม่พบประวัติการจ่ายปันผลของหุ้นตัวนี้') })));
        return;
      }
      const price = D.quote?.price ?? holding()?.price;
      const st = calc.dividends.stats(ev, price);
      const yrs = st.years.slice(-10);
      const box = h('div', { class: 'chart-box short' });
      const g = (v) => (v == null ? '–' : fmt.pct(v, { sign: true }));
      divBox.replaceChildren(h('div', { style: { marginTop: '12px' } }, ui.card({
        title: 'เงินปันผล', icon: 'coin',
        body: h('div', null,
          ui.metrics([
            { label: 'ปันผล 12 เดือน', value: fmt.money(st.ttm, ccy), sub: 'ต่อหุ้น' },
            { label: 'อัตราปันผล', value: fmt.pct(st.yieldPct, { dec: 2 }) },
            { label: 'จ่ายต่อเนื่อง', value: `${st.consecutiveYears} ปี` },
            { label: 'จ่ายปีละ', value: `${st.frequency || '–'} ครั้ง` },
            { label: 'โตเฉลี่ย 3 ปี', value: g(st.cagr3), tone: st.cagr3 == null ? '' : fmt.tone(st.cagr3) },
            { label: 'โตเฉลี่ย 5 ปี', value: g(st.cagr5), tone: st.cagr5 == null ? '' : fmt.tone(st.cagr5) },
          ]),
          h('div', { class: 'muted small', style: { margin: '12px 0 6px' } }, `ปันผลรวมต่อหุ้นรายปี (${ccy}, ปี พ.ศ. 2 หลัก)`),
          box),
      })));
      chart(box, {
        type: 'bar',
        data: { labels: yrs.map((y) => String(y.year + 543).slice(-2)), datasets: [{ label: 'ปันผลต่อหุ้น', data: yrs.map((y) => +y.total.toFixed(3)), backgroundColor: chart.colors[3] }] },
        options: { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } } } },
      });
    };

    // ---------- fundamentals ----------
    const hasFund = () => D.fund && (D.fund.years || []).length > 0;
    const drawFund = () => {
      const wrap = (card) => h('div', { style: { marginTop: '12px' } }, card);
      if (!fundOk()) {
        fundBox.replaceChildren(wrap(ui.card({ title: 'งบการเงิน', icon: 'report-analytics', body: h('div', { class: 'muted' }, 'สินทรัพย์ประเภทนี้ไม่มีงบการเงินแบบบริษัท จึงไม่แสดงตัวเลขพื้นฐาน (EPS, ROE, D/E) ดูได้เฉพาะกราฟราคาและสถานะในพอร์ต') })));
        return;
      }
      if (!hasFund()) {
        fundBox.replaceChildren(wrap(ui.card({ title: 'งบการเงิน', icon: 'report-analytics', body: h('div', { class: 'muted' }, 'ยังไม่มีข้อมูลงบการเงินของหุ้นตัวนี้') })));
        return;
      }
      const f = D.fund, ccy = f.ccy || 'THB';
      const g = (a, i) => (a && a[i] != null ? a[i] : null);
      const ratio = (a, b, mul = 1) => (a != null && b != null && b !== 0 ? (a / b) * mul : null);
      const rows = f.years.map((y, i) => ({
        y, eps: g(f.eps, i), rev: g(f.revenue, i), ni: g(f.netIncome, i),
        roe: ratio(g(f.netIncome, i), g(f.equity, i), 100), de: ratio(g(f.totalDebt, i), g(f.equity, i)), fcf: g(f.fcf, i),
      }));
      const th = (t, r) => h('th', { class: r ? 'r' : '' }, t);
      const table = h('table', { class: 'table' },
        h('thead', null, h('tr', null, th('ปี'), th('EPS', 1), th('รายได้', 1), th('กำไรสุทธิ', 1), th('ROE', 1), th('D/E', 1), th('FCF', 1))),
        h('tbody', null, rows.slice().reverse().map((r) => h('tr', null,
          h('td', null, String(r.y)),
          h('td', { class: 'r' }, fmt.num(r.eps, 2)),
          h('td', { class: 'r', style: { whiteSpace: 'nowrap' } }, fmt.compact(r.rev)),
          h('td', { class: 'r', style: { whiteSpace: 'nowrap' } }, fmt.compact(r.ni)),
          h('td', { class: 'r' }, r.roe == null ? '–' : fmt.pct(r.roe)),
          h('td', { class: 'r' }, r.de == null ? '–' : fmt.num(r.de, 2)),
          h('td', { class: `r ${r.fcf != null && r.fcf < 0 ? 'down' : ''}`, style: { whiteSpace: 'nowrap' } }, fmt.compact(r.fcf))))));
      const box = h('div', { class: 'chart-box short' });
      fundBox.replaceChildren(wrap(ui.card({
        title: 'งบการเงินย้อนหลัง', icon: 'report-analytics', sub: `หน่วยเงิน ${ccy}`,
        body: h('div', null, h('div', { class: 'scroll-x' }, table),
          h('div', { class: 'muted small', style: { margin: '12px 0 6px' } }, 'กำไรต่อหุ้น (EPS) รายปี'), box),
      })));
      chart(box, {
        type: 'bar',
        data: { labels: rows.map((r) => String(r.y)), datasets: [{ label: 'EPS', data: rows.map((r) => r.eps), backgroundColor: chart.colors[1] }] },
        options: { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } } } },
      });
    };

    // ---------- flags ----------
    const drawFlags = () => {
      if (!fundOk() || !hasFund()) { flagBox.replaceChildren(); return; }
      const f = D.fund, flags = [];
      const idx = (a) => { const o = []; (a || []).forEach((v, i) => { if (v != null) o.push(i); }); return o; };
      const ei = idx(f.eps);
      if (ei.length >= 3) {
        const [a, b, c] = ei.slice(-3).map((i) => f.eps[i]);
        if (c < b && b < a) flags.push('กำไรต่อหุ้น (EPS) ลดลง 2 ปีติดต่อกัน');
      }
      const st = calc.dividends.stats(D.divs?.events || [], D.quote?.price);
      const lastEps = ei.length ? f.eps[ei[ei.length - 1]] : null;
      if (lastEps > 0 && st.ttm > 0 && (st.ttm / lastEps) * 100 > 100) {
        flags.push(`จ่ายปันผลมากกว่ากำไร (Payout ประมาณ ${fmt.num((st.ttm / lastEps) * 100, 0)}%)`);
      }
      const li = f.years.length - 1;
      if (f.equity?.[li] > 0 && f.totalDebt?.[li] != null && f.totalDebt[li] / f.equity[li] > 2) {
        flags.push(`D/E สูงกว่า 2 เท่า (${fmt.num(f.totalDebt[li] / f.equity[li], 2)}) ธนาคารมี D/E สูงเป็นปกติ`);
      }
      const fi = idx(f.fcf);
      if (fi.length && f.fcf[fi[fi.length - 1]] < 0) flags.push('กระแสเงินสดอิสระ (FCF) ปีล่าสุดติดลบ');
      const yrNow = new Date().getFullYear();
      const done = st.years.filter((y) => y.year < yrNow);
      if (done.length >= 2 && done[done.length - 1].total < done[done.length - 2].total * 0.99) {
        flags.push(`ปันผลต่อหุ้นปี ${done[done.length - 1].year + 543} ลดลงจากปีก่อนหน้า`);
      }
      flagBox.replaceChildren(h('div', { style: { marginTop: '12px' } }, ui.card({
        title: 'จุดที่ควรเช็กเพิ่ม', icon: 'flag', tone: flags.length ? 'butter' : 'mint',
        body: flags.length
          ? h('div', null, flags.map((t) => h('div', { class: 'row', style: { alignItems: 'flex-start', marginBottom: '6px' } }, icon('alert-circle'), h('div', { class: 'grow' }, t))),
              h('div', { class: 'faint' }, 'เป็นเพียงจุดที่น่าศึกษาเพิ่ม ไม่ได้แปลว่าหุ้นดีหรือไม่ดี'))
          : h('div', null, 'ไม่พบจุดผิดปกติจากข้อมูลที่มี'),
      })));
    };

    // ---------- explain + actions ----------
    const drawExplain = () => {
      if (!fundOk()) return;
      explainBox.replaceChildren(ui.section('อธิบายตัวเลข'), h('div', null, EXPLAIN.map(([t, d]) => h('details', { class: 'card', style: { marginBottom: '8px' } },
        h('summary', { style: { cursor: 'pointer', fontWeight: '600', minHeight: '28px' } }, t),
        h('p', { class: 'muted', style: { margin: '8px 0 0' } }, d)))));
      actionBox.replaceChildren(h('div', { style: { marginTop: '14px' } },
        ui.button('ประเมินมูลค่า', { variant: 'primary', icon: 'calculator', block: true, onClick: () => nav('valuation/' + encodeURIComponent(symbol)) })));
    };

    // ---------- loading ----------
    const loadHist = async () => {
      D.hist = null; drawChart();
      const r = RANGES.find((x) => x.value === range);
      try { const d = await store.history(symbol, clsOf(), r.value, r.interval); if (dead) return; D.hist = d; } catch (e) { if (dead) return; D.hist = { t: [], c: [] }; }
      drawChart();
    };

    const drawAll = () => { drawHeader(); drawPos(); };
    const unsub = store.subscribe(() => { if (!dead && D.loaded) drawAll(); });

    try { D.quote = await store.quote(symbol, clsOf()); } catch (e) { D.quote = null; }
    if (dead) return () => {};
    if (!D.quote && !holding() && !watchRow()) {
      unsub();
      root.replaceChildren(ui.empty({
        mood: 'worried', title: 'หนูออมหาหุ้นตัวนี้ไม่เจอ ลองเช็กชื่อย่ออีกครั้ง',
        text: 'หุ้นไทยลงท้าย .BK เช่น PTT.BK หุ้นอเมริกาเช่น KO',
        action: ui.button('กลับ', { variant: 'soft', onClick: () => history.back() }),
      }));
      return () => { dead = true; };
    }
    D.loaded = true;
    drawAll();
    drawExplain();
    divBox.append(ui.skeleton(3));
    fundBox.append(ui.skeleton(3));
    loadHist();
    const cls = clsOf();
    const [hh, dd, fu] = await Promise.allSettled([
      store.history(symbol, cls, '1y', '1d'),
      fundOk() ? store.dividends(symbol) : Promise.resolve(null),
      fundOk() ? store.fundamentals(symbol) : Promise.resolve(null),
    ]);
    if (dead) return () => {};
    D.daily = hh.status === 'fulfilled' ? hh.value : null;
    D.divs = dd.status === 'fulfilled' ? dd.value : null;
    D.fund = fu.status === 'fulfilled' ? fu.value : null;
    drawTech(); drawDiv(); drawFund(); drawFlags();

    return () => { dead = true; unsub(); };
  },
};
