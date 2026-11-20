// หนูออม — ตั้งค่า (Builder E)
import { applyTheme } from '../main.js';
import { resetDemo } from '../demo-data.js';

const ALLOC = ['TH', 'US', 'CRYPTO', 'GOLD', 'CASH'];
const shortUrl = (u) => {
  const s = String(u || '');
  return s.length > 42 ? s.slice(0, 28) + '…' + s.slice(-10) : s;
};
const getTheme = () => { try { return localStorage.getItem('nuaom.theme') || 'auto'; } catch (e) { return 'auto'; } };

export default {
  title: 'ตั้งค่า',
  async render(root, params, ctx) {
    const { store, ui, fmt, api } = ctx;
    const { h, icon } = ui;
    let alive = true;
    let quotaText = 'กำลังตรวจโควตา…';
    let quotaLoaded = false;

    const loadQuota = async () => {
      if (quotaLoaded) return;
      quotaLoaded = true;
      try {
        const r = await api.call('line.quota');
        quotaText = `ใช้ไปแล้ว ${r.used ?? '–'} / ${r.limit ?? '–'} ข้อความเดือนนี้`;
      } catch (e) { quotaText = 'ยังตรวจโควตาข้อความไม่ได้ในตอนนี้'; }
      const el = root.querySelector('[data-quota]');
      if (alive && el) el.textContent = quotaText;
    };

    const draw = () => {
      const s = store.get();
      const st = s.settings || {};
      const cfg = api.config();
      const out = [];

      // ---------- connection ----------
      const url = ui.field({ label: 'ลิงก์ API (Web app URL)', value: cfg.url || '', placeholder: 'https://script.google.com/macros/s/…/exec' });
      const key = ui.field({ label: 'รหัสแอป (APP KEY)', type: 'password', value: cfg.key || '', placeholder: 'รหัสที่ตั้งไว้ใน Apps Script' });
      const eye = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'แสดง/ซ่อนรหัส', onClick: () => { key.input.type = key.input.type === 'password' ? 'text' : 'password'; } }, icon('eye'));
      const readCfg = () => {
        const u = url.get().trim(); const k = key.get().trim();
        if (!/^https?:\/\//i.test(u)) { url.error('ใส่ลิงก์ที่ขึ้นต้นด้วย https://'); return null; }
        if (!k) { key.error('ใส่รหัสแอปด้วยนะ'); return null; }
        return { url: u, key: k };
      };
      const test = ui.button('ทดสอบการเชื่อมต่อ', { variant: 'soft', icon: 'plug-connected', onClick: async () => {
        const c = readCfg(); if (!c) return;
        const prev = api.config();
        api.setConfig(c);
        try {
          const r = await api.call('ping');
          ui.toast(`เชื่อมต่อได้แล้ว (เวอร์ชัน ${r && r.version ? r.version : '–'})`, 'up');
        } catch (e) { ui.toast(e.message, 'down'); }
        if (prev.url && prev.key) api.setConfig(prev); else api.clearConfig();
      } });
      const save = ui.button('บันทึกและเชื่อม', { variant: 'primary', icon: 'device-floppy', onClick: async () => {
        const c = readCfg(); if (!c) return;
        api.setConfig(c);
        try { await store.load(); ui.toast('เชื่อมต่อแล้ว', 'up'); } catch (e) { ui.toast(e.message, 'down'); }
      } });
      const cutBtn = api.configured() ? ui.button('ตัดการเชื่อม (กลับโหมดตัวอย่าง)', { variant: 'ghost', icon: 'plug-connected-x', onClick: async () => {
        if (!(await ui.confirm('ตัดการเชื่อมแล้วกลับไปใช้ข้อมูลตัวอย่าง? ข้อมูลจริงยังอยู่ใน Google Sheet ของคุณ', { okText: 'ตัดการเชื่อม', danger: true }))) return;
        api.clearConfig();
        try { await store.load(); } catch (e) { /* demo */ }
        ui.toast('กลับสู่โหมดตัวอย่างแล้ว');
      } }) : null;
      out.push(ui.card({
        title: 'การเชื่อมต่อข้อมูล', icon: 'cloud',
        action: ui.chip(s.demo ? 'โหมดตัวอย่าง' : 'เชื่อมต่อแล้ว', s.demo ? 'butter' : 'mint'),
        body: h('div', null,
          h('div', { class: 'small muted', style: { marginBottom: '10px' } }, s.demo ? 'ตอนนี้ใช้ข้อมูลสมมติ ใส่ลิงก์และรหัสแอปเพื่อใช้ข้อมูลจริงของคุณ' : `เชื่อมกับ ${shortUrl(cfg.url)}`),
          url.el, h('div', { class: 'row', style: { alignItems: 'flex-start' } }, h('div', { class: 'grow' }, key.el), h('div', { style: { marginTop: '22px' } }, eye)),
          h('div', { class: 'faint', style: { margin: '-4px 0 10px' } }, 'รหัสแอปเก็บไว้ในเครื่องนี้เท่านั้น ไม่ถูกส่งไปที่อื่นนอกจากเซิร์ฟเวอร์ของคุณเอง'),
          h('div', { class: 'btn-row' }, test, save), cutBtn ? h('div', { style: { marginTop: '8px' } }, cutBtn) : null),
      }));

      // ---------- LINE ----------
      const tok = ui.field({ label: 'Channel access token', type: 'password', placeholder: s.lineReady ? 'ตั้งค่าไว้แล้ว (วางใหม่เพื่อเปลี่ยน)' : 'วาง token ที่นี่', help: 'ระบบจะไม่แสดง token กลับมาให้เห็น' });
      const uid = ui.field({ label: 'Your user ID', type: 'password', placeholder: s.lineReady ? 'ตั้งค่าไว้แล้ว (วางใหม่เพื่อเปลี่ยน)' : 'วาง user ID ที่นี่' });
      const lineOn = ui.field({ label: 'ส่งแจ้งเตือนเข้า LINE', type: 'checkbox', value: !!st.line_enabled });
      lineOn.input.addEventListener('change', async () => {
        try { await store.saveSettings({ line_enabled: lineOn.get() }); ui.toast(lineOn.get() ? 'เปิดการแจ้งเตือนแล้ว' : 'ปิดการแจ้งเตือนแล้ว', 'up'); } catch (e) { ui.toast(e.message, 'down'); }
      });
      out.push(ui.card({
        title: 'แจ้งเตือนทาง LINE', icon: 'brand-line',
        action: ui.chip(s.lineReady ? 'พร้อมใช้งาน' : 'ยังไม่ตั้งค่า', s.lineReady ? 'mint' : 'gray'),
        body: h('div', null,
          h('ol', { class: 'small muted', style: { margin: '0 0 12px', paddingLeft: '20px' } },
            ['สร้าง LINE Official Account (ฟรี)', 'เปิดใช้ Messaging API', 'คัดลอก Channel access token และ Your user ID', 'วางที่ช่องด้านล่าง แล้วกดบันทึก'].map((t) => h('li', null, t))),
          tok.el, uid.el,
          h('div', { class: 'btn-row' },
            ui.button('บันทึกรหัส LINE', { variant: 'primary', icon: 'device-floppy', onClick: async () => {
              const t = tok.get().trim(); const u = uid.get().trim();
              if (!t && !u) { tok.error('วาง token หรือ user ID อย่างน้อยหนึ่งอย่างนะ'); return; }
              const payload = {}; if (t) payload.LINE_TOKEN = t; if (u) payload.LINE_USER_ID = u;
              try { await store.setSecrets(payload); tok.set(''); uid.set(''); ui.toast('บันทึกแล้ว', 'up'); } catch (e) { ui.toast(e.message, 'down'); }
            } }),
            ui.button('ส่งข้อความทดสอบ', { variant: 'soft', icon: 'send', onClick: async () => {
              try {
                const r = await api.call('line.test');
                ui.toast(r && r.sent === false ? 'โหมดตัวอย่างยังไม่ส่งข้อความจริง' : 'ส่งแล้ว ลองดูใน LINE นะ', r && r.sent === false ? '' : 'up');
              } catch (e) { ui.toast(e.message, 'down'); }
            } })),
          h('div', { class: 'divider' }), lineOn.el,
          h('div', { class: 'small muted', 'data-quota': '1' }, quotaText)),
      }));

      // ---------- goals & rules ----------
      const ta = st.target_alloc || {};
      const wht = st.wht || {};
      const F = {
        name: ui.field({ label: 'ชื่อที่ให้หนูออมเรียก', value: st.display_name ?? '', placeholder: 'เช่น นักออม' }),
        goal: ui.field({ label: 'เป้าปันผลต่อเดือน (บาท)', type: 'number', value: st.dividend_goal_month ?? '', min: 0 }),
        maxPos: ui.field({ label: 'เพดานหุ้นตัวเดียว (%)', type: 'number', value: st.max_position_pct ?? '', min: 0, max: 100 }),
        maxCrypto: ui.field({ label: 'เพดานคริปโต (%)', type: 'number', value: st.max_crypto_pct ?? '', min: 0, max: 100 }),
        maxShort: ui.field({ label: 'เพดานเงินเก็งกำไร/ถือสั้น (%)', type: 'number', value: st.max_short_pct ?? '', min: 0, max: 100 }),
        emMonths: ui.field({ label: 'เงินสำรองฉุกเฉิน (เดือน)', type: 'number', value: st.emergency_months ?? '', min: 0 }),
        expense: ui.field({ label: 'ค่าใช้จ่ายต่อเดือน (บาท)', type: 'number', value: st.monthly_expense ?? '', min: 0 }),
        whtTH: ui.field({ label: 'ภาษีหัก ณ ที่จ่าย ไทย (%)', type: 'number', value: wht.TH ?? 10, min: 0, max: 100 }),
        whtUS: ui.field({ label: 'ภาษีหัก ณ ที่จ่าย อเมริกา (%)', type: 'number', value: wht.US ?? 15, min: 0, max: 100 }),
        checklist: ui.field({ label: 'ถามเช็กลิสต์ก่อนซื้อ', type: 'checkbox', value: st.checklist_on_buy !== false }),
      };
      const A = {};
      ALLOC.forEach((c) => { A[c] = ui.field({ label: fmt.clsName(c), type: 'number', value: ta[c] ?? 0, min: 0, max: 100 }); });
      const sumEl = h('div', { class: 'small', style: { margin: '0 0 10px' } });
      const sum = () => ALLOC.reduce((a, c) => a + (Number(A[c].get()) || 0), 0);
      const updateSum = () => {
        const t = sum(); const ok = Math.abs(t - 100) < 0.01;
        sumEl.className = `small ${ok ? 'up' : 'down'}`;
        sumEl.textContent = ok ? `รวม ${t}% ครบ 100% แล้ว` : `รวม ${Math.round(t * 100) / 100}% (ต้องรวมกันได้ 100%${t > 100 ? ' ลดลง ' + Math.round((t - 100) * 100) / 100 : ' ขาดอีก ' + Math.round((100 - t) * 100) / 100}%)`;
      };
      ALLOC.forEach((c) => A[c].input.addEventListener('input', updateSum));
      updateSum();
      const saveGoals = ui.button('บันทึกเป้าหมายและกฎ', { variant: 'primary', icon: 'device-floppy', block: true, onClick: async () => {
        const nonNeg = (f, label, max) => { const v = f.get(); if (v === '' || !(v >= 0) || (max && v > max)) { f.error(`${label}ต้องเป็นตัวเลข 0${max ? '–' + max : ' ขึ้นไป'}`); return null; } return v; };
        const goal = nonNeg(F.goal, 'เป้าปันผล'); if (goal === null) return;
        for (const c of ALLOC) { const v = A[c].get(); if (v === '' || !(v >= 0)) { A[c].error('ใส่ตัวเลข 0 ขึ้นไป'); return; } }
        if (Math.abs(sum() - 100) >= 0.01) { updateSum(); ui.toast('สัดส่วนเป้าหมายต้องรวมกันได้ 100%', 'down'); return; }
        const maxPos = nonNeg(F.maxPos, 'เพดานหุ้นตัวเดียว', 100); if (maxPos === null) return;
        const maxCrypto = nonNeg(F.maxCrypto, 'เพดานคริปโต', 100); if (maxCrypto === null) return;
        const maxShort = nonNeg(F.maxShort, 'เพดานเงินเก็งกำไร', 100); if (maxShort === null) return;
        const em = nonNeg(F.emMonths, 'เดือนเงินสำรอง'); if (em === null) return;
        const wTH = nonNeg(F.whtTH, 'ภาษี ไทย', 100); if (wTH === null) return;
        const wUS = nonNeg(F.whtUS, 'ภาษี อเมริกา', 100); if (wUS === null) return;
        const ex = F.expense.get();
        if (ex !== '' && !(ex >= 0)) { F.expense.error('ค่าใช้จ่ายต้องเป็นตัวเลข 0 ขึ้นไป'); return; }
        const target_alloc = {}; ALLOC.forEach((c) => { target_alloc[c] = Number(A[c].get()); });
        try {
          await store.saveSettings({
            display_name: F.name.get().trim() || 'นักออม', dividend_goal_month: goal, target_alloc, max_position_pct: maxPos, max_crypto_pct: maxCrypto,
            max_short_pct: maxShort, emergency_months: em, monthly_expense: ex === '' ? '' : ex, wht: { TH: wTH, US: wUS }, checklist_on_buy: F.checklist.get(),
          });
          ui.toast('บันทึกแล้ว', 'up');
        } catch (e) { ui.toast(e.message, 'down'); }
      } });
      out.push(ui.card({
        title: 'เป้าหมายและกฎของฉัน', icon: 'target',
        body: h('div', null, F.name.el, F.goal.el,
          h('h4', { style: { margin: '6px 0 8px' } }, 'สัดส่วนเป้าหมายของพอร์ต (%)'),
          h('div', { class: 'grid2' }, ALLOC.map((c) => A[c].el)), sumEl,
          h('div', { class: 'grid2' }, F.maxPos.el, F.maxCrypto.el, F.maxShort.el, F.emMonths.el),
          F.expense.el,
          h('div', { class: 'grid2' }, F.whtTH.el, F.whtUS.el),
          F.checklist.el, saveGoals),
      }));

      // ---------- appearance ----------
      out.push(ui.card({
        title: 'หน้าตาแอป', icon: 'palette',
        body: ui.segment([{ value: 'auto', label: 'อัตโนมัติ' }, { value: 'light', label: 'สว่าง' }, { value: 'dark', label: 'มืด' }], getTheme(), (v) => applyTheme(v)),
      }));

      // ---------- install ----------
      out.push(ui.card({
        title: 'ติดตั้งไว้บนหน้าจอโฮม', icon: 'device-mobile', tone: 'sky',
        body: h('div', { class: 'stack small' },
          h('div', null, h('b', null, 'iPhone (Safari): '), 'แตะ แชร์ แล้วเลือก เพิ่มไปยังหน้าจอโฮม'),
          h('div', null, h('b', null, 'Android (Chrome): '), 'แตะ ⋮ แล้วเลือก ติดตั้งแอป หรือ เพิ่มลงหน้าจอหลัก'),
          h('div', { class: 'muted' }, 'จะเปิดได้เร็วเหมือนแอปทั่วไป')),
      }));

      // ---------- data ----------
      const dl = ui.button('ดาวน์โหลดข้อมูลสำรอง (JSON)', { variant: 'soft', icon: 'download', onClick: async () => {
        try {
          const data = await api.call('export');
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const a = h('a', { href: URL.createObjectURL(blob), download: `nuaom-backup-${fmt.isoToday()}.json` });
          document.body.append(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 2000);
          ui.toast('ดาวน์โหลดแล้ว', 'up');
        } catch (e) { ui.toast(e.message, 'down'); }
      } });
      const reset = s.demo ? ui.button('รีเซ็ตข้อมูลตัวอย่าง', { variant: 'danger', icon: 'refresh', onClick: async () => {
        if (!(await ui.confirm('ล้างการแก้ไขในข้อมูลตัวอย่างและเริ่มใหม่?', { okText: 'รีเซ็ต', danger: true }))) return;
        resetDemo();
        try { await store.load(); ui.toast('รีเซ็ตแล้ว', 'up'); } catch (e) { ui.toast(e.message, 'down'); }
      } }) : null;
      out.push(ui.card({
        title: 'ข้อมูลของฉัน', icon: 'database',
        body: h('div', { class: 'stack' }, h('div', { class: 'small muted' }, 'ไฟล์สำรองเก็บทุกอย่าง ทั้งรายการซื้อขาย บันทึก และการตั้งค่า'), h('div', { class: 'btn-row' }, dl, reset)),
      }));

      // ---------- about ----------
      out.push(ui.card({
        body: h('div', { class: 'row' }, ui.mascot('happy', 52), h('div', { class: 'grow' }, h('b', null, 'HOON เวอร์ชัน 1.0'), h('div', { class: 'small muted' }, 'ผู้ช่วยเก็บออมและติดตามหุ้น ทอง คริปโต และปันผล'))),
      }));
      root.replaceChildren(h('div', null, out), ui.disclaimer());
    };

    draw();
    loadQuota();
    const unsub = store.subscribe(draw);
    return () => { alive = false; unsub(); };
  },
};
