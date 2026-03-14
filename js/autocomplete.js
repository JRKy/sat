// ======================================================
// autocomplete.js
// Simple location search using Nominatim
// ======================================================

import { map } from "./map.js";

// DOM elements
const input = document.getElementById("search");
const list = document.getElementById("autocomplete");

let results = [];
let activeIndex = -1;
let onSelectCallback = null;

// ======================================================
// RENDER RESULTS
// ======================================================

function renderList() {
  if (results.length === 0) {
    list.classList.add("hidden");
    return;
  }

  list.innerHTML = results
    .map(
      (r, i) => `
      <div class="autocomplete-item ${i === activeIndex ? "active" : ""}" data-i="${i}">
        <div>
          <div class="autocomplete-primary">${r.display_name}</div>
          <div class="autocomplete-secondary">${r.type}</div>
        </div>
      </div>
    `
    )
    .join("");

  list.classList.remove("hidden");

  // Click events
  list.querySelectorAll(".autocomplete-item").forEach((item) => {
    item.addEventListener("click", () => {
      const i = Number(item.dataset.i);
      choose(i);
    });
  });
}

// ======================================================
// CHOOSE RESULT
// ======================================================

function choose(i) {
  const r = results[i];
  if (!r) return;

  input.value = r.display_name;
  list.classList.add("hidden");

  const lat = Number(r.lat);
  const lon = Number(r.lon);

  if (onSelectCallback) onSelectCallback(lat, lon);

  map.setView([lat, lon], 8);
}

// ======================================================
// SEARCH API
// ======================================================

async function search(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    query
  )}`;

  const res = await fetch(url);
  const data = await res.json();

  results = data.slice(0, 8);
  activeIndex = -1;
  renderList();
}

// ======================================================
// KEYBOARD HANDLING
// ======================================================

function handleKey(e) {
  if (list.classList.contains("hidden")) return;

  if (e.key === "ArrowDown") {
    activeIndex = (activeIndex + 1) % results.length;
    renderList();
  } else if (e.key === "ArrowUp") {
    activeIndex = (activeIndex - 1 + results.length) % results.length;
    renderList();
  } else if (e.key === "Enter") {
    if (activeIndex >= 0) choose(activeIndex);
  }
}

// ======================================================
// PUBLIC API
// ======================================================

export function initAutocomplete(callback) {
  onSelectCallback = callback;

  input.addEventListener("input", () => {
    const q = input.value.trim();
    if (q.length < 3) {
      list.classList.add("hidden");
      return;
    }
    search(q);
  });

  input.addEventListener("keydown", handleKey);
}