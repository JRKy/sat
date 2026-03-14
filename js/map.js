// --- Base map initialization ---
export const map = L.map("map", {
  worldCopyJump: true,
  center: [0, 0],
  zoom: 2,
  zoomControl: false,
  preferCanvas: true
});

// --- Tile layer ---
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

// --- Panes (rendering layers) ---

// Footprints (under satellites)
export const FOOTPRINT_PANE = "footprint-pane";
map.createPane(FOOTPRINT_PANE);
map.getPane(FOOTPRINT_PANE).style.zIndex = 300;
map.getPane(FOOTPRINT_PANE).style.pointerEvents = "none";

// Satellite markers (above footprints)
export const SAT_PANE = "satellite-pane";
map.createPane(SAT_PANE);
map.getPane(SAT_PANE).style.zIndex = 450;
map.getPane(SAT_PANE).style.pointerEvents = "auto";

// Lines (satellite-to-observer links)
export const LINE_PANE = "line-pane";
map.createPane(LINE_PANE);
map.getPane(LINE_PANE).style.zIndex = 400;
map.getPane(LINE_PANE).style.pointerEvents = "none";

// User marker (highest priority)
export const USER_PANE = "user-pane";
map.createPane(USER_PANE);
map.getPane(USER_PANE).style.zIndex = 500;
map.getPane(USER_PANE).style.pointerEvents = "auto";

// Optional: zoom control
L.control.zoom({ position: "topright" }).addTo(map);