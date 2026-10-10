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
      data._meteoblue = data._meteoblue ?? 'unreachable';
      console.warn('meteoblue overlay omitido:', e.message);
    }

    return data;
  }

  throw new Error(lastErr?.message || 'No se pudo obtener datos de ningún modelo disponible');
}

// Estado de la fusión meteoblue (viaja en data._meteoblue hasta el footer).
// Etiqueta corta en español para la UI (función pura, testeable).
export function meteoblueLabel(code) {
  if (code === 'active') return 'activa';
  if (code === 'no_key') return 'sin clave';
  if (code === 'no_match') return 'sin horas coincidentes';
  if (code === 'unreachable') return 'proxy no responde';
  if (code === 'network_error') return 'API caída';
  if (code === 'parse_error' || code === 'bad_data') return 'datos inválidos';
  if (code === 'bad_coords') return 'coordenadas inválidas';
  if (typeof code === 'string' && code.startsWith('http_')) {
    const s = code.slice(5);
    return (s === '401' || s === '403') ? 'clave rechazada' : `error HTTP ${s}`;
  }
  return 'no disponible';
}

// Parámetros de la corrección de lluvia para los días 8–14 (donde meteoblue no
// llega). El sesgo se aprende del solape de ~168 h con meteoblue y se aplica
// hacia adelante. Topes conservadores porque la muestra es corta (~7 días).
export const CALIB = {
  MIN_OVERLAP: 100,   // horas coincidentes mínimas para el sesgo de probabilidad
  MIN_WET:     12,    // horas húmedas mínimas por lado para el factor de cantidad
  WET_MM:      0.1,   // umbral de "hora húmeda" (LOCI)
  TRACE_MM:    0.2,   // llovizna traza que se anula si meteoblue estuvo seco
  FACTOR_MIN:  0.25,  // clamp del factor de cantidad (ver README: refs)
  FACTOR_MAX:  4
};

// Corrección de sesgo (LOCI simplificado). Recibe los pares del solape
// {omP, mbP, omPp, mbPp} y devuelve cómo corregir las horas futuras.
// Pura y testeable. pp = probabilidad (%), P = cantidad (mm).
export function calibrateRain(pairs) {
  const out = { ppBias: 0, wetThreshold: CALIB.WET_MM, amountFactor: 1, ppApplied: false, amountApplied: false };

  const pp = pairs.filter(p => p.omPp != null && p.mbPp != null);
  if (pp.length >= CALIB.MIN_OVERLAP) {
    out.ppBias = pp.reduce((a, p) => a + (p.mbPp - p.omPp), 0) / pp.length;
    out.ppApplied = true;
  }

  const wet   = pairs.filter(p => p.omP != null && p.mbP != null);
  const mbWet = wet.filter(p => p.mbP > CALIB.WET_MM);
  const omWet = wet.filter(p => p.omP > CALIB.WET_MM);

  if (mbWet.length === 0 && wet.length >= CALIB.MIN_OVERLAP) {
    // meteoblue seco: solo anular lloviznas traza, nunca borrar todo.
    out.wetThreshold = CALIB.TRACE_MM;
    out.amountApplied = true;
  } else if (mbWet.length >= CALIB.MIN_WET && omWet.length >= CALIB.MIN_WET) {
    const sorted = wet.map(p => p.omP).sort((a, b) => a - b);
    const tidx   = sorted.length - mbWet.length - 1;
    const T      = Math.min(2, Math.max(CALIB.WET_MM, sorted[tidx] ?? CALIB.WET_MM));
    const meanMb = mbWet.reduce((a, p) => a + p.mbP, 0) / mbWet.length;
    const above  = wet.filter(p => p.omP > T);
    const meanOm = above.reduce((a, p) => a + p.omP, 0) / (above.length || 1);
    if (meanOm > 0) {
      out.wetThreshold = T;
      out.amountFactor = Math.min(CALIB.FACTOR_MAX, Math.max(CALIB.FACTOR_MIN, meanMb / meanOm));
      out.amountApplied = true;
    }
  }
  return out;
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
  if (!mb.available) { data._meteoblue = mb.reason || 'unavailable'; return; }
  if (!Array.isArray(mb.times)) { data._meteoblue = 'bad_data'; return; }

  const byKey = new Map();
  for (let i = 0; i < mb.times.length; i++) {
    const key = String(mb.times[i]).slice(0, 16).replace(' ', 'T');
    byKey.set(key, {
      p:  mb.precipitation?.[i],
      pp: mb.precipitation_probability?.[i]
    });
  }

  const H = data.hourly;
  const origP  = H.precipitation.slice();
  const origPp = H.precipitation_probability.slice();
  const pairs = [], overlaid = new Set();
  let lastOverlaid = -1;
  for (let i = 0; i < H.time.length; i++) {
    const e = byKey.get(H.time[i].slice(0, 16));
    if (!e) continue;
    overlaid.add(i);
    lastOverlaid = i;
    pairs.push({ omP: origP[i] ?? null, mbP: e.p ?? null, omPp: origPp[i] ?? null, mbPp: e.pp ?? null });
    if (e.p  != null) H.precipitation[i]              = e.p;
    if (e.pp != null) H.precipitation_probability[i]  = e.pp;
  }
  if (!overlaid.size) { data._meteoblue = 'no_match'; return; }

  // Días 8–14: sin dato de meteoblue, se corrigen con el sesgo aprendido del solape.
  const cal = calibrateRain(pairs);
  let corrected = 0;
  if ((cal.ppApplied || cal.amountApplied) && lastOverlaid >= 0) {
    for (let i = lastOverlaid + 1; i < H.time.length; i++) {
      if (overlaid.has(i)) continue;
      if (cal.ppApplied && H.precipitation_probability[i] != null) {
        H.precipitation_probability[i] = Math.max(0, Math.min(100, Math.round(H.precipitation_probability[i] + cal.ppBias)));
      }
      if (cal.amountApplied && H.precipitation[i] != null) {
        const p = H.precipitation[i];
        H.precipitation[i] = p <= cal.wetThreshold ? 0 : Math.round(p * cal.amountFactor * 10) / 10;
      }
      corrected++;
    }
  }
  data._calib = corrected
    ? (cal.ppApplied && cal.amountApplied ? 'applied' : 'partial')
    : 'off';

  // Los totales diarios se recalculan desde las horas fusionadas/corregidas.
  // Se usa la fecha de cada entrada diaria (ayer es el índice 0 con past_days).
  if (Array.isArray(data.daily?.time)) {
    for (let di = 0; di < data.daily.time.length; di++) {
      const day  = data.daily.time[di];
      let sum = 0, count = 0;
      for (let i = 0; i < H.time.length; i++) {
        if (H.time[i].startsWith(day)) { sum += H.precipitation[i] || 0; count++; }
      }
      if (count >= 20) data.daily.precipitation_sum[di] = Math.round(sum * 10) / 10;
    }
  }

  data._model = 'IFS + meteoblue (lluvia)';
  data._meteoblue = 'active';
  console.info(`meteoblue: ${overlaid.size} horas de precipitación aplicadas · corrección 8–14d: ${data._calib}`);
}