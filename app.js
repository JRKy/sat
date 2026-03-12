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

function updateLocation(lat, lon, height = 0) {
  userMarker.setLatLng([lat, lon]);
  map.setView([lat, lon], 10);

  const observer = {
    longitude: satellite.degreesToRadians(lon),
    latitude: satellite.degreesToRadians(lat),
    height: height
  };

  lines.forEach(line => map.removeLayer(line));
  lines.length = 0;

  let html = '';
  satellites.forEach(sat => {
    const position = {
      longitude: satellite.degreesToRadians(sat.lon),
      latitude: 0,
      height: 35786
    };

    const lookAngles = satellite.lookAngles(observer, position);
    const az = lookAngles.azimuth * 180 / Math.PI;
    const el = lookAngles.elevation * 180 / Math.PI;
    const status = el > 10 ? 'Good' : 'Bad';
    const color = el > 10 ? 'green' : 'red';

    html += `${sat.name}: Az ${az.toFixed(1)}° El ${el.toFixed(1)}° (${status})<br>`;

    if (el > 0) {
      const line = L.polyline([[lat, lon], [0, sat.lon]], { color }).addTo(map);
      lines.push(line);
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