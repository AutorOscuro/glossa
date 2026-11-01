// @purpose: Pruebas del cableado de servicios de estudio (app/services.js, 2.1-T1): con base, sin base, sin catálogo, el armador con ajustes y la carga de arranque con fetch simulado.
// 2.1-T1. Base en memoria, catálogo y temas reales, ajustes reales; el fetch y los reinicios de base son dobles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStudyServices, startServices, CATALOG_URL, TOPICS_URL } from '../app/services.js';
import { createMemoryDb } from '../core/db.memory.js';
import { createErrorCatalog } from '../core/errorCatalog.js';
import { createSettings } from '../core/settings.js';
import { createRng } from '../core/rng.js';
import { createState, transition } from '../core/sessionRunner.js';
import { localDay } from '../core/clock.js';
import { makeClock } from './_helpers.mjs';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const CATALOG_JSON = JSON.parse(read('content/taxonomy/error_codes.json'));
const TOPICS_JSON = JSON.parse(read('content/taxonomy/topics.json'));
const CATALOG = createErrorCatalog(CATALOG_JSON);
const TOPIC = 'gram.be.present_forms';

const answer = (over = {}) => ({
  type: 'answer', itemId: 'it001', cardId: 'it001#0', topics: [TOPIC], exerciseType: 'fix_error', result: 'correct', rating: 3, ms: 4000, mode: 'mech', channel: 'keyboard', ...over,
});

async function world({ withCatalog = true, withDb = true, settings = null } = {}) {
  const clock = makeClock('2026-10-26T15:00:00.000Z');
  let db = null;
  if (withDb) { db = createMemoryDb(); await db.open(); }
  const study = createStudyServices({ db, settings, catalog: withCatalog ? CATALOG : null, topics: TOPICS_JSON.topics, clock, rng: createRng(3), log: () => {} });
  return { db, clock, study };
}
const putCard = async (db, srs, clock, itemId, over = {}) => {
  const base = srs.newCard(itemId, 0, clock.now(), [TOPIC]);
  const card = { ...base, ...over };
  await db.put('cards', card);
  return card;
};

test('con base y catálogo: todos los servicios existen, el objeto está congelado y available es true', async () => {
  const { study } = await world();
  assert.equal(study.available, true);
  assert.deepEqual([...study.missing], []);
  for (const k of ['srs', 'events', 'errors', 'mastery', 'board', 'catalog', 'db', 'clock']) assert.ok(study[k], `falta ${k}`);
  assert.equal(typeof study.plan, 'function');
  assert.equal(study.topics.length, TOPICS_JSON.topics.length);
  assert.ok(Object.isFrozen(study) && Object.isFrozen(study.missing));
});

test('el registro de eventos queda unido al dominio: registrar por study.events.log invalida la caché del tema', async () => {
  const { study, db, clock } = await world();
  await putCard(db, study.srs, clock, 'it001');
  const first = await study.board.get(TOPIC, clock.now());
  assert.equal(first.evidence, 0); assert.equal(first.band, 'unseen');
  const saved = await study.events.log(answer());
  assert.equal(saved.itemId, 'it001');
  const second = await study.board.get(TOPIC, clock.now());
  assert.equal(second.evidence, 1, 'la caché vieja no debe sobrevivir al evento');
  assert.ok(second.pct > 0);
  assert.equal((await study.events.byTopic(TOPIC)).length, 1);
});

test('el registro de errores usa el catálogo real y un código desconocido se rechaza', async () => {
  const { study } = await world();
  const code = CATALOG.ids()[0];
  const out = await study.errors.record({ original: 'I am agree', code });
  assert.equal(out.created, true);
  await assert.rejects(() => study.errors.record({ original: 'x', code: 'NO.EXISTE' }), (e) => e.code === 'BAD_ERROR_RECORD');
});

test('sin base: srs y plan existen, lo demás es null y missing lo dice; el plan sale vacío con su razón', async () => {
  const { study } = await world({ withDb: false });
  assert.equal(study.available, false);
  assert.deepEqual([...study.missing], ['db']);
  assert.equal(study.db, null);
  for (const k of ['events', 'errors', 'mastery', 'board']) assert.equal(study[k], null, k);
  assert.equal(typeof study.srs.review, 'function');
  const plan = await study.plan();
  assert.equal(plan.count, 0);
  assert.equal(plan.reason.code, 'no_material');
});

test('sin catálogo: hay eventos pero no errores, dominio ni tablero; missing lista «catalog»', async () => {
  const { study } = await world({ withCatalog: false });
  assert.deepEqual([...study.missing], ['catalog']);
  assert.equal(study.available, false);
  assert.ok(study.events); for (const k of ['errors', 'mastery', 'board']) assert.equal(study[k], null, k);
  await study.events.log(answer()); // sigue registrando
  const none = await world({ withDb: false, withCatalog: false });
  assert.deepEqual([...none.study.missing], ['db', 'catalog']);
});

test('plan: lee las tarjetas de la base y ofrece repasos vencidos antes que nuevas', async () => {
  const { study, db, clock } = await world();
  const past = new Date(clock.now().getTime() - 3 * 86400000).toISOString();
  await putCard(db, study.srs, clock, 'dueA', { state: 2, due: past, reps: 3, stability: 4, difficulty: 5, last_review: past });
  await putCard(db, study.srs, clock, 'newB');
  const plan = await study.plan();
  assert.equal(plan.count, 2);
  assert.deepEqual(plan.items.map((i) => [i.itemId, i.kind]), [['dueA', 'review'], ['newB', 'new']]);
  assert.equal(plan.generatedAt, clock.now().toISOString());
});

test('plan: usa los ajustes (dailyNewCap 0 = sin nuevas) y las opciones los pisan', async () => {
  const settings = createSettings(); await settings.load();
  await settings.set('dailyNewCap', 0);
  const { study, db, clock } = await world({ settings });
  for (const id of ['n1', 'n2', 'n3']) await putCard(db, study.srs, clock, id);
  const none = await study.plan();
  assert.equal(none.count, 0); assert.equal(none.reason.code, 'nothing_due'); // el tope 0 viene del ajuste
  const some = await study.plan({ newCap: 2 });
  assert.equal(some.count, 2);
  const sized = await study.plan({ newCap: 3, size: 1 });
  assert.equal(sized.count, 1);
});

test('plan: no ofrece ítems retirados (content_cache) y es determinista con la misma semilla', async () => {
  const { study, db, clock } = await world();
  for (const id of ['k1', 'k2', 'k3']) await putCard(db, study.srs, clock, id);
  await db.put('content_cache', { pack_id: 'p1', version: 1, imported: clock.now().toISOString(), updated: clock.now().toISOString(), items: [{ id: 'k1', facet: 0 }], deprecated: ['k2'] });
  const a = await study.plan({ rng: createRng(9) });
  const b = await study.plan({ rng: createRng(9) });
  assert.deepEqual(a.items.map((i) => i.itemId), b.items.map((i) => i.itemId));
  assert.ok(!a.items.some((i) => i.itemId === 'k2'));
  assert.deepEqual(a.items.map((i) => i.itemId).sort(), ['k1', 'k3']);
});

test('plan: una opción inválida rechaza con el error del armador (nada se traga en silencio) y avisa por log', async () => {
  const logged = [];
  const db = createMemoryDb(); await db.open();
  const study = createStudyServices({ db, catalog: CATALOG, clock: makeClock(), log: (...a) => logged.push(a) });
  await assert.rejects(() => study.plan({ size: 0 }), /size/);
  assert.equal(logged.length, 1);
});

test('plan: no escribe nada en la base', async () => {
  const { study, db, clock } = await world();
  await putCard(db, study.srs, clock, 'solo');
  const before = JSON.stringify(await db.exportAll());
  await study.plan();
  const after = JSON.parse(JSON.stringify(await db.exportAll()));
  const strip = (x) => { const o = JSON.parse(x); delete o.exportedAt; return JSON.stringify(o); };
  assert.equal(strip(before), strip(JSON.stringify(after)));
});

// ---------- startServices ----------
const okFetch = (calls = []) => async (url) => {
  calls.push(url);
  if (url === CATALOG_URL) return { ok: true, json: async () => CATALOG_JSON };
  if (url === TOPICS_URL) return { ok: true, json: async () => TOPICS_JSON };
  return { ok: false, json: async () => ({}) };
};

test('startServices: espera la base y los ajustes, carga catálogo y temas y deja services.study', async () => {
  const db = createMemoryDb(); await db.open();
  const settings = createSettings(); await settings.load();
  const services = {};
  const calls = [];
  const study = await startServices({ storageReady: Promise.resolve({ db }), settingsReady: Promise.resolve({ settings }), services, fetchFn: okFetch(calls), clock: makeClock(), log: () => {} });
  assert.equal(services.study, study);
  assert.equal(study.available, true);
  assert.equal(study.settings, settings);
  assert.equal(study.db, db);
  assert.deepEqual(calls.sort(), [CATALOG_URL, TOPICS_URL].sort());
  assert.equal(study.topics.length, 248);
});

test('startServices nunca rechaza: base que no abrió, ajustes que fallan, fetch que falla o devuelve basura', async () => {
  const logged = [];
  const log = (...a) => logged.push(a);
  const clock = makeClock();
  const badFetches = [
    async () => { throw new Error('sin red'); },
    async () => ({ ok: false, status: 404, json: async () => ({}) }),
    async () => ({ ok: true, json: async () => { throw new SyntaxError('JSON roto'); } }),
    async () => ({ ok: true, json: async () => ({ codes: 'no es lista' }) }),
    async () => undefined,
  ];
  for (const fetchFn of badFetches) {
    const services = {};
    const study = await startServices({ storageReady: Promise.resolve({ db: null }), settingsReady: Promise.resolve({ settings: null }), services, fetchFn, clock, log });
    assert.equal(services.study, study);
    assert.deepEqual([...study.missing], ['db', 'catalog']);
    assert.deepEqual(study.topics, []);
    assert.equal((await study.plan()).count, 0);
  }
  const s2 = {};
  const study = await startServices({ storageReady: Promise.reject(new Error('base caída')), settingsReady: Promise.reject(new Error('ajustes caídos')), services: s2, fetchFn: okFetch(), clock, log });
  assert.equal(s2.study, study); assert.equal(study.db, null); assert.equal(study.settings, null);
  assert.ok(logged.length >= 5);
  const s3 = {};
  const noFetch = await startServices({ storageReady: Promise.resolve({ db: null }), settingsReady: Promise.resolve({}), services: s3, fetchFn: null, clock, log });
  assert.equal(s3.study, noFetch); assert.equal(noFetch.catalog, null);
});

test('startServices: si el catálogo falla pero la base abre, el estudio queda a medias (eventos sí, errores no) y los temas cargan por separado', async () => {
  const db = createMemoryDb(); await db.open();
  const fetchFn = async (url) => (url === CATALOG_URL ? { ok: false, json: async () => ({}) } : okFetch()(url));
  const study = await startServices({ storageReady: Promise.resolve({ db }), settingsReady: Promise.resolve({ settings: null }), services: {}, fetchFn, clock: makeClock(), log: () => {} });
  assert.deepEqual([...study.missing], ['catalog']);
  assert.ok(study.events); assert.equal(study.errors, null);
  assert.equal(study.topics.length, 248);
});

test('startServices: los mensajes de log no llevan secretos de los ajustes', async () => {
  const settings = createSettings(); await settings.load();
  await settings.set('aiKey', 'clave-de-prueba-123');
  const logged = [];
  await startServices({ storageReady: Promise.resolve({ db: null }), settingsReady: Promise.resolve({ settings }), services: {}, fetchFn: async () => { throw new Error('sin red'); }, clock: makeClock(), log: (...a) => logged.push(a) });
  assert.ok(logged.length > 0);
  assert.ok(!JSON.stringify(logged.map((l) => l.map(String))).includes('clave-de-prueba-123'));
});

test('main.js arranca los servicios de estudio tras la base y los ajustes y los deja en services.studyReady', () => {
  const main = read('app/main.js');
  assert.match(main, /import \{ startServices \} from '\.\/services\.js'/);
  assert.match(main, /app\.services\.studyReady = startServices\(\{ storageReady: app\.services\.storageReady, settingsReady: app\.services\.settingsReady, services: app\.services \}\)/);
});

// ── 2.1-T2: newToday y reviewsToday salen de los eventos de hoy ──
const LOCAL_NOON = (offsetDays = 0) => new Date(2026, 9, 26 + offsetDays, 12, 0, 0).toISOString();
async function worldLocal(opts = {}) {
  const db = createMemoryDb(); await db.open();
  const clock = makeClock(new Date(2026, 9, 26, 15, 0, 0).toISOString());
  const study = createStudyServices({ db, settings: opts.settings ?? null, catalog: CATALOG, topics: TOPICS_JSON.topics, clock, rng: createRng(3), log: opts.log ?? (() => {}) });
  return { db, clock, study };
}

test('plan: las tarjetas nuevas ya introducidas hoy se descuentan del tope diario', async () => {
  const { study, db, clock } = await worldLocal();
  const cards = [];
  for (const id of ['n1', 'n2', 'n3', 'n4']) cards.push(await putCard(db, study.srs, clock, id));
  await study.events.log(answer({ itemId: 'n1', cardId: cards[0].id, ts: LOCAL_NOON(0) }));
  const sinTope = await study.plan({ newCap: 3 });
  assert.equal(sinTope.count, 2, 'tope 3 − 1 introducida hoy = 2 nuevas (n1 ya no cuenta como nueva disponible)');
  const todas = await study.plan({ newCap: 3, newToday: 0 });
  assert.equal(todas.count, 3, 'si las opciones traen newToday, mandan sobre el conteo');
});

test('plan: con el tope de nuevas gastado hoy la razón es new_cap_reached', async () => {
  const { study, db, clock } = await worldLocal();
  const cards = [];
  for (const id of ['m1', 'm2', 'm3']) cards.push(await putCard(db, study.srs, clock, id));
  await study.events.log(answer({ itemId: 'm1', cardId: cards[0].id, ts: LOCAL_NOON(0) }));
  const plan = await study.plan({ newCap: 1, items: undefined });
  assert.equal(plan.count, 0);
  assert.equal(plan.reason.code, 'new_cap_reached');
});

test('plan: los repasos de hoy se restan del cupo diario de repasos', async () => {
  const { study, db, clock } = await worldLocal();
  const past = new Date(2026, 9, 20, 9, 0, 0);
  const due = [];
  for (const id of ['v1', 'v2', 'v3', 'v4']) due.push(await putCard(db, study.srs, clock, id, { state: 2, stability: 5, difficulty: 5, reps: 3, due: past.toISOString(), last_review: past.toISOString() }));
  await study.events.log(answer({ itemId: 'v1', cardId: due[0].id, ts: LOCAL_NOON(-6) }));
  await study.events.log(answer({ itemId: 'v1', cardId: due[0].id, ts: LOCAL_NOON(0) }));
  const plan = await study.plan({ reviewCap: 3 });
  assert.equal(plan.count, 2, 'cupo 3 − 1 repaso hecho hoy');
  assert.equal((await study.plan({ reviewCap: 3, reviewsToday: 0 })).count, 3);
});

test('plan: la práctica extra (repaso adelantado) de hoy NO se resta del cupo diario de repasos', async () => {
  const { study, db, clock } = await worldLocal();
  const past = new Date(2026, 9, 20, 9, 0, 0);
  const due = [];
  for (const id of ['x1', 'x2', 'x3', 'x4']) due.push(await putCard(db, study.srs, clock, id, { state: 2, stability: 5, difficulty: 5, reps: 3, due: past.toISOString(), last_review: past.toISOString() }));
  await study.events.log(answer({ itemId: 'x1', cardId: due[0].id, ts: LOCAL_NOON(-6) }));
  await study.events.log(answer({ itemId: 'x1', cardId: due[0].id, ts: LOCAL_NOON(0), early: true }));
  assert.equal((await study.plan({ reviewCap: 3 })).count, 3, 'la práctica adelantada no gasta cupo: siguen los 3');
  await study.events.log(answer({ itemId: 'x2', cardId: due[1].id, ts: LOCAL_NOON(-6) }));
  await study.events.log(answer({ itemId: 'x2', cardId: due[1].id, ts: LOCAL_NOON(0) }));
  assert.equal((await study.plan({ reviewCap: 3 })).count, 2, 'un repaso a tiempo sí gasta uno');
});

test('plan: si no se puede contar lo de hoy, avisa por log y sigue con 0 (no rompe el plan)', async () => {
  const db = createMemoryDb(); await db.open();
  const clock = makeClock(new Date(2026, 9, 26, 15, 0, 0).toISOString());
  const broken = { ...db, query: (store, ...rest) => (store === 'events' ? Promise.reject(new Error('base caída')) : db.query(store, ...rest)) };
  Object.setPrototypeOf(broken, db);
  const logs = [];
  const study = createStudyServices({ db: broken, settings: null, catalog: CATALOG, topics: TOPICS_JSON.topics, clock, rng: createRng(3), log: (...a) => logs.push(a) });
  await putCard(broken, study.srs, clock, 'z1');
  const plan = await study.plan({ newCap: 2 });
  assert.equal(plan.count, 1);
  assert.ok(logs.some((a) => /contar lo estudiado hoy/.test(a[0])));
});

test('plan: sin base no intenta contar lo de hoy ni avisa por log', async () => {
  const logs = [];
  const study = createStudyServices({ db: null, settings: null, catalog: null, topics: [], clock: makeClock(new Date(2026, 9, 26, 15, 0, 0).toISOString()), rng: createRng(3), log: (...a) => logs.push(a) });
  const plan = await study.plan();
  assert.equal(plan.count, 0);
  assert.equal(plan.reason.code, 'no_material');
  assert.deepEqual(logs, []);
});

test('session: con base se puede guardar y restaurar una sesión a mitad por services.study', async () => {
  const { study } = await world();
  assert.equal(typeof study.session.save, 'function'); assert.equal(typeof study.session.load, 'function'); assert.equal(typeof study.session.clear, 'function');
  const state = transition(createState(), { type: 'START', total: 1 }).state;
  await study.session.save({ sessionId: 's1', state, items: [{ cardId: 'it001#0', itemId: 'it001' }] });
  const out = await study.session.load();
  assert.equal(out.status, 'restored'); assert.equal(out.sessionId, 's1'); assert.equal(out.items[0].cardId, 'it001#0');
});

test('session: usa el reloj de los servicios (una sesión vieja caduca) y sin base es null', async () => {
  const { study, clock } = await world();
  const state = transition(createState(), { type: 'START', total: 1 }).state;
  await study.session.save({ sessionId: 's1', state, items: [{ cardId: 'a#0', itemId: 'a' }] });
  clock.advance(13 * 3600 * 1000);
  assert.equal((await study.session.load()).status, 'expired');
  const none = await world({ withDb: false });
  assert.equal(none.study.session, null);
});

// ---------- foto diaria de dominio ----------
const logAnswer = (study, over = {}) => study.events.log(answer(over));

test('snapshot: existe con base, catálogo y temas; es null sin base, sin catálogo o sin temas', async () => {
  const full = await world();
  for (const k of ['take', 'takeIfMissing', 'list']) assert.equal(typeof full.study.snapshot[k], 'function');
  assert.equal(typeof full.study.finish, 'function');
  const noDb = await world({ withDb: false });
  assert.equal(noDb.study.snapshot, null); assert.equal(noDb.study.finish === undefined, false); assert.equal(await noDb.study.finish(), null);
  const noCat = await world({ withCatalog: false });
  assert.equal(noCat.study.snapshot, null);
  const db = createMemoryDb(); await db.open();
  const noTopics = createStudyServices({ db, catalog: CATALOG, topics: [], clock: makeClock(), log: () => {} });
  assert.equal(noTopics.snapshot, null);
  assert.deepEqual(await noTopics.finish(), { cleared: false, snapshot: null, snapshotError: null });
});

test('finish: borra la sesión guardada y toma la foto del día con los temas que tienen respuestas', async () => {
  const { study, db, clock } = await world();
  await logAnswer(study);
  const state = transition(createState(), { type: 'START', total: 1 }).state;
  await study.session.save({ sessionId: 's1', state, items: [{ cardId: 'it001#0', itemId: 'it001' }] });
  const out = await study.finish();
  assert.equal(out.cleared, true); assert.equal(out.snapshotError, null);
  assert.equal(out.snapshot.saved, true); assert.equal(out.snapshot.count, 1);
  assert.equal((await study.session.load()).status, 'none');
  const day = out.snapshot.day;
  assert.equal(day, localDay(clock.now()));
  assert.equal((await db.get('meta', `mastery_snap:${day}`)).results[0].topicId, TOPIC);
  assert.equal(clock.now() instanceof Date, true);
});

test('finish: sin respuestas no guarda foto y repetirlo el mismo día no cambia nada', async () => {
  const { study } = await world();
  const first = await study.finish();
  assert.deepEqual([first.cleared, first.snapshot.saved], [false, false]);
  await logAnswer(study);
  const a = await study.finish(); const b = await study.finish();
  assert.equal(a.snapshot.changed, true); assert.equal(b.snapshot.changed, false); assert.equal(b.snapshot.saved, true);
});

test('finish: si la foto falla avisa por log, no rechaza y deja la sesión borrada', async () => {
  const clock = makeClock('2026-10-26T15:00:00.000Z');
  const real = createMemoryDb(); await real.open();
  const db = { ...real, put: async (store, rec) => { if (store === 'meta' && String(rec?.key).startsWith('mastery_snap:')) throw new Error('cuota llena'); return real.put(store, rec); } };
  const logs = [];
  const study = createStudyServices({ db, catalog: CATALOG, topics: TOPICS_JSON.topics, clock, rng: createRng(3), log: (...a) => logs.push(a) });
  await logAnswer(study);
  const state = transition(createState(), { type: 'START', total: 1 }).state;
  await study.session.save({ sessionId: 's1', state, items: [{ cardId: 'it001#0', itemId: 'it001' }] });
  const out = await study.finish();
  assert.deepEqual([out.cleared, out.snapshot], [true, null]); assert.match(out.snapshotError, /cuota llena/);
  assert.equal(logs.length, 1); assert.match(String(logs[0][0]), /foto diaria/);
  assert.equal((await study.session.load()).status, 'none');
});

test('finish: si no se puede borrar la sesión guardada, rechaza (no se oculta un fallo de la base)', async () => {
  const real = createMemoryDb(); await real.open();
  const db = { ...real, delete: async () => { throw new Error('base cerrada'); } };
  const study = createStudyServices({ db, catalog: CATALOG, topics: TOPICS_JSON.topics, clock: makeClock(), log: () => {} });
  const state = transition(createState(), { type: 'START', total: 1 }).state;
  await study.session.save({ sessionId: 's1', state, items: [{ cardId: 'a#0', itemId: 'a' }] });
  await assert.rejects(() => study.finish(), /base cerrada/);
});

test('startServices: el primer arranque del día toma la foto (services.snapshotReady) y el segundo no la repite', async () => {
  const db = createMemoryDb(); await db.open();
  const settings = createSettings(); await settings.load();
  const clock = makeClock('2026-10-26T15:00:00.000Z');
  const boot = async () => { const services = {}; const study = await startServices({ storageReady: Promise.resolve({ db }), settingsReady: Promise.resolve({ settings }), services, fetchFn: okFetch([]), clock, log: () => {} }); return { services, study }; };
  const first = await boot();
  assert.equal((await first.services.snapshotReady).saved, false);
  await first.study.events.log(answer());
  const second = await boot();
  const r2 = await second.services.snapshotReady;
  assert.deepEqual([r2.saved, r2.changed], [true, true]);
  const third = await boot();
  const r3 = await third.services.snapshotReady;
  assert.deepEqual([r3.saved, r3.changed, r3.count], [false, false, 1]);
});

test('startServices: snapshotReady nunca rechaza aunque la foto falle y vale null sin base', async () => {
  const real = createMemoryDb(); await real.open();
  const db = { ...real, get: async (store, key) => { if (store === 'meta' && String(key).startsWith('mastery_snap:')) throw new Error('meta rota'); return real.get(store, key); } };
  const settings = createSettings(); await settings.load();
  const logs = [];
  const services = {};
  await startServices({ storageReady: Promise.resolve({ db }), settingsReady: Promise.resolve({ settings }), services, fetchFn: okFetch([]), clock: makeClock(), log: (...a) => logs.push(a) });
  assert.equal(await services.snapshotReady, null);
  assert.equal(logs.length, 1); assert.match(String(logs[0][0]), /foto diaria/);
  const none = {};
  const noneLogs = [];
  await startServices({ storageReady: Promise.resolve({ db: null }), settingsReady: Promise.resolve({ settings }), services: none, fetchFn: okFetch([]), clock: makeClock(), log: (...x) => noneLogs.push(String(x[0])) });
  assert.equal(await none.snapshotReady, null);
  assert.equal(noneLogs.some((m) => /foto diaria/.test(m)), false);
});

test('srs de los servicios lleva la protección de repasos adelantados: un fallo en menos de 24 h reinicia', async () => {
  const { study } = await world();
  const t0 = new Date('2026-01-01T10:00:00.000Z');
  let c = study.srs.newCard('it', 0, t0, [TOPIC]); let now = t0;
  for (let i = 0; i < 3; i++) { c = study.srs.review(c, 3, now); now = new Date(c.due); }
  const t = new Date(Date.parse(c.last_review) + 2 * 3600000);
  const failed = study.srs.review(c, 1, t);
  assert.ok((Date.parse(failed.due) - t.getTime()) / 86400000 <= 5);
  assert.equal(study.srs.engine(), 'fsrs');
});
