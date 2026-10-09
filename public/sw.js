const CACHE_NAME = 'swm-shell-v3';
const APP_SHELL = ['./', './manifest.webmanifest', './favicon.svg'];
const STATIC_DESTINATIONS = new Set(['font', 'image', 'manifest', 'script', 'style', 'worker']);

function isStaticAssetRequest(request, url) {
  if (url.origin !== self.location.origin || url.pathname.includes('/api/')) return false;
  const scopePath = new URL(self.registration.scope).pathname;
  const relativePath = url.pathname.slice(scopePath.length);
  return STATIC_DESTINATIONS.has(request.destination)
    || relativePath.startsWith('assets/')
    || relativePath === 'manifest.webmanifest'
    || relativePath === 'favicon.svg';
}

function isSafeCacheResponse(response) {
  if (!response.ok || response.type !== 'basic') return false;
  if (response.headers.get('Cache-Control')?.toLowerCase().includes('no-store')) return false;
  return !response.headers.get('Content-Type')?.toLowerCase().includes('application/json');
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('swm-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./', copy));
          return response;
        })
        .catch(() => caches.match('./')),
    );
    return;
  }

  if (!isStaticAssetRequest(request, url)) return;

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      const cacheCopy = isSafeCacheResponse(response) ? response.clone() : null;
      if (cacheCopy) {
        caches.open(CACHE_NAME)
          .then((cache) => cache.put(request, cacheCopy))
          .catch(() => {});
      }
      return response;
    })),
  );
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch {
    payload = { title: 'Deadline reminder', body: event.data?.text() || '' };
  }
  event.waitUntil(self.registration.showNotification(payload.title || 'Deadline reminder', {
    body: payload.body || 'An Issue deadline needs attention.',
    icon: './favicon.svg',
    badge: './favicon.svg',
    tag: payload.tag || 'deadline-reminder',
    renotify: true,
    data: { url: payload.url || './#/issues' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || './#/issues', self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
    const existing = clients.find((client) => client.url.startsWith(self.registration.scope));
    if (existing) {
      await existing.navigate(target);
      return existing.focus();
    }
    return self.clients.openWindow(target);
  }));
});
