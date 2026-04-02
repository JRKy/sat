# sat

**Satellite Antenna Tracker** — a lightweight, static web app for computing GEO satellite look angles (azimuth and elevation) from any ground location.

🌐 **Live:** [https://jrky.github.io/sat/](https://jrky.github.io/sat/)

---

## What it does

On load the app requests your GPS location automatically. You can also click anywhere on the map, use the search bar, or tap the location button. The app immediately computes pointing angles to every satellite and shows:

- **Azimuth and elevation** for each satellite from your position
- **Status** — Good (≥20°), Low (5–20°), or Bad (<5°)
- **Great-circle look-angle lines** on the map, colored and styled by status (solid green/amber, dashed red)
- **Satellite name labels** visible at all zoom levels
- **Coverage footprints** (optional toggle, off by default) showing each satellite's visibility zone
- **Compass rose + angle readout** in the detail card when a satellite is selected

The satellite panel slides in from the right (desktop) or up from the bottom (mobile) when you click a satellite marker or table row. It can be pinned open alongside the map. The pin state persists across sessions. Dark mode follows system preference.

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

All satellite math (az/el, footprint geometry, great-circle lines) is plain JS with no external dependencies.

---

## Project structure

```
sat/
├── index.html
├── satellites.json        # satellite list — edit this to change satellites
├── styles/
│   └── main.css
└── js/
    ├── app.js             # bootstrap, geolocation, FAB wiring
    ├── state.js           # single source of truth
    ├── map.js             # Leaflet init, panes, user marker
    ├── markers.js         # satellite icons + always-visible name labels
    ├── lines.js           # look-angle lines (status-colored geodesics)
    ├── footprints.js      # coverage footprint polygons
    ├── geometry.js        # pure math: az/el, footprint boundary
    ├── events.js          # user interactions, panel, selection
    ├── table.js           # satellite list table with sorting
    └── autocomplete.js    # Nominatim location search
```

---

## Hosting on GitHub Pages

The repo is configured to serve from the `main` branch root. To deploy:

```bash
git add .
git commit -m "update"
git push origin main
```

GitHub Pages will publish automatically to [https://jrky.github.io/sat/](https://jrky.github.io/sat/).

---

## License

MIT © 2026 Josh Kennedy

