// ── SCORING ─────────────────────────────────────────────────────────
export function scoreHour(cloud, precip, rh, vis_m, wind) {
  const s_cloud  = Math.max(0, 100 - cloud);
  const s_precip = Math.max(0, 100 - precip * 1.2);
  const s_rh     = rh <= 50 ? 100 : rh >= 90 ? 0 : Math.round((90 - rh) / 40 * 100);
  const s_vis    = Math.min(100, vis_m / 1000 / 30 * 100);
  const s_wind   = wind > 25 ? Math.max(0, 100 - (wind - 25) * 4) : 100;
  let score = Math.round((s_cloud*.45 + s_precip*.20 + s_rh*.20 + s_vis*.15) * s_wind / 100);
  if (rh > 90 && vis_m < 5000) score = Math.round(score * 0.5);
  return score;
}

export function scoreColor(s) { return s >= 70 ? '#40e0a0' : s >= 45 ? '#f0c060' : '#e05060'; }

export function verdict(s)    {
  return s >= 70 ? { text:'Excelente', c:'#40e0a0' }
       : s >= 55 ? { text:'Bueno',     c:'#80d0a0' }
       : s >= 40 ? { text:'Parcial',   c:'#f0c060' }
       :            { text:'Bloqueado', c:'#e05060' };
}