// ======================================================
// window-ui.js
// Floating satellite window drag/minimize behavior.
// ======================================================

import {
  loadPersistedWinPos,
  saveWinPos,
  loadPersistedWinMin,
  saveWinMin
} from "./state.js";

const win            = document.getElementById("sat-window");
const winHeader      = document.getElementById("win-header");
const winMinimizeBtn = document.getElementById("win-minimize");

let minimized = false;
let initialized = false;
let dragging = false;
let dragStartX = 0, dragStartY = 0;
let winStartX  = 0, winStartY  = 0;

const isMobile = () => window.innerWidth <= 600;

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function applyPos(x, y) {
  const maxX = window.innerWidth  - win.offsetWidth;
  const maxY = window.innerHeight - win.offsetHeight;
  const cx = clamp(x, 0, Math.max(0, maxX));
  const cy = clamp(y, 0, Math.max(0, maxY));
  win.style.left = cx + "px";
  win.style.top  = cy + "px";
  win.style.right = "auto";
}

export function isWindowMinimized() {
  return minimized;
}

export function minimizeWindow() {
  minimized = true;
  win.classList.add("minimized");
  winMinimizeBtn.querySelector(".material-symbols-rounded").textContent = "open_in_full";
  winMinimizeBtn.title = "Expand";
  saveWinMin(true);
}

export function expandWindow() {
  minimized = false;
  win.classList.remove("minimized");
  winMinimizeBtn.querySelector(".material-symbols-rounded").textContent = "remove";
  winMinimizeBtn.title = "Minimize";
  saveWinMin(false);
}

export function initFloatingWindow() {
  if (initialized) return;
  initialized = true;

  winMinimizeBtn.addEventListener("click", () => {
    if (minimized) expandWindow(); else minimizeWindow();
  });

  winHeader.addEventListener("click", (e) => {
    const clickedTitle = e.target.id === "win-title" ||
      e.target.id === "win-title-text" ||
      e.target.id === "win-title-pill";
    if (minimized && (e.target === winHeader || clickedTitle)) expandWindow();
  });

  if (loadPersistedWinMin()) minimizeWindow();

  winHeader.addEventListener("mousedown", (e) => {
    if (isMobile()) return;
    if (e.target.closest(".icon-btn")) return;
    dragging   = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    const rect = win.getBoundingClientRect();
    winStartX  = rect.left;
    winStartY  = rect.top;
    win.classList.add("dragging");
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    applyPos(winStartX + e.clientX - dragStartX, winStartY + e.clientY - dragStartY);
  });

  document.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    win.classList.remove("dragging");
    const rect = win.getBoundingClientRect();
    saveWinPos(rect.left, rect.top);
  });

  winHeader.addEventListener("touchstart", (e) => {
    if (isMobile()) return;
    if (e.target.closest(".icon-btn")) return;
    const t = e.touches[0];
    dragging   = true;
    dragStartX = t.clientX;
    dragStartY = t.clientY;
    const rect = win.getBoundingClientRect();
    winStartX  = rect.left;
    winStartY  = rect.top;
    e.preventDefault();
  }, { passive: false });

  document.addEventListener("touchmove", (e) => {
    if (!dragging) return;
    const t = e.touches[0];
    applyPos(winStartX + t.clientX - dragStartX, winStartY + t.clientY - dragStartY);
  }, { passive: true });

  document.addEventListener("touchend", () => {
    if (!dragging) return;
    dragging = false;
    const rect = win.getBoundingClientRect();
    saveWinPos(rect.left, rect.top);
  });

  const savedPos = loadPersistedWinPos();
  if (savedPos && !isMobile()) {
    applyPos(savedPos.x, savedPos.y);
  }

  window.addEventListener("resize", () => {
    if (isMobile()) return;
    const rect = win.getBoundingClientRect();
    applyPos(rect.left, rect.top);
  });
}
