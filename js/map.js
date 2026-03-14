// =========================================
// Map Initialization + Base Layers
// =========================================

import { createUserMarker } from "./markers.js";

// --- Base layers (Option A: no API keys required) ---

const street = L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }
);

const dark = L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  {
    maxZoom: 19,
    attribution: "&copy; CARTO"
  }
);

const terrain = L.tileLayer(
  "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
  {
    maxZoom: 17,
    attribution: "&copy; OpenTopoMap contributors"
  }
);

const satellite = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/" +
    "World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    maxZoom: 19,
    attribution: "Tiles &copy; Esri"
  }
);

// =========================================
// Map Setup
// =========================================

export const map = L.map("map", {
  center: [20, 0],
  zoom: 2,
  zoomControl: true,
  worldCopyJump: true,
  preferCanvas: true,
  layers: [street] // default
});

// =========================================
// Layer Control
// =========================================

const baseLayers = {
  "Street": street,
  "Dark": dark,
  "Terrain": terrain,
  "Satellite": satellite
};

L.control.layers(baseLayers, null, { position: "topleft" }).addTo(map);

// =========================================
// Scale Control
// =========================================

L.control.scale({
  metric: true,
  imperial: true,
  position: "bottomleft"
}).addTo(map);

// =========================================
// Panes (rendering order)
// =========================================

export const FOOTPRINT_PANE = "footprint-pane";
map.createPane(FOOTPRINT_PANE);
map.getPane(FOOTPRINT_PANE).style.zIndex = 300;
map.getPane(FOOTPRINT_PANE).style.pointerEvents = "none";

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

// =========================================
// User Marker (created lazily)
// =========================================

let userMarker = null;

/**
 * Sets the user's location on the map.
 * Creates the marker only when needed.
 */
export function setUserLocation(lat, lon) {
  if (!userMarker) {
    userMarker = createUserMarker([lat, lon]);
    userMarker.addTo(map);
  } else {
    userMarker.setLatLng([lat, lon]);
  }
}

// =========================================
// Map Click Handler (sets user location)
// =========================================

map.on("click", (e) => {
  const { lat, lng } = e.latlng;
  setUserLocation(lat, lng);
});

// =========================================
// Export Base Layers (optional use elsewhere)
// =========================================

export const layers = {
  street,
  dark,
  terrain,
  satellite
};