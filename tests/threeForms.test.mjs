// @purpose: Pruebas de la lógica pura de three_forms (core/threeForms.js, 2.5-T3 punto 1): lectura de las tres formas, variantes, calificación por faceta y resultado global.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FORM_KEYS, FORM_FACETS, readForms, gradeForms } from '../core/threeForms.js';

const item = (forms = { present: 'sing', past: 'sang', participle: 'sung' }, extra = {}) => ({ id: 'v.sing', type: 'three_forms', prompt_es: 'cantar', data: { forms }, ...extra });
const by = (g, key) => g.forms.find((f) => f.key === key);

test('las claves y las facetas siguen el roadmap: presente 0, pasado 1, participio 2', () => {
  assert.deepEqual([...FORM_KEYS], ['present', 'past', 'participle']);
  assert.deepEqual({ ...FORM_FACETS }, { present: 0, past: 1, participle: 2 });
  assert.ok(Object.isFrozen(FORM_KEYS) && Object.isFrozen(FORM_FACETS));
});

test('readForms lee texto o lista, descarta vacíos y mantiene el orden de las tres formas', () => {
  const r = readForms(item({ present: 'learn', past: ['learnt', '  ', 'learned', 5], participle: ['learnt', 'learned'] }));
  assert.equal(r.ok, true);
  assert.deepEqual(r.forms.map((f) => [f.key, f.facet]), [['present', 0], ['past', 1], ['participle', 2]]);
  assert.deepEqual(r.forms[0].accept, ['learn']);
  assert.deepEqual(r.forms[1].accept, ['learnt', 'learned']);
});

test('readForms explica por qué no sirve el ítem', () => {
  for (const bad of [null, undefined, 'x', 7, [], true]) assert.deepEqual(readForms(bad), { ok: false, reason: 'no_item' });
  for (const d of [undefined, null, [], 'x', {}, { forms: null }, { forms: [] }, { forms: 'sang' }]) assert.deepEqual(readForms({ data: d }), { ok: false, reason: 'no_forms' });
  assert.deepEqual(readForms(item({ present: 'go', past: 'went' })), { ok: false, reason: 'incomplete', missing: ['participle'] });
  assert.deepEqual(readForms(item({ present: ' ', past: [], participle: null })), { ok: false, reason: 'incomplete', missing: ['present', 'past', 'participle'] });
});

test('gradeForms: las tres bien → correct y cada forma lleva su faceta', () => {
  const g = gradeForms(item(), { present: 'sing', past: 'sang', participle: 'sung' });
  assert.equal(g.result, 'correct');
  assert.equal(g.allCorrect, true);
  assert.equal(g.anyEmpty, false);
  assert.deepEqual(g.forms.map((f) => [f.key, f.facet, f.result]), [['present', 0, 'correct'], ['past', 1, 'correct'], ['participle', 2, 'correct']]);
});

test('un fallo en una forma no cambia el resultado de las otras (CA 4)', () => {
  const g = gradeForms(item(), { present: 'sing', past: 'sung', participle: 'sung' });
  assert.equal(by(g, 'present').result, 'correct');
  assert.equal(by(g, 'past').result, 'wrong');
  assert.equal(by(g, 'participle').result, 'correct');
  assert.equal(g.result, 'wrong');
  assert.equal(g.allCorrect, false);
});

test('la forma de otro hueco es wrong aunque compare la vea como errata, y dice con cuál se confundió', () => {
  const g = gradeForms(item(), { present: 'Sang ', past: 'sung', participle: 'sung' });
  assert.equal(by(g, 'present').result, 'wrong');
  assert.equal(by(g, 'present').swappedWith, 'past');
  assert.equal(by(g, 'past').swappedWith, 'participle');
  assert.equal(by(g, 'participle').swappedWith, null);
  assert.equal(g.forms.every((f) => f.swappedWith === null), false);
});

test('una errata de la propia forma sigue siendo almost y no cuenta como forma cambiada', () => {
  const g = gradeForms(item(), { present: 'sing', past: 'sangg', participle: 'sung' });
  assert.equal(by(g, 'past').result, 'almost');
  assert.equal(by(g, 'past').swappedWith, null);
  assert.equal(g.result, 'almost');
});

test('si dos formas son iguales (cut, cut, cut) escribir la misma palabra acierta y no es forma cambiada', () => {
  const g = gradeForms(item({ present: 'cut', past: 'cut', participle: 'cut' }), { present: 'cut', past: 'cut', participle: 'cut' });
  assert.equal(g.result, 'correct');
  assert.ok(g.forms.every((f) => f.swappedWith === null));
});

test('gradeForms acepta una lista de 3 en orden y las variantes de cada forma', () => {
  const it = item({ present: 'learn', past: ['learnt', 'learned'], participle: ['learnt', 'learned'] });
  const g = gradeForms(it, ['learn', 'learned', 'learnt']);
  assert.equal(g.result, 'correct');
});

test('un campo vacío o sin texto es wrong con empty, y los demás se califican igual', () => {
  const g = gradeForms(item(), { present: 'sing', past: '   ', participle: undefined });
  assert.equal(by(g, 'present').result, 'correct');
  assert.equal(by(g, 'past').empty, true);
  assert.equal(by(g, 'past').result, 'wrong');
  assert.equal(by(g, 'participle').empty, true);
  assert.equal(g.anyEmpty, true);
  assert.equal(g.result, 'wrong');
  assert.equal(gradeForms(item(), null).anyEmpty, true);
});

test('result global: almost solo si ninguna forma es wrong y alguna es almost; compare es inyectable', () => {
  const calls = [];
  const compare = (typed, accept) => { calls.push([typed, accept]); return { result: typed === 'ok' ? 'correct' : typed === 'near' ? 'almost' : 'wrong' }; };
  assert.equal(gradeForms(item(), { present: 'ok', past: 'near', participle: 'ok' }, { compare }).result, 'almost');
  assert.equal(gradeForms(item(), { present: 'near', past: 'zzz', participle: 'ok' }, { compare }).result, 'wrong');
  assert.equal(gradeForms(item(), { present: 'ok', past: 'ok', participle: 'ok' }, { compare }).result, 'correct');
  assert.deepEqual(calls.slice(0, 3), [['ok', ['sing']], ['near', ['sang']], ['ok', ['sung']]]);
});

test('un ítem inválido lanza Error en español', () => {
  assert.throws(() => gradeForms(null, {}), /el ítem no es un objeto/);
  assert.throws(() => gradeForms({ data: {} }, {}), /no tiene las tres formas/);
  assert.throws(() => gradeForms(item({ present: 'go', past: 'went' }), {}), /faltan formas aceptadas \(participle\)/);
});

test('la forma cambiada ignora mayúsculas también en la forma aceptada', () => {
  const g = gradeForms(item({ present: 'sing', past: 'Sang', participle: 'sung' }), { present: 'sang', past: 'Sang', participle: 'sung' });
  assert.equal(by(g, 'present').result, 'wrong');
  assert.equal(by(g, 'present').swappedWith, 'past');
});

test('una forma nunca se marca como cambiada con ella misma, aunque compare la rechace', () => {
  const compare = () => ({ result: 'wrong' });
  const g = gradeForms(item(), { present: 'sing', past: 'sang', participle: 'sung' }, { compare });
  assert.ok(g.forms.every((f) => f.swappedWith === null));
});

test('un campo vacío es wrong aunque compare dijera correct', () => {
  const compare = () => ({ result: 'correct' });
  const g = gradeForms(item(), { present: 'sing', past: '', participle: 'sung' }, { compare });
  assert.equal(by(g, 'past').result, 'wrong');
  assert.equal(g.result, 'wrong');
});
