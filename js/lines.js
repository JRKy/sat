// ======================================================
// lines.js
// Look-angle lines from the observer pin to each visible
// satellite, colored by status.
//
// WHY NOT Leaflet.Geodesic:
//   Geodesic libraries pick between the two arcs of a great
//   circle by convention, and when Δλ is large (e.g. Hawaii
//   → a sat near the dateline) they can take the long way
//   round. For a visual connector to a GEO sat on the equator
//   a straight Mercator line to the nearest world copy is
//   clearer, faster, and always takes the short path.
// ======================================================

import { map, LINE_PANE } from "./map.js";

const STATUS_COLORS = {
  good: { light: "#1e8e3e", dark: "#30d158" },
  low:  { light: "#f29900", dark: "#ffd60a" },
  bad:  { light: "#d93025", dark: "#ff453a" },
};

function statusColor(status) {
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return (STATUS_COLORS[status] ?? STATUS_COLORS.bad)[dark ? "dark" : "light"];
}

/**
 * Adjust satellite longitude to the nearest world copy relative to the
 * observer so the line always takes the short path across the map.
 *
 * Example — Hawaii (−158°) → MUOS-2 (172°):
 *   raw Δλ = 172 − (−158) = 330° → would draw eastward across the whole map
 *   adjusted: delta normalised to −30° → satLon = −158 + (−30) = −188° ✓
 *   Leaflet renders −188° as the western world-copy of 172°, short arc drawn.
 */
function nearestSatLon(obsLon, satLon) {
  let delta = satLon - obsLon;
  while (delta >  180) delta -= 360;
  while (delta < -180) delta += 360;
  return obsLon + delta;
}

let lineLayers = {};

// ── Public API ─────────────────────────────────────────

export function updateLines(satList, obs) {
  clearLines();
  if (!obs || !satList.length) return;

  for (const sat of satList) {
    const color    = statusColor(sat.status);
    const isDashed = sat.status === "bad";
    const satLon   = nearestSatLon(obs.lon, sat.centerLon);

    const line = L.polyline(
      [[obs.lat, obs.lon], [0, satLon]],
      {
        pane:      LINE_PANE,
        color,
        weight:    sat.status === "good" ? 2 : 1.5,
        opacity:   sat.status === "bad"  ? 0.35 : 0.65,
        dashArray: isDashed ? "5 6" : null,
        noWrap:    true,  // don't re-wrap our already-adjusted coords
      }
    );

    line.addTo(map);
    lineLayers[sat.id] = line;
  }
}

export function clearLines() {
  for (const id in lineLayers) map.removeLayer(lineLayers[id]);
  lineLayers = {};
}
