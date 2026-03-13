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

const DEFAULT_SAT_LAT = 0;
const DEFAULT_SAT_ALT_KM = 35786;
const MIN_VISIBLE_EL = 0;
const MIN_USABLE_EL = 10;
const GREAT_CIRCLE_STEPS = 64;

let satellitesRaw = [];
let satMarkers = [];
let lines = [];
let selectedSatName = null;
let sortMode = 'lon';

let lastObserver = { lat: 39.0, lon: -104.0, heightKm: 2.3 };
let lastComputed = [];

const userMarker = L.marker([0, 0], {
  icon: L.divIcon({
    className: 'user-marker',
    html: '<span class="material-icons">location_on</span>',
    iconSize: [48, 48],
    iconAnchor: [24, 48]
  })
}).addTo(map);

function degToRad(d) { return d * Math.PI / 180; }
function radToDeg(r) { return r * 180 / Math.PI; }
function normAzDeg(d) { return (d % 360 + 360) % 360; }

function greatCirclePoints(lat1, lon1, lat2, lon2, steps = GREAT_CIRCLE_STEPS) {
  const φ1 = degToRad(lat1), λ1 = degToRad(lon1);
  const φ2 = degToRad(lat2), λ2 = degToRad(lon2);

  const v1 = [Math.cos(φ1)*Math.cos(λ1), Math.cos(φ1)*Math.sin(λ1), Math.sin(φ1)];
  const v2 = [Math.cos(φ2)*Math.cos(λ2), Math.cos(φ2)*Math.sin(λ2), Math.sin(φ2)];

  const dot = Math.min(1, Math.max(-1, v1[0]*v2[0] + v1[1]*v2[1] + v1[2]*v2[2]));
  const ω = Math.acos(dot);
  if (!isFinite(ω) || ω === 0) return [[lat1, lon1], [lat2, lon2]];

  const sinω = Math.sin(ω);
  const pts = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = Math.sin((1 - t) * ω) / sinω;
    const b = Math.sin(t * ω) / sinω;

    const x = a*v1[0] + b*v2[0];
    const y = a*v1[1] + b*v2[1];
    const z = a*v1[2] + b*v2[2];

    pts.push([radToDeg(Math.atan2(z, Math.sqrt(x*x + y*y))), radToDeg(Math.atan2(y, x))]);
  }
  return pts;
}

function addSatelliteMarkers() {
  satMarkers.forEach(m => map.removeLayer(m));
  satMarkers = [];

  satellitesRaw.forEach(sat => {
    const marker = L.marker([sat.lat ?? DEFAULT_SAT_LAT, sat.lon], {
      icon: L.divIcon({
        className: 'sat-marker',
        html: '<span class="material-icons">satellite</span>',
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      })
    }).addTo(map);

    marker.bindTooltip(`${sat.name}\n${sat.lon.toFixed(1)}°`, {
      permanent: true,
      direction: 'top',
      className: 'sat-label',
      offset: [0, -10]
    }).openTooltip();

    satMarkers.push(marker);
  });
}

function updateLocation(lat, lon, heightKm = 0, setZoom = false) {
  lastObserver = { lat, lon, heightKm };
  userMarker.setLatLng([lat, lon]);
  if (setZoom) map.setView([lat, lon], 12);

  lines.forEach(l => map.removeLayer(l));
  lines = [];

  const observerGd = {
    longitude: satellite.degreesToRadians(lon),
    latitude: satellite.degreesToRadians(lat),
    height: heightKm
  };

  let html = `
<table>
<tr><th>Satellite</th><th>Az</th><th>El</th><th>Status</th></tr>
`;

  satellitesRaw.forEach(sat => {
    const positionEcf = satellite.geodeticToEcf({
      longitude: satellite.degreesToRadians(sat.lon),
      latitude: satellite.degreesToRadians(sat.lat ?? DEFAULT_SAT_LAT),
      height: sat.alt_km ?? DEFAULT_SAT_ALT_KM
    });

    const look = satellite.ecfToLookAngles(observerGd, positionEcf);
    const az = normAzDeg(radToDeg(look.azimuth));
    const el = radToDeg(look.elevation);

    const status = el > MIN_USABLE_EL ? 'Good' : (el > 0 ? 'Low' : 'Bad');
    const color = el > MIN_USABLE_EL ? 'green' : (el > 0 ? 'blue' : 'red');
    const dash = el > MIN_USABLE_EL ? null : '5,5';

    html += `<tr><td>${sat.name}</td><td>${az.toFixed(1)}°</td><td>${el.toFixed(1)}°</td><td>${status}</td></tr>`;

    // ✅ FIX: only draw LOS lines when satellite is above the horizon
    if (el > 0) {
      const pts = greatCirclePoints(lat, lon, sat.lat ?? 0, sat.lon);
      lines.push(L.polyline(pts, {
        color, weight: 3, opacity: 0.7, dashArray: dash
      }).addTo(map));
    }
  });

  satTable.innerHTML = html + '</table>';
  info.innerHTML = `<b>Observer:</b> ${lat.toFixed(4)}°, ${lon.toFixed(4)}° — Lines only drawn for visible satellites (El > 0°)`;
}

fetch('satellites.json')
  .then(r => r.json())
  .then(d => { satellitesRaw = d; addSatelliteMarkers(); updateLocation(lastObserver.lat, lastObserver.lon, lastObserver.heightKm, true); });