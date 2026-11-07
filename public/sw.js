const CACHE_NAME = "masjid-times-v5";
const APP_SHELL = ["/manifest.webmanifest", "/favicon.svg"];
const NAVIGATION_TIMEOUT_MS = 3000;

function isMosquePath(pathname) {
  return /^\/masjids\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pathname);
}

function canonicalMosquePath(value) {
  try {
    const url = new URL(value, self.location.origin);
    if (url.origin !== self.location.origin || !isMosquePath(url.pathname)) {
      return null;
    }
    return url.pathname;
  } catch {
    return null;
  }
}

function fetchWithTimeout(request, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
    fetch(request).then(
      (response) => {
        clearTimeout(timer);
        resolve(response);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function broadcastTimetableUpdate(url) {
  const windows = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  windows.forEach((client) =>
    client.postMessage({ type: "TIMETABLE_UPDATED", url }),
  );
}

async function refreshTimetableCache(url, { broadcast = false } = {}) {
  const path = canonicalMosquePath(url);
  if (!path) return false;

  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) return false;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(path, response.clone());
  if (broadcast) await broadcastTimetableUpdate(path);
  return true;
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

  if (event.request.mode === "navigate" && isMosquePath(url.pathname)) {
    event.respondWith(
      fetchWithTimeout(event.request, NAVIGATION_TIMEOUT_MS)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(
              caches.open(CACHE_NAME).then((cache) => cache.put(url.pathname, copy)),
            );
          }
          return response;
        })
        .catch(() =>
          caches.match(url.pathname).then((cached) => cached || Response.error()),
        ),
    );
    return;
  }

  if (APP_SHELL.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request)),
    );
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

  const mosquePath = canonicalMosquePath(payload.url);
  const work = [
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      tag: payload.tag || "prayer-time-change",
      renotify: true,
      data: { url: mosquePath || "/" },
    }),
  ];
  if (mosquePath) {
    work.push(
      refreshTimetableCache(mosquePath, { broadcast: true }).catch(
        () => undefined,
      ),
    );
  }
  event.waitUntil(Promise.all(work));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = canonicalMosquePath(event.notification.data?.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) =>
        client.url.startsWith(self.location.origin),
      );
      if (existing) {
        existing.postMessage({ type: "TIMETABLE_UPDATED", url });
        existing.navigate(url);
        return existing.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
