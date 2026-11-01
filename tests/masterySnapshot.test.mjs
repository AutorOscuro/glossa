// @purpose: Pruebas de la foto diaria de dominio (core/masterySnapshot.js, 2.1-T2): una por día, solo temas con evidencia, idempotencia, límite de días, lectura y fallos de la base.
// 2.1-T2. Base en memoria, dominio real (eventos, errores, tablero) y los temas reales de topics.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createMasterySnapshot, SNAP_PREFIX, DEFAULT_MAX_DAYS, keyOf } from '../core/masterySnapshot.js';
import { createMemoryDb } from '../core/db.memory.js';
import { createEvents } from '../core/events.js';
import { createErrors } from '../core/errors.js';
import { createErrorCatalog } from '../core/errorCatalog.js';
import { createMastery } from '../core/mastery.js';
import { createMasteryBoard } from '../core/masteryBoard.js';
import { createSrs } from '../core/srsEngine.js';
import { localDay } from '../core/clock.js';
import { masteryTrend } from '../core/stats.js';
import { makeClock } from './_helpers.mjs';

const TOPICS = JSON.parse(fs.readFileSync(new URL('../content/taxonomy/topics.json', import.meta.url), 'utf8')).topics;
const CATALOG = createErrorCatalog(JSON.parse(fs.readFileSync(new URL('../content/taxonomy/error_codes.json', import.meta.url), 'utf8')));
const [T1, T2, T3] = [TOPICS[0].id, TOPICS[1].id, TOPICS[2].id];

async function world(opts = {}) {
  const clock = makeClock('2026-10-26T15:00:00.000Z');
  const db = createMemoryDb(); await db.open();
  const srs = createSrs();
  const rawEvents = createEvents({ db, clock });
  const errors = createErrors({ db, catalog: CATALOG, clock });
  const mastery = createMastery({ db, events: rawEvents, errors, srs, clock });
  const board = createMasteryBoard({ mastery, db, clock });
  const events = board.wrapEvents(rawEvents);
  const snap = createMasterySnapshot({ db, board, topics: opts.topics ?? TOPICS, clock, ...opts.extra });
  const answer = (topic, result = 'correct', n = 1) => Promise.all(Array.from({ length: n }, (_, i) => events.log({
    type: 'answer', itemId: `${topic}.i${i}`, cardId: `${topic}.i${i}#0`, topics: [topic], exerciseType: 'fix_error', result, rating: result === 'correct' ? 3 : 1, ms: 3000, mode: 'mech', channel: 'keyboard',
  })));
  return { db, clock, snap, board, events, answer };
}
const metaKeys = async (db) => (await db.query('meta', {})).map((r) => r.key).filter((k) => k.startsWith(SNAP_PREFIX)).sort();

test('guarda solo los temas con respuestas, ordenados, con el formato acordado y la clave del día local', async () => {
  const w = await world();
  await w.answer(T2, 'correct', 3); await w.answer(T1, 'wrong', 2);
  const out = await w.snap.take();
  const day = localDay(w.clock.now());
  assert.deepEqual(out, { day, key: `mastery_snap:${day}`, saved: true, changed: true, count: 2, pruned: 0 });
  const rec = await w.db.get('meta', `mastery_snap:${day}`);
  assert.equal(rec.v, 1); assert.equal(rec.day, day); assert.equal(rec.key, `mastery_snap:${day}`);
  assert.deepEqual(rec.results.map((r) => r.topicId), [T1, T2].sort());
  for (const r of rec.results) {
    assert.deepEqual(Object.keys(r).sort(), ['band', 'confidence', 'evidence', 'pct', 'topicId']);
    assert.ok(Number.isInteger(r.pct) && r.pct >= 1 && r.pct <= 100);
    assert.ok(r.evidence > 0);
  }
  assert.equal(rec.results.find((r) => r.topicId === T2).evidence, 3);
  assert.ok(!rec.results.some((r) => r.topicId === T3), 'un tema sin respuestas no entra');
});

test('sin ningún tema con respuestas no se guarda foto', async () => {
  const w = await world();
  assert.deepEqual(await w.snap.take(), { day: localDay(w.clock.now()), key: keyOf(localDay(w.clock.now())), saved: false, changed: false, count: 0, pruned: 0 });
  assert.deepEqual(await metaKeys(w.db), []);
});

test('IDEMPOTENTE: repetir con los mismos datos no escribe de nuevo; con datos nuevos el mismo día gana la última', async () => {
  const w = await world();
  await w.answer(T1, 'correct', 2);
  const first = await w.snap.take();
  let puts = 0;
  const realPut = w.db.put; w.db.put = (...a) => { puts += 1; return realPut.apply(w.db, a); };
  const again = await w.snap.take();
  assert.equal(again.changed, false); assert.equal(again.saved, true); assert.equal(puts, 0);
  assert.equal((await metaKeys(w.db)).length, 1);
  await w.answer(T1, 'correct', 2);
  const third = await w.snap.take();
  assert.equal(third.changed, true); assert.equal(puts, 1);
  const rec = await w.db.get('meta', first.key);
  assert.equal(rec.results[0].evidence, 4);
  assert.equal((await metaKeys(w.db)).length, 1, 'sigue habiendo una sola foto del día');
});

test('takeIfMissing: crea la del día si falta y, si ya existe, no calcula nada', async () => {
  const w = await world();
  await w.answer(T1);
  let computed = 0;
  const board = { results: (...a) => { computed += 1; return w.board.results(...a); } };
  const snap = createMasterySnapshot({ db: w.db, board, topics: TOPICS, clock: w.clock });
  const a = await snap.takeIfMissing();
  assert.equal(a.saved, true); assert.equal(a.changed, true); assert.equal(computed, 1);
  const b = await snap.takeIfMissing();
  assert.deepEqual([b.saved, b.changed, b.count], [false, false, 1]); assert.equal(computed, 1);
  w.clock.advanceDays(1); // día nuevo → vuelve a calcular
  const c = await snap.takeIfMissing();
  assert.equal(c.saved, true); assert.equal(computed, 2);
});

test('límite de días: se conservan las maxDays más recientes y no se tocan otras claves de meta', async () => {
  const w = await world({ extra: { maxDays: 3 } });
  await w.db.put('meta', { key: 'firstSession', at: 'x' });
  await w.answer(T1);
  const days = [];
  for (let i = 0; i < 5; i += 1) { const out = await w.snap.take(); days.push(out.day); if (i >= 3) assert.equal(out.pruned, 1, `día ${i}`); w.clock.advanceDays(1); }
  assert.deepEqual(await metaKeys(w.db), days.slice(2).map(keyOf));
  assert.ok(await w.db.get('meta', 'firstSession'));
  assert.ok(await w.db.get('meta', 'schemaVersion'));
  assert.equal(DEFAULT_MAX_DAYS, 400);
});

test('con 400 días por defecto: la foto 401 borra la más antigua', async () => {
  const w = await world();
  await w.answer(T1);
  for (let i = 0; i < 401; i += 1) { await w.snap.take(); w.clock.advanceDays(1); }
  const keys = await metaKeys(w.db);
  assert.equal(keys.length, 400);
});

test('list: devuelve las fotos en orden de día, filtra por rango y alimenta stats.masteryTrend', async () => {
  const w = await world();
  await w.answer(T1, 'correct', 3);
  const days = [];
  for (let i = 0; i < 4; i += 1) { days.push((await w.snap.take()).day); w.clock.advanceDays(1); if (i === 1) await w.answer(T2, 'correct', 2); }
  const all = await w.snap.list();
  assert.deepEqual(all.map((s) => s.day), days);
  assert.deepEqual((await w.snap.list({ from: days[1], to: days[2] })).map((s) => s.day), [days[1], days[2]]);
  assert.deepEqual(await w.snap.list({ from: '2030-01-01' }), []);
  assert.equal(all[0].results.length, 1); assert.equal(all[3].results.length, 2);
  const trend = masteryTrend(all, TOPICS, { by: 'area' });
  assert.deepEqual(trend.days, days);
  assert.ok(trend.series.length >= 1 && trend.series[0].points.length >= 1);
});

test('list ignora registros ilegibles y valida el rango', async () => {
  const w = await world();
  await w.answer(T1);
  const ok = (await w.snap.take()).day;
  await w.db.put('meta', { key: 'mastery_snap:no-es-dia', day: 'x', results: [] });
  await w.db.put('meta', { key: 'mastery_snap:2026-01-01', day: '2026-01-02', results: [] }); // el día no coincide con la clave
  await w.db.put('meta', { key: 'mastery_snap:2026-01-03', day: '2026-01-03', results: 'no lista' });
  await w.db.put('meta', { key: 'mastery_snap:2026-01-04', day: '2026-01-04', results: [{ topicId: 5 }, null, { topicId: T1, pct: 50, evidence: 2, band: 'raro', confidence: 'raro' }, { topicId: T2, pct: 10, evidence: 0 }] });
  const out = await w.snap.list();
  assert.deepEqual(out.map((s) => s.day), ['2026-01-04', ok]);
  assert.deepEqual(out[0].results, [{ topicId: T1, pct: 50, band: 'initial', confidence: 'low', evidence: 2 }]);
  for (const bad of [{ from: 5 }, { to: '26-1-1' }, { from: null }]) await assert.rejects(() => w.snap.list(bad), /debe ser AAAA-MM-DD/);
});

test('si la base falla al escribir se rechaza, no se guarda foto y las anteriores no se borran', async () => {
  const w = await world({ extra: { maxDays: 1 } });
  await w.answer(T1);
  await w.snap.take();
  const keysBefore = await metaKeys(w.db);
  w.clock.advanceDays(1);
  w.db.setWriteHook(() => { throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' }); });
  await assert.rejects(() => w.snap.take(), (e) => e.code === 'QUOTA' || /quota/i.test(e.message));
  w.db.setWriteHook(null);
  assert.deepEqual(await metaKeys(w.db), keysBefore, 'la foto vieja sigue ahí');
});

test('si el cálculo del dominio falla no se escribe nada', async () => {
  const w = await world();
  const snap = createMasterySnapshot({ db: w.db, board: { results: async () => { throw new Error('cálculo roto'); } }, topics: TOPICS, clock: w.clock });
  await assert.rejects(() => snap.take(), /cálculo roto/);
  assert.deepEqual(await metaKeys(w.db), []);
});

test('el día es el local del instante recibido (no el de UTC) y un now ilegible lanza', async () => {
  const w = await world();
  await w.answer(T1);
  const now = new Date('2026-03-01T04:30:00.000Z');
  assert.equal((await w.snap.take(now)).day, localDay(now));
  assert.equal((await w.snap.take(now.getTime())).day, localDay(now));
  for (const bad of ['mañana', {}, NaN]) await assert.rejects(() => w.snap.take(bad), /now debe ser una fecha/);
});

test('validación de la fábrica: dependencias y maxDays', async () => {
  const w = await world();
  const ok = { db: w.db, board: w.board, topics: TOPICS, clock: w.clock };
  assert.doesNotThrow(() => createMasterySnapshot(ok));
  for (const patch of [{ db: null }, { db: {} }, { board: null }, { board: {} }, { topics: 'x' }, { clock: {} }, { maxDays: 0 }, { maxDays: 1.5 }, { maxDays: 4000 }, { maxDays: '3' }]) {
    assert.throws(() => createMasterySnapshot({ ...ok, ...patch }), /createMasterySnapshot/, JSON.stringify(patch));
  }
  assert.throws(() => createMasterySnapshot(), /createMasterySnapshot/);
  assert.throws(() => keyOf('2026-1-1'), /AAAA-MM-DD/);
  assert.ok(Object.isFrozen(w.snap));
});

test('temas inválidos en la lista se ignoran y no se escribe en otros almacenes', async () => {
  const w = await world({ topics: [null, 5, { id: '' }, { id: T1 }, { nombre: 'x' }] });
  await w.answer(T1); await w.answer(T2);
  const out = await w.snap.take();
  assert.equal(out.count, 1);
  assert.equal(await w.db.count('errors', {}), 0);
  assert.equal(await w.db.count('cards', {}), 0);
});
