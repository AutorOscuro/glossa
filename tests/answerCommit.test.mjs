// @purpose: Pruebas de la persistencia atómica de una respuesta (core/answerCommit.js, 2.1-T2): evento + tarjeta + errores en una transacción, doble toque, fallos a medias y dominio.
// 2.1-T2. Base en memoria, eventos, errores, dominio y calificación reales; los fallos se provocan con un envoltorio de la base.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createAnswerCommit, MAX_ERRORS_PER_ANSWER } from '../core/answerCommit.js';
import { gradeAnswer } from '../core/gradeAnswer.js';
import { createEvents } from '../core/events.js';
import { createErrors } from '../core/errors.js';
import { createErrorCatalog } from '../core/errorCatalog.js';
import { createSrs } from '../core/srsEngine.js';
import { createMemoryDb } from '../core/db.memory.js';
import { createRng } from '../core/rng.js';
import { DbError } from '../core/db.js';
import { EventError } from '../core/eventSchema.js';
import { makeClock } from './_helpers.mjs';

const CATALOG = createErrorCatalog(JSON.parse(fs.readFileSync(new URL('../content/taxonomy/error_codes.json', import.meta.url), 'utf8')));
const TOPIC = 'gram.present_perfect.for_since';
const CODE = 'TNS.SINCE_FOR';
const srs = createSrs();
const NOW = new Date('2026-10-26T15:00:00.000Z');

async function world({ wrapDb = (d) => d, withErrors = true, withBoard = false } = {}) {
  const real = createMemoryDb(); await real.open();
  const db = wrapDb(real);
  const clock = makeClock(NOW.toISOString());
  const events = createEvents({ db, clock, rng: createRng(7) });
  const errors = withErrors ? createErrors({ db, catalog: CATALOG, clock }) : null;
  const invalidated = [];
  const board = withBoard ? { invalidate: (t) => invalidated.push(t) } : null;
  const { commit } = createAnswerCommit({ db, events, errors, board });
  return { real, db, events, errors, commit, invalidated };
}
const putCard = async (db, itemId = 'g.pp.0001') => { const c = srs.newCard(itemId, 0, NOW, [TOPIC]); await db.put('cards', c); return c; };
const grade = (card, answer = { result: 'correct', ms: 4000 }, over = {}) => gradeAnswer({ answer, card, srs, now: NOW, exerciseType: 'fix_error', baselineMs: 6000, sessionId: 'ses_1', mode: 'mech', channel: 'keyboard', ...over });
const count = async (db, store) => (await db.query(store, {})).length;
const slip = (over = {}) => ({ code: CODE, original: 'I live here since 2020', correction: 'I have lived here since 2020', topics: [TOPIC], ...over });

test('una respuesta guarda el evento, la tarjeta reprogramada y el error, y lo devuelve', async () => {
  const { real, commit } = await world();
  const card = await putCard(real);
  const g = grade(card, { result: 'wrong', ms: 5000, responseRaw: 'I live here since 2020' });
  const r = await commit({ grade: g, errors: [slip()] });
  assert.equal(r.duplicate, false); assert.equal(r.cardSaved, true);
  assert.equal(await count(real, 'events'), 1); assert.equal(await count(real, 'errors'), 1);
  const saved = await real.get('cards', card.id);
  assert.equal(saved.reps, 1); assert.equal(saved.last_review, NOW.toISOString());
  assert.equal(r.event.cardId, card.id); assert.equal(r.event.sessionId, 'ses_1'); assert.match(r.event.id, /^evt_/);
  assert.equal(r.errors.length, 1); assert.equal(r.errors[0].created, true);
  assert.equal(r.errors[0].record.itemId, card.itemId, 'el error hereda el itemId del evento');
  assert.equal(r.errors[0].record.ts, r.event.ts, 'y la fecha del evento');
});

test('sin errores también funciona (errors omitido o vacío) y sin registro de errores', async () => {
  const w = await world({ withErrors: false });
  const card = await putCard(w.real);
  const r = await w.commit({ grade: grade(card) });
  assert.equal(r.duplicate, false); assert.deepEqual(r.errors, []);
  assert.equal(await count(w.real, 'events'), 1);
  const r2 = await w.commit({ grade: grade(card, { result: 'correct', ms: 4000 }, { sessionId: 'ses_2' }), errors: [] });
  assert.equal(r2.duplicate, false);
});

test('doble toque: la misma respuesta (misma sesión y tarjeta) no escribe nada la segunda vez', async () => {
  const { real, commit } = await world();
  const card = await putCard(real);
  const first = await commit({ grade: grade(card, { result: 'wrong', ms: 5000 }), errors: [slip()] });
  const before = { cards: await real.get('cards', card.id), events: await count(real, 'events'), errors: await real.query('errors', {}) };
  const again = await commit({ grade: grade(card, { result: 'wrong', ms: 5000 }), errors: [slip()] });
  assert.equal(again.duplicate, true); assert.equal(again.cardSaved, false); assert.equal(again.card, null); assert.deepEqual(again.errors, []);
  assert.equal(again.event.id, first.event.id, 'devuelve el evento ya guardado');
  assert.equal(await count(real, 'events'), before.events);
  assert.deepEqual(await real.get('cards', card.id), before.cards, 'la tarjeta no se reprograma dos veces');
  assert.deepEqual(await real.query('errors', {}), before.errors, 'el error no se cuenta dos veces');
});

test('una respuesta de OTRA sesión a la misma tarjeta, o de la misma sesión a otra tarjeta, sí se guarda', async () => {
  const { real, commit } = await world();
  const a = await putCard(real, 'g.pp.0001'); const b = await putCard(real, 'g.pp.0002');
  await commit({ grade: grade(a) });
  assert.equal((await commit({ grade: grade(a, undefined, { sessionId: 'ses_2' }) })).duplicate, false);
  assert.equal((await commit({ grade: grade(b) })).duplicate, false);
  assert.equal(await count(real, 'events'), 3);
});

test('sin sessionId no se puede detectar el doble toque: escribe cada vez', async () => {
  const { real, commit } = await world();
  const card = await putCard(real);
  const g = grade(card, undefined, { sessionId: undefined });
  await commit({ grade: g }); await commit({ grade: g });
  assert.equal(await count(real, 'events'), 2);
});

test('Atómico (todo o nada): si falla la escritura del error, no queda ni el evento ni la tarjeta cambiada', async () => {
  const wrap = (db) => new Proxy(db, { get(target, prop) {
    if (prop !== 'tx') return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
    return (stores, fn) => target.tx(stores, (t) => fn(new Proxy(t, { get(tt, p) {
      if (p === 'put') return async (store, rec) => { if (store === 'errors') throw new DbError('QUOTA', 'cuota llena', { store }); return tt.put(store, rec); };
      return typeof tt[p] === 'function' ? tt[p].bind(tt) : tt[p];
    } })));
  } });
  const { real, commit } = await world({ wrapDb: wrap });
  const card = await putCard(real);
  const before = await real.get('cards', card.id);
  await assert.rejects(() => commit({ grade: grade(card, { result: 'wrong', ms: 5000 }), errors: [slip()] }), (e) => e instanceof DbError && e.code === 'QUOTA');
  assert.equal(await count(real, 'events'), 0, 'el evento no quedó');
  assert.equal(await count(real, 'errors'), 0);
  assert.deepEqual(await real.get('cards', card.id), before, 'la tarjeta quedó como estaba');
});

test('Atómico (todo o nada): si falla guardar la tarjeta, tampoco queda el evento', async () => {
  const wrap = (db) => new Proxy(db, { get(target, prop) {
    if (prop !== 'tx') return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
    return (stores, fn) => target.tx(stores, (t) => fn(new Proxy(t, { get(tt, p) {
      if (p === 'put') return async (store, rec) => { if (store === 'cards') throw new DbError('ABORTED', 'cortado', { store }); return tt.put(store, rec); };
      return typeof tt[p] === 'function' ? tt[p].bind(tt) : tt[p];
    } })));
  } });
  const { real, commit } = await world({ wrapDb: wrap });
  const card = await putCard(real);
  await assert.rejects(() => commit({ grade: grade(card) }), (e) => e instanceof DbError && e.code === 'ABORTED');
  assert.equal(await count(real, 'events'), 0);
});

test('una entrada mala lanza ANTES de tocar la base: evento inválido, error con código inexistente, error que no es objeto', async () => {
  const { real, commit } = await world();
  const card = await putCard(real);
  const g = grade(card);
  await assert.rejects(() => commit({ grade: { ...g, event: { ...g.event, result: 'inventado' } } }), (e) => e instanceof EventError);
  await assert.rejects(() => commit({ grade: g, errors: [slip({ code: 'NO.EXISTE' })] }), (e) => e.code === 'BAD_ERROR_RECORD');
  await assert.rejects(() => commit({ grade: g, errors: ['texto'] }), /objeto/);
  assert.equal(await count(real, 'events'), 0); assert.equal(await count(real, 'errors'), 0);
  assert.equal((await real.get('cards', card.id)).reps, 0);
});

test('argumentos inválidos: sin grade, sin tarjeta, tarjeta de otro evento, errors no lista, demasiados errores, errores sin catálogo', async () => {
  const w = await world(); const card = await putCard(w.real); const g = grade(card);
  await assert.rejects(() => w.commit(), /grade/);
  await assert.rejects(() => w.commit({ grade: { event: g.event } }), /grade/);
  await assert.rejects(() => w.commit({ grade: { ...g, card: { ...g.card, id: 'otra#0' } } }), /misma tarjeta/);
  await assert.rejects(() => w.commit({ grade: { card: g.card } }), /grade debe traer event y card/);
  await assert.rejects(() => w.commit({ grade: { ...g, card: { ...g.card, id: '' }, event: { ...g.event, cardId: '' } } }), /necesita un id/);
  await assert.rejects(() => w.commit({ grade: { ...g, card: { ...g.card, id: 12 }, event: { ...g.event, cardId: 12 } } }), /necesita un id/);
  await assert.rejects(() => w.commit({ grade: g, errors: 'x' }), /lista/);
  await assert.rejects(() => w.commit({ grade: g, errors: Array.from({ length: MAX_ERRORS_PER_ANSWER + 1 }, () => slip()) }), /demasiados/);
  const sin = await world({ withErrors: false }); const c2 = await putCard(sin.real);
  await assert.rejects(() => sin.commit({ grade: grade(c2), errors: [slip()] }), /no hay registro de errores/);
  assert.equal(await count(sin.real, 'events'), 0, 'rechazó sin guardar el evento');
  assert.equal(await count(w.real, 'events'), 0);
});

test('tarjeta suspendida o sin programar: el evento se guarda y la tarjeta NO se toca', async () => {
  const { real, commit } = await world();
  const card = srs.newCard('g.pp.0009', 0, NOW, [TOPIC]);
  const suspended = { ...card, suspended: true }; await real.put('cards', suspended);
  const g = grade(suspended);
  assert.equal(g.scheduled, false);
  const r = await commit({ grade: g });
  assert.equal(r.cardSaved, false); assert.equal(r.card, null); assert.equal(await count(real, 'events'), 1);
  assert.deepEqual(await real.get('cards', suspended.id), suspended);
});

test('varios errores en una respuesta se guardan juntos; repetir el mismo error con otro evento suma una ocurrencia', async () => {
  const { real, commit } = await world();
  const card = await putCard(real);
  const r = await commit({ grade: grade(card, { result: 'wrong', ms: 5000 }), errors: [slip(), slip({ original: 'He go to school', code: 'TNS.PERF_FORM', topics: [] })] });
  assert.equal(r.errors.length, 2); assert.equal(await count(real, 'errors'), 2);
  const later = { ...grade(card, { result: 'wrong', ms: 5000 }, { sessionId: 'ses_9' }) };
  later.event = { ...later.event, ts: '2026-10-26T16:00:00.000Z' };
  const r2 = await commit({ grade: later, errors: [slip()] });
  assert.equal(r2.errors[0].created, false); assert.equal(r2.errors[0].counted, true);
  assert.equal((await real.query('errors', { index: 'code', value: CODE }))[0].count, 2);
});

test('el dominio se invalida con los temas del evento y los de los errores, y solo cuando se guardó', async () => {
  const w = await world({ withBoard: true });
  const card = await putCard(w.real);
  await w.commit({ grade: grade(card, { result: 'wrong', ms: 5000 }), errors: [slip({ topics: ['gram.other.topic'] })] });
  assert.equal(w.invalidated.length, 1);
  assert.deepEqual([...w.invalidated[0]].sort(), [TOPIC, 'gram.other.topic'].sort());
  await w.commit({ grade: grade(card, { result: 'wrong', ms: 5000 }), errors: [slip()] }); // doble toque
  assert.equal(w.invalidated.length, 1, 'un doble toque no invalida nada');
});

test('si invalidar el dominio falla, la respuesta ya guardada no se pierde ni se rechaza', async () => {
  const real = createMemoryDb(); await real.open();
  const clock = makeClock(NOW.toISOString());
  const events = createEvents({ db: real, clock, rng: createRng(7) });
  const { commit } = createAnswerCommit({ db: real, events, errors: null, board: { invalidate: () => { throw new Error('caché rota'); } } });
  const card = await putCard(real);
  const r = await commit({ grade: grade(card) });
  assert.equal(r.duplicate, false); assert.equal(await count(real, 'events'), 1);
});

test('el constructor valida sus piezas y el objeto devuelto está congelado', async () => {
  const { real, events, errors } = await world();
  assert.throws(() => createAnswerCommit(), /db\.tx/);
  assert.throws(() => createAnswerCommit({ db: real }), /events\.prepare/);
  assert.throws(() => createAnswerCommit({ db: real, events: { prepare() {} } }), /insertIn/);
  assert.throws(() => createAnswerCommit({ db: real, events, errors: { prepare() {} } }), /applyIn/);
  assert.throws(() => createAnswerCommit({ db: real, events, errors, board: {} }), /invalidate/);
  assert.ok(Object.isFrozen(createAnswerCommit({ db: real, events })));
});

test('services: study.commit guarda la respuesta con los servicios reales y el dominio ve el cambio', async () => {
  const { createStudyServices } = await import('../app/services.js');
  const db = createMemoryDb(); await db.open();
  const topics = JSON.parse(fs.readFileSync(new URL('../content/taxonomy/topics.json', import.meta.url), 'utf8')).topics;
  const study = createStudyServices({ db, settings: null, catalog: CATALOG, topics, clock: makeClock(NOW.toISOString()), rng: createRng(3), log: () => {} });
  assert.equal(typeof study.commit, 'function');
  const card = await putCard(db);
  const r = await study.commit({ grade: grade(card, { result: 'wrong', ms: 5000 }), errors: [slip()] });
  assert.equal(r.duplicate, false);
  assert.equal((await study.events.byCard(card.id)).length, 1);
  const none = createStudyServices({ db: null, settings: null, catalog: null, topics: [], clock: makeClock(NOW.toISOString()), rng: createRng(3), log: () => {} });
  assert.equal(none.commit, null);
});

test('el tope de errores por respuesta es 20: con 20 se guarda y con 21 se rechaza sin escribir', async () => {
  assert.equal(MAX_ERRORS_PER_ANSWER, 20);
  const { real, commit } = await world();
  const card = await putCard(real);
  const mk = (n) => Array.from({ length: n }, (_, i) => slip({ original: `error número ${i}` }));
  await assert.rejects(() => commit({ grade: grade(card), errors: mk(21) }), /demasiados/);
  assert.equal(await count(real, 'events'), 0);
  const r = await commit({ grade: grade(card), errors: mk(20) });
  assert.equal(r.errors.length, 20); assert.equal(await count(real, 'errors'), 20);
});

test('un error que trae su propio ts o itemId los conserva (los del evento son solo el valor por defecto)', async () => {
  const { real, commit } = await world();
  const card = await putCard(real);
  const r = await commit({ grade: grade(card, { result: 'wrong', ms: 5000 }), errors: [slip({ ts: '2026-10-25T10:00:00.000Z', itemId: 'otro.item' })] });
  assert.equal(r.errors[0].record.ts, '2026-10-25T10:00:00.000Z');
  assert.equal(r.errors[0].record.itemId, 'otro.item');
});

test('abre la transacción solo con los almacenes que usa: sin registro de errores no incluye `errors`', async () => {
  const seen = [];
  const wrap = (db) => new Proxy(db, { get(target, prop) {
    if (prop !== 'tx') return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
    return (stores, fn) => { seen.push([...stores]); return target.tx(stores, fn); };
  } });
  const a = await world({ wrapDb: wrap, withErrors: false });
  await a.commit({ grade: grade(await putCard(a.real)) });
  assert.deepEqual(seen.at(-1), ['events', 'cards']);
  const b = await world({ wrapDb: wrap });
  await b.commit({ grade: grade(await putCard(b.real)) });
  assert.deepEqual(seen.at(-1), ['events', 'cards', 'errors']);
});

test('doble toque: un evento que no es respuesta (nota) con la misma sesión y tarjeta no lo bloquea', async () => {
  const { real, events, commit } = await world();
  const card = await putCard(real);
  await events.log({ type: 'note', responseRaw: 'apunte', sessionId: 'ses_1', cardId: card.id, itemId: card.itemId });
  const r = await commit({ grade: grade(card) });
  assert.equal(r.duplicate, false); assert.equal(await count(real, 'events'), 2);
});

test('doble toque: dos facetas del mismo ítem en la misma sesión son tarjetas distintas y las dos se guardan', async () => {
  const { real, commit } = await world();
  const f0 = srs.newCard('g.pp.0001', 0, NOW, [TOPIC]); const f1 = srs.newCard('g.pp.0001', 1, NOW, [TOPIC]);
  assert.notEqual(f0.id, f1.id);
  await real.put('cards', f0); await real.put('cards', f1);
  assert.equal((await commit({ grade: grade(f0) })).duplicate, false);
  assert.equal((await commit({ grade: grade(f1) })).duplicate, false);
  assert.equal(await count(real, 'events'), 2);
});

test('la tarjeta devuelta es una copia: cambiarla no cambia la de la calificación', async () => {
  const { real, commit } = await world();
  const card = await putCard(real);
  const g = grade(card);
  const r = await commit({ grade: g });
  assert.notEqual(r.card, g.card); assert.deepEqual(r.card, g.card);
});

test('un fallo que no es de la base (error cualquiera dentro de la transacción) sale como DbError UNKNOWN y no guarda nada', async () => {
  const wrap = (db) => new Proxy(db, { get(target, prop) {
    if (prop !== 'tx') return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
    return (stores, fn) => target.tx(stores, (t) => fn(new Proxy(t, { get(tt, p) {
      if (p === 'put') return async (store, rec) => { if (store === 'cards') throw new Error('algo raro'); return tt.put(store, rec); };
      return typeof tt[p] === 'function' ? tt[p].bind(tt) : tt[p];
    } })));
  } });
  const { real, commit } = await world({ wrapDb: wrap });
  const card = await putCard(real);
  await assert.rejects(() => commit({ grade: grade(card) }), (e) => e instanceof DbError && e.code === 'UNKNOWN');
  assert.equal(await count(real, 'events'), 0);
});
