// หนูออม — ปันผลของฉัน (owner: Builder C)
function bodyOf(item) {
  let b = item && item.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  return b || {};
}

export default {
  title: 'ปันผลของฉัน',
  async render(root, params, ctx) {
    const { store, ui, fmt, calc, nav } = ctx;
    const { h } = ui;
    let alive = true;
    let data = null; // { evMap, calendar }
    let loadKey = '';
    let charts = [];

    const openTx = async (preset) => { const m = await import('./portfolio.js'); m.openTxSheet(ctx, preset || {}); };

    async function load() {
      const s = store.get();
      const hs = s.derived.holdings.filter((x) => (x.cls === 'TH' || x.cls === 'US') && x.qty > 0);
      const key = hs.map((x) => x.symbol).join(',') + '|' + s.news.length;
      if (key === loadKey) return false;
      loadKey = key;
      const evMap = {};
      await Promise.all(hs.map(async (x) => {
        try { const d = await store.dividends(x.symbol); evMap[x.symbol] = (d && d.events) || []; } catch (e) { evMap[x.symbol] = []; }
      }));
      if (!alive) return false;
      const weekly = s.news.filter((n) => n.kind === 'WEEKLY').sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
      const confirmed = (bodyOf(weekly).upcoming_xd || []).filter((c) => c && c.confirmed !== false);
      let calendar = [];
      try { calendar = calc.dividends.projectCalendar(hs, evMap, { months: 12, confirmed, wht: s.settings.wht, fx: s.fx }); } catch (e) { console.error(e); }
      data = { evMap, calendar, hs };
      return true;
    }

    function calRow(e) {
      return h('div', { class: 'li' },
        h('div', { class: 'avatar', style: { background: `var(--${fmt.clsTone(e.cls)}-bg)`, color: `var(--${fmt.clsTone(e.cls)}-ink)` } }, fmt.sym(e.symbol).slice(0, 6)),
        h('div', { class: 'main' },
          h('div', { class: 'title' }, fmt.sym(e.symbol), ' ', ui.chip(e.estimated ? 'คาดการณ์' : 'ยืนยันแล้ว', e.estimated ? 'butter' : 'mint')),
          h('div', { class: 'sub', style: { whiteSpace: 'normal' } }, `ขึ้น XD ${fmt.date(e.xd)} · จ่าย ${fmt.date(e.pay)}`)),
        h('div', { class: 'right' }, h('div', { class: 'r1' }, fmt.thb(e.netTHB)), h('div', { class: 'r2' }, `${e.qty.toLocaleString('th-TH')} หุ้น`)));
    }

    function build() {
      const s = store.get();
      const nodes = [], post = [];
      const hasDiv = s.tx.some((x) => x.type === 'DIV');
      const hs = s.derived.holdings.filter((x) => (x.cls === 'TH' || x.cls === 'US') && x.qty > 0);
      if (!hs.length && !hasDiv) {
        nodes.push(ui.empty({
          mood: 'money', title: 'ยังไม่มีปันผลให้ดู', text: 'บันทึกหุ้นปันผลที่ถืออยู่ หรือเงินปันผลที่ได้รับ แล้วหนูออมจะช่วยสรุปให้',
          action: h('div', { class: 'btn-row', style: { justifyContent: 'center' } },
            ui.button('บันทึกเงินปันผลที่ได้รับ', { variant: 'primary', icon: 'coin', onClick: () => openTx({ type: 'DIV' }) }),
            ui.button('ลองคำนวณก้อนหิมะปันผล', { variant: 'soft', icon: 'snowflake', onClick: () => nav('tools/snowball') })),
        }));
        nodes.push(ui.disclaimer());
        return { nodes, post };
      }

      const now = new Date(), year = now.getFullYear(), m = now.getMonth();
      const thisY = calc.dividends.receivedByMonth(s.tx, s.fx, year);
      const lastY = calc.dividends.receivedByMonth(s.tx, s.fx, year - 1);
      const ytd = thisY.reduce((a, b) => a + b, 0);
      let l12 = 0;
      for (let i = m + 1; i < 12; i++) l12 += lastY[i];
      for (let i = 0; i <= m; i++) l12 += thisY[i];
      const avg = l12 / 12;
      const goalM = Number(s.settings.dividend_goal_month) || 0;
      const pct = goalM > 0 ? (avg / goalM) * 100 : 0;

      nodes.push(h('div', { class: 'row', style: { margin: '4px 0 12px' } }, ui.mascot('money', 64, { bob: true }),
        h('div', { class: 'speech grow' }, avg > 0 ? `ปันผลเฉลี่ยเดือนละ ${fmt.thb(avg)} หนูออมเก็บใส่แก้มไว้ให้แล้วนะ` : 'ยังไม่มีปันผลเข้า รอดูกันต่อไปนะ')));
      nodes.push(ui.metrics([
        { label: `ปันผลสุทธิปี ${year + 543}`, value: fmt.thb(ytd), icon: 'coin' },
        { label: '12 เดือนล่าสุด', value: fmt.thb(l12), icon: 'calendar-stats' },
        { label: 'เฉลี่ยต่อเดือน', value: fmt.thb(avg), icon: 'chart-line' },
        { label: 'ถึงเป้าแล้ว', value: fmt.pct(pct, { dec: 0 }), tone: pct >= 100 ? 'up' : '' },
      ]));

      const left = Math.max(0, goalM - avg);
      nodes.push(ui.card({
        title: 'เป้าหมายปันผลต่อเดือน', icon: 'target',
        body: h('div', null,
          h('div', { class: 'progress-label' }, h('span', null, `${fmt.thb(avg)} จากเป้า ${fmt.thb(goalM)}`), h('b', null, fmt.pct(pct, { dec: 0 }))),
          ui.progress(pct, 'mint'),
          h('div', { class: 'small muted', style: { marginTop: '8px' } }, left > 0 ? `อีก ${fmt.thb(left)} ต่อเดือนจะถึงเป้า สู้ๆ นะ` : 'ถึงเป้าแล้ว เก่งมาก!')),
      }));

      const chartBox = h('div', { class: 'chart-box' });
      nodes.push(ui.card({ title: 'ปันผลที่ได้รับรายเดือน', icon: 'chart-bar', sub: `ปี ${year + 543} เทียบ ปี ${year + 542} (สุทธิ, บาท)`, body: chartBox }));
      post.push(() => {
        const c = ctx.chart(chartBox, {
          type: 'bar',
          data: {
            labels: Array.from({ length: 12 }, (_, i) => fmt.month(i)),
            datasets: [
              { label: `ปี ${year + 542}`, data: lastY.map((v) => Math.round(v)), backgroundColor: ctx.chart.colors[1] },
              { label: `ปี ${year + 543}`, data: thisY.map((v) => Math.round(v)), backgroundColor: ctx.chart.colors[0] },
            ],
          },
          options: {
            plugins: { tooltip: { callbacks: { label: (i) => `${i.dataset.label}: ${fmt.thb(i.parsed.y)}` } } },
            scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { callback: (v) => Number(v).toLocaleString('th-TH') } } },
          },
        });
        if (c) charts.push(c);
      });

      // ปฏิทิน + ตาราง (ต้องโหลดข้อมูล)
      if (!data) {
        nodes.push(ui.card({ title: 'ปฏิทินปันผล 12 เดือนข้างหน้า', icon: 'calendar-event', body: ui.skeleton(3) }));
        nodes.push(ui.card({ title: 'ปันผลรายตัว', icon: 'table', body: ui.skeleton(3) }));
      } else {
        const groups = new Map();
        data.calendar.forEach((e) => { const k = e.xd.slice(0, 7); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); });
        nodes.push(ui.section('ปฏิทินปันผล 12 เดือนข้างหน้า'));
        if (!groups.size) {
          nodes.push(ui.card({ body: h('div', { class: 'faint center' }, 'ยังไม่มีข้อมูลปันผลของหุ้นที่ถือ ให้คาดการณ์') }));
        } else {
          for (const [k, arr] of groups) {
            const [y, mm] = k.split('-').map(Number);
            const total = arr.reduce((a, b) => a + b.netTHB, 0);
            nodes.push(ui.card({
              title: `${fmt.month(mm - 1, true)} ${y + 543}`, icon: 'calendar-month',
              action: ui.chip(`รวม ${fmt.thb(total)}`, 'mint'),
              body: h('div', { class: 'list' }, arr.map(calRow)),
            }));
          }
        }
        nodes.push(h('div', { class: 'faint', style: { margin: '6px 2px' } }, 'ตัวเลข "คาดการณ์" คิดจากปันผลย้อนหลัง 12 เดือน ไม่ได้รับประกันว่าจะจ่ายจริง'));

        const rows = data.hs.map((hd) => {
          const ev = data.evMap[hd.symbol] || [];
          const st = calc.dividends.stats(ev, hd.price);
          return { hd, st, yoc: calc.dividends.yieldOnCost(hd, st.ttm) };
        });
        nodes.push(ui.card({
          title: 'ปันผลรายตัว', icon: 'table',
          body: h('div', { class: 'scroll-x' }, h('table', { class: 'table' },
            h('thead', null, h('tr', null, h('th', null, 'หุ้น'), h('th', { class: 'r' }, 'ปันผลต่อราคา'), h('th', { class: 'r' }, 'ต่อต้นทุน'), h('th', { class: 'r' }, 'จ่ายต่อเนื่อง'), h('th', { class: 'r' }, 'โต 5 ปี'))),
            h('tbody', null, rows.map(({ hd, st, yoc }) => h('tr', null,
              h('td', null, h('b', null, fmt.sym(hd.symbol))),
              h('td', { class: 'r' }, st.ttm > 0 ? fmt.pct(st.yieldPct) : '–'),
              h('td', { class: 'r' }, st.ttm > 0 ? fmt.pct(yoc) : '–'),
              h('td', { class: 'r' }, st.consecutiveYears ? `${st.consecutiveYears} ปี` : '–'),
              h('td', { class: `r ${fmt.tone(st.cagr5)}` }, st.cagr5 === null ? '–' : fmt.pct(st.cagr5, { sign: true }))))))),
        }));
        nodes.push(h('div', { class: 'faint', style: { margin: '6px 2px' } }, 'ปันผลต่อราคา = ปันผล 12 เดือนล่าสุด ÷ ราคาปัจจุบัน · ต่อต้นทุน = ÷ ทุนเฉลี่ยของคุณ'));
      }

      nodes.push(h('div', { class: 'btn-row', style: { marginTop: '14px' } },
        ui.button('บันทึกเงินปันผลที่ได้รับ', { variant: 'primary', icon: 'plus', onClick: () => openTx({ type: 'DIV' }) }),
        ui.button('ลองคำนวณก้อนหิมะปันผล', { variant: 'soft', icon: 'snowflake', onClick: () => nav('tools/snowball') })));
      nodes.push(ui.disclaimer());
      return { nodes, post };
    }

    const draw = () => {
      if (!alive) return;
      charts.forEach((c) => { try { c.destroy(); } catch (e) { /* ignore */ } });
      charts = [];
      const { nodes, post } = build();
      root.replaceChildren(...nodes);
      post.forEach((f) => f());
    };
    draw();
    load().then((ch) => { if (ch && alive) draw(); });
    const unsub = store.subscribe(() => { draw(); load().then((ch) => { if (ch && alive) draw(); }); });
    return () => { alive = false; unsub(); charts.forEach((c) => { try { c.destroy(); } catch (e) { /* ignore */ } }); };
  },
};
