// หนูออม — เครื่องคิดเลข (Builder D)
const TOOLS = [
  { key: 'compound', icon: 'chart-line', label: 'ดอกเบี้ยทบต้น', tone: 'pink', desc: 'เงินโตแค่ไหนถ้าลงทุนสม่ำเสมอ' },
  { key: 'snowball', icon: 'snowflake', label: 'ก้อนหิมะปันผล', tone: 'sky', desc: 'ปันผลทบต้นไปเรื่อยๆ' },
  { key: 'fire', icon: 'flame', label: 'เป้าอิสรภาพการเงิน', tone: 'peach', desc: 'ต้องมีเงินเท่าไรถึงใช้ปันผลเลี้ยงตัวเอง' },
  { key: 'dca', icon: 'calendar-repeat', label: 'DCA vs ลงทีเดียว', tone: 'butter', desc: 'เทียบจากราคาในอดีต' },
  { key: 'tax', icon: 'receipt-tax', label: 'ภาษีเงินปันผล', tone: 'lavender', desc: 'หัก 10% จบ หรือขอเครดิตภาษี' },
  { key: 'size', icon: 'ruler-2', label: 'ขนาดไม้', tone: 'mint', desc: 'ซื้อกี่หุ้นให้เสี่ยงพอดี' },
  { key: 'fx', icon: 'currency-dollar', label: 'แปลงค่าเงิน', tone: 'gray', desc: 'บาท ↔ ดอลลาร์' },
];

export default {
  title: 'เครื่องคิดเลข',
  async render(root, params, ctx) {
    const { store, ui, fmt, calc, nav, chart } = ctx;
    const { h } = ui;
    const name = params[0];
    let dead = false;
    const charts = {};

    // ---------- grid ----------
    const tool = TOOLS.find((t) => t.key === name);
    if (!tool) {
      root.append(
        h('div', { class: 'menu-grid' }, TOOLS.map((t) => {
          const ic = ui.icon(t.icon);
          ic.style.background = `var(--${t.tone}-bg)`; ic.style.color = `var(--${t.tone}-ink)`;
          return h('div', { class: 'menu-tile', role: 'button', tabindex: '0', onClick: () => nav('tools/' + t.key), style: { minHeight: '104px' } },
            ic, h('div', { style: { fontWeight: '600', lineHeight: '1.3' } }, t.label));
        })),
        h('div', { class: 'faint center', style: { marginTop: '14px' } }, 'เลือกเครื่องคิดเลขที่อยากลองได้เลย ตัวเลขทั้งหมดเป็นการจำลอง'),
        ui.disclaimer());
      return () => {};
    }

    // ---------- helpers ----------
    const S = {};
    const results = h('div');
    const holder = (id, cls = '') => h('div', { id: 'h-' + id, class: cls });
    const draw = (id, host, config, size = '') => {
      if (charts[id]) { try { charts[id].destroy(); } catch (e) { /* ignore */ } }
      const box = h('div', { class: 'chart-box ' + size });
      host.replaceChildren(box);
      charts[id] = chart(box, config);
    };
    const inp = (key, label, { min, max, step, slider = false, help, onChange } = {}) => {
      const fld = ui.field({ label, type: 'number', value: S[key], help });
      let rng = null;
      if (slider) {
        rng = h('input', { type: 'range', min, max, step: step ?? (max - min) / 200, value: Math.min(max, Math.max(min, S[key] || 0)), 'aria-label': label, style: { width: '100%', accentColor: 'var(--accent)' } });
        rng.addEventListener('input', () => { fld.set(rng.value); S[key] = Number(rng.value); (onChange || update)(); });
        fld.el.insertBefore(rng, fld.el.querySelector('input').nextSibling);
      }
      fld.input.addEventListener('input', () => {
        const v = fld.get();
        S[key] = v === '' ? 0 : v;
        if (rng && v !== '') rng.value = Math.min(max, Math.max(min, v));
        (onChange || update)();
      });
      return fld.el;
    };
    const check = (key, label) => {
      const fld = ui.field({ label, type: 'checkbox', value: S[key] });
      fld.input.addEventListener('change', () => { S[key] = fld.get(); update(); });
      return fld.el;
    };
    const yearLabels = (rows) => rows.map((r) => String(r.year));
    let update = () => {};
    const totals = store.get().derived.totals || {};
    const portTotal = Math.round(totals.valueTHB || 0);
    const noteBox = (text, tone = 'butter') => ui.card({ tone, body: h('div', { class: 'small' }, text) });
    const money = (v) => fmt.thb(v);

    const tools = {
      // ----- compound -----
      compound() {
        Object.assign(S, { principal: 100000, monthly: 5000, rate: 7, years: 20 });
        const ch = holder('c');
        update = () => {
          const rows = calc.compound.compound({ principal: S.principal, monthly: S.monthly, ratePct: S.rate, years: S.years });
          const last = rows[rows.length - 1];
          if (!last) { results.replaceChildren(h('div', { class: 'muted' }, 'ใส่จำนวนปีอย่างน้อย 1 ปี')); ch.replaceChildren(); return; }
          results.replaceChildren(ui.metrics([
            { label: 'มูลค่าสุดท้าย', value: money(last.value), tone: 'up' },
            { label: 'เงินที่ลงไปทั้งหมด', value: money(last.invested) },
            { label: 'ผลตอบแทนที่ได้', value: money(last.value - last.invested), tone: 'up', sub: `${fmt.num(last.invested > 0 ? (last.value / last.invested - 1) * 100 : 0, 0)}% ของเงินที่ลง` },
            { label: 'เท่าของเงินลง', value: `${fmt.num(last.invested > 0 ? last.value / last.invested : 0, 2)} เท่า` },
          ]));
          draw('c', ch, {
            type: 'bar',
            data: { labels: yearLabels(rows), datasets: [
              { label: 'เงินที่ลงไป', data: rows.map((r) => Math.round(r.invested)), backgroundColor: chart.colors[1], stack: 's' },
              { label: 'ผลตอบแทน', data: rows.map((r) => Math.round(r.value - r.invested)), backgroundColor: chart.colors[3], stack: 's' },
            ] },
            options: { plugins: { tooltip: { callbacks: { title: (i) => `ปีที่ ${i[0].label}`, label: (i) => `${i.dataset.label}: ${money(i.parsed.y)}` } } },
              scales: { x: { stacked: true, grid: { display: false }, ticks: { maxTicksLimit: 8, maxRotation: 0 } }, y: { stacked: true, ticks: { maxTicksLimit: 5, callback: (v) => fmt.compact(v) } } } },
          }, 'tall');
        };
        return [
          ui.card({ body: h('div', null, inp('principal', 'เงินต้น (บาท)'), inp('monthly', 'ลงทุนเพิ่มต่อเดือน (บาท)'),
            inp('rate', 'ผลตอบแทนต่อปี (%)', { min: 0, max: 20, step: 0.5, slider: true }), inp('years', 'จำนวนปี', { min: 1, max: 40, step: 1, slider: true })) }),
          results, ui.card({ title: 'มูลค่าแต่ละปี', icon: 'chart-bar', sub: 'แกนล่างคือปีที่', body: ch }),
        ];
      },

      // ----- snowball -----
      snowball() {
        const goal = Number(store.get().settings.dividend_goal_month) || 4000;
        Object.assign(S, { start: 200000, monthly: 5000, yld: 5, dg: 5, pg: 3, years: 20, reinvest: true, tax: 10 });
        const c1 = holder('s1'), c2 = holder('s2');
        update = () => {
          const rows = calc.compound.snowball({ start: S.start, monthly: S.monthly, yieldPct: S.yld, divGrowthPct: S.dg, priceGrowthPct: S.pg, years: S.years, reinvest: S.reinvest, taxPct: S.tax });
          const last = rows[rows.length - 1];
          if (!last) { results.replaceChildren(h('div', { class: 'muted' }, 'ใส่จำนวนปีอย่างน้อย 1 ปี')); return; }
          const hit = rows.find((r) => r.divMonth >= goal);
          results.replaceChildren(
            ui.metrics([
              { label: 'มูลค่าพอร์ตสุดท้าย', value: money(last.value), tone: 'up' },
              { label: 'ปันผลต่อเดือน (ปีสุดท้าย)', value: money(last.divMonth), tone: 'up' },
              { label: 'เงินที่ลงไปทั้งหมด', value: money(last.invested) },
              { label: 'ปันผลทั้งปี (ปีสุดท้าย)', value: money(last.divYear) },
            ]),
            h('div', { style: { marginTop: '12px' } }, ui.card({
              tone: hit ? 'mint' : 'butter', icon: 'target', title: 'เป้าปันผล',
              body: h('div', null, hit ? `ปีที่ ${hit.year} ปันผลถึงเป้า ${money(goal)}/เดือน` : `ในช่วงนี้ปันผลยังไม่ถึงเป้า ${money(goal)}/เดือน ลองเพิ่มเงินลงทุนหรือจำนวนปี`),
            })));
          const labels = yearLabels(rows);
          const x = { grid: { display: false }, ticks: { maxTicksLimit: 8, maxRotation: 0 } };
          draw('s1', c1, { type: 'line', data: { labels, datasets: [
            { label: 'มูลค่าพอร์ต', data: rows.map((r) => Math.round(r.value)), borderColor: chart.colors[0] },
            { label: 'เงินที่ลงไป', data: rows.map((r) => Math.round(r.invested)), borderColor: chart.colors[1], borderDash: [5, 4] },
          ] }, options: { plugins: { tooltip: { callbacks: { title: (i) => `ปีที่ ${i[0].label}`, label: (i) => `${i.dataset.label}: ${money(i.parsed.y)}` } } }, scales: { x, y: { ticks: { maxTicksLimit: 5, callback: (v) => fmt.compact(v) } } } } });
          draw('s2', c2, { type: 'bar', data: { labels, datasets: [{ label: 'ปันผลต่อเดือน', data: rows.map((r) => Math.round(r.divMonth)), backgroundColor: rows.map((r) => (r.divMonth >= goal ? chart.colors[3] : chart.colors[2])) }] },
            options: { plugins: { legend: { display: false }, tooltip: { callbacks: { title: (i) => `ปีที่ ${i[0].label}`, label: (i) => money(i.parsed.y) } } }, scales: { x, y: { ticks: { maxTicksLimit: 5, callback: (v) => fmt.compact(v) } } } } }, 'short');
        };
        return [
          ui.card({ body: h('div', null, inp('start', 'มูลค่าเริ่มต้น (บาท)'), inp('monthly', 'เติมเงินต่อเดือน (บาท)'),
            inp('yld', 'อัตราปันผล (%)', { min: 0, max: 12, step: 0.1, slider: true }),
            inp('dg', 'ปันผลโตปีละ (%)', { min: 0, max: 15, step: 0.5, slider: true }),
            inp('pg', 'ราคาโตปีละ (%)', { min: 0, max: 15, step: 0.5, slider: true }),
            inp('years', 'จำนวนปี', { min: 1, max: 40, step: 1, slider: true }),
            inp('tax', 'ภาษีหัก ณ ที่จ่าย (%)', { min: 0, max: 30, step: 1 }),
            check('reinvest', 'นำปันผลไปลงทุนต่อ')) }),
          results,
          ui.card({ title: 'มูลค่าพอร์ตแต่ละปี', icon: 'chart-line', body: c1 }),
          ui.card({ title: 'ปันผลต่อเดือนแต่ละปี', icon: 'coin', sub: 'แท่งสีเขียวคือปีที่ถึงเป้า', body: c2 }),
        ];
      },

      // ----- fire -----
      fire() {
        Object.assign(S, { expense: 25000, yld: 4, start: portTotal, monthly: 10000, rate: 6 });
        update = () => {
          const target = calc.compound.fire({ monthlyExpense: S.expense, yieldPct: S.yld });
          if (target === null) { results.replaceChildren(h('div', { class: 'down' }, 'อัตราปันผล/ถอนต้องมากกว่า 0')); return; }
          const yrs = calc.compound.yearsTo({ target, start: S.start, monthly: S.monthly, ratePct: S.rate });
          const pct = target > 0 ? (S.start / target) * 100 : 0;
          let when = 'เกิน 100 ปี ลองเพิ่มเงินลงทุนหรือลดค่าใช้จ่าย';
          if (yrs === 0) when = 'ถึงเป้าแล้ว';
          else if (yrs !== null) when = `ประมาณ ${Math.floor(yrs)} ปี ${Math.round((yrs % 1) * 12)} ด.`;
          results.replaceChildren(
            ui.metrics([
              { label: 'เงินที่ต้องมี', value: money(target), tone: '' },
              { label: 'ต้องใช้เวลา', value: when.startsWith('ประมาณ') ? when.replace('ประมาณ ', '~') : yrs === 0 ? when : '–' },
              { label: 'มีอยู่แล้ว', value: money(S.start) },
              { label: 'ปันผลต่อเดือนที่ต้องการ', value: money(S.expense) },
            ]),
            h('div', { style: { marginTop: '12px' } }, ui.card({ title: 'ความคืบหน้า', icon: 'target', body: h('div', null,
              ui.progress(Math.min(100, pct), 'mint', `ถึงเป้าแล้ว ${fmt.num(pct, 1)}%`),
              yrs === null ? h('div', { class: 'faint', style: { marginTop: '8px' } }, when) : null) })));
        };
        return [
          ui.card({ body: h('div', null, inp('expense', 'ค่าใช้จ่ายต่อเดือน (บาท)'),
            inp('yld', 'อัตราปันผล/ถอนใช้ต่อปี (%)', { min: 1, max: 10, step: 0.1, slider: true, help: 'เช่น 4% คือถอนปีละ 4% ของเงินก้อน' }),
            inp('start', 'เงินที่มีตอนนี้ (บาท)', { help: portTotal ? 'ใส่มูลค่าพอร์ตปัจจุบันให้แล้ว แก้ได้' : undefined }),
            inp('monthly', 'ลงทุนเพิ่มต่อเดือน (บาท)'), inp('rate', 'ผลตอบแทนต่อปี (%)', { min: 0, max: 15, step: 0.5, slider: true })) }),
          results,
        ];
      },

      // ----- dca -----
      dca() {
        Object.assign(S, { amount: 5000, years: 5 });
        let cls = 'US', symbol = 'VOO', monthly = null, loadErr = null, loading = false;
        const ch = holder('d');
        const symField = ui.field({ label: 'ชื่อย่อ', value: symbol, placeholder: 'เช่น VOO, PTT' });
        const load = async () => {
          const raw = symField.get().trim();
          if (!raw) { symField.error('ใส่ชื่อย่อหุ้นก่อน'); return; }
          symbol = fmt.normSym(raw, cls);
          loading = true; loadErr = null; monthly = null; update();
          try { const d = await store.history(symbol, cls, '10y', '1mo'); if (dead) return; monthly = d; } catch (e) { if (dead) return; loadErr = e; }
          loading = false; update();
        };
        update = () => {
          if (loading) { results.replaceChildren(ui.skeleton(3)); ch.replaceChildren(); return; }
          if (loadErr) { results.replaceChildren(ui.errorBox(loadErr, load)); return; }
          if (!monthly || !(monthly.c || []).length) { results.replaceChildren(h('div', { class: 'muted' }, 'ยังไม่มีข้อมูลราคาย้อนหลัง')); ch.replaceChildren(); return; }
          const n = S.years * 12;
          const sl = { t: monthly.t.slice(-n), c: monthly.c.slice(-n) };
          const d = calc.compound.dcaBacktest(sl, S.amount);
          const l = calc.compound.lumpBacktest(sl, d.invested);
          if (!d.series.length) { results.replaceChildren(h('div', { class: 'muted' }, 'ใส่เงินต่อเดือนให้มากกว่า 0')); ch.replaceChildren(); return; }
          const better = d.value >= l.value ? 'DCA' : 'ลงทีเดียว';
          results.replaceChildren(
            ui.metrics([
              { label: 'DCA: มูลค่าสุดท้าย', value: money(d.value), sub: fmt.pct(d.returnPct, { sign: true }), tone: fmt.tone(d.returnPct) },
              { label: 'ลงทีเดียว: มูลค่าสุดท้าย', value: money(l.value), sub: fmt.pct(l.returnPct, { sign: true }), tone: fmt.tone(l.returnPct) },
              { label: 'เงินลงทั้งหมด', value: money(d.invested) },
              { label: 'ช่วงนี้ได้มากกว่า', value: better },
            ]),
            h('div', { class: 'faint', style: { margin: '8px 2px' } }, 'ผลในอดีตไม่ได้รับประกันอนาคต'));
          draw('d', ch, { type: 'line', data: { labels: d.series.map((p) => { const dt = new Date(p.t * 1000); return `${fmt.month(dt.getMonth())} ${String(dt.getFullYear() + 543).slice(-2)}`; }), datasets: [
            { label: 'DCA', data: d.series.map((p) => Math.round(p.value)), borderColor: chart.colors[0] },
            { label: 'ลงทีเดียว', data: l.series.map((p) => Math.round(p.value)), borderColor: chart.colors[1] },
            { label: 'เงินที่ลงไป (DCA)', data: d.series.map((p) => Math.round(p.invested)), borderColor: chart.css('--ink-3'), borderDash: [5, 4], borderWidth: 1.5 },
          ] }, options: { interaction: { mode: 'index', intersect: false }, plugins: { tooltip: { callbacks: { label: (i) => `${i.dataset.label}: ${money(i.parsed.y)}` } } },
            scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 5, maxRotation: 0 } }, y: { ticks: { maxTicksLimit: 5, callback: (v) => fmt.compact(v) } } } } }, 'tall');
        };
        symField.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') load(); });
        const yrSeg = ui.segment([{ value: 5, label: '5 ปี' }, { value: 10, label: '10 ปี' }], S.years, (v) => { S.years = v; update(); });
        const clsSeg = ui.segment([{ value: 'US', label: 'หุ้นอเมริกา' }, { value: 'TH', label: 'หุ้นไทย' }, { value: 'CRYPTO', label: 'คริปโต' }], cls, (v) => { cls = v; });
        setTimeout(load, 0);
        return [
          ui.card({ body: h('div', null, h('div', { style: { marginBottom: '12px' } }, clsSeg), symField.el,
            inp('amount', 'เงินลงต่อเดือน (บาท หรือหน่วยสกุลของสินทรัพย์)'),
            h('div', { class: 'muted small', style: { marginBottom: '6px' } }, 'ช่วงเวลา'), h('div', { style: { marginBottom: '12px' } }, yrSeg),
            ui.button('คำนวณ', { variant: 'primary', block: true, icon: 'calculator', onClick: load })) }),
          results, ui.card({ title: 'มูลค่าเทียบกัน', icon: 'chart-line', body: ch }),
        ];
      },

      // ----- tax -----
      tax() {
        const yr = new Date().getFullYear();
        const gross = Math.round(store.get().tx.filter((t) => t.type === 'DIV' && t.cls === 'TH' && String(t.date).startsWith(String(yr)))
          .reduce((s, t) => s + Number(t.qty) * Number(t.price), 0));
        Object.assign(S, { gross, corp: 20, other: 300000 });
        update = () => {
          const r = calc.tax.compareDividend({ gross: S.gross, otherNetIncome: S.other, corpRatePct: S.corp });
          const inc = r.better === 'include';
          results.replaceChildren(
            ui.metrics([
              { label: 'หัก 10% จบ', value: money(r.finalTax10), sub: 'ภาษีรวมที่จ่าย' },
              { label: inc ? 'ขอเครดิตภาษี: ได้คืน' : 'ขอเครดิตภาษี: จ่ายเพิ่ม', value: money(Math.abs(r.includeTax)), tone: inc ? 'up' : 'down', sub: 'เทียบกับที่ถูกหักไปแล้ว 10%' },
            ]),
            h('div', { style: { marginTop: '12px' } }, ui.card({ tone: inc ? 'mint' : 'butter', icon: 'bulb', title: inc ? 'ขอเครดิตภาษีน่าจะคุ้มกว่า' : 'หัก 10% จบน่าจะคุ้มกว่า',
              body: h('div', { class: 'small' },
                h('p', null, inc ? `ถ้านำเงินปันผลไปรวมคำนวณภาษีและขอเครดิตภาษี คุณอาจได้เงินภาษีคืนประมาณ ${money(r.diff)} เมื่อเทียบกับการปล่อยให้หัก 10% จบ`
                  : `การให้หัก ณ ที่จ่าย 10% แล้วจบ ประหยัดกว่าประมาณ ${money(r.diff)} เมื่อเทียบกับการนำไปรวมคำนวณภาษี`),
                h('p', { class: 'muted', style: { margin: 0 } }, 'โดยทั่วไปคนที่เงินได้สุทธิต่ำ (ฐานภาษีต่ำกว่า 10%) มักได้ประโยชน์จากการขอเครดิตภาษี ส่วนคนฐานภาษีสูงมักเหมาะกับ 10% จบ')) })));
        };
        return [
          ui.card({ body: h('div', null, inp('gross', `เงินปันผลรวมทั้งปี (บาท, ก่อนหักภาษี)`, { help: gross ? `ใส่ยอดปันผลหุ้นไทยปี ${yr + 543} จากรายการของคุณให้แล้ว แก้ได้` : 'ยังไม่มีปันผลหุ้นไทยในปีนี้ ใส่ตัวเลขเองได้' }),
            inp('corp', 'อัตราภาษีนิติบุคคลของบริษัทที่จ่ายปันผล (%)', { min: 0, max: 30, step: 1, slider: true }),
            inp('other', 'เงินได้สุทธิอื่นๆ ต่อปี (บาท)', { help: 'หลังหักค่าใช้จ่ายและลดหย่อนแล้ว' })) }),
          results,
          noteBox('ตรวจสอบกับกรมสรรพากรอีกครั้ง เป็นการคำนวณคร่าวๆ ไม่รวมกรณีพิเศษ', 'lavender'),
        ];
      },

      // ----- size -----
      size() {
        Object.assign(S, { capital: portTotal || 100000, risk: 1, entry: 100, stop: 93 });
        update = () => {
          const r = calc.compound.positionSize({ capital: S.capital, riskPct: S.risk, entry: S.entry, stop: S.stop });
          if (!(r.shares > 0)) { results.replaceChildren(h('div', { class: 'muted' }, 'ราคาเข้ากับจุดตัดขาดทุนต้องต่างกัน และเงินเสี่ยงต้องพอซื้ออย่างน้อย 1 หุ้น')); return; }
          results.replaceChildren(
            ui.metrics([
              { label: 'จำนวนหุ้นที่ซื้อได้', value: fmt.num(r.shares, 0) + ' หุ้น' },
              { label: 'มูลค่าที่ซื้อ', value: money(r.positionValue), sub: `${fmt.num(S.capital > 0 ? (r.positionValue / S.capital) * 100 : 0, 1)}% ของเงินทุน` },
              { label: 'ยอมเสียได้ไม่เกิน', value: money(r.riskAmount), tone: 'down' },
              { label: 'ขาดทุนต่อหุ้นถ้าชนจุดตัด', value: fmt.num(Math.abs(S.entry - S.stop), 2) },
            ]),
            r.exceedsCapital ? h('div', { style: { marginTop: '12px' } }, noteBox('ขนาดไม้นี้ใหญ่เกินเงินทุนทั้งหมดที่ใส่ไว้ ลองลดความเสี่ยงต่อไม้หรือขยับจุดตัดขาดทุนให้ใกล้ราคาเข้าขึ้น', 'peach')) : null);
        };
        return [
          ui.card({ body: h('div', null, inp('capital', 'เงินทุนทั้งหมด (บาท)', { help: portTotal ? 'ใส่มูลค่าพอร์ตให้แล้ว แก้ได้' : undefined }),
            inp('risk', 'ยอมเสี่ยงต่อไม้ (% ของเงินทุน)', { min: 0.25, max: 5, step: 0.25, slider: true }),
            inp('entry', 'ราคาเข้า'), inp('stop', 'จุดตัดขาดทุน (ราคา)')) }),
          results,
          noteBox('เครื่องมือช่วยคิดขนาดไม้ตามความเสี่ยงที่คุณกำหนดเอง ไม่ใช่คำแนะนำให้ซื้อหรือขาย'),
        ];
      },

      // ----- fx -----
      fx() {
        const rate = Number(store.get().fx?.USD) || 0;
        Object.assign(S, { amount: 1000 });
        let dir = 'thb';
        update = () => {
          if (!(rate > 0)) { results.replaceChildren(h('div', { class: 'muted' }, 'ยังไม่มีอัตราแลกเปลี่ยน ลองรีเฟรชข้อมูลอีกครั้ง')); return; }
          const out = dir === 'thb' ? S.amount / rate : S.amount * rate;
          results.replaceChildren(ui.metrics([
            { label: dir === 'thb' ? 'เป็นดอลลาร์สหรัฐ' : 'เป็นบาท', value: dir === 'thb' ? fmt.money(out, 'USD') : fmt.thb(out, { dec: 2 }) },
            { label: 'อัตรา', value: `฿${fmt.num(rate, 2)}`, sub: 'ต่อ 1 ดอลลาร์' },
          ]));
        };
        const seg = ui.segment([{ value: 'thb', label: 'บาท → ดอลลาร์' }, { value: 'usd', label: 'ดอลลาร์ → บาท' }], dir, (v) => { dir = v; update(); });
        return [
          ui.card({ body: h('div', null, h('div', { style: { marginBottom: '12px' } }, seg), inp('amount', 'จำนวนเงิน')) }),
          results,
        ];
      },
    };

    const blocks = tools[tool.key]();
    root.append(
      ui.button('เครื่องคิดเลขทั้งหมด', { variant: 'ghost', small: true, icon: 'chevron-left', onClick: () => nav('tools') }),
      h('div', { class: 'row', style: { margin: '6px 2px 12px' } }, h('h2', null, tool.label)),
      h('div', { class: 'stack' }, blocks),
      ui.disclaimer());
    update();
    return () => { dead = true; };
  },
};
