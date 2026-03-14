import { map, FOOTPRINT_PANE } from "./map.js";
import {
  satellites,
  selectedSatNames,
  autoFitFootprints
} from "./state.js";
import {
  footprintBoundaryPoints,
  greatCirclePoints,
  normalizeLon180
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
 * Unwrap longitudes so the ring is monotonic.
 * Prevents Leaflet from wrapping across ±180.
 */
function unwrapRing(ring) {
  if (!ring.length) return ring;

  const out = [ring[0]];
  let prev = ring[0][1];

  for (let i = 1; i < ring.length; i++) {
    let [lat, lon] = ring[i];
    lon = normalizeLon180(lon);

    // unwrap relative to previous
    while (lon - prev > 180) lon -= 360;
    while (lon - prev < -180) lon += 360;

    out.push([lat, lon]);
    prev = lon;
  }

  return out;
}

/**
 * Convert a ring into a geodesic polyline by interpolating
 * great-circle segments between each pair.
 */
function geodesicPolylineFromRing(ring, stepsPerSegment = 8) {
  const pts = [];

  for (let i = 0; i < ring.length - 1; i++) {
    const [lat1, lon1] = ring[i];
    const [lat2, lon2] = ring[i + 1];

    const seg = greatCirclePoints(lat1, lon1, lat2, lon2, stepsPerSegment);
    for (let j = 0; j < seg.length - 1; j++) {
      pts.push(seg[j]);
    }
  }

  // Close the ring
  pts.push(pts[0]);

  return pts;
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

    // 1. Generate raw footprint ring
    const boundary = footprintBoundaryPoints(sat, 720);

    // 2. Unwrap longitudes so Leaflet doesn't wrap across ±180
    const unwrapped = unwrapRing(boundary);

    // 3. Convert ring into geodesic polyline
    const geoPts = geodesicPolylineFromRing(unwrapped, 8);

    // 4. Draw outline
    const outline = L.polyline(geoPts, {
      pane: FOOTPRINT_PANE,
      color,
      weight: 2,
      opacity: 0.85,
      smoothFactor: 1.0,
      noWrap: true,
      interactive: false
    }).addTo(map);

    // 5. Draw filled polygon
    const fill = L.polygon(geoPts, {
      pane: FOOTPRINT_PANE,
      color,
      weight: 1,
      opacity: 0.0,
      fillColor: color,
      fillOpacity: 0.06,
      noWrap: true,
      interactive: false
    }).addTo(map);

    const group = L.layerGroup([outline, fill]).addTo(map);
    footprintLayers.set(sat.name, group);
  });

  if (footprintEnabled && autoFitFootprints) {
    fitToFootprints();
  }
}