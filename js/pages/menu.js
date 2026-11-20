// หนูออม — หน้าเมนู (Builder E)
export default {
  title: 'เครื่องมือทั้งหมด',
  async render(root, params, ctx) {
    const { store, ui, fmt, nav } = ctx;
    const { h, icon } = ui;

    const TILES = [
      { path: 'gold', icon: 'coins', label: 'ทองคำ', tone: 'butter' },
      { path: 'watch', icon: 'eye', label: 'จับตา & แจ้งเตือน', tone: 'sky', badge: 'alerts' },
      { path: 'screener', icon: 'filter', label: 'คัดกรองหุ้น', tone: 'mint' },
      { path: 'valuation', icon: 'scale', label: 'ประเมินมูลค่า', tone: 'lavender' },
      { path: 'tools', icon: 'calculator', label: 'เครื่องคิดเลข', tone: 'peach' },
      { path: 'risk', icon: 'shield-check', label: 'ความเสี่ยงพอร์ต', tone: 'pink' },
      { path: 'journal', icon: 'notebook', label: 'บันทึกการลงทุน', tone: 'butter', badge: 'journal' },
      { path: 'learn', icon: 'school', label: 'ห้องเรียน', tone: 'mint' },
      { path: 'news', icon: 'news', label: 'ข่าว', tone: 'sky' },
      { path: 'portfolio/tx', icon: 'list-details', label: 'รายการทั้งหมด', tone: 'lavender' },
      { path: 'dividends', icon: 'cash', label: 'ปันผล', tone: 'pink' },
      { path: 'settings', icon: 'settings', label: 'ตั้งค่า', tone: 'gray' },
    ];

    const badges = (s) => {
      const today = fmt.isoToday();
      const due = (s.journal || []).filter((j) => j.review_date && String(j.review_date).slice(0, 10) <= today && !j.review_note).length;
      const alerts = (s.alerts || []).filter((a) => a.active === true || a.active === 'TRUE' || a.active === 'true' || a.active === 1).length;
      return { journal: due, alerts };
    };

    const draw = () => {
      const s = store.get();
      const b = badges(s);
      const name = s.settings && s.settings.display_name ? s.settings.display_name : 'นักออม';
      const tiles = TILES.map((t) => {
        const n = t.badge ? b[t.badge] : 0;
        const ic = icon(t.icon);
        ic.style.background = `var(--${t.tone}-bg)`;
        ic.style.color = `var(--${t.tone}-ink)`;
        return h('button', {
          type: 'button', class: 'menu-tile', style: { position: 'relative', font: 'inherit', color: 'inherit' },
          'aria-label': t.label, onClick: () => nav(t.path),
        }, ic, h('span', null, t.label),
        n ? h('span', { class: 'chip t-down', style: { position: 'absolute', top: '6px', right: '6px', padding: '0 7px', fontSize: '12px' } }, String(n)) : null);
      });
      root.replaceChildren(
        h('div', { class: 'row', style: { margin: '4px 0 14px' } },
          ui.mascot('happy', 56),
          h('div', { class: 'speech grow' }, `${fmt.greeting()} ${name} จะให้หนูออมช่วยอะไรดี?`)),
        h('div', { class: 'menu-grid' }, tiles),
        ui.disclaimer());
    };
    draw();
    const unsub = store.subscribe(draw);
    return () => unsub();
  },
};
