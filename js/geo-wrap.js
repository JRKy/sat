// ======================================================
// geo-wrap.js
// Shared helpers for placing GEO features on the nearest
// Leaflet world copy.
// ======================================================

/**
 * Return targetLon shifted by whole world widths so it is closest to
 * referenceLon. This keeps markers, lines, and footprints on the same
 * visual world copy.
 */
export function nearestWrappedLon(referenceLon, targetLon) {
  let delta = targetLon - referenceLon;
  while (delta >  180) delta -= 360;
  while (delta < -180) delta += 360;
  return referenceLon + delta;
}

/**
 * Return the longitude offset needed to move targetLon's canonical world
 * copy onto the nearest wrapped copy for referenceLon.
 */
export function worldCopyOffset(referenceLon, targetLon) {
  return nearestWrappedLon(referenceLon, targetLon) - targetLon;
}
