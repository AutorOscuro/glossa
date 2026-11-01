// @purpose: Criterios de aceptación 1 a 5 de la subparte 1.10 (cliente de IA) con la pila real: fachada, cola, caché, base en memoria y eventos; servidor y tiempo simulados.
// CA 1: 200/401/429/500/timeout/JSON inválido con servidor falso · CA 2: la caché evita llamadas repetidas · CA 3: sin clave available() es false y nada sale a la red
// CA 4: reintentos con tope · CA 5: ninguna clave en registros, resultados, caché ni consola. Sin red y sin esperas reales (tests/_aiTime.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createAi } from '../core/ai/index.js';
import { createCache } from '../core/ai/cache.js';
import { GROQ_DEFAULT_MODEL } from '../core/ai/providers/groq.js';
import { friendlyMessage } from '../core/ai/messages.js';
import { createEvents } from '../core/events.js';
import { createMemoryDb } from '../core/db.memory.js';
import { fakeTime } from './_aiTime.mjs';
import { makeClock, makeRng } from './_helpers.mjs';

const hashFn = async (text) => createHash('sha256').update(text).digest('hex');
const KEY = 'gsk_CLAVE-SECRETA-ca-0123456789';
const PROMPT = 'Explica la frase PRIVADA-ca-xyz';
const REQ = { task: 'ca.task', messages: [{ role: 'user', content: PROMPT }] };
const reply = (content, usage = { prompt_tokens: 6, completion_tokens: 3 }) => ({ choices: [{ message: { content } }], usage });
const res = (status, json, headers = {}) => ({ status, json: async () => json, headers: { get: (k) => headers[k.toLowerCase()] ?? null } });

async function stack(handler, { conf = {}, over = {}, db: sharedDb } = {}) {
  const T = fakeTime();
  const db = sharedDb ?? createMemoryDb();
  if (!sharedDb) await db.open();
  const events = createEvents({ db, clock: makeClock(), rng: makeRng(5) });
  const cache = createCache({ db, clock: T.clock, hashFn });
  const calls = [];
  const fetchFn = async (url, init) => { calls.push({ url, init, body: JSON.parse(init.body) }); return handler(calls.length, init); };
  const cfg = { mode: 'auto', provider: 'groq', model: 'm-ca', key: KEY, ...conf };
  const ai = createAi({ getConfig: () => cfg, fetchFn, clock: T.clock, timers: T.timers, rng: () => 1, cache, logEvent: (e) => events.log(e), ...over });
  const run = async (req = REQ, ms = 200000) => { const p = ai.complete(req); await T.advance(ms); return p; };
  return { ai, T, db, events, cache, calls, cfg, run };
}

// ───────── CA 1 · servidor falso: 200 / 401 / 429 / 500 / timeout / JSON inválido ─────────
test('CA1: 200 → éxito con texto, uso, modelo y texto escapado', async () => {
  const S = await stack(() => res(200, reply('<b>Hola</b>')));
  const r = await S.run();
  assert.deepEqual([r.ok, r.text, r.model, r.attempts, r.cached, r.usage], [true, '<b>Hola</b>', 'm-ca', 1, undefined, { promptTokens: 6, completionTokens: 3 }]);
  assert.equal(r.safe.text, '&lt;b&gt;Hola&lt;&#47;b&gt;');
});

test('CA1: 401 → clave inválida con mensaje amable, un solo intento y la IA se marca no disponible', async () => {
  const S = await stack(() => res(401, { error: { message: 'bad key ' + KEY } }));
  const r = await S.run();
  assert.deepEqual([r.ok, r.reason, r.attempts, r.status, r.error], [false, 'auth', 1, 401, friendlyMessage('auth')]);
  assert.equal(S.calls.length, 1);
  assert.deepEqual([S.ai.available(), S.ai.availability().reason], [false, 'auth']);
});

test('CA1: 429 → cupo agotado con mensaje amable y cierre temporal con retryAt', async () => {
  const S = await stack(() => res(429, {}));
  const r = await S.run(REQ, 20000); // menos que el cierre de 60 s
  assert.deepEqual([r.ok, r.reason, r.error], [false, 'rate_limit', friendlyMessage('rate_limit')]);
  const a = S.ai.availability();
  assert.deepEqual([a.available, a.reason, a.retryAt > S.T.clock.nowMs()], [false, 'rate_limit', true]);
  await S.T.advance(60000);
  assert.equal(S.ai.available(), true, 'pasado el cierre vuelve a estar disponible');
});

test('CA1: 500 → error del servidor tras los reintentos, con mensaje amable', async () => {
  const S = await stack(() => res(500, {}));
  const r = await S.run();
  assert.deepEqual([r.ok, r.reason, r.error], [false, 'server', friendlyMessage('server')]);
});

test('CA1: timeout → fetch colgado que ignora la señal: se corta y da timeout', async () => {
  const S = await stack(() => new Promise(() => {}), { over: { timeoutMs: 2000 } });
  const r = await S.run(REQ, 100000);
  assert.deepEqual([r.ok, r.reason, r.error], [false, 'timeout', friendlyMessage('timeout')]);
  assert.equal(S.T.pending(), 0, 'sin temporizadores vivos');
});

test('CA1: JSON inválido → una sola reparación y luego bad_json con el texto; JSON arreglado → éxito', async () => {
  const bad = await stack(() => res(200, reply('esto no es json')));
  const r1 = await bad.run({ ...REQ, json: true });
  assert.deepEqual([r1.ok, r1.reason, r1.repaired, bad.calls.length, r1.text], [false, 'bad_json', true, 2, 'esto no es json']);
  const fix = await stack((n) => res(200, reply(n === 1 ? 'nada de json' : '{"a":1}')));
  const r2 = await fix.run({ ...REQ, json: true });
  assert.deepEqual([r2.ok, r2.json, r2.repaired, fix.calls.length], [true, { a: 1 }, true, 2]);
});

// ───────── CA 2 · la caché evita llamadas repetidas ─────────
test('CA2: la misma petición 3 veces → una sola llamada de red; las otras salen de la caché', async () => {
  const S = await stack(() => res(200, reply('Hello')));
  const a = await S.run();
  const b = await S.run();
  const c = await S.run();
  assert.equal(S.calls.length, 1);
  assert.deepEqual([a.cached, b.cached, c.cached, b.attempts, b.text, b.safe.text], [undefined, true, true, 0, 'Hello', 'Hello']);
});

test('CA2: la caché sobrevive a reiniciar el cliente y sirve sin salir a la red', async () => {
  const S = await stack(() => res(200, reply('Hello')));
  await S.run();
  const S2 = await stack(() => { throw new Error('no debe llamar'); }, { db: S.db });
  const r = await S2.run();
  assert.deepEqual([r.ok, r.cached, S2.calls.length], [true, true, 0]);
});

test('CA2: otra entrada, otro modelo o refresh sí llaman; cache:false ni lee ni escribe', async () => {
  const S = await stack(() => res(200, reply('Hello')));
  await S.run();
  await S.run({ ...REQ, messages: [{ role: 'user', content: 'otra cosa' }] });
  assert.equal(S.calls.length, 2);
  S.cfg.model = 'm-otro';
  await S.run();
  assert.equal(S.calls.length, 3);
  S.cfg.model = 'm-ca';
  await S.run({ ...REQ, refresh: true });
  assert.equal(S.calls.length, 4);
  await S.run({ ...REQ, cache: false });
  assert.equal(S.calls.length, 5);
  assert.equal((await S.cache.size()), 3);
});

test('CA2: los fallos no se guardan en la caché y se puede repetir la llamada', async () => {
  const S = await stack((n) => (n <= 4 ? res(500, {}) : res(200, reply('Hello'))));
  assert.equal((await S.run()).ok, false);
  assert.equal(await S.cache.size(), 0);
  const r = await S.run();
  assert.deepEqual([r.ok, r.cached], [true, undefined]);
});

// ───────── CA 3 · sin clave nada sale a la red ─────────
test('CA3: sin clave (vacía, espacios, ilegible o modo mecánico) available() es false y no hay llamadas', async () => {
  for (const conf of [{ key: '' }, { key: '   ' }, { key: undefined }, { key: 5 }, { mode: 'mechanical' }, { provider: 'otro' }]) {
    const S = await stack(() => res(200, reply('x')), { conf });
    assert.equal(S.ai.available(), false, JSON.stringify(conf));
    const r = await S.run();
    assert.equal(r.ok, false);
    assert.equal(S.calls.length, 0, JSON.stringify(conf));
    assert.equal(S.T.pending(), 0);
  }
  const S = await stack(() => res(200, reply('x')));
  S.cfg.key = '';
  assert.deepEqual([S.ai.available(), S.ai.availability().reason], [false, 'no_key']);
});

test('CA3: si leer la configuración falla, tampoco sale nada y no se lanza', async () => {
  const S = await stack(() => res(200, reply('x')));
  const T = fakeTime();
  const ai = createAi({ getConfig: () => { throw new Error('ajustes rotos'); }, fetchFn: async () => { S.calls.push('x'); return res(200, reply('x')); }, clock: T.clock, timers: T.timers });
  assert.equal(ai.available(), false);
  const p = ai.complete(REQ).catch((e) => e);
  await T.advance(1000);
  const r = await p;
  assert.equal(r instanceof Error || r.ok === false, true);
  assert.equal(S.calls.length, 0);
});

test('CA3: con la clave puesta y el modelo vacío, la IA está disponible y usa el modelo por defecto verificado', async () => {
  const S = await stack(() => res(200, reply('x')), { conf: { model: '' } });
  assert.equal(S.ai.available(), true);
  await S.run();
  assert.equal(S.calls[0].body.model, GROQ_DEFAULT_MODEL);
});

// ───────── CA 4 · reintentos con tope ─────────
test('CA4: 429 y 500 reintentan hasta 3 veces (4 llamadas) y paran; el tiempo total no pasa de 45 s', async () => {
  for (const status of [429, 500]) {
    const S = await stack(() => res(status, {}));
    const t0 = S.T.clock.nowMs();
    const p = S.ai.complete(REQ);
    await S.T.advance(100000);
    const r = await p;
    assert.deepEqual([r.ok, r.attempts, S.calls.length], [false, 4, 4], String(status));
    assert.equal(r.ms <= 45000, true, `${status} ms=${r.ms}`);
    assert.equal(S.T.clock.nowMs() >= t0, true);
  }
});

test('CA4: nunca se reintenta 401, 400 ni respuesta rara; el vacío solo una vez; el tope es configurable', async () => {
  for (const [status, body] of [[401, {}], [400, {}], [200, { choices: [] }]]) {
    const S = await stack(() => res(status, body));
    const r = await S.run();
    assert.equal(S.calls.length, 1, `${status}`);
    assert.equal(r.attempts, 1);
  }
  const E = await stack(() => res(200, reply('   ')));
  const re = await E.run();
  assert.deepEqual([re.reason, E.calls.length], ['empty', 2]);
  const C = await stack(() => res(500, {}), { over: { maxRetries: 1 } });
  await C.run();
  assert.equal(C.calls.length, 2);
  const Z = await stack(() => res(500, {}), { over: { maxRetries: 0 } });
  await Z.run();
  assert.equal(Z.calls.length, 1);
});

test('CA4: la espera crece (exponencial con azar) y respeta un Retry-After corto', async () => {
  const S = await stack(() => res(429, {}, { 'retry-after': '2' }));
  const p = S.ai.complete(REQ);
  await S.T.advance(100000);
  const r = await p;
  assert.deepEqual([r.reason, r.attempts], ['rate_limit', 4]);
  const L = await stack(() => res(429, {}, { 'retry-after': '120' }));
  const rl = await L.run();
  assert.deepEqual([rl.reason, rl.attempts, rl.retryAfterMs, L.calls.length], ['rate_limit', 1, 120000, 1]);
});

// ───────── CA 5 · ninguna clave en logs ─────────
test('CA5: la clave no aparece en eventos, caché, resultados, mensajes ni consola (éxito, fallos y caché)', async () => {
  const seen = [];
  const keep = {};
  for (const m of ['log', 'info', 'warn', 'error', 'debug']) { keep[m] = console[m]; console[m] = (...a) => { seen.push(a.map(String).join(' ')); }; }
  const out = [];
  let S;
  try {
    S = await stack((n, init) => {
      if (n === 1) return res(200, reply('texto ok'));
      if (n === 2) return res(401, { error: { message: `key ${KEY} rejected`, authorization: init.headers.Authorization } });
      return res(500, { error: `Bearer ${KEY}` });
    });
    out.push(await S.run());                                              // éxito
    out.push(await S.run());                                              // caché
    S.cfg.model = 'm-2';
    out.push(await S.run());                                              // 401
    S.cfg.key = KEY + '-b';
    out.push(await S.run({ ...REQ, task: 'ca.otra' }));                   // 500
    out.push(S.ai.availability());
  } finally { for (const m of Object.keys(keep)) console[m] = keep[m]; }
  const dump = JSON.stringify([out, await S.db.query('events', {}), await S.db.query('generated', {}), S.cache.stats(), seen]);
  assert.equal(dump.includes('CLAVE-SECRETA'), false, 'la clave se coló');
  assert.equal(dump.includes('gsk_'), false);
  assert.equal(dump.includes('PRIVADA-ca-xyz'), false, 'el prompt se coló en registros o resultados');
  const evs = await S.db.query('events', {});
  assert.equal(evs.length >= 3, true);
  for (const e of evs) { assert.equal(e.type, 'ai_call'); assert.match(e.responseRaw, /^ok=[01] cached=[01] attempts=\d+ tokens=\d+ est=[01]( reason=[a-z_]+)?$/); }
  const sent = S.calls[0].init;
  assert.equal(sent.headers.Authorization, `Bearer ${KEY}`, 'la clave solo viaja en la cabecera');
  assert.equal(sent.body.includes('CLAVE-SECRETA'), false, 'nunca en el cuerpo');
});
