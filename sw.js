// TripLedger Service Worker v5
// Minimal — matching the approach of the version that worked

const CACHE_NAME = 'tripledger-v5';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll([
        '/Finance-app-v2/',
        '/Finance-app-v2/index.html',
        '/Finance-app-v2/manifest.json',
        '/Finance-app-v2/icon192.png',
        '/Finance-app-v2/icon512.png'
      ]);
    }).catch(err => console.log('[SW] Cache install error (non-fatal):', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Skip non-GET and cross-origin API calls
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('script.google.com')) return;

  event.respondWith(
    fetch(event.request)
      .then(res => {
        // Cache successful responses
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
