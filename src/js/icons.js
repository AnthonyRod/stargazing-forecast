// Inline SVG icon set (no deps). Stroke = currentColor, decorative by default.
export const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  pin: '<path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
  save: '<path d="M5 4h11l3 3v13H5Z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8Z"/>',
  drop: '<path d="M12 3s6 6.3 6 11a6 6 0 0 1-12 0c0-4.7 6-11 6-11Z"/>',
  thermo: '<path d="M10 4a2 2 0 0 1 4 0v9.3a4 4 0 1 1-4 0Z"/><circle cx="12" cy="17" r="1.5"/>',
  wind: '<path d="M3 8h9a3 3 0 1 0-3-3M3 12h13a3 3 0 1 1-3 3M3 16h7"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/>',
  cloud: '<path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 11a3.5 3.5 0 0 1-.5 7Z"/>',
  part: '<path d="M12 12V5m0 0 1.5-1.5M12 5 10.5 3.5M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 11a3.5 3.5 0 0 1-.5 7Z"/>',
  rain: '<path d="M7 15a4 4 0 0 1-.5-8A6 6 0 0 1 18 8a3.5 3.5 0 0 1-.5 7Z"/><path d="M8 18l-1 2m5-2-1 2m5-2-1 2"/>',
  fog: '<path d="M4 10h16M6 14h12M4 18h16"/>',
  storm: '<path d="M7 15a4 4 0 0 1-.5-8A6 6 0 0 1 18 8a3.5 3.5 0 0 1-.5 7Z"/><path d="m12 13-2 4h3l-1 4 4-6h-3Z"/>',
  snow: '<path d="M7 15a4 4 0 0 1-.5-8A6 6 0 0 1 18 8a3.5 3.5 0 0 1-.5 7Z"/><path d="M12 16v5m-2-1.5L12 21l2-1.5"/>',
};

export function icon(name, size = 16) {
  const inner = ICONS[name] || ICONS.cloud;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inner}</svg>`;
}

// WMO code -> icon name (day/night only affects clear + partly)
export function wmoIconName(code, hour) {
  const night = hour != null && (hour < 6 || hour >= 18);
  if (code === 0) return night ? 'moon' : 'sun';
  if (code === 1 || code === 2) return 'part';
  if (code === 3) return 'cloud';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'cloud';
}

export function skyIconName(cloud, hour) {
  const night = hour < 6 || hour >= 18;
  if (cloud < 20) return night ? 'moon' : 'sun';
  if (cloud < 60) return 'part';
  return 'cloud';
}
