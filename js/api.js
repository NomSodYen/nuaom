// หนูออม — backend client (owner: Opus). Real backend = Google Apps Script web app; otherwise demo.
import { demoCall } from './demo-data.js';

const CFG_KEY = 'nuaom.cfg';

function readCfg() {
  try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; } catch (e) { return {}; }
}

export const api = {
  config() { return readCfg(); },
  configured() { const c = readCfg(); return !!(c.url && c.key); },
  setConfig({ url, key }) {
    localStorage.setItem(CFG_KEY, JSON.stringify({ url: String(url || '').trim(), key: String(key || '').trim() }));
  },
  clearConfig() { localStorage.removeItem(CFG_KEY); },

  async call(a, payload = {}, { timeoutMs = 45000 } = {}) {
    const cfg = readCfg();
    if (!cfg.url || !cfg.key) return demoCall(a, payload);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(cfg.url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ a, k: cfg.key, ...payload }),
        redirect: 'follow',
        signal: ctrl.signal,
      });
    } catch (e) {
      throw new Error(e.name === 'AbortError' ? 'เซิร์ฟเวอร์ตอบช้าเกินไป ลองใหม่อีกครั้ง' : 'เชื่อมต่อไม่ได้ ตรวจอินเทอร์เน็ตหรือลิงก์ API');
    } finally {
      clearTimeout(timer);
    }
    let body;
    try { body = await res.json(); } catch (e) { throw new Error('เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง (ตรวจลิงก์ API อีกครั้ง)'); }
    if (!body.ok) throw new Error(body.error === 'AUTH' ? 'รหัสแอปไม่ถูกต้อง ไปที่หน้า ตั้งค่า' : body.error || 'เกิดข้อผิดพลาด');
    return body.data;
  },
};

export default api;
