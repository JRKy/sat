/* ============================
   Map Initialization
============================ */

const map = L.map('map', {
  zoomControl: true,
  attributionControl: false,
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
L.control.scale({ imperial: true, metric: true, position: "bottomright" }).addTo(map);

/* ============================
   DOM References
============================ */

const searchInput = document.getElementById("search");
const geoBtn = document.getElementById("geo");
const autocomplete = document.getElementById("autocomplete");

const satPanel = document.getElementById("sat-panel");
const panelToggleBtn = document.getElementById("panel-toggle");
const panelToggleIcon = document.getElementById("panel-toggle-icon");

const satTable = document.getElementById("sat-table");
const sortSelect = document.getElementById("sort");

const cutoffSlider = document.getElementById("cutoff");
const cutoffValue = document.getElementById("cutoff-value");
const cutoffHintValue = document.getElementById("cutoff-hint-value");

const info = document.getElementById("info");

/* ============================
   Constants / State
============================ */

const DEFAULT_SAT_LAT = 0;         // degrees
const DEFAULT_SAT_ALT_KM = 35786;  // km (GEO approx)

const MIN_VISIBLE_EL = 0;          // degrees
const MIN_USABLE_EL = 10;          // degrees

const GREAT_CIRCLE_STEPS = 64;

let satellites = [];
let satMarkers = new Map(); // name -> L.Marker
let lineLayers = [];        // L.Polyline array (recreated each update)

let sortMode = "lon";
let elevationCutoff = 0;
let selectedSatName = null;

let lastObserver = { lat: 39.0, lon: -104.0, heightKm: 2.3 };

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
  // clear old
  for (const [, m] of satMarkers) map.removeLayer(m);
  satMarkers.clear();

  satellites.forEach((sat) => {
    const marker = L.marker([sat.lat ?? DEFAULT_SAT_LAT, sat.lon], {
      icon: satIcon(selectedSatName === sat.name)
    }).addTo(map);

    // Better-looking tooltip with a hard break and spacing above the icon
    marker.bindTooltip(
      `<span class="name">${sat.name}</span><span class="lon">${sat.lon.toFixed(1)}°</span>`,
      {
        permanent: true,
        direction: "top",
        className: "sat-label",
        offset: [0, -24] // gives breathing room above the icon
      }
    ).openTooltip();

    satMarkers.set(sat.name, marker);
  });

  refreshMarkerSelection();
}

/**
 * IMPORTANT FIX:
 * Leaflet markers don't support bringToFront().
 * Use z-index offset instead.
 */
function refreshMarkerSelection() {
  for (const sat of satellites) {
    const marker = satMarkers.get(sat.name);
    if (!marker) continue;

    const isSelected = selectedSatName === sat.name;
    marker.setIcon(satIcon(isSelected));

    // ✅ correct way to "bring forward" a Marker
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

function buildTable(rows) {
  if (!rows.length) {
    satTable.innerHTML = `
      <div style="padding:12px;color:#5f6368;font-size:13px;">
        No satellites meet the cutoff (El ≥ ${elevationCutoff}°).
      </div>
    `;
    return;
  }

  const html = `
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
          const selected = (selectedSatName === r.sat.name) ? "selected" : "";
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

  satTable.innerHTML = html;

  // Click row → select
  satTable.querySelectorAll("tr[data-sat]").forEach((row) => {
    row.addEventListener("click", () => {
      const name = row.getAttribute("data-sat");
      selectedSatName = (selectedSatName === name) ? null : name;
      refreshMarkerSelection();
      updateLocation(lastObserver.lat, lastObserver.lon, lastObserver.heightKm, false);
    });
  });
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

  // Sort
  computed.sort((a, b) => {
    if (sortMode === "el") return (b.el - a.el) || (a.sat.lon - b.sat.lon);
    return (a.sat.lon - b.sat.lon) || a.sat.name.localeCompare(b.sat.name);
  });

  // Filter by cutoff
  const filtered = computed.filter(r => r.el >= elevationCutoff);

  // Clear selection if it falls out of filter
  if (selectedSatName && !filtered.some(r => r.sat.name === selectedSatName)) {
    selectedSatName = null;
    refreshMarkerSelection();
  }

  // Draw lines only if above horizon AND above cutoff
  filtered.forEach((r) => {
    if (r.el <= 0) return; // behind Earth → no line on 2D map

    const isSelected = (selectedSatName === r.sat.name);

    const pts = greatCirclePoints(lat, lon, r.sat.lat ?? 0, r.sat.lon);
    const line = L.polyline(pts, {
      color: r.el > MIN_USABLE_EL ? "#1e8e3e" : "#1a73e8",
      weight: isSelected ? 5 : 3,
      opacity: isSelected ? 0.95 : 0.70,
      dashArray: r.el > MIN_USABLE_EL ? null : "5,5"
    }).addTo(map);

    if (isSelected) line.bringToFront(); // ✅ valid on polylines
    lineLayers.push(line);
  });

  buildTable(filtered);

  const selected = selectedSatName ? computed.find(r => r.sat.name === selectedSatName) : null;

  // Bottom-left info (lat/lon always visible)
  info.innerHTML = `
    <div><b>Observer:</b> ${lat.toFixed(5)}°, ${lon.toFixed(5)}°</div>
    <div><b>Cutoff:</b> El ≥ ${elevationCutoff}° (lines only if El > 0°)</div>
    <div><b>Selected:</b> ${
      selected
        ? `${selected.sat.name} — Az ${selected.az.toFixed(1)}°, El ${selected.el.toFixed(1)}° (${selected.status})`
        : "none (tap a row)"
    }</div>
  `;
}

/* ============================
   Events
============================ */

// map click to reposition observer
map.on("click", (e) => {
  updateLocation(e.latlng.lat, e.latlng.lng, lastObserver.heightKm, false);
});

// sort
sortSelect.addEventListener("change", () => {
  sortMode = sortSelect.value;
  updateLocation(lastObserver.lat, lastObserver.lon, lastObserver.heightKm, false);
});

// elevation cutoff
cutoffSlider.addEventListener("input", () => {
  elevationCutoff = parseFloat(cutoffSlider.value);
  cutoffValue.textContent = elevationCutoff.toFixed(0);
  cutoffHintValue.textContent = elevationCutoff.toFixed(0);
  updateLocation(lastObserver.lat, lastObserver.lon, lastObserver.heightKm, false);
});

// current location (user gesture)
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

// mobile panel collapse
panelToggleBtn?.addEventListener("click", () => {
  const collapsed = satPanel.classList.toggle("collapsed");
  panelToggleIcon.textContent = collapsed ? "expand_less" : "expand_more";
});

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
      // mousedown fires before blur
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

/**
 * Optional: reduce Chrome's "geolocation must be user gesture" warning.
 * Only auto-request location if permission is already granted.
 */
if (navigator.permissions && navigator.geolocation) {
  navigator.permissions.query({ name: "geolocation" }).then((perm) => {
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
  }).catch(() => {});
}