/* ============================================================
   S&S Companion — Service Worker (versioned, update-safe)
   ------------------------------------------------------------
   WHY A VERSION: bump CACHE_VERSION on every release. The old
   cache is deleted on activate, so users always get fresh assets
   instead of a stale shell. This is the #1 fix for "I updated the
   app but users still see the old version".

   STRATEGY:
   - HTML / navigation  → network-first (fresh app shell when online,
     cached fallback when offline).
   - Other assets       → stale-while-revalidate (instant load, quiet
     background refresh).
   ============================================================ */

const CACHE_VERSION = 'sands-v5-2-2-r3';   // ← bump this on each deploy
const CACHE_NAME    = CACHE_VERSION;

/* Pre-cache the minimum needed to boot offline. Add your real
   asset filenames here (icons, self-hosted fonts, etc.). */
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './Bind_Pact_Weapon.webp',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE).catch(() => {}))
      // Do NOT auto-skipWaiting; we wait for the user's "update" tap.
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* The page posts this when the user taps "update". */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function isHTMLRequest(req) {
  return req.mode === 'navigate' ||
         (req.headers.get('accept') || '').includes('text/html');
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Network-first for the app shell / navigations.
  if (isHTMLRequest(req)) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Stale-while-revalidate for everything else (same-origin).
  if (new URL(req.url).origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(cached => {
        const network = fetch(req).then(res => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
          }
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
  }
});
