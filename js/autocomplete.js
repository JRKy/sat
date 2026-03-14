import { lastObserver } from "./state.js";
import { updateLocation } from "./events.js"; // re-exported there

const searchInput = document.getElementById("search");
const autocomplete = document.getElementById("autocomplete");

let acItems = [];
let acActiveIndex = -1;
let acTimer = null;
const acCache = {};

function hideAutocomplete() {
  if (!autocomplete) return;
  autocomplete.classList.add("hidden");
  autocomplete.innerHTML = "";
  acItems = [];
  acActiveIndex = -1;
  searchInput.removeAttribute("aria-activedescendant");
}

function renderAutocomplete(items) {
  if (!autocomplete) return;
  acItems = items;
  acActiveIndex = -1;

  if (!items.length) {
    hideAutocomplete();
    return;
  }

  autocomplete.innerHTML = items.map((p, idx) => {
    const primary = (p.display_name || "").split(",").slice(0, 2).join(",").trim();
    const secondary = (p.display_name || "").split(",").slice(2).join(",").trim();
    const id = `ac-item-${idx}`;
    return `
      <div class="autocomplete-item"
           id="${id}"
           role="option"
           aria-selected="false"
           data-idx="${idx}">
        <span class="material-icons">place</span>
        <div>
          <div class="autocomplete-primary">${primary || p.display_name}</div>
          ${secondary ? `<div class="autocomplete-secondary">${secondary}</div>` : ""}
        </div>
      </div>
    `;
  }).join("");

  autocomplete.classList.remove("hidden");

  autocomplete.querySelectorAll(".autocomplete-item").forEach((el) => {
    el.addEventListener("mousedown", (ev) => {
      ev.preventDefault();
      const idx = parseInt(el.getAttribute("data-idx"), 10);
      chooseAutocomplete(idx);
    });
  });
}

function setActive(idx) {
  if (!autocomplete) return;
  const nodes = autocomplete.querySelectorAll(".autocomplete-item");

  nodes.forEach(n => {
    n.classList.remove("active");
    n.setAttribute("aria-selected", "false");
  });

  if (idx >= 0 && idx < nodes.length) {
    const node = nodes[idx];
    node.classList.add("active");
    node.setAttribute("aria-selected", "true");
    node.scrollIntoView({ block: "nearest" });
    searchInput.setAttribute("aria-activedescendant", node.id);
  } else {
    searchInput.removeAttribute("aria-activedescendant");
  }

  acActiveIndex = idx;
}

function chooseAutocomplete(idx) {
  const p = acItems[idx];
  if (!p) return;

  searchInput.value = p.display_name || searchInput.value;
  hideAutocomplete();

  const lat = parseFloat(p.lat);
  const lon = parseFloat(p.lon);
  if (!isNaN(lat) && !isNaN(lon)) {
    updateLocation(lat, lon, lastObserver.heightKm, true);
  }
}

export function initAutocomplete() {
  searchInput.addEventListener("input", () => {
    clearTimeout(acTimer);
    const q = searchInput.value.trim();

    if (q.length < 3) {
      hideAutocomplete();
      return;
    }

    if (acCache[q]) {
      renderAutocomplete(acCache[q]);
      return;
    }

    acTimer = setTimeout(() => {
      fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=8&addressdetails=1`, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "Satellite-Antenna-Tracker/1.0"
        }
      })
        .then(res => res.json())
        .then(data => {
          const items = Array.isArray(data) ? data : [];
          acCache[q] = items;
          renderAutocomplete(items);
        })
        .catch(() => hideAutocomplete());
    }, 300);
  });

  searchInput.addEventListener("keydown", (e) => {
    if (!autocomplete || autocomplete.classList.contains("hidden")) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(acActiveIndex + 1, acItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(acActiveIndex - 1, 0));
    } else if (e.key === "Enter") {
      if (acActiveIndex >= 0) {
        e.preventDefault();
        chooseAutocomplete(acActiveIndex);
      }
    } else if (e.key === "Escape") {
      hideAutocomplete();
    }
  });

  document.addEventListener("click", (e) => {
    if (!autocomplete) return;
    if (!autocomplete.contains(e.target) && e.target !== searchInput) {
      hideAutocomplete();
    }
  });
}