// ======================================================
// app.js
// Application bootstrap — wires everything together.
// ======================================================

import { map, setUserLocation } from "./map.js";
import { initTable } from "./table.js";
import { initEvents, openPanel, closePanel } from "./events.js";
import { initAutocomplete } from "./autocomplete.js";

// 1. Initialize table container
initTable("sat-table");

// 2. Load satellite list and bootstrap
fetch("satellites.json")
  .then(res => res.json())
  .then(satList => {
    const normalized = satList.map((s, i) => ({
      id:        String(i),
      name:      s.name,
      centerLon: Number(s.lon),
      lat:       0,
      alt_km:    35786,
      az:        0,
      el:        0,
      status:    "bad"
    }));

    initEvents(normalized);
  })
  .catch(err => console.error("Failed to load satellites.json:", err));

// 3. Search bar → set user location (triggers onLocationChange in events.js)
initAutocomplete((lat, lon) => {
  setUserLocation(lat, lon);
});

// 4. Satellite panel toggle button — respects pinned state
document.getElementById("sat-toggle").addEventListener("click", () => {
  const panel = document.getElementById("sat-panel");
  if (panel.classList.contains("open")) {
    closePanel();
  } else {
    openPanel();
  }
});

// 5. Geolocation button
document.getElementById("geo").addEventListener("click", () => {
  geolocate();
});

// 6. Auto-geolocate on load — silently ignored if denied or unavailable
function geolocate() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude, longitude } = pos.coords;
      setUserLocation(latitude, longitude);
      map.setView([latitude, longitude], 4);
    },
    () => {} // denied or unavailable — no-op, user can click the map instead
  );
}

geolocate();

console.log("Satellite Antenna Tracker ready.");
