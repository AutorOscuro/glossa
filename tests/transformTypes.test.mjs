// @purpose: Pruebas de la lógica pura de transform y keyword_transform (core/transformTypes.js, 2.5-T4 punto 3): oración base, palabra clave, «sin cambios», trampa, detector y códigos de error.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TRANSFORM_TYPES, KEYWORD_TYPES, isTransformType, sourceOf, keywordOf, instructionFor, promptPlan, hasKeyword, gradeTransform } from '../core/transformTypes.js';

const item = (extra = {}) => ({
  id: 'g.cmp.0001', type: 'keyword_transform', prompt_es: 'Usa la palabra clave.',
  accept: ['She is taller than me.', "She's taller than me."],
  distractors: [{ text: 'She is more tall than me.', code: 'CMP.MORE_TALL' }], error_codes: ['CMP.AS'],
  data: { source: 'I am not as tall as her.', instruction_es: 'Reescribe con «taller».', keyword: 'taller' }, ...extra,
});
const withData = (d, extra = {}) => item({ data: { source: 'I am not as tall as her.', instruction_es: null, keyword: null, ...d }, ...extra });
const detect = (t) => (/can to/i.test(t) ? [{ code: 'GRM.CAN_TO', hint: 'Parece que usaste «can to».' }, { code: 'X.SECOND', hint: 'otra' }] : []);

test('TRANSFORM_TYPES e isTransformType: solo los cuatro tipos, y las listas son congeladas', () => {
  assert.deepEqual([...TRANSFORM_TYPES], ['transform', 'keyword_transform', 'join_sentences', 'pronoun_placement']);
  assert.deepEqual([...KEYWORD_TYPES], ['keyword_transform', 'join_sentences']);
  assert.ok(Object.isFrozen(TRANSFORM_TYPES) && Object.isFrozen(KEYWORD_TYPES));
  for (const ok of TRANSFORM_TYPES) assert.equal(isTransformType(ok), true);
  for (const bad of ['fix_error', 'register_shift', '', undefined, null, 5, '__proto__']) assert.equal(isTransformType(bad), false, String(bad));
});

test('sourceOf: sale de data.source sin espacios; vacío, ajeno o sin data es null', () => {
  assert.equal(sourceOf(withData({ source: '  I go.  ' })), 'I go.');
  for (const bad of [undefined, null, '', '   ', 5, {}, []]) assert.equal(sourceOf(withData({ source: bad })), null, String(bad));
  for (const bad of [undefined, null, 'x', 5, [], { data: null }, { data: [] }]) assert.equal(sourceOf(bad), null);
});

test('keywordOf: solo en keyword_transform; en transform es null aunque el ítem la traiga', () => {
  assert.equal(keywordOf(withData({ keyword: ' taller ' }), 'keyword_transform'), 'taller');
  assert.equal(keywordOf(withData({ keyword: 'taller' }), 'transform'), null);
  for (const bad of [undefined, null, '', '  ', 5]) assert.equal(keywordOf(withData({ keyword: bad }), 'keyword_transform'), null, String(bad));
  assert.equal(keywordOf(null, 'keyword_transform'), null);
});

test('instructionFor: data.instruction_es manda, luego prompt_es, luego la de siempre; tipo desconocido lanza', () => {
  assert.equal(instructionFor('keyword_transform', item()), 'Reescribe con «taller».');
  assert.equal(instructionFor('keyword_transform', withData({ instruction_es: '  ' })), 'Usa la palabra clave.');
  assert.equal(instructionFor('keyword_transform', withData({}, { prompt_es: undefined })), 'Reescribe la oración con la palabra clave, sin cambiarla.');
  assert.equal(instructionFor('transform', null), 'Reescribe la oración como se pide.');
  for (const bad of ['fix_error', '', undefined, null]) assert.throws(() => instructionFor(bad, item()), /transformTypes: tipo desconocido/, String(bad));
});

test('promptPlan: instrucción, oración base en inglés y palabra clave (solo keyword_transform)', () => {
  assert.deepEqual(promptPlan(item(), 'keyword_transform'), { instruction: 'Reescribe con «taller».', main: { text: 'I am not as tall as her.', lang: 'en' }, keyword: 'taller' });
  assert.equal(promptPlan(item(), 'transform').keyword, null);
  assert.equal(promptPlan(withData({ source: '' }), 'transform').main, null);
  assert.throws(() => promptPlan(item(), 'fix_error'), /promptPlan: tipo desconocido/);
});

test('hasKeyword: palabra entera, sin mayúsculas ni apóstrofos tipográficos; «does» no es «do»', () => {
  assert.equal(hasKeyword('She is Taller than me.', 'taller'), true);
  assert.equal(hasKeyword('She is tall than me.', 'taller'), false);
  assert.equal(hasKeyword('She does it', 'do'), false);
  assert.equal(hasKeyword('I do it', 'DO'), true);
  assert.equal(hasKeyword('It’s mine', "it's"), true);
  assert.equal(hasKeyword('Take good care of it', 'take care of'), false);
  assert.equal(hasKeyword('I take care of it', 'take care of'), true);
  assert.equal(hasKeyword('anything', ''), true);
  assert.equal(hasKeyword('anything', null), true);
  assert.equal(hasKeyword(null, 'x'), false);
});

test('acierta con cualquier versión válida y con contracciones; nada extra', () => {
  for (const ok of ['She is taller than me.', "She's taller than me.", 'she is taller than me']) {
    const g = gradeTransform(item(), ok, 'keyword_transform', { detect });
    assert.equal(g.result, 'correct', ok);
    assert.deepEqual([g.unchanged, g.keywordMissing, g.trap, g.hits, g.hint], [false, false, null, [], null]);
    assert.equal(g.keyword, 'taller');
  }
});

test('vacío: wrong con empty, sin extras ni detector', () => {
  let calls = 0;
  const g = gradeTransform(item(), '   ', 'keyword_transform', { detect: () => { calls += 1; return []; } });
  assert.equal(g.empty, true);
  assert.deepEqual([g.unchanged, g.keywordMissing, g.trap], [false, false, null]);
  assert.equal(calls, 0);
});

test('sin cambios: wrong, unchanged y los error_codes del ítem; no consulta al detector', () => {
  let calls = 0;
  const g = gradeTransform(item(), 'I am not as tall as her', 'keyword_transform', { detect: () => { calls += 1; return []; } });
  assert.equal(g.result, 'wrong');
  assert.equal(g.unchanged, true);
  assert.deepEqual(g.errorCodes, ['CMP.AS']);
  assert.equal(g.keywordMissing, false);
  assert.equal(calls, 0);
});

test('sin cambios gana a almost aunque compare vea la oración cerca de una válida', () => {
  const compare = (typed, list) => (list[0] === 'I am not as tall as her.' ? { result: 'correct' } : { result: 'almost', matched: list[0], errorCodes: [] });
  const g = gradeTransform(item(), 'I am not as tall as her.', 'keyword_transform', { compare });
  assert.equal(g.result, 'wrong');
  assert.equal(g.unchanged, true);
});

test('palabra clave ausente: wrong con keywordMissing; con la clave puesta no se marca', () => {
  const miss = gradeTransform(item(), 'She is bigger than me.', 'keyword_transform');
  assert.equal(miss.result, 'wrong');
  assert.equal(miss.keywordMissing, true);
  const has = gradeTransform(item(), 'She is taller than I am.', 'keyword_transform');
  assert.equal(has.result, 'wrong');
  assert.equal(has.keywordMissing, false);
});

test('transform y un ítem sin clave nunca marcan keywordMissing', () => {
  assert.equal(gradeTransform(item(), 'She is bigger than me.', 'transform').keywordMissing, false);
  assert.equal(gradeTransform(withData({ keyword: null }, { distractors: [] }), 'She is bigger than me.', 'keyword_transform').keywordMissing, false);
});

test('keywordMissing no cambia el resultado: una errata de la clave sigue siendo almost', () => {
  const compare = () => ({ result: 'almost', matched: 'She is taller than me.', errorCodes: [], spellingFlags: [{ word: 'tallr', expected: 'taller' }] });
  const g = gradeTransform(item(), 'She is tallr than me.', 'keyword_transform', { compare });
  assert.equal(g.result, 'almost');
  assert.equal(g.keywordMissing, false);
  assert.deepEqual([g.trap, g.hits, g.hint], [null, [], null]);
});

test('trampa conocida: wrong con trap y su código; el detector no manda sobre ella', () => {
  const g = gradeTransform(item(), 'She is more tall than me.', 'keyword_transform', { detect });
  assert.equal(g.result, 'wrong');
  assert.deepEqual(g.trap, { text: 'She is more tall than me.', code: 'CMP.MORE_TALL' });
  assert.ok(g.errorCodes.includes('CMP.MORE_TALL'));
  assert.equal(g.unchanged, false);
});

test('detector: solo si es wrong; su pista y su código principal viajan', () => {
  const g = gradeTransform(item({ distractors: [] }), 'She can to run taller.', 'keyword_transform', { detect });
  assert.equal(g.result, 'wrong');
  assert.equal(g.hits.length, 2);
  assert.equal(g.hint, 'Parece que usaste «can to».');
  assert.ok(g.errorCodes.includes('GRM.CAN_TO'));
  assert.ok(!g.errorCodes.includes('X.SECOND'));
});

test('si el detector lanza o devuelve basura, la calificación sigue', () => {
  const a = gradeTransform(item({ distractors: [] }), 'She is bigger.', 'keyword_transform', { detect: () => { throw new Error('boom'); } });
  assert.equal(a.result, 'wrong');
  assert.deepEqual(a.hits, []);
  for (const junk of [null, 5, 'x', [null, 3]]) {
    const b = gradeTransform(item({ distractors: [] }), 'She is bigger.', 'keyword_transform', { detect: () => junk });
    assert.deepEqual(b.hits, []);
    assert.equal(b.hint, null);
  }
});

test('un ítem sin accept o un tipo desconocido lanzan en español', () => {
  assert.throws(() => gradeTransform(item({ accept: [] }), 'x', 'keyword_transform'), /accept/);
  assert.throws(() => gradeTransform(null, 'x', 'keyword_transform'), /ítem/);
  assert.throws(() => gradeTransform(item(), 'x', 'fix_error'), /gradeTransform: tipo desconocido/);
});

test('la pista del detector llega sin espacios en los bordes', () => {
  const g = gradeTransform(item({ distractors: [] }), 'She is bigger.', 'keyword_transform', { detect: () => [{ code: 'A.B', hint: '  Mira el orden.  ' }] });
  assert.equal(g.hint, 'Mira el orden.');
});

test('un resultado raro de compare nunca cuela: lo que no acierta ni es errata queda en wrong', () => {
  const g = gradeTransform(item({ distractors: [] }), 'She is bigger.', 'keyword_transform', { compare: () => ({ result: 'maybe' }) });
  assert.equal(g.result, 'wrong');
});

test('una palabra clave al final del texto y más larga que el texto se resuelve sin error', () => {
  assert.equal(hasKeyword('taller', 'taller'), true);
  assert.equal(hasKeyword('tall', 'very tall indeed'), false);
  assert.equal(hasKeyword('', 'taller'), false);
});

const JOIN = (extra = {}) => ({
  id: 'g.join.0001', type: 'join_sentences', prompt_es: 'Une las oraciones.',
  accept: ['I stayed home because it was raining.', 'Because it was raining, I stayed home.'],
  distractors: [{ text: 'I stayed home because was raining.', code: 'GRM.MISSING_SUBJ' }], error_codes: ['GRM.MISSING_SUBJ'],
  data: { source: 'It was raining. I stayed home.', instruction_es: null, keyword: 'because' }, ...extra,
});
const PRON = (extra = {}) => ({
  id: 'v.pron.0001', type: 'pronoun_placement', prompt_es: 'Cambia el objeto por un pronombre.', prompt_en: 'Pick up the box.',
  accept: ['Pick it up.'], distractors: [{ text: 'Pick up it.', code: 'PHR.PRON_AFTER' }], error_codes: ['PHR.PRON_AFTER'], data: {}, ...extra,
});

test('join_sentences: el conector sale de data.keyword, la instrucción por defecto es de unir y la base es data.source', () => {
  assert.equal(keywordOf(JOIN(), 'join_sentences'), 'because');
  assert.equal(keywordOf(JOIN({ data: { source: 'a', instruction_es: null, keyword: null } }), 'join_sentences'), null);
  assert.deepEqual(promptPlan(JOIN(), 'join_sentences'), { instruction: 'Une las oraciones.', main: { text: 'It was raining. I stayed home.', lang: 'en' }, keyword: 'because' });
  assert.equal(instructionFor('join_sentences', null), 'Une las oraciones en una sola.');
});

test('join_sentences: acierta con cualquier orden válido; sin conector es wrong con keywordMissing; copiar las dos oraciones es «sin cambios»', () => {
  for (const ok of ['I stayed home because it was raining.', 'because it was raining, I stayed home']) assert.equal(gradeTransform(JOIN(), ok, 'join_sentences').result, 'correct', ok);
  const miss = gradeTransform(JOIN(), 'I stayed home and it was raining.', 'join_sentences');
  assert.deepEqual([miss.result, miss.keywordMissing, miss.keyword], ['wrong', true, 'because']);
  const same = gradeTransform(JOIN(), 'It was raining. I stayed home.', 'join_sentences');
  assert.deepEqual([same.result, same.unchanged, same.errorCodes], ['wrong', true, ['GRM.MISSING_SUBJ']]);
  const trap = gradeTransform(JOIN(), 'I stayed home because was raining.', 'join_sentences');
  assert.deepEqual(trap.trap, { text: 'I stayed home because was raining.', code: 'GRM.MISSING_SUBJ' });
});

test('pronoun_placement: la oración base es prompt_en; data.source manda si existe; en otros tipos prompt_en NO es la base', () => {
  assert.equal(sourceOf(PRON(), 'pronoun_placement'), 'Pick up the box.');
  assert.equal(sourceOf(PRON({ data: { source: 'Put on the coat.' } }), 'pronoun_placement'), 'Put on the coat.');
  assert.equal(sourceOf(PRON()), null);
  assert.equal(sourceOf(PRON(), 'transform'), null);
  assert.equal(sourceOf(PRON({ prompt_en: '  ' }), 'pronoun_placement'), null);
  assert.equal(sourceOf(null, 'pronoun_placement'), null);
  assert.deepEqual(promptPlan(PRON(), 'pronoun_placement'), { instruction: 'Cambia el objeto por un pronombre.', main: { text: 'Pick up the box.', lang: 'en' }, keyword: null });
  assert.equal(instructionFor('pronoun_placement', null), 'Cambia el objeto por un pronombre y colócalo bien.');
});

test('pronoun_placement: «Pick it up» acierta; «Pick up it» es la trampa con su código; dejar la oración es «sin cambios»; nunca hay clave', () => {
  assert.equal(gradeTransform(PRON(), 'pick it up', 'pronoun_placement').result, 'correct');
  const trap = gradeTransform(PRON(), 'Pick up it.', 'pronoun_placement');
  assert.deepEqual([trap.result, trap.trap?.code, trap.keywordMissing], ['wrong', 'PHR.PRON_AFTER', false]);
  assert.ok(trap.errorCodes.includes('PHR.PRON_AFTER'));
  const same = gradeTransform(PRON(), 'Pick up the box', 'pronoun_placement');
  assert.deepEqual([same.result, same.unchanged], ['wrong', true]);
  assert.equal(gradeTransform(PRON({ data: { keyword: 'it' } }), 'Pick up them.', 'pronoun_placement').keyword, null);
});
