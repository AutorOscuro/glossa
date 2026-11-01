// @purpose: Pruebas del cargador de contenido (core/content.js): validateIndex, loadIndex y loadPack con fetch falso.
// Pruebas de core/content.js (subparte 1.3, cuarto 4, mitad 4A, parte 1): validateIndex, loadIndex y loadPack con `fetch` falso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateIndex, loadIndex, loadPack, validatePack, packPath, INDEX_SCHEMA } from '../core/content.js';
import { errorCodeSet } from '../core/contentCodes.js';
import { topicIdSet, topicInfo } from '../core/contentTaxonomy.js';
import { loadSample, loadTaxonomyFixtures } from './_samplePack.mjs';

const T = 'gram.present_perfect.for_since';
const entry = (over = {}) => ({ pack_id: 'sample_pack_v1', version: 1, path: packPath('sample_pack_v1'), topics: [T], items_count: 21, size_kb: 21, ...over });
const index = (packs = [entry()]) => ({ schema: 1, packs });
const probs = (res) => res.errors.map((e) => `${e.path}:${e.rule}`);
const res = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });
// fetch falso: tabla url → respuesta (o función); registra las llamadas
const fakeFetch = (routes) => { const calls = []; const f = async (url, init) => { calls.push({ url, init }); const r = routes[url]; if (r === undefined) return res('no', 404); return typeof r === 'function' ? r() : r; }; f.calls = calls; return f; };

// ---------- validateIndex ----------
test('un índice válido pasa; uno vacío también', () => {
  assert.deepEqual(validateIndex(index()), { ok: true, errors: [], warnings: [], errorTotal: 0, warningTotal: 0 });
  assert.equal(validateIndex(index([])).ok, true);
  assert.equal(INDEX_SCHEMA, 1);
});

test('validateIndex: una prueba por regla, con ruta exacta', () => {
  const cases = [
    [{ ...index(), schema: 2 }, ['schema:ENUM']],
    [{ schema: 1 }, ['packs:REQUIRED']],
    [{ ...index(), extra: 1 }, ['extra:UNKNOWN_FIELD']],
    [index([entry({ pack_id: 'Mal-Id' })]), ['packs[0].pack_id:FORMAT']],
    [index([entry({ version: 0 })]), ['packs[0].version:RANGE']],
    [index([entry({ path: 'content/packs/otro_v1.json' })]), ['packs[0].path:INDEX_PATH']],
    [index([entry({ path: '../secreto.json' })]), ['packs[0].path:FORMAT']],
    [index([entry({ path: 'https://malo.example/x.json' })]), ['packs[0].path:FORMAT']],
    [index([entry({ topics: [] })]), ['packs[0].topics:LIST_SIZE']],
    [index([entry({ items_count: -1 })]), ['packs[0].items_count:RANGE']],
    [index([entry({ size_kb: 1.5 })]), ['packs[0].size_kb:TYPE']],
    [index([entry(), entry()]), ['packs[1].pack_id:DUPLICATE']],
    [index([{ pack_id: 'sample_pack_v1' }]), ['packs[0].version:REQUIRED', 'packs[0].path:REQUIRED', 'packs[0].topics:REQUIRED', 'packs[0].items_count:REQUIRED', 'packs[0].size_kb:REQUIRED']],
  ];
  for (const [input, expected] of cases) assert.deepEqual(probs(validateIndex(input)).sort(), [...expected].sort(), JSON.stringify(input).slice(0, 80));
});

test('validateIndex: entrada inválida o hostil no lanza', () => {
  for (const bad of [null, undefined, 3, 'x', [], { schema: 1, packs: 'x' }, { schema: 1, packs: [null, 3, []] }]) assert.equal(validateIndex(bad).ok, false, String(bad));
  const hostile = new Proxy({}, { get() { throw new Error('x'); }, ownKeys() { throw new Error('y'); } });
  assert.equal(validateIndex(hostile).ok, false);
  assert.equal(validateIndex({ schema: 1, packs: Array.from({ length: 1001 }, (_, i) => entry({ pack_id: `p_${i}_ab`, path: packPath(`p_${i}_ab`) })) }).ok, false);
});

// ---------- loadIndex ----------
test('loadIndex: caso feliz pide content/index.json y devuelve el índice', async () => {
  const f = fakeFetch({ 'content/index.json': res(index()) });
  const r = await loadIndex(f);
  assert.deepEqual([r.ok, r.missing, r.index.packs.length], [true, false, 1]);
  assert.equal(f.calls[0].url, 'content/index.json');
  assert.ok(f.calls[0].init.signal); // el pedido es cancelable
});

test('loadIndex: base personalizada, con o sin barra final', async () => {
  for (const base of ['x/content', 'x/content/']) {
    const f = fakeFetch({ 'x/content/index.json': res(index()) });
    assert.equal((await loadIndex(f, { base })).ok, true, base);
  }
});

test('loadIndex: sin index.json (404) NO es fallo: índice vacío con missing', async () => {
  const r = await loadIndex(fakeFetch({}));
  assert.deepEqual([r.ok, r.missing, r.index], [true, true, { schema: 1, packs: [] }]);
});

test('loadIndex: errores de red, 503 sin conexión, 500, timeout, texto roto, índice inválido y enorme', async () => {
  const code = async (f, opts) => (await loadIndex(f, opts)).error.code;
  assert.equal(await code(fakeFetch({ 'content/index.json': () => { throw new TypeError('Failed to fetch'); } })), 'NETWORK');
  assert.equal(await code(fakeFetch({ 'content/index.json': () => Promise.reject(new Error('x')) })), 'NETWORK');
  assert.equal(await code(fakeFetch({ 'content/index.json': res('Sin conexión', 503) })), 'OFFLINE');
  assert.equal(await code(fakeFetch({ 'content/index.json': res('x', 500) })), 'HTTP');
  assert.equal(await code(fakeFetch({ 'content/index.json': () => new Promise(() => {}) }), { timeoutMs: 20 }), 'TIMEOUT');
  assert.equal(await code(fakeFetch({ 'content/index.json': { ok: true, status: 200, text: () => new Promise(() => {}) } }), { timeoutMs: 20 }), 'TIMEOUT');
  assert.equal(await code(fakeFetch({ 'content/index.json': res('{ no json') })), 'BAD_JSON');
  assert.equal(await code(fakeFetch({ 'content/index.json': res({ schema: 2, packs: [] }) })), 'BAD_INDEX');
  assert.equal(await code(fakeFetch({ 'content/index.json': res(index()) }), { maxBytes: 10 }), 'TOO_BIG');
  assert.equal(await code(fakeFetch({ 'content/index.json': { ok: true, status: 200, text: async () => { throw new Error('cortado'); } } })), 'NETWORK');
  assert.equal(await code(fakeFetch({ 'content/index.json': { ok: true, status: 200 } })), 'NETWORK');
  assert.equal(await code(fakeFetch({ 'content/index.json': () => null })), 'NETWORK');
  assert.equal(await code(undefined), 'NO_FETCH');
});

test('loadIndex: el error trae mensaje en español y los primeros problemas', async () => {
  const r = await loadIndex(fakeFetch({ 'content/index.json': res(index([entry({ version: 0 })])) }));
  assert.equal(r.ok, false);
  assert.match(r.error.message, /index\.json/);
  assert.match(r.error.detail[0], /^packs\[0\]\.version: /);
  const off = await loadIndex(fakeFetch({ 'content/index.json': res('x', 503) }));
  assert.match(off.error.message, /Sin conexión/);
});

test('loadIndex: nunca deja un temporizador vivo (el proceso termina sin esperar el tiempo máximo)', async () => {
  const t0 = Date.now();
  await loadIndex(fakeFetch({ 'content/index.json': res(index()) }), { timeoutMs: 60000 });
  assert.ok(Date.now() - t0 < 1000);
});

// ---------- loadPack ----------
const tax = () => { const t = loadTaxonomyFixtures(); return { errorCodes: errorCodeSet(t.errorCodes), topicIds: topicIdSet(t.topics), topicInfo: topicInfo(t.topics) }; };

test('loadPack: caso feliz valida con el contexto y devuelve el paquete', async () => {
  const f = fakeFetch({ [packPath('sample_pack_v1')]: res(loadSample()) });
  const r = await loadPack(entry(), f, { ctx: tax() });
  assert.deepEqual([r.ok, r.pack.pack_id, r.warnings], [true, 'sample_pack_v1', 0]);
  assert.equal(r.pack.items.length, 21);
});

test('loadPack: pide siempre content/packs/<pack_id>.json, nunca la ruta que traiga la entrada', async () => {
  const f = fakeFetch({ [packPath('sample_pack_v1')]: res(loadSample()) });
  const r = await loadPack({ ...entry(), path: 'https://malo.example/x.json' }, f);
  assert.equal(r.ok, true);
  assert.deepEqual(f.calls.map((c) => c.url), [packPath('sample_pack_v1')]);
});

test('loadPack: versión distinta a la del índice → STALE (caché mezclada); otro pack_id → PACK_MISMATCH', async () => {
  const v2 = { ...loadSample(), version: 2 };
  let r = await loadPack(entry(), fakeFetch({ [packPath('sample_pack_v1')]: res(v2) }));
  assert.deepEqual([r.ok, r.error.code, r.error.detail], [false, 'STALE', { expected: 1, got: 2 }]);
  r = await loadPack(entry(), fakeFetch({ [packPath('sample_pack_v1')]: res({ ...loadSample(), pack_id: 'otro_v1' }) }));
  assert.equal(r.error.code, 'PACK_MISMATCH');
  for (const body of ['[1]', '3', 'null']) assert.equal((await loadPack(entry(), fakeFetch({ [packPath('sample_pack_v1')]: res(body) }))).error.code, 'PACK_MISMATCH', body);
});

test('loadPack: un paquete inválido se rechaza con el total y los primeros problemas; validate:false lo deja pasar', async () => {
  const bad = loadSample(); bad.items[0].accept = null; bad.items[1].topics = ['gram.no.existe'];
  const f = fakeFetch({ [packPath('sample_pack_v1')]: res(bad) });
  const r = await loadPack(entry(), f, { ctx: tax() });
  assert.equal(r.error.code, 'INVALID_PACK');
  assert.ok(r.error.detail.total >= 2);
  assert.match(r.error.detail.first[0], /^items\[0\]\.accept: /);
  assert.equal((await loadPack(entry(), f, { validate: false })).ok, true);
});

test('loadPack: los avisos se cuentan pero no impiden cargar', async () => {
  const p = loadSample();
  p.items = p.items.filter((it) => it.topics[0] === 'gram.modals.no_to' || it.id <= 'g.samp.0003'); p.stories = [];
  const r = await loadPack(entry(), fakeFetch({ [packPath('sample_pack_v1')]: res(p) }), { ctx: tax() });
  assert.deepEqual([r.ok, r.warnings], [true, 2]);
});

test('loadPack: errores de red y entradas inválidas devuelven error, no lanzan', async () => {
  const p = packPath('sample_pack_v1');
  assert.equal((await loadPack(entry(), fakeFetch({}))).error.code, 'NOT_FOUND');
  assert.equal((await loadPack(entry(), fakeFetch({ [p]: res('x', 503) }))).error.code, 'OFFLINE');
  assert.equal((await loadPack(entry(), fakeFetch({ [p]: () => { throw new Error('x'); } }))).error.code, 'NETWORK');
  assert.equal((await loadPack(entry(), fakeFetch({ [p]: res('{ roto') }))).error.code, 'BAD_JSON');
  assert.equal((await loadPack(entry(), fakeFetch({ [p]: () => new Promise(() => {}) }), { timeoutMs: 20 })).error.code, 'TIMEOUT');
  assert.equal((await loadPack(entry(), fakeFetch({ [p]: res(loadSample()) }), { maxBytes: 100 })).error.code, 'TOO_BIG');
  for (const bad of [null, undefined, 3, 'x', [], {}, { pack_id: '../x' }, { pack_id: 'AB' }]) assert.equal((await loadPack(bad, fakeFetch({}))).error.code, 'BAD_ENTRY', String(bad));
});

test('loadPack: una entrada sin versión carga lo que haya (la versión solo se compara si el índice la anuncia)', async () => {
  const f = fakeFetch({ [packPath('sample_pack_v1')]: res({ ...loadSample(), version: 7 }) });
  assert.equal((await loadPack({ pack_id: 'sample_pack_v1' }, f)).ok, true);
});

test('loadPack: no modifica la entrada y llamadas simultáneas no se pisan', async () => {
  const e = entry(); const copy = JSON.stringify(e);
  const f = fakeFetch({ [packPath('sample_pack_v1')]: res(loadSample()) });
  const [a, b] = await Promise.all([loadPack(e, f), loadPack(e, f)]);
  assert.deepEqual([a.ok, b.ok], [true, true]);
  assert.notEqual(a.pack, b.pack);
  assert.equal(JSON.stringify(e), copy);
});

test('validatePack se reexporta (8.15) y es el mismo validador', () => {
  assert.equal(validatePack(loadSample(), tax()).ok, true);
});
