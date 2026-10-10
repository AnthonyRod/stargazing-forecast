import { S } from './state.js';
import { scoreHour, scoreColor, verdict } from './scoring.js';
import { addDays, fmtDate, moonPhase, getNightSlots, bestWindow } from './utils.js';

// ── RENDER · PESTAÑA ASTRO ─────────────────────────────────────────────
export function renderForecast(data, lat, lon) {
  const H       = data.hourly;
  const timeArr = H.time;

  const scores = timeArr.map((_, i) =>
    scoreHour(H.cloud_cover?.[i], H.precipitation_probability?.[i],
              H.relative_humidity_2m?.[i], H.visibility?.[i], H.wind_speed_10m?.[i])
  );

  const today = timeArr[0].slice(0, 10);
  const dates = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const moon  = moonPhase(today);

  const latStr = `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(lon).toFixed(4)}°${lon >= 0 ? 'O' : 'E'}`;
  const elevation = data.elevation ? `${data.elevation}m MSL` : '';

  document.title = `Stargazing Forecast · ${latStr} ${lonStr}${elevation ? ' · ' + elevation : ''}`;
  document.getElementById('headerSubtitle').textContent =
    `${latStr} · ${lonStr}${elevation ? ' · ' + elevation : ''}`
    + ` · ${data.timezone} · GMT${data.utc_offset_seconds >= 0 ? '+' : ''}${data.utc_offset_seconds/3600}`;
  document.getElementById('fetchedAt').textContent =
    new Date().toLocaleTimeString('es-CR', { hour:'2-digit', minute:'2-digit' });
  document.getElementById('footerModel').textContent = data._model || 'best_match';
  document.getElementById('footerDate').textContent =
    `Actualizado: ${new Date().toLocaleString('es-CR')} · ${timeArr.length} horas de datos`;

  // Moon widget
  document.getElementById('moonWidget').innerHTML = `
    <span class="moon-phase-icon">${moon.icon}</span>
    <span class="moon-label">${moon.name}</span>
    <div class="moon-detail">Día ${moon.phase} del ciclo · ${moon.illum}% ilum.</div>
    <div class="moon-detail" style="color:${moon.effect.c};margin-top:3px">${moon.effect.t}</div>`;

  // ── Build night cards ────────────────────────────────────────
  let bestNightIdx = 0, bestNightScore = -1;

  const nightMeta = dates.map((date, di) => {
    const slots = getNightSlots(date, timeArr);
    const ns    = slots.map(({ i }) => scores[i]).filter(s => s !== undefined);
    const avg   = ns.length ? Math.round(ns.reduce((a,b)=>a+b,0)/ns.length) : 0;
    const peak  = ns.length ? Math.max(...ns) : 0;
    const peakSlot = slots.find(({ i }) => scores[i] === peak);
    const peakHour = peakSlot ? peakSlot.label : '';
    if (peak > bestNightScore) { bestNightScore = peak; bestNightIdx = di; }
    return { date, slots, avg, peak, peakHour };
  });

  const grid = document.getElementById('nightsGrid');
  grid.innerHTML = '';

  const chartLabels = [], chartScores = [], chartColors = [], chartBg = [];
  const chartRaw = [];
  const dayBoundaries = [];

  nightMeta.forEach(({ date, slots, avg, peak, peakHour }, di) => {
    const isBest = di === bestNightIdx;
    const v      = verdict(avg);
    const win    = bestWindow(slots, scores);
    const moonN  = moonPhase(date);

    const pick = key => slots.map(({ i }) => H[key]?.[i]).filter(x => x !== undefined);
    const mean = arr => arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(0) : '—';

    const avgCloud = mean(pick('cloud_cover'));
    const avgRh    = mean(pick('relative_humidity_2m'));
    const avgVis   = mean(pick('visibility').map(x => x/1000));
    const avgWind  = mean(pick('wind_speed_10m'));

    const bars = slots.map(({ label, i }) => {
      const s  = scores[i] ?? 0;
      const c  = scoreColor(s);
      const cl = H.cloud_cover?.[i] ?? '?';
      const rh = H.relative_humidity_2m?.[i] ?? '?';
      const vi = H.visibility?.[i] !== undefined ? (H.visibility[i] / 1000).toFixed(1) : '?';
      const wi = H.wind_speed_10m?.[i] ?? '?';
      chartLabels.push(`${date.slice(5)} ${label}`);
      chartScores.push(s);
      chartColors.push(c);
      chartBg.push(c + '55');
      chartRaw.push({ cl, rh, vi, wi });
      if (chartLabels.length > 1 && label === '00:00') dayBoundaries.push(chartLabels.length - 1);
      return `<div class="hour-bar"
        style="background:${c};opacity:${0.18+s/100*0.82}"
        data-tip="${label} · Score:${s} · Nubes:${cl}% · HR:${rh}%"></div>`;
    }).join('');

    const winTag = win
      ? `<div class="window-tag">★ ${win[0].label}–${win[win.length-1].label}
          · avg ${Math.round(win.map(w=>w.s).reduce((a,b)=>a+b,0)/win.length)}</div>`
      : `<div class="no-window-tag">Sin ventana esta noche</div>`;

    const card = document.createElement('div');
    card.className = `night-card${isBest ? ' best' : ''}${peak >= 70 ? ' is-excellent' : ''}`;
    card.innerHTML = `
      <div class="night-header">
        <div>
          <div class="night-date">${isBest ? '★ ' : ''}${fmtDate(date)}</div>
          <div class="night-sub">${moonN.icon} ${moonN.name} · ${moonN.illum}% ilum.</div>
        </div>
        <div>
          <div class="score-badge" style="color:${v.c}">${avg}</div>
          <div class="score-label">SCORE PROM</div>
          <div class="score-verdict" style="color:${v.c}">${v.text}</div>
        </div>
      </div>
      <div class="hour-timeline">${bars}</div>
      <div class="hour-labels"><span>18h</span><span>21h</span><span>00h</span><span>03h</span><span>05h</span></div>
      <div class="peak-tag" style="color:${scoreColor(peak)};border-color:${scoreColor(peak)}55;background:${scoreColor(peak)}12">▲ ${peakHour} · pico ${peak}</div>
      ${winTag}
      <div class="metrics">
        <div class="metric"><div class="metric-val">${avgCloud}%</div><div class="metric-lbl">Nubes</div></div>
        <div class="metric"><div class="metric-val">${avgRh}%</div><div class="metric-lbl">Humedad</div></div>
        <div class="metric"><div class="metric-val">${parseFloat(avgVis).toFixed(0)}km</div><div class="metric-lbl">Visib.</div></div>
        <div class="metric"><div class="metric-val">${avgWind}</div><div class="metric-lbl">Viento</div></div>
      </div>`;
    grid.appendChild(card);
  });

  // ── Day-marker plugin ───────────────────────────────────────
  const border = () => getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#141e35';
  const dayMarkerPlugin = {
    id: 'dayMarkers',
    afterDraw(chart) {
      const ctx = chart.ctx;
      const xAxis = chart.scales.x;
      const yAxis = chart.scales.y;
      ctx.save();
      ctx.strokeStyle = border();
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      dayBoundaries.forEach(idx => {
        const x = xAxis.getPixelForValue(idx);
        ctx.beginPath();
        ctx.moveTo(x, yAxis.top);
        ctx.lineTo(x, yAxis.bottom);
        ctx.stroke();
        const dayLabel = chartLabels[idx].slice(0, 5);
        ctx.restore();
        ctx.save();
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#3a4a60';
        ctx.font = '7px Space Mono';
        ctx.textAlign = 'center';
        ctx.fillText(dayLabel, x, yAxis.bottom + 4);
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = border();
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
      });
      ctx.restore();
    }
  };

  // ── Main chart ──────────────────────────────────────────────
  if (S.chart) S.chart.destroy();
  S.chart = new Chart(document.getElementById('mainChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: chartLabels,
      datasets: [{
        data: chartScores,
        backgroundColor: chartBg,
        borderColor: chartColors,
        borderWidth: 1,
        borderRadius: 2,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display:false },
        tooltip: {
          backgroundColor:'#0d1224', titleColor:'#b8c8e0',
          bodyColor:'#e8f0ff', borderColor:'#141e35', borderWidth:1,
          callbacks: {
            label: ctx => {
              const r = chartRaw[ctx.dataIndex];
              return `Score: ${ctx.parsed.y} — ${verdict(ctx.parsed.y).text}  ·  Nubes:${r.cl}% HR:${r.rh}% Vis:${r.vi}km Viento:${r.wi}km/h`;
            }
          }
        }
      },
      scales: {
        x: { grid:{ display:false }, ticks:{ color: getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#3a4a60', font:{ family:'Space Mono', size:6 }, maxRotation:90 } },
        y: { grid:{ display:false }, min:0, max:100, ticks:{ color: getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#3a4a60', font:{ family:'Space Mono', size:9 } } }
      }
    },
    plugins: [dayMarkerPlugin]
  });

  // ── Night filter ────────────────────────────────────────────
  const filterBtns = document.querySelectorAll('.filter-btn');
  const gridEl = document.getElementById('nightsGrid');
  const cntEl = document.getElementById('filterCount');
  function applyFilter(f) {
    filterBtns.forEach(b => b.classList.toggle('active', b.dataset.filter === f));
    gridEl.classList.toggle('filter-excellent', f === 'excellent');
    const visible = [...gridEl.children].filter(c => f !== 'excellent' || c.classList.contains('is-excellent')).length;
    cntEl.textContent = `${visible} / ${gridEl.children.length} noches`;
  }
  filterBtns.forEach(b => b.addEventListener('click', () => applyFilter(b.dataset.filter)));
  applyFilter('all');

  // ── Explainer ───────────────────────────────────────────────
  const bestDate = dates[bestNightIdx];
  const bestMoon = moonPhase(bestDate);
  document.getElementById('explainer').innerHTML = `
    <strong>Cómo se calcula el Score (0–100):</strong><br>
    Nubosidad <strong>45%</strong> · Prob. lluvia <strong>20%</strong> ·
    Humedad relativa <strong>20%</strong> · Visibilidad <strong>15%</strong> ·
    Penalización si viento &gt;20 km/h. HR &gt;90% + visibilidad &lt;5km = penalización por niebla.<br><br>
    <strong>Fase lunar hoy:</strong> Día ${moon.phase} del ciclo · ${moon.illum}% iluminación →
    <span style="color:${moon.effect.c}">${moon.effect.t}</span>.
    ${elevation ? `A ${data.elevation}m la niebla nocturna es el factor limitante más frecuente;` : ''}
    HR &gt;95% = riesgo de rocío sobre óptica incluso con cielo despejado.<br><br>
    <strong>Mejor noche en 14 días:</strong>
    ${fmtDate(bestDate)} · ${bestMoon.icon} ${bestMoon.illum}% iluminación lunar ·
    Score promedio nocturno <span style="color:#40e0a0">${bestNightScore}/100</span>.
  `;
}