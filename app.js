const map = L.map('map').setView([39.0, -104.0], 4);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap'
}).addTo(map);

const info = document.getElementById('info');
const searchInput = document.getElementById('search');
const geoBtn = document.getElementById('geo');

const satellites = [
  { name: 'MUOS-1', tle1: '1 38093U 12009A 26071.48060987 -.00000125 00000-0 00000-0 0 9992', tle2: '2 38093 5.2782 47.1923 0057630 358.1227 197.8379 1.00273191 51479' },
  { name: 'MUOS-2', tle1: '1 39206U 13036A   26071.23586730 -.00000010  00000-0  00000-0 0  9995', tle2: '2 39206   4.8021  45.3406 0052403 183.6448 197.8264  1.00269137 46227' },
  { name: 'MUOS-3', tle1: '1 40374U 15002A   26071.34697359 -.00000126  00000-0  00000-0 0  9998', tle2: '2 40374   4.3349  43.0263 0052851 183.8300  52.5714  1.00272785 40612' },
  { name: 'MUOS-4', tle1: '1 40887U 15044A   26071.58674965 -.00000090  00000-0  00000-0 0  9997', tle2: '2 40887   4.1482  41.5704 0058740 358.8243  56.0181  1.00272079 38590' },
  { name: 'MUOS-5', tle1: '1 41622U 16041A 26071.19905701 -.00000141 00000-0 00000+0 0 9991', tle2: '2 41622 2.4155 299.9264 0194902 262.5259 294.0053 1.00273443 36119' }
];

const satRecs = satellites.map(sat => satellite.twoline2satrec(sat.tle1, sat.tle2));
const satPositions = satRecs.map(rec => {
  const now = new Date();
  const posVel = satellite.propagate(rec, now);
  const gmst = satellite.gstime(now);
  const gd = satellite.eciToGeodetic(posVel.position, gmst);
  return { lat: satellite.degreesLat(gd.latitude), lon: satellite.degreesLong(gd.longitude) };
});

const userMarker = L.marker([0, 0]).addTo(map);
const lines = [];

function updateLocation(lat, lon, height = 0) {
  userMarker.setLatLng([lat, lon]);
  map.setView([lat, lon], 10);

  const observer = { latitude: satellite.degreesToRadians(lat), longitude: satellite.degreesToRadians(lon), height };

  lines.forEach(line => map.removeLayer(line));
  lines.length = 0;

  let html = '';
  satellites.forEach((sat, i) => {
    const posGd = { latitude: satellite.radiansToDegrees(satPositions[i].lat * Math.PI / 180), longitude: satPositions[i].lon, height: 35786 / 1000 };
    const topocentric = satellite.topocentric(observer, posGd);
    const lookAngles = satellite.topocentricToLookAngles(topocentric);
    const az = lookAngles.azimuth * 180 / Math.PI;
    const el = lookAngles.elevation * 180 / Math.PI;
    const status = el > 10 ? 'Good' : 'Bad';
    const color = el > 10 ? 'green' : 'red';

    html += `${sat.name}: Az ${az.toFixed(1)}° El ${el.toFixed(1)}° (${status})<br>`;

    if (el > 0) {
      const line = L.polyline([[lat, lon], [satPositions[i].lat, satPositions[i].lon]], {color}).addTo(map);
      lines.push(line);
    }
  });

  info.innerHTML = html;
}

// Initial
updateLocation(39.0, -104.0, 2.3);

map.on('click', e => updateLocation(e.latlng.lat, e.latlng.lng));

geoBtn.addEventListener('click', () => {
  navigator.geolocation.getCurrentPosition(pos => updateLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.altitude / 1000));
});

searchInput.addEventListener('keypress', e => {
  if (e.key === 'Enter') {
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchInput.value)}&format=json`)
      .then(res => res.json())
      .then(data => {
        if (data[0]) updateLocation(parseFloat(data[0].lat), parseFloat(data[0].lon));
      });
  }
});