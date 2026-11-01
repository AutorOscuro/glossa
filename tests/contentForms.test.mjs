// @purpose: Pruebas de la validación de three_forms en core/contentData.js y core/contentTypes.js (2.5-T3, punto 5, ampliación 1.3-2A: data.forms y accept opcional).
import test from 'node:test';
import assert from 'node:assert/strict';
import { DATA_SPECS, FORM_FIELDS } from '../core/contentData.js';
import { ITEM_TYPES } from '../core/contentTypes.js';
import { validateItem } from '../core/contentItem.js';
import { LIMITS } from '../core/contentRules.js';

const item = (type, data, extra = {}) => ({
  id: 'vrb.irreg.0001', type, topics: ['gram.present_perfect.form'], level: 'A2', prompt_es: 'cantar', data,
  explain_es: 'x', source: 'original', version: 1, ...extra,
});
const run = (type, data, extra) => validateItem(item(type, data, extra), { dataSpecs: DATA_SPECS });
const at = (r) => r.errors.map((e) => `${e.path}:${e.rule}`);
const forms = { present: 'sing', past: 'sang', participle: 'sung' };

test('three_forms válido SIN accept (las respuestas viven en data.forms)', () => {
  assert.equal(run('three_forms', { forms }).ok, true);
  assert.equal(ITEM_TYPES.three_forms.acceptRequired, false);
});
test('three_forms con accept sigue siendo válido (accept opcional, no prohibido)', () => {
  assert.equal(run('three_forms', { forms }, { accept: ['sing sang sung'] }).ok, true);
});
test('three_forms: cada forma admite lista de grafías («learnt» y «learned»)', () => {
  assert.equal(run('three_forms', { forms: { present: ['learn'], past: ['learnt', 'learned'], participle: 'learnt' } }).ok, true);
});
test('three_forms sin data.forms → DATA_FIELD_REQUIRED', () => {
  assert.deepEqual(at(run('three_forms', {})), ['data.forms:DATA_FIELD_REQUIRED']);
  assert.deepEqual(at(run('three_forms', { hint: 'x' })), ['data.forms:DATA_FIELD_REQUIRED']);
});
test('three_forms: falta una de las tres formas', () => {
  for (const k of FORM_FIELDS) {
    const f = { ...forms }; delete f[k];
    const r = run('three_forms', { forms: f });
    assert.equal(r.ok, false, k);
    assert.ok(at(r).every((x) => x.startsWith(`data.forms.${k}`) || x.startsWith('data.forms')), at(r).join());
  }
});
test('three_forms: forma vacía, de otro tipo, lista vacía o demasiado larga no valen', () => {
  for (const bad of ['', '   ', 5, null, [], [''], ['a', 7], 'x'.repeat(LIMITS.short + 1), Array.from({ length: 11 }, (_, i) => `w${i}`)]) {
    assert.equal(run('three_forms', { forms: { ...forms, past: bad } }).ok, false, JSON.stringify(bad));
  }
  assert.equal(run('three_forms', { forms: { ...forms, past: Array.from({ length: 10 }, (_, i) => `w${i}`) } }).ok, true);
});
test('three_forms: un campo extra dentro de forms no vale', () => {
  assert.equal(run('three_forms', { forms: { ...forms, gerund: 'singing' } }).ok, false);
  assert.equal(run('three_forms', { forms: 'sing sang sung' }).ok, false);
  assert.equal(run('three_forms', { forms: ['sing', 'sang', 'sung'] }).ok, false);
});
test('data.forms en otro tipo de la familia → FORMS_ONLY', () => {
  for (const t of ['fill_verb', 'translate_word', 'first_letter', 'fix_error']) {
    assert.deepEqual(at(run(t, { forms }, { accept: ['x'] })), ['data.forms:FORMS_ONLY'], t);
  }
});
test('los demás tipos que se escriben siguen exigiendo accept', () => {
  assert.deepEqual(at(run('fill_verb', {})), ['accept:ACCEPT_REQUIRED']);
  assert.equal(run('fill_verb', {}, { accept: ['went'] }).ok, true);
});
test('FORM_FIELDS está congelado y en el orden de las facetas', () => {
  assert.deepEqual([...FORM_FIELDS], ['present', 'past', 'participle']);
  assert.equal(Object.isFrozen(FORM_FIELDS), true);
});
