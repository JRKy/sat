/* ============================
 Map Initialization
============================ */
const map = L.map('map', {
  zoomControl: true,
  attributionControl: true, // Leaflet attribution ON (default bottom-right)
  minZoom: 3,
  maxZoom: 19
}).setView([39.0, -104.0], 4);

const baseLayers = {
  "Streets": L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    { attribution: "© OpenStreetMap contributors", maxZoom: 19 }
  ),
  "Satellite": L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { attribution: "Tiles © Esri", maxZoom: 19 }
  ),
  "Dark": L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    { attribution: "© OpenStreetMap & Carto", maxZoom: 19 }
  )
};

baseLayers["Streets"].addTo(map);
L.control.layers(baseLayers, null, { position: "topright" }).addTo(map);
L.control.scale({ imperial: true, metric: true, position: "bottomleft" }).addTo(map);

/* ============================
 Footprint Pane (below markers/lines)
============================ */
const FOOTPRINT_PANE = "footprintPane";
map.createPane(FOOTPRINT_PANE);
map.getPane(FOOTPRINT_PANE).style.zIndex = 250;
map.getPane(FOOTPRINT_PANE).style.pointerEvents = "none";

/* ============================
 DOM References
============================ */
const searchInput = document.getElementById("search");
const geoBtn = document.getElementById("geo");
const autocomplete = document.getElementById("autocomplete");
const satToggleBtn = document.getElementById("sat-toggle");
const satPanel = document.getElementById("sat-panel");
const panelCloseBtn = document.getElementById("panel-close");
const panelPinBtn = document.getElementById("panel-pin");
const satBackdrop = document.getElementById("sat-backdrop");
const satTable = document.getElementById("sat-table");
const sortSelect = document.getElementById("sort");
const cutoffSlider = document.getElementById("cutoff");
const cutoffValue = document.getElementById("cutoff-value");
const cutoffHintValue = document.getElementById("cutoff-hint-value");
const observerInfo = document.getElementById("observer-info");
const selectedInfo = document.getElementById("selected-info");
const footprintToggle = document.getElementById("footprint-toggle");
/* Legacy */
const info = document.getElementById("info");

/* ============================
 Constants / State
============================ */
const EARTH_RADIUS_KM = 6371;
const DEFAULT_SAT_LAT = 0; // degrees
const DEFAULT_SAT_ALT_KM = 35786; // km (GEO approx)
const MIN_VISIBLE_EL = 0; // degrees
const MIN_USABLE_EL = 10; // degrees
const GREAT_CIRCLE_STEPS = 64;

let satellites = [];
let satMarkers = new Map(); // name -> L.Marker
let lineLayers = [];
let sortMode = "lon";
let elevationCutoff = 0;

// Multi-select state
let selectedSatNames = new Set();

let lastObserver = { lat: 39.0, lon: -104.0, heightKm: 2.3 };

/* ============================
 Footprint toggle persistence (default OFF)
============================ */
const FOOTPRINT_STORAGE_KEY = "satFootprintEnabled";

function safeGetFootprintFromStorage() {
  try {
    const v = localStorage.getItem(FOOTPRINT_STORAGE_KEY);
    if (v === null) return false; // default OFF if not set
    return v === "true";
  } catch {
    return false;
  }
}

function safeSetFootprintToStorage(val) {
  try {
    localStorage.setItem(FOOTPRINT_STORAGE_KEY, val ? "true" : "false");
  } catch {
    /* ignore */
  }
}

let footprintEnabled = safeGetFootprintFromStorage();

// Sync toggle UI on load
if (footprintToggle) {
  footprintToggle.checked = footprintEnabled;
}

/* ============================
 Antimeridian-safe geometry helper (UNIFIED)
 - Works for polylines and polygon rings
 - Handles every edge case: exact 180, multiple wraps, repeated points, etc.
============================ */
function normalizeLon180(lon) {
  // normalize to (-180, 180], keep 180 not -180 for continuity
  let x = ((lon + 180) % 360 + 360) % 360 - 180;
  if (x === -180) x = 180;
  return x;
}

function oppositeDatelineLon(lon) {
  // If we end at +180, next segment should start at -180, and vice versa
  return (lon === 180) ? -180 : 180;
}

function unwrapLon(prevUnwrapped, lonNorm) {
  // Choose lonNorm + 360k that minimizes jump from prevUnwrapped
  let best = lonNorm;
  let bestDiff = Math.abs(best - prevUnwrapped);

  const c1 = lonNorm + 360;
  const d1 = Math.abs(c1 - prevUnwrapped);
  if (d1 < bestDiff) { best = c1; bestDiff = d1; }

  const c2 = lonNorm - 360;
  const d2 = Math.abs(c2 - prevUnwrapped);
  if (d2 < bestDiff) { best = c2; bestDiff = d2; }

  return best;
}

/**
 * Split a lat/lon path at the antimeridian.
 * @param {Array<[number,number]>} pts - array of [lat,lon] with lon in degrees.
 * @param {Object} opts
 * @param {boolean} opts.closed - if true, treat as ring (will connect last->first).
 * @returns {Array<Array<[number,number]>>} segments/rings.
 */
function splitAtAntimeridian(pts, opts = {}) {
  const closed = !!opts.closed;
  const EPS = 1e-9;

  if (!Array.isArray(pts) || pts.length < 2) return [];
  // Normalize input lon and remove consecutive duplicates
  const cleaned = [];
  for (const p of pts) {
    if (!p || p.length < 2) continue;
    const lat = +p[0];
    const lon = normalizeLon180(+p[1]);
    const prev = cleaned[cleaned.length - 1];
    if (!prev || prev[0] !== lat || prev[1] !== lon) cleaned.push([lat, lon]);
  }
  if (cleaned.length < 2) return [];

  // If closed ring, ensure closure by appending first point if needed
  let work = cleaned;
  if (closed) {
    const first = work[0];
    const last = work[work.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      work = work.concat([[first[0], first[1]]]);
    }
  }

  // Build unwrapped longitude series
  const unwrapped = [];
  unwrapped[0] = work[0][1];
  for (let i = 1; i < work.length; i++) {
    unwrapped[i] = unwrapLon(unwrapped[i - 1], work[i][1]);
  }

  const segments = [];
  let seg = [[work[0][0], work[0][1]]];

  for (let i = 1; i < work.length; i++) {
    let lat1 = work[i - 1][0];
    let lat2 = work[i][0];

    let lon1u = unwrapped[i - 1];
    let lon2u = unwrapped[i];

    // Determine "world zone" indices for dateline boundaries
    // Zone changes when crossing boundary at 180 + 360*k.
    let z1 = Math.floor((lon1u + 180) / 360);
    let z2 = Math.floor((lon2u + 180) / 360);

    // If multiple zone jumps (rare), handle iteratively.
    while (z1 !== z2) {
      const boundary = 180 + 360 * Math.min(z1, z2); // boundary between zones
      const denom = (lon2u - lon1u);
      if (Math.abs(denom) < EPS) break;

      const t = (boundary - lon1u) / denom;
      const latCross = lat1 + t * (lat2 - lat1);

      const lonCrossNorm = normalizeLon180(boundary);

      // End current segment at the boundary
      seg.push([latCross, lonCrossNorm]);
      segments.push(seg);

      // Start new segment at opposite side of boundary
      seg = [[latCross, oppositeDatelineLon(lonCrossNorm)]];

      // Move slightly into the next zone to prevent infinite loops on exact boundary
      if (z2 > z1) {
        lon1u = boundary + EPS;
      } else {
        lon1u = boundary - EPS;
      }
      lat1 = latCross;
      z1 = Math.floor((lon1u + 180) / 360);
    }

    // Finally add the endpoint for this original segment
    seg.push([lat2, normalizeLon180(lon2u)]);
  }

  if (seg.length >= 2) segments.push(seg);

  // For closed rings, turn each segment into a valid ring if possible
  if (closed) {
    const rings = [];
    for (const s of segments) {
      // Remove any tiny rings
      if (s.length < 3) continue;
      const f = s[0];
      const l = s[s.length - 1];
      if (f[0] !== l[0] || f[1] !== l[1]) {
        s.push([f[0], f[1]]);
      }
      // Ensure still valid after closure
      if (s.length >= 4) rings.push(s);
    }
    return rings;
  }

  // For open polylines, also remove any 1-point segments
  return segments.filter(s => s.length >= 2);
}

/* ============================
 TRUE Footprints (Boundary Polygons)
 - Uses PDF boundary method (azimuth sweep)
 - Footprints are true geometric visibility (NOT affected by elevationCutoff)
============================ */
const FOOTPRINT_COLORS = [
  "#1a73e8", // blue
  "#34a853", // green
  "#fbbc05", // yellow
  "#ea4335", // red
  "#8e24aa", // purple
  "#00acc1"  // cyan
];

// satName -> Leaflet Layer (polygon/multipolygon)
let footprintLayers = new Map();

function clearFootprints() {
  for (const [, layer] of footprintLayers) {
    map.removeLayer(layer);
  }
  footprintLayers.clear();
}

function toRad(deg) { return deg * Math.PI / 180; }
function toDeg(rad) { return rad * 180 / Math.PI; }

function horizonAngularRadiusRad(altKm) {
  const Re = EARTH_RADIUS_KM;
  const r = Re + altKm;
  return Math.acos(Re / r);
}

function footprintBoundaryPoints(sat, steps = 360) {
  const lon0 = toRad(sat.lon);
  const lat0 = toRad((sat.lat ?? DEFAULT_SAT_LAT));
  const altKm = sat.alt_km ?? DEFAULT_SAT_ALT_KM;

  const p = horizonAngularRadiusRad(altKm);

  const sinp = Math.sin(p);
  const cosp = Math.cos(p);

  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;

    let lat, lon;

    // PDF special case (MUOS/GEO on equator)
    if (Math.abs(lat0) < 1e-12) {
      lat = Math.asin(sinp * Math.cos(a));
      lon = lon0 + Math.atan2(Math.sin(a) * sinp, cosp);
    } else {
      // general spherical-circle form
      const sinLat0 = Math.sin(lat0);
      const cosLat0 = Math.cos(lat0);
      lat = Math.asin(sinLat0 * cosp + cosLat0 * sinp * Math.cos(a));
      lon = lon0 + Math.atan2(
        Math.sin(a) * sinp * cosLat0,
        cosp - sinLat0 * Math.sin(lat)
      );
    }

    const latDeg = toDeg(lat);
    const lonDeg = normalizeLon180(toDeg(lon));
    pts.push([latDeg, lonDeg]);
  }
  return pts;
}

function updateFootprints() {
  clearFootprints();

  if (!footprintEnabled) return;
  if (!selectedSatNames.size) return;

  // Stable ordering so colors don't shuffle
  const selected = satellites
    .filter(s => selectedSatNames.has(s.name))
    .sort((a, b) => (a.lon - b.lon) || a.name.localeCompare(b.name));

  selected.forEach((sat, idx) => {
    const color = FOOTPRINT_COLORS[idx % FOOTPRINT_COLORS.length];

    const boundary = footprintBoundaryPoints(sat, 360);

    // Split ring at antimeridian into multiple rings
    const rings = splitAtAntimeridian(boundary, { closed: true });

    if (!rings.length) return;

    // Leaflet multipolygon format: [ [ring1], [ring2], ... ]
    const multi = rings.map(r => [r]);

    const poly = L.polygon(multi, {
      pane: FOOTPRINT_PANE,
      color,
      weight: 2,
      opacity: 0.85,
      fillColor: color,
      fillOpacity: 0.06,
      interactive: false
    }).addTo(map);

    footprintLayers.set(sat.name, poly);
  });
}

/* ============================
 Panel Toggle + Pin (with tooltip + persistence)
============================ */
const PIN_STORAGE_KEY = "satPanelPinned";
function safeGetPinnedFromStorage() {
  try {
    return localStorage.getItem(PIN_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}
function safeSetPinnedToStorage(val) {
  try {
    localStorage.setItem(PIN_STORAGE_KEY, val ? "true" : "false");
  } catch {
    /* ignore */
  }
}
let panelPinned = safeGetPinnedFromStorage();
function syncPanelPinnedUI() {
  if (satPanel) {
    satPanel.classList.toggle("pinned", panelPinned);
  }
  if (panelPinBtn) {
    panelPinBtn.title = panelPinned ? "Pinned" : "Pin panel";
    panelPinBtn.setAttribute("aria-label", panelPinned ? "Pinned" : "Pin panel");
  }
  safeSetPinnedToStorage(panelPinned);
}
function openPanel() {
  if (!satPanel) return;
  satPanel.classList.add("open");
  if (satBackdrop) {
    if (panelPinned) satBackdrop.classList.remove("open");
    else satBackdrop.classList.add("open");
  }
}
function closePanel(force = false) {
  if (!satPanel) return;
  if (panelPinned && !force) return;
  satPanel.classList.remove("open");
  if (satBackdrop) satBackdrop.classList.remove("open");
}
function togglePanel() {
  if (!satPanel) return;
  if (panelPinned && satPanel.classList.contains("open")) return;
  if (satPanel.classList.contains("open")) closePanel();
  else openPanel();
}
satToggleBtn?.addEventListener("click", togglePanel);
panelCloseBtn?.addEventListener("click", () => {
  panelPinned = false;
  syncPanelPinnedUI();
  closePanel(true);
});
satBackdrop?.addEventListener("click", () => closePanel(false));
panelPinBtn?.addEventListener("click", () => {
  panelPinned = !panelPinned;
  syncPanelPinnedUI();
  if (panelPinned) {
    openPanel();
  } else {
    if (satPanel?.classList.contains("open") && satBackdrop) satBackdrop.classList.add("open");
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closePanel(false);
});
syncPanelPinnedUI();
if (panelPinned) openPanel();

/* ============================
 Icons (Material Icons)
============================ */
function userIcon() {
  return L.divIcon({
    className: "user-marker",
    html: '<span class="material-icons">location_on</span>',
    iconSize: [48, 48],
    iconAnchor: [24, 48]
  });
}
function satIcon(isSelected) {
  return L.divIcon({
    className: isSelected ? "sat-marker selected" : "sat-marker",
    html: '<span class="material-icons">satellite</span>',
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });
}

/* ============================
 User Marker
============================ */
const userMarker = L.marker([0, 0], { icon: userIcon() }).addTo(map);

/* ============================
 Math Helpers
============================ */
const degToRad = (d) => d * Math.PI / 180;
const radToDeg = (r) => r * 180 / Math.PI;
const normAzDeg = (d) => (d % 360 + 360) % 360;

/* ============================
 Great-Circle Path (visual only)
============================ */
function greatCirclePoints(lat1, lon1, lat2, lon2, steps = GREAT_CIRCLE_STEPS) {
  const φ1 = degToRad(lat1), λ1 = degToRad(lon1);
  const φ2 = degToRad(lat2), λ2 = degToRad(lon2);

  const v1 = [Math.cos(φ1) * Math.cos(λ1), Math.cos(φ1) * Math.sin(λ1), Math.sin(φ1)];
  const v2 = [Math.cos(φ2) * Math.cos(λ2), Math.cos(φ2) * Math.sin(λ2), Math.sin(φ2)];

  const dot = Math.min(1, Math.max(-1, v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]));
  const ω = Math.acos(dot);

  if (!isFinite(ω) || ω === 0) return [[lat1, lon1], [lat2, lon2]];

  const sinω = Math.sin(ω);
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = Math.sin((1 - t) * ω) / sinω;
    const b = Math.sin(t * ω) / sinω;
    const x = a * v1[0] + b * v2[0];
    const y = a * v1[1] + b * v2[1];
    const z = a * v1[2] + b * v2[2];
    pts.push([
      radToDeg(Math.atan2(z, Math.sqrt(x * x + y * y))),
      radToDeg(Math.atan2(y, x))
    ]);
  }
  return pts;
}

/* ============================
 Satellite Markers
============================ */
function addSatelliteMarkers() {
  for (const [, m] of satMarkers) map.removeLayer(m);
  satMarkers.clear();

  satellites.forEach((sat) => {
    const marker = L.marker([sat.lat ?? DEFAULT_SAT_LAT, sat.lon], {
      icon: satIcon(selectedSatNames.has(sat.name))
    }).addTo(map);

    marker.bindTooltip(
      `<span class="name">${sat.name}</span><span class="lon">${sat.lon.toFixed(1)}°</span>`,
      {
        permanent: true,
        direction: "top",
        className: "sat-label",
        offset: [0, -24]
      }
    ).openTooltip();

    satMarkers.set(sat.name, marker);
  });

  refreshMarkerSelection();
}

function refreshMarkerSelection() {
  for (const sat of satellites) {
    const marker = satMarkers.get(sat.name);
    if (!marker) continue;

    const isSelected = selectedSatNames.has(sat.name);
    marker.setIcon(satIcon(isSelected));
    marker.setZIndexOffset(isSelected ? 1000 : 0);
  }
}

/* ============================
 Lines / Table helpers
============================ */
function clearLines() {
  lineLayers.forEach((l) => map.removeLayer(l));
  lineLayers = [];
}

function statusClass(status) {
  if (status === "Good") return "status-pill status-good";
  if (status === "Low") return "status-pill status-low";
  return "status-pill status-bad";
}

function addWrappedPolyline(latlngs, options, bringFront = false) {
  const segs = splitAtAntimeridian(latlngs, { closed: false });
  const layers = [];
  for (const s of segs) {
    const pl = L.polyline(s, options).addTo(map);
    if (bringFront) pl.bringToFront();
    layers.push(pl);
  }
  return layers;
}

function buildTable(rows) {
  if (!rows.length) {
    satTable.innerHTML = `
      <div style="padding:12px;color:#5f6368;font-size:13px;">
        No satellites meet the cutoff (El ≥ ${elevationCutoff}°).
      </div>
    `;
    return;
  }

  satTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Satellite</th>
          <th>Az</th>
          <th>El</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => {
          const selected = selectedSatNames.has(r.sat.name) ? "selected" : "";
          return `
            <tr class="${selected}" data-sat="${r.sat.name}">
              <td>${r.sat.name}</td>
              <td>${r.az.toFixed(1)}°</td>
              <td>${r.el.toFixed(1)}°</td>
              <td><span class="${statusClass(r.status)}">${r.status}</span></td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;

  satTable.querySelectorAll("tr[data-sat]").forEach((row) => {
    row.addEventListener("click", () => {
      const name = row.getAttribute("data-sat");
      if (selectedSatNames.has(name)) selectedSatNames.delete(name);
      else selectedSatNames.add(name);

      refreshMarkerSelection();
      updateLocation(lastObserver.lat, lastObserver.lon, lastObserver.heightKm, false);
      openPanel();
    });
  });
}

/* ============================
 Panel info renderers
============================ */
function renderObserverInfo(lat, lon, heightKm) {
  if (!observerInfo) return;
  observerInfo.innerHTML = `
    <div><b>Lat:</b> ${lat.toFixed(5)}°</div>
    <div><b>Lon:</b> ${lon.toFixed(5)}°</div>
    <div class="muted">${heightKm ? `Height: ${heightKm.toFixed(2)} km` : ""}</div>
  `;
}

function renderSelectedInfo(selectedRows) {
  if (!selectedInfo) return;

  if (!selectedRows || selectedRows.length === 0) {
    selectedInfo.innerHTML = `<div class="muted">None (tap rows to select)</div>`;
    return;
  }

  if (selectedRows.length === 1) {
    const r = selectedRows[0];
    selectedInfo.innerHTML = `
      <div><b>${r.sat.name}</b></div>
      <div>Az: ${r.az.toFixed(1)}°</div>
      <div>El: ${r.el.toFixed(1)}°</div>
      <div class="muted">${r.status}</div>
    `;
    return;
  }

  const maxLines = 5;
  const head = selectedRows.slice(0, maxLines);

  selectedInfo.innerHTML = `
    <div><b>${selectedRows.length} satellites selected</b></div>
    ${head.map(r => `<div>${r.sat.name}: Az ${r.az.toFixed(0)}°, El ${r.el.toFixed(0)}°</div>`).join("")}
    ${selectedRows.length > maxLines ? `<div class="muted">…and ${selectedRows.length - maxLines} more</div>` : ""}
  `;
}

/* ============================
 Core Update Logic
============================ */
function updateLocation(lat, lon, heightKm = 0, setZoom = false) {
  lastObserver = { lat, lon, heightKm };
  userMarker.setLatLng([lat, lon]);
  if (setZoom) map.setView([lat, lon], 12);

  clearLines();

  const observerGd = {
    longitude: satellite.degreesToRadians(lon),
    latitude: satellite.degreesToRadians(lat),
    height: heightKm
  };

  const computed = satellites.map((sat) => {
    const positionEcf = satellite.geodeticToEcf({
      longitude: satellite.degreesToRadians(sat.lon),
      latitude: satellite.degreesToRadians(sat.lat ?? DEFAULT_SAT_LAT),
      height: sat.alt_km ?? DEFAULT_SAT_ALT_KM
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

  // Drop selections that no longer meet cutoff filter (existing behavior)
  const filteredNames = new Set(filtered.map(r => r.sat.name));
  let changed = false;
  for (const name of Array.from(selectedSatNames)) {
    if (!filteredNames.has(name)) {
      selectedSatNames.delete(name);
      changed = true;
    }
  }
  if (changed) refreshMarkerSelection();

  filtered.forEach((r) => {
    if (r.el <= 0) return; // behind Earth -> no line on 2D map

    const isSelected = selectedSatNames.has(r.sat.name);
    const pts = greatCirclePoints(lat, lon, r.sat.lat ?? 0, r.sat.lon);

    const options = {
      color: r.el > MIN_USABLE_EL ? "#1e8e3e" : "#1a73e8",
      weight: isSelected ? 5 : 3,
      opacity: isSelected ? 0.95 : 0.70,
      dashArray: r.el > MIN_USABLE_EL ? null : "5,5"
    };

    // ✅ Antimeridian-safe lines
    const segLayers = addWrappedPolyline(pts, options, isSelected);
    lineLayers.push(...segLayers);
  });

  buildTable(filtered);

  const selectedRows = computed.filter(r => selectedSatNames.has(r.sat.name));

  renderObserverInfo(lat, lon, heightKm);
  renderSelectedInfo(selectedRows);

  // ✅ Antimeridian-safe true footprints
  updateFootprints();

  if (info) info.innerHTML = "";
}

/* ============================
 Events
============================ */
map.on("click", (e) => {
  updateLocation(e.latlng.lat, e.latlng.lng, lastObserver.heightKm, false);
});

sortSelect.addEventListener("change", () => {
  sortMode = sortSelect.value;
  updateLocation(lastObserver.lat, lastObserver.lon, lastObserver.heightKm, false);
});

cutoffSlider.addEventListener("input", () => {
  elevationCutoff = parseFloat(cutoffSlider.value);
  cutoffValue.textContent = elevationCutoff.toFixed(0);
  cutoffHintValue.textContent = elevationCutoff.toFixed(0);
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

/* Toggle footprint */
if (footprintToggle) {
  footprintToggle.addEventListener("change", () => {
    footprintEnabled = !!footprintToggle.checked;
    safeSetFootprintToStorage(footprintEnabled);
    updateFootprints();
  });
}

/* ============================
 Custom Autocomplete (robust)
============================ */
let acItems = [];
let acActiveIndex = -1;
let acTimer = null;

function hideAutocomplete() {
  if (!autocomplete) return;
  autocomplete.classList.add("hidden");
  autocomplete.innerHTML = "";
  acItems = [];
  acActiveIndex = -1;
}

function renderAutocomplete(items) {
  if (!autocomplete) return;
  acItems = items;
  acActiveIndex = -1;

  if (!items.length) {
    hideAutocomplete();
    return;
  }

  autocomplete.innerHTML = items.map((p, idx) => {
    const primary = (p.display_name || "").split(",").slice(0, 2).join(",").trim();
    const secondary = (p.display_name || "").split(",").slice(2).join(",").trim();
    return `
      <div class="autocomplete-item" role="option" data-idx="${idx}">
        <span class="material-icons">place</span>
        <div>
          <div class="autocomplete-primary">${primary || p.display_name}</div>
          ${secondary ? `<div class="autocomplete-secondary">${secondary}</div>` : ""}
        </div>
      </div>
    `;
  }).join("");

  autocomplete.classList.remove("hidden");

  autocomplete.querySelectorAll(".autocomplete-item").forEach((el) => {
    el.addEventListener("mousedown", (ev) => {
      ev.preventDefault();
      const idx = parseInt(el.getAttribute("data-idx"), 10);
      chooseAutocomplete(idx);
    });
  });
}

function setActive(idx) {
  if (!autocomplete) return;
  const nodes = autocomplete.querySelectorAll(".autocomplete-item");
  nodes.forEach(n => n.classList.remove("active"));

  if (idx >= 0 && idx < nodes.length) {
    nodes[idx].classList.add("active");
    nodes[idx].scrollIntoView({ block: "nearest" });
  }
  acActiveIndex = idx;
}

function chooseAutocomplete(idx) {
  const p = acItems[idx];
  if (!p) return;
  searchInput.value = p.display_name || searchInput.value;
  hideAutocomplete();
  updateLocation(parseFloat(p.lat), parseFloat(p.lon), lastObserver.heightKm, true);
}

searchInput.addEventListener("input", () => {
  clearTimeout(acTimer);
  const q = searchInput.value.trim();

  if (q.length < 3) {
    hideAutocomplete();
    return;
  }

  acTimer = setTimeout(() => {
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=8&addressdetails=1`)
      .then(res => res.json())
      .then(data => renderAutocomplete(Array.isArray(data) ? data : []))
      .catch(() => hideAutocomplete());
  }, 300);
});

searchInput.addEventListener("keydown", (e) => {
  if (!autocomplete || autocomplete.classList.contains("hidden")) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    setActive(Math.min(acActiveIndex + 1, acItems.length - 1));
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    setActive(Math.max(acActiveIndex - 1, 0));
  } else if (e.key === "Enter") {
    if (acActiveIndex >= 0) {
      e.preventDefault();
      chooseAutocomplete(acActiveIndex);
    }
  } else if (e.key === "Escape") {
    hideAutocomplete();
  }
});

document.addEventListener("click", (e) => {
  if (!autocomplete) return;
  if (!autocomplete.contains(e.target) && e.target !== searchInput) hideAutocomplete();
});

/* ============================
 Load Satellites + Init
============================ */
fetch("satellites.json")
  .then(r => r.json())
  .then(data => {
    satellites = Array.isArray(data) ? data : [];
    elevationCutoff = parseFloat(cutoffSlider.value);
    cutoffValue.textContent = elevationCutoff.toFixed(0);
    cutoffHintValue.textContent = elevationCutoff.toFixed(0);
    addSatelliteMarkers();
    updateLocation(lastObserver.lat, lastObserver.lon, lastObserver.heightKm, true);
  })
  .catch(err => {
    console.error("Failed to load satellites.json", err);
    satellites = [{ name: "Fallback", lon: -104, lat: 0, alt_km: DEFAULT_SAT_ALT_KM }];
    addSatelliteMarkers();
    updateLocation(lastObserver.lat, lastObserver.lon, lastObserver.heightKm, true);
  });

/* Optional: reduce Chrome geolocation warning by only auto-requesting if already granted */
if (navigator.permissions && navigator.geolocation) {
  navigator.permissions.query({ name: "geolocation" })
    .then((perm) => {
      if (perm.state === "granted") {
        navigator.geolocation.getCurrentPosition(
          (pos) => updateLocation(
            pos.coords.latitude,
            pos.coords.longitude,
            (pos.coords.altitude ?? 0) / 1000,
            true
          ),
          () => {},
          { enableHighAccuracy: true, timeout: 5000 }
        );
      }
    })
    .catch(() => {});
}