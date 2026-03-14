import { lastObserver } from "./state.js";
import { renderObserverInfo } from "./table.js";
import { initPanelControls, syncPanelPinnedUI } from "./panel.js";
import { initEvents } from "./events.js";
import { initAutocomplete } from "./autocomplete.js";
import { fetchSatellites } from "./satellites.js";

syncPanelPinnedUI();
initPanelControls();
renderObserverInfo(lastObserver.lat, lastObserver.lon, lastObserver.heightKm);

initEvents();
initAutocomplete();
fetchSatellites();

console.log("Satellite Antenna Tracker (modular) initialized.");