// @purpose: Fuzz de la familia ordenar/emparejar/completar (2.4-T4, punto 1): toques al azar contra un modelo independiente en los 4 estados (ordenar, construir, banco, emparejar), con 2 y 12 elementos y argumentos hostiles.
// Cada secuencia aplica la misma acción al estado real y a un modelo escrito aparte (listas simples) y compara después de CADA toque: mismo resultado, mismo objeto
// cuando la acción no procede, estado congelado, sin mutar el anterior, bandeja fija y deshacer como inverso exacto (CA 3 y 4 de 2.4; CA 5: 2 y 12 bloques).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../core/rng.js';
import {
  ORDER_LIMITS, createOrderState, placeBlock, removeBlock, undoLast, resetOrder, bankOf, isComplete,
} from '../core/orderBlocks.js';
import { createBuildState, BUILD_LIMITS } from '../core/buildPieces.js';
import {
  CLOZE_BANK_LIMITS, createClozeState, placeWord, removeFill, undoLast as undoCloze, resetCloze, freeWords, isClozeComplete,
} from '../core/clozeBank.js';
import { MATCH_LIMITS, createMatchState, pickMatch, isMatchComplete, gradeMatch } from '../core/matchPairs.js';

const HOSTILE = [-1, 1.5, NaN, Infinity, -Infinity, '0', '1', null, {}, [], true, false, 2 ** 31, Number.MAX_SAFE_INTEGER];
const isIdx = (v, n) => Number.isInteger(v) && v >= 0 && v < n;
const range = (n) => Array.from({ length: n }, (_, i) => i);
const snap = (s) => JSON.stringify(s);
const small = (v) => v === null || typeof v !== 'object' || (Object.isFrozen(v) && Object.values(v).every(small));
const deepFrozen = (s) => Object.isFrozen(s) && Object.values(s).every(small);

// ---------- ordenar y construir (las dos usan las mismas acciones de core/orderBlocks.js) ----------
function runSlots({ label, make, count, seeds = 60, steps = 300 }) {
  const cov = { complete: 0, undone: 0, removed: 0, noop: 0 };
  for (let seed = 1; seed <= seeds; seed += 1) {
    const r = createRng(seed * 104729 + count);
    let s = make(seed);
    assert.equal(s.count, count, `${label}: cuenta`);
    const tray0 = [...s.tray];
    assert.deepEqual([...tray0].sort((a, b) => a - b), range(count), `${label}: la bandeja es una permutación`);
    const m = { placed: [], hist: [] };
    const push = (e) => { m.hist.push(e); if (m.hist.length > ORDER_LIMITS.history) m.hist.shift(); };

    const apply = (kind, arg) => {
      const prev = s;
      const before = snap(prev);
      let next;
      let expected = false;
      if (kind === 'place') {
        next = placeBlock(prev, arg);
        if (isIdx(arg, count) && !m.placed.includes(arg)) { m.placed.push(arg); push({ type: 'place', block: arg }); expected = true; }
      } else if (kind === 'remove') {
        next = removeBlock(prev, arg);
        const pos = m.placed.indexOf(arg);
        if (isIdx(arg, count) && pos >= 0) { m.placed.splice(pos, 1); push({ type: 'remove', block: arg, pos }); expected = true; cov.removed += 1; }
      } else if (kind === 'undo') {
        next = undoLast(prev);
        const last = m.hist.pop();
        if (last) {
          m.placed = m.placed.filter((x) => x !== last.block);
          if (last.type === 'remove') m.placed.splice(last.pos, 0, last.block);
          expected = true;
          cov.undone += 1;
        }
      } else {
        next = resetOrder(prev);
        if (m.placed.length > 0 || m.hist.length > 0) { m.placed = []; m.hist = []; expected = true; }
      }
      s = next;
      if (!expected) cov.noop += 1;
      const at = `${label} semilla ${seed} acción ${kind}(${String(arg)})`;
      assert.equal(snap(prev), before, `${at}: no debe mutar el estado anterior`);
      assert.equal(next !== prev, expected, `${at}: ${expected ? 'debía cambiar' : 'debía devolver el MISMO objeto'}`);
      assert.ok(deepFrozen(next), `${at}: estado congelado`);
      assert.deepEqual([...next.tray], tray0, `${at}: la bandeja es fija`);
      assert.deepEqual([...next.placed], m.placed, `${at}: colocadas`);
      assert.equal(new Set(next.placed).size, next.placed.length, `${at}: sin repetidas`);
      assert.deepEqual(bankOf(next), tray0.filter((i) => !m.placed.includes(i)), `${at}: banco`);
      assert.equal(isComplete(next), m.placed.length === count, `${at}: completa`);
      assert.equal(next.history.length, m.hist.length, `${at}: historial`);
      assert.ok(next.history.length <= ORDER_LIMITS.history);
      if (expected && (kind === 'place' || kind === 'remove') && prev.history.length < ORDER_LIMITS.history) {
        assert.deepEqual(undoLast(next), prev, `${at}: deshacer debe ser el inverso exacto`);
      }
      if (isComplete(next)) cov.complete += 1;
      return next;
    };

    for (let k = 0; k < steps; k += 1) {
      const roll = r.int(0, 99);
      const i = r.int(0, count - 1);
      if (roll < 32) apply('place', roll < 4 ? r.int(-1, count) : i);
      else if (roll < 47) apply('remove', roll < 34 ? r.int(-1, count) : i);
      else if (roll < 65) apply('undo');
      else if (roll < 68) apply('reset');
      else if (roll < 78) apply(r.int(0, 1) === 0 ? 'place' : 'remove', HOSTILE[r.int(0, HOSTILE.length - 1)]);
      else if (roll < 90) { // doble toque: la misma acción dos veces seguidas
        const kind = r.int(0, 1) === 0 ? 'place' : 'remove';
        const first = apply(kind, i);
        assert.equal(apply(kind, i), first, `${label}: el segundo toque idéntico no cambia nada`);
      } else { // ráfaga: llena la frase con los bloques libres en orden al azar hasta completarla
        for (const b of r.shuffle(bankOf(s))) apply('place', b);
      }
    }
  }
  return cov;
}

const buildItem = (pieces, extras, type = 'build_from_keywords') => ({
  id: 'g.fz.0001', type, prompt_es: 'Forma la frase.',
  data: { pieces: range(pieces).map((i) => `w${i}`), extra_pieces: range(extras).map((i) => `x${i}`) },
});

const SLOT_CASES = [
  ['order_blocks 2', 2, (seed) => createOrderState(2, { rng: createRng(seed) })],
  ['order_blocks 5', 5, (seed) => createOrderState(5, { rng: createRng(seed) })],
  ['order_blocks 12', 12, (seed) => createOrderState(12, { rng: createRng(seed) })],
  ['unscramble_letters 2 piezas', 2, (seed) => createBuildState(buildItem(2, 0, 'unscramble_letters'), { rng: createRng(seed) })],
  ['build_from_keywords 2 + 4 de más', 6, (seed) => createBuildState(buildItem(2, 4), { rng: createRng(seed) })],
  ['build_from_keywords 12 + 4 de más', 16, (seed) => createBuildState(buildItem(12, 4), { rng: createRng(seed) })],
];

for (const [label, count, make] of SLOT_CASES) {
  test(`fuzz de toques (${label}): 60 secuencias de 300 acciones contra el modelo, sin excepciones`, () => {
    const cov = runSlots({ label, make, count });
    assert.ok(cov.complete > 0, 'la exploración llegó a la frase completa');
    assert.ok(cov.undone > 0 && cov.removed > 0 && cov.noop > 0, 'la exploración probó deshacer, quitar y acciones que no proceden');
  });
}

test('CA 5 de 2.4: los topes de tamaño del estado son 2 a 12 bloques y 16 piezas (12 + 4 de más)', () => {
  assert.equal(ORDER_LIMITS.min, 2);
  assert.equal(ORDER_LIMITS.max, 12);
  assert.equal(BUILD_LIMITS.max + BUILD_LIMITS.extraMax, 16);
  assert.throws(() => createOrderState(1, { rng: createRng(1) }), /entero de 2 a 12/);
  assert.throws(() => createOrderState(13, { rng: createRng(1) }), /entero de 2 a 12/);
  assert.equal(createBuildState(buildItem(12, 4), { rng: createRng(1) }).count, 16);
});

// ---------- completar con banco ----------
function runCloze({ gaps, bank, seeds = 60, steps = 300 }) {
  const label = `cloze_bank ${gaps} huecos y ${bank} fichas`;
  const cov = { complete: 0, undone: 0, removed: 0, noop: 0 };
  for (let seed = 1; seed <= seeds; seed += 1) {
    const r = createRng(seed * 7919 + gaps * 31 + bank);
    let s = createClozeState(gaps, bank, { rng: createRng(seed) });
    const tray0 = [...s.tray];
    const m = { fills: new Array(gaps).fill(null), hist: [] };
    const push = (e) => { m.hist.push(e); if (m.hist.length > CLOZE_BANK_LIMITS.history) m.hist.shift(); };

    const apply = (kind, a, b) => {
      const prev = s;
      const before = snap(prev);
      let next;
      let expected = false;
      if (kind === 'place') {
        next = b === undefined ? placeWord(prev, a) : placeWord(prev, a, b);
        const g = b === undefined ? m.fills.indexOf(null) : b;
        if (isIdx(a, bank) && !m.fills.includes(a) && isIdx(g, gaps) && m.fills[g] === null) {
          m.fills[g] = a; push({ type: 'place', word: a, gap: g }); expected = true;
        }
      } else if (kind === 'remove') {
        next = removeFill(prev, a);
        if (isIdx(a, gaps) && m.fills[a] !== null) { const w = m.fills[a]; m.fills[a] = null; push({ type: 'remove', word: w, gap: a }); expected = true; cov.removed += 1; }
      } else if (kind === 'undo') {
        next = undoCloze(prev);
        const last = m.hist.pop();
        if (last) { m.fills[last.gap] = last.type === 'place' ? null : last.word; expected = true; cov.undone += 1; }
      } else {
        next = resetCloze(prev);
        if (m.hist.length > 0 || m.fills.some((x) => x !== null)) { m.fills.fill(null); m.hist = []; expected = true; }
      }
      s = next;
      if (!expected) cov.noop += 1;
      const at = `${label} semilla ${seed} acción ${kind}(${String(a)}, ${String(b)})`;
      assert.equal(snap(prev), before, `${at}: no debe mutar el estado anterior`);
      assert.equal(next !== prev, expected, `${at}: ${expected ? 'debía cambiar' : 'debía devolver el MISMO objeto'}`);
      assert.ok(deepFrozen(next), `${at}: estado congelado`);
      assert.deepEqual([...next.tray], tray0, `${at}: la bandeja es fija`);
      assert.deepEqual([...next.fills], m.fills, `${at}: huecos`);
      const used = next.fills.filter((x) => x !== null);
      assert.equal(new Set(used).size, used.length, `${at}: ninguna ficha en dos huecos`);
      assert.deepEqual(freeWords(next), tray0.filter((w) => !m.fills.includes(w)), `${at}: fichas libres`);
      assert.equal(isClozeComplete(next), m.fills.every((x) => x !== null), `${at}: completo`);
      assert.equal(next.history.length, m.hist.length, `${at}: historial`);
      if (expected && (kind === 'place' || kind === 'remove') && prev.history.length < CLOZE_BANK_LIMITS.history) {
        assert.deepEqual(undoCloze(next), prev, `${at}: deshacer debe ser el inverso exacto`);
      }
      if (isClozeComplete(next)) cov.complete += 1;
      return next;
    };

    for (let k = 0; k < steps; k += 1) {
      const roll = r.int(0, 99);
      const w = r.int(0, bank - 1);
      const g = r.int(0, gaps - 1);
      if (roll < 30) apply('place', roll < 3 ? r.int(-1, bank) : w);
      else if (roll < 44) apply('place', w, roll < 36 ? r.int(-1, gaps) : g);
      else if (roll < 56) apply('remove', roll < 47 ? r.int(-1, gaps) : g);
      else if (roll < 72) apply('undo');
      else if (roll < 75) apply('reset');
      else if (roll < 85) {
        const h = HOSTILE[r.int(0, HOSTILE.length - 1)];
        const which = r.int(0, 2);
        if (which === 0) apply('place', h);
        else if (which === 1) apply('place', w, h);
        else apply('remove', h);
      } else if (roll < 93) { // doble toque
        const first = apply('place', w);
        assert.equal(apply('place', w), first, `${label}: el segundo toque idéntico no cambia nada`);
      } else { // ráfaga: llena los huecos con fichas libres
        for (const f of r.shuffle(freeWords(s))) apply('place', f);
      }
    }
  }
  return cov;
}

for (const [gaps, bank] of [[1, 1], [1, 2], [2, 2], [6, 6], [6, 20]]) {
  test(`fuzz de toques (cloze_bank, ${gaps} huecos y ${bank} fichas): 60 secuencias contra el modelo, sin excepciones`, () => {
    const cov = runCloze({ gaps, bank });
    assert.ok(cov.complete > 0 && cov.undone > 0 && cov.noop > 0, 'la exploración llegó al final, deshizo y probó acciones que no proceden');
  });
}

// ---------- emparejar ----------
function runMatch({ pairs, extras, seeds = 60, steps = 300 }) {
  const label = `match_pairs ${pairs} parejas y ${extras} de más`;
  const cards = pairs + extras;
  const cov = { complete: 0, hits: 0, misses: 0, selects: 0 };
  for (let seed = 1; seed <= seeds; seed += 1) {
    const r = createRng(seed * 15485863 + pairs * 17 + extras);
    let s = createMatchState(pairs, extras, { rng: createRng(seed) });
    const tray0 = [...s.tray];
    assert.deepEqual([...tray0].sort((a, b) => a - b), range(cards), `${label}: la bandeja es una permutación`);
    const m = { solved: [], selected: null, tries: 0 };
    const item = {
      id: 'g.fz.0002', type: 'match_pairs', prompt_es: 'Une.',
      data: { pairs: range(pairs).map((i) => ({ left: `l${i}`, right: `r${i}` })), extra_right: range(extras).map((i) => `e${i}`) },
    };

    const apply = (side, index) => {
      const prev = s;
      const before = snap(prev);
      const next = pickMatch(prev, side, index);
      let expected = false;
      const sideOk = side === 'left' || side === 'right';
      const limit = side === 'left' ? pairs : cards;
      const locked = isIdx(index, pairs) && m.solved.includes(index);
      let last = prev.last;
      if (sideOk && isIdx(index, limit) && !locked) {
        expected = true;
        if (m.selected === null) { m.selected = { side, index }; cov.selects += 1; } else if (m.selected.side === side) {
          m.selected = m.selected.index === index ? null : { side, index };
        } else {
          const left = side === 'left' ? index : m.selected.index;
          const right = side === 'right' ? index : m.selected.index;
          m.tries += 1;
          if (left === right) { m.solved.push(left); cov.hits += 1; } else cov.misses += 1;
          last = { left, right, ok: left === right };
          m.selected = null;
        }
      }
      s = next;
      const at = `${label} semilla ${seed} toque ${String(side)}/${String(index)}`;
      assert.equal(snap(prev), before, `${at}: no debe mutar el estado anterior`);
      assert.equal(next !== prev, expected, `${at}: ${expected ? 'debía cambiar' : 'debía devolver el MISMO objeto'}`);
      assert.ok(deepFrozen(next), `${at}: estado congelado`);
      assert.deepEqual([...next.tray], tray0, `${at}: la bandeja es fija`);
      assert.deepEqual([...next.solved], m.solved, `${at}: parejas resueltas`);
      assert.equal(new Set(next.solved).size, next.solved.length, `${at}: ninguna pareja dos veces`);
      assert.deepEqual(next.selected === null ? null : { ...next.selected }, m.selected, `${at}: selección`);
      if (next.selected !== null) {
        assert.ok(isIdx(next.selected.index, next.selected.side === 'left' ? pairs : cards), `${at}: selección válida`);
        assert.ok(!(isIdx(next.selected.index, pairs) && m.solved.includes(next.selected.index)), `${at}: no se elige lo ya resuelto`);
      }
      assert.deepEqual(next.last === null ? null : { ...next.last }, last === null ? null : { ...last }, `${at}: último intento`);
      assert.equal(next.attempts.length, m.tries, `${at}: intentos`);
      assert.equal(isMatchComplete(next), m.solved.length === pairs, `${at}: completa`);
      const g = gradeMatch(item, next.attempts);
      assert.deepEqual(g.solved, m.solved, `${at}: la calificación ve las mismas parejas`);
      assert.equal(g.complete, m.solved.length === pairs);
      if (m.solved.length === pairs) cov.complete += 1;
      return next;
    };

    for (let k = 0; k < steps; k += 1) {
      const roll = r.int(0, 99);
      const side = r.int(0, 1) === 0 ? 'left' : 'right';
      if (roll < 55) apply(side, r.int(0, (side === 'left' ? pairs : cards) - 1));
      else if (roll < 62) apply(side, r.int(-1, (side === 'left' ? pairs : cards)));
      else if (roll < 72) apply(HOSTILE[r.int(0, HOSTILE.length - 1)], r.int(0, pairs - 1));
      else if (roll < 80) apply(side, HOSTILE[r.int(0, HOSTILE.length - 1)]);
      else if (roll < 92) { // doble toque: el mismo lado y la misma tarjeta dos veces seguidas
        const index = r.int(0, (side === 'left' ? pairs : cards) - 1);
        apply(side, index);
        apply(side, index);
      } else { // pareja entera: izquierda y derecha, a veces la correcta
        const left = r.int(0, pairs - 1);
        apply('left', left);
        apply('right', r.int(0, 2) === 0 ? r.int(0, cards - 1) : left);
      }
    }
    // Tras completar, nada puede cambiar lo resuelto ni los intentos.
    if (isMatchComplete(s)) {
      const solved = [...s.solved];
      const tries = s.attempts.length;
      for (let k = 0; k < 50; k += 1) apply(r.int(0, 1) === 0 ? 'left' : 'right', r.int(0, cards - 1));
      assert.deepEqual([...s.solved], solved, `${label}: lo resuelto es definitivo`);
      assert.equal(s.attempts.length, tries, `${label}: sin intentos nuevos tras completar`);
    }
  }
  return cov;
}

for (const [pairs, extras] of [[2, 0], [2, 4], [6, 0], [10, 4]]) {
  test(`fuzz de toques (match_pairs, ${pairs} parejas y ${extras} de más): 60 secuencias contra el modelo, sin excepciones`, () => {
    const cov = runMatch({ pairs, extras });
    assert.ok(cov.complete > 0 && cov.hits > 0 && cov.misses > 0 && cov.selects > 0, 'la exploración acertó, falló, eligió y completó');
  });
}

// ---------- argumentos hostiles y topes ----------
test('argumentos hostiles: ningún estado cambia ni lanza (ordenar, construir, banco y emparejar)', () => {
  const o = placeBlock(createOrderState(4, { rng: createRng(1) }), 1);
  const b = placeBlock(createBuildState(buildItem(3, 2), { rng: createRng(1) }), 1);
  const c = placeWord(createClozeState(3, 5, { rng: createRng(1) }), 1);
  const mt = pickMatch(createMatchState(3, 1, { rng: createRng(1) }), 'left', 1);
  for (const h of HOSTILE) {
    assert.equal(placeBlock(o, h), o, `placeBlock(${String(h)})`);
    assert.equal(removeBlock(o, h), o, `removeBlock(${String(h)})`);
    assert.equal(placeBlock(b, h), b);
    assert.equal(removeBlock(b, h), b);
    assert.equal(placeWord(c, h), c, `placeWord(${String(h)})`);
    assert.equal(placeWord(c, 0, h), c, `placeWord(0, ${String(h)})`);
    assert.equal(removeFill(c, h), c, `removeFill(${String(h)})`);
    assert.equal(pickMatch(mt, h, 0), mt, `pickMatch(${String(h)}, 0)`);
    assert.equal(pickMatch(mt, 'right', h), mt, `pickMatch(right, ${String(h)})`);
    assert.equal(pickMatch(mt, 'left', h), mt, `pickMatch(left, ${String(h)})`);
  }
});

test('el índice -0 se comporta como 0: no duplica, se puede quitar y no rompe el estado (rareza inofensiva: la pantalla solo manda enteros >= 0)', () => {
  const s0 = createOrderState(3, { rng: createRng(1) });
  const t = placeBlock(s0, -0);
  assert.equal(t.placed.length, 1);
  assert.equal(placeBlock(t, 0), t, 'colocar 0 después de -0 no duplica');
  assert.equal(removeBlock(t, 0).placed.length, 0);
  assert.deepEqual(undoLast(t).placed, []);
  assert.equal(JSON.stringify(t.placed), '[0]');
});

test('historial lleno (200): se conservan las acciones más recientes y se puede deshacer hasta vaciarlo, en ordenar y en banco', () => {
  let o = createOrderState(2, { rng: createRng(3) });
  for (let k = 0; k < 300; k += 1) { o = placeBlock(o, 0); o = removeBlock(o, 0); }
  assert.equal(o.history.length, ORDER_LIMITS.history);
  const seen = [];
  while (o.history.length > 0) { o = undoLast(o); seen.push([...o.placed]); assert.equal(new Set(o.placed).size, o.placed.length); assert.ok(o.placed.every((v) => v === 0 || v === 1)); }
  assert.equal(seen.length, ORDER_LIMITS.history);
  assert.equal(undoLast(o), o, 'sin historial, deshacer no hace nada');

  let c = createClozeState(1, 2, { rng: createRng(3) });
  for (let k = 0; k < 300; k += 1) { c = placeWord(c, 0); c = removeFill(c, 0); }
  assert.equal(c.history.length, CLOZE_BANK_LIMITS.history);
  let n = 0;
  while (c.history.length > 0) { c = undoCloze(c); n += 1; assert.ok(c.fills[0] === null || c.fills[0] === 0); }
  assert.equal(n, CLOZE_BANK_LIMITS.history);
  assert.equal(undoCloze(c), c);
});

test('«Empezar de nuevo» sigue limpiando cuando el historial ya se agotó pero quedan piezas puestas (más de 200 acciones y 200 deshacer)', () => {
  let o = createOrderState(3, { rng: createRng(4) });
  o = placeBlock(o, 0);
  for (let k = 0; k < 300; k += 1) { o = placeBlock(o, 1); o = removeBlock(o, 1); }
  while (o.history.length > 0) o = undoLast(o);
  assert.deepEqual([...o.placed], [0], 'la acción más antigua se perdió del historial y su pieza sigue puesta');
  const o2 = resetOrder(o);
  assert.notEqual(o2, o);
  assert.deepEqual([...o2.placed], []);

  let c = createClozeState(2, 4, { rng: createRng(4) });
  c = placeWord(c, 0);
  for (let k = 0; k < 300; k += 1) { c = placeWord(c, 1); c = removeFill(c, 1); }
  while (c.history.length > 0) c = undoCloze(c);
  assert.deepEqual([...c.fills], [0, null]);
  const c2 = resetCloze(c);
  assert.notEqual(c2, c);
  assert.deepEqual([...c2.fills], [null, null]);
});

test('emparejar: con miles de fallos los intentos no pasan del tope y las parejas acertadas siempre se guardan', () => {
  let s = createMatchState(2, 4, { rng: createRng(5) });
  for (let k = 0; k < 3000; k += 1) { s = pickMatch(s, 'left', 0); s = pickMatch(s, 'right', 1 + (k % 5)); }
  assert.ok(s.attempts.length <= MATCH_LIMITS.attempts, `intentos ${s.attempts.length}`);
  s = pickMatch(s, 'left', 0);
  s = pickMatch(s, 'right', 0);
  s = pickMatch(s, 'left', 1);
  s = pickMatch(s, 'right', 1);
  assert.equal(isMatchComplete(s), true);
  const item = { type: 'match_pairs', prompt_es: 'x', data: { pairs: [{ left: 'a', right: 'b' }, { left: 'c', right: 'd' }], extra_right: ['e', 'f', 'g', 'h'] } };
  const g = gradeMatch(item, s.attempts);
  assert.equal(g.complete, true, 'las parejas acertadas no se pierden aunque se llegue al tope de fallos');
  assert.equal(g.result, 'wrong', 'hubo fallos, así que no es correcto a la primera');
});
