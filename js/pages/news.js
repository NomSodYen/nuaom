// หนูออม — ข่าวจากทีมหนูออม (Builder E)
const KIND = {
  DAILY: { label: 'ข่าวเช้า', long: 'ข่าวเช้า', tone: 'butter' },
  WEEKLY: { label: 'สรุปสัปดาห์', long: 'สรุปสัปดาห์', tone: 'lavender' },
};
const MOOD = { calm: 'happy', good: 'excited', worried: 'worried' };
const IMPACT = {
  up: { icon: 'trending-up', color: 'var(--up)', bg: 'var(--up-bg)' },
  down: { icon: 'trending-down', color: 'var(--down)', bg: 'var(--down-bg)' },
  neutral: { icon: 'minus', color: 'var(--ink-3)', bg: 'var(--gray-bg)' },
};
const HEAT = ['', 'เงียบ', 'เริ่มมีคนพูดถึง', 'กำลังมาแรง', 'ร้อนแรง', 'ร้อนมาก คนแห่เยอะ ระวังซื้อแพง'];

function parseBody(b) {
  if (!b) return {};
  if (typeof b === 'object') return b;
  try { const o = JSON.parse(b); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; }
}
const arr = (x) => (Array.isArray(x) ? x.filter((i) => i !== null && i !== undefined) : []);
const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '')) ? String(u) : null);

export default {
  title: (params) => (params && params[0] ? 'อ่านข่าว' : 'ข่าวจากทีม HOON'),
  async render(root, params, ctx) {
    const { store, ui, fmt, nav } = ctx;
    const { h, icon } = ui;
    let filter = 'ALL';

    const link = (url, text) => {
      const u = safeUrl(url);
      return u ? h('a', { href: u, target: '_blank', rel: 'noopener', class: 'small' }, icon('external-link'), ' ', text || 'ที่มา') : null;
    };
    const symNav = (sym) => {
      const s = String(sym || '');
      if (/^GOLD/i.test(s)) return nav('gold');
      return nav('stock/' + encodeURIComponent(s));
    };
    const symChip = (sym) => h('button', {
      type: 'button', class: 'chip t-sky clickable', style: { border: 0, font: 'inherit', fontSize: '12.5px', minHeight: '30px' },
      onClick: () => symNav(sym),
    }, fmt.sym(sym));
    const kindChip = (k) => { const m = KIND[k]; return ui.chip(m ? m.long : (k || 'ข่าว'), m ? m.tone : 'gray'); };

    // ---------- list ----------
    const drawList = () => {
      const all = [...(store.get().news || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.created || '').localeCompare(String(a.created || '')));
      const rows = all.filter((n) => filter === 'ALL' || n.kind === filter);
      const seg = ui.segment([{ value: 'ALL', label: 'ทั้งหมด' }, { value: 'DAILY', label: 'ข่าวเช้า' }, { value: 'WEEKLY', label: 'สรุปสัปดาห์' }], filter, (v) => { filter = v; drawList(); });
      let body;
      if (!all.length) {
        body = ui.empty({ mood: 'sleep', title: 'ยังไม่มีข่าวจากทีม HOON', text: 'สั่งทีมข่าวได้ทุกเมื่อผ่าน Claude แล้วสรุปจะมาขึ้นที่นี่' });
      } else if (!rows.length) {
        body = ui.empty({ mood: 'sleep', title: 'ไม่มีข่าวในหมวดนี้', text: 'ลองเลือกหมวด "ทั้งหมด" ดูนะ' });
      } else {
        body = h('div', { class: 'stack' }, rows.map((n) => h('div', {
          class: 'card', role: 'button', tabindex: '0', style: { cursor: 'pointer' },
          onClick: () => nav('news/' + encodeURIComponent(n.id)),
          onKeydown: (e) => { if (e.key === 'Enter') nav('news/' + encodeURIComponent(n.id)); },
        },
        h('div', { class: 'row between', style: { marginBottom: '6px' } }, kindChip(n.kind), h('span', { class: 'faint' }, fmt.date(n.date))),
        h('h3', { style: { marginBottom: '4px' } }, n.title || 'ข่าว'),
        n.summary ? h('div', { class: 'muted small' }, n.summary) : null,
        h('div', { class: 'row', style: { marginTop: '8px', color: 'var(--pink-ink)', fontSize: '13px' } }, 'อ่านต่อ', icon('chevron-right')))));
      }
      root.replaceChildren(h('div', { style: { marginBottom: '12px' } }, seg), body, ui.disclaimer());
    };

    // ---------- detail ----------
    const itemRow = (it) => {
      const im = IMPACT[it.impact] || IMPACT.neutral;
      const av = h('div', { style: { width: '32px', height: '32px', borderRadius: '11px', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: im.bg, color: im.color, fontSize: '18px' } }, icon(im.icon));
      return h('div', { class: 'row', style: { alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px dashed var(--line)' } }, av,
        h('div', { class: 'grow' }, h('div', null, it.text || ''), it.source || it.url ? h('div', { style: { marginTop: '2px' } }, link(it.url, it.source || 'ที่มา')) : null));
    };

    const flames = (heat) => {
      const n = Math.max(1, Math.min(5, Math.round(Number(heat) || 1)));
      return h('span', { style: { display: 'inline-flex', gap: '1px', fontSize: '18px' }, 'aria-label': `ความร้อน ${n} จาก 5` },
        [1, 2, 3, 4, 5].map((i) => {
          const f = icon('flame');
          f.style.color = i <= n ? (n >= 4 ? 'var(--down)' : 'var(--peach-ink)') : 'var(--gray)';
          f.style.opacity = i <= n ? '1' : '.5';
          return f;
        }));
    };

    const drawDetail = () => {
      const n = (store.get().news || []).find((x) => String(x.id) === String(params[0]));
      if (!n) {
        root.replaceChildren(ui.empty({ mood: 'worried', title: 'หาข่าวนี้ไม่เจอ', text: 'ข่าวอาจเก่าเกินไปหรือถูกลบแล้ว', action: ui.button('กลับไปรายการข่าว', { variant: 'soft', onClick: () => nav('news') }) }));
        return;
      }
      const b = parseBody(n.body);
      const out = [];
      out.push(ui.card({
        tone: b.mood === 'worried' ? 'peach' : b.mood === 'good' ? 'mint' : 'pink',
        body: h('div', null,
          h('div', { class: 'row between', style: { marginBottom: '8px' } }, kindChip(n.kind), h('span', { class: 'faint' }, fmt.dateLong(n.date))),
          h('div', { class: 'row' }, ui.mascot(MOOD[b.mood] || 'happy', 56),
            h('div', { class: 'grow' }, h('h3', null, b.headline || n.title || 'ข่าว'), n.title && b.headline ? h('div', { class: 'small muted' }, n.title) : null))),
      }));

      for (const sec of arr(b.sections)) {
        const items = arr(sec.items);
        if (!items.length) continue;
        out.push(ui.card({ title: sec.title || 'ข่าว', icon: 'news', body: h('div', null, items.map(itemRow)) }));
      }

      const hits = arr(b.rule_hits);
      if (hits.length) {
        out.push(ui.card({
          title: 'เข้าเกณฑ์ที่คุณตั้งไว้', icon: 'list-check', tone: 'mint',
          body: h('div', { class: 'stack' }, hits.map((r) => h('div', null,
            h('div', { class: 'row wrap' }, symChip(r.symbol)), h('div', { class: 'small', style: { marginTop: '4px' } }, r.detail || '')))),
        }));
      }

      const cal = arr(b.calendar);
      if (cal.length) {
        out.push(ui.card({
          title: 'ปฏิทินที่ควรจับตา', icon: 'calendar-event',
          body: ui.list(cal.map((c) => ({ icon: 'calendar', avatarTone: 'sky', title: c.event || '', sub: fmt.dateLong(c.date) }))),
        }));
      }

      if (b.critic) {
        out.push(ui.card({ title: 'มุมฝ่ายค้าน', icon: 'message-question', tone: 'lavender', body: h('div', null, b.critic) }));
      }

      const themes = arr(b.themes);
      if (themes.length) {
        out.push(ui.section('เรดาร์ธีม'));
        for (const t of themes) {
          const heat = Math.max(1, Math.min(5, Math.round(Number(t.heat) || 1)));
          const bull = arr(t.bull), bear = arr(t.bear), ev = arr(t.evidence), rel = arr(t.related);
          const box = (bg, title, items) => h('div', { style: { background: bg, borderRadius: '12px', padding: '10px' } },
            h('b', { class: 'small' }, title), h('ul', { class: 'small', style: { margin: '4px 0 0', paddingLeft: '18px' } }, items.map((x) => h('li', null, x))));
          out.push(ui.card({
            title: t.name || 'ธีม', icon: 'radar',
            body: h('div', { class: 'stack' },
              h('div', { class: 'row wrap' }, flames(heat), h('span', { class: 'small', style: { color: 'var(--peach-ink)', fontWeight: '600' } }, `${heat}/5 ${HEAT[heat]}`)),
              ev.length ? h('div', null, ev.map((e) => h('div', { class: 'small', style: { marginBottom: '2px' } }, '• ', e.text || '', ' ', link(e.url, 'ที่มา')))) : null,
              bull.length || bear.length ? h('div', { class: 'grid2' }, box('var(--up-bg)', 'ข้อดี', bull), box('var(--down-bg)', 'ข้อเสีย', bear)) : null,
              rel.length ? h('div', { class: 'row wrap' }, h('span', { class: 'faint' }, 'เกี่ยวข้อง:'), rel.map(symChip)) : null),
          }));
        }
      }

      const xd = arr(b.upcoming_xd);
      if (xd.length) {
        out.push(ui.card({
          title: 'ใกล้ขึ้นเครื่องหมาย XD', icon: 'coin',
          body: h('div', { class: 'scroll-x' }, h('table', { class: 'table' },
            h('thead', null, h('tr', null, h('th', null, 'หุ้น'), h('th', null, 'XD'), h('th', { class: 'r' }, 'ปันผล'), h('th', null, 'วันจ่าย'), h('th', null, 'สถานะ'))),
            h('tbody', null, xd.map((r) => h('tr', null,
              h('td', null, h('b', null, fmt.sym(r.symbol))), h('td', null, fmt.date(r.xd)), h('td', { class: 'r' }, fmt.ok(r.amount) ? fmt.num(r.amount, 2) : '–'),
              h('td', null, r.pay ? fmt.date(r.pay) : '–'), h('td', null, ui.chip(r.confirmed ? 'ยืนยันแล้ว' : 'คาดการณ์', r.confirmed ? 'mint' : 'gray'))))))),
        }));
      }

      const dis = h('div', { class: 'disclaimer' }, icon('info-circle'), b.disclaimer || 'ข้อมูลเพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน');
      root.replaceChildren(h('div', null, out), dis);
    };

    const draw = () => (params && params[0] ? drawDetail() : drawList());
    draw();
    const unsub = store.subscribe(draw);
    return () => unsub();
  },
};
