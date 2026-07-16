// ============================================================
// BENIM SHOP — Service Worker
// Strategy: Cache First with Network Update
//   1. On first visit — fetch from network, cache everything.
//   2. On repeat visits — serve from cache INSTANTLY, then
//      fetch fresh copy in background and update cache.
//   3. Result: user sees cached page immediately (no skeleton
//      flash), then Firebase loads real data on top of it.
// ============================================================

const CACHE_NAME = 'benim-v3';
const CORE_ASSETS = [
  './',
  './index.html',
  'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Poppins:wght@400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
];

// ── Install: pre-cache core assets ──────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CORE_ASSETS).catch(() => {
        // External fonts/icons may fail in restricted environments — that's OK
      });
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: delete old caches ─────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: Stale-While-Revalidate strategy ──────────────────
// Serve from cache immediately, update cache in background.
// This gives instant loads on repeat visits while keeping
// content fresh — the skeleton shows only on the very first visit.
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and Firebase/Firestore requests
  // (Firebase must always go to network for real-time data)
  if (request.method !== 'GET') return;
  if (url.hostname.includes('firestore.googleapis.com')) return;
  if (url.hostname.includes('firebase.googleapis.com')) return;
  if (url.hostname.includes('googleapis.com') && url.pathname.includes('/identitytoolkit')) return;
  if (url.hostname.includes('securetoken.googleapis.com')) return;

  // For the main HTML page: Cache First, then update in background
  if (url.pathname === '/' || url.pathname.endsWith('index.html') || url.pathname.endsWith('/')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // For Firebase SDK scripts and CDN fonts/icons: Cache First
  if (url.hostname.includes('gstatic.com') ||
      url.hostname.includes('cdnjs.cloudflare.com') ||
      url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // For everything else: Network First (falls back to cache)
  event.respondWith(networkFirst(request));
});

// ── Cache Strategies ─────────────────────────────────────────

// Stale-While-Revalidate: return cache instantly, update in background
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  // Fetch fresh version in background regardless
  const fetchPromise = fetch(request).then(response => {
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  // Return cached version immediately if available, else wait for network
  return cached || fetchPromise;
}

// Cache First: serve from cache, only fetch if not cached
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch(e) {
    return new Response('Network error', { status: 503 });
  }
}

// Network First: try network, fall back to cache
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch(e) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}
