import { map, FOOTPRINT_PANE } from "./map.js";
import {
  satellites,
  selectedSatNames,
  autoFitFootprints
} from "./state.js";
import {
  footprintBoundaryPoints
} from "./geometry.js";

const FOOTPRINT_COLORS = [
  "#1a73e8",
  "#34a853",
  "#fbbc05",
  "#ea4335",
  "#8e24aa",
  "#00acc1"
];

let footprintLayers = new Map();

export function clearFootprints() {
  for (const [, layer] of footprintLayers) map.removeLayer(layer);
  footprintLayers.clear();
}

export function fitToFootprints() {
  try {
    if (!footprintLayers.size) return;
    const group = L.featureGroup([...footprintLayers.values()]);
    const b = group.getBounds();
    if (b && b.isValid()) {
      map.fitBounds(b, { padding: [20, 20], maxZoom: 4 });
    }
  } catch {}
}

/**
 * Unwrap longitudes so the ring is monotonic and continuous.
 * We do NOT normalize to [-180, 180]; we just keep it continuous.
 */
function unwrapRing(ring) {
  if (!ring.length) return ring;

  const out = [ring[0]];
  let prevLon = ring[0][1];

  for (let i = 1; i < ring.length; i++) {
    const [lat, lonRaw] = ring[i];
    let lon = lonRaw;

    // unwrap relative to previous longitude
    while (lon - prevLon > 180) lon -= 360;
    while (lon - prevLon < -180) lon += 360;

    out.push([lat, lon]);
    prevLon = lon;
  }

  return out;
}

export function updateFootprints(footprintEnabled) {
  clearFootprints();
  if (!footprintEnabled) return;
  if (!selectedSatNames.size) return;

  const selected = satellites
    .filter(s => selectedSatNames.has(s.name))
    .sort((a, b) => (a.lon - b.lon) || a.name.localeCompare(b.name));

  selected.forEach((sat, idx) => {
    const color = FOOTPRINT_COLORS[idx % FOOTPRINT_COLORS.length];

    // 1. Generate raw footprint ring (your math is already correct)
    const boundary = footprintBoundaryPoints(sat, 720);
    if (!boundary || boundary.length < 3) return;

    // 2. Unwrap longitudes so Leaflet doesn't fold at ±180
    const unwrapped = unwrapRing(boundary);

    // 3. Draw filled polygon
    const fill = L.polygon(unwrapped, {
      pane: FOOTPRINT_PANE,
      color,
      weight: 1,
      opacity: 0.0,
      fillColor: color,
      fillOpacity: 0.06,
      noWrap: true,
      interactive: false
    }).addTo(map);

    // 4. Draw outline
    const outline = L.polyline(unwrapped, {
      pane: FOOTPRINT_PANE,
      color,
      weight: 2,
      opacity: 0.85,
      smoothFactor: 1.0,
      noWrap: true,
      interactive: false
    }).addTo(map);

    const group = L.layerGroup([fill, outline]).addTo(map);
    footprintLayers.set(sat.name, group);
  });

  if (footprintEnabled && autoFitFootprints) {
    fitToFootprints();
  }
}