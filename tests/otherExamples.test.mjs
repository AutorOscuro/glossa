// @purpose: Pruebas de core/otherExamples.js (2.7-T1): al menos 3 ejemplos del mismo tema, sin repetir, sin el ítem actual, sin destripar ítems por venir y sin lanzar con datos rotos.
// 2.7-T1, CA 1 del roadmap (la ayuda no pierde el ejercicio) y regla «≥ 3 ejemplos del mismo tema/ítem desde el paquete».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectExamples, sentenceFromItem, sentencesFromTopic, exampleKey, EXAMPLES } from '../core/otherExamples.js';

const T1 = 'gram.present_perfect.for_since';
const T2 = 'gram.past_simple.regular';
const item = (id, accept, extra = {}) => ({ id, type: 'fix_error', topics: [T1], prompt_es: 'Corrige.', prompt_en: 'x', accept, ...extra });
const pool = () => [
  item('g.pp.0003', ['I have worked here for two years.']),
  item('g.pp.0001', ["I've lived here for two years."]),
  item('g.pp.0002', ['She has known him since 2019.']),
  item('g.pp.0004', ['We have studied English since March.']),
  item('g.ps.0001', ['They watched a film last night.'], { topics: [T2] }),
];

test('reúne al menos 3 ejemplos del mismo tema, en orden estable por id', () => {
  const r = collectExamples({ topicIds: [T1], items: pool() });
  assert.equal(r.enough, true);
  assert.equal(r.shortBy, 0);
  assert.deepEqual(r.examples.map((e) => e.itemId), ['g.pp.0001', 'g.pp.0002', 'g.pp.0003', 'g.pp.0004']);
  assert.ok(r.examples.every((e) => e.kind === 'item'));
  assert.deepEqual(collectExamples({ topicIds: [T1], items: pool().reverse() }).examples, r.examples, 'el orden no depende del orden de entrada');
});

test('no muestra el ítem actual ni sus frases aunque otro ítem las repita', () => {
  const current = item('g.pp.0001', ["I've lived here for two years."], { prompt_en: "I'm living here since two years." });
  const dup = item('g.pp.0009', ['I have lived here for two years.']); // misma frase con la contracción expandida
  const r = collectExamples({ topicIds: [T1], items: [...pool(), dup], currentItem: current });
  const ens = r.examples.map((e) => e.en);
  assert.ok(!ens.includes("I've lived here for two years."));
  assert.ok(!ens.includes('I have lived here for two years.'), 'una repetida con contracción expandida tampoco');
  assert.ok(!r.examples.some((e) => e.itemId === 'g.pp.0001'));
});

test('los ítems que la sesión aún no presentó (excludeItemIds) no se destripan', () => {
  const r = collectExamples({ topicIds: [T1], items: pool(), excludeItemIds: new Set(['g.pp.0002', 'g.pp.0003']) });
  assert.deepEqual(r.examples.map((e) => e.itemId), ['g.pp.0001', 'g.pp.0004']);
  assert.equal(r.enough, false);
  assert.equal(r.shortBy, 1);
  assert.deepEqual(collectExamples({ topicIds: [T1], items: pool(), excludeItemIds: ['g.pp.0001'] }).examples.map((e) => e.itemId), ['g.pp.0002', 'g.pp.0003', 'g.pp.0004']);
});

test('primero la teoría del tema, luego los ítems; una frase de teoría repetida en un ítem sale una vez', () => {
  const topics = [{ id: T1, theory: { examples: [{ en: 'He has lived in Lima for ten years.', es: 'Vive en Lima desde hace diez años.' }, { en: 'Bad', es: 'x' }] } }];
  const items = [...pool(), item('g.pp.0010', ['he has lived in lima for ten years'])];
  const r = collectExamples({ topicIds: [T1], topics, items });
  assert.equal(r.examples[0].kind, 'theory');
  assert.equal(r.examples[0].es, 'Vive en Lima desde hace diez años.');
  assert.equal(r.examples[0].topicId, T1);
  assert.equal(r.examples.filter((e) => exampleKey(e.en) === exampleKey('He has lived in Lima for ten years.')).length, 1);
  assert.ok(!r.examples.some((e) => e.en === 'Bad'), 'una «frase» de una palabra no vale');
});

test('los ítems del tema principal van antes que los de temas secundarios', () => {
  const both = item('z.last', ['A sentence from both topics today.'], { topics: [T2, T1] });
  const r = collectExamples({ topicIds: [T1, T2], items: [both, ...pool()] });
  // «z.last» trae T1 entre sus temas (el principal): va con los de T1 por id; «g.ps.0001» solo trae T2 (secundario): va al final.
  assert.deepEqual(r.examples.map((e) => e.itemId), ['g.pp.0001', 'g.pp.0002', 'g.pp.0003', 'g.pp.0004', 'z.last', 'g.ps.0001']);
});

test('ítems de otro tema no entran; con un tema sin ítems no hay ejemplos y se dice cuántos faltan', () => {
  const r = collectExamples({ topicIds: ['otro.tema'], items: pool() });
  assert.equal(r.count, 0);
  assert.equal(r.enough, false);
  assert.equal(r.shortBy, 3);
  assert.deepEqual(r.examples, []);
});

test('tope máximo: nunca más de `max`', () => {
  const many = Array.from({ length: 20 }, (_, i) => item(`g.pp.${String(i).padStart(4, '0')}`, [`Sentence number ${i} is here today.`]));
  assert.equal(collectExamples({ topicIds: [T1], items: many }).count, EXAMPLES.max);
  assert.equal(collectExamples({ topicIds: [T1], items: many, max: 4 }).count, 4);
  assert.equal(collectExamples({ topicIds: [T1], items: many, min: 5, max: 4 }).count, 5, 'max menor que min se sube a min');
  assert.equal(collectExamples({ topicIds: [T1], items: many, min: 0, max: 0 }).count, EXAMPLES.max, 'valores no válidos vuelven a los de fábrica');
});

test('sentenceFromItem: solo frases en inglés de ítems originales', () => {
  assert.deepEqual(sentenceFromItem(item('a.1', ['  I   have  a  dog today.  '])), { en: 'I have a dog today.', es: null, itemId: 'a.1' });
  assert.equal(sentenceFromItem(item('a.2', ['dog'])), null, 'una palabra no es un ejemplo');
  assert.equal(sentenceFromItem(item('a.3', ['I have a dog today.'], { source: 'ai_generated_unverified' })), null);
  assert.equal(sentenceFromItem(item('a.4', ['I have a dog today.'], { needs_ai: true })), null);
  assert.equal(sentenceFromItem(item('a.5', ['Me duele mucho la rodilla.'], { type: 'translate_word' })), null, 'translate_word responde en español');
  assert.equal(sentenceFromItem(item('a.6', ['I have a ___ today.'])), null, 'una frase con hueco no es un ejemplo');
  assert.equal(sentenceFromItem(item('a.7', ['x '.repeat(100)])), null);
  assert.equal(sentenceFromItem(item('a.8', [])), null);
  assert.equal(sentenceFromItem(item('a.9', ['1 2 3 4 5'])), null, 'sin letras no es una frase');
  assert.equal(sentenceFromItem(item('a.10', ['No', 'My knee hurts a lot.'])).en, 'My knee hurts a lot.', 'salta la respuesta corta y toma la siguiente válida');
});

test('traducir con frase: el enunciado en español es la traducción del ejemplo', () => {
  const t = sentenceFromItem(item('tr.1', ['My knee hurts a lot.'], { type: 'translate_bank', prompt_es: ' Me duele mucho la rodilla. ' }));
  assert.deepEqual(t, { en: 'My knee hurts a lot.', es: 'Me duele mucho la rodilla.', itemId: 'tr.1' });
  assert.equal(sentenceFromItem(item('tr.2', ['My knee hurts a lot.'], { type: 'fix_error', prompt_es: 'Corrige el error.' })).es, null, 'una consigna no es traducción');
});

test('sentencesFromTopic: teoría ausente o rota da lista vacía', () => {
  assert.deepEqual(sentencesFromTopic({ id: T1 }), []);
  assert.deepEqual(sentencesFromTopic({ id: T1, theory: {} }), []);
  assert.deepEqual(sentencesFromTopic({ id: T1, theory: { examples: 'no' } }), []);
  assert.deepEqual(sentencesFromTopic({ id: T1, theory: { examples: [null, 3, { en: 5 }, { en: 'We are friends now.' }] } }), [{ en: 'We are friends now.', es: null, topicId: T1 }]);
  assert.deepEqual(sentencesFromTopic(null), []);
});

test('entradas rotas no lanzan y dan un resultado vacío', () => {
  for (const bad of [undefined, null, 5, 'x', [], { topicIds: 'x', items: 'y', topics: 7, excludeItemIds: 9, currentItem: 'z' }, { topicIds: [null, 3], items: [null, 4, { id: 5 }, { id: 'a', topics: 'x' }] }]) {
    const r = collectExamples(bad);
    assert.equal(r.count, 0);
    assert.equal(r.enough, false);
  }
  assert.doesNotThrow(() => collectExamples({ topicIds: [T1], items: [{ id: 'a', topics: [T1], accept: [null, 4, {}] }] }));
});

test('texto con acentos, ñ, emoji, comillas curvas y espacios dobles se conserva y se deduplica', () => {
  const a = item('u.1', ['It’s Ana’s café 🙂 near the school.']);
  const b = item('u.2', ["it's ana's  cafe 🙂 near the school"]);
  const r = collectExamples({ topicIds: [T1], items: [a, b] });
  assert.equal(r.count, 1);
  assert.equal(r.examples[0].en, 'It’s Ana’s café 🙂 near the school.');
});

test('no modifica sus entradas', () => {
  const items = pool(); const snap = JSON.stringify(items);
  const topics = [{ id: T1, theory: { examples: [{ en: 'He has lived in Lima for ten years.', es: null }] } }];
  const tsnap = JSON.stringify(topics);
  const ex = new Set(['g.pp.0002']);
  collectExamples({ topicIds: [T1], items, topics, excludeItemIds: ex });
  assert.equal(JSON.stringify(items), snap);
  assert.equal(JSON.stringify(topics), tsnap);
  assert.deepEqual([...ex], ['g.pp.0002']);
});

test('con 5000 ítems tarda poco', () => {
  const big = Array.from({ length: 5000 }, (_, i) => item(`b.${String(i).padStart(5, '0')}`, [`This is sentence number ${i} for the test.`], { topics: [i % 2 ? T1 : T2] }));
  const t0 = performance.now();
  const r = collectExamples({ topicIds: [T1], items: big });
  assert.equal(r.enough, true);
  assert.ok(performance.now() - t0 < 200, `tardó ${Math.round(performance.now() - t0)} ms`);
});

test('si el ítem actual llega solo con su id, igualmente se excluye su propia frase del paquete', () => {
  const r = collectExamples({ topicIds: [T1], items: pool(), currentItem: { id: 'g.pp.0001' } });
  assert.ok(!r.examples.some((e) => e.itemId === 'g.pp.0001'));
  assert.deepEqual(r.examples.map((e) => e.itemId), ['g.pp.0002', 'g.pp.0003', 'g.pp.0004']);
});
