// @purpose: Prueba que con la app instalada y SIN conexión se abre y se planea estudiar el paquete semilla desde el primer arranque (sw.js real + archivos reales).
// Subparte 2.9-T3, punto 2 (precache de content/index.json y de los paquetes con el shell). Sin navegador: el sw.js REAL corre en un entorno simulado
// que sirve los archivos REALES del repo según el asset-manifest.json real; tras instalar se «corta la red» y todo lo demás pasa por el evento fetch del sw.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServices } from '../app/services.js';
import { startContent } from '../app/contentStartup.js';
import { loadIndex, loadPack } from '../core/content.js';
import { createMemoryDb } from '../core/db.memory.js';
import { createRng } from '../core/rng.js';
import { makeClock } from './_helpers.mjs';
import { makeEnv } from './_fakeDom.mjs';
import { createItemResolver } from '../app/itemResolver.js';
import { registerExerciseTypes } from '../app/exerciseTypes.js';
import { createExerciseRegistry } from '../ui/exercises/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const CV = /const CACHE_VERSION = '([^']+)'/.exec(SRC)[1];
const BASE = 'https://example.test/glossa/';
const SEED = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/packs/pack_seed_v1.json'), 'utf8'));

// Arranca el sw.js real. `net` sirve los archivos reales; con online=false cada petición a la red lanza TypeError (avión).
function boot() {
  const handlers = {};
  const store = new Map();
  const state = { online: true, netHits: 0 };
  const norm = (req, ignoreSearch) => { const u = new URL(typeof req === 'string' ? req : req.url); if (ignoreSearch) u.search = ''; return u.href; };
  const makeCache = (map) => ({
    async match(req, o = {}) { for (const [k, v] of map) if (norm(k, o.ignoreSearch) === norm(req, o.ignoreSearch)) return v.clone(); return undefined; },
    async put(req, res) { map.set(norm(req), res); },
    async delete(req) { return map.delete(norm(req)); },
    async keys() { return [...map.keys()].map((url) => ({ url })); },
  });
  const caches = {
    async open(name) { if (!store.has(name)) store.set(name, new Map()); return makeCache(store.get(name)); },
    async keys() { return [...store.keys()]; },
    async delete(name) { return store.delete(name); },
  };
  const net = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    if (!state.online) throw new TypeError('Failed to fetch');
    state.netHits += 1;
    const rel = decodeURIComponent(new URL(url).pathname.slice(new URL(BASE).pathname.length));
    const file = path.join(ROOT, rel);
    if (!rel || !file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return new Response('no', { status: 404 });
    return new Response(fs.readFileSync(file), { status: 200 });
  };
  const self = {
    location: { href: `${BASE}sw.js` },
    addEventListener: (type, fn) => { handlers[type] = fn; },
    skipWaiting() {}, clients: { claim: () => Promise.resolve() },
  };
  vm.runInContext(SRC, vm.createContext({ self, URL, Request, Response, fetch: net, caches, Promise }));
  async function dispatch(type, extra = {}) {
    const waits = []; let responded;
    handlers[type]({ ...extra, waitUntil: (p) => waits.push(p), respondWith: (p) => { responded = p; } });
    const value = responded === undefined ? undefined : await responded;
    await Promise.all(waits);
    return { value, responded: responded !== undefined };
  }
  // El fetch que ve la app: relativo al origen de la app, pasando por el sw.js como en el navegador.
  const appFetch = async (url) => {
    const request = { url: new URL(url, BASE).href, method: 'GET', mode: 'cors', headers: { get: () => null } };
    const r = await dispatch('fetch', { request });
    return r.responded ? r.value : net(request);
  };
  return { dispatch, store, state, appFetch };
}

async function installAndGoOffline() {
  const sw = boot();
  await sw.dispatch('install');
  await sw.dispatch('activate');
  sw.state.online = false;
  sw.state.netHits = 0;
  return sw;
}

test('instalada y SIN conexión: el índice y el paquete semilla salen de la caché del shell, validados', async () => {
  const sw = await installAndGoOffline();
  const cache = sw.store.get(CV);
  for (const rel of ['content/index.json', 'content/packs/pack_seed_v1.json']) assert.ok(cache.has(`${BASE}${rel}`), `${rel} está en el precache`);
  assert.equal(sw.store.has('sophia-packs-v1'), false, 'ya no se crea la caché aparte de paquetes');
  const index = await loadIndex(sw.appFetch);
  assert.equal(index.ok, true, JSON.stringify(index.error));
  const pack = await loadPack(index.index.packs[0], sw.appFetch);
  assert.equal(pack.ok, true, JSON.stringify(pack.error));
  assert.equal(pack.pack.items.length, SEED.items.length);
  assert.equal(sw.state.netHits, 0, 'cero peticiones a la red');
});

test('primer arranque sin conexión: se importan las 60 tarjetas y se arma una sesión de estudio con ítems del paquete', async () => {
  const sw = await installAndGoOffline();
  const db = createMemoryDb(); await db.open();
  const storageReady = Promise.resolve({ db });
  const clock = makeClock('2026-11-01T08:00:00.000Z');
  const logs = [];
  const log = (...a) => logs.push(a[0]);
  const services = {};
  await startServices({ storageReady, settingsReady: Promise.resolve({ settings: null }), services, fetchFn: sw.appFetch, clock, rng: createRng(3), log });
  const r = await startContent({ storageReady, fetchFn: sw.appFetch, clock, log });
  assert.equal(r.ok, true, JSON.stringify([r, logs]));
  assert.equal(r.results[0].cardsCreated, SEED.items.length);
  assert.equal((await db.query('cards', {})).length, SEED.items.length);
  assert.deepEqual(logs, [], 'sin avisos: la taxonomía también salió del precache');

  const plan = await services.study.plan();
  assert.ok(plan.items.length > 0, 'hay una sesión que estudiar');
  const ids = new Set(SEED.items.map((it) => it.id));
  for (const e of plan.items) assert.ok(ids.has(e.itemId), `${e.itemId} es un ítem del paquete semilla`);
  assert.equal(sw.state.netHits, 0, 'todo el arranque sin tocar la red');
});

test('primer arranque sin conexión: el primer ejercicio de la sesión se MONTA y los 60 ítems del paquete se dibujan', async () => {
  const realDocument = globalThis.document;
  const env = makeEnv(); globalThis.document = env.doc;
  try {
    const sw = await installAndGoOffline();
    const db = createMemoryDb(); await db.open();
    const storageReady = Promise.resolve({ db });
    const clock = makeClock('2026-11-01T08:00:00.000Z');
    const services = {};
    await startServices({ storageReady, settingsReady: Promise.resolve({ settings: null }), services, fetchFn: sw.appFetch, clock, rng: createRng(3), log: () => {} });
    await startContent({ storageReady, fetchFn: sw.appFetch, clock, log: () => {} });
    const logs = [];
    const registry = createExerciseRegistry({ resolveItem: createItemResolver({ fetchFn: sw.appFetch, log: (...a) => logs.push(a[0]) }).resolve, log: (...a) => logs.push(a[0]) });
    registerExerciseTypes(registry, { catalog: () => services.study.catalog, log: (...a) => logs.push(a[0]) });
    const plan = await services.study.plan();
    const submit = async () => ({ status: 'saved' });
    const first = env.doc.createElement('div');
    const handle = await registry.mount(first, plan.items[0], { index: 0, total: plan.items.length, submit });
    assert.ok(handle, `el primer ejercicio no se montó: ${logs.join(' | ')}`);
    assert.ok(first.textContent.length > 0, 'el ejercicio dibujó algo');
    handle.destroy();
    for (const it of SEED.items) {
      const slot = env.doc.createElement('div');
      const entry = { cardId: `${it.id}#0`, itemId: it.id, facet: 0, topic: it.topics?.[0] ?? null, exerciseType: null, kind: 'new', why: 'new', topics: it.topics ?? [] };
      const h = await registry.mount(slot, entry, { index: 0, total: 1, submit });
      assert.ok(h, `${it.id} (${it.type}) no se pudo montar offline: ${logs.join(' | ')}`);
      assert.ok(slot.textContent.length > 0, `${it.id} no dibujó nada`);
      h.destroy();
    }
    assert.deepEqual(logs, [], 'sin avisos ni errores en todo el recorrido');
    assert.equal(sw.state.netHits, 0, 'sin tocar la red en ningún momento');
  } finally { globalThis.document = realDocument; }
});

test('control: sin instalar (caché vacía) y sin conexión NO se puede importar nada (la prueba de arriba no pasa por casualidad)', async () => {
  const sw = boot(); sw.state.online = false;
  const db = createMemoryDb(); await db.open();
  const r = await startContent({ storageReady: Promise.resolve({ db }), fetchFn: sw.appFetch, clock: makeClock(), log: () => {} });
  assert.equal((await db.query('cards', {})).length, 0);
  assert.equal(r.results.length, 0);
});

test('un paquete servido por una versión vieja de la caché no se mezcla: índice y paquete salen siempre de la misma instalación', async () => {
  const sw = await installAndGoOffline();
  const index = (await loadIndex(sw.appFetch)).index.packs[0];
  const pack = await loadPack(index, sw.appFetch);
  assert.equal(pack.ok, true, 'sin error STALE: la versión del índice y la del paquete coinciden');
  assert.equal(pack.pack.version, index.version);
});

test('actualizar el shell borra la caché vieja de paquetes (sophia-packs-v1) y deja intacto el audio', async () => {
  const sw = boot();
  for (const n of ['sophia-packs-v1', 'sophia-audio-v1']) sw.store.set(n, new Map());
  await sw.dispatch('install'); await sw.dispatch('activate');
  assert.deepEqual([...sw.store.keys()].sort(), [CV, 'sophia-audio-v1'].sort());
});
