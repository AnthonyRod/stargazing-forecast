// ── WEATHER TAB ────────────────────────────────────────────────────────
import { addDays } from './utils.js';

export const WMO = {
  0:{i:'☀️',t:'Despejado'},1:{i:'🌤️',t:'Mayormente despejado'},2:{i:'⛅',t:'Parcial nublado'},3:{i:'☁️',t:'Nublado'},
  45:{i:'🌫️',t:'Niebla'},48:{i:'🌫️',t:'Niebla'},
  51:{i:'🌦️',t:'Llovizna'},53:{i:'🌦️',t:'Llovizna'},55:{i:'🌦️',t:'Llovizna'},
  56:{i:'🌦️',t:'Llovizna helada'},57:{i:'🌦️',t:'Llovizna helada'},
  61:{i:'🌧️',t:'Lluvia'},63:{i:'🌧️',t:'Lluvia'},65:{i:'🌧️',t:'Lluvia fuerte'},
  66:{i:'🌧️',t:'Lluvia helada'},67:{i:'🌧️',t:'Lluvia helada'},
  71:{i:'🌨️',t:'Nieve'},73:{i:'🌨️',t:'Nieve'},75:{i:'🌨️',t:'Nieve fuerte'},
  77:{i:'🌨️',t:'Granos de nieve'},
  80:{i:'🌦️',t:'Chubascos'},81:{i:'🌦️',t:'Chubascos'},82:{i:'🌦️',t:'Chubascos'},
  85:{i:'🌨️',t:'Chubascos de nieve'},86:{i:'🌨️',t:'Chubascos de nieve'},
  95:{i:'⛈️',t:'Tormenta'},96:{i:'⛈️',t:'Tormenta'},99:{i:'⛈️',t:'Tormenta'},
};

export function wmoIcon(code, hour) {
  const w = WMO[code];
  if (!w) return {i:'❓',t:'Desconocido'};
  let icon = w.i;
  const night = hour != null && (hour < 6 || hour >= 18);
  if (night) {
    if (icon === '☀️') icon = '🌙';
    else if (icon === '🌤️' || icon === '⛅') icon = '🌙☁️';
    else if (icon === '🌦️') icon = '🌧️';
  }
  return {i: icon, t: w.t};
}

export function skyText(cloud) {
  if (cloud < 20) return 'Despejado';
  if (cloud < 60) return 'Parcial nublado';
  return 'Nublado';
}

export function skyIcon(cloud, hour) {
  const night = hour < 6 || hour >= 18;
  if (cloud < 20) return night ? '🌙' : '☀️';
  if (cloud < 60) return night ? '🌙☁️' : '⛅';
  return '☁️';
}

// Etiqueta de tarjeta diaria relativa a hoy (función pura, testeable).
// todayStr: fecha local actual 'YYYY-MM-DD'.
export function dayLabel(date, todayStr) {
  if (date === todayStr) return 'Hoy';
  if (date === addDays(todayStr, 1)) return 'Mañana';
  if (date === addDays(todayStr, -1)) return 'Ayer';
  return ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][
    new Date(date + 'T12:00:00Z').getUTCDay()];
}

// Ventana horaria anclada a ahora: `before` horas pasadas + `after` horas
// desde ahora (incl. ahora). Devuelve [start, end) con clamps a los
// extremos del array (función pura, testeable).
export function hourlyWindowBounds(nowIdx, HLen, before = 8, after = 24) {
  const start = Math.max(0, nowIdx - before);
  const end = Math.min(HLen, nowIdx + after);
  return [start, end];
}

// Desplaza el contenedor horario para alinear la tarjeta AHORA al borde
// izquierdo. Usa scrollLeft manual (seguro con la pestaña oculta).
export function scrollHourlyNow() {
  const c = document.getElementById('hourlyWeather');
  const nowCard = c?.querySelector('.w-card.now');
  if (!c || !nowCard) return;
  c.scrollLeft += nowCard.getBoundingClientRect().left - c.getBoundingClientRect().left;
}

export function renderWeather(data) {
  const H = data.hourly;
  const D = data.daily;
  if (!H || !D) return;

  const now = new Date();
  const offsetMs = (data.utc_offset_seconds || 0) * 1000;
  const localNow = new Date(now.getTime() + offsetMs);
  const localStr = localNow.toISOString().slice(0, 13) + ':00';
  const localHour = localNow.getUTCHours();
  const todayStr = localNow.toISOString().slice(0, 10);
  const yesterdayStr = addDays(todayStr, -1);

  let nowIdx = -1;
  for (let i = 0; i < H.time.length; i++) {
    if (H.time[i] >= localStr) { nowIdx = i; break; }
  }
  if (nowIdx < 0) nowIdx = H.time.length - 1;
  nowIdx = Math.max(0, nowIdx);

  const curTemp  = H.temperature_2m?.[nowIdx];
  const curRh    = H.relative_humidity_2m?.[nowIdx];
  const curCloud = H.cloud_cover?.[nowIdx] ?? 0;
  const curCode  = H.weather_code?.[nowIdx] ?? 0;

  const w = wmoIcon(curCode, localHour);

  // ── Astro current conditions ──
  document.getElementById('currentConditions').innerHTML = `
    <div class="cond-icon">${skyIcon(curCloud, localHour)}</div>
    <div class="cond-temp">${curTemp != null ? Math.round(curTemp) + '°' : '—'}</div>
    <div class="cond-desc">${skyText(curCloud)}${curCode > 0 ? ' · ' + w.t : ''}</div>
    <div class="cond-meta">
      <span>💧 ${curRh != null ? curRh + '%' : '—'}</span>
      <span>🌡️ ${H.apparent_temperature?.[nowIdx] != null ? Math.round(H.apparent_temperature[nowIdx]) + '°' : '—'}</span>
    </div>`;

  // ── Weather current conditions ──
  document.getElementById('weatherCurrent').innerHTML = `
    <div class="cond-icon">${w.i}</div>
    <div class="cond-temp">${curTemp != null ? Math.round(curTemp) + '°' : '—'}</div>
    <div class="cond-desc">${w.t}${curCloud != null ? ' · ' + skyText(curCloud) : ''}</div>
    <div class="cond-meta">
      <span>💧 ${curRh != null ? curRh + '%' : '—'}</span>
      <span>🌡️ ${H.apparent_temperature?.[nowIdx] != null ? Math.round(H.apparent_temperature[nowIdx]) + '°' : '—'}</span>
    </div>`;

  // ── 8 h antes + 24 h desde ahora (hasta 32 tarjetas) ──
  // Anclada a ahora: cruza medianoche sin truncar el futuro.
  const [wStart, wEnd] = hourlyWindowBounds(nowIdx, H.time.length);
  const slots = [];
  for (let i = wStart; i < wEnd; i++) {
    const h = parseInt(H.time[i].slice(11, 13));
    const wc = wmoIcon(H.weather_code?.[i] ?? 0, h);
    slots.push({ hour:h, day:H.time[i].slice(0, 10),
      prev:i < nowIdx, now:i === nowIdx,
      temp:H.temperature_2m?.[i], feels:H.apparent_temperature?.[i],
      precip:H.precipitation?.[i], wind:H.wind_speed_10m?.[i], icon:wc.i });
  }

  document.getElementById('hourlyWeather').innerHTML = slots.map(s => `
    <div class="w-card${s.now ? ' now' : s.prev ? ' prev' : ''}">
      ${s.now ? '<div class="now-tag">AHORA</div>' : ''}
      <div class="hour">${s.day === yesterdayStr ? 'Ayer ' : ''}${String(s.hour).padStart(2,'0')}:00</div>
      <div class="icon">${s.icon}</div>
      <div class="temp">${s.temp != null ? Math.round(s.temp) + '°' : '—'}</div>
      <div class="feels">${s.feels != null ? Math.round(s.feels) + '°' : ''}</div>
      <div class="precip">${s.precip != null && s.precip > 0 ? s.precip.toFixed(1) + 'mm' : ''}</div>
      <div class="wind">${s.wind != null ? s.wind.toFixed(0) + 'km/h' : ''}</div>
    </div>`).join('');

  // ── Ayer + 14 días ──
  document.getElementById('dailyWeather').innerHTML = D.time.map((date, i) => {
    const dw = wmoIcon(D.weather_code?.[i] ?? 0);
    return `<div class="d-card">
      <div class="day">${dayLabel(date, todayStr)}</div>
      <div class="icon">${dw.i}</div>
      <div class="temps">
        <span class="hi">${D.temperature_2m_max?.[i] != null ? Math.round(D.temperature_2m_max[i]) + '°' : '—'}</span>
        <span class="lo"> / ${D.temperature_2m_min?.[i] != null ? Math.round(D.temperature_2m_min[i]) + '°' : '—'}</span>
      </div>
      <div class="precip">${D.precipitation_sum?.[i] != null && D.precipitation_sum[i] > 0 ? D.precipitation_sum[i].toFixed(1) + 'mm' : '—'}</div>
      <div class="wind">${D.wind_speed_10m_max?.[i] != null ? D.wind_speed_10m_max[i].toFixed(0) + 'km/h' : '—'}</div>
    </div>`;
  }).join('');

  scrollHourlyNow(); // no-op mientras la pestaña Clima está oculta
}