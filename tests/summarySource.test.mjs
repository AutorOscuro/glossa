// @purpose: Pruebas de app/summarySource.js (2.8-T2, punto 1): lectura con ventana, resumen igual al de los almacenes, «antes» desde la foto diaria y degradación sin culpa.
// Servicios de estudio reales sobre base en memoria; los fallos se provocan con envoltorios. CA 1 y CA 2 de 2.8 con la fuente real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStudyServices } from '../app/services.js';
import { createMemoryDb } from '../core/db.memory.js';
import { createErrorCatalog } from '../core/errorCatalog.js';
import { createRng } from '../core/rng.js';
import { createAnswerTimer } from '../core/answerTimer.js';
import { createSessionDriver, startSession } from '../core/sessionDriver.js';
import { transition } from '../core/sessionRunner.js';
import { addDays, localDay } from '../core/clock.js';
import { createSummarySource, SUMMARY_WINDOW_MS } from '../app/summarySource.js';
import { makeClock } from './_helpers.mjs';

const read = (p) => JSON.parse(fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const CATALOG = createErrorCatalog(read('content/taxonomy/error_codes.json'));
const TOPICS = read('content/taxonomy/topics.json').topics;
const TOPIC = 'gram.be.present_forms';
const CODE = 'TNS.SINCE_FOR';
const wrong = (original) => ({ result: 'wrong', errors: [{ code: CODE, original, correction: 'for two years', topics: [TOPIC] }] });

async function world({ cards = 4 } = {}) {
  const clock = makeClock('2026-10-26T15:00:00.000Z');
  const db = createMemoryDb(); await db.open();
  const study = createStudyServices({ db, catalog: CATALOG, topics: TOPICS, clock, rng: createRng(3), log: () => {} });
  for (let i = 0; i < cards; i += 1) await db.put('cards', study.srs.newCard(`it00${i}`, 0, clock.now(), [TOPIC]));
  const timer = createAnswerTimer({ clock, visibility: { hidden: () => false, onChange: () => () => {} } });
  const started = await startSession({ study, rng: createRng(9) });
  const driver = createSessionDriver({ study, timer, sessionId: started.sessionId, state: started.state, items: started.items, log: () => {} });
  await driver.prepare();
  return { clock, db, study, started, driver };
}
async function answerNext(w, answer) {
  w.driver.shown(); w.clock.advance(3000);
  await w.driver.submit({ exerciseType: 'fix_error', responseRaw: 'x', ...answer });
  return w.driver.next();
}
const quiet = () => {};

test('CA 1: el resumen leído por la fuente coincide con los almacenes (cifras, errores, repasos y fallos)', async () => {
  const w = await world();
  for (const a of [{ result: 'correct' }, wrong('since two years'), { result: 'almost' }, wrong('since two years')]) await answerNext(w, a);
  const s = await createSummarySource({ study: w.study, log: quiet }).load({ sessionId: w.started.sessionId, state: w.driver.getState() });
  const events = (await w.db.query('events', {})).filter((e) => e.type === 'answer' && e.sessionId === w.started.sessionId);
  const errors = await w.db.query('errors', {});
  assert.equal(s.answered, events.length);
  assert.deepEqual(s.counts, { correct: 1, almost: 1, wrong: 2, dontKnow: 0, skipped: 0 });
  assert.equal(s.errors.total, errors.length);
  assert.equal(s.errors.fresh.length, 2);
  assert.equal(s.failed.length, 2);
  for (const it of s.nextReviews.items) assert.equal(it.due, (await w.db.get('cards', it.cardId)).due);
  assert.equal(s.nextReviews.items.length, 4);
  assert.equal(s.degraded, false);
});

test('CA 2: abandonar a mitad da resumen parcial por la fuente real', async () => {
  const w = await world();
  await answerNext(w, { result: 'correct' });
  w.driver.shown();
  const quit = transition(w.driver.getState(), 'QUIT').state;
  const s = await createSummarySource({ study: w.study, log: quiet }).load({ sessionId: w.started.sessionId, state: quit });
  assert.equal(s.partial, true);
  assert.equal(s.answered, 1);
  assert.equal(s.pending, 3);
});

test('CA 4: sin respuestas la fuente devuelve un resumen vacío sin NaN', async () => {
  const w = await world();
  const quit = transition(w.driver.getState(), 'QUIT').state;
  const s = await createSummarySource({ study: w.study, log: quiet }).load({ sessionId: w.started.sessionId, state: quit });
  assert.equal(s.empty, true);
  assert.ok(!JSON.stringify(s).match(/NaN|Infinity|undefined/));
});

test('ventana: lee eventos desde ahora − 24 h y los errores solo por día; nunca el historial entero', async () => {
  const w = await world();
  await answerNext(w, wrong('since two years'));
  const calls = { since: [], list: [] };
  const spy = { ...w.study, events: { ...w.study.events, since: (ts, o) => { calls.since.push(ts); return w.study.events.since(ts, o); } },
    errors: { ...w.study.errors, list: (o) => { calls.list.push(o); return w.study.errors.list(o); } } };
  await createSummarySource({ study: spy, log: quiet }).load({ sessionId: w.started.sessionId, state: w.driver.getState() });
  assert.equal(calls.since.length, 1);
  assert.equal(w.clock.now().getTime() - calls.since[0].getTime(), SUMMARY_WINDOW_MS);
  assert.ok(calls.list.length >= 1 && calls.list.every((o) => typeof o.day === 'string' && Object.keys(o).length === 1), 'errors.list siempre con un día');
});

test('eventos de otras sesiones y de hace más de 24 h no entran', async () => {
  const w = await world();
  await answerNext(w, { result: 'correct' });
  const old = (await w.db.query('events', {}))[0];
  await w.db.put('events', { ...old, id: 'evt_20260101T0000_old1', ts: '2026-01-01T10:00:00.000Z', day: '2026-01-01' });
  await w.db.put('events', { ...old, id: 'evt_20261026T1459_othr', sessionId: 'ses_otra', cardId: 'zz#0' });
  const s = await createSummarySource({ study: w.study, log: quiet }).load({ sessionId: w.started.sessionId, state: w.driver.getState() });
  assert.equal(s.answered, 1);
});

test('dominio: sin foto previa el tema es «new» (con su confianza); con foto de ayer más alta el tema baja', async () => {
  const w = await world();
  await answerNext(w, { result: 'wrong' });
  const src = createSummarySource({ study: w.study, log: quiet });
  const first = await src.load({ sessionId: w.started.sessionId, state: w.driver.getState() });
  const c0 = first.mastery.changes.find((c) => c.topicId === TOPIC);
  assert.equal(c0.direction, 'new');
  assert.equal(c0.before, null);
  assert.ok(['low', 'mid', 'high'].includes(c0.confidence));
  const yesterday = localDay(addDays(w.clock.now(), -1));
  await w.db.put('meta', { key: `mastery_snap:${yesterday}`, v: 1, day: yesterday, results: [{ topicId: TOPIC, pct: 100, band: 'mastered', confidence: 'high', evidence: 50 }] });
  const second = await src.load({ sessionId: w.started.sessionId, state: w.driver.getState() });
  const c1 = second.mastery.changes.find((c) => c.topicId === TOPIC);
  assert.equal(c1.before, 100);
  assert.equal(c1.direction, 'down');
  assert.equal(c1.delta, c1.after - 100);
  assert.ok(c1.delta < 0);
});

test('dominio: una foto de ayer más baja da «sube»; solo se toman los temas practicados', async () => {
  const w = await world();
  await answerNext(w, { result: 'correct' });
  const yesterday = localDay(addDays(w.clock.now(), -1));
  await w.db.put('meta', { key: `mastery_snap:${yesterday}`, v: 1, day: yesterday, results: [
    { topicId: TOPIC, pct: 40, band: 'progress', confidence: 'mid', evidence: 5 }, { topicId: 'otro.tema', pct: 90, band: 'mastered', confidence: 'high', evidence: 9 } ] });
  const s = await createSummarySource({ study: w.study, log: quiet }).load({ sessionId: w.started.sessionId, state: w.driver.getState() });
  assert.deepEqual(s.mastery.changes.map((c) => [c.topicId, c.direction, c.before]), [[TOPIC, 'up', 40]]);
});

test('degradación: si fallan errores, tarjetas o dominio el resumen sale igual y se avisa; si fallan los eventos, rechaza', async () => {
  const w = await world();
  await answerNext(w, wrong('since two years'));
  const logs = [];
  const boom = () => { throw new Error('roto'); };
  const broken = { ...w.study, errors: { ...w.study.errors, list: boom }, db: { ...w.db, get: boom }, board: { ...w.study.board, results: boom } };
  const s = await createSummarySource({ study: broken, log: (...a) => logs.push(a) }).load({ sessionId: w.started.sessionId, state: w.driver.getState() });
  assert.equal(s.answered, 1);
  assert.equal(s.counts.wrong, 1);
  assert.equal(s.errors.total, 0);
  assert.equal(s.nextReviews.unknown, 1);
  assert.deepEqual(s.mastery.changes, []);
  assert.equal(logs.length, 3);
  const noEvents = { ...w.study, events: { ...w.study.events, since: async () => { throw new Error('base cerrada'); } } };
  await assert.rejects(() => createSummarySource({ study: noEvents, log: quiet }).load({ sessionId: w.started.sessionId }), /base cerrada/);
});

test('sin servicios de estudio lanza un error en español al crearla', () => {
  assert.throws(() => createSummarySource({}), /faltan los servicios de estudio/);
  assert.throws(() => createSummarySource({ study: { events: {} } }), /faltan los servicios de estudio/);
});

test('«antes» ignora la foto de HOY (finish() la toma al terminar la sesión): si no, todo saldría «igual»', async () => {
  const w = await world();
  await answerNext(w, { result: 'wrong' });
  const today = localDay(w.clock.now());
  const yesterday = localDay(addDays(w.clock.now(), -1));
  const snap = (day, pct) => ({ key: `mastery_snap:${day}`, v: 1, day, results: [{ topicId: TOPIC, pct, band: 'mastered', confidence: 'high', evidence: 50 }] });
  await w.db.put('meta', snap(yesterday, 100));
  const after = (await w.study.board.results(TOPICS, w.clock.now())).get(TOPIC).pct;
  await w.db.put('meta', snap(today, after)); // lo que dejaría finish(): el «después»
  const s = await createSummarySource({ study: w.study, log: quiet }).load({ sessionId: w.started.sessionId, state: w.driver.getState() });
  const c = s.mastery.changes.find((x) => x.topicId === TOPIC);
  assert.equal(c.before, 100);
  assert.equal(c.direction, 'down');
});

test('solo se leen las tarjetas de ESTA sesión (no las de otras sesiones de la ventana)', async () => {
  const w = await world();
  await answerNext(w, { result: 'correct' });
  const mine = (await w.db.query('events', {}))[0];
  await w.db.put('events', { ...mine, id: 'evt_20261026T1459_othr', sessionId: 'ses_otra', cardId: 'zz#0' });
  const read = [];
  const spy = { ...w.study, db: { ...w.db, get: (store, id) => { read.push(`${store}:${id}`); return w.db.get(store, id); } } };
  await createSummarySource({ study: spy, log: quiet }).load({ sessionId: w.started.sessionId, state: w.driver.getState() });
  assert.deepEqual(read, [`cards:${mine.cardId}`]);
});
