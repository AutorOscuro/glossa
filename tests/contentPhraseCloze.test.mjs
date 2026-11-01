// @purpose: Pruebas de los campos opcionales key_es, key_en y turns de phrase_cloze en el validador de contenido (2.2).
// Decisión del Administrador (2026-10-27): ampliación compatible de 1.3-2A. Los campos solo existen en phrase_cloze.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DATA_SPECS, PHRASE_CLOZE_FIELDS } from '../core/contentData.js';
import { validateItem } from '../core/contentItem.js';
import { loadSample } from './_samplePack.mjs';

const ES = '—¿Pudiste enviar el correo? —No, no pude enviarlo.';
const turns2 = () => [{ who: 'A', es: '¿Pudiste enviar el correo?', en: 'Did you send the email?' }, { who: 'B', es: 'No, no pude enviarlo.' }];
const item = (data, extra = {}) => ({
  id: 'gram.modals.0001', type: 'phrase_cloze', topics: ['gram.modals.no_to'], level: 'A2', prompt_es: ES,
  data: { text: "No, I ___ send it.", answers: [["couldn't"]], ...data }, accept: ["No, I couldn't send it."],
  explain_es: 'x', source: 'original', version: 1, ...extra,
});
const run = (data, extra) => validateItem(item(data, extra), { dataSpecs: DATA_SPECS });
const rules = (r) => r.errors.map((e) => e.rule);
const at = (r, rule) => r.errors.filter((e) => e.rule === rule).map((e) => e.path);

test('sin los campos nuevos el ítem sigue siendo válido (compatible)', () => {
  assert.equal(run({}).ok, true);
  assert.deepEqual([...PHRASE_CLOZE_FIELDS], ['key_es', 'key_en', 'turns']);
});
test('con los tres campos es válido', () => {
  assert.equal(run({ key_es: 'no pude', key_en: "couldn't", turns: turns2() }).ok, true);
});
test('el paquete de muestra trae un phrase_cloze con los tres campos y es válido', () => {
  const it = loadSample().items.find((i) => i.type === 'phrase_cloze');
  assert.ok(it.data.key_es && it.data.key_en && it.data.turns.length === 2);
  assert.equal(validateItem(it, { dataSpecs: DATA_SPECS }).ok, true);
});
test('key_es: aparece en prompt_es sin distinguir mayúsculas', () => {
  assert.equal(run({ key_es: 'NO PUDE' }).ok, true);
  assert.equal(run({ key_es: 'Pudiste' }).ok, true);
});
test('key_es: puede aparecer solo en un turno', () => {
  assert.equal(run({ key_es: 'el correo', turns: turns2() }, { prompt_es: 'Un diálogo sobre un envío.' }).ok, true);
  assert.equal(run({ key_es: 'el correo' }, { prompt_es: 'Un diálogo sobre un envío.' }).ok, false);
});
test('key_es que no está en el texto → KEY_NOT_IN_TEXT en data.key_es', () => {
  const r = run({ key_es: 'jamás', turns: turns2() });
  assert.deepEqual(at(r, 'KEY_NOT_IN_TEXT'), ['data.key_es']);
});
test('límites: key_es 120 sí y 121 no; key_en 60 sí y 61 no', () => {
  const k = (n) => 'a'.repeat(n);
  assert.equal(run({ key_es: k(120) }, { prompt_es: k(130) }).ok, true);
  assert.ok(rules(run({ key_es: k(121) }, { prompt_es: k(130) })).includes('TEXT_TOO_LONG'));
  assert.equal(run({ key_en: k(60) }).ok, true);
  assert.ok(rules(run({ key_en: k(61) })).includes('TEXT_TOO_LONG'));
});
test('key_es y key_en no pueden estar vacíos ni ser de otro tipo', () => {
  assert.ok(rules(run({ key_es: '' })).includes('TEXT_EMPTY'));
  assert.ok(rules(run({ key_en: '' })).includes('TEXT_EMPTY'));
  assert.ok(rules(run({ key_en: 5 })).includes('TYPE'));
  assert.ok(rules(run({ key_es: null })).includes('TYPE'));
});
test('turns: de 2 a 6 elementos', () => {
  const t = (n) => Array.from({ length: n }, (_, i) => ({ who: i % 2 ? 'B' : 'A', es: `Turno ${i}` }));
  assert.equal(run({ turns: t(2) }).ok, true);
  assert.equal(run({ turns: t(6) }).ok, true);
  assert.ok(rules(run({ turns: t(1) })).includes('LIST_SIZE'));
  assert.ok(rules(run({ turns: t(7) })).includes('LIST_SIZE'));
  assert.ok(rules(run({ turns: [] })).includes('LIST_SIZE'));
  assert.ok(rules(run({ turns: 'A: hola' })).includes('TYPE'));
});
test('turns: who solo A o B; es obligatorio y ≤ 300; en opcional; sin campos extra', () => {
  const bad = (turn) => run({ turns: [{ who: 'A', es: 'ok' }, turn] });
  assert.equal(bad({ who: 'B', es: 'x'.repeat(300) }).ok, true);
  assert.ok(rules(bad({ who: 'B', es: 'x'.repeat(301) })).includes('TEXT_TOO_LONG'));
  assert.ok(rules(bad({ who: 'C', es: 'x' })).length > 0);
  assert.ok(rules(bad({ who: 'a', es: 'x' })).length > 0);
  assert.ok(rules(bad({ es: 'x' })).includes('REQUIRED'));
  assert.ok(rules(bad({ who: 'B' })).includes('REQUIRED'));
  assert.ok(rules(bad({ who: 'B', es: 'x', raro: 1 })).includes('UNKNOWN_FIELD'));
  assert.ok(rules(bad({ who: 'B', es: 'x', en: 7 })).includes('TYPE'));
  assert.equal(bad({ who: 'B', es: 'x', en: 'ok' }).ok, true);
});
test('los otros tipos de la familia cloze rechazan los tres campos (PHRASE_CLOZE_ONLY)', () => {
  const other = { id: 'gram.modals.0002', type: 'cloze_bank', topics: ['gram.modals.no_to'], level: 'A2', prompt_es: ES, explain_es: 'x', source: 'original', version: 1 };
  const go = (d) => validateItem({ ...other, data: { text: 'I ___ it.', answers: [['saw']], ...d } }, { dataSpecs: DATA_SPECS });
  assert.equal(go({}).ok, true);
  assert.deepEqual(at(go({ key_es: 'pude' }), 'PHRASE_CLOZE_ONLY'), ['data.key_es']);
  assert.deepEqual(at(go({ key_en: 'saw' }), 'PHRASE_CLOZE_ONLY'), ['data.key_en']);
  assert.deepEqual(at(go({ turns: turns2() }), 'PHRASE_CLOZE_ONLY'), ['data.turns']);
});
test('una entrada hostil no hace lanzar al validador', () => {
  const hostile = [null, 1, 'x', [], {}, { who: 'A' }, { get es() { throw new Error('boom'); } }];
  for (const h of hostile) {
    assert.doesNotThrow(() => run({ turns: [h, h], key_es: h, key_en: h }));
    assert.doesNotThrow(() => run({ turns: h }));
  }
});
test('un tipo que no es phrase_cloze da solo PHRASE_CLOZE_ONLY (no también KEY_NOT_IN_TEXT)', () => {
  const other = { id: 'gram.modals.0003', type: 'cloze_bank', topics: ['gram.modals.no_to'], level: 'A2', prompt_es: 'Sin esa palabra.', explain_es: 'x', source: 'original', version: 1 };
  const r = validateItem({ ...other, data: { text: 'I ___ it.', answers: [['saw']], key_es: 'jamás' } }, { dataSpecs: DATA_SPECS });
  assert.deepEqual(rules(r), ['PHRASE_CLOZE_ONLY']);
});
test('sin prompt_es y sin turnos: key_es se reporta como ausente, sin lanzar', () => {
  const it = item({ key_es: 'pude' });
  delete it.prompt_es;
  let r;
  assert.doesNotThrow(() => { r = validateItem(it, { dataSpecs: DATA_SPECS }); });
  assert.ok(rules(r).includes('REQUIRED'));
  assert.deepEqual(at(r, 'KEY_NOT_IN_TEXT'), ['data.key_es']);
});
