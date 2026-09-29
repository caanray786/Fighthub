/* Offline support: the app itself is cached on install so it opens without a
   connection; exercise pictures are cached as they are viewed; the news feed is
   fetched fresh when online and falls back to the last copy offline.
   Bump VERSION whenever app files change so phones pick up the update. */

const VERSION = 'fight-hub-v7';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'base.css?v=7', 'glass.css?v=7', 'training.css?v=7', 'app.css?v=7',
  'config.js', 'icons.js?v=7', 'core.js?v=7', 'training-data.js?v=7', 'exercise-content.js?v=7', 'exercise-media.js?v=7',
  'training.js?v=7', 'interval-model.js?v=7', 'conditioning-model.js?v=7', 'hiit.js?v=7', 'guided-model.js?v=7', 'guided.js?v=7',
  'exercise-experience.js?v=7', 'mobility.js?v=7', 'membership-model.js?v=7', 'membership.js?v=7', 'routine-model.js?v=7',
  'routine.js?v=7', 'exercise-navigation.js?v=7', 'fight-data.js?v=7', 'fight.js?v=7', 'journal.js?v=7', 'account.js?v=7', 'shell.js?v=7',
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
