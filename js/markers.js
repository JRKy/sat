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

// ── Wrapped satellite markers ──────────────────────────
// Single canonical position only — Leaflet's worldCopyJump
// and tile rendering handle visual continuity when panning.
const WORLD_OFFSETS = [0];

/**
 * Creates wrapped markers for all world copies.
 * Returns an array of { marker, label } objects.
 */
export function createWrappedSatelliteMarkers(sat) {
  const wrapped = [];

  for (const offset of WORLD_OFFSETS) {
    const lon = sat.centerLon + offset;

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
        className: "",
        html: labelHtml,
        iconSize:   [LABEL_W, LABEL_H],
        iconAnchor: [LABEL_W / 2, -16]  // centered horizontally, below the sat icon
      }),
      interactive: false,
      pane: LABEL_PANE
    });

    wrapped.push({ marker, label });
  }

  return wrapped;
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
