import { S } from './state.js';
import { validateCoord } from './utils.js';

// ── DOM REFS ──────────────────────────────────────────────────────────
const citySearch    = document.getElementById('citySearch');
const searchResults = document.getElementById('searchResults');
const latInput      = document.getElementById('latInput');
const lonInput      = document.getElementById('lonInput');
const locError      = document.getElementById('locationError');
const locCurrent    = document.getElementById('locationCurrent');
const locLoading    = document.getElementById('locLoading');
const locSource     = document.getElementById('locSource');
const currentCoords = document.getElementById('currentCoords');
const saveLocBtn    = document.getElementById('saveLocBtn');
const savedLocations = document.getElementById('savedLocations');
const savedLocationsList = document.getElementById('savedLocationsList');
const locationPicker = document.getElementById('locationPicker');
const loadingState   = document.getElementById('loadingState');

const SAVED_KEY = 'stargazer-saved-locations';

export function getSaved() {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY)) || []; } catch { return []; }
}
function setSaved(arr) {
  localStorage.setItem(SAVED_KEY, JSON.stringify(arr));
}
export function saveCurrentLocation() {
  const arr = getSaved();
  if (arr.some(s => s.lat === S.lat && s.lon === S.lon)) return;
  arr.push({
    id: Date.now(),
    lat: S.lat,
    lon: S.lon,
    place: citySearch.value || `${S.lat.toFixed(4)}° · ${S.lon.toFixed(4)}°`,
  });
  setSaved(arr);
  renderSaved();
}
function deleteSaved(id) {
  setSaved(getSaved().filter(s => s.id !== id));
  renderSaved();
}
export function renderSaved() {
  const arr = getSaved();
  if (arr.length === 0) { savedLocations.style.display = 'none'; return; }
  savedLocations.style.display = 'block';
  savedLocationsList.innerHTML = arr.map(s =>
    `<div class="saved-location-item" data-id="${s.id}">
      <span class="saved-loc-name">${s.place}</span>
      <span class="saved-loc-coords">${s.lat.toFixed(4)}° · ${s.lon.toFixed(4)}°</span>
      <button class="saved-loc-delete" data-id="${s.id}">✕</button>
    </div>`
  ).join('');
  savedLocationsList.querySelectorAll('.saved-location-item').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('.saved-loc-delete')) return;
      const s = getSaved().find(x => x.id === parseInt(el.dataset.id));
      if (s) { S.autoDetectCancelled = true; locLoading.style.display = 'none'; setCoords(s.lat, s.lon, s.place); }
    });
  });
  savedLocationsList.querySelectorAll('.saved-loc-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      deleteSaved(parseInt(btn.dataset.id));
    });
  });
}

// ── HELPERS ────────────────────────────────────────────────────────────
export function showLocError(msg) {
  locError.style.display = 'block';
  locError.textContent = msg;
}
export function hideLocError() {
  locError.style.display = 'none';
}
export function showLocLoading() {
  S.locLoadingStart = Date.now();
  locLoading.style.display = 'flex';
}
export async function hideLocLoading() {
  const elapsed = Date.now() - S.locLoadingStart;
  if (elapsed < 800) {
    await new Promise(r => setTimeout(r, 800 - elapsed));
  }
  locLoading.style.display = 'none';
}

// ── MAP ─────────────────────────────────────────────────────────────────
function initMap() {
  if (S.map) return;
  const lat = S.lat ?? 20;
  const lon = S.lon ?? 0;
  S.map = L.map('map', { attributionControl: false }).setView([lat, lon], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
  }).addTo(S.map);
  L.control.attribution({ prefix: false, position: 'bottomright' }).addTo(S.map);

  S.map.on('click', e => {
    if (S.mapMarker) S.map.removeLayer(S.mapMarker);
    S.mapMarker = L.marker([e.latlng.lat, e.latlng.lng], { draggable: true }).addTo(S.map);
    S.mapMarker.on('dragend', () => {
      const pos = S.mapMarker.getLatLng();
      applyMapCoords(pos.lat, pos.lng);
    });
    applyMapCoords(e.latlng.lat, e.latlng.lng);
  });
}

export function syncMapMarker() {
  if (!S.map || S.lat == null || S.lon == null) return;
  if (S.mapMarker) { S.map.removeLayer(S.mapMarker); S.mapMarker = null; }
  S.mapMarker = L.marker([S.lat, S.lon], { draggable: true }).addTo(S.map);
  S.mapMarker.on('dragend', () => {
    const pos = S.mapMarker.getLatLng();
    applyMapCoords(pos.lat, pos.lng);
  });
  S.map.setView([S.lat, S.lon], S.map.getZoom() < 8 ? 8 : S.map.getZoom());
}

function initMapOnFirstShow() {
  const isFirst = !S.map;
  if (isFirst) initMap();
  setTimeout(() => {
    if (S.map) S.map.invalidateSize();
    syncMapMarker();
  }, isFirst ? 200 : 50);
}

function applyMapCoords(lat, lon) {
  S.userInteracted = true;
  latInput.value = lat.toFixed(4);
  lonInput.value = lon.toFixed(4);
  S.lat = lat;
  S.lon = lon;
  reverseGeocode(lat, lon);
}

export function showPicker() {
  locationPicker.style.display = 'block';
  loadingState.style.display = 'none';
  locCurrent.style.display = 'none';
  saveLocBtn.style.display = 'none';
  hideLocError();
  if (S.lat != null && S.lon != null) {
    latInput.value = S.lat.toFixed(4);
    lonInput.value = S.lon.toFixed(4);
  }
  setTimeout(initMapOnFirstShow, 100);
}

export function showLoading() {
  locationPicker.style.display = 'none';
  loadingState.style.display = 'flex';
  locCurrent.style.display = 'none';
}

export function showCurrentCoords(lat, lon) {
  currentCoords.textContent = `${lat.toFixed(4)}°${lat >= 0 ? 'N' : 'S'} · ${lon.toFixed(4)}°${lon >= 0 ? 'E' : 'O'}`;
  locCurrent.style.display = 'flex';
  saveLocBtn.style.display = 'inline';
}

export async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=es`,
      { headers: { 'User-Agent': 'StargazingForecast/1.0' } }
    );
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (data && data.display_name) {
      const parts = data.display_name.split(',').slice(0, 4).map(s => s.trim()).filter(Boolean);
      if (parts.length) { citySearch.value = parts.join(', '); return; }
    }
  } catch (_) {}
  citySearch.value = `${lat.toFixed(4)}°${lat >= 0 ? 'N' : 'S'} ${lon.toFixed(4)}°${lon >= 0 ? 'E' : 'O'}`;
}

function setCoords(lat, lon, place) {
  S.lat = lat;
  S.lon = lon;
  latInput.value = lat.toFixed(4);
  lonInput.value = lon.toFixed(4);
  showCurrentCoords(lat, lon);
  hideLocError();
  locSource.textContent = '';
  if (place) {
    citySearch.value = place;
  } else {
    reverseGeocode(lat, lon);
  }
  setTimeout(syncMapMarker, 100);
}

export function getManualCoords() {
  const lat = validateCoord(latInput.value, 'lat');
  const lon = validateCoord(lonInput.value, 'lon');
  if (lat === null || lon === null) {
    showLocError('Valores inválidos: Latitud (-90 a 90), Longitud (-180 a 180).');
    return null;
  }
  return { lat, lon };
}

// ── CITY SEARCH (Open-Meteo Geocoding) ────────────────────────────────
function closeSearch() {
  searchResults.classList.remove('show');
  searchResults.innerHTML = '';
}

function selectResult(r) {
  S.userInteracted = true;
  const place = `${r.name}${r.admin1 ? ', ' + r.admin1 : ''}${r.country ? ', ' + r.country : ''}`;
  setCoords(r.latitude, r.longitude, place);
  closeSearch();
}

async function doSearch(query) {
  if (query.length < 2) { closeSearch(); return; }

  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=es&format=json`
    );
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data.results || !data.results.length) { closeSearch(); return; }

    searchResults.innerHTML = data.results.map(r =>
      `<div class="search-result-item" data-lat="${r.latitude}" data-lon="${r.longitude}">
        <div class="name">${r.name}${r.admin1 ? ', ' + r.admin1 : ''}</div>
        <div class="meta">${r.country || ''} · ${r.latitude.toFixed(4)}°${r.latitude >= 0 ? 'N' : 'S'} ${r.longitude.toFixed(4)}°${r.longitude >= 0 ? 'E' : 'O'}${r.elevation ? ' · ' + r.elevation + 'm' : ''}</div>
      </div>`
    ).join('');
    searchResults.classList.add('show');

    searchResults.querySelectorAll('.search-result-item').forEach(el => {
      el.addEventListener('click', () => selectResult({
        latitude: parseFloat(el.dataset.lat),
        longitude: parseFloat(el.dataset.lon),
        name: el.querySelector('.name').textContent,
        country: '',
      }));
    });
  } catch (e) {
    closeSearch();
  }
}

citySearch.addEventListener('input', () => {
  clearTimeout(S.geoTimeout);
  S.geoTimeout = setTimeout(() => doSearch(citySearch.value.trim()), 300);
});

citySearch.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const first = searchResults.querySelector('.search-result-item');
    if (first) first.click();
  }
  if (e.key === 'Escape') closeSearch();
});

document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrap')) closeSearch();
});

// ── AUTO-DETECT LOCATION ─────────────────────────────────────────────
export async function autoDetectLocation() {
  showLocLoading();
  // Yield to browser so the loading state renders before GPS/IP
  await new Promise(r => requestAnimationFrame(r));
  if (S.autoDetectCancelled) { locLoading.style.display = 'none'; return; }

  let gpsResolved = false;

  // Try GPS first (accurate). Retry on transient errors.
  const gpsOpts = { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 };
  for (let attempt = 0; attempt < 3; attempt++) {
    if (S.autoDetectCancelled) { locLoading.style.display = 'none'; return; }
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, gpsOpts);
      });
      if (!S.userInteracted) {
        setCoords(pos.coords.latitude, pos.coords.longitude);
        citySearch.value = '';
        gpsResolved = true;
        locSource.textContent = '📍 Ubicación precisa (GPS)';
      }
      break;
    } catch (err) {
      // Transient location failure (kCLErrorLocationUnknown) — retry
      if (err.code === 2 && attempt < 2) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      // Permission denied, timeout, or other — bail
      break;
    }
  }

  // Fallback: IP-based location
  if (!gpsResolved && !S.userInteracted && !S.autoDetectCancelled) {
    try {
      const res = await fetch('https://ipinfo.io/json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const d = await res.json();
      if (!d.loc) throw new Error('no data');
      const [lat, lon] = d.loc.split(',').map(Number);
      const place = [d.city, d.region, d.country].filter(Boolean).join(', ');
      setCoords(lat, lon, place || undefined);
      locSource.textContent = '📍 Ubicación aproximada (IP)';
    } catch (_) {}
  }

  await hideLocLoading();
}