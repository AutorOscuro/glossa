// @purpose: Pruebas de las señales R, P y E del dominio por tema (core/masterySignals.js) con resultados calculados a mano.
// 1.7-T1: señales R, P y E del dominio por tema. Casos con resultado calculado a mano; sin leer la lógica que se prueba.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { signalR, signalP, signalE, isProduction } from '../core/masterySignals.js';
import { MASTERY_CONFIG, WEIGHTS, BANDS } from '../core/mastery.config.js';
import { newCard, review, retrievability, RATING } from '../core/srs.js';
import { createErrors } from '../core/errors.js';
import { createErrorCatalog } from '../core/errorCatalog.js';
import { createMemoryDb } from '../core/db.memory.js';
import { makeClock } from './_helpers.mjs';

const NOW = new Date('2026-10-20T12:00:00.000Z');
const DAY = 86400000;
const ago = (days) => new Date(NOW.getTime() - days * DAY).toISOString();
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);
const TOPIC = 'gram.present_perfect.for_since';
const ev = (o = {}) => ({ type: 'answer', ts: ago(0), topics: [TOPIC], exerciseType: 'fix_error', result: 'correct', ...o });

// ---------- configuración ----------
test('config: los pesos suman 1 y son los de 8.7; las bandas cubren 0–100 sin huecos ni solapes', () => {
  assert.deepEqual({ ...WEIGHTS }, { R: 0.35, P: 0.30, U: 0.20, E: 0.15 });
  close(Object.values(WEIGHTS).reduce((a, b) => a + b, 0), 1);
  assert.deepEqual(BANDS.map((b) => [b.min, b.max]), [[0, 0], [1, 29], [30, 59], [60, 84], [85, 100]]);
  assert.deepEqual(BANDS.map((b) => b.label), ['Sin ver', 'Inicial', 'En progreso', 'Sólido', 'Dominado']);
  assert.deepEqual(BANDS.map((b) => b.symbol), ['○', '◔', '◑', '◕', '●']);
  assert.ok(Object.isFrozen(MASTERY_CONFIG) && Object.isFrozen(WEIGHTS) && Object.isFrozen(BANDS) && Object.isFrozen(BANDS[0]));
});

// ---------- R ----------
const fake = (map) => (card) => map[card.id];
const rc = (id, reps = 1) => ({ ...newCard(id, 0, NOW), reps });

test('R: sin tarjetas, o solo nuevas (0 repasos) → null', () => {
  assert.deepEqual(signalR([], NOW, { retrievability: fake({}) }), { value: null, cards: 0, ignored: 0, failed: 0 });
  assert.equal(signalR([rc('a#0', 0)], NOW, { retrievability: () => 1 }).value, null);
});

test('R (FIX 2.9-T4): una tarjeta cuyo último resultado fue fallo aporta 0 hasta que acierte; acertar, omitir o no tener intentos no la toca', () => {
  const last = { 'a#0': 'wrong', 'b#0': 'dont_know', 'c#0': 'correct', 'd#0': 'almost' };
  const out = signalR([rc('a'), rc('b'), rc('c'), rc('d'), rc('e')], NOW, { retrievability: () => 1, lastResult: (c) => last[c.id] });
  close(out.value, 3 / 5); // c, d y e (sin intentos) valen 1; a y b valen 0
  assert.deepEqual([out.cards, out.failed], [5, 2]);
  const noFn = signalR([rc('a')], NOW, { retrievability: () => 1 });
  assert.deepEqual([noFn.value, noFn.failed], [1, 0]); // sin `lastResult` el cálculo es el de siempre
  const off = signalR([rc('a')], NOW, { retrievability: () => 1, lastResult: () => 'wrong', config: { ...MASTERY_CONFIG, R: { ...MASTERY_CONFIG.R, zeroAfterFail: false } } });
  assert.deepEqual([off.value, off.failed], [1, 0]); // la constante apaga la regla
  assert.equal(signalR([rc('a', 0)], NOW, { retrievability: () => 1, lastResult: () => 'wrong' }).value, null); // una tarjeta nueva sigue sin contar
  assert.throws(() => signalR([rc('a')], NOW, { retrievability: () => 1, lastResult: 'x' }), /lastResult/);
});

test('R: media de la retrievabilidad de las tarjetas repasadas (0,8 y 0,4 → 0,6) e ignora las nuevas', () => {
  const out = signalR([rc('a'), rc('b'), rc('c', 0)], NOW, { retrievability: (c) => ({ 'a#0': 0.8, 'b#0': 0.4, 'c#0': 0 })[c.id] });
  close(out.value, 0.6);
  assert.equal(out.cards, 2);
});

test('R: una retrievabilidad fuera de rango se recorta y una no numérica cuenta 0', () => {
  close(signalR([rc('a'), rc('b')], NOW, { retrievability: (c) => (c.id === 'a#0' ? 7 : -3) }).value, 0.5);
  close(signalR([rc('a')], NOW, { retrievability: () => NaN }).value, 0);
});

test('R: elementos ilegibles se ignoran y se cuentan; entradas incorrectas lanzan', () => {
  const out = signalR([null, 5, { reps: 'x' }, rc('a')], NOW, { retrievability: () => 0.5 });
  assert.equal(out.ignored, 3);
  close(out.value, 0.5);
  assert.throws(() => signalR('x', NOW, { retrievability: () => 1 }), /lista/);
  assert.throws(() => signalR([], NOW, {}), /retrievability/);
  assert.throws(() => signalR([], 'no-fecha', { retrievability: () => 1 }), /now/);
});

test('R con el motor FSRS real: tras un repaso «Good», justo al pasar `stability` días la retención es ≈ 0,9 y antes es mayor', () => {
  const card = review(newCard('x', 0, NOW), RATING.GOOD, NOW);
  assert.equal(card.reps, 1);
  const r0 = signalR([card], NOW, { retrievability }).value;
  const at = new Date(NOW.getTime() + card.stability * DAY);
  const rS = signalR([card], at, { retrievability }).value;
  const rLate = signalR([card], new Date(NOW.getTime() + 5 * card.stability * DAY), { retrievability }).value;
  assert.ok(r0 > 0.99, `r0=${r0}`);
  assert.ok(Math.abs(rS - 0.9) < 0.01, `rS=${rS}`);
  assert.ok(rLate < rS && rS < r0, 'la retención baja con el tiempo');
});

// ---------- P ----------
test('P: sin eventos, o solo de reconocimiento → null', () => {
  assert.deepEqual(signalP([], TOPIC, NOW), { value: null, attempts: 0, ignored: 0 });
  assert.equal(signalP([ev({ exerciseType: 'mcq_en_es' }), ev({ exerciseType: 'choose_correct' })], TOPIC, NOW).value, null);
});

test('P: mismo instante, 1 acierto y 1 fallo → 0,5; todos aciertos → 1; todos fallos → 0', () => {
  close(signalP([ev(), ev({ result: 'wrong' })], TOPIC, NOW).value, 0.5);
  assert.equal(signalP([ev(), ev()], TOPIC, NOW).value, 1);
  assert.equal(signalP([ev({ result: 'wrong' }), ev({ result: 'dont_know' })], TOPIC, NOW).value, 0);
});

test('P: lo reciente pesa más (vida media 10 días): fallo hace 25 días + acierto hoy = 1 / (1 + 0,5^2,5)', () => {
  const w = 0.5 ** 2.5;
  close(signalP([ev({ ts: ago(25), result: 'wrong' }), ev()], TOPIC, NOW).value, 1 / (1 + w));
  close(signalP([ev({ ts: ago(25) }), ev({ result: 'wrong' })], TOPIC, NOW).value, w / (1 + w));
  close(signalP([ev({ ts: ago(10), result: 'wrong' }), ev()], TOPIC, NOW).value, 1 / 1.5); // 10 días = una vida media
});

test('P: ventana de 30 días (el borde entra, un instante antes no), sin futuro, sin otro tema y sin tipos que no son intento', () => {
  assert.equal(signalP([ev({ ts: ago(30) })], TOPIC, NOW).attempts, 1);
  assert.equal(signalP([ev({ ts: new Date(NOW.getTime() - 30 * DAY - 1).toISOString() })], TOPIC, NOW).attempts, 0);
  assert.equal(signalP([ev({ ts: new Date(NOW.getTime() + 1).toISOString() })], TOPIC, NOW).attempts, 0);
  assert.equal(signalP([ev({ topics: ['otro.tema'] })], TOPIC, NOW).attempts, 0);
  assert.equal(signalP([ev({ result: 'skipped' })], TOPIC, NOW).attempts, 0);
  assert.equal(signalP([ev({ type: 'note' }), ev({ type: 'tap_word' })], TOPIC, NOW).attempts, 0);
  assert.equal(signalP([ev({ topics: 'x' }), ev({ exerciseType: 'no_existe' })], TOPIC, NOW).attempts, 0);
});

test('P: `almost` vale como acierto (8.5); un evento con varios temas cuenta en cada uno', () => {
  assert.equal(signalP([ev({ result: 'almost' })], TOPIC, NOW).value, 1);
  const multi = ev({ topics: [TOPIC, 'gram.past_simple.regular'], result: 'wrong' });
  assert.equal(signalP([multi], 'gram.past_simple.regular', NOW).value, 0);
  assert.equal(signalP([multi], TOPIC, NOW).value, 0);
});

test('P: qué es producción — escribir o hablar sí; elegir, ordenar, emparejar, leer y escuchar no', () => {
  for (const t of ['fix_error', 'transform', 'fill_verb', 'translate_word', 'three_forms', 'keyword_transform', 'phrase_cloze',
    'read_aloud_score', 'echo_repeat', 'write_email', 'med_summarize', 'translate_free', 'own_sentence_word']) assert.equal(isProduction(t), true, t);
  for (const t of ['mcq_en_es', 'choose_correct', 'prep_pick', 'order_blocks', 'match_pairs', 'cloze_bank', 'read_tfng', 'dictation', 'minimal_pair_listen', 'x', '', null, undefined, 5]) {
    assert.equal(isProduction(t), false, String(t));
  }
});

test('P: eventos ilegibles se ignoran y se cuentan; entradas incorrectas lanzan', () => {
  const out = signalP([null, { type: 'answer' }, ev({ ts: 'basura' }), ev()], TOPIC, NOW);
  assert.equal(out.ignored, 3);
  assert.equal(out.value, 1);
  assert.throws(() => signalP({}, TOPIC, NOW), /lista/);
  assert.throws(() => signalP([], '', NOW), /topicId/);
  assert.throws(() => signalP([], TOPIC, 'x'), /now/);
});

test('P: más aciertos nunca bajan P (monotonía) en una secuencia fija de eventos', () => {
  const base = [ev({ ts: ago(3), result: 'wrong' }), ev({ ts: ago(2), result: 'wrong' }), ev({ ts: ago(1) })];
  let prev = signalP(base, TOPIC, NOW).value;
  for (let i = 0; i < 6; i += 1) {
    base.push(ev({ ts: ago(0.5 - i * 0.01) }));
    const now = signalP(base, TOPIC, NOW).value;
    assert.ok(now >= prev - 1e-12, `${now} < ${prev}`);
    prev = now;
  }
});

// ---------- E ----------
test('E: sin reincidencia → 0 (no null)', () => {
  assert.deepEqual(signalE([]), { value: 0, codes: [] });
});

test('E: un código con 3, 4, 5, 6 y 10 veces en la ventana → 0,25 · 0,5 · 0,75 · 1 · 1 (tope)', () => {
  for (const [n, e] of [[3, 0.25], [4, 0.5], [5, 0.75], [6, 1], [10, 1]]) close(signalE([{ code: 'TNS.SINCE_FOR', inWindow: n }]).value, e);
});

test('E: varios códigos se unen como probabilidades (3 y 4 veces → 1 − 0,75·0,5 = 0,625) y nunca pasan de 1', () => {
  const out = signalE([{ code: 'A', inWindow: 3 }, { code: 'B', inWindow: 4 }]);
  close(out.value, 0.625);
  assert.deepEqual(out.codes.map((c) => c.code), ['A', 'B']);
  assert.ok(signalE([{ code: 'A', inWindow: 9 }, { code: 'B', inWindow: 9 }]).value <= 1);
});

test('E: monotonía — un código más, o una vez más, nunca baja E', () => {
  let prev = 0;
  for (let n = 3; n <= 8; n += 1) { const v = signalE([{ code: 'A', inWindow: n }]).value; assert.ok(v >= prev); prev = v; }
  assert.ok(signalE([{ code: 'A', inWindow: 3 }, { code: 'B', inWindow: 3 }]).value > signalE([{ code: 'A', inWindow: 3 }]).value);
});

test('E: filas dañadas o por debajo de la regla (< 3 veces) no aportan; lo que no es lista lanza', () => {
  assert.equal(signalE([null, 4, { code: 'A' }, { code: 'A', inWindow: 2 }, { code: 7, inWindow: 5 }, { code: 'A', inWindow: 3.5 }]).value, 0);
  assert.throws(() => signalE(null), /lista/);
});

test('E con el registro real (memoria): 3 veces el mismo código en 14 días → recurrente → E = 0,25; 2 veces → 0', async () => {
  const catalog = createErrorCatalog(JSON.parse(fs.readFileSync(new URL('../content/taxonomy/error_codes.json', import.meta.url), 'utf8')));
  const db = createMemoryDb();
  await db.open();
  const errors = createErrors({ db, catalog, clock: makeClock(NOW.toISOString()) });
  const rec = (days, original) => errors.record({ original, code: 'TNS.SINCE_FOR', topics: [TOPIC], ts: ago(days) });
  await rec(5, 'I live here since 2010');
  await rec(3, 'I live here since 2010');
  const two = await errors.recurrent({ by: 'code', topic: TOPIC, now: NOW });
  assert.equal(signalE(two).value, 0);
  await rec(1, 'I live here since 2010');
  const three = await errors.recurrent({ by: 'code', topic: TOPIC, now: NOW });
  close(signalE(three).value, 0.25);
  await rec(20, 'I live here since 2010'); // fuera de la ventana de 14 días: no cambia nada
  close(signalE(await errors.recurrent({ by: 'code', topic: TOPIC, now: NOW })).value, 0.25);
  assert.equal(signalE(await errors.recurrent({ by: 'code', topic: 'otro.tema', now: NOW })).value, 0);
});

// ---------- huecos cerrados tras las roturas de 1.7-T1 ----------
test('R: `reps` no entero (2,5 · NaN · texto) es un dato ilegible: se ignora', () => {
  const bad = [{ ...rc('a'), reps: 2.5 }, { ...rc('b'), reps: NaN }, { ...rc('c'), reps: '3' }];
  const out = signalR(bad, NOW, { retrievability: () => 1 });
  assert.equal(out.ignored, 3);
  assert.equal(out.value, null);
});

test('P: `topics` que no es lista (número, null, objeto) no lanza y no cuenta', () => {
  const out = signalP([ev({ topics: 5 }), ev({ topics: null }), ev({ topics: {} }), ev()], TOPIC, NOW);
  assert.equal(out.attempts, 1);
});

test('E: con 2 veces el código no aparece en `codes`; con 10 veces su aporte queda en 1 (no pasa de 1)', () => {
  assert.deepEqual(signalE([{ code: 'A', inWindow: 2 }]).codes, []);
  assert.deepEqual(signalE([{ code: 'A', inWindow: 10 }]).codes, [{ code: 'A', inWindow: 10, contribution: 1 }]);
});
