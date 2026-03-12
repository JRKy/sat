const map = L.map('map').setView([39.0, -104.0], 4); // Black Forest approx

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap'
}).addTo(map);

const info = document.getElementById('info');

// Add your satellite TLEs, position calc, markers, click handler here next