/* ==========================================================================
 * sw.js — Service worker
 *
 * Strategy: cache-first for static assets so the game works offline after a
 * single load. Bump CACHE_VERSION on every deploy that changes asset hashes
 * (or wire it to a build-time constant if/when we add a build step).
 * ========================================================================== */

const CACHE_VERSION = 'becaffeined-v3';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/css/tokens.css',
  '/css/game.css',
  '/js/main.js',
  '/js/board.js',
  '/js/render.js',
  '/js/input.js',
  '/js/audio.js',
  '/js/levels.js',
  '/js/splash.js',
  '/js/storage.js',
  '/manifest.webmanifest',
  '/assets/img/cr-monogram-dark.jpg',
  '/assets/img/cr-logo.png',
  '/assets/img/favicon-32x32.png',
  '/assets/img/favicon-192x192.png',
  '/assets/img/apple-touch-icon.png',
  '/assets/svg/drink-iced-cr.svg',
  '/assets/svg/drink-streetcar.svg',
  '/assets/svg/drink-cappuccino.svg',
  '/assets/svg/drink-bayou-beast.svg',
  '/assets/svg/drink-iced-mocha.svg',
  '/assets/svg/drink-coffee-bag.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Don't cache analytics or any cross-origin POSTs.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) =>
      cached ||
      fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() => caches.match('/index.html'))
    )
  );
});
