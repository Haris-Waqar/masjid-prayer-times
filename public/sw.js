const CACHE_NAME = "masjid-times-v3";
const APP_SHELL = ["/", "/manifest.webmanifest", "/favicon.svg"];

async function broadcastTimetableUpdate() {
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  windows.forEach((client) => client.postMessage({ type: "TIMETABLE_UPDATED" }));
}

async function refreshTimetableCache({ broadcast = false } = {}) {
  const response = await fetch("/", { cache: "no-store" });
  if (!response.ok) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put("/", response.clone());
  if (broadcast) await broadcastTimetableUpdate();
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (event.request.mode === "navigate" && url.pathname === "/") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(
              caches.open(CACHE_NAME).then((cache) => cache.put("/", copy)),
            );
          }
          return response;
        })
        .catch(() =>
          caches.match("/").then((cached) => cached || Response.error()),
        ),
    );
    return;
  }

  if (APP_SHELL.includes(url.pathname)) {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
  }
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "Jamaat time changed",
    body: "Open the app to see the latest jamaat time. · تازہ جماعت کا وقت دیکھنے کے لیے ایپ کھولیں۔",
    url: "/",
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    Promise.all([
      refreshTimetableCache({ broadcast: true }).catch(() => undefined),
      self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: "/favicon.svg",
        badge: "/favicon.svg",
        tag: payload.tag || "prayer-time-change",
        renotify: true,
        data: { url: payload.url || "/" },
      }),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.startsWith(self.location.origin));
      if (existing) {
        existing.postMessage({ type: "TIMETABLE_UPDATED" });
        existing.navigate(url);
        return existing.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
