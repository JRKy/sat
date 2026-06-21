# Satellite Antenna Tracker

A lightweight static web app for computing GEO satellite look angles from any ground location.

Live site: https://jrky.github.io/sat/

## Features

- Set observer location from browser geolocation, map click, or location search.
- Compute true azimuth, magnetic azimuth, elevation, zenith angle, and magnetic declination.
- Show map lines from the observer to visible satellites.
- Show a selected-satellite bearing ray for dish pointing.
- Color satellites by elevation status:
  - Good: 20 degrees or higher
  - Low: 5 to 20 degrees
  - Bad: below 5 degrees
- Toggle optional GEO footprint overlays.
- Filter visible satellites by minimum elevation.
- Export visible satellite angles to CSV.
- Manage a personal satellite catalog in the Satellites tab:
  - enable or disable default satellites
  - add custom satellites by name and longitude
  - delete custom satellites
  - reset back to defaults

The app has no build step, no framework, and no API keys.

## Running Locally

Serve the folder with a local static server:

```powershell
cd C:\Users\jrky\OneDrive\Documents\Sat
python -m http.server 8123 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:8123/
```

Opening `index.html` directly from `file://` is not recommended because browser security rules can interfere with `fetch()` and ES modules.

## Interface

The app uses a floating window over the map.

- On desktop, the window can be dragged and its position is remembered.
- On mobile, the window docks to the bottom of the screen.
- The title-bar button minimizes or expands the window.
- Selecting a satellite from the map or table switches to the Pointing tab.

Tabs:

- Pointing: observer coordinates and selected satellite details.
- Satellites: filters, toggles, CSV export, catalog controls, and sortable satellite table.

## Default Satellites

Defaults live in `satellites.json`:

| Name | Longitude |
| --- | ---: |
| ALT-IO | 110.0 E |
| ALT-LANT | 24.0 W |
| ALT-PAC | 170.0 E |
| MUOS-2 | 172.0 E |
| MUOS-3 | 15.5 W |
| MUOS-4 | 75.0 E |
| MUOS-5 | 100.0 W |

Each entry requires a `name` and `lon` in decimal degrees. Negative longitude means west.

```json
[
  { "name": "MY-SAT", "lon": -75.0 }
]
```

End users can also customize their own local catalog from the app UI without editing this file.

## Persistence

The app stores these values in `localStorage`:

| Key | Purpose |
| --- | --- |
| `sat_catalog_v1` | Local satellite catalog edits |
| `sat_elev_unit` | Elevation vs zenith display mode |
| `sat_win_pos` | Floating window position on desktop |
| `sat_win_min` | Whether the window is minimized |

Footprints default to off each session.

## Offline Behavior

The service worker caches the app shell, including HTML, CSS, JavaScript modules, icons, and `satellites.json`.

Works offline after the first cache:

- satellite math
- magnetic declination
- bearing ray
- footprints
- table filtering and sorting
- CSV export
- local catalog management

Requires network:

- map tiles
- location search through Nominatim
- CDN-loaded Leaflet, fonts, and icons on first load

To invalidate the app shell cache after changing cached files, bump the version in `sw.js`:

```js
const CACHE = "sat-v5";
```

## Project Structure

```text
sat/
|-- index.html
|-- satellites.json
|-- manifest.json
|-- sw.js
|-- favicon.svg
|-- styles/
|   `-- main.css
`-- js/
    |-- app.js             # bootstrap, catalog init, geolocation button
    |-- autocomplete.js    # Nominatim search
    |-- bearing.js         # selected-satellite bearing ray
    |-- catalog.js         # local satellite catalog UI and persistence
    |-- declination.js     # embedded WMM-2025 magnetic declination
    |-- events.js          # app coordination, selection, rendering refresh
    |-- export.js          # CSV generation and download
    |-- footprints.js      # GEO footprint polygons
    |-- geo-wrap.js        # longitude wrapping helpers
    |-- geometry.js        # az/el and footprint math
    |-- lines.js           # observer-to-satellite map lines
    |-- map.js             # Leaflet setup, panes, user marker
    |-- markers.js         # satellite markers and labels
    |-- state.js           # shared app state and persisted preferences
    |-- status.js          # elevation status thresholds and colors
    |-- table.js           # sortable satellite table
    `-- window-ui.js       # floating window drag/minimize behavior
```

## Stack

| Concern | Library / Source |
| --- | --- |
| Map | Leaflet 1.9 |
| Geocoding | Nominatim / OpenStreetMap |
| Tile layers | OpenStreetMap, CartoDB Dark, OpenTopoMap, Esri Imagery |
| Icons | Material Symbols Rounded |
| Fonts | Google Sans, Roboto Mono |
| Magnetic model | NOAA WMM-2025 coefficients embedded locally |

## Deployment

GitHub Pages serves the repository from the `main` branch root.

```powershell
git add .
git commit -m "Update app"
git push origin main
```

## License

MIT. See `LICENSE`.
