// หนูออม — ความเสี่ยงพอร์ต (Builder E)
const CLASSES = ['TH', 'US', 'CRYPTO', 'GOLD', 'CASH', 'OTHER'];
const DEFAULT_SHOCKS = { TH: -30, US: -30, CRYPTO: -60, GOLD: 5, CASH: 0, OTHER: -20 };
const PRESETS = [
  { label: 'วิกฤตแบบปี 2008', shocks: { TH: -50, US: -40, CRYPTO: -70, GOLD: 5, CASH: 0, OTHER: -30 }, note: 'สมมติว่าตลาดหุ้นทั่วโลกร่วงหนักแบบวิกฤตการเงินปี 2008' },
  { label: 'คริปโตร่วงหนัก', shocks: { TH: -5, US: -5, CRYPTO: -70, GOLD: 0, CASH: 0, OTHER: -10 }, note: 'สมมติว่าคริปโตร่วง 70% ส่วนสินทรัพย์อื่นลงเล็กน้อย' },
  { label: 'บาทแข็ง/หุ้นนอกลง', shocks: { TH: 0, US: -15, CRYPTO: -10, GOLD: -5, CASH: 0, OTHER: 0 }, note: 'สมมติว่าบาทแข็งค่าและหุ้นต่างประเทศปรับลง มูลค่าเป็นเงินบาทของสินทรัพย์ต่างประเทศจึงลดลง' },
  { label: 'ค่าเริ่มต้น', shocks: DEFAULT_SHOCKS, note: '' },
];
const CCY_NAME = { THB: 'บาท (THB)', USD: 'ดอลลาร์สหรัฐ (USD)' };

export default {
  title: 'ความเสี่ยงพอร์ต',
  async render(root, params, ctx) {
    const { store, ui, fmt, calc, nav, chart } = ctx;
    const { h, icon } = ui;
    const shocks = { ...DEFAULT_SHOCKS };
    let presetNote = '';
    let ddChart = null;

    const killChart = () => { if (ddChart) { try { ddChart.destroy(); } catch (e) { /* ignore */ } ddChart = null; } };

    // bar with an optional marker (target / limit)
    const bar = (pct, color, marker) => h('div', { style: { position: 'relative', height: '12px', borderRadius: '999px', background: 'var(--gray-bg)', overflow: 'visible' } },
      h('div', { style: { height: '100%', width: Math.max(0, Math.min(100, pct)) + '%', background: color, borderRadius: '999px', transition: 'width .4s ease' } }),
      marker !== undefined && marker !== null && marker !== '' && Number.isFinite(+marker)
        ? h('div', { title: `เป้า ${(+marker).toFixed(0)}%`, style: { position: 'absolute', top: '-3px', bottom: '-3px', left: `calc(${Math.max(0, Math.min(100, +marker))}% - 1px)`, width: '3px', borderRadius: '2px', background: 'var(--ink)' } }) : null);

    const draw = () => {
      killChart();
      const s = store.get();
      const hs = s.derived.holdings || [];
      const totals = s.derived.totals || {};
      const st = s.settings || {};
      const fx = s.fx || {};
      const total = totals.valueTHB || 0;

      if (!hs.length || !(total > 0)) {
        root.replaceChildren(ui.empty({
          mood: 'sleep', title: 'ยังไม่มีสินทรัพย์ในพอร์ต', text: 'พอเริ่มบันทึกรายการซื้อ หนูออมจะช่วยเช็กความเสี่ยงให้',
          action: ui.button('ไปหน้าพอร์ต', { variant: 'soft', onClick: () => nav('portfolio') }),
        }), ui.disclaimer());
        return;
      }
      const out = [];

      // ---------- warnings ----------
      const warns = calc.risk.rulesCheck(totals, hs, st);
      if (!warns.length) {
        out.push(ui.card({ tone: 'mint', body: h('div', { class: 'row' }, ui.mascot('happy', 52), h('div', { class: 'grow' }, h('b', null, 'พอร์ตอยู่ในกรอบที่คุณตั้งไว้'), h('div', { class: 'small muted' }, 'ยังไม่มีข้อไหนเกินเพดานหรือห่างจากเป้าเกิน 5 จุด'))) }));
      } else {
        out.push(ui.card({
          title: 'สิ่งที่ควรเช็ก', icon: 'alert-triangle', sub: 'เทียบกับกฎที่คุณตั้งไว้เอง',
          body: h('div', { class: 'stack' }, warns.map((w) => h('div', {
            class: 'row', style: { alignItems: 'flex-start', padding: '8px 10px', borderRadius: '12px', background: w.level === 'warn' ? 'var(--peach-bg)' : 'var(--sky-bg)', color: w.level === 'warn' ? 'var(--peach-ink)' : 'var(--sky-ink)' },
          }, icon(w.level === 'warn' ? 'alert-triangle' : 'info-circle'), h('div', { class: 'grow small' }, w.text)))),
        }));
      }

      // ---------- allocation vs target ----------
      const target = st.target_alloc || {};
      const clsList = CLASSES.filter((c) => (totals.byCls && totals.byCls[c] && totals.byCls[c].valueTHB > 0) || (c !== 'OTHER' && target[c] !== undefined && +target[c] > 0));
      out.push(ui.card({
        title: 'สัดส่วนจริง เทียบเป้าหมาย', icon: 'chart-pie', sub: 'เส้นดำคือเป้าหมายที่ตั้งไว้',
        body: h('div', { class: 'stack' }, clsList.map((c) => {
          const actual = (totals.byCls && totals.byCls[c] && totals.byCls[c].pct) || 0;
          const tg = target[c] !== undefined && target[c] !== '' ? +target[c] : null;
          const diff = tg === null ? null : actual - tg;
          const txt = diff === null ? 'ยังไม่ได้ตั้งเป้า' : Math.abs(diff) < 0.5 ? 'ตรงเป้า' : `${diff > 0 ? 'สูงกว่า' : 'ต่ำกว่า'}เป้า ${Math.abs(diff).toFixed(1)} จุด`;
          return h('div', null,
            h('div', { class: 'row between', style: { marginBottom: '4px' } },
              h('span', null, h('i', { class: 'dot', style: { background: ctx.chart.cls[c], marginRight: '6px' } }), fmt.clsName(c)),
              h('span', { class: 'small num' }, `${actual.toFixed(1)}%`, tg !== null ? h('span', { class: 'faint' }, ` / เป้า ${tg}%`) : null)),
            bar(actual, ctx.chart.cls[c], tg),
            h('div', { class: `small ${diff !== null && Math.abs(diff) > 5 ? 'down' : 'faint'}`, style: { marginTop: '3px' } }, txt));
        })),
      }));

      // ---------- concentration ----------
      const conc = calc.risk.concentration(hs, st.max_position_pct);
      const top5 = hs.filter((x) => x.cls !== 'CASH').map((x) => ({ symbol: x.symbol, w: Number.isFinite(+x.weight) ? +x.weight : (x.valueTHB / total) * 100 })).sort((a, b) => b.w - a.w).slice(0, 5);
      const hhiLabel = conc.hhi < 1500 ? ['กระจายตัวดี', 'mint'] : conc.hhi < 2500 ? ['กระจุกตัวปานกลาง', 'butter'] : ['กระจุกตัวสูง', 'peach'];
      out.push(ui.card({
        title: 'ความกระจุกตัว', icon: 'target', sub: st.max_position_pct ? `เส้นดำคือเพดานตัวเดียว ${st.max_position_pct}%` : null,
        body: h('div', { class: 'stack' },
          top5.length ? h('div', { class: 'stack' }, top5.map((t) => h('div', null,
            h('div', { class: 'row between', style: { marginBottom: '4px' } }, h('b', null, fmt.sym(t.symbol)), h('span', { class: `small num ${conc.over.some((o) => o.symbol === t.symbol) ? 'down' : ''}` }, `${t.w.toFixed(1)}%`)),
            bar(t.w * (100 / Math.max(40, top5[0].w)), conc.over.some((o) => o.symbol === t.symbol) ? 'var(--down)' : 'var(--pink)', st.max_position_pct ? (+st.max_position_pct) * (100 / Math.max(40, top5[0].w)) : null)))) : h('div', { class: 'muted' }, 'ยังไม่มีหุ้นหรือสินทรัพย์เสี่ยงในพอร์ต'),
          h('div', { class: 'grid2' },
            ui.metric({ label: 'ตัวใหญ่สุด', value: fmt.pct(conc.top1) }),
            ui.metric({ label: '3 ตัวใหญ่สุดรวมกัน', value: fmt.pct(conc.top3) })),
          h('div', { class: 'row wrap' }, h('span', { class: 'small' }, `ดัชนีกระจุกตัว (HHI) ${Math.round(conc.hhi).toLocaleString('th-TH')}`), ui.chip(hhiLabel[0], hhiLabel[1])),
          h('div', { class: 'small muted' }, 'HHI คือการเอาสัดส่วนของแต่ละตัวมายกกำลังสองแล้วบวกกัน ยิ่งต่ำยิ่งกระจาย (ต่ำกว่า 1,500 ถือว่ากระจายดี สูงกว่า 2,500 กระจุกมาก) ใช้ดูภาพรวมเท่านั้น')),
      }));

      // ---------- currency ----------
      const cur = calc.risk.currency(hs);
      const segs = cur.map((c, i) => ({ label: `${CCY_NAME[c.ccy] || c.ccy} ${c.pct.toFixed(1)}%`, value: c.valueTHB, color: ui.PALETTE[i % ui.PALETTE.length] }));
      const nonThb = cur.filter((c) => c.ccy !== 'THB').reduce((a, c) => a + c.pct, 0);
      out.push(ui.card({
        title: 'สกุลเงินที่ถืออยู่', icon: 'currency-dollar',
        body: h('div', null,
          h('div', { class: 'row', style: { gap: '16px', alignItems: 'center' } },
            h('div', { style: { flex: 'none' } }, ui.donut(segs, 124, { thickness: 20, center: `${nonThb.toFixed(0)}%` })),
            h('div', { class: 'grow' }, ui.legend(segs), h('div', { class: 'small muted', style: { marginTop: '8px' } }, `ตัวเลขกลางวงคือสัดส่วนที่ไม่ใช่เงินบาท ถ้าบาทแข็งค่า มูลค่า ${nonThb.toFixed(0)}% ส่วนนี้เมื่อแปลงเป็นบาทจะลดลง`)))),
      }));

      // ---------- stress test ----------
      const stressBox = h('div');
      const noteEl = h('div', { class: 'small muted' });
      const updateStress = () => {
        const r = calc.risk.stress(hs, shocks);
        noteEl.textContent = presetNote;
        stressBox.replaceChildren(
          ui.metrics([
            { label: 'มูลค่าตอนนี้', value: fmt.thb(r.before) },
            { label: 'มูลค่าหลังเหตุการณ์', value: fmt.thb(r.after) },
            { label: 'ผลต่าง', value: fmt.thb(-r.lossTHB, { sign: true }), tone: r.lossTHB > 0 ? 'down' : 'up' },
            { label: 'เปลี่ยนไป', value: fmt.pct(-r.lossPct, { sign: true }), tone: r.lossPct > 0 ? 'down' : 'up' },
          ]),
          h('div', { class: 'list', style: { marginTop: '8px' } }, r.byCls.map((c) => ui.listItem({
            avatar: fmt.clsName(c.cls).slice(0, 3), avatarTone: fmt.clsTone(c.cls), title: fmt.clsName(c.cls),
            sub: `${fmt.thb(c.before)} → ${fmt.thb(c.after)}`, right: fmt.thb(c.after - c.before, { sign: true }), rightSub: fmt.pct(shocks[c.cls], { dec: 0, sign: true }), rightTone: fmt.tone(c.after - c.before),
          }))));
      };
      const sliders = {};
      const sliderRows = CLASSES.filter((c) => totals.byCls && totals.byCls[c] && totals.byCls[c].valueTHB > 0).map((c) => {
        const val = h('b', { class: 'num' });
        const input = h('input', { type: 'range', min: '-80', max: '40', step: '5', value: String(shocks[c]), 'aria-label': `สมมติ${fmt.clsName(c)}เปลี่ยน`, style: { width: '100%', accentColor: 'var(--accent)', minHeight: '32px' } });
        const set = () => { val.textContent = fmt.pct(shocks[c], { dec: 0, sign: true }); val.className = `num ${fmt.tone(shocks[c])}`; };
        input.addEventListener('input', () => { shocks[c] = Number(input.value); presetNote = ''; set(); updateStress(); });
        sliders[c] = { input, set };
        set();
        return h('div', null, h('div', { class: 'row between' }, h('span', null, fmt.clsName(c)), val), input);
      });
      const presetBtns = h('div', { class: 'btn-row' }, PRESETS.map((p) => ui.button(p.label, {
        small: true, variant: 'soft', onClick: () => {
          Object.assign(shocks, DEFAULT_SHOCKS, p.shocks); presetNote = p.note;
          for (const c of Object.keys(sliders)) { sliders[c].input.value = String(shocks[c]); sliders[c].set(); }
          updateStress();
        },
      })));
      out.push(ui.card({
        title: 'ทดสอบเหตุการณ์สมมติ', icon: 'bolt', sub: 'ลองเลื่อนดูว่าถ้าตลาดแรงขนาดนี้ พอร์ตจะเป็นอย่างไร',
        body: h('div', { class: 'stack' }, presetBtns, noteEl, h('div', { class: 'stack' }, sliderRows), h('div', { class: 'divider', style: { margin: '4px 0' } }), stressBox,
          h('div', { class: 'faint' }, 'เป็นการสมมติเพื่อซ้อมรับมือ ไม่ใช่การพยากรณ์ว่าจะเกิดขึ้นจริง')),
      }));
      updateStress();

      // ---------- US estate tax ----------
      const est = calc.risk.usEstate(hs, fx.USD);
      if (est.usd > 0 || hs.some((x) => x.cls === 'US')) {
        out.push(ui.card({
          title: 'ภาษีมรดกสหรัฐฯ (หุ้นอเมริกา)', icon: 'flag', tone: est.pct >= 80 ? 'peach' : '',
          body: h('div', { class: 'stack' },
            ui.progress(Math.min(100, est.pct), est.over ? 'down' : est.pct >= 80 ? 'peach' : 'mint', h('span', { class: 'row between', style: { width: '100%' } }, h('span', null, `สินทรัพย์สหรัฐฯ ประมาณ $${Math.round(est.usd).toLocaleString('th-TH')}`), h('span', null, `เกณฑ์ $${est.limit.toLocaleString('th-TH')}`))),
            h('div', { class: 'small' }, est.over ? `ตอนนี้เกินเกณฑ์ที่เกี่ยวข้อง (${est.pct.toFixed(0)}% ของ $60,000) ควรศึกษาเพิ่ม` : `ตอนนี้ราว ${est.pct.toFixed(0)}% ของเกณฑ์ $60,000`),
            h('div', { class: 'small muted' }, 'สำหรับผู้ลงทุนที่ไม่ใช่คนอเมริกัน หุ้นและ ETF สหรัฐฯ ที่ถือโดยตรงอาจเข้าข่ายภาษีมรดกสหรัฐฯ เมื่อมูลค่ารวมเกินประมาณ $60,000 กฎและวิธีคำนวณมีรายละเอียดมาก ควรศึกษาเพิ่ม/ปรึกษาผู้เชี่ยวชาญ')),
        }));
      }

      // ---------- volatility / drawdown ----------
      const snaps = (s.snapshots || []).filter((x) => Number(x.value_thb) > 0);
      const vals = snaps.map((x) => Number(x.value_thb));
      let ddBody;
      if (vals.length < 3) {
        ddBody = h('div', { class: 'muted small' }, 'ยังมีข้อมูลมูลค่าพอร์ตรายวันไม่พอ รอให้หนูออมเก็บสถิติสักพักนะ');
      } else {
        const dd = calc.risk.drawdown(vals);
        const vol = calc.risk.volatility(vals, 252);
        const volLabel = vol === null ? '' : vol < 10 ? 'ค่อนข้างนิ่ง' : vol < 20 ? 'ปานกลาง' : 'ค่อนข้างแกว่ง';
        const step = Math.max(1, Math.ceil(snaps.length / 120));
        const pts = snaps.filter((_, i) => i % step === 0 || i === snaps.length - 1);
        const box = h('div', { class: 'chart-box short' });
        ddBody = h('div', { class: 'stack' },
          ui.metrics([
            { label: 'ลงลึกสุดจากจุดสูงสุด', value: fmt.pct(dd.maxDDPct), sub: `${fmt.date(snaps[dd.peakIdx].date)} → ${fmt.date(snaps[dd.troughIdx].date)}`, tone: dd.maxDDPct > 20 ? 'down' : '' },
            { label: 'ความผันผวนต่อปี', value: vol === null ? '–' : fmt.pct(vol), sub: volLabel }]),
          box,
          h('div', { class: 'small muted' }, 'คำนวณจากมูลค่าพอร์ตรายวันที่เก็บไว้ ซึ่งรวมเงินที่ฝากหรือถอนด้วย จึงเป็นค่าประมาณคร่าวๆ'));
        setTimeout(() => {
          if (!box.isConnected) return;
          ddChart = chart(box, {
            type: 'line',
            data: { labels: pts.map((p) => fmt.date(p.date)), datasets: [{ data: pts.map((p) => Number(p.value_thb)), borderColor: chart.cls.TH, backgroundColor: 'transparent', fill: false }] },
            options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { maxTicksLimit: 4, maxRotation: 0 }, grid: { display: false } }, y: { ticks: { maxTicksLimit: 4, callback: (v) => fmt.compact(v) } } } },
          });
        }, 0);
      }
      out.push(ui.card({ title: 'ความแกว่งของพอร์ต', icon: 'activity', body: ddBody }));

      // ---------- emergency fund ----------
      const expInput = ui.field({ label: 'ค่าใช้จ่ายต่อเดือนของคุณ (บาท)', type: 'number', value: st.monthly_expense ?? '', placeholder: 'เช่น 25000', help: 'ใช้คำนวณว่าเงินสดที่มีอยู่พอใช้กี่เดือน' });
      const months = Number(st.emergency_months) || 6;
      const exp = Number(st.monthly_expense) || 0;
      const cash = totals.cashTHB || 0;
      const covered = exp > 0 ? cash / exp : 0;
      let efText;
      if (!(exp > 0)) efText = 'กรอกค่าใช้จ่ายต่อเดือน แล้วหนูออมจะคำนวณให้';
      else if (covered >= months) efText = `เงินสดที่มี ${fmt.thb(cash)} ใช้ได้ประมาณ ${covered.toFixed(1)} เดือน ครบตามเป้า ${months} เดือนแล้ว`;
      else efText = `เงินสดที่มี ${fmt.thb(cash)} ใช้ได้ประมาณ ${covered.toFixed(1)} เดือน ยังขาดอีก ${fmt.thb(exp * months - cash)} จะครบ ${months} เดือน`;
      out.push(ui.card({
        title: 'เงินสำรองฉุกเฉิน', icon: 'lifebuoy',
        body: h('div', { class: 'stack' },
          exp > 0 ? ui.progress(Math.min(100, (covered / months) * 100), covered >= months ? 'mint' : 'butter', h('span', { class: 'row between', style: { width: '100%' } }, h('span', null, `มี ${covered.toFixed(1)} เดือน`), h('span', null, `เป้า ${months} เดือน`))) : null,
          h('div', { class: 'small' }, efText),
          expInput.el,
          ui.button('บันทึกค่าใช้จ่าย', {
            variant: 'soft', icon: 'device-floppy', onClick: async () => {
              const v = expInput.get();
              if (v === '' || !(v >= 0)) { expInput.error('กรอกเป็นตัวเลขตั้งแต่ 0 ขึ้นไป'); return; }
              try { await store.saveSettings({ monthly_expense: v }); ui.toast('บันทึกแล้ว', 'up'); } catch (e) { ui.toast(e.message, 'down'); }
            },
          }),
          h('div', { class: 'faint' }, 'นับเฉพาะเงินสดที่บันทึกไว้ในพอร์ต')),
      }));

      root.replaceChildren(h('div', null, out), ui.disclaimer());
    };

    draw();
    const unsub = store.subscribe(draw);
    return () => { unsub(); killChart(); };
  },
};
