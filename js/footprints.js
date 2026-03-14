import { map, FOOTPRINT_PANE } from "./map.js";
import {
  satellites,
  selectedSatNames,
  autoFitFootprints
} from "./state.js";
import {
  splitRingIntoDatelinePolygons,
  footprintBoundaryPoints,
  greatCirclePoints
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
 * Convert a ring of lat/lon points into a geodesic polyline
 * by interpolating great-circle segments between each pair.
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

    // 2. Split across dateline
    const rings = splitRingIntoDatelinePolygons(boundary);
    if (!rings.length) return;

    const layerGroup = L.layerGroup().addTo(map);

    rings.forEach(ring => {
      // 3. Convert ring into geodesic polyline
      const geoPts = geodesicPolylineFromRing(ring, 8);

      // 4. Draw outline
      L.polyline(geoPts, {
        pane: FOOTPRINT_PANE,
        color,
        weight: 2,
        opacity: 0.85,
        smoothFactor: 1.0,
        interactive: false
      }).addTo(layerGroup);

      // 5. Draw filled polygon (still using polyline points)
      L.polygon(geoPts, {
        pane: FOOTPRINT_PANE,
        color,
        weight: 1,
        opacity: 0.0,
        fillColor: color,
        fillOpacity: 0.06,
        interactive: false
      }).addTo(layerGroup);
    });

    footprintLayers.set(sat.name, layerGroup);
  });

  if (footprintEnabled && autoFitFootprints) {
    fitToFootprints();
  }
}