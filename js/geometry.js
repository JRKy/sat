import {
  EARTH_RADIUS_KM,
  DEFAULT_SAT_LAT,
  DEFAULT_SAT_ALT_KM,
  GREAT_CIRCLE_STEPS
} from "./state.js";

export const EPS = 1e-9;

export function normalizeLon180(lon) {
  let x = ((lon + 180) % 360 + 360) % 360 - 180;
  if (x === -180) x = 180;
  return x;
}

export function unwrapLon(prevU, lonNorm) {
  let best = lonNorm;
  let bestDiff = Math.abs(best - prevU);

  const c1 = lonNorm + 360;
  const d1 = Math.abs(c1 - prevU);
  if (d1 < bestDiff) { best = c1; bestDiff = d1; }

  const c2 = lonNorm - 360;
  const d2 = Math.abs(c2 - prevU);
  if (d2 < bestDiff) { best = c2; bestDiff = d2; }

  return best;
}

export function buildUnwrappedSeries(pts) {
  const out = [];
  if (!pts.length) return out;
  const lon0n = normalizeLon180(pts[0][1]);
  out.push(lon0n);
  for (let i = 1; i < pts.length; i++) {
    const lonn = normalizeLon180(pts[i][1]);
    out.push(unwrapLon(out[i - 1], lonn));
  }
  return out;
}

export function splitPolylineAtDateline(pts) {
  if (!Array.isArray(pts) || pts.length < 2) return [];

  const cleaned = [];
  for (const p of pts) {
    if (!p) continue;
    const lat = +p[0];
    const lon = +p[1];
    const lonN = normalizeLon180(lon);
    const prev = cleaned[cleaned.length - 1];
    if (!prev || prev[0] !== lat || normalizeLon180(prev[1]) !== lonN)
      cleaned.push([lat, lon]);
  }
  if (cleaned.length < 2) return [];

  const U = buildUnwrappedSeries(cleaned);
  const segments = [];
  let seg = [[cleaned[0][0], normalizeLon180(cleaned[0][1])]];
  let zCurr = Math.floor((U[0] + 180) / 360);

  function lonInZone(lonU, z) {
    return normalizeLon180(lonU - 360 * z);
  }

  for (let i = 1; i < cleaned.length; i++) {
    let lat1 = cleaned[i - 1][0];
    let lon1u = U[i - 1];
    let lat2 = cleaned[i][0];
    let lon2u = U[i];

    let z1 = Math.floor((lon1u + 180) / 360);
    let z2 = Math.floor((lon2u + 180) / 360);

    while (z1 !== z2) {
      const boundary = 180 + 360 * Math.min(z1, z2);
      const denom = lon2u - lon1u;
      if (Math.abs(denom) < EPS) break;

      const t = (boundary - lon1u) / denom;
      const latX = lat1 + t * (lat2 - lat1);

      seg.push([latX, lonInZone(boundary, zCurr)]);
      segments.push(seg);

      zCurr += (z2 > z1) ? 1 : -1;

      const startLon = (lonInZone(boundary, zCurr) === 180) ? -180 : 180;
      seg = [[latX, startLon]];

      lon1u = boundary + ((z2 > z1) ? EPS : -EPS);
      lat1 = latX;
      z1 = Math.floor((lon1u + 180) / 360);
    }

    seg.push([lat2, lonInZone(lon2u, zCurr)]);
  }

  if (seg.length >= 2) segments.push(seg);
  return segments.filter(s => s.length >= 2);
}

export function splitRingIntoDatelinePolygons(ringPts) {
  if (!Array.isArray(ringPts) || ringPts.length < 4) return [];

  const pts = ringPts.slice();
  const f = pts[0];
  const l = pts[pts.length - 1];
  if (f[0] !== l[0] || normalizeLon180(f[1]) !== normalizeLon180(l[1])) {
    pts.push([f[0], f[1]]);
  }

  const cleaned = [];
  for (const p of pts) {
    if (!p) continue;
    const lat = +p[0];
    const lon = +p[1];
    const lonN = normalizeLon180(lon);
    const prev = cleaned[cleaned.length - 1];
    if (!prev || prev[0] !== lat || normalizeLon180(prev[1]) !== lonN)
      cleaned.push([lat, lon]);
  }
  if (cleaned.length < 4) return [];

  const U = buildUnwrappedSeries(cleaned);
  const segments = [];
  let seg = [[cleaned[0][0], normalizeLon180(cleaned[0][1])]];
  let zCurr = Math.floor((U[0] + 180) / 360);

  function lonInZone(lonU, z) {
    return normalizeLon180(lonU - 360 * z);
  }

  for (let i = 1; i < cleaned.length; i++) {
    let lat1 = cleaned[i - 1][0];
    let lon1u = U[i - 1];
    let lat2 = cleaned[i][0];
    let lon2u = U[i];

    let z1 = Math.floor((lon1u + 180) / 360);
    let z2 = Math.floor((lon2u + 180) / 360);

    while (z1 !== z2) {
      const boundary = 180 + 360 * Math.min(z1, z2);
      const denom = lon2u - lon1u;
      if (Math.abs(denom) < EPS) break;

      const t = (boundary - lon1u) / denom;
      const latX = lat1 + t * (lat2 - lat1);

      seg.push([latX, lonInZone(boundary, zCurr)]);
      segments.push({ zone: zCurr, pts: seg });

      zCurr += (z2 > z1) ? 1 : -1;

      const startLon = (lonInZone(boundary, zCurr) === 180) ? -180 : 180;
      seg = [[latX, startLon]];

      lon1u = boundary + ((z2 > z1) ? EPS : -EPS);
      lat1 = latX;
      z1 = Math.floor((lon1u + 180) / 360);
    }

    seg.push([lat2, lonInZone(lon2u, zCurr)]);
  }

  if (seg.length >= 2) segments.push({ zone: zCurr, pts: seg });

  const rings = [];

  for (const s of segments) {
    const p = s.pts;
    if (p.length < 3) continue;

    let sum = 0;
    for (const q of p) sum += q[1];
    const seamLon = (sum / p.length) >= 0 ? 180 : -180;

    const first = p[0];
    const last = p[p.length - 1];
    const ring = p.slice();

    ring[0] = [first[0], seamLon];
    ring[ring.length - 1] = [last[0], seamLon];

    // Minimal safety: ensure closure
    ring[ring.length - 1] = [ring[0][0], ring[0][1]];

    if (ring.length >= 4) rings.push(ring);
  }

  if (rings.length === 1) {
    let hasJump = false;
    for (let i = 1; i < cleaned.length; i++) {
      const a = normalizeLon180(cleaned[i - 1][1]);
      const b = normalizeLon180(cleaned[i][1]);
      if (Math.abs(b - a) > 180) { hasJump = true; break; }
    }
    if (!hasJump) {
      const normRing = cleaned.map(([lat, lon]) => [lat, normalizeLon180(lon)]);
      const ff = normRing[0];
      const ll = normRing[normRing.length - 1];
      if (ff[0] !== ll[0] || ff[1] !== ll[1]) normRing.push([ff[0], ff[1]]);
      return [normRing];
    }
  }

  return rings;
}

export function toRad(deg) { return deg * Math.PI / 180; }
export function toDeg(rad) { return rad * 180 / Math.PI; }

export function horizonAngularRadiusRad(altKm) {
  const Re = EARTH_RADIUS_KM;
  const r = Re + altKm;
  return Math.acos(Re / r);
}

export function greatCirclePoints(lat1, lon1, lat2, lon2, steps = GREAT_CIRCLE_STEPS) {
  const φ1 = toRad(lat1), λ1 = toRad(lon1);
  const φ2 = toRad(lat2), λ2 = toRad(lon2);

  const v1 = [Math.cos(φ1) * Math.cos(λ1), Math.cos(φ1) * Math.sin(λ1), Math.sin(φ1)];
  const v2 = [Math.cos(φ2) * Math.cos(λ2), Math.cos(φ2) * Math.sin(λ2), Math.sin(φ2)];

  const rawDot = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
  if (!isFinite(rawDot)) return [[lat1, lon1], [lat2, lon2]];

  const dot = Math.min(1, Math.max(-1, rawDot));
  const ω = Math.acos(dot);
  if (!isFinite(ω) || ω === 0) return [[lat1, lon1], [lat2, lon2]];

  const sinω = Math.sin(ω);
  const pts = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = Math.sin((1 - t) * ω) / sinω;
    const b = Math.sin(t * ω) / sinω;

    const x = a * v1[0] + b * v2[0];
    const y = a * v1[1] + b * v2[1];
    const z = a * v1[2] + b * v2[2];

    const lat = toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)));
    const lonRaw = toDeg(Math.atan2(y, x));
    pts.push([lat, normalizeLon180(lonRaw)]);
  }

  return pts;
}

export function footprintBoundaryPoints(sat, steps = 720) {
  const lon0 = toRad(sat.lon);
  const lat0 = toRad(sat.lat ?? DEFAULT_SAT_LAT);
  const altKm = sat.alt_km ?? DEFAULT_SAT_ALT_KM;

  const p = horizonAngularRadiusRad(altKm);
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
      const sinLat0 = Math.sin(lat0);
      const cosLat0 = Math.cos(lat0);
      lat = Math.asin(sinLat0 * cosp + cosLat0 * sinp * Math.cos(a));
      lon = lon0 + Math.atan2(
        Math.sin(a) * sinp * cosLat0,
        cosp - sinLat0 * Math.sin(lat)
      );
    }

    const latDeg = toDeg(lat);
    const lonDegRaw = toDeg(lon);
    pts.push([latDeg, lonDegRaw]);
  }

  const first = pts[0];
  const last = pts[pts.length - 1];
  if (first[0] !== last[0] || normalizeLon180(first[1]) !== normalizeLon180(last[1])) {
    pts.push([first[0], first[1]]);
  }

  return pts;
}