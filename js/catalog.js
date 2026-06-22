// ======================================================
// catalog.js
// Persistent satellite catalog controls.
// ======================================================

const CATALOG_KEY = "sat_catalog_v1";
const GEO_ALT_KM = 35786;

let defaultRecords = [];
let catalog = { disabledDefaults: [], custom: [], footprintIds: [] };
let onChange = null;
let onFootprintChange = null;
let root = null;

function defaultId(s, i) {
  return `default:${i}:${s.name}:${Number(s.lon).toFixed(3)}`;
}

function cleanName(value) {
  return value.trim().replace(/[<>&"]/g, "").slice(0, 48);
}

function clampLon(value) {
  return Math.max(-180, Math.min(180, Number(value)));
}

function loadCatalog() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CATALOG_KEY) || "{}");
    return {
      disabledDefaults: Array.isArray(parsed.disabledDefaults) ? parsed.disabledDefaults : [],
      custom: Array.isArray(parsed.custom) ? parsed.custom : [],
      footprintIds: Array.isArray(parsed.footprintIds) ? parsed.footprintIds : [],
    };
  } catch {
    return { disabledDefaults: [], custom: [], footprintIds: [] };
  }
}

function saveCatalog() {
  try { localStorage.setItem(CATALOG_KEY, JSON.stringify(catalog)); } catch {}
}

function normalize(record) {
  return {
    id:        record.id,
    name:      record.name,
    centerLon: record.lon,
    lat:       0,
    alt_km:    GEO_ALT_KM,
    az:        0,
    magAz:     0,
    el:        0,
    decl:      0,
    status:    "bad"
  };
}

function allRecords() {
  const disabled = new Set(catalog.disabledDefaults);
  const defaults = defaultRecords.map(r => ({ ...r, custom: false, enabled: !disabled.has(r.id) }));
  const custom = catalog.custom.map(r => ({
    id: r.id,
    name: cleanName(r.name || ""),
    lon: clampLon(r.lon),
    custom: true,
    enabled: r.enabled !== false,
  })).filter(r => r.name && Number.isFinite(r.lon));
  return [...defaults, ...custom];
}

export function getEnabledSatellites() {
  return allRecords()
    .filter(r => r.enabled)
    .map(normalize);
}

function getSelectedFootprintIds() {
  const enabledIds = new Set(allRecords().filter(r => r.enabled).map(r => r.id));
  return catalog.footprintIds.filter(id => enabledIds.has(id));
}

function setFootprintEnabled(id, enabled) {
  const ids = new Set(catalog.footprintIds);
  if (enabled) ids.add(id);
  else ids.delete(id);
  catalog.footprintIds = [...ids];
}

function emitChange() {
  saveCatalog();
  renderCatalog();
  if (onChange) onChange(getEnabledSatellites());
  if (onFootprintChange) onFootprintChange(getSelectedFootprintIds());
}

function renderCatalog() {
  if (!root) return;
  const records = allRecords();
  const enabledCount = records.filter(r => r.enabled).length;
  const footprintIds = new Set(catalog.footprintIds);
  root.innerHTML = `
    <div class="catalog-header">
      <div class="catalog-title">
        <span class="material-symbols-rounded">tune</span>
        <span>Catalog</span>
        <span class="catalog-count">${enabledCount}/${records.length}</span>
      </div>
      <button id="catalog-reset" class="icon-btn compact" title="Reset catalog">
        <span class="material-symbols-rounded">restart_alt</span>
      </button>
    </div>
    <form id="catalog-add" class="catalog-add">
      <input id="catalog-name" type="text" maxlength="48" placeholder="Name" autocomplete="off" />
      <input id="catalog-lon" type="number" min="-180" max="180" step="0.1" placeholder="Lon" />
      <button class="icon-btn compact" title="Add satellite" type="submit">
        <span class="material-symbols-rounded">add</span>
      </button>
    </form>
    <div class="catalog-list">
      ${records.map(r => `
        <div class="catalog-item" data-id="${r.id}">
          <label class="catalog-toggle">
            <input type="checkbox" ${r.enabled ? "checked" : ""} />
            <span class="catalog-name">${r.name}</span>
          </label>
          <span class="catalog-lon">${r.lon.toFixed(1)}°</span>
          <button class="icon-btn compact catalog-footprint ${footprintIds.has(r.id) ? "active" : ""}" title="${footprintIds.has(r.id) ? "Hide footprint" : "Show footprint"}" type="button" ${r.enabled ? "" : "disabled"}>
            <span class="material-symbols-rounded">radio_button_checked</span>
          </button>
          ${r.custom ? `
            <button class="icon-btn compact catalog-delete" title="Delete satellite" type="button">
              <span class="material-symbols-rounded">delete</span>
            </button>` : `<span class="catalog-fixed"></span>`}
        </div>`).join("")}
    </div>`;

  root.querySelector("#catalog-reset").addEventListener("click", () => {
    catalog = { disabledDefaults: [], custom: [], footprintIds: [] };
    emitChange();
  });

  root.querySelector("#catalog-add").addEventListener("submit", (e) => {
    e.preventDefault();
    const nameInput = root.querySelector("#catalog-name");
    const lonInput = root.querySelector("#catalog-lon");
    const name = cleanName(nameInput.value);
    const lon = clampLon(lonInput.value);
    if (!name || !Number.isFinite(lon)) return;

    catalog.custom.push({
      id: `custom:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      name,
      lon,
      enabled: true,
    });
    emitChange();
  });

  root.querySelectorAll(".catalog-item").forEach(item => {
    const id = item.dataset.id;
    item.querySelector("input").addEventListener("change", (e) => {
      if (id.startsWith("default:")) {
        const disabled = new Set(catalog.disabledDefaults);
        if (e.target.checked) disabled.delete(id); else disabled.add(id);
        catalog.disabledDefaults = [...disabled];
      } else {
        const custom = catalog.custom.find(r => r.id === id);
        if (custom) custom.enabled = e.target.checked;
      }
      if (!e.target.checked) setFootprintEnabled(id, false);
      emitChange();
    });

    item.querySelector(".catalog-footprint")?.addEventListener("click", () => {
      const record = allRecords().find(r => r.id === id);
      if (!record?.enabled) return;
      setFootprintEnabled(id, !catalog.footprintIds.includes(id));
      emitChange();
    });

    item.querySelector(".catalog-delete")?.addEventListener("click", () => {
      catalog.custom = catalog.custom.filter(r => r.id !== id);
      setFootprintEnabled(id, false);
      emitChange();
    });
  });
}

export function initSatelliteCatalog(containerId, rawDefaults, callback, footprintCallback) {
  root = document.getElementById(containerId);
  onChange = callback;
  onFootprintChange = footprintCallback;
  defaultRecords = rawDefaults.map((s, i) => ({
    id: defaultId(s, i),
    name: cleanName(s.name),
    lon: clampLon(s.lon),
  }));
  catalog = loadCatalog();
  renderCatalog();
  return {
    satellites: getEnabledSatellites(),
    footprintIds: getSelectedFootprintIds()
  };
}
