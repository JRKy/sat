/* ============================
 Map Initialization (Upgraded)
============================ */
const WORLD_BOUNDS = L.latLngBounds(
  L.latLng(-90, -180),
  L.latLng(90, 180)
);

const map = L.map("map", {
  zoomControl: true,
  attributionControl: true,
  minZoom: 1,
  maxZoom: 19,
  worldCopyJump: false,
  maxBounds: WORLD_BOUNDS,
  maxBoundsViscosity: 0.8   // smooth, no snap-back
}).setView([0, 0], 2);

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
 Footprint Pane
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

const info = document.getElementById("info");

/* ============================
 Constants / State
============================ */
const EARTH_RADIUS_KM = 6371;
const DEFAULT_SAT_LAT = 0;
const DEFAULT_SAT_ALT_KM = 35786;
const MIN_VISIBLE_EL = 0;
const MIN_USABLE_EL = 10;
const GREAT_CIRCLE_STEPS = 64;

const LABEL_ZOOM_THRESHOLD = 6;

let satellites = [];
let satMarkers = new Map();
let lineLayers = [];
let sortMode = "lon";
let elevationCutoff = 0;

let selectedSatNames = new Set();
let autoFitFootprints = false;

let lastObserver = { lat: 39.0, lon: -104.0, heightKm: 2.3 };

/* ============================
 Footprint toggle persistence
============================ */
const FOOTPRINT_STORAGE_KEY = "satFootprintEnabled";

function safeGetFootprintFromStorage() {
  try {
    const v = localStorage.getItem(FOOTPRINT_STORAGE_KEY);
    return v === "true";
  } catch {
    return false;
  }
}

function safeSetFootprintToStorage(val) {
  try { localStorage.setItem(FOOTPRINT_STORAGE_KEY, val ? "true" : "false"); }
  catch {}
}

let footprintEnabled = safeGetFootprintFromStorage();
if (footprintToggle) footprintToggle.checked = footprintEnabled;

/* ============================
 Antimeridian Helpers
============================ */
const EPS = 1e-9;

function normalizeLon180(lon) {
  let x = ((lon + 180) % 360 + 360) % 360 - 180;
  if (x === -180) x = 180;
  return x;
}

function unwrapLon(prevU, lonNorm) {
  let best = lonNorm;
  let bestDiff = Math.abs(best - prevU);

  const c1 = lonNorm + 360;
  const d1 = Math.abs(c1 - prevU);
  if (d1 < bestDiff) { best = c1; bestDiff = d1; }

  const c2 = lonNorm - 360;
  const d2 = Math.abs(c2 - prevU);
  if (d2 < bestDiff) { best = c2; bestDiff = d2; }

  return best;
}

function buildUnwrappedSeries(pts) {
  const out = [];
  if (!pts.length) return out;
  const lon0n = normalizeLon180(pts[0][1]);
  out.push(lon0n);
  for (let i = 1; i < pts.length; i++) {
    const lonn = normalizeLon180(pts[i][1]);
    out.push(unwrapLon(out[i - 1], lonn));
  }
  return out;
}

/* ============================
 Dateline Splitters
============================ */
function splitPolylineAtDateline(pts) {
  if (!Array.isArray(pts) || pts.length < 2) return [];

  const cleaned = [];
  for (const p of pts) {
    if (!p) continue;
    const lat = +p[0];
    const lon = +p[1];
    const lonN = normalizeLon180(lon);
    const prev = cleaned[cleaned.length - 1];
    if (!prev || prev[0] !== lat || normalizeLon180(prev[1]) !== lonN)
      cleaned.push([lat, lon]);
  }
  if (cleaned.length < 2) return [];

  const U = buildUnwrappedSeries(cleaned);
  const segments = [];
  let seg = [[cleaned[0][0], normalizeLon180(cleaned[0][1])]];
  let zCurr = Math.floor((U[0] + 180) / 360);

  function lonInZone(lonU, z) {
    return normalizeLon180(lonU - 360 * z);
  }

  for (let i = 1; i < cleaned.length; i++) {
    let lat1 = cleaned[i - 1][0];
    let lon1u = U[i - 1];
    let lat2 = cleaned[i][0];
    let lon2u = U[i];

    let z1 = Math.floor((lon1u + 180) / 360);
    let z2 = Math.floor((lon2u + 180) / 360);

    while (z1 !== z2) {
      const boundary = 180 + 360 * Math.min(z1, z2);
      const denom = lon2u - lon1u;
      if (Math.abs(denom) < EPS) break;

      const t = (boundary - lon1u) / denom;
      const latX = lat1 + t * (lat2 - lat1);

      seg.push([latX, lonInZone(boundary, zCurr)]);
      segments.push(seg);

      zCurr += (z2 > z1) ? 1 : -1;

      const startLon = (lonInZone(boundary, zCurr) === 180) ? -180 : 180;
      seg = [[latX, startLon]];

      lon1u = boundary + ((z2 > z1) ? EPS : -EPS);
      lat1 = latX;
      z1 = Math.floor((lon1u + 180) / 360);
    }

    seg.push([lat2, lonInZone(lon2u, zCurr)]);
  }

  if (seg.length >= 2) segments.push(seg);
  return segments.filter(s => s.length >= 2);
}

function splitRingIntoDatelinePolygons(ringPts) {
  if (!Array.isArray(ringPts) || ringPts.length < 4) return [];

  const pts = ringPts.slice();
  const f = pts[0];
  const l = pts[pts.length - 1];
  if (f[0] !== l[0] || normalizeLon180(f[1]) !== normalizeLon180(l[1])) {
    pts.push([f[0], f[1]]);
  }

  const cleaned = [];
  for (const p of pts) {
    if (!p) continue;
    const lat = +p[0];
    const lon = +p[1];
    const lonN = normalizeLon180(lon);
    const prev = cleaned[cleaned.length - 1];
    if (!prev || prev[0] !== lat || normalizeLon180(prev[1]) !== lonN)
      cleaned.push([lat, lon]);
  }
  if (cleaned.length < 4) return [];

  const U = buildUnwrappedSeries(cleaned);
  const segments = [];
  let seg = [[cleaned[0][0], normalizeLon180(cleaned[0][1])]];
  let zCurr = Math.floor((U[0] + 180) / 360);

  function lonInZone(lonU, z) {
    return normalizeLon180(lonU - 360 * z);
  }

  for (let i = 1; i < cleaned.length; i++) {
    let lat1 = cleaned[i - 1][0];
    let lon1u = U[i - 1];
    let lat2 = cleaned[i][0];
    let lon2u = U[i];

    let z1 = Math.floor((lon1u + 180) / 360);
    let z2 = Math.floor((lon2u + 180) / 360);

    while (z1 !== z2) {
      const boundary = 180 + 360 * Math.min(z1, z2);
      const denom = lon2u - lon1u;
      if (Math.abs(denom) < EPS) break;

      const t = (boundary - lon1u) / denom;
      const latX = lat1 + t * (lat2 - lat1);

      seg.push([latX, lonInZone(boundary, zCurr)]);
      segments.push({ zone: zCurr, pts: seg });

      zCurr += (z2 > z1) ? 1 : -1;

      const startLon = (lonInZone(boundary, zCurr) === 180) ? -180 : 180;
      seg = [[latX, startLon]];

      lon1u = boundary + ((z2 > z1) ? EPS : -EPS);
      lat1 = latX;
      z1 = Math.floor((lon1u + 180) / 360);
    }

    seg.push([lat2, lonInZone(lon2u, zCurr)]);
  }

  if (seg.length >= 2) segments.push({ zone: zCurr, pts: seg });

  const rings = [];

  for (const s of segments) {
    const p = s.pts;
    if (p.length < 3) continue;

    let sum = 0;
    for (const q of p) sum += q[1];
    const seamLon = (sum / p.length) >= 0 ? 180 : -180;

    const first = p[0];
    const last = p[p.length - 1];
    const ring = p.slice();

    ring[0] = [first[0], seamLon];
    ring[ring.length - 1] = [last[0], seamLon];

    const start = ring[0];
    const end = ring[ring.length - 1];
    if (start[0] !== end[0] || start[1] !== end[1]) {
      ring.push([start[0], start[1]]);
    }

    if (ring.length >= 4) rings.push(ring);
  }

  if (rings.length === 1) {
    let hasJump = false;
    for (let i = 1; i < cleaned.length; i++) {
      const a = normalizeLon180(cleaned[i - 1][1]);
      const b = normalizeLon180(cleaned[i][1]);
      if (Math.abs(b - a) > 180) { hasJump = true; break; }
    }
    if (!hasJump) {
      const normRing = cleaned.map(([lat, lon]) => [lat, normalizeLon180(lon)]);
      const ff = normRing[0];
      const ll = normRing[normRing.length - 1];
      if (ff[0] !== ll[0] || ff[1] !== ll[1]) normRing.push([ff[0], ff[1]]);
      return [normRing];
    }
  }

  return rings;
}

/* ============================
 Footprints
============================ */
const FOOTPRINT_COLORS = [
  "#1a73e8",
  "#34a853",
  "#fbbc05",
  "#ea4335",
  "#8e24aa",
  "#00acc1"
];

let footprintLayers = new Map();

function clearFootprints() {
  for (const [, layer] of footprintLayers) map.removeLayer(layer);
  footprintLayers.clear();
}

function toRad(deg) { return deg * Math.PI / 180; }
function toDeg(rad) { return rad * 180 / Math.PI; }

function horizonAngularRadiusRad(altKm) {
  const Re = EARTH_RADIUS_KM;
  const r = Re + altKm;
  return Math.acos(Re / r);
}

function footprintBoundaryPoints(sat, steps = 720) {
  const lon0 = toRad(sat.lon);
  const lat0 = toRad(sat.lat ?? DEFAULT_SAT_LAT);
  const altKm = sat.alt_km ?? DEFAULT_SAT_ALT_KM;

  const p = horizonAngularRadiusRad(altKm);
  const sinp = Math.sin(p);
  const cosp = Math.cos(p);

  const pts = [];

  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;

    let lat, lon;

    if (Math.abs(lat0) < 1e-12) {
      lat = Math.asin(sinp * Math.cos(a));
      lon = lon0 + Math.atan2(Math.sin(a) * sinp, cosp);
    } else {
      const sinLat0 = Math.sin(lat0);
      const cosLat0 = Math.cos(lat0);
      lat = Math.asin(sinLat0 * cosp + cosLat0 * sinp * Math.cos(a));
      lon = lon0 + Math.atan2(
        Math.sin(a) * sinp * cosLat0,
        cosp - sinLat0 * Math.sin(lat)
      );
    }

    const latDeg = toDeg(lat);
    const lonDegRaw = toDeg(lon);
    pts.push([latDeg, lonDegRaw]);
  }

  const first = pts[0];
  const last = pts[pts.length - 1];
  if (first[0] !== last[0] || normalizeLon180(first[1]) !== normalizeLon180(last[1])) {
    pts.push([first[0], first[1]]);
  }

  return pts;
}

function fitToFootprints() {
  try {
    if (!footprintLayers.size) return;
    const group = L.featureGroup([...footprintLayers.values()]);
    const b = group.getBounds();
    if (b && b.isValid()) {
      map.fitBounds(b, { padding: [20, 20], maxZoom: 4 });
    }
  } catch {}
}

function updateFootprints() {
  clearFootprints();
  if (!footprintEnabled) return;
  if (!selectedSatNames.size) return;

  const selected = satellites
    .filter(s => selectedSatNames.has(s.name))
    .sort((a, b) => (a.lon - b.lon) || a.name.localeCompare(b.name));

  selected.forEach((sat, idx) => {
    const color = FOOTPRINT_COLORS[idx % FOOTPRINT_COLORS.length];

    const boundary = footprintBoundaryPoints(sat, 720);
    const rings = splitRingIntoDatelinePolygons(boundary);
    if (!rings.length) return;

    const multi = rings
      .filter(r => r.length >= 4)
      .map(r => [r]);

    if (!multi.length) return;

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

  if (footprintEnabled && autoFitFootprints) {
    autoFitFootprints = false;
    fitToFootprints();
  }
}

/* ============================
 Panel Toggle + Pin
============================ */
const PIN_STORAGE_KEY = "satPanelPinned";

function safeGetPinnedFromStorage() {
  try { return localStorage.getItem(PIN_STORAGE_KEY) === "true"; }
  catch { return false; }
}

function safeSetPinnedToStorage(val) {
  try { localStorage.setItem(PIN_STORAGE_KEY, val ? "true" : "false"); }
  catch {}
}

let panelPinned = safeGetPinnedFromStorage();

function syncPanelPinnedUI() {
  if (satPanel) satPanel.classList.toggle("pinned", panelPinned);
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
  if (panelPinned) openPanel();
  else if (satPanel?.classList.contains("open") && satBackdrop) satBackdrop.classList.add("open");
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closePanel(false);
});

window.addEventListener("resize", syncPanelPinnedUI);

syncPanelPinnedUI();
if (panelPinned) openPanel();

/* ============================
 Icons
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
 Great-Circle Path (Upgraded)
============================ */
function greatCirclePoints(lat1, lon1, lat2, lon2, steps = GREAT_CIRCLE_STEPS) {
  const φ1 = degToRad(lat1), λ1 = degToRad(lon1);
  const φ2 = degToRad(lat2), λ2 = degToRad(lon2);

  const v1 = [Math.cos(φ1) * Math.cos(λ1), Math.cos(φ1) * Math.sin(λ1), Math.sin(φ1)];
  const v2 = [Math.cos(φ2) * Math.cos(λ2), Math.cos(φ2) * Math.sin(λ2), Math.sin(φ2)];

  const rawDot = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
  if (!isFinite(rawDot)) return [[lat1, lon1], [lat2, lon2]];

  const dot = Math.min(1, Math.max(-1, rawDot));
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

    const lat = radToDeg(Math.atan2(z, Math.sqrt(x * x + y * y)));
    const lonRaw = radToDeg(Math.atan2(y, x));

    // FIX: Normalize longitude to avoid dateline tearing
    pts.push([lat, normalizeLon180(lonRaw)]);
  }

  return pts;
}

/* ============================
 Satellite Markers + Label Visibility
============================ */
function addSatelliteMarkers() {
  for (const [, m] of satMarkers) map.removeLayer(m);
  satMarkers.clear();

  satellites.forEach((sat) => {
    const marker = L.marker([sat.lat, sat.lon], {
      icon: satIcon(selectedSatNames.has(sat.name))
    }).addTo(map);

    const labelHtml =
      `<span class="name">${sat.name}</span><span class="lon">${sat.lon.toFixed(1)}°</span>`;

    const labelPermanent =
      (map.getZoom() >= LABEL_ZOOM_THRESHOLD) || selectedSatNames.has(sat.name);

    marker.bindTooltip(labelHtml, {
      permanent: labelPermanent,
      direction: "top",
      className: "sat-label",
      offset: [0, -24]
    });

    if (labelPermanent) marker.openTooltip();

    satMarkers.set(sat.name, marker);
  });

  refreshMarkerSelection();
  updateLabelVisibility();
}

function refreshMarkerSelection() {
  for (const sat of satellites) {
    const marker = satMarkers.get(sat.name);
    if (!marker) continue;
    const isSelected = selectedSatNames.has(sat.name);
    marker.setIcon(satIcon(isSelected));
    marker.setZIndexOffset(isSelected ? 1000 : 0);
  }
  updateLabelVisibility();
}

function updateLabelVisibility() {
  for (const sat of satellites) {
    const marker = satMarkers.get(sat.name);
    if (!marker) continue;

    const shouldBePermanent =
      (map.getZoom() >= LABEL_ZOOM_THRESHOLD) || selectedSatNames.has(sat.name);

    const tt = marker.getTooltip();
    if (!tt) continue;

    // FIX: Only rebuild when needed (prevents flicker)
    if (tt.options.permanent === shouldBePermanent) continue;

    const content = tt.getContent();
    marker.unbindTooltip();
    marker.bindTooltip(content, {
      permanent: shouldBePermanent,
      direction: "top",
      className: "sat-label",
      offset: [0, -24]
    });

    if (shouldBePermanent) marker.openTooltip();
  }
}

map.on("zoomend", updateLabelVisibility);

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
  const segs = splitPolylineAtDateline(latlngs);
  const layers = [];
  for (const s of segs) {
    const pl = L.polyline(
      s.map(([lat, lon]) => [lat, normalizeLon180(lon)]),
      options
    ).addTo(map);
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
      if (!name) return;

      if (selectedSatNames.has(name)) selectedSatNames.delete(name);
      else selectedSatNames.add(name);

      autoFitFootprints = footprintEnabled;

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
      latitude: satellite.degreesToRadians(sat.lat),
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
  let changed = false;
  for (const name of Array.from(selectedSatNames)) {
    if (!filteredNames.has(name)) {
      selectedSatNames.delete(name);
      changed = true;
    }
  }
  if (changed) refreshMarkerSelection();

  filtered.forEach((r) => {
    if (r.el <= 0) return;
    const isSelected = selectedSatNames.has(r.sat.name);
    const pts = greatCirclePoints(lat, lon, r.sat.lat, r.sat.lon);

    const options = {
      color: r.el > MIN_USABLE_EL ? "#1e8e3e" : "#1a73e8",
      weight: isSelected ? 5 : 3,
      opacity: isSelected ? 0.95 : 0.70,
      dashArray: r.el > MIN_USABLE_EL ? null : "5,5"
    };

    const segLayers = addWrappedPolyline(pts, options, isSelected);
    lineLayers.push(...segLayers);
  });

  buildTable(filtered);

  const selectedRows = computed.filter(r => selectedSatNames.has(r.sat.name));
  renderObserverInfo(lat, lon, heightKm);
  renderSelectedInfo(selectedRows);

  updateFootprints();

  if (info) info.innerHTML = "";
}

/* ============================
 Debounce Helper
============================ */
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

/* ============================
 Map + UI Events
============================ */
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

if (footprintToggle) {
  footprintToggle.addEventListener("change", () => {
    footprintEnabled = !!footprintToggle.checked;
    safeSetFootprintToStorage(footprintEnabled);
    autoFitFootprints = footprintEnabled;
    updateFootprints();
  });
}

/* ============================
 Autocomplete (Upgraded)
============================ */
let acItems = [];
let acActiveIndex = -1;
let acTimer = null;
const acCache = {};

function hideAutocomplete() {
  if (!autocomplete) return;
  autocomplete.classList.add("hidden");
  autocomplete.innerHTML = "";
  acItems = [];
  acActiveIndex = -1;
  searchInput.removeAttribute("aria-activedescendant");
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
    const id = `ac-item-${idx}`;
    return `
      <div class="autocomplete-item"
           id="${id}"
           role="option"
           aria-selected="false"
           data-idx="${idx}">
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

  nodes.forEach(n => {
    n.classList.remove("active");
    n.setAttribute("aria-selected", "false");
  });

  if (idx >= 0 && idx < nodes.length) {
    const node = nodes[idx];
    node.classList.add("active");
    node.setAttribute("aria-selected", "true");
    node.scrollIntoView({ block: "nearest" });
    searchInput.setAttribute("aria-activedescendant", node.id);
  } else {
    searchInput.removeAttribute("aria-activedescendant");
  }

  acActiveIndex = idx;
}

function chooseAutocomplete(idx) {
  const p = acItems[idx];
  if (!p) return;

  searchInput.value = p.display_name || searchInput.value;
  hideAutocomplete();

  const lat = parseFloat(p.lat);
  const lon = parseFloat(p.lon);
  if (!isNaN(lat) && !isNaN(lon)) {
    updateLocation(lat, lon, lastObserver.heightKm, true);
  }
}

searchInput.addEventListener("input", () => {
  clearTimeout(acTimer);
  const q = searchInput.value.trim();

  if (q.length < 3) {
    hideAutocomplete();
    return;
  }

  if (acCache[q]) {
    renderAutocomplete(acCache[q]);
    return;
  }

  acTimer = setTimeout(() => {
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=8&addressdetails=1`, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Satellite-Antenna-Tracker/1.0"
      }
    })
      .then(res => res.json())
      .then(data => {
        const items = Array.isArray(data) ? data : [];
        acCache[q] = items;
        renderAutocomplete(items);
      })
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

/* Close autocomplete when clicking outside */
document.addEventListener("click", (e) => {
  if (!autocomplete) return;
  if (!autocomplete.contains(e.target) && e.target !== searchInput) {
    hideAutocomplete();
  }
});

/* ============================
 Satellite Loader (External JSON)
============================ */

/**
 * Normalizes a satellite entry from satellites.json
 * - Ensures lat = 0 (GEO)
 * - Ensures alt_km = 35786 (GEO)
 */
function normalizeSatellite(s) {
  return {
    name: s.name,
    lon: Number(s.lon),
    lat: 0,
    alt_km: 35786
  };
}

/**
 * Loads satellites into the app
 */
function loadSatellites(list) {
  satellites = list
    .map(normalizeSatellite)
    .sort((a, b) => a.lon - b.lon);

  addSatelliteMarkers();
  updateLocation(lastObserver.lat, lastObserver.lon, lastObserver.heightKm, false);
}

/* ============================
 Fetch satellites.json
============================ */
function fetchSatellites() {
  fetch("satellites.json", {
    headers: {
      "Accept": "application/json"
    }
  })
    .then(res => res.json())
    .then(data => {
      if (!Array.isArray(data)) {
        console.error("satellites.json is not an array");
        return;
      }
      loadSatellites(data);
    })
    .catch(err => {
      console.error("Failed to load satellites.json:", err);
    });
}

/* ============================
 Final Initialization
============================ */

// Sync pinned state on load
syncPanelPinnedUI();

// Render initial observer info
renderObserverInfo(lastObserver.lat, lastObserver.lon, lastObserver.heightKm);

// Load satellites from external file
fetchSatellites();

// Apply footprint state on load
if (footprintEnabled) updateFootprints();

console.log("Satellite Antenna Tracker initialized.");