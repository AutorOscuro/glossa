// @purpose: Pruebas de la corrección palabra por palabra (core/wordDiff.js).
// Pruebas de core/wordDiff.js (subparte 1.2, cuarto 3, mitad 3A). Contrato: docs/CONTRACTS.md 1.2-3A.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { wordDiff, alignWords } from '../core/wordDiff.js';
import { compare } from '../core/compare.js';
import { createConfusables } from '../core/confusables.js';
import { makeRng } from './_helpers.mjs';

const C = createConfusables(JSON.parse(fs.readFileSync(new URL('../content/taxonomy/confusables.json', import.meta.url), 'utf8')));
const WITH = { confusables: C };
// Forma corta para la tabla: "palabra:estado" o "palabra:estado>esperada"
const short = (diff) => diff.map((t) => (t.expected ? `${t.text}:${t.status}>${t.expected}` : `${t.text}:${t.status}`)).join(' ');

const TABLE = [
  ['I have a dog', 'I have a dog', WITH, 'i:ok have:ok a:ok dog:ok'],
  ['i HAVE a   dog.', 'I have a dog', WITH, 'i:ok have:ok a:ok dog:ok'],
  ['I have dog', 'I have a dog', WITH, 'i:ok have:ok a:missing dog:ok'],
  ['I have a big dog', 'I have a dog', WITH, 'i:ok have:ok a:ok big:extra dog:ok'],
  ['I have a cat', 'I have a dog', WITH, 'i:ok have:ok a:ok cat:wrong>dog'],
  ['I recieve it', 'I receive it', WITH, 'i:ok recieve:close>receive it:ok'],
  ['He work here', 'He works here', WITH, 'he:ok work:wrong>works here:ok'],
  ['He work here', 'He works here', { ...WITH, almostAtWordEnd: true }, 'he:ok work:close>works here:ok'],
  ['Good lock', 'Good luck', WITH, 'good:ok lock:wrong>luck'],
  ['Good lock', 'Good luck', undefined, 'good:ok lock:close>luck'],
  ['I don\'t go', 'I do not go', WITH, 'i:ok do:ok not:ok go:ok'],
  ['I do not go', 'I don’t go', WITH, 'i:ok do:ok not:ok go:ok'],
  ['I can\'t swim', 'I cannot swim', WITH, 'i:ok cannot:ok swim:ok'],
  ['Yes I do', 'Yes, I do.', WITH, 'yes:ok i:ok do:ok'],
  ['Well , yes . I do', 'Well, yes. I do.', WITH, 'well:ok yes:ok i:ok do:ok'],
  ['I leaved home', 'I left home', WITH, 'i:ok leaved:wrong>left home:ok'],
  ['I eated pizza', 'I ate pizza', WITH, 'i:ok eated:wrong>ate pizza:ok'],
  ['He didn\'t went', 'He didn\'t go', WITH, 'he:ok did:ok not:ok went:wrong>go'],
  ['She can to swim', 'She can swim', WITH, 'she:ok can:ok to:extra swim:ok'],
  ['I live here since two years', 'I have lived here for two years', WITH, 'i:ok have:missing live:wrong>lived here:ok since:wrong>for two:ok years:ok'],
  ['', 'I have a dog', WITH, 'i:missing have:missing a:missing dog:missing'],
  ['I have a dog', '', WITH, 'i:extra have:extra a:extra dog:extra'],
  ['', '', WITH, ''],
  ['cat', 'dog', WITH, 'cat:wrong>dog'],
  ['Hello!', 'Hello.', { keepFinalPunctuation: true }, 'hello!:wrong>hello.'],
  ['Hello', 'Hello.', { keepFinalPunctuation: true }, 'hello:wrong>hello.'],
  ['canción', 'cancion', { lang: 'es' }, 'cancion:ok'],
  ['cancion', 'canción', undefined, 'cancion:close>canción'],
  ['A well known actor', 'A well-known actor', WITH, 'a:ok well:extra known:wrong>well-known actor:ok'], // el guion cuenta: son 2 palabras frente a 1
];

test('tabla: casos de ok, close, wrong, extra y missing con el orden de lectura', () => {
  for (const [user, ref, opts, expected] of TABLE) {
    const got = short(wordDiff(user, ref, opts));
    assert.equal(got, expected, `${JSON.stringify(user)} vs ${JSON.stringify(ref)}`);
  }
});

test('alignWords devuelve el mismo diff y un coste: 0 igual, 0,5 por casi, 1,5 por cambiada, 1 por sobra/falta', () => {
  assert.equal(alignWords('I have a dog', 'I have a dog', WITH).cost, 0);
  assert.equal(alignWords('I recieve it', 'I receive it', WITH).cost, 0.5);
  assert.equal(alignWords('I have a cat', 'I have a dog', WITH).cost, 1.5);
  assert.equal(alignWords('I have dog', 'I have a dog', WITH).cost, 1);
  assert.equal(alignWords('I have a big dog', 'I have a dog', WITH).cost, 1);
  assert.equal(alignWords('', 'a b c', WITH).cost, 3);
  assert.deepEqual(alignWords('I have dog', 'I have a dog', WITH).diff, wordDiff('I have dog', 'I have a dog', WITH));
});

test('entradas raras no lanzan: null, undefined, números, objetos, emoji, tabuladores', () => {
  for (const u of [null, undefined, 0, NaN, 42, {}, [], true, Symbol('x'), '🙂', '\t\n', '\u200B', 'I like 🍕']) {
    for (const r of [null, undefined, 7, {}, '', '🙂', 'I like 🍕', ['a']]) {
      const d = wordDiff(u, r, { confusables: { areConfusable() { throw new Error('x'); } }, lang: 'es' });
      assert.ok(Array.isArray(d));
    }
  }
  assert.deepEqual(wordDiff(42, '42'), [{ text: '42', status: 'ok' }]);
  assert.equal(short(wordDiff('I like 🍕', 'I like 🍕')), 'i:ok like:ok 🍕:ok');
});

test('textos largos: se leen 250 palabras por lado, el resultado cabe en 500 elementos y no se cuelga', () => {
  const t0 = Date.now();
  const a = Array.from({ length: 600 }, (_, i) => `w${i}`).join(' ');
  const b = Array.from({ length: 600 }, (_, i) => `x${i}`).join(' ');
  const { diff, cost } = alignWords(a, b);
  assert.ok(diff.length <= 500);
  assert.equal(cost, 250 * 1.5 + 350 + 350, 'las 250 leídas cambiadas y las 350 de cada lado descartadas suman 1 cada una');
  assert.equal(wordDiff(a, a).every((t) => t.status === 'ok'), true);
  assert.equal(wordDiff('x'.repeat(5000), 'x'.repeat(5000)).length, 1);
  assert.ok(Date.now() - t0 < 2000);
});

// Oráculo independiente: coste mínimo por recursión con memoria (no la tabla de la implementación).
function oracleCost(U, R, near) {
  const memo = new Map();
  const go = (i, j) => {
    if (i === U.length) return (R.length - j);
    if (j === R.length) return (U.length - i);
    const key = `${i},${j}`;
    if (memo.has(key)) return memo.get(key);
    const pair = U[i] === R[j] ? 0 : near(U[i], R[j]) ? 0.5 : 1.5;
    const best = Math.min(pair + go(i + 1, j + 1), 1 + go(i + 1, j), 1 + go(i, j + 1));
    memo.set(key, best);
    return best;
  };
  return go(0, 0);
}

const POOL = ['i', 'have', 'a', 'dog', 'dogs', 'receive', 'recieve', 'luck', 'lock', 'works', 'work', 'go', 'went', 'not', 'the', 'big'];
const SMALL_NEAR = (u, r) => (u === 'recieve' && r === 'receive') || (u === 'receive' && r === 'recieve');

test('coste mínimo: coincide con un oráculo independiente en 300 pares pequeños', () => {
  const rng = makeRng(31);
  for (let k = 0; k < 300; k += 1) {
    const U = Array.from({ length: rng.int(0, 6) }, () => rng.pick(POOL));
    const R = Array.from({ length: rng.int(0, 6) }, () => rng.pick(POOL));
    const got = alignWords(U.join(' '), R.join(' '), WITH).cost;
    // dogs/dog, works/work, luck/lock y went/... no son "casi" aquí (última letra o confusables); solo recieve/receive lo es.
    assert.equal(got, oracleCost(U, R, SMALL_NEAR), `${U.join(' ')} | ${R.join(' ')}`);
  }
});

const ALPHABET = ['a', 'b', 'e', 'i', ' ', ' ', '\'', '’', '.', ',', '!', 'É', 'ñ', '🙂', '\u200B', '-', '1'];
const rand = (rng) => (rng.next() < 0.5
  ? Array.from({ length: rng.int(0, 16) }, () => rng.pick(ALPHABET)).join('')
  : Array.from({ length: rng.int(0, 7) }, () => rng.pick(POOL)).join(' '));

test('fuzz de 1000 pares: forma válida, el orden de lectura se conserva y concuerda con compare', () => {
  const rng = makeRng(20261018);
  const STATUS = ['ok', 'close', 'wrong', 'extra', 'missing'];
  for (let k = 0; k < 1000; k += 1) {
    const user = rand(rng);
    const ref = rand(rng);
    const opts = { confusables: rng.next() < 0.5 ? C : undefined, lang: rng.next() < 0.3 ? 'es' : 'en', keepFinalPunctuation: rng.next() < 0.3, almostAtWordEnd: rng.next() < 0.3 };
    const { diff, cost } = alignWords(user, ref, opts);
    assert.ok(diff.length <= 500 && cost >= 0);
    for (const t of diff) {
      assert.ok(STATUS.includes(t.status));
      assert.ok(typeof t.text === 'string' && t.text !== '' && !/\s/u.test(t.text), JSON.stringify(t));
      assert.equal(t.expected !== undefined, t.status === 'close' || t.status === 'wrong');
    }
    // El lado de la persona y el de la referencia se reconstruyen en orden.
    const userSide = diff.filter((t) => t.status !== 'missing').map((t) => t.text);
    const refSide = diff.filter((t) => t.status !== 'extra').map((t) => (t.expected !== undefined ? t.expected : t.text));
    assert.equal(userSide.join(' '), alignWords(user, '', opts).diff.map((t) => t.text).join(' '));
    assert.equal(refSide.join(' '), alignWords('', ref, opts).diff.map((t) => t.text).join(' '));
    // Coherencia con compare.
    const cmp = compare(user, [ref], opts);
    if (userSide.length > 0 && refSide.length > 0) {
      if (cmp.result === 'correct') assert.ok(diff.every((t) => t.status === 'ok'), 'correct → todo ok');
      if (cmp.result === 'almost') assert.deepEqual(diff.map((t) => t.status).filter((s) => s !== 'ok'), ['close'], 'almost → una sola close');
      if (cmp.result === 'wrong') assert.ok(diff.some((t) => t.status !== 'ok'), 'wrong → algo no ok');
    }
    if (diff.every((t) => t.status === 'ok') && diff.length > 0) assert.equal(cmp.result, 'correct');
  }
});
