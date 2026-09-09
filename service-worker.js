// BG3 Gear Collector v7.5 — ANON SESSION DIAGNOSTIC
// Page does NOT register this worker. It exists only to retire old workers if a browser checks the URL.
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    try{
      const names=await caches.keys();
      await Promise.all(names.filter(n=>n.startsWith("bg3-gear-")).map(n=>caches.delete(n)));
    }catch(_){}
    try{await self.registration.unregister()}catch(_){}
  })());
});
