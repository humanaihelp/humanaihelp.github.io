/* HumanAI Concierge — offline support (makes the site installable as an app) */
const CACHE = "hac-v2";
const CORE = ["./", "index.html", "services.html", "how-we-work.html", "team.html", "pricing.html", "contact.html",
  "disclaimer.html", "refund-policy.html", "privacy.html", "terms.html", "404.html",
  "assets/css/style.css", "assets/js/main.js", "assets/js/assistant.js", "assets/assistant.json", "assets/img/logo.svg", "assets/img/icon-192.png", "assets/img/icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  if (req.mode === "navigate" || req.url.endsWith(".json")) {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return r; })
      .catch(() => caches.match(req).then(r => r || caches.match("index.html"))));
  } else {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })));
  }
});
