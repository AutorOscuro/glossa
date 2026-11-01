// @purpose: Pruebas de la lectura de ítems match_pairs (core/matchPairs.js, 2.4-T2 punto 1; el estado y la calificación están en matchPairsState.test.mjs): válidos, bordes de los topes, cada dato dañado y coherencia con el validador.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MATCH_LIMITS, readMatch } from '../core/matchPairs.js';
import { DATA_SPECS } from '../core/contentData.js';
import { validateItem } from '../core/contentItem.js';
import { LIMITS } from '../core/contentRules.js';

const pairs = (n) => Array.from({ length: n }, (_, i) => ({ left: `l${i}`, right: `r${i}` }));
const item = (data = {}, extra = {}) => ({ id: 'g.mp.0001', type: 'match_pairs', prompt_es: 'Une.', data: { pairs: pairs(5), ...data }, ...extra });
const reason = (it) => { const r = readMatch(it); return r.ok ? 'ok' : r.reason; };
const k = (n) => 'a'.repeat(n);

test('los topes son los del validador (sin números distintos)', () => {
  assert.deepEqual({ ...MATCH_LIMITS }, { min: 2, max: 10, textLength: 120, extraMax: 4, attempts: 400 });
  assert.ok(Object.isFrozen(MATCH_LIMITS));
  assert.equal(MATCH_LIMITS.textLength, LIMITS.short);
});

test('caso feliz: parejas, lefts, rights y distractores', () => {
  const r = readMatch(item({ pairs: [{ left: 'dog', right: 'perro' }, { left: 'cat', right: 'gato' }], extra_right: ['pez'] }));
  assert.deepEqual(r, { ok: true, pairs: [{ left: 'dog', right: 'perro' }, { left: 'cat', right: 'gato' }], lefts: ['dog', 'cat'], rights: ['perro', 'gato'], extra: ['pez'] });
});

test('sin extra_right (o null) extra es lista vacía', () => {
  assert.deepEqual(readMatch(item()).extra, []);
  assert.deepEqual(readMatch(item({ extra_right: null })).extra, []);
  assert.deepEqual(readMatch(item({ extra_right: [] })).extra, []);
});

test('los textos salen recortados', () => {
  const r = readMatch(item({ pairs: [{ left: ' a ', right: ' b ' }, { left: 'c', right: 'd' }], extra_right: [' e '] }));
  assert.deepEqual(r.pairs[0], { left: 'a', right: 'b' });
  assert.deepEqual(r.extra, ['e']);
});

test('bordes de las parejas: 2 y 10 valen; 1 y 11 no', () => {
  assert.equal(reason(item({ pairs: pairs(MATCH_LIMITS.min) })), 'ok');
  assert.equal(reason(item({ pairs: pairs(MATCH_LIMITS.max) })), 'ok');
  assert.equal(reason(item({ pairs: pairs(MATCH_LIMITS.min - 1) })), 'bad_pairs');
  assert.equal(reason(item({ pairs: pairs(MATCH_LIMITS.max + 1) })), 'bad_pairs');
  assert.equal(reason(item({ pairs: [] })), 'bad_pairs');
});

test('bordes del texto: 120 vale y 121 no (en left, right y extra_right)', () => {
  assert.equal(reason(item({ pairs: [{ left: k(120), right: k(119) + 'b' }, { left: 'x', right: 'y' }] })), 'ok');
  assert.equal(reason(item({ pairs: [{ left: k(121), right: 'r' }, { left: 'x', right: 'y' }] })), 'bad_pairs');
  assert.equal(reason(item({ pairs: [{ left: 'l', right: k(121) }, { left: 'x', right: 'y' }] })), 'bad_pairs');
  assert.equal(reason(item({ extra_right: [k(120)] })), 'ok');
  assert.equal(reason(item({ extra_right: [k(121)] })), 'bad_extra');
});

test('bordes de extra_right: 4 valen; 5 no', () => {
  assert.equal(reason(item({ extra_right: ['e1', 'e2', 'e3', 'e4'] })), 'ok');
  assert.equal(reason(item({ extra_right: ['e1', 'e2', 'e3', 'e4', 'e5'] })), 'bad_extra');
});

test('cada dato dañado da su razón', () => {
  for (const bad of [null, undefined, 5, 'x', [], { type: 'match_pairs' }, { data: null }, { data: [] }, { data: 'x' }]) assert.equal(reason(bad), 'no_data', JSON.stringify(bad));
  for (const p of [undefined, null, 'x', {}, 5, [null], [5, 5], [{ left: 'a' }, { left: 'b', right: 'c' }], [{ left: 'a', right: 'b' }, { left: '', right: 'c' }],
    [{ left: 'a', right: 'b' }, { left: 'c', right: '   ' }], [{ left: 'a', right: 'b' }, { left: 3, right: 'c' }], [{ left: 'a', right: 'b' }, ['c', 'd']]]) {
    assert.equal(reason({ type: 'match_pairs', data: { pairs: p } }), 'bad_pairs', JSON.stringify(p));
  }
  for (const e of ['x', {}, 5, [5], [''], ['  '], [null], ['a', 'a']]) assert.equal(reason(item({ extra_right: e })), 'bad_extra', JSON.stringify(e));
});

test('left o right repetidos: bad_pairs (también tras recortar)', () => {
  assert.equal(reason(item({ pairs: [{ left: 'a', right: 'x' }, { left: 'a', right: 'y' }] })), 'bad_pairs');
  assert.equal(reason(item({ pairs: [{ left: 'a', right: 'x' }, { left: 'b', right: 'x' }] })), 'bad_pairs');
  assert.equal(reason(item({ pairs: [{ left: 'a', right: 'x' }, { left: ' a ', right: 'y' }] })), 'bad_pairs');
  assert.equal(reason(item({ pairs: [{ left: 'a', right: 'x' }, { left: 'b', right: ' x' }] })), 'bad_pairs');
  assert.equal(reason(item({ pairs: [{ left: 'a', right: 'b' }, { left: 'b', right: 'a' }] })), 'ok', 'un texto puede estar a la izquierda de una y a la derecha de otra');
});

test('un extra_right igual a un right de pareja no vale (ni recortado)', () => {
  assert.equal(reason(item({ extra_right: ['r0'] })), 'bad_extra');
  assert.equal(reason(item({ extra_right: [' r3 '] })), 'bad_extra');
  assert.equal(reason(item({ extra_right: ['l0'] })), 'ok', 'igual a un left sí: son lados distintos');
});

test('el tipo no cambia nada (solo se lee data) y no muta el ítem', () => {
  const it = item({ extra_right: ['e'] }, { type: 'categorize' });
  const copy = JSON.stringify(it);
  assert.equal(readMatch(it).ok, true);
  assert.equal(JSON.stringify(it), copy);
});

test('el resultado no comparte listas con el ítem', () => {
  const it = item();
  const r = readMatch(it);
  r.lefts.push('zzz');
  r.pairs.push({ left: 'q', right: 'w' });
  assert.equal(it.data.pairs.length, 5);
  assert.equal(readMatch(it).lefts.length, 5);
});

// ---- coherencia con el validador ----
test('lo que el validador acepta de `matching` es lo que readMatch lee, con parejas al azar', () => {
  let seed = 12345;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  const word = () => ['a', 'b', 'c', 'dd', 'ee', 'fff', ' g', 'h '][rnd(8)];
  let agree = 0;
  for (let t = 0; t < 400; t += 1) {
    const n = 1 + rnd(12);
    const ps = Array.from({ length: n }, () => ({ left: word(), right: word() }));
    const data = { pairs: ps };
    if (rnd(2)) data.extra_right = Array.from({ length: rnd(6) }, word);
    const it = { id: 'gram.pp.0001', type: 'match_pairs', topics: ['gram.present_perfect.form'], level: 'A2', prompt_es: 'x', data, explain_es: 'x', source: 'original', version: 1 };
    const v = validateItem(it, { dataSpecs: DATA_SPECS }).ok;
    const r = readMatch(it).ok;
    // El lector es más estricto en dos casos que el validador NO mira (extra_right repetido o igual a un right); en el resto deben coincidir.
    if (v && !r) {
      const e = data.extra_right ?? [];
      const rights = ps.map((x) => x.right.trim());
      const trimmedDup = new Set(ps.map((x) => x.left.trim())).size !== n || new Set(rights).size !== n;
      assert.ok(trimmedDup || new Set(e.map((x) => x.trim())).size !== e.length || e.some((x) => rights.includes(x.trim())), `incoherente: ${JSON.stringify(data)}`);
    } else {
      assert.equal(r && !v, false, `readMatch acepta lo que el validador rechaza: ${JSON.stringify(data)}`);
      agree += 1;
    }
  }
  assert.ok(agree > 50, 'el azar debe producir suficientes casos válidos');
});
