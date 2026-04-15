# sat

**Satellite Antenna Tracker** — a lightweight, static web app for computing GEO satellite look angles (azimuth, elevation, and magnetic bearing) from any ground location.

🌐 **Live:** [https://jrky.github.io/sat/](https://jrky.github.io/sat/)

---

## What it does

On load the app requests your GPS location automatically. You can also click anywhere on the map, use the search bar, or tap the location button. The app immediately computes pointing angles to every satellite and shows:

- **True and magnetic azimuth** for each satellite — magnetic corrected using the embedded WMM-2025 model
- **Elevation** above the horizon, or zenith angle (switchable)
- **Magnetic declination** for your location, shown in the satellite detail card
- **Status** — Good (≥20°), Low (5–20°), Bad (<5°) — industry-standard thresholds
- **Look-angle lines** on the map from your location to each satellite, colored by status (solid green/amber, dashed red for bad)
- **Bearing ray** — a dashed directional arrow on the map showing which way to point your dish when a satellite is selected
- **Satellite name labels** visible at all zoom levels
- **Coverage footprints** (optional toggle, off by default) showing each satellite's visibility zone
- **Compass rose** in the detail card with two needles — true north and magnetic north side by side
- **CSV export** of all visible satellite angles including true az, magnetic az, elevation, zenith angle, and status

---

## Interface

The app uses a **floating window** that sits over the map. On desktop it can be dragged anywhere on screen and its position is remembered across sessions. On mobile it anchors to the bottom of the screen as a fixed card. Click the **—** button in the title bar to minimize it to a slim bar — the selected satellite name and status remain visible even when minimized. Click the title bar or expand button to restore it.

The window has two tabs:

- **Pointing** — your observer coordinates and the selected satellite's detail card (compass rose, true az, magnetic az, elevation/zenith, declination)
- **Satellites** — the full satellite table with sortable columns, plus controls for min elevation filter, footprint toggle, zenith angle toggle, and CSV export

Clicking any satellite marker on the map or any row in the table automatically switches to the Pointing tab and expands the window if minimized.

---

## Elevation status thresholds

| Status | Elevation | Meaning |
|--------|-----------|---------|
| **Good** | ≥ 20° | Clean sky angle, reliable link |
| **Low** | 5° – 20° | Marginal; increased path loss and rain-fade risk |
| **Bad** | < 5° | Below practical minimum; terrain/atmosphere blockage likely |

---

## Satellites

| Name | Longitude |
|------|-----------|
| ALT-IO | 110.0° E |
| ALT-LANT | 24.0° W |
| ALT-PAC | 127.0° W |
| MUOS-2 | 172.0° E |
| MUOS-3 | 15.5° W |
| MUOS-4 | 75.0° E |
| MUOS-5 | 100.0° W |

To update the satellite list, edit [`satellites.json`](satellites.json). Each entry needs a `name` and a `lon` (decimal degrees, negative = West):

```json
[
  { "name": "MY-SAT", "lon": -75.0 }
]
```

---

## Stack

No build step. No framework. No API keys.

| Concern | Library / Source |
|---------|-----------------|
| Map | [Leaflet 1.9](https://leafletjs.com/) |
| Geocoding | [Nominatim](https://nominatim.org/) (OpenStreetMap) |
| Tile layers | OSM · CartoDB Dark · OpenTopoMap · Esri Satellite |
| Icons | [Material Symbols Rounded](https://fonts.google.com/icons) |
| Fonts | Google Sans · Roboto Mono |
| Magnetic model | WMM-2025 (NOAA), embedded — no API needed |

All satellite math (az/el, magnetic declination, footprint geometry, look-angle lines, bearing ray) is plain JS with no runtime dependencies beyond Leaflet.

---

## Project structure

```
sat/
├── index.html
├── satellites.json        # satellite list — edit to add/remove satellites
├── manifest.json          # PWA manifest
├── sw.js                  # service worker — offline app shell caching
├── favicon.svg
├── styles/
│   └── main.css
└── js/
    ├── app.js             # bootstrap, geolocation, FAB wiring
    ├── state.js           # single source of truth + localStorage persistence
    ├── map.js             # Leaflet init, rendering panes, user marker
    ├── markers.js         # satellite icons + name labels (nearest world copy)
    ├── lines.js           # look-angle lines, status-colored, shortest-path aware
    ├── bearing.js         # directional bearing ray for selected satellite
    ├── footprints.js      # coverage footprint polygons
    ├── geometry.js        # pure math: az/el/magAz, footprint boundary
    ├── declination.js     # WMM-2025 magnetic declination (self-contained)
    ├── events.js          # floating window, tabs, selection, controls, export
    ├── table.js           # satellite table with sorting, mag az, unit toggle
    └── autocomplete.js    # Nominatim location search with debounce
```

---

## Persistence

The following preferences are saved to `localStorage` and restored on next load:

| Key | What it stores |
|-----|----------------|
| `sat_elev_unit` | Elevation vs zenith angle toggle |
| `sat_win_pos` | Floating window position (desktop) |
| `sat_win_min` | Whether the window is minimized |

Footprints default to off every session and are not persisted.

---

## Offline / PWA

The app registers a service worker on load and caches the full app shell (all JS, CSS, satellite list, icons). Once cached, it runs entirely offline — az/el computation, magnetic declination, bearing ray, footprints, and CSV export all work without a connection. Map tiles, geocoding search, and CDN-loaded fonts require network and degrade gracefully when unavailable.

To force a cache refresh after an update, bump the `CACHE` version string in `sw.js`:

```js
const CACHE = "sat-v2"; // increment to invalidate old cache
```

---

## Hosting on GitHub Pages

The repo serves from the `main` branch root. To deploy:

```bash
git add .
git commit -m "update"
git push origin main
```

GitHub Pages publishes automatically to [https://jrky.github.io/sat/](https://jrky.github.io/sat/).

---

## License

MIT © 2026 Josh Kennedy
