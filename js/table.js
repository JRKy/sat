import {
  selectedSatNames
} from "./state.js";

const satTable = document.getElementById("sat-table");
const observerInfo = document.getElementById("observer-info");
const selectedInfo = document.getElementById("selected-info");

export function statusClass(status) {
  if (status === "Good") return "status-pill status-good";
  if (status === "Low") return "status-pill status-low";
  return "status-pill status-bad";
}

export function buildTable(rows, elevationCutoff) {
  if (!rows.length) {
    satTable.innerHTML = `
      <div style="padding:12px;color:#5f6368;font-size:13px;">
        No satellites meet the cutoff (El ≥ ${elevationCutoff}°).
      </div>
    `;
    return;
  }

  satTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Satellite</th>
          <th>Az</th>
          <th>El</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => {
          const selected = selectedSatNames.has(r.sat.name) ? "selected" : "";
          return `
            <tr class="${selected}" data-sat="${r.sat.name}">
              <td>${r.sat.name}</td>
              <td>${r.az.toFixed(1)}°</td>
              <td>${r.el.toFixed(1)}°</td>
              <td><span class="${statusClass(r.status)}">${r.status}</span></td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

export function renderObserverInfo(lat, lon, heightKm) {
  if (!observerInfo) return;
  observerInfo.innerHTML = `
    <div><b>Lat:</b> ${lat.toFixed(5)}°</div>
    <div><b>Lon:</b> ${lon.toFixed(5)}°</div>
    <div class="muted">${heightKm ? `Height: ${heightKm.toFixed(2)} km` : ""}</div>
  `;
}

export function renderSelectedInfo(selectedRows) {
  if (!selectedInfo) return;

  if (!selectedRows || selectedRows.length === 0) {
    selectedInfo.innerHTML = `<div class="muted">None (tap rows to select)</div>`;
    return;
  }

  if (selectedRows.length === 1) {
    const r = selectedRows[0];
    selectedInfo.innerHTML = `
      <div><b>${r.sat.name}</b></div>
      <div>Az: ${r.az.toFixed(1)}°</div>
      <div>El: ${r.el.toFixed(1)}°</div>
      <div class="muted">${r.status}</div>
    `;
    return;
  }

  const maxLines = 5;
  const head = selectedRows.slice(0, maxLines);
  selectedInfo.innerHTML = `
    <div><b>${selectedRows.length} satellites selected</b></div>
    ${head.map(r => `<div>${r.sat.name}: Az ${r.az.toFixed(0)}°, El ${r.el.toFixed(0)}°</div>`).join("")}
    ${selectedRows.length > maxLines ? `<div class="muted">…and ${selectedRows.length - maxLines} more</div>` : ""}
  `;
}