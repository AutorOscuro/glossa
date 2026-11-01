// @purpose: Pruebas de la lógica pura de los 6 tipos de palabra y colocación (2.5-T2, puntos 1 y 2): tabla, idioma de la respuesta, instrucción, líneas, huecos, máscara por defecto y plan del enunciado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORD_TYPES, textTypeInfo, answerLangFor, instructionFor, promptLines, gapParts, withDefaults, promptPlan } from '../core/textTypes.js';
import { typeInfo } from '../core/contentTypes.js';
import { maskHint } from '../core/textAnswer.js';

const it = (type, extra = {}) => ({ type, prompt_es: 'Texto', prompt_en: null, accept: ['x'], data: {}, ...extra });

test('WORD_TYPES: los 6 tipos de T2, todos de la familia text_input del catálogo y sin repetir', () => {
  assert.equal(WORD_TYPES.length, 6);
  assert.equal(new Set(WORD_TYPES).size, 6);
  assert.ok(Object.isFrozen(WORD_TYPES));
  for (const t of WORD_TYPES) assert.equal(typeInfo(t)?.family, 'text_input', t);
});

test('textTypeInfo: devuelve la ficha de cada tipo y null para los demás o lo que no es texto', () => {
  for (const t of WORD_TYPES) assert.equal(textTypeInfo(t).type, t);
  assert.equal(textTypeInfo('fill_verb').family, 'grammar');
  assert.equal(textTypeInfo('translate_word').family, 'vocab');
  assert.equal(textTypeInfo('first_letter').defaultMask, 'first_letter');
  for (const bad of ['fix_error', 'three_forms', 'phrase_cloze', '', 'toString', '__proto__', null, undefined, 3, {}]) assert.equal(textTypeInfo(bad), null, String(bad));
});

test('answerLangFor: siempre inglés (translate_word es español → inglés, respuesta del Administrador, pregunta 8), tenga o no prompt_en', () => {
  assert.equal(answerLangFor(it('translate_word')), 'en');
  assert.equal(answerLangFor(it('translate_word', { prompt_en: 'house' })), 'en');
  assert.equal(answerLangFor(it('translate_word', { prompt_en: '   ' })), 'en');
  for (const t of WORD_TYPES) assert.equal(answerLangFor(it(t, { prompt_en: 'a ___ b' })), 'en', t);
  for (const bad of [null, undefined, 'x', [], 5]) assert.equal(answerLangFor(bad), 'en');
});

test('instructionFor: una instrucción en español por tipo; traducir cambia con la dirección', () => {
  const seen = new Set();
  for (const t of WORD_TYPES) { const s = instructionFor(it(t)); assert.ok(s.endsWith('.') || s.endsWith('?'), t); seen.add(s); }
  assert.equal(seen.size, 6, 'cada tipo tiene su propia instrucción (translate_word usa la de inglés por defecto)');
  assert.equal(instructionFor(it('translate_word')), 'Traduce al inglés.');
  assert.equal(instructionFor(it('translate_word', { prompt_en: 'house' })), 'Traduce al inglés.');
  assert.equal(instructionFor(it('fix_error')), '');
  assert.equal(instructionFor(null), '');
});

test('promptLines: recorta, y vacío o ausente es null', () => {
  assert.deepEqual(promptLines({ prompt_es: ' Hola ', prompt_en: ' She ___ here. ' }), { es: 'Hola', en: 'She ___ here.' });
  assert.deepEqual(promptLines({ prompt_es: 'Hola', prompt_en: null }), { es: 'Hola', en: null });
  assert.deepEqual(promptLines({ prompt_es: '  ', prompt_en: '' }), { es: null, en: null });
  assert.deepEqual(promptLines({ prompt_es: 5, prompt_en: {} }), { es: null, en: null });
  assert.deepEqual(promptLines(null), { es: null, en: null });
});

test('gapParts: parte por cada hueco de 2 o más rayas; una raya sola no es hueco', () => {
  assert.deepEqual(gapParts('She ___ here.'), [{ text: 'She ', gap: false }, { text: '', gap: true }, { text: ' here.', gap: false }]);
  assert.deepEqual(gapParts('___'), [{ text: '', gap: true }]);
  assert.deepEqual(gapParts('a ____ b ___'), [{ text: 'a ', gap: false }, { text: '', gap: true }, { text: ' b ', gap: false }, { text: '', gap: true }]);
  assert.deepEqual(gapParts('a _ b'), [{ text: 'a _ b', gap: false }]);
  assert.deepEqual(gapParts('sin hueco'), [{ text: 'sin hueco', gap: false }]);
  assert.deepEqual(gapParts(''), []);
  assert.deepEqual(gapParts(null), []);
});

test('withDefaults: first_letter recibe la máscara de primera letra; un valor explícito se respeta; no muta', () => {
  const base = it('first_letter', { accept: ['house'] });
  const out = withDefaults(base);
  assert.equal(out.data.mask, 'first_letter');
  assert.equal(maskHint(out), 'h _ _ _ _');
  assert.equal(base.data.mask, undefined);
  assert.equal(withDefaults(it('first_letter', { accept: ['house'], data: { mask: 'none' } })).data.mask, 'none');
  assert.equal(withDefaults(it('first_letter', { accept: ['house'], data: { mask: 'length' } })).data.mask, 'length');
  assert.equal(withDefaults(it('first_letter', { accept: ['house'], data: { hint: 'h' } })).data.hint, 'h');
  assert.equal(withDefaults(it('first_letter', { accept: ['house'], data: null })).data.mask, 'first_letter');
  const same = it('fill_verb');
  assert.equal(withDefaults(same), same);
  assert.equal(withDefaults(null), null);
  assert.equal(withDefaults('x'), 'x');
});

// ---- Cierre de roturas vivas (4.R) ----
const arrWith = (props) => Object.assign([], props);

test('withDefaults: solo first_letter recibe máscara; ningún otro tipo cambia', () => {
  for (const t of WORD_TYPES.filter((x) => x !== 'first_letter')) {
    const base = it(t);
    assert.equal(withDefaults(base), base, t);
    assert.equal(withDefaults(base).data.mask, undefined, t);
  }
});

test('lo que no es un objeto plano (lista con propiedades, texto) se trata como no ítem', () => {
  const bad = arrWith({ type: 'fill_verb', prompt_es: 'Hola', prompt_en: 'x ___', data: {} });
  assert.equal(instructionFor(arrWith({ type: 'fill_verb' })), '');
  assert.deepEqual(promptLines(bad), { es: null, en: null });
  assert.equal(withDefaults(arrWith({ type: 'first_letter' })).data, undefined);
  assert.equal(answerLangFor(arrWith({ type: 'translate_word', prompt_en: 'house' })), 'en');
});

test('withDefaults: un data que no es objeto se reemplaza sin copiar sus caracteres', () => {
  assert.deepEqual(withDefaults(it('first_letter', { data: 'ab' })).data, { mask: 'first_letter' });
  assert.deepEqual(withDefaults(it('first_letter', { data: ['a', 'b'] })).data, { mask: 'first_letter' });
});

test('gapParts: dos rayas ya son un hueco', () => {
  assert.deepEqual(gapParts('a __ b'), [{ text: 'a ', gap: false }, { text: '', gap: true }, { text: ' b', gap: false }]);
});

// ---- promptPlan (punto 2): qué enseña la pantalla ----
const EN5 = WORD_TYPES.filter((x) => x !== 'translate_word');

test('promptPlan: lo que no es un ítem de la tabla da un plan vacío', () => {
  const empty = { instruction: '', main: null, aside: null };
  for (const bad of [null, undefined, 5, 'fill_verb', [], arrWith({ type: 'fill_verb', prompt_es: 'x' }), { type: 'mcq_en_es', prompt_es: 'x' }, {}, { type: 5 }]) {
    assert.deepEqual(promptPlan(bad), empty);
  }
});

test('promptPlan: los 5 tipos que responden en inglés muestran prompt_en con huecos y prompt_es como apoyo', () => {
  for (const t of EN5) {
    const plan = promptPlan(it(t, { prompt_es: 'Ella va a la escuela.', prompt_en: 'She ___ (go) to school.' }));
    assert.equal(plan.instruction, instructionFor(it(t)), t);
    assert.deepEqual(plan.main, { lang: 'en', parts: [{ text: 'She ', gap: false }, { text: '', gap: true }, { text: ' (go) to school.', gap: false }] }, t);
    assert.deepEqual(plan.aside, { lang: 'es', text: 'Ella va a la escuela.' }, t);
  }
});

test('promptPlan: sin prompt_en el texto principal es prompt_es, sin apoyo (los 6 tipos)', () => {
  for (const t of WORD_TYPES) {
    const plan = promptPlan(it(t, { prompt_es: 'feliz', prompt_en: null }));
    assert.deepEqual(plan.main, { lang: 'es', parts: [{ text: 'feliz', gap: false }] }, t);
    assert.equal(plan.aside, null, t);
    assert.equal(plan.instruction, instructionFor(it(t, { prompt_en: null })), t);
  }
});

test('promptPlan: traducir palabra al inglés muestra la palabra española y la instrucción «al inglés»', () => {
  const plan = promptPlan(it('translate_word', { prompt_es: 'perro' }));
  assert.equal(plan.instruction, 'Traduce al inglés.');
  assert.deepEqual(plan.main, { lang: 'es', parts: [{ text: 'perro', gap: false }] });
  assert.equal(plan.aside, null);
});

test('promptPlan: traducir palabra muestra la palabra española y NUNCA prompt_en (sería la respuesta)', () => {
  const plan = promptPlan(it('translate_word', { prompt_es: 'perro', prompt_en: 'dog' }));
  assert.equal(plan.instruction, 'Traduce al inglés.');
  assert.deepEqual(plan.main, { lang: 'es', parts: [{ text: 'perro', gap: false }] });
  assert.equal(plan.aside, null);
  assert.ok(!JSON.stringify(plan).includes('dog'));
});

test('promptPlan: los 5 tipos en inglés conservan el apoyo aunque prompt_en sea la palabra (el apoyo solo se oculta en translate_word)', () => {
  for (const t of EN5) assert.notEqual(promptPlan(it(t, { prompt_es: 'perro', prompt_en: 'dog' })).aside, null, t);
});

test('promptPlan: un prompt_en vacío o de solo espacios cuenta como ausente; los bordes se recortan', () => {
  for (const blank of ['', '   ', '\n\t', null, undefined, 7, {}]) {
    const plan = promptPlan(it('fill_verb', { prompt_es: '  Hola  ', prompt_en: blank }));
    assert.deepEqual(plan.main, { lang: 'es', parts: [{ text: 'Hola', gap: false }] }, JSON.stringify(blank));
    assert.equal(plan.aside, null);
  }
  const trimmed = promptPlan(it('fill_verb', { prompt_es: '  Hola  ', prompt_en: '  I ___ here.  ' }));
  assert.equal(trimmed.main.parts[0].text, 'I ');
  assert.equal(trimmed.main.parts[2].text, ' here.');
  assert.equal(trimmed.aside.text, 'Hola');
});

test('promptPlan: sin ningún texto queda la instrucción y nada más', () => {
  for (const t of WORD_TYPES) {
    const plan = promptPlan(it(t, { prompt_es: '  ', prompt_en: null }));
    assert.equal(plan.main, null, t);
    assert.equal(plan.aside, null, t);
    assert.equal(plan.instruction, instructionFor(it(t, { prompt_en: null })), t);
    assert.notEqual(plan.instruction, '', t);
  }
});

test('promptPlan: el hueco también se parte en el texto español y no se muta el ítem', () => {
  const item = Object.freeze(it('collocation_fill', { prompt_es: 'hacer una ___', prompt_en: null, data: Object.freeze({}) }));
  const plan = promptPlan(item);
  assert.deepEqual(plan.main.parts, [{ text: 'hacer una ', gap: false }, { text: '', gap: true }]);
  assert.equal(item.prompt_es, 'hacer una ___');
});

test('promptPlan: con prompt_en y sin prompt_es no hay apoyo (ni un apoyo vacío)', () => {
  for (const t of EN5) {
    for (const noEs of [null, undefined, '', '   ']) {
      const plan = promptPlan(it(t, { prompt_es: noEs, prompt_en: 'She ___ here.' }));
      assert.equal(plan.aside, null, `${t} ${JSON.stringify(noEs)}`);
      assert.equal(plan.main.lang, 'en', t);
    }
  }
  assert.equal(promptPlan(it('translate_word', { prompt_es: null, prompt_en: 'dog' })).aside, null);
});
