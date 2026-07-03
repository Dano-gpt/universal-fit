/* Universal Fit — service worker mínimo (habilita instalación como app + arranque offline del shell) */
const CACHE = 'uf-shell-v1';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Nunca cachear llamadas a Supabase / APIs ni Google: siempre red.
  if (url.origin !== self.location.origin) return;
  // Network-first para el HTML (así siempre se ve la última versión publicada),
  // con fallback a cache si no hay conexión.
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(
      fetch(req).then((r) => {
        const copy = r.clone();
        caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
        return r;
      }).catch(() => caches.match('./index.html').then((m) => m || caches.match('./')))
    );
    return;
  }
  // Cache-first para íconos/estáticos del propio origen.
  e.respondWith(
    caches.match(req).then((m) => m || fetch(req).then((r) => {
      const copy = r.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      return r;
    }).catch(() => m))
  );
});
