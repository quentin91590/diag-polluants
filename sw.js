/* Hors ligne : l'application se charge sans réseau après la première visite */
const V = 'diagpol-v2';
const CORE = ['./', 'index.html', 'css/app.css', 'js/app.js', 'js/util.js', 'js/db.js', 'js/ref.js', 'js/store.js', 'js/ar.js', 'js/report.js', 'js/vendor/qrcode.js', 'js/vendor/docx.iife.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (u.hostname.endsWith('geo.admin.ch')) return;
  if (u.origin === location.origin) {
    /* réseau d'abord pour avoir la dernière version, cache si hors ligne */
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const c = res.clone(); caches.open(V).then(x => x.put(e.request, c)); return res; })));
  }
});
