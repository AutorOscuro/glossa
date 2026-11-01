// @purpose: Prueba cruzada de 2.8-T1: el resumen contra los eventos, errores y tarjetas que deja una sesión REAL (conductor, confirmación atómica y base en memoria).
// 2.8-T1, CA 1 y CA 2 con servicios reales. El recuento se hace aparte, leyendo directamente los almacenes `events`, `errors` y `cards`, no con el módulo probado.
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
import { buildSessionSummary } from '../core/sessionSummary.js';
import { makeClock } from './_helpers.mjs';

const read = (p) => JSON.parse(fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const CATALOG = createErrorCatalog(read('content/taxonomy/error_codes.json'));
const TOPICS = read('content/taxonomy/topics.json').topics;
const TOPIC = 'gram.be.present_forms';
const CODE = 'TNS.SINCE_FOR';

const vis = () => ({ hidden: () => false, onChange: () => () => {} });

async function world({ cards = 6 } = {}) {
  const clock = makeClock('2026-10-26T15:00:00.000Z');
  const db = createMemoryDb(); await db.open();
  const study = createStudyServices({ db, catalog: CATALOG, topics: TOPICS, clock, rng: createRng(3), log: () => {} });
  for (let i = 0; i < cards; i += 1) await db.put('cards', study.srs.newCard(`it00${i}`, 0, clock.now(), [TOPIC]));
  const timer = createAnswerTimer({ clock, visibility: vis() });
  const started = await startSession({ study, rng: createRng(9) });
  const driver = createSessionDriver({ study, timer, sessionId: started.sessionId, state: started.state, items: started.items, log: () => {} });
  await driver.prepare();
  return { clock, db, study, started, driver };
}

// Responde el ítem actual y avanza; devuelve lo que contestó el conductor.
async function answerNext(w, answer, { ms = 4000 } = {}) {
  w.driver.shown();
  w.clock.advance(ms);
  const r = await w.driver.submit({ exerciseType: 'fix_error', responseRaw: 'x', ...answer });
  const n = await w.driver.next();
  return { r, n };
}

const toRows = (map) => [...map.values()].map((m) => ({ topicId: m.topicId, pct: m.pct, band: m.band, confidence: m.confidence }));
const wrongWith = (original) => ({ result: 'wrong', errors: [{ code: CODE, original, correction: 'I have lived here for two years', topics: [TOPIC] }] });

async function gather(w) {
  const events = await w.db.query('events', {});
  const errors = await w.db.query('errors', {});
  const cards = await w.db.query('cards', {});
  return { events, errors, cards };
}

test('CA 1: una sesión completa — cada cifra del resumen coincide con los eventos guardados', async () => {
  const w = await world({ cards: 6 });
  const before = toRows(await w.study.board.results(TOPICS, w.clock.now()));
  const plan = [{ result: 'correct' }, wrongWith('since two years'), { result: 'dont_know', dontKnow: true }, { result: 'almost' }, { result: 'correct' }, wrongWith('since two years')];
  let last;
  for (const p of plan) last = await answerNext(w, p, { ms: 3000 });
  assert.equal(last.n.status, 'finished');

  const { events, errors, cards } = await gather(w);
  const after = toRows(await w.study.board.results(TOPICS, w.clock.now()));
  const s = buildSessionSummary({ events, sessionId: w.started.sessionId, state: w.driver.getState(), errors, catalog: CATALOG, masteryBefore: before, masteryAfter: after, cards, now: w.clock.now() });

  // Recuento independiente leyendo los almacenes.
  const mine = events.filter((e) => e.type === 'answer' && e.sessionId === w.started.sessionId);
  const tally = (r) => mine.filter((e) => e.result === r).length;
  assert.equal(s.answered, mine.length);
  assert.equal(s.answered, 6);
  assert.deepEqual(s.counts, { correct: tally('correct'), almost: tally('almost'), wrong: tally('wrong'), dontKnow: tally('dont_know'), skipped: tally('skipped') });
  assert.deepEqual(s.counts, { correct: 2, almost: 1, wrong: 2, dontKnow: 1, skipped: 0 });
  assert.equal(s.accuracyPct, 33);
  assert.equal(s.time.ms, mine.reduce((sum, e) => sum + e.ms, 0));
  assert.equal(s.time.counted, 6);
  assert.equal(s.partial, false);
  assert.equal(s.pending, 0);

  // Lo mismo que cuenta el ejecutor por su cuenta (dos caminos distintos al mismo número).
  assert.equal(s.answered, last.n.summary.answered);
  assert.equal(s.counts.correct, last.n.summary.correct);
  assert.equal(s.counts.wrong, last.n.summary.wrong);

  // Errores: los dos fallos eran de ítems distintos, así que son dos registros nuevos (el mismo código, frases iguales pero ítems distintos).
  assert.equal(s.errors.total, errors.length);
  assert.equal(s.errors.fresh.length, 2);
  assert.equal(s.errors.recurrent.length, 0);
  assert.ok(s.errors.fresh.every((e) => e.code === CODE && e.times === 1 && e.priorCount === 0 && typeof e.hint === 'string' && e.hint !== ''));

  // Repasos: cada tarjeta respondida aparece con el `due` guardado en la base.
  assert.equal(s.nextReviews.items.length + s.nextReviews.unknown, 6);
  for (const it of s.nextReviews.items) assert.equal(it.due, cards.find((c) => c.id === it.cardId).due);

  // Fallos: exactamente las tarjetas cuyo evento quedó wrong o dont_know.
  const failedIds = mine.filter((e) => e.result === 'wrong' || e.result === 'dont_know').map((e) => e.cardId);
  assert.deepEqual(s.failed.map((f) => f.cardId), failedIds);
  assert.equal(s.failed.length, 3);

  // Dominio: el tema practicado trae su cambio, con confianza.
  const change = s.mastery.changes.find((c) => c.topicId === TOPIC);
  assert.ok(change, 'el tema practicado aparece en los cambios de dominio');
  assert.equal(change.after, after.find((r) => r.topicId === TOPIC).pct);
  assert.ok(['low', 'mid', 'high'].includes(change.confidence));
});

test('CA 2: abandonar a mitad da un resumen parcial que cuadra con lo respondido', async () => {
  const w = await world({ cards: 6 });
  await answerNext(w, { result: 'correct' });
  await answerNext(w, wrongWith('since two years'));
  w.driver.shown(); // el tercero ya está en pantalla y se abandona sin responder
  const quit = transition(w.driver.getState(), 'QUIT').state;
  const { events, errors, cards } = await gather(w);
  const s = buildSessionSummary({ events, sessionId: w.started.sessionId, state: quit, errors, catalog: CATALOG, cards, now: w.clock.now() });
  assert.equal(s.partial, true);
  assert.equal(s.ended, 'quit');
  assert.equal(s.answered, 2);
  assert.equal(s.planned, 6);
  assert.equal(s.pending, 4);
  assert.equal(s.counts.correct, 1);
  assert.equal(s.counts.wrong, 1);
  assert.equal(s.accuracyPct, 50);
  assert.equal(s.failed.length, 1);
});

test('errores recurrentes: lo que ya había antes de la sesión se separa de lo nuevo', async () => {
  const w = await world({ cards: 3 });
  // El primer ítem del plan ya había fallado con esa frase dos veces antes de hoy.
  const first = w.started.items[0].itemId;
  for (const ts of ['2026-10-20T10:00:00.000Z', '2026-10-22T10:00:00.000Z']) {
    await w.study.errors.record({ original: 'since two years', code: CODE, correction: 'for two years', topics: [TOPIC], itemId: first, ts });
  }
  await answerNext(w, wrongWith('since two years')); // ítem 1: el mismo error de siempre
  await answerNext(w, wrongWith('since two years')); // ítem 2: error nuevo (otro ítem)
  await answerNext(w, { result: 'correct' });
  const { events, errors, cards } = await gather(w);
  const s = buildSessionSummary({ events, sessionId: w.started.sessionId, state: w.driver.getState(), errors, catalog: CATALOG, cards, now: w.clock.now() });
  assert.equal(s.errors.recurrent.length, 1);
  assert.equal(s.errors.fresh.length, 1);
  const r = s.errors.recurrent[0];
  assert.equal(r.itemId, first);
  assert.equal(r.priorCount, 2);
  assert.equal(r.times, 1);
  assert.equal(r.count, 3);
  assert.equal(r.kind, 'systematic'); // la 3.ª ocurrencia lo vuelve sistemático (core/errors.js)
  assert.equal(s.errors.fresh[0].priorCount, 0);
});

test('CA 4 con servicios reales: una sesión sin respuestas no muestra NaN', async () => {
  const w = await world({ cards: 3 });
  const { events, errors, cards } = await gather(w);
  const quit = transition(w.driver.getState(), 'QUIT').state;
  const s = buildSessionSummary({ events, sessionId: w.started.sessionId, state: quit, errors, cards, now: w.clock.now() });
  assert.equal(s.empty, true);
  assert.equal(s.accuracyPct, null);
  assert.equal(s.pending, 3);
  assert.ok(!JSON.stringify(s).match(/NaN|Infinity|undefined/));
});
