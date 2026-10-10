import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REQUIRED_FIELDS, WEATHER_FIELDS, FALLBACK_MODELS,
  buildApiUrl, missingFields, fetchForecast, applyMeteobluePrecip,
} from '../src/js/api.js';

// ── helpers ───────────────────────────────────────────────────────────
const dayStrFrom = (base, offset) => {
  const d = new Date(base + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const dayStr = offset => dayStrFrom('2026-10-09', offset);

const jsonResponse = (body, { ok = true, status = 200 } = {}) => ({
  ok, status,
  json: async () => body,
});

function makeForecastFixture({ hours = 48, start = '2026-10-09T00:00:00Z' } = {}) {
  const time = [];
  let d = new Date(start);
  for (let i = 0; i < hours; i++) {
    time.push(d.toISOString().slice(0, 16));
    d = new Date(d.getTime() + 3600e3);
  }
  const fill = v => Array.from({ length: hours }, () => v);
  const days = Math.max(Math.ceil(hours / 24), 1);
  const startDay = time[0].slice(0, 10);
  return {
    timezone: 'America/Costa_Rica',
    utc_offset_seconds: -21600,
    elevation: 1840,
    hourly: {
      time,
      precipitation_probability: fill(20),
      cloud_cover: fill(10),
      visibility: fill(25000),
      wind_speed_10m: fill(5),
      wind_direction_10m: fill(90),
      relative_humidity_2m: fill(60),
      dew_point_2m: fill(15),
      temperature_2m: fill(24),
      apparent_temperature: fill(25),
      precipitation: fill(0),
      weather_code: fill(1),
    },
    daily: {
      time: Array.from({ length: days }, (_, i) => dayStrFrom(startDay, i)),
      temperature_2m_max: Array(days).fill(28),
      temperature_2m_min: Array(days).fill(20),
      precipitation_sum: Array(days).fill(99),
      weather_code: Array(days).fill(1),
      wind_speed_10m_max: Array(days).fill(15),
      uv_index_max: Array(days).fill(10),
    },
  };
}

const mbTimes = data => data.hourly.time.map(s => s.replace('T', ' '));

function mockFetch(t, handler) {
  t.mock.method(globalThis, 'fetch', async (url, opts) => handler(String(url), opts));
}

// ── buildApiUrl / missingFields ───────────────────────────────────────
test('buildApiUrl: incluye parámetros, modelos y campos', () => {
  const url = buildApiUrl(9.75, -83.99, 'best_match');
  for (const p of ['latitude=9.75', 'longitude=-83.99', 'models=best_match', 'forecast_days=14', 'past_days=1', 'timezone=auto', '&hourly=', '&daily=']) {
    assert.ok(url.includes(p), `falta ${p}`);
  }
  for (const f of [...REQUIRED_FIELDS, ...WEATHER_FIELDS]) {
    assert.ok(url.includes(f), `falta el campo ${f}`);
  }
  assert.ok(buildApiUrl(1, 2, 'gfs_global').includes('models=gfs_global'));
});

test('missingFields: todos los campos requeridos presentes', () => {
  const h = {};
  for (const f of REQUIRED_FIELDS) h[f] = [1, 2, 3];
  assert.deepEqual(missingFields(h), []);
});

test('missingFields: detecta campos ausentes o totalmente nulos', () => {
  const h = {};
  for (const f of REQUIRED_FIELDS) h[f] = [1, null, 3];
  delete h.dew_point_2m;
  assert.deepEqual(missingFields(h), ['dew_point_2m']);

  h.dew_point_2m = [null, null, null];
  assert.deepEqual(missingFields(h), ['dew_point_2m']);

  h.dew_point_2m = [null, 1, null]; // un valor no nulo basta
  assert.deepEqual(missingFields(h), []);

  h.visibility = []; // vacío => considerado faltante
  assert.deepEqual(missingFields(h), ['visibility']);
});

// ── applyMeteobluePrecip ──────────────────────────────────────────────
test('applyMeteobluePrecip: aplica lluvia y probabilidad donde coinciden las horas', async t => {
  const data = makeForecastFixture({ hours: 24 });
  data.hourly.precipitation = Array.from({ length: 24 }, (_, i) => i);
  data.hourly.precipitation_probability = Array(24).fill(5);

  mockFetch(t, url => url.startsWith('/api/meteoblue')
    ? jsonResponse({
        available: true,
        times: mbTimes(data).slice(0, 6),
        precipitation: [1.5, 2.5, 3.5, 4.5, 5.5, 6.5],
        precipitation_probability: [91, 92, 93, 94, 95, 96],
      })
    : jsonResponse({}));

  await applyMeteobluePrecip(9.75, -83.99, data);

  assert.deepEqual(data.hourly.precipitation.slice(0, 6), [1.5, 2.5, 3.5, 4.5, 5.5, 6.5]);
  assert.deepEqual(data.hourly.precipitation_probability.slice(0, 6), [91, 92, 93, 94, 95, 96]);
  assert.equal(data.hourly.precipitation[6], 6);               // sin coincidencia => intacto
  assert.equal(data.hourly.precipitation_probability[6], 5);
  assert.equal(data._model, 'IFS + meteoblue (lluvia)');
});

test('applyMeteobluePrecip: recalcula precipitation_sum de días con >=20 h', async t => {
  const data = makeForecastFixture({ hours: 48 });
  data.daily.time = Array.from({ length: 7 }, (_, i) => dayStr(i));
  data.daily.precipitation_sum = Array(7).fill(99);
  data.hourly.precipitation = Array(48).fill(0);

  mockFetch(t, () => jsonResponse({
    available: true,
    times: mbTimes(data),
    precipitation: Array(48).fill(1),
    precipitation_probability: Array(48).fill(80),
  }));

  await applyMeteobluePrecip(9.75, -83.99, data);

  assert.equal(data.daily.precipitation_sum[0], 24); // 24 × 1 mm
  assert.equal(data.daily.precipitation_sum[1], 24);
  assert.equal(data.daily.precipitation_sum[2], 99); // sin horas => intacto
  assert.equal(data.daily.precipitation_sum[6], 99);
});

test('applyMeteobluePrecip: con día pasado, ayer queda intacto y hoy se fusiona', async t => {
  const data = makeForecastFixture({ hours: 72, start: '2026-10-08T00:00:00Z' });
  data.daily.time = Array.from({ length: 7 }, (_, i) => dayStrFrom('2026-10-08', i));
  data.daily.precipitation_sum = Array(7).fill(99);
  data.hourly.precipitation = Array(72).fill(0);

  // meteoblue solo cubre desde hoy (índices 24–71)
  mockFetch(t, () => jsonResponse({
    available: true,
    times: data.hourly.time.slice(24).map(s => s.replace('T', ' ')),
    precipitation: Array(48).fill(2),
    precipitation_probability: Array(48).fill(70),
  }));

  await applyMeteobluePrecip(9.75, -83.99, data);

  assert.equal(data.hourly.precipitation[0], 0);    // ayer: sin overlay
  assert.equal(data.hourly.precipitation[23], 0);
  assert.equal(data.hourly.precipitation[24], 2);   // hoy 00:00: fusionado
  assert.equal(data.hourly.precipitation_probability[0], 20); // prob. base intacta
  // totales alineados por daily.time: [0]=ayer (solo Open-Meteo), [1]=hoy
  assert.equal(data.daily.precipitation_sum[0], 0);
  assert.equal(data.daily.precipitation_sum[1], 48);
  assert.equal(data.daily.precipitation_sum[3], 99); // sin horas => intacto
  assert.equal(data._model, 'IFS + meteoblue (lluvia)');
});

test('applyMeteobluePrecip: no recalcula días con menos de 20 horas', async t => {
  const data = makeForecastFixture({ hours: 10 });

  mockFetch(t, () => jsonResponse({
    available: true,
    times: mbTimes(data),
    precipitation: Array(10).fill(3),
    precipitation_probability: Array(10).fill(90),
  }));

  await applyMeteobluePrecip(9.75, -83.99, data);

  assert.equal(data._model, 'IFS + meteoblue (lluvia)');
  assert.equal(data.daily.precipitation_sum[0], 99); // 10 < 20 => no se toca
});

test('applyMeteobluePrecip: valores null de meteoblue no sobrescriben', async t => {
  const data = makeForecastFixture({ hours: 24 });
  data.hourly.precipitation = Array(24).fill(7);

  mockFetch(t, () => jsonResponse({
    available: true,
    times: mbTimes(data).slice(0, 3),
    precipitation: [9, null, 9],
    precipitation_probability: [null, 1, null],
  }));

  await applyMeteobluePrecip(9.75, -83.99, data);

  assert.equal(data.hourly.precipitation[0], 9);
  assert.equal(data.hourly.precipitation[1], 7);            // null => intacto
  assert.equal(data.hourly.precipitation[2], 9);
  assert.equal(data.hourly.precipitation_probability[0], 20); // null => intacto (base)
  assert.equal(data.hourly.precipitation_probability[1], 1);
});

test('applyMeteobluePrecip: available=false => sin cambios', async t => {
  const data = makeForecastFixture({ hours: 24 });
  data.hourly.precipitation = Array(24).fill(7);

  mockFetch(t, () => jsonResponse({ available: false, reason: 'no_key' }));

  await applyMeteobluePrecip(9.75, -83.99, data);

  assert.equal(data._model, undefined);
  assert.equal(data.hourly.precipitation[0], 7);
  assert.equal(data.daily.precipitation_sum[0], 99);
});

test('applyMeteobluePrecip: sin horas coincidentes => sin overlay ni recálculo', async t => {
  const data = makeForecastFixture({ hours: 24 });

  mockFetch(t, () => jsonResponse({
    available: true,
    times: ['2027-01-01 00:00'],
    precipitation: [5],
    precipitation_probability: [50],
  }));

  await applyMeteobluePrecip(9.75, -83.99, data);

  assert.equal(data._model, undefined);
  assert.equal(data.hourly.precipitation[0], 0);
  assert.equal(data.daily.precipitation_sum[0], 99);
});

test('applyMeteobluePrecip: respuesta no-OK del proxy => rechaza', async t => {
  mockFetch(t, () => ({ ok: false, status: 500, json: async () => ({}) }));
  await assert.rejects(
    () => applyMeteobluePrecip(9.75, -83.99, makeForecastFixture()),
    /proxy HTTP 500/
  );
});

test('applyMeteobluePrecip: envía lat, lon y zona horaria al proxy', async t => {
  let captured = '';
  mockFetch(t, url => { captured = String(url); return jsonResponse({ available: false }); });

  await applyMeteobluePrecip(9.75, -83.99, makeForecastFixture());
  assert.ok(captured.startsWith('/api/meteoblue?lat='));
  assert.ok(captured.includes('lat=9.75'));
  assert.ok(captured.includes('lon=-83.99'));
  assert.ok(captured.includes('tz=America%2FCosta_Rica'));
});

test('applyMeteobluePrecip: fetch que lanza => rechaza', async t => {
  mockFetch(t, () => { throw new Error('network down'); });
  await assert.rejects(() => applyMeteobluePrecip(9.75, -83.99, makeForecastFixture()), /network down/);
});

// ── fetchForecast: cadena de fallback ────────────────────────────────
test('fetchForecast: el primer modelo válido gana (sin meteoblue)', async t => {
  const omCalls = [];
  mockFetch(t, url => {
    const u = String(url);
    omCalls.push(u);
    return u.includes('api.open-meteo.com')
      ? jsonResponse(makeForecastFixture())
      : jsonResponse({ available: false });
  });

  const data = await fetchForecast(9.75, -83.99);
  assert.equal(data._model, 'Mejor disponible');
  assert.equal(omCalls.filter(u => u.includes('api.open-meteo.com')).length, 1);
});

test('fetchForecast: cae al siguiente modelo si falta un campo requerido', async t => {
  let omCalls = 0;
  mockFetch(t, url => {
    const u = String(url);
    if (u.includes('api.open-meteo.com')) {
      omCalls++;
      if (omCalls === 1) {
        const d = makeForecastFixture();
        d.hourly.dew_point_2m = Array(d.hourly.time.length).fill(null);
        return jsonResponse(d);
      }
      return jsonResponse(makeForecastFixture());
    }
    return jsonResponse({ available: false });
  });

  const data = await fetchForecast(9.75, -83.99);
  assert.equal(data._model, 'GFS (global)'); // segundo de la cadena
  assert.equal(omCalls, 2);
});

test('fetchForecast: error de la API salta al siguiente modelo', async t => {
  let omCalls = 0;
  mockFetch(t, url => {
    const u = String(url);
    if (u.includes('api.open-meteo.com')) {
      omCalls++;
      return omCalls === 1 ? jsonResponse({ error: true, reason: 'overloaded' }) : jsonResponse(makeForecastFixture());
    }
    return jsonResponse({ available: false });
  });

  const data = await fetchForecast(9.75, -83.99);
  assert.equal(data._model, 'GFS (global)');
  assert.equal(omCalls, 2);
});

test('fetchForecast: HTTP 5xx sigue con el siguiente modelo', async t => {
  let omCalls = 0;
  mockFetch(t, url => {
    const u = String(url);
    if (u.includes('api.open-meteo.com')) {
      omCalls++;
      return omCalls === 1
        ? { ok: false, status: 503, statusText: 'Service Unavailable', json: async () => ({}) }
        : jsonResponse(makeForecastFixture());
    }
    return jsonResponse({ available: false });
  });

  const data = await fetchForecast(9.75, -83.99);
  assert.equal(data._model, 'GFS (global)');
});

test('fetchForecast: todos los modelos fallan => rechaza', async t => {
  let omCalls = 0;
  mockFetch(t, url => {
    const u = String(url);
    if (u.includes('api.open-meteo.com')) {
      omCalls++;
      return { ok: false, status: 503, statusText: 'Down', json: async () => ({}) };
    }
    return jsonResponse({ available: false });
  });

  await assert.rejects(() => fetchForecast(9.75, -83.99), /HTTP 503/);
  assert.equal(omCalls, FALLBACK_MODELS.length);
});

test('fetchForecast: aplica la fusión meteoblue al flujo completo', async t => {
  const data = makeForecastFixture({ hours: 24 });
  data.hourly.precipitation = Array(24).fill(0);

  mockFetch(t, url => {
    const u = String(url);
    if (u.includes('api.open-meteo.com')) return jsonResponse(data);
    return jsonResponse({
      available: true,
      times: mbTimes(data),
      precipitation: Array(24).fill(2),
      precipitation_probability: Array(24).fill(88),
    });
  });

  const out = await fetchForecast(9.75, -83.99);
  assert.equal(out._model, 'IFS + meteoblue (lluvia)');
  assert.equal(out.hourly.precipitation[0], 2);
  assert.equal(out.hourly.precipitation_probability[0], 88);
});

test('fetchForecast: si meteoblue falla, igual devuelve el pronóstico Open-Meteo', async t => {
  const data = makeForecastFixture({ hours: 24 });
  const urls = [];
  mockFetch(t, url => {
    const u = String(url);
    urls.push(u);
    if (u.includes('api.open-meteo.com')) return jsonResponse(data);
    throw new Error('proxy caído');
  });
  t.mock.method(console, 'warn', () => {}); // silencia el warning esperado

  const out = await fetchForecast(9.75, -83.99);
  assert.equal(out._model, 'Mejor disponible'); // sin fusión, pero con datos
  assert.ok(urls.some(u => u.startsWith('/api/meteoblue')));
});