// Gruszka – zapamiętuje aplikację w telefonie, żeby otwierała się także bez internetu.
const CACHE = 'gruszka-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', './index.html']).catch(() => {})));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

// Najpierw próbuje pobrać świeżą wersję (max ~3 s), a gdy nie ma zasięgu – bierze zapamiętaną.
async function networkFirst(req){
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000))
    ]);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    return (await cache.match(req)) || (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
  }
}

// Biblioteki Firebase mają numer wersji w adresie, więc wystarczy pobrać je raz.
async function cacheFirst(req){
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) e.respondWith(networkFirst(req));
  else if (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) e.respondWith(cacheFirst(req));
});
