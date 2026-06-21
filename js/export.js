// ======================================================
// export.js
// CSV formatting and download helpers.
// ======================================================

function observerLine(obs) {
  const latDir = obs.lat >= 0 ? "N" : "S";
  const lonDir = obs.lon >= 0 ? "E" : "W";
  return `# Observer: ${Math.abs(obs.lat).toFixed(4)}°${latDir} ${Math.abs(obs.lon).toFixed(4)}°${lonDir}`;
}

function declinationLine(sats) {
  const decl = sats[0]?.decl;
  if (decl === undefined) return "";
  return `# Mag declination: ${decl >= 0 ? decl.toFixed(1) + "°E" : Math.abs(decl).toFixed(1) + "°W"}`;
}

export function buildSatelliteCsv(obs, sats) {
  const header = ["Satellite","Lon (°)","True Az (°)","Mag Az (°)","Elevation (°)","Zenith (°)","Status"].join(",");
  const rows = sats.map(s =>
    [s.name, s.centerLon.toFixed(1), s.az.toFixed(1),
     (s.magAz ?? s.az).toFixed(1), s.el.toFixed(1),
     (90 - s.el).toFixed(1), s.status.toUpperCase()].join(",")
  );

  return [observerLine(obs), declinationLine(sats), header, ...rows]
    .filter(Boolean)
    .join("\n");
}

export function downloadTextFile(filename, text, type = "text/plain") {
  const blob = new Blob([text], { type });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportSatelliteAngles(obs, sats) {
  if (!obs || !sats.length) return;
  downloadTextFile("satellite-angles.csv", buildSatelliteCsv(obs, sats), "text/csv");
}
