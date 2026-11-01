// @purpose: Pruebas de la fachada de IA con caché, registro ai_call, disponibilidad fina y texto escapado (1.10-T3), con base en memoria y fetch simulado.
// Sin red y con tiempo falso (tests/_aiTime.mjs): ninguna espera real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAi, normalizeRequest, callRecord } from '../core/ai/index.js';
import { createCache } from '../core/ai/cache.js';
import { GROQ_DEFAULT_MODEL } from '../core/ai/providers/groq.js';
import { createEvents } from '../core/events.js';
import { createMemoryDb } from '../core/db.memory.js';
import { createHash } from 'node:crypto';
import { fakeTime } from './_aiTime.mjs';
import { makeClock, makeRng } from './_helpers.mjs';

// Hash síncrono: crypto.subtle resuelve en un hilo real y dejaría la prueba esperando fuera del reloj falso (la caché real se prueba en aiCache.test.mjs).
const hashFn = async (text) => createHash('sha256').update(text).digest('hex');
const KEY = 'clave-secreta-987';
const PROMPT = 'Explica con detalle la frase privada-xyz';
const MSGS = [{ role: 'user', content: PROMPT }];
const REQ = { task: 'test.t', messages: MSGS };
const body = (content, usage = { prompt_tokens: 5, completion_tokens: 2 }) => ({ choices: [{ message: { content } }], usage });
const res = (status, json, headers = {}) => ({ status, json: async () => json, headers: { get: (k) => headers[k.toLowerCase()] ?? null } });

async function setup(handler, { conf = {}, over = {}, withCache = true, withEvents = true, cacheOpts = {} } = {}) {
  const T = fakeTime();
  const db = createMemoryDb();
  await db.open();
  const events = createEvents({ db, clock: makeClock(), rng: makeRng(3) });
  const cache = createCache({ db, clock: T.clock, hashFn, ...cacheOpts });
  const calls = [];
  const f = async (url, init) => { calls.push({ url, init, body: JSON.parse(init.body) }); return handler(calls.length, init); };
  const cfg = { mode: 'auto', provider: 'groq', model: 'm-1', key: KEY, ...conf };
  const ai = createAi({
    getConfig: () => cfg, fetchFn: f, clock: T.clock, timers: T.timers, rng: () => 1,
    ...(withCache ? { cache } : {}), ...(withEvents ? { logEvent: (e) => events.log(e) } : {}), ...over,
  });
  const run = async (req, ms = 120000) => { const p = ai.complete(req); await T.advance(ms); return p; };
  const evs = () => db.query('events', {});
  return { ai, T, db, events, cache, calls, cfg, run, evs };
}
const ok200 = () => res(200, body('Hello'));

test('CA2: la segunda llamada igual sale de la caché, sin red, con cached y attempts 0', async () => {
  const S = await setup(ok200);
  const a = await S.run(REQ);
  const b = await S.run(REQ);
  assert.equal(S.calls.length, 1);
  assert.deepEqual([a.ok, a.cached, a.attempts, a.text], [true, undefined, 1, 'Hello']);
  assert.deepEqual([b.ok, b.cached, b.attempts, b.text, b.provider, b.model], [true, true, 0, 'Hello', 'groq', 'm-1']);
  assert.deepEqual(b.usage, a.usage);
});

test('la caché guarda y devuelve el JSON validado, también tras una reparación', async () => {
  const S = await setup((n) => res(200, body(n === 1 ? 'no es json' : '{"a":1}')));
  const req = { ...REQ, schema: { type: 'object', required: ['a'], properties: { a: { type: 'integer' } } } };
  const a = await S.run(req);
  assert.deepEqual([a.ok, a.repaired, a.json, S.calls.length], [true, true, { a: 1 }, 2]);
  const b = await S.run(req);
  assert.deepEqual([b.ok, b.cached, b.json, S.calls.length], [true, true, { a: 1 }, 2]);
});

test('lo que falla no se guarda: un 500 y luego un 200 llaman dos veces y recién entonces cachean', async () => {
  const S = await setup((n) => (n <= 4 ? res(500, {}) : ok200()), { over: { maxRetries: 3 } });
  const a = await S.run(REQ);
  assert.deepEqual([a.ok, a.reason, S.calls.length, await S.cache.size()], [false, 'server', 4, 0]);
  const b = await S.run(REQ);
  assert.deepEqual([b.ok, S.calls.length, await S.cache.size()], [true, 5, 1]);
  const bad = await setup(() => res(200, body('no json')));
  const c = await bad.run({ ...REQ, json: true });
  assert.deepEqual([c.ok, c.reason, await bad.cache.size()], [false, 'bad_json', 0]);
  const sch = await setup(() => res(200, body('{"a":"x"}')));
  const d = await sch.run({ ...REQ, schema: { type: 'object', properties: { a: { type: 'integer' } } } });
  assert.deepEqual([d.ok, d.reason, await sch.cache.size()], [false, 'schema', 0]);
});

test('cache: false ni lee ni escribe; refresh: true no lee pero sí escribe lo nuevo', async () => {
  const S = await setup((n) => res(200, body(`R${n}`)));
  await S.run({ ...REQ, cache: false });
  assert.equal(await S.cache.size(), 0);
  const a = await S.run(REQ);
  const b = await S.run({ ...REQ, cache: false });
  assert.deepEqual([a.text, b.text, S.calls.length], ['R2', 'R3', 3]);
  const c = await S.run({ ...REQ, refresh: true });
  assert.deepEqual([c.text, c.cached, S.calls.length], ['R4', undefined, 4]);
  const d = await S.run(REQ);
  assert.deepEqual([d.text, d.cached], ['R4', true]);
});

test('otro modelo, otra temperatura o un mensaje distinto no reutilizan la caché', async () => {
  const S = await setup(ok200);
  await S.run(REQ);
  S.cfg.model = 'm-2';
  await S.run(REQ);
  await S.run({ ...REQ, temperature: 0.9 });
  await S.run({ ...REQ, messages: [{ role: 'user', content: 'otra cosa' }] });
  assert.equal(S.calls.length, 4);
  S.cfg.model = 'm-1';
  assert.equal((await S.run(REQ)).cached, true);
  assert.equal(S.calls.length, 4);
});

test('sin conexión la caché sigue sirviendo, y sin caché el fallo es network', async () => {
  let down = false;
  const S = await setup(() => { if (down) throw new Error('offline'); return ok200(); }, { over: { maxRetries: 0 } });
  await S.run(REQ);
  down = true;
  const hit = await S.run(REQ);
  assert.deepEqual([hit.ok, hit.cached], [true, true]);
  const miss = await S.run({ ...REQ, task: 'test.otra' });
  assert.deepEqual([miss.ok, miss.reason], [false, 'network']);
});

test('CA3: sin clave nada sale a la red, available() es false y la caché no se consulta con el modo mecánico', async () => {
  const S = await setup(ok200, { conf: { key: '' } });
  const r = await S.run(REQ);
  assert.deepEqual([r.ok, r.reason, S.calls.length, S.ai.available(), S.ai.availability().reason], [false, 'no_key', 0, false, 'no_key']);
  const M = await setup(ok200);
  await M.run(REQ);
  M.cfg.mode = 'mechanical';
  const m = await M.run(REQ);
  assert.deepEqual([m.ok, m.reason, m.cached, M.calls.length, M.ai.available()], [false, 'no_ai', undefined, 1, false]);
});

test('una caché cuya base falla no rompe la llamada', async () => {
  const boom = async () => { throw new Error('boom'); };
  const S = await setup(ok200, { withCache: false });
  const cache = createCache({ db: { get: boom, put: boom, query: boom, delete: boom }, clock: S.T.clock, hashFn });
  const ai = createAi({ getConfig: () => S.cfg, fetchFn: async () => ok200(), clock: S.T.clock, timers: S.T.timers, rng: () => 1, cache });
  const p = ai.complete(REQ); await S.T.advance(60000);
  const r = await p;
  assert.deepEqual([r.ok, r.text, r.cached], [true, 'Hello', undefined]);
});

test('ai_call: un éxito deja UN evento con tarea, ms, modo y conteo, sin clave ni prompt ni texto', async () => {
  const S = await setup(ok200);
  await S.run({ ...REQ, task: 'examples.gen-x' });
  const [e, ...rest] = await S.evs();
  assert.equal(rest.length, 0);
  assert.deepEqual([e.type, e.mode, e.exerciseType, e.itemId, e.cardId, e.result, e.topics, e.errorCodes], ['ai_call', 'ai', 'examples_gen_x', null, null, null, [], []]);
  assert.equal(e.responseRaw, 'ok=1 cached=0 attempts=1 tokens=7 est=0');
  assert.ok(Number.isInteger(e.ms) && e.ms >= 0);
  const dump = JSON.stringify(await S.db.exportAll());
  assert.ok(!dump.includes(KEY));
  assert.ok(!(JSON.stringify(e).includes('privada-xyz')) && !JSON.stringify(e).includes('Hello'));
});

test('ai_call: un fallo lleva el motivo y los intentos; los tokens son aproximados (est=1)', async () => {
  const S = await setup(() => res(429, {}), { over: { maxRetries: 2 } });
  const r = await S.run(REQ);
  assert.equal(r.reason, 'rate_limit');
  const [e] = await S.evs();
  assert.equal(e.responseRaw, `ok=0 cached=0 attempts=3 tokens=${Math.ceil(PROMPT.length / 4)} est=1 reason=rate_limit`);
});

test('ai_call: un acierto de la caché también se registra (cached=1, attempts=0)', async () => {
  const S = await setup(ok200);
  await S.run(REQ);
  await S.run(REQ);
  const evs = await S.evs();
  assert.equal(evs.length, 2);
  assert.ok(evs.some((e) => e.responseRaw === 'ok=1 cached=1 attempts=0 tokens=7 est=0'));
});

test('ai_call: no se registra lo que no salió a la red (sin clave, modo mecánico, endpoint malo, cola llena)', async () => {
  for (const conf of [{ key: '' }, { mode: 'mechanical' }, { endpoint: 'http://x.test' }]) {
    const S = await setup(ok200, { conf });
    await S.run(REQ);
    assert.equal((await S.evs()).length, 0, JSON.stringify(Object.keys(conf)));
    assert.equal(S.calls.length, 0);
  }
  const Q = await setup(() => new Promise(() => {}), { over: { concurrency: 1, maxPending: 0, timeoutMs: 1000, maxRetries: 0 } });
  const first = Q.ai.complete(REQ);
  const second = await Q.ai.complete({ ...REQ, task: 'test.dos' });
  assert.equal(second.reason, 'queue_full');
  await Q.T.advance(5000);
  await first;
  const evs = await Q.evs();
  assert.equal(evs.length, 1);
  assert.match(evs[0].responseRaw, /reason=timeout/);
});

test('ai_call: si registrar falla o es lento-fallido, el resultado no cambia', async () => {
  const S = await setup(ok200, { withEvents: false, over: { logEvent: async () => { throw new Error('base llena'); } } });
  const r = await S.run(REQ);
  assert.deepEqual([r.ok, r.text], [true, 'Hello']);
  const S2 = await setup(ok200, { withEvents: false, over: { logEvent: () => { throw new Error('síncrono'); } } });
  assert.equal((await S2.run(REQ)).ok, true);
});

test('callRecord: forma, límites y saneamiento del evento', () => {
  const m = [{ role: 'user', content: 'x'.repeat(8) }];
  const long = 'a'.repeat(59);
  const r = callRecord(long, { ok: true, text: 'abcd', usage: { promptTokens: null, completionTokens: 4 }, attempts: 1, ms: 9e9 }, m, false);
  assert.equal(r.exerciseType.length, 40);
  assert.equal(r.ms, 86400000);
  assert.equal(r.responseRaw, 'ok=1 cached=0 attempts=1 tokens=3 est=1');
  const f = callRecord('t', { ok: false, reason: 'Raro/<x>', attempts: 2, ms: 5 }, m, false);
  assert.equal(f.responseRaw, 'ok=0 cached=0 attempts=2 tokens=2 est=1 reason=arox');
  assert.deepEqual(Object.keys(r).sort(), ['exerciseType', 'mode', 'ms', 'responseRaw', 'type']);
});

test('disponibilidad: un motivo claro para cada caso y available() es el booleano', async () => {
  const cases = [
    [{}, true, null],
    [{ key: '' }, false, 'no_key'],
    [{ key: '   ' }, false, 'no_key'],
    [{ model: '' }, true, null],
    [{ model: '  ' }, true, null],
    [{ mode: 'mechanical' }, false, 'no_ai'],
    [{ provider: 'otro' }, false, 'no_ai'],
    [{ endpoint: 'http://x.test' }, false, 'bad_endpoint'],
    [{ endpoint: 'https://ok.example.com/v1/x' }, true, null],
  ];
  for (const [conf, av, reason] of cases) {
    const S = await setup(ok200, { conf });
    assert.deepEqual([S.ai.available(), S.ai.availability().reason], [av, reason], JSON.stringify(conf));
    assert.equal(S.calls.length, 0);
  }
});

test('disponibilidad: una clave rechazada (401) marca «auth» hasta que cambie la clave', async () => {
  const S = await setup((n) => (n === 1 ? res(401, {}) : ok200()));
  assert.equal(S.ai.available(), true);
  const r = await S.run(REQ);
  assert.equal(r.reason, 'auth');
  assert.deepEqual([S.ai.available(), S.ai.availability().reason], [false, 'auth']);
  S.cfg.key = 'otra-clave-555';
  assert.equal(S.ai.available(), true);
  S.cfg.key = KEY;
  assert.equal(S.ai.available(), false);
  assert.ok(!JSON.stringify(S.ai.availability()).includes(KEY));
  S.cfg.key = 'otra-clave-555';
  const ok = await S.run(REQ);
  assert.equal(ok.ok, true);
  S.cfg.key = KEY;
  assert.equal(S.ai.available(), true);
});

test('disponibilidad: un 429 tras los reintentos cierra la IA un rato (retryAfter o el defecto) y se reabre solo', async () => {
  const S = await setup(() => res(429, {}, { 'retry-after': '3' }), { over: { maxRetries: 0 } });
  const t0 = S.T.clock.nowMs();
  await S.run(REQ, 100);
  const a = S.ai.availability();
  assert.deepEqual([a.available, a.reason], [false, 'rate_limit']);
  assert.ok(a.retryAt >= t0 + 3000 && a.retryAt <= t0 + 3100, String(a.retryAt));
  assert.ok(a.retryAt > S.T.clock.nowMs());
  await S.T.advance(a.retryAt - S.T.clock.nowMs() - 1);
  assert.equal(S.ai.available(), false);
  await S.T.advance(1);
  assert.equal(S.ai.available(), true);
  const D = await setup(() => res(429, {}), { over: { maxRetries: 0, rateLimitCooldownMs: 5000 } });
  await D.run(REQ, 50);
  const b = D.ai.availability();
  await D.T.advance(5000);
  assert.deepEqual([b.available, D.ai.available()], [false, true]);
});

test('disponibilidad: un éxito real borra el cierre; un acierto de la caché no lo borra', async () => {
  let fail = true;
  const S = await setup(() => (fail ? res(429, {}) : ok200()), { over: { maxRetries: 0, rateLimitCooldownMs: 60000 } });
  await S.cache.set(await S.cache.key({ ...normalizeRequest({ task: 'test.c', messages: MSGS }) }, 'm-1'), { text: 'viejo' });
  await S.run(REQ, 50);
  assert.equal(S.ai.available(), false);
  const hit = await S.run({ task: 'test.c', messages: MSGS }, 10);
  assert.equal(hit.cached, true);
  assert.equal(S.ai.available(), false);
  fail = false;
  // Poco tiempo: si «available» se reabriera por el reloj y no por el éxito, esta prueba no lo notaría.
  const r = await S.run({ ...REQ, task: 'test.nuevo' }, 50);
  assert.equal(r.ok, true);
  assert.equal(S.ai.available(), true);
});

test('el tope del cierre por cupo es 15 minutos aunque el servidor pida más', async () => {
  const S = await setup(() => res(429, {}, { 'retry-after': '99999' }), { over: { maxRetries: 0 } });
  await S.run(REQ, 50);
  const a = S.ai.availability();
  assert.ok(a.retryAt - S.T.clock.nowMs() <= 15 * 60000);
  assert.ok(a.retryAt - S.T.clock.nowMs() > 14 * 60000);
});

test('una configuración que lanza no tumba availability() ni available()', async () => {
  const T = fakeTime();
  const ai = createAi({ getConfig: () => { throw new Error('boom'); }, fetchFn: async () => ok200(), clock: T.clock, timers: T.timers });
  assert.deepEqual([ai.available(), ai.availability().reason], [false, 'no_ai']);
});

test('safe: el texto y el JSON de la IA vienen escapados; el original sigue en text y json', async () => {
  const S = await setup(() => res(200, body('{"t":"<script>alert(1)<\\/script>","<k>":["&"]}')));
  const r = await S.run({ ...REQ, json: true });
  assert.deepEqual(r.json, { t: '<script>alert(1)</script>', '<k>': ['&'] });
  assert.ok(!r.safe.text.includes('<'));
  assert.deepEqual(r.safe.json, { t: '&lt;script&gt;alert(1)&lt;&#47;script&gt;', '&lt;k&gt;': ['&amp;'] });
  const bad = await setup(() => res(200, body('<b>no json</b>')));
  const f = await bad.run({ ...REQ, json: true });
  assert.deepEqual([f.ok, f.reason, f.safe.text], [false, 'bad_json', '&lt;b&gt;no json&lt;&#47;b&gt;']);
  const e = await setup(() => res(500, {}), { over: { maxRetries: 0 } });
  assert.equal((await e.run(REQ)).safe, undefined);
});

test('tutor: antepone el prompt base como primer mensaje y el nivel y el JSON salen cuando corresponden', async () => {
  const S = await setup(ok200);
  await S.run({ ...REQ, tutor: { level: 'B1' } });
  const sent = S.calls[0].body.messages;
  assert.equal(sent.length, 2);
  assert.equal(sent[0].role, 'system');
  assert.match(sent[0].content, /nivel de la persona: B1/);
  assert.ok(!/SOLO con el JSON/.test(sent[0].content));
  assert.deepEqual(sent[1], MSGS[0]);
  await S.run({ ...REQ, tutor: true, json: true });
  assert.match(S.calls[1].body.messages[0].content, /SOLO con el JSON/);
  const n = normalizeRequest({ ...REQ, tutor: true });
  assert.equal(n.messages[0].role, 'system');
  assert.equal(normalizeRequest(REQ).messages.length, 1);
});

test('tutor, cache y refresh con valores raros lanzan un error claro', () => {
  assert.throws(() => normalizeRequest({ ...REQ, tutor: 'si' }), /tutor/);
  assert.throws(() => normalizeRequest({ ...REQ, tutor: null }), /tutor/);
  assert.throws(() => normalizeRequest({ ...REQ, tutor: [] }), /tutor/);
  assert.throws(() => normalizeRequest({ ...REQ, tutor: false === 0 }), /tutor/);
  assert.throws(() => normalizeRequest({ ...REQ, cache: 'no' }), /«cache»/);
  assert.throws(() => normalizeRequest({ ...REQ, refresh: 1 }), /«refresh»/);
  const many = Array.from({ length: 40 }, () => ({ role: 'user', content: 'x' }));
  assert.throws(() => normalizeRequest({ task: 'a.b', messages: many, tutor: true }), /sobra un mensaje/);
  assert.equal(normalizeRequest({ task: 'a.b', messages: many }).messages.length, 40);
});

test('createAi valida cache, logEvent y rateLimitCooldownMs', async () => {
  const base = { getConfig: () => ({}), fetchFn: async () => ok200() };
  assert.throws(() => createAi({ ...base, cache: {} }), /cache/);
  assert.throws(() => createAi({ ...base, cache: 5 }), /cache/);
  assert.throws(() => createAi({ ...base, logEvent: 'x' }), /logEvent/);
  for (const bad of [-1, 1.5, 900001, '5']) assert.throws(() => createAi({ ...base, rateLimitCooldownMs: bad }), /rateLimitCooldownMs/);
  assert.doesNotThrow(() => createAi({ ...base, rateLimitCooldownMs: 0 }));
});

test('la clave jamás aparece en resultados, eventos ni registros de la caché', async () => {
  const S = await setup(ok200);
  const a = await S.run(REQ);
  const b = await S.run(REQ);
  const dump = JSON.stringify([a, b, await S.db.exportAll(), S.ai.availability()]);
  assert.ok(!dump.includes(KEY));
});

// ── Cierre de huecos de las roturas 4.R sobre index.js (1.10-T3) ──

test('callRecord: los tokens solo son exactos con prompt y completion; si falta uno se estiman por caracteres hacia arriba', () => {
  const m = [{ role: 'user', content: 'x'.repeat(5) }];
  const solo = callRecord('t', { ok: true, text: '', usage: { promptTokens: 4 }, attempts: 1, ms: 1 }, m, false);
  assert.equal(solo.responseRaw, 'ok=1 cached=0 attempts=1 tokens=2 est=1');
  const fallo = callRecord('t', { ok: false, reason: 'server', attempts: 1, ms: 1 }, m, false);
  assert.equal(fallo.responseRaw, 'ok=0 cached=0 attempts=1 tokens=2 est=1 reason=server');
  const exacto = callRecord('t', { ok: true, text: 'zz', usage: { promptTokens: 4, completionTokens: 3 }, attempts: 1, ms: 1 }, m, true);
  assert.equal(exacto.responseRaw, 'ok=1 cached=1 attempts=1 tokens=7 est=0');
});

test('tutor: con 39 mensajes cabe el del prompt base (40) y con 40 ya no', () => {
  const con = (n) => Array.from({ length: n }, () => ({ role: 'user', content: 'x' }));
  const r = normalizeRequest({ task: 'a.b', messages: con(39), tutor: true });
  assert.equal(r.messages.length, 40);
  assert.equal(r.messages[0].role, 'system');
  assert.throws(() => normalizeRequest({ task: 'a.b', messages: con(40), tutor: true }), /sobra un mensaje/);
});

test('rateLimitCooldownMs: 0 y 900000 son válidos y 900001 no', () => {
  const base = { getConfig: () => ({}), fetchFn: async () => ok200() };
  assert.doesNotThrow(() => createAi({ ...base, rateLimitCooldownMs: 900000 }));
  assert.throws(() => createAi({ ...base, rateLimitCooldownMs: 900001 }), /rateLimitCooldownMs/);
});

test('modelo vacío (1.10-T4): se llama con el modelo por defecto, se registra el ai_call y la segunda vez sale de la caché', async () => {
  const S = await setup(ok200, { conf: { model: '  ' } });
  const a = await S.run(REQ);
  const b = await S.run(REQ);
  assert.deepEqual([a.ok, a.model, b.cached, S.calls.length], [true, GROQ_DEFAULT_MODEL, true, 1]);
  assert.equal(S.calls[0].body.model, GROQ_DEFAULT_MODEL);
  const evs = await S.evs();
  assert.equal(evs.length, 2);
  const rec = (await S.db.query('generated', {}))[0];
  assert.equal(rec.model, GROQ_DEFAULT_MODEL);
});
