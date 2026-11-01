// @purpose: Pruebas de core/masteryBoard.js: caché por tema (acierto, fallo tras un evento, tarjeta o día nuevo), invalidación y consultas con datos reales.
// 1.7-T3: tablero con caché. Se prueba con un dominio de mentira (para contar cálculos y cortar carreras) y con el dominio real sobre la base en memoria.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createMasteryBoard } from '../core/masteryBoard.js';
import { MASTERY_CONFIG } from '../core/mastery.config.js';
import { createMastery } from '../core/mastery.js';
import { aggregate, atRisk, toStudy } from '../core/masteryAgg.js';
import { createEvents } from '../core/events.js';
import { createErrors } from '../core/errors.js';
import { createErrorCatalog } from '../core/errorCatalog.js';
import { createSrs } from '../core/srsEngine.js';
import { RATING } from '../core/srs.js';
import { createMemoryDb } from '../core/db.memory.js';
import { makeClock } from './_helpers.mjs';

const NOW = new Date('2026-10-20T12:00:00.000Z');
const HOUR = 3600000;
const DAY = 86400000;
const plus = (ms) => new Date(NOW.getTime() + ms);
const CATALOG = createErrorCatalog(JSON.parse(fs.readFileSync(new URL('../content/taxonomy/error_codes.json', import.meta.url), 'utf8')));

// Dominio de mentira: cuenta los cálculos y devuelve lo que diga `state`.
function stubWorld() {
  const state = { cards: [], pct: 10, calls: [], gate: null };
  const mastery = {
    async compute(topicId, at) {
      state.calls.push([topicId, at]);
      if (state.gate) await state.gate;
      return { topicId, pct: state.pct, evidence: 1, band: 'initial', confidence: 'low', caps: [], signals: { R: 0.9, P: null, U: null, E: 0 }, detail: { R: { cards: [{ id: 'c' }] } } };
    },
  };
  const db = { async query(store, opts) { assert.deepEqual([store, opts.index], ['cards', 'topics']); return state.cards.filter((c) => c.topics.includes(opts.value)); } };
  const board = createMasteryBoard({ mastery, db, clock: { now: () => NOW } });
  return { state, board };
}
const card = (id, extra = {}) => ({ id, topics: ['t1'], due: '2026-10-21T00:00:00.000Z', reps: 1, lapses: 0, suspended: false, stability: 3, last_review: '2026-10-20T00:00:00.000Z', ...extra });

// ---------- caché ----------
test('get: la primera vez calcula (fallo) y la segunda sale de la caché (acierto), con el mismo objeto inmutable', async () => {
  const { state, board } = stubWorld();
  const a = await board.get('t1');
  const b = await board.get('t1');
  assert.equal(a, b);
  assert.equal(state.calls.length, 1);
  assert.deepEqual(board.stats(), { hits: 1, misses: 1, size: 1 });
  assert.ok(Object.isFrozen(a) && Object.isFrozen(a.signals) && Object.isFrozen(a.detail.R.cards[0]));
  assert.throws(() => { a.pct = 99; }, TypeError);
  assert.equal(a.pct, 10);
});

test('get: cada tema tiene su propia entrada', async () => {
  const { state, board } = stubWorld();
  await board.get('t1');
  await board.get('t2');
  await board.get('t1');
  assert.deepEqual(state.calls.map((c) => c[0]), ['t1', 't2']);
  assert.equal(board.stats().size, 2);
});

test('get: el mismo día local sigue valiendo y otro día recalcula (R decae con el tiempo)', async () => {
  const { state, board } = stubWorld();
  await board.get('t1', NOW);
  await board.get('t1', plus(HOUR));
  assert.equal(state.calls.length, 1);
  await board.get('t1', plus(2 * DAY));
  assert.equal(state.calls.length, 2);
  assert.equal(state.calls[1][1].getTime(), plus(2 * DAY).getTime());
  await board.get('t1', plus(2 * DAY + HOUR));
  assert.equal(state.calls.length, 2);
});

test('get: pasa a compute el `now` indicado, o el del reloj si no hay', async () => {
  const { state, board } = stubWorld();
  await board.get('t1');
  assert.equal(state.calls[0][1].getTime(), NOW.getTime());
  await board.get('t2', '2026-10-25T08:00:00.000Z');
  assert.equal(state.calls[1][1].toISOString(), '2026-10-25T08:00:00.000Z');
  await board.get('t3', plus(3 * DAY).getTime());
  assert.equal(state.calls[2][1].getTime(), plus(3 * DAY).getTime());
});

test('get: repasar o suspender una tarjeta del tema (cambia la firma) recalcula sin pasar por `log`', async () => {
  const { state, board } = stubWorld();
  state.cards = [card('a#0'), card('b#0')];
  await board.get('t1');
  await board.get('t1');
  assert.equal(state.calls.length, 1);
  state.cards = [card('a#0', { reps: 2 }), card('b#0')];
  await board.get('t1');
  assert.equal(state.calls.length, 2);
  state.cards = [card('a#0', { reps: 2 }), card('b#0', { suspended: true })];
  await board.get('t1');
  assert.equal(state.calls.length, 3);
  state.cards = [card('a#0', { reps: 2 }), card('b#0', { suspended: true }), card('c#0')];
  await board.get('t1');
  assert.equal(state.calls.length, 4);
  state.cards = [card('a#0', { reps: 2, due: '2026-11-01T00:00:00.000Z' }), card('b#0', { suspended: true }), card('c#0')];
  await board.get('t1');
  assert.equal(state.calls.length, 5);
  state.cards = state.cards.slice().reverse(); // el mismo conjunto en otro orden no cambia nada
  await board.get('t1');
  assert.equal(state.calls.length, 5);
});

test('invalidate: un id, una lista o todo; los demás temas siguen en caché', async () => {
  const { state, board } = stubWorld();
  for (const id of ['t1', 't2', 't3']) await board.get(id);
  board.invalidate('t1');
  await board.get('t1'); await board.get('t2'); await board.get('t3');
  assert.equal(state.calls.length, 4);
  board.invalidate(['t2', 't3']);
  await board.get('t1'); await board.get('t2'); await board.get('t3');
  assert.equal(state.calls.length, 6);
  board.invalidate();
  assert.equal(board.stats().size, 0);
  for (const id of ['t1', 't2', 't3']) await board.get(id);
  assert.equal(state.calls.length, 9);
  board.invalidate([]);
  board.invalidate('nunca-visto');
  assert.equal(board.stats().size, 3);
});

test('invalidate: argumentos inválidos lanzan', () => {
  const { board } = stubWorld();
  assert.throws(() => board.invalidate(''), /invalidate espera/);
  assert.throws(() => board.invalidate(['a', '']), /invalidate espera/);
  assert.throws(() => board.invalidate([1]), /invalidate espera/);
  assert.throws(() => board.invalidate(7), /invalidate espera/);
  assert.throws(() => board.invalidate(null), /invalidate espera/);
});

test('un cálculo en curso cuando se invalida no se guarda (ni el tema ni «todo»)', async () => {
  for (const how of [(b) => b.invalidate('t1'), (b) => b.invalidate(['t1', 'x']), (b) => b.invalidate()]) {
    const { state, board } = stubWorld();
    let open;
    state.gate = new Promise((r) => { open = r; });
    const pending = board.get('t1');
    await new Promise((r) => setTimeout(r, 5));
    how(board);
    state.gate = null;
    open();
    const first = await pending;
    assert.equal(first.pct, 10);
    assert.equal(board.stats().size, 0);
    await board.get('t1');
    assert.equal(state.calls.length, 2);
  }
});

test('invalidar otro tema no descarta el cálculo en curso', async () => {
  const { state, board } = stubWorld();
  let open;
  state.gate = new Promise((r) => { open = r; });
  const pending = board.get('t1');
  await new Promise((r) => setTimeout(r, 5));
  board.invalidate('otro');
  open();
  await pending;
  assert.equal(board.stats().size, 1);
});

// ---------- wrapEvents ----------
test('wrapEvents: cada `log` invalida los temas del evento y solo esos', async () => {
  const { state, board } = stubWorld();
  const logged = [];
  const raw = { async log(ev) { logged.push(ev); return { ...ev, id: 'e1' }; }, async byTopic() { return []; } };
  const events = board.wrapEvents(raw);
  for (const id of ['t1', 't2', 't3']) await board.get(id);
  const saved = await events.log({ type: 'answer', topics: ['t1', 't3'] });
  assert.equal(saved.id, 'e1');
  assert.equal(logged.length, 1);
  await board.get('t1'); await board.get('t2'); await board.get('t3');
  assert.deepEqual(state.calls.map((c) => c[0]), ['t1', 't2', 't3', 't1', 't3']);
});

test('wrapEvents: copia congelada que conserva las demás funciones; si `log` falla no invalida', async () => {
  const { state, board } = stubWorld();
  const raw = { async log() { throw new Error('no se pudo'); }, async byTopic() { return ['x']; }, extra: 7 };
  const events = board.wrapEvents(raw);
  assert.ok(Object.isFrozen(events));
  assert.equal(events.extra, 7);
  assert.deepEqual(await events.byTopic('t1'), ['x']);
  await board.get('t1');
  await assert.rejects(() => events.log({ topics: ['t1'] }), /no se pudo/);
  await board.get('t1');
  assert.equal(state.calls.length, 1);
});

test('wrapEvents: un evento sin temas no invalida nada; sin `log` lanza', async () => {
  const { state, board } = stubWorld();
  const events = board.wrapEvents({ async log(ev) { return ev; } });
  await board.get('t1');
  await events.log({ type: 'session_start' });
  await events.log({ type: 'note', topics: [] });
  await events.log({ type: 'note', topics: 'no-es-lista' });
  await board.get('t1');
  assert.equal(state.calls.length, 1);
  assert.throws(() => board.wrapEvents({}), /wrapEvents necesita/);
  assert.throws(() => board.wrapEvents(null), /wrapEvents necesita/);
});

// ---------- results y consultas ----------
test('results: un solo `now` para todos, ids repetidos se calculan una vez y se devuelve un Map', async () => {
  const { state, board } = stubWorld();
  const out = await board.results([{ id: 't1' }, { id: 't2' }, { id: 't1' }], plus(DAY));
  assert.ok(out instanceof Map);
  assert.deepEqual([...out.keys()], ['t1', 't2']);
  assert.equal(state.calls.length, 2);
  assert.deepEqual(board.stats(), { hits: 0, misses: 2, size: 2 }); // el id repetido ni siquiera se vuelve a mirar
  assert.equal(state.calls[0][1], state.calls[1][1]);
  assert.deepEqual(await board.results([]), new Map());
});

test('entradas inválidas lanzan en español', async () => {
  const { board } = stubWorld();
  await assert.rejects(() => board.get(''), /topicId debe ser/);
  await assert.rejects(() => board.get(3), /topicId debe ser/);
  await assert.rejects(() => board.get('t1', 'no-es-fecha'), /now debe ser una fecha/);
  await assert.rejects(() => board.get('t1', null), /now debe ser una fecha/);
  await assert.rejects(() => board.results([{ id: 't1' }], 'no-es-fecha'), /now debe ser una fecha/);
  await assert.rejects(() => board.results('x'), /topics debe ser una lista/);
  await assert.rejects(() => board.results([{ id: '' }]), /cada tema/);
  await assert.rejects(() => board.results([null]), /cada tema/);
  await assert.rejects(() => board.byLevel(null), /topics debe ser una lista/);
  await assert.rejects(() => board.atRisk([{ nada: 1 }]), /cada tema/);
});

test('createMasteryBoard: exige dominio, base y reloj válidos', () => {
  const m = { compute() {} };
  const d = { query() {} };
  assert.throws(() => createMasteryBoard(), /falta el dominio/);
  assert.throws(() => createMasteryBoard({ mastery: {}, db: d }), /falta el dominio/);
  assert.throws(() => createMasteryBoard({ mastery: m }), /falta la base/);
  assert.throws(() => createMasteryBoard({ mastery: m, db: {} }), /falta la base/);
  assert.throws(() => createMasteryBoard({ mastery: m, db: d, clock: {} }), /reloj no válido/);
  assert.throws(() => createMasteryBoard({ mastery: m, db: d, clock: null }), /reloj no válido/);
  assert.ok(Object.isFrozen(createMasteryBoard({ mastery: m, db: d })));
});

// ---------- con el dominio real ----------
async function realWorld() {
  const db = createMemoryDb();
  await db.open();
  const clock = makeClock(NOW.toISOString());
  const rawEvents = createEvents({ db, clock });
  const errors = createErrors({ db, catalog: CATALOG, clock });
  const srs = createSrs();
  const mastery = createMastery({ db, events: rawEvents, errors, srs, clock });
  const board = createMasteryBoard({ mastery, db, clock });
  return { db, srs, rawEvents, errors, mastery, board, events: board.wrapEvents(rawEvents) };
}
let n = 0;
function answer(topics, result = 'correct', extra = {}) {
  n += 1;
  return { ts: NOW.toISOString(), type: 'answer', sessionId: 's1', cardId: `it${n}#0`, itemId: `it${n}`, topics, exerciseType: 'fix_error', result, rating: result === 'correct' ? 3 : 1, ms: 5000, hint: false, dontKnow: result === 'dont_know', responseRaw: `r${n}`, errorCodes: [], mode: 'mech', channel: 'keyboard', ...extra };
}
const TOPICS = [
  { id: 'gram.a', area: 'gram', level: 'A1', priority: 2, min_items: 12, status: 'draft' },
  { id: 'gram.b', area: 'gram', level: 'A2', priority: 1, min_items: 12, status: 'draft' },
  { id: 'verb.c', area: 'verb', level: 'A2', priority: 3, min_items: 24, status: 'draft' },
];

test('real: sin eventos todo está «Sin ver» y todos los temas son «a estudiar»', async () => {
  const { board } = await realWorld();
  const lv = await board.byLevel(TOPICS);
  assert.deepEqual(lv.groups.map((g) => [g.key, g.pct, g.band, g.seen]), [['A1', 0, 'unseen', 0], ['A2', 0, 'unseen', 0]]);
  assert.deepEqual((await board.atRisk(TOPICS)), []);
  assert.deepEqual((await board.toStudy(TOPICS)).map((x) => x.topicId), ['gram.b', 'gram.a', 'verb.c']);
});

test('real: un evento nuevo cambia el resultado y la caché lo refleja solo si se registró con wrapEvents', async () => {
  const w = await realWorld();
  const before = await w.board.get('gram.a');
  assert.deepEqual([before.pct, before.evidence], [0, 0]);
  await w.rawEvents.log(answer(['gram.a'])); // sin avisar a la caché
  assert.equal((await w.board.get('gram.a')).evidence, 0, 'sin wrapEvents ni invalidate la caché no se entera (contrato)');
  await w.events.log(answer(['gram.a'])); // con wrapEvents
  const after = await w.board.get('gram.a');
  assert.equal(after.evidence, 2);
  assert.ok(after.pct >= 1);
  assert.deepEqual(w.board.stats().misses, 2);
  const again = await w.board.get('gram.a');
  assert.equal(again, after);
  assert.equal(w.board.stats().hits, 2); // la lectura rancia y esta
});

test('real: `invalidate` explícito recoge lo que no pasa por `log` (p. ej. un evento escrito a mano)', async () => {
  const w = await realWorld();
  await w.board.get('gram.a');
  await w.rawEvents.log(answer(['gram.a']));
  w.board.invalidate('gram.a');
  assert.equal((await w.board.get('gram.a')).evidence, 1);
});

test('real: guardar una tarjeta del tema recalcula aunque el evento no avisara', async () => {
  const w = await realWorld();
  await w.rawEvents.log(answer(['gram.a']));
  const first = await w.board.get('gram.a');
  assert.equal(first.signals.R, null);
  let c = w.srs.newCard('it#0', 0, NOW, ['gram.a']);
  c = w.srs.review(c, RATING.GOOD, NOW);
  await w.db.put('cards', c);
  const second = await w.board.get('gram.a');
  assert.equal(typeof second.signals.R, 'number');
  assert.equal(w.board.stats().misses, 2);
});

test('real: por nivel, por área, en riesgo y a estudiar coinciden con las funciones puras sobre cada tema', async () => {
  const w = await realWorld();
  for (let i = 0; i < 5; i += 1) await w.events.log(answer(['gram.a'])); // 5 respuestas y 5 ítems: el tope por evidencia (FIX 2.9-T4) no interviene
  for (let i = 0; i < 2; i += 1) await w.events.log(answer(['gram.b'], 'wrong', { cardId: 'same#0', itemId: 'same' }));
  const results = await w.board.results(TOPICS);
  assert.deepEqual(await w.board.byLevel(TOPICS), aggregate(TOPICS, results, { by: 'level' }));
  assert.deepEqual(await w.board.byArea(TOPICS), aggregate(TOPICS, results, { by: 'area' }));
  assert.deepEqual(await w.board.atRisk(TOPICS), atRisk(TOPICS, results));
  assert.deepEqual(await w.board.toStudy(TOPICS), toStudy(TOPICS, results));
  const area = await w.board.byArea(TOPICS);
  assert.deepEqual(area.groups.map((g) => [g.key, g.topics, g.seen]), [['gram', 2, 2], ['verb', 1, 0]]);
  // gram.b tiene dos fallos seguidos de la misma tarjeta: tope activo → en riesgo
  const risk = await w.board.atRisk(TOPICS);
  assert.deepEqual(risk.map((x) => [x.topicId, x.reasons.includes('cap')]), [['gram.b', true]]);
  // 5 aciertos de producción en 5 ítems dan 100 % en gram.a (sale de «a estudiar»); gram.b (con tope) y el no visto siguen dentro
  assert.equal(results.get('gram.a').band, 'mastered');
  assert.deepEqual((await w.board.toStudy(TOPICS)).map((x) => x.topicId), ['gram.b', 'verb.c']);
});

test('real: el % del nivel es la media ponderada de los % de sus temas', async () => {
  const w = await realWorld();
  for (let i = 0; i < 4; i += 1) await w.events.log(answer(['gram.b']));
  await w.events.log(answer(['verb.c']));
  const b = await w.board.get('gram.b');
  const c = await w.board.get('verb.c');
  const a2 = (await w.board.byLevel(TOPICS)).groups.find((g) => g.key === 'A2');
  const expected = (12 * b.pct + 24 * c.pct) / 36;
  assert.ok(Math.abs(a2.avg - expected) < 1e-9);
  assert.equal(a2.pct, Math.max(1, Math.round(expected)));
});

// ---------- endurecimiento tras la tanda de roturas (4.R) ----------
test('get: cada campo de la firma de la tarjeta recalcula por sí solo (id, due, reps, lapses, suspended, stability, last_review)', async () => {
  const { state, board } = stubWorld();
  const changes = [{ id: 'z#0' }, { due: '2026-11-02T00:00:00.000Z' }, { reps: 4 }, { lapses: 1 }, { suspended: true }, { stability: 9 }, { last_review: '2026-10-21T00:00:00.000Z' }];
  for (const extra of changes) {
    state.cards = [card('a#0')];
    await board.get('t1'); // la entrada vuelve a la tarjeta base
    const before = state.calls.length;
    state.cards = [card('a#0', extra)];
    await board.get('t1');
    assert.equal(state.calls.length, before + 1, JSON.stringify(extra));
    await board.get('t1');
    assert.equal(state.calls.length, before + 1, `${JSON.stringify(extra)} (segunda lectura)`);
  }
});

test('get: la firma no se confunde si el valor de un campo se desplaza a otro (reps 1 + lapses 12 ≠ reps 11 + lapses 2)', async () => {
  const { state, board } = stubWorld();
  state.cards = [card('a#0', { reps: 1, lapses: 12 })];
  await board.get('t1');
  state.cards = [card('a#0', { reps: 11, lapses: 2 })];
  await board.get('t1');
  assert.equal(state.calls.length, 2);
});

test('get: dos tarjetas no se confunden con una sola cuyo texto imita a las dos', async () => {
  const { state, board } = stubWorld();
  state.cards = [card('a#0'), card('b#0')];
  await board.get('t1');
  state.cards = [card('a#0', { last_review: '2026-10-20T00:00:00.000Z","b#0' })];
  await board.get('t1');
  assert.equal(state.calls.length, 2);
});

test('get: sin reloj inyectado usa la hora del sistema', async () => {
  const state = { at: null };
  const board = createMasteryBoard({ mastery: { async compute(id, at) { state.at = at; return { topicId: id, pct: 0, evidence: 0 }; } }, db: { async query() { return []; } } });
  const before = Date.now();
  await board.get('t1');
  assert.ok(state.at instanceof Date && state.at.getTime() >= before && state.at.getTime() <= Date.now());
});

test('get: el resultado de compute no se comparte con la caché (no se congela el original) y soporta referencias circulares', async () => {
  const mine = { topicId: 't1', pct: 5, evidence: 1, detail: { x: [1] } };
  mine.self = mine;
  const board = createMasteryBoard({ mastery: { async compute() { return mine; } }, db: { async query() { return []; } }, clock: { now: () => NOW } });
  const out = await board.get('t1');
  assert.notEqual(out, mine);
  assert.equal(Object.isFrozen(mine), false);
  mine.pct = 77; // quien llama a compute puede seguir tocando lo suyo
  assert.equal((await board.get('t1')).pct, 5);
  assert.equal(out.self, out);
  assert.ok(Object.isFrozen(out.detail.x));
});

test('wrapEvents: si `log` no devuelve el evento, invalida con los temas que se le pasaron', async () => {
  const { state, board } = stubWorld();
  const events = board.wrapEvents({ async log() { return undefined; } });
  await board.get('t1'); await board.get('t2');
  assert.equal(await events.log({ type: 'answer', topics: ['t2'] }), undefined);
  await board.get('t1'); await board.get('t2');
  assert.deepEqual(state.calls.map((c) => c[0]), ['t1', 't2', 't2']);
});

test('wrapEvents: ignora temas ilegibles en la lista sin romper el `log`', async () => {
  const { state, board } = stubWorld();
  const events = board.wrapEvents({ async log(ev) { return ev; } });
  await board.get('t1');
  const saved = await events.log({ type: 'answer', topics: [3, '', null, 't1'] });
  assert.equal(saved.type, 'answer');
  await board.get('t1');
  assert.equal(state.calls.length, 2);
});

test('wrapEvents: un `log` que acepta una entrada vacía tampoco rompe la invalidación', async () => {
  const { state, board } = stubWorld();
  const events = board.wrapEvents({ async log() { return 'ok'; } });
  await board.get('t1');
  assert.equal(await events.log(undefined), 'ok');
  assert.equal(await events.log(null), 'ok');
  await board.get('t1');
  assert.equal(state.calls.length, 1);
});

test('stats cuenta uno por acierto y uno por fallo', async () => {
  const { board } = stubWorld();
  for (let i = 0; i < 3; i += 1) await board.get('t1');
  await board.get('t2');
  assert.deepEqual(board.stats(), { hits: 2, misses: 2, size: 2 });
});

test('las consultas pasan su `now` y su config al cálculo y a la agregación', async () => {
  const state = { ats: [] };
  const mastery = { async compute(id, at) { state.ats.push(at.getTime()); return { topicId: id, pct: 40, evidence: 3, band: 'progress', confidence: 'low', caps: [], signals: { R: 0.9, P: null, U: null, E: 0 } }; } };
  const db = { async query() { return []; } };
  const topics = [{ id: 'a', area: 'gram', level: 'A1', priority: 1, min_items: 12 }];
  const when = plus(3 * DAY);
  const plain = createMasteryBoard({ mastery, db, clock: { now: () => NOW } });
  for (const call of ['byLevel', 'byArea', 'atRisk', 'toStudy']) {
    state.ats.length = 0;
    plain.invalidate();
    await plain[call](topics, when);
    assert.deepEqual(state.ats, [when.getTime()], call);
  }
  assert.deepEqual((await plain.toStudy(topics, when)).map((x) => x.topicId), ['a']); // 40 % = «En progreso»: entra con el corte por defecto
  const strict = createMasteryBoard({ mastery, db, clock: { now: () => NOW }, config: { ...MASTERY_CONFIG, toStudy: { maxBand: 'initial' }, atRisk: { retention: 0.95 }, levels: ['A1'] } });
  assert.deepEqual(await strict.toStudy(topics, when), []);
  assert.deepEqual((await strict.atRisk(topics, when)).map((x) => x.reasons), [['low_retention']]);
  assert.deepEqual(await plain.atRisk(topics, when), []);
});
