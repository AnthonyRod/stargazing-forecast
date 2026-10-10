// ── ESTADO COMPARTIDO ──────────────────────────────────────────────────
// Único estado mutable compartido entre módulos (coordenadas, mapa, chart).
export const S = {
  lat: null,
  lon: null,
  chart: null,
  geoTimeout: null,
  map: null,
  mapMarker: null,
  userInteracted: false,
  autoDetectCancelled: false,
  locLoadingStart: 0,
};