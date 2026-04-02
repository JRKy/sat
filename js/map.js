// ======================================================
// map.js
// Map initialization, base layers, panes, user marker.
// ======================================================

// ── Base tile layers ───────────────────────────────────
const street = L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }
);

const dark = L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  { maxZoom: 19, attribution: "&copy; CARTO" }
);

const terrain = L.tileLayer(
  "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
  { maxZoom: 17, attribution: "&copy; OpenTopoMap contributors" }
);

const satellite = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  { maxZoom: 19, attribution: "Tiles &copy; Esri" }
);

// ── Map instance ───────────────────────────────────────
export const map = L.map("map", {
  center: [20, 0],
  zoom: 2,
  zoomControl: true,
  worldCopyJump: true,
  preferCanvas: true,
  layers: [street]
});

// ── Layer control ──────────────────────────────────────
L.control.layers({ "Street": street, "Dark": dark, "Terrain": terrain, "Satellite": satellite }, null, {
  position: "topleft"
}).addTo(map);

// ── Scale control ──────────────────────────────────────
L.control.scale({ metric: true, imperial: true, position: "bottomleft" }).addTo(map);

// ── Rendering panes (z-order) ──────────────────────────
export const FOOTPRINT_PANE = "footprint-pane";
map.createPane(FOOTPRINT_PANE);
map.getPane(FOOTPRINT_PANE).style.zIndex = 300;
map.getPane(FOOTPRINT_PANE).style.pointerEvents = "none";

export const LINE_PANE = "line-pane";
map.createPane(LINE_PANE);
map.getPane(LINE_PANE).style.zIndex = 380;
map.getPane(LINE_PANE).style.pointerEvents = "none";

export const BEARING_PANE = "bearing-pane";
map.createPane(BEARING_PANE);
map.getPane(BEARING_PANE).style.zIndex = 420;
map.getPane(BEARING_PANE).style.pointerEvents = "none";

export const SAT_PANE = "satellite-pane";
map.createPane(SAT_PANE);
map.getPane(SAT_PANE).style.zIndex = 450;
map.getPane(SAT_PANE).style.pointerEvents = "auto";

export const LABEL_PANE = "label-pane";
map.createPane(LABEL_PANE);
map.getPane(LABEL_PANE).style.zIndex = 460;
map.getPane(LABEL_PANE).style.pointerEvents = "none";

export const USER_PANE = "user-pane";
map.createPane(USER_PANE);
map.getPane(USER_PANE).style.zIndex = 500;
map.getPane(USER_PANE).style.pointerEvents = "auto";

// ── User marker ────────────────────────────────────────
const userIcon = L.divIcon({
  className: "",
  html: `<span class="material-symbols-rounded user-marker" style="font-size:34px">location_on</span>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34]
});

let userMarker = null;
let _onLocationChange = null;

export function onLocationChange(cb) { _onLocationChange = cb; }

export function setUserLocation(lat, lon) {
  if (!userMarker) {
    userMarker = L.marker([lat, lon], { icon: userIcon, pane: USER_PANE });
    userMarker.addTo(map);
  } else {
    userMarker.setLatLng([lat, lon]);
  }
  if (_onLocationChange) _onLocationChange(lat, lon);
}

export function getUserMarker() { return userMarker; }

// ── Map click → set user location ─────────────────────
// (events.js also listens to map clicks for deselection;
//  Leaflet fires listeners in registration order, so
//  events.js registers its listener after map.js runs.)
map.on("click", (e) => {
  setUserLocation(e.latlng.lat, e.latlng.lng);
});

export const layers = { street, dark, terrain, satellite };
