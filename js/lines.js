// ======================================================
// lines.js
// Great-circle look-angle lines from the observer pin
// to each visible satellite. Lines are colored by status
// and sit in their own pane beneath the satellite icons.
// ======================================================

import { map, LINE_PANE } from "./map.js";

// Status → stroke color (matched to CSS vars at runtime via getComputedStyle
// would require a DOM reference; use literal values that mirror the CSS tokens
// for both light and dark — we read them fresh on each draw).
const STATUS_COLORS = {
  good: { light: "#1e8e3e", dark: "#30d158" },
  low:  { light: "#f29900", dark: "#ffd60a" },
  bad:  { light: "#d93025", dark: "#ff453a" },
};

function statusColor(status) {
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return (STATUS_COLORS[status] ?? STATUS_COLORS.bad)[dark ? "dark" : "light"];
}

// Active line layers: id → L.Polyline (central copy only; we draw one line,
// Leaflet's worldCopyJump handles visual continuity on panned maps).
let lineLayers = {};

// ── Public API ─────────────────────────────────────────

/**
 * Redraws all look-angle lines from the observer to each satellite.
 * Call whenever observer location or visible satellite list changes.
 *
 * @param {Array}       satList  Visible satellite objects (with az/el/status)
 * @param {{ lat, lon }} obs     Observer position, or null to clear
 */
export function updateLines(satList, obs) {
  clearLines();
  if (!obs || !satList.length) return;

  for (const sat of satList) {
    const color   = statusColor(sat.status);
    const isDashed = sat.status === "bad";

    // Great-circle line: observer → sub-satellite point (equator, centerLon)
    // Leaflet.Geodesic handles the spherical interpolation automatically.
    // Fall back to a plain polyline if the plugin isn't loaded.
    const obsLatLng = L.latLng(obs.lat, obs.lon);
    const satLatLng = L.latLng(0, sat.centerLon);

    let line;

    if (typeof L.geodesic === "function") {
      line = L.geodesic([obsLatLng, satLatLng], {
        pane:        LINE_PANE,
        color,
        weight:      sat.status === "good" ? 2 : 1.5,
        opacity:     sat.status === "bad"  ? 0.35 : 0.65,
        dashArray:   isDashed ? "5 6" : null,
        steps:       4,       // geodesic interpolation steps
        wrap:        false,
      });
    } else {
      line = L.polyline([obsLatLng, satLatLng], {
        pane:      LINE_PANE,
        color,
        weight:    sat.status === "good" ? 2 : 1.5,
        opacity:   sat.status === "bad"  ? 0.35 : 0.65,
        dashArray: isDashed ? "5 6" : null,
      });
    }

    line.addTo(map);
    lineLayers[sat.id] = line;
  }
}

/**
 * Removes all look-angle lines from the map.
 */
export function clearLines() {
  for (const id in lineLayers) {
    map.removeLayer(lineLayers[id]);
  }
  lineLayers = {};
}
