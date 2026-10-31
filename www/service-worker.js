const CACHE = 'empire-command-mobile-v5';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './assets/app-icon.svg',
  './assets/icons/icon-192.webp',
  './assets/icons/icon-512.webp',
  './js/data.js',
  './js/engine.js',
  './js/app.js'
];

self.addEventListener('install', event => {
  event.waitUntil(Promise.all([
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)),
    self.skipWaiting()
  ]));
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))),
    self.clients.claim()
  ]));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(async response => {
      if (response.ok) {
        const clone = response.clone();
        const cache = await caches.open(CACHE);
        await cache.put(event.request, clone);
      }
      return response;
    }).catch(() => event.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))
  );
});
