/* USB Intelligence — service worker gerado no build. Não edite dist/sw.js. */
const VERSION = __USBI_VERSION__;
const PRECACHE = __USBI_PRECACHE__;
const CACHE = `usbi-${VERSION}`;

self.addEventListener('install', (event) => {
  // Cacheia tudo antes de se declarar pronto: se um arquivo falhar,
  // a instalação falha e a versão anterior continua valendo.
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(PRECACHE.map((p) => new Request(p, { cache: 'reload' })))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('usbi-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
  if (data.type === 'GET_STATUS') {
    caches.open(CACHE).then(async (cache) => {
      const keys = await cache.keys();
      const cached = new Set(keys.map((r) => new URL(r.url).pathname));
      const scope = new URL(self.registration.scope).pathname;
      const missing = PRECACHE.filter((p) => {
        const path = new URL(p, self.registration.scope).pathname;
        return !cached.has(path) && path !== scope;
      });
      event.source && event.source.postMessage({
        type: 'STATUS', version: VERSION, total: PRECACHE.length, cached: keys.length, missing,
      });
    });
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // nada externo passa pelo cache

  if (req.mode === 'navigate') {
    // Rede primeiro para receber atualizações; sem rede, o index em cache.
    event.respondWith(
      fetch(req).catch(() => caches.match('index.html', { ignoreSearch: true })
        .then((r) => r || caches.match('./')))
    );
    return;
  }
  // Arquivos com hash no nome são imutáveis: cache primeiro.
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }))
  );
});
