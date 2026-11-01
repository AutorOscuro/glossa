// @purpose: Pruebas del estado de toques de construir con piezas (core/buildPieces.js createBuildState y el tope ampliado de createOrderState, 2.4-T3 punto 2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBuildState, gradeBuildState, BUILD_LIMITS } from '../core/buildPieces.js';
import { createOrderState, placeBlock, removeBlock, undoLast, resetOrder, bankOf, STATE_MAX_CEILING } from '../core/orderBlocks.js';
import { createRng } from '../core/rng.js';

const many = (n) => Array.from({ length: n }, (_, i) => `p${i}`);
const sent = (data = {}, extra = {}) => ({ id: 'g.bfk.0001', type: 'build_from_keywords', prompt_es: 'Construye la frase.', data: { pieces: ['I', 'have', 'eaten'], ...data }, ...extra });

test('createOrderState: el tope de bloques es 12 salvo con `max` (12 a 32)', () => {
  assert.equal(STATE_MAX_CEILING, 32);
  assert.throws(() => createOrderState(13, { rng: createRng(1) }), /de 2 a 12$/);
  assert.equal(createOrderState(16, { rng: createRng(1), max: 16 }).count, 16);
  assert.throws(() => createOrderState(17, { rng: createRng(1), max: 16 }), /de 2 a 16$/);
  assert.equal(createOrderState(32, { rng: createRng(1), max: 32 }).count, 32);
  assert.throws(() => createOrderState(33, { rng: createRng(1), max: 33 }), /de 2 a 12$/);
  for (const bad of [11, 12.5, '16', null, NaN, -1, Infinity]) assert.throws(() => createOrderState(13, { rng: createRng(1), max: bad }), /de 2 a 12$/, String(bad));
  assert.equal(createOrderState(12, { rng: createRng(1), max: 11 }).count, 12);
});

test('createBuildState: count = piezas + piezas de más, hasta 16', () => {
  assert.equal(createBuildState(sent(), { rng: createRng(1) }).count, 3);
  assert.equal(createBuildState(sent({ extra_pieces: ['has'] }), { rng: createRng(1) }).count, 4);
  const max = createBuildState(sent({ pieces: many(12), extra_pieces: many(4) }), { rng: createRng(1) });
  assert.equal(max.count, BUILD_LIMITS.max + BUILD_LIMITS.extraMax);
  assert.deepEqual([...max.tray].sort((a, b) => a - b), Array.from({ length: 16 }, (_, i) => i));
});

test('la bandeja no deja las piezas en el orden de la respuesta, y es fija', () => {
  for (let seed = 1; seed <= 40; seed += 1) {
    const st = createBuildState(sent({ pieces: many(5) }), { rng: createRng(seed) });
    assert.ok(st.tray.some((v, k) => v !== k), `semilla ${seed}`);
  }
  let st = createBuildState(sent({ pieces: many(5) }), { rng: createRng(9) });
  const tray = [...st.tray];
  for (const i of [0, 3, 1]) st = placeBlock(st, i);
  st = removeBlock(st, 3);
  assert.deepEqual([...st.tray], tray);
});

test('shuffle:false deja el orden del contenido y no necesita rng', () => {
  const st = createBuildState(sent({ shuffle: false, extra_pieces: ['x'] }));
  assert.deepEqual([...st.tray], [0, 1, 2, 3]);
});

test('con barajado y sin rng lanza Error en español', () => {
  assert.throws(() => createBuildState(sent()), /falta un rng/);
});

test('un ítem inválido lanza Error en español', () => {
  assert.throws(() => createBuildState(null, { rng: createRng(1) }), /createBuildState: el ítem de construir no es válido \(no_data\)/);
  assert.throws(() => createBuildState(sent({ pieces: ['a'] }), { rng: createRng(1) }), /bad_pieces/);
});

test('doble toque en la misma pieza: el mismo estado, sin duplicar ni tocar el historial', () => {
  let st = createBuildState(sent({ extra_pieces: ['x'] }), { rng: createRng(2) });
  st = placeBlock(st, 1);
  const again = placeBlock(st, 1);
  assert.equal(again, st);
  assert.deepEqual([...again.placed], [1]);
  assert.equal(again.history.length, 1);
});

test('quitar lo que no está puesto y piezas fuera de rango no cambian nada', () => {
  const st = createBuildState(sent({ extra_pieces: ['x'] }), { rng: createRng(2) });
  for (const i of [-1, 4, 99, 1.5, '1', null, undefined, NaN]) {
    assert.equal(placeBlock(st, i), st, String(i));
    assert.equal(removeBlock(st, i), st, String(i));
  }
  assert.equal(removeBlock(st, 0), st);
});

test('las piezas de más se pueden colocar, quitar y deshacer como las demás', () => {
  let st = createBuildState(sent({ extra_pieces: ['has'] }), { rng: createRng(4) });
  st = placeBlock(st, 3);
  assert.deepEqual([...st.placed], [3]);
  st = placeBlock(st, 0);
  st = removeBlock(st, 3);
  assert.deepEqual([...st.placed], [0]);
  st = undoLast(st);
  assert.deepEqual([...st.placed], [3, 0]);
  st = resetOrder(st);
  assert.deepEqual([...st.placed], []);
  assert.deepEqual(bankOf(st), [...st.tray]);
});

test('el estado nuevo está congelado y el anterior no cambia', () => {
  const a = createBuildState(sent(), { rng: createRng(5) });
  const b = placeBlock(a, 2);
  assert.ok(Object.isFrozen(b) && Object.isFrozen(b.placed) && Object.isFrozen(b.tray));
  assert.deepEqual([...a.placed], []);
});

test('gradeBuildState califica lo colocado; lo que no es estado cuenta como vacío', () => {
  const it = sent({ extra_pieces: ['has'] });
  let st = createBuildState(it, { rng: createRng(6) });
  for (const i of [0, 1, 2]) st = placeBlock(st, i);
  assert.equal(gradeBuildState(it, st).result, 'correct');
  st = removeBlock(st, 2);
  st = placeBlock(st, 3);
  st = placeBlock(st, 2);
  assert.equal(gradeBuildState(it, st).result, 'wrong');
  assert.deepEqual(gradeBuildState(it, st).usedExtra, [3]);
  for (const bad of [null, undefined, 3, 'x', []]) assert.equal(gradeBuildState(it, bad).empty, true, String(bad));
});

test('deshacer paso a paso vuelve al principio (CA 3 de 2.4)', () => {
  const it = sent({ pieces: many(6), extra_pieces: ['x', 'y'] });
  const rng = createRng(11);
  let st = createBuildState(it, { rng });
  const seen = [st];
  for (const i of [3, 0, 7, 5]) { st = placeBlock(st, i); seen.push(st); }
  st = removeBlock(st, 0); seen.push(st);
  for (let k = seen.length - 1; k > 0; k -= 1) {
    st = undoLast(st);
    assert.deepEqual([...st.placed], [...seen[k - 1].placed], `paso ${k}`);
  }
  assert.equal(st.history.length, 0);
});

test('fuzz: 300 secuencias de toques al azar sin excepciones ni estados imposibles (2, 12 y 16 piezas)', () => {
  for (const [n, e] of [[2, 0], [2, 4], [12, 0], [12, 4], [5, 2]]) {
    const it = sent({ pieces: many(n), extra_pieces: many(e) });
    const total = n + e;
    for (let seed = 1; seed <= 60; seed += 1) {
      const r = createRng(seed * 7 + n);
      let st = createBuildState(it, { rng: createRng(seed) });
      const tray = [...st.tray];
      for (let step = 0; step < 80; step += 1) {
        const roll = r.int ? r.int(0, 4) : Math.floor(Math.random() * 5);
        const i = (r.int ? r.int(-1, total + 1) : Math.floor(Math.random() * (total + 2)) - 1);
        const before = st;
        st = [placeBlock, removeBlock, (s) => undoLast(s), (s) => resetOrder(s), placeBlock][roll](st, i);
        assert.ok(new Set(st.placed).size === st.placed.length, 'sin repetidos');
        assert.ok(st.placed.every((x) => Number.isInteger(x) && x >= 0 && x < total), 'en rango');
        assert.deepEqual([...st.tray], tray, 'la bandeja no se mueve');
        assert.equal(bankOf(st).length + st.placed.length, total, 'banco + puestas = total');
        if (st === before) assert.deepEqual([...st.placed], [...before.placed]);
        const g = gradeBuildState(it, st);
        assert.ok(g.result === 'correct' || g.result === 'wrong');
      }
    }
  }
});
