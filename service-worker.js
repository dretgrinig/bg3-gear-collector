// BG3 Gear Collector v7.6 — STORY ISOLATION FIX
// No PWA registration. This file only retires an old worker if a browser happens to update it.
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
