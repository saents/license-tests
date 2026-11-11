// Offline support. Images are content-hashed -> cache-first forever.
// Question JSON and the app shell -> stale-while-revalidate (instant load, updates in background).
const IMG = 'viv-img-v1';
const APP = 'viv-app-v2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== IMG && k !== APP).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (url.pathname.includes('/data/img/')) {
    e.respondWith(
      caches.open(IMG).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  e.respondWith(
    caches.open(APP).then(async (c) => {
      const hit = await c.match(req, { ignoreSearch: req.mode === 'navigate' });
      const net = fetch(req)
        .then((res) => { if (res.ok) c.put(req, res.clone()); return res; })
        .catch(() => hit);
      return hit || net;
    }),
  );
});
