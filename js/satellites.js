import {
  setSatellites
} from "./state.js";
import { addSatelliteMarkers } from "./markers.js";
// import { updateLocation } from "./events.js";  // REMOVED
import { lastObserver } from "./state.js";

function normalizeSatellite(s) {
  return {
    name: s.name,
    lon: Number(s.lon),
    lat: 0,
    alt_km: 35786
  };
}

export function loadSatellitesFromList(list) {
  const sats = list
    .map(normalizeSatellite)
    .sort((a, b) => a.lon - b.lon);

  setSatellites(sats);
  addSatelliteMarkers();

  // ❌ Removed automatic updateLocation() on load
  // updateLocation(lastObserver.lat, lastObserver.lon, lastObserver.heightKm, false);
}

export function fetchSatellites() {
  fetch("./data/satellites.json", {
    headers: {
      "Accept": "application/json"
    }
  })
    .then(res => res.json())
    .then(data => {
      if (!Array.isArray(data)) {
        console.error("satellites.json is not an array");
        return;
      }
      loadSatellitesFromList(data);
    })
    .catch(err => {
      console.error("Failed to load satellites.json:", err);
    });
}