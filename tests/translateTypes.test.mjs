// @purpose: Pruebas de la lógica pura de trap_translate y translate_bank (core/translateTypes.js, 2.5-T3 punto 3): instrucción, banco, plan del enunciado y trampa conocida.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRANSLATE_TYPES, BANK_MAX, isTranslateType, instructionFor, bankOf, promptPlan, trapOf, gradeTranslation } from '../core/translateTypes.js';

const item = (extra = {}) => ({
  id: 't.age', type: 'trap_translate', prompt_es: ' Tengo 20 años. ',
  accept: ['I am 20 years old.', "I'm 20 years old."],
  distractors: [{ text: 'I have 20 years.', code: 'LEX.HAVE_AGE' }, { text: 'I am 20 years.', code: 'LEX.AGE_OLD' }],
  data: { bank: ['I', 'am', 'have', '20', 'years', 'old'] }, ...extra,
});

test('los dos tipos y su reconocimiento', () => {
  assert.deepEqual([...TRANSLATE_TYPES], ['trap_translate', 'translate_bank']);
  assert.ok(Object.isFrozen(TRANSLATE_TYPES));
  assert.equal(isTranslateType('trap_translate'), true);
  assert.equal(isTranslateType('translate_bank'), true);
  for (const bad of ['fill_verb', '', null, undefined, 7, {}]) assert.equal(isTranslateType(bad), false);
});

test('instructionFor: una por tipo; el banco se nombra solo en translate_bank; un tipo desconocido lanza', () => {
  assert.equal(instructionFor('trap_translate'), 'Traduce al inglés.');
  assert.equal(instructionFor('translate_bank'), 'Traduce al inglés con las palabras del banco.');
  assert.throws(() => instructionFor('fill_verb'), /tipo desconocido \(fill_verb\)/);
  assert.throws(() => instructionFor(undefined), /tipo desconocido/);
  assert.throws(() => instructionFor('x'.repeat(100)), (e) => e.message.length < 90);
});

test('bankOf recorta, descarta vacíos y no-textos, quita repetidos exactos y respeta el tope', () => {
  assert.deepEqual(bankOf(item({ data: { bank: [' I ', 'am', '', '  ', 7, null, 'am', 'Am'] } })), ['I', 'am', 'Am']);
  for (const d of [undefined, null, {}, { bank: 'I am' }, { bank: {} }]) assert.deepEqual(bankOf(item({ data: d })), []);
  assert.deepEqual(bankOf(null), []);
  assert.equal(bankOf(item({ data: { bank: Array.from({ length: 50 }, (_, i) => `w${i}`) } })).length, BANK_MAX);
  assert.equal(BANK_MAX, 30);
});

test('promptPlan: instrucción, frase en español recortada y banco solo en translate_bank', () => {
  const t = promptPlan(item(), 'trap_translate');
  assert.deepEqual(t, { instruction: 'Traduce al inglés.', main: { text: 'Tengo 20 años.', lang: 'es' }, bank: [] });
  const b = promptPlan(item(), 'translate_bank');
  assert.equal(b.instruction, 'Traduce al inglés con las palabras del banco.');
  assert.deepEqual(b.bank, ['I', 'am', 'have', '20', 'years', 'old']);
  assert.equal(promptPlan(item({ prompt_es: '  ' }), 'trap_translate').main, null);
  assert.equal(promptPlan({}, 'translate_bank').main, null);
  assert.throws(() => promptPlan(item(), 'mcq'), /tipo desconocido/);
});

test('trapOf: coincide con el distractor aunque cambien mayúsculas, espacios o puntuación final; una errata no cuenta', () => {
  assert.deepEqual(trapOf(item(), '  i have 20 years  '), { text: 'I have 20 years.', code: 'LEX.HAVE_AGE' });
  assert.deepEqual(trapOf(item(), 'I am 20 years.'), { text: 'I am 20 years.', code: 'LEX.AGE_OLD' });
  assert.equal(trapOf(item(), 'I hav 20 years'), null);
  assert.equal(trapOf(item(), 'I am 20 years old.'), null);
});

test('trapOf: sin distractores válidos, vacío o código ausente', () => {
  assert.equal(trapOf(item({ distractors: undefined }), 'I have 20 years'), null);
  assert.equal(trapOf(item({ distractors: 'x' }), 'I have 20 years'), null);
  assert.equal(trapOf(item({ distractors: [null, 7, {}, { text: ' ' }, { text: 5 }] }), 'I have 20 years'), null);
  assert.equal(trapOf(item(), ''), null);
  assert.equal(trapOf(item(), '   '), null);
  assert.equal(trapOf(item(), undefined), null);
  assert.deepEqual(trapOf(item({ distractors: [{ text: 'I have 20 years.' }] }), 'I have 20 years'), { text: 'I have 20 years.', code: null });
  assert.deepEqual(trapOf(item({ distractors: [{ text: 'I have 20 years.', code: '  ' }] }), 'I have 20 years'), { text: 'I have 20 years.', code: null });
  assert.deepEqual(trapOf(item({ distractors: [{ text: ' I have 20 years. ', code: ' LEX.X ' }] }), 'I have 20 years'), { text: 'I have 20 years.', code: 'LEX.X' });
});

test('trapOf devuelve el primero que coincide y usa el compare inyectado', () => {
  const dup = item({ distractors: [{ text: 'I have 20 years.', code: 'A' }, { text: 'I have 20 years.', code: 'B' }] });
  assert.equal(trapOf(dup, 'I have 20 years').code, 'A');
  const seen = [];
  const compare = (typed, accept, o) => { seen.push([typed, accept, o]); return { result: 'correct' }; };
  assert.equal(trapOf(item(), ' xyz ', { compare }).code, 'LEX.HAVE_AGE');
  assert.deepEqual(seen[0], ['xyz', ['I have 20 years.'], {}]);
});

test('gradeTranslation: un acierto es correct y sin trampa', () => {
  const g = gradeTranslation(item(), "I'm 20 years old");
  assert.equal(g.result, 'correct');
  assert.equal(g.trap, null);
  assert.equal(g.empty, false);
  assert.deepEqual(g.errorCodes, []);
});

test('gradeTranslation: la trampa conocida es wrong con su código; otro error no trae trampa', () => {
  const g = gradeTranslation(item(), 'I have 20 years');
  assert.equal(g.result, 'wrong');
  assert.deepEqual(g.trap, { text: 'I have 20 years.', code: 'LEX.HAVE_AGE' });
  assert.deepEqual(g.errorCodes, ['LEX.HAVE_AGE']);
  assert.equal(g.typed, 'I have 20 years');
  const other = gradeTranslation(item(), 'The cat sleeps');
  assert.equal(other.trap, null);
  assert.equal(other.result, 'wrong');
});

test('gradeTranslation: la trampa fuerza wrong aunque compare la viera cercana, y el código no se repite', () => {
  const near = (typed) => ({ result: typed === 'I have 20 years' ? 'almost' : 'wrong', matched: null, diff: [], spellingFlags: [], errorCodes: ['LEX.HAVE_AGE', 'X'] });
  const compare = (typed, accept) => (accept[0] === 'I have 20 years.' ? { result: typed.toLowerCase() === 'i have 20 years' ? 'correct' : 'wrong' } : near(typed));
  const g = gradeTranslation(item(), 'I have 20 years', { compare });
  assert.equal(g.result, 'wrong');
  assert.deepEqual(g.errorCodes, ['LEX.HAVE_AGE', 'X']);
  const g2 = gradeTranslation(item({ distractors: [{ text: 'I have 20 years.', code: 'NEW' }] }), 'I have 20 years', { compare });
  assert.deepEqual(g2.errorCodes, ['LEX.HAVE_AGE', 'X', 'NEW']);
});

test('gradeTranslation: vacío no busca trampa; si acierta manda accept aunque sea un distractor', () => {
  const e = gradeTranslation(item(), '   ');
  assert.equal(e.empty, true);
  assert.equal(e.trap, null);
  const same = gradeTranslation(item({ accept: ['I have 20 years.'] }), 'I have 20 years');
  assert.equal(same.result, 'correct');
  assert.equal(same.trap, null);
});

test('gradeTranslation: un ítem sin accept lanza Error en español', () => {
  assert.throws(() => gradeTranslation(item({ accept: [] }), 'x'), /no tiene respuestas aceptadas/);
  assert.throws(() => gradeTranslation(null, 'x'), /no es un objeto/);
});

test('una errata del distractor («casi») no es la trampa: solo lo exacto cuenta', () => {
  assert.equal(trapOf(item(), 'I have 20 yeers'), null);
  const g = gradeTranslation(item(), 'I have 20 yeers');
  assert.equal(g.trap, null);
  assert.deepEqual(g.errorCodes, []);
});

test('una trampa sin código no mete null en errorCodes', () => {
  const g = gradeTranslation(item({ distractors: [{ text: 'I have 20 years.' }] }), 'I have 20 years');
  assert.equal(g.result, 'wrong');
  assert.deepEqual(g.trap, { text: 'I have 20 years.', code: null });
  assert.deepEqual(g.errorCodes, []);
});
