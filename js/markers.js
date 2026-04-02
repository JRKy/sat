// ======================================================
// markers.js
// Satellite markers and zoom-aware labels.
// (User marker lives in map.js to avoid circular imports.)
// ======================================================

import { map, SAT_PANE, LABEL_PANE } from "./map.js";
import { LABEL_ZOOM_THRESHOLD } from "./state.js";

// ── Icon helpers ───────────────────────────────────────
function materialIcon(symbol, className = "", size = 28) {
  return L.divIcon({
    className,
    html: `<span class="material-symbols-rounded" style="font-size:${size}px">${symbol}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

const satelliteIcon = materialIcon("satellite_alt", "sat-marker", 28);

// ── Label visibility ───────────────────────────────────
// All labels are collected here so we can show/hide on zoom.
const allLabels = new Set();

function updateLabelVisibility() {
  const visible = map.getZoom() >= LABEL_ZOOM_THRESHOLD;
  for (const label of allLabels) {
    const el = label.getElement();
    if (el) el.style.display = visible ? "" : "none";
  }
}

map.on("zoomend", updateLabelVisibility);

// ── Nearest-copy longitude ─────────────────────────────
// Place the marker at whichever world copy of centerLon is
// closest to the observer (or map center if no observer).
// Mirrors the same logic used in lines.js.
function nearestLon(referenceLon, satLon) {
  let delta = satLon - referenceLon;
  while (delta >  180) delta -= 360;
  while (delta < -180) delta += 360;
  return referenceLon + delta;
}

/**
 * Creates a marker + label for the satellite at the world copy
 * nearest to the observer. Returns an array of { marker, label }.
 *
 * @param {object}      sat  Satellite object (centerLon, name, …)
 * @param {object|null} obs  Observer { lat, lon } or null
 */
export function createWrappedSatelliteMarkers(sat, obs) {
  // Use observer lon if available, otherwise map center lon
  const refLon = obs ? obs.lon : map.getCenter().lng;
  const lon    = nearestLon(refLon, sat.centerLon);

  const marker = L.marker([0, lon], {
    icon: satelliteIcon,
    pane: SAT_PANE,
    title: sat.name
  });

  const labelHtml = `<div class="sat-label"><span class="name">${sat.name}</span></div>`;
  const LABEL_W = 90;
  const LABEL_H = 22;

  const label = L.marker([0, lon], {
    icon: L.divIcon({
      className:  "",
      html:       labelHtml,
      iconSize:   [LABEL_W, LABEL_H],
      iconAnchor: [LABEL_W / 2, -16]
    }),
    interactive: false,
    pane: LABEL_PANE
  });

  return [{ marker, label }];
}

// ── Bulk add / remove ──────────────────────────────────
export function addSatelliteToMap(wrappedSet) {
  const showLabels = map.getZoom() >= LABEL_ZOOM_THRESHOLD;
  for (const w of wrappedSet) {
    w.marker.addTo(map);
    w.label.addTo(map);
    allLabels.add(w.label);
    // Apply initial visibility immediately after adding
    const el = w.label.getElement();
    if (el && !showLabels) el.style.display = "none";
  }
}

export function removeSatelliteFromMap(wrappedSet) {
  for (const w of wrappedSet) {
    allLabels.delete(w.label);
    map.removeLayer(w.marker);
    map.removeLayer(w.label);
  }
}
