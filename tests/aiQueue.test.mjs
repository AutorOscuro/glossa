// @purpose: Pruebas de core/ai/queue.js y messages.js (1.10-T2): concurrencia, reintentos con espera, tiempo límite, cancelación y mensajes amables.
// Todo con reloj y temporizadores falsos (tests/_aiTime.mjs): ninguna prueba espera de verdad ni sale a la red.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQueue, backoffDelay, checkTimeout, QUEUE_DEFAULTS } from '../core/ai/queue.js';
import { friendlyMessage, AI_MESSAGES } from '../core/ai/messages.js';
import { fakeTime, flush } from './_aiTime.mjs';

const ok = (extra = {}) => ({ ok: true, text: 'hola', ...extra });
const fail = (reason, extra = {}) => ({ ok: false, reason, ...extra });
const mkq = (over = {}) => { const T = fakeTime(); const q = createQueue({ clock: T.clock, timers: T.timers, rng: () => 1, ...over }); return { T, q }; };
// attempt que devuelve en orden los resultados dados (el último se repite) y cuenta llamadas.
const script = (...results) => { const f = async () => { f.calls += 1; return results[Math.min(f.calls - 1, results.length - 1)]; }; f.calls = 0; return f; };

// ---------- opciones ----------
test('opciones: valores por defecto congelados y validación de rangos', () => {
  assert.deepEqual({ ...QUEUE_DEFAULTS }, { concurrency: 2, maxPending: 50, maxRetries: 3, emptyRetries: 1, baseDelayMs: 500, maxDelayMs: 8000, maxTotalMs: 45000, timeoutMs: 20000 });
  assert.ok(Object.isFrozen(QUEUE_DEFAULTS));
  for (const bad of [{ concurrency: 0 }, { concurrency: 9 }, { concurrency: 1.5 }, { concurrency: '2' }, { maxRetries: -1 }, { maxRetries: 11 }, { maxPending: -1 }, { baseDelayMs: -5 }, { maxDelayMs: 600001 }, { maxTotalMs: 999 }, { timeoutMs: 999 }, { timeoutMs: 300001 }, { emptyRetries: 11 }]) {
    assert.throws(() => createQueue(bad), /createQueue/, JSON.stringify(bad));
  }
  for (const good of [{ concurrency: 1 }, { concurrency: 8 }, { maxRetries: 0 }, { maxRetries: 10 }, { maxPending: 0 }, { timeoutMs: 1000 }, { timeoutMs: 300000 }]) createQueue(good);
});
test('checkTimeout: solo enteros de 1000 a 300000', () => {
  for (const v of [1000, 20000, 300000]) assert.equal(checkTimeout(v), true, String(v));
  for (const v of [999, 300001, 1500.5, '5000', null, undefined, NaN, Infinity]) assert.equal(checkTimeout(v), false, String(v));
});
test('run: exige una función y un timeoutMs válido', () => {
  const { q } = mkq();
  assert.throws(() => q.run('x'), /función/);
  assert.throws(() => q.run(async () => ok(), { timeoutMs: 10 }), /timeoutMs/);
});

// ---------- espera exponencial ----------
test('backoffDelay: duplica, respeta el tope y el azar va de 50 % a 100 %', () => {
  const o = { baseDelayMs: 500, maxDelayMs: 8000 };
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((i) => backoffDelay(i, { ...o, rng: () => 1 })), [500, 1000, 2000, 4000, 8000, 8000, 8000]);
  assert.deepEqual([0, 1, 2].map((i) => backoffDelay(i, { ...o, rng: () => 0 })), [250, 500, 1000]);
  assert.equal(backoffDelay(0, { ...o, rng: () => 0.5 }), 375);
  assert.equal(backoffDelay(500, { ...o, rng: () => 1 }), 8000); // sin desbordar
  assert.equal(backoffDelay(0, { baseDelayMs: 0, maxDelayMs: 8000, rng: () => 1 }), 0);
});

// ---------- reintentos ----------
test('éxito al primer intento: 1 intento y sin temporizadores pendientes', async () => {
  const { T, q } = mkq();
  const a = script(ok());
  const r = await q.run(a);
  assert.deepEqual([r.ok, r.attempts, a.calls], [true, 1, 1]);
  assert.equal(T.pending(), 0);
});
test('500 dos veces y luego 200: espera 500 ms y luego 1000 ms exactos', async () => {
  const { T, q } = mkq();
  const a = script(fail('server'), fail('server'), ok());
  const p = q.run(a);
  await T.advance(499); assert.equal(a.calls, 1);
  await T.advance(1); assert.equal(a.calls, 2);
  await T.advance(999); assert.equal(a.calls, 2);
  await T.advance(1); assert.equal(a.calls, 3);
  const r = await p;
  assert.deepEqual([r.ok, r.attempts], [true, 3]);
  assert.equal(T.pending(), 0);
});
test('429, 5xx, red y tiempo se reintentan hasta maxRetries y devuelven el último fallo', async () => {
  for (const reason of ['rate_limit', 'server', 'network']) {
    const { T, q } = mkq();
    const a = script(fail(reason));
    const p = q.run(a);
    await T.advance(60000);
    const r = await p;
    assert.deepEqual([r.ok, r.reason, r.attempts, a.calls], [false, reason, 4, 4], reason);
  }
});
test('maxRetries 0 no reintenta; maxRetries 1 hace 2 intentos', async () => {
  for (const [m, expect] of [[0, 1], [1, 2], [5, 6]]) {
    const { T, q } = mkq({ maxRetries: m });
    const a = script(fail('server'));
    const p = q.run(a);
    await T.advance(120000);
    assert.equal((await p).attempts, expect, String(m));
  }
});
test('no se reintenta auth, bad_request, bad_response, no_key ni los demás', async () => {
  for (const reason of ['auth', 'bad_request', 'bad_response', 'no_key', 'no_model', 'bad_endpoint', 'no_ai', 'bad_json', 'schema']) {
    const { T, q } = mkq();
    const a = script(fail(reason));
    const r = await q.run(a);
    assert.deepEqual([r.reason, r.attempts, a.calls, T.pending()], [reason, 1, 1, 0], reason);
  }
});
test('empty se reintenta una sola vez (emptyRetries) y nunca más que maxRetries', async () => {
  const { T, q } = mkq();
  const a = script(fail('empty'));
  const p = q.run(a);
  await T.advance(60000);
  assert.deepEqual([(await p).attempts, a.calls], [2, 2]);
  const b = mkq({ emptyRetries: 3 });
  const a2 = script(fail('empty'));
  const p2 = b.q.run(a2);
  await b.T.advance(60000);
  assert.equal((await p2).attempts, 4);
  const c = mkq({ emptyRetries: 3, maxRetries: 1 });
  const a3 = script(fail('empty'));
  const p3 = c.q.run(a3);
  await c.T.advance(60000);
  assert.equal((await p3).attempts, 2);
  const d = mkq({ emptyRetries: 0 });
  assert.equal((await d.q.run(script(fail('empty')))).attempts, 1);
});
test('Retry-After: espera lo pedido si es mayor que la espera normal', async () => {
  const { T, q } = mkq();
  const a = script(fail('rate_limit', { retryAfterMs: 3000 }), ok());
  const p = q.run(a);
  await T.advance(2999); assert.equal(a.calls, 1);
  await T.advance(1); assert.equal(a.calls, 2);
  assert.equal((await p).ok, true);
});
test('Retry-After menor que la espera normal no la acorta', async () => {
  const { T, q } = mkq();
  const a = script(fail('rate_limit', { retryAfterMs: 100 }), ok());
  const p = q.run(a);
  await T.advance(499); assert.equal(a.calls, 1);
  await T.advance(1); assert.equal(a.calls, 2);
  await p;
});
test('Retry-After mayor que maxDelayMs: no se espera, se devuelve el fallo con su espera', async () => {
  const { T, q } = mkq();
  const a = script(fail('rate_limit', { retryAfterMs: 8001 }), ok());
  const r = await q.run(a);
  assert.deepEqual([r.ok, r.reason, r.attempts, r.retryAfterMs, a.calls], [false, 'rate_limit', 1, 8001, 1]);
  assert.equal(T.pending(), 0);
  const b = mkq();
  const a2 = script(fail('rate_limit', { retryAfterMs: 8000 }), ok());
  const p = b.q.run(a2);
  await b.T.advance(8000);
  assert.equal((await p).ok, true);
});
test('Retry-After no numérico o negativo se ignora', async () => {
  for (const v of [NaN, -1, Infinity, '3', null]) {
    const { T, q } = mkq();
    const a = script(fail('server', { retryAfterMs: v }), ok());
    const p = q.run(a);
    await T.advance(500);
    assert.equal((await p).ok, true, String(v));
  }
});
test('maxTotalMs: no empieza una espera que pase del total', async () => {
  const { T, q } = mkq({ maxTotalMs: 1500, baseDelayMs: 1000, maxDelayMs: 8000 });
  const a = script(fail('server'));
  const p = q.run(a);
  await T.advance(1000); // 1.º reintento tras 1000 ms; el 2.º pediría 2000 más
  assert.equal(a.calls, 2);
  const r = await p;
  assert.deepEqual([r.reason, r.attempts], ['server', 2]);
});
test('maxTotalMs: justo en el límite sí espera', async () => {
  const { T, q } = mkq({ maxTotalMs: 1000, baseDelayMs: 1000, maxDelayMs: 1000, maxRetries: 1 });
  const a = script(fail('server'), ok());
  const p = q.run(a);
  await T.advance(1000);
  assert.equal((await p).ok, true);
});

// ---------- tiempo límite ----------
test('tiempo límite: un intento colgado que ignora la señal termina a los 20 s', async () => {
  const { T, q } = mkq({ maxRetries: 0 });
  const a = () => new Promise(() => {});
  const p = q.run(a);
  await T.advance(19999);
  let settled = false; p.then(() => { settled = true; });
  await flush(); assert.equal(settled, false);
  await T.advance(1);
  const r = await p;
  assert.deepEqual([r.ok, r.reason, r.attempts], [false, 'timeout', 1]);
  assert.equal(T.pending(), 0);
});
test('tiempo límite: el intento recibe una señal que se aborta al vencer', async () => {
  const { T, q } = mkq({ maxRetries: 0 });
  let seen;
  const p = q.run((signal) => { seen = signal; return new Promise(() => {}); });
  await T.advance(20000);
  await p;
  assert.equal(seen.aborted, true);
});
test('tiempo límite: aunque el proveedor conteste «aborted» al vencer, el motivo es timeout', async () => {
  const { T, q } = mkq({ maxRetries: 0 });
  const p = q.run((signal) => new Promise((res) => signal.addEventListener('abort', () => res(fail('aborted')))));
  await T.advance(20000);
  assert.equal((await p).reason, 'timeout');
});
test('tiempo límite: es por intento y se reintenta (4 intentos × 20 s)', async () => {
  const { T, q } = mkq({ maxTotalMs: 900000 });
  let n = 0;
  const p = q.run(() => { n += 1; return new Promise(() => {}); });
  await T.advance(400000);
  const r = await p;
  assert.deepEqual([r.reason, r.attempts, n], ['timeout', 4, 4]);
});
test('tiempo límite configurable en la cola y por llamada', async () => {
  const { T, q } = mkq({ maxRetries: 0, timeoutMs: 5000 });
  const p = q.run(() => new Promise(() => {}));
  await T.advance(4999); await T.advance(1);
  assert.equal((await p).reason, 'timeout');
  const p2 = q.run(() => new Promise(() => {}), { timeoutMs: 1000 });
  await T.advance(1000);
  assert.equal((await p2).reason, 'timeout');
});
test('un intento que acaba justo antes del límite cuenta como éxito', async () => {
  const { T, q } = mkq();
  const p = q.run(() => new Promise((res) => T.timers.setTimeout(() => res(ok()), 19999)));
  await T.advance(19999);
  assert.equal((await p).ok, true);
  assert.equal(T.pending(), 0);
});
test('un intento que lanza cuenta como network y se reintenta; uno que devuelve basura es bad_response', async () => {
  const { T, q } = mkq();
  const boom = script();
  let n = 0;
  const p = q.run(async () => { n += 1; if (n < 3) throw new Error('secreto-xyz'); return ok(); });
  await T.advance(2000);
  assert.deepEqual([(await p).ok, n], [true, 3]);
  for (const junk of [null, undefined, 5, 'x', {}, { ok: 'sí' }]) {
    const b = mkq();
    const r = await b.q.run(async () => junk);
    assert.deepEqual([r.reason, r.attempts], ['bad_response', 1], String(junk));
  }
  void boom;
});

// ---------- cancelación ----------
test('cancelar antes de empezar: aborted y el intento no se llama', async () => {
  const { q } = mkq();
  const ctl = new AbortController(); ctl.abort();
  const a = script(ok());
  const r = await q.run(a, { signal: ctl.signal });
  assert.deepEqual([r.reason, r.attempts, a.calls], ['aborted', 0, 0]);
});
test('cancelar durante el intento: aborted, sin reintento, y el intento ve la señal abortada', async () => {
  const { T, q } = mkq();
  const ctl = new AbortController();
  let seen;
  const p = q.run((s) => { seen = s; return new Promise(() => {}); }, { signal: ctl.signal });
  await flush();
  ctl.abort();
  const r = await p;
  assert.deepEqual([r.reason, r.attempts, seen.aborted, T.pending()], ['aborted', 1, true, 0]);
});
test('cancelar durante la espera entre reintentos corta la espera', async () => {
  const { T, q } = mkq();
  const ctl = new AbortController();
  const a = script(fail('server'), ok());
  const p = q.run(a, { signal: ctl.signal });
  await T.advance(100);
  ctl.abort();
  const r = await p;
  assert.deepEqual([r.reason, r.attempts, a.calls, T.pending()], ['aborted', 1, 1, 0]);
  await T.advance(10000);
  assert.equal(a.calls, 1);
});
test('cancelar mientras espera turno: sale de la fila y no corre', async () => {
  const { T, q } = mkq({ concurrency: 1 });
  let release;
  const first = q.run(() => new Promise((res) => { release = () => res(ok()); }));
  const ctl = new AbortController();
  const a = script(ok());
  const second = q.run(a, { signal: ctl.signal });
  await flush();
  assert.deepEqual(q.stats(), { running: 1, waiting: 1, concurrency: 1 });
  ctl.abort();
  assert.deepEqual([(await second).reason, (await second).attempts], ['aborted', 0]);
  assert.equal(q.stats().waiting, 0);
  release();
  await first;
  assert.equal(a.calls, 0);
  assert.equal(T.pending(), 0);
});
test('cancelar no afecta a las demás peticiones de la fila', async () => {
  const { q } = mkq({ concurrency: 1 });
  let release;
  const first = q.run(() => new Promise((res) => { release = () => res(ok({ text: 'uno' })); }));
  const ctl = new AbortController();
  const middle = q.run(script(ok()), { signal: ctl.signal });
  const last = q.run(script(ok({ text: 'tres' })));
  await flush();
  ctl.abort();
  release();
  assert.equal((await first).text, 'uno');
  assert.equal((await middle).reason, 'aborted');
  assert.equal((await last).text, 'tres');
});

// ---------- concurrencia ----------
test('concurrencia 2: nunca más de 2 a la vez y salen en orden de llegada', async () => {
  const { q } = mkq({ concurrency: 2 });
  let live = 0; let peak = 0; const started = []; const gates = [];
  const mk1 = (i) => q.run(() => { started.push(i); live += 1; peak = Math.max(peak, live); return new Promise((res) => { gates[i] = () => { live -= 1; res(ok({ text: String(i) })); }; }); });
  const ps = [0, 1, 2, 3, 4].map(mk1);
  await flush();
  assert.deepEqual(started, [0, 1]);
  assert.deepEqual(q.stats(), { running: 2, waiting: 3, concurrency: 2 });
  gates[0](); await flush();
  assert.deepEqual(started, [0, 1, 2]);
  gates[1](); gates[2](); await flush();
  assert.deepEqual(started, [0, 1, 2, 3, 4]);
  gates[3](); gates[4]();
  assert.deepEqual((await Promise.all(ps)).map((r) => r.text), ['0', '1', '2', '3', '4']);
  assert.equal(peak, 2);
  assert.deepEqual(q.stats(), { running: 0, waiting: 0, concurrency: 2 });
});
test('concurrencia 1: en serie, y un intento que falla no bloquea al siguiente', async () => {
  const { T, q } = mkq({ concurrency: 1, maxRetries: 0 });
  const order = [];
  const a = q.run(async () => { order.push('a'); throw new Error('x'); });
  const b = q.run(async () => { order.push('b'); return ok(); });
  await T.advance(10);
  assert.equal((await a).ok, false);
  assert.equal((await b).ok, true);
  assert.deepEqual(order, ['a', 'b']);
});
test('una petición que espera para reintentar ocupa su lugar (no se cuela otra)', async () => {
  const { T, q } = mkq({ concurrency: 1 });
  const order = [];
  const a = q.run(async () => { order.push('a'); return order.filter((x) => x === 'a').length < 2 ? fail('rate_limit') : ok(); });
  const b = q.run(async () => { order.push('b'); return ok(); });
  await T.advance(10000);
  await Promise.all([a, b]);
  assert.deepEqual(order, ['a', 'a', 'b']);
});
test('maxPending: con todos los puestos ocupados y la fila llena, queue_full', async () => {
  const { q } = mkq({ concurrency: 1, maxPending: 1 });
  const gate = () => new Promise(() => {});
  q.run(gate); q.run(gate);
  const r = await q.run(script(ok()));
  assert.deepEqual([r.reason, r.attempts], ['queue_full', 0]);
  assert.deepEqual(q.stats(), { running: 1, waiting: 1, concurrency: 1 });
});
test('maxPending 0: se ejecuta si hay puesto libre, si no queue_full', async () => {
  const { q } = mkq({ concurrency: 1, maxPending: 0 });
  q.run(() => new Promise(() => {}));
  assert.equal((await q.run(script(ok()))).reason, 'queue_full');
  const free = mkq({ concurrency: 1, maxPending: 0 });
  assert.equal((await free.q.run(script(ok()))).ok, true);
});
test('el puesto se libera antes de entregar el resultado (llamar enseguida con maxPending 0 no da queue_full)', async () => {
  const { q } = mkq({ concurrency: 1, maxPending: 0 });
  for (let i = 0; i < 5; i += 1) assert.equal((await q.run(script(ok()))).ok, true, String(i));
  assert.deepEqual(q.stats(), { running: 0, waiting: 0, concurrency: 1 });
});
test('la cola sigue sirviendo después de errores y cancelaciones (sin fugas de puestos)', async () => {
  const { T, q } = mkq({ concurrency: 2, maxRetries: 0 });
  for (let i = 0; i < 10; i += 1) await q.run(async () => { throw new Error('x'); });
  const ctl = new AbortController(); ctl.abort();
  await q.run(script(ok()), { signal: ctl.signal });
  assert.equal((await q.run(script(ok()))).ok, true);
  assert.deepEqual(q.stats(), { running: 0, waiting: 0, concurrency: 2 });
  assert.equal(T.pending(), 0);
});
test('los resultados se devuelven sin mutar el del proveedor y con attempts', async () => {
  const { q } = mkq();
  const original = ok({ usage: { promptTokens: 1 } });
  const r = await q.run(async () => original);
  assert.equal(original.attempts, undefined);
  assert.deepEqual(r, { ok: true, text: 'hola', usage: { promptTokens: 1 }, attempts: 1 });
});

// ---------- mensajes amables ----------
test('friendlyMessage: todos los motivos tienen un texto en español, distinto y sin datos sensibles', () => {
  const reasons = ['no_ai', 'no_key', 'no_model', 'bad_endpoint', 'network', 'timeout', 'aborted', 'auth', 'rate_limit', 'server', 'bad_request', 'bad_response', 'empty', 'bad_json', 'schema', 'queue_full'];
  assert.deepEqual(Object.keys(AI_MESSAGES).sort(), [...reasons].sort());
  const seen = new Set();
  for (const r of reasons) {
    const m = friendlyMessage(r);
    assert.ok(typeof m === 'string' && m.length >= 20 && m.length <= 140, r);
    assert.ok(!seen.has(m), `repetido: ${r}`); seen.add(m);
    assert.ok(!/gsk_|sk-|Bearer|undefined|\[object/.test(m), r);
  }
  assert.ok(Object.isFrozen(AI_MESSAGES));
});
test('friendlyMessage: lo desconocido da el mensaje genérico (también «constructor» y «__proto__»)', () => {
  const g = friendlyMessage('nada');
  for (const v of [undefined, null, 5, {}, '', 'constructor', '__proto__', 'toString', 'hasOwnProperty']) assert.equal(friendlyMessage(v), g, String(v));
  assert.match(g, /modo mecánico/);
});
test('mensajes clave: auth habla de la clave, rate_limit de cupo y modo mecánico, network de conexión', () => {
  assert.match(friendlyMessage('auth'), /clave/);
  assert.match(friendlyMessage('rate_limit'), /cupo/); assert.match(friendlyMessage('rate_limit'), /mecánico/);
  assert.match(friendlyMessage('network'), /conexión/);
  assert.match(friendlyMessage('no_key'), /Ajustes/);
});

// ---------- huecos cerrados tras las roturas de 1.10-T2 ----------
test('baseDelayMs 0 es válido y reintenta sin espera', async () => {
  const { T, q } = mkq({ baseDelayMs: 0 });
  const a = script(fail('server'), ok());
  const p = q.run(a);
  await T.advance(0);
  assert.equal((await p).attempts, 2);
});
test('backoffDelay redondea al entero más cercano (2,25 → 2)', () => {
  assert.equal(backoffDelay(0, { baseDelayMs: 3, maxDelayMs: 100, rng: () => 0.5 }), 2);
  assert.equal(backoffDelay(0, { baseDelayMs: 3, maxDelayMs: 100, rng: () => 0.9 }), 3);
});
test('rng puede ser un objeto con next() (createRng) y se usa en cada espera', async () => {
  const seen = [];
  const { T, q } = mkq({ rng: { next: () => { seen.push(1); return 0; } } });
  const a = script(fail('server'), ok());
  const p = q.run(a);
  await T.advance(249); assert.equal(a.calls, 1);
  await T.advance(1); assert.equal(a.calls, 2);
  await p;
  assert.equal(seen.length, 1);
});
test('un intento que siempre lanza termina con motivo network', async () => {
  const { T, q } = mkq();
  const p = q.run(async () => { throw new Error('x'); });
  await T.advance(60000);
  assert.equal((await p).reason, 'network');
});
test('maxTotalMs cuenta desde el primer intento aunque el reloj no empiece en 0', async () => {
  const { T, q } = mkq({ maxTotalMs: 1500, baseDelayMs: 1000 });
  await T.advance(100000);
  const a = script(fail('server'));
  const p = q.run(a);
  await T.advance(5000);
  assert.deepEqual([(await p).attempts, a.calls], [2, 2]);
});
