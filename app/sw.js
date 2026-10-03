/* Offline support: the app itself is cached on install so it opens without a
   connection; exercise pictures are cached as they are viewed; the news feed is
   fetched fresh when online and falls back to the last copy offline.
   Bump VERSION whenever app files change so phones pick up the update. */

const VERSION = 'fight-hub-v32';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'base.css?v=32', 'glass.css?v=32', 'training.css?v=32', 'app.css?v=32',
  'config.js', 'i18n.js?v=32', 'icons.js?v=32', 'core.js?v=32', 'training-data.js?v=32', 'exercise-content.js?v=32', 'exercise-media.js?v=32', 'female-media.js?v=32', 'body-model.js?v=32',
  'training.js?v=32', 'interval-model.js?v=32', 'conditioning-model.js?v=32', 'hiit.js?v=32', 'guided-model.js?v=32', 'guided.js?v=32',
  'exercise-experience.js?v=32', 'mobility.js?v=32', 'membership-model.js?v=32', 'membership.js?v=32', 'routine-model.js?v=32',
  'routine.js?v=32', 'exercise-navigation.js?v=32', 'fight-data.js?v=32', 'fight.js?v=32', 'journal.js?v=32', 'account.js?v=32', 'premium.js?v=32', 'retention.js?v=32', 'recap.js?v=32', 'coach.js?v=32', 'reminders.js?v=32', 'bodyplan.js?v=32', 'shell.js?v=32',
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

/* ---- Training reminders (sent by the website, shown even when the app is closed) ---- */
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || 'Fight Hub', {
    body: data.body || 'Time to train.',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: data.tag || 'fight-hub',
    data: { url: data.url || '/app/' }
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/app/', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(c => c.url.startsWith(self.location.origin + '/app/'));
    return open ? open.focus() : self.clients.openWindow(url);
  }));
});
