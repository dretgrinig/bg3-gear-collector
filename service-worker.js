// BG3 Gear Collector v7.4 — NO-PWA CLEANROOM
// DO NOT add registration code for this worker.
// Its sole purpose is to retire previously-installed BG3 Gear Collector service workers.

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    try {
      const names = await caches.keys();
      await Promise.all(
        names.filter(name => name.startsWith("bg3-gear-")).map(name => caches.delete(name))
      );
    } catch (_) {}

    try { await self.registration.unregister(); } catch (_) {}
    try { await self.clients.claim(); } catch (_) {}
  })());
});
