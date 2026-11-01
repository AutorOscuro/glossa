// @purpose: Cierra las roturas vivas de la primera ronda de core/textErrors.js (2.5-T5): bordes de texto, mayúsculas, apóstrofos, topes y dedupe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectHits, withDetection, errorEntries } from '../core/textErrors.js';

const ALL = { has: () => true, hint: () => 'h' };
const wrong = (typed, extra = {}) => ({ result: 'wrong', typed, empty: false, errorCodes: [], ...extra });
const almost = (typed, word, extra = {}) => ({ result: 'almost', typed, empty: false, errorCodes: [], spellingFlags: [{ word }], ...extra });

test('detectHits: un texto en blanco no llega al detector', () => {
  let calls = 0;
  const detect = () => { calls += 1; return [{ code: 'A.B' }]; };
  assert.deepEqual(detectHits(detect, '   '), []);
  assert.deepEqual(detectHits(detect, ''), []);
  assert.equal(calls, 0);
  assert.equal(detectHits(detect, 'x').length, 1);
});

test('withDetection: el código del aviso se limpia, no se suma en blanco ni si no es texto, y no se repite', () => {
  const run = (code, prev = []) => withDetection(wrong('x', { errorCodes: prev }), { detect: () => [{ code, hint: ' pista ' }] });
  assert.deepEqual(run('  A.B  ').errorCodes, ['A.B']);
  assert.deepEqual(run('   ').errorCodes, []);
  assert.doesNotThrow(() => run(5));
  assert.deepEqual(run(5).errorCodes, []);
  assert.deepEqual(run('A.B', ['A.B']).errorCodes, ['A.B']);
  assert.equal(run('A.B').hint, 'pista');
  const bare = withDetection({ result: 'wrong', typed: 'x', empty: false }, { detect: () => [{ code: 'A.B' }] });
  assert.deepEqual(bare.errorCodes, ['A.B']);
});

test('promoción de «casi»: mayúsculas, apóstrofos y prefijo SPELL.', () => {
  const det = (hit) => () => [hit];
  assert.equal(withDetection(almost('They had CAME', 'came'), { detect: det({ code: 'TNS.X', text: 'HAD CAME' }) }).promoted, true);
  assert.equal(withDetection(almost('They had came', 'Came'), { detect: det({ code: 'TNS.X', text: 'had came' }) }).promoted, true);
  assert.equal(withDetection(almost("It isn't", "isn't"), { detect: det({ code: 'TNS.X', text: "isn't" }) }).promoted, true);
  assert.equal(withDetection(almost("It isn't", 'isn'), { detect: det({ code: 'TNS.X', text: "isn't" }) }).result, 'almost');
  assert.equal(withDetection(almost('had came', 'came'), { detect: det({ code: 'SPELL.X', text: 'came' }) }).result, 'almost');
  assert.equal(withDetection(almost('had came', 'came'), { detect: det({ code: 'SPELLER.X', text: 'came' }) }).promoted, true);
  assert.equal(withDetection(almost('had came', 'came'), { detect: det({ code: 'TNS.X', text: 'other' }) }).result, 'almost');
});

test('errorEntries: tope por max (entero, positivo, máximo 20)', () => {
  const hits = Array.from({ length: 30 }, (_, i) => ({ code: `C.${i}`, text: `t${i}` }));
  const g = wrong('x', { hits });
  const n = (max) => errorEntries({}, g, { catalog: ALL, max }).length;
  assert.equal(n(50), 20);
  assert.equal(n(3), 3);
  assert.equal(n(2.5), 5);
  assert.equal(n('3'), 5);
  assert.equal(n(0), 5);
  assert.equal(n(undefined), 5);
});

test('errorEntries: respuestas aceptadas en blanco o no texto se saltan', () => {
  const g = wrong('x', { hits: [{ code: 'C.1', text: 'tt' }] });
  assert.equal(errorEntries({ accept: [null, '  ', 'good'] }, g, { catalog: ALL })[0].correction, 'good');
  assert.equal(errorEntries({ accept: ['  ', 'good'] }, g, { catalog: ALL })[0].correction, 'good');
});

test('errorEntries: un tema demasiado largo se descarta', () => {
  const long = `a.${'b'.repeat(120)}`;
  const e = errorEntries({ topics: [long, 'gram.ok'] }, wrong('x', { hits: [{ code: 'C.1', text: 'tt' }] }), { catalog: ALL })[0];
  assert.deepEqual(e.topics, ['gram.ok']);
});

test('errorEntries: avisos sin código o sin ningún texto no producen entrada', () => {
  const g = { result: 'wrong', empty: false, hits: [{ code: null, text: 'a' }, { code: '', text: 'a' }, { code: 'C.1' }] };
  assert.deepEqual(errorEntries({}, g, { catalog: ALL }), []);
  assert.deepEqual(errorEntries({}, { result: 'wrong', trap: { code: 'C.1' } }, { catalog: ALL }), []);
  assert.equal(errorEntries({}, { result: 'wrong', typed: 'zz', trap: { code: 'C.1' } }, { catalog: ALL })[0].original, 'zz');
});
