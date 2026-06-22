// ======================================================
// app.js
// Application bootstrap.
// ======================================================

import { map, setUserLocation } from "./map.js";
import { initTable } from "./table.js";
import { initEvents, highlightSatellite, replaceSatellites } from "./events.js?v=6";
import { initAutocomplete } from "./autocomplete.js";
import { initSatelliteCatalog } from "./catalog.js?v=5";

// 1. Initialize table container
initTable("sat-table", { onSelect: highlightSatellite });

// 2. Load satellites and bootstrap
fetch("satellites.json")
  .then(res => res.json())
  .then(satList => {
    const enabled = initSatelliteCatalog("catalog-manager", satList, replaceSatellites);
    initEvents(enabled);
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
