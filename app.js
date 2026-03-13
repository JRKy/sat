const map = L.map('map', {
  zoomControl: true,
  attributionControl: false,
  minZoom: 3,
  maxZoom: 19
}).setView([39.0, -104.0], 4);

const baseLayers = {
  "Satellite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri',
    maxZoom: 19
  }),
  "Dark": L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap & Carto',
    maxZoom: 19
  }),
  "Streets": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  }),
  "Terrain": L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: 'Map data: © OpenTopoMap (CC-BY-SA)',
    maxZoom: 17
  })
};

baseLayers["Streets"].addTo(map);

L.control.layers(baseLayers, null, { position: 'topright' }).addTo(map);

L.control.scale({ imperial: true, metric: true }).addTo(map);

const info = document.getElementById('info');
const searchInput = document.getElementById('search');
const geoBtn = document.getElementById('geo');
const satTable = document.getElementById('sat-table');
const suggestions = document.getElementById('suggestions');

let satellites = [];

fetch('satellites.json')
  .then(res => res.json())
  .then(data => {
    satellites = data.sort((a, b) => a.lon - b.lon);
    addSatelliteMarkers();
    updateLocation(39.0, -104.0, 2.3, true);
  })
  .catch(err => {
    console.error('Failed to load satellites:', err);
    satellites = [{ name: 'Fallback', lon: -104 }];
    addSatelliteMarkers();
    updateLocation(39.0, -104.0, 2.3, true);
  });

const userMarker = L.marker([0, 0], {
  icon: L.divIcon({
    className: 'user-marker',
    html: '<span class="material-icons">location_on</span>',
    iconSize: [48, 48],
    iconAnchor: [24, 48]
  })
}).addTo(map);

const lines = [];
const satMarkers = [];

function addSatelliteMarkers() {
  satMarkers.forEach(m => map.removeLayer(m));
  satMarkers.length = 0;

  satellites.forEach(sat => {
    const marker = L.marker([0, sat.lon], {
      icon: L.divIcon({
        className: 'sat-marker',
        html: '<span class="material-icons">satellite</span>',
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      })
    }).addTo(map);

    marker.bindTooltip(`${sat.name}<br>${sat.lon.toFixed(1)}°`, {
      permanent: true,
      direction: 'top',
      className: 'sat-label',
      offset: [0, -10]
    }).openTooltip();

    satMarkers.push(marker);
  });
}

function updateLocation(lat, lon, height = 0, setZoom = false) {
  userMarker.setLatLng([lat, lon]);
  if (setZoom) map.setView([lat, lon], 12);

  const observerGd = {
    longitude: satellite.degreesToRadians(lon),
    latitude: satellite.degreesToRadians(lat),
    height: height
  };

  lines.forEach(l => map.removeLayer(l));
  lines.length = 0;

  let html = '<table><tr><th>Satellite</th><th>Az</th><th>El</th><th>Status</th></tr>';
  satellites.forEach((sat, i) => {
    const positionEcf = satellite.geodeticToEcf({
      longitude: satellite.degreesToRadians(sat.lon),
      latitude: 0,
      height: 35786
    });

    const lookAngles = satellite.ecfToLookAngles(observerGd, positionEcf);

    const az = lookAngles.azimuth * 180 / Math.PI;
    const el = lookAngles.elevation * 180 / Math.PI;
    const status = el > 10 ? 'Good' : (el > 0 ? 'Low' : 'Bad');
    let color = el > 10 ? 'green' : (el > 0 ? 'blue' : 'red');
    let dashArray = el > 10 ? null : '5, 5';

    html += `<tr style="color:${color}"><td>${sat.name}</td><td>${az.toFixed(1)}°</td><td>${el.toFixed(1)}°</td><td>${status}</td></tr>`;

    const line = L.polyline([[lat, lon], [0, sat.lon]], {
      color,
      weight: 3,
      opacity: 0.7,
      dashArray
    }).addTo(map);
    lines.push(line);
  });
  html += '</table>';
  satTable.innerHTML = html;
  info.innerHTML = '';
}

// Auto-detect on load
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    pos => updateLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.altitude / 1000 || 0, true),
    err => {
      console.warn('Geolocation failed:', err);
      updateLocation(39.0, -104.0, 2.3, true);
    },
    { enableHighAccuracy: true, timeout: 5000 }
  );
} else {
  updateLocation(39.0, -104.0, 2.3, true);
}

// Autocomplete
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
        searchInput.focus(); searchInput.blur(); searchInput.focus();
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
      if (data[0]) updateLocation(parseFloat(data[0].lat), parseFloat(data[0].lon));
    });
});

map.on('click', e => updateLocation(e.latlng.lat, e.latlng.lng));

geoBtn.addEventListener('click', () => {
  navigator.geolocation.getCurrentPosition(pos => {
    updateLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.altitude / 1000 || 0, true);
  });
});