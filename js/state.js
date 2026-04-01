// ======================================================
// state.js
// Single source of truth for the entire application.
// All modules read from and write to this store.
// ======================================================

// ── Constants ──────────────────────────────────────────
export const EARTH_RADIUS_KM    = 6371;
export const DEFAULT_SAT_ALT_KM = 35786;
export const LABEL_ZOOM_THRESHOLD = 4;

// ── Satellite list ─────────────────────────────────────
let _satellites = [];
export function getSatellites()      { return _satellites; }
export function setSatellites(list)  { _satellites = list; }

// ── Observer location ──────────────────────────────────
// null until the user sets a location
let _observer = null;   // { lat, lon, heightKm }
export function getObserver()    { return _observer; }
export function setObserver(o)   { _observer = o; }
export function hasObserver()    { return _observer !== null; }

// ── UI state ───────────────────────────────────────────
let _selectedId      = null;
let _showFootprints  = false;
let _elevationCutoff = 0;

export function getSelectedId()         { return _selectedId; }
export function setSelectedId(id)       { _selectedId = id; }

export function getShowFootprints()     { return _showFootprints; }
export function setShowFootprints(v)    { _showFootprints = v; }

export function getElevationCutoff()    { return _elevationCutoff; }
export function setElevationCutoff(v)   { _elevationCutoff = v; }

// ── Persistence helpers ────────────────────────────────
const FOOTPRINT_KEY = "sat_footprint";
const PIN_KEY       = "sat_pinned";

export function loadPersistedFootprint() {
  try { return localStorage.getItem(FOOTPRINT_KEY) === "true"; } catch { return false; }
}
export function saveFootprint(v) {
  try { localStorage.setItem(FOOTPRINT_KEY, v ? "true" : "false"); } catch {}
}
export function loadPersistedPinned() {
  try { return localStorage.getItem(PIN_KEY) === "true"; } catch { return false; }
}
export function savePinned(v) {
  try { localStorage.setItem(PIN_KEY, v ? "true" : "false"); } catch {}
}
