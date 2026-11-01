// @purpose: Criterios de aceptación de la 1.2, de punta a punta con la API pública de comparación de respuestas.
// Cierre de la 1.2 (cuarto 4B): los 5 criterios de aceptación del roadmap (sección 1.2), de punta a punta con la API pública.
// Los casos finos viven en normalize.test.mjs, compare.test.mjs, compare.diff.test.mjs y wordDiff.test.mjs; aquí solo se amarra cada CA.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalize, damerauLevenshtein } from '../core/normalize.js';
import { compare } from '../core/compare.js';
import { wordDiff } from '../core/wordDiff.js';
import { createConfusables } from '../core/confusables.js';
import { makeRng } from './_helpers.mjs';

const data = JSON.parse(fs.readFileSync(new URL('../content/taxonomy/confusables.json', import.meta.url), 'utf8'));
const C = createConfusables(data);
const WITH = { confusables: C };

test('CA-1: los 5 puntos de 8.5', () => {
  // 1) normalización: espacios, minúsculas, ’ → \', puntuación final, contracciones, diacríticos solo en ES
  assert.equal(normalize('  Hello   WORLD!  '), 'hello world');
  assert.equal(normalize('Don’t'), 'don\'t');
  assert.equal(compare('I\'ve', ['I have'], WITH).result, 'correct');
  assert.equal(compare('canción', ['cancion'], { lang: 'es' }).result, 'correct');
  assert.notEqual(compare('cancion', ['canción']).result, 'correct', 'en inglés los diacríticos no se quitan');
  // 2) correct: igual tras normalizar
  assert.equal(compare('  I HAVE a dog. ', ['i have a dog'], WITH).result, 'correct');
  // 3) almost: Damerau-Levenshtein 1 en una palabra de ≥ 4 letras; se acepta y se marca la ortografía
  assert.equal(damerauLevenshtein('recieve', 'receive'), 1);
  const almost = compare('I recieve it', ['I receive it'], WITH);
  assert.equal(almost.result, 'almost');
  assert.deepEqual(almost.spellingFlags, [{ word: 'recieve', expected: 'receive', index: 1 }]);
  // 4) wrong: el resto, y nunca almost si el cambio crea otra palabra válida
  assert.equal(compare('Good lock', ['Good luck'], WITH).result, 'wrong');
  // 5) la I minúscula es mecánica y NO invalida
  const cap = compare('i have a dog', ['I have a dog'], WITH);
  assert.equal(cap.result, 'correct');
  assert.deepEqual(cap.errorCodes, ['MECH.CAP_I']);
});

test('CA-2: "almost" nunca cuando el cambio crea otra palabra válida (toda la lista, en los dos sentidos)', () => {
  let n = 0;
  for (const [a, b] of data.pairs) {
    for (const [u, k] of [[a, b], [b, a]]) {
      n += 1;
      assert.notEqual(compare(`say ${u} now`, [`say ${k} now`], { ...WITH, almostAtWordEnd: true }).result, 'almost', `${u}/${k}`);
    }
  }
  assert.ok(n >= 120, `${n} comprobaciones`);
  assert.ok(data.pairs.length >= 60, 'la lista inicial tiene al menos 60 parejas');
});

test('CA-3: I\'ve/I have, don\'t/do not, can\'t/cannot son equivalentes en los dos sentidos y en el diff', () => {
  for (const [a, b] of [['I\'ve', 'I have'], ['don\'t', 'do not'], ['can\'t', 'cannot']]) {
    for (const [u, k] of [[a, b], [b, a]]) {
      const r = compare(`${u} go`, [`${k} go`], WITH);
      assert.equal(r.result, 'correct', `${u} → ${k}`);
      assert.ok(r.diff.every((t) => t.status === 'ok'), `${u} → ${k}: diff`);
    }
  }
});

test('CA-4: espacios dobles, tabuladores, mayúsculas y puntuación final no cambian el resultado', () => {
  for (const u of ['I  have   a dog', '\tI have a dog\n', 'I HAVE A DOG', 'i have a dog.', 'I have a dog!!!', 'I have a dog…', '  I have a dog ?']) {
    assert.equal(compare(u, ['I have a dog'], WITH).result, 'correct', JSON.stringify(u));
  }
  assert.equal(compare('I have a dog', ['I have a dog.'], WITH).result, 'correct');
  assert.equal(compare('I have a dog', ['I have a dog.'], { ...WITH, keepFinalPunctuation: true }).result, 'wrong', 'si el ejercicio evalúa la puntuación, cuenta');
});

test('CA-5: vacío, null, undefined y emoji no lanzan (también en wordDiff) y un vacío nunca es correcto', () => {
  const weird = [undefined, null, '', '   ', '🙂', '👨‍👩‍👧‍👦', '🙂🙂 🙂', {}, [], NaN, 0, Symbol('s'), () => 1];
  for (const u of weird) {
    for (const acc of [undefined, null, [], [''], ['🙂'], ['I have a dog'], [null, undefined, 5]]) {
      const r = compare(u, acc, WITH);
      assert.ok(['correct', 'almost', 'wrong'].includes(r.result));
      assert.ok(Array.isArray(r.diff) && Array.isArray(r.spellingFlags) && Array.isArray(r.errorCodes));
    }
    assert.ok(Array.isArray(wordDiff(u, 'I have a dog', WITH)));
    assert.equal(typeof normalize(u), 'string');
  }
  assert.equal(compare('', [''], WITH).result, 'wrong');
});

test('Pruebas pedidas: los casos del diagnóstico de William son wrong y el fuzz de 1000 no lanza', () => {
  for (const [u, a] of [['I leaved home', 'I left home'], ['I eated pizza', 'I ate pizza'], ['He didn\'t went', 'He didn\'t go'], ['She can to swim', 'She can swim']]) {
    const r = compare(u, [a], WITH);
    assert.equal(r.result, 'wrong', u);
    assert.ok(r.diff.some((t) => t.status === 'wrong' || t.status === 'extra'), `${u}: el diff señala dónde`);
  }
  const rng = makeRng(1202);
  const pool = ['I', 'have', 'don\'t', 'can\'t', '🙂', 'é', ' ', '  ', '.', ',', '’', 'recieve', 'luck', 'lock', '\u200B', '\t', 'İ', '1'];
  for (let i = 0; i < 1000; i += 1) {
    const text = Array.from({ length: rng.int(0, 12) }, () => rng.pick(pool)).join(rng.next() < 0.5 ? ' ' : '');
    const other = Array.from({ length: rng.int(0, 12) }, () => rng.pick(pool)).join(' ');
    const r = compare(text, [other], { ...WITH, lang: rng.next() < 0.3 ? 'es' : 'en' });
    assert.ok(['correct', 'almost', 'wrong'].includes(r.result));
    wordDiff(text, other, WITH);
  }
});
