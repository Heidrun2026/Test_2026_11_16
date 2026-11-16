// Service Worker: cacht NUR die App-Hülle. Keine Planungsdaten.
const CACHE = 'kapa-shell-v2'; // Bei Änderungen der Hülle hochzählen
const SHELL = ['./', './index.html', './offline.html', './css/styles.css', './js/app.js', './js/calc.js', './js/store.js', './manifest.webmanifest', './icons/icon.svg'];
const OFFLINE = new URL('./offline.html', self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.includes('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE)));
    return;
  }
  // Netzwerk zuerst, damit Änderungen am Prototyp sofort sichtbar sind
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
