import { S } from './state.js';
import { fetchForecast } from './api.js';
import { renderForecast } from './forecast.js';
import { renderWeather, scrollHourlyNow } from './weather.js';
import {
  showPicker, showLoading, showCurrentCoords, showLocError,
  getManualCoords, reverseGeocode, syncMapMarker,
  saveCurrentLocation, renderSaved, autoDetectLocation,
} from './location.js';

// ── DOM REFS ──────────────────────────────────────────────────────────
const locationOverlay = document.getElementById('locationOverlay');
const app             = document.getElementById('app');
const errorBox        = document.getElementById('errorBox');
const errorMsg        = document.getElementById('errorMsg');
const themeBtn        = document.getElementById('themeBtn');
const refreshBtn      = document.getElementById('refreshBtn');
const retryBtn        = document.getElementById('retryBtn');
const backBtn         = document.getElementById('backBtn');
const changeLocBtn    = document.getElementById('changeLocBtn');
const headerChangeLoc = document.getElementById('headerChangeLoc');
const fetchBtn        = document.getElementById('fetchBtn');
const latInput        = document.getElementById('latInput');
const lonInput        = document.getElementById('lonInput');

// ── TAB SWITCHING ──────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.querySelector('.tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'weather') scrollHourlyNow();
  });
});

async function startForecast(lat, lon) {
  S.lat = lat;
  S.lon = lon;
  latInput.value = lat.toFixed(4);
  lonInput.value = lon.toFixed(4);

  showLoading();

  try {
    const data = await fetchForecast(lat, lon);
    renderForecast(data, lat, lon);
    renderWeather(data);

    locationOverlay.style.display = 'none';
    app.style.display = 'block';
  } catch (err) {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('locationPicker').style.display = 'block';
    showCurrentCoords(lat, lon);
    showLocError(`${err.message}. Verificá tu conexión o intentá más tarde.`);
    console.error('Fetch error:', err);
  }
}

async function refreshForecast() {
  refreshBtn.disabled = true;

  try {
    const data = await fetchForecast(S.lat, S.lon);
    renderForecast(data, S.lat, S.lon);
    renderWeather(data);
    scrollHourlyNow(); // el re-render resetea el scroll del contenedor
    document.getElementById('fetchedAt').textContent =
      new Date().toLocaleTimeString('es-CR', { hour:'2-digit', minute:'2-digit' });
  } catch (err) {
    console.error('Refresh error:', err);
  } finally {
    refreshBtn.disabled = false;
  }
}

function showError(errMsg) {
  locationOverlay.style.display = 'none';
  errorMsg.textContent = `${errMsg}. Verificá tu conexión o intentá más tarde.`;
  errorBox.style.display = 'flex';
}

function goBackToPicker() {
  errorBox.style.display = 'none';
  app.style.display = 'none';
  locationOverlay.style.display = 'flex';
  showPicker();
  if (S.lat !== null) {
    showCurrentCoords(S.lat, S.lon);
  }
}

function resetToPicker() {
  errorBox.style.display = 'none';
  app.style.display = 'none';
  locationOverlay.style.display = 'flex';
  showPicker();
}

// ── THEME ──────────────────────────────────────────────────────────────
function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  themeBtn.textContent = next === 'dark' ? '☀' : '☾';
  localStorage.setItem('stargazing-theme', next);
  if (S.chart) S.chart.update();
}

const savedTheme = localStorage.getItem('stargazing-theme');
if (savedTheme && savedTheme !== 'dark') {
  document.documentElement.setAttribute('data-theme', 'light');
  themeBtn.textContent = '☾';
}

// ── EVENT BINDING ────────────────────────────────────────────────────
refreshBtn.addEventListener('click', refreshForecast);
themeBtn.addEventListener('click', toggleTheme);

fetchBtn.addEventListener('click', () => {
  const c = getManualCoords();
  if (c) {
    reverseGeocode(c.lat, c.lon);
    startForecast(c.lat, c.lon);
  }
});

latInput.addEventListener('keydown', e => { if (e.key === 'Enter') fetchBtn.click(); });
lonInput.addEventListener('keydown', e => { if (e.key === 'Enter') fetchBtn.click(); });
latInput.addEventListener('blur', () => {
  const c = getManualCoords();
  if (c) { S.userInteracted = true; S.lat = c.lat; S.lon = c.lon; setTimeout(syncMapMarker, 50); }
});
lonInput.addEventListener('blur', () => {
  const c = getManualCoords();
  if (c) { S.userInteracted = true; S.lat = c.lat; S.lon = c.lon; setTimeout(syncMapMarker, 50); }
});

changeLocBtn.addEventListener('click', resetToPicker);
headerChangeLoc.addEventListener('click', resetToPicker);
document.getElementById('saveLocBtn').addEventListener('click', saveCurrentLocation);
backBtn.addEventListener('click', goBackToPicker);
retryBtn.addEventListener('click', () => {
  if (S.lat !== null && S.lon !== null) {
    errorBox.style.display = 'none';
    startForecast(S.lat, S.lon);
  } else {
    goBackToPicker();
  }
});

// ── INIT ─────────────────────────────────────────────────────────────
autoDetectLocation();
showPicker();
renderSaved();
