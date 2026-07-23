/* Universal Fit — service worker (network-first para no quedar pegado con archivos viejos) */
const CACHE = 'uf-shell-v6-2.25.9';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;            // Supabase/Google/etc: red directa
  // version.txt nunca se resuelve desde caché: es la fuente de verdad de la versión publicada.
  if (url.pathname.endsWith('/version.txt')) {
    e.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }
  // Network-first: siempre intenta la versión más nueva; si no hay red, cae al cache.
  e.respondWith(
    fetch(req, { cache: 'no-store' }).then((r) => {
      const copy = r.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      return r;
    }).catch(() => caches.match(req).then((m) => m || caches.match('./index.html')))
  );
});
/* ---- Web Push ---- */
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: (e.data && e.data.text && e.data.text()) || '' }; }
  const title = d.title || 'Universal Fit';
  const opts = {
    body: d.body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: d.tag || 'uf',
    renotify: true,
    data: { url: d.url || './' }
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { try { await c.focus(); return; } catch (_) {} }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  })());
});
