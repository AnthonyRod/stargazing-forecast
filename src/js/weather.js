// ── WEATHER TAB ────────────────────────────────────────────────────────
import { addDays } from './utils.js';
import { icon, wmoIconName, skyIconName } from './icons.js';
import { startWater, stopWater } from './water.js';

export const WMO = {
  0:{t:'Despejado'},1:{t:'Mayormente despejado'},2:{t:'Parcial nublado'},3:{t:'Nublado'},
  45:{t:'Niebla'},48:{t:'Niebla'},
  51:{t:'Llovizna'},53:{t:'Llovizna'},55:{t:'Llovizna'},
  56:{t:'Llovizna helada'},57:{t:'Llovizna helada'},
  61:{t:'Lluvia'},63:{t:'Lluvia'},65:{t:'Lluvia fuerte'},
  66:{t:'Lluvia helada'},67:{t:'Lluvia helada'},
  71:{t:'Nieve'},73:{t:'Nieve'},75:{t:'Nieve fuerte'},
  77:{t:'Granos de nieve'},
  80:{t:'Chubascos'},81:{t:'Chubascos'},82:{t:'Chubascos'},
  85:{t:'Chubascos de nieve'},86:{t:'Chubascos de nieve'},
  95:{t:'Tormenta'},96:{t:'Tormenta'},99:{t:'Tormenta'},
};

export function wmoIcon(code, hour) {
  const w = WMO[code];
  if (!w) return {i:icon('cloud',22),t:'Desconocido'};
  return {i: icon(wmoIconName(code, hour),22), t: w.t};
}

export function skyText(cloud) {
  if (cloud < 20) return 'Despejado';
  if (cloud < 60) return 'Parcial nublado';
  return 'Nublado';
}

export function skyIcon(cloud, hour) {
  return icon(skyIconName(cloud, hour), 30);
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
    <div class="cond-temp mono">${curTemp != null ? Math.round(curTemp) + '°' : '—'}</div>
    <div class="cond-desc">${skyText(curCloud)}${curCode > 0 ? ' · ' + w.t : ''}</div>
    <div class="cond-meta">
      <span>${icon('drop',14)} ${curRh != null ? curRh + '%' : '—'}</span>
      <span>${icon('thermo',14)} ${H.apparent_temperature?.[nowIdx] != null ? Math.round(H.apparent_temperature[nowIdx]) + '°' : '—'}</span>
    </div>`;

  // ── Weather current conditions ──
  document.getElementById('weatherCurrent').innerHTML = `
    <div class="cond-icon">${w.i}</div>
    <div class="cond-temp mono">${curTemp != null ? Math.round(curTemp) + '°' : '—'}</div>
    <div class="cond-desc">${w.t}${curCloud != null ? ' · ' + skyText(curCloud) : ''}</div>
    <div class="cond-meta">
      <span>${icon('drop',14)} ${curRh != null ? curRh + '%' : '—'}</span>
      <span>${icon('thermo',14)} ${H.apparent_temperature?.[nowIdx] != null ? Math.round(H.apparent_temperature[nowIdx]) + '°' : '—'}</span>
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
      precip:H.precipitation?.[i], wind:H.wind_speed_10m?.[i], icon:wc.i, iconName:wmoIconName(H.weather_code?.[i] ?? 0, h), wtext:wc.t });
  }

  // Nivel de llenado compartido: máx de lluvia en la ventana visible,
  // para que el "vaso" sea comparable entre tarjetas.
  const wmax = Math.max(0.1, ...slots.map(s => s.precip ?? 0));
  document.getElementById('hourlyWeather').innerHTML = slots.map(s => {
    const fill = s.precip > 0 ? Math.max(6, Math.round(s.precip / wmax * 100)) : 0;
    return `
    <div class="w-card${s.now ? ' now' : s.prev ? ' prev' : ''}"${s.now ? ' aria-current="true"' : ''}>
      ${fill ? `<div class="w-fill" style="height:${fill}%" aria-hidden="true"><canvas class="w-water"></canvas></div>` : ''}
      ${s.now ? '<div class="now-tag">AHORA</div>' : ''}
      <div class="hour mono">${s.day === yesterdayStr ? 'Ayer ' : ''}${String(s.hour).padStart(2,'0')}:00</div>
      <div class="icon" role="img" aria-label="${s.wtext}">${s.icon}</div>
      <div class="temp">${s.temp != null ? Math.round(s.temp) + '°' : '—'}</div>
      <div class="feels">${s.feels != null ? Math.round(s.feels) + '°' : ''}</div>
      <div class="precip">${s.precip != null && s.precip > 0 ? s.precip.toFixed(1) + 'mm' : ''}</div>
      <div class="wind">${s.wind != null ? s.wind.toFixed(0) + 'km/h' : ''}</div>
    </div>`; }).join('');

  // ── Ayer + 14 días ──
  // Escala de lluvia compartida: el máx horario de los 15 días, para que
  // las barras sean comparables entre días (no relativas a cada día).
  const allRain = D.time.map(date => {
    const rainH = [];
    for (let h = 0; h < 24; h++) {
      const idx = H.time.indexOf(`${date}T${String(h).padStart(2, '0')}:00`);
      rainH.push(idx >= 0 ? (H.precipitation?.[idx] ?? 0) : 0);
    }
    return rainH;
  });
  const gmax = Math.max(0.1, ...allRain.flat());
  document.getElementById('dailyWeather').innerHTML = D.time.map((date, i) => {
    const code = D.weather_code?.[i] ?? 0;
    const dw = wmoIcon(code);
    // Sparkline: lluvia (mm) hora por hora de este día
    const rainH = allRain[i];
    const rmax = Math.max(...rainH);
    const peakH = rainH.indexOf(rmax);
    const rainBars = rainH.map((v, h) =>
      v > 0
        ? `<span style="height:${Math.max(4, Math.round(v / gmax * 100))}%" title="${String(h).padStart(2, '0')}:00 · ${v.toFixed(1)}mm"></span>`
        : `<span class="zero" style="height:8%" title="${String(h).padStart(2, '0')}:00 · 0mm"></span>`
    ).join('');
    const rainHours = rainH.map((_, h) =>
      h % 6 === 0 ? `<span>${String(h).padStart(2, '0')}</span>` : '<span></span>'
    ).join('');
    const rainLbl = rmax > 0
      ? `Lluvia por hora, máx ${rmax.toFixed(1)}mm a las ${String(peakH).padStart(2, '0')}:00`
      : 'Sin lluvia prevista';
    return `<div class="d-card">
      <div class="day">${dayLabel(date, todayStr)}</div>
      <div class="icon" role="img" aria-label="${dw.t}">${dw.i}</div>
      <div class="d-rain" role="img" aria-label="${rainLbl}"><div class="d-bars">${rainBars}</div><div class="d-hours" aria-hidden="true">${rainHours}</div></div>
      <div class="temps">
        <span class="hi">${D.temperature_2m_max?.[i] != null ? Math.round(D.temperature_2m_max[i]) + '°' : '—'}</span>
        <span class="lo"> / ${D.temperature_2m_min?.[i] != null ? Math.round(D.temperature_2m_min[i]) + '°' : '—'}</span>
      </div>
      <div class="precip">${D.precipitation_sum?.[i] != null && D.precipitation_sum[i] > 0 ? D.precipitation_sum[i].toFixed(1) + 'mm' : '—'}</div>
      <div class="wind">${D.wind_speed_10m_max?.[i] != null ? D.wind_speed_10m_max[i].toFixed(0) + 'km/h' : '—'}</div>
    </div>`;
  }).join('');

  scrollHourlyNow(); // no-op mientras la pestaña Clima está oculta
  // Las tarjetas se reemplazan en cada render: reiniciar el agua solo si
  // la pestaña Clima está visible (si no, sizeCanvas mediría 0).
  if (!document.getElementById('panel-weather').hasAttribute('hidden')) startWater();
  else stopWater();
}