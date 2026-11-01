// @purpose: Pruebas del resolvedor de ítems (app/itemResolver.js) con el paquete semilla real, fallos de red y paquetes dañados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createItemResolver } from '../app/itemResolver.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const readText = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const SEED = JSON.parse(readText('content/packs/pack_seed_v1.json'));
const reply = (text) => ({ ok: true, status: 200, text: async () => text, json: async () => JSON.parse(text) });
const miss = { ok: false, status: 404, text: async () => 'no', json: async () => ({}) };
// fetch que sirve los archivos reales; `over` sustituye o rompe rutas; `calls` anota lo pedido.
const repoFetch = ({ calls = [], over = {} } = {}) => async (url) => {
  calls.push(url);
  if (url in over) { const v = over[url]; return typeof v === 'function' ? v() : v; }
  return reply(readText(url));
};
const quiet = () => {};

test('resuelve un ítem real del paquete semilla, entero y con su tipo', async () => {
  const r = createItemResolver({ fetchFn: repoFetch(), log: quiet });
  const want = SEED.items[7];
  const got = await r.resolve(want.id);
  assert.deepEqual(got, want);
  assert.equal(typeof got.type, 'string');
});

test('resuelve los 60 ítems y un id desconocido, vacío o raro da null', async () => {
  const r = createItemResolver({ fetchFn: repoFetch(), log: quiet });
  for (const it of SEED.items) assert.equal((await r.resolve(it.id))?.id, it.id);
  for (const bad of ['no.existe.0001', '', null, undefined, 7, {}]) assert.equal(await r.resolve(bad), null);
});

test('lee el índice y el paquete UNA sola vez, aunque pidan muchos ítems a la vez', async () => {
  const calls = [];
  const r = createItemResolver({ fetchFn: repoFetch({ calls }), log: quiet });
  await Promise.all(SEED.items.map((it) => r.resolve(it.id)));
  await r.resolve(SEED.items[0].id);
  assert.equal(calls.filter((u) => u === 'content/index.json').length, 1);
  assert.equal(calls.filter((u) => u === 'content/packs/pack_seed_v1.json').length, 1);
});

test('sin fetch, sin índice o con red caída da null y nunca rechaza', async () => {
  assert.equal(await createItemResolver({ fetchFn: null, log: quiet }).resolve('x'), null);
  assert.equal(await createItemResolver({ fetchFn: repoFetch({ over: { 'content/index.json': miss } }), log: quiet }).resolve(SEED.items[0].id), null);
  const down = async () => { throw new TypeError('Failed to fetch'); };
  assert.equal(await createItemResolver({ fetchFn: down, log: quiet }).resolve(SEED.items[0].id), null);
});

test('un fallo no se queda guardado: cuando vuelve la red, la siguiente llamada funciona', async () => {
  let online = false;
  const f = async (url) => { if (!online) throw new TypeError('Failed to fetch'); return repoFetch()(url); };
  const logs = [];
  const r = createItemResolver({ fetchFn: f, log: (m) => logs.push(m) });
  assert.equal(await r.resolve(SEED.items[0].id), null);
  assert.ok(logs.length > 0, 'el fallo se anota');
  online = true;
  assert.equal((await r.resolve(SEED.items[0].id))?.id, SEED.items[0].id);
});

test('un paquete dañado se anota, no entrega ítems a medias y se reintenta después', async () => {
  let broken = true;
  const bad = { ...SEED, items: [...SEED.items.slice(0, 3), { id: 'seed.roto.0001' }] };
  const f = repoFetch({ over: { 'content/packs/pack_seed_v1.json': () => reply(JSON.stringify(broken ? bad : SEED)) } });
  const logs = [];
  const r = createItemResolver({ fetchFn: f, log: (m) => logs.push(m) });
  assert.equal(await r.resolve(SEED.items[0].id), null, 'un paquete inválido no llega a las sesiones');
  assert.ok(logs.some((m) => /pack_seed_v1/.test(m)));
  broken = false;
  assert.equal((await r.resolve(SEED.items[0].id))?.id, SEED.items[0].id, 'reparado el paquete, la siguiente llamada lo lee');
});

test('un id que no es texto no provoca ni una lectura de red', async () => {
  const calls = [];
  const r = createItemResolver({ fetchFn: repoFetch({ calls }), log: quiet });
  for (const bad of ['', null, undefined, 7, {}]) assert.equal(await r.resolve(bad), null);
  assert.deepEqual(calls, []);
});

test('con el mismo id en dos paquetes manda el primero del índice', async () => {
  const dup = { ...SEED, pack_id: 'pack_dup_v1', items: [{ ...SEED.items[0], explain_es: 'Copia del segundo paquete.' }] };
  const idx = { schema: 1, packs: [
    { pack_id: 'pack_seed_v1', version: SEED.version, path: 'content/packs/pack_seed_v1.json', topics: SEED.topics, items_count: SEED.items.length, size_kb: 61 },
    { pack_id: 'pack_dup_v1', version: SEED.version, path: 'content/packs/pack_dup_v1.json', topics: SEED.topics, items_count: 1, size_kb: 1 },
  ] };
  const f = repoFetch({ over: { 'content/index.json': reply(JSON.stringify(idx)), 'content/packs/pack_dup_v1.json': reply(JSON.stringify(dup)) } });
  const got = await createItemResolver({ fetchFn: f, log: quiet }).resolve(SEED.items[0].id);
  assert.equal(got.explain_es, SEED.items[0].explain_es);
});

test('reset() obliga a leer de nuevo', async () => {
  const calls = [];
  const r = createItemResolver({ fetchFn: repoFetch({ calls }), log: quiet });
  await r.resolve(SEED.items[0].id); r.reset(); await r.resolve(SEED.items[0].id);
  assert.equal(calls.filter((u) => u === 'content/index.json').length, 2);
});

test('main.js usa el resolvedor en el registro de ejercicios', () => {
  const main = readText('app/main.js');
  assert.match(main, /app\.services\.itemResolver = createItemResolver\(/);
  assert.match(main, /createExerciseRegistry\(\{ log: console\.error, resolveItem: \(id\) => app\.services\.itemResolver\.resolve\(id\)/);
});
