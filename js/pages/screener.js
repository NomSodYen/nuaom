// หนูออม — คัดกรองหุ้น (Builder D)
const PRESETS = [
  { label: 'ปันผลสม่ำเสมอ', f: { minYears: 10, maxPayout: 80 } },
  { label: 'ปันผลสูง', f: { minYield: 5 } },
  { label: 'งบแข็งแรง', f: { minROE: 12, maxDE: 1 } },
  { label: 'ราคาไม่แพง', f: { maxPE: 12 } },
];
const LABELS = {
  minYield: (v) => `ปันผล ≥ ${v}%`, maxPE: (v) => `P/E ≤ ${v}`, minROE: (v) => `ROE ≥ ${v}%`,
  maxDE: (v) => `D/E ≤ ${v}`, minYears: (v) => `จ่าย ≥ ${v} ปี`, maxPayout: (v) => `Payout ≤ ${v}%`,
  text: (v) => `ค้นหา "${v}"`,
};
const SORTS = [
  { value: 'score', label: 'คะแนนคุณภาพปันผล' },
  { value: 'yield', label: 'อัตราปันผล' },
  { value: 'pe', label: 'P/E ต่ำ→สูง' },
  { value: 'roe', label: 'ROE' },
];

export default {
  title: 'คัดกรองหุ้น',
  async render(root, params, ctx) {
    const { store, ui, fmt, calc, nav } = ctx;
    const { h } = ui;
    let dead = false;
    let data = null;
    let f = {};
    let sort = 'score';
    const body = h('div');
    root.append(body);
    body.append(ui.skeleton(5));

    const load = async () => {
      body.replaceChildren(ui.skeleton(5));
      try { data = await store.screener(); } catch (e) {
        if (dead) return;
        body.replaceChildren(ui.errorBox(e, load), ui.disclaimer());
        return;
      }
      if (dead) return;
      draw();
    };

    const num = (v) => (v === '' || v == null ? null : Number(v));
    const clsLabel = (c) => (c === 'TH' ? 'หุ้นไทย' : c === 'US' ? 'หุ้นอเมริกา' : 'ทั้งหมด');

    const openFilters = () => {
      let cls = f.cls || 'ALL';
      const fields = {
        text: ui.field({ label: 'ค้นหาชื่อ/ชื่อย่อ', value: f.text ?? '', placeholder: 'เช่น PTT, ธนาคาร' }),
        minYield: ui.field({ label: 'ปันผลขั้นต่ำ (%)', type: 'number', value: f.minYield ?? '' }),
        maxPE: ui.field({ label: 'P/E ไม่เกิน', type: 'number', value: f.maxPE ?? '' }),
        minROE: ui.field({ label: 'ROE ขั้นต่ำ (%)', type: 'number', value: f.minROE ?? '' }),
        maxDE: ui.field({ label: 'D/E ไม่เกิน (เท่า)', type: 'number', value: f.maxDE ?? '' }),
        minYears: ui.field({ label: 'จ่ายต่อเนื่องอย่างน้อย (ปี)', type: 'number', value: f.minYears ?? '' }),
        maxPayout: ui.field({ label: 'Payout ไม่เกิน (%)', type: 'number', value: f.maxPayout ?? '' }),
      };
      ui.sheet({
        title: 'ตัวกรอง',
        body: h('div', null,
          h('div', { style: { marginBottom: '12px' } }, ui.segment([{ value: 'ALL', label: 'ทั้งหมด' }, { value: 'TH', label: 'หุ้นไทย' }, { value: 'US', label: 'หุ้นอเมริกา' }], cls, (v) => { cls = v; })),
          fields.text.el,
          h('div', { class: 'grid2' }, fields.minYield.el, fields.maxPE.el, fields.minROE.el, fields.maxDE.el, fields.minYears.el, fields.maxPayout.el)),
        actions: [
          { text: 'ล้างทั้งหมด', variant: 'ghost', onClick: () => { f = {}; draw(); } },
          {
            text: 'ใช้ตัวกรอง', variant: 'primary',
            onClick: () => {
              const nf = { cls: cls === 'ALL' ? undefined : cls };
              const t = fields.text.get().trim();
              if (t) nf.text = t;
              for (const k of ['minYield', 'maxPE', 'minROE', 'maxDE', 'minYears', 'maxPayout']) {
                const v = num(fields[k].get());
                if (v !== null && Number.isFinite(v)) nf[k] = v;
              }
              f = nf; draw();
            },
          },
        ],
      });
    };

    const addWatch = async (r) => {
      try { await store.upsertWatch({ symbol: r.symbol, cls: r.cls, name: r.name }); ui.toast('เพิ่มในรายการจับตาแล้ว', 'up'); } catch (e) { ui.toast(e.message, 'down'); }
    };

    const draw = () => {
      const rows = (data && data.rows) || [];
      if (!rows.length) {
        body.replaceChildren(ui.empty({ mood: 'sleep', title: 'ยังไม่มีข้อมูลให้คัดกรอง', text: 'ระบบจะรวบรวมข้อมูลหุ้นทุกคืนช่วง 01:00–06:00 พรุ่งนี้เช้ากลับมาดูนะ' }), ui.disclaimer());
        return;
      }
      const watched = new Set(store.get().watch.map((w) => w.symbol));
      let res = calc.screen.filter(rows, f).map((r) => ({ ...r, _score: calc.screen.divScore(r) }));
      const key = { score: (r) => -r._score, yield: (r) => -(r.div_yield ?? -1), roe: (r) => -(r.roe ?? -1e9), pe: (r) => (r.pe > 0 ? r.pe : 1e9) }[sort];
      res.sort((a, b) => key(a) - key(b));

      const chips = [];
      if (f.cls) chips.push(['cls', clsLabel(f.cls)]);
      for (const k of Object.keys(LABELS)) if (f[k] !== undefined && f[k] !== '') chips.push([k, LABELS[k](f[k])]);

      const activePreset = (p) => Object.entries(p.f).every(([k, v]) => f[k] === v);
      const presetRow = h('div', { class: 'scroll-x' }, h('div', { class: 'row', style: { width: 'max-content', paddingBottom: '4px' } },
        PRESETS.map((p) => h('span', {
          class: `chip clickable${activePreset(p) ? ' t-pink' : ''}`, role: 'button', tabindex: '0', style: { minHeight: '36px', padding: '4px 14px' },
          onClick: () => { f = { ...f, ...p.f }; draw(); },
        }, p.label)),
        h('span', { class: 'chip clickable', role: 'button', tabindex: '0', style: { minHeight: '36px', padding: '4px 14px' }, onClick: () => { f = {}; draw(); } }, 'ล้างตัวกรอง')));

      const sortSel = h('select', { 'aria-label': 'เรียงตาม', style: { minHeight: '40px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--card-2)', padding: '0 10px', maxWidth: '100%' },
        onChange: (e) => { sort = e.target.value; draw(); } },
        SORTS.map((s) => h('option', { value: s.value, selected: s.value === sort }, 'เรียง: ' + s.label)));

      const list = res.length
        ? ui.list(res.map((r) => {
          const star = h('button', {
            class: 'icon-btn', 'aria-label': 'เพิ่มในรายการจับตา', style: { width: '36px', height: '36px', flex: 'none' },
            onClick: (e) => { e.stopPropagation(); if (!watched.has(r.symbol)) addWatch(r); },
          }, ui.icon(watched.has(r.symbol) ? 'star-filled' : 'star'));
          const stats = `P/E ${fmt.num(r.pe, 1)} · ROE ${r.roe == null ? '–' : fmt.pct(r.roe, { dec: 0 })} · ${r.div_years ?? '–'} ปี`;
          const el = ui.listItem({
            avatar: fmt.sym(r.symbol), avatarTone: fmt.clsTone(r.cls), title: r.name,
            sub: `${fmt.sym(r.symbol)} · ${r.sector || ''}`,
            right: r.div_yield == null ? '–' : fmt.pct(r.div_yield, { dec: 1 }),
            rightSub: `คะแนน ${r._score}`, onClick: () => nav('stock/' + encodeURIComponent(r.symbol)),
          });
          const main = el.querySelector('.main');
          main.append(h('div', { class: 'sub num', style: { marginTop: '2px' } }, stats));
          el.append(star);
          return el;
        }))
        : ui.empty({ mood: 'worried', title: 'ไม่มีหุ้นที่เข้าเกณฑ์', text: 'ลองผ่อนเกณฑ์ลงหรือล้างตัวกรอง', action: ui.button('ล้างตัวกรอง', { variant: 'soft', onClick: () => { f = {}; draw(); } }) });

      body.replaceChildren(
        h('div', { class: 'faint', style: { margin: '0 2px 8px' } }, data.updated ? 'อัปเดต ' + fmt.rel(data.updated) : ''),
        presetRow,
        h('div', { class: 'row wrap', style: { margin: '10px 0' } },
          ui.button('ตัวกรอง', { variant: 'soft', small: true, icon: 'adjustments-horizontal', onClick: openFilters }),
          h('div', { class: 'grow' }), sortSel),
        chips.length ? h('div', { class: 'row wrap', style: { marginBottom: '10px' } }, chips.map(([k, t]) => h('span', {
          class: 'chip t-sky clickable', role: 'button', tabindex: '0', style: { minHeight: '32px', padding: '4px 12px' },
          onClick: () => { const nf = { ...f }; delete nf[k]; f = nf; draw(); },
        }, t + ' ', ui.icon('x')))) : h('span'),
        h('div', { class: 'muted small', style: { margin: '0 2px 6px' } }, `พบ ${res.length} จาก ${rows.length} ตัว`),
        ui.card({ body: list }),
        ui.card({
          title: 'คะแนนคุณภาพปันผล', icon: 'award', sub: '(คิดจากสูตร ไม่ใช่คำแนะนำ)', tone: 'lavender',
          body: h('div', { class: 'muted small' },
            h('p', null, 'คะแนน 0–100 ถ่วงน้ำหนักจาก อัตราปันผล (30) สัดส่วนจ่ายปันผล (20) จำนวนปีที่จ่ายต่อเนื่อง (20) การเติบโตของปันผล ROE และ D/E (อย่างละ 10)'),
            h('p', { style: { margin: 0 } }, 'ปันผลสูงผิดปกติจะได้คะแนนลดลง เพราะอาจเป็นสัญญาณเตือน ข้อมูลที่ไม่มีนับเป็น 0 คะแนน')),
        }),
        ui.disclaimer());
    };

    load();
    return () => { dead = true; };
  },
};
