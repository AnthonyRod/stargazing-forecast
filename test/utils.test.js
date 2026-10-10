import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, fmtDate, moonPhase, getNightSlots, bestWindow, validateCoord } from '../src/js/utils.js';

// helper: genera etiquetas horarias Open-Meteo ('YYYY-MM-DDTHH:00')
function makeTime(days) {
  const out = [];
  for (const day of days) {
    for (let h = 0; h < 24; h++) out.push(`${day}T${String(h).padStart(2, '0')}:00`);
  }
  return out;
}

test('addDays: suma simple y roces de mes/año', () => {
  assert.equal(addDays('2026-01-01', 0), '2026-01-01');
  assert.equal(addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-01-01', 400), '2027-02-05');
});

test('fmtDate: formato "Ddd D Mmm"', () => {
  assert.equal(fmtDate('2026-01-05'), 'Lun 5 Ene');
  assert.equal(fmtDate('2026-03-09'), 'Lun 9 Mar');
  assert.equal(fmtDate('2026-12-25'), 'Vie 25 Dic');
});

test('moonPhase: valores verificados (referencia 2000-01-06)', () => {
  const cuartoCreciente = moonPhase('2000-01-14');
  assert.equal(cuartoCreciente.icon, '🌓');
  assert.equal(cuartoCreciente.name, 'Cuarto Creciente');
  assert.equal(cuartoCreciente.phase, '7.7');
  assert.equal(cuartoCreciente.illum, 54);
  assert.equal(cuartoCreciente.effect.t, '~ Moderada');

  const gibosa = moonPhase('2000-01-21');
  assert.equal(gibosa.icon, '🌔');
  assert.equal(gibosa.name, 'Gibosa Creciente');
  assert.equal(gibosa.illum, 100);
  assert.equal(gibosa.effect.t, '⚠ Muy brillante');
});

test('moonPhase: envolvente (wrap) para fechas anteriores a la referencia', () => {
  const m = moonPhase('1999-12-31');
  assert.equal(m.icon, '🌗');
  assert.equal(m.name, 'Cuarto Menguante');
  assert.equal(m.phase, '23.3');
  assert.equal(m.illum, 38);
  assert.equal(m.effect.t, '✓ Ideal');
});

test('moonPhase: forma y rangos del resultado', () => {
  const dates = ['2026-01-01', '2026-02-15', '2026-06-01', '2026-10-09', '2027-03-20'];
  const icons = new Set(['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘']);
  const effects = new Set(['⚠ Muy brillante', '~ Moderada', '✓ Ideal']);
  for (const d of dates) {
    const m = moonPhase(d);
    assert.match(m.phase, /^\d+\.\d$/);
    assert.ok(Number(m.phase) >= 0 && Number(m.phase) < 29.53058867);
    assert.ok(Number.isInteger(m.illum) && m.illum >= 0 && m.illum <= 100);
    assert.ok(icons.has(m.icon), `icono inesperado ${m.icon}`);
    assert.ok(effects.has(m.effect.t));
  }
});

test('getNightSlots: 18–23 de la fecha + 00–05 del día siguiente', () => {
  const timeArr = makeTime(['2026-03-01', '2026-03-02']);
  const slots = getNightSlots('2026-03-01', timeArr);
  assert.deepEqual(
    slots.map(s => s.label),
    ['18:00', '19:00', '20:00', '21:00', '22:00', '23:00', '00:00', '01:00', '02:00', '03:00', '04:00', '05:00']
  );
  assert.deepEqual(
    slots.map(s => s.i),
    [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29]
  );
});

test('getNightSlots: omite horas ausentes en la serie', () => {
  const full = makeTime(['2026-03-01', '2026-03-02']);
  const timeArr = full.filter(t => t !== '2026-03-01T20:00' && t !== '2026-03-02T03:00');
  const slots = getNightSlots('2026-03-01', timeArr);
  const labels = slots.map(s => s.label);
  assert.equal(slots.length, 10);
  assert.ok(!labels.includes('20:00'));
  assert.ok(!labels.includes('03:00'));
});

test('getNightSlots: sin datos del día siguiente sólo devuelve la tarde', () => {
  const timeArr = makeTime(['2026-03-31']);
  const slots = getNightSlots('2026-03-31', timeArr);
  assert.equal(slots.length, 6);
  assert.deepEqual(slots.map(s => s.label), ['18:00', '19:00', '20:00', '21:00', '22:00', '23:00']);
});

test('getNightSlots: serie vacía => sin slots', () => {
  assert.deepEqual(getNightSlots('2026-03-01', []), []);
});

test('bestWindow: devuelve el tramo continuo más largo con score >= 55', () => {
  const slots = ['18:00', '19:00', '20:00', '21:00', '22:00', '23:00', '00:00', '01:00']
    .map((label, i) => ({ label, i }));
  const scores = [50, 60, 60, 70, 40, 80, 80, 80];
  // primer tramo de longitud 3 gana el empate (se actualiza sólo si es estrictamente más largo)
  assert.deepEqual(bestWindow(slots, scores), [
    { label: '19:00', s: 60 },
    { label: '20:00', s: 60 },
    { label: '21:00', s: 70 },
  ]);
});

test('bestWindow: maxConsecutive distinto / sin ventana', () => {
  const slots = ['18:00', '19:00', '20:00', '21:00'].map((label, i) => ({ label, i }));
  assert.deepEqual(bestWindow(slots, [80, 80, 80, 80]), [
    { label: '18:00', s: 80 }, { label: '19:00', s: 80 }, { label: '20:00', s: 80 }, { label: '21:00', s: 80 },
  ]);
  assert.equal(bestWindow(slots, [10, 54, 20, 0]), null);
  assert.deepEqual(bestWindow(slots, [10, 55, 20, 0]), [{ label: '19:00', s: 55 }]);
});

test('bestWindow: tolera scores faltantes (undefined => 0)', () => {
  const slots = [{ label: '18:00', i: 0 }, { label: '19:00', i: 5 }];
  const scores = [60]; // no hay índice 5
  assert.deepEqual(bestWindow(slots, scores), [{ label: '18:00', s: 60 }]);
});

test('validateCoord: acepta valores dentro de rango', () => {
  assert.equal(validateCoord('9.7482', 'lat'), 9.7482);
  assert.equal(validateCoord('-83.9959', 'lon'), -83.9959);
  assert.equal(validateCoord(0, 'lat'), 0);
});

test('validateCoord: límites exactos aceptados', () => {
  assert.equal(validateCoord(90, 'lat'), 90);
  assert.equal(validateCoord(-90, 'lat'), -90);
  assert.equal(validateCoord(180, 'lon'), 180);
  assert.equal(validateCoord(-180, 'lon'), -180);
});

test('validateCoord: fuera de rango => null', () => {
  assert.equal(validateCoord(90.0001, 'lat'), null);
  assert.equal(validateCoord(-90.0001, 'lat'), null);
  assert.equal(validateCoord(180.0001, 'lon'), null);
  assert.equal(validateCoord(-180.0001, 'lon'), null);
});

test('validateCoord: entradas no numéricas o vacías => null', () => {
  assert.equal(validateCoord('abc', 'lat'), null);
  assert.equal(validateCoord('', 'lat'), null);
  assert.equal(validateCoord('   ', 'lon'), null);
  assert.equal(validateCoord(undefined, 'lat'), null);
});

test('validateCoord: parseFloat tolerante a sufijos (comportamiento actual)', () => {
  assert.equal(validateCoord('9.75abc', 'lat'), 9.75);
});
