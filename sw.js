/* ==========================================================================
 * sw.js — Kill-switch service worker
 *
 * Why this exists:
 *   Earlier deploys registered a cache-first service worker (v1–v4). On
 *   mobile Chrome (especially Samsung's variant) those cached versions
 *   don't release cleanly via Site settings → Clear & reset, leaving
 *   players seeing a stale version of the game.
 *
 *   This file replaces those previous service workers. On install it
 *   wipes every cache, takes immediate control of all open tabs, and
 *   unregisters itself. Next page load goes straight to the network
 *   with normal HTTP caching governed by /_headers.
 *
 *   When the game stabilizes (no more visual or gameplay iteration),
 *   we'll restore a proper service worker for offline play and PWA
 *   installs.
 * ========================================================================== */

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Wipe every cache one more time, in case anything was created post-install
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    // Take control of any tab that's currently open
    await self.clients.claim();
    // Unregister this worker so future visits hit the network directly
    await self.registration.unregister();
    // Force every controlled tab to reload — the user sees fresh content
    // immediately without having to refresh manually.
    const allClients = await self.clients.matchAll({ type: 'window' });
    for (const client of allClients) {
      try { client.navigate(client.url); } catch { /* navigation may not be permitted */ }
    }
  })());
});

// No fetch handler — when this SW is active it acts as a pass-through. Once
// it unregisters in activate(), all subsequent loads go straight to network.
