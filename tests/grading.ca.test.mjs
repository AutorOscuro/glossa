// @purpose: Criterios de aceptación de la 1.5, de punta a punta con la API pública de calificación.
// Cierre de la 1.5 (cuarto 4): los 4 criterios de aceptación del roadmap (sección 1.5), de punta a punta con la API pública.
// Los casos finos viven en grading.test.mjs, gradingBaseline.test.mjs, answerTimer.test.mjs, gradeAnswer.test.mjs y
// ratingButtons.test.mjs; aquí solo se amarra cada CA.
// El «oráculo» de abajo escribe las reglas del roadmap con SUS números (1,8 · 0,6 · 5), a propósito sin leer grading.config.js
// ni grading.js: si alguien cambia un valor en la configuración sin querer, esta tabla lo delata.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rate, rateDetailed, defaultBaselineMs, RATING } from '../core/grading.js';
import { baselineFor, loadBaselines } from '../core/gradingBaseline.js';
import { createAnswerTimer } from '../core/answerTimer.js';
import { gradeAnswer, gradeManual } from '../core/gradeAnswer.js';
import { createSrs } from '../core/srsEngine.js';
import { newCard } from '../core/srs.js';
import { createEvents } from '../core/events.js';
import { validateEvent } from '../core/eventSchema.js';
import { createMemoryDb } from '../core/db.memory.js';
import { makeClock, makeRng } from './_helpers.mjs';

const NOW = new Date('2026-10-20T15:00:00.000Z');
const srs = createSrs();
const TYPE = 'fix_error';
const BASE = 10000; // mediana de prueba redonda: los bordes caen en 6.000 / 18.000 / 50.000 ms
const RESULTS = ['correct', 'almost', 'wrong', 'dont_know', 'skipped'];
const fresh = () => newCard('g.pp.0001', 0, NOW, ['gram.present_perfect.for_since']);

// Oráculo independiente: roadmap 1.5 escrito tal cual.
function oracle({ result, ms, hint = false, dontKnow = false, interrupted = false }, base) {
  if (dontKnow || result === 'dont_know' || result === 'wrong' || result === 'skipped') return 1; // Again
  const readable = typeof ms === 'number' && Number.isFinite(ms) && ms > 0;
  const ignored = interrupted || !readable || ms > 5 * base; // distracción o dato ilegible: el tiempo no cuenta
  const slow = !ignored && ms > 1.8 * base;
  const fast = !ignored && ms < 0.6 * base;
  if (result === 'almost' || hint || slow) return 2; // Hard
  return fast ? 4 : 3; // Easy / Good
}

// Tiempos: bordes exactos y vecinos, valores extremos y datos ilegibles.
const TIMES = [1, 3000, 5999, 6000, 6001, 10000, 17999, 18000, 18001, 49999, 50000, 50001, 3600000, 0, -5, NaN, Infinity, undefined, null, '8000'];

test('CA-1: tabla de decisión completa (resultado × pista × «no sé» × interrupción × tiempo) contra el oráculo del roadmap', () => {
  let n = 0;
  for (const result of RESULTS) for (const hint of [false, true]) for (const dontKnow of [false, true]) for (const interrupted of [false, true]) {
    for (const ms of TIMES) {
      const input = { result, ms, hint, dontKnow, interrupted };
      const want = oracle(input, BASE);
      assert.equal(rate(input, BASE), want, `rate ${JSON.stringify(input)}`);
      assert.equal(rateDetailed(input, BASE).rating, want, `rateDetailed ${JSON.stringify(input)}`);
      n += 1;
    }
  }
  assert.equal(n, 5 * 2 * 2 * 2 * TIMES.length); // 800 combinaciones, ninguna sin mirar
});

test('CA-1: los 4 niveles salen con los motivos del roadmap, y los bordes exactos son Good', () => {
  assert.deepEqual(RATING, { again: 1, hard: 2, good: 3, easy: 4 });
  const reason = (input) => rateDetailed(input, BASE).reason;
  assert.equal(reason({ result: 'wrong', ms: 1000 }), 'again_wrong');
  assert.equal(reason({ result: 'skipped' }), 'again_skipped');
  assert.equal(reason({ result: 'dont_know' }), 'again_dont_know');
  assert.equal(reason({ result: 'almost', ms: 1000 }), 'hard_almost');
  assert.equal(reason({ result: 'correct', ms: 1000, hint: true }), 'hard_hint');
  assert.equal(reason({ result: 'correct', ms: 18001 }), 'hard_slow');
  assert.equal(reason({ result: 'correct', ms: 10000 }), 'good_normal');
  assert.equal(reason({ result: 'correct', ms: 5999 }), 'easy_fast');
  // bordes exactos: ni 1,8 × ni 0,6 × cambian de nivel
  assert.equal(rate({ result: 'correct', ms: 18000 }, BASE), 3);
  assert.equal(rate({ result: 'correct', ms: 6000 }, BASE), 3);
  assert.equal(rate({ result: 'correct', ms: 50000 }, BASE), 2, 'a 5 × exactos todavía se lee (lento: Hard); solo MÁS de 5 × se ignora');
  assert.equal(rate({ result: 'correct', ms: 50001 }, BASE), 3);
});

test('CA-1: lo mismo por el puente completo (gradeAnswer) — rating, evento válido y tarjeta programada', () => {
  let n = 0;
  for (const result of RESULTS) for (const hint of [false, true]) for (const dontKnow of [false, true]) for (const interrupted of [false, true]) {
    for (const ms of [1, 5999, 6000, 18000, 18001, 50001, undefined]) {
      const answer = { result, ms, hint, dontKnow, interrupted };
      const g = gradeAnswer({ answer, card: fresh(), srs, now: NOW, exerciseType: TYPE, baselineMs: BASE });
      assert.equal(g.rating, oracle(answer, BASE), JSON.stringify(answer));
      assert.equal(g.event.rating, g.rating);
      assert.equal(validateEvent(g.event).ok, true);
      assert.equal(g.scheduled, true);
      n += 1;
    }
  }
  assert.equal(n, 5 * 2 * 2 * 2 * 7);
});

test('CA-2: pestaña oculta o tiempo extremo NO bajan el rating — con el cronómetro de verdad', () => {
  const clock = makeClock('2026-10-20T15:00:00.000Z');
  let hidden = false; const subs = new Set();
  const visibility = { hidden: () => hidden, onChange: (fn) => { subs.add(fn); return () => subs.delete(fn); } };
  const setHidden = (v) => { hidden = v; for (const f of [...subs]) f(); };
  const timer = createAnswerTimer({ clock, visibility });

  // La persona contesta bien a los 4 s, pero se fue 60 s a otra pestaña. Con reloj de pared serían 64 s (> 5 × la mediana).
  timer.start(); clock.advance(2000); setHidden(true); clock.advance(60000); setHidden(false); clock.advance(2000);
  const t = timer.stop();
  assert.equal(t.ms, 4000); assert.equal(t.hiddenMs, 60000); assert.equal(t.interrupted, true);
  const wall = t.ms + t.hiddenMs;
  assert.equal(rate({ result: 'correct', ms: wall }, BASE), 3, 'sin el cronómetro, el tiempo de pared (> 5 ×) ya se ignoraba: Good, nunca Hard');
  assert.equal(rate({ result: 'correct', ms: t.ms, interrupted: t.interrupted }, BASE), 3, 'con el cronómetro: Good');

  // Ni la pausa larga ni el tiempo extremo bajan a Hard una respuesta correcta sin pista; y no tocan Again/Hard que vienen de otra causa.
  for (const result of RESULTS) for (const hint of [false, true]) {
    const normal = oracle({ result, hint, ms: BASE }, BASE); // lectura sin distracción
    for (const input of [{ interrupted: true, ms: 1000 }, { interrupted: true, ms: 90000 }, { ms: 50001 }, { ms: 3600000 }]) {
      const r = rate({ result, hint, ...input }, BASE);
      if (result === 'correct' && !hint) assert.equal(r, 3, `Good: ${JSON.stringify(input)}`);
      else assert.equal(r, normal, `igual que sin distracción: ${result} ${hint} ${JSON.stringify(input)}`);
    }
  }
});

test('CA-2: un vistazo corto (≤ 3 s) se descuenta pero no interrumpe: el tiempo SÍ cuenta, sin los segundos de la otra pestaña', () => {
  const clock = makeClock('2026-10-20T15:00:00.000Z');
  let hidden = false; const subs = new Set();
  const visibility = { hidden: () => hidden, onChange: (fn) => { subs.add(fn); return () => subs.delete(fn); } };
  const timer = createAnswerTimer({ clock, visibility });
  timer.start(); clock.advance(4000); hidden = true; subs.forEach((f) => f()); clock.advance(3000); hidden = false; subs.forEach((f) => f()); clock.advance(1000);
  const t = timer.stop();
  assert.deepEqual(t, { ms: 5000, hiddenMs: 3000, interrupted: false });
  assert.equal(rate({ result: 'correct', ms: t.ms, interrupted: t.interrupted }, BASE), 4, '5 s < 6 s (0,6 × mediana): Easy; los 3 s fuera no la hicieron «lenta»');
});

test('CA-3: con menos de 8 datos usa constantes; con 8 usa la mediana personal (base de datos real en memoria)', async () => {
  const clock = makeClock('2026-10-20T10:00:00.000Z'); const db = createMemoryDb(); await db.open();
  const events = createEvents({ db, clock, rng: makeRng(21) });
  const log = (over = {}) => events.log({
    type: 'answer', itemId: 'g.pp.0001', cardId: 'g.pp.0001#0', topics: ['gram.x'], exerciseType: TYPE, result: 'correct', rating: 3, ms: 1000,
    mode: 'mech', channel: 'keyboard', ...over,
  });
  // 7 correctas rápidas (1 s) + muchas respuestas que NO cuentan como muestra: errores, «no sé», con pista, casi, sin tiempo.
  for (let i = 0; i < 7; i += 1) { await log(); clock.advance(60000); }
  for (const over of [{ result: 'wrong', rating: 1 }, { result: 'dont_know', rating: 1, dontKnow: true }, { hint: true }, { result: 'almost', rating: 2 }, { ms: null }]) { await log(over); clock.advance(60000); }
  let b = await loadBaselines({ events, now: clock.now() });
  assert.deepEqual(b.forType(TYPE), { ms: defaultBaselineMs(TYPE), source: 'default', samples: 7 });
  const answer = { result: 'correct', ms: 2000 };
  assert.equal(gradeAnswer({ answer, card: fresh(), srs, now: NOW, exerciseType: TYPE, baselines: b }).rating, 4, 'con 7 datos: 2 s contra la constante de 12 s es rápido (Easy)');

  await log(); clock.advance(60000); // la 8.ª correcta
  b = await loadBaselines({ events, now: clock.now() });
  assert.deepEqual(b.forType(TYPE), { ms: 1000, source: 'personal', samples: 8 });
  assert.equal(gradeAnswer({ answer, card: fresh(), srs, now: NOW, exerciseType: TYPE, baselines: b }).rating, 2, 'con 8 datos: 2 s contra su mediana de 1 s es lento (Hard)');

  // sin ningún dato, y tipo desconocido: constantes (familia o constante general), sin lanzar
  assert.equal(baselineFor(TYPE, []).source, 'default');
  assert.equal(baselineFor('tipo_que_no_existe', []).ms, defaultBaselineMs('tipo_que_no_existe'));
  assert.equal(defaultBaselineMs('tipo_que_no_existe'), 12000);
  assert.equal(defaultBaselineMs('mcq_en_es'), 6000);
});

test('CA-4: «no sé» = Again (1) siempre, por rate, rateDetailed y el puente; ni el tiempo, la pista ni la pausa lo cambian', () => {
  let n = 0;
  for (const shape of [{ result: 'dont_know' }, { result: 'correct', dontKnow: true }, { result: 'almost', dontKnow: true }, { result: 'dont_know', dontKnow: true }]) {
    for (const hint of [false, true]) for (const interrupted of [false, true]) for (const ms of TIMES) for (const base of [1, 3000, BASE, 600000]) {
      const input = { ...shape, hint, interrupted, ms };
      assert.equal(rate(input, base), 1, JSON.stringify(input));
      assert.equal(rateDetailed(input, base).reason, 'again_dont_know');
      n += 1;
    }
  }
  assert.ok(n > 1000);
  for (const shape of [{ result: 'dont_know' }, { result: 'correct', dontKnow: true }]) {
    const g = gradeAnswer({ answer: { ...shape, ms: 1, hint: true }, card: fresh(), srs, now: NOW, exerciseType: TYPE, baselineMs: BASE });
    assert.equal(g.rating, 1);
    assert.equal(g.event.result, 'dont_know'); assert.equal(g.event.dontKnow, true); assert.equal(g.event.rating, 1);
    assert.equal(validateEvent(g.event).ok, true);
    assert.equal(g.card.lapses ?? 0, 0, 'el primer «Otra vez» de una tarjeta nueva no suma lapses (1.4)');
  }
  // y el botón manual «Otra vez» también es 1
  assert.equal(gradeManual({ rating: 1, card: fresh(), srs, now: NOW, exerciseType: TYPE }).rating, 1);
});

test('Recorrido completo: cronómetro → mediana → gradeAnswer → events.log → la mediana aprende de la respuesta', async () => {
  const clock = makeClock('2026-10-20T10:00:00.000Z'); const db = createMemoryDb(); await db.open();
  const events = createEvents({ db, clock, rng: makeRng(33) });
  const timer = createAnswerTimer({ clock });
  let card = fresh();
  for (let i = 0; i < 8; i += 1) {
    const baselines = await loadBaselines({ events, now: clock.now() });
    timer.start(); clock.advance(4000 + i * 100); const t = timer.stop();
    const g = gradeAnswer({ answer: { result: 'correct', ms: t.ms, interrupted: t.interrupted }, card, srs, now: clock.now(), exerciseType: TYPE, baselines });
    assert.equal(g.event.ms, 4000 + i * 100);
    await events.log(g.event); card = g.card; clock.advance(60000);
  }
  const after = await loadBaselines({ events, now: clock.now() });
  assert.deepEqual(after.forType(TYPE), { ms: 4350, source: 'personal', samples: 8 });
  assert.equal(card.itemId, 'g.pp.0001'); assert.equal(card.reps, 8, 'la tarjeta pasó por 8 repasos programados');
});
