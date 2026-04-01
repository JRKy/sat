// ======================================================
// events.js
// Orchestrates all user interactions:
//   - observer location changes → recompute az/el/status
//   - satellite selection / highlight
//   - panel open/close/pin
//   - footprint toggle
//   - elevation cutoff filter
//   - map click deselection
// ======================================================

import { map, onLocationChange } from "./map.js";
import {
  createWrappedSatelliteMarkers,
  addSatelliteToMap,
  removeSatelliteFromMap
} from "./markers.js";
import { updateTable, clearTableSelection } from "./table.js";
import { updateFootprints, clearFootprints } from "./footprints.js";
import { computeAzEl, elToStatus } from "./geometry.js";
import {
  getSatellites, setSatellites,
  getObserver, setObserver, hasObserver,
  getSelectedId, setSelectedId,
  getShowFootprints, setShowFootprints,
  getElevationCutoff, setElevationCutoff,
  loadPersistedFootprint, saveFootprint,
  loadPersistedPinned, savePinned
} from "./state.js";

// ── DOM refs ───────────────────────────────────────────
const panel          = document.getElementById("sat-panel");
const backdrop       = document.getElementById("sat-backdrop");
const panelClose     = document.getElementById("panel-close");
const panelPin       = document.getElementById("panel-pin");
const cutoffSlider   = document.getElementById("cutoff");
const cutoffValue    = document.getElementById("cutoff-value");
const footprintToggle= document.getElementById("footprint-toggle");
const observerInfo   = document.getElementById("observer-info");
const selectedInfo   = document.getElementById("selected-info");

// ── Active marker store ────────────────────────────────
let activeWrapped = {}; // id → wrappedSet

// ── Panel ──────────────────────────────────────────────
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
  const pinned = panel.classList.toggle("pinned");
  savePinned(pinned);
  // Update pin icon fill
  panelPin.querySelector(".material-symbols-rounded").style.fontVariationSettings =
    pinned ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"
           : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24";
});

// Restore pinned state
if (loadPersistedPinned()) {
  panel.classList.add("pinned", "open");
  backdrop.classList.add("open");
  document.body.classList.add("panel-open");
  panelPin.querySelector(".material-symbols-rounded").style.fontVariationSettings =
    "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24";
}

// ── Observer info display ──────────────────────────────
function renderObserverInfo() {
  const obs = getObserver();
  if (!obs) {
    observerInfo.innerHTML = `
      <div class="info-card hint">
        <span class="material-symbols-rounded">touch_app</span>
        <span>Click the map or search to set your location</span>
      </div>`;
    return;
  }
  const latDir = obs.lat >= 0 ? "N" : "S";
  const lonDir = obs.lon >= 0 ? "E" : "W";
  observerInfo.innerHTML = `
    <div class="info-card observer">
      <span class="material-symbols-rounded">location_on</span>
      <div>
        <div class="info-label">Observer</div>
        <div class="info-value">${Math.abs(obs.lat).toFixed(4)}°${latDir}, ${Math.abs(obs.lon).toFixed(4)}°${lonDir}</div>
      </div>
    </div>`;
}

// ── Selected satellite detail ──────────────────────────
function renderSelectedInfo(sat) {
  if (!sat) {
    selectedInfo.innerHTML = "";
    return;
  }

  const obs = getObserver();
  if (!obs) {
    selectedInfo.innerHTML = `
      <div class="info-card">
        <span class="material-symbols-rounded">satellite_alt</span>
        <div>
          <div class="info-label">${sat.name}</div>
          <div class="info-value muted">Set location for pointing angles</div>
        </div>
      </div>`;
    return;
  }

  const compassHtml = buildCompassSvg(sat.az);
  const statusClass = `status-${sat.status}`;

  selectedInfo.innerHTML = `
    <div class="detail-card">
      <div class="detail-header">
        <span class="material-symbols-rounded">satellite_alt</span>
        <div>
          <div class="detail-name">${sat.name}</div>
          <div class="detail-lon">${sat.centerLon.toFixed(1)}° longitude</div>
        </div>
        <span class="status-pill ${statusClass}">${sat.status.toUpperCase()}</span>
      </div>
      <div class="detail-angles">
        <div class="angle-row">
          ${compassHtml}
          <div class="angle-values">
            <div class="angle-item">
              <div class="angle-label">Azimuth</div>
              <div class="angle-val">${sat.az.toFixed(1)}°</div>
            </div>
            <div class="angle-item">
              <div class="angle-label">Elevation</div>
              <div class="angle-val ${sat.el < 0 ? "bad" : sat.el < 10 ? "low-color" : "good-color"}">${sat.el.toFixed(1)}°</div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

function buildCompassSvg(az) {
  const r    = 30;
  const cx   = 36, cy = 36;
  const azR  = (az - 90) * Math.PI / 180; // rotate so 0° = North = up
  // needle tip
  const tx = cx + r * Math.cos(azR);
  const ty = cy + r * Math.sin(azR);
  // needle tail
  const bx = cx - 16 * Math.cos(azR);
  const by = cy - 16 * Math.sin(azR);

  return `
    <svg class="compass" viewBox="0 0 72 72" width="72" height="72">
      <circle cx="${cx}" cy="${cy}" r="33" class="compass-ring"/>
      <text x="${cx}" y="8"  class="compass-dir" text-anchor="middle">N</text>
      <text x="${cx}" y="69" class="compass-dir" text-anchor="middle">S</text>
      <text x="5"    y="${cy+4}" class="compass-dir" text-anchor="middle">W</text>
      <text x="67"   y="${cy+4}" class="compass-dir" text-anchor="middle">E</text>
      <line x1="${bx}" y1="${by}" x2="${tx}" y2="${ty}" class="compass-needle"/>
      <circle cx="${tx}" cy="${ty}" r="3" class="compass-tip"/>
      <circle cx="${cx}" cy="${cy}" r="3" class="compass-center"/>
    </svg>`;
}

// ── Az / El computation ────────────────────────────────
function recomputeAllAzEl() {
  const obs  = getObserver();
  const sats = getSatellites();

  for (const sat of sats) {
    if (!obs) {
      sat.az     = 0;
      sat.el     = 0;
      sat.status = "bad";
    } else {
      const { az, el } = computeAzEl(obs.lat, obs.lon, sat.centerLon, sat.alt_km ?? 35786);
      sat.az     = az;
      sat.el     = el;
      sat.status = elToStatus(el);
    }
  }
}

// ── Filtering ──────────────────────────────────────────
function filteredSatellites() {
  const cutoff = getElevationCutoff();
  const obs    = getObserver();
  // Only apply cutoff filter once observer is set (otherwise everything would hide)
  if (!obs) return getSatellites();
  return getSatellites().filter(s => s.el >= cutoff);
}

// ── Rendering ──────────────────────────────────────────
function clearAllMarkers() {
  for (const id in activeWrapped) removeSatelliteFromMap(activeWrapped[id]);
  activeWrapped = {};
}

function renderSatellites() {
  clearAllMarkers();

  const visible = filteredSatellites();

  for (const sat of visible) {
    const wrapped = createWrappedSatelliteMarkers(sat);
    activeWrapped[sat.id] = wrapped;
    addSatelliteToMap(wrapped);

    // Click handler on each wrapped marker
    for (const w of wrapped) {
      w.marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        selectSatellite(sat.id);
      });
    }
  }

  updateTable(visible);
  updateFootprints(visible, getShowFootprints());
}

// ── Selection ──────────────────────────────────────────
function selectSatellite(id) {
  setSelectedId(id);
  openPanel();
  _applyHighlight(id);

  const sat = getSatellites().find(s => s.id === id);
  renderSelectedInfo(sat ?? null);
}

export function highlightSatellite(id) { selectSatellite(id); }

export function clearSatelliteHighlight() {
  setSelectedId(null);
  _applyHighlight(null);
  renderSelectedInfo(null);
}

function _applyHighlight(id) {
  for (const sid in activeWrapped) {
    for (const w of activeWrapped[sid]) {
      const icon = w.marker._icon;
      if (!icon) continue;
      if (sid === id) icon.classList.add("selected");
      else            icon.classList.remove("selected");
    }
  }
}

// ── Map click → deselect ───────────────────────────────
// Note: map.js also fires setUserLocation on click.
// Both handlers run; order is: map.js first, then this.
map.on("click", () => {
  clearSatelliteHighlight();
  clearTableSelection();
  renderObserverInfo(); // refresh after location may have changed
});

// ── Location change callback ───────────────────────────
onLocationChange((lat, lon) => {
  setObserver({ lat, lon, heightKm: 0 });
  recomputeAllAzEl();
  renderObserverInfo();
  refreshSatellites();

  // If a satellite is selected, refresh its detail card
  const selId = getSelectedId();
  if (selId) {
    const sat = getSatellites().find(s => s.id === selId);
    renderSelectedInfo(sat ?? null);
  }
});

// ── Controls ───────────────────────────────────────────
footprintToggle.addEventListener("change", () => {
  const v = footprintToggle.checked;
  setShowFootprints(v);
  saveFootprint(v);
  updateFootprints(filteredSatellites(), v);
});

cutoffSlider.addEventListener("input", () => {
  const v = Number(cutoffSlider.value);
  setElevationCutoff(v);
  cutoffValue.textContent = v;
  refreshSatellites();
});

// Restore persisted footprint toggle
const persistedFootprint = loadPersistedFootprint();
if (persistedFootprint) {
  setShowFootprints(true);
  footprintToggle.checked = true;
}

// ── Public API ─────────────────────────────────────────
export function initEvents(satList) {
  setSatellites(satList);
  renderObserverInfo();
  renderSatellites();
}

export function refreshSatellites() {
  renderSatellites();
  const selId = getSelectedId();
  if (selId && activeWrapped[selId]) {
    _applyHighlight(selId);
  } else {
    clearSatelliteHighlight();
    clearTableSelection();
  }
}
