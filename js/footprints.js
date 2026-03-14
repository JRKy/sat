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

    const boundary = footprintBoundaryPoints(sat, 720);
    const rings = splitRingIntoDatelinePolygons(boundary);
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