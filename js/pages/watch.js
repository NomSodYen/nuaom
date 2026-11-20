// หนูออม — จับตา & แจ้งเตือน (owner: Builder C)
const KIND_TH = {
  PRICE_BELOW: 'ราคาต่ำกว่า', PRICE_ABOVE: 'ราคาสูงกว่า', YIELD_ABOVE: 'อัตราปันผลสูงกว่า',
  CHANGE_PCT: 'ขยับแรงเกิน', GOLD_BELOW: 'ทองแท่งต่ำกว่า', GOLD_ABOVE: 'ทองแท่งสูงกว่า',
};
const isOn = (a) => !(a.active === false || a.active === 'FALSE' || a.active === 'false' || a.active === 0 || a.active === '');
const has = (v) => v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v));

export default {
  title: 'จับตา & แจ้งเตือน',
  async render(root, params, ctx) {
    const { store, ui, fmt, calc, nav } = ctx;
    const { h } = ui;
    let alive = true;
    let screenerRows = [];
    const tried = new Set();

    function alertText(a) {
      const v = Number(a.value);
      if (a.kind === 'CHANGE_PCT') return `ขยับแรงเกิน ±${v}% ในวันเดียว`;
      if (a.kind === 'YIELD_ABOVE') return `อัตราปันผลสูงกว่า ${v}%`;
      if (a.kind === 'GOLD_BELOW' || a.kind === 'GOLD_ABOVE') return `${KIND_TH[a.kind]} ${fmt.thb(v)}`;
      return `${KIND_TH[a.kind] || a.kind} ${fmt.num(v, 2)}`;
    }

    // ---------- ฟอร์มจับตา ----------
    function watchSheet(w) {
      const editing = !!w;
      let cls = w ? w.cls : 'TH';
      const sym = ui.field({ label: 'ชื่อย่อ', placeholder: 'เช่น KBANK, KO, BTC', value: w ? (w.cls === 'TH' ? fmt.sym(w.symbol) : w.symbol) : '' });
      if (editing) sym.input.disabled = true;
      sym.input.setAttribute('autocapitalize', 'characters');
      const note = ui.field({ label: 'โน้ต', value: w ? w.note || '' : '', placeholder: 'เช่น รอปันผลเกิน 6%' });
      const minY = ui.field({ label: 'เกณฑ์ปันผลขั้นต่ำ (%)', type: 'number', value: w ? w.min_yield : '' });
      const maxPe = ui.field({ label: 'P/E ไม่เกิน', type: 'number', value: w ? w.max_pe : '' });
      const below = ui.field({ label: 'ราคาต่ำกว่า', type: 'number', value: w ? w.price_below : '' });
      const above = ui.field({ label: 'ราคาสูงกว่า', type: 'number', value: w ? w.price_above : '' });
      const seg = editing ? null : ui.segment([{ value: 'TH', label: 'หุ้นไทย' }, { value: 'US', label: 'หุ้นอเมริกา' }, { value: 'CRYPTO', label: 'คริปโต' }], cls, (v) => { cls = v; });
      ui.sheet({
        title: editing ? `แก้ไข ${fmt.sym(w.symbol)}` : 'เพิ่มหุ้นที่จับตา',
        body: h('div', { class: 'form' }, seg ? h('div', { style: { marginBottom: '12px' } }, seg) : null, sym.el, note.el,
          h('div', { class: 'faint', style: { marginBottom: '8px' } }, 'ใส่เฉพาะเกณฑ์ที่อยากให้หนูออมจับตา เว้นว่างได้'),
          h('div', { class: 'grid2' }, minY.el, maxPe.el, below.el, above.el)),
        actions: [{
          text: 'บันทึก', variant: 'primary', icon: 'check',
          onClick: async () => {
            const symbol = editing ? w.symbol : fmt.normSym(sym.get(), cls);
            if (!symbol) { sym.error('กรอกชื่อย่อด้วยนะ'); return false; }
            const q = store.get().quotes[symbol];
            const row = {
              ...(w || {}), symbol, cls, name: (w && w.name) || (q && q.name) || '', note: note.get().trim(),
              min_yield: has(minY.get()) ? Number(minY.get()) : '', max_pe: has(maxPe.get()) ? Number(maxPe.get()) : '',
              price_below: has(below.get()) ? Number(below.get()) : '', price_above: has(above.get()) ? Number(above.get()) : '',
            };
            try { await store.upsertWatch(row); } catch (e) { ui.toast(e.message, 'down'); return false; }
            ui.toast('บันทึกแล้ว', 'up');
            return undefined;
          },
        }],
      });
    }

    function watchActions(w) {
      const m = ui.sheet({
        title: fmt.sym(w.symbol),
        body: h('div', { class: 'col' },
          ui.button('ดูข้อมูลหุ้น', { icon: 'chart-line', variant: 'soft', block: true, onClick: () => { m.close(); nav('stock/' + encodeURIComponent(w.symbol)); } }),
          ui.button('แก้ไขเกณฑ์', { icon: 'edit', variant: 'soft', block: true, onClick: () => { m.close(); watchSheet(w); } }),
          ui.button('เอาออกจากรายการ', { icon: 'trash', variant: 'danger', block: true, onClick: async () => {
            if (!(await ui.confirm(`เอา ${fmt.sym(w.symbol)} ออกจากรายการจับตาใช่ไหม?`, { okText: 'เอาออก', danger: true }))) return;
            try { await store.deleteWatch(w.symbol); m.close(); ui.toast('เอาออกแล้ว'); } catch (e) { ui.toast(e.message, 'down'); }
          } })),
      });
    }

    // ---------- ฟอร์มแจ้งเตือน ----------
    function alertSheet() {
      let cls = 'TH';
      const sym = ui.field({ label: 'ชื่อย่อ', placeholder: 'เช่น PTT, KO, BTC' });
      sym.input.setAttribute('autocapitalize', 'characters');
      const kind = ui.field({ label: 'เตือนเมื่อ', type: 'select', options: [] });
      const val = ui.field({ label: 'ค่าที่ตั้ง', type: 'number' });
      const note = ui.field({ label: 'โน้ตกันลืม (ไม่ใส่ก็ได้)' });
      const opts = () => {
        const list = cls === 'GOLD'
          ? [['GOLD_BELOW', 'ทองแท่งราคาต่ำกว่า (บาท)'], ['GOLD_ABOVE', 'ทองแท่งราคาสูงกว่า (บาท)']]
          : [['PRICE_BELOW', 'ราคาต่ำกว่า'], ['PRICE_ABOVE', 'ราคาสูงกว่า'],
            ...(cls === 'TH' || cls === 'US' ? [['YIELD_ABOVE', 'อัตราปันผลสูงกว่า (%)']] : []),
            ['CHANGE_PCT', 'ขยับแรงเกิน ± (%) ในวันเดียว']];
        kind.input.replaceChildren(...list.map(([v, l]) => h('option', { value: v }, l)));
        sym.el.classList.toggle('hidden', cls === 'GOLD');
      };
      opts();
      const seg = ui.segment([{ value: 'TH', label: 'หุ้นไทย' }, { value: 'US', label: 'หุ้นอเมริกา' }, { value: 'CRYPTO', label: 'คริปโต' }, { value: 'GOLD', label: 'ทองคำ' }], cls, (v) => { cls = v; opts(); });
      ui.sheet({
        title: 'ตั้งการแจ้งเตือน',
        body: h('div', { class: 'form' }, h('div', { style: { marginBottom: '12px' } }, seg), sym.el, kind.el, val.el, note.el),
        actions: [{
          text: 'บันทึก', variant: 'primary', icon: 'bell-plus',
          onClick: async () => {
            const symbol = cls === 'GOLD' ? 'GOLD965' : fmt.normSym(sym.get(), cls);
            if (!symbol) { sym.error('กรอกชื่อย่อด้วยนะ'); return false; }
            if (!(Number(val.get()) > 0)) { val.error('กรอกตัวเลขที่มากกว่า 0'); return false; }
            try { await store.upsertAlert({ symbol, cls, kind: kind.get(), value: Number(val.get()), active: true, note: note.get().trim() }); } catch (e) { ui.toast(e.message, 'down'); return false; }
            ui.toast('ตั้งเตือนแล้ว', 'up');
            return undefined;
          },
        }],
      });
    }

    function ruleChips(w, hitRules) {
      const chips = [];
      const add = (rule, text) => chips.push(ui.chip(hitRules.has(rule) ? [ui.icon('check'), text] : text, hitRules.has(rule) ? 'up' : ''));
      if (has(w.min_yield)) add('min_yield', `ปันผล ≥ ${w.min_yield}%`);
      if (has(w.max_pe)) add('max_pe', `P/E ≤ ${w.max_pe}`);
      if (has(w.price_below)) add('price_below', `ราคา < ${w.price_below}`);
      if (has(w.price_above)) add('price_above', `ราคา > ${w.price_above}`);
      return chips;
    }

    function build() {
      const s = store.get();
      const nodes = [];
      if (!s.lineReady) {
        nodes.push(ui.card({
          tone: 'butter', title: 'ยังไม่ได้เชื่อม LINE', icon: 'brand-line',
          body: h('div', null, h('p', { class: 'small' }, 'ยังไม่ได้เชื่อม LINE แจ้งเตือนจะยังไม่ส่ง'),
            ui.button('ไปตั้งค่า', { small: true, variant: 'soft', icon: 'settings', onClick: () => nav('settings') })),
        }));
      }

      // หุ้นที่จับตา
      let hits = [];
      try { hits = calc.screen.ruleHits(s.watch, s.quotes, screenerRows); } catch (e) { hits = []; }
      nodes.push(ui.section('หุ้นที่จับตา', ui.button('เพิ่ม', { small: true, variant: 'soft', icon: 'plus', onClick: () => watchSheet(null) })));
      if (!s.watch.length) {
        nodes.push(ui.card({ body: ui.empty({ mood: 'sleep', title: 'ยังไม่มีหุ้นที่จับตา', text: 'เพิ่มหุ้นที่สนใจพร้อมเกณฑ์ของคุณเอง หนูออมจะบอกเมื่อเข้าเกณฑ์', action: ui.button('เพิ่มหุ้นที่จับตา', { variant: 'primary', icon: 'plus', onClick: () => watchSheet(null) }) }) }));
      } else {
        for (const w of s.watch) {
          const q = s.quotes[w.symbol];
          const my = hits.filter((x) => x.symbol === w.symbol);
          const hitRules = new Set(my.map((x) => x.rule));
          const li = ui.listItem({
            avatar: fmt.sym(w.symbol), avatarTone: fmt.clsTone(w.cls),
            title: fmt.sym(w.symbol), sub: w.note || (q && q.name) || w.name || fmt.clsName(w.cls),
            right: q ? fmt.money(q.price, q.ccy, 2) : tried.has(w.symbol) ? 'ไม่มีราคา' : '…',
            rightSub: q ? fmt.pct(q.changePct, { sign: true, dec: 2 }) : '', rightTone: q ? fmt.tone(q.changePct) : '',
            onClick: () => nav('stock/' + encodeURIComponent(w.symbol)),
          });
          const chips = ruleChips(w, hitRules);
          nodes.push(ui.card({
            body: h('div', null,
              h('div', { class: 'row' }, h('div', { class: 'grow' }, li),
                h('button', { class: 'icon-btn', 'aria-label': 'ตัวเลือก', onClick: () => watchActions(w) }, ui.icon('dots'))),
              chips.length ? h('div', { class: 'row wrap', style: { gap: '6px', marginTop: '6px' } }, chips) : null,
              my.map((x) => h('div', { class: 'small up', style: { marginTop: '6px' } }, '✓ ' + x.detail))),
          }));
        }
        nodes.push(h('div', { class: 'faint', style: { margin: '6px 2px' } }, 'เครื่องหมายถูก = เข้าเกณฑ์ที่คุณตั้งไว้ ไม่ได้แปลว่าควรซื้อหรือขาย'));
      }

      // แจ้งเตือน
      nodes.push(ui.section('การแจ้งเตือน (ส่งเข้า LINE)', ui.button('ตั้งเตือน', { small: true, variant: 'soft', icon: 'plus', onClick: alertSheet })));
      if (!s.alerts.length) {
        nodes.push(ui.card({ body: ui.empty({ mood: 'sleep', title: 'ยังไม่มีการแจ้งเตือน', text: 'ตั้งเตือนราคา ปันผล หรือการขยับแรง หนูออมจะส่งเข้า LINE ให้', action: ui.button('ตั้งเตือนแรก', { variant: 'primary', icon: 'bell-plus', onClick: alertSheet }) }) }));
      } else {
        nodes.push(ui.card({
          body: h('div', { class: 'list' }, s.alerts.map((a) => {
            const gold = a.cls === 'GOLD' || a.symbol === 'GOLD965';
            const cb = h('input', {
              type: 'checkbox', checked: isOn(a), 'aria-label': 'เปิดปิดการแจ้งเตือน',
              style: { width: '24px', height: '24px', accentColor: 'var(--accent)' },
              onChange: async (e) => {
                try { await store.upsertAlert({ ...a, active: e.target.checked }); } catch (er) { ui.toast(er.message, 'down'); e.target.checked = !e.target.checked; }
              },
            });
            return h('div', { class: 'li' },
              h('div', { class: 'avatar', style: { background: `var(--${gold ? 'butter' : fmt.clsTone(a.cls)}-bg)`, color: `var(--${gold ? 'butter' : fmt.clsTone(a.cls)}-ink)` } }, gold ? ui.icon('coin') : fmt.sym(a.symbol).slice(0, 6)),
              h('div', { class: 'main' }, h('div', { class: 'title' }, gold ? 'ทองคำแท่ง' : fmt.sym(a.symbol)),
                h('div', { class: 'sub', style: { whiteSpace: 'normal' } }, alertText(a) + (a.note ? ` · ${a.note}` : ''))),
              h('label', { style: { display: 'flex', alignItems: 'center', minWidth: '44px', minHeight: '44px', justifyContent: 'center' } }, cb),
              h('button', {
                class: 'icon-btn', 'aria-label': 'ลบการแจ้งเตือน',
                onClick: async () => {
                  if (!(await ui.confirm('ลบการแจ้งเตือนนี้ใช่ไหม?', { okText: 'ลบ', danger: true }))) return;
                  try { await store.deleteAlert(a.id); ui.toast('ลบแล้ว'); } catch (e) { ui.toast(e.message, 'down'); }
                },
              }, ui.icon('trash')));
          })),
        }));
      }
      nodes.push(ui.disclaimer());
      return nodes;
    }

    const draw = () => { if (alive) root.replaceChildren(...build()); };
    draw();
    const unsub = store.subscribe(draw);

    // ราคาที่ยังไม่มี + ข้อมูลสแกนหุ้น
    (async () => {
      const missing = store.get().watch.filter((w) => !store.get().quotes[w.symbol] && !tried.has(w.symbol));
      await Promise.all(missing.map(async (w) => { tried.add(w.symbol); try { await store.quote(w.symbol, w.cls); } catch (e) { /* ignore */ } }));
      if (missing.length && alive) draw();
    })();
    store.screener().then((r) => { if (alive) { screenerRows = (r && r.rows) || []; draw(); } }).catch(() => {});
    return () => { alive = false; unsub(); };
  },
};
