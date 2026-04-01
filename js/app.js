// ======================================================
// app.js
// Application bootstrap — wires everything together.
// ======================================================

import { map, setUserLocation } from "./map.js";
import { initTable } from "./table.js";
import { initEvents } from "./events.js";
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

// 4. Satellite panel toggle button
document.getElementById("sat-toggle").addEventListener("click", () => {
  const panel    = document.getElementById("sat-panel");
  const backdrop = document.getElementById("sat-backdrop");
  panel.classList.toggle("open");
  backdrop.classList.toggle("open");
  document.body.classList.toggle("panel-open", panel.classList.contains("open"));
});

// 5. Geolocation button
document.getElementById("geo").addEventListener("click", () => {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude, longitude } = pos.coords;
      setUserLocation(latitude, longitude);
      map.setView([latitude, longitude], 6);
    },
    err => console.warn("Geolocation denied:", err.message)
  );
});

console.log("Satellite Antenna Tracker ready.");
