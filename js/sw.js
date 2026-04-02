// ======================================================
// sw.js — Service Worker
// Caches the app shell for offline use.
// Tile layers and Nominatim geocoding require network;
// all other app functionality works offline.
// ======================================================

const CACHE    = "sat-v1";
const PRECACHE = [
  "/sat/",
  "/sat/index.html",
  "/sat/manifest.json",
  "/sat/satellites.json",
  "/sat/favicon.svg",
  "/sat/styles/main.css",
  "/sat/js/app.js",
  "/sat/js/state.js",
  "/sat/js/map.js",
  "/sat/js/markers.js",
  "/sat/js/events.js",
  "/sat/js/table.js",
  "/sat/js/geometry.js",
  "/sat/js/declination.js",
  "/sat/js/bearing.js",
  "/sat/js/lines.js",
  "/sat/js/footprints.js",
  "/sat/js/autocomplete.js",
];

// Install — cache all app shell files
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate — delete old caches
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — cache-first for app shell, network-first for tiles/geocoding
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // Always go to network for tile layers, CDN libs, and Nominatim
  const networkOnly = [
    "tile.openstreetmap.org",
    "basemaps.cartocdn.com",
    "opentopomap.org",
    "arcgisonline.com",
    "nominatim.openstreetmap.org",
    "unpkg.com",
    "fonts.googleapis.com",
    "fonts.gstatic.com",
  ];

  if (networkOnly.some(h => url.hostname.includes(h))) {
    e.respondWith(fetch(e.request).catch(() => new Response("", { status: 503 })));
    return;
  }

  // Cache-first for everything else (app shell)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      });
    })
  );
});
