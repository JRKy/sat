// ======================================================
// events.js
// Satellite selection, highlighting, panel logic,
// footprint toggle, cutoff filtering, map sync
// ======================================================

import { map } from "./map.js";
import {
  createWrappedSatelliteMarkers,
  addSatelliteToMap,
  removeSatelliteFromMap
} from "./markers.js";

import { updateTable, clearTableSelection } from "./table.js";

// ======================================================
// INTERNAL STATE
// ======================================================

let satellites = [];              // full satellite list
let activeWrapped = {};           // id → wrapped marker set
let selectedId = null;
let showFootprints = false;
let elevationCutoff = 0;

// DOM elements
const panel = document.getElementById("sat-panel");
const backdrop = document.getElementById("sat-backdrop");
const panelClose = document.getElementById("panel-close");
const panelPin = document.getElementById("panel-pin");
const cutoffSlider = document.getElementById("cutoff");
const cutoffValue = document.getElementById("cutoff-value");
const footprintToggle = document.getElementById("footprint-toggle");

// ======================================================
// PANEL LOGIC
// ======================================================

function openPanel() {
  panel.classList.add("open");
  backdrop.classList.add("open");
  document.body.classList.add("panel-open");
}

function closePanel() {
  if (panel.classList.contains("pinned")) return;
  panel.classList.remove("open");
  backdrop.classList.remove("open");
  document.body.classList.remove("panel-open");
}

panelClose.addEventListener("click", closePanel);
backdrop.addEventListener("click", closePanel);

panelPin.addEventListener("click", () => {
  panel.classList.toggle("pinned");
});

// ======================================================
// FOOTPRINT TOGGLE
// ======================================================

footprintToggle.addEventListener("change", () => {
  showFootprints = footprintToggle.checked;
  refreshSatellites();
});

// ======================================================
// ELEVATION CUTOFF
// ======================================================

cutoffSlider.addEventListener("input", () => {
  elevationCutoff = Number(cutoffSlider.value);
  cutoffValue.textContent = elevationCutoff;
  refreshSatellites();
});

// ======================================================
// SATELLITE FILTERING
// ======================================================

function filteredSatellites() {
  return satellites.filter((s) => s.el >= elevationCutoff);
}

// ======================================================
// SATELLITE RENDERING
// ======================================================

function clearAllSatellites() {
  for (const id in activeWrapped) {
    removeSatelliteFromMap(activeWrapped[id]);
  }
  activeWrapped = {};
}

function renderSatellites() {
  clearAllSatellites();

  const list = filteredSatellites();

  for (const sat of list) {
    const wrapped = createWrappedSatelliteMarkers(sat);
    activeWrapped[sat.id] = wrapped;
    addSatelliteToMap(wrapped);
  }

  updateTable(list);
}

// ======================================================
// SELECTION + HIGHLIGHT
// ======================================================

export function highlightSatellite(id) {
  selectedId = id;

  // Open panel if not already
  openPanel();

  // Highlight markers
  for (const sid in activeWrapped) {
    const wrapped = activeWrapped[sid];
    for (const w of wrapped) {
      if (sid === id) {
        w.marker._icon?.classList.add("selected");
      } else {
        w.marker._icon?.classList.remove("selected");
      }
    }
  }
}

export function clearSatelliteHighlight() {
  selectedId = null;

  for (const sid in activeWrapped) {
    const wrapped = activeWrapped[sid];
    for (const w of wrapped) {
      w.marker._icon?.classList.remove("selected");
    }
  }
}

// ======================================================
// MAP CLICK → CLEAR SELECTION
// ======================================================

map.on("click", () => {
  clearSatelliteHighlight();
  clearTableSelection();
});

// ======================================================
// PUBLIC API
// ======================================================

/**
 * Initializes the event system with the full satellite list.
 */
export function initEvents(satList) {
  satellites = satList;
  renderSatellites();
}

/**
 * Re-renders satellites after filtering or toggles.
 */
export function refreshSatellites() {
  renderSatellites();

  // Re-highlight selected satellite if still visible
  if (selectedId && activeWrapped[selectedId]) {
    highlightSatellite(selectedId);
  } else {
    clearSatelliteHighlight();
    clearTableSelection();
  }
}