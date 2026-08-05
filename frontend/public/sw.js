/*
  EdeniSystem Service Worker

  Goal:
  - Make the app feel fast on slow/unstable internet.
  - Keep the strategy simple (no complicated offline data sync).

  Strategy:
  - Static assets (JS/CSS/images/fonts): cache-first.
    This makes repeat visits very fast.

  - Page navigations (HTML): network-first with cache fallback.
    This ensures you see fresh pages when online, but still have something
    if the network is temporarily down.

  Notes:
  - We do NOT cache POST requests.
  - We keep cache names versioned to allow clean upgrades.
*/

const VERSION = "v1";
const STATIC_CACHE = `edenisystem-static-${VERSION}`;
const PAGES_CACHE = `edenisystem-pages-${VERSION}`;

// Minimal offline page as a last fallback.
const OFFLINE_HTML = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Offline</title></head><body style="font-family:system-ui; padding:24px;"><h1>Offline</h1><p>Network is unavailable. Please try again.</p></body></html>`;

self.addEventListener("install", (event) => {
  // Activate worker immediately after install.
  self.skipWaiting();

  event.waitUntil(
    (async () => {
      const cache = await caches.open(PAGES_CACHE);
      await cache.put("/offline", new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html" } }));
    })()
  );
});

self.addEventListener("activate", (event) => {
  // Remove old caches when we deploy a new version.
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((k) => {
          if (k.startsWith("edenisystem-") && ![STATIC_CACHE, PAGES_CACHE].includes(k)) {
            return caches.delete(k);
          }
          return Promise.resolve();
        })
      );

      await self.clients.claim();
    })()
  );
});

function isStaticAsset(request) {
  // Requests for Next.js build output:
  // - /_next/static/... (JS/CSS)
  // Also common image/font extensions.
  const url = new URL(request.url);
  if (url.pathname.startsWith("/_next/static/")) return true;

  return (
    url.pathname.match(/\.(?:png|jpg|jpeg|webp|gif|svg|ico|woff2?|ttf|css|js)$/i) !== null
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // We only want to handle same-origin requests.
  if (url.origin !== self.location.origin) return;

  // 1) Cache-first for static assets
  if (isStaticAsset(request)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;

        const res = await fetch(request);
        // Only cache successful responses.
        if (res.ok) cache.put(request, res.clone());
        return res;
      })()
    );
    return;
  }

  // 2) Network-first for navigations (HTML documents)
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(PAGES_CACHE);
        try {
          const res = await fetch(request);
          if (res.ok) cache.put(request, res.clone());
          return res;
        } catch {
          const cached = await cache.match(request);
          if (cached) return cached;
          const offline = await cache.match("/offline");
          return offline || new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html" } });
        }
      })()
    );
    return;
  }

  // 3) Default (API and other GETs): Network-first
  event.respondWith(
    (async () => {
      const cache = await caches.open(PAGES_CACHE);
      try {
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      } catch {
        const cached = await cache.match(request);
        if (cached) return cached;
        throw new TypeError("Network request failed and no cache available");
      }
    })()
  );
});
