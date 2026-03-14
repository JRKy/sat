import { map } from "./map.js";
import {
  satellites,
  satMarkers,
  selectedSatNames,
  LABEL_ZOOM_THRESHOLD
} from "./state.js";
import { normalizeLon180 } from "./geometry.js";

function userIcon() {
  return L.divIcon({
    className: "user-marker",
    html: '<span class="material-icons">location_on</span>',
    iconSize: [48, 48],
    iconAnchor: [24, 48]
  });
}

function satIcon(isSelected) {
  return L.divIcon({
    className: isSelected ? "sat-marker selected" : "sat-marker",
    html: '<span class="material-icons">satellite</span>',
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });
}

export const userMarker = L.marker([0, 0], { icon: userIcon() }).addTo(map);

export function addSatelliteMarkers() {
  for (const [, m] of satMarkers) map.removeLayer(m);
  satMarkers.clear();

  satellites.forEach((sat) => {
    const marker = L.marker([sat.lat, sat.lon], {
      icon: satIcon(selectedSatNames.has(sat.name))
    }).addTo(map);

    const labelHtml =
      `<span class="name">${sat.name}</span><span class="lon">${sat.lon.toFixed(1)}°</span>`;

    const labelPermanent =
      (map.getZoom() >= LABEL_ZOOM_THRESHOLD) || selectedSatNames.has(sat.name);

    marker.bindTooltip(labelHtml, {
      permanent: labelPermanent,
      direction: "top",
      className: "sat-label",
      offset: [0, -24]
    });

    if (labelPermanent) marker.openTooltip();

    satMarkers.set(sat.name, marker);
  });

  refreshMarkerSelection();
  updateLabelVisibility();
}

export function refreshMarkerSelection() {
  for (const sat of satellites) {
    const marker = satMarkers.get(sat.name);
    if (!marker) continue;
    const isSelected = selectedSatNames.has(sat.name);
    marker.setIcon(satIcon(isSelected));
    marker.setZIndexOffset(isSelected ? 1000 : 0);
  }
  updateLabelVisibility();
}

export function updateLabelVisibility() {
  for (const sat of satellites) {
    const marker = satMarkers.get(sat.name);
    if (!marker) continue;

    const shouldBePermanent =
      (map.getZoom() >= LABEL_ZOOM_THRESHOLD) || selectedSatNames.has(sat.name);

    const tt = marker.getTooltip();
    if (!tt) continue;
    if (tt.options.permanent === shouldBePermanent) continue;

    const content = tt.getContent();
    marker.unbindTooltip();
    marker.bindTooltip(content, {
      permanent: shouldBePermanent,
      direction: "top",
      className: "sat-label",
      offset: [0, -24]
    });

    if (shouldBePermanent) marker.openTooltip();
  }
}

map.on("zoomend", updateLabelVisibility);