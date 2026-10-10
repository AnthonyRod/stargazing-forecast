import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreHour, scoreColor, verdict } from '../src/js/scoring.js';

test('scoreHour: cielo ideal => 100', () => {
  assert.equal(scoreHour(0, 0, 40, 30000, 10), 100);
});

test('scoreHour: mezcla intermedia => valor exacto ponderado', () => {
  // s_cloud=50, s_precip=88, s_rh=50, s_vis=50, s_wind=100
  assert.equal(scoreHour(50, 10, 70, 15000, 20), 58);
});

test('scoreHour: penalización por viento sólo si > 25 km/h', () => {
  assert.equal(scoreHour(0, 0, 40, 30000, 25), 100); // borde: sin penalización
  assert.equal(scoreHour(0, 0, 40, 30000, 26), 96);
  assert.equal(scoreHour(0, 0, 40, 30000, 40), 40);
});

test('scoreHour: lluvia alta reduce el score', () => {
  assert.equal(scoreHour(0, 100, 40, 30000, 10), 80);
});

test('scoreHour: niebla (RH>90 y vis<5km) reduce el score a la mitad', () => {
  assert.equal(scoreHour(0, 0, 95, 3000, 10), 34);
  // mismo caso sin niebla (visibilidad alta) => sin penalización
  assert.equal(scoreHour(0, 0, 95, 30000, 10), 80);
});

test('scoreHour: RH exactamente 90 anula el componente de humedad', () => {
  // s_rh = 0 con rh >= 90; resto ideal => 45+20+0+15 = 80
  assert.equal(scoreHour(0, 0, 90, 30000, 10), 80);
});

test('scoreHour: siempre dentro de 0..100 para entradas extremas', () => {
  const extremes = [
    [0, 0, 0, 1e9, 0],
    [100, 999, 100, 0, 999],
    [200, 500, 120, -5, 60],
  ];
  for (const args of extremes) {
    const s = scoreHour(...args);
    assert.ok(s >= 0 && s <= 100, `fuera de rango: ${s}`);
  }
});

test('scoreHour: determinista', () => {
  const args = [42, 7, 63, 12345, 18];
  assert.equal(scoreHour(...args), scoreHour(...args));
});

test('scoreColor: umbrales 70 / 45', () => {
  assert.equal(scoreColor(100), '#40e0a0');
  assert.equal(scoreColor(70), '#40e0a0');
  assert.equal(scoreColor(69), '#f0c060');
  assert.equal(scoreColor(45), '#f0c060');
  assert.equal(scoreColor(44), '#e05060');
  assert.equal(scoreColor(0), '#e05060');
});

test('verdict: umbrales 70 / 55 / 40', () => {
  assert.deepEqual(verdict(70), { text: 'Excelente', c: '#40e0a0' });
  assert.equal(verdict(69).text, 'Bueno');
  assert.equal(verdict(55).text, 'Bueno');
  assert.equal(verdict(54).text, 'Parcial');
  assert.equal(verdict(40).text, 'Parcial');
  assert.deepEqual(verdict(39), { text: 'Bloqueado', c: '#e05060' });
});
