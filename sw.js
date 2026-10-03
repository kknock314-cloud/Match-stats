const CACHE_NAME = 'pitchstats-cache-blue-v18';
const urlsToCache = ['./', './index.html', './style.css?v=18', './app.js?v=18', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(urlsToCache))));
self.addEventListener('fetch', e => {
  if (e.request.url.includes('firestore') || e.request.url.includes('identitytoolkit') || e.request.url.includes('gstatic')) return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
