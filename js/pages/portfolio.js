// หนูออม — พอร์ตของฉัน + ฟอร์มบันทึกรายการ (owner: Builder C)
const TYPES = [
  { value: 'BUY', label: 'ซื้อ' }, { value: 'SELL', label: 'ขาย' }, { value: 'DIV', label: 'ปันผล' },
  { value: 'DEPOSIT', label: 'ฝากเงินสด' }, { value: 'WITHDRAW', label: 'ถอนเงินสด' }, { value: 'SPLIT', label: 'แตกพาร์' },
];
const TYPE_TH = Object.fromEntries(TYPES.map((t) => [t.value, t.label]));
const TYPE_TONE = { BUY: 'mint', SELL: 'pink', DIV: 'butter', DEPOSIT: 'sky', WITHDRAW: 'gray', SPLIT: 'lavender' };
const CLS_OPTS = [
  { value: 'TH', label: 'หุ้นไทย' }, { value: 'US', label: 'หุ้นอเมริกา' }, { value: 'CRYPTO', label: 'คริปโต' },
  { value: 'GOLD', label: 'ทองคำ' }, { value: 'OTHER', label: 'อื่นๆ' },
];
const CSV_COLS = ['date', 'type', 'cls', 'symbol', 'qty', 'price', 'ccy', 'fee', 'tax', 'fx', 'bucket', 'note'];
const isNum = (v) => v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v));

function qtyText(fmt, h) {
  const dec = h.cls === 'CRYPTO' ? 8 : 4;
  const s = Number(h.qty).toLocaleString('th-TH', { maximumFractionDigits: dec });
  const unit = h.cls === 'GOLD' ? 'บาท' : h.cls === 'CRYPTO' ? 'หน่วย' : h.cls === 'CASH' ? '' : 'หุ้น';
  return `${s} ${unit}`.trim();
}
const holdingTitle = (h) => (h.cls === 'GOLD' ? 'ทองคำแท่ง 96.5%' : h.cls === 'CASH' ? h.name : h.cls === 'TH' ? h.symbol.replace(/\.BK$/i, '') : h.symbol);

// ---------- ฟอร์มบันทึก/แก้ไขรายการ ----------
export async function openTxSheet(ctx, preset = {}) {
  const { store, ui, fmt } = ctx;
  const { h } = ui;
  const editing = !!preset.id;
  const st = store.get();
  const wht = { TH: 10, US: 15, ...(st.settings.wht || {}) };
  const initType = preset.type || 'BUY';
  const cashInit = initType === 'DEPOSIT' || initType === 'WITHDRAW';
  const initCls = preset.cls && preset.cls !== 'CASH' ? preset.cls : 'TH';

  const fType = ui.field({ label: 'ประเภท', type: 'select', options: TYPES, value: initType });
  const fCls = ui.field({ label: 'สินทรัพย์', type: 'select', options: CLS_OPTS, value: initCls });
  const fSym = ui.field({ label: 'ชื่อย่อ', placeholder: 'เช่น PTT, KO, BTC', value: preset.symbol && initCls === 'TH' ? fmt.sym(preset.symbol) : (cashInit || initCls === 'GOLD' ? '' : preset.symbol || '') });
  const fDate = ui.field({ label: 'วันที่', type: 'date', value: preset.date ? String(preset.date).slice(0, 10) : fmt.isoToday() });
  const fQty = ui.field({ label: 'จำนวน', type: 'number', value: preset.qty ?? '' });
  const fPrice = ui.field({ label: 'ราคาต่อหน่วย', type: 'number', value: preset.price ?? '' });
  const fCcy = ui.field({ label: 'สกุลเงิน', type: 'select', options: [{ value: 'THB', label: 'บาท (THB)' }, { value: 'USD', label: 'ดอลลาร์ (USD)' }], value: preset.ccy || (initCls === 'US' ? 'USD' : 'THB') });
  const fFee = ui.field({ label: 'ค่าธรรมเนียม', type: 'number', value: preset.fee ?? '', placeholder: '0' });
  const fTax = ui.field({ label: 'ภาษีหัก ณ ที่จ่าย', type: 'number', value: preset.tax ?? '', placeholder: '0' });
  const fFx = ui.field({ label: 'อัตราแลกเปลี่ยน (บาทต่อ 1 ดอลลาร์)', type: 'number', value: preset.fx && Number(preset.fx) !== 1 ? preset.fx : '' });
  const fBucket = ui.field({ label: 'ระยะเวลาถือ', type: 'select', options: [{ value: 'LONG', label: 'ถือยาว' }, { value: 'SHORT', label: 'ถือสั้น' }], value: preset.bucket || 'LONG' });
  const fNote = ui.field({ label: 'หมายเหตุ', type: 'textarea', value: preset.note || '' });
  fNote.input.style.minHeight = '64px';
  fSym.input.setAttribute('autocapitalize', 'characters');
  fSym.input.setAttribute('autocomplete', 'off');

  let taxTouched = editing && preset.tax !== undefined && preset.tax !== '';
  fTax.input.addEventListener('input', () => { taxTouched = true; });

  const heldQty = () => {
    const cls = fCls.get();
    const sym = cls === 'GOLD' ? 'GOLD965' : fmt.normSym(fSym.get(), cls);
    const hh = store.get().derived.holdings.find((x) => x.key === `${cls}:${sym}`);
    return hh ? hh.qty : 0;
  };
  const setLabel = (f, text) => { const l = f.el.querySelector('label'); if (l) l.textContent = text; };

  const updateTax = () => {
    if (fType.get() !== 'DIV' || taxTouched) return;
    const gross = Number(fQty.get()) * Number(fPrice.get());
    const rate = Number(wht[fCls.get()] || 0);
    if (gross > 0) fTax.set(Math.round(gross * rate) / 100);
  };

  const refresh = () => {
    const type = fType.get(), cls = fCls.get();
    const cash = type === 'DEPOSIT' || type === 'WITHDRAW';
    const show = (f, on) => f.el.classList.toggle('hidden', !on);
    show(fCls, !cash);
    show(fSym, !cash && cls !== 'GOLD');
    show(fPrice, !cash && type !== 'SPLIT');
    show(fCcy, type !== 'SPLIT' && (cash || cls !== 'GOLD'));
    show(fFee, type === 'BUY' || type === 'SELL');
    show(fTax, type === 'DIV');
    show(fFx, type !== 'SPLIT' && fCcy.get() !== 'THB' && (cash || cls !== 'GOLD'));
    show(fBucket, type === 'BUY' || type === 'SELL');
    setLabel(fPrice, type === 'DIV' ? 'ปันผลต่อหุ้น' : 'ราคาต่อหน่วย');
    setLabel(fQty, cash ? 'จำนวนเงิน' : type === 'SPLIT' ? 'อัตราส่วน (เช่น 2 = แตก 1 เป็น 2)'
      : type === 'DIV' ? 'จำนวนหุ้นที่ถือตอนรับปันผล'
        : cls === 'GOLD' ? 'จำนวนทอง (บาททองคำ)' : cls === 'CRYPTO' ? 'จำนวน (หน่วย)' : 'จำนวนหุ้น');
    setLabel(fFee, 'ค่าธรรมเนียม' + (fCcy.get() === 'USD' ? ' (ดอลลาร์)' : ' (บาท)'));
    if (fFx.get() === '' && fCcy.get() === 'USD' && st.fx && st.fx.USD) fFx.set(st.fx.USD);
    updateTax();
  };
  fType.input.addEventListener('change', () => {
    if (fType.get() === 'DEPOSIT' || fType.get() === 'WITHDRAW') { /* สกุลเงินเลือกเอง */ }
    refresh();
  });
  fCls.input.addEventListener('change', () => {
    if (fCls.get() !== 'CASH') fCcy.set(fCls.get() === 'US' ? 'USD' : 'THB');
    refresh();
  });
  fCcy.input.addEventListener('change', refresh);
  const prefillQty = () => {
    const t = fType.get();
    if ((t === 'DIV' || t === 'SELL') && fQty.get() === '') { const q = heldQty(); if (q > 0) { fQty.set(q); updateTax(); } }
  };
  fSym.input.addEventListener('change', prefillQty);
  fType.input.addEventListener('change', prefillQty);
  fQty.input.addEventListener('input', updateTax);
  fPrice.input.addEventListener('input', updateTax);

  const all = [fType, fCls, fSym, fDate, fQty, fPrice, fCcy, fFee, fTax, fFx, fBucket, fNote];
  refresh();

  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };

    async function save() {
      all.forEach((f) => f.error && f.error(''));
      const type = fType.get();
      const cash = type === 'DEPOSIT' || type === 'WITHDRAW';
      const cls = cash ? 'CASH' : fCls.get();
      const symbol = cash ? 'CASH' : cls === 'GOLD' ? 'GOLD965' : fmt.normSym(fSym.get(), cls);
      const qty = fQty.get(), price = fPrice.get();
      if (!cash && cls !== 'GOLD' && !symbol) { fSym.error('กรอกชื่อย่อด้วยนะ'); return false; }
      if (!fDate.get()) { fDate.error('เลือกวันที่ด้วยนะ'); return false; }
      if (!(Number(qty) > 0)) { fQty.error('ต้องมากกว่า 0'); return false; }
      if (!cash && type !== 'SPLIT' && (price === '' || !(Number(price) >= 0))) { fPrice.error('กรอกราคา (ตั้งแต่ 0 ขึ้นไป)'); return false; }
      if (type === 'SELL') {
        let held = heldQty();
        if (editing && preset.type === 'SELL' && preset.symbol === symbol) held += Number(preset.qty) || 0;
        if (Number(qty) > held + 1e-9) { fQty.error(`ขายเกินที่ถืออยู่ (ถือ ${Number(held).toLocaleString('th-TH', { maximumFractionDigits: 8 })})`); return false; }
      }
      const ccy = type === 'SPLIT' ? (cls === 'US' ? 'USD' : 'THB') : (cls === 'GOLD' ? 'THB' : fCcy.get());
      const fxv = ccy === 'THB' ? 1 : (fFx.get() === '' ? (st.fx && st.fx.USD) || '' : fFx.get());
      const row = {
        date: fDate.get(), type, cls, symbol, qty: Number(qty),
        price: cash ? 1 : type === 'SPLIT' ? '' : Number(price),
        ccy, fee: type === 'BUY' || type === 'SELL' ? Number(fFee.get() || 0) : 0,
        tax: type === 'DIV' ? Number(fTax.get() || 0) : 0, fx: fxv,
        bucket: type === 'BUY' || type === 'SELL' ? fBucket.get() : (preset.bucket || 'LONG'), note: fNote.get().trim(),
      };
      if (type === 'BUY' && !editing && store.get().settings.checklist_on_buy !== false) {
        let mod = null;
        try { mod = await import('./journal.js'); } catch (e) { mod = null; }
        if (mod && typeof mod.openBuyChecklist === 'function') {
          let go = true;
          try { go = await mod.openBuyChecklist(ctx, { symbol, cls, qty: row.qty, price: row.price, ccy }); } catch (e) { console.warn(e); go = true; }
          if (!go) return false;
        }
      }
      let saved;
      try {
        saved = editing ? await store.updateTx({ ...preset, ...row, id: preset.id }) : await store.addTx(row);
      } catch (e) { ui.toast(e.message, 'down'); return false; }
      ui.toast('บันทึกแล้ว', 'up');
      finish(saved || row);
      return undefined;
    }

    const actions = [];
    if (editing) {
      actions.push({
        text: 'ลบรายการ', variant: 'danger', icon: 'trash',
        onClick: async () => {
          const ok = await ui.confirm('ลบรายการนี้ใช่ไหม? ลบแล้วกู้คืนไม่ได้นะ', { okText: 'ลบเลย', danger: true });
          if (!ok) return false;
          try { await store.deleteTx(preset.id); } catch (e) { ui.toast(e.message, 'down'); return false; }
          ui.toast('ลบแล้ว');
          return undefined;
        },
      });
    }
    actions.push({ text: 'บันทึก', variant: 'primary', icon: 'check', onClick: save });
    ui.sheet({
      title: editing ? 'แก้ไขรายการ' : 'บันทึกรายการ',
      body: h('div', { class: 'form' }, all.map((f) => f.el)),
      actions,
      onClose: () => finish(null),
    });
  });
}

// ---------- CSV ----------
function parseCsv(text) {
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (ch !== '\r') cur += ch;
  }
  row.push(cur); rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}
const csvCell = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

function csvToTx(fmt, text) {
  const rows = parseCsv(text.replace(/^﻿/, ''));
  const out = [], errors = [];
  if (!rows.length) return { out, errors, total: 0 };
  let cols = CSV_COLS, start = 0;
  const head = rows[0].map((c) => c.trim().toLowerCase());
  if (head.includes('date') && head.includes('type')) { cols = head; start = 1; }
  const T = Object.keys(TYPE_TH), C = ['TH', 'US', 'CRYPTO', 'GOLD', 'CASH', 'OTHER'];
  for (let i = start; i < rows.length; i++) {
    const o = {};
    cols.forEach((c, j) => { o[c] = (rows[i][j] ?? '').trim(); });
    const line = i + 1;
    const err = (m) => errors.push(`แถว ${line}: ${m}`);
    const type = o.type.toUpperCase();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(o.date)) { err('วันที่ต้องเป็นแบบ ปปปป-ดด-วว เช่น 2026-11-20'); continue; }
    if (!T.includes(type)) { err(`ประเภท "${o.type}" ไม่ถูกต้อง (ใช้ BUY, SELL, DIV, DEPOSIT, WITHDRAW, SPLIT)`); continue; }
    const cash = type === 'DEPOSIT' || type === 'WITHDRAW';
    const cls = cash ? 'CASH' : o.cls.toUpperCase();
    if (!C.includes(cls)) { err(`สินทรัพย์ "${o.cls}" ไม่ถูกต้อง (ใช้ TH, US, CRYPTO, GOLD, CASH, OTHER)`); continue; }
    const symbol = cash ? 'CASH' : fmt.normSym(o.symbol, cls);
    if (!symbol) { err('ไม่มีชื่อย่อ'); continue; }
    if (!isNum(o.qty) || Number(o.qty) <= 0) { err('จำนวนต้องเป็นตัวเลขที่มากกว่า 0'); continue; }
    if (!cash && type !== 'SPLIT' && (!isNum(o.price) || Number(o.price) < 0)) { err('ราคาต้องเป็นตัวเลข'); continue; }
    const ccy = (o.ccy || (cls === 'US' ? 'USD' : 'THB')).toUpperCase();
    out.push({
      date: o.date, type, cls, symbol, qty: Number(o.qty), price: cash ? 1 : type === 'SPLIT' ? '' : Number(o.price), ccy,
      fee: isNum(o.fee) ? Number(o.fee) : 0, tax: isNum(o.tax) ? Number(o.tax) : 0,
      fx: isNum(o.fx) ? Number(o.fx) : ccy === 'THB' ? 1 : '', bucket: o.bucket.toUpperCase() === 'SHORT' ? 'SHORT' : 'LONG', note: o.note,
    });
  }
  return { out, errors, total: rows.length - start };
}

function openImportSheet(ctx) {
  const { store, ui, fmt } = ctx;
  const { h } = ui;
  const ta = ui.field({ label: 'วางข้อมูล CSV ที่นี่', type: 'textarea', placeholder: 'date,type,cls,symbol,qty,price,ccy,fee,tax,fx,bucket,note\n2026-11-20,BUY,TH,PTT,100,34.5,THB,0,0,1,LONG,' });
  ta.input.style.minHeight = '120px';
  ta.input.style.fontSize = '13px';
  const preview = h('div', { class: 'stack' });
  let parsed = { out: [], errors: [], total: 0 };
  const update = () => {
    parsed = csvToTx(fmt, ta.get());
    const kids = [];
    if (parsed.total) {
      kids.push(h('div', { class: 'row wrap' }, ui.chip(`พบ ${parsed.total} แถว`, 'sky'), ui.chip(`ใช้ได้ ${parsed.out.length}`, 'up'),
        parsed.errors.length ? ui.chip(`มีปัญหา ${parsed.errors.length}`, 'down') : null));
      parsed.out.slice(0, 5).forEach((r) => kids.push(h('div', { class: 'small muted' },
        `${fmt.date(r.date)} · ${TYPE_TH[r.type]} · ${fmt.sym(r.symbol)} · ${r.qty}${r.price !== '' ? ' × ' + r.price : ''}`)));
      if (parsed.out.length > 5) kids.push(h('div', { class: 'faint' }, `…และอีก ${parsed.out.length - 5} แถว`));
      parsed.errors.slice(0, 6).forEach((e) => kids.push(h('div', { class: 'small down' }, e)));
    }
    preview.replaceChildren(...kids);
  };
  ta.input.addEventListener('input', update);
  ui.sheet({
    title: 'นำเข้า CSV',
    body: h('div', null,
      h('p', { class: 'small muted' }, 'หัวตาราง: date,type,cls,symbol,qty,price,ccy,fee,tax,fx,bucket,note (วันที่แบบ ปปปป-ดด-วว ค.ศ.)'),
      ta.el, preview),
    actions: [{
      text: 'นำเข้า', variant: 'primary', icon: 'upload',
      onClick: async () => {
        if (!parsed.out.length) { ui.toast('ยังไม่มีแถวที่นำเข้าได้', 'down'); return false; }
        try { await store.addTxMany(parsed.out); } catch (e) { ui.toast(e.message, 'down'); return false; }
        ui.toast(`นำเข้า ${parsed.out.length} รายการแล้ว`, 'up');
        return undefined;
      },
    }],
  });
}

function exportCsv(ctx) {
  const { store, ui } = ctx;
  const rows = [CSV_COLS.join(',')];
  store.get().tx.forEach((t) => rows.push(CSV_COLS.map((c) => csvCell(t[c])).join(',')));
  const blob = new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'nuaom-transactions.csv';
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  ui.toast('ส่งออกแล้ว', 'up');
}

// ---------- รายละเอียดสินทรัพย์ ----------
function openHolding(ctx, hd) {
  const { store, ui, fmt, nav } = ctx;
  const { h } = ui;
  const txs = store.get().tx.filter((t) => t.cls === hd.cls && t.symbol === hd.symbol)
    .sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8);
  const kv = h('dl', { class: 'kv' },
    h('dt', null, 'จำนวน'), h('dd', null, qtyText(fmt, hd)),
    h('dt', null, 'ทุนเฉลี่ย'), h('dd', null, fmt.money(hd.avgCost, hd.ccy, 2)),
    h('dt', null, 'ราคาปัจจุบัน'), h('dd', null, hd.priceMissing ? 'ไม่มีราคา' : fmt.money(hd.price, hd.ccy, 2)),
    h('dt', null, 'มูลค่า'), h('dd', null, fmt.thb(hd.valueTHB)),
    h('dt', null, 'ต้นทุนรวม'), h('dd', null, fmt.thb(hd.costTHB)),
    h('dt', null, 'กำไร/ขาดทุน'), h('dd', { class: fmt.tone(hd.unrealizedTHB) }, `${fmt.thb(hd.unrealizedTHB, { sign: true })} (${fmt.pct(hd.unrealizedPct, { sign: true })})`),
    h('dt', null, 'กำไรที่ขายแล้ว'), h('dd', { class: fmt.tone(hd.realizedTHB) }, fmt.thb(hd.realizedTHB, { sign: true })),
    h('dt', null, 'ปันผลสุทธิรวม'), h('dd', null, fmt.thb(hd.divNetTHB)),
    h('dt', null, 'สัดส่วนในพอร์ต'), h('dd', null, fmt.pct(hd.weight)));
  const list = txs.length
    ? h('div', { class: 'list' }, txs.map((t) => ui.listItem({
      icon: t.type === 'BUY' ? 'arrow-down-left' : t.type === 'SELL' ? 'arrow-up-right' : t.type === 'DIV' ? 'coin' : 'refresh',
      title: [TYPE_TH[t.type] || t.type, ' ', ui.chip(fmt.date(t.date), TYPE_TONE[t.type] || '')],
      sub: `${Number(t.qty).toLocaleString('th-TH', { maximumFractionDigits: 8 })} × ${t.price === '' ? '–' : fmt.money(t.price, t.ccy, 2)}`,
      onClick: () => { openTxSheet(ctx, t); },
    })))
    : h('div', { class: 'faint' }, 'ยังไม่มีรายการ');
  const preset = { cls: hd.cls, symbol: hd.symbol, price: hd.priceMissing ? '' : hd.price, ccy: hd.ccy, bucket: hd.bucket };
  const actions = [
    { text: 'ซื้อเพิ่ม', variant: 'primary', icon: 'plus', onClick: () => { openTxSheet(ctx, { ...preset, type: 'BUY' }); } },
  ];
  if (hd.cls !== 'CASH') {
    actions.push({ text: 'ขาย', variant: 'soft', icon: 'minus', onClick: () => { openTxSheet(ctx, { ...preset, type: 'SELL' }); } });
    actions.push({ text: 'บันทึกปันผล', variant: 'soft', icon: 'coin', onClick: () => { openTxSheet(ctx, { ...preset, type: 'DIV', qty: hd.qty, price: '' }); } });
  }
  if (['TH', 'US', 'CRYPTO'].includes(hd.cls)) {
    actions.push({ text: 'ดูข้อมูลหุ้น', variant: 'ghost', icon: 'chart-line', onClick: () => { nav('stock/' + encodeURIComponent(hd.symbol)); } });
  }
  if (hd.cls === 'CASH') { actions.length = 0; actions.push({ text: 'ฝากเงินสด', variant: 'primary', onClick: () => { openTxSheet(ctx, { type: 'DEPOSIT', ccy: hd.ccy }); } }); }
  ui.sheet({
    title: holdingTitle(hd),
    body: h('div', null, kv, h('div', { class: 'divider' }), h('h4', { style: { marginBottom: '4px' } }, 'รายการของสินทรัพย์นี้'), list),
    actions,
  });
}

// ---------- หน้า ----------
export default {
  title: 'พอร์ตของฉัน',
  async render(root, params, ctx) {
    const { store, ui, fmt, calc, nav } = ctx;
    const { h } = ui;
    const mode = params[0] === 'tx' ? 'tx' : 'main';
    let clsF = 'ALL', bucketF = 'ALL';
    let alive = true;

    const fab = () => h('button', { class: 'fab', 'aria-label': 'บันทึกรายการ', onClick: () => openTxSheet(ctx) }, ui.icon('plus'));

    function summary(s) {
      const t = s.derived.totals;
      let xirrTxt = '–';
      try {
        const r = calc.portfolio.xirr(calc.portfolio.portfolioFlows(s.tx, s.fx, t));
        if (r !== null && r !== undefined && Number.isFinite(r)) xirrTxt = fmt.pct(r * 100, { sign: true });
      } catch (e) { /* ignore */ }
      return ui.metrics([
        { label: 'มูลค่ารวม', value: fmt.thb(t.valueTHB), icon: 'wallet' },
        { label: 'ต้นทุนรวม', value: fmt.thb(t.costTHB), icon: 'receipt' },
        { label: 'กำไร/ขาดทุนยังไม่ขาย', value: fmt.thb(t.unrealizedTHB, { sign: true }), sub: fmt.pct(t.unrealizedPct, { sign: true }), tone: fmt.tone(t.unrealizedTHB) },
        { label: 'กำไรที่ขายแล้ว', value: fmt.thb(t.realizedTHB, { sign: true }), tone: fmt.tone(t.realizedTHB) },
        { label: 'ปันผลสุทธิรวม', value: fmt.thb(t.divNetTHB), icon: 'coin' },
        { label: 'ผลตอบแทนต่อปี', value: xirrTxt, sub: 'แบบ XIRR', tone: xirrTxt === '–' ? '' : xirrTxt.startsWith('−') ? 'down' : 'up' },
      ]);
    }

    function holdingRow(hd) {
      const gold = hd.cls === 'GOLD', cash = hd.cls === 'CASH';
      return ui.listItem({
        icon: gold ? 'coin' : cash ? 'cash' : null, avatar: fmt.sym(hd.symbol), avatarTone: fmt.clsTone(hd.cls),
        title: [holdingTitle(hd), hd.priceMissing ? [' ', ui.chip('ไม่มีราคา', 'peach')] : null],
        sub: cash ? fmt.money(hd.qty, hd.ccy, 2) : `${qtyText(fmt, hd)} · ทุนเฉลี่ย ${fmt.money(hd.avgCost, hd.ccy, 2)}`,
        right: fmt.thb(hd.valueTHB),
        rightSub: cash ? '' : fmt.pct(hd.unrealizedPct, { sign: true }), rightTone: fmt.tone(hd.unrealizedTHB),
        onClick: () => openHolding(ctx, hd),
      });
    }

    function drawMain() {
      const s = store.get();
      const nodes = [];
      if (!s.tx.length) {
        nodes.push(ui.empty({
          mood: 'sleep', title: 'ยังไม่มีสินทรัพย์ในพอร์ต', text: 'กดปุ่มด้านล่างเพื่อบันทึกหุ้นตัวแรก หนูออมจะช่วยคำนวณต้นทุนและกำไรให้',
          action: h('div', { class: 'btn-row', style: { justifyContent: 'center' } },
            ui.button('บันทึกรายการ', { variant: 'primary', icon: 'plus', onClick: () => openTxSheet(ctx) }),
            ui.button('นำเข้า CSV', { variant: 'soft', icon: 'upload', onClick: () => openImportSheet(ctx) })),
        }));
        nodes.push(fab());
        root.replaceChildren(...nodes);
        return;
      }
      nodes.push(summary(s));
      const clsOpts = [{ value: 'ALL', label: 'ทั้งหมด' }, { value: 'TH', label: 'หุ้นไทย' }, { value: 'US', label: 'หุ้นอเมริกา' },
        { value: 'CRYPTO', label: 'คริปโต' }, { value: 'GOLD', label: 'ทอง' }, { value: 'CASH', label: 'เงินสด' }];
      const bOpts = [{ value: 'ALL', label: 'ทุกระยะ' }, { value: 'LONG', label: 'ถือยาว' }, { value: 'SHORT', label: 'ถือสั้น' }];
      nodes.push(h('div', { style: { margin: '14px 0 8px', display: 'flex', flexDirection: 'column', gap: '8px' } },
        ui.segment(clsOpts, clsF, (v) => { clsF = v; drawMain(); }),
        ui.segment(bOpts, bucketF, (v) => { bucketF = v; drawMain(); })));
      const hs = s.derived.holdings.filter((x) => (clsF === 'ALL' || x.cls === clsF) && (bucketF === 'ALL' || x.bucket === bucketF || (bucketF === 'LONG' && !x.bucket)));
      nodes.push(ui.card({
        title: 'สินทรัพย์ที่ถือ', icon: 'briefcase', sub: `${hs.length} รายการ`,
        action: ui.button('ประวัติรายการ', { small: true, variant: 'soft', icon: 'history', onClick: () => nav('portfolio/tx') }),
        body: hs.length ? h('div', { class: 'list' }, hs.map(holdingRow)) : h('div', { class: 'faint center', style: { padding: '14px 0' } }, 'ไม่มีสินทรัพย์ในหมวดนี้'),
      }));
      nodes.push(fab());
      root.replaceChildren(...nodes);
    }

    function drawTx() {
      const s = store.get();
      const nodes = [];
      const tools = ui.card({
        title: 'เครื่องมือ CSV', icon: 'file-spreadsheet', tone: 'sky',
        body: h('div', { class: 'btn-row' },
          ui.button('นำเข้า CSV', { icon: 'upload', variant: 'soft', onClick: () => openImportSheet(ctx) }),
          ui.button('ส่งออก CSV', { icon: 'download', variant: 'soft', onClick: () => exportCsv(ctx) })),
      });
      nodes.push(tools);
      const txs = s.tx.slice().sort((a, b) => (a.date === b.date ? String(b.created || '').localeCompare(String(a.created || '')) : a.date < b.date ? 1 : -1));
      if (!txs.length) {
        nodes.push(ui.empty({ mood: 'sleep', title: 'ยังไม่มีรายการ', text: 'บันทึกรายการแรกได้เลยนะ', action: ui.button('บันทึกรายการ', { variant: 'primary', icon: 'plus', onClick: () => openTxSheet(ctx) }) }));
      } else {
        const groups = new Map();
        for (const t of txs) { const k = String(t.date).slice(0, 7); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t); }
        for (const [k, arr] of groups) {
          const [y, m] = k.split('-').map(Number);
          nodes.push(ui.section(`${fmt.month(m - 1, true)} ${y + 543}`, h('span', { class: 'faint' }, `${arr.length} รายการ`)));
          nodes.push(ui.card({
            body: h('div', { class: 'list' }, arr.map((t) => {
              const cash = t.cls === 'CASH';
              const amt = Number(t.qty) * (t.type === 'SPLIT' ? 0 : Number(t.price) || 0);
              return ui.listItem({
                icon: cash ? 'cash' : null, avatar: fmt.sym(t.symbol), avatarTone: fmt.clsTone(t.cls),
                title: [cash ? 'เงินสด' : t.cls === 'GOLD' ? 'ทองคำแท่ง' : fmt.sym(t.symbol), ' ', ui.chip(TYPE_TH[t.type] || t.type, TYPE_TONE[t.type] || '')],
                sub: `${fmt.date(t.date)} · ${t.type === 'SPLIT' ? 'อัตราส่วน ' + t.qty : Number(t.qty).toLocaleString('th-TH', { maximumFractionDigits: 8 }) + (cash ? '' : ' × ' + fmt.money(t.price, t.ccy, 2))}`,
                right: t.type === 'SPLIT' ? '–' : fmt.money(cash ? t.qty : amt, t.ccy, 2),
                rightSub: t.type === 'DIV' && Number(t.tax) ? `หักภาษี ${fmt.money(t.tax, t.ccy, 2)}` : '',
                onClick: () => openTxSheet(ctx, t),
              });
            })),
          }));
        }
      }
      nodes.push(fab());
      root.replaceChildren(...nodes);
    }

    const draw = () => { if (alive) (mode === 'tx' ? drawTx : drawMain)(); };
    draw();
    const unsub = store.subscribe(draw);

    if (params[0] === 'add') {
      openTxSheet(ctx).then(() => { if (alive) nav('portfolio'); });
    } else if (params[0] === 'h' && params[1]) {
      const hd = store.get().derived.holdings.find((x) => x.key === params[1] || x.symbol === params[1]);
      if (hd) openHolding(ctx, hd);
    }
    return () => { alive = false; unsub(); };
  },
};
