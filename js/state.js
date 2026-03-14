// Global constants & shared state

export const EARTH_RADIUS_KM = 6371;
export const DEFAULT_SAT_LAT = 0;
export const DEFAULT_SAT_ALT_KM = 35786;
export const MIN_VISIBLE_EL = 0;
export const MIN_USABLE_EL = 10;
export const GREAT_CIRCLE_STEPS = 64;
export const LABEL_ZOOM_THRESHOLD = 6;

export const FOOTPRINT_STORAGE_KEY = "satFootprintEnabled";
export const PIN_STORAGE_KEY = "satPanelPinned";

export let satellites = [];
export let satMarkers = new Map();
export let lineLayers = [];
export let selectedSatNames = new Set();
export let autoFitFootprints = false;

export let lastObserver = { lat: 39.0, lon: -104.0, heightKm: 2.3 };

export function setSatellites(list) { satellites = list; }
export function setLineLayers(layers) { lineLayers = layers; }
export function setLastObserver(o) { lastObserver = o; }

export function safeGetFootprintFromStorage() {
  try {
    const v = localStorage.getItem(FOOTPRINT_STORAGE_KEY);
    return v === "true";
  } catch {
    return false;
  }
}

export function safeSetFootprintToStorage(val) {
  try { localStorage.setItem(FOOTPRINT_STORAGE_KEY, val ? "true" : "false"); }
  catch {}
}

export function safeGetPinnedFromStorage() {
  try { return localStorage.getItem(PIN_STORAGE_KEY) === "true"; }
  catch { return false; }
}

export function safeSetPinnedToStorage(val) {
  try { localStorage.setItem(PIN_STORAGE_KEY, val ? "true" : "false"); }
  catch {}
}