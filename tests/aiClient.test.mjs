// @purpose: Pruebas de la fachada de IA con cola (1.10-T2): reintentos, tiempo límite, cancelación, JSON reparado una vez, Retry-After y clave nunca filtrada.
// fetch es siempre un doble y el tiempo es falso (tests/_aiTime.mjs): sin red y sin esperas reales.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAi, normalizeRequest } from '../core/ai/index.js';
import { retryAfterMs } from '../core/ai/providers/groq.js';
import { friendlyMessage } from '../core/ai/messages.js';
import { fakeTime, flush } from './_aiTime.mjs';

const KEY = 'clave-secreta-987';
const MSGS = [{ role: 'user', content: 'Explica "have been"' }];
const body = (content) => ({ choices: [{ message: { content } }], usage: { prompt_tokens: 5, completion_tokens: 2 } });
const res = (status, json, headers = {}) => ({ status, json: async () => { if (json === undefined) throw new Error('sin cuerpo'); return json; }, headers: { get: (k) => headers[k.toLowerCase()] ?? null } });
function setup(handler, over = {}, conf = {}) {
  const T = fakeTime();
  const calls = [];
  const f = async (url, init) => { calls.push({ url, init, body: JSON.parse(init.body) }); return handler(calls.length, init); };
  const ai = createAi({ getConfig: () => ({ mode: 'auto', provider: 'groq', model: 'm-1', key: KEY, ...conf }), fetchFn: f, clock: T.clock, timers: T.timers, rng: () => 1, ...over });
  return { ai, T, calls };
}
const run = async (S, req, ms = 120000) => { const p = S.ai.complete(req); await S.T.advance(ms); return p; };
const REQ = { task: 'test.t', messages: MSGS };
const noKey = (x) => assert.ok(!JSON.stringify(x).includes(KEY), 'la clave no debe aparecer');

test('429 y luego 200: éxito con 2 intentos, ms de reloj y sin error', async () => {
  const S = setup((n) => (n === 1 ? res(429, {}) : res(200, body('Hello'))));
  const r = await run(S, REQ);
  assert.deepEqual([r.ok, r.text, r.attempts, r.provider, S.calls.length, r.error], [true, 'Hello', 2, 'groq', 2, undefined]);
  assert.ok(r.ms >= 500 && r.ms <= 120000);
  noKey(r);
});
test('401: un solo intento, motivo auth y mensaje amable sobre la clave', async () => {
  const S = setup(() => res(401, {}));
  const r = await run(S, REQ);
  assert.deepEqual([r.ok, r.reason, r.attempts, S.calls.length, r.error], [false, 'auth', 1, 1, friendlyMessage('auth')]);
  assert.match(r.error, /clave/);
  noKey(r);
});
test('500 sin parar: 4 intentos, motivo server, mensaje amable', async () => {
  const S = setup(() => res(500, {}));
  const r = await run(S, REQ);
  assert.deepEqual([r.reason, r.attempts, S.calls.length, r.error], ['server', 4, 4, friendlyMessage('server')]);
});
test('429 sin parar: 4 intentos y mensaje de cupo (modo mecánico)', async () => {
  const S = setup(() => res(429, {}));
  const r = await run(S, REQ);
  assert.deepEqual([r.reason, r.attempts], ['rate_limit', 4]);
  assert.match(r.error, /cupo/);
});
test('red caída: se reintenta y al final network; el mensaje del error no se propaga', async () => {
  const S = setup(() => { throw new Error(`fallo con ${KEY}`); });
  const r = await run(S, REQ);
  assert.deepEqual([r.reason, r.attempts, r.error], ['network', 4, friendlyMessage('network')]);
  noKey(r);
});
test('red que vuelve: 2 caídas y luego éxito', async () => {
  const S = setup((n) => { if (n < 3) throw new Error('caída'); return res(200, body('ok')); });
  const r = await run(S, REQ);
  assert.deepEqual([r.ok, r.attempts], [true, 3]);
});
test('respuesta vacía: se reintenta una vez; si sigue vacía, empty', async () => {
  const S = setup(() => res(200, body('  ')));
  const r = await run(S, REQ);
  assert.deepEqual([r.reason, r.attempts, S.calls.length, r.error], ['empty', 2, 2, friendlyMessage('empty')]);
  const S2 = setup((n) => res(200, body(n === 1 ? '' : 'listo')));
  assert.equal((await run(S2, REQ)).text, 'listo');
});
test('bad_response (200 sin choices) no se reintenta', async () => {
  const S = setup(() => res(200, { nada: 1 }));
  const r = await run(S, REQ);
  assert.deepEqual([r.reason, r.attempts], ['bad_response', 1]);
});
test('400 no se reintenta', async () => {
  const S = setup(() => res(400, {}));
  const r = await run(S, REQ);
  assert.deepEqual([r.reason, r.attempts, S.calls.length], ['bad_request', 1, 1]);
});

// ---------- tiempo límite y cancelación ----------
const hang = (init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(Object.assign(new Error('abort'), { name: 'AbortError' }))));
test('fetch colgado: timeout a los 20 s por intento; con maxRetries 0 son 20 s en total', async () => {
  const S = setup((n, init) => hang(init), { maxRetries: 0 });
  const p = S.ai.complete(REQ);
  await S.T.advance(19999);
  let settled = false; p.then(() => { settled = true; });
  await flush(); assert.equal(settled, false);
  await S.T.advance(1);
  const r = await p;
  assert.deepEqual([r.reason, r.attempts, r.ms, r.error], ['timeout', 1, 20000, friendlyMessage('timeout')]);
});
test('timeout configurable: opción de la fachada y por petición', async () => {
  const S = setup((n, init) => hang(init), { maxRetries: 0, timeoutMs: 3000 });
  const p = S.ai.complete(REQ);
  await S.T.advance(3000);
  assert.equal((await p).ms, 3000);
  const p2 = S.ai.complete({ ...REQ, timeoutMs: 1000 });
  await S.T.advance(1000);
  assert.equal((await p2).reason, 'timeout');
});
test('timeout se reintenta y un éxito posterior se entrega', async () => {
  const S = setup((n, init) => (n === 1 ? hang(init) : res(200, body('ya'))));
  const p = S.ai.complete(REQ);
  await S.T.advance(20000 + 500);
  const r = await p;
  assert.deepEqual([r.ok, r.attempts, r.text], [true, 2, 'ya']);
});
test('cancelar con la señal de quien llama: aborted, sin reintentos y sin mensaje de error de red', async () => {
  const S = setup((n, init) => hang(init));
  const ctl = new AbortController();
  const p = S.ai.complete({ ...REQ, signal: ctl.signal });
  await flush();
  ctl.abort();
  const r = await p;
  assert.deepEqual([r.reason, r.attempts, S.calls.length, r.error], ['aborted', 1, 1, friendlyMessage('aborted')]);
});
test('una señal ya abortada no llama a la red', async () => {
  const S = setup(() => res(200, body('x')));
  const ctl = new AbortController(); ctl.abort();
  const r = await S.ai.complete({ ...REQ, signal: ctl.signal });
  assert.deepEqual([r.reason, S.calls.length], ['aborted', 0]);
});
test('timeoutMs inválido en la petición lanza Error en español', () => {
  for (const v of [0, 999, 300001, '5000', 1.5, null]) assert.throws(() => normalizeRequest({ ...REQ, timeoutMs: v }), /timeoutMs/, String(v));
  assert.equal(normalizeRequest({ ...REQ, timeoutMs: 5000 }).timeoutMs, 5000);
  assert.equal(normalizeRequest(REQ).timeoutMs, undefined);
});

// ---------- sin IA / sin ajustes ----------
test('modo mecánico: no hay red, ni cola, ni intentos, y trae mensaje', async () => {
  const S = setup(() => res(200, body('x')), {}, { mode: 'mechanical' });
  const r = await S.ai.complete(REQ);
  assert.deepEqual([r.ok, r.reason, r.provider, r.attempts, S.calls.length, r.error], [false, 'no_ai', 'none', 0, 0, friendlyMessage('no_ai')]);
});
test('sin clave / endpoint malo: ninguna llamada de red y mensaje amable (con el modelo vacío sí se llama, con el defecto)', async () => {
  for (const [conf, reason] of [[{ key: '' }, 'no_key'], [{ endpoint: 'http://x.y/z' }, 'bad_endpoint']]) {
    const S = setup(() => res(200, body('x')), {}, conf);
    const r = await S.ai.complete(REQ);
    assert.deepEqual([r.reason, r.attempts, S.calls.length, r.error], [reason, 1, 0, friendlyMessage(reason)], reason);
    assert.equal(S.T.pending(), 0);
  }
});

// ---------- JSON reparado una sola vez ----------
const SCHEMA = { type: 'object', required: ['a'], properties: { a: { type: 'number' } } };
test('JSON inválido: un reintento con «corrige a JSON válido» mostrando su respuesta; si sale bien, éxito', async () => {
  const S = setup((n) => res(200, body(n === 1 ? 'Claro: a vale 1' : '{"a":1}')));
  const r = await run(S, { ...REQ, schema: SCHEMA });
  assert.deepEqual([r.ok, r.json, r.repaired, r.attempts, S.calls.length], [true, { a: 1 }, true, 2, 2]);
  const m = S.calls[1].body.messages;
  assert.equal(m.length, MSGS.length + 2);
  assert.deepEqual(m.slice(0, MSGS.length), MSGS);
  assert.deepEqual([m.at(-2).role, m.at(-2).content], ['assistant', 'Claro: a vale 1']);
  assert.equal(m.at(-1).role, 'user');
  assert.match(m.at(-1).content, /JSON válido/);
  assert.deepEqual(S.calls[0].body.messages, MSGS);
  assert.equal(S.calls[1].body.response_format.type, 'json_object');
});
test('JSON inválido dos veces: bad_json con el texto del segundo intento y SOLO 2 llamadas', async () => {
  const S = setup((n) => res(200, body(n === 1 ? 'no json' : 'sigue sin json')));
  const r = await run(S, { ...REQ, json: true });
  assert.deepEqual([r.ok, r.reason, r.text, r.repaired, r.attempts, S.calls.length, r.error], [false, 'bad_json', 'sigue sin json', true, 2, 2, friendlyMessage('bad_json')]);
});
test('JSON válido a la primera: no hay reparación ni campo repaired', async () => {
  const S = setup(() => res(200, body('{"a":2}')));
  const r = await run(S, { ...REQ, schema: SCHEMA });
  assert.deepEqual([r.json, r.repaired, r.attempts, S.calls.length], [{ a: 2 }, undefined, 1, 1]);
});
test('JSON válido pero que no cumple el esquema: schema, sin reparación', async () => {
  const S = setup(() => res(200, body('{"a":"x"}')));
  const r = await run(S, { ...REQ, schema: SCHEMA });
  assert.deepEqual([r.reason, S.calls.length, r.repaired, r.error], ['schema', 1, undefined, friendlyMessage('schema')]);
  assert.ok(Array.isArray(r.errors) && r.errors.length > 0);
});
test('reparado y luego no cumple el esquema: schema con repaired true', async () => {
  const S = setup((n) => res(200, body(n === 1 ? 'x' : '{"a":"no"}')));
  const r = await run(S, { ...REQ, schema: SCHEMA });
  assert.deepEqual([r.reason, r.repaired, S.calls.length], ['schema', true, 2]);
});
test('sin json pedido, un texto que no es JSON se entrega tal cual', async () => {
  const S = setup(() => res(200, body('texto libre')));
  const r = await run(S, REQ);
  assert.deepEqual([r.ok, r.text, S.calls.length, r.json], [true, 'texto libre', 1, undefined]);
});
test('la reparación también reintenta ante 500 y suma sus intentos; si falla, lleva repaired y mensaje', async () => {
  const S = setup((n) => (n === 1 ? res(200, body('basura')) : res(500, {})));
  const r = await run(S, { ...REQ, json: true });
  assert.deepEqual([r.reason, r.repaired, r.attempts, S.calls.length, r.error], ['server', true, 5, 5, friendlyMessage('server')]);
});
test('la respuesta mala que se le muestra a la IA se recorta a 6000 caracteres', async () => {
  const S = setup((n) => res(200, body(n === 1 ? 'z'.repeat(20000) : '{"a":1}')));
  await run(S, { ...REQ, json: true });
  assert.equal(S.calls[1].body.messages.at(-2).content.length, 6000);
});
test('los mensajes originales de quien llama no se modifican al reparar', async () => {
  const S = setup((n) => res(200, body(n === 1 ? 'x' : '{"a":1}')));
  const msgs = [{ role: 'user', content: 'hola' }];
  await run(S, { task: 't', messages: msgs, json: true });
  assert.deepEqual(msgs, [{ role: 'user', content: 'hola' }]);
});

// ---------- Retry-After ----------
test('retryAfterMs: solo segundos enteros', () => {
  const h = (v) => ({ headers: { get: () => v } });
  assert.equal(retryAfterMs(h('2')), 2000);
  assert.equal(retryAfterMs(h(' 7 ')), 7000);
  assert.equal(retryAfterMs(h('0')), 0);
  assert.equal(retryAfterMs(h('999999')), 999999000);
  for (const v of ['-1', '1.5', '1e3', '', 'Wed, 21 Oct 2026 07:28:00 GMT', 'abc', '1234567', null, 5]) assert.equal(retryAfterMs(h(v)), undefined, String(v));
  for (const bad of [null, undefined, {}, { headers: null }, { headers: {} }, { headers: { get: 'x' } }]) assert.equal(retryAfterMs(bad), undefined);
});
test('429 con Retry-After 3: espera 3 s (no 0,5 s)', async () => {
  const S = setup((n) => (n === 1 ? res(429, {}, { 'retry-after': '3' }) : res(200, body('ok'))));
  const p = S.ai.complete(REQ);
  await S.T.advance(2999); assert.equal(S.calls.length, 1);
  await S.T.advance(1); assert.equal(S.calls.length, 2);
  assert.equal((await p).ok, true);
});
test('429 con Retry-After de 60 s: no se espera, se devuelve rate_limit con la espera pedida', async () => {
  const S = setup(() => res(429, {}, { 'retry-after': '60' }));
  const r = await run(S, REQ);
  assert.deepEqual([r.reason, r.attempts, r.retryAfterMs, S.calls.length], ['rate_limit', 1, 60000, 1]);
});
test('503 con Retry-After también se respeta; 401 con Retry-After no lo propaga', async () => {
  const S = setup((n) => (n === 1 ? res(503, {}, { 'retry-after': '2' }) : res(200, body('ok'))));
  const p = S.ai.complete(REQ);
  await S.T.advance(1999); assert.equal(S.calls.length, 1);
  await S.T.advance(1); assert.equal(S.calls.length, 2);
  await p;
  const S2 = setup(() => res(401, {}, { 'retry-after': '2' }));
  assert.equal((await run(S2, REQ)).retryAfterMs, undefined);
});

// ---------- cola y clave ----------
test('varias peticiones a la vez: el proveedor nunca recibe más de 2 en vuelo', async () => {
  let live = 0; let peak = 0;
  const S = setup(async () => { live += 1; peak = Math.max(peak, live); await new Promise((r) => S.T.timers.setTimeout(r, 100)); live -= 1; return res(200, body('x')); });
  const ps = Array.from({ length: 6 }, () => S.ai.complete(REQ));
  await S.T.advance(5000);
  const rs = await Promise.all(ps);
  assert.equal(rs.every((r) => r.ok), true);
  assert.equal(peak, 2);
  assert.deepEqual(S.ai.queueStats(), { running: 0, waiting: 0, concurrency: 2 });
});
test('concurrency y demás opciones llegan a la cola; una opción inválida lanza al crear', () => {
  const S = setup(() => res(200, body('x')), { concurrency: 1 });
  assert.equal(S.ai.queueStats().concurrency, 1);
  assert.throws(() => setup(() => res(200, body('x')), { maxRetries: -1 }), /createQueue/);
});
test('la clave viaja solo en Authorization, igual en cada reintento, y nunca está en ningún resultado', async () => {
  const S = setup((n) => (n < 3 ? res(500, {}) : res(200, body('ok'))));
  const r = await run(S, REQ);
  assert.equal(S.calls.length, 3);
  for (const c of S.calls) { assert.equal(c.init.headers.Authorization, `Bearer ${KEY}`); assert.ok(!c.init.body.includes(KEY)); assert.ok(!c.url.includes(KEY)); }
  noKey(r);
  for (const status of [401, 429, 500, 400]) noKey(await run(setup(() => res(status, {})), REQ));
});
test('cambiar la clave o el modelo entre reintentos vale al instante (se leen en cada intento)', async () => {
  let key = KEY;
  const T = fakeTime(); const calls = [];
  const ai = createAi({ getConfig: () => ({ mode: 'auto', provider: 'groq', model: 'm-1', key }), fetchFn: async (u, i) => { calls.push(i.headers.Authorization); return calls.length === 1 ? res(500, {}) : res(200, body('ok')); }, clock: T.clock, timers: T.timers, rng: () => 1 });
  const p = ai.complete(REQ);
  await T.advance(100); key = 'otra-clave';
  await T.advance(1000);
  assert.equal((await p).ok, true);
  assert.deepEqual(calls, [`Bearer ${KEY}`, 'Bearer otra-clave']);
});
test('sin temporizadores pendientes al terminar, en éxito, fallo y cancelación', async () => {
  for (const h of [() => res(200, body('x')), () => res(500, {}), () => res(401, {})]) {
    const S = setup(h);
    await run(S, REQ);
    assert.equal(S.T.pending(), 0);
  }
});

// ---------- huecos cerrados tras las roturas de 1.10-T2 ----------
test('la petición de reparación pide SOLO el JSON, sin texto ni bloques de código', async () => {
  const S = setup((n) => res(200, body(n === 1 ? 'x' : '{"a":1}')));
  await run(S, { ...REQ, json: true });
  const ask = S.calls[1].body.messages.at(-1).content;
  assert.match(ask, /responde SOLO con el JSON válido/);
  assert.match(ask, /sin bloques de código/);
});
test('tras reparar, el texto y el modelo del resultado son los del segundo intento', async () => {
  const S = setup((n) => res(200, n === 1 ? { choices: [{ message: { content: 'basura' } }] } : body('{"a":1}')));
  const r = await run(S, { ...REQ, json: true });
  assert.deepEqual([r.text, r.json, r.model, r.usage], ['{"a":1}', { a: 1 }, 'm-1', { promptTokens: 5, completionTokens: 2 }]);
});
test('la fachada pasa su reloj a la cola: maxTotalMs corta los reintentos con el tiempo falso', async () => {
  const S = setup(() => res(500, {}), { maxTotalMs: 1000, baseDelayMs: 400 }); // esperas 400 y 800: solo el tiempo ya transcurrido (reloj falso) impide la segunda
  const r = await run(S, REQ);
  assert.deepEqual([r.attempts, S.calls.length], [2, 2]);
});
