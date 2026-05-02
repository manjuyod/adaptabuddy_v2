const CACHE_VERSION = "v2";
const STATIC_CACHE = `adaptabuddy-static-${CACHE_VERSION}`;
const PAGE_CACHE = `adaptabuddy-pages-${CACHE_VERSION}`;
const API_CACHE = `adaptabuddy-api-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline";

const PRECACHE_URLS = [OFFLINE_URL, "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];
const STATIC_EXTENSIONS = /\.(?:js|css|png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|otf)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key !== STATIC_CACHE && key !== PAGE_CACHE && key !== API_CACHE
            )
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, PAGE_CACHE, OFFLINE_URL));
    return;
  }

  if (isStaticAssetRequest(request, url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  }
});

function isStaticAssetRequest(request, url) {
  if (url.pathname.startsWith("/_next/static/")) return true;
  if (["script", "style", "image", "font"].includes(request.destination)) return true;
  return STATIC_EXTENSIONS.test(url.pathname);
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) return cachedResponse;

  const networkResponse = await fetch(request);
  if (shouldCacheResponse(networkResponse)) {
    await cache.put(request, networkResponse.clone());
  }
  return networkResponse;
}

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const networkResponse = await fetch(request);
    if (shouldCacheResponse(networkResponse)) {
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;

    if (fallbackUrl) {
      const fallbackResponse = await caches.match(fallbackUrl);
      if (fallbackResponse) return fallbackResponse;
    }

    return new Response("Offline", {
      status: 503,
      headers: { "Content-Type": "text/plain" }
    });
  }
}

function shouldCacheResponse(response) {
  if (!response || !response.ok) return false;
  const cacheControl = response.headers.get("Cache-Control") ?? "";
  return !cacheControl.toLowerCase().includes("no-store");
}
