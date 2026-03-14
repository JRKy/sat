import { LABEL_ZOOM_THRESHOLD } from "./state.js";

export const WORLD_BOUNDS = L.latLngBounds(
  L.latLng(-90, -180),
  L.latLng(90, 180)
);

export const map = L.map("map", {
  zoomControl: true,
  attributionControl: true,
  minZoom: 1,
  maxZoom: 19,
  worldCopyJump: false,
  maxBounds: WORLD_BOUNDS,
  maxBoundsViscosity: 0.8
}).setView([0, 0], 2);

const baseLayers = {
  "Streets": L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    { attribution: "© OpenStreetMap contributors", maxZoom: 19 }
  ),
  "Satellite": L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { attribution: "Tiles © Esri", maxZoom: 19 }
  ),
  "Dark": L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    { attribution: "© OpenStreetMap & Carto", maxZoom: 19 }
  )
};

baseLayers["Streets"].addTo(map);
L.control.layers(baseLayers, null, { position: "topright" }).addTo(map);
L.control.scale({ imperial: true, metric: true, position: "bottomleft" }).addTo(map);

export const FOOTPRINT_PANE = "footprintPane";
map.createPane(FOOTPRINT_PANE);
map.getPane(FOOTPRINT_PANE).style.zIndex = 250;
map.getPane(FOOTPRINT_PANE).style.pointerEvents = "none";

export function getLabelZoomThreshold() {
  return LABEL_ZOOM_THRESHOLD;
}