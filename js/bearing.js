// ======================================================
// bearing.js
// Short bearing ray drawn from the observer pin in the
// direction of the selected satellite. Helps physically
// orient a dish — "point this way on the ground."
//
// The ray is ~500 km long in the true-azimuth direction
// and is drawn in a dedicated pane above look-angle lines.
// ======================================================

import { map, BEARING_PANE } from "./map.js";
import { toRad, toDeg } from "./geometry.js";

const RAY_KM   = 600;   // visual length of bearing ray
const R_EARTH  = 6371;

let _rayLayer  = null;
let _obsBubble = null;

// ── Public API ─────────────────────────────────────────

/**
 * Draw (or update) the bearing ray from obs toward sat.az.
 * @param {{ lat, lon }} obs
 * @param {number}       az   True azimuth (degrees, 0 = North)
 * @param {string}       status  'good' | 'low' | 'bad'
 */
export function updateBearingRay(obs, az, status) {
  clearBearingRay();
  if (!obs) return;

  const tip  = _destinationPoint(obs.lat, obs.lon, az, RAY_KM);
  const color = _statusColor(status);

  // Dashed ray line
  _rayLayer = L.polyline(
    [[obs.lat, obs.lon], [tip.lat, tip.lon]],
    {
      pane:      BEARING_PANE,
      color,
      weight:    3,
      opacity:   0.9,
      dashArray: "8 6",
      lineCap:   "round",
    }
  ).addTo(map);

  // Small arrowhead at the tip using a rotated divIcon
  const arrowHtml = `
    <svg viewBox="0 0 20 20" width="20" height="20"
         style="transform:rotate(${az}deg); display:block;">
      <polygon points="10,0 18,18 10,13 2,18"
               fill="${color}" opacity="0.9"/>
    </svg>`;

  _obsBubble = L.marker([tip.lat, tip.lon], {
    icon: L.divIcon({
      className:  "",
      html:       arrowHtml,
      iconSize:   [20, 20],
      iconAnchor: [10, 10],
    }),
    pane:        BEARING_PANE,
    interactive: false,
  }).addTo(map);
}

export function clearBearingRay() {
  if (_rayLayer)  { map.removeLayer(_rayLayer);  _rayLayer  = null; }
  if (_obsBubble) { map.removeLayer(_obsBubble); _obsBubble = null; }
}

// ── Helpers ────────────────────────────────────────────

/**
 * Destination point given start, bearing (degrees), distance (km).
 * Uses spherical Earth (Haversine inverse).
 */
function _destinationPoint(lat, lon, bearing, distKm) {
  const φ1 = toRad(lat);
  const λ1 = toRad(lon);
  const θ  = toRad(bearing);
  const δ  = distKm / R_EARTH;

  const sinφ2 = Math.sin(φ1) * Math.cos(δ) +
                Math.cos(φ1) * Math.sin(δ) * Math.cos(θ);
  const φ2    = Math.asin(sinφ2);
  const λ2    = λ1 + Math.atan2(
    Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
    Math.cos(δ) - Math.sin(φ1) * sinφ2
  );

  return { lat: toDeg(φ2), lon: toDeg(λ2) };
}

const STATUS_COLORS = {
  good: { light: "#1e8e3e", dark: "#30d158" },
  low:  { light: "#f29900", dark: "#ffd60a" },
  bad:  { light: "#d93025", dark: "#ff453a" },
};

function _statusColor(status) {
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return (STATUS_COLORS[status] ?? STATUS_COLORS.bad)[dark ? "dark" : "light"];
}
