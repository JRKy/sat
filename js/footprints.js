import { map, FOOTPRINT_PANE } from "./map.js";
import {
  satellites,
  selectedSatNames,
  autoFitFootprints
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

    // 2. Split across dateline
    const rings = splitRingIntoDatelinePolygons(boundary);
    if (!rings.length) return;

    // 3. Convert rings to geodesic format
    const geodesicSegments = rings.map(r => {
      return r.map(([lat, lon]) => [lat, lon]);
    });

    // 4. Draw using Leaflet.Geodesic
    const geo = L.geodesic(geodesicSegments, {
      pane: FOOTPRINT_PANE,
      weight: 2,
      opacity: 0.85,
      color,
      fill: true,
      fillColor: color,
      fillOpacity: 0.06,
      wrap: true,
      steps: 256,   // smooth curve
      interactive: false
    }).addTo(map);

    footprintLayers.set(sat.name, geo);
  });

  if (footprintEnabled && autoFitFootprints) {
    fitToFootprints();
  }
}