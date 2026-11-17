// Service worker de Timeless Contenido: RED PRIMERO, copia en caché solo como respaldo offline.
const CACHE = 'timeless-contenido-v3';
const ASSETS = ['./', './index.html', './estilo.css', './core.js', './ui.js', './manifest.json',
  '../app.js', '../config.js', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(ASSETS.map((u) => c.add(u).catch(() => null)))));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k.indexOf('timeless-contenido-') === 0).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'script.google.com' || url.hostname.endsWith('googleusercontent.com')) return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('demo-datos.json')) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res && res.ok && res.type === 'basic') {
        const copia = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
