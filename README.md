# sat

**Satellite Antenna Tracker** — a lightweight, static web app for computing GEO satellite look angles (azimuth and elevation) from any ground location.

🌐 **Live:** [https://jrky.github.io/sat/](https://jrky.github.io/sat/)

---

## What it does

Set your location by clicking the map, using the search bar, or hitting the GPS button. The app immediately computes pointing angles to every satellite in the list and shows:

- **Azimuth and elevation** for each satellite from your position
- **Status** — Good (≥10°), Low (0–10°), or Bad (below horizon)
- **Great-circle look-angle lines** on the map, colored by status
- **Coverage footprints** (optional toggle) showing each satellite's visibility zone
- **Compass rose** in the detail card for the selected satellite

Satellite labels appear automatically at higher zoom levels. The panel can be pinned open alongside the map or used as a slide-out drawer. State (pin, footprints) persists across sessions via `localStorage`. Dark mode follows system preference.

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

To update the satellite list, edit [`satellites.json`](satellites.json). Each entry needs a `name` and a `lon` (decimal degrees, negative = West).

```json
[
  { "name": "MY-SAT", "lon": -75.0 }
]
```

---

## Stack

No build step. No framework. No API keys.

| Concern | Library |
|---------|---------|
| Map | [Leaflet 1.9](https://leafletjs.com/) |
| Geodesic lines | [Leaflet.Geodesic](https://henrythasler.github.io/Leaflet.Geodesic/) |
| Geocoding | [Nominatim](https://nominatim.org/) (OpenStreetMap) |
| Tile layers | OSM · CartoDB · OpenTopoMap · Esri |
| Icons | [Material Symbols Rounded](https://fonts.google.com/icons) |
| Fonts | Google Sans · Roboto Mono |

All satellite math (az/el, footprint geometry, great-circle lines) is done in plain JS with no external dependencies.

---

## Project structure

```
sat/
├── index.html
├── satellites.json        # satellite list — edit this to change satellites
├── styles/
│   └── main.css
└── js/
    ├── app.js             # bootstrap
    ├── state.js           # single source of truth
    ├── map.js             # Leaflet init, panes, user marker
    ├── markers.js         # satellite icons + zoom-aware labels
    ├── lines.js           # look-angle lines (status-colored)
    ├── footprints.js      # coverage footprint polygons
    ├── geometry.js        # pure math: az/el, footprint boundary
    ├── events.js          # user interactions, panel, selection
    ├── table.js           # satellite list table
    └── autocomplete.js    # Nominatim location search
```

---

## Hosting on GitHub Pages

The repo is already configured to serve from the `main` branch root. To deploy:

```bash
git add .
git commit -m "update"
git push origin main
```

GitHub Pages will publish automatically to [https://jrky.github.io/sat/](https://jrky.github.io/sat/).

---

## License

MIT © 2026 Josh Kennedy
