// @purpose: Pruebas de core/pausableVisibility.js (2.7-T1): la pausa de las hojas de ayuda se suma a la pestaña oculta y el cronómetro de respuesta la descuenta.
// 2.7-T1. Incluye el cruce con core/answerTimer.js: mirar una ayuda no cuenta como tiempo de respuesta.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPausableVisibility } from '../core/pausableVisibility.js';
import { createAnswerTimer } from '../core/answerTimer.js';
import { makeClock } from './_helpers.mjs';
import { fakeVisibility } from './_sesionHarness.mjs';

test('sin base, visible; la pausa la oculta y al quitarla vuelve a verse', () => {
  const v = createPausableVisibility();
  assert.equal(v.hidden(), false);
  v.setPaused(true);
  assert.equal(v.hidden(), true);
  assert.equal(v.paused(), true);
  v.setPaused(false);
  assert.equal(v.hidden(), false);
});

test('hidden = pestaña oculta O pausa; la pausa no pisa a la base', () => {
  const base = fakeVisibility();
  const v = createPausableVisibility(base);
  base.set(true);
  assert.equal(v.hidden(), true);
  v.setPaused(true); base.set(false);
  assert.equal(v.hidden(), true, 'la pausa sigue aunque la pestaña vuelva');
  v.setPaused(false);
  assert.equal(v.hidden(), false);
});

test('avisa al cambiar la base y al cambiar la pausa, pero no repite avisos iguales', () => {
  const base = fakeVisibility();
  const v = createPausableVisibility(base);
  let n = 0; const off = v.onChange(() => { n += 1; });
  v.setPaused(true); v.setPaused(true); v.setPaused(false); v.setPaused(false);
  assert.equal(n, 2);
  base.set(true);
  assert.equal(n, 3);
  off();
  v.setPaused(true); base.set(false);
  assert.equal(n, 3, 'tras desuscribir no avisa');
});

test('se suscribe a la base una sola vez y la suelta cuando no queda nadie', () => {
  let subs = 0; let unsubs = 0;
  const base = { hidden: () => false, onChange: () => { subs += 1; return () => { unsubs += 1; }; } };
  const v = createPausableVisibility(base);
  const a = v.onChange(() => {}); const b = v.onChange(() => {});
  assert.equal(subs, 1);
  a(); assert.equal(unsubs, 0);
  b(); assert.equal(unsubs, 1);
  const c = v.onChange(() => {}); assert.equal(subs, 2); c();
});

test('una base rota o un oyente que lanza no rompen la respuesta', () => {
  const broken = { hidden: () => { throw new Error('x'); }, onChange: () => { throw new Error('y'); } };
  const v = createPausableVisibility(broken);
  assert.equal(v.hidden(), false);
  assert.doesNotThrow(() => v.onChange(() => {}));
  const originalError = console.error; console.error = () => {};
  try { v.onChange(() => { throw new Error('oyente'); }); assert.doesNotThrow(() => v.setPaused(true)); } finally { console.error = originalError; }
  assert.equal(createPausableVisibility({}).hidden(), false);
  assert.equal(createPausableVisibility(null).hidden(), false);
  assert.throws(() => v.onChange('no'), /necesita una función/);
});

test('cruce con el cronómetro: el tiempo con la ayuda abierta no cuenta como tiempo de respuesta', () => {
  const clock = makeClock('2026-10-31T10:00:00.000Z');
  const vis = createPausableVisibility(fakeVisibility());
  const timer = createAnswerTimer({ clock, visibility: vis });
  timer.start();
  clock.advance(4000);
  vis.setPaused(true);
  clock.advance(20000); // mirando «Otros ejemplos»
  vis.setPaused(false);
  clock.advance(1000);
  const r = timer.stop();
  assert.equal(r.ms, 5000);
  assert.equal(r.hiddenMs, 20000);
  assert.equal(r.interrupted, true, 'más de 3 s de pausa: el tiempo ya no es fiable y no sube ni baja la nota');
});

test('una ayuda de menos de 3 s no interrumpe la medición', () => {
  const clock = makeClock('2026-10-31T10:00:00.000Z');
  const vis = createPausableVisibility();
  const timer = createAnswerTimer({ clock, visibility: vis });
  timer.start();
  clock.advance(2000); vis.setPaused(true); clock.advance(1500); vis.setPaused(false); clock.advance(500);
  const r = timer.stop();
  assert.deepEqual([r.ms, r.hiddenMs, r.interrupted], [2500, 1500, false]);
});

test('solo `true` pone la pausa: valores «verdaderos» que no son true (1, «sí», objeto) no la activan', () => {
  const v = createPausableVisibility();
  for (const odd of [1, 'sí', {}, [], 'true']) { v.setPaused(odd); assert.equal(v.paused(), false, `no debe pausar con ${JSON.stringify(odd)}`); }
  v.setPaused(true);
  assert.equal(v.paused(), true);
  v.setPaused(1); // un valor que no es true equivale a quitar la pausa
  assert.equal(v.paused(), false);
});
