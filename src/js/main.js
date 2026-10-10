import { S } from './state.js';
import { fetchForecast } from './api.js';
import { renderForecast } from './forecast.js';
import { renderWeather, scrollHourlyNow } from './weather.js';
import { icon } from './icons.js';
import { startWater, stopWater } from './water.js';
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

// ── TAB SWITCHING (ARIA tablist + arrow keys) ─────────────────────────────
const tabs = [...document.querySelectorAll('.tab')];
function selectTab(btn, focus = false) {
  tabs.forEach(b => {
    const on = b === btn;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on);
    b.tabIndex = on ? 0 : -1;
    const panel = document.getElementById('panel-' + b.dataset.tab);
    panel.classList.toggle('active', on);
    if (on) panel.removeAttribute('hidden'); else panel.setAttribute('hidden', '');
    if (on && focus) b.focus();
  });
  if (btn.dataset.tab === 'weather') { scrollHourlyNow(); startWater(); }
  else stopWater();
}
tabs.forEach((btn, i) => {
  btn.addEventListener('click', () => selectTab(btn));
  btn.addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    selectTab(tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length], true);
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
  refreshBtn.setAttribute('aria-busy', 'true');

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
    refreshBtn.removeAttribute('aria-busy');
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
function paintThemeBtn(theme) {
  themeBtn.innerHTML = icon(theme === 'dark' ? 'sun' : 'moon', 20);
  themeBtn.setAttribute('aria-label', theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
  themeBtn.setAttribute('aria-pressed', theme === 'light');
}
function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  paintThemeBtn(next);
  localStorage.setItem('stargazing-theme', next);
  if (S.chart) S.chart.update();
}

paintThemeBtn(document.documentElement.getAttribute('data-theme') || 'dark');
refreshBtn.innerHTML = icon('refresh', 20);
const savedTheme = localStorage.getItem('stargazing-theme');
if (savedTheme && savedTheme !== 'dark') {
  document.documentElement.setAttribute('data-theme', 'light');
  paintThemeBtn('light');
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
