// @purpose: Pruebas del planificador simple de respaldo (core/srs.simple.js).
// Pruebas del planificador simple de respaldo (subparte 1.4, cuarto 4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newCard, review, retrievability, previewIntervals, levelOf, dueLabel, LEITNER_DAYS } from '../core/srs.simple.js';
import * as fsrs from '../core/srs.js';

const T0 = new Date('2026-10-20T10:00:00.000Z');
const D = 86400000;
const plus = (d, n) => new Date(d.getTime() + n * D);
const gap = (c) => (new Date(c.due) - new Date(c.last_review)) / D;
function run(ratings) {
  let c = newCard('x.1', 0, T0); const gaps = [];
  for (const r of ratings) { c = review(c, r, new Date(c.state === 0 ? T0 : c.due)); gaps.push(gap(c)); }
  return { c, gaps };
}

test('misma interfaz que el motor normal y reutiliza newCard, levelOf y dueLabel', () => {
  for (const k of ['newCard', 'review', 'retrievability', 'previewIntervals', 'levelOf', 'dueLabel']) assert.equal(typeof (k in fsrs ? fsrs[k] : null), 'function', k);
  assert.equal(newCard, fsrs.newCard); assert.equal(levelOf, fsrs.levelOf); assert.equal(dueLabel, fsrs.dueLabel);
  assert.deepEqual([...LEITNER_DAYS], [1, 3, 7, 14, 30, 60, 120, 240]);
});

test('CA 1: los intervalos crecen con aciertos y un fallo los reduce', () => {
  const { c, gaps } = run(['good', 'good', 'good', 'good', 'good', 'good', 'good']);
  assert.deepEqual(gaps, [3, 7, 14, 30, 60, 120, 240]);
  const top = run(Array(12).fill('good')).gaps; assert.equal(top[top.length - 1], 240);
  const failed = review(c, 'again', new Date(c.due));
  assert.equal(gap(failed), 1); assert.equal(failed.stability, 1); assert.equal(failed.lapses, c.lapses + 1);
  assert.ok(gap(failed) < gap(c));
});

test('respuestas: Hard se queda en la caja, Easy sube dos, la primera vez Good va a la caja 2', () => {
  const base = run(['good', 'good']).c; // caja de 7 días
  assert.equal(gap(review(base, 'hard', new Date(base.due))), 7);
  assert.equal(gap(review(base, 'good', new Date(base.due))), 14);
  assert.equal(gap(review(base, 'easy', new Date(base.due))), 30);
  const n = newCard('x.9', 0, T0);
  assert.deepEqual(['again', 'hard', 'good', 'easy'].map((r) => gap(review(n, r, T0))), [1, 1, 3, 7]);
  const p = previewIntervals(n, T0);
  assert.deepEqual(Object.keys(p), ['again', 'hard', 'good', 'easy']);
  assert.equal(p.good.label, 'Repaso en 3 d');
});

test('el primer "Otra vez" de una tarjeta nueva no suma lapses; 8 fallos de una aprendida marcan sanguijuela', () => {
  assert.equal(review(newCard('x.1', 0, T0), 'again', T0).lapses, 0);
  let c = review(newCard('x.1', 0, T0), 'good', T0); const flags = [];
  for (let i = 0; i < 8; i += 1) { c = review(c, 'again', plus(new Date(c.last_review), 1)); flags.push(c.leech); }
  assert.deepEqual(flags, [false, false, false, false, false, false, false, true]);
  assert.equal(c.suspended, true);
  assert.throws(() => review(c, 'good', plus(T0, 40)), /suspendida/);
  let d = review(newCard('x.2', 0, T0), 'good', T0);
  for (let i = 0; i < 3; i += 1) d = review(d, 'again', plus(new Date(d.last_review), 1), { leechThreshold: 3 });
  assert.equal(d.leech, true);
});

test('CA 2: retrievabilidad en [0, 1], nueva 0, decrece y vale 0,9 al vencer', () => {
  assert.equal(retrievability(newCard('x.1', 0, T0), T0), 0);
  const { c } = run(['good', 'good', 'good']);
  let prev = 2;
  for (const k of [0, 1, 7, 14, 100, 1e4, 1e5]) {
    const r = retrievability(c, plus(new Date(c.last_review), k));
    assert.ok(r >= 0 && r <= 1 && Number.isFinite(r)); assert.ok(r <= prev + 1e-12); prev = r;
  }
  assert.equal(retrievability(c, new Date(c.last_review)), 1);
  assert.ok(Math.abs(retrievability(c, new Date(c.due)) - 0.9) < 1e-9);
});

test('CA 5: reloj hacia atrás no da NaN ni intervalos negativos', () => {
  const { c } = run(['good', 'good', 'good']);
  const back = plus(new Date(c.last_review), -9);
  for (const r of [1, 2, 3, 4]) { const n = review(c, r, back); assert.ok(new Date(n.due) >= new Date(c.last_review)); assert.ok(gap(n) >= 1); }
  assert.equal(retrievability(c, back), 1);
  for (const v of Object.values(previewIntervals(c, back))) assert.doesNotMatch(v.label, /NaN|undefined|-\d/);
});

test('compatibilidad: una tarjeta de FSRS sigue en el motor simple y viceversa, sin migrar nada', () => {
  let c = newCard('x.1', 0, T0);
  for (let i = 0; i < 4; i += 1) c = fsrs.review(c, 'good', new Date(c.state === 0 ? T0 : c.due));
  const s = review(c, 'good', new Date(c.due));
  assert.equal(s.state, 2); assert.ok(LEITNER_DAYS.includes(s.stability)); assert.ok(gap(s) >= 1);
  const back = fsrs.review(s, 'good', new Date(s.due));
  for (const k of ['stability', 'difficulty']) assert.ok(Number.isFinite(back[k]) && back[k] >= 0);
  assert.ok(gap(back) > 0);
  // Raíz del fallo hallado en el recorrido: tras el primer repaso simple la dificultad debe ser válida para FSRS (≥ 1).
  const fromNew = review(newCard('x.2', 0, T0), 'good', T0);
  assert.equal(fromNew.difficulty, 5);
  assert.doesNotThrow(() => fsrs.review(fromNew, 'good', new Date(fromNew.due)));
  assert.equal(review(c, 'good', new Date(c.due)).difficulty, c.difficulty, 'una tarjeta con dificultad válida la conserva');
});

test('determinismo: sin Math.random ni Date.now, no muta y acepta nombres de respuesta', () => {
  const c = run(['good', 'good']).c; const snap = JSON.stringify(c);
  const rr = Math.random; const nn = Date.now;
  Math.random = () => { throw new Error('no'); }; Date.now = () => { throw new Error('no'); };
  try {
    assert.deepEqual(review(c, 'GOOD', new Date(c.due)), review(c, 3, new Date(c.due)));
    retrievability(c, T0); previewIntervals(c, T0);
  } finally { Math.random = rr; Date.now = nn; }
  assert.equal(JSON.stringify(c), snap);
});

test('entradas inválidas fallan con mensaje claro', () => {
  const c = newCard('x.1', 0, T0);
  for (const bad of [0, 5, 2.5, 'bien', null]) assert.throws(() => review(c, bad, T0), /rating/);
  assert.throws(() => review(null, 'good', T0), /tarjeta/);
  assert.throws(() => review({ ...c, state: 7 }, 'good', T0), /state/);
  assert.throws(() => review({ ...c, stability: -1 }, 'good', T0), /stability/);
  assert.throws(() => review({ ...c, due: 'x' }, 'good', T0), /due/);
  assert.throws(() => review({ ...c, state: 2 }, 'good', T0), /last_review/);
  assert.throws(() => review(c, 'good', 'ayer'), /toDate/);
  assert.throws(() => retrievability({ ...c, reps: 1.5 }, T0), /reps/);
});
