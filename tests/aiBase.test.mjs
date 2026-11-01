// @purpose: Pruebas de core/ai (1.10-T1): fachada complete, proveedores none y groq con fetch simulado, y validación del JSON devuelto.
// Los esperados están escritos a mano. Ninguna prueba sale a la red: fetch es siempre un doble.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAi, configFromSettings, normalizeRequest } from '../core/ai/index.js';
import { createGroqProvider, checkEndpoint, reasonFromStatus, GROQ_DEFAULT_ENDPOINT, GROQ_DEFAULT_MODEL, GROQ_FREE_LIMITS } from '../core/ai/providers/groq.js';
import { createNoneProvider } from '../core/ai/providers/none.js';
import { parseJson, validate } from '../core/ai/schema.js';
import { createClock } from '../core/clock.js';

const KEY = 'clave-de-prueba-123';
const MSGS = [{ role: 'user', content: 'Hola' }];
const okBody = (content, usage) => ({ choices: [{ message: { role: 'assistant', content } }], usage });
function fakeFetch(handler) {
  const calls = [];
  const fn = async (url, init) => { calls.push({ url, init, body: JSON.parse(init.body) }); return handler(calls.length, url, init); };
  fn.calls = calls;
  return fn;
}
const res = (status, body) => ({ status, json: async () => { if (body === undefined) throw new Error('sin cuerpo'); return body; } });
const cfg = (over = {}) => ({ mode: 'auto', provider: 'groq', model: 'modelo-x', key: KEY, endpoint: undefined, ...over });
// T1 prueba la clasificación (sin reintentos: maxRetries 0); los reintentos se prueban en aiQueue.test.mjs.
const mk = (handler, over) => { const f = fakeFetch(handler); let c = cfg(over); const ai = createAi({ getConfig: () => c, fetchFn: f, clock: createClock(() => 1000), maxRetries: 0 }); return { ai, f, set: (o) => { c = cfg(o); } }; };

// ---------- proveedor none ----------
test('none: no está disponible y responde no_ai sin tocar la red', async () => {
  const p = createNoneProvider();
  assert.equal(p.id, 'none'); assert.equal(p.available(), false);
  assert.deepEqual(await p.complete({}), { ok: false, reason: 'no_ai' });
});

// ---------- groq: petición ----------
test('groq: arma la petición compatible con OpenAI y devuelve texto y tokens', async () => {
  const { ai, f } = mk(() => res(200, okBody('Hello', { prompt_tokens: 12, completion_tokens: 3 })));
  const r = await ai.complete({ task: 'test.hello', messages: MSGS, maxTokens: 50, temperature: 0.5 });
  assert.deepEqual([r.ok, r.text, r.provider, r.model], [true, 'Hello', 'groq', 'modelo-x']);
  assert.deepEqual(r.usage, { promptTokens: 12, completionTokens: 3 });
  assert.equal(f.calls.length, 1);
  const c = f.calls[0];
  assert.equal(c.url, GROQ_DEFAULT_ENDPOINT);
  assert.equal(c.init.method, 'POST');
  assert.equal(c.init.headers.Authorization, `Bearer ${KEY}`);
  assert.deepEqual(c.body, { model: 'modelo-x', messages: MSGS, max_tokens: 50, temperature: 0.5 });
});
test('groq: con json pide response_format json_object', async () => {
  const { ai, f } = mk(() => res(200, okBody('{"a":1}')));
  const r = await ai.complete({ task: 't', messages: MSGS, json: true });
  assert.deepEqual(r.json, { a: 1 });
  assert.deepEqual(f.calls[0].body.response_format, { type: 'json_object' });
});
test('groq: endpoint y modelo editables y leídos en cada llamada', async () => {
  const { ai, f, set } = mk(() => res(200, okBody('x')), { endpoint: 'https://proxy.example.org/v1/chat', model: 'otro' });
  await ai.complete({ task: 't', messages: MSGS });
  assert.equal(f.calls[0].url, 'https://proxy.example.org/v1/chat');
  assert.equal(f.calls[0].body.model, 'otro');
  set({ model: 'tercero' });
  await ai.complete({ task: 't', messages: MSGS });
  assert.equal(f.calls[1].body.model, 'tercero');
  assert.equal(f.calls[1].url, GROQ_DEFAULT_ENDPOINT);
});
test('groq: modelo por defecto verificado (1.10-T4): un modelo vacío usa el defecto y sale a la red', async () => {
  assert.equal(GROQ_DEFAULT_MODEL, 'openai/gpt-oss-120b');
  for (const model of ['', '  ', undefined]) {
    const { ai, f } = mk(() => res(200, okBody('x')), { model });
    const r = await ai.complete({ task: 't', messages: MSGS });
    assert.deepEqual([r.ok, r.model, f.calls.length, f.calls[0].body.model], [true, GROQ_DEFAULT_MODEL, 1, GROQ_DEFAULT_MODEL], String(model));
  }
});
test('groq: los modelos gpt-oss piden razonamiento bajo y los demás no mandan el campo', async () => {
  for (const [model, expected] of [['openai/gpt-oss-120b', 'low'], ['openai/gpt-oss-20b', 'low'], ['otro/modelo', undefined], ['gpt-oss-120b', undefined], ['x/openai/gpt-oss-y', undefined], ['openai/gpt-ossy', undefined], ['openai/gpt-oss', undefined]]) {
    const { ai, f } = mk(() => res(200, okBody('x')), { model });
    await ai.complete({ task: 't', messages: MSGS });
    assert.equal(f.calls[0].body.reasoning_effort, expected, model);
    assert.equal('reasoning_effort' in f.calls[0].body, expected !== undefined, model);
  }
});
test('groq: los límites gratuitos verificados quedan documentados y congelados', () => {
  assert.deepEqual({ ...GROQ_FREE_LIMITS }, { verified: '2026-10-25', model: GROQ_DEFAULT_MODEL, rpm: 30, rpd: 1000, tpm: 8000, tpd: 200000 });
  assert.equal(Object.isFrozen(GROQ_FREE_LIMITS), true);
});
test('checkEndpoint: solo https sin usuario ni fragmento', () => {
  assert.equal(checkEndpoint('https://a.b/c'), 'https://a.b/c');
  for (const bad of ['http://a.b', 'ftp://a.b', 'javascript:alert(1)', 'https://u:p@a.b', 'https://a.b/#x', '', '   ', 'no es url', 5, null, 'https://' + 'a'.repeat(400)]) assert.equal(checkEndpoint(bad), null, String(bad).slice(0, 30));
});
test('groq: endpoint no válido → bad_endpoint, sin red', async () => {
  const { ai, f } = mk(() => res(200, okBody('x')), { endpoint: 'http://inseguro.example.org' });
  assert.equal((await ai.complete({ task: 't', messages: MSGS })).reason, 'bad_endpoint');
  assert.equal(f.calls.length, 0);
});

// ---------- groq: fallos ----------
test('reasonFromStatus: tabla de códigos', () => {
  const t = { 400: 'bad_request', 401: 'auth', 403: 'auth', 404: 'bad_request', 408: 'server', 422: 'bad_request', 429: 'rate_limit', 500: 'server', 503: 'server', 599: 'server' };
  for (const [s, r] of Object.entries(t)) assert.equal(reasonFromStatus(Number(s)), r, s);
});
for (const [status, reason] of [[401, 'auth'], [429, 'rate_limit'], [500, 'server'], [400, 'bad_request']]) {
  test(`groq: HTTP ${status} → ${reason}`, async () => {
    const { ai } = mk(() => res(status, { error: { message: `secreto ${KEY}` } }));
    const r = await ai.complete({ task: 't', messages: MSGS });
    assert.deepEqual([r.ok, r.reason, r.status], [false, reason, status]);
    assert.ok(!JSON.stringify(r).includes(KEY));
  });
}
test('groq: red caída y cancelación se distinguen, sin filtrar el mensaje del error', async () => {
  const a = mk(() => { throw new TypeError(`fallo con ${KEY}`); });
  const r = await a.ai.complete({ task: 't', messages: MSGS });
  assert.equal(r.reason, 'network'); assert.ok(!JSON.stringify(r).includes(KEY));
  const b = mk(() => { const e = new Error('x'); e.name = 'AbortError'; throw e; });
  assert.equal((await b.ai.complete({ task: 't', messages: MSGS })).reason, 'aborted');
});
test('groq: respuestas raras → bad_response o empty', async () => {
  for (const body of [undefined, null, {}, { choices: [] }, { choices: [{}] }, { choices: [{ message: { content: 5 } }] }, { choices: [{ message: { content: null } }] }]) {
    const { ai } = mk(() => res(200, body));
    assert.equal((await ai.complete({ task: 't', messages: MSGS })).reason, 'bad_response', JSON.stringify(body));
  }
  for (const c of ['', '   \n']) assert.equal((await mk(() => res(200, okBody(c))).ai.complete({ task: 't', messages: MSGS })).reason, 'empty');
  assert.equal((await mk(() => ({})).ai.complete({ task: 't', messages: MSGS })).reason, 'network');
});
test('groq: usage ilegible → null; texto enorme se recorta y se marca', async () => {
  const a = await mk(() => res(200, okBody('x', { prompt_tokens: -1, completion_tokens: 'a' }))).ai.complete({ task: 't', messages: MSGS });
  assert.deepEqual(a.usage, { promptTokens: null, completionTokens: null });
  const big = await mk(() => res(200, okBody('z'.repeat(200001)))).ai.complete({ task: 't', messages: MSGS });
  assert.equal(big.text.length, 200000);
});

// ---------- fachada ----------
test('sin clave o modo mecánico: available false, nada sale a la red', async () => {
  for (const over of [{ key: '' }, { key: '   ' }, { mode: 'mechanical' }, { provider: 'otro' }]) {
    const { ai, f } = mk(() => res(200, okBody('x')), over);
    assert.equal(ai.available(), false, JSON.stringify(over));
    const r = await ai.complete({ task: 't', messages: MSGS });
    assert.equal(r.ok, false);
    assert.ok(['no_ai', 'no_key'].includes(r.reason));
    assert.equal(f.calls.length, 0);
  }
});
test('available y providerId siguen la configuración en vivo', () => {
  const { ai, set } = mk(() => res(200, okBody('x')));
  assert.deepEqual([ai.available(), ai.providerId()], [true, 'groq']);
  set({ mode: 'mechanical' });
  assert.deepEqual([ai.available(), ai.providerId()], [false, 'none']);
});
test('json: texto que no es JSON → bad_json con el texto; esquema que falla → schema con rutas', async () => {
  const a = await mk(() => res(200, okBody('lo siento'))).ai.complete({ task: 't', messages: MSGS, json: true });
  assert.deepEqual([a.ok, a.reason, a.text], [false, 'bad_json', 'lo siento']);
  const schema = { type: 'object', required: ['n'], properties: { n: { type: 'integer', minimum: 1 } } };
  const b = await mk(() => res(200, okBody('{"n":0}'))).ai.complete({ task: 't', messages: MSGS, schema });
  assert.deepEqual([b.reason, b.errors], ['schema', ['n: debe ser ≥ 1']]);
  const c = await mk(() => res(200, okBody('```json\n{"n":3}\n```'))).ai.complete({ task: 't', messages: MSGS, schema });
  assert.deepEqual([c.ok, c.json], [true, { n: 3 }]);
});
test('el resultado lleva ms medidos con el reloj inyectado', async () => {
  let t = 0;
  const ai = createAi({ getConfig: () => cfg(), fetchFn: async () => { t += 250; return res(200, okBody('x')); }, clock: createClock(() => t) });
  assert.equal((await ai.complete({ task: 't', messages: MSGS })).ms, 250);
});
test('normalizeRequest: valores por defecto y usos incorrectos lanzan Error en español', () => {
  const r = normalizeRequest({ task: 'a.b', messages: MSGS });
  assert.deepEqual([r.maxTokens, r.temperature, r.json], [800, 0.2, false]);
  assert.equal(normalizeRequest({ task: 'a', messages: MSGS, schema: {} }).json, true);
  const bad = [null, 'x', {}, { task: 'A', messages: MSGS }, { task: '', messages: MSGS }, { task: 'a', messages: [] }, { task: 'a', messages: 'hola' },
    { task: 'a', messages: [{ role: 'robot', content: 'x' }] }, { task: 'a', messages: [{ role: 'user', content: '  ' }] }, { task: 'a', messages: [{ role: 'user' }] },
    { task: 'a', messages: Array(41).fill(MSGS[0]) }, { task: 'a', messages: [{ role: 'user', content: 'x'.repeat(100001) }] },
    { task: 'a', messages: MSGS, maxTokens: 0 }, { task: 'a', messages: MSGS, maxTokens: 8001 }, { task: 'a', messages: MSGS, maxTokens: 1.5 },
    { task: 'a', messages: MSGS, temperature: -0.1 }, { task: 'a', messages: MSGS, temperature: 2.1 }, { task: 'a', messages: MSGS, temperature: NaN },
    { task: 'a', messages: MSGS, schema: [] }, { task: 'a', messages: MSGS, schema: null }];
  for (const b of bad) assert.throws(() => normalizeRequest(b), /complete/, JSON.stringify(b)?.slice(0, 40));
  assert.doesNotThrow(() => normalizeRequest({ task: 'a', messages: MSGS, maxTokens: 8000, temperature: 2 }));
  assert.doesNotThrow(() => normalizeRequest({ task: 'a', messages: MSGS, maxTokens: 1, temperature: 0 }));
});
test('createAi y createGroqProvider exigen sus dependencias', () => {
  assert.throws(() => createAi({}), /getConfig/);
  assert.throws(() => createAi({ getConfig: () => ({}) }), /fetchFn/);
  assert.throws(() => createGroqProvider({ getKey: () => '' }), /fetchFn/);
  assert.throws(() => createGroqProvider({ fetchFn: () => {} }), /getKey/);
});
test('configFromSettings lee los ajustes de IA en cada llamada', () => {
  const vals = { aiMode: 'auto', aiProvider: 'groq', aiModel: 'm1', aiKey: 'k1' };
  const get = configFromSettings({ get: (k) => vals[k] }, { endpoint: 'https://e.example.org/x' });
  assert.deepEqual(get(), { mode: 'auto', provider: 'groq', model: 'm1', key: 'k1', endpoint: 'https://e.example.org/x' });
  vals.aiModel = 'm2';
  assert.equal(get().model, 'm2');
  assert.throws(() => configFromSettings({}), /ajustes/);
});
test('ninguna clave aparece en los resultados, ni en éxito ni en fallo', async () => {
  for (const h of [() => res(200, okBody(`eco ${'x'}`)), () => res(401, {}), () => { throw new Error(KEY); }]) {
    const r = await mk(h).ai.complete({ task: 't', messages: MSGS });
    assert.ok(!JSON.stringify(r).includes(KEY));
  }
});

// ---------- schema ----------
test('parseJson: cercas, texto alrededor, basura y límites', () => {
  assert.deepEqual(parseJson('{"a":1}'), { ok: true, value: { a: 1 } });
  assert.deepEqual(parseJson('```json\n{"a":[1,2]}\n```').value, { a: [1, 2] });
  assert.deepEqual(parseJson('```\n[1]\n```').value, [1]);
  assert.deepEqual(parseJson('Aquí está: {"a":"}"} ¡listo!').value, { a: '}' });
  assert.deepEqual(parseJson('Mira [1,{"b":2}] fin').value, [1, { b: 2 }]);
  for (const bad of ['', '   ', 'hola', '{"a":', '5', 'true', 'null', '"texto"', null, undefined, 7, '{"a":1} {"b":2}x', 'x'.repeat(200001)]) assert.equal(parseJson(bad).ok, false, String(bad).slice(0, 20));
  assert.equal(parseJson('{"__proto__":{"x":1}}').ok, false);
  assert.equal(parseJson('{"a":{"constructor":1}}').ok, false);
  assert.equal(parseJson('['.repeat(14) + ']'.repeat(14)).ok, false); // 14 listas anidadas = profundidad 13 > 12
  assert.equal(parseJson('['.repeat(13) + ']'.repeat(13)).ok, true);  // profundidad 12: justo el tope
  assert.equal(({}).x, undefined);
});
test('validate: tipos, requeridos, campos extra, rangos, enum, listas y anidados', () => {
  const S = { type: 'object', required: ['q', 'level'], properties: {
    q: { type: 'string', minLength: 2, maxLength: 5 }, level: { enum: ['A1', 'B1'] }, n: { type: ['integer', 'null'], minimum: 0, maximum: 10 },
    tags: { type: 'array', minItems: 1, maxItems: 2, items: { type: 'string' } }, sub: { type: 'object', properties: { ok: { type: 'boolean' } } } } };
  assert.equal(validate({ q: 'hola', level: 'A1', n: null, tags: ['a'], sub: { ok: true } }, S).ok, true);
  const e = (v) => validate(v, S).errors;
  assert.deepEqual(e({}), ['(raíz): falta «q»', '(raíz): falta «level»']);
  assert.deepEqual(e({ q: 'h', level: 'A1' }), ['q: mínimo 2 caracteres']);
  assert.deepEqual(e({ q: 'hola!!', level: 'A1' }), ['q: máximo 5 caracteres']);
  assert.deepEqual(e({ q: 'hola', level: 'C2' }), ['level: valor fuera de los permitidos']);
  assert.deepEqual(e({ q: 'hola', level: 'A1', n: 11 }), ['n: debe ser ≤ 10']);
  assert.deepEqual(e({ q: 'hola', level: 'A1', n: -1 }), ['n: debe ser ≥ 0']);
  assert.deepEqual(e({ q: 'hola', level: 'A1', n: 1.5 }), ['n: se esperaba integer o null']);
  assert.deepEqual(e({ q: 'hola', level: 'A1', tags: [] }), ['tags: mínimo 1 elementos']);
  assert.deepEqual(e({ q: 'hola', level: 'A1', tags: ['a', 'b', 'c'] }), ['tags: máximo 2 elementos']);
  assert.deepEqual(e({ q: 'hola', level: 'A1', tags: ['a', 3] }), ['tags[1]: se esperaba string']);
  assert.deepEqual(e({ q: 'hola', level: 'A1', sub: { ok: 'sí' } }), ['sub.ok: se esperaba boolean']);
  assert.deepEqual(e({ q: 'hola', level: 'A1', extra: 1 }), ['(raíz): campo no permitido «extra»']);
  assert.equal(validate({ a: 1 }, { type: 'object', additionalProperties: true }).ok, true);
  assert.deepEqual(validate([], { type: 'object' }).errors, ['(raíz): se esperaba object']);
  assert.deepEqual(validate({}, { type: 'array' }).errors, ['(raíz): se esperaba array']);
  assert.deepEqual(validate(NaN, { type: 'number' }).errors, ['(raíz): se esperaba number']);
  assert.throws(() => validate({}, null), /esquema/);
  assert.throws(() => validate({}, []), /esquema/);
});
test('validate: los motivos no incluyen el valor recibido y se limitan a 20', () => {
  const r = validate({ q: 'SECRETO-VALOR', level: 'ZZ-SECRETO' }, { type: 'object', properties: { q: { maxLength: 3 }, level: { enum: ['A1'] } } });
  assert.ok(!JSON.stringify(r.errors).includes('SECRETO'));
  const many = validate(Array(50).fill(1), { type: 'array', items: { type: 'string' } });
  assert.equal(many.errors.length, 20);
});

// ---------- schema: huecos cerrados tras las roturas intencionales ----------
test('parseJson: topes exactos de tamaño, claves prohibidas mezcladas y profundidad enorme sin desbordar', () => {
  const edge = (n) => `["${'a'.repeat(n - 4)}"]`; // n caracteres en total
  assert.equal(parseJson(edge(200000)).ok, true);
  assert.equal(parseJson(edge(200001)).ok, false);
  assert.equal(parseJson('{"a":{"prototype":1}}').ok, false);
  assert.equal(parseJson('{"ok":1,"__proto__":{"x":1}}').ok, false);
  assert.equal(parseJson('{"ok":1,"constructor":2}').ok, false);
  assert.equal(parseJson('{"ok":1,"prototype":2}').ok, false);
  assert.equal(parseJson('['.repeat(90000) + ']'.repeat(90000)).ok, false);
});
test('parseJson: cadenas con comillas escapadas y llaves dentro, y un segundo bloque es ambiguo', () => {
  assert.deepEqual(parseJson('Respuesta: {"a":"x\\"}y","b":2} fin').value, { a: 'x"}y', b: 2 });
  assert.deepEqual(parseJson('Ruta: {"p":"c:\\\\"} fin').value, { p: 'c:\\' });
  assert.equal(parseJson('{"a":1} luego [2]').ok, false);
  assert.equal(parseJson('[1] luego {"a":2}').ok, false);
});
test('validate: límites exactos, error único por tipo erróneo, claves heredadas y claves largas', () => {
  const S = { type: 'object', properties: { s: { type: 'string', minLength: 2, maxLength: 4 }, n: { type: 'number', minimum: 1, maximum: 3 }, a: { type: 'array', minItems: 1, maxItems: 2 } } };
  assert.equal(validate({ s: 'ab', n: 1, a: [1] }, S).ok, true);
  assert.equal(validate({ s: 'abcd', n: 3, a: [1, 2] }, S).ok, true);
  assert.deepEqual(validate({ w: 1 }, { type: 'object', required: ['a', 'b', 'c', 'd', 'e'], properties: Object.fromEntries('abcdefghijklmnopqrstuvwxyz'.split('').map((k) => [k, {}])) }).errors.length, 5);
  const none = validate({}, { type: 'object', required: Array.from({ length: 30 }, (_, i) => `k${i}`) });
  assert.equal(none.errors.length, 20);
  assert.deepEqual(validate(5, { type: 'string', enum: ['a'], minLength: 3 }).errors, ['(raíz): se esperaba string']);
  assert.deepEqual(validate({ toString: 1 }, { type: 'object', properties: { a: { type: 'string' } } }).errors, ['(raíz): campo no permitido «toString»']);
  const long = validate({ ['k'.repeat(100)]: 1 }, { type: 'object' }).errors[0];
  assert.equal(long, `(raíz): campo no permitido «${'k'.repeat(40)}»`);
});

// ---------- huecos cerrados tras las roturas de groq.js e index.js ----------
test('checkEndpoint: tope exacto, usuario vacío con contraseña y normalización', () => {
  const at = (n) => `https://a.example/${'p'.repeat(n - 'https://a.example/'.length)}`;
  assert.equal(checkEndpoint(at(400)), at(400));
  assert.equal(checkEndpoint(at(401)), null);
  assert.equal(checkEndpoint('https://:clave@a.example/'), null);
  assert.equal(checkEndpoint('  https://a.b/c  '), 'https://a.b/c');
  assert.equal(checkEndpoint('HTTPS://A.B'), 'https://a.b/');
});
test('groq: cabeceras exactas, modelo recortado, señal reenviada y estados 3xx', async () => {
  const ctl = new AbortController();
  const { ai, f } = mk(() => res(200, okBody('x')), { model: '  modelo-x  ' });
  await ai.complete({ task: 't', messages: MSGS, signal: ctl.signal });
  assert.deepEqual(f.calls[0].init.headers, { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` });
  assert.equal(f.calls[0].body.model, 'modelo-x');
  // Desde T2 el proveedor recibe la señal de la cola (derivada de la de quien llama): abortar la de fuera aborta la de dentro.
  assert.ok(f.calls[0].init.signal instanceof AbortSignal);
  for (const s of [300, 301, 199]) assert.equal((await mk(() => res(s, okBody('x'))).ai.complete({ task: 't', messages: MSGS })).reason, 'bad_request', String(s));
  assert.equal((await mk(() => res(201, okBody('x'))).ai.complete({ task: 't', messages: MSGS })).ok, true);
});
test('groq: un fetch que lanza algo que no es Error sigue siendo «network»', async () => {
  for (const thrown of [null, undefined, 'texto', 0]) {
    const p = createGroqProvider({ fetchFn: async () => { throw thrown; }, getKey: () => KEY, getModel: () => 'm' });
    assert.equal((await p.complete({ messages: MSGS, maxTokens: 5, temperature: 0, json: false })).reason, 'network');
  }
});
test('groq: tope de respuesta exacto, truncated y tokens (0 vale 0, decimales se cortan)', async () => {
  const exact = await mk(() => res(200, okBody('z'.repeat(200000)))).ai.complete({ task: 't', messages: MSGS });
  assert.deepEqual([exact.text.length, exact.truncated], [200000, undefined]);
  const p = createGroqProvider({ fetchFn: async () => res(200, okBody('z'.repeat(200000))), getKey: () => KEY, getModel: () => 'm' });
  assert.equal((await p.complete({ messages: MSGS, maxTokens: 5, temperature: 0 })).truncated, false);
  const p2 = createGroqProvider({ fetchFn: async () => res(200, okBody('z'.repeat(200001))), getKey: () => KEY, getModel: () => 'm' });
  assert.equal((await p2.complete({ messages: MSGS, maxTokens: 5, temperature: 0 })).truncated, true);
  const u = await mk(() => res(200, okBody('x', { prompt_tokens: 0, completion_tokens: 12.7 }))).ai.complete({ task: 't', messages: MSGS });
  assert.deepEqual(u.usage, { promptTokens: 0, completionTokens: 12 });
  const w = await mk(() => res(200, okBody('x', 'raro'))).ai.complete({ task: 't', messages: MSGS });
  assert.deepEqual(w.usage, { promptTokens: null, completionTokens: null });
});
test('normalizeRequest: nombre de tarea, roles, topes exactos y mensajes limpios', () => {
  for (const t of ['a', 'a1', 'a.b-c_d', 'a'.repeat(60)]) assert.equal(normalizeRequest({ task: t, messages: MSGS }).task, t);
  for (const t of [' a', 'a ', 'a b', 'a!', '1a', '.a', 'a'.repeat(61), 'á', undefined, ['a'], 5, 'a\nb']) assert.throws(() => normalizeRequest({ task: t, messages: MSGS }), /task/, String(t));
  assert.throws(() => normalizeRequest({ messages: MSGS }), /task/);
  for (const role of ['system', 'user', 'assistant']) assert.equal(normalizeRequest({ task: 'a', messages: [{ role, content: 'x' }] }).messages[0].role, role);
  assert.throws(() => normalizeRequest({ task: 'a', messages: [null] }), /complete/);
  assert.equal(normalizeRequest({ task: 'a', messages: Array(40).fill(MSGS[0]) }).messages.length, 40);
  assert.equal(normalizeRequest({ task: 'a', messages: [{ role: 'user', content: 'x'.repeat(100000) }] }).messages.length, 1);
  assert.deepEqual(normalizeRequest({ task: 'a', messages: [{ role: 'user', content: 'x', extra: 1, apiKey: 'k' }] }).messages, [{ role: 'user', content: 'x' }]);
  assert.equal(normalizeRequest({ task: 'a', messages: MSGS, json: 'yes' }).json, false);
  assert.equal(normalizeRequest({ task: 'a', messages: MSGS, json: true }).json, true);
  assert.equal(normalizeRequest({ task: 'a', messages: MSGS, signal: 'S' }).signal, 'S');
});
test('fachada: la clave y el modo se leen en cada llamada, y una configuración nula o con fallos no tumba la app', async () => {
  const { ai, set } = mk(() => res(200, okBody('x')));
  assert.equal(ai.available(), true);
  set({ key: '' });
  assert.equal(ai.available(), false);
  assert.equal((await ai.complete({ task: 't', messages: MSGS })).reason, 'no_key');
  const nul = createAi({ getConfig: () => null, fetchFn: async () => res(200, okBody('x')) });
  assert.deepEqual([nul.available(), nul.providerId()], [false, 'none']);
  const boom = createAi({ getConfig: () => ({ mode: 'auto', provider: 'groq', get key() { throw new Error('boom'); } }), fetchFn: async () => res(200, okBody('x')) });
  assert.deepEqual((await boom.complete({ task: 't', messages: MSGS })).reason, 'network');
});
test('fachada: ms nunca es negativo con un reloj que retrocede, y todo fallo indica el proveedor', async () => {
  let t = 5000;
  const ai = createAi({ getConfig: () => cfg(), fetchFn: async () => { t -= 100; return res(200, okBody('x')); }, clock: createClock(() => t) });
  assert.equal((await ai.complete({ task: 't', messages: MSGS })).ms, 0);
  assert.equal((await mk(() => res(401, {})).ai.complete({ task: 't', messages: MSGS })).provider, 'groq');
  assert.equal((await mk(() => res(200, okBody('x')), { mode: 'mechanical' }).ai.complete({ task: 't', messages: MSGS })).provider, 'none');
});
test('configFromSettings: el endpoint puede ser un valor o una función', () => {
  const s = { get: () => 'v' };
  assert.equal(configFromSettings(s, { endpoint: () => 'https://f.example.org/' })().endpoint, 'https://f.example.org/');
  assert.equal(configFromSettings(s)().endpoint, undefined);
});
