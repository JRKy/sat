const map = L.map('map').setView([39.0, -104.0], 4); // Black Forest approx

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap'
}).addTo(map);

const info = document.getElementById('info');

// Add your satellite TLEs, position calc, markers, click handler here next

// Sample GEO satellite: INTELSAT 40E (use fresh TLE from celestrak.org if needed)
const tleLine1 = '1 56174U 23052A   26071.19350504 -.00000173  00000+0  00000+0 0  9998';
const tleLine2 = '2 56174   0.0085 156.3093 0000776 239.1222 113.0513  1.00272451 10856';

const satrec = satellite.twoline2satrec(tleLine1, tleLine2);

// Observer location (Black Forest, CO approx)
const observer = {
  longitude: satellite.degreesToRadians(-104.7),
  latitude: satellite.degreesToRadians(39.0),
  height: 2.3 // km
};

// Marker for satellite
const satMarker = L.marker([39, -104.7], {
  icon: L.divIcon({ className: 'sat-icon', html: '🛰️', iconSize: [30, 30] })
}).addTo(map);

// Update position function
function updateSatellitePosition() {
  const now = new Date();
  const positionAndVelocity = satellite.propagate(satrec, now);
  const positionEci = positionAndVelocity.position;
  
  if (positionEci) {
    const gmst = satellite.gstime(now);
    const positionGd = satellite.eciToGeodetic(positionEci, gmst);
    
    const lat = satellite.degreesLat(positionGd.latitude);
    const lon = satellite.degreesLong(positionEci.longitude); // wait, longitude
    
    satMarker.setLatLng([lat, lon]);
    
    // Look angles from observer
    const lookAngles = satellite.topocentricToLookAngles(
      satellite.topocentric(observer, positionGd)
    );
    const az = lookAngles.azimuth * 180 / Math.PI;
    const el = lookAngles.elevation * 180 / Math.PI;
    
    info.textContent = `Az: ${az.toFixed(1)}° El: ${el.toFixed(1)}°`;
  }
}

// Update every 5 seconds
setInterval(updateSatellitePosition, 5000);
updateSatellitePosition(); // initial