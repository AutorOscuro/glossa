// @purpose: Pruebas del intercalado (core/sessionInterleave.js y su uso en session.build, 1.8-T3): propiedades con datos aleatorios semillados, casos límite y CA 2.
// 1.8-T3: nunca más de 2 seguidos del mismo tema ni tipo (si hay opciones), sin perder ni duplicar ítems, determinista y con poca alteración del orden.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interleave, runExcess } from '../core/sessionInterleave.js';
import { build } from '../core/session.js';
import { createRng } from '../core/rng.js';

const it = (id, topic, exerciseType) => ({ id, topic, exerciseType });
const topicsOf = (l) => l.map((x) => x.topic);
const typesOf = (l) => l.map((x) => x.exerciseType);
const maxRunOf = (keys) => { let best = 0; let run = 0; let prev = null; for (const k of keys) { run = k !== null && k === prev ? run + 1 : k === null ? 0 : 1; prev = k; best = Math.max(best, run); } return best; };
const sameSet = (a, b) => assert.deepEqual(a.map((x) => x.id).sort(), b.map((x) => x.id).sort());

test('runExcess: cuenta los ítems que pasan del límite; nulos rompen la racha', () => {
  assert.equal(runExcess(['a', 'a', 'a', 'a', 'b'], 2), 2);
  assert.equal(runExcess(['a', 'a', 'b', 'a', 'a'], 2), 0);
  assert.equal(runExcess(['a', 'a', null, 'a', 'a', 'a'], 2), 1);
  assert.equal(runExcess([null, null, null, null], 2), 0);
  assert.equal(runExcess([], 2), 0);
});

test('entrada ya válida: el orden no cambia', () => {
  const l = [it(1, 'a', 'x'), it(2, 'b', 'y'), it(3, 'a', 'z'), it(4, 'b', 'x')];
  const r = interleave(l);
  assert.deepEqual(r.items.map((x) => x.id), [1, 2, 3, 4]);
  assert.equal(r.moved, 0);
  assert.deepEqual(r.violations, { topic: 0, type: 0 });
});

test('3 del mismo tema seguidos con otro disponible: se separan y el resto no se mueve de más', () => {
  const l = [it(1, 'a', 'x'), it(2, 'a', 'y'), it(3, 'a', 'z'), it(4, 'b', 'x'), it(5, 'c', 'y')];
  const r = interleave(l);
  assert.ok(maxRunOf(topicsOf(r.items)) <= 2);
  assert.deepEqual(r.items.slice(0, 2).map((x) => x.id), [1, 2], 'los dos primeros siguen donde estaban');
  assert.equal(r.violations.topic, 0);
});

test('mismo tipo seguido: se separa; y prefiere variar el formato dentro del tema', () => {
  const l = [it(1, 'a', 'x'), it(2, 'b', 'x'), it(3, 'c', 'x'), it(4, 'd', 'y')];
  assert.ok(maxRunOf(typesOf(interleave(l).items)) <= 2);
  const v = [it(1, 'a', 'x'), it(2, 'a', 'x'), it(3, 'a', 'y')];
  assert.deepEqual(interleave(v).items.map((x) => x.id), [1, 3, 2], 'tras a/x se prefiere a/y a otro a/x');
});

test('sin opciones (todo del mismo tema): se deja como está y se informa de la violación', () => {
  const l = [it(1, 'a', 'x'), it(2, 'a', 'y'), it(3, 'a', 'x'), it(4, 'a', 'y'), it(5, 'a', 'x')];
  const r = interleave(l);
  assert.deepEqual(r.items.map((x) => x.id), [1, 2, 3, 4, 5]);
  assert.equal(r.violations.topic, 3);
  assert.equal(r.violations.type, 0);
});

test('opciones parciales: reparte lo que se puede (4 de un tema y 1 de otro)', () => {
  const l = [it(1, 'a', null), it(2, 'a', null), it(3, 'a', null), it(4, 'a', null), it(5, 'b', null)];
  const r = interleave(l);
  assert.equal(r.maxRun, 2);
  assert.deepEqual(r.violations, { topic: 0, type: 0 });
  assert.ok(maxRunOf(topicsOf(r.items)) <= 2);
  const l2 = [it(1, 'a', null), it(2, 'a', null), it(3, 'a', null), it(4, 'a', null), it(5, 'a', null), it(6, 'b', null)];
  const r2 = interleave(l2);
  assert.equal(r2.maxRun, 3, 'con 5 y 1 lo mejor posible es 3 seguidos');
  assert.equal(maxRunOf(topicsOf(r2.items)), 3);
  sameSet(r2.items, l2);
});

test('nulos: sin tema o sin tipo no cuentan como repetidos', () => {
  const l = Array.from({ length: 6 }, (_, i) => it(i, null, null));
  const r = interleave(l);
  assert.deepEqual(r.items.map((x) => x.id), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(r.violations, { topic: 0, type: 0 });
  assert.deepEqual(interleave([]).items, []);
  assert.deepEqual(interleave([it(1, 'a', 'x')]).items.map((x) => x.id), [1]);
});

test('validación y presupuesto agotado', () => {
  assert.throws(() => interleave(null), /items debe ser/);
  assert.throws(() => interleave([], { maxRun: 0 }), /maxRun/);
  const l = [it(1, 'a', 'x'), it(2, 'a', 'x'), it(3, 'a', 'x'), it(4, 'b', 'y')];
  const r = interleave(l, { budget: 1 });
  assert.deepEqual(r.items.map((x) => x.id), [1, 2, 3, 4], 'sin presupuesto: orden de entrada');
  assert.equal(r.window, 0);
  assert.equal(r.violations.topic, 1);
});

test('maxRun configurable', () => {
  const l = [it(1, 'a', null), it(2, 'a', null), it(3, 'b', null), it(4, 'a', null), it(5, 'a', null)];
  assert.equal(maxRunOf(topicsOf(interleave(l, { maxRun: 1 }).items)), 2, 'con 4 y 1 el mínimo posible sube a 2');
  assert.equal(interleave(l, { maxRun: 3 }).moved, 0);
});

test('propiedades (400 casos semillados): conserva ítems, cumple si es posible, determinista, sin entradas alteradas', () => {
  const rng = createRng(2026);
  for (let c = 0; c < 400; c += 1) {
    const n = 1 + Math.floor(rng.next() * 30);
    const nt = 1 + Math.floor(rng.next() * 6);
    const ny = 1 + Math.floor(rng.next() * 5);
    const l = Array.from({ length: n }, (_, i) => it(i, rng.next() < 0.1 ? null : `t${Math.floor(rng.next() * nt)}`, rng.next() < 0.1 ? null : `y${Math.floor(rng.next() * ny)}`));
    const copy = JSON.stringify(l);
    const r = interleave(l);
    assert.equal(JSON.stringify(l), copy, 'no modifica la entrada');
    sameSet(r.items, l);
    assert.equal(new Set(r.items.map((x) => x.id)).size, n);
    assert.deepEqual(interleave(l).items, r.items, 'determinista');
    // Condición necesaria por dimensión: si cada tema y cada tipo cabe con ≤ 2 seguidos, el resultado no debe tener violaciones.
    const fits = (keys) => { const m = new Map(); for (const k of keys) if (k !== null) m.set(k, (m.get(k) ?? 0) + 1); return [...m.values()].every((v) => v <= 2 * (n - v + 1)); };
    if (fits(topicsOf(l)) && fits(typesOf(l)) && r.window !== 0) assert.deepEqual(r.violations, { topic: 0, type: 0 }, `caso ${c}`);
    assert.ok(maxRunOf(topicsOf(r.items)) <= Math.max(2, r.maxRun ?? n), `caso ${c}`);
  }
});

test('propiedades: con temas y tipos suficientes casi siempre se cumple y la urgencia se altera poco', () => {
  const rng = createRng(77);
  let incumple = 0;
  let desplazamiento = 0;
  let total = 0;
  for (let c = 0; c < 200; c += 1) {
    const n = 20;
    const l = Array.from({ length: n }, (_, i) => it(i, `t${Math.floor(rng.next() * 5)}`, `y${Math.floor(rng.next() * 4)}`));
    const r = interleave(l);
    if (r.violations.topic + r.violations.type > 0) incumple += 1;
    r.items.forEach((x, p) => { desplazamiento += Math.abs(x.id - p); total += 1; });
  }
  assert.ok(incumple <= 10, `incumplimientos: ${incumple} de 200`);
  assert.ok(desplazamiento / total < 4, `desplazamiento medio ${desplazamiento / total}`);
});

test('rendimiento: 100 ítems con pocos temas y tipos, el mejor de 3 intentos en menos de 100 ms', () => {
  const rng = createRng(5);
  const l = Array.from({ length: 100 }, (_, i) => it(i, `t${Math.floor(rng.next() * 3)}`, `y${Math.floor(rng.next() * 3)}`));
  let best = Infinity;
  for (let k = 0; k < 3; k += 1) { const t0 = performance.now(); interleave(l); best = Math.min(best, performance.now() - t0); }
  assert.ok(best < 100, `${best} ms`);
});

// ───────── dentro de session.build (CA 2) ─────────
const NOW = new Date('2026-10-25T12:00:00.000Z');
const ago = (d) => new Date(NOW.getTime() - d * 86400000).toISOString();
let n = 0;
const card = (topic, type, over = {}) => { n += 1; const itemId = `${topic}.${n}`; return { card: { id: `${itemId}#0`, itemId, facet: 0, topics: [topic], state: 2, due: ago(1 + (n % 7)), stability: 5, difficulty: 5, reps: 3, lapses: 0, last_review: ago(6), suspended: false, leech: false, created: ago(30), ...over }, item: { id: itemId, type } }; };
const TYPES = ['mcq_en_es', 'first_letter', 'cloze_bank', 'match_pairs'];

test('CA 2 en build: 12 mezclas de temas y tipos, nunca más de 2 seguidos del mismo tema ni tipo', () => {
  const rng = createRng(11);
  for (let c = 0; c < 12; c += 1) {
    const nTopics = 3 + (c % 4);
    const pairs = Array.from({ length: 30 }, (_, i) => card(`gram.t${Math.floor(rng.next() * nTopics)}`, TYPES[Math.floor(rng.next() * TYPES.length)]));
    const plan = build({ now: NOW, cards: pairs.map((p) => p.card), items: pairs.map((p) => p.item), rng: createRng(c), size: 20 });
    assert.equal(plan.count, 20);
    assert.ok(maxRunOf(plan.items.map((x) => x.topic)) <= 2, `tema, caso ${c}`);
    assert.ok(maxRunOf(plan.items.map((x) => x.exerciseType)) <= 2, `tipo, caso ${c}`);
    assert.equal(new Set(plan.items.map((x) => x.cardId)).size, 20);
    assert.deepEqual(plan.stats.interleave.violations, { topic: 0, type: 0 });
  }
});

test('build: el intercalado no cambia QUÉ ítems entran, también con rescate, energía baja y nuevas', () => {
  const pairs = Array.from({ length: 160 }, (_, i) => card(`gram.t${i % 4}`, TYPES[i % 4]));
  const base = { now: NOW, cards: pairs.map((p) => p.card), items: pairs.map((p) => p.item) };
  const rescate = build({ ...base, rng: createRng(1) });
  assert.equal(rescate.rescue.active, true);
  assert.ok(maxRunOf(rescate.items.map((x) => x.topic)) <= 2);
  const low = build({ ...base, rng: createRng(1), energy: 'low' });
  assert.equal(low.count, 10);
  assert.ok(maxRunOf(low.items.map((x) => x.exerciseType)) <= 2);
  const nuevas = Array.from({ length: 12 }, (_, i) => card('gram.nuevo', TYPES[i % 4], { state: 0, due: ago(0) }));
  const mix = build({ now: NOW, cards: [...pairs.slice(0, 8).map((p) => p.card), ...nuevas.map((p) => p.card)], items: [...pairs.slice(0, 8), ...nuevas].map((p) => p.item), rng: createRng(3), topics: [{ id: 'gram.nuevo', area: 'gram', priority: 1 }] });
  assert.equal(mix.items.filter((x) => x.kind === 'new').length, 10);
  assert.ok(maxRunOf(mix.items.map((x) => x.topic)) <= 2);
});

test('build: determinista y el plan no depende del orden de entrada con intercalado', () => {
  const rng = createRng(4);
  const pairs = Array.from({ length: 40 }, () => card(`gram.t${Math.floor(rng.next() * 3)}`, TYPES[Math.floor(rng.next() * 4)]));
  const go = (l) => build({ now: NOW, cards: l.map((p) => p.card), items: l.map((p) => p.item), rng: createRng(9) });
  assert.deepEqual(go(pairs), go(pairs));
  assert.deepEqual(go(pairs), go([...pairs].reverse()));
});

test('build: items con topic (primer tema no retirado) y plan congelado', () => {
  const p = card('gram.a', 'mcq_en_es');
  const plan = build({ now: NOW, cards: [p.card], items: [p.item], rng: createRng(1) });
  assert.equal(plan.items[0].topic, 'gram.a');
  assert.ok(Object.isFrozen(plan.items) && Object.isFrozen(plan.stats.interleave) && Object.isFrozen(plan.stats.interleave.violations));
});

// ───────── refuerzos tras la primera tanda de roturas ─────────
test('moved cuenta los ítems que cambian de sitio', () => {
  const l = [it(1, 'a', null), it(2, 'a', null), it(3, 'a', null), it(4, 'b', null)];
  const r = interleave(l);
  assert.ok(r.moved >= 1 && r.moved <= 3, String(r.moved));
  assert.equal(r.moved, r.items.filter((x, p) => x !== l[p]).length);
});

test('contra fuerza bruta: encuentra un orden válido si y solo si existe (300 casos pequeños, obliga a retroceder)', () => {
  const rng = createRng(31);
  const exists = (l) => {
    const used = new Array(l.length).fill(false);
    const seq = [];
    const ok = (k, key) => { if (key === null) return true; return !(seq.length >= 2 && seq[seq.length - 1][k] === key && seq[seq.length - 2][k] === key); };
    const go = () => {
      if (seq.length === l.length) return true;
      for (let i = 0; i < l.length; i += 1) {
        if (used[i] || !ok('topic', l[i].topic) || !ok('exerciseType', l[i].exerciseType)) continue;
        used[i] = true; seq.push(l[i]);
        if (go()) return true;
        seq.pop(); used[i] = false;
      }
      return false;
    };
    return go();
  };
  let posibles = 0;
  let imposibles = 0;
  for (let c = 0; c < 300; c += 1) {
    const n = 5 + Math.floor(rng.next() * 4);
    const l = Array.from({ length: n }, (_, i) => it(i, `t${Math.floor(rng.next() * 3)}`, `y${Math.floor(rng.next() * 3)}`));
    const r = interleave(l);
    const hay = exists(l);
    if (hay) posibles += 1; else imposibles += 1;
    assert.equal(r.violations.topic + r.violations.type === 0, hay, `caso ${c}: ${JSON.stringify(l.map((x) => x.topic + x.exerciseType))}`);
    sameSet(r.items, l);
  }
  assert.ok(posibles > 50 && imposibles > 5, `${posibles} posibles, ${imposibles} imposibles: el generador debe cubrir ambos`);
});

test('build: el tema del ítem se usa para intercalar aunque no haya tipos (solo `topics`)', () => {
  const cards = [...Array.from({ length: 6 }, (_, i) => card('gram.a', null, { due: ago(20 - i) }).card), ...Array.from({ length: 6 }, (_, i) => card('gram.b', null, { due: ago(10 - i) }).card)];
  const plan = build({ now: NOW, cards, rng: createRng(1) });
  assert.equal(plan.count, 12);
  assert.ok(maxRunOf(plan.items.map((x) => x.topic)) <= 2);
  assert.ok(plan.items.every((x) => x.topic === 'gram.a' || x.topic === 'gram.b'));
  assert.ok(plan.stats.interleave.moved > 0);
  assert.equal(plan.stats.interleave.moved, plan.items.filter((x, p) => x.cardId !== [...cards].sort((a, b) => a.due.localeCompare(b.due)).map((c) => c.id)[p]).length);
});

test('la ventana de 6 mantiene la búsqueda local: caso fijo donde la ventana total elegiría otro orden', () => {
  const spec = ['t1y1', 't2y1', 't1y1', 't2y2', 't0y2', 't1y1', 't1y1', 't1y1', 't1y0'];
  const l = spec.map((s, i) => it(i, s.slice(0, 2), s.slice(2)));
  assert.deepEqual(interleave(l).items.map((x) => x.id), [0, 3, 2, 1, 8, 5, 4, 6, 7]);
  assert.deepEqual(interleave(l, { windows: [Infinity] }).items.map((x) => x.id), [0, 1, 8, 2, 3, 5, 4, 6, 7]);
});

test('build: el tema de las nuevas también se intercala con los repasos de otro tema', () => {
  const rev = Array.from({ length: 4 }, (_, i) => card('gram.r', null, { due: ago(30 - i) }).card);
  const nuevas = Array.from({ length: 6 }, () => card('gram.n', null, { state: 0, due: ago(0) }).card);
  const plan = build({ now: NOW, cards: [...rev, ...nuevas], rng: createRng(1), topics: [{ id: 'gram.n', area: 'gram', priority: 1 }], newCap: 6 });
  assert.equal(plan.count, 10);
  assert.ok(maxRunOf(plan.items.map((x) => x.topic)) <= 2);
  assert.ok(plan.items.filter((x) => x.kind === 'new').every((x) => x.topic === 'gram.n'));
});
