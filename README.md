# ✦ Stargazing Forecast

Pronóstico astronómico para observación de estrellas en Costa Rica (y el mundo). Evaluá la calidad del cielo para cada noche de los próximos 14 días con un score 0–100, combinando datos meteorológicos de **Open-Meteo (modelo ECMWF IFS 9 km)** y **precipitación horaria de meteoblue** (con ajuste de terreno `mLM`), servidos por un servidor Node propio.

La app es una SPA **vanilla JS sin frameworks** organizada en **módulos ES** (`src/`) y empaquetada con **esbuild**, + un backend `server.mjs` que sirve los archivos estáticos y actúa como proxy de la API de meteoblue para no exponer la clave.

## Tabla de contenidos

- [Cómo funciona](#cómo-funciona)
- [Score de observación](#score-de-observación)
  - [Rangos](#rangos)
  - [Ventana óptima](#ventana-óptima)
- [Estructura de la aplicación](#estructura-de-la-aplicación)
- [Flujo de datos](#flujo-de-datos)
- [Arquitectura técnica](#arquitectura-técnica)
  - [APIs usadas](#apis-usadas)
  - [Cadena de fallback](#cadena-de-fallback)
  - [Fusión de precipitación (meteoblue)](#fusión-de-precipitación-meteoblue)
  - [Geolocalización](#geolocalización)
- [Cómo se usa](#cómo-se-usa)
  - [Seleccionar ubicación](#seleccionar-ubicación)
  - [Dashboard](#dashboard)
  - [Filtros](#filtros)
  - [Tema oscuro / claro](#tema-oscuro--claro)
- [Pruebas](#pruebas)
- [Deploy](#deploy)
  - [Railway](#railway)
  - [Local](#local)
- [Stack](#stack)

## Cómo funciona

Cada **hora nocturna (18:00–05:59)** se calcula un score en función de nubosidad, probabilidad de lluvia, humedad relativa y visibilidad. El resultado se muestra en tarjetas por noche (14 noches) y en un gráfico de barras hora por hora.

Las variables meteorológicas de base vienen de **Open-Meteo** (modelo `best_match`, que para Costa Rica resuelve a **ECMWF IFS 9 km**, con fallback a GFS). Sobre esos datos, para los **primeros 7 días** se superpone la **precipitación horaria de meteoblue** (cantidad y probabilidad), cuyo motor `mLM` ajusta la lluvia al terreno usando un DEM de 80 m + correcciones de radar/satélite — más preciso para las tormentas convectivas locales de las montañas costarricenses. Los días 8–14 conservan los datos de Open-Meteo.

El campo de probabilidad de lluvia alimenta directamente el score (peso 20 %), por lo que la fusión mejora la precisión del pronóstico sin cambiar la lógica de evaluación.

El pedido a Open-Meteo incluye `past_days=1`, así que la respuesta trae **ayer** además de los 14 días de pronóstico. La pestaña Clima lo aprovecha (tarjeta "Ayer" y 8 h pasadas antes de la hora actual); la pestaña Astro ignora ese día extra y sigue mostrando hoy..+13.

## Score de observación

| Variable                | Peso  | Fuente en el código                          |
| ----------------------- | ----- | -------------------------------------------- |
| Nubosidad               | 45 %  | `cloud_cover` (Open-Meteo / IFS)             |
| Probabilidad de lluvia  | 20 %  | `precipitation_probability` (meteoblue 0–7 d, luego IFS) |
| Humedad relativa        | 20 %  | `relative_humidity_2m` (Open-Meteo / IFS)    |
| Visibilidad             | 15 %  | `visibility` (Open-Meteo / IFS)              |

Penalización: si el viento supera 25 km/h se descuenta del total. Si la humedad supera 90 % y la visibilidad es menor a 5 km, se aplica una penalización adicional por niebla (el score se reduce 50 %).

### Rangos

| Score      | Etiqueta    | Color      |
| ---------- | ----------- | ---------- |
| ≥ 70       | Excelente   | Verde      |
| 55–69      | Bueno       | Verde claro|
| 40–54      | Parcial     | Ámbar      |
| < 40       | Bloqueado   | Rojo       |

### Ventana óptima

Se detecta automáticamente dentro de cada noche el tramo continuo más largo con score ≥ 55 y se marca con ★.

## Estructura de la aplicación

| Archivo               | Rol                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------- |
| `src/index.html`      | Markup de la SPA + enlaces a estilos/advertencias externas (Leaflet, Chart.js, fuentes). |
| `src/styles.css`      | Estilos CSS (sin preprocesador).                                                      |
| `src/js/main.js`      | **Entrada**: tab switching, `startForecast`, `refreshForecast`, tema, eventos e init. |
| `src/js/api.js`       | Open-Meteo (`fetchForecast`) + fusión de precip. (`applyMeteobluePrecip`).            |
| `src/js/scoring.js`   | `scoreHour`, `scoreColor`, `verdict` (funciones puras y testeables).                  |
| `src/js/utils.js`     | Fechas, fase lunar, night slots, ventana óptima, `validateCoord` (funciones puras). |
| `src/js/forecast.js`  | `renderForecast()`: tarjetas por noche, gráfico, filtros y explainer.                 |
| `src/js/weather.js`   | Pestaña Clima: códigos WMO, condiciones actuales, 8 h pasadas + 24 h (con autoscroll a AHORA) y diario Ayer + 14 días. |
| `src/js/location.js`  | Selector: mapa (Leaflet), búsqueda, geocoding, autodetección GPS/IP, guardados.       |
| `src/js/state.js`     | Estado mutable compartido (`S`: coordenadas, mapa, chart).                            |
| `test/`               | Unit tests con `node:test` (lógica pura y de datos; sin dependencias extra).          |
| `dist/` (gitignored)  | Build minificado generado por `npm run build`. **No se edita a mano.**                |
| `server.mjs`          | Servidor Node (sin dependencias de runtime): sirve `dist/` y proxy `/api/meteoblue`.  |
| `package.json`        | Scripts: `build` (esbuild + html-minifier-terser), `dev` (esbuild --watch), `test`, `start`. |
| `.meteoblue_api_key`  | Clave de meteoblue para desarrollo local (gitignored; en producción se usa la env var). |
| `README.md`           | Esta documentación.                                                                   |

## Flujo de datos

```
Navegador (SPA)
  │
  ├─► api.open-meteo.com/v1/forecast   (directo, sin clave)
  │      models=best_match → ECMWF IFS 9km (CR) → GFS fallback
  │      14 días horarios: cloud, RH, visibilidad, viento, temperatura, lluvia…
  │
  └─► /api/meteoblue  (proxy propio, la clave NO sale del servidor)
         my.meteoblue.com/packages/basic-1h  (7 días horarios)
         → precipitation + precipitation_probability
         → cache 10 min, fusión por marca de tiempo exacta (zona horaria local)
         ↓
  server.mjs fusiona → {hourly, daily} devuelto a la UI
       ├─ applyMeteobluePrecip() sobrescribe lluvia y prob. de lluvia (días 0–6)
       ├─ se recalculan precipitation_sum diarios desde las horas fusionadas
       └─ si no hay clave o falla → se conservan los datos de Open-Meteo
  → renderForecast() + renderWeather() → score, tarjetas, gráfico, pestañas
```

- **Alineación temporal**: el cliente le pasa a meteoblue la misma zona horaria que devuelve Open-Meteo (`timezone auto`, p. ej. `America/Costa_Rica`), por lo que ambas series horarias comparten etiquetas locales idénticas (`2026-10-09T18:00`). No hay desplazamientos UTC que corregir.
- **Fusión por marca de tiempo**: se construye un mapa `hora → {precipitación, probabilidad}` y se aplica donde la hora coincida exactamente (primeros 7 días, 168 horas).
- **Fallback silencioso**: si el proxy devuelve `{available:false}` (sin clave, red caída, error) o falla el `fetch`, la app continúa con los datos de Open-Meteo sin romperse. El estado de la fusión se refleja en el footer: con clave OK muestra `IFS + meteoblue (lluvia)`; si está inactiva muestra `· sin meteoblue (motivo)`. Cuando la corrección de lluvia 8–14d está activa, el footer añade `· corr. lluvia 8–14d`.

## Arquitectura técnica

### APIs usadas

| API                                      | Uso                                                            |
| ---------------------------------------- | -------------------------------------------------------------- |
| [Open-Meteo](https://open-meteo.com)     | Datos meteorológicos (14 días, horarios) + geocoding. Sin clave |
| [meteoblue](https://business.meteoblue.com) | Precipitación horaria (7 días) vía proxy `/api/meteoblue`. Con clave |
| [Nominatim](https://nominatim.org)       | Reverse geocoding (OSM)                                        |
| [ipinfo.io](https://ipinfo.io)           | Geolocalización por IP (fallback)                              |
| [OpenStreetMap](https://www.openstreetmap.org) | Tiles del mapa (Leaflet)                                  |

### Cadena de fallback

Existen **dos capas independientes** de fallback:

1. **Modelos de Open-Meteo** (por si un modelo no entrega algún campo requerido o falla):
   1. `best_match` — modelo óptimo automático (en Costa Rica: ECMWF IFS 9 km)
   2. `gfs_seamless` — GFS con interpolación horaria
   3. `gfs_global` — GFS cada 3 h

   Cada modelo se valida con `missingFields()`: si algún campo requerido (`cloud_cover`, `precipitation_probability`, `relative_humidity_2m`, `visibility`, `wind_speed_10m`, `wind_direction_10m`, `dew_point_2m`) viene `null`, se prueba el siguiente.

2. **Capas de datos enriquecidas**: la fusión de meteoblue es *aditiva*. Si no está disponible, la app funciona igual con Open-Meteo (solo pierde la mejora de precisión de lluvia en los primeros 7 días). La clave de meteoblue se lee del entorno (`METEOBLUE_API_KEY`) o del archivo `.meteoblue_api_key` (solo local); sin ella el proxy responde `{available:false}`.

### Fusión de precipitación (meteoblue)

- Por qué: en Costa Rica la lluvia es mayormente **convectiva** (tormentas locales de montaña). Los modelos globales (IFS 9 km o GFS 25 km) la ubican mal en tiempo/espacio. En un estudio global (WMO), la precipitación a 24 h de meteoblue obtuvo HSS 0.49–0.51 frente a 0.44–0.47 del resto, gracias al ajuste de terreno `mLM` (+DEM 80 m) y correcciones de radar/satélite.
- Qué se reemplaza: solo `precipitation` (mm) y `precipitation_probability` (%) para horas ≤ 7 días. Nubosidad, humedad, viento y visibilidad siguen viniendo de IFS para no perder resolución horaria.
- Dónde: `applyMeteobluePrecip()` en `src/js/api.js`, invocado desde `fetchForecast()` tras obtener los datos de Open-Meteo.

### Corrección estimada de lluvia (días 8–14)

meteoblue solo entrega lluvia horaria hasta 7 días [5], así que los días 8–14 no tienen referencia directa. En su lugar se aplica una **corrección de sesgo**: las ~168 horas de solape (días 0–6, con dato de ambas fuentes) sirven de muestra pareada para medir cómo se desvía Open-Meteo de meteoblue en *ese lugar y ese régimen*, y esa desviación se aplica a los días 8–14.

- **Probabilidad → desplazamiento aditivo**: `pp_corr = clamp(pp_OM + bias, 0, 100)`, con `bias = media(mb − om)` sobre el solape (mínimo 100 horas coincidentes). Las variables acotadas se corrigen por desplazamiento, igual que la temperatura en las guías estándar [2].
- **Cantidad (mm) → LOCI simplificado** [1]: (1) se iguala la frecuencia de horas húmedas (> 0,1 mm) con un umbral `T_om` sobre Open-Meteo; (2) solo los valores sobre el umbral se escalan por `factor = media(mb|húmedo) / media(om|>T_om)`. Así se corrige el "drizzle" típico de los modelos (llueve demasiado seguido y demasiado liviano) sin inventar eventos.
- **Topes conservadores**: `factor ∈ [0,25, 4]` y se exige ≥ 12 horas húmedas por lado; por debajo, la cantidad queda sin corregir. Topar el factor es práctica estándar (ISI-MIP topa su μ en 10 con 40 años de muestra [3]); el nuestro es mucho más estrecho porque la muestra es de ~168 horas. Si meteoblue estuvo seco toda la semana, solo se anulan lloviznas traza (≤ 0,2 mm), nunca se borra todo.
- **Etiqueta**: cuando la corrección está activa el footer añade `· corr. lluvia 8–14d`. Sin solape suficiente o sin meteoblue, los días 8–14 quedan con Open-Meteo puro y sin etiqueta.
- **Límite honesto**: el sesgo aprendido describe el régimen actual; la deriva del modelo crece con el plazo, así que esto es "menos equivocado", no "correcto". Ver `calibrateRain()` en `src/js/api.js` (función pura, con tests).

**Referencias rápidas**

1. Método LOCI (Schmidli et al. 2006; revisado en Teutschbein & Seibert 2012) — igualación de frecuencia por umbral + escalado de intensidad solo en horas húmedas: <https://hess.copernicus.org/preprints/11/12659/2014/hessd-11-12659-2014.pdf> (§3.2.2) y <https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2021EA001981>
2. Met Office UKCP18, *How to Bias Correct* (Fung 2018) — ajuste aditivo para variables tipo temperatura, relativo (multiplicativo) para precipitación: <https://www.metoffice.gov.uk/binaries/content/assets/metofficegovuk/pdf/research/ukcp/ukcp18-guidance---how-to-bias-correct.pdf>
3. ISI-MIP, *Fact Sheet: Bias Correction* (Hempel et al.) — precipitación con corrección multiplicativa y factor μ topado en 10: <https://www.isimip.org/documents/16/Fact_Sheet_Bias_Correction.pdf>
4. Lange (2019), ISIMIP3BASD — la precipitación se ajusta multiplicativamente: <https://gmd.copernicus.org/articles/12/3055/2019>
5. meteoblue, Forecast API Configurator — la API de pronóstico entrega hasta 7 días (motivo por el que 8–14 se estima): <https://docs.meteoblue.com/en/weather-apis/forecast-api/forecast-api-configurator>

### Geolocalización

1. `navigator.geolocation.getCurrentPosition` (precisión baja, `enableHighAccuracy: false`)
2. Si falla (común en macOS sin GPS), fallback por IP vía `ipinfo.io`
3. Si todo falla, se muestra error y se invita a búsqueda manual

## Cómo se usa

### Seleccionar ubicación

1. **Mapa** — clic para colocar el marcador (se puede arrastrar).
2. **Buscar ciudad** — autocompletado contra Open-Meteo Geocoding (mínimo 2 caracteres).
3. **Coordenadas manuales** — latitud/longitud directas.
4. **GPS / IP** — botón "Detectar ubicación por IP".

Al elegir una ubicación se hace reverse geocoding (Nominatim) para mostrar la dirección.

### Dashboard

- **Tarjetas por noche**: score promedio, pico (mejor hora), fase lunar, métricas (nubes, humedad, visibilidad, viento), timeline horario y ventana óptima.
- **Gráfico general**: barras de score hora por hora de las 14 noches, con divisores de medianoche.
- **Refrescar datos**: botón ↻ en el header.
- **Cambiar ubicación**: botón ← para volver al selector.
- **Pestañas**: "Astro" y "Tiempo" (condiciones actuales, hora por hora: 8 h pasadas + 24 h próximas con la hora actual destacada y autoscroll a AHORA, y diario Ayer + 14 días).
- **Fuente de datos**: el footer indica el modelo y si la fusión meteoblue está activa (`IFS + meteoblue (lluvia)`) o en fallback (`· sin meteoblue (motivo)`), y añade `· corr. lluvia 8–14d` cuando la corrección estimada de los días 8–14 está activa.

### Filtros

Filtro "Todas / Solo excelentes" sobre las tarjetas de noche. Muestra el conteo de noches visibles.

### Tema oscuro / claro

Botón ☀/☾ en el header. La preferencia se persiste en `localStorage`.

## Pruebas

```bash
npm test
```

Corren con el runner nativo `node:test` (Node ≥ 18, sin dependencias extra) y cubren la **lógica pura y de datos** de la app:

- `test/scoring.test.js` — `scoreHour`, `scoreColor`, `verdict` (pesos, penalizaciones de viento/niebla).
- `test/utils.test.js` — fechas, fases lunares, night slots, ventana óptima, `validateCoord`.
- `test/weather.test.js` — códigos WMO, iconos día/noche, textos de cielo, etiquetas Ayer/Hoy/Mañana.
- `test/api.test.js` — `buildApiUrl`, `missingFields`, cadena de fallback de modelos, y **fusión de meteoblue** (`applyMeteobluePrecip`) con `fetch` simulado.

> Las vistas de DOM (`renderForecast`, `renderWeather`, mapa, pestañas) no se testean aquí: se verifican con el flujo real del navegador (smoke test en Chrome headless).

## Deploy

### Railway

El servidor está en `server.mjs`. En el panel de Railway:

1. Conectá el repo de GitHub (se autodetecta como Node.js y corre `npm start`).
2. Agregá la **environment variable** `METEOBLUE_API_KEY` con tu clave de meteoblue.
3. Listo. Sin clave, la app igual funciona (modo fallback, sin fusión de lluvia).

El `package.json` ya trae `"start": "node server.mjs"`.

#### La clave no aparece (`NO configurada` en los logs)

1. El nombre debe ser exacto: `METEOBLUE_API_KEY` (mayúsculas, sin espacios).
2. Seteala en el **servicio correcto**: Service → Variables (o a nivel proyecto) — no en otro servicio.
3. Guardá y **redeployá**: el arranque debe imprimir `METEOBLUE_API_KEY: configurada (env METEOBLUE_API_KEY)`. Mirá el log de la **última** instancia, no de un deploy viejo.
4. El archivo `.meteoblue_api_key` es solo para desarrollo **local** (está gitignored y no viaja a Railway): en el deploy solo se lee la variable de entorno.
5. Si la variable está pero la clave es inválida/vencida, el log avisa `clave meteoblue rechazada (HTTP 401/403)` y el footer de la app muestra `· sin meteoblue (clave rechazada)`.

### Local

```bash
# Instalar dependencias de build (una vez)
npm install

# Copiá tu clave de meteoblue (opcional; si no, la app funciona en modo fallback)
echo "TU_CLAVE" > .meteoblue_api_key

# Generar el build en dist/ (tras editar cualquier archivo de src/)
npm run build

# Servir app + proxy meteoblue
npm start
# → http://localhost:3000

# Modo desarrollo: esbuild recompila dist/app.js al guardar src/js/
npm run dev
```

> El servidor sirve `dist/`: tras editar `src/` hay que regenerarlo con `npm run build` (o `npm run dev` mientras trabajás en JS).

> **Importante**: la app debe servirse via HTTP con `npm start`, no con `file://` ni con un servidor estático simple, porque el proxy `/api/meteoblue` es necesario para la fusión de precipitación (y `fetch()`/geolocalización del navegador no funcionan con `file://`).

## Stack

- Vanilla JS (sin framework), **módulos ES** en `src/`
- Chart.js 4 (gráfico de barras)
- Leaflet 1.9 + OpenStreetMap (mapa)
- Node.js ≥ 18 (servidor propio, sin dependencias de runtime)
- Open-Meteo API (meteorología + geocoding + IFS/GFS)
- meteoblue Forecast API (`basic-1h`) vía proxy
- Nominatim API (reverse geocoding)
- Build: `esbuild` (bundle + minify de JS y CSS) + `html-minifier-terser` (HTML)
- Tests: `node:test` (runner nativo, sin dependencias extra)