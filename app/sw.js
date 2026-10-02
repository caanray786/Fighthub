/* Offline support: the app itself is cached on install so it opens without a
   connection; exercise pictures are cached as they are viewed; the news feed is
   fetched fresh when online and falls back to the last copy offline.
   Bump VERSION whenever app files change so phones pick up the update. */

const VERSION = 'fight-hub-v30';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'base.css?v=30', 'glass.css?v=30', 'training.css?v=30', 'app.css?v=30',
  'config.js', 'i18n.js?v=30', 'icons.js?v=30', 'core.js?v=30', 'training-data.js?v=30', 'exercise-content.js?v=30', 'exercise-media.js?v=30', 'female-media.js?v=30', 'body-model.js?v=30',
  'training.js?v=30', 'interval-model.js?v=30', 'conditioning-model.js?v=30', 'hiit.js?v=30', 'guided-model.js?v=30', 'guided.js?v=30',
  'exercise-experience.js?v=30', 'mobility.js?v=30', 'membership-model.js?v=30', 'membership.js?v=30', 'routine-model.js?v=30',
  'routine.js?v=30', 'exercise-navigation.js?v=30', 'fight-data.js?v=30', 'fight.js?v=30', 'journal.js?v=30', 'account.js?v=30', 'premium.js?v=30', 'retention.js?v=30', 'recap.js?v=30', 'coach.js?v=30', 'reminders.js?v=30', 'bodyplan.js?v=30', 'shell.js?v=30',
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
