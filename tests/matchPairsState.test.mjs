// @purpose: Pruebas del estado de toques y la calificación de match_pairs (core/matchPairs.js, 2.4-T2 punto 2): barajado, selección, acierto y fallo al instante, bloqueos, calificación y secuencias al azar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MATCH_LIMITS, createMatchState, pickMatch, isMatchComplete, gradeMatch } from '../core/matchPairs.js';
import { createRng } from '../core/rng.js';

const pairs = (n) => Array.from({ length: n }, (_, i) => ({ left: `l${i}`, right: `r${i}` }));
const item = (n = 5, extra) => ({ id: 'g.mp.0001', type: 'match_pairs', prompt_es: 'Une.', data: { pairs: pairs(n), ...(extra ? { extra_right: extra } : {}) } });
const mk = (n = 5, e = 0, seed = 1, opts = {}) => createMatchState(n, e, { rng: createRng(seed), ...opts });
const L = (s, i) => pickMatch(s, 'left', i);
const R = (s, i) => pickMatch(s, 'right', i);
const hit = (s, i) => R(L(s, i), i);

test('createMatchState: cuenta, bandeja permutación y todo congelado', () => {
  const s = mk(5, 2);
  assert.equal(s.pairCount, 5);
  assert.equal(s.cardCount, 7);
  assert.deepEqual([...s.tray].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual([...s.solved], []);
  assert.equal(s.selected, null);
  assert.equal(s.last, null);
  assert.ok(Object.isFrozen(s) && Object.isFrozen(s.tray) && Object.isFrozen(s.solved) && Object.isFrozen(s.attempts));
});

test('el barajado nunca deja la bandeja en el orden original (2 a 14 tarjetas, muchas semillas)', () => {
  for (const [n, e] of [[2, 0], [2, 4], [5, 0], [6, 2], [10, 4]]) {
    for (let seed = 1; seed <= 60; seed += 1) {
      const s = mk(n, e, seed);
      assert.ok(s.tray.some((v, k) => v !== k), `n=${n} e=${e} seed=${seed}`);
    }
  }
});

test('shuffle: false conserva el orden; sin rng y con shuffle lanza', () => {
  assert.deepEqual([...mk(4, 1, 1, { shuffle: false }).tray], [0, 1, 2, 3, 4]);
  assert.throws(() => createMatchState(4, 0), /rng/);
  assert.equal(createMatchState(4, 0, { shuffle: false }).cardCount, 4);
});

test('un rng que no devuelve permutación lanza', () => {
  const bad = { shuffle: () => [0, 0, 1] };
  assert.throws(() => createMatchState(3, 0, { rng: bad }), /permutación/);
});

test('rng que devuelve siempre el orden original: se gira un lugar', () => {
  const same = { shuffle: (a) => [...a] };
  assert.deepEqual([...createMatchState(3, 0, { rng: same }).tray], [1, 2, 0]);
});

test('parejas y distractores fuera de rango lanzan Error en español', () => {
  for (const n of [1, 11, 2.5, '3', null, undefined, NaN]) assert.throws(() => createMatchState(n, 0, { rng: createRng(1) }), /parejas/, String(n));
  for (const e of [-1, 5, 1.5, '1', null, undefined, NaN]) assert.throws(() => createMatchState(3, e, { rng: createRng(1) }), /distractores/, String(e));
  assert.equal(mk(2, 0).pairCount, 2);
  assert.equal(mk(10, 4).cardCount, 14);
});

test('un toque selecciona; el mismo toque la quita; otro del mismo lado la cambia', () => {
  let s = L(mk(), 2);
  assert.deepEqual({ ...s.selected }, { side: 'left', index: 2 });
  s = L(s, 2);
  assert.equal(s.selected, null);
  s = L(L(s, 1), 3);
  assert.deepEqual({ ...s.selected }, { side: 'left', index: 3 });
  s = R(s, 4);
  assert.equal(s.attempts.length, 1);
  assert.equal(s.selected, null);
});

test('acierto al instante: la pareja queda resuelta y `last` lo dice', () => {
  const s = hit(mk(), 3);
  assert.deepEqual([...s.solved], [3]);
  assert.deepEqual({ ...s.last }, { left: 3, right: 3, ok: true });
  assert.deepEqual(s.attempts.map((a) => ({ ...a })), [{ left: 3, right: 3 }]);
  assert.equal(s.selected, null);
});

test('fallo al instante: nada se resuelve y `last` lo dice', () => {
  const s = R(L(mk(), 1), 2);
  assert.deepEqual([...s.solved], []);
  assert.deepEqual({ ...s.last }, { left: 1, right: 2, ok: false });
  assert.equal(s.selected, null);
});

test('se puede empezar por la derecha', () => {
  const s = L(R(mk(), 4), 4);
  assert.deepEqual([...s.solved], [4]);
  assert.deepEqual({ ...s.last }, { left: 4, right: 4, ok: true });
});

test('un distractor siempre es fallo y se puede repetir', () => {
  let s = mk(3, 2);
  s = R(L(s, 0), 3);
  s = R(L(s, 0), 3);
  assert.equal(s.attempts.length, 2);
  assert.ok(s.attempts.every((a) => a.left !== a.right));
  assert.deepEqual([...s.solved], []);
});

test('doble toque sobre una pareja resuelta no cambia nada (mismo objeto)', () => {
  const s = hit(mk(), 2);
  assert.equal(L(s, 2), s);
  assert.equal(R(s, 2), s);
  const sel = L(s, 0);
  assert.equal(R(sel, 2), sel, 'tocar la tarjeta bloqueada con otra seleccionada no hace nada');
});

test('toques inválidos devuelven el mismo estado', () => {
  const s = mk(4, 1);
  for (const [side, i] of [['left', -1], ['left', 4], ['right', 5], ['right', -1], ['up', 0], [undefined, 0], ['left', 1.5], ['left', '1'], ['left', NaN], ['left', null], ['right', Infinity]]) {
    assert.equal(pickMatch(s, side, i), s, `${side} ${i}`);
  }
});

test('cada función devuelve un estado nuevo y no muta el anterior', () => {
  const a = mk();
  const b = L(a, 0);
  assert.notEqual(a, b);
  assert.equal(a.selected, null);
});

test('completar: isMatchComplete solo con todas resueltas (2 y 10 parejas)', () => {
  for (const n of [2, 10]) {
    let s = mk(n, n === 10 ? 4 : 0);
    assert.equal(isMatchComplete(s), false);
    for (let i = 0; i < n; i += 1) {
      assert.equal(isMatchComplete(s), false);
      s = hit(s, i);
    }
    assert.equal(isMatchComplete(s), true);
    assert.deepEqual([...s.solved], Array.from({ length: n }, (_, i) => i));
  }
});

test('tope de intentos: los fallos de más se descartan, los aciertos siempre entran', () => {
  let s = mk(2, 1);
  for (let i = 0; i < 1000; i += 1) s = R(L(s, 0), 1);
  assert.equal(s.attempts.length, MATCH_LIMITS.attempts - 2);
  s = hit(hit(s, 0), 1);
  assert.equal(isMatchComplete(s), true);
  assert.ok(s.attempts.length <= MATCH_LIMITS.attempts);
  assert.deepEqual({ ...s.last }, { left: 1, right: 1, ok: true });
  const g = gradeMatch(item(2, ['x']), s.attempts);
  assert.equal(g.complete, true);
  assert.equal(g.result, 'wrong');
});

// ---- calificación ----
test('gradeMatch: sin fallos y completo es correct', () => {
  const g = gradeMatch(item(3), [{ left: 0, right: 0 }, { left: 1, right: 1 }, { left: 2, right: 2 }]);
  assert.deepEqual(g, { result: 'correct', complete: true, empty: false, solved: [0, 1, 2], mistakes: 0, firstTry: 3, wrongLefts: [], text: 'l0 = r0; l1 = r1; l2 = r2' });
});

test('gradeMatch: completo con un fallo es wrong y lo cuenta', () => {
  const g = gradeMatch(item(3), [{ left: 0, right: 1 }, { left: 0, right: 0 }, { left: 1, right: 1 }, { left: 2, right: 2 }]);
  assert.equal(g.result, 'wrong');
  assert.equal(g.complete, true);
  assert.equal(g.mistakes, 1);
  assert.equal(g.firstTry, 2);
  assert.deepEqual(g.wrongLefts, [0]);
});

test('gradeMatch: incompleto o vacío es wrong; vacío lo marca', () => {
  const part = gradeMatch(item(3), [{ left: 0, right: 0 }]);
  assert.equal(part.result, 'wrong');
  assert.equal(part.complete, false);
  assert.equal(part.empty, false);
  for (const v of [[], undefined, null, 'x', 5, {}]) {
    const g = gradeMatch(item(3), v);
    assert.equal(g.result, 'wrong');
    assert.equal(g.empty, true);
    assert.equal(g.text, '');
  }
});

test('gradeMatch: un distractor cuenta como fallo y el texto lo nombra', () => {
  const g = gradeMatch(item(2, ['zzz']), [{ left: 0, right: 2 }, { left: 0, right: 0 }, { left: 1, right: 1 }]);
  assert.equal(g.mistakes, 1);
  assert.equal(g.text, 'l0 = zzz; l0 = r0; l1 = r1');
});

test('gradeMatch ignora intentos hostiles sin lanzar', () => {
  const g = gradeMatch(item(2), [null, 7, 'a', [], {}, { left: -1, right: 0 }, { left: 0, right: 9 }, { left: 0.5, right: 0 }, { left: '0', right: '0' },
    { left: 0, right: 0 }, { left: 0, right: 0 }, { left: 1, right: 0 }, { left: 0, right: 1 }, { left: 1, right: 1 }]);
  assert.deepEqual(g.solved, [0, 1]);
  assert.equal(g.mistakes, 0);
  assert.equal(g.result, 'correct');
});

test('gradeMatch lanza si el ítem no es válido', () => {
  assert.throws(() => gradeMatch({ type: 'match_pairs', data: {} }, []), /bad_pairs/);
  assert.throws(() => gradeMatch(null, []), /no_data/);
});

test('el estado y gradeMatch coinciden: lo que arma el estado, gradeMatch lo califica igual', () => {
  let s = mk(5, 2, 7);
  s = R(L(s, 0), 6);
  s = hit(s, 0);
  s = R(L(s, 3), 1);
  for (const i of [1, 2, 3, 4]) s = hit(s, i);
  const g = gradeMatch(item(5, ['e1', 'e2']), s.attempts);
  assert.deepEqual(g.solved, [...s.solved]);
  assert.equal(g.mistakes, 2);
  assert.deepEqual(g.wrongLefts, [0, 3]);
  assert.equal(g.complete, isMatchComplete(s));
});

// ---- secuencias al azar ----
test('fuzz: 3000 secuencias de toques al azar nunca lanzan y mantienen los invariantes', () => {
  const rng = createRng(99);
  for (let run = 0; run < 3000; run += 1) {
    const n = 2 + (run % 9);
    const e = run % 5;
    const it = item(n, Array.from({ length: e }, (_, i) => `x${i}`));
    let s = mk(n, e, run + 1);
    const steps = 1 + (run % 60);
    for (let k = 0; k < steps; k += 1) {
      const side = rng.int(0, 5) === 0 ? 'zz' : (rng.int(0, 2) === 0 ? 'left' : 'right');
      const idx = rng.int(-1, n + e + 2);
      const next = pickMatch(s, side, idx);
      assert.ok(next === s || Object.isFrozen(next));
      s = next;
      assert.equal(new Set(s.solved).size, s.solved.length, 'sin parejas repetidas');
      assert.ok(s.solved.every((v) => v >= 0 && v < n));
      assert.ok(s.attempts.length <= MATCH_LIMITS.attempts);
      if (s.selected !== null) {
        assert.ok(s.selected.side === 'left' ? s.selected.index < n : s.selected.index < n + e);
        assert.ok(!(s.selected.index < n && s.solved.includes(s.selected.index)), 'no se selecciona lo resuelto');
      }
    }
    const g = gradeMatch(it, s.attempts);
    assert.deepEqual(g.solved, [...s.solved]);
    assert.equal(g.complete, isMatchComplete(s));
    assert.equal(g.result === 'correct', isMatchComplete(s) && g.mistakes === 0);
  }
});

test('con un rng que devuelve primero el orden original, se usa el siguiente intento (no se gira)', () => {
  const seq = [[0, 1, 2], [2, 0, 1], [1, 2, 0]];
  let k = 0;
  const rng = { shuffle: () => seq[Math.min(k++, seq.length - 1)] };
  assert.deepEqual([...createMatchState(3, 0, { rng }).tray], [2, 0, 1]);
  assert.equal(k, 2, 'se detiene en el primer intento bueno');
});

test('se usa el primer barajado bueno aunque los siguientes también lo fueran', () => {
  let k = 0;
  const outs = [[1, 0, 2], [2, 1, 0]];
  const rng = { shuffle: () => outs[k++ % 2] };
  assert.deepEqual([...createMatchState(3, 0, { rng }).tray], [1, 0, 2]);
  assert.equal(k, 1);
});

test('una lista más corta que las tarjetas no es una permutación', () => {
  assert.throws(() => createMatchState(3, 0, { rng: { shuffle: () => [0, 1] } }), /permutación/);
  assert.throws(() => createMatchState(3, 0, { rng: { shuffle: () => [1, 0, 2, 3] } }), /permutación/);
});

test('el rng entra con 10 intentos: si nueve son el orden original, el décimo vale', () => {
  let k = 0;
  const rng = { shuffle: () => (++k < 10 ? [0, 1, 2] : [1, 2, 0]) };
  assert.deepEqual([...createMatchState(3, 0, { rng }).tray], [1, 2, 0]);
  assert.equal(k, 10);
});

test('la selección y el último intento salen congelados', () => {
  const s = R(L(mk(), 0), 1);
  assert.ok(Object.isFrozen(s.last));
  const t = L(mk(), 0);
  assert.ok(Object.isFrozen(t.selected));
  assert.ok(Object.isFrozen(t.attempts));
  assert.ok(Object.isFrozen(s.attempts[0]));
});

test('gradeMatch: cada intento hostil por separado se ignora (ni fallo ni texto)', () => {
  const it = item(2, ['x']); // 2 parejas, 3 tarjetas: índices válidos de la derecha 0 a 2
  const bad = [
    { left: 0, right: 0.5 }, { left: 0, right: '0' }, { left: 0, right: -1 }, { left: 0, right: 3 }, { left: 0, right: NaN }, { left: 0, right: Infinity },
    { left: 0.5, right: 0 }, { left: -1, right: 0 }, { left: 2, right: 0 }, { left: 2, right: 2 }, { left: NaN, right: 0 }, { left: 1 }, { right: 1 }, {},
  ];
  for (const a of bad) {
    const g = gradeMatch(it, [a]);
    assert.equal(g.empty, true, JSON.stringify(a));
    assert.equal(g.mistakes, 0, JSON.stringify(a));
    assert.equal(g.text, '', JSON.stringify(a));
  }
  const edge = gradeMatch(it, [{ left: 1, right: 2 }]);
  assert.equal(edge.mistakes, 1, 'el último distractor (índice 2) sí cuenta');
  assert.equal(edge.text, 'l1 = x');
});

test('gradeMatch: una tarjeta de pareja ya resuelta no se puede usar en un fallo posterior', () => {
  const g = gradeMatch(item(3), [{ left: 0, right: 0 }, { left: 1, right: 0 }]);
  assert.equal(g.mistakes, 0);
  assert.equal(g.text, 'l0 = r0');
});

test('gradeMatch: solo fallos no es «vacío»; wrongLefts sale en orden creciente', () => {
  const g = gradeMatch(item(3), [{ left: 2, right: 0 }, { left: 0, right: 1 }, { left: 2, right: 1 }]);
  assert.equal(g.empty, false);
  assert.equal(g.complete, false);
  assert.deepEqual(g.solved, []);
  assert.equal(g.mistakes, 3);
  assert.deepEqual(g.wrongLefts, [0, 2]);
});
