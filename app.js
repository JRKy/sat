const map = L.map('map').setView([39.0, -104.0], 4);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap'
}).addTo(map);

const info = document.getElementById('info');
const searchInput = document.getElementById('search');
const geoBtn = document.getElementById('geo');

const satellites = [
  { name: 'MUOS-1', lon: -100 },
  { name: 'MUOS-2', lon: -177 },
  { name: 'MUOS-3', lon: -16 },
  { name: 'MUOS-4', lon: 75 },
  { name: 'MUOS-5', lon: -105 }
];

const userMarker = L.marker([0, 0]).addTo(map);
const lines = [];
const labels = [];

function updateLocation(lat, lon, height = 0) {
  userMarker.setLatLng([lat, lon]);
  map.setView([lat, lon], 10);

  const observerGd = {
    longitude: satellite.degreesToRadians(lon),
    latitude: satellite.degreesToRadians(lat),
    height: height
  };

  lines.forEach(l => map.removeLayer(l));
  labels.forEach(l => map.removeLayer(l));
  lines.length = 0;
  labels.length = 0;

  let html = '';
  satellites.forEach((sat, i) => {
    const positionEcf = satellite.geodeticToEcf({
      longitude: satellite.degreesToRadians(sat.lon),
      latitude: 0,
      height: 35786
    });

    const lookAngles = satellite.ecfToLookAngles(observerGd, positionEcf);

    const az = lookAngles.azimuth * 180 / Math.PI;
    const el = lookAngles.elevation * 180 / Math.PI;
    const status = el > 10 ? 'Good' : 'Bad';
    const color = el > 10 ? 'green' : 'red';

    html += `${sat.name}: Az ${az.toFixed(1)}° El ${el.toFixed(1)}° (${status})<br>`;

    if (el > 0) {
      const line = L.polyline([[lat, lon], [0, sat.lon]], {
        color,
        weight: 3,
        opacity: 0.7
      }).addTo(map);
      lines.push(line);

      // Anchor label ~5-10% along line (close to user, follows direction)
      const frac = 0.08 + i * 0.02; // slight stagger per satellite
      const labelLat = lat + frac * (0 - lat);
      const labelLon = lon + frac * (sat.lon - lon);
      const label = L.tooltip([labelLat, labelLon], {
        permanent: true,
        direction: 'center',
        className: 'line-label',
        offset: [0, -12],
        pane: 'tooltipPane'
      }).setContent(sat.name).addTo(map);
      labels.push(label);
    }
  });

  info.innerHTML = html;
}

// Initial load
updateLocation(39.0, -104.0, 2.3);

map.on('click', e => updateLocation(e.latlng.lat, e.latlng.lng));

geoBtn.addEventListener('click', () => {
  navigator.geolocation.getCurrentPosition(pos => {
    updateLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.altitude / 1000 || 0);
  });
});

searchInput.addEventListener('keypress', e => {
  if (e.key === 'Enter') {
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchInput.value)}&format=json`)
      .then(res => res.json())
      .then(data => {
        if (data[0]) {
          updateLocation(parseFloat(data[0].lat), parseFloat(data[0].lon));
        }
      });
  }
});