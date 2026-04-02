// ======================================================
// declination.js
// World Magnetic Model (WMM-2025) — magnetic declination.
//
// Coefficients valid 2025.0 – 2030.0 (NOAA WMM2025).
// Returns declination in degrees: positive = East of true North,
// negative = West. Magnetic azimuth = true azimuth − declination.
//
// Reference: NOAA National Centers for Environmental Information
// https://www.ngdc.noaa.gov/geomag/WMM/
// ======================================================

// WMM-2025 Gauss coefficients (g, h) up to degree/order 12
// Format: [n, m, g_nm, h_nm, gdot_nm, hdot_nm]
// Only non-zero terms are listed.
const WMM_COEFFS = [
  [1,0,-29350.0,      0.0,   15.9,    0.0],
  [1,1, -1410.0,   4545.0,    6.3,  -25.1],
  [2,0, -2556.0,      0.0,  -20.5,    0.0],
  [2,1,  2952.0,  -3133.0,   -5.4,   -7.1],
  [2,2,  1649.0,   -815.0,    0.8,   17.0],
  [3,0,  1401.0,      0.0,    1.0,    0.0],
  [3,1, -2379.0,   -178.0,    4.2,    2.3],
  [3,2,  1249.0,    264.0,    1.0,   -1.8],
  [3,3,    883.0,   -291.0,   -2.8,   -3.6],
  [4,0,    813.0,      0.0,  -10.1,    0.0],
  [4,1,    247.0,    294.0,    3.0,   -0.8],
  [4,2,   -938.0,    -57.0,    1.0,    4.6],
  [4,3,    783.0,    -83.0,    1.5,    0.5],
  [4,4,    -19.0,    -12.0,    1.0,    0.0],
  [5,0,   -191.0,      0.0,   -1.0,    0.0],
  [5,1,    268.0,   -314.0,    0.0,    0.5],
  [5,2,    202.0,    -56.0,    2.2,    0.1],
  [5,3,    -51.0,    -24.0,   -0.4,   -0.6],
  [5,4,    -37.0,    -38.0,    0.1,    0.5],
  [5,5,    -11.0,    -31.0,    1.3,   -0.1],
  [6,0,     38.0,      0.0,    1.3,    0.0],
  [6,1,   -225.0,     -7.0,    2.0,   -0.1],
  [6,2,     76.0,     -7.0,    0.2,    0.1],
  [6,3,    -72.0,     -3.0,   -0.6,   -0.1],
  [6,4,    -14.0,     -9.0,    0.3,    0.1],
  [6,5,     14.0,     11.0,    0.1,    0.0],
  [6,6,     -8.0,      0.0,    0.3,    0.1],
  [7,0,     -4.0,      0.0,    0.0,    0.0],
  [7,1,     48.0,     10.0,    0.4,    0.1],
  [7,2,    -13.0,    -17.0,   -0.3,    0.4],
  [7,3,    -17.0,     11.0,    0.2,   -0.1],
  [7,4,    -10.0,     28.0,   -0.2,    0.4],
  [7,5,      1.0,    -13.0,    0.1,    0.0],
  [7,6,      4.0,     10.0,   -0.1,   -0.2],
  [7,7,     -1.0,    -19.0,    0.2,    0.0],
  [8,0,     14.0,      0.0,   -0.1,    0.0],
  [8,1,    -14.0,    -16.0,   -0.2,    0.0],
  [8,2,      0.0,      5.0,    0.1,    0.2],
  [8,3,    -10.0,      9.0,    0.1,    0.0],
  [8,4,      1.0,      1.0,    0.1,    0.0],
  [8,5,     10.0,     -1.0,    0.0,    0.0],
  [8,6,      1.0,      0.0,    0.1,    0.0],
  [8,7,      3.0,      7.0,    0.0,    0.0],
  [8,8,      2.0,     -4.0,    0.0,    0.0],
  [9,0,      5.0,      0.0,    0.0,    0.0],
  [9,1,     -4.0,     -4.0,    0.0,    0.0],
  [9,2,      2.0,     -1.0,    0.0,    0.0],
  [9,3,      1.0,     -4.0,    0.0,    0.0],
  [9,4,     -2.0,     -1.0,    0.0,    0.0],
  [9,5,      1.0,      4.0,    0.0,    0.0],
  [9,6,      0.0,      0.0,    0.0,    0.0],
  [9,7,      0.0,      1.0,    0.0,    0.0],
  [9,8,      1.0,     -3.0,    0.0,    0.0],
  [9,9,     -1.0,      2.0,    0.0,    0.0],
];

const EPOCH    = 2025.0;
const R_EARTH  = 6371.2; // WMM reference radius km
const R_ELLIP  = 6378.137;
const FLAT_INV = 298.257223563;

function toRad(d) { return d * Math.PI / 180; }
function toDeg(r) { return r * 180 / Math.PI; }

// Associated Legendre polynomial P(n,m,x) — Schmidt quasi-normal
function legendreSchmidt(nMax, x) {
  const P = [];
  for (let n = 0; n <= nMax; n++) P.push(new Float64Array(n + 1));

  P[0][0] = 1.0;
  const sp = Math.sqrt(1 - x * x); // sin(theta_colatitude)

  for (let n = 1; n <= nMax; n++) {
    // diagonal
    P[n][n] = P[n-1][n-1] * sp * Math.sqrt((2*n - 1) / (2*n));
    // off-diagonal
    if (n > 1) P[n][n-1] = P[n-1][n-1] * x * Math.sqrt(2*n - 1);
    // recurse upward
    for (let m = 0; m <= n - 2; m++) {
      const k = ((n-1)*(n-1) - m*m) / ((2*n-1)*(2*n-3));
      P[n][m] = x * P[n-1][m] - Math.sqrt(k) * P[n-2][m];
    }
  }
  return P;
}

/**
 * Compute magnetic declination at a surface location.
 *
 * @param {number} lat   Geodetic latitude  (degrees)
 * @param {number} lon   Longitude          (degrees)
 * @param {number} year  Decimal year, e.g. 2025.5 (default: current)
 * @returns {number}     Declination in degrees (+ East, − West)
 */
export function getMagDeclination(lat, lon, year) {
  if (year === undefined) {
    const now = new Date();
    year = now.getFullYear() + (now.getMonth() / 12) + (now.getDate() / 365);
  }

  const dt = year - EPOCH;     // years since epoch

  // Convert geodetic to geocentric spherical
  const f    = 1 / FLAT_INV;
  const latR = toRad(lat);
  const lonR = toRad(lon);
  const cosLat = Math.cos(latR), sinLat = Math.sin(latR);
  const rc   = R_ELLIP / Math.sqrt(1 - (2*f - f*f) * sinLat * sinLat);
  const xp   = (rc + 0) * cosLat;   // altitude = 0 (surface)
  const zp   = (rc * (1 - (2*f - f*f))) * sinLat;
  const r    = Math.sqrt(xp*xp + zp*zp);
  const thetaGC = Math.acos(zp / r);  // geocentric colatitude

  const cosTheta = Math.cos(thetaGC);
  const sinTheta = Math.sin(thetaGC);

  const nMax = 12;
  const P    = legendreSchmidt(nMax, cosTheta);

  let Br = 0, Bt = 0, Bp = 0;

  for (const [n, m, g0, h0, gdot, hdot] of WMM_COEFFS) {
    const g = g0 + gdot * dt;
    const h = h0 + hdot * dt;
    const ratio = Math.pow(R_EARTH / r, n + 2);
    const cosM  = Math.cos(m * lonR);
    const sinM  = Math.sin(m * lonR);

    Br -= (n + 1) * ratio * (g * cosM + h * sinM) * P[n][m];
    Bt -= ratio * (g * cosM + h * sinM) *
          (m < n
            ? (Math.sqrt(((n-m)*(n+m+1))) * (m > 0 ? P[n][m+1] : 0) - ((sinTheta < 1e-10) ? 0 : m / sinTheta * P[n][m]))
            : (-(sinTheta < 1e-10 ? 0 : m / sinTheta * P[n][m]))
          );
    Bp += ratio * m * (-g * sinM + h * cosM) * P[n][m];
  }

  if (sinTheta > 1e-10) Bp /= sinTheta;

  // Convert geocentric to geodetic components
  const psi   = latR - (Math.PI / 2 - thetaGC);
  const sinPsi = Math.sin(psi), cosPsi = Math.cos(psi);
  const Bn    = -Bt * cosPsi - Br * sinPsi;
  const Be    =  Bp;

  const decl  = toDeg(Math.atan2(Be, Bn));
  return Math.round(decl * 10) / 10;
}
