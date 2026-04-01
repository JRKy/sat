// ======================================================
// geometry.js
// Pure math — no DOM, no Leaflet, no side effects.
// ======================================================

import { EARTH_RADIUS_KM, DEFAULT_SAT_ALT_KM, GREAT_CIRCLE_STEPS } from "./state.js";

export const EPS = 1e-9;

// ── Angle helpers ──────────────────────────────────────
export function toRad(deg) { return deg * Math.PI / 180; }
export function toDeg(rad) { return rad * 180 / Math.PI; }

export function normalizeLon180(lon) {
  let x = ((lon + 180) % 360 + 360) % 360 - 180;
  if (x === -180) x = 180;
  return x;
}

export function unwrapLon(prevU, lonNorm) {
  let best = lonNorm;
  let bestDiff = Math.abs(best - prevU);
  const c1 = lonNorm + 360, d1 = Math.abs(c1 - prevU);
  if (d1 < bestDiff) { best = c1; bestDiff = d1; }
  const c2 = lonNorm - 360, d2 = Math.abs(c2 - prevU);
  if (d2 < bestDiff) { best = c2; }
  return best;
}

export function buildUnwrappedSeries(pts) {
  const out = [];
  if (!pts.length) return out;
  out.push(normalizeLon180(pts[0][1]));
  for (let i = 1; i < pts.length; i++) {
    out.push(unwrapLon(out[i - 1], normalizeLon180(pts[i][1])));
  }
  return out;
}

// ── Footprint geometry ─────────────────────────────────
export function horizonAngularRadiusRad(altKm) {
  const Re = EARTH_RADIUS_KM;
  const r  = Re + altKm;
  return Math.acos(Re / r);
}

export function footprintBoundaryPoints(sat, steps = 720) {
  const lon0  = toRad(sat.lon);
  const lat0  = toRad(sat.lat ?? 0);
  const altKm = sat.alt_km ?? DEFAULT_SAT_ALT_KM;

  const p    = horizonAngularRadiusRad(altKm);
  const sinp = Math.sin(p);
  const cosp = Math.cos(p);

  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    let lat, lon;
    if (Math.abs(lat0) < 1e-12) {
      lat = Math.asin(sinp * Math.cos(a));
      lon = lon0 + Math.atan2(Math.sin(a) * sinp, cosp);
    } else {
      const sinLat0 = Math.sin(lat0), cosLat0 = Math.cos(lat0);
      lat = Math.asin(sinLat0 * cosp + cosLat0 * sinp * Math.cos(a));
      lon = lon0 + Math.atan2(Math.sin(a) * sinp * cosLat0, cosp - sinLat0 * Math.sin(lat));
    }
    pts.push([toDeg(lat), toDeg(lon)]);
  }

  // Force closure
  const f = pts[0], l = pts[pts.length - 1];
  if (f[0] !== l[0] || normalizeLon180(f[1]) !== normalizeLon180(l[1])) pts.push([f[0], f[1]]);

  // Smooth northmost spike
  let maxLat = -999, maxIdx = 0;
  for (let i = 0; i < pts.length; i++) { if (pts[i][0] > maxLat) { maxLat = pts[i][0]; maxIdx = i; } }
  const prev = pts[(maxIdx - 1 + pts.length) % pts.length];
  const next = pts[(maxIdx + 1) % pts.length];
  pts[maxIdx] = [(prev[0] + next[0]) / 2, (prev[1] + next[1]) / 2];

  return pts;
}

// ── Az / El computation ────────────────────────────────
/**
 * Compute azimuth and elevation from an observer on the ground
 * to a GEO satellite.
 *
 * @param {number} obsLat   Observer geodetic latitude  (degrees)
 * @param {number} obsLon   Observer longitude          (degrees)
 * @param {number} satLon   Satellite longitude         (degrees, GEO → lat = 0)
 * @param {number} altKm    Satellite altitude km       (default GEO)
 * @returns {{ az: number, el: number }}  degrees
 */
export function computeAzEl(obsLat, obsLon, satLon, altKm = DEFAULT_SAT_ALT_KM) {
  const φ  = toRad(obsLat);
  const Δλ = toRad(satLon - obsLon);

  const Re = EARTH_RADIUS_KM;
  const Rs = Re + altKm;

  // Sub-satellite point is (lat=0, lon=satLon)
  // Vector from Earth center to sat (ECEF, simplified)
  // Range vector from observer to sat, projected to local horizon
  // Standard GEO pointing formula:

  const cosφ  = Math.cos(φ);
  const sinφ  = Math.sin(φ);
  const cosΔλ = Math.cos(Δλ);
  const sinΔλ = Math.sin(Δλ);

  // Range vector components in topocentric coords
  const Rx = Rs * cosΔλ - Re * cosφ;   // East component (rotated)
  const Ry = Rs * sinΔλ;               // North-rotated
  const Rz = -Re * sinφ;               // Up component seed

  // ENU components
  const east  =  Rs * sinΔλ;
  const north =  Rs * sinφ * cosΔλ - Re * (1 / cosφ) * (sinφ * sinφ);

  // More robust GEO formula (standard reference):
  // Let a = cos(obsLat)*cos(Δlon)
  const a = cosφ * cosΔλ;

  // Elevation
  const num   = a - Re / Rs;
  const denom = Math.sqrt(1 - 2 * a * Re / Rs + (Re / Rs) ** 2);
  const elRad = Math.atan(num / denom) - Math.asin(Re / Rs * Math.sin(Math.acos(a)));

  // Simpler robust elevation:
  // slant range²
  const slant2 = Re * Re + Rs * Rs - 2 * Re * Rs * a;
  const slant  = Math.sqrt(slant2);

  // Elevation via dot product of range vector with up vector
  // Up at observer: (cosφ cosλobs, cosφ sinλobs, sinφ) → simplified
  const elRad2 = Math.asin((Rs * a - Re) / slant);

  // Azimuth (N-clockwise) toward sub-satellite point
  // projected great-circle bearing from (obsLat,obsLon) to (0, satLon)
  const azRad = Math.atan2(sinΔλ, -Math.tan(φ) * cosΔλ);  // toward equatorial target
  // adjust: for GEO at equator the bearing from northern hemisphere points south
  // atan2 gives bearing from north; we want 0=N, 90=E
  const azDeg = (toDeg(azRad) + 360) % 360;

  return {
    az: Math.round(azDeg * 10) / 10,
    el: Math.round(toDeg(elRad2) * 10) / 10
  };
}

/**
 * Maps elevation to status string.
 */
export function elToStatus(el) {
  if (el >= 10) return "good";
  if (el >= 0)  return "low";
  return "bad";
}

// ── Polyline split helpers (unchanged) ─────────────────
export function splitPolylineAtDateline(pts) {
  if (!Array.isArray(pts) || pts.length < 2) return [];
  const cleaned = [];
  for (const p of pts) {
    if (!p) continue;
    const lat = +p[0], lon = +p[1], lonN = normalizeLon180(lon);
    const prev = cleaned[cleaned.length - 1];
    if (!prev || prev[0] !== lat || normalizeLon180(prev[1]) !== lonN) cleaned.push([lat, lon]);
  }
  if (cleaned.length < 2) return [];
  const U = buildUnwrappedSeries(cleaned);
  const segments = [];
  let seg = [[cleaned[0][0], normalizeLon180(cleaned[0][1])]];
  let zCurr = Math.floor((U[0] + 180) / 360);
  const lonInZone = (lonU, z) => normalizeLon180(lonU - 360 * z);
  for (let i = 1; i < cleaned.length; i++) {
    let lat1 = cleaned[i-1][0], lon1u = U[i-1], lat2 = cleaned[i][0], lon2u = U[i];
    let z1 = Math.floor((lon1u+180)/360), z2 = Math.floor((lon2u+180)/360);
    while (z1 !== z2) {
      const boundary = 180 + 360 * Math.min(z1, z2);
      const denom = lon2u - lon1u;
      if (Math.abs(denom) < EPS) break;
      const t = (boundary - lon1u) / denom;
      const latX = lat1 + t * (lat2 - lat1);
      seg.push([latX, lonInZone(boundary, zCurr)]);
      segments.push(seg);
      zCurr += (z2 > z1) ? 1 : -1;
      seg = [[latX, (lonInZone(boundary, zCurr) === 180) ? -180 : 180]];
      lon1u = boundary + ((z2 > z1) ? EPS : -EPS);
      lat1 = latX;
      z1 = Math.floor((lon1u+180)/360);
    }
    seg.push([lat2, lonInZone(lon2u, zCurr)]);
  }
  if (seg.length >= 2) segments.push(seg);
  return segments.filter(s => s.length >= 2);
}
