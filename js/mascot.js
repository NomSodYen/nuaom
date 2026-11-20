// หนูออม mascot. Real art comes from ChatGPT (owner) → app/img/mascot/<mood>.png.
// Until a PNG exists the placeholder (emoji in a pastel circle) is shown.
const MOODS = {
  happy: { badge: '😊', say: 'วันนี้หนูออมพร้อมช่วยนะ' },
  excited: { badge: '🎉', say: 'เย่! มีเรื่องดีๆ' },
  worried: { badge: '💦', say: 'ใจเย็นๆ นะ ค่อยๆ ดู' },
  sleep: { badge: '💤', say: 'ยังไม่มีอะไรใหม่ หนูออมงีบก่อนนะ' },
  money: { badge: '💰', say: 'ปันผลเข้าแล้ว เก็บใส่แก้มก่อน!' },
};
const available = new Map(); // mood -> true/false after first probe

export function moodInfo(mood) { return MOODS[mood] || MOODS.happy; }

export function mascotEl(mood = 'happy', size = 56, { bob = false } = {}) {
  const info = moodInfo(mood);
  const wrap = document.createElement('span');
  wrap.className = 'mascot' + (bob ? ' bob' : '');
  wrap.style.width = wrap.style.height = size + 'px';
  wrap.style.fontSize = size + 'px';
  wrap.setAttribute('role', 'img');
  wrap.setAttribute('aria-label', 'หนูออม');
  const ph = () => {
    wrap.innerHTML = '';
    const c = document.createElement('span');
    c.className = 'ph';
    c.style.fontSize = Math.round(size * 0.55) + 'px';
    c.textContent = '🐹';
    const b = document.createElement('span');
    b.className = 'badge';
    b.textContent = info.badge;
    wrap.append(c, b);
  };
  if (available.get(mood) === false) { ph(); return wrap; }
  const img = new Image();
  img.alt = 'หนูออม';
  img.decoding = 'async';
  img.onload = () => available.set(mood, true);
  img.onerror = () => { available.set(mood, false); ph(); };
  img.src = `img/mascot/${mood}.png`;
  wrap.append(img);
  return wrap;
}
