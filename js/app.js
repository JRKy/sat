// ======================================================
// app.js
// Application bootstrap.
// ======================================================

import { map, setUserLocation } from "./map.js";
import { initTable } from "./table.js";
import { initEvents } from "./events.js";
import { initAutocomplete } from "./autocomplete.js";

// 1. Initialize table container
initTable("sat-table");

// 2. Load satellites and bootstrap
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

// 3. Search bar
initAutocomplete((lat, lon) => setUserLocation(lat, lon));

// 4. Geolocation button
document.getElementById("geo").addEventListener("click", geolocate);

// 5. Auto-geolocate on load
function geolocate() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    pos => {
      setUserLocation(pos.coords.latitude, pos.coords.longitude);
      map.setView([pos.coords.latitude, pos.coords.longitude], 4);
    },
    () => {}
  );
}

geolocate();
