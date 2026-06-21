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
import { nearestWrappedLon } from "./geo-wrap.js";
import { statusColor } from "./status.js";

let lineLayers = {};

// ── Public API ─────────────────────────────────────────

export function updateLines(satList, obs) {
  clearLines();
  if (!obs || !satList.length) return;

  for (const sat of satList) {
    const color    = statusColor(sat.status);
    const isDashed = sat.status === "bad";
    const satLon   = nearestWrappedLon(obs.lon, sat.centerLon);

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
