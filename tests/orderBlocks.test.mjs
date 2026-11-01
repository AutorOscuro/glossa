// @purpose: Pruebas de la lectura de ítems order_blocks (core/orderBlocks.js, 2.4-T1 puntos 1 a 3): lectura, calificación y estado de toques (barajar, colocar, quitar, deshacer, reiniciar).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ORDER_LIMITS, readOrder, gradeOrder, createOrderState, placeBlock, removeBlock, undoLast, resetOrder, bankOf, isComplete } from '../core/orderBlocks.js';
import { createRng } from '../core/rng.js';

const item = (data = {}, extra = {}) => ({
  id: 'g.ord.0001', type: 'order_blocks', prompt_es: 'Ordena la frase.',
  data: { blocks: ['I', 'have lived', 'here', 'for two years'], ...data }, ...extra,
});
const many = (n) => Array.from({ length: n }, (_, i) => `b${i}`);

test('límites: 2 a 12 bloques (CA 5 de 2.4)', () => {
  assert.deepEqual(ORDER_LIMITS, { min: 2, max: 12, blockLength: 200, acceptLength: 600, history: 200 });
  assert.ok(Object.isFrozen(ORDER_LIMITS));
});

test('lee un ítem válido: bloques en el orden correcto, frase solución y barajado por defecto', () => {
  const r = readOrder(item());
  assert.deepEqual(r, { ok: true, blocks: ['I', 'have lived', 'here', 'for two years'], solution: 'I have lived here for two years', accept: ['I have lived here for two years'], shuffle: true });
});

test('2 y 12 bloques valen; 1 y 13 no', () => {
  assert.equal(readOrder(item({ blocks: many(2) })).ok, true);
  assert.equal(readOrder(item({ blocks: many(12) })).ok, true);
  assert.equal(readOrder(item({ blocks: many(12) })).solution, many(12).join(' '));
  for (const n of [0, 1, 13]) assert.deepEqual(readOrder(item({ blocks: many(n) })), { ok: false, reason: 'bad_blocks' }, String(n));
});

test('accept añade otros órdenes válidos: la solución va primero y no se repite', () => {
  const r = readOrder(item({}, { accept: ['For two years I have lived here', 'I have lived here for two years', 'For two years I have lived here'] }));
  assert.deepEqual(r.accept, ['I have lived here for two years', 'For two years I have lived here']);
});

test('accept ausente, null o vacío deja solo la solución', () => {
  for (const accept of [undefined, null, []]) assert.deepEqual(readOrder(item({}, { accept })).accept, ['I have lived here for two years']);
});

test('accept mal formado se rechaza con bad_accept', () => {
  for (const accept of ['texto', 5, {}, [''], ['  '], [3], [null], ['x'.repeat(601)]]) assert.deepEqual(readOrder(item({}, { accept })), { ok: false, reason: 'bad_accept' }, JSON.stringify(accept));
  assert.equal(readOrder(item({}, { accept: ['x'.repeat(600)] })).ok, true);
});

test('bloques mal formados se rechazan con bad_blocks', () => {
  for (const blocks of [undefined, null, 'a b', {}, ['a', ''], ['a', '   '], ['a', 3], ['a', null], ['a', ['b']], ['a', 'x'.repeat(201)]]) {
    assert.deepEqual(readOrder(item({ blocks })), { ok: false, reason: 'bad_blocks' }, JSON.stringify(blocks));
  }
  assert.equal(readOrder(item({ blocks: ['a', 'x'.repeat(200)] })).ok, true);
});

test('los bloques se identifican por posición: dos bloques iguales son válidos y se conservan', () => {
  const r = readOrder(item({ blocks: ['very', 'very', 'good'] }));
  assert.equal(r.ok, true);
  assert.deepEqual(r.blocks, ['very', 'very', 'good']);
  assert.equal(r.solution, 'very very good');
});

test('la solución recorta los espacios de los bordes de cada bloque, pero blocks conserva el texto original', () => {
  const r = readOrder(item({ blocks: [' I ', ' agree'] }));
  assert.equal(r.solution, 'I agree');
  assert.deepEqual(r.blocks, [' I ', ' agree']);
});

test('shuffle: false se respeta; cualquier otro valor baraja', () => {
  assert.equal(readOrder(item({ shuffle: false })).shuffle, false);
  for (const s of [true, undefined, null, 0, 'no']) assert.equal(readOrder(item({ shuffle: s })).shuffle, true, String(s));
});

test('no_data: ítem o data ausentes, nulos, listas o de otro tipo', () => {
  for (const it of [undefined, null, 5, 'x', [], {}, { data: null }, { data: [] }, { data: 'x' }]) assert.deepEqual(readOrder(it), { ok: false, reason: 'no_data' }, JSON.stringify(it));
});

test('no muta el ítem y devuelve copias de los bloques', () => {
  const it = item({}, { accept: ['For two years I have lived here'] });
  const before = JSON.stringify(it);
  const r = readOrder(it);
  r.blocks.push('x'); r.accept.push('y');
  assert.equal(JSON.stringify(it), before);
});

test('entradas hostiles: __proto__ en los datos o como texto de un bloque no rompe', () => {
  assert.doesNotThrow(() => readOrder(JSON.parse('{"data":{"blocks":["a","b"],"__proto__":{"x":1}}}')));
  assert.equal(readOrder(JSON.parse('{"data":{"blocks":["a","b"],"__proto__":{"x":1}}}')).ok, true);
  assert.equal(readOrder(item({ blocks: ['__proto__', 'constructor'] })).solution, '__proto__ constructor');
});

// ---- punto 2: gradeOrder ----
const accepting = () => item({}, { accept: ['For two years I have lived here'] });

test('gradeOrder: el orden correcto es correct, completo y sin posiciones mal puestas', () => {
  const g = gradeOrder(item(), [0, 1, 2, 3]);
  assert.deepEqual(g, { result: 'correct', placed: [0, 1, 2, 3], text: 'I have lived here for two years', matched: 'I have lived here for two years', complete: true, empty: false, misplaced: [] });
});

test('gradeOrder: otro orden incorrecto es wrong y marca las posiciones mal puestas', () => {
  const g = gradeOrder(item(), [0, 1, 3, 2]);
  assert.equal(g.result, 'wrong');
  assert.equal(g.text, 'I have lived for two years here');
  assert.equal(g.matched, null);
  assert.deepEqual(g.misplaced, [2, 3]);
  assert.deepEqual(gradeOrder(item(), [3, 1, 2, 0]).misplaced, [0, 3]);
});

test('gradeOrder: un orden alternativo de accept también es correct y no marca posiciones', () => {
  const g = gradeOrder(accepting(), [3, 0, 1, 2]);
  assert.equal(g.result, 'correct');
  assert.equal(g.matched, 'For two years I have lived here');
  assert.deepEqual(g.misplaced, []);
  assert.equal(gradeOrder(item(), [3, 0, 1, 2]).result, 'wrong');
});

test('gradeOrder: incompleto es wrong, sin comparar y sin posiciones', () => {
  const g = gradeOrder(item(), [0, 1]);
  assert.deepEqual(g, { result: 'wrong', placed: [0, 1], text: 'I have lived', matched: null, complete: false, empty: false, misplaced: [] });
  const e = gradeOrder(item(), []);
  assert.equal(e.empty, true); assert.equal(e.result, 'wrong'); assert.equal(e.text, '');
});

test('gradeOrder: placed hostil se limpia y nunca lanza', () => {
  for (const p of [undefined, null, 'abc', 5, {}, [NaN, 1.5, -1, 4, 99, '0', null, undefined, {}, [0]]]) {
    const g = gradeOrder(item(), p);
    assert.deepEqual(g.placed, []); assert.equal(g.empty, true); assert.equal(g.result, 'wrong');
  }
  assert.deepEqual(gradeOrder(item(), [0, 0, 1, 1, 2, 9, 3]).placed, [0, 1, 2, 3]);
  assert.equal(gradeOrder(item(), [0, 0, 1, 1, 2, 9, 3]).result, 'correct');
});

test('gradeOrder: con bloques repetidos cualquier reparto de los iguales vale', () => {
  const it = item({ blocks: ['very', 'very', 'good'] });
  assert.equal(gradeOrder(it, [0, 1, 2]).result, 'correct');
  assert.equal(gradeOrder(it, [1, 0, 2]).result, 'correct');
  assert.equal(gradeOrder(it, [2, 0, 1]).result, 'wrong');
});

test('gradeOrder: 2 y 12 bloques', () => {
  assert.equal(gradeOrder(item({ blocks: many(2) }), [0, 1]).result, 'correct');
  assert.equal(gradeOrder(item({ blocks: many(2) }), [1, 0]).result, 'wrong');
  const ok = Array.from({ length: 12 }, (_, i) => i);
  assert.equal(gradeOrder(item({ blocks: many(12) }), ok).result, 'correct');
  assert.deepEqual(gradeOrder(item({ blocks: many(12) }), [...ok].reverse()).misplaced.length, 12);
});

test('gradeOrder: compara con compare (contracciones y puntuación interior no cambian el resultado)', () => {
  const it = item({ blocks: ["I've", 'lived,', 'here'] }, { accept: ['I have lived here'] });
  assert.equal(gradeOrder(it, [0, 1, 2]).result, 'correct');
});

test('gradeOrder: un ítem inválido lanza un Error en español; no muta nada', () => {
  assert.throws(() => gradeOrder(item({ blocks: ['solo'] }), [0]), /gradeOrder: el ítem de ordenar no es válido \(bad_blocks\)/);
  assert.throws(() => gradeOrder(null, []), /no_data/);
  const it = accepting(); const before = JSON.stringify(it); const p = [3, 0, 1, 2];
  gradeOrder(it, p);
  assert.equal(JSON.stringify(it), before); assert.deepEqual(p, [3, 0, 1, 2]);
});

test('gradeOrder: los espacios de los bordes de los bloques no aparecen en text', () => {
  const g = gradeOrder(item({ blocks: [' I ', ' agree '] }), [0, 1]);
  assert.equal(g.text, 'I agree');
  assert.equal(g.result, 'correct');
});

test('gradeOrder: un orden incompleto nunca es correct, aunque su texto coincida con una frase de accept', () => {
  const it = item({ blocks: ['a', 'b', 'c'] }, { accept: ['a b'] });
  const g = gradeOrder(it, [0, 1]);
  assert.equal(g.result, 'wrong'); assert.equal(g.complete, false); assert.equal(g.matched, null);
  assert.equal(gradeOrder(it, [0, 1, 2]).result, 'correct');
});

test('gradeOrder: «casi» de compare cuenta como wrong (no hay almost en ordenar)', () => {
  const it = item({ blocks: ['I', 'like', 'pizza'] }, { accept: ['I pizzza like'] });
  const g = gradeOrder(it, [0, 2, 1]);
  assert.equal(g.text, 'I pizza like');
  assert.equal(g.result, 'wrong'); assert.equal(g.matched, null);
  assert.deepEqual(g.misplaced, [1, 2]);
});

test('gradeOrder: con un solo bloque puesto no está vacío; vacío solo sin ninguno', () => {
  assert.equal(gradeOrder(item(), [2]).empty, false);
  assert.equal(gradeOrder(item(), [2]).complete, false);
  assert.equal(gradeOrder(item(), [9]).empty, true);
});

test('gradeOrder: misplaced solo existe si está completo y es wrong', () => {
  assert.deepEqual(gradeOrder(item(), [1, 0]).misplaced, []);
  assert.deepEqual(gradeOrder(item(), [1, 0, 2, 3]).misplaced, [0, 1]);
  assert.deepEqual(gradeOrder(item(), [0, 1, 2, 3]).misplaced, []);
});

// ---- punto 3: estado de toques ----
const ident = { shuffle: (a) => [...a] };
const rev = { shuffle: (a) => [...a].reverse() };
const mk = (n = 4, seed = 3) => createOrderState(n, { rng: createRng(seed) });
const sameSet = (a, b) => assert.deepEqual([...a].sort((p, q) => p - q), [...b].sort((p, q) => p - q));

test('createOrderState: bandeja con todos los bloques una sola vez, nada colocado, estado congelado', () => {
  const s = mk(5);
  sameSet(s.tray, [0, 1, 2, 3, 4]);
  assert.deepEqual(s.placed, []); assert.deepEqual(s.history, []); assert.equal(s.count, 5);
  assert.ok(Object.isFrozen(s) && Object.isFrozen(s.tray) && Object.isFrozen(s.placed) && Object.isFrozen(s.history));
});

test('createOrderState: count fuera de 2 a 12 o no entero lanza Error en español', () => {
  for (const n of [0, 1, 13, 2.5, -3, NaN, '4', null, undefined]) assert.throws(() => createOrderState(n, { rng: createRng(1) }), /createOrderState: el número de bloques debe ser un entero de 2 a 12/, String(n));
  assert.equal(createOrderState(2, { rng: createRng(1) }).count, 2);
  assert.equal(createOrderState(12, { rng: createRng(1) }).count, 12);
});

test('createOrderState: sin rng útil lanza; con shuffle:false no hace falta', () => {
  for (const rng of [undefined, null, {}, { shuffle: 3 }, [], 'x']) assert.throws(() => createOrderState(3, { rng }), /falta un rng con shuffle/, String(rng));
  assert.deepEqual(createOrderState(3, { shuffle: false }).tray, [0, 1, 2]);
  assert.deepEqual(createOrderState(3, { rng: null, shuffle: false }).tray, [0, 1, 2]);
  assert.throws(() => createOrderState(3), /falta un rng/);
});

test('createOrderState: un rng que no devuelve una permutación lanza', () => {
  for (const out of [[0, 1], [0, 1, 1], [0, 1, 5], 'abc', null, [0, 1, 2, 3]]) assert.throws(() => createOrderState(3, { rng: { shuffle: () => out } }), /no devolvió una permutación/, JSON.stringify(out));
});

test('createOrderState: nunca deja la bandeja en el orden original (2 a 12 bloques, 300 semillas)', () => {
  for (let n = 2; n <= 12; n += 1) for (let seed = 1; seed <= 300; seed += 1) {
    const { tray } = mk(n, seed);
    assert.ok(tray.some((v, k) => v !== k), `n=${n} seed=${seed}`);
  }
});

test('createOrderState: si el rng devuelve siempre el orden original, gira la bandeja un lugar', () => {
  assert.deepEqual(createOrderState(4, { rng: ident }).tray, [1, 2, 3, 0]);
  assert.deepEqual(createOrderState(2, { rng: ident }).tray, [1, 0]);
});

test('createOrderState: reintenta el barajado y se queda con el primer resultado que no es el original', () => {
  let calls = 0;
  const rng = { shuffle: (a) => { calls += 1; return calls < 3 ? [...a] : [...a].reverse(); } };
  assert.deepEqual(createOrderState(4, { rng }).tray, [3, 2, 1, 0]);
  assert.equal(calls, 3);
  let all = 0;
  createOrderState(4, { rng: { shuffle: (a) => { all += 1; return [...a]; } } });
  assert.equal(all, 10);
});

test('createOrderState: con la misma semilla sale la misma bandeja; con otras, variadas', () => {
  assert.deepEqual(mk(6, 9).tray, mk(6, 9).tray);
  assert.ok(new Set(Array.from({ length: 40 }, (_, k) => mk(6, k + 1).tray.join())).size > 10);
});

test('placeBlock: coloca al final, saca el bloque de la bandeja y anota el historial', () => {
  const s0 = createOrderState(4, { rng: rev });
  const s1 = placeBlock(s0, 2); const s2 = placeBlock(s1, 0);
  assert.deepEqual(s2.placed, [2, 0]);
  assert.deepEqual(bankOf(s2), [3, 1]);
  assert.deepEqual(s2.history, [{ type: 'place', block: 2 }, { type: 'place', block: 0 }]);
  assert.deepEqual(s2.tray, s0.tray);
});

test('placeBlock: doble toque en el mismo bloque o bloque fuera de rango no hace nada (devuelve el mismo estado)', () => {
  const s = placeBlock(mk(), 1);
  assert.equal(placeBlock(s, 1), s);
  for (const i of [-1, 4, 99, 1.5, NaN, '0', null, undefined, {}, [0]]) assert.equal(placeBlock(s, i), s, String(i));
});

test('placeBlock: al colocar todos queda completo y la bandeja vacía; después ya no admite nada', () => {
  let s = mk(3);
  for (const i of [2, 0, 1]) s = placeBlock(s, i);
  assert.equal(isComplete(s), true); assert.deepEqual(bankOf(s), []); assert.deepEqual(s.placed, [2, 0, 1]);
  assert.equal(placeBlock(s, 0), s);
});

test('removeBlock: quita de cualquier posición, los de después se corren y el bloque vuelve a su sitio de la bandeja', () => {
  let s = createOrderState(4, { rng: rev });
  for (const i of [0, 1, 2, 3]) s = placeBlock(s, i);
  const r = removeBlock(s, 1);
  assert.deepEqual(r.placed, [0, 2, 3]);
  assert.deepEqual(bankOf(r), [1]);
  assert.deepEqual(r.history.at(-1), { type: 'remove', block: 1, pos: 1 });
  assert.deepEqual(removeBlock(r, 0).placed, [2, 3]);
});

test('removeBlock: un bloque no colocado o un valor hostil no hace nada (mismo estado)', () => {
  const s = placeBlock(mk(), 0);
  for (const i of [1, -1, 4, 1.5, NaN, '0', null, undefined, {}]) assert.equal(removeBlock(s, i), s, String(i));
});

test('undoLast: deshace colocar y quitar; quitar devuelve el bloque a su posición anterior', () => {
  let s = mk(4);
  for (const i of [3, 1, 0]) s = placeBlock(s, i);
  const removed = removeBlock(s, 1);
  assert.deepEqual(removed.placed, [3, 0]);
  const back = undoLast(removed);
  assert.deepEqual(back.placed, [3, 1, 0]);
  assert.deepEqual(undoLast(back).placed, [3, 1]);
  assert.deepEqual(back.history.length, 3);
});

test('undoLast: sin historial no hace nada (mismo estado)', () => {
  const s = mk();
  assert.equal(undoLast(s), s);
});

test('undoLast: deshacer todo vuelve exactamente al estado inicial', () => {
  const s0 = mk(6, 4);
  let s = s0;
  for (const i of [5, 2, 0, 3]) s = placeBlock(s, i);
  s = removeBlock(s, 2); s = placeBlock(s, 1); s = removeBlock(s, 5); s = removeBlock(s, 0);
  while (s.history.length > 0) s = undoLast(s);
  assert.deepEqual(s, s0);
});

test('resetOrder: vacía lo colocado y el historial, conserva la bandeja y no vuelve a barajar', () => {
  let s = mk(4, 5);
  const tray = s.tray;
  for (const i of [0, 1]) s = placeBlock(s, i);
  const r = resetOrder(s);
  assert.deepEqual(r.placed, []); assert.deepEqual(r.history, []); assert.deepEqual(r.tray, tray);
  assert.deepEqual(bankOf(r), tray);
  const empty = mk();
  assert.equal(resetOrder(empty), empty);
});

test('resetOrder: un estado con historial pero sin colocados (colocar y quitar) también se limpia', () => {
  let s = placeBlock(mk(), 0); s = removeBlock(s, 0);
  assert.equal(s.placed.length, 0); assert.equal(s.history.length, 2);
  assert.deepEqual(resetOrder(s).history, []);
});

test('bankOf: respeta el orden de la bandeja, no el del índice', () => {
  const s = placeBlock(createOrderState(4, { rng: rev }), 3);
  assert.deepEqual(bankOf(s), [2, 1, 0]);
});

test('los estados no se mutan ni se pueden mutar desde fuera', () => {
  const s = placeBlock(mk(), 1);
  const snap = JSON.stringify(s);
  placeBlock(s, 0); removeBlock(s, 1); undoLast(s); resetOrder(s);
  assert.equal(JSON.stringify(s), snap);
  assert.throws(() => { 'use strict'; s.placed.push(9); }, TypeError);
  assert.throws(() => { 'use strict'; s.history[0].block = 9; }, TypeError);
});

test('historial: tope de 200; con más acciones se pierden las más antiguas y deshacer sigue consistente', () => {
  let s = mk(4);
  for (let k = 0; k < 150; k += 1) { s = placeBlock(s, 1); s = removeBlock(s, 1); }
  assert.equal(s.history.length, 200);
  let n = 0;
  while (s.history.length > 0) { s = undoLast(s); n += 1; }
  assert.equal(n, 200);
  assert.deepEqual(s.placed, []);
});

test('fuzz: 3000 acciones aleatorias en 2, 5 y 12 bloques mantienen los invariantes y nunca lanzan', () => {
  for (const n of [2, 5, 12]) {
    const r = createRng(100 + n);
    let s = mk(n, n);
    for (let k = 0; k < 3000; k += 1) {
      const i = r.int(-1, n + 1);
      const a = r.int(0, 4);
      s = a === 0 ? placeBlock(s, i) : a === 1 ? removeBlock(s, i) : a === 2 ? undoLast(s) : a === 3 ? placeBlock(s, r.int(0, n - 1)) : (r.int(0, 30) === 0 ? resetOrder(s) : s);
      assert.equal(new Set(s.placed).size, s.placed.length);
      assert.ok(s.placed.every((v) => v >= 0 && v < n));
      sameSet([...bankOf(s), ...s.placed], Array.from({ length: n }, (_, v) => v));
      assert.ok(s.history.length <= ORDER_LIMITS.history);
      assert.equal(isComplete(s), s.placed.length === n);
    }
  }
});

test('el estado de toques se lleva bien con gradeOrder: ordenar con toques y calificar', () => {
  let s = createOrderState(4, { rng: createRng(8) });
  for (const i of [0, 1, 2, 3]) s = placeBlock(s, i);
  assert.equal(gradeOrder(item(), s.placed).result, 'correct');
  s = undoLast(s); s = undoLast(s); s = placeBlock(s, 3); s = placeBlock(s, 2);
  assert.equal(gradeOrder(item(), s.placed).result, 'wrong');
});

test('createOrderState: solo shuffle:false conserva el orden; cualquier otro valor baraja', () => {
  for (const sh of [true, undefined, null, 0, '', 'no', 1]) assert.deepEqual(createOrderState(3, { rng: rev, shuffle: sh }).tray, [2, 1, 0], String(sh));
  assert.deepEqual(createOrderState(3, { rng: rev, shuffle: false }).tray, [0, 1, 2]);
});

test('historial lleno: se conservan las acciones MÁS RECIENTES y deshacer actúa sobre la última', () => {
  let s = mk(4);
  for (let k = 0; k < 150; k += 1) { s = placeBlock(s, 1); s = removeBlock(s, 1); }
  s = placeBlock(s, 2); s = placeBlock(s, 3);
  assert.equal(s.history.length, 200);
  assert.deepEqual(s.history.at(-1), { type: 'place', block: 3 });
  assert.deepEqual(s.history.at(-2), { type: 'place', block: 2 });
  assert.deepEqual(undoLast(s).placed, [2]);
  assert.deepEqual(undoLast(undoLast(s)).placed, []);
});
