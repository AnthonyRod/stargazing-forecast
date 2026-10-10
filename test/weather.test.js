import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wmoIcon, skyText, skyIcon, dayLabel, hourlyWindowBounds, WMO } from '../src/js/weather.js';
import { wmoIconName, skyIconName } from '../src/js/icons.js';

test('wmoIcon: código desconocido', () => {
  const r = wmoIcon(9999, 12);
  assert.equal(r.t, 'Desconocido');
  assert.match(r.i, /<svg/);
});

test('wmoIcon: día vs noche', () => {
  assert.equal(wmoIcon(0, 12).t, 'Despejado');
  assert.equal(wmoIconName(0, 12), 'sun');
  assert.equal(wmoIconName(0, 22), 'moon');
  assert.equal(wmoIconName(1, 22), 'part');
  assert.equal(wmoIconName(2, 22), 'part');
});

test('wmoIcon: lluvia de noche sigue siendo lluvia', () => {
  assert.equal(wmoIconName(80, 12), 'rain');
  assert.equal(wmoIconName(80, 20), 'rain');
});

test('wmoIcon: sin hora no aplica ajuste nocturno', () => {
  assert.equal(wmoIconName(0), 'sun');
  assert.equal(wmoIconName(0, null), 'sun');
});

test('wmoIcon: bordes del horario nocturno (18:00–05:59)', () => {
  assert.equal(wmoIconName(0, 18), 'moon'); // >= 18 es noche
  assert.equal(wmoIconName(0, 6), 'sun');  // 06:00 es día
  assert.equal(wmoIconName(0, 5), 'moon');
});

test('WMO: tabla coherente (todas las entradas con texto)', () => {
  for (const [code, w] of Object.entries(WMO)) {
    assert.ok(w.t, `código ${code} incompleto`);
  }
});

test('skyText: umbrales 20 / 60', () => {
  assert.equal(skyText(0), 'Despejado');
  assert.equal(skyText(19), 'Despejado');
  assert.equal(skyText(20), 'Parcial nublado');
  assert.equal(skyText(59), 'Parcial nublado');
  assert.equal(skyText(60), 'Nublado');
  assert.equal(skyText(100), 'Nublado');
});

test('skyIcon: variantes día/noche y umbrales', () => {
  assert.equal(skyIconName(10, 12), 'sun');
  assert.equal(skyIconName(10, 22), 'moon');
  assert.equal(skyIconName(40, 12), 'part');
  assert.equal(skyIconName(40, 22), 'part');
  assert.equal(skyIconName(80, 12), 'cloud');
  assert.equal(skyIconName(80, 5), 'cloud'); // nublado ignora día/noche
  assert.match(skyIcon(10, 12), /<svg/);
});

test('dayLabel: Ayer / Hoy / Mañana relativos a la fecha', () => {
  assert.equal(dayLabel('2026-10-08', '2026-10-09'), 'Ayer');
  assert.equal(dayLabel('2026-10-09', '2026-10-09'), 'Hoy');
  assert.equal(dayLabel('2026-10-10', '2026-10-09'), 'Mañana');
});

test('dayLabel: resto de días => nombre del día de semana', () => {
  assert.equal(dayLabel('2026-10-11', '2026-10-09'), 'Domingo');
  assert.equal(dayLabel('2026-10-12', '2026-10-09'), 'Lunes');
  assert.equal(dayLabel('2026-10-05', '2026-10-09'), 'Lunes'); // pasado lejano también
});

test('hourlyWindowBounds: 8 pasadas + 24 desde ahora (incl. ahora)', () => {
  assert.deepEqual(hourlyWindowBounds(100, 360), [92, 124]);
  const [s, e] = hourlyWindowBounds(100, 360);
  assert.equal(e - s, 32);
});

test('hourlyWindowBounds: clamp al inicio cuando nowIdx < 8', () => {
  assert.deepEqual(hourlyWindowBounds(3, 360), [0, 27]);
});

test('hourlyWindowBounds: clamp al final cerca del fin del array', () => {
  assert.deepEqual(hourlyWindowBounds(350, 360), [342, 360]);
});

test('hourlyWindowBounds: respeta parámetros before/after personalizados', () => {
  assert.deepEqual(hourlyWindowBounds(50, 360, 12, 36), [38, 86]);
});
