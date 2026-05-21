const CACHE_NAME = 'tripledger-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon192.png',
  '/icon512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
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
  const url = new URL(event.request.url);

  // Google Fonts: cache-first (fonts rarely change)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(res => {
            cache.put(event.request, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  // Apps Script / external APIs: network only (no cache)
  if (url.hostname.includes('script.google.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Everything else: network first, fall back to cache
  event.respondWith(
    fetch(event.request)
      .then(res => {
        // Cache successful GET responses for static assets
        if (event.request.method === 'GET' && res.status === 200) {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, res.clone()));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
