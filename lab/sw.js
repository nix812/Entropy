// Last Gradient: offline start. Every same-site GET goes to the network first and the answer is kept. With no connection the kept
// copy is served, so the game opens from the Home Screen icon without a signal. Nothing else is cached or changed.
const C = 'last-gradient-1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;
  e.respondWith(fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(C).then(k => k.put(r.url.split('?')[0], c)).catch(() => {}); } return res; })
    .catch(() => caches.match(r.url.split('?')[0]).then(m => m || caches.match(new URL('./', self.location).href)).then(m => m || Response.error())));
});
