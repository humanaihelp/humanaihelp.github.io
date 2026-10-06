/* HumanAI Concierge — offline support (makes the site installable as an app) */
const CACHE = "hac-v4";
const CORE = ["./", "index.html", "services.html", "how-we-work.html", "team.html", "pricing.html", "contact.html",
  "disclaimer.html", "refund-policy.html", "privacy.html", "terms.html", "app.html", "404.html",
  "assets/css/style.css", "assets/js/main.js", "assets/js/assistant.js", "assets/assistant.json", "assets/img/logo.svg", "assets/img/icon-192.png", "assets/img/icon-512.png",
  "assets/fonts/plus-jakarta-sans-latin-400-normal.woff2", "assets/fonts/plus-jakarta-sans-latin-600-normal.woff2", "assets/fonts/plus-jakarta-sans-latin-700-normal.woff2", "assets/fonts/instrument-serif-latin-400-normal.woff2", "assets/fonts/instrument-serif-latin-400-italic.woff2"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  /* Never cache the admin page or the app download: always load them fresh. */
  if (url.pathname.startsWith("/admin/") || url.pathname.startsWith("/app/")) return;
  /* Fonts and images: cache first (they rarely change). */
  if (/\.(woff2|png|jpg|jpeg|svg|webp|ico)$/i.test(url.pathname)) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })));
    return;
  }
  /* Pages, CSS, JS, JSON: network first so updates show immediately; cached copy only when offline. */
  e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return r; })
    .catch(() => caches.match(req).then(r => r || (req.mode === "navigate" ? caches.match("index.html") : undefined))));
});
