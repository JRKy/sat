// ======================================================
// table.js
// Satellite table rendering + sorting + selection
// ======================================================

import { highlightSatellite, clearSatelliteHighlight } from "./events.js";

// ======================================================
// INTERNAL STATE
// ======================================================

let tableContainer = null;
let satellites = [];
let sortColumn = "name";
let sortDirection = "asc"; // "asc" or "desc"

// ======================================================
// SORTING HELPERS
// ======================================================

function compare(a, b) {
  const col = sortColumn;

  let v1 = a[col];
  let v2 = b[col];

  // Numeric columns
  if (col === "centerLon" || col === "az" || col === "el") {
    v1 = Number(v1);
    v2 = Number(v2);
  }

  if (v1 < v2) return sortDirection === "asc" ? -1 : 1;
  if (v1 > v2) return sortDirection === "asc" ? 1 : -1;
  return 0;
}

function sortSatellites() {
  satellites.sort(compare);
}

// ======================================================
// TABLE HEADER TEMPLATE
// ======================================================

function headerCell(label, key) {
  const isSorted = sortColumn === key;
  const sortClass = isSorted ? `sort-${sortDirection}` : "";

  return `<th data-col="${key}" class="${sortClass}">${label}</th>`;
}

// ======================================================
// TABLE RENDERING
// ======================================================

function renderTable() {
  sortSatellites();

  const rows = satellites
    .map(
      (sat) => `
      <tr data-id="${sat.id}">
        <td>${sat.name}</td>
        <td>${sat.centerLon.toFixed(1)}°</td>
        <td>${sat.az.toFixed(1)}°</td>
        <td>${sat.el.toFixed(1)}°</td>
        <td>
          <span class="status-pill status-${sat.status}">
            ${sat.status.toUpperCase()}
          </span>
        </td>
      </tr>
    `
    )
    .join("");

  tableContainer.innerHTML = `
    <table>
      <thead>
        <tr>
          ${headerCell("Satellite", "name")}
          ${headerCell("Center", "centerLon")}
          ${headerCell("Az", "az")}
          ${headerCell("El", "el")}
          ${headerCell("Status", "status")}
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;

  attachHeaderEvents();
  attachRowEvents();
}

// ======================================================
// HEADER CLICK EVENTS (SORTING)
// ======================================================

function attachHeaderEvents() {
  const headers = tableContainer.querySelectorAll("th");

  headers.forEach((th) => {
    th.addEventListener("click", () => {
      const col = th.dataset.col;

      if (col === sortColumn) {
        // Toggle direction
        sortDirection = sortDirection === "asc" ? "desc" : "asc";
      } else {
        sortColumn = col;
        sortDirection = "asc";
      }

      renderTable();
    });
  });
}

// ======================================================
// ROW CLICK EVENTS (SELECTION + MAP HIGHLIGHT)
// ======================================================

function attachRowEvents() {
  const rows = tableContainer.querySelectorAll("tbody tr");

  rows.forEach((row) => {
    row.addEventListener("click", () => {
      const id = row.dataset.id;

      // Clear previous selection
      rows.forEach((r) => r.classList.remove("selected"));
      row.classList.add("selected");

      highlightSatellite(id);
    });
  });
}

// ======================================================
// PUBLIC API
// ======================================================

/**
 * Initializes the table system.
 */
export function initTable(containerId) {
  tableContainer = document.getElementById(containerId);
}

/**
 * Updates the table with a new satellite list.
 */
export function updateTable(satList) {
  satellites = satList;
  renderTable();
}

/**
 * Clears selection (used when clicking map background).
 */
export function clearTableSelection() {
  const rows = tableContainer.querySelectorAll("tbody tr");
  rows.forEach((r) => r.classList.remove("selected"));
  clearSatelliteHighlight();
}