// Pruebas de core/clock.js y core/rng.js (subparte 0.7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toDate, toIso, localDay, addDays, createClock, systemClock } from '../core/clock.js';
import { createRng, systemRng } from '../core/rng.js';
import { makeRng, makeClock } from './_helpers.mjs';

test('toDate/toIso aceptan Date, milisegundos e ISO y no mutan el original', () => {
  const d = new Date('2026-10-17T12:00:00.000Z');
  assert.equal(toIso(d), '2026-10-17T12:00:00.000Z');
  assert.equal(toIso(d.getTime()), '2026-10-17T12:00:00.000Z');
  assert.equal(toIso('2026-10-17T12:00:00Z'), '2026-10-17T12:00:00.000Z');
  const c = toDate(d); c.setFullYear(2000);
  assert.equal(d.getFullYear(), 2026);
});

test('toDate rechaza lo que no es una fecha', () => {
  for (const bad of [undefined, null, '', '   ', 'mañana', NaN, Infinity, {}, [], true]) assert.throws(() => toDate(bad), /toDate/);
  assert.throws(() => toDate(new Date('x')), /fecha no válida/);
});

test('localDay usa el día LOCAL, con ceros a la izquierda', () => {
  assert.equal(localDay(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  assert.equal(localDay(new Date(2026, 11, 31, 0, 0)), '2026-12-31');
  assert.match(localDay(Date.now()), /^\d{4}-\d{2}-\d{2}$/);
});

test('localDay sigue la zona horaria del dispositivo, no UTC', () => {
  const prev = process.env.TZ;
  try {
    process.env.TZ = 'America/Bogota'; // UTC-5, sin horario de verano
    assert.equal(localDay('2026-10-18T03:00:00.000Z'), '2026-10-17');
    assert.equal(localDay('2026-10-17T05:00:00.000Z'), '2026-10-17');
    assert.equal(localDay('2026-10-17T04:59:00.000Z'), '2026-10-16');
    process.env.TZ = 'Pacific/Auckland'; // UTC+13 en octubre
    assert.equal(localDay('2026-10-17T12:00:00.000Z'), '2026-10-18');
  } finally {
    if (prev === undefined) delete process.env.TZ; else process.env.TZ = prev;
  }
});

test('addDays suma días (también negativos y fracciones) sin mutar', () => {
  const d = new Date('2026-10-17T00:00:00.000Z');
  assert.equal(addDays(d, 1).toISOString(), '2026-10-18T00:00:00.000Z');
  assert.equal(addDays(d, -17).toISOString(), '2026-09-30T00:00:00.000Z');
  assert.equal(addDays(d, 0.5).toISOString(), '2026-10-17T12:00:00.000Z');
  assert.equal(d.toISOString(), '2026-10-17T00:00:00.000Z');
  for (const bad of ['1', NaN, undefined, Infinity]) assert.throws(() => addDays(d, bad), /addDays/);
});

test('createClock: fuente inyectada; valida la fuente y lo que devuelve', () => {
  let t = Date.parse('2026-10-17T08:30:00.000Z');
  const c = createClock(() => t);
  assert.equal(c.iso(), '2026-10-17T08:30:00.000Z');
  assert.equal(c.nowMs(), t);
  assert.ok(c.now() instanceof Date);
  t += 1000;
  assert.equal(c.iso(), '2026-10-17T08:30:01.000Z');
  assert.equal(c.day(), localDay(t));
  assert.throws(() => createClock('x'), /función/);
  assert.throws(() => createClock(() => 'x').now(), /no válido/);
  assert.throws(() => createClock(() => NaN).iso(), /no válido/);
  assert.ok(Math.abs(systemClock.nowMs() - Date.now()) < 1000);
});

test('el reloj falso de las pruebas cumple la misma forma que createClock', () => {
  const fake = makeClock('2026-10-17T08:30:00.000Z');
  for (const k of ['now', 'nowMs', 'iso']) assert.equal(typeof fake[k], 'function');
});

test('createRng: determinista, igual que el azar de las pruebas, y en [0,1)', () => {
  const a = createRng(42); const b = createRng(42); const h = makeRng(42);
  for (let i = 0; i < 100; i += 1) {
    const v = a.next();
    assert.equal(v, b.next());
    assert.equal(v, h.next());
    assert.ok(v >= 0 && v < 1);
  }
  assert.notEqual(createRng(1).next(), createRng(2).next());
});

test('rng.int incluye ambos extremos; pick y shuffle', () => {
  const r = createRng(7);
  const seen = new Set();
  for (let i = 0; i < 500; i += 1) seen.add(r.int(3, 6));
  assert.deepEqual([...seen].sort(), [3, 4, 5, 6]);
  assert.equal(r.int(5, 5), 5);
  assert.ok(['a', 'b', 'c'].includes(r.pick(['a', 'b', 'c'])));
  assert.equal(r.pick(['solo']), 'solo');
  const orig = [1, 2, 3, 4, 5, 6, 7, 8];
  const sh = createRng(3).shuffle(orig);
  assert.deepEqual([...sh].sort(), orig);
  assert.deepEqual(orig, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(createRng(3).shuffle(orig), sh);
  assert.deepEqual(r.shuffle([]), []);
});

test('rng rechaza entradas inválidas', () => {
  const r = createRng(1);
  assert.throws(() => createRng('x'), /semilla/);
  assert.throws(() => createRng(NaN), /semilla/);
  assert.throws(() => r.int(2, 1), /rango/);
  assert.throws(() => r.int(1.5, 3), /rango/);
  assert.throws(() => r.pick([]), /arreglo/);
  assert.throws(() => r.pick('abc'), /arreglo/);
  assert.throws(() => r.shuffle('abc'), /arreglo/);
});

test('systemRng devuelve valores válidos', () => {
  for (let i = 0; i < 50; i += 1) { const v = systemRng.next(); assert.ok(v >= 0 && v < 1); }
  assert.equal(systemRng.int(4, 4), 4);
});
