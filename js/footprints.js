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

/**
 * Shift every point in an unwrapped ring by a uniform longitude offset
 * so the footprint lands on the same world copy as its satellite marker.
 */
function _shiftRing(ring, offset) {
  if (offset === 0) return ring;
  return ring.map(([lat, lon]) => [lat, lon + offset]);
}

/**
 * Compute the longitude shift needed to place the footprint on the
 * world copy nearest to the reference longitude (observer or map center).
 * Mirrors the nearestLon logic in markers.js and lines.js.
 */
function _nearestOffset(refLon, satCenterLon) {
  // Find where the sat marker was placed (nearest copy to refLon)
  let delta = satCenterLon - refLon;
  while (delta >  180) delta -= 360;
  while (delta < -180) delta += 360;
  const nearestSatLon = refLon + delta;
  // The offset is how far that copy is from the canonical centerLon
  return nearestSatLon - satCenterLon;
}

// ── Public API ─────────────────────────────────────────
export function clearFootprints() {
  for (const [, group] of footprintLayers) map.removeLayer(group);
  footprintLayers.clear();
}

/**
 * Redraws footprints for a given satellite list.
 *
 * @param {Array}        satList  Satellite objects (with centerLon)
 * @param {boolean}      enabled  Whether footprints are toggled on
 * @param {object|null}  obs      Observer { lat, lon } or null
 */
export function updateFootprints(satList, enabled, obs) {
  clearFootprints();
  if (!enabled || !satList.length) return;

  const refLon = obs ? obs.lon : map.getCenter().lng;

  satList.forEach((sat, idx) => {
    const color    = FOOTPRINT_COLORS[idx % FOOTPRINT_COLORS.length];
    const boundary = footprintBoundaryPoints(sat, 720);
    if (!boundary || boundary.length < 3) return;

    const offset   = _nearestOffset(refLon, sat.centerLon);
    const ring     = _shiftRing(_unwrapRing(boundary), offset);
    const layers   = [];

    const fill = L.polygon(ring, {
      pane: FOOTPRINT_PANE,
      color, weight: 1, opacity: 0,
      fillColor: color, fillOpacity: 0.07,
      noWrap: true, interactive: false
    }).addTo(map);

    const outline = L.polyline(ring, {
      pane: FOOTPRINT_PANE,
      color, weight: 2, opacity: 0.85,
      smoothFactor: 1, noWrap: true, interactive: false
    }).addTo(map);

    layers.push(fill, outline);
    footprintLayers.set(sat.name, L.layerGroup(layers).addTo(map));
  });
}
