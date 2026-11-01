// @purpose: Pruebas de las reacciones de la sesión (2.6-T3, punto 1): estado de la mascota por resultado, en la lógica pura y en la vista de sesión real.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mascotStateFor, MASCOT_FOR } from '../core/feedbackCues.js';
import { mk, openNew, fakeHost } from './_sesionHarness.mjs';

const realDocument = globalThis.document;
afterEach(() => { globalThis.document = realDocument; });

test('mascotStateFor: feliz al acertar, «pensando» al fallar o en «No sé», neutral el resto', () => {
  assert.equal(mascotStateFor('correct'), 'happy');
  assert.equal(mascotStateFor('wrong'), 'thinking');
  assert.equal(mascotStateFor('dont_know'), 'thinking');
  assert.equal(mascotStateFor('dont'), 'thinking');
  for (const v of ['almost', 'skipped', '', 'CORRECT', 'toString', '__proto__', 'constructor', undefined, null, 5, {}, [], true]) assert.equal(mascotStateFor(v), 'neutral', String(v));
  assert.ok(Object.isFrozen(MASCOT_FOR));
});

const stateOf = (t) => t.q('.mascot')[0]?.getAttribute('data-state');

for (const [result, expected] of [['correct', 'happy'], ['wrong', 'thinking'], ['dont_know', 'thinking'], ['almost', 'neutral']]) {
  test(`vista de sesión: tras «${result}» la mascota queda «${expected}» y vuelve a neutral con «Continuar»`, async () => {
    const t = await mk({ host: fakeHost({ answer: { result, exerciseType: 'fix_error' } }) });
    await openNew(t);
    assert.equal(stateOf(t), 'neutral');
    t.click(t.btn('Comprobar')); await t.flush();
    assert.equal(stateOf(t), expected);
    t.click(t.btn('Continuar')); await t.flush();
    assert.equal(stateOf(t), 'neutral');
  });
}
