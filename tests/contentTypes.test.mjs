// @purpose: Pruebas del registro de tipos de ejercicio (core/contentTypes.js).
// Pruebas de core/contentTypes.js (subparte 1.3, cuarto 1, mitad B): registro de tipos de ejercicio del catálogo 8.9.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ITEM_TYPES, FAMILIES, INTEGRATOR_TYPES, typeInfo, isItemType, isIntegratorType, suggestType, typesOfFamily } from '../core/contentTypes.js';

// Lee los tipos DIRECTAMENTE del roadmap (sección 8.9), así la prueba no depende de un conteo a mano.
function roadmapTypes() {
  const md = fs.readFileSync(new URL('../docs/ROADMAP.md', import.meta.url), 'utf8');
  const start = md.indexOf('### 8.9 ');
  const end = md.indexOf('### 8.10 ');
  assert.ok(start > 0 && end > start, 'no se encontró la sección 8.9');
  const rows = md.slice(start, end).split('\n').filter((l) => l.startsWith('|') && !l.startsWith('|---') && !l.startsWith('| Frente'));
  const items = new Set();
  const integrators = new Set();
  for (const row of rows) {
    const cells = row.split('|');
    const names = [...(cells[2] || '').matchAll(/`([a-z_]+)`/g)].map((m) => m[1]);
    const target = /Integradores/.test(cells[1] || '') ? integrators : items;
    for (const n of names) target.add(n);
  }
  return { items, integrators };
}

test('el registro contiene EXACTAMENTE los tipos del roadmap 8.9 (ni uno más, ni uno menos)', () => {
  const { items, integrators } = roadmapTypes();
  assert.ok(items.size >= 80, `se esperaban ≥ 80 tipos y hay ${items.size}`);
  assert.deepEqual(Object.keys(ITEM_TYPES).sort(), [...items].sort());
  assert.deepEqual([...INTEGRATOR_TYPES].sort(), [...integrators].sort());
  assert.equal(integrators.size, 4);
});

test('ningún tipo es a la vez ítem e integrador; los integradores no son ítems', () => {
  for (const t of INTEGRATOR_TYPES) { assert.equal(isItemType(t), false, t); assert.equal(isIntegratorType(t), true, t); assert.equal(typeInfo(t), null, t); }
  for (const t of Object.keys(ITEM_TYPES)) assert.equal(isIntegratorType(t), false, t);
});

test('cada tipo tiene familia conocida y banderas coherentes con la tabla A / IA / Au', () => {
  for (const [t, info] of Object.entries(ITEM_TYPES)) {
    assert.ok(FAMILIES.includes(info.family), `${t}: familia ${info.family}`);
    for (const k of ['auto', 'ai', 'audio', 'acceptRequired']) assert.equal(typeof info[k], 'boolean', `${t}.${k}`);
    assert.ok(info.auto || info.ai, `${t}: debe ser autocalificable o usar IA`);
  }
  for (const f of FAMILIES) assert.ok(typesOfFamily(f).length > 0, `familia vacía: ${f}`);
});

test('familias de ejemplo: autocalificables sin IA, solo-IA, audio y habla', () => {
  for (const t of ['mcq_en_es', 'fix_error', 'order_blocks', 'match_pairs', 'cloze_bank', 'transform', 'read_tfng', 'dictation']) assert.equal(ITEM_TYPES[t].auto, true, t);
  for (const t of ['own_sentence_word', 'own_sentence_grammar', 'explain_rule', 'own_sentence_verb', 'translate_free', 'summarize_one_line', 'write_essay', 'write_email', 'med_summarize', 'med_cross_language']) {
    assert.deepEqual([ITEM_TYPES[t].auto, ITEM_TYPES[t].ai], [false, true], t);
  }
  for (const t of ['dictation', 'cloze_audio', 'connected_speech', 'minimal_pair_listen', 'listen_comprehension', 'what_did_they_say', 'follow_instruction', 'extensive_listening', 'spell_from_audio']) assert.equal(ITEM_TYPES[t].audio, true, t);
  for (const t of ['read_aloud_score', 'echo_repeat', 'voice_chat', 'sound_drill']) assert.equal(ITEM_TYPES[t].family, 'speak', t);
  assert.equal(ITEM_TYPES.mcq_en_es.audio, false);
  assert.equal(ITEM_TYPES.phrase_cloze.audio, true);
});

test('acceptRequired: los tipos que se escriben (y solo esos) exigen `accept`', () => {
  for (const t of ['fill_verb', 'translate_word', 'first_letter', 'fix_error', 'transform', 'keyword_transform', 'join_sentences', 'phrase_cloze', 'pronoun_placement']) assert.equal(ITEM_TYPES[t].acceptRequired, true, t);
  assert.equal(ITEM_TYPES.three_forms.acceptRequired, false, 'three_forms: accept opcional (sus respuestas viven en data.forms)');
  for (const t of ['mcq_en_es', 'choose_correct', 'match_pairs', 'order_blocks', 'own_sentence_word', 'write_essay', 'read_tfng']) assert.equal(ITEM_TYPES[t].acceptRequired, false, t);
});

test('typeInfo / isItemType no se dejan engañar por nombres de Object.prototype ni por valores raros', () => {
  for (const bad of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf', '', ' ', 'MCQ_EN_ES', null, undefined, 5, {}, [], Symbol('x')]) {
    assert.equal(isItemType(bad), false, String(typeof bad));
    assert.equal(typeInfo(bad), null);
  }
  assert.equal(isItemType('fix_error'), true);
  assert.equal(typeInfo('fix_error').family, 'text_input');
});

test('el registro está congelado', () => {
  assert.ok(Object.isFrozen(ITEM_TYPES) && Object.isFrozen(ITEM_TYPES.fix_error) && Object.isFrozen(FAMILIES) && Object.isFrozen(INTEGRATOR_TYPES));
  assert.throws(() => { 'use strict'; ITEM_TYPES.nuevo = {}; });
});

test('suggestType: sugiere el tipo más parecido (hasta 2 ediciones) o null', () => {
  assert.equal(suggestType('fix_eror'), 'fix_error');
  assert.equal(suggestType('mcq_en_es '), 'mcq_en_es');
  assert.equal(suggestType('dictacion'), 'dictation');
  assert.equal(suggestType('zzzzzzzz'), null);
  for (const bad of [null, undefined, 3, {}, '']) assert.equal(suggestType(bad), null);
});

test('habla: autocalificable (Azure) y con IA y audio; las familias reparten los 85 tipos sin dejar ninguno fuera', () => {
  for (const t of typesOfFamily('speak')) assert.deepEqual([ITEM_TYPES[t].auto, ITEM_TYPES[t].ai, ITEM_TYPES[t].audio], [true, true, true], t);
  assert.deepEqual(typesOfFamily('speak').sort(), ['describe_image_speak', 'echo_repeat', 'minimal_pair_speak', 'read_aloud_score', 'rhythm_sentence', 'sound_drill', 'stress_mark', 'voice_chat']);
  assert.deepEqual(typesOfFamily('mediation').sort(), ['med_cross_language', 'med_explain_layperson', 'med_register', 'med_speech_act', 'med_summarize']);
  assert.equal(FAMILIES.reduce((n, f) => n + typesOfFamily(f).length, 0), Object.keys(ITEM_TYPES).length);
  assert.deepEqual(typesOfFamily('no_existe'), []);
});
