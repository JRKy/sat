// ======================================================
// footprints.js
// Footprint polygon rendering for selected / all visible sats.
// ======================================================

import { map, FOOTPRINT_PANE } from "./map.js";
import { footprintBoundaryPoints } from "./geometry.js";

const FOOTPRINT_COLORS = [
  "#1a73e8", "#34a853", "#fbbc05", "#ea4335", "#8e24aa", "#00acc1",
  "#f57c00", "#0097a7", "#c62828", "#558b2f"
];

let footprintLayers = new Map(); // satName → L.layerGroup

// ── Public API ─────────────────────────────────────────
export function clearFootprints() {
  for (const [, group] of footprintLayers) map.removeLayer(group);
  footprintLayers.clear();
}

/**
 * Redraws footprints for a given satellite list.
 * Call with an empty array or enabled=false to clear.
 *
 * @param {Array}   satList   Satellite objects to draw footprints for
 * @param {boolean} enabled   Whether footprints are toggled on
 */
export function updateFootprints(satList, enabled) {
  clearFootprints();
  if (!enabled || !satList.length) return;

  satList.forEach((sat, idx) => {
    const color = FOOTPRINT_COLORS[idx % FOOTPRINT_COLORS.length];
    const boundary = footprintBoundaryPoints(sat, 720);
    if (!boundary || boundary.length < 3) return;

    const unwrapped = _unwrapRing(boundary);
    const layers    = [];

    const fill = L.polygon(unwrapped, {
      pane: FOOTPRINT_PANE,
      color, weight: 1, opacity: 0,
      fillColor: color, fillOpacity: 0.07,
      interactive: false
    }).addTo(map);

    const outline = L.polyline(unwrapped, {
      pane: FOOTPRINT_PANE,
      color, weight: 2, opacity: 0.85,
      smoothFactor: 1, interactive: false
    }).addTo(map);

    layers.push(fill, outline);

    footprintLayers.set(sat.name, L.layerGroup(layers).addTo(map));
  });
}

// ── Internal ───────────────────────────────────────────
function _unwrapRing(ring) {
  if (!ring.length) return ring;
  const out = [ring[0]];
  let prevLon = ring[0][1];
  for (let i = 1; i < ring.length; i++) {
    let lon = ring[i][1];
    while (lon - prevLon >  180) lon -= 360;
    while (lon - prevLon < -180) lon += 360;
    out.push([ring[i][0], lon]);
    prevLon = lon;
  }
  return out;
}
