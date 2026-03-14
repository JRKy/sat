import { map, userMarker } from "./map.js";
import {
  satellites,
  selectedSatNames,
  lineLayers,
  setLineLayers,
  lastObserver,
  setLastObserver,
  MIN_VISIBLE_EL,
  MIN_USABLE_EL
} from "./state.js";
import { greatCirclePoints } from "./geometry.js";
import { buildTable, renderObserverInfo, renderSelectedInfo } from "./table.js";
import { updateFootprints } from "./footprints.js";
import { openPanel } from "./panel.js";

const sortSelect = document.getElementById("sort");
const cutoffSlider = document.getElementById("cutoff");
const cutoffValue = document.getElementById("cutoff-value");
const geoBtn = document.getElementById("geo");
const footprintToggle = document.getElementById("footprint-toggle");
const satTable = document.getElementById("sat-table");
const info = document.getElementById("info");

let sortMode = "lon";
let elevationCutoff = 0;
let footprintEnabled = footprintToggle ? footprintToggle.checked : false;

export function getFootprintEnabled() {
  return footprintEnabled;
}

function degToRad(d) { return d * Math.PI / 180; }
function radToDeg(r) { return r * 180 / Math.PI; }
function normAzDeg(d) { return (d % 360 + 360) % 360; }

/**
 * Remove all LOS lines.
 */
function clearLines() {
  lineLayers.forEach((l) => map.removeLayer(l));
  setLineLayers([]);
}

/**
 * Unwrap a polyline so longitudes are continuous.
 */
function unwrapLine(pts) {
  if (!pts.length) return pts;
  const out = [pts[0]];
  let prev = pts[0][1];

  for (let i = 1; i < pts.length; i++) {
    let [lat, lon] = pts[i];

    while (lon - prev > 180) lon -= 360;
    while (lon - prev < -180) lon += 360;

    out.push([lat, lon]);
    prev = lon;
  }

  return out;
}

/**
 * Draw LOS line repeated across world tiles.
 */
function addWrappedPolyline(latlngs, options, bringFront = false) {
  const offsets = [0, 360, -360];
  const layers = [];

  offsets.forEach(offset => {
    const shifted = latlngs.map(([lat, lon]) => [lat, lon + offset]);

    const pl = L.polyline(shifted, {
      ...options,
      noWrap: true
    }).addTo(map);

    if (bringFront) pl.bringToFront();
    layers.push(pl);
  });

  return layers;
}

export function updateLocation(lat, lon, heightKm = 0, setZoom = false) {
  setLastObserver({ lat, lon, heightKm });
  userMarker.setLatLng([lat, lon]);
  if (setZoom) map.setView([lat, lon], 12);

  clearLines();

  const observerGd = {
    longitude: degToRad(lon),
    latitude: degToRad(lat),
    height: heightKm
  };

  const computed = satellites.map((sat) => {
    const positionEcf = satellite.geodeticToEcf({
      longitude: degToRad(sat.lon),
      latitude: degToRad(sat.lat),
      height: sat.alt_km
    });
    const look = satellite.ecfToLookAngles(observerGd, positionEcf);
    const az = normAzDeg(radToDeg(look.azimuth));
    const el = radToDeg(look.elevation);
    const status = el > MIN_USABLE_EL ? "Good" : (el > MIN_VISIBLE_EL ? "Low" : "Bad");
    return { sat, az, el, status };
  });

  computed.sort((a, b) => {
    if (sortMode === "el") return (b.el - a.el) || (a.sat.lon - b.sat.lon);
    return (a.sat.lon - b.sat.lon) || a.sat.name.localeCompare(b.sat.name);
  });

  const filtered = computed.filter(r => r.el >= elevationCutoff);

  const filteredNames = new Set(filtered.map(r => r.sat.name));
  for (const name of Array.from(selectedSatNames)) {
    if (!filteredNames.has(name)) {
      selectedSatNames.delete(name);
    }
  }

  const newLineLayers = [];
  filtered.forEach((r) => {
    if (r.el <= 0) return;

    const isSelected = selectedSatNames.has(r.sat.name);

    // Great-circle path, unwrapped for continuity
    const pts = unwrapLine(greatCirclePoints(lat, lon, r.sat.lat, r.sat.lon));

    const options = {
      color: r.el > MIN_USABLE_EL ? "#1e8e3e" : "#1a73e8",
      weight: isSelected ? 5 : 3,
      opacity: isSelected ? 0.95 : 0.70,
      dashArray: r.el > MIN_USABLE_EL ? null : "5,5"
    };

    const segLayers = addWrappedPolyline(pts, options, isSelected);
    newLineLayers.push(...segLayers);
  });

  setLineLayers(newLineLayers);

  buildTable(filtered, elevationCutoff);

  const selectedRows = computed.filter(r => selectedSatNames.has(r.sat.name));
  renderObserverInfo(lat, lon, heightKm);
  renderSelectedInfo(selectedRows);

  updateFootprints(footprintEnabled);

  if (info) info.innerHTML = "";
}

function debounce(fn, delay) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

const debouncedUpdateLocation = debounce(
  (lat, lon, heightKm, setZoom) => updateLocation(lat, lon, heightKm, setZoom),
  16
);

export function initEvents() {
  map.on("click", (e) => {
    debouncedUpdateLocation(e.latlng.lat, e.latlng.lng, lastObserver.heightKm, false);
  });

  sortSelect.addEventListener("change", () => {
    sortMode = sortSelect.value;
    updateLocation(lastObserver.lat, lastObserver.lon, lastObserver.heightKm, false);
  });

  cutoffSlider.addEventListener("input", () => {
    const v = parseFloat(cutoffSlider.value);
    elevationCutoff = isNaN(v) ? 0 : v;
    cutoffValue.textContent = elevationCutoff.toFixed(0);
    updateLocation(lastObserver.lat, lastObserver.lon, lastObserver.heightKm, false);
  });

  geoBtn.addEventListener("click", () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      updateLocation(
        pos.coords.latitude,
        pos.coords.longitude,
        (pos.coords.altitude ?? 0) / 1000,
        true
      );
    });
  });

  if (footprintToggle) {
    footprintToggle.addEventListener("change", () => {
      footprintEnabled = !!footprintToggle.checked;
      updateFootprints(footprintEnabled);
    });
  }

  satTable.addEventListener("click", (e) => {
    const row = e.target.closest("tr[data-sat]");
    if (!row) return;
    const name = row.getAttribute("data-sat");
    if (!name) return;

    if (selectedSatNames.has(name)) selectedSatNames.delete(name);
    else selectedSatNames.add(name);

    updateLocation(lastObserver.lat, lastObserver.lon, lastObserver.heightKm, false);
    openPanel();
  });
}