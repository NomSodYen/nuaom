// หนูออม — ประเมินมูลค่า (Builder D)
export default {
  title: 'ประเมินมูลค่า',
  async render(root, params, ctx) {
    const { store, ui, fmt, calc, nav, chart } = ctx;
    const { h } = ui;
    const symbol = params[0] ? String(params[0]).toUpperCase() : '';
    let dead = false;

    // ---------- no symbol: search ----------
    if (!symbol) {
      let cls = 'TH';
      const input = h('input', { placeholder: 'เช่น PTT, KO', autocomplete: 'off', autocapitalize: 'characters', 'aria-label': 'ชื่อย่อหุ้น' });
      const go = () => { const raw = input.value.trim(); if (raw) nav('valuation/' + encodeURIComponent(fmt.normSym(raw, cls))); };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
      const hold = store.get().derived.holdings.filter((x) => x.cls === 'TH' || x.cls === 'US');
      root.append(
        ui.card({
          title: 'เลือกหุ้นที่อยากประเมิน', icon: 'calculator',
          body: h('div', null,
            ui.segment([{ value: 'TH', label: 'หุ้นไทย' }, { value: 'US', label: 'หุ้นอเมริกา' }], cls, (v) => { cls = v; }),
            h('div', { class: 'search-box', style: { margin: '12px 0' } }, ui.icon('search'), input),
            ui.button('ประเมินมูลค่า', { variant: 'primary', block: true, icon: 'arrow-right', onClick: go })),
        }),
        hold.length ? ui.card({
          title: 'หุ้นในพอร์ตของคุณ', icon: 'briefcase',
          body: h('div', { class: 'row wrap' }, hold.map((x) => h('span', {
            class: `chip clickable t-${fmt.clsTone(x.cls)}`, role: 'button', tabindex: '0', style: { minHeight: '36px', padding: '4px 14px' },
            onClick: () => nav('valuation/' + encodeURIComponent(x.symbol)),
          }, fmt.sym(x.symbol)))),
        }) : ui.empty({ mood: 'happy', title: 'พิมพ์ชื่อย่อหุ้นได้เลย', text: 'ยังไม่มีหุ้นในพอร์ต พิมพ์ชื่อย่อด้านบนเพื่อเริ่มประเมิน' }),
        ui.disclaimer());
      return () => {};
    }

    root.append(ui.skeleton(5));
    const cls = store.get().derived.holdings.find((x) => x.symbol === symbol)?.cls
      || store.get().watch.find((w) => w.symbol === symbol)?.cls || fmt.guessCls(symbol);
    const [qR, fR, dR, mR] = await Promise.allSettled([
      store.quote(symbol, cls), store.fundamentals(symbol), store.dividends(symbol), store.history(symbol, cls, '10y', '1mo'),
    ]);
    if (dead) return () => {};
    const quote = qR.status === 'fulfilled' ? qR.value : null;
    const F = fR.status === 'fulfilled' ? fR.value : null;
    const divs = dR.status === 'fulfilled' ? dR.value : null;
    const monthly = mR.status === 'fulfilled' ? mR.value : null;
    const price = quote?.price ?? null;
    const ccy = quote?.ccy || F?.ccy || (cls === 'US' ? 'USD' : 'THB');

    if (!quote) {
      root.replaceChildren(ui.empty({ mood: 'worried', title: 'หนูออมหาหุ้นตัวนี้ไม่เจอ ลองเช็กชื่อย่ออีกครั้ง', action: ui.button('เลือกหุ้นใหม่', { variant: 'soft', onClick: () => nav('valuation') }) }));
      return () => {};
    }

    // ---------- prefill ----------
    const last = (a) => { for (let i = (a || []).length - 1; i >= 0; i--) if (a[i] != null) return a[i]; return null; };
    const st = calc.dividends.stats(divs?.events || [], price);
    const eps = last(F?.eps), equity = last(F?.equity), shares = last(F?.shares);
    const S = {
      dps: +(st.ttm || 0).toFixed(2),
      dg: st.cagr5 == null ? 3 : +Math.min(8, Math.max(0, st.cagr5)).toFixed(1),
      dr: 9,
      fcf: last(F?.fcf) ?? 0, g1: 8, gt: 2.5, disc: 9, shares: shares ?? 0,
      netDebt: Math.round((last(F?.totalDebt) ?? 0) - (last(F?.cash) ?? 0)),
      eps: eps ?? 0, bvps: equity && shares ? +(equity / shares).toFixed(2) : 0,
    };
    const band = calc.valuation.peBand(monthly, { years: F?.years || [], eps: F?.eps || [] });

    const compute = () => {
      const ddm = calc.valuation.ddm({ dps: S.dps, growthPct: S.dg, requiredPct: S.dr });
      const dcf = calc.valuation.dcf({ fcf: S.fcf, growthPct: S.g1, years: 5, terminalPct: S.gt, discountPct: S.disc, shares: S.shares, netDebt: S.netDebt });
      return { ddm, dcf, pe: band.bands.mean, graham: calc.valuation.graham(S.eps, S.bvps) };
    };

    const summaryBox = h('div');
    const panel = h('div');
    const resultBox = h('div');
    let tab = 'ddm';

    const drawSummary = () => {
      const v = compute();
      const items = [['DDM', v.ddm], ['DCF', v.dcf.perShare], ['P/E Band', v.pe], ['Graham', v.graham]];
      summaryBox.replaceChildren(ui.card({
        tone: 'sky',
        title: fmt.sym(symbol), icon: 'scale', sub: `ราคาปัจจุบัน ${fmt.money(price, ccy)}`,
        body: h('div', null,
          h('div', { class: 'list' }, items.map(([name, val]) => {
            const m = calc.valuation.mos(val, price);
            const chipEl = m === null ? ui.chip('คำนวณไม่ได้', '')
              : ui.chip(m >= 0 ? `ราคาต่ำกว่ามูลค่าที่คำนวณ ${fmt.num(m, 0)}%` : `ราคาสูงกว่ามูลค่าที่คำนวณ ${fmt.num(Math.abs(m), 0)}%`, m >= 0 ? 'up' : 'down');
            return h('div', { class: 'li', style: { padding: '8px 2px', minHeight: '0', flexWrap: 'wrap' } },
              h('div', { class: 'grow', style: { minWidth: '100px' } }, h('b', null, name), h('div', { class: 'small num muted' }, val == null ? '–' : fmt.money(val, ccy))),
              chipEl);
          })),
          h('div', { class: 'faint', style: { marginTop: '8px' } }, 'ตัวเลขขึ้นกับสมมติฐานที่คุณใส่ ลองปรับดูว่าผลเปลี่ยนแค่ไหน')),
      }));
    };

    // number field + slider helper
    const num = (key, label, { min, max, step = 'any', slider = true, help } = {}) => {
      const fld = ui.field({ label, type: 'number', value: S[key], help });
      let rng = null;
      if (slider) {
        rng = h('input', { type: 'range', min, max, step: step === 'any' ? (max - min) / 200 : step, value: Math.min(max, Math.max(min, S[key])), 'aria-label': label, style: { width: '100%', accentColor: 'var(--accent)' } });
        rng.addEventListener('input', () => { fld.set(rng.value); S[key] = Number(rng.value); update(); });
        fld.el.insertBefore(rng, fld.el.querySelector('input').nextSibling);
      }
      fld.input.addEventListener('input', () => {
        const v = fld.get();
        S[key] = v === '' ? 0 : v;
        if (rng && v !== '') rng.value = Math.min(max, Math.max(min, v));
        update();
      });
      return fld.el;
    };

    const drawResult = () => {
      const v = compute();
      if (tab === 'ddm') {
        resultBox.replaceChildren(v.ddm === null
          ? h('div', { class: 'down' }, 'ผลตอบแทนที่ต้องการต้องมากกว่าอัตราเติบโต')
          : ui.metrics([{ label: 'มูลค่าตามสูตร DDM', value: fmt.money(v.ddm, ccy), tone: '' }, { label: 'ปันผลปีหน้า (ประมาณ)', value: fmt.money(S.dps * (1 + S.dg / 100), ccy) }]));
      } else if (tab === 'dcf') {
        const d = v.dcf;
        if (d.perShare === null) {
          resultBox.replaceChildren(h('div', { class: 'down' }, S.disc <= S.gt ? 'อัตราคิดลดต้องมากกว่าการเติบโตระยะยาว' : 'กรอกจำนวนหุ้นและ FCF ให้ครบเพื่อคำนวณ'));
        } else {
          resultBox.replaceChildren(
            ui.metrics([{ label: 'มูลค่าต่อหุ้น (DCF)', value: fmt.money(d.perShare, ccy) }, { label: 'มูลค่าส่วนของผู้ถือหุ้น', value: fmt.compact(d.equity) }]),
            h('div', { class: 'scroll-x', style: { marginTop: '12px' } }, h('table', { class: 'table' },
              h('thead', null, h('tr', null, h('th', null, 'ปีที่'), h('th', { class: 'r' }, 'FCF ที่คาด'), h('th', { class: 'r' }, 'มูลค่าปัจจุบัน'))),
              h('tbody', null, d.rows.map((r) => h('tr', null, h('td', null, r.year), h('td', { class: 'r' }, fmt.compact(r.fcf)), h('td', { class: 'r' }, fmt.compact(r.pv)))),
                h('tr', null, h('td', null, 'ระยะยาว'), h('td', { class: 'r' }, '–'), h('td', { class: 'r' }, fmt.compact(d.terminalPV)))))));
        }
      } else if (tab === 'graham') {
        resultBox.replaceChildren(v.graham === null
          ? h('div', { class: 'down' }, 'ต้องมี EPS และมูลค่าทางบัญชีต่อหุ้นเป็นบวกทั้งคู่')
          : ui.metrics([{ label: 'ตัวเลขเกรแฮม', value: fmt.money(v.graham, ccy) }, { label: 'สูตร', value: '√(22.5×EPS×BVPS)' }]));
      }
    };

    const drawBand = () => {
      if (!band.series.length || band.bands.mean === null) {
        panel.replaceChildren(h('div', { class: 'muted' }, 'ข้อมูล EPS หรือราคาย้อนหลังไม่พอสำหรับ P/E Band'));
        resultBox.replaceChildren();
        return;
      }
      const t = monthly.t, c = monthly.c;
      const labels = t.map((x) => fmt.date(x));
      const B = band.bands;
      const line = (label, v, color, dash) => ({ label, data: c.map(() => +v.toFixed(2)), borderColor: color, borderDash: dash, borderWidth: 1.5 });
      const box = h('div', { class: 'chart-box tall' });
      const curPE = band.latestEps > 0 && price ? price / band.latestEps : null;
      panel.replaceChildren(box);
      resultBox.replaceChildren(ui.metrics([
        { label: 'P/E ปัจจุบัน', value: curPE == null ? '–' : fmt.num(curPE, 1), sub: `เฉลี่ยย้อนหลัง ${fmt.num(band.mean, 1)}` },
        { label: 'ราคาที่ P/E เฉลี่ย', value: fmt.money(B.mean, ccy), sub: `ช่วง ${fmt.num(B.m1, 1)}–${fmt.num(B.p1, 1)}` },
      ]));
      chart(box, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'ราคา', data: c, borderColor: chart.css('--ink'), borderWidth: 2 },
            line('−2SD', B.m2, chart.css('--down'), [5, 4]), line('−1SD', B.m1, chart.colors[5], [5, 4]),
            line('เฉลี่ย', B.mean, chart.colors[3], [2, 2]),
            line('+1SD', B.p1, chart.colors[1], [5, 4]), line('+2SD', B.p2, chart.colors[4], [5, 4]),
          ],
        },
        options: {
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (i) => `${i.dataset.label}: ${fmt.num(i.parsed.y, 2)}` } } },
          scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 6, maxRotation: 0 } }, y: { ticks: { maxTicksLimit: 5 } } },
        },
      });
    };

    const update = () => { drawSummary(); if (tab !== 'pe') drawResult(); };

    const drawPanel = () => {
      if (tab === 'ddm') {
        panel.replaceChildren(h('div', null,
          num('dps', `ปันผลต่อหุ้น (${ccy})`, { min: 0, max: Math.max(1, +(S.dps * 3).toFixed(2)), step: 0.01 }),
          num('dg', 'อัตราเติบโตปันผล (% ต่อปี)', { min: 0, max: 15, step: 0.1 }),
          num('dr', 'ผลตอบแทนที่ต้องการ (% ต่อปี)', { min: 1, max: 20, step: 0.1 })));
        drawResult();
      } else if (tab === 'dcf') {
        panel.replaceChildren(h('div', null,
          num('fcf', `FCF ล่าสุด (${ccy})`, { slider: false }),
          num('g1', 'เติบโต 5 ปีแรก (% ต่อปี)', { min: -10, max: 30, step: 0.5 }),
          num('gt', 'เติบโตระยะยาว (% ต่อปี)', { min: 0, max: 5, step: 0.1 }),
          num('disc', 'อัตราคิดลด (% ต่อปี)', { min: 3, max: 20, step: 0.1 }),
          num('shares', 'จำนวนหุ้น', { slider: false }),
          num('netDebt', `หนี้สุทธิ (หนี้ − เงินสด, ${ccy})`, { slider: false })));
        drawResult();
      } else if (tab === 'pe') {
        drawBand();
      } else {
        panel.replaceChildren(h('div', null,
          num('eps', `กำไรต่อหุ้น EPS (${ccy})`, { slider: false }),
          num('bvps', `มูลค่าทางบัญชีต่อหุ้น BVPS (${ccy})`, { slider: false, help: 'ส่วนของผู้ถือหุ้น ÷ จำนวนหุ้น' })));
        drawResult();
      }
    };

    const seg = ui.segment([{ value: 'ddm', label: 'DDM' }, { value: 'dcf', label: 'DCF' }, { value: 'pe', label: 'P/E Band' }, { value: 'graham', label: 'Graham' }], tab, (v) => { tab = v; drawPanel(); });

    const noFund = !F || !(F.years || []).length;
    root.replaceChildren(
      summaryBox,
      h('div', { style: { margin: '12px 0' } }, seg),
      noFund ? ui.card({ tone: 'butter', body: h('div', { class: 'small' }, 'ยังไม่มีข้อมูลงบการเงินของหุ้นตัวนี้ ค่าที่ขึ้นต้นจึงเป็น 0 กรอกเองได้') }) : h('span'),
      ui.card({ body: h('div', null, panel, h('div', { class: 'divider' }), resultBox) }),
      ui.disclaimer());
    drawSummary();
    drawPanel();
    return () => { dead = true; };
  },
};
