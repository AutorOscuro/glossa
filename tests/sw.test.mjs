// Ejecuta el sw.js REAL en un entorno simulado (cachés, red y eventos falsos). Nada de esto toca un navegador.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const ORIGIN = 'https://example.test';
const BASE = `${ORIGIN}/sophia/`;
const CV = /const CACHE_VERSION = '([^']+)'/.exec(SRC)[1];
const FILES = ['index.html', 'app/main.js', 'ui/styles/base.css', 'icons/icon-192.png'];

function setup({ files = FILES, cacheVersion = CV, manifestStatus = 200, missing = [], online = true } = {}) {
  const handlers = {};
  const calls = { skip: 0, claim: 0 };
  const store = new Map();
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
  const net = new Map(); // url → { status, body }
  const log = [];
  const state = { online };
  const manifest = { schema: 1, version: '0.0.0', cacheVersion, files: files.map((p) => ({ path: p, hash: 'h', size: 1 })) };
  net.set(`${BASE}asset-manifest.json`, { status: manifestStatus, body: JSON.stringify(manifest) });
  for (const f of files) if (!missing.includes(f)) net.set(`${BASE}${f}`, { status: 200, body: `net:${f}` });
  const fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    log.push({ url, cache: input.cache });
    if (!state.online) throw new TypeError('Failed to fetch');
    const hit = net.get(url);
    if (!hit) return new Response('no', { status: 404 });
    return new Response(hit.body, { status: hit.status });
  };
  const self = {
    location: { href: `${BASE}sw.js` },
    addEventListener: (type, fn) => { handlers[type] = fn; },
    skipWaiting() { calls.skip += 1; },
    clients: { claim() { calls.claim += 1; return Promise.resolve(); } },
  };
  vm.runInContext(SRC, vm.createContext({ self, URL, Request, Response, fetch, caches, Promise }));
  async function run(type, extra = {}) {
    const waits = [];
    let responded;
    const ev = { ...extra, waitUntil: (p) => waits.push(p), respondWith: (p) => { responded = p; } };
    handlers[type](ev);
    const value = responded === undefined ? undefined : await responded;
    await Promise.all(waits);
    return { value, responded: responded !== undefined };
  }
  const request = (u, { method = 'GET', mode = 'cors', range = null } = {}) => ({ url: u.startsWith('http') ? u : `${BASE}${u}`, method, mode, headers: { get: (n) => (n.toLowerCase() === 'range' ? range : null) } });
  const text = (r) => r.value.text();
  return { run, store, net, log, calls, state, request, text, handlers };
}

test('sw.js: la línea CACHE_VERSION existe y es un nombre de caché válido', () => {
  assert.match(CV, /^sophia-shell-\d+\.\d+\.\d+-[0-9a-f]{8}$/);
});

test('install: precachea cada archivo del manifest con cache:"reload", lee el manifest sin caché HTTP y NO fuerza activación', async () => {
  const t = setup();
  await t.run('install');
  const cache = t.store.get(CV);
  assert.deepEqual([...cache.keys()].sort(), FILES.map((f) => `${BASE}${f}`).sort());
  assert.equal(t.log.find((l) => l.url.endsWith('asset-manifest.json')).cache, 'no-store');
  for (const f of FILES) assert.equal(t.log.find((l) => l.url === `${BASE}${f}`).cache, 'reload', f);
  assert.equal(t.calls.skip, 0, 'una versión nueva espera: nunca se activa sola');
});

test('install FALLA (y no deja caché a medias) si falta el manifest, no coincide la versión o un archivo da 404', async () => {
  await assert.rejects(setup({ manifestStatus: 404 }).run('install'), /asset-manifest\.json/);
  const mismatch = setup({ cacheVersion: 'sophia-shell-9.9.9-ffffffff' });
  await assert.rejects(mismatch.run('install'), /no coinciden/);
  assert.equal(mismatch.store.size, 0);
  const t = setup({ missing: ['ui/styles/base.css'] });
  await assert.rejects(t.run('install'), /ui\/styles\/base\.css/);
  assert.equal(t.store.has(CV), false, 'sin caché a medias');
  await assert.rejects(setup({ online: false }).run('install'), /Failed to fetch/);
  await assert.rejects(setup({ files: [] }).run('install'), /no es válido/);
});

test('activate: borra cachés viejas del shell, conserva la actual, packs y audio, y reclama clientes', async () => {
  const t = setup();
  for (const n of ['sophia-shell-0.4.0-aaaaaaaa', CV, 'sophia-packs-v1', 'sophia-audio-v1', 'otra-app-cache']) t.store.set(n, new Map());
  await t.run('activate');
  assert.deepEqual([...t.store.keys()].sort(), [CV, 'otra-app-cache', 'sophia-audio-v1', 'sophia-packs-v1'].sort());
  assert.equal(t.calls.claim, 1);
});

test('message: SKIP_WAITING activa; GET_VERSION responde; basura se ignora', async () => {
  const t = setup();
  const sent = [];
  const source = { postMessage: (m) => sent.push(m) };
  await t.run('message', { data: { type: 'SKIP_WAITING' } });
  assert.equal(t.calls.skip, 1);
  await t.run('message', { data: { type: 'GET_VERSION' }, source });
  assert.deepEqual(JSON.parse(JSON.stringify(sent)), [{ type: 'VERSION', cacheVersion: CV }]); // JSON: los objetos nacen en otro "realm" de vm
  for (const data of [null, undefined, 'SKIP_WAITING', 5, {}, { type: 7 }, { type: 'OTRA' }]) await t.run('message', { data, source });
  await t.run('message', { data: { type: 'GET_VERSION' } });
  assert.equal(t.calls.skip, 1); assert.equal(sent.length, 1);
});

test('fetch: NO intercepta POST, otro origen (APIs de IA/Azure), fuera de alcance, Range, sw.js ni el manifest', async () => {
  const t = setup();
  const cases = [
    t.request('content/packs/a.json', { method: 'POST' }),
    t.request('https://api.openai.com/v1/chat/completions'),
    t.request('https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1'),
    t.request(`${ORIGIN}/otra-app/index.html`),
    t.request('https://api.otro.com/sophia/content/packs/x.json'), // otro origen con la MISMA ruta: tampoco
    t.request('https://api.otro.com/sophia/audio/x.mp3'),
    t.request('audio/a.mp3', { range: 'bytes=0-100' }),
    t.request('sw.js'), t.request('asset-manifest.json'),
  ];
  for (const r of cases) assert.equal((await t.run('fetch', { request: r })).responded, false, r.url);
  assert.equal(t.store.size, 0, 'nada guardado');
  assert.equal(t.log.length, 0, 'ni una petición hecha por el SW');
});

test('navegación: sirve index.html de la caché SIN red; sin caché y sin red da 503 legible; con red y sin caché usa la red', async () => {
  const t = setup();
  await t.run('install'); t.state.online = false;
  for (const u of ['', '#/tema/x', 'cualquier/ruta']) {
    const r = await t.run('fetch', { request: t.request(u === '#/tema/x' ? '' : u, { mode: 'navigate' }) });
    assert.equal(await t.text(r), 'net:index.html', u);
  }
  const cold = setup({ online: false });
  const r = await cold.run('fetch', { request: cold.request('', { mode: 'navigate' }) });
  assert.equal(r.value.status, 503); assert.match(await cold.text(r), /Sin conexión/);
  const warm = setup(); warm.net.set(BASE, { status: 200, body: 'directo' });
  assert.equal(await warm.text(await warm.run('fetch', { request: warm.request('', { mode: 'navigate' }) })), 'directo');
});

test('shell: primero caché (sin tocar la red), ignora ?v=, y lo que no está en el shell se pide pero NO se guarda', async () => {
  const t = setup();
  await t.run('install'); t.log.length = 0;
  assert.equal(await t.text(await t.run('fetch', { request: t.request('app/main.js') })), 'net:app/main.js');
  assert.equal(await t.text(await t.run('fetch', { request: t.request('app/main.js?v=3') })), 'net:app/main.js');
  assert.equal(t.log.length, 0, 'cero peticiones: salió de la caché');
  t.net.set(`${BASE}ui/nuevo.js`, { status: 200, body: 'nuevo' });
  assert.equal(await t.text(await t.run('fetch', { request: t.request('ui/nuevo.js') })), 'nuevo');
  assert.equal(t.store.get(CV).has(`${BASE}ui/nuevo.js`), false, 'no se cachea lo que no está en el manifest');
  t.state.online = false;
  const r = await t.run('fetch', { request: t.request('ui/otro.js') });
  assert.equal(r.value.status, 503);
  assert.equal(await t.text(await t.run('fetch', { request: t.request('app/main.js') })), 'net:app/main.js', 'sigue funcionando offline');
});

test('packs: stale-while-revalidate (responde lo guardado y se actualiza), con y sin red', async () => {
  const t = setup(); const u = `${BASE}content/packs/p1.json`;
  t.net.set(u, { status: 200, body: 'v1' });
  assert.equal(await t.text(await t.run('fetch', { request: t.request(u) })), 'v1', 'sin copia: usa la red');
  t.net.set(u, { status: 200, body: 'v2' });
  assert.equal(await t.text(await t.run('fetch', { request: t.request(u) })), 'v1', 'con copia: responde la guardada');
  const saved = async () => t.store.get('sophia-packs-v1').get(u).clone().text();
  assert.equal(await saved(), 'v2', '…y la actualizó en segundo plano');
  t.state.online = false;
  assert.equal(await t.text(await t.run('fetch', { request: t.request(u) })), 'v2', 'offline: la guardada, sin error');
  await assert.rejects(t.run('fetch', { request: t.request(`${BASE}content/packs/otro.json`) }), /Failed to fetch/);
  t.state.online = true; t.net.set(u, { status: 500, body: 'roto' });
  await t.run('fetch', { request: t.request(u) });
  assert.equal(await saved(), 'v2', 'un 500 no pisa la copia buena');
  assert.equal(t.store.has(CV), false, 'los packs no van a la caché del shell');
});

test('audio: caché primero, solo guarda 200, y descarta los más antiguos pasando el tope de 60', async () => {
  const t = setup();
  const url = (i) => `${BASE}audio/a${i}.mp3`;
  for (let i = 0; i < 65; i += 1) { t.net.set(url(i), { status: 200, body: `a${i}` }); await t.run('fetch', { request: t.request(url(i)) }); }
  const keys = [...t.store.get('sophia-audio-v1').keys()];
  assert.equal(keys.length, 60);
  assert.ok(!keys.includes(url(0)) && !keys.includes(url(4)), 'los 5 primeros se descartaron');
  assert.ok(keys.includes(url(5)) && keys.includes(url(64)));
  t.log.length = 0; t.state.online = false;
  assert.equal(await t.text(await t.run('fetch', { request: t.request(url(64)) })), 'a64'); assert.equal(t.log.length, 0);
  t.state.online = true; t.net.set(url(99), { status: 206, body: 'parcial' }); t.net.set(url(98), { status: 404, body: 'x' });
  await t.run('fetch', { request: t.request(url(99)) }); await t.run('fetch', { request: t.request(url(98)) });
  assert.ok(![...t.store.get('sophia-audio-v1').keys()].some((k) => k === url(99) || k === url(98)), '206 y 404 no se guardan');
});

test('funciona en una carpeta distinta (GitHub Pages sirve en /repo/): las rutas salen de la ubicación del sw.js', async () => {
  const t = setup();
  await t.run('install');
  assert.ok([...t.store.get(CV).keys()].every((k) => k.startsWith(BASE)));
});
