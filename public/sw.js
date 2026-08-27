self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// This worker enables PWA installation without caching league data or pages.
self.addEventListener("fetch", () => {});
