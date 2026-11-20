// หนูออม — ทองคำ (owner: Builder C)
const GRAM_PER_BAHT = 15.244;
const RANGES = [{ value: 30, label: '1 เดือน' }, { value: 90, label: '3 เดือน' }, { value: 180, label: '6 เดือน' }, { value: 365, label: '1 ปี' }];

export default {
  title: 'ทองคำ',
  async render(root, params, ctx) {
    const { store, ui, fmt } = ctx;
    const { h } = ui;
    let alive = true;
    let data = null, error = null;
    let range = 90;
    let charts = [];
    let calcBaht = 1;

    const openTx = async () => { const m = await import('./portfolio.js'); m.openTxSheet(ctx, { type: 'BUY', cls: 'GOLD', symbol: 'GOLD965', ccy: 'THB' }); };

    function latest() { return (data && data.latest) || (store.get().gold && store.get().gold.latest) || null; }

    function addAlertSheet() {
      const g = latest();
      const kind = ui.field({ label: 'เตือนเมื่อ', type: 'select', options: [{ value: 'GOLD_BELOW', label: 'ทองแท่งราคาต่ำกว่า' }, { value: 'GOLD_ABOVE', label: 'ทองแท่งราคาสูงกว่า' }], value: 'GOLD_BELOW' });
      const val = ui.field({ label: 'ราคา (บาทต่อบาททองคำ)', type: 'number', value: g ? Math.round(g.barSell / 100) * 100 : '', help: 'เทียบกับราคาขายออกของทองแท่ง' });
      const note = ui.field({ label: 'โน้ตกันลืม (ไม่ใส่ก็ได้)', value: '' });
      ui.sheet({
        title: 'ตั้งเตือนราคาทอง', body: h('div', { class: 'form' }, kind.el, val.el, note.el),
        actions: [{
          text: 'บันทึก', variant: 'primary', icon: 'bell-plus',
          onClick: async () => {
            if (!(Number(val.get()) > 0)) { val.error('กรอกราคาที่มากกว่า 0'); return false; }
            try { await store.upsertAlert({ symbol: 'GOLD965', cls: 'GOLD', kind: kind.get(), value: Number(val.get()), active: true, note: note.get() }); } catch (e) { ui.toast(e.message, 'down'); return false; }
            ui.toast('ตั้งเตือนแล้ว', 'up');
            return undefined;
          },
        }],
      });
    }

    function build() {
      const s = store.get();
      const nodes = [], post = [];
      const g = latest();

      // ราคาล่าสุด
      if (g) {
        const ch = Number(g.changeToday) || 0;
        nodes.push(ui.card({
          tone: 'butter', title: 'ราคาทองไทยล่าสุด', icon: 'coin', sub: `อัปเดต ${fmt.rel(g.time)}`,
          action: ui.chip(`${fmt.thb(ch, { sign: true })} วันนี้`, fmt.tone(ch) || 'gray'),
          body: h('div', null,
            h('div', { class: 'grid2' },
              h('div', null, h('div', { class: 'small muted' }, 'ทองคำแท่ง รับซื้อ'), h('div', { class: 'num', style: { fontSize: '20px', fontWeight: 700 } }, fmt.thb(g.barBuy))),
              h('div', null, h('div', { class: 'small muted' }, 'ทองคำแท่ง ขายออก'), h('div', { class: 'num', style: { fontSize: '20px', fontWeight: 700 } }, fmt.thb(g.barSell))),
              h('div', null, h('div', { class: 'small muted' }, 'ทองรูปพรรณ รับซื้อ'), h('div', { class: 'num', style: { fontWeight: 600 } }, fmt.thb(g.ornBuy))),
              h('div', null, h('div', { class: 'small muted' }, 'ทองรูปพรรณ ขายออก'), h('div', { class: 'num', style: { fontWeight: 600 } }, fmt.thb(g.ornSell)))),
            h('div', { class: 'divider' }),
            h('div', { class: 'row between wrap small' },
              h('span', null, `ทองโลก ${fmt.money(g.spotUsd, 'USD', 0)}/ออนซ์`), h('span', null, `1 ดอลลาร์ = ${fmt.num(g.thbUsd, 2)} บาท`)),
            h('div', { class: 'faint', style: { marginTop: '6px' } }, 'ที่มา: ', h('a', { href: 'https://www.goldtraders.or.th/', target: '_blank', rel: 'noopener' }, 'สมาคมค้าทองคำ'))),
        }));
      } else {
        nodes.push(ui.card({ tone: 'butter', body: h('div', { class: 'row' }, ui.mascot('sleep', 44), h('div', { class: 'small grow' }, 'ยังไม่มีราคาทอง ลองกดรีเฟรชด้านบนนะ')) }));
      }

      // กราฟ
      nodes.push(h('div', { style: { margin: '14px 0 4px' } }, ui.segment(RANGES, range, (v) => { range = v; draw(); })));
      if (error) nodes.push(ui.errorBox(error, () => { error = null; data = null; draw(); fetchData(); }));
      else if (!data) nodes.push(ui.card({ title: 'กราฟราคาทอง', icon: 'chart-line', body: ui.skeleton(4) }));
      else {
        const cutoff = Date.now() - range * 86400000;
        let hist = (data.history || []).filter((r) => fmt.toDate(r.time) && fmt.toDate(r.time).getTime() >= cutoff);
        let estimated = false;
        // The backend only starts recording Thai prices on install day. Until enough real history exists,
        // estimate it from world gold × THB/USD (96.5% gold, 15.244 g per baht-weight, 31.1035 g per oz),
        // calibrated to today's real association price so the line ends exactly on the real number.
        const lt = data.latest || (store.get().gold || {}).latest;
        const wd = data.world || { t: [], c: [] };
        if (hist.length < 10 && lt && lt.spotUsd && lt.thbUsd && (wd.c || []).length) {
          const k = (15.244 * 0.965) / 31.1035;
          const premium = Number(lt.barSell) - Number(lt.spotUsd) * Number(lt.thbUsd) * k;
          hist = wd.t.map((t, i) => ({ time: t, bar_sell: Number(wd.c[i]) * Number(lt.thbUsd) * k + premium }))
            .filter((r) => r.time * 1000 >= cutoff && Number.isFinite(r.bar_sell));
          estimated = hist.length > 0;
        }
        const box1 = h('div', { class: 'chart-box' });
        nodes.push(ui.card({
          title: 'ราคาทองแท่ง (ขายออก)', icon: 'chart-line',
          sub: estimated ? 'ค่าประมาณจากทองโลก × ค่าเงิน (หนูออมกำลังเก็บประวัติราคาจริงทุกวัน)' : 'บาทต่อบาททองคำ',
          body: hist.length ? box1 : h('div', { class: 'faint center' }, 'ยังไม่มีข้อมูลย้อนหลัง'),
        }));
        if (hist.length) post.push(() => {
          const c = ctx.chart(box1, {
            type: 'line',
            data: { labels: hist.map((r) => fmt.date(r.time)), datasets: [{ data: hist.map((r) => Number(r.bar_sell)), borderColor: ctx.chart.colors[2], backgroundColor: 'transparent' }] },
            options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: (i) => fmt.thb(i.parsed.y) } } }, interaction: { intersect: false, mode: 'index' }, scales: { x: { ticks: { maxTicksLimit: 4, maxRotation: 0 }, grid: { display: false } }, y: { ticks: { callback: (v) => Number(v).toLocaleString('th-TH') } } } },
          });
          if (c) charts.push(c);
        });
        const w = data.world || { t: [], c: [] };
        const idx = (w.t || []).map((t, i) => i).filter((i) => w.t[i] * 1000 >= cutoff);
        const box2 = h('div', { class: 'chart-box' });
        nodes.push(ui.card({ title: 'ราคาทองโลก', icon: 'world', sub: 'ดอลลาร์ต่อออนซ์', body: idx.length ? box2 : h('div', { class: 'faint center' }, 'ยังไม่มีข้อมูลทองโลก') }));
        if (idx.length) post.push(() => {
          const c = ctx.chart(box2, {
            type: 'line',
            data: { labels: idx.map((i) => fmt.date(w.t[i])), datasets: [{ data: idx.map((i) => Number(w.c[i])), borderColor: ctx.chart.colors[1], backgroundColor: 'transparent' }] },
            options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: (i) => fmt.money(i.parsed.y, 'USD', 0) } } }, interaction: { intersect: false, mode: 'index' }, scales: { x: { ticks: { maxTicksLimit: 4, maxRotation: 0 }, grid: { display: false } }, y: { ticks: { callback: (v) => Number(v).toLocaleString('th-TH') } } } },
          });
          if (c) charts.push(c);
        });
      }

      // ทองของฉัน
      const mine = s.derived.holdings.filter((x) => x.cls === 'GOLD');
      nodes.push(ui.card({
        title: 'ทองของฉัน', icon: 'wallet',
        action: ui.button('บันทึกการซื้อทอง', { small: true, variant: 'soft', icon: 'plus', onClick: openTx }),
        body: mine.length ? h('div', { class: 'col', style: { gap: '12px' } }, mine.map((hd) => h('dl', { class: 'kv' },
          h('dt', null, 'จำนวน'), h('dd', null, `${Number(hd.qty).toLocaleString('th-TH', { maximumFractionDigits: 4 })} บาททองคำ (${fmt.num(hd.qty * GRAM_PER_BAHT, 2)} กรัม)`),
          h('dt', null, 'ทุนเฉลี่ย'), h('dd', null, `${fmt.thb(hd.avgCost)} ต่อบาท`),
          h('dt', null, 'มูลค่าตอนนี้'), h('dd', null, fmt.thb(hd.valueTHB)),
          h('dt', null, 'กำไร/ขาดทุน'), h('dd', { class: fmt.tone(hd.unrealizedTHB) }, `${fmt.thb(hd.unrealizedTHB, { sign: true })} (${fmt.pct(hd.unrealizedPct, { sign: true })})`),
          h('dt', null, 'มูลค่าคิดจาก'), h('dd', null, 'ราคารับซื้อทองแท่ง'))))
          : h('div', { class: 'faint center', style: { padding: '8px 0' } }, 'ยังไม่มีทองในพอร์ต'),
      }));

      // แจ้งเตือน
      const alerts = s.alerts.filter((a) => a.kind === 'GOLD_BELOW' || a.kind === 'GOLD_ABOVE');
      nodes.push(ui.card({
        title: 'เตือนราคาทอง', icon: 'bell',
        action: ui.button('ตั้งเตือน', { small: true, variant: 'soft', icon: 'plus', onClick: addAlertSheet }),
        body: alerts.length ? h('div', { class: 'list' }, alerts.map((a) => h('div', { class: 'li' },
          h('div', { class: 'avatar', style: { background: 'var(--butter-bg)', color: 'var(--butter-ink)' } }, ui.icon('bell')),
          h('div', { class: 'main' },
            h('div', { class: 'title' }, `ทองแท่ง${a.kind === 'GOLD_BELOW' ? 'ต่ำกว่า' : 'สูงกว่า'} ${fmt.thb(a.value)}`),
            h('div', { class: 'sub' }, a.note || (a.active === false || a.active === 'FALSE' ? 'ปิดอยู่' : 'เปิดอยู่'))),
          h('button', {
            class: 'icon-btn', 'aria-label': 'ลบการแจ้งเตือน',
            onClick: async () => {
              if (!(await ui.confirm('ลบการแจ้งเตือนนี้ใช่ไหม?', { okText: 'ลบ', danger: true }))) return;
              try { await store.deleteAlert(a.id); ui.toast('ลบแล้ว'); } catch (e) { ui.toast(e.message, 'down'); }
            },
          }, ui.icon('trash')))))
          : h('div', { class: 'faint center', style: { padding: '8px 0' } }, 'ยังไม่มีการเตือน ตั้งไว้ให้หนูออมแจ้งผ่าน LINE ได้นะ'),
      }));

      // เครื่องคิดเลข
      const bahtIn = ui.field({ label: 'บาททองคำ', type: 'number', value: calcBaht });
      const gramIn = ui.field({ label: 'กรัม', type: 'number', value: Math.round(calcBaht * GRAM_PER_BAHT * 1000) / 1000 });
      const out = h('dl', { class: 'kv' });
      const upd = () => {
        const b = Number(calcBaht) || 0;
        out.replaceChildren(
          h('dt', null, 'น้ำหนัก'), h('dd', null, `${fmt.num(b, 4)} บาท = ${fmt.num(b * GRAM_PER_BAHT, 3)} กรัม`),
          h('dt', null, 'ต้นทุนที่ราคาขายออกตอนนี้'), h('dd', null, g ? fmt.thb(b * g.barSell) : '–'),
          h('dt', null, 'มูลค่าที่ราคารับซื้อตอนนี้'), h('dd', null, g ? fmt.thb(b * g.barBuy) : '–'));
      };
      bahtIn.input.addEventListener('input', () => { calcBaht = bahtIn.get() === '' ? 0 : bahtIn.get(); gramIn.set(Math.round(calcBaht * GRAM_PER_BAHT * 1000) / 1000); upd(); });
      gramIn.input.addEventListener('input', () => { const gr = gramIn.get() === '' ? 0 : gramIn.get(); calcBaht = gr / GRAM_PER_BAHT; bahtIn.set(Math.round(calcBaht * 10000) / 10000); upd(); });
      upd();
      nodes.push(ui.card({
        title: 'เครื่องคิดเลขทอง', icon: 'calculator',
        body: h('div', null, h('div', { class: 'grid2' }, bahtIn.el, gramIn.el), out,
          h('div', { class: 'faint', style: { marginTop: '10px' } }, 'ทองรูปพรรณมีค่ากำเหน็จ (ค่าแรงทำทอง) บวกเพิ่ม และตอนขายคืนมักถูกหักออก จึงมักได้ราคาต่ำกว่าทองแท่ง ถ้าเก็บเพื่อออมควรเทียบราคาก่อนนะ')),
      }));
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
    async function fetchData() {
      try { data = await store.goldData(); error = null; } catch (e) { error = e; }
      draw();
    }
    draw();
    fetchData();
    const unsub = store.subscribe(() => {
      // อย่ารีวาดตอนผู้ใช้กำลังพิมพ์ในเครื่องคิดเลข
      if (root.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
      draw();
    });
    return () => { alive = false; unsub(); charts.forEach((c) => { try { c.destroy(); } catch (e) { /* ignore */ } }); };
  },
};
