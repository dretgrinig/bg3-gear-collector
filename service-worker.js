// BG3 Gear Collector v7.2 AUTH TEST
// Intentionally removes itself. Auth persistence must be verified before PWA caching returns.
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k.startsWith("bg3-gear-")).map(k=>caches.delete(k))))
      .then(()=>self.registration.unregister())
      .then(()=>self.clients.matchAll())
      .then(clients=>clients.forEach(c=>c.navigate(c.url)))
  );
});
