// @purpose: Pruebas de la vibración de la sesión (2.6-T3, punto 3): decisión pura, adaptador de navigator.vibrate y vista de sesión real.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { vibrationFor, PULSE_MS } from '../core/feedbackCues.js';
import { createVibration } from '../app/vibration.js';
import { mk, openNew, fakeHost } from './_sesionHarness.mjs';

const realDocument = globalThis.document;
afterEach(() => { globalThis.document = realDocument; });

test('vibrationFor: un pulso de 10 ms solo al acertar y solo con el ajuste en true', () => {
  assert.equal(PULSE_MS, 10);
  assert.equal(vibrationFor('correct', true), 10);
  for (const r of ['wrong', 'dont_know', 'dont', 'almost', 'skipped', '', undefined, null, 'toString', '__proto__', {}]) assert.equal(vibrationFor(r, true), 0, String(r));
  for (const e of [false, undefined, null, 0, 1, 'true', {}]) assert.equal(vibrationFor('correct', e), 0, String(e));
});

test('adaptador: sin navigator, sin vibrate, que lanza o que rechaza, no lanza y devuelve false', () => {
  for (const nav of [null, undefined, {}, { vibrate: 5 }, { vibrate() { throw new Error('no permitido'); } }, { vibrate: () => false }]) {
    assert.equal(createVibration({ nav }).pulse(10), false, String(nav));
  }
});

test('adaptador: pulsos inválidos no llegan a navigator.vibrate', () => {
  const calls = [];
  const v = createVibration({ nav: { vibrate: (x) => { calls.push(x); return true; } } });
  for (const ms of [0, -1, 51, 1.5, NaN, Infinity, '10', null, undefined, [10], [10, 20, 10], {}]) assert.equal(v.pulse(ms), false, String(ms));
  assert.deepEqual(calls, []);
  assert.equal(v.pulse(10), true);
  assert.deepEqual(calls, [10]);
});

function spy() { const calls = []; return { calls, pulse: (ms) => { calls.push(ms); return true; } }; }
const settings = (v) => ({ get: (k) => (k === 'vibration' ? v : undefined) });

for (const [result, expected] of [['correct', [10]], ['wrong', []], ['dont_know', []], ['almost', []]]) {
  test(`vista de sesión: tras «${result}» vibra ${JSON.stringify(expected)}`, async () => {
    const vibration = spy();
    const t = await mk({ host: fakeHost({ answer: { result, exerciseType: 'fix_error' } }), services: { vibration, settings: settings(true) } });
    await openNew(t);
    t.click(t.btn('Comprobar')); await t.flush();
    assert.deepEqual(vibration.calls, expected);
    assert.ok(t.btn('Continuar'));
  });
}

test('vista de sesión: con `vibration` en false no vibra; sin ajustes cargados vibra (valor por defecto)', async () => {
  const off = spy();
  let t = await mk({ services: { vibration: off, settings: settings(false) } });
  await openNew(t);
  t.click(t.btn('Comprobar')); await t.flush();
  assert.deepEqual(off.calls, []);
  const dflt = spy();
  t = await mk({ services: { vibration: dflt } });
  await openNew(t);
  t.click(t.btn('Comprobar')); await t.flush();
  assert.deepEqual(dflt.calls, [10]);
});

test('vista de sesión: el cierre de la sesión no vibra (solo suena)', async () => {
  const vibration = spy();
  const t = await mk({ cards: 1, services: { vibration, settings: settings(true) } });
  await openNew(t);
  t.click(t.btn('Comprobar')); await t.flush();
  t.click(t.btn('Continuar')); await t.flush();
  assert.deepEqual(vibration.calls, [10]);
});

test('vista de sesión: un adaptador que lanza o un ajuste que lanza no bloquea «Continuar»', async () => {
  const bad = { pulse() { throw new Error('boom'); } };
  let t = await mk({ cards: 2, services: { vibration: bad, settings: settings(true) } });
  await openNew(t);
  t.click(t.btn('Comprobar')); await t.flush();
  assert.equal(t.q('.session__foot')[0].hasAttribute('hidden'), false);
  t = await mk({ cards: 2, services: { vibration: spy(), settings: { get() { throw new Error('ajustes'); } } } });
  await openNew(t);
  t.click(t.btn('Comprobar')); await t.flush();
  assert.equal(t.q('.session__foot')[0].hasAttribute('hidden'), false);
});
