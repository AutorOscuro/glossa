// @purpose: Pruebas de la lógica pura de fix_error (core/fixError.js, 2.5-T4 punto 1): oración con error, «sin cambios», trampa, detector y códigos de error.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FIX_TYPE, sentenceOf, promptPlan, gradeFix } from '../core/fixError.js';

const item = (extra = {}) => ({
  id: 'g.pp.0001', type: 'fix_error', prompt_es: 'Corrige el error en la oración.', prompt_en: "I'm living here since two years.",
  accept: ["I've lived here for two years.", 'I have lived here for two years.', "I've been living here for two years."],
  distractors: [{ text: 'I live here since two years.', code: 'TNS.SINCE_FOR' }], error_codes: ['TNS.SINCE_FOR'], data: {}, ...extra,
});
const detect = (t) => (/can to/i.test(t) ? [{ code: 'GRM.CAN_TO', hint: 'Parece que usaste «can to»: después de can va el verbo solo.' }, { code: 'X.SECOND', hint: 'otra' }] : []);

test('FIX_TYPE y sentenceOf: la oración sale de prompt_en sin espacios; vacío o ajeno es null', () => {
  assert.equal(FIX_TYPE, 'fix_error');
  assert.equal(sentenceOf(item({ prompt_en: '  I go.  ' })), 'I go.');
  for (const bad of [undefined, null, '', '   ', 5, {}, []]) assert.equal(sentenceOf(item({ prompt_en: bad })), null, String(bad));
  for (const bad of [undefined, null, 'x', 5, []]) assert.equal(sentenceOf(bad), null);
});
test('promptPlan: instrucción de prompt_es (o la de siempre) y la oración en inglés', () => {
  assert.deepEqual(promptPlan(item()), { instruction: 'Corrige el error en la oración.', main: { text: "I'm living here since two years.", lang: 'en' } });
  assert.equal(promptPlan(item({ prompt_es: 'Hay un error de tiempo.' })).instruction, 'Hay un error de tiempo.');
  assert.equal(promptPlan(item({ prompt_es: '  ' })).instruction, 'Corrige el error en la oración.');
  assert.deepEqual(promptPlan(item({ prompt_en: '' })).main, null);
  assert.deepEqual(promptPlan(null), { instruction: 'Corrige el error en la oración.', main: null });
});
test('acierta con cualquier versión válida, con contracciones y sin tocar mayúsculas', () => {
  for (const ok of ["I've lived here for two years.", 'I have lived here for two years', "i've been living here for two years"]) {
    const g = gradeFix(item(), ok, { detect });
    assert.equal(g.result, 'correct', ok);
    assert.deepEqual([g.unchanged, g.trap, g.hits, g.hint], [false, null, [], null]);
  }
});
test('vacío: wrong con empty, sin trampa ni detector', () => {
  let calls = 0;
  const g = gradeFix(item(), '   ', { detect: () => { calls += 1; return []; } });
  assert.equal(g.empty, true);
  assert.equal(calls, 0);
  assert.equal(g.unchanged, false);
});
test('sin cambios: la misma oración con error es wrong, unchanged y lleva los error_codes del ítem', () => {
  for (const same of ["I'm living here since two years.", "i'm living here since two years", "  I'm living here since two years.  "]) {
    const g = gradeFix(item(), same, { detect });
    assert.equal(g.result, 'wrong', same);
    assert.equal(g.unchanged, true);
    assert.ok(g.errorCodes.includes('TNS.SINCE_FOR'), 'lleva el código del ítem');
    assert.equal(new Set(g.errorCodes).size, g.errorCodes.length);
    assert.equal(g.trap, null);
  }
  const g = gradeFix(item({ error_codes: undefined }), "I'm living here since two years.");
  assert.equal(g.unchanged, true);
  assert.ok(!g.errorCodes.includes('TNS.SINCE_FOR'));
});
test('trampa conocida: otra corrección mala típica da wrong, trap y su código una sola vez', () => {
  const g = gradeFix(item(), 'I live here since two years.', { detect });
  assert.equal(g.result, 'wrong');
  assert.deepEqual(g.trap, { text: 'I live here since two years.', code: 'TNS.SINCE_FOR' });
  assert.deepEqual(g.errorCodes, ['TNS.SINCE_FOR']);
  assert.equal(g.unchanged, false);
});
test('detector: solo se pregunta si es wrong; su pista y su código principal viajan', () => {
  const g = gradeFix(item({ accept: ['I can go.'], prompt_en: 'I can to go.', distractors: [], error_codes: [] }), 'He can to swim.', { detect });
  assert.equal(g.result, 'wrong');
  assert.equal(g.hits.length, 2);
  assert.equal(g.hint, 'Parece que usaste «can to»: después de can va el verbo solo.');
  assert.deepEqual(g.errorCodes, ['GRM.CAN_TO']);
});
test('«sin cambios» gana a «almost»: aunque compare vea la oración con error cerca de una válida, sigue siendo wrong', () => {
  const almost = (typed, accept) => (accept.includes("I'm living here since two years.") ? { result: 'correct', matched: accept[0] } : { result: 'almost', matched: 'x', spellingFlags: ['y'] });
  const g = gradeFix(item(), "I'm living here since two years.", { compare: almost });
  assert.equal(g.result, 'wrong');
  assert.equal(g.unchanged, true);
  assert.ok(g.errorCodes.includes('TNS.SINCE_FOR'));
});
test('una errata de verdad (almost) no consulta al detector ni añade códigos', () => {
  let calls = 0;
  const g = gradeFix(item(), "I've lived here for two yeers.", { detect: () => { calls += 1; return [{ code: 'Z', hint: 'z' }]; } });
  assert.equal(g.result, 'almost');
  assert.equal(calls, 0);
  assert.deepEqual([g.hits, g.trap, g.unchanged], [[], null, false]);
});
test('la trampa manda sobre el detector para el código; la pista del detector se conserva', () => {
  const g = gradeFix(item(), 'I live here since two years.', { detect: () => [{ code: 'OTRO.CODE', hint: 'pista' }] });
  assert.deepEqual(g.errorCodes, ['TNS.SINCE_FOR']);
  assert.equal(g.hint, 'pista');
});
test('un detector que lanza o devuelve basura no rompe la calificación', () => {
  for (const d of [() => { throw new Error('x'); }, () => null, () => 'x', () => [null, 3, 'a'], () => [{ code: 'A' }]]) {
    const g = gradeFix(item(), 'Banana phone.', { detect: d });
    assert.equal(g.result, 'wrong');
    assert.equal(g.hint, null);
  }
  assert.equal(gradeFix(item(), 'Banana phone.', { detect: () => [{ code: 'A' }] }).hits.length, 1);
});
test('compare inyectable y errores en español para ítems inválidos', () => {
  const g = gradeFix(item(), 'cualquiera', { compare: () => ({ result: 'correct', matched: 'x' }) });
  assert.equal(g.result, 'correct');
  assert.throws(() => gradeFix(item({ accept: [] }), 'x'), /accept/);
  assert.throws(() => gradeFix(null, 'x'), /no es un objeto/);
});
test('la pista se recorta y una pista vacía no cuenta', () => {
  assert.equal(gradeFix(item(), 'Banana.', { detect: () => [{ code: 'A', hint: '  pista  ' }] }).hint, 'pista');
  assert.equal(gradeFix(item(), 'Banana.', { detect: () => [{ code: 'A', hint: '   ' }] }).hint, null);
});
test('los códigos no se repiten ni entran valores vacíos', () => {
  const g = gradeFix(item({ error_codes: ['A', 'A', '', ' B ', 5] }), "I'm living here since two years.");
  assert.deepEqual(g.errorCodes, ['A', 'B']);
});
