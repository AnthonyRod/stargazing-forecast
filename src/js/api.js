// Días pasados incluidos en la respuesta de Open-Meteo (la pestaña Clima
// muestra "ayer"; Astro sigue partiendo de hoy ignorando este día extra).
export const PAST_DAYS = 1;

// ── API ──────────────────────────────────────────────────────────────
export const REQUIRED_FIELDS = [
  'precipitation_probability', 'cloud_cover', 'visibility',
  'wind_speed_10m', 'wind_direction_10m',
  'relative_humidity_2m', 'dew_point_2m'
];

export const FALLBACK_MODELS = [
  { name: 'best_match',    label: 'Mejor disponible' },
  { name: 'gfs_seamless',  label: 'GFS (global)' },
  { name: 'gfs_global',    label: 'GFS (0.25°)' },
];

export const WEATHER_FIELDS = [
  'temperature_2m', 'apparent_temperature', 'precipitation', 'weather_code'
];

export function buildApiUrl(lat, lon, model) {
  return `https://api.open-meteo.com/v1/forecast`
    + `?latitude=${lat}&longitude=${lon}`
    + `&hourly=${REQUIRED_FIELDS.join(',')},${WEATHER_FIELDS.join(',')}`
    + `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,wind_speed_10m_max,uv_index_max`
    + `&models=${model}&forecast_days=14&past_days=${PAST_DAYS}&timezone=auto`;
}

export function missingFields(hourly) {
  return REQUIRED_FIELDS.filter(f => {
    const arr = hourly[f];
    return !arr || !arr.some(v => v !== null);
  });
}

// ── MAIN ─────────────────────────────────────────────────────────────
export async function fetchForecast(lat, lon) {
  let lastErr = null;

  for (const model of FALLBACK_MODELS) {
    const url = buildApiUrl(lat, lon, model.name);
    let res, data;

    try {
      res = await fetch(url);
    } catch (e) {
      lastErr = e;
      continue;
    }

    if (!res.ok) { lastErr = new Error(`HTTP ${res.status} — ${res.statusText}`); continue; }

    try {
      data = await res.json();
    } catch (e) {
      lastErr = e;
      continue;
    }

    if (data.error) { lastErr = new Error(data.reason ?? 'Error de la API'); continue; }

    const missing = missingFields(data.hourly);
    if (missing.length) {
      lastErr = new Error(`Modelo "${model.label}" no incluye: ${missing.join(', ')}`);
      continue;
    }

    data._model = model.label;

    try {
      await applyMeteobluePrecip(lat, lon, data);
    } catch (e) {
      console.warn('meteoblue overlay omitido:', e.message);
    }

    return data;
  }

  throw new Error(lastErr?.message || 'No se pudo obtener datos de ningún modelo disponible');
}

// meteoblue aporta precipitación horaria (0–7 días) con ajuste de terreno (mLM).
// Se fusiona con los datos de Open-Meteo por marca de tiempo exacta; si falla o no
// hay clave configurada en el prox., se deja intacto el dato de Open-Meteo.
export async function applyMeteobluePrecip(lat, lon, data) {
  const tz  = data.timezone || 'UTC';
  const res = await fetch(
    `/api/meteoblue?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&tz=${encodeURIComponent(tz)}`
  );
  if (!res.ok) throw new Error(`proxy HTTP ${res.status}`);
  const mb = await res.json();
  if (!mb.available || !Array.isArray(mb.times)) return;

  const byKey = new Map();
  for (let i = 0; i < mb.times.length; i++) {
    const key = String(mb.times[i]).slice(0, 16).replace(' ', 'T');
    byKey.set(key, {
      p:  mb.precipitation?.[i],
      pp: mb.precipitation_probability?.[i]
    });
  }

  const H = data.hourly;
  let overlaid = 0;
  for (let i = 0; i < H.time.length; i++) {
    const e = byKey.get(H.time[i].slice(0, 16));
    if (!e) continue;
    if (e.p  != null) H.precipitation[i]              = e.p;
    if (e.pp != null) H.precipitation_probability[i]  = e.pp;
    overlaid++;
  }
  if (!overlaid) return;

  // Los totales diarios de días 0–6 se recalculan desde las horas fusionadas.
  // Se usa la fecha de cada entrada diaria (ayer es el índice 0 con past_days).
  if (Array.isArray(data.daily?.time)) {
    for (let di = 0; di < Math.min(7, data.daily.time.length); di++) {
      const day  = data.daily.time[di];
      let sum = 0, count = 0;
      for (let i = 0; i < H.time.length; i++) {
        if (H.time[i].startsWith(day)) { sum += H.precipitation[i] || 0; count++; }
      }
      if (count >= 20) data.daily.precipitation_sum[di] = Math.round(sum * 10) / 10;
    }
  }

  data._model = 'IFS + meteoblue (lluvia)';
  console.info(`meteoblue: ${overlaid} horas de precipitación aplicadas`);
}