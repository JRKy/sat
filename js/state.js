// ======================================================
// state.js
// Single source of truth for the entire application.
// ======================================================

// ── Constants ──────────────────────────────────────────
export const EARTH_RADIUS_KM    = 6371;
export const DEFAULT_SAT_ALT_KM = 35786;
export const LABEL_ZOOM_THRESHOLD = 2;

// ── Satellite list ─────────────────────────────────────
let _satellites = [];
export function getSatellites()     { return _satellites; }
export function setSatellites(list) { _satellites = list; }

// ── Observer location ──────────────────────────────────
let _observer = null; // { lat, lon, heightKm }
export function getObserver()  { return _observer; }
export function setObserver(o) { _observer = o; }
export function hasObserver()  { return _observer !== null; }

// ── UI state ───────────────────────────────────────────
let _selectedId      = null;
let _showFootprints  = false;
let _elevationCutoff = 0;
let _elevUnit        = "horizon"; // "horizon" | "zenith"

export function getSelectedId()       { return _selectedId; }
export function setSelectedId(id)     { _selectedId = id; }

export function getShowFootprints()   { return _showFootprints; }
export function setShowFootprints(v)  { _showFootprints = v; }

export function getElevationCutoff()  { return _elevationCutoff; }
export function setElevationCutoff(v) { _elevationCutoff = v; }

export function getElevUnit()         { return _elevUnit; }
export function setElevUnit(v)        { _elevUnit = v; }

// ── Persistence ────────────────────────────────────────
const FOOTPRINT_KEY  = "sat_footprint";
const ELEV_UNIT_KEY  = "sat_elev_unit";
const WIN_POS_KEY    = "sat_win_pos";
const WIN_MIN_KEY    = "sat_win_min";

export function saveFootprint(v) {
  try {
    if (v) localStorage.setItem(FOOTPRINT_KEY, "true");
    else   localStorage.removeItem(FOOTPRINT_KEY);
  } catch {}
}

export function loadPersistedElevUnit() {
  try { return localStorage.getItem(ELEV_UNIT_KEY) || "horizon"; } catch { return "horizon"; }
}
export function saveElevUnit(v) {
  try { localStorage.setItem(ELEV_UNIT_KEY, v); } catch {}
}

export function loadPersistedWinPos() {
  try {
    const v = localStorage.getItem(WIN_POS_KEY);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}
export function saveWinPos(x, y) {
  try { localStorage.setItem(WIN_POS_KEY, JSON.stringify({ x, y })); } catch {}
}

export function loadPersistedWinMin() {
  try { return localStorage.getItem(WIN_MIN_KEY) === "true"; } catch { return false; }
}
export function saveWinMin(v) {
  try { localStorage.setItem(WIN_MIN_KEY, v ? "true" : "false"); } catch {}
}
