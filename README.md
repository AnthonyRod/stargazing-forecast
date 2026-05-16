# ✦ Stargazing Forecast

Web app auto-contenida, sin dependencias de build, cero frameworks — un solo archivo HTML. Para consultar el pronóstico astronómico a 14 días. Evalúa la calidad del cielo para observación nocturna combinando datos meteorológicos en un score 0–100.

## Tabla de contenidos

- [Cómo funciona](#cómo-funciona)
- [Score de observación](#score-de-observación)
- [Cómo se usa](#cómo-se-usa)
  - [Seleccionar ubicación](#seleccionar-ubicación)
  - [Dashboard](#dashboard)
  - [Filtros](#filtros)
  - [Tema oscuro / claro](#tema-oscuro--claro)
- [Arquitectura técnica](#arquitectura-técnica)
  - [APIs usadas](#apis-usadas)
  - [Cadena de fallback de modelos](#cadena-de-fallback-de-modelos)
  - [Geolocalización](#geolocalización)
- [Deploy](#deploy)
  - [Railway](#railway)
  - [Local](#local)
- [Stack](#stack)

## Cómo funciona

Cada hora nocturna (18:00–05:59) se calcula un score basado en cuatro variables meteorológicas. El resultado se muestra en tarjetas por noche y en un gráfico de barras de 14 días.

## Score de observación

| Variable              | Peso  | Fuente                          |
| --------------------- | ----- | ------------------------------- |
| Nubosidad             | 45 %  | `cloud_cover`                   |
| Probabilidad de lluvia| 20 %  | `precipitation_probability`     |
| Humedad relativa      | 20 %  | `relative_humidity_2m`          |
| Visibilidad           | 15 %  | `visibility`                    |

Penalización: si el viento supera 20 km/h se descuenta del total. Si la humedad supera 90 % y la visibilidad es menor a 5 km, se aplica una penalización adicional por niebla (score se reduce 50 %).

### Rangos

| Score      | Etiqueta    | Color  |
| ---------- | ----------- | ------ |
| ≥ 70       | Excelente   | Verde  |
| 55–69      | Bueno       | Verde claro |
| 40–54      | Parcial     | Ámbar  |
| < 40       | Bloqueado   | Rojo   |

### Ventana óptima

Se detecta automáticamente la mejor ventana dentro de cada noche buscando el tramo continuo más largo con score ≥ 55.

## Cómo se usa

### Seleccionar ubicación

Tres formas de elegir coordenadas:

1. **Mapa** — hacé clic en el mapa para colocar un marcador. Se puede arrastrar para ajustar.
2. **Buscar ciudad** — autocompletado contra Open-Meteo Geocoding API (mínimo 2 caracteres).
3. **Coordenadas manuales** — ingresá latitud / longitud directamente.
4. **GPS / IP** — botón "Detectar ubicación por IP" usa geolocalización del navegador, con fallback a IP.

Al elegir una ubicación, se hace reverse geocoding (Nominatim) para mostrar la dirección en el campo de búsqueda.

### Dashboard

- **Tarjetas por noche**: score promedio, pico (mejor hora), fase lunar, métricas (nubes, humedad, visibilidad, viento), timeline horario, ventana óptima.
- **Gráfico general**: barras de score hora por hora en 14 noches, con divisores de medianoche.
- **Refrescar datos**: botón ↻ en el header.
- **Cambiar ubicación**: botón ← para volver al selector.

### Filtros

Filtro "Todas / Solo excelentes" sobre las tarjetas de noche. Muestra el conteo de noches visibles.

### Tema oscuro / claro

Botón ☀/☾ en el header. La preferencia se persiste en `localStorage`.

## Arquitectura técnica

### APIs usadas

| API                                    | Uso                          |
| -------------------------------------- | ---------------------------- |
| [Open-Meteo](https://open-meteo.com)   | Datos meteorológicos y geocoding |
| [Nominatim](https://nominatim.org)     | Reverse geocoding (OSM)      |
| [ipinfo.io](https://ipinfo.io)         | Geolocalización por IP       |
| [OpenStreetMap](https://www.openstreetmap.org) | Tiles del mapa (Leaflet) |

### Cadena de fallback de modelos

Open-Meteo ofrece distintos modelos. La app intenta en orden:

1. `best_match` — modelo óptimo automático
2. `gfs_seamless` — GFS con interpolación horaria
3. `gfs_global` — GFS cada 3 h

Cada modelo se valida con `missingFields()`: si algún campo requerido (`cloud_cover`, `precipitation_probability`, `relative_humidity_2m`, `visibility`, `wind_speed_10m`) viene `null`, se prueba el siguiente.

### Geolocalización

1. `navigator.geolocation.getCurrentPosition` (precisión baja, `enableHighAccuracy: false`)
2. Si falla (común en macOS sin GPS), fallback por IP via `ipinfo.io`
3. Si todo falla, se muestra error y se invita a búsqueda manual

### Formato de datos

El HTML renderizado es una single-page application (SPA) en un solo archivo. Los datos meteorológicos viajan como JSON desde Open-Meteo y se procesan completamente en el cliente.

## Deploy

### Railway

Crear un `package.json` en la raíz:

```json
{
  "name": "stargazing-forecast",
  "scripts": {
    "start": "npx serve . -s -l $PORT"
  }
}
```

Conectar repo de GitHub a Railway. Se autodetecta como Node.js y corre `npm start`. No necesita configuración adicional.

### Local

```bash
# Servir con Python
python3 -m http.server 8080

# O con Node
npx serve . -s

# O con PHP
php -S localhost:8080
```

> **Importante**: el archivo debe servirse via HTTP, no `file://`, porque `fetch()` y la geolocalización del navegador no funcionan con protocolo file.

## Stack

- Vanilla JS (sin framework)
- Chart.js 4 para el gráfico de barras
- Leaflet 1.9 + OpenStreetMap para el mapa
- Open-Meteo API (meteorología + geocoding)
- Nominatim API (reverse geocoding)
- Sin dependencias de build — un solo `.html`
