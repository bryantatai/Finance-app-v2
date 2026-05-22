// TripLedger Service Worker v4
// Fixed for Chrome PWA installability on GitHub Pages subfolder

const CACHE_NAME = 'tripledger-v4';

// Use absolute paths matching the GitHub Pages deployment
const BASE = '/Finance-app-v2';
const STATIC_ASSETS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/manifest.json',
  BASE + '/icon192.png',
  BASE + '/icon512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Add each individually — one 404 won't break the whole install
      return Promise.allSettled(STATIC_ASSETS.map(url => cache.add(url)));
    }).then(() => {
      console.log('[SW] Install complete');
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => {
        console.log('[SW] Deleting old cache:', k);
        return caches.delete(k);
      }))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // ── Google Fonts: cache first ──────────────────────────
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(req).then(cached => {
          if (cached) return cached;
          return fetch(req).then(res => {
            cache.put(req, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  // ── Apps Script: network only, never cache ─────────────
  if (url.hostname.includes('script.google.com')) {
    event.respondWith(
      fetch(req).catch(() => new Response(JSON.stringify({success:false,error:'offline'}), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }

  // ── Navigation requests (HTML pages): network first, ───
  // ── fall back to cached index.html (covers start_url) ──
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          // Cache the fresh response
          caches.open(CACHE_NAME).then(cache => cache.put(req, res.clone()));
          return res;
        })
        .catch(() => {
          // Offline: serve cached index.html for any navigation
          return caches.match(BASE + '/index.html')
            .then(cached => cached || caches.match(BASE + '/'));
        })
    );
    return;
  }

  // ── Everything else: network first, cache fallback ─────
  event.respondWith(
    fetch(req)
      .then(res => {
        if (req.method === 'GET' && res.status === 200) {
          caches.open(CACHE_NAME).then(cache => cache.put(req, res.clone()));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
