import { map, FOOTPRINT_PANE } from "./map.js";
import {
  satellites,
  selectedSatNames,
  autoFitFootprints,
  setLineLayers
} from "./state.js";
import {
  splitRingIntoDatelinePolygons,
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

/**
 * Resample a lat/lon ring in Web Mercator space to eliminate projection artifacts.
 * Produces a smooth, uniform polygon with no kinks.
 */
function resampleRingProjected(latlonRing, samples = 1024) {
  if (!latlonRing || latlonRing.length < 4) return latlonRing;

  const zoom = map.getMaxZoom();
  const proj = latlonRing.map(([lat, lon]) => map.project([lat, lon], zoom));

  // Compute cumulative distances
  const dists = [0];
  for (let i = 1; i < proj.length; i++) {
    const dx = proj[i].x - proj[i - 1].x;
    const dy = proj[i].y - proj[i - 1].y;
    dists.push(dists[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }

  const total = dists[dists.length - 1];
  if (total <= 0) return latlonRing;

  const out = [];
  for (let s = 0; s <= samples; s++) {
    const target = (s / samples) * total;

    // Find segment
    let i = 1;
    while (i < dists.length && dists[i] < target) i++;

    const d0 = dists[i - 1];
    const d1 = dists[i];
    const t = (target - d0) / (d1 - d0 + 1e-12);

    const x = proj[i - 1].x + t * (proj[i].x - proj[i - 1].x);
    const y = proj[i - 1].y + t * (proj[i].y - proj[i - 1].y);

    const ll = map.unproject({ x, y }, zoom);
    out.push([ll.lat, ll.lng]);
  }

  // Force closure
  out[out.length - 1] = [out[0][0], out[0][1]];

  return out;
}

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

    // 2. Smooth it in projected space to eliminate artifacts
    const smoothed = resampleRingProjected(boundary, 1024);

    // 3. Split across dateline
    const rings = splitRingIntoDatelinePolygons(smoothed);
    if (!rings.length) return;

    const multi = rings
      .filter(r => r.length >= 4)
      .map(r => [r]);

    if (!multi.length) return;

    const poly = L.polygon(multi, {
      pane: FOOTPRINT_PANE,
      color,
      weight: 2,
      opacity: 0.85,
      fillColor: color,
      fillOpacity: 0.06,
      interactive: false
    }).addTo(map);

    footprintLayers.set(sat.name, poly);
  });

  if (footprintEnabled && autoFitFootprints) {
    fitToFootprints();
  }
}