const map = L.map('map', {
  zoomControl: true,
  attributionControl: false,
  minZoom: 3,
  maxZoom: 19
}).setView([39.0, -104.0], 4);

const baseLayers = {
  "Satellite": L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { attribution: 'Tiles © Esri', maxZoom: 19 }
  ),
  "Dark": L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    { attribution: '© OpenStreetMap & Carto', maxZoom: 19 }
  ),
  "Streets": L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { attribution: '© OpenStreetMap contributors', maxZoom: 19 }
  ),
  "Terrain": L.tileLayer(
    'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    { attribution: 'Map data: © OpenTopoMap (CC-BY-SA)', maxZoom: 17 }
  )
};

baseLayers["Streets"].addTo(map);
L.control.layers(baseLayers, null, { position: 'topright' }).addTo(map);
L.control.scale({ imperial: true, metric: true, position: 'bottomright' }).addTo(map);

const info = document.getElementById('info');
const searchInput = document.getElementById('search');
const geoBtn = document.getElementById('geo');
const satTable = document.getElementById('sat-table');
const suggestions = document.getElementById('suggestions');
const sortSelect = document.getElementById('sort');

/** ---- Tunables / Defaults ---- **/
const DEFAULT_SAT_LAT = 0;         // degrees
const DEFAULT_SAT_ALT_KM = 35786;  // GEO altitude in km (approx)
const MIN_VISIBLE_EL = 0;          // degrees
const MIN_USABLE_EL = 10;          // degrees
const GREAT_CIRCLE_STEPS = 64;     // polyline resolution

let satellitesRaw = [];
let satMarkers = [];
let lines = [];

let selectedSatName = null;
let sortMode = 'lon';

let lastObserver = { lat: 39.0, lon: -104.0, heightKm: 2.3 };
let lastComputed = [];

/** ---- Markers ---- **/
const userMarker = L.marker([0, 0], {
  icon: L.divIcon({
    className: 'user-marker',
    html: '<span class="material-icons">location_on</span>',
    iconSize: [48, 48],
    iconAnchor: [24, 48]
  })
}).addTo(map);

/** ---- Helpers ---- **/
function degToRad(d) { return d * Math.PI / 180; }
function radToDeg(r) { return r * 180 / Math.PI; }
function normAzDeg(deg) { return (deg % 360 + 360) % 360; }

/**
 * Great-circle interpolation (slerp) between two lat/lon points.
 * Returns array of [lat, lon] points for Leaflet polyline.
 */
function greatCirclePoints(lat1, lon1, lat2, lon2, steps = GREAT_CIRCLE_STEPS) {
  const φ1 = degToRad(lat1), λ1 = degToRad(lon1);
  const φ2 = degToRad(lat2), λ2 = degToRad(lon2);

  // Convert to unit vectors
  const v1 = [
    Math.cos(φ1) * Math.cos(λ1),
    Math.cos(φ1) * Math.sin(λ1),
    Math.sin(φ1)
  ];
  const v2 = [
    Math.cos(φ2) * Math.cos(λ2),
    Math.cos(φ2) * Math.sin(λ2),
    Math.sin(φ2)
  ];

  // Angle between vectors
  const dot = Math.min(1, Math.max(-1, v1[0]*v2[0] + v1[1]*v2[1] + v1[2]*v2[2]));
  const ω = Math.acos(dot);

  // If points are identical or extremely close
  if (!isFinite(ω) || ω === 0) {
    return [[lat1, lon1], [lat2, lon2]];
  }

  const sinω = Math.sin(ω);
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = Math.sin((1 - t) * ω) / sinω;
    const b = Math.sin(t * ω) / sinω;

    const x = a * v1[0] + b * v2[0];
    const y = a * v1[1] + b * v2[1];
    const z = a * v1[2] + b * v2[2];

    const φ = Math.atan2(z, Math.sqrt(x*x + y*y));
    const λ = Math.atan2(y, x);

    pts.push([radToDeg(φ), radToDeg(λ)]);
  }
  return pts;
}

function satDisplayLat(sat) { return (sat.lat ?? DEFAULT_SAT_LAT); }
function satDisplayAltKm(sat) { return (sat.alt_km ?? DEFAULT_SAT_ALT_KM); }

function assumptionText() {
  return `Assumes geosynchronous-style look angles using satellites.json lat/alt (default ${DEFAULT_SAT_LAT}° lat, ${DEFAULT_SAT_ALT_KM.toLocaleString()} km).`;
}

/** ---- Satellite markers ---- **/
function addSatelliteMarkers() {
  satMarkers.forEach(m => map.removeLayer(m));
  satMarkers = [];

  satellitesRaw.forEach(sat => {
    const lat = satDisplayLat(sat);
    const marker = L.marker([lat, sat.lon], {
      icon: L.divIcon({
        className: 'sat-marker',
        html: '<span class="material-icons">satellite</span>',
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      })
    }).addTo(map);

    const label = `${sat.name}\n${sat.lon.toFixed(1)}°`;
    marker.bindTooltip(label, {
      permanent: true,
      direction: 'top',
      className: 'sat-label',
      offset: [0, -10]
    }).openTooltip();

    satMarkers.push(marker);
  });
}

/** ---- Core computation + UI ---- **/
function computeLookAnglesForObserver(lat, lon, heightKm) {
  const observerGd = {
    longitude: satellite.degreesToRadians(lon),
    latitude: satellite.degreesToRadians(lat),
    height: heightKm
  };

  return satellitesRaw.map(sat => {
    const satLat = satDisplayLat(sat);
    const satAlt = satDisplayAltKm(sat);

    const positionEcf = satellite.geodeticToEcf({
      longitude: satellite.degreesToRadians(sat.lon),
      latitude: satellite.degreesToRadians(satLat),
      height: satAlt
    });

    const lookAngles = satellite.ecfToLookAngles(observerGd, positionEcf);
    const az = normAzDeg(radToDeg(lookAngles.azimuth));
    const el = radToDeg(lookAngles.elevation);

    const status = el > MIN_USABLE_EL ? 'Good' : (el > MIN_VISIBLE_EL ? 'Low' : 'Bad');
    const color = el > MIN_USABLE_EL ? 'green' : (el > MIN_VISIBLE_EL ? 'blue' : 'red');
    const dashArray = el > MIN_USABLE_EL ? null : '5, 5';

    return {
      ...sat,
      satLat,
      satAlt,
      az,
      el,
      status,
      color,
      dashArray
    };
  });
}

function sortComputedList(list) {
  if (sortMode === 'el') {
    // Descending elevation; stable tiebreakers
    return [...list].sort((a, b) => (b.el - a.el) || (a.lon - b.lon) || a.name.localeCompare(b.name));
  }
  // Longitude ascending
  return [...list].sort((a, b) => (a.lon - b.lon) || a.name.localeCompare(b.name));
}

function clearLines() {
  lines.forEach(l => map.removeLayer(l));
  lines = [];
}

function renderTableAndLines(observerLat, observerLon, computedSorted) {
  clearLines();

  let html = `
<table>
  <tr>
    <th>Satellite</th>
    <th>Az</th>
    <th>El</th>
    <th>Status</th>
  </tr>
`;

  computedSorted.forEach(sat => {
    const isSelected = selectedSatName && sat.name === selectedSatName;

    html += `
  <tr class="sat-row ${isSelected ? 'selected' : ''}" data-sat="${sat.name}">
    <td>${sat.name}</td>
    <td>${sat.az.toFixed(1)}°</td>
    <td>${sat.el.toFixed(1)}°</td>
    <td>${sat.status}</td>
  </tr>
`;

    // Draw great-circle polyline between observer and satellite subsatellite point (visual approximation)
    const satPoint = [sat.satLat, sat.lon];
    const points = greatCirclePoints(observerLat, observerLon, satPoint[0], satPoint[1]);

    const line = L.polyline(points, {
      color: sat.color,
      weight: isSelected ? 5 : 3,
      opacity: isSelected ? 0.9 : 0.7,
      dashArray: sat.dashArray
    }).addTo(map);

    lines.push(line);
  });

  html += `</table>`;
  satTable.innerHTML = html;

  // Attach row click handlers
  satTable.querySelectorAll('tr[data-sat]').forEach(row => {
    row.addEventListener('click', () => {
      const name = row.getAttribute('data-sat');
      selectedSatName = (selectedSatName === name) ? null : name;
      // Re-render without moving observer
      updateLocation(lastObserver.lat, lastObserver.lon, lastObserver.heightKm, false);
    });
  });
}

function renderInfoPanel(observerLat, observerLon, heightKm) {
  const sel = selectedSatName
    ? lastComputed.find(s => s.name === selectedSatName)
    : null;

  const locLine = `<b>Observer:</b> ${observerLat.toFixed(4)}°, ${observerLon.toFixed(4)}° @ ${heightKm.toFixed(2)} km`;
  const assumeLine = `<span style="color:#555">${assumptionText()}</span>`;

  let selLine = `<b>Selected:</b> none (click a table row to lock)`;
  if (sel) {
    selLine = `<b>Selected:</b> ${sel.name} — Az ${sel.az.toFixed(1)}°, El ${sel.el.toFixed(1)}° (${sel.status})`;
  }

  info.innerHTML = `${locLine}<br>${selLine}<br>${assumeLine}`;
}

function updateLocation(lat, lon, heightKm = 0, setZoom = false) {
  lastObserver = { lat, lon, heightKm };

  userMarker.setLatLng([lat, lon]);
  if (setZoom) map.setView([lat, lon], 12);

  lastComputed = computeLookAnglesForObserver(lat, lon, heightKm);
  const computedSorted = sortComputedList(lastComputed);

  renderTableAndLines(lat, lon, computedSorted);
  renderInfoPanel(lat, lon, heightKm);
}

/** ---- Load satellites ---- **/
fetch('satellites.json')
  .then(res => res.json())
  .then(data => {
    satellitesRaw = Array.isArray(data) ? data : [];
    addSatelliteMarkers();
    updateLocation(lastObserver.lat, lastObserver.lon, lastObserver.heightKm, true);
  })
  .catch(err => {
    console.error('Failed to load satellites:', err);
    satellitesRaw = [{ name: 'Fallback', lon: -104, lat: DEFAULT_SAT_LAT, alt_km: DEFAULT_SAT_ALT_KM, type: 'GEO' }];
    addSatelliteMarkers();
    updateLocation(lastObserver.lat, lastObserver.lon, lastObserver.heightKm, true);
  });

/** ---- Geolocation on load ---- **/
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    pos => {
      const hKm = ((pos.coords.altitude ?? 0) / 1000);
      updateLocation(pos.coords.latitude, pos.coords.longitude, hKm, true);
    },
    err => {
      console.warn('Geolocation failed:', err);
      updateLocation(lastObserver.lat, lastObserver.lon, lastObserver.heightKm, true);
    },
    { enableHighAccuracy: true, timeout: 5000 }
  );
} else {
  updateLocation(lastObserver.lat, lastObserver.lon, lastObserver.heightKm, true);
}

/** ---- Sort control ---- **/
sortSelect.addEventListener('change', () => {
  sortMode = sortSelect.value;
  updateLocation(lastObserver.lat, lastObserver.lon, lastObserver.heightKm, false);
});

/** ---- Autocomplete ---- **/
let timeout;
searchInput.addEventListener('input', () => {
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    const q = searchInput.value.trim();
    if (q.length < 3) {
      suggestions.innerHTML = '';
      return;
    }

    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=8&addressdetails=1`)
      .then(res => res.json())
      .then(data => {
        suggestions.innerHTML = '';
        data.forEach(place => {
          const opt = document.createElement('option');
          opt.value = place.display_name;
          suggestions.appendChild(opt);
        });

        // Nudge datalist rendering on some mobile browsers
        searchInput.focus();
        searchInput.blur();
        searchInput.focus();
      })
      .catch(err => console.error('Nominatim error:', err));
  }, 400);
});

searchInput.addEventListener('change', () => {
  const q = searchInput.value.trim();
  if (!q) return;

  fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`)
    .then(res => res.json())
    .then(data => {
      if (data[0]) updateLocation(parseFloat(data[0].lat), parseFloat(data[0].lon), lastObserver.heightKm, true);
    });
});

/** ---- Map click sets observer ---- **/
map.on('click', e => updateLocation(e.latlng.lat, e.latlng.lng, lastObserver.heightKm, false));

/** ---- Geo button ---- **/
geoBtn.addEventListener('click', () => {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(pos => {
    const hKm = ((pos.coords.altitude ?? 0) / 1000);
    updateLocation(pos.coords.latitude, pos.coords.longitude, hKm, true);
  });
});
