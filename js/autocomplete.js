// ======================================================
// autocomplete.js
// Location search via Nominatim with keyboard navigation.
// ======================================================

import { map } from "./map.js";

const input = document.getElementById("search");
const list  = document.getElementById("autocomplete");

let results        = [];
let activeIndex    = -1;
let onSelectCallback = null;

// ── Render ─────────────────────────────────────────────
function renderList() {
  if (!results.length) { list.classList.add("hidden"); return; }

  list.innerHTML = results.map((r, i) => `
    <div class="autocomplete-item ${i === activeIndex ? "active" : ""}" data-i="${i}">
      <div class="autocomplete-primary">${r.display_name}</div>
      <div class="autocomplete-secondary">${r.type}</div>
    </div>`).join("");

  list.classList.remove("hidden");

  list.querySelectorAll(".autocomplete-item").forEach(item => {
    item.addEventListener("click", () => choose(Number(item.dataset.i)));
  });
}

// ── Choose ─────────────────────────────────────────────
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

// ── Search ─────────────────────────────────────────────
async function search(query) {
  try {
    const res  = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
    const data = await res.json();
    results     = data.slice(0, 8);
    activeIndex = -1;
    renderList();
  } catch {
    list.classList.add("hidden");
  }
}

// ── Keyboard ───────────────────────────────────────────
function handleKey(e) {
  if (list.classList.contains("hidden")) return;
  if (e.key === "ArrowDown")  { activeIndex = (activeIndex + 1) % results.length; renderList(); }
  else if (e.key === "ArrowUp") { activeIndex = (activeIndex - 1 + results.length) % results.length; renderList(); }
  else if (e.key === "Enter")   { if (activeIndex >= 0) choose(activeIndex); }
  else if (e.key === "Escape")  { list.classList.add("hidden"); }
}

// ── Public API ─────────────────────────────────────────
export function initAutocomplete(callback) {
  onSelectCallback = callback;

  let debounce;
  input.addEventListener("input", () => {
    clearTimeout(debounce);
    const q = input.value.trim();
    if (q.length < 3) { list.classList.add("hidden"); return; }
    debounce = setTimeout(() => search(q), 250);
  });

  input.addEventListener("keydown", handleKey);

  // Close on outside click
  document.addEventListener("click", e => {
    if (!e.target.closest("#search-container")) list.classList.add("hidden");
  });
}
