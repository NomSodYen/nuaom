// หนูออม service worker — app shell offline. API calls (script.google.com) always go to network.
const BUILD = '2026-11-20.2';
const CACHE = 'nuaom-' + BUILD;
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/theme.css', 'vendor/chart.umd.min.js',
  'js/main.js', 'js/ui.js', 'js/fmt.js', 'js/api.js', 'js/store.js', 'js/demo-data.js', 'js/mascot.js',
  'js/calc/index.js', 'js/calc/_util.js', 'js/calc/portfolio.js', 'js/calc/dividends.js', 'js/calc/valuation.js', 'js/calc/risk.js',
  'js/calc/tax.js', 'js/calc/compound.js', 'js/calc/technical.js', 'js/calc/screen.js',
  'js/pages/home.js', 'js/pages/portfolio.js', 'js/pages/dividends.js', 'js/pages/gold.js', 'js/pages/watch.js',
  'js/pages/news.js', 'js/pages/stock.js', 'js/pages/screener.js', 'js/pages/valuation.js', 'js/pages/tools.js',
  'js/pages/risk.js', 'js/pages/journal.js', 'js/pages/learn.js', 'js/pages/settings.js', 'js/pages/menu.js',
  'img/icon-192.png', 'img/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => null)))));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('nuaom-') && k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.hostname.endsWith('google.com') || url.hostname.endsWith('googleusercontent.com')) return;
  const sameOrigin = url.origin === self.location.origin;
  const cdn = /fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/.test(url.hostname);
  if (!sameOrigin && !cdn) return;
  // network-first for same-origin (fresh code after deploy), cache fallback offline; cache-first for CDN assets
  if (sameOrigin) {
    e.respondWith(fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
  } else {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((res) => {
      const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res;
    })));
  }
});
