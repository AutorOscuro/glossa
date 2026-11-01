// @purpose: Pruebas de la distancia damerauLevenshtein (core/normalize.js).
// Pruebas de damerauLevenshtein (subparte 1.2, cuarto 2A).
import test from 'node:test';
import assert from 'node:assert/strict';
import { damerauLevenshtein as d } from '../core/normalize.js';

const TABLE = [
  ['', '', 0], ['a', 'a', 0], ['abc', 'abc', 0],
  ['', 'abc', 3], ['abc', '', 3],
  ['a', 'b', 1], ['cat', 'cut', 1], ['cat', 'cats', 1], ['cats', 'cat', 1], ['cat', 'at', 1],
  ['ab', 'ba', 1], ['abc', 'acb', 1], ['abcd', 'acbd', 1], ['hello', 'hlelo', 1],
  ['form', 'from', 1], ['receive', 'recieve', 1], ['separate', 'seperate', 1], ['definitely', 'definately', 1],
  ['went', 'want', 1], ['bad', 'bed', 1], ['its', "it's", 1],
  ['kitten', 'sitting', 3], ['sunday', 'saturday', 3],
  ['abc', 'bca', 2], ['ca', 'abc', 2],
  ['live', 'leave', 2], ['ship', 'sheep', 2], ['eated', 'ate', 2], ['leaved', 'left', 4],
  ['I', 'i', 1], ['é', 'e', 1], ['😀', 'a', 1], ['😀a', 'a', 1], ['😀😀', '😀', 1],
  ['ñandú', 'nandu', 2],
];
for (const [a, b, expected] of TABLE) {
  test(`damerau: "${a}" ↔ "${b}" = ${expected}`, () => {
    assert.equal(d(a, b), expected);
    assert.equal(d(b, a), expected, 'simétrica');
  });
}

test('damerau: entradas que no son texto cuentan como vacío y no lanzan', () => {
  assert.equal(d(null, 'abc'), 3);
  assert.equal(d('abc', undefined), 3);
  assert.equal(d({}, []), 0);
  assert.equal(d(5, 5), 0);
  assert.equal(d(NaN, 'a'), 1);
});

test('damerau: max devuelve max + 1 cuando se supera y el valor real cuando no', () => {
  assert.equal(d('xx', 'yy', 1), 2);
  assert.equal(d('abcdef', 'a', 2), 3);
  assert.equal(d('form', 'from', 1), 1);
  assert.equal(d('abc', 'abc', 0), 0);
  assert.equal(d('abc', 'abd', 0), 1);
  assert.equal(d('', 'abc', 1), 2);
  assert.equal(d('abc', '', 5), 3);
  assert.equal(d('abc', 'xyz', -1), 3, 'max negativo se ignora');
  assert.equal(d('abc', 'xyz', NaN), 3);
  assert.equal(d('abcdef', 'abxyzf', 1), 2, 'misma longitud pero lejos: devuelve max + 1, no el valor real (3)');
  assert.equal(d('abcdef', 'abxyzf', 3), 3);
});

test('damerau: palabras de más de 200 puntos de código devuelven Infinity sin colgarse', () => {
  const t0 = Date.now();
  assert.equal(d('a'.repeat(201), 'a'), Infinity);
  assert.equal(d('a', 'a'.repeat(5000)), Infinity);
  assert.ok(Date.now() - t0 < 100);
  assert.equal(d('a'.repeat(200), 'a'.repeat(199)), 1);
});

test('damerau: 200 vs 200 caracteres tarda poco', () => {
  const t0 = Date.now();
  d('ab'.repeat(100), 'ba'.repeat(100));
  assert.ok(Date.now() - t0 < 300);
});

// Oráculo independiente: búsqueda en anchura con las 4 operaciones (insertar, borrar, sustituir, intercambiar vecinas).
function bfs(a, b, alphabet, cap) {
  if (a === b) return 0;
  let frontier = [a];
  const seen = new Set([a]);
  for (let steps = 1; steps <= cap; steps += 1) {
    const next = [];
    for (const s of frontier) {
      const out = [];
      for (let i = 0; i <= s.length; i += 1) for (const c of alphabet) out.push(s.slice(0, i) + c + s.slice(i));
      for (let i = 0; i < s.length; i += 1) {
        out.push(s.slice(0, i) + s.slice(i + 1));
        for (const c of alphabet) if (c !== s[i]) out.push(s.slice(0, i) + c + s.slice(i + 1));
        if (i + 1 < s.length && s[i] !== s[i + 1]) out.push(s.slice(0, i) + s[i + 1] + s[i] + s.slice(i + 2));
      }
      for (const o of out) {
        if (o.length > 7 || seen.has(o)) continue;
        if (o === b) return steps;
        seen.add(o);
        next.push(o);
      }
    }
    frontier = next;
  }
  return Infinity;
}

test('damerau: coincide con un oráculo de búsqueda en anchura en 250 pares aleatorios', () => {
  let seed = 2024;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const word = () => Array.from({ length: Math.floor(rnd() * 5) }, () => 'abc'[Math.floor(rnd() * 3)]).join('');
  for (let i = 0; i < 250; i += 1) {
    const a = word();
    const b = word();
    assert.equal(d(a, b), bfs(a, b, 'abc', 8), `${JSON.stringify(a)} ↔ ${JSON.stringify(b)}`);
  }
});

test('damerau: propiedades (identidad, simetría, cota, triangular) en 500 trozos aleatorios', () => {
  let seed = 77;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const word = () => Array.from({ length: Math.floor(rnd() * 8) }, () => 'abcé😀'[Math.floor(rnd() * 5)]).join('');
  for (let i = 0; i < 500; i += 1) {
    const a = word(); const b = word(); const c = word();
    assert.equal(d(a, a), 0);
    assert.equal(d(a, b), d(b, a));
    assert.ok(d(a, b) <= Math.max(Array.from(a).length, Array.from(b).length));
    assert.ok(d(a, c) <= d(a, b) + d(b, c), 'desigualdad triangular');
    assert.equal(d(a, b) === 0, a === b);
  }
});

test('damerau: una sola edición siempre da 1', () => {
  assert.equal(d('hello', 'hxllo'), 1);
  assert.equal(d('hello', 'helo'), 1);
  assert.equal(d('hello', 'helllo'), 1);
  assert.equal(d('hello', 'hlelo'), 1);
});
