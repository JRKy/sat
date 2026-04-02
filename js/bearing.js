// ======================================================
// bearing.js
// Bearing ray from the observer toward the selected
// satellite — shows which direction to point a dish.
// Drawn as a dashed polyline + arrowhead polygon,
// both in BEARING_PANE so they sit above look-angle
// lines but below satellite icons.
// ======================================================

import { map, BEARING_PANE } from "./map.js";
import { toRad, toDeg } from "./geometry.js";

const RAY_KM  = 1500; // visible at world zoom (~13° arc)
const R_EARTH = 6371;

let _layers = []; // all active Leaflet layers for this ray

// ── Public API ─────────────────────────────────────────

export function updateBearingRay(obs, az, status) {
  clearBearingRay();
  if (!obs) return;

  const color = _statusColor(status);
  const tip   = _dest(obs.lat, obs.lon, az, RAY_KM);

  // Dashed shaft
  _layers.push(
    L.polyline([[obs.lat, obs.lon], [tip.lat, tip.lon]], {
      pane:      BEARING_PANE,
      color,
      weight:    2.5,
      opacity:   0.85,
      dashArray: "10 7",
    }).addTo(map)
  );

  // Arrowhead — small triangle at tip, oriented along the bearing.
  // Build three points relative to tip in lat/lon space.
  const HEAD_KM  = 60;  // length of arrowhead
  const WING_KM  = 30;  // half-width of arrowhead base
  const tipPt    = tip;
  const basePt   = _dest(tip.lat, tip.lon, (az + 180) % 360, HEAD_KM);
  const leftPt   = _dest(basePt.lat, basePt.lon, (az - 90 + 360) % 360, WING_KM);
  const rightPt  = _dest(basePt.lat, basePt.lon, (az + 90) % 360, WING_KM);

  _layers.push(
    L.polygon(
      [[tipPt.lat, tipPt.lon], [leftPt.lat, leftPt.lon], [rightPt.lat, rightPt.lon]],
      {
        pane:        BEARING_PANE,
        color,
        fillColor:   color,
        fillOpacity: 0.9,
        weight:      0,
        interactive: false,
      }
    ).addTo(map)
  );
}

export function clearBearingRay() {
  _layers.forEach(l => map.removeLayer(l));
  _layers = [];
}

// ── Helpers ────────────────────────────────────────────

/**
 * Destination point from (lat, lon) along bearing (°) for distKm km.
 */
function _dest(lat, lon, bearing, distKm) {
  const φ1   = toRad(lat);
  const λ1   = toRad(lon);
  const θ    = toRad(bearing);
  const δ    = distKm / R_EARTH;
  const sinφ = Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ);
  const φ2   = Math.asin(sinφ);
  const λ2   = λ1 + Math.atan2(
    Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
    Math.cos(δ) - Math.sin(φ1) * sinφ
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
