// ── HELPERS DE FECHA ───────────────────────────────────────────────────
export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function fmtDate(dateStr) {
  const [, m, d] = dateStr.split('-');
  const months = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const dnames  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const dt = new Date(dateStr + 'T12:00:00Z');
  return `${dnames[dt.getUTCDay()]} ${parseInt(d)} ${months[+m]}`;
}

// ── FASE LUNAR ─────────────────────────────────────────────────────────
export function moonPhase(dateStr) {
  const d   = new Date(dateStr + 'T12:00:00Z');
  const ref = new Date('2000-01-06T18:14:00Z');
  const cycle = 29.53058867;
  const days  = (d - ref) / 864e5;
  const phase = ((days % cycle) + cycle) % cycle;
  const illum = Math.round((1 - Math.cos(2 * Math.PI * phase / cycle)) / 2 * 100);
  let icon, name;
  if      (phase <  1.85) { icon='🌑'; name='Luna Nueva'; }
  else if (phase <  7.38) { icon='🌒'; name='Creciente Cóncava'; }
  else if (phase < 11.08) { icon='🌓'; name='Cuarto Creciente'; }
  else if (phase < 14.77) { icon='🌔'; name='Gibosa Creciente'; }
  else if (phase < 16.61) { icon='🌕'; name='Luna Llena'; }
  else if (phase < 22.15) { icon='🌖'; name='Gibosa Menguante'; }
  else if (phase < 25.84) { icon='🌗'; name='Cuarto Menguante'; }
  else                    { icon='🌘'; name='Menguante Cóncava'; }
  const effect = illum > 70 ? { t:'⚠ Muy brillante', c:'#f0a040' }
               : illum > 40 ? { t:'~ Moderada',      c:'#f0c060' }
               :               { t:'✓ Ideal',          c:'#40e0a0' };
  return { icon, name, phase: phase.toFixed(1), illum, effect };
}

// ── NIGHT SLOTS ─────────────────────────────────────────────────────
export function getNightSlots(date, timeArr) {
  const next  = addDays(date, 1);
  const slots = [];
  for (let h = 18; h <= 23; h++) {
    const t = `${date}T${String(h).padStart(2,'0')}:00`;
    const i = timeArr.indexOf(t);
    if (i >= 0) slots.push({ label:`${String(h).padStart(2,'0')}:00`, i });
  }
  for (let h = 0; h <= 5; h++) {
    const t = `${next}T${String(h).padStart(2,'0')}:00`;
    const i = timeArr.indexOf(t);
    if (i >= 0) slots.push({ label:`${String(h).padStart(2,'0')}:00`, i });
  }
  return slots;
}

export function bestWindow(slots, scores) {
  let best = null, run = [], maxLen = 0;
  slots.forEach(({ label, i }) => {
    const s = scores[i] ?? 0;
    if (s >= 55) {
      run.push({ label, s });
      if (run.length > maxLen) { maxLen = run.length; best = [...run]; }
    } else { run = []; }
  });
  return best;
}

// ── VALIDACIÓN DE COORDENADAS ─────────────────────────────────────────
export function validateCoord(v, type) {
  const n = parseFloat(v);
  if (isNaN(n)) return null;
  if (type === 'lat' && (n < -90 || n > 90)) return null;
  if (type === 'lon' && (n < -180 || n > 180)) return null;
  return n;
}