// @purpose: Pruebas de la importación de paquetes a la base (core/contentImport.js e importPacksToDb).
// Pruebas de core/contentImport.js y de importPacksToDb (subparte 1.3, cuarto 4, mitad 4A, parte 2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importPackToDb, importPacksToDb, deprecatedItemIds, cardIdOf, initialCard, packPath } from '../core/content.js';
import { createMemoryDb } from '../core/db.memory.js';
import { errorCodeSet } from '../core/contentCodes.js';
import { topicIdSet, topicInfo } from '../core/contentTaxonomy.js';
import { loadSample, loadTaxonomyFixtures } from './_samplePack.mjs';
import { makeClock } from './_helpers.mjs';

const T0 = new Date('2026-10-18T10:00:00.000Z');
const T1 = new Date('2026-10-19T10:00:00.000Z');
async function newDb(opts) { const db = createMemoryDb(opts); await db.open(); return db; }
const cards = (db) => db.query('cards', {});
const cacheOf = (db, id = 'sample_pack_v1') => db.get('content_cache', id);
const idsOf = (pack) => pack.items.map((i) => i.id);
const res = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });
const tax = () => { const t = loadTaxonomyFixtures(); return { errorCodes: errorCodeSet(t.errorCodes), topicIds: topicIdSet(t.topics), topicInfo: topicInfo(t.topics) }; };

// ---------- caso feliz ----------
test('importa un paquete nuevo: una tarjeta por ítem con los valores iniciales de 8.4 y un registro en content_cache', async () => {
  const db = await newDb();
  const pack = loadSample();
  const r = await importPackToDb(db, pack, { now: T0 });
  assert.deepEqual([r.ok, r.status, r.cardsRetopiced, r.deprecated, r.reactivated], [true, 'new', 0, [], []]);
  const all = await cards(db);
  const questions = pack.stories.reduce((n, s) => n + s.questions.length, 0);
  assert.equal(r.cardsCreated, pack.items.length + questions);
  assert.equal(all.length, r.cardsCreated);
  const c = await db.get('cards', cardIdOf(pack.items[0].id, pack.items[0].facet));
  assert.deepEqual(c, {
    id: `${pack.items[0].id}#0`, itemId: pack.items[0].id, facet: 0, topics: pack.items[0].topics,
    state: 0, due: T0.toISOString(), stability: 0, difficulty: 0, reps: 0, lapses: 0, last_review: null,
    suspended: false, leech: false, fav: false, created: T0.toISOString(),
  });
  const rec = await cacheOf(db);
  assert.deepEqual([rec.version, rec.imported, rec.updated, rec.items.length, rec.deprecated], [1, T0.toISOString(), T0.toISOString(), r.cardsCreated, []]);
});

test('las preguntas de las historias también reciben tarjeta', async () => {
  const db = await newDb();
  const pack = loadSample();
  await importPackToDb(db, pack, { now: T0 });
  for (const s of pack.stories) for (const q of s.questions) assert.ok(await db.get('cards', cardIdOf(q.id, q.facet)), q.id);
});

test('una faceta de verbo (0, 1, 2) da la tarjeta itemId#faceta', async () => {
  const db = await newDb();
  const pack = loadSample();
  pack.items[0].facet = 2; pack.items[1].facet = 1;
  await importPackToDb(db, pack, { now: T0 });
  assert.ok(await db.get('cards', `${pack.items[0].id}#2`));
  assert.ok(await db.get('cards', `${pack.items[1].id}#1`));
  assert.equal(await db.get('cards', `${pack.items[0].id}#0`), null);
});

// ---------- idempotencia ----------
test('reimportar lo mismo no cambia nada: ni tarjetas ni content_cache (huella idéntica), status unchanged', async () => {
  const db = await newDb();
  const pack = loadSample();
  await importPackToDb(db, pack, { now: T0 });
  const before = JSON.stringify([await cards(db), await cacheOf(db)]);
  let writes = 0;
  db.setWriteHook(() => { writes += 1; });
  const r = await importPackToDb(db, pack, { now: T1 });
  assert.deepEqual([r.ok, r.status, r.cardsCreated, r.cardsRetopiced, r.deprecated, r.reactivated], [true, 'unchanged', 0, 0, [], []]);
  assert.equal(JSON.stringify([await cards(db), await cacheOf(db)]), before);
  assert.equal(writes, 0, 'una transacción sin cambios no escribe');
});

test('reimportar NO pisa el progreso de una tarjeta (reps, estabilidad, fav, suspended…)', async () => {
  const db = await newDb();
  const pack = loadSample();
  await importPackToDb(db, pack, { now: T0 });
  const id = cardIdOf(pack.items[0].id, pack.items[0].facet);
  const worked = { ...(await db.get('cards', id)), state: 2, reps: 7, lapses: 2, stability: 31.5, difficulty: 4.2, last_review: '2026-10-18T09:00:00.000Z', due: '2026-11-18T00:00:00.000Z', fav: true, suspended: true, leech: true };
  await db.put('cards', worked);
  await importPackToDb(db, pack, { now: T1 });
  assert.deepEqual(await db.get('cards', id), worked);
});

test('si falta una tarjeta (borrada a mano) la siguiente importación la recrea y el resto queda igual', async () => {
  const db = await newDb();
  const pack = loadSample();
  await importPackToDb(db, pack, { now: T0 });
  const gone = cardIdOf(pack.items[3].id, pack.items[3].facet);
  const keep = await db.get('cards', cardIdOf(pack.items[4].id, pack.items[4].facet));
  await db.delete('cards', gone);
  const r = await importPackToDb(db, pack, { now: T1 });
  assert.deepEqual([r.status, r.cardsCreated], ['updated', 1]);
  assert.equal((await db.get('cards', gone)).created, T1.toISOString());
  assert.deepEqual(await db.get('cards', keep.id), keep);
  assert.equal((await cacheOf(db)).imported, T0.toISOString(), 'imported no cambia');
});

// ---------- migración de paquete v1 → v2 → v3 (simulada) ----------
test('v1→v2: ítem nuevo = tarjeta nueva; ítem retirado = deprecated (tarjeta e historial intactos); tema cambiado = solo topics', async () => {
  const db = await newDb();
  const v1 = loadSample();
  await importPackToDb(db, v1, { now: T0 });
  const retired = v1.items[0];
  const retiredCard = { ...(await db.get('cards', cardIdOf(retired.id, retired.facet))), reps: 5, stability: 12, state: 2 };
  await db.put('cards', retiredCard);
  await db.put('events', { id: 'evt_1', ts: T0.toISOString(), day: '2026-10-18', cardId: retiredCard.id, itemId: retired.id, type: 'answer', topics: retired.topics });
  const moved = v1.items[1];
  const movedBefore = { ...(await db.get('cards', cardIdOf(moved.id, moved.facet))), reps: 3 };
  await db.put('cards', movedBefore);

  const v2 = structuredClone(v1);
  v2.version = 2;
  v2.items = v2.items.filter((i) => i.id !== retired.id);
  const added = { ...structuredClone(v1.items[2]), id: 'g.samp.9001' };
  v2.items.push(added);
  v2.items.find((i) => i.id === moved.id).topics = ['gram.modals.no_to'];

  const r = await importPackToDb(db, v2, { now: T1 });
  assert.deepEqual([r.ok, r.status, r.version, r.cardsCreated, r.cardsRetopiced, r.deprecated, r.reactivated], [true, 'updated', 2, 1, 1, [retired.id], []]);
  assert.deepEqual(await db.get('cards', retiredCard.id), retiredCard, 'la tarjeta retirada sigue ahí con su progreso');
  assert.ok(await db.get('events', 'evt_1'), 'los eventos no se tocan');
  assert.ok(await db.get('cards', `${added.id}#0`));
  assert.deepEqual(await db.get('cards', movedBefore.id), { ...movedBefore, topics: ['gram.modals.no_to'] }, 'solo cambian los temas');
  const rec = await cacheOf(db);
  assert.deepEqual([rec.version, rec.imported, rec.updated, rec.deprecated], [2, T0.toISOString(), T1.toISOString(), [retired.id]]);
  assert.ok(!rec.items.some((i) => i.id === retired.id) && rec.items.some((i) => i.id === added.id));
  assert.deepEqual([...(await deprecatedItemIds(db))], [retired.id]);

  // reimportar v2 es idempotente y NO vuelve a anunciar el retiro
  const again = await importPackToDb(db, v2, { now: new Date('2026-10-20T10:00:00.000Z') });
  assert.deepEqual([again.status, again.deprecated, again.cardsCreated], ['unchanged', [], 0]);
});

test('v3 vuelve a traer un ítem retirado: se reactiva (sale de deprecated) y conserva su tarjeta', async () => {
  const db = await newDb();
  const v1 = loadSample();
  await importPackToDb(db, v1, { now: T0 });
  const id = v1.items[0].id;
  const v2 = { ...structuredClone(v1), version: 2, items: v1.items.slice(1) };
  await importPackToDb(db, v2, { now: T0 });
  const progress = { ...(await db.get('cards', `${id}#0`)), reps: 9 };
  await db.put('cards', progress);
  const v3 = { ...structuredClone(v1), version: 3 };
  const r = await importPackToDb(db, v3, { now: T1 });
  assert.deepEqual([r.status, r.reactivated, r.deprecated, r.cardsCreated], ['updated', [id], [], 0]);
  assert.deepEqual(await db.get('cards', `${id}#0`), progress);
  assert.deepEqual((await cacheOf(db)).deprecated, []);
  assert.equal((await deprecatedItemIds(db)).size, 0);
});

test('importar una versión MENOR que la instalada no hace nada (status older)', async () => {
  const db = await newDb();
  const v1 = loadSample();
  const v2 = { ...structuredClone(v1), version: 2, items: v1.items.slice(1) };
  await importPackToDb(db, v2, { now: T0 });
  const before = JSON.stringify([await cards(db), await cacheOf(db)]);
  const r = await importPackToDb(db, v1, { now: T1 });
  assert.deepEqual([r.ok, r.status, r.version, r.cardsCreated], [true, 'older', 2, 0]);
  assert.equal(JSON.stringify([await cards(db), await cacheOf(db)]), before);
});

test('un ítem que otro paquete instalado sigue trayendo NO se marca deprecated al salir de este', async () => {
  const db = await newDb();
  const a = loadSample();
  await importPackToDb(db, a, { now: T0 });
  const shared = a.items[0];
  const b = { ...structuredClone(a), pack_id: 'otro_pack_v1', version: 1, items: [structuredClone(shared)], stories: [], lexicon: [] };
  await importPackToDb(db, b, { now: T0 });
  const a2 = { ...structuredClone(a), version: 2, items: a.items.slice(1) };
  const r = await importPackToDb(db, a2, { now: T1 });
  assert.deepEqual(r.deprecated, []);
  assert.equal((await deprecatedItemIds(db)).has(shared.id), false);
});

// ---------- atomicidad ----------
test('si la base falla a mitad, no queda NADA a medias (ni tarjetas ni registro) y devuelve error DB amable', async () => {
  const db = await newDb({ onWrite: () => { throw new Error('quota exceeded'); } });
  const r = await importPackToDb(db, loadSample(), { now: T0 });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'DB');
  assert.match(r.error.message, /espacio|guardar|inténtalo/i);
  db.setWriteHook(null);
  assert.deepEqual([(await cards(db)).length, await cacheOf(db)], [0, null]);
  const ok = await importPackToDb(db, loadSample(), { now: T0 });
  assert.equal(ok.ok, true, 'reintentar funciona');
});

// ---------- entradas inválidas / hostiles ----------
test('argumentos y paquetes inválidos devuelven error con código, sin lanzar y sin escribir', async () => {
  const db = await newDb();
  const base = loadSample();
  const bad = (mut) => { const p = structuredClone(base); mut(p); return p; };
  const code = async (pack, o = { now: T0 }, d = db) => (await importPackToDb(d, pack, o)).error.code;
  assert.equal(await code(base, {}), 'BAD_ARGS');
  assert.equal((await importPackToDb(db, base)).error.code, 'BAD_ARGS');
  assert.equal(await code(base, { now: 'ayer' }), 'BAD_ARGS');
  assert.equal(await code(base, { now: T0 }, null), 'BAD_ARGS');
  for (const p of [null, 5, [], 'x', {}, bad((x) => { x.pack_id = 'Mal-Id'; }), bad((x) => { x.version = 0; }), bad((x) => { x.version = 1.5; }),
    bad((x) => { x.items = 'no'; }), bad((x) => { x.stories = 'no'; }), bad((x) => { x.items[0].id = 'Mal#Id'; }), bad((x) => { x.items[0].id = 7; }),
    bad((x) => { x.items[0].facet = 3; }), bad((x) => { x.items[0].facet = '1'; }), bad((x) => { x.items[0].topics = []; }), bad((x) => { x.items[0].topics = [1]; }),
    bad((x) => { x.items[1].id = x.items[0].id; }), bad((x) => { x.items[0] = null; })]) {
    assert.equal(await code(p), 'BAD_PACK', JSON.stringify(p)?.slice(0, 60));
  }
  assert.deepEqual([(await cards(db)).length, await cacheOf(db)], [0, null]);
});

test('un paquete con getters hostiles o anidación enorme no hace lanzar la función', async () => {
  const db = await newDb();
  const hostile = loadSample();
  Object.defineProperty(hostile.items[0], 'topics', { get() { throw new Error('boom'); }, enumerable: true });
  const r = await importPackToDb(db, hostile, { now: T0 });
  assert.equal(r.ok, false);
  assert.ok(['BAD_PACK', 'DB'].includes(r.error.code));
});

test('un registro dañado en content_cache no rompe la importación (cuenta como sin historial)', async () => {
  const db = await newDb();
  await db.put('content_cache', { pack_id: 'sample_pack_v1', version: 1 }); // sin items ni deprecated
  await db.put('content_cache', { pack_id: 'basura_v1', version: 'x', items: 5 });
  const r = await importPackToDb(db, loadSample(), { now: T0 });
  assert.equal(r.ok, true);
  assert.ok(r.cardsCreated > 0);
  assert.ok(Array.isArray((await cacheOf(db)).items));
  assert.equal((await deprecatedItemIds(db)).size, 0);
});

test('texto con acentos, ñ y emoji en los temas no afecta: solo cuentan ids', async () => {
  const db = await newDb();
  const p = loadSample();
  p.title_es = 'Tiempos perfectos — niño 🎉';
  const r = await importPackToDb(db, p, { now: T0 });
  assert.equal(r.ok, true);
});

test('rendimiento: 5.000 ítems se importan en una transacción (< 3 s) y reimportar tarda poco', async () => {
  const db = await newDb();
  const base = loadSample();
  const big = { ...base, pack_id: 'grande_v1', stories: [], items: Array.from({ length: 5000 }, (_, i) => ({ ...structuredClone(base.items[0]), id: `g.big.${String(i + 1).padStart(4, '0')}` })) };
  let t = Date.now();
  const r = await importPackToDb(db, big, { now: T0 });
  assert.equal(r.cardsCreated, 5000);
  assert.ok(Date.now() - t < 3000, `tardó ${Date.now() - t} ms`);
  t = Date.now();
  assert.equal((await importPackToDb(db, big, { now: T1 })).status, 'unchanged');
  assert.ok(Date.now() - t < 3000);
});

test('reloj: now como Date, número o ISO da la misma hora guardada; fechas absurdas no corrompen', async () => {
  for (const now of [T0, T0.getTime(), T0.toISOString()]) {
    const db = await newDb();
    await importPackToDb(db, loadSample(), { now });
    assert.equal((await cards(db))[0].created, T0.toISOString());
  }
  const db = await newDb();
  assert.equal((await importPackToDb(db, loadSample(), { now: new Date('1999-01-01T00:00:00Z') })).ok, true);
  const clock = makeClock();
  assert.equal(initialCard({ id: 'a.b', facet: null, topics: ['x.y'] }, clock.now()).due, clock.iso());
});

// ---------- importPacksToDb (índice → paquetes → base) ----------
const entry = (over = {}) => ({ pack_id: 'sample_pack_v1', version: 1, path: packPath('sample_pack_v1'), topics: ['gram.present_perfect.for_since'], items_count: 21, size_kb: 21, ...over });
const fakeFetch = (routes) => { const calls = []; const f = async (url) => { calls.push(url); const r = routes[url]; return r === undefined ? res('no', 404) : (typeof r === 'function' ? r() : r); }; f.calls = calls; return f; };
const routes = (pack = loadSample(), e = entry()) => ({ 'content/index.json': res({ schema: 1, packs: [e] }), [packPath(pack.pack_id)]: res(pack) });

test('importPacksToDb: caso feliz e idempotencia: la segunda vez no descarga el paquete', async () => {
  const db = await newDb();
  const f = fakeFetch(routes());
  const r = await importPacksToDb(db, f, { now: T0, ctx: tax() });
  assert.deepEqual([r.ok, r.missing, r.failed, r.results.map((x) => x.status)], [true, false, [], ['new']]);
  assert.equal(f.calls.length, 2);
  const f2 = fakeFetch(routes());
  const r2 = await importPacksToDb(db, f2, { now: T1, ctx: tax() });
  assert.deepEqual([r2.ok, r2.results[0].status, r2.results[0].skipped], [true, 'unchanged', true]);
  assert.deepEqual(f2.calls, ['content/index.json'], 'sin descargar el paquete (abre sin conexión)');
  const r3 = await importPacksToDb(db, fakeFetch(routes()), { now: T1, ctx: tax(), force: true });
  assert.deepEqual([r3.results[0].status, r3.results[0].skipped], ['unchanged', undefined]);
});

test('importPacksToDb: sin index.json (404) = nada que importar, no es fallo', async () => {
  const db = await newDb();
  const r = await importPacksToDb(db, fakeFetch({}), { now: T0 });
  assert.deepEqual([r.ok, r.missing, r.results, r.failed], [true, true, [], []]);
});

test('importPacksToDb: el índice falla (503/red) → error del índice; un paquete malo no impide los buenos', async () => {
  const db = await newDb();
  const off = await importPacksToDb(db, fakeFetch({ 'content/index.json': res('x', 503) }), { now: T0 });
  assert.deepEqual([off.ok, off.error.code], [false, 'OFFLINE']);
  const good = loadSample();
  const bad = { ...loadSample(), pack_id: 'roto_v1' }; bad.items[0].accept = null;
  const r = await importPacksToDb(db, fakeFetch({
    'content/index.json': res({ schema: 1, packs: [entry({ pack_id: 'roto_v1', path: packPath('roto_v1') }), entry(), entry({ pack_id: 'falta_v1', path: packPath('falta_v1') })] }),
    [packPath('roto_v1')]: res(bad), [packPath('sample_pack_v1')]: res(good),
  }), { now: T0, ctx: tax() });
  assert.equal(r.ok, false);
  assert.deepEqual(r.results.map((x) => x.pack_id), ['sample_pack_v1']);
  assert.deepEqual(r.failed.map((x) => [x.pack_id, x.error.code]), [['roto_v1', 'INVALID_PACK'], ['falta_v1', 'NOT_FOUND']]);
  assert.equal(await cacheOf(db, 'roto_v1'), null);
});

test('importPacksToDb: v2 en el índice sobre v1 instalada → actualiza (retira, crea); falta `now` → error por paquete sin lanzar', async () => {
  const db = await newDb();
  await importPacksToDb(db, fakeFetch(routes()), { now: T0, ctx: tax() });
  const v2 = { ...loadSample(), version: 2 }; v2.items = v2.items.slice(1);
  const r = await importPacksToDb(db, fakeFetch(routes(v2, entry({ version: 2 }))), { now: T1, ctx: tax() });
  assert.deepEqual([r.ok, r.results[0].status, r.results[0].version, r.results[0].deprecated], [true, 'updated', 2, [loadSample().items[0].id]]);
  const noNow = await importPacksToDb(await newDb(), fakeFetch(routes()), {});
  assert.deepEqual([noNow.ok, noNow.failed[0].error.code], [false, 'BAD_ARGS']);
});

test('importPacksToDb: si la lectura de la base falla, informa por paquete', async () => {
  const db = await newDb();
  db.get = async () => { throw new Error('quota'); };
  const r = await importPacksToDb(db, fakeFetch(routes()), { now: T0 });
  assert.deepEqual([r.ok, r.failed[0].error.code], [false, 'DB']);
});

test('ids de paquete con idéntico contenido en dos paquetes: ids de ítems se guardan una sola vez por tarjeta (misma tarjeta)', async () => {
  const db = await newDb();
  const a = loadSample();
  await importPackToDb(db, a, { now: T0 });
  const n = (await cards(db)).length;
  const b = { ...structuredClone(a), pack_id: 'copia_v1' };
  const r = await importPackToDb(db, b, { now: T1 });
  assert.equal(r.cardsCreated, 0);
  assert.equal((await cards(db)).length, n);
});
