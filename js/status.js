// ======================================================
// status.js
// Shared satellite status thresholds and display colors.
// ======================================================

export const STATUS_THRESHOLDS = {
  good: 20,
  low: 5,
};

export const STATUS_COLORS = {
  good: { light: "#1e8e3e", dark: "#30d158" },
  low:  { light: "#f29900", dark: "#ffd60a" },
  bad:  { light: "#d93025", dark: "#ff453a" },
};

export function elevationToStatus(el) {
  if (el >= STATUS_THRESHOLDS.good) return "good";
  if (el >= STATUS_THRESHOLDS.low) return "low";
  return "bad";
}

export function statusColor(status, colorScheme) {
  const dark = colorScheme
    ? colorScheme === "dark"
    : typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
  return (STATUS_COLORS[status] ?? STATUS_COLORS.bad)[dark ? "dark" : "light"];
}
