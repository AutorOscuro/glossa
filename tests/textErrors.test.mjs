// @purpose: Pruebas de core/textErrors.js (2.5-T5): detectHits, withDetection (incluida la promoción de «casi») y errorEntries con entradas hostiles y un fuzz de semilla fija.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createErrorCatalog } from '../core/errorCatalog.js';
import { createErrors, LIMITS } from '../core/errors.js';
import { createMemoryDb } from '../core/db.memory.js';
import { gradeText } from '../core/textAnswer.js';
import { createErrorDetector } from '../core/errorDetect.js';
import { detectHits, withDetection, errorEntries, MAX_TEXT_ERRORS } from '../core/textErrors.js';
import { makeClock } from './_helpers.mjs';

const CATALOG = createErrorCatalog(JSON.parse(fs.readFileSync(new URL('../content/taxonomy/error_codes.json', import.meta.url), 'utf8')));
const DETECT = createErrorDetector({ catalog: CATALOG }).detect;
const ERRORS = createErrors({ db: createMemoryDb(), catalog: CATALOG, clock: makeClock() });
const wrong = (typed, extra = {}) => ({ result: 'wrong', typed, empty: false, errorCodes: [], ...extra });

test('detectHits: nunca lanza y solo devuelve objetos', () => {
  for (const d of [undefined, null, 5, 'x', {}, () => { throw new Error('x'); }, () => null, () => 'a', () => [1, null, 'a', { code: 'X' }, [2]]]) {
    assert.doesNotThrow(() => detectHits(d, 'leaved'));
  }
  assert.deepEqual(detectHits(() => [1, null, 'a', { code: 'X' }, [2]], 'abc'), [{ code: 'X' }]);
  for (const t of [undefined, null, 5, '', '   ', {}]) assert.deepEqual(detectHits(DETECT, t), []);
  assert.equal(detectHits(DETECT, 'He leaved early')[0].code, 'VRB.IRREG_REGULARIZE');
});

test('withDetection: una respuesta mala suma pista, avisos y el código; no muta la entrada', () => {
  const g = wrong('He leaved early', { errorCodes: ['X.PREV'] });
  const copy = JSON.stringify(g);
  const out = withDetection(g, { detect: DETECT });
  assert.equal(JSON.stringify(g), copy);
  assert.equal(out.hits[0].code, 'VRB.IRREG_REGULARIZE');
  assert.equal(typeof out.hint, 'string');
  assert.deepEqual(out.errorCodes, ['X.PREV', 'VRB.IRREG_REGULARIZE']);
  assert.deepEqual(withDetection(out, { detect: DETECT }), out, 'idempotente: ya trae hits');
});

test('withDetection: sin aviso, hits [] y hint null; con trampa su código manda y el del detector no se suma', () => {
  const none = withDetection(wrong('stayed'), { detect: DETECT });
  assert.deepEqual([none.hits, none.hint, none.errorCodes], [[], null, []]);
  const trap = withDetection(wrong('He leaved early', { trap: { code: 'LEX.TRAP', text: 'x' }, errorCodes: ['LEX.TRAP'] }), { detect: DETECT });
  assert.deepEqual(trap.errorCodes, ['LEX.TRAP']);
  assert.equal(trap.hits[0].code, 'VRB.IRREG_REGULARIZE');
  assert.equal(typeof trap.hint, 'string');
});

test('withDetection: acierto, «no sé», vacío y no-objetos pasan sin tocar', () => {
  for (const g of [{ result: 'correct', typed: 'leaved' }, { result: 'dont_know' }, wrong('leaved', { empty: true }), null, undefined, 5, 'x', [], { result: 'wrong', typed: 'leaved', hits: [] }]) {
    assert.equal(withDetection(g, { detect: DETECT }), g);
  }
  assert.doesNotThrow(() => withDetection(wrong('leaved')));
  assert.doesNotThrow(() => withDetection(wrong('leaved'), null));
});

test('withDetection: «casi» pasa a «mal» solo con un aviso de gramática que cubre la palabra marcada', () => {
  const near = (typed, accept) => gradeText({ type: 'fix_error', accept: [accept] }, typed, {});
  const came = near('They had came late.', 'They had come late.');
  assert.equal(came.result, 'almost');
  const p = withDetection(came, { detect: DETECT });
  assert.equal(p.result, 'wrong');
  assert.equal(p.promoted, true);
  assert.deepEqual(p.spellingFlags, []);
  assert.equal(p.hits[0].code, 'TNS.PERF_FORM');
  assert.ok(p.errorCodes.includes('TNS.PERF_FORM'));
  for (const [typed, accept] of [['He has writen it.', 'He has written it.'], ['I pased the exam.', 'I passed the exam.'], ['Yesterday I paseed the exam.', 'Yesterday I passed the exam.']]) {
    const g = near(typed, accept);
    assert.equal(g.result, 'almost', typed);
    assert.equal(withDetection(g, { detect: DETECT }), g, `${typed}: una errata no se promueve`);
  }
  const unrelated = { result: 'almost', typed: 'x', spellingFlags: [{ word: 'zzz', expected: 'zz', index: 0 }] };
  assert.equal(withDetection(unrelated, { detect: () => [{ code: 'TNS.PERF_FORM', text: 'had came' }] }), unrelated, 'el aviso no cubre la palabra marcada');
  assert.equal(withDetection({ ...unrelated, spellingFlags: [{ word: 'came' }] }, { detect: () => [{ code: 'SPELL.GENERAL', text: 'came' }] }).result, 'almost', 'SPELL.* nunca promueve');
});

test('errorEntries: forma de la entrada, corrección aceptada, contexto y temas; solo con result wrong y catálogo', () => {
  const item = { accept: ['left', 'went away'], situation: 'En la oficina', topics: ['gram.past_simple', 'MAL TEMA', 'gram.past_simple'] };
  const g = withDetection(wrong('He leaved early'), { detect: DETECT });
  assert.deepEqual(errorEntries(item, g, { catalog: CATALOG }), [{ code: 'VRB.IRREG_REGULARIZE', original: 'leaved', correction: 'left', context: 'En la oficina', topics: ['gram.past_simple'] }]);
  assert.deepEqual(errorEntries(item, { ...g, matched: 'went away' }, { catalog: CATALOG })[0].correction, 'went away');
  for (const bad of [undefined, null, {}, { has: () => true }, { hint: () => 'x' }, 5, 'x']) assert.deepEqual(errorEntries(item, g, { catalog: bad }), []);
  for (const r of ['correct', 'almost', 'dont_know', undefined]) assert.deepEqual(errorEntries(item, { ...g, result: r }, { catalog: CATALOG }), []);
  assert.deepEqual(errorEntries(item, { ...g, unchanged: true }, { catalog: CATALOG }), []);
  assert.deepEqual(errorEntries(item, null, { catalog: CATALOG }), []);
  assert.deepEqual(errorEntries(null, g, { catalog: CATALOG }).map((e) => e.code), ['VRB.IRREG_REGULARIZE']);
});

test('errorEntries: la trampa va primero, sin repetir código + texto, con tope y solo códigos que existen', () => {
  const cat = { has: (c) => ['A.ONE', 'B.TWO', 'C.THREE', 'D.FOUR', 'E.FIVE', 'F.SIX', 'G.SEVEN'].includes(c), hint: () => null };
  const hits = ['A.ONE', 'B.TWO', 'C.THREE', 'D.FOUR', 'E.FIVE', 'F.SIX', 'G.SEVEN', 'Z.NOPE'].map((code, i) => ({ code, text: `t${i}` }));
  const g = wrong('abc', { trap: { code: 'B.TWO', text: 't1' }, hits: [...hits, { code: 'A.ONE', text: 't0' }, { code: 'A.ONE', text: ' T0 ' }] });
  const out = errorEntries({ accept: ['x'] }, g, { catalog: cat });
  assert.equal(out.length, MAX_TEXT_ERRORS);
  assert.deepEqual(out.map((e) => e.code), ['B.TWO', 'A.ONE', 'C.THREE', 'D.FOUR', 'E.FIVE']);
  assert.equal(errorEntries({ accept: ['x'] }, g, { catalog: cat, max: 2 }).length, 2);
  assert.equal(errorEntries({ accept: ['x'] }, g, { catalog: cat, max: 999 }).length, 7);
  assert.equal(errorEntries({ accept: ['x'] }, g, { catalog: cat, max: -1 }).length, MAX_TEXT_ERRORS);
  assert.equal(errorEntries({ accept: ['x'] }, g, { catalog: { has: () => { throw new Error('x'); }, hint: () => null } }).length, 0);
});

test('errorEntries: un aviso sin trozo usa lo escrito; textos largos y caracteres de control quedan dentro de LIMITS y errors.prepare los acepta', () => {
  const cat = { has: () => true, hint: () => null };
  const long = 'a'.repeat(900);
  const g = wrong(`${long}\u0000\u0007 end`, { hits: [{ code: 'X.ONE' }, { code: 'X.TWO', text: `${long}\u0001` }] });
  const out = errorEntries({ accept: [`${long}\u0002`], situation: `${long}\u0003`, topics: ['x'.repeat(300), ...Array.from({ length: 30 }, (_, i) => `t.n${i}`)] }, g, { catalog: cat });
  assert.equal(out.length, 2);
  for (const e of out) {
    assert.ok(e.original.length <= LIMITS.original && e.correction.length <= LIMITS.correction && e.context.length <= LIMITS.context);
    assert.ok(e.topics.length <= LIMITS.topics);
    assert.doesNotMatch(JSON.stringify(e), /\\u0000|\\u0001|\\u0002|\\u0003|\\u0007/);
  }
});

// Fuzz con semilla fija: 600 respuestas al azar sobre 40 trozos reales y basura; nunca lanza y toda entrada la acepta errors.prepare.
test('fuzz de 600 respuestas (semilla fija): sin excepciones, forma válida, tope y entradas aceptadas por errors.prepare', () => {
  let s = 20261031;
  const next = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const pick = (a) => a[Math.floor(next() * a.length)];
  const BITS = ['He leaved', 'We eated', 'She can to swim', "didn't went", 'I have went', 'since two years', "don't know nothing", 'interested about', 'Where live she', 'avoid to speak',
    'Is very important', 'Despite of', 'came', 'had came', 'writen', 'hello', 'the', 'a lot', '', ' ', '\u0000', '😀', '…', 'İ', 'ß', 'x'.repeat(50), "it's", "I'm", '___', '<b>', '__proto__', 'constructor'];
  const ACCEPT = [['left'], ['She can swim.', 'She is able to swim.'], ['I have gone.'], [], ['  '], ['x'.repeat(700)]];
  for (let i = 0; i < 600; i += 1) {
    const typed = Array.from({ length: 1 + Math.floor(next() * 5) }, () => pick(BITS)).join(pick([' ', '  ', '', '. ']));
    const item = { type: 'fix_error', accept: pick(ACCEPT), situation: pick(['', 'Oficina', 'x'.repeat(400), null]), topics: pick([[], ['gram.past_simple'], ['mal'], null]) };
    const base = { result: pick(['wrong', 'wrong', 'almost', 'correct', 'dont_know']), typed, empty: typed.trim() === '', errorCodes: [], spellingFlags: pick([[], [{ word: 'came', expected: 'come', index: 2 }]]) };
    let g; let out;
    assert.doesNotThrow(() => { g = withDetection(base, { detect: DETECT }); out = errorEntries(item, g, { catalog: CATALOG }); }, JSON.stringify(typed));
    assert.ok(out.length <= MAX_TEXT_ERRORS);
    if (g.result !== 'wrong') assert.deepEqual(out, []);
    for (const e of out) assert.doesNotThrow(() => ERRORS.prepare({ ...e, itemId: 'fuzz' }), JSON.stringify([typed, e]));
  }
});
