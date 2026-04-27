/* ==========================================================================
 * sw.js — Kill-switch service worker (silent self-cleanup version)
 *
 * Why this exists:
 *   Earlier deploys registered a cache-first service worker (v1–v4). On
 *   mobile Chrome (especially Samsung's variant) those cached versions
 *   refuse to release via Site settings → Clear & reset.
 *
 *   The browser auto-checks /sw.js on its update cycle. When it sees this
 *   file replace the old one, it installs and activates this version. On
 *   activate, this worker:
 *     1. wipes every cache,
 *     2. takes control of any tabs that the old worker had,
 *     3. unregisters itself.
 *
 *   It does NOT call client.navigate() — that caused a reload loop with
 *   the registration script in index.html. The user simply refreshes
 *   their tab whenever they next look at it; everything is fresh from
 *   network. New visitors don't register this SW at all (the registration
 *   call has been removed from index.html).
 *
 *   When the game stabilizes, restore a proper offline-first SW.
 * ========================================================================== */

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.clients.claim();
    await self.registration.unregister();
    // Deliberately no client.navigate() here — that produces an infinite
    // reload loop when paired with index.html's registration script.
  })());
});

// No fetch handler. While this SW is active it acts as a transparent
// pass-through; once activate() unregisters it, every subsequent request
// goes straight to network.
