// หนูออม — บันทึกการลงทุน + เช็กลิสต์ก่อนซื้อ (Builder E)
const EMOTIONS = ['มั่นใจ', 'กลัวตกรถ', 'ตื่นเต้น', 'กังวล', 'เฉยๆ'];
const EMO_TONE = { 'มั่นใจ': 'mint', 'กลัวตกรถ': 'peach', 'ตื่นเต้น': 'butter', 'กังวล': 'sky', 'เฉยๆ': 'gray' };
const ACTIONS = { BUY: { label: 'ซื้อ', tone: 'up' }, SELL: { label: 'ขาย', tone: 'down' }, THOUGHT: { label: 'ความคิด', tone: 'lavender' } };
const CHECKS = [
  { key: 'why', label: 'รู้ว่าซื้อเพราะอะไร' },
  { key: 'exit', label: 'มีแผนขาย/จุดตัดขาดทุนแล้ว' },
  { key: 'size', label: 'ไม่เกินสัดส่วนที่ตั้งไว้' },
  { key: 'news', label: 'ไม่ได้ซื้อตามข่าวลือหรือกลุ่มไลน์' },
  { key: 'emergency', label: 'มีเงินสำรองฉุกเฉินแล้ว' },
];
const REVIEW_RESULTS = ['เป็นไปตามแผน', 'ไม่เป็นตามแผน'];

const parseChecklist = (c) => {
  if (!c) return {};
  if (typeof c === 'object') return c;
  try { const o = JSON.parse(c); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; }
};
const plusDays = (fmt, n) => fmt.iso(new Date(Date.now() + n * 86400000));

// ---------- shared small widgets ----------
function emotionPicker(ui, value, onChange) {
  let cur = value || '';
  const wrap = ui.h('div', { class: 'row wrap', role: 'radiogroup', 'aria-label': 'อารมณ์ตอนนั้น' });
  const draw = () => {
    wrap.replaceChildren(...EMOTIONS.map((e) => ui.h('button', {
      type: 'button', role: 'radio', 'aria-checked': cur === e ? 'true' : 'false',
      class: `chip t-${EMO_TONE[e]} clickable`,
      style: { border: 0, font: 'inherit', fontSize: '14px', minHeight: '36px', padding: '4px 14px', boxShadow: cur === e ? '0 0 0 2px var(--accent)' : 'none', fontWeight: cur === e ? '700' : '400' },
      onClick: () => { cur = cur === e ? '' : e; draw(); onChange && onChange(cur); },
    }, e)));
  };
  draw();
  return { el: wrap, get: () => cur };
}

function starPicker(ui, value) {
  let cur = Number(value) || 3;
  const wrap = ui.h('div', { class: 'row', role: 'radiogroup', 'aria-label': 'ความมั่นใจ' });
  const draw = () => {
    wrap.replaceChildren(...[1, 2, 3, 4, 5].map((i) => ui.h('button', {
      type: 'button', 'aria-label': `${i} ดาว`, class: 'icon-btn',
      style: { border: 0, background: 'transparent', color: i <= cur ? 'var(--butter-ink)' : 'var(--gray)', fontSize: '26px' },
      onClick: () => { cur = i; draw(); },
    }, ui.icon('star'))));
    wrap.append(ui.h('span', { class: 'small muted' }, ['', 'ไม่ค่อยมั่นใจ', 'ค่อนข้างลังเล', 'ปานกลาง', 'ค่อนข้างมั่นใจ', 'มั่นใจมาก'][cur]));
  };
  draw();
  return { el: wrap, get: () => cur };
}

const stars = (ui, n) => ui.h('span', { style: { display: 'inline-flex', fontSize: '14px' }, 'aria-label': `ความมั่นใจ ${n} จาก 5` },
  [1, 2, 3, 4, 5].map((i) => { const s = ui.icon('star'); s.style.color = i <= n ? 'var(--butter-ink)' : 'var(--gray)'; return s; }));

const labelled = (ui, text, el) => ui.h('div', { class: 'field' }, ui.h('label', null, text), el);

// ---------- buy checklist (exported) ----------
export async function openBuyChecklist(ctx, draft) {
  const { store, ui, fmt } = ctx;
  const { h } = ui;
  draft = draft || {};
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const s = store.get();
    const st = s.settings || {};
    const checks = {};
    const note = h('div', { class: 'hidden' });
    const refresh = () => {
      const n = CHECKS.filter((c) => checks[c.key].get()).length;
      const risky = emo && emo.get() === 'กลัวตกรถ';
      if (n < 3 || risky) {
        note.className = '';
        note.replaceChildren(h('div', { style: { background: 'var(--peach-bg)', color: 'var(--peach-ink)', borderRadius: '12px', padding: '8px 12px', fontSize: '13.5px' } },
          risky ? 'หนูออมสังเกตว่าตอนนี้รู้สึกกลัวตกรถ ลองพักสักคืนแล้วค่อยกลับมาดูอีกทีก็ได้นะ ไม่ได้ห้ามนะ แค่ชวนใจเย็นๆ' : 'ติ๊กได้ไม่ถึง 3 ข้อ ลองเช็กอีกรอบไหม? ยังกดไปต่อได้ตามสบายนะ'));
      } else { note.className = 'hidden'; note.replaceChildren(); }
    };
    let emo = null;
    const rows = CHECKS.map((c) => {
      checks[c.key] = ui.field({ label: c.label, type: 'checkbox' });
      checks[c.key].input.addEventListener('change', refresh);
      return checks[c.key].el;
    });
    // size hint
    const fx = (draft.ccy && draft.ccy !== 'THB') ? ((s.fx && s.fx[draft.ccy]) || (s.fx && s.fx.USD) || 1) : 1;
    const add = (Number(draft.qty) || 0) * (Number(draft.price) || 0) * fx;
    const hs = (s.derived && s.derived.holdings) || [];
    const existing = (hs.find((x) => x.symbol === draft.symbol) || {}).valueTHB || 0;
    const total = ((s.derived && s.derived.totals && s.derived.totals.valueTHB) || 0) + add;
    const maxPct = Number(st.max_position_pct) || 0;
    let hint = null;
    if (add > 0 && total > 0) {
      const w = ((existing + add) / total) * 100;
      const over = maxPct > 0 && w > maxPct;
      hint = h('div', { class: 'small', style: { color: over ? 'var(--peach-ink)' : 'var(--ink-2)', marginTop: '-6px', marginBottom: '10px', paddingLeft: '32px' } },
        `หลังซื้อ ${fmt.sym(draft.symbol || '')} จะมีสัดส่วนประมาณ ${w.toFixed(1)}% ของพอร์ต` + (maxPct ? (over ? ` เกินเพดาน ${maxPct}% ที่ตั้งไว้` : ` (เพดาน ${maxPct}%)`) : ''));
      rows.splice(3, 0, hint);
    }
    const reason = ui.field({ label: 'เหตุผลสั้นๆ', type: 'textarea', placeholder: 'ซื้อเพราะอะไร?' });
    const exit = ui.field({ label: 'แผนขาย / จุดตัดขาดทุน', type: 'textarea', placeholder: 'เช่น ขายถ้าลง 10% หรือถือยาวรับปันผล' });
    emo = emotionPicker(ui, '', refresh);
    const conf = starPicker(ui, 3);

    const body = h('div', null,
      h('div', { class: 'row', style: { marginBottom: '10px' } }, ui.mascot('happy', 52),
        h('div', { class: 'speech grow' }, draft.symbol ? `ก่อนซื้อ ${fmt.sym(draft.symbol)} ตอบหนูออมสั้นๆ 5 ข้อนะ` : 'ตอบหนูออมสั้นๆ 5 ข้อนะ')),
      h('div', null, rows), note,
      reason.el, exit.el, labelled(ui, 'อารมณ์ตอนนี้', emo.el), labelled(ui, 'ความมั่นใจ', conf.el));

    ui.sheet({
      title: 'ก่อนซื้อ หนูออมขอถาม 5 ข้อ', body,
      onClose: () => finish(false),
      actions: [
        { text: 'ข้ามครั้งนี้', variant: 'ghost', onClick: () => { finish(true); } },
        {
          text: 'บันทึกแล้วไปต่อ', variant: 'primary', icon: 'check', onClick: async () => {
            const cl = {};
            CHECKS.forEach((c) => { cl[c.key] = !!checks[c.key].get(); });
            try {
              await store.upsertJournal({
                date: fmt.isoToday(), symbol: draft.symbol || '', action: 'BUY', reason: reason.get(), exit_plan: exit.get(),
                confidence: conf.get(), emotion: emo.get(), checklist: JSON.stringify(cl), review_date: plusDays(fmt, 90), review_note: '',
              });
            } catch (e) { ui.toast(e.message, 'down'); return false; }
            ui.toast('บันทึกลงสมุดแล้ว', 'up');
            finish(true);
          },
        },
      ],
    });
  });
}

export default {
  title: 'บันทึกการลงทุน',
  async render(root, params, ctx) {
    const { store, ui, fmt, chart } = ctx;
    const { h, icon } = ui;
    let filter = 'ALL';
    let monthChart = null;
    const killChart = () => { if (monthChart) { try { monthChart.destroy(); } catch (e) { /* ignore */ } monthChart = null; } };

    const isDue = (j) => j.review_date && String(j.review_date).slice(0, 10) <= fmt.isoToday() && !j.review_note;
    const find = (id) => (store.get().journal || []).find((j) => j.id === id);

    // ----- rules sheet -----
    const editRules = () => {
      const f = ui.field({ label: 'กฎการลงทุนของฉัน', type: 'textarea', value: store.get().settings.rules_text || '', placeholder: 'เช่น\n1. หุ้นตัวเดียวไม่เกิน 15%\n2. ไม่ซื้อตามข่าวลือ' });
      f.input.style.minHeight = '180px';
      ui.sheet({
        title: 'กฎของฉัน', body: f.el,
        actions: [{ text: 'ยกเลิก', variant: 'ghost' }, {
          text: 'บันทึก', variant: 'primary', onClick: async () => {
            try { await store.saveSettings({ rules_text: f.get() }); ui.toast('บันทึกแล้ว', 'up'); } catch (e) { ui.toast(e.message, 'down'); return false; }
          },
        }],
      });
    };

    // ----- review sheet -----
    const reviewSheet = (j) => {
      let result = '';
      const note = ui.field({ label: 'ตอนนี้เป็นอย่างไรบ้าง? เหตุผลเดิมยังจริงอยู่ไหม?', type: 'textarea', placeholder: 'เขียนสั้นๆ ก็พอ' });
      const chips = h('div', { class: 'row wrap' });
      const drawChips = () => chips.replaceChildren(...REVIEW_RESULTS.map((r) => h('button', {
        type: 'button', class: `chip t-${r === 'เป็นไปตามแผน' ? 'mint' : 'peach'} clickable`,
        style: { border: 0, font: 'inherit', minHeight: '36px', padding: '4px 14px', boxShadow: result === r ? '0 0 0 2px var(--accent)' : 'none' },
        onClick: () => { result = result === r ? '' : r; drawChips(); },
      }, r)));
      drawChips();
      ui.sheet({
        title: `ทบทวน ${fmt.sym(j.symbol) || 'บันทึก'}`,
        body: h('div', null,
          h('div', { class: 'small muted', style: { marginBottom: '8px' } }, `บันทึกเมื่อ ${fmt.date(j.date)}: ${j.reason || '(ไม่ได้เขียนเหตุผล)'}`),
          j.exit_plan ? h('div', { class: 'small muted', style: { marginBottom: '8px' } }, `แผนเดิม: ${j.exit_plan}`) : null,
          labelled(ui, 'ผลเป็นไปตามแผนไหม', chips), note.el),
        actions: [{ text: 'ไว้ทีหลัง', variant: 'ghost' }, {
          text: 'บันทึกการทบทวน', variant: 'primary', onClick: async () => {
            const txt = note.get().trim();
            if (!txt && !result) { note.error('เลือกผลหรือเขียนสั้นๆ สักหน่อยนะ'); return false; }
            try { await store.upsertJournal({ ...j, review_note: (result ? `[${result}] ` : '') + txt }); ui.toast('ทบทวนแล้ว เก่งมาก', 'up'); } catch (e) { ui.toast(e.message, 'down'); return false; }
          },
        }],
      });
    };

    // ----- add / edit sheet -----
    const entrySheet = (j) => {
      const isNew = !j;
      j = j || {};
      const date = ui.field({ label: 'วันที่', type: 'date', value: j.date || fmt.isoToday() });
      const sym = ui.field({ label: 'หุ้น / สินทรัพย์', value: j.symbol ? fmt.sym(j.symbol) : '', placeholder: 'เช่น PTT, KO, BTC (เว้นว่างได้ถ้าเป็นความคิดทั่วไป)' });
      const act = ui.field({ label: 'การกระทำ', type: 'select', value: j.action || 'BUY', options: [{ value: 'BUY', label: 'ซื้อ' }, { value: 'SELL', label: 'ขาย' }, { value: 'THOUGHT', label: 'แค่บันทึกความคิด' }] });
      const reason = ui.field({ label: 'เหตุผล', type: 'textarea', value: j.reason || '', placeholder: 'ทำไมถึงตัดสินใจแบบนี้?' });
      const exit = ui.field({ label: 'แผนขาย / จุดตัดขาดทุน', type: 'textarea', value: j.exit_plan || '' });
      const conf = starPicker(ui, j.confidence || 3);
      const emo = emotionPicker(ui, j.emotion || '');
      const rev = ui.field({ label: 'วันที่จะกลับมาทบทวน', type: 'date', value: j.review_date || plusDays(fmt, 90) });
      ui.sheet({
        title: isNew ? 'เพิ่มบันทึก' : 'แก้ไขบันทึก',
        body: h('div', null, date.el, sym.el, act.el, reason.el, exit.el, labelled(ui, 'ความมั่นใจ', conf.el), labelled(ui, 'อารมณ์ตอนนั้น', emo.el), rev.el),
        actions: [{ text: 'ยกเลิก', variant: 'ghost' }, {
          text: 'บันทึก', variant: 'primary', onClick: async () => {
            const raw = sym.get().trim();
            const action = act.get();
            if (!date.get()) { date.error('เลือกวันที่ก่อนนะ'); return false; }
            if (!raw && action !== 'THOUGHT') { sym.error('ใส่ชื่อหุ้นด้วยนะ'); return false; }
            if (!reason.get().trim() && !raw) { reason.error('เขียนเหตุผลหรือความคิดสักนิดนะ'); return false; }
            const symbol = raw ? fmt.normSym(raw, fmt.guessCls(raw)) : '';
            try {
              await store.upsertJournal({
                ...j, date: date.get(), symbol, action, reason: reason.get(), exit_plan: exit.get(), confidence: conf.get(), emotion: emo.get(),
                checklist: j.checklist || '', review_date: rev.get(), review_note: j.review_note || '',
              });
              ui.toast('บันทึกแล้ว', 'up');
            } catch (e) { ui.toast(e.message, 'down'); return false; }
          },
        }],
      });
    };

    // ----- detail sheet -----
    const detailSheet = (j) => {
      const cl = parseChecklist(j.checklist);
      const hasCl = Object.keys(cl).length > 0;
      const act = ACTIONS[j.action] || ACTIONS.THOUGHT;
      const kv = (label, val) => (val ? h('div', { style: { marginBottom: '10px' } }, h('div', { class: 'faint' }, label), h('div', { style: { whiteSpace: 'pre-wrap' } }, val)) : null);
      const m = ui.sheet({
        title: `${fmt.sym(j.symbol) || 'ความคิด'} · ${fmt.date(j.date)}`,
        body: h('div', null,
          h('div', { class: 'row wrap', style: { marginBottom: '10px' } }, ui.chip(act.label, act.tone), j.emotion ? ui.chip(j.emotion, EMO_TONE[j.emotion] || 'gray') : null, stars(ui, Number(j.confidence) || 0)),
          kv('เหตุผล', j.reason), kv('แผนขาย / จุดตัดขาดทุน', j.exit_plan),
          hasCl ? h('div', { style: { marginBottom: '10px' } }, h('div', { class: 'faint' }, 'เช็กลิสต์ก่อนซื้อ'),
            CHECKS.map((c) => h('div', { class: 'row small', style: { gap: '6px' } }, icon(cl[c.key] ? 'circle-check' : 'circle'), h('span', { class: cl[c.key] ? '' : 'faint' }, c.label)))) : null,
          kv('ทบทวนเมื่อ', j.review_date ? fmt.date(j.review_date) : ''), kv('ผลการทบทวน', j.review_note),
          isDue(j) ? ui.button('ทบทวนตอนนี้', { variant: 'soft', icon: 'refresh', onClick: () => { m.close(); reviewSheet(j); } }) : null),
        actions: [
          { text: 'ลบ', variant: 'danger', icon: 'trash', keepOpen: true, onClick: async () => {
            if (!(await ui.confirm('ลบบันทึกนี้ถาวร?', { okText: 'ลบ', danger: true }))) return false;
            try { await store.deleteJournal(j.id); ui.toast('ลบแล้ว'); m.close(); } catch (e) { ui.toast(e.message, 'down'); }
            return false;
          } },
          { text: 'แก้ไข', variant: 'primary', icon: 'pencil', onClick: () => { setTimeout(() => entrySheet(find(j.id) || j), 0); } },
        ],
      });
    };

    // ---------- page ----------
    const draw = () => {
      killChart();
      const s = store.get();
      const st = s.settings || {};
      const all = [...(s.journal || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)));
      const out = [];

      out.push(ui.card({
        title: 'กฎของฉัน', icon: 'list-check', tone: 'butter',
        action: ui.button('แก้ไข', { small: true, variant: 'soft', icon: 'pencil', onClick: editRules }),
        body: st.rules_text && st.rules_text.trim()
          ? h('div', { style: { whiteSpace: 'pre-wrap' } }, st.rules_text)
          : h('div', { class: 'muted' }, 'ยังไม่ได้เขียนกฎ ลองเขียนสัก 3 ข้อ เช่น เพดานต่อหุ้น วิธีตัดขาดทุน และสิ่งที่จะไม่ทำ'),
      }));

      const due = all.filter(isDue);
      if (due.length) {
        out.push(ui.card({
          tone: 'peach',
          body: h('div', { class: 'row' }, icon('bell-ringing'), h('div', { class: 'grow' }, h('b', null, `ถึงเวลาทบทวน ${due.length} รายการ`), h('div', { class: 'small' }, 'กลับมาดูว่าเหตุผลที่เขียนไว้ยังจริงอยู่ไหม')),
            ui.button('ทบทวน', { small: true, variant: 'primary', onClick: () => reviewSheet(due[0]) })),
        }));
      }

      const seg = ui.segment([{ value: 'ALL', label: 'ทั้งหมด' }, { value: 'BUY', label: 'ซื้อ' }, { value: 'SELL', label: 'ขาย' }, { value: 'THOUGHT', label: 'ความคิด' }], filter, (v) => { filter = v; draw(); });
      const rows = all.filter((j) => filter === 'ALL' || j.action === filter);
      out.push(ui.section('สมุดบันทึก', ui.button('เพิ่ม', { small: true, variant: 'primary', icon: 'plus', onClick: () => entrySheet() })));
      out.push(h('div', { style: { marginBottom: '10px' } }, seg));
      if (!all.length) {
        out.push(ui.empty({ mood: 'sleep', title: 'สมุดยังว่างอยู่', text: 'จดเหตุผลทุกครั้งที่ซื้อขาย อีกสามเดือนจะกลับมาอ่านแล้วได้เรียนรู้เยอะเลย', action: ui.button('เขียนบันทึกแรก', { variant: 'soft', icon: 'plus', onClick: () => entrySheet() }) }));
      } else if (!rows.length) {
        out.push(ui.empty({ mood: 'sleep', title: 'ไม่มีบันทึกในหมวดนี้' }));
      } else {
        out.push(ui.card({
          body: h('div', { class: 'list' }, rows.map((j) => {
            const act = ACTIONS[j.action] || ACTIONS.THOUGHT;
            return h('div', { class: 'li clickable', role: 'button', tabindex: '0', onClick: () => detailSheet(j), onKeydown: (e) => { if (e.key === 'Enter') detailSheet(j); }, style: { alignItems: 'flex-start' } },
              h('div', { class: 'grow', style: { minWidth: 0 } },
                h('div', { class: 'row wrap', style: { gap: '6px', marginBottom: '3px' } }, h('b', null, fmt.sym(j.symbol) || 'ความคิด'), ui.chip(act.label, act.tone), j.emotion ? ui.chip(j.emotion, EMO_TONE[j.emotion] || 'gray') : null, isDue(j) ? ui.chip('รอทบทวน', 'peach') : null),
                h('div', { class: 'row', style: { gap: '8px', marginBottom: '3px' } }, h('span', { class: 'faint' }, fmt.date(j.date)), stars(ui, Number(j.confidence) || 0)),
                j.reason ? h('div', { class: 'small muted' }, String(j.reason).length > 90 ? String(j.reason).slice(0, 90) + '…' : j.reason) : null),
              icon('chevron-right'));
          })),
        }));
      }

      // ----- stats -----
      if (all.length) {
        const counts = {};
        all.forEach((j) => { if (j.emotion) counts[j.emotion] = (counts[j.emotion] || 0) + 1; });
        const now = new Date();
        const months = [];
        for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push({ y: d.getFullYear(), m: d.getMonth(), n: 0 }); }
        all.forEach((j) => { const d = fmt.toDate(j.date); if (!d) return; const x = months.find((q) => q.y === d.getFullYear() && q.m === d.getMonth()); if (x) x.n += 1; });
        const buys = all.filter((j) => j.action === 'BUY');
        const fomo = buys.filter((j) => j.emotion === 'กลัวตกรถ').length;
        let insight = 'ยิ่งจดต่อเนื่อง ยิ่งเห็นนิสัยการลงทุนของตัวเองชัดขึ้น';
        if (fomo >= 2 && fomo / buys.length >= 0.25) insight = 'ช่วงหลังซื้อเพราะกลัวตกรถบ่อย ลองรอ 1 วันก่อนกดซื้อ';
        else if ((counts['กังวล'] || 0) >= 3) insight = 'บันทึกว่ากังวลหลายครั้ง ลองเช็กว่าสัดส่วนในพอร์ตสบายใจจริงไหม';
        const box = h('div', { class: 'chart-box short' });
        out.push(ui.card({
          title: 'สถิติของฉัน', icon: 'chart-bar',
          body: h('div', { class: 'stack' },
            Object.keys(counts).length ? h('div', { class: 'row wrap' }, Object.entries(counts).map(([e, n]) => ui.chip(`${e} ${n}`, EMO_TONE[e] || 'gray'))) : h('div', { class: 'muted small' }, 'ยังไม่ได้บันทึกอารมณ์'),
            h('div', { class: 'faint' }, 'จำนวนบันทึกต่อเดือน (6 เดือนล่าสุด)'), box,
            h('div', { class: 'row', style: { alignItems: 'flex-start' } }, ui.mascot('happy', 36), h('div', { class: 'speech grow small' }, insight))),
        }));
        setTimeout(() => {
          if (!box.isConnected) return;
          monthChart = chart(box, {
            type: 'bar',
            data: { labels: months.map((x) => fmt.month(x.m)), datasets: [{ data: months.map((x) => x.n), backgroundColor: chart.colors[0] }] },
            options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0, maxTicksLimit: 4 } }, x: { grid: { display: false } } } },
          });
        }, 0);
      }

      root.replaceChildren(h('div', null, out), ui.disclaimer());
    };

    draw();
    const unsub = store.subscribe(draw);
    return () => { unsub(); killChart(); };
  },
};
