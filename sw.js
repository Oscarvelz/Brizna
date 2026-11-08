// Brizna service worker: the app opens with no internet. VERSION is written by build.sh from package.json "version".
const VERSION = "brizna-1.5.21";
const CORE = ["./", "./index.html", "./icon-192.png", "./icon-512.png", "./icon-180.png", "./precache.json"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    let files = [];
    try { files = await (await fetch("./precache.json", { cache: "no-store" })).json(); } catch { /* ignore */ }
    await cache.addAll([...new Set([...CORE, ...files])].filter((u) => !u.endsWith(".webmanifest")).map((u) => new Request(u, { cache: "reload" })));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Delete only old app caches (brizna-X.Y.Z); the fonts cache (brizna-fonts) stays across updates.
    for (const k of await caches.keys()) if (k !== VERSION && /^brizna-\d+\.\d+\.\d+$/.test(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Never cache account or sync traffic.
  if (url.hostname.endsWith("supabase.co") || url.hostname.endsWith("er-api.com")) return;
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith((async () => {
      const cache = await caches.open("brizna-fonts");
      const hit = await cache.match(req);
      const net = fetch(req).then((res) => { if (res.ok || res.type === "opaque") cache.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })());
    return;
  }
  if (url.origin !== self.location.origin) return;
  // The install manifest always comes fresh from the network (a stale one gave Android the old beige strip).
  if (url.pathname.endsWith(".webmanifest")) return;
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(VERSION);
        cache.put("./index.html", res.clone());
        return res;
      } catch {
        return (await caches.match("./index.html")) || (await caches.match("./")) || Response.error();
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok) (await caches.open(VERSION)).put(req, res.clone());
    return res;
  })());
});
