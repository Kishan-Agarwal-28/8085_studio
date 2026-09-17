// 8085 Compiler Service Worker
// Enables offline capabilities, asset caching, and background compilation handling

const CACHE_NAME = '8085-compiler-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/favicon.ico',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Intercept fetch requests for caching offline assets
self.addEventListener('fetch', (event) => {
  // Only handle GET requests for same-origin static assets
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request).catch(() => cachedResponse);
    })
  );
});

// Handle messages sent directly to the Service Worker
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PING_SW') {
    event.ports[0]?.postMessage({ status: 'SW_ACTIVE', version: CACHE_NAME });
  }
});
