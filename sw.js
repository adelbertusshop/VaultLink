const CACHE = 'vaultlink-static-v3';
const STATIC_ASSETS = [
  '/manifest.json',
  '/logo.png'
];

function isSameOriginStatic(request) {
  const url = new URL(request.url);
  return url.origin === self.location.origin &&
    request.method === 'GET' &&
    (url.pathname === '/manifest.json' || url.pathname === '/logo.png');
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;

  // Never cache navigation, authentication, API, Supabase, or non-GET traffic.
  if (!isSameOriginStatic(request)) return;

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request))
  );
});
