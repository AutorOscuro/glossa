// @purpose: Pruebas del arranque que importa el contenido a la base (app/contentStartup.js) con el paquete semilla real.
// Pruebas de app/contentStartup.js (subparte 2.9-T3, punto 1). Usan el paquete semilla REAL (content/packs/pack_seed_v1.json) y una base en memoria.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startContent, ERROR_CODES_URL, TOPICS_URL } from '../app/contentStartup.js';
import { createMemoryDb } from '../core/db.memory.js';
import { makeClock } from './_helpers.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const readText = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const SEED = JSON.parse(readText('content/packs/pack_seed_v1.json'));

// fetch falso que sirve los archivos reales del repo; `missing` lista rutas que devuelven 404.
const repoFetch = (calls = [], missing = []) => async (url) => {
  calls.push(url);
  if (missing.includes(url)) return { ok: false, status: 404, text: async () => 'no', json: async () => ({}) };
  const text = readText(url);
  return { ok: true, status: 200, text: async () => text, json: async () => JSON.parse(text) };
};
async function newDb() { const db = createMemoryDb(); await db.open(); return db; }
const quiet = () => {};

test('importa el paquete semilla real: una tarjeta por ítem y el registro del paquete', async () => {
  const db = await newDb();
  const r = await startContent({ storageReady: Promise.resolve({ db }), fetchFn: repoFetch(), clock: makeClock(), log: quiet });
  assert.equal(r.ok, true);
  assert.equal(r.skipped, false);
  assert.equal(r.results.length, 1);
  assert.equal(r.results[0].pack_id, 'pack_seed_v1');
  assert.equal(r.results[0].cardsCreated, SEED.items.length);
  assert.equal((await db.query('cards', {})).length, SEED.items.length);
  const cache = await db.get('content_cache', 'pack_seed_v1');
  assert.equal(cache.version, SEED.version);
});

test('sin reloj inyectado usa la hora real (la app no pasa reloj)', async () => {
  const db = await newDb();
  const before = Date.now();
  const r = await startContent({ storageReady: Promise.resolve({ db }), fetchFn: repoFetch(), log: quiet });
  assert.equal(r.ok, true);
  const all = await db.query('cards', {});
  assert.ok(all.every((c) => Date.parse(c.due) >= before - 1000));
});

test('es idempotente: la segunda vez no descarga el paquete ni duplica tarjetas', async () => {
  const db = await newDb();
  await startContent({ storageReady: Promise.resolve({ db }), fetchFn: repoFetch(), log: quiet });
  const calls = [];
  const r = await startContent({ storageReady: Promise.resolve({ db }), fetchFn: repoFetch(calls), log: quiet });
  assert.equal(r.ok, true);
  assert.equal(r.results[0].status, 'unchanged');
  assert.equal(calls.includes('content/packs/pack_seed_v1.json'), false, 'no vuelve a pedir el paquete');
  assert.equal((await db.query('cards', {})).length, SEED.items.length);
});

test('cada tarjeta nace pendiente: due al instante del reloj de arranque', async () => {
  const db = await newDb();
  const clock = makeClock('2026-11-01T08:00:00.000Z');
  await startContent({ storageReady: Promise.resolve({ db }), fetchFn: repoFetch(), clock, log: quiet });
  const all = await db.query('cards', {});
  assert.ok(all.every((c) => c.due === clock.iso()), 'todas con due = ahora');
  assert.equal(new Set(all.map((c) => c.id)).size, all.length, 'sin ids repetidos');
});

test('nunca rechaza: base que no abrió, sin fetch, índice que falta o taxonomía caída', async () => {
  const bad = await startContent({ storageReady: Promise.reject(new Error('sin base')), fetchFn: repoFetch(), log: quiet });
  assert.deepEqual([bad.ok, bad.skipped, bad.reason], [false, true, 'db']);
  const nullDb = await startContent({ storageReady: Promise.resolve({ db: null }), fetchFn: repoFetch(), log: quiet });
  assert.equal(nullDb.reason, 'db');
  const db = await newDb();
  const noFetch = await startContent({ storageReady: Promise.resolve({ db }), fetchFn: null, log: quiet });
  assert.equal(noFetch.reason, 'fetch');
  const noIndex = await startContent({ storageReady: Promise.resolve({ db }), fetchFn: repoFetch([], ['content/index.json']), log: quiet });
  assert.deepEqual([noIndex.ok, noIndex.missing, noIndex.results.length], [true, true, 0], 'sin índice no es un fallo: no hay nada que importar');
  assert.equal((await db.query('cards', {})).length, 0, 'sin índice no se escribe nada');
  const boom = await startContent({ storageReady: Promise.resolve({ db }), fetchFn: async () => { throw new Error('red'); }, log: quiet });
  assert.equal(boom.ok, false);
});

test('si la taxonomía no carga, importa igual y lo anota', async () => {
  const db = await newDb();
  const logs = [];
  const r = await startContent({ storageReady: Promise.resolve({ db }), fetchFn: repoFetch([], [ERROR_CODES_URL, TOPICS_URL]), log: (...a) => logs.push(a[0]) });
  assert.equal(r.ok, true);
  assert.equal((await db.query('cards', {})).length, SEED.items.length);
  assert.ok(logs.some((m) => /taxonomía/.test(m)));
});

test('un paquete dañado no deja tarjetas a medias', async () => {
  const db = await newDb();
  const broken = { ...SEED, items: [...SEED.items.slice(0, 5), { id: 'seed.roto.0001' }] };
  const f = async (url) => {
    if (url === 'content/packs/pack_seed_v1.json') return { ok: true, status: 200, text: async () => JSON.stringify(broken), json: async () => broken };
    return repoFetch()(url);
  };
  const r = await startContent({ storageReady: Promise.resolve({ db }), fetchFn: f, log: quiet });
  assert.equal(r.ok, false);
  assert.equal(r.failed.length, 1);
  assert.equal((await db.query('cards', {})).length, 0);
});

// fetch que sirve el paquete semilla con una modificación (el resto, los archivos reales).
const fetchWithPack = (mutate) => async (url) => {
  if (url !== 'content/packs/pack_seed_v1.json') return repoFetch()(url);
  const copy = JSON.parse(JSON.stringify(SEED)); mutate(copy);
  return { ok: true, status: 200, text: async () => JSON.stringify(copy), json: async () => copy };
};

test('usa la taxonomía: un código de error que no existe en el catálogo rechaza el paquete', async () => {
  const db = await newDb();
  const f = fetchWithPack((p) => { const it = p.items.find((x) => Array.isArray(x.distractors) && x.distractors.length); it.distractors[0].code = 'ZZZ.NO_EXISTE'; });
  const r = await startContent({ storageReady: Promise.resolve({ db }), fetchFn: f, log: quiet });
  assert.equal(r.ok, false);
  assert.equal(r.failed.length, 1);
  assert.equal((await db.query('cards', {})).length, 0);
});

test('usa la taxonomía: un tema que no existe rechaza el paquete', async () => {
  const db = await newDb();
  // el tema falso se declara también en `topics` del paquete, para que solo la taxonomía pueda delatarlo
  const f = fetchWithPack((p) => { p.topics = [...p.topics, 'no.existe.este_tema']; p.items[0].topics = ['no.existe.este_tema']; });
  const r = await startContent({ storageReady: Promise.resolve({ db }), fetchFn: f, log: quiet });
  assert.equal(r.ok, false);
  assert.equal((await db.query('cards', {})).length, 0);
});

test('main.js lo cablea después de los servicios de estudio', () => {
  const main = readText('app/main.js');
  assert.match(main, /import \{ startContent \} from '\.\/contentStartup\.js'/);
  assert.match(main, /app\.services\.contentReady = startContent\(\{ storageReady: app\.services\.storageReady \}\)/);
  assert.ok(main.indexOf('services.studyReady = startServices') < main.indexOf('services.contentReady = startContent'));
});

test('main.js ofrece services.reimportContent (Ajustes lo llama tras importar o borrar todo)', () => {
  const main = readText('app/main.js');
  assert.match(main, /app\.services\.reimportContent = \(\) => \{ app\.services\.contentReady = startContent\(\{ storageReady: app\.services\.storageReady \}\); return app\.services\.contentReady; \}/);
  assert.match(readText('ui/views/settings.js'), /afterChange: \(\) => ctx\.services\.reimportContent\?\.\(\)/);
});

test('tras «Borrar todo» el contenido vuelve: reimportar deja otra vez las tarjetas del paquete', async () => {
  const { createDataTools } = await import('../app/dataTools.js');
  const { createSettings } = await import('../core/settings.js');
  const db = await newDb();
  const settings = createSettings({ db }); await settings.load();
  const storageReady = Promise.resolve({ db });
  await startContent({ storageReady, fetchFn: repoFetch(), log: quiet });
  const tools = createDataTools({ db, settings, afterChange: () => startContent({ storageReady, fetchFn: repoFetch(), log: quiet }) });
  await tools.wipeAll();
  assert.equal((await db.query('cards', {})).length, SEED.items.length, 'el contenido se importó de nuevo solo');
  assert.ok(await db.get('content_cache', 'pack_seed_v1'));
});
