import { map, SAT_PANE } from "./map.js";
import {
  satellites,
  selectedSatNames
} from "./state.js";

let satMarkerLayers = new Map();

/**
 * Clear all satellite markers from the map.
 */
export function clearSatMarkers() {
  for (const [, layer] of satMarkerLayers) {
    map.removeLayer(layer);
  }
  satMarkerLayers.clear();
}

/**
 * Draw satellite markers, repeated across world tiles.
 */
export function updateSatMarkers() {
  clearSatMarkers();

  const offsets = [0, 360, -360];

  satellites.forEach((sat) => {
    const isSelected = selectedSatNames.has(sat.name);
    const color = isSelected ? "#1e8e3e" : "#1a73e8";

    const layers = [];

    offsets.forEach((offset) => {
      const shiftedLon = sat.lon + offset;

      const marker = L.circleMarker([sat.lat, shiftedLon], {
        pane: SAT_PANE,
        radius: isSelected ? 7 : 5,
        color,
        weight: isSelected ? 3 : 2,
        fillColor: color,
        fillOpacity: 0.9,
        noWrap: true,
        interactive: true
      })
        .on("click", () => {
          if (selectedSatNames.has(sat.name)) {
            selectedSatNames.delete(sat.name);
          } else {
            selectedSatNames.add(sat.name);
          }
          updateSatMarkers();
        })
        .addTo(map);

      layers.push(marker);
    });

    const group = L.layerGroup(layers).addTo(map);
    satMarkerLayers.set(sat.name, group);
  });
}

/**
 * Backwards-compatible entry point for satellites.js
 */
export function addSatelliteMarkers() {
  updateSatMarkers();
}