// @purpose: Pruebas de diff y spellingFlags dentro de compare (core/compare.js).
// Pruebas de diff y spellingFlags dentro de compare (subparte 1.2, cuarto 3, mitad 3B). Contrato: docs/CONTRACTS.md 1.2-3B.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compare } from '../core/compare.js';
import { wordDiff } from '../core/wordDiff.js';
import { createConfusables } from '../core/confusables.js';
import { makeRng } from './_helpers.mjs';

const C = createConfusables(JSON.parse(fs.readFileSync(new URL('../content/taxonomy/confusables.json', import.meta.url), 'utf8')));
const WITH = { confusables: C };
const short = (diff) => diff.map((t) => (t.expected ? `${t.text}:${t.status}>${t.expected}` : `${t.text}:${t.status}`)).join(' ');

// [usuario, aceptadas, opciones, flags esperadas, diff esperado en forma corta]
const ALMOST = [
  ['I recieve it', ['I receive it'], WITH, [{ word: 'recieve', expected: 'receive', index: 1 }], 'i:ok recieve:close>receive it:ok'],
  ['She is begining', ['She is beginning'], WITH, [{ word: 'begining', expected: 'beginning', index: 2 }], 'she:ok is:ok begining:close>beginning'],
  ['Tomorow is Monday', ['Tomorrow is Monday'], WITH, [{ word: 'tomorow', expected: 'tomorrow', index: 0 }], 'tomorow:close>tomorrow is:ok monday:ok'],
  ['I am glaad', ['I am happy', 'I am glad'], { ...WITH, almostAtWordEnd: true }, [{ word: 'glaad', expected: 'glad', index: 2 }], 'i:ok am:ok glaad:close>glad'],
  ['I dont recieve it', ['I don\'t receive it'], WITH, [], null], // "dont" ≠ "don't": no es almost (se comprueba más abajo)
  ['I don\'t recieve it', ['I do not receive it'], WITH, [{ word: 'recieve', expected: 'receive', index: 3 }], 'i:ok do:ok not:ok recieve:close>receive it:ok'],
  ['Yes I recieve it', ['Yes, I receive it'], WITH, [{ word: 'recieve', expected: 'receive', index: 2 }], 'yes:ok i:ok recieve:close>receive it:ok'],
  ['Hello wrold.', ['Hello world.'], { ...WITH, keepFinalPunctuation: true }, [{ word: 'wrold', expected: 'world', index: 1 }], 'hello:ok wrold.:close>world.'],
  ['I RECIEVE it', ['I receive it'], WITH, [{ word: 'recieve', expected: 'receive', index: 1 }], 'i:ok recieve:close>receive it:ok'],
  ['cancion', ['canción'], undefined, [{ word: 'cancion', expected: 'canción', index: 0 }], 'cancion:close>canción'],
  ['I like colur', ['I like color', 'I like colour'], WITH, [{ word: 'colur', expected: 'color', index: 2 }], 'i:ok like:ok colur:close>color'],
];

test('almost: UNA marca con la palabra escrita, la correcta y su posición; el diff trae el mismo close', () => {
  for (const [user, accept, opts, flags, shortDiff] of ALMOST) {
    const r = compare(user, accept, opts);
    if (shortDiff === null) {
      assert.equal(r.result, 'wrong', user);
      assert.deepEqual(r.spellingFlags, [], user);
      continue;
    }
    assert.equal(r.result, 'almost', user);
    assert.deepEqual(r.spellingFlags, flags, user);
    assert.equal(short(r.diff).replace(/\./g, ''), shortDiff.replace(/\./g, ''), user);
  }
});

test('almost: la marca y el diff cuentan lo mismo (índice, palabra y esperada)', () => {
  const r = compare('I like colur a lot', ['I like color a lot'], WITH);
  const [flag] = r.spellingFlags;
  const close = r.diff.findIndex((t) => t.status === 'close');
  assert.equal(close, flag.index);
  assert.equal(r.diff[close].text, flag.word);
  assert.equal(r.diff[close].expected, flag.expected);
  assert.equal(r.diff.filter((t) => t.status !== 'ok').length, 1);
});

test('almost con puntuación final conservada: la marca no lleva el punto pegado', () => {
  const r = compare('Hello wrold!', ['Hello world!'], { ...WITH, keepFinalPunctuation: true });
  assert.equal(r.result, 'almost');
  assert.deepEqual(r.spellingFlags, [{ word: 'wrold', expected: 'world', index: 1 }]);
});

test('correct y wrong: spellingFlags siempre []', () => {
  for (const [u, a] of [['I have a dog', 'I have a dog'], ['I leaved home', 'I left home'], ['I recieve a leter', 'I receive a letter'], ['Good lock', 'Good luck'], ['', 'x']]) {
    assert.deepEqual(compare(u, [a], WITH).spellingFlags, [], u);
  }
});

test('correct: el diff es todo ok y coincide con wordDiff contra la aceptada', () => {
  const r = compare('I\'ve a dog', ['I have a dog'], WITH);
  assert.equal(r.result, 'correct');
  assert.equal(short(r.diff), 'i:ok have:ok a:ok dog:ok');
  assert.deepEqual(r.diff, wordDiff('I\'ve a dog', 'I have a dog', WITH));
});

test('correct: la referencia es la aceptada que coincidió, no la primera de la lista', () => {
  const r = compare('He is here', ['He\'s there', 'He is here'], WITH);
  assert.equal(r.matched, 'He is here');
  assert.equal(short(r.diff), 'he:ok is:ok here:ok');
});

test('wrong: el diff se hace contra la aceptada MÁS CERCANA, no contra la primera', () => {
  const accept = ['I would like to buy a new red car', 'I have a dog', 'Where is the station'];
  const r = compare('I have a cat', accept, WITH);
  assert.equal(r.result, 'wrong');
  assert.equal(r.matched, null);
  assert.equal(short(r.diff), 'i:ok have:ok a:ok cat:wrong>dog');
});

test('wrong: con dos aceptadas igual de cercanas gana la primera', () => {
  const r = compare('I have a cat', ['I have a dog', 'I have a bird'], WITH);
  assert.equal(short(r.diff), 'i:ok have:ok a:ok cat:wrong>dog');
  const r2 = compare('I have a cat', ['I have a bird', 'I have a dog'], WITH);
  assert.equal(short(r2.diff), 'i:ok have:ok a:ok cat:wrong>bird');
});

test('wrong: los casos del diagnóstico muestran qué palabra falló', () => {
  assert.equal(short(compare('I leaved home', ['I left home'], WITH).diff), 'i:ok leaved:wrong>left home:ok');
  assert.equal(short(compare('I eated pizza', ['I ate pizza'], WITH).diff), 'i:ok eated:wrong>ate pizza:ok');
  assert.equal(short(compare('He didn\'t went', ['He didn\'t go'], WITH).diff), 'he:ok did:ok not:ok went:wrong>go');
  assert.equal(short(compare('She can to swim', ['She can swim'], WITH).diff), 'she:ok can:ok to:extra swim:ok');
  assert.equal(short(compare('He work here', ['He works here'], WITH).diff), 'he:ok work:wrong>works here:ok');
});

test('wrong con dos errores de tecleo: las dos palabras salen close en el diff, pero no hay marcas', () => {
  const r = compare('I recieve a leter', ['I receive a letter'], WITH);
  assert.equal(r.result, 'wrong');
  assert.equal(short(r.diff), 'i:ok recieve:close>receive a:ok leter:close>letter');
  assert.deepEqual(r.spellingFlags, []);
});

test('respuesta vacía: wrong, sin marcas y el diff muestra todo lo que faltó de la aceptada más corta', () => {
  const r = compare('', ['I have a dog', 'Hi'], WITH);
  assert.equal(r.result, 'wrong');
  assert.equal(short(r.diff), 'hi:missing');
  assert.deepEqual(r.spellingFlags, []);
});

test('sin aceptadas válidas el diff es [] (no hay contra qué comparar)', () => {
  for (const acc of [[], [''], [null, {}, '  '], undefined, null]) {
    const r = compare('I have a dog', acc, WITH);
    assert.equal(r.result, 'wrong');
    assert.deepEqual(r.diff, []);
    assert.deepEqual(r.spellingFlags, []);
  }
});

test('las aceptadas inválidas no cuentan como referencia aunque vengan primero', () => {
  const r = compare('I have a cat', [null, '', 7, 'I have a dog'], WITH);
  assert.equal(short(r.diff), 'i:ok have:ok a:ok cat:wrong>dog');
});

test('lang es: el diff y la marca comparan sin diacríticos', () => {
  const r = compare('Qué fácil', ['que facil'], { lang: 'es' });
  assert.equal(r.result, 'correct');
  assert.equal(short(r.diff), 'que:ok facil:ok');
  const w = compare('La cancion es buena', ['La canción es bonita'], { lang: 'es' });
  assert.equal(w.result, 'wrong');
  assert.equal(short(w.diff), 'la:ok cancion:ok es:ok buena:wrong>bonita');
});

test('textos de más de 250 palabras: la marca sigue saliendo aunque el diff recorte', () => {
  const base = Array.from({ length: 300 }, () => 'word');
  const typo = base.slice();
  typo[280] = 'wrod';
  const r = compare(typo.join(' '), [base.join(' ')], WITH);
  assert.equal(r.result, 'almost');
  assert.deepEqual(r.spellingFlags, [{ word: 'wrod', expected: 'word', index: 280 }]);
  assert.ok(r.diff.length <= 500);
});

test('rendimiento: 5000 aceptadas y textos largos no cuelgan ni lanzan', () => {
  const t0 = Date.now();
  const accept = Array.from({ length: 5000 }, (_, i) => `answer number ${i} is here`);
  const r = compare('I recieve it', accept, WITH);
  assert.equal(r.result, 'wrong');
  assert.ok(r.diff.length > 0 && r.diff.length <= 500);
  const long = Array.from({ length: 250 }, (_, i) => `w${i}`).join(' ');
  const r2 = compare(long, Array.from({ length: 100 }, (_, i) => `${long} z${i}`), WITH);
  assert.equal(r2.result, 'wrong');
  assert.ok(Date.now() - t0 < 4000, `tardó ${Date.now() - t0} ms`);
});

test('cada llamada devuelve arreglos y objetos nuevos y no toca lo recibido', () => {
  const accept = ['I receive it'];
  const opts = { confusables: C };
  const snap = JSON.stringify([accept, Object.keys(opts)]);
  const a = compare('I recieve it', accept, opts);
  const b = compare('I recieve it', accept, opts);
  assert.notEqual(a.spellingFlags, b.spellingFlags);
  assert.notEqual(a.spellingFlags[0], b.spellingFlags[0]);
  assert.notEqual(a.diff, b.diff);
  a.diff.length = 0;
  a.spellingFlags.length = 0;
  assert.equal(compare('I recieve it', accept, opts).diff.length, 3);
  assert.equal(JSON.stringify([accept, Object.keys(opts)]), snap);
});

test('las claves de compare no cambian: result, matched, diff, spellingFlags y errorCodes', () => {
  const r = compare('I recieve it', ['I receive it'], WITH);
  assert.deepEqual(Object.keys(r).sort(), ['diff', 'errorCodes', 'matched', 'result', 'spellingFlags']);
  assert.equal(r.matched, 'I receive it');
  assert.deepEqual(compare('i recieve it', ['I receive it'], WITH).errorCodes, ['MECH.CAP_I']);
});

test('Unicode, números y objetos raros no lanzan y dan diff y marcas con la forma correcta', () => {
  const weird = [undefined, null, '', 0, NaN, 42, true, {}, [], () => 1, Symbol('x'), '🙂', '\u0000', '\uD800', 'I like 🍕🍕', 'cafe\u0301'];
  for (const u of weird) {
    for (const acc of [undefined, null, [], ['I like 🍕'], ['café'], [Symbol('s'), 'x'], 'x', 42]) {
      const r = compare(u, acc, { ...WITH, almostAtWordEnd: true });
      assert.ok(Array.isArray(r.diff) && Array.isArray(r.spellingFlags));
      for (const t of r.diff) assert.ok(['ok', 'close', 'wrong', 'extra', 'missing'].includes(t.status));
    }
  }
});

const WORDS = ['I', 'have', 'dog', 'don\'t', 'do', 'not', 'go', 'went', 'want', 'bad', 'bed', 'receive', 'recieve', 'luck', 'lock', 'works', 'work', 'letter', 'leter', 'friend', 'freind'];
const randomText = (rng) => Array.from({ length: rng.int(0, 6) }, () => rng.pick(WORDS)).join(rng.next() < 0.8 ? ' ' : ', ');

test('fuzz de 1000: coherencia entre result, diff y spellingFlags', () => {
  const rng = makeRng(20261019);
  let almost = 0;
  for (let i = 0; i < 1000; i += 1) {
    const user = randomText(rng);
    const accept = Array.from({ length: rng.int(0, 3) }, () => randomText(rng));
    // Con frecuencia una aceptada es el texto con sus erratas corregidas: así el fuzz produce casos almost de verdad.
    if (rng.next() < 0.5) accept.splice(rng.int(0, accept.length), 0, user.replace('recieve', 'receive').replace('leter', 'letter').replace('freind', 'friend'));
    const opts = { confusables: rng.next() < 0.5 ? C : undefined, almostAtWordEnd: rng.next() < 0.3, keepFinalPunctuation: rng.next() < 0.2 };
    const r = compare(user, accept, opts);
    const where = JSON.stringify([user, accept, opts.almostAtWordEnd, r]);
    assert.ok(r.spellingFlags.length <= 1, where);
    if (r.result !== 'almost') assert.deepEqual(r.spellingFlags, [], where);
    if (r.result === 'correct') assert.ok(r.diff.length > 0 && r.diff.every((t) => t.status === 'ok'), where);
    if (r.result === 'almost') {
      almost += 1;
      assert.equal(r.spellingFlags.length, 1, where);
      const [f] = r.spellingFlags;
      assert.equal(r.diff.filter((t) => t.status === 'close').length, 1, where);
      assert.equal(r.diff[f.index].status, 'close', where);
      assert.equal(r.diff[f.index].text, f.word, where);
      assert.equal(r.diff[f.index].expected, f.expected, where);
      assert.ok(r.diff.every((t, k) => k === f.index || t.status === 'ok'), where);
      assert.deepEqual(r.diff, wordDiff(user, r.matched, opts), where);
    }
    if (r.result === 'wrong') {
      const usable = accept.some((a) => compare(a, [a], opts).result === 'correct');
      if (usable) assert.ok(r.diff.some((t) => t.status !== 'ok'), where);
      else assert.deepEqual(r.diff, [], where);
    }
  }
  assert.ok(almost >= 20, `el fuzz solo produjo ${almost} casos almost`);
});

test('las opciones llegan al diff: almostAtWordEnd y keepFinalPunctuation cambian lo que se pinta', () => {
  const atEnd = compare('He work here', ['He works here'], { ...WITH, almostAtWordEnd: true });
  assert.equal(atEnd.result, 'almost');
  assert.equal(short(atEnd.diff), 'he:ok work:close>works here:ok');
  assert.deepEqual(atEnd.spellingFlags, [{ word: 'work', expected: 'works', index: 1 }]);
  const kept = compare('Hello wrold.', ['Hello world.'], { ...WITH, keepFinalPunctuation: true });
  assert.deepEqual(kept.diff, [{ text: 'hello', status: 'ok' }, { text: 'wrold.', status: 'close', expected: 'world.' }]);
  const plain = compare('Hello wrold.', ['Hello world.'], WITH);
  assert.equal(plain.result, 'almost');
  assert.equal(short(plain.diff), 'hello:ok wrold:close>world');
});

test('wrong: las opciones también cuentan al elegir la aceptada más cercana', () => {
  const accept = ['He is here todya', 'He works here today'];
  const user = 'He work here todya';
  assert.equal(short(compare(user, accept, WITH).diff), 'he:ok work:wrong>is here:ok todya:ok');
  assert.equal(short(compare(user, accept, { ...WITH, almostAtWordEnd: true }).diff), 'he:ok work:close>works here:ok todya:close>today');
});

test('wrong: solo se miran las primeras 100 aceptadas para elegir la referencia', () => {
  const accept = Array.from({ length: 150 }, () => 'a b c d e f g h');
  accept[120] = 'I have a dog'; // la mejor, pero fuera del tope
  accept[10] = 'I have a big grey dog';
  const r = compare('I have a cat', accept, WITH);
  assert.equal(r.result, 'wrong');
  assert.equal(short(r.diff), 'i:ok have:ok a:ok big:missing grey:missing cat:wrong>dog');
});
