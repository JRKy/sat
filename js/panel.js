import {
  safeGetPinnedFromStorage,
  safeSetPinnedToStorage
} from "./state.js";

const satToggleBtn = document.getElementById("sat-toggle");
const satPanel = document.getElementById("sat-panel");
const panelCloseBtn = document.getElementById("panel-close");
const panelPinBtn = document.getElementById("panel-pin");
const satBackdrop = document.getElementById("sat-backdrop");

let panelPinned = safeGetPinnedFromStorage();

export function syncPanelPinnedUI() {
  if (satPanel) satPanel.classList.toggle("pinned", panelPinned);
  if (panelPinBtn) {
    panelPinBtn.title = panelPinned ? "Pinned" : "Pin panel";
    panelPinBtn.setAttribute("aria-label", panelPinned ? "Pinned" : "Pin panel");
  }
  safeSetPinnedToStorage(panelPinned);
}

export function openPanel() {
  if (!satPanel) return;
  satPanel.classList.add("open");
  document.body.classList.add("panel-open");   // ⭐ NEW

  if (satBackdrop) {
    if (panelPinned) satBackdrop.classList.remove("open");
    else satBackdrop.classList.add("open");
  }
}

export function closePanel(force = false) {
  if (!satPanel) return;
  if (panelPinned && !force) return;
  satPanel.classList.remove("open");
  document.body.classList.remove("panel-open");  // ⭐ NEW

  if (satBackdrop) satBackdrop.classList.remove("open");
}

export function togglePanel() {
  if (!satPanel) return;
  if (panelPinned && satPanel.classList.contains("open")) return;
  if (satPanel.classList.contains("open")) closePanel();
  else openPanel();
}

export function initPanelControls() {
  satToggleBtn?.addEventListener("click", togglePanel);

  panelCloseBtn?.addEventListener("click", () => {
    panelPinned = false;
    syncPanelPinnedUI();
    closePanel(true);
  });

  satBackdrop?.addEventListener("click", () => closePanel(false));

  panelPinBtn?.addEventListener("click", () => {
    panelPinned = !panelPinned;
    syncPanelPinnedUI();
    if (panelPinned) openPanel();
    else if (satPanel?.classList.contains("open") && satBackdrop) satBackdrop.classList.add("open");
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePanel(false);
  });

  window.addEventListener("resize", syncPanelPinnedUI);

  syncPanelPinnedUI();
  if (panelPinned) openPanel();
}