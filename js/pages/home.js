// หนูออม — หน้าแรก (owner: Builder C)
const RULE_TH = { min_yield: 'ปันผลถึงเกณฑ์', max_pe: 'P/E ถึงเกณฑ์', price_below: 'ราคาต่ำกว่าที่ตั้ง', price_above: 'ราคาสูงกว่าที่ตั้ง' };

function bodyOf(item) {
  let b = item && item.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  return b || {};
}
const newest = (arr) => arr.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.created || '').localeCompare(String(a.created || '')))[0];

/** net dividends (THB) over the last 12 calendar months */
export function last12Net(calc, tx, fx) {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth();
  const a = calc.dividends.receivedByMonth(tx, fx, y - 1), b = calc.dividends.receivedByMonth(tx, fx, y);
  let sum = 0;
  for (let i = m + 1; i < 12; i++) sum += a[i];
  for (let i = 0; i <= m; i++) sum += b[i];
  return sum;
}

export default {
  title: 'HOON',
  async render(root, params, ctx) {
    const { store, ui, fmt, calc, nav } = ctx;
    const { h } = ui;
    let alive = true;
    let cal = null; // upcoming dividends (null = loading)
    let charts = [];
    const calKey = { v: '' };

    const openTx = async (preset) => { const m = await import('./portfolio.js'); m.openTxSheet(ctx, preset || {}); };

    async function loadCalendar() {
      const s = store.get();
      const hs = s.derived.holdings.filter((x) => (x.cls === 'TH' || x.cls === 'US') && x.qty > 0);
      const key = hs.map((x) => x.symbol).join(',') + '|' + s.news.length;
      if (key === calKey.v) return false;
      calKey.v = key;
      if (!hs.length) { cal = []; return true; }
      const map = {};
      await Promise.all(hs.map(async (x) => {
        try { const d = await store.dividends(x.symbol); map[x.symbol] = (d && d.events) || []; } catch (e) { map[x.symbol] = []; }
      }));
      if (!alive) return false;
      const weekly = newest(s.news.filter((n) => n.kind === 'WEEKLY'));
      const confirmed = (bodyOf(weekly).upcoming_xd || []).filter((c) => c && c.confirmed !== false);
      try {
        cal = calc.dividends.projectCalendar(hs, map, { months: 3, confirmed, wht: s.settings.wht, fx: s.fx });
      } catch (e) { console.error(e); cal = []; }
      return true;
    }
    const qbtn = (t, v, f) => { const b = ui.button(t, { variant: v, onClick: f, block: true }); Object.assign(b.style, { padding: '0 4px', whiteSpace: 'nowrap', fontSize: '13.5px' }); return b; };
    const link = (el, path) => { el.style.cursor = 'pointer'; el.addEventListener('click', () => nav(path)); return el; };

    function build() {
      const s = store.get();
      const t = s.derived.totals || {};
      const holdings = s.derived.holdings;
      const nodes = [];
      const post = [];

      // ----- ผู้ใช้ใหม่ -----
      if (!s.tx.length) {
        nodes.push(ui.empty({
          mood: 'happy', title: 'เริ่มจากบันทึกหุ้นตัวแรกของคุณ',
          text: 'หนูออมจะช่วยดูพอร์ต ปันผล ทอง และข่าวให้ทุกวัน เริ่มได้เลยนะ',
          action: h('div', { class: 'btn-row', style: { justifyContent: 'center' } },
            ui.button('บันทึกรายการ', { variant: 'primary', icon: 'plus', onClick: () => openTx() }),
            ui.button('ไปตั้งค่าเชื่อมข้อมูล', { variant: 'soft', icon: 'settings', onClick: () => nav('settings') })),
        }));
        nodes.push(ui.disclaimer());
        return { nodes, post };
      }

      // ----- ทักทาย -----
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      const recentDiv = s.tx.some((x) => x.type === 'DIV' && fmt.toDate(x.date) >= weekAgo);
      const day = Number(t.dayChangePct) || 0;
      const mood = recentDiv ? 'money' : day >= 1 ? 'excited' : day <= -1.5 ? 'worried' : 'happy';
      const line = recentDiv ? 'ปันผลเข้าแล้ว เก็บใส่แก้มก่อน!' : mood === 'excited' ? 'วันนี้พอร์ตสดใสเลย' : mood === 'worried' ? 'วันนี้พอร์ตลงนิดหน่อย ใจเย็นๆ นะ' : 'วันนี้หนูออมดูแลพอร์ตให้แล้วนะ';
      nodes.push(h('div', { class: 'row', style: { margin: '4px 0 12px' } },
        ui.mascot(mood, 64, { bob: true }),
        h('div', { class: 'speech grow' }, h('b', null, `${fmt.greeting()} ${s.settings.display_name || ''}`), h('div', { class: 'small muted' }, line))));

      // ----- การ์ดหลัก -----
      const snaps = (s.snapshots || []).slice(-130);
      const chartBox = h('div', { class: 'chart-box short' });
      const heroBody = h('div', null,
        h('div', { class: 'small muted' }, 'มูลค่าพอร์ตรวม'),
        h('div', { class: 'hero-value' }, fmt.thb(t.valueTHB)),
        h('div', { class: 'row wrap', style: { marginTop: '4px', gap: '6px' } },
          ui.chip(`วันนี้ ${fmt.thb(t.dayChangeTHB, { sign: true })} (${fmt.pct(t.dayChangePct, { sign: true, dec: 2 })})`, fmt.tone(t.dayChangeTHB) || 'gray'),
          ui.chip(`กำไร/ขาดทุนยังไม่ขาย ${fmt.thb(t.unrealizedTHB, { sign: true })} (${fmt.pct(t.unrealizedPct, { sign: true })})`, fmt.tone(t.unrealizedTHB) || 'gray')),
        snaps.length > 2 ? h('div', { style: { marginTop: '10px' } }, chartBox) : null);
      nodes.push(ui.card({ tone: 'pink', body: heroBody }));
      if (snaps.length > 2) {
        post.push(() => {
          const c = ctx.chart(chartBox, {
            type: 'line',
            data: { labels: snaps.map((x) => fmt.date(x.date)), datasets: [{ data: snaps.map((x) => Number(x.value_thb)), borderColor: ctx.chart.css('--accent'), backgroundColor: 'transparent', fill: false, tension: 0.3 }] },
            options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: (i) => fmt.thb(i.parsed.y) } } }, scales: { x: { display: false }, y: { display: false } }, interaction: { intersect: false, mode: 'index' } },
          });
          if (c) charts.push(c);
        });
      }

      // ----- เป้าปันผล -----
      const goalM = Number(s.settings.dividend_goal_month) || 0;
      const avg = last12Net(calc, s.tx, s.fx) / 12;
      const pct = goalM > 0 ? (avg / goalM) * 100 : 0;
      nodes.push(link(ui.card({
        title: 'เป้าหมายปันผล', icon: 'target', sub: 'แตะเพื่อดูรายละเอียด',
        body: h('div', null,
          h('div', { class: 'progress-label' }, h('span', null, `เฉลี่ย ${fmt.thb(avg)}/เดือน จากเป้า ${fmt.thb(goalM)}`), h('b', null, fmt.pct(pct, { dec: 0 }))),
          ui.progress(pct, 'mint')),
      }), 'dividends'));

      // ----- สัดส่วน -----
      const alloc = calc.portfolio.allocation(holdings, 'cls').filter((a) => a.valueTHB > 0);
      if (alloc.length) {
        const segs = alloc.map((a) => ({ label: `${fmt.clsName(a.key)} ${fmt.pct(a.pct, { dec: 0 })}`, value: a.valueTHB, color: ui.CLS_COLOR[a.key] }));
        nodes.push(ui.card({
          title: 'สัดส่วนพอร์ต', icon: 'chart-pie',
          body: h('div', { class: 'row', style: { gap: '14px' } }, ui.donut(segs, 124, { thickness: 20 }),
            h('div', { class: 'grow' }, ui.legend(segs))),
        }));
      }

      // ----- เตือน -----
      let warns = [];
      try { warns = calc.risk.rulesCheck(t, holdings, s.settings).slice(0, 3); } catch (e) { warns = []; }
      if (warns.length) {
        nodes.push(link(ui.card({
          tone: 'peach', title: 'จุดที่ควรเช็ก', icon: 'alert-circle', sub: 'เทียบกับกฎที่คุณตั้งไว้',
          body: h('div', { class: 'col', style: { gap: '8px' } }, warns.map((w) => h('div', { class: 'row', style: { alignItems: 'flex-start' } },
            ui.icon(w.level === 'warn' ? 'alert-triangle' : 'info-circle'), h('div', { class: 'small grow' }, w.text)))),
        }), 'risk'));
      }

      // ----- ข่าวล่าสุด -----
      const daily = newest(s.news.filter((n) => n.kind === 'DAILY'));
      if (daily) {
        const b = bodyOf(daily);
        const items = (b.sections || []).flatMap((sec) => sec.items || []).slice(0, 3);
        const icoOf = { up: ['trending-up', 'up'], down: ['trending-down', 'down'] };
        nodes.push(ui.card({
          title: 'ข่าวเช้าล่าสุด', icon: 'news', sub: fmt.date(daily.date),
          body: h('div', { class: 'col', style: { gap: '8px' } },
            h('div', { style: { fontWeight: 600 } }, b.headline || daily.summary || daily.title),
            items.map((it) => {
              const [ic, tn] = icoOf[it.impact] || ['minus', ''];
              return h('div', { class: 'row', style: { alignItems: 'flex-start' } }, h('span', { class: tn }, ui.icon(ic)), h('div', { class: 'small grow' }, it.text));
            }),
            (b.rule_hits || []).length ? h('div', { class: 'row wrap', style: { gap: '6px' } }, b.rule_hits.slice(0, 4).map((r) => ui.chip(`${fmt.sym(r.symbol)} · ${RULE_TH[r.rule] || 'เข้าเกณฑ์'}`, 'mint'))) : null,
            h('div', null, ui.button('อ่านต่อ', { small: true, variant: 'soft', icon: 'arrow-right', onClick: () => nav('news/' + encodeURIComponent(daily.id)) }))),
        }));
      } else {
        nodes.push(ui.card({
          title: 'ข่าวเช้า', icon: 'news',
          body: h('div', { class: 'row' }, ui.mascot('sleep', 44), h('div', { class: 'small muted grow' }, 'ทีมข่าวจะส่งสรุปทุกเช้าวันทำการ 08:30')),
        }));
      }

      // ----- ปันผลที่จะถึง -----
      const todayIso = fmt.isoToday();
      const lim = new Date(); lim.setDate(lim.getDate() + 60);
      const limIso = fmt.iso(lim);
      let upBody;
      if (cal === null) upBody = ui.skeleton(2);
      else {
        const next = cal.filter((e) => e.xd >= todayIso && e.xd <= limIso).slice(0, 3);
        upBody = next.length
          ? h('div', { class: 'list' }, next.map((e) => ui.listItem({
            avatar: fmt.sym(e.symbol), avatarTone: fmt.clsTone(e.cls),
            title: [fmt.sym(e.symbol), ' ', ui.chip(e.estimated ? 'คาดการณ์' : 'ยืนยันแล้ว', e.estimated ? 'butter' : 'mint')],
            sub: `ขึ้น XD ${fmt.date(e.xd)} · จ่าย ${fmt.date(e.pay)}`,
            right: fmt.thb(e.netTHB), rightSub: 'สุทธิ',
          })))
          : h('div', { class: 'faint' }, 'ยังไม่มีปันผลที่คาดว่าจะถึงใน 60 วันนี้');
      }
      nodes.push(link(ui.card({ title: 'ปันผลที่กำลังจะมา', icon: 'calendar-event', sub: 'ภายใน 60 วัน', body: upBody }), 'dividends'));

      // ----- ทอง -----
      const g = s.gold && s.gold.latest;
      if (g) {
        nodes.push(link(ui.card({
          tone: 'butter', title: 'ทองคำแท่งวันนี้', icon: 'coin', sub: fmt.rel(g.time),
          body: h('div', { class: 'row between' },
            h('div', null, h('div', { class: 'small muted' }, 'ขายออก (ราคาซื้อทอง)'), h('div', { style: { fontSize: '22px', fontWeight: 700 } }, fmt.thb(g.barSell))),
            ui.chip(`${fmt.thb(g.changeToday, { sign: true })} วันนี้`, fmt.tone(g.changeToday) || 'gray')),
        }), 'gold'));
      }

      // ----- ทางลัด -----
      nodes.push(h('div', { class: 'grid3', style: { marginTop: '12px', gap: '8px' } },
        [['บันทึกรายการ', 'primary', () => openTx()], ['ส่องหุ้น', 'soft', () => nav('screener')], ['เครื่องคิดเลข', 'soft', () => nav('tools')]].map(([t, v, f]) =>
          qbtn(t, v, f))));
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
    const refresh = async () => { if (await loadCalendar()) draw(); };

    draw();
    refresh();
    const unsub = store.subscribe(() => { draw(); loadCalendar().then((ch) => { if (ch && alive) draw(); }); });
    return () => { alive = false; unsub(); charts.forEach((c) => { try { c.destroy(); } catch (e) { /* ignore */ } }); };
  },
};
