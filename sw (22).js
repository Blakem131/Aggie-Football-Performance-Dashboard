/* Texas A&M Performance Dashboard — offline service worker */
const CACHE = 'tamu-perf-v45';
const CORE = ['./index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c =>
    /* cache:'reload' bypasses HTTP/CDN caches so we never install a stale copy */
    Promise.all(CORE.map(u => fetch(u, { cache: 'reload' }).then(r => { if (r.ok) return c.put(u, r); })))
  ).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const isPage = e.request.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/');
  const isData = url.pathname.endsWith('.xlsx');

  /* The page itself and the data file: ALWAYS network-first. Cache only as offline fallback. */
  if (isPage || isData) {
    e.respondWith(
      fetch(e.request, isData ? undefined : { cache: 'no-cache' }).then(res => {
        if (res.ok) { const copy = res.clone(); const key = isData ? url.pathname : './index.html';
          caches.open(CACHE).then(c => c.put(key, copy)); }
        return res;
      }).catch(() => caches.match(isData ? url.pathname : './index.html'))
    );
    return;
  }

  /* Static assets (icons, CDN libraries, fonts): cache-first for speed */
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit ||
      fetch(e.request).then(res => {
        if (res.ok && (res.type === 'basic' || res.type === 'cors')) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
    )
  );
});
