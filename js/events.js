// ======================================================
// events.js
// Orchestrates all user interactions.
// ======================================================

import { map, onLocationChange } from "./map.js";
import {
  createWrappedSatelliteMarkers,
  addSatelliteToMap,
  removeSatelliteFromMap
} from "./markers.js";
import { updateTable, clearTableSelection, selectTableRow } from "./table.js";
import { updateFootprints } from "./footprints.js";
import { updateLines } from "./lines.js";
import { updateBearingRay, clearBearingRay } from "./bearing.js";
import { computeAzEl, elToStatus } from "./geometry.js";
import { getMagDeclination } from "./declination.js";
import {
  getSatellites, setSatellites,
  getObserver, setObserver, hasObserver,
  getSelectedId, setSelectedId,
  getShowFootprints, setShowFootprints,
  getElevationCutoff, setElevationCutoff,
  getElevUnit, setElevUnit,
  loadPersistedElevUnit, saveElevUnit,
  saveFootprint,
  loadPersistedWinPos, saveWinPos,
  loadPersistedWinMin, saveWinMin
} from "./state.js";

// ── DOM refs ───────────────────────────────────────────
const win             = document.getElementById("sat-window");
const winHeader       = document.getElementById("win-header");
const winMinimizeBtn  = document.getElementById("win-minimize");
const winTitleText    = document.getElementById("win-title-text");
const winTitlePill    = document.getElementById("win-title-pill");
const cutoffSlider    = document.getElementById("cutoff");
const cutoffValue     = document.getElementById("cutoff-value");
const footprintToggle = document.getElementById("footprint-toggle");
const elevUnitToggle  = document.getElementById("elev-unit-toggle");
const exportBtn       = document.getElementById("export-btn");
const observerInfo    = document.getElementById("observer-info");
const selectedInfo    = document.getElementById("selected-info");

// ── Active marker store ────────────────────────────────
let activeWrapped = {};

// ── Tab switching ──────────────────────────────────────
const tabBtns  = document.querySelectorAll(".tab-btn");
const tabPanes = document.querySelectorAll(".tab-pane");

export function selectTab(name) {
  tabBtns.forEach(b  => b.classList.toggle("active", b.dataset.tab === name));
  tabPanes.forEach(p => p.classList.toggle("active", p.id === `tab-${name}`));
}

tabBtns.forEach(btn => btn.addEventListener("click", () => selectTab(btn.dataset.tab)));

// ── Floating window: minimize / expand ────────────────
let _minimized = false;

export function minimizeWindow() {
  _minimized = true;
  win.classList.add("minimized");
  winMinimizeBtn.querySelector(".material-symbols-rounded").textContent = "open_in_full";
  winMinimizeBtn.title = "Expand";
  saveWinMin(true);
}

export function expandWindow() {
  _minimized = false;
  win.classList.remove("minimized");
  winMinimizeBtn.querySelector(".material-symbols-rounded").textContent = "remove";
  winMinimizeBtn.title = "Minimize";
  saveWinMin(false);
}

winMinimizeBtn.addEventListener("click", () => {
  if (_minimized) expandWindow(); else minimizeWindow();
});

// Also expand on header click when minimized
winHeader.addEventListener("click", (e) => {
  if (_minimized && e.target === winHeader || e.target.id === "win-title" ||
      e.target.id === "win-title-text" || e.target.id === "win-title-pill") {
    expandWindow();
  }
});

// Restore minimized state
if (loadPersistedWinMin()) minimizeWindow();

// ── Floating window: drag (desktop only) ──────────────
const isMobile = () => window.innerWidth <= 600;

let dragging = false;
let dragStartX = 0, dragStartY = 0;
let winStartX  = 0, winStartY  = 0;

function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

function applyPos(x, y) {
  const maxX = window.innerWidth  - win.offsetWidth;
  const maxY = window.innerHeight - win.offsetHeight;
  const cx = clamp(x, 0, Math.max(0, maxX));
  const cy = clamp(y, 0, Math.max(0, maxY));
  win.style.left = cx + "px";
  win.style.top  = cy + "px";
  win.style.right = "auto";
}

winHeader.addEventListener("mousedown", (e) => {
  if (isMobile()) return;
  if (e.target.closest(".icon-btn")) return; // don't drag when clicking buttons
  dragging   = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  const rect = win.getBoundingClientRect();
  winStartX  = rect.left;
  winStartY  = rect.top;
  win.classList.add("dragging");
  e.preventDefault();
});

document.addEventListener("mousemove", (e) => {
  if (!dragging) return;
  applyPos(winStartX + e.clientX - dragStartX, winStartY + e.clientY - dragStartY);
});

document.addEventListener("mouseup", () => {
  if (!dragging) return;
  dragging = false;
  win.classList.remove("dragging");
  const rect = win.getBoundingClientRect();
  saveWinPos(rect.left, rect.top);
});

// Touch drag
winHeader.addEventListener("touchstart", (e) => {
  if (isMobile()) return;
  if (e.target.closest(".icon-btn")) return;
  const t = e.touches[0];
  dragging   = true;
  dragStartX = t.clientX;
  dragStartY = t.clientY;
  const rect = win.getBoundingClientRect();
  winStartX  = rect.left;
  winStartY  = rect.top;
  e.preventDefault();
}, { passive: false });

document.addEventListener("touchmove", (e) => {
  if (!dragging) return;
  const t = e.touches[0];
  applyPos(winStartX + t.clientX - dragStartX, winStartY + t.clientY - dragStartY);
}, { passive: true });

document.addEventListener("touchend", () => {
  if (!dragging) return;
  dragging = false;
  const rect = win.getBoundingClientRect();
  saveWinPos(rect.left, rect.top);
});

// Restore or set default position
const savedPos = loadPersistedWinPos();
if (savedPos && !isMobile()) {
  applyPos(savedPos.x, savedPos.y);
}

// Re-clamp on resize
window.addEventListener("resize", () => {
  if (isMobile()) return;
  const rect = win.getBoundingClientRect();
  applyPos(rect.left, rect.top);
});

// ── Observer info ──────────────────────────────────────
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

// ── Window title bar summary ───────────────────────────
function updateWindowTitle(sat) {
  if (!sat || !hasObserver()) {
    winTitleText.textContent = "Satellite Tracker";
    winTitlePill.textContent = "";
    winTitlePill.className   = "";
    return;
  }
  winTitleText.textContent  = sat.name;
  winTitlePill.textContent  = sat.status.toUpperCase();
  winTitlePill.className    = `status-pill status-${sat.status}`;
}

// ── Selected satellite detail ──────────────────────────
function renderSelectedInfo(sat) {
  updateWindowTitle(sat);

  if (!sat) {
    selectedInfo.innerHTML = "";
    clearBearingRay();
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
    clearBearingRay();
    return;
  }

  updateBearingRay(obs, sat.az, sat.status);

  const compassHtml  = buildCompassSvg(sat.az, sat.magAz ?? sat.az);
  const statusClass  = `status-${sat.status}`;
  const unit         = getElevUnit();
  const elDisplay    = unit === "zenith"
    ? (90 - sat.el).toFixed(1) + "°"
    : sat.el.toFixed(1) + "°";
  const elColorClass = sat.el >= 20 ? "good-color" : sat.el >= 5 ? "low-color" : "bad";
  const decl         = sat.decl ?? 0;
  const declStr      = decl >= 0
    ? `${decl.toFixed(1)}° E`
    : `${Math.abs(decl).toFixed(1)}° W`;

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
              <div class="angle-label">True Az</div>
              <div class="angle-val">${sat.az.toFixed(1)}°</div>
            </div>
            <div class="angle-item">
              <div class="angle-label">Mag Az</div>
              <div class="angle-val mag-az">${(sat.magAz ?? sat.az).toFixed(1)}°</div>
            </div>
            <div class="angle-item">
              <div class="angle-label">${unit === "zenith" ? "Zenith" : "Elevation"}</div>
              <div class="angle-val ${elColorClass}">${elDisplay}</div>
            </div>
          </div>
        </div>
        <div class="decl-row">
          <span class="material-symbols-rounded decl-icon">explore</span>
          <span class="decl-text">Declination: <strong>${declStr}</strong></span>
        </div>
      </div>
    </div>`;
}

function buildCompassSvg(az, magAz) {
  const cx = 36, cy = 36, r = 26, rb = 14;

  function needle(angleDeg, color, tipClass) {
    const a   = (angleDeg - 90) * Math.PI / 180;
    const tx  = cx + r  * Math.cos(a), ty = cy + r  * Math.sin(a);
    const bx  = cx - rb * Math.cos(a), by = cy - rb * Math.sin(a);
    const wa  = 0.5, wl = 7;
    const w1x = tx - wl * Math.cos(a - wa), w1y = ty - wl * Math.sin(a - wa);
    const w2x = tx - wl * Math.cos(a + wa), w2y = ty - wl * Math.sin(a + wa);
    return `
      <line x1="${bx.toFixed(2)}" y1="${by.toFixed(2)}" x2="${tx.toFixed(2)}" y2="${ty.toFixed(2)}"
            stroke="${color}" stroke-width="2" stroke-linecap="round"/>
      <polygon points="${tx.toFixed(2)},${ty.toFixed(2)} ${w1x.toFixed(2)},${w1y.toFixed(2)} ${w2x.toFixed(2)},${w2y.toFixed(2)}"
               fill="${color}" class="${tipClass}"/>`;
  }

  return `
    <svg class="compass" viewBox="0 0 72 72" width="72" height="72">
      <circle cx="${cx}" cy="${cy}" r="33" class="compass-ring"/>
      <text x="${cx}" y="9"      class="compass-dir" text-anchor="middle">N</text>
      <text x="${cx}" y="70"     class="compass-dir" text-anchor="middle">S</text>
      <text x="5"    y="${cy+4}" class="compass-dir" text-anchor="middle">W</text>
      <text x="67"   y="${cy+4}" class="compass-dir" text-anchor="middle">E</text>
      <line x1="${cx}" y1="3"  x2="${cx}" y2="10"  class="compass-tick"/>
      <line x1="${cx}" y1="62" x2="${cx}" y2="69"  class="compass-tick"/>
      <line x1="3"  y1="${cy}" x2="10"  y2="${cy}" class="compass-tick"/>
      <line x1="62" y1="${cy}" x2="69"  y2="${cy}" class="compass-tick"/>
      ${needle(magAz, "var(--low)",    "compass-tip-mag")}
      ${needle(az,    "var(--accent)", "compass-tip-poly")}
      <circle cx="${cx}" cy="${cy}" r="3" class="compass-center"/>
    </svg>
    <div class="compass-legend">
      <span class="legend-dot" style="background:var(--accent)"></span><span>True</span>
      <span class="legend-dot" style="background:var(--low)"></span><span>Mag</span>
    </div>`;
}

// ── Az/El computation ──────────────────────────────────
function recomputeAllAzEl() {
  const obs  = getObserver();
  const sats = getSatellites();
  const decl = obs ? getMagDeclination(obs.lat, obs.lon) : 0;

  for (const sat of sats) {
    if (!obs) {
      sat.az = 0; sat.magAz = 0; sat.el = 0; sat.decl = 0; sat.status = "bad";
    } else {
      const r = computeAzEl(obs.lat, obs.lon, sat.centerLon, sat.alt_km ?? 35786, decl);
      sat.az = r.az; sat.magAz = r.magAz; sat.el = r.el; sat.decl = decl;
      sat.status = elToStatus(r.el);
    }
  }
}

// ── Filtering ──────────────────────────────────────────
function filteredSatellites() {
  const cutoff = getElevationCutoff();
  const obs    = getObserver();
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
    const wrapped = createWrappedSatelliteMarkers(sat, getObserver());
    activeWrapped[sat.id] = wrapped;
    addSatelliteToMap(wrapped);

    for (const w of wrapped) {
      w.marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        selectSatellite(sat.id);
      });
    }
  }

  updateTable(visible);
  updateFootprints(visible, getShowFootprints(), getObserver());
  updateLines(visible, getObserver());
}

// ── Selection ──────────────────────────────────────────
function selectSatellite(id) {
  setSelectedId(id);
  if (_minimized) expandWindow();
  selectTab("pointing");
  _applyHighlight(id);
  selectTableRow(id);

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
      icon.classList.toggle("selected", sid === id);
    }
  }
}

// ── Map click → deselect ──────────────────────────────
map.on("click", () => {
  clearSatelliteHighlight();
  clearTableSelection();
});

// ── Location change ────────────────────────────────────
onLocationChange((lat, lon) => {
  setObserver({ lat, lon, heightKm: 0 });
  recomputeAllAzEl();
  renderObserverInfo();
  refreshSatellites();

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
  updateFootprints(filteredSatellites(), v, getObserver());
});

cutoffSlider.addEventListener("input", () => {
  const v = Number(cutoffSlider.value);
  setElevationCutoff(v);
  cutoffValue.textContent = v;
  refreshSatellites();
});

elevUnitToggle.addEventListener("change", () => {
  const v = elevUnitToggle.checked ? "zenith" : "horizon";
  setElevUnit(v);
  saveElevUnit(v);
  const selId = getSelectedId();
  if (selId) {
    const sat = getSatellites().find(s => s.id === selId);
    if (sat) renderSelectedInfo(sat);
  }
  updateTable(filteredSatellites());
});

exportBtn.addEventListener("click", () => {
  const obs  = getObserver();
  const sats = filteredSatellites();
  if (!obs || !sats.length) return;

  const latDir = obs.lat >= 0 ? "N" : "S";
  const lonDir = obs.lon >= 0 ? "E" : "W";
  const header = ["Satellite","Lon (°)","True Az (°)","Mag Az (°)","Elevation (°)","Zenith (°)","Status"].join(",");
  const rows   = sats.map(s =>
    [s.name, s.centerLon.toFixed(1), s.az.toFixed(1),
     (s.magAz ?? s.az).toFixed(1), s.el.toFixed(1),
     (90 - s.el).toFixed(1), s.status.toUpperCase()].join(",")
  );
  const meta     = `# Observer: ${Math.abs(obs.lat).toFixed(4)}°${latDir} ${Math.abs(obs.lon).toFixed(4)}°${lonDir}`;
  const decl     = sats[0]?.decl;
  const declLine = decl !== undefined
    ? `# Mag declination: ${decl >= 0 ? decl.toFixed(1) + "°E" : Math.abs(decl).toFixed(1) + "°W"}`
    : "";
  const csv = [meta, declLine, header, ...rows].filter(Boolean).join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "satellite-angles.csv"; a.click();
  URL.revokeObjectURL(url);
});

// Restore elevation unit
const persistedUnit = loadPersistedElevUnit();
if (persistedUnit === "zenith") {
  setElevUnit("zenith");
  if (elevUnitToggle) elevUnitToggle.checked = true;
}

// Footprints default OFF
saveFootprint(false);
footprintToggle.checked = false;
setShowFootprints(false);

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
