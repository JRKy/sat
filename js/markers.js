// ======================================================
// markers.js
// Satellite markers, labels, and user marker
// ======================================================

import { map, SAT_PANE, LABEL_PANE, USER_PANE } from "./map.js";

// ======================================================
// ICON HELPERS
// ======================================================

/**
 * Creates a Material Symbol divIcon.
 */
function materialIcon(symbol, className = "", size = 28) {
  return L.divIcon({
    className,
    html: `<span class="material-symbols-rounded" style="font-size:${size}px">${symbol}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

// Satellite icon
const satelliteIcon = materialIcon("satellite_alt", "sat-marker", 28);

// User map pin icon
const userIcon = materialIcon("location_on", "user-marker", 36);

// ======================================================
// USER MARKER
// ======================================================

/**
 * Creates the user marker (but does NOT add it to the map).
 */
export function createUserMarker(latlng) {
  return L.marker(latlng, {
    icon: userIcon,
    pane: USER_PANE
  });
}

// ======================================================
// SATELLITE MARKERS + LABELS
// ======================================================

/**
 * Creates a satellite marker at a given lat/lon.
 * Satellite center is always lat = 0, lon = centerLon.
 */
export function createSatelliteMarker(sat) {
  const latlng = [0, sat.centerLon];

  const marker = L.marker(latlng, {
    icon: satelliteIcon,
    pane: SAT_PANE,
    title: sat.name
  });

  return marker;
}

/**
 * Creates a vertical chip-style label for a satellite.
 */
export function createSatelliteLabel(sat) {
  const latlng = [0, sat.centerLon];

  const labelHtml = `
    <div class="sat-label">
      <span class="name">${sat.name}</span>
      <span class="center">${sat.centerLon.toFixed(1)}°</span>
    </div>
  `;

  const label = L.marker(latlng, {
    icon: L.divIcon({
      className: "",
      html: labelHtml,
      iconSize: null
    }),
    interactive: false,
    pane: LABEL_PANE
  });

  return label;
}

// ======================================================
// WORLD-WRAPPING (duplicate markers at ±360°)
// ======================================================

/**
 * Returns an array of lon offsets to duplicate markers across world copies.
 */
function worldWrapOffsets() {
  return [-360, 0, 360];
}

/**
 * Creates wrapped markers for a satellite.
 * Returns an array of { marker, label } objects.
 */
export function createWrappedSatelliteMarkers(sat) {
  const wrapped = [];

  for (const offset of worldWrapOffsets()) {
    const lon = sat.centerLon + offset;

    const marker = L.marker([0, lon], {
      icon: satelliteIcon,
      pane: SAT_PANE,
      title: sat.name
    });

    const labelHtml = `
      <div class="sat-label">
        <span class="name">${sat.name}</span>
        <span class="center">${sat.centerLon.toFixed(1)}°</span>
      </div>
    `;

    const label = L.marker([0, lon], {
      icon: L.divIcon({
        className: "",
        html: labelHtml,
        iconSize: null
      }),
      interactive: false,
      pane: LABEL_PANE
    });

    wrapped.push({ marker, label });
  }

  return wrapped;
}

// ======================================================
// BULK ADD / REMOVE HELPERS
// ======================================================

/**
 * Adds all wrapped satellite markers + labels to the map.
 */
export function addSatelliteToMap(wrappedSet) {
  for (const w of wrappedSet) {
    w.marker.addTo(map);
    w.label.addTo(map);
  }
}

/**
 * Removes all wrapped satellite markers + labels from the map.
 */
export function removeSatelliteFromMap(wrappedSet) {
  for (const w of wrappedSet) {
    map.removeLayer(w.marker);
    map.removeLayer(w.label);
  }
}