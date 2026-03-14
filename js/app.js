// ======================================================
// app.js
// Main bootstrap for the modular Satellite Tracker
// ======================================================

import { map, setUserLocation } from "./map.js";
import { initTable } from "./table.js";
import { initEvents, refreshSatellites } from "./events.js";
import { initAutocomplete } from "./autocomplete.js";

// ======================================================
// INITIALIZATION
// ======================================================

// 1. Initialize table container
initTable("sat-table");

// 2. Load satellites.json
fetch("satellites.json")
  .then((res) => res.json())
  .then((satList) => {
    // Normalize GEO satellites
    const normalized = satList.map((s, i) => ({
      id: String(i),
      name: s.name,
      centerLon: Number(s.lon),
      az: 0,
      el: 0,
      status: "bad" // placeholder until observer is set
    }));

    // Initialize event system with satellites
    initEvents(normalized);

    // Initial render
    refreshSatellites();
  })
  .catch((err) => console.error("Failed to load satellites.json:", err));

// 3. Initialize autocomplete search
initAutocomplete((lat, lon) => {
  setUserLocation(lat, lon);
});

// 4. Log startup
console.log("Satellite Antenna Tracker initialized.");