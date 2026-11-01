// @purpose: Pruebas del planificador FSRS de core/srs.js.
// Pruebas del planificador FSRS de core/srs.js (subparte 1.4, cuarto 2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { newCard, review, retrievability, previewIntervals, dueLabel, RATING, FSRS_VERSION, DEFAULT_RETENTION } from '../core/srs.js';

const T0 = new Date('2026-10-20T10:00:00.000Z');
const D = 86400000;
const days = (card) => (new Date(card.due) - new Date(card.last_review)) / D;
const plus = (d, n) => new Date(d.getTime() + n * D);

// Repasa siempre en la fecha de vencimiento con la respuesta dada.
function run(ratings, opts) {
  let c = newCard('x.1', 0, T0); const gaps = [];
  for (const r of ratings) { c = review(c, r, new Date(c.state === 0 ? T0 : c.due), opts); gaps.push(days(c)); }
  return { c, gaps };
}

test('CA 1: los intervalos crecen con aciertos seguidos', () => {
  const { gaps } = run(Array(9).fill('good'));
  for (let i = 1; i < gaps.length; i += 1) assert.ok(gaps[i] > gaps[i - 1], `intervalo ${i}: ${gaps}`);
  const easy = run(Array(6).fill('easy')).gaps;
  for (let i = 1; i < easy.length; i += 1) assert.ok(easy[i] > easy[i - 1]);
});

test('CA 1: un fallo reduce el intervalo y la estabilidad', () => {
  const { c: mature, gaps } = run(Array(6).fill('good'));
  const failed = review(mature, 'again', new Date(mature.due));
  assert.ok(days(failed) < gaps[gaps.length - 1], `${days(failed)} < ${gaps[gaps.length - 1]}`);
  assert.ok(failed.stability < mature.stability);
  assert.equal(failed.lapses, mature.lapses + 1);
  assert.ok(failed.difficulty >= mature.difficulty);
});

test('CA 1: para una tarjeta ya repasada Again < Hard < Good < Easy', () => {
  const { c } = run(['good', 'good', 'good']);
  const p = previewIntervals(c, new Date(c.due));
  const t = (k) => new Date(p[k].due).getTime();
  assert.ok(t('again') < t('hard') && t('hard') < t('good') && t('good') < t('easy'));
});

test('CA 2: retrievabilidad en [0, 1], nueva = 0, decrece con el tiempo y ronda la retención en el vencimiento', () => {
  const n = newCard('x.1', 0, T0);
  assert.equal(retrievability(n, T0), 0);
  const { c } = run(['good', 'good', 'good', 'good']);
  let prev = 2;
  for (const k of [0, 0.5, 1, 3, 10, 40, 200, 3000, 1e5]) {
    const r = retrievability(c, plus(new Date(c.last_review), k));
    assert.ok(r >= 0 && r <= 1 && Number.isFinite(r), String(r));
    assert.ok(r <= prev + 1e-12, `no crece: ${k} d → ${r}`); prev = r;
  }
  assert.ok(retrievability(c, new Date(c.last_review)) > 0.999);
  assert.ok(Math.abs(retrievability(c, new Date(c.due)) - DEFAULT_RETENTION) < 0.03);
});

test('CA 3: 8 fallos de una tarjeta ya aprendida → sanguijuela suspendida; con 7 no; umbral configurable', () => {
  const step = (c) => plus(new Date(c.last_review), 1);
  let c = review(newCard('x.1', 0, T0), 'good', T0); const flags = [];
  for (let i = 0; i < 8; i += 1) { c = review(c, 'again', step(c)); flags.push(c.leech); }
  assert.deepEqual(flags, [false, false, false, false, false, false, false, true]);
  assert.equal(c.suspended, true); assert.equal(c.lapses, 8);
  assert.throws(() => review(c, 'good', plus(T0, 30)), /suspendida/);
  let d = review(newCard('x.2', 0, T0), 'good', T0);
  for (let i = 0; i < 3; i += 1) d = review(d, 'again', step(d), { leechThreshold: 3 });
  assert.equal(d.leech, true);
  assert.equal(review(newCard('x.3', 0, T0), 'good', T0).leech, false);
});

test('el primer "Otra vez" de una tarjeta nueva no cuenta como fallo (FSRS)', () => {
  const c = review(newCard('x.1', 0, T0), 'again', T0);
  assert.equal(c.lapses, 0); assert.equal(c.leech, false); assert.equal(c.state, 2);
});

test('CA 5: reloj hacia atrás no da NaN ni intervalos negativos', () => {
  const { c } = run(['good', 'good', 'good']);
  const back = plus(new Date(c.last_review), -5);
  for (const r of [1, 2, 3, 4]) {
    const n = review(c, r, back);
    for (const k of ['stability', 'difficulty']) assert.ok(Number.isFinite(n[k]) && n[k] >= 0, k);
    assert.ok(new Date(n.due) >= new Date(c.last_review));
    assert.ok(days(n) >= 0);
  }
  const rr = retrievability(c, back);
  assert.ok(rr > 0.999 && rr <= 1);
  const p = previewIntervals(c, back);
  for (const v of Object.values(p)) assert.doesNotMatch(v.label, /NaN|undefined|-\d/);
  assert.doesNotMatch(dueLabel(review(c, 'good', back), back), /NaN|-\d/);
});

test('determinismo: sin Math.random ni Date.now, con fuzz apagado y con fuzz sembrado', () => {
  const { c } = run(['good', 'good', 'good', 'good']);
  const realR = Math.random; const realN = Date.now;
  Math.random = () => { throw new Error('Math.random no permitido'); };
  Date.now = () => { throw new Error('Date.now no permitido'); };
  try {
    const now = new Date(c.due);
    assert.deepEqual(review(c, 'good', now), review(c, 'good', now));
    const o = { fuzz: true, seed: 'sembrado' };
    assert.deepEqual(review(c, 'good', now, o), review(c, 'good', now, o));
    assert.deepEqual(previewIntervals(c, now, o), previewIntervals(c, now, o));
    retrievability(c, now);
  } finally { Math.random = realR; Date.now = realN; }
});

test('fuzz: reproducible por semilla, dentro de un rango razonable y distinto del exacto', () => {
  const { c } = run(Array(7).fill('good'));
  const now = new Date(c.due);
  const exact = days(review(c, 'good', now));
  assert.ok(exact > 20);
  const seen = new Set();
  for (let i = 0; i < 40; i += 1) {
    const g = days(review(c, 'good', now, { fuzz: true, seed: `s${i}` }));
    assert.ok(Number.isInteger(g) && Math.abs(g - exact) <= exact * 0.2 + 2, `${g} vs ${exact}`);
    seen.add(g);
  }
  assert.ok(seen.size > 3, 'el fuzz debe variar con la semilla');
  // Sin fuzz el intervalo en días es siempre el mismo, sin importar la hora exacta del repaso.
  const plain = new Set();
  for (let k = 0; k < 60; k += 1) {
    const n = review(c, 'good', new Date(now.getTime() + k * 60000));
    plain.add(Math.round((new Date(n.due) - new Date(n.last_review)) / D));
  }
  assert.equal(plain.size, 1, 'sin fuzz el intervalo no varía');
  assert.throws(() => review(c, 'good', now, { fuzz: true }), /seed/);
  assert.throws(() => review(c, 'good', now, { fuzz: true, seed: '' }), /seed/);
});

test('retención configurable: más retención, intervalos más cortos; fuera de rango falla', () => {
  const { c } = run(['good', 'good', 'good']);
  const now = new Date(c.due);
  const g = (retention) => days(review(c, 'good', now, { retention }));
  assert.ok(g(0.8) > g(0.9) && g(0.9) > g(0.95));
  for (const bad of [0, 0.5, 1, 1.2, '0.9', NaN]) assert.throws(() => review(c, 'good', now, { retention: bad }), /retención/);
});

test('entradas: respuestas por nombre o número, no muta y rechaza tarjetas dañadas', () => {
  const c = newCard('x.1', 0, T0); const snap = JSON.stringify(c);
  assert.deepEqual(review(c, 'GOOD', T0), review(c, RATING.GOOD, T0));
  assert.equal(JSON.stringify(c), snap);
  for (const bad of [0, 5, 2.5, 'bien', null, undefined]) assert.throws(() => review(c, bad, T0), /rating/);
  assert.throws(() => review(null, 'good', T0), /tarjeta/);
  assert.throws(() => review({ ...c, state: 9 }, 'good', T0), /state/);
  assert.throws(() => review({ ...c, stability: NaN }, 'good', T0), /stability/);
  assert.throws(() => review({ ...c, reps: -1 }, 'good', T0), /reps/);
  assert.throws(() => review({ ...c, due: 'x' }, 'good', T0), /due/);
  assert.throws(() => review({ ...c, state: 2 }, 'good', T0), /last_review/);
  assert.throws(() => review(c, 'good', 'ayer'), /toDate/);
});

test('review: una tarjeta ya vista sin memoria válida (dificultad < 1 o estabilidad 0) falla con mensaje claro', () => {
  const seen = review(newCard('x.1', 0, T0), 'good', T0);
  assert.throws(() => review({ ...seen, difficulty: 0 }, 'good', plus(T0, 3)), /difficulty ≥ 1/);
  assert.throws(() => review({ ...seen, stability: 0 }, 'good', plus(T0, 3)), /stability > 0/);
  assert.equal(retrievability({ ...seen, difficulty: 0 }, plus(T0, 3)) >= 0, true);
});

test('review: la primera vez pasa a repaso con last_review y reps=1; previewIntervals no cambia la tarjeta', () => {
  const c = newCard('x.1', 1, T0, ['t.a']); const snap = JSON.stringify(c);
  const n = review(c, 'good', T0);
  assert.deepEqual([n.state, n.reps, n.lapses, n.facet, n.id, n.last_review], [2, 1, 0, 1, 'x.1#1', T0.toISOString()]);
  assert.deepEqual(n.topics, ['t.a']);
  const p = previewIntervals(c, T0);
  assert.deepEqual(Object.keys(p), ['again', 'hard', 'good', 'easy']);
  assert.match(p.good.label, /^Repaso en /);
  assert.equal(JSON.stringify(c), snap);
});

test('CA 6: licencia y VERSION.txt presentes y coherentes con el archivo vendorizado', () => {
  assert.match(FSRS_VERSION, /v5\.4\.1.*FSRS-6/);
  for (const f of ['index.mjs', 'LICENSE', 'VERSION.txt']) assert.ok(existsSync(new URL(`../vendor/ts-fsrs/${f}`, import.meta.url)), f);
  const read = (f) => readFileSync(new URL(`../vendor/ts-fsrs/${f}`, import.meta.url));
  const sha = (b) => createHash('sha256').update(b).digest('hex');
  const v = read('VERSION.txt').toString('utf8');
  assert.ok(v.includes(sha(read('index.mjs'))), 'sha256 de index.mjs en VERSION.txt');
  assert.ok(v.includes(sha(read('LICENSE'))), 'sha256 de LICENSE en VERSION.txt');
  assert.match(read('LICENSE').toString('utf8'), /MIT License/);
});
