/* Clinton POS - Offline App Shell Service Worker
 *
 * Strategy (no build-time manifest needed):
 *  - Navigation requests: network-first, fall back to cached app shell (index.html)
 *    so the SPA boots with zero connectivity.
 *  - Same-origin static assets (JS/CSS/fonts/images): stale-while-revalidate, so
 *    Vite's hashed bundle chunks get cached the first time they're fetched online
 *    and are served instantly (and offline) thereafter.
 *  - API / cross-origin requests: passed straight through to the network. Offline
 *    transaction buffering for those is handled in the app via IndexedDB + SyncManager.
 */

const VERSION = 'v2';
const SHELL_CACHE = `clinton-pos-shell-${VERSION}`;
const ASSET_CACHE = `clinton-pos-assets-${VERSION}`;
const TILE_CACHE = `clinton-pos-tiles-${VERSION}`;
const TILE_CACHE_LIMIT = 400;
const APP_SHELL = '/index.html';

// Precache the app shell so a cold offline start still resolves the document.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(['/', APP_SHELL])).catch(() => {})
  );
  self.skipWaiting();
});

// Drop caches from previous versions on activation.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE && k !== TILE_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Allow the page to trigger an immediate activation after an update.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

function isStaticAsset(url) {
  return /\.(?:js|mjs|css|woff2?|ttf|otf|eot|png|jpe?g|gif|svg|webp|ico|json|csv)$/i.test(
    url.pathname
  );
}

function isMapTile(url) {
  return /(^|\.)tile\.openstreetmap\.org$/i.test(url.hostname);
}

async function trimCache(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length <= maxItems) return;
    await Promise.all(keys.slice(0, keys.length - maxItems).map((k) => cache.delete(k)));
  } catch (_) {}
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET; never interfere with POST/PUT/etc. (payments, sync, auth).
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // SPA navigations -> network-first, fall back to cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(APP_SHELL).then((cached) => cached || caches.match('/'))
      )
    );
    return;
  }

  // Same-origin static assets -> stale-while-revalidate.
  if (sameOrigin && isStaticAsset(url)) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res && res.status === 200) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // OpenStreetMap tiles -> stale-while-revalidate so previously viewed areas
  // render instantly on the next visit, while fresh tiles load in the background.
  if (isMapTile(url) && request.mode === 'cors') {
    event.respondWith(
      caches.open(TILE_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res && (res.status === 200 || res.type === 'opaque')) {
              cache.put(request, res.clone());
              trimCache(TILE_CACHE, TILE_CACHE_LIMIT);
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Everything else (APIs, cross-origin) -> straight to network.
});
