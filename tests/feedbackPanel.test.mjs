// @purpose: Pruebas del panel de feedback común (2.6-T1): estados, orden, respuesta visible al fallar, notas por estado, binarios sin «casi» y entradas hostiles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { h as domH } from '../ui/dom.js';
import { feedbackState, feedbackNodes, FB_TEXT, NUANCE_SHORT_MAX } from '../ui/feedbackPanel.js';
import { makeEnv } from './_fakeDom.mjs';
import { makeRng } from './_helpers.mjs';

const env = makeEnv();
const { h } = domH.with(env.doc);
const IT = { explain_es: 'Explicación.', grammar_note_es: 'Nota de gramática.', nuance_es: 'Un matiz breve.' };
const cls = (n) => (n.getAttribute ? String(n.getAttribute('class') ?? '') : '');
const texts = (nodes) => nodes.map((n) => n.textContent);
const run = (result, extra = {}) => feedbackNodes({ h, result, item: IT, ...extra });

test('feedbackState: los 4 estados y los valores raros', () => {
  assert.equal(feedbackState('correct'), 'correct');
  assert.equal(feedbackState('almost'), 'almost');
  assert.equal(feedbackState('wrong'), 'wrong');
  assert.equal(feedbackState('dont_know'), 'dont');
  assert.equal(feedbackState('dont'), 'dont');
  for (const v of [undefined, null, 5, '', 'x', {}, [], 'CORRECT']) assert.equal(feedbackState(v), 'wrong');
  assert.equal(feedbackState('almost', { binary: true }), 'wrong', 'los tipos binarios nunca muestran «casi»');
  assert.equal(feedbackState('almost', { binary: false }), 'almost');
  assert.equal(feedbackState('correct', { binary: true }), 'correct');
  assert.equal(feedbackState('dont_know', null), 'dont');
});

test('veredicto: texto por estado, con la cola de cada tipo, o texto completo propio', () => {
  assert.equal(run('correct')[0].textContent, '¡Bien!');
  assert.equal(run('wrong')[0].textContent, 'Todavía no.');
  assert.equal(run('wrong', { tail: 'Fíjate en la corrección:' })[0].textContent, 'Todavía no. Fíjate en la corrección:');
  assert.equal(run('dont_know', { tail: 'así se dice.' })[0].textContent, 'No pasa nada: así se dice.');
  assert.equal(run('almost')[0].textContent, FB_TEXT.almost);
  assert.equal(run('correct', { verdict: '¡Bien! Todas las parejas, sin fallos.' })[0].textContent, '¡Bien! Todas las parejas, sin fallos.');
  assert.equal(run('wrong', { verdict: '   ' })[0].textContent, 'Todavía no.', 'un texto propio en blanco no cuenta');
  const c = cls(run('wrong')[0]);
  assert.match(c, /fb__verdict/);
  assert.match(c, /fb__verdict--wrong/);
});

test('al fallar: veredicto, extras, respuesta, explicación, gramática, matiz y al final lo de `after`, en ese orden', () => {
  const before = h('p', { class: 'x-before' }, 'antes');
  const after = h('p', { class: 'x-after' }, 'después');
  for (const result of ['wrong', 'almost', 'dont_know']) {
    const out = run(result, { before, after: [after, null], answer: 'works' });
    assert.deepEqual(out.map(cls).map((c) => c.split(' ')[0]), ['fb__verdict', 'x-before', 'fb__correct', 'fb__explain', 'fb__box', 'fb__box', 'x-after'], result);
    assert.equal(out[2].textContent, 'Respuesta: works');
    assert.equal(out[3].textContent, 'Explicación.');
    assert.match(out[4].textContent, /Gramática.*Nota de gramática\./);
    assert.match(out[5].textContent, /Matiz.*Un matiz breve\./);
  }
});

test('la respuesta correcta se pinta como texto o como nodos propios, y siempre tras fallar (CA 3)', () => {
  assert.equal(run('wrong', { answer: '  works  ' })[1].textContent, 'Respuesta: works');
  const mine = h('div', { class: 'own' }, 'bloques');
  assert.equal(run('wrong', { answer: mine })[1], mine);
  const two = [h('p', {}, 'a'), h('p', {}, 'b')];
  assert.deepEqual(texts(run('dont_know', { answer: two }).slice(1, 3)), ['a', 'b']);
  assert.equal(run('wrong', { answer: '   ' }).some((n) => cls(n).includes('fb__correct')), false, 'sin respuesta no inventa una');
  for (const result of ['wrong', 'almost', 'dont_know']) assert.ok(run(result, { answer: 'x' }).some((n) => cls(n).includes('fb__correct')), result);
});

test('al acertar: solo el matiz y solo si es breve; ni explicación ni gramática ni respuesta', () => {
  const out = run('correct', { answer: 'works' });
  assert.deepEqual(out.map((n) => cls(n).split(' ')[0]), ['fb__verdict', 'fb__box']);
  assert.match(out[1].textContent, /Matiz.*Un matiz breve\./);
  const long = 'x'.repeat(NUANCE_SHORT_MAX + 1);
  assert.equal(feedbackNodes({ h, result: 'correct', item: { ...IT, nuance_es: long } }).length, 1);
  assert.equal(feedbackNodes({ h, result: 'correct', item: { ...IT, nuance_es: 'x'.repeat(NUANCE_SHORT_MAX) } }).length, 2);
  assert.equal(feedbackNodes({ h, result: 'correct', item: { ...IT, nuance_es: null } }).length, 1);
});

test('notas ausentes, nulas, en blanco o que no son texto no se pintan', () => {
  for (const v of [undefined, null, '', '   ', 5, {}, [], true]) {
    const out = feedbackNodes({ h, result: 'wrong', item: { explain_es: v, grammar_note_es: v, nuance_es: v } });
    assert.equal(out.length, 1, String(v));
  }
  const some = feedbackNodes({ h, result: 'wrong', item: { explain_es: null, grammar_note_es: 'solo gramática', nuance_es: null } });
  assert.equal(some.length, 2);
  for (const it of [undefined, null, 'x', 5, [], () => 1]) assert.equal(feedbackNodes({ h, result: 'wrong', item: it }).length, 1);
});

test('el texto del ítem entra como texto, nunca como HTML', () => {
  const out = feedbackNodes({ h, result: 'wrong', item: { explain_es: '<b>x</b>' }, answer: '<i>y</i>' });
  assert.equal(out[1].textContent, 'Respuesta: <i>y</i>');
  assert.equal(out[2].textContent, '<b>x</b>');
  assert.equal(out.some((n) => n.querySelectorAll('b').length > 0 || n.querySelectorAll('i').length > 0), false);
});

test('sin `h` lanza TypeError; el resto de las opciones raras no lanza', () => {
  for (const o of [undefined, null, {}, { h: 5 }, 'x']) assert.throws(() => feedbackNodes(o), TypeError);
  for (const v of [undefined, null, 5, {}, [], 'x']) assert.doesNotThrow(() => feedbackNodes({ h, result: 'wrong', before: v, after: v, answer: v, tail: v, verdict: v }));
});

test('no muta el ítem y es determinista (fuzz con semilla fija)', () => {
  const rng = makeRng(2601);
  const pick = (a) => rng.pick(a);
  const states = ['correct', 'almost', 'wrong', 'dont_know', 'dont', undefined, 'zz'];
  const note = [undefined, null, '', ' ', 'nota', 'x'.repeat(200), 5];
  for (let i = 0; i < 300; i += 1) {
    const item = { explain_es: pick(note), grammar_note_es: pick(note), nuance_es: pick(note) };
    const copy = JSON.stringify(item);
    const result = pick(states);
    const binary = rng.next() < 0.5;
    const opt = { h, result, item, binary, tail: pick(note), answer: pick(note) };
    const a = feedbackNodes(opt);
    const b = feedbackNodes(opt);
    assert.equal(JSON.stringify(item), copy);
    assert.deepEqual(texts(a), texts(b));
    const state = feedbackState(result, { binary });
    assert.match(cls(a[0]), new RegExp(`fb__verdict--${state}`));
    const has = (c) => a.some((n) => cls(n).includes(c));
    if (state === 'correct') {
      assert.equal(has('fb__explain') || has('fb__grammar') || has('fb__correct'), false);
    } else {
      assert.equal(has('fb__explain'), typeof item.explain_es === 'string' && item.explain_es.trim() !== '');
      assert.equal(has('fb__grammar'), typeof item.grammar_note_es === 'string' && item.grammar_note_es.trim() !== '');
      assert.equal(has('fb__nuance'), typeof item.nuance_es === 'string' && item.nuance_es.trim() !== '');
    }
    if (binary) assert.notEqual(state, 'almost');
  }
});

test('bordes: el tope de «breve» es 160 en cifras, espacios sobrantes se quitan y `binary` solo vale si es true', () => {
  assert.equal(NUANCE_SHORT_MAX, 160);
  const n = (len) => feedbackNodes({ h, result: 'correct', item: { nuance_es: 'x'.repeat(len) } }).length;
  assert.deepEqual([n(100), n(160), n(161)], [2, 2, 1]);
  assert.equal(run('wrong', { tail: '  Mira:  ' })[0].textContent, 'Todavía no. Mira:');
  assert.equal(run('wrong', { verdict: '  Mi texto  ' })[0].textContent, 'Mi texto');
  const out = feedbackNodes({ h, result: 'wrong', item: { grammar_note_es: '  nota  ', nuance_es: '  matiz  ' } });
  assert.deepEqual([out[1].querySelectorAll('p')[1].textContent, out[2].querySelectorAll('p')[1].textContent], ['nota', 'matiz']);
  for (const v of ['yes', 1, {}]) assert.equal(feedbackState('almost', { binary: v }), 'almost');
  assert.equal(run('wrong', { before: false, after: false }).length, 4, 'false no es un nodo');
});
