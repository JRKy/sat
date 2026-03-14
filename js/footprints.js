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

/**
 * Merge multiple dateline-split rings into one continuous ring.
 * Assumes rings are already normalized and ordered.
 */
function mergeDatelineRings(rings) {
  if (rings.length === 1) return rings[0];

  // Sort rings by average longitude so they connect in order
  const sorted = rings
    .map(r => ({
      ring: r,
      avgLon: r.reduce((s, p) => s + p[1], 0) / r.length
    }))
    .sort((a, b) => a.avgLon - b.avgLon)
    .map(x => x.ring);

  // Concatenate, removing duplicate endpoints
  const merged = [];

  sorted.forEach((r, idx) => {
    if (idx === 0) {
      merged.push(...r);
    } else {
      // Skip first point to avoid duplicate seam point
      merged.push(...r.slice(1));
    }
  });

  // Ensure closure
  const first = merged[0];
  const last = merged[merged.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    merged.push([first[0], first[1]]);
  }

  return merged;
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

    // ⭐ 3. Merge rings into one seamless ring
    const mergedRing = mergeDatelineRings(rings);

    // 4. Convert ring into geodesic polyline
    const geoPts = geodesicPolylineFromRing(mergedRing, 8);

    // 5. Draw outline
    const outline = L.polyline(geoPts, {
      pane: FOOTPRINT_PANE,
      color,
      weight: 2,
      opacity: 0.85,
      smoothFactor: 1.0,
      interactive: false
    }).addTo(map);

    // 6. Draw filled polygon
    const fill = L.polygon(geoPts, {
      pane: FOOTPRINT_PANE,
      color,
      weight: 1,
      opacity: 0.0,
      fillColor: color,
      fillOpacity: 0.06,
      interactive: false
    }).addTo(map);

    const group = L.layerGroup([outline, fill]).addTo(map);
    footprintLayers.set(sat.name, group);
  });

  if (footprintEnabled && autoFitFootprints) {
    fitToFootprints();
  }
}