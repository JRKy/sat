// ======================================================
// table.js
// Satellite list table: rendering, sorting, row selection.
// ======================================================

import { highlightSatellite } from "./events.js";
import { hasObserver, getElevUnit } from "./state.js";

// ── Internal state ─────────────────────────────────────
let tableContainer = null;
let satellites     = [];
let sortColumn     = "name";
let sortDirection  = "asc";

// ── Sorting ────────────────────────────────────────────
function compare(a, b) {
  let v1 = a[sortColumn];
  let v2 = b[sortColumn];
  if (["centerLon","az","magAz","el"].includes(sortColumn)) { v1 = Number(v1); v2 = Number(v2); }
  if (v1 < v2) return sortDirection === "asc" ? -1 : 1;
  if (v1 > v2) return sortDirection === "asc" ?  1 : -1;
  return 0;
}

// ── Rendering ──────────────────────────────────────────
function headerCell(label, key) {
  const isSorted  = sortColumn === key;
  const cls       = isSorted ? `sort-${sortDirection}` : "";
  return `<th data-col="${key}" class="${cls}">${label}</th>`;
}

function renderTable() {
  satellites.sort(compare);
  const show    = hasObserver();
  const unit    = getElevUnit();
  const elLabel = unit === "zenith" ? "Zenith" : "El";

  const rows = satellites.map(sat => {
    const elVal = show
      ? (unit === "zenith" ? (90 - sat.el).toFixed(1) : sat.el.toFixed(1)) + "°"
      : "—";
    return `
    <tr data-id="${sat.id}">
      <td>${sat.name}</td>
      <td>${sat.centerLon.toFixed(1)}°</td>
      <td>${show ? sat.az.toFixed(1)  + "°" : "—"}</td>
      <td>${show ? (sat.magAz ?? sat.az).toFixed(1) + "°" : "—"}</td>
      <td>${elVal}</td>
      <td>
        <span class="status-pill status-${sat.status}">
          ${show ? sat.status.toUpperCase() : "—"}
        </span>
      </td>
    </tr>`;
  }).join("");

  tableContainer.innerHTML = `
    <table>
      <thead>
        <tr>
          ${headerCell("Satellite",  "name")}
          ${headerCell("Lon",        "centerLon")}
          ${headerCell("True Az",    "az")}
          ${headerCell("Mag Az",     "magAz")}
          ${headerCell(elLabel,      "el")}
          ${headerCell("Status",     "status")}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;

  attachHeaderEvents();
  attachRowEvents();
}

function attachHeaderEvents() {
  tableContainer.querySelectorAll("th").forEach(th => {
    th.addEventListener("click", () => {
      const col = th.dataset.col;
      if (col === sortColumn) sortDirection = sortDirection === "asc" ? "desc" : "asc";
      else { sortColumn = col; sortDirection = "asc"; }
      renderTable();
    });
  });
}

function attachRowEvents() {
  tableContainer.querySelectorAll("tbody tr").forEach(row => {
    row.addEventListener("click", () => {
      tableContainer.querySelectorAll("tbody tr").forEach(r => r.classList.remove("selected"));
      row.classList.add("selected");
      highlightSatellite(row.dataset.id);
    });
  });
}

// ── Public API ─────────────────────────────────────────
export function initTable(containerId) {
  tableContainer = document.getElementById(containerId);
}

export function updateTable(satList) {
  satellites = satList;
  renderTable();
}

export function clearTableSelection() {
  if (!tableContainer) return;
  tableContainer.querySelectorAll("tbody tr").forEach(r => r.classList.remove("selected"));
}

export function selectTableRow(id) {
  if (!tableContainer) return;
  tableContainer.querySelectorAll("tbody tr").forEach(r => {
    r.classList.toggle("selected", r.dataset.id === id);
  });
}
