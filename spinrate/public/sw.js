// Aftertrack Service Worker v2
const CACHE_NAME = "aftertrack-v2";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// ─── INSTALL ──────────────────────────────────────────────────────────────────
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ─── ACTIVATE ─────────────────────────────────────────────────────────────────
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ─── FETCH ────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Skip non-GET, supabase, spotify, deezer requests
  if (request.method !== "GET") return;
  if (url.hostname.includes("supabase") || url.hostname.includes("spotify") || url.hostname.includes("deezer")) return;

  // Network first para API routes de Next.js
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Cache first para assets estáticos (imágenes, fonts, etc)
  if (
    url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf)$/) ||
    url.hostname.includes("fonts.googleapis") ||
    url.hostname.includes("fonts.gstatic") ||
    url.hostname.includes("coverartarchive") ||
    url.hostname.includes("i.scdn.co")
  ) {
    e.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Network first para todo lo demás, fallback a cache
  e.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok && url.origin === self.location.origin) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return res;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("/")))
  );
});

// ─── PUSH NOTIFICATIONS ───────────────────────────────────────────────────────
self.addEventListener("push", (e) => {
  if (!e.data) return;
  let data = {};
  try { data = e.data.json(); } catch { data = { title: "Aftertrack", body: e.data.text() }; }

  e.waitUntil(
    self.registration.showNotification(data.title || "Aftertrack 🎵", {
      body: data.body || "Tenés una nueva notificación",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-72.png",
      data: data.url ? { url: data.url } : {},
      vibrate: [100, 50, 100],
      actions: data.actions || [],
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/";
  e.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      const client = clientList.find((c) => c.url === url && "focus" in c);
      if (client) return client.focus();
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
