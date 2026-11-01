// @purpose: Pruebas de la lectura y calificación de unscramble_letters y build_from_keywords (core/buildPieces.js, 2.4-T3 punto 1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUILD_LIMITS, readBuild, gradeBuild } from '../core/buildPieces.js';

const word = (data = {}, extra = {}) => ({ id: 'g.unl.0001', type: 'unscramble_letters', prompt_es: 'Ordena las letras.', data: { pieces: ['c', 'a', 't'], ...data }, ...extra });
const sent = (data = {}, extra = {}) => ({ id: 'g.bfk.0001', type: 'build_from_keywords', prompt_es: 'Construye la frase.', data: { pieces: ['I', 'have', 'eaten'], ...data }, ...extra });
const many = (n) => Array.from({ length: n }, (_, i) => `p${i}`);

test('límites congelados: 2 a 12 piezas, hasta 4 de más', () => {
  assert.deepEqual(BUILD_LIMITS, { min: 2, max: 12, extraMax: 4, pieceLength: 120, acceptLength: 600 });
  assert.ok(Object.isFrozen(BUILD_LIMITS));
});

test('letras: une sin espacio; frases: une con un espacio', () => {
  const a = readBuild(word());
  assert.deepEqual(a, { ok: true, pieces: ['c', 'a', 't'], extras: [], all: ['c', 'a', 't'], solution: 'cat', accept: ['cat'], joiner: '', shuffle: true });
  const b = readBuild(sent());
  assert.equal(b.solution, 'I have eaten');
  assert.equal(b.joiner, ' ');
});

test('las piezas de más van después en `all` y no entran en la solución', () => {
  const r = readBuild(word({ extra_pieces: ['x', 'z'] }));
  assert.deepEqual(r.all, ['c', 'a', 't', 'x', 'z']);
  assert.deepEqual(r.extras, ['x', 'z']);
  assert.equal(r.solution, 'cat');
});

test('2 y 12 piezas valen; 1 y 13 no; 4 de más valen, 5 no', () => {
  assert.equal(readBuild(sent({ pieces: many(2) })).ok, true);
  assert.equal(readBuild(sent({ pieces: many(12) })).ok, true);
  assert.equal(readBuild(sent({ pieces: many(1) })).reason, 'bad_pieces');
  assert.equal(readBuild(sent({ pieces: many(13) })).reason, 'bad_pieces');
  assert.equal(readBuild(sent({ extra_pieces: many(4) })).ok, true);
  assert.equal(readBuild(sent({ extra_pieces: many(5) })).reason, 'bad_extra');
  assert.equal(readBuild(sent({ pieces: many(12), extra_pieces: many(4) })).all.length, 16);
});

test('razones de rechazo', () => {
  assert.equal(readBuild(null).reason, 'no_data');
  assert.equal(readBuild({ type: 'unscramble_letters' }).reason, 'no_data');
  assert.equal(readBuild({ type: 'order_blocks', data: { pieces: ['a', 'b'] } }).reason, 'bad_type');
  assert.equal(readBuild({ type: 'toString', data: { pieces: ['a', 'b'] } }).reason, 'bad_type');
  assert.equal(readBuild(sent({ pieces: ['a', ''] })).reason, 'bad_pieces');
  assert.equal(readBuild(sent({ pieces: ['a', '   '] })).reason, 'bad_pieces');
  assert.equal(readBuild(sent({ pieces: ['a', 7] })).reason, 'bad_pieces');
  assert.equal(readBuild(sent({ pieces: ['a', 'x'.repeat(121)] })).reason, 'bad_pieces');
  assert.equal(readBuild(sent({ pieces: ['a', 'x'.repeat(120)] })).ok, true);
  assert.equal(readBuild(sent({ extra_pieces: 'x' })).reason, 'bad_extra');
  assert.equal(readBuild(sent({ extra_pieces: [''] })).reason, 'bad_extra');
  assert.equal(readBuild(sent({}, { accept: 'x' })).reason, 'bad_accept');
  assert.equal(readBuild(sent({}, { accept: [''] })).reason, 'bad_accept');
  assert.equal(readBuild(sent({}, { accept: ['x'.repeat(601)] })).reason, 'bad_accept');
  assert.equal(readBuild(sent({}, { accept: ['x'.repeat(600)] })).ok, true);
});

test('null y undefined en los campos opcionales cuentan como ausentes', () => {
  assert.equal(readBuild(sent({ extra_pieces: null }, { accept: null })).ok, true);
  assert.equal(readBuild(sent({ extra_pieces: undefined }, { accept: undefined })).ok, true);
});

test('shuffle:false se respeta; cualquier otro valor baraja', () => {
  assert.equal(readBuild(word({ shuffle: false })).shuffle, false);
  assert.equal(readBuild(word({ shuffle: true })).shuffle, true);
});

test('accept: la solución va primero y no se repite', () => {
  const r = readBuild(sent({}, { accept: ['I have eaten', 'I ate', 'I ate', 'I have eaten'] }));
  assert.deepEqual(r.accept, ['I have eaten', 'I ate']);
});

test('la lectura no comparte listas con el ítem', () => {
  const it = word({ extra_pieces: ['x'] });
  const r = readBuild(it);
  r.pieces.push('q'); r.extras.push('q');
  assert.deepEqual(it.data.pieces, ['c', 'a', 't']);
  assert.deepEqual(it.data.extra_pieces, ['x']);
});

test('califica: orden correcto, incorrecto, vacío y a medias', () => {
  const ok = gradeBuild(word(), [0, 1, 2]);
  assert.deepEqual(ok, { result: 'correct', placed: [0, 1, 2], text: 'cat', matched: 'cat', complete: true, empty: false, usedExtra: [], misplaced: [] });
  const bad = gradeBuild(word(), [2, 1, 0]);
  assert.equal(bad.result, 'wrong');
  assert.equal(bad.text, 'tac');
  assert.deepEqual(bad.misplaced, [0, 2]);
  const empty = gradeBuild(word(), []);
  assert.equal(empty.empty, true);
  assert.equal(empty.complete, false);
  assert.equal(empty.result, 'wrong');
  const half = gradeBuild(word(), [0, 1]);
  assert.equal(half.complete, false);
  assert.deepEqual(half.misplaced, []);
});

test('un solo cambio de orden en una palabra larga nunca es «almost»', () => {
  const it = word({ pieces: [...'receive'] });
  const r = gradeBuild(it, [0, 1, 2, 4, 3, 5, 6]);
  assert.equal(r.text, 'recieve');
  assert.equal(r.result, 'wrong');
});

test('varios órdenes válidos en accept (frases)', () => {
  const it = sent({ pieces: ['I', 'have', 'eaten'] }, { accept: ['have I eaten'] });
  assert.equal(gradeBuild(it, [1, 0, 2]).result, 'correct');
  assert.equal(gradeBuild(it, [1, 0, 2]).matched, 'have I eaten');
  assert.equal(gradeBuild(it, [0, 1, 2]).matched, 'I have eaten');
  assert.equal(gradeBuild(it, [0, 2, 1]).result, 'wrong');
});

test('usar una pieza de más es incorrecto aunque estén todas las de la respuesta', () => {
  const it = sent({ extra_pieces: ['has'] });
  const r = gradeBuild(it, [0, 3, 1, 2]);
  assert.equal(r.result, 'wrong');
  assert.equal(r.complete, true);
  assert.deepEqual(r.usedExtra, [3]);
  assert.deepEqual(r.misplaced, []);
  assert.equal(gradeBuild(it, [0, 1, 2]).result, 'correct');
});

test('lo inválido en `placed` se ignora y nunca lanza', () => {
  const it = word({ extra_pieces: ['x'] });
  assert.equal(gradeBuild(it, [0, 0, 1, 1, 2, 2]).result, 'correct');
  assert.equal(gradeBuild(it, [0, -1, 1.5, '1', null, undefined, NaN, 99, 4, 1, 2]).placed.length, 3);
  for (const bad of [null, undefined, 'abc', 7, {}, { length: 3 }]) {
    const r = gradeBuild(it, bad);
    assert.equal(r.empty, true);
    assert.equal(r.result, 'wrong');
  }
});

test('el índice de una pieza de más válido es total-1; total no vale', () => {
  const it = word({ extra_pieces: ['x', 'z'] });
  assert.deepEqual(gradeBuild(it, [4]).placed, [4]);
  assert.deepEqual(gradeBuild(it, [5]).placed, []);
});

test('dos piezas con el mismo texto son distintas por su posición', () => {
  const it = word({ pieces: ['a', 'b', 'a'] });
  assert.equal(gradeBuild(it, [2, 1, 0]).result, 'correct');
  assert.equal(gradeBuild(it, [0, 1, 2]).result, 'correct');
});

test('las piezas se recortan al unir', () => {
  const it = sent({ pieces: ['  I ', 'have  ', ' eaten'] });
  assert.equal(readBuild(it).solution, 'I have eaten');
  assert.equal(gradeBuild(it, [0, 1, 2]).text, 'I have eaten');
});

test('con 12 y con 2 piezas califica', () => {
  const big = word({ pieces: many(12) });
  assert.equal(gradeBuild(big, Array.from({ length: 12 }, (_, i) => i)).result, 'correct');
  const small = sent({ pieces: ['yes', 'no'] });
  assert.equal(gradeBuild(small, [0, 1]).result, 'correct');
  assert.equal(gradeBuild(small, [1, 0]).result, 'wrong');
});

test('un ítem inválido lanza Error en español', () => {
  assert.throws(() => gradeBuild(null, [0]), /gradeBuild: el ítem de construir no es válido \(no_data\)/);
  assert.throws(() => gradeBuild(word({ pieces: ['a'] }), [0]), /bad_pieces/);
});

test('no muta el ítem ni la lista placed', () => {
  const it = word({ extra_pieces: ['x'] });
  const snap = JSON.stringify(it);
  const placed = [2, 1, 0, 3];
  gradeBuild(it, placed);
  assert.equal(JSON.stringify(it), snap);
  assert.deepEqual(placed, [2, 1, 0, 3]);
});

test('misplaced solo se llena con la respuesta completa y mal: ni a medias ni con un orden válido de accept', () => {
  const half = gradeBuild(word(), [1, 0]);
  assert.equal(half.complete, false);
  assert.deepEqual(half.misplaced, []);
  const it = sent({ pieces: ['I', 'have', 'eaten'] }, { accept: ['have I eaten'] });
  const alt = gradeBuild(it, [1, 0, 2]);
  assert.equal(alt.result, 'correct');
  assert.deepEqual(alt.misplaced, []);
});

test('una frase incorrecta no devuelve `matched`', () => {
  assert.equal(gradeBuild(word(), [1, 0, 2]).matched, null);
  assert.equal(gradeBuild(word(), []).matched, null);
});
