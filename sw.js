// TripLedger Service Worker v6
// Chrome Android PWA installability compliant

const CACHE_NAME = 'tripledger-v6';
const PRECACHE = [
  '/Finance-app-v2/',
  '/Finance-app-v2/index.html',
  '/Finance-app-v2/manifest.json',
  '/Finance-app-v2/icon192.png',
  '/Finance-app-v2/icon512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Add each asset individually so one 404 doesn't break the whole install
        return Promise.all(
          PRECACHE.map(url =>
            cache.add(url).catch(err => console.warn('[SW] Could not precache:', url, err))
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Never intercept Apps Script or Google API calls — let the browser handle
  // them natively.  Calling event.respondWith(fetch(req)) here would issue the
  // request from the SW worker context, which Playwright's page.route() cannot
  // intercept (CDP Fetch only sees renderer-process requests).  By returning
  // WITHOUT calling event.respondWith() the browser falls through to its own
  // network stack, which IS interceptable by page.route() in tests and reaches
  // the real network identically in production.
  if (url.hostname.includes('script.google.com') ||
      url.hostname.includes('googleapis.com')) {
    return;
  }

  // Google Fonts — cache first (offline resilience)
  if (url.hostname === 'fonts.googleapis.com' ||
      url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          caches.open(CACHE_NAME).then(c => c.put(req, res.clone()));
          return res;
        });
      })
    );
    return;
  }

  // Everything else — network first, fall back to cache
  // For navigation requests (HTML), always fall back to cached index.html
  event.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.status === 200 && req.method === 'GET') {
          caches.open(CACHE_NAME).then(c => c.put(req, res.clone()));
        }
        return res;
      })
      .catch(() => {
        // Offline fallback
        return caches.match(req).then(cached => {
          if (cached) return cached;
          // For navigation, serve index.html from cache
          if (req.mode === 'navigate') {
            return caches.match('/Finance-app-v2/index.html');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});
