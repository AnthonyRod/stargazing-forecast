import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wmoIcon, skyText, skyIcon, dayLabel, WMO } from '../src/js/weather.js';

test('wmoIcon: código desconocido', () => {
  assert.deepEqual(wmoIcon(9999, 12), { i: '❓', t: 'Desconocido' });
});

test('wmoIcon: día vs noche', () => {
  assert.deepEqual(wmoIcon(0, 12), { i: '☀️', t: 'Despejado' });
  assert.deepEqual(wmoIcon(0, 22), { i: '🌙', t: 'Despejado' });
  assert.deepEqual(wmoIcon(1, 22), { i: '🌙☁️', t: 'Mayormente despejado' });
  assert.deepEqual(wmoIcon(2, 22), { i: '🌙☁️', t: 'Parcial nublado' });
});

test('wmoIcon: convierte chubascos a lluvia de noche', () => {
  assert.equal(wmoIcon(80, 12).i, '🌦️');
  assert.equal(wmoIcon(80, 20).i, '🌧️');
});

test('wmoIcon: sin hora no aplica ajuste nocturno', () => {
  assert.equal(wmoIcon(0).i, '☀️');
  assert.equal(wmoIcon(0, null).i, '☀️');
});

test('wmoIcon: bordes del horario nocturno (18:00–05:59)', () => {
  assert.equal(wmoIcon(0, 18).i, '🌙'); // >= 18 es noche
  assert.equal(wmoIcon(0, 6).i, '☀️');  // 06:00 es día
  assert.equal(wmoIcon(0, 5).i, '🌙');
});

test('WMO: tabla coherente (todas las entradas con icono y texto)', () => {
  for (const [code, w] of Object.entries(WMO)) {
    assert.ok(w.i && w.t, `código ${code} incompleto`);
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
  assert.equal(skyIcon(10, 12), '☀️');
  assert.equal(skyIcon(10, 22), '🌙');
  assert.equal(skyIcon(40, 12), '⛅');
  assert.equal(skyIcon(40, 22), '🌙☁️');
  assert.equal(skyIcon(80, 12), '☁️');
  assert.equal(skyIcon(80, 5), '☁️'); // nublado ignora día/noche
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
