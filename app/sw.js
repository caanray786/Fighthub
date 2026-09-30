/* Offline support: the app itself is cached on install so it opens without a
   connection; exercise pictures are cached as they are viewed; the news feed is
   fetched fresh when online and falls back to the last copy offline.
   Bump VERSION whenever app files change so phones pick up the update. */

const VERSION = 'fight-hub-v11';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'base.css?v=11', 'glass.css?v=11', 'training.css?v=11', 'app.css?v=11',
  'config.js', 'icons.js?v=11', 'core.js?v=11', 'training-data.js?v=11', 'exercise-content.js?v=11', 'exercise-media.js?v=11',
  'training.js?v=11', 'interval-model.js?v=11', 'conditioning-model.js?v=11', 'hiit.js?v=11', 'guided-model.js?v=11', 'guided.js?v=11',
  'exercise-experience.js?v=11', 'mobility.js?v=11', 'membership-model.js?v=11', 'membership.js?v=11', 'routine-model.js?v=11',
  'routine.js?v=11', 'exercise-navigation.js?v=11', 'fight-data.js?v=11', 'fight.js?v=11', 'journal.js?v=11', 'account.js?v=11', 'premium.js?v=11', 'retention.js?v=11', 'shell.js?v=11',
  'assets/fight-hub-logo.png', 'icons/icon-192.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Signed-in (private) requests are never cached: they belong to one member
  if (request.headers.has('Authorization')) return;

  // Live news and events: network first, last copy when offline
  if (url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/rest/v1/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          if (response.ok) caches.open(VERSION + '-feed').then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  if (url.origin !== location.origin) return;

  // Opening the app: fresh page when online, cached page when offline
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('index.html')));
    return;
  }

  // Everything else from the app: cache first, then network (and keep a copy)
  event.respondWith(
    caches.match(request).then(hit => hit || fetch(request).then(response => {
      if (response.ok && url.pathname.includes('/assets/')) {
        const copy = response.clone();
        caches.open(VERSION + '-media').then(cache => cache.put(request, copy));
      }
      return response;
    }))
  );
});
