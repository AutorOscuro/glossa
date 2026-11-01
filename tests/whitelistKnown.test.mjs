// @purpose: Pruebas del lematizador y de los lemas conocidos (core/lemmas.js, core/whitelistKnown.js, core/whitelist.config.js) con el lemmas.json real.
// Pruebas de 1.11-T2: tabla de lemas, cargador, lista A1, fuentes de knownLemmas, bordes (4.1) y entradas hostiles (4.3).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createMemoryDb } from '../core/db.memory.js';
import { createLemmaTable, loadLemmas, LEMMAS_PATH } from '../core/lemmas.js';
import { knownLemmas, knownLemmasDetailed } from '../core/whitelistKnown.js';
import { A1_BASE, KNOWN_TOPIC_THRESHOLD } from '../core/whitelist.config.js';
import { tokenize } from '../core/tokenize.js';
import { createEvents } from '../core/events.js';
import { createErrors } from '../core/errors.js';
import { createErrorCatalog } from '../core/errorCatalog.js';
import { createSrs } from '../core/srsEngine.js';
import { createMastery } from '../core/mastery.js';

const REAL = JSON.parse(fs.readFileSync(new URL('../content/taxonomy/lemmas.json', import.meta.url), 'utf8'));
const table = createLemmaTable(REAL);
const tiny = (lemmas, extra = {}) => ({ schema: 1, bands: ['1K'], lemmas: lemmas.map(([lemma, forms = []]) => ({ lemma, pos: ['noun'], band: '1K', forms })), ...extra });
const word = (text) => tokenize(text)[0];
const res = (body, ok = true, status = 200) => ({ ok, status, text: async () => body });

// ---------- tabla con el archivo real ----------
test('el archivo real carga: ≥ 3000 lemas y el lema cuenta como forma de sí mismo', () => {
  assert.ok(table.size >= 3000);
  assert.deepEqual(table.lemmasOf('dog'), ['dog']);
  assert.deepEqual(table.lemmasOf('dogs'), ['dog']);
});
test('formas flexionadas van a su lema: walked, running, known, children', () => {
  assert.deepEqual(table.lemmasOf('walked'), ['walk']);
  assert.deepEqual(table.lemmasOf('running'), ['run']);
  assert.deepEqual(table.lemmasOf('known'), ['know']);
  assert.deepEqual(table.lemmasOf('me'), ['i']);
});
test('una forma con dos lemas devuelve los dos, ordenados (left)', () => {
  assert.deepEqual(table.lemmasOf('left'), ['leave', 'left']);
});
test('mayúsculas no importan; lo que no está en la tabla da []', () => {
  assert.deepEqual(table.lemmasOf('DOGS'), ['dog']);
  assert.deepEqual(table.lemmasOf('zzzxqw'), []);
  assert.deepEqual(table.lemmasOf(''), []);
  for (const v of [null, undefined, 5, {}, []]) assert.deepEqual(table.lemmasOf(v), []);
});
test('no se deja engañar por nombres de Object (constructor, __proto__, toString)', () => {
  for (const w of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf']) assert.deepEqual(table.lemmasOf(w), [], w);
  assert.equal(table.has('constructor'), false);
  assert.equal(table.info('__proto__'), null);
});
test('has e info', () => {
  assert.equal(table.has('walk'), true);
  assert.equal(table.has('walked'), false);
  assert.equal(table.has(5), false);
  const info = table.info('walk');
  assert.equal(info.lemma, 'walk');
  assert.ok(Array.isArray(info.pos) && Object.isFrozen(info));
  assert.equal(table.info('walked'), null);
});

// ---------- analyze (token → partes y lemas) ----------
test('analyze don\'t: dos partes, ambas en la lista', () => {
  assert.deepEqual(table.analyze(word("don't")), { parts: [{ part: 'do', lemmas: ['do'] }, { part: 'not', lemmas: ['not'] }], listed: true });
});
test('analyze well-known: well + known → know', () => {
  assert.deepEqual(table.analyze(word('well-known')), { parts: [{ part: 'well', lemmas: ['well'] }, { part: 'known', lemmas: ['know'] }], listed: true });
});
test('analyze: número, sigla y código no tienen partes y no están «en lista»', () => {
  for (const s of ['3rd', '42', 'U.S.', 'mp3']) assert.deepEqual(table.analyze(word(s)), { parts: [], listed: false }, s);
});
test('analyze T-shirt: la parte «t» no está, así que el token no está en lista', () => {
  const a = table.analyze(word('T-shirt'));
  assert.deepEqual(a.parts[0], { part: 't', lemmas: [] });
  assert.equal(a.listed, false);
});
test('analyze: entradas que no son token no lanzan', () => {
  for (const v of [null, undefined, 5, 'dog', {}, { kind: 'word' }, { kind: 'word', parts: 'dog' }]) assert.deepEqual(table.analyze(v), { parts: [], listed: false });
});
test('analyze: palabra fuera de la lista (nombre propio) conserva su parte con lemmas vacío', () => {
  assert.deepEqual(table.analyze(word('Bucaramanga')), { parts: [{ part: 'bucaramanga', lemmas: [] }], listed: false });
});

// ---------- validación del formato ----------
test('createLemmaTable rechaza archivos mal formados con mensaje en español', () => {
  const malos = [null, [], 'x', { schema: 2, lemmas: [{}] }, { schema: 1 }, { schema: 1, lemmas: [] }, tiny([['Dog']]), tiny([['dog'], ['dog']]),
    tiny([['dog', ['do gs']]]), { schema: 1, bands: ['1K'], lemmas: [{ lemma: 'dog', pos: [], band: '1K' }] },
    { schema: 1, bands: ['1K'], lemmas: [{ lemma: 'dog', pos: ['noun'], band: '9K' }] }, { schema: 1, lemmas: [null] }, { schema: 1, lemmas: [{ lemma: 'dog', pos: ['noun'], band: '1K', forms: 'dogs' }] }];
  for (const m of malos) assert.throws(() => createLemmaTable(m), /lemmas\.json/);
});
test('una forma compartida por dos lemas con las mismas letras no se duplica', () => {
  const t = createLemmaTable(tiny([['z', ['b', 'b']], ['a', ['b']]]));
  assert.deepEqual(t.lemmasOf('b'), ['a', 'z']);
});
test('el tope de lemas y de formas se respeta', () => {
  const muchas = Array.from({ length: 41 }, (_, i) => `x${'a'.repeat(i + 1)}`);
  assert.throws(() => createLemmaTable(tiny([['dog', muchas]])), /forms/);
});

// ---------- cargador ----------
test('loadLemmas: éxito, con la ruta por defecto', async () => {
  const seen = [];
  const r = await loadLemmas(async (url) => { seen.push(url); return res(JSON.stringify(REAL)); });
  assert.equal(r.ok, true);
  assert.equal(r.table.size, table.size);
  assert.deepEqual(seen, [LEMMAS_PATH]);
});
test('loadLemmas: 404, red, JSON roto, formato malo, demasiado grande, sin fetch: nunca lanza', async () => {
  const code = async (f, o) => (await loadLemmas(f, o)).error?.code;
  assert.equal(await code(async () => res('', false, 404)), 'NOT_FOUND');
  assert.equal(await code(async () => res('', false, 500)), 'HTTP');
  assert.equal(await code(async () => { throw new Error('caído'); }), 'NETWORK');
  assert.equal(await code(async () => res('{no json')), 'BAD_JSON');
  assert.equal(await code(async () => res('{"schema":1,"lemmas":[]}')), 'BAD_LEMMAS');
  assert.equal(await code(async () => res(JSON.stringify(REAL)), { maxBytes: 100 }), 'TOO_BIG');
  assert.equal(await code(undefined), 'NO_FETCH');
  assert.equal(await code(async () => null), 'HTTP');
});
test('loadLemmas: el tiempo límite corta una descarga colgada', async () => {
  const r = await loadLemmas(() => new Promise(() => {}), { timeoutMs: 20 });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'TIMEOUT');
});
test('los mensajes de error no filtran la ruta ni el contenido', async () => {
  const r = await loadLemmas(async () => res('{secreto-xyz'), { path: 'ruta/privada.json' });
  assert.ok(!r.error.message.includes('secreto-xyz') && !r.error.message.includes('privada'));
});

// ---------- lista A1 ----------
test('A1_BASE: sin repetidos, todo en minúscula y cada lema existe en el lemmas.json real', () => {
  assert.equal(new Set(A1_BASE).size, A1_BASE.length);
  assert.ok(A1_BASE.length >= 200);
  assert.deepEqual(A1_BASE.filter((l) => l !== l.toLowerCase() || !table.has(l)), []);
  assert.ok(Object.isFrozen(A1_BASE));
});

// ---------- knownLemmas ----------
const newDb = async (words = []) => {
  const db = createMemoryDb();
  await db.open();
  for (const w of words) await db.put('words', w);
  return db;
};
const fakeMastery = (pcts, calls = []) => ({ compute: async (id) => { calls.push(id); const v = pcts[id]; if (v instanceof Error) throw v; return { pct: v }; } });
const item = (id, topics, prompt_en, accept = null, distractors = []) => ({ id, topics, prompt_en, accept, distractors });

test('sin nada más: solo la base A1', async () => {
  const k = await knownLemmas(await newDb(), { table });
  assert.deepEqual([...k].sort(), [...A1_BASE].sort());
});
test('base apagada: conjunto vacío; base propia: esa lista, en minúscula', async () => {
  assert.equal((await knownLemmas(await newDb(), { table, base: false })).size, 0);
  assert.deepEqual([...await knownLemmas(await newDb(), { table, base: ['Cat', ' dog '] })].sort(), ['cat', 'dog']);
});
test('palabras known y learning entran; las demás no', async () => {
  const db = await newDb([{ id: 'zebra', state: 'known' }, { id: 'Giraffe', state: 'learning' }, { id: 'lion', state: 'wishlist' }]);
  const k = await knownLemmas(db, { table, base: false });
  assert.deepEqual([...k].sort(), ['giraffe', 'zebra']);
});
test('una palabra «unknown» se quita de la base, de las palabras y de los temas', async () => {
  const db = await newDb([{ id: 'dog', state: 'unknown' }, { id: 'house', state: 'unknown' }, { id: 'zebra', state: 'known' }]);
  const d = await knownLemmasDetailed(db, { table, mastery: fakeMastery({ t1: 90 }), items: [item('a.b', ['t1'], 'The house is big.')] });
  assert.equal(d.lemmas.has('dog'), false);
  assert.equal(d.lemmas.has('house'), false);
  assert.equal(d.lemmas.has('zebra'), true);
  assert.equal(d.lemmas.has('big'), true);
  assert.deepEqual([...d.unknown].sort(), ['dog', 'house']);
});
test('temas con dominio ≥ umbral aportan los lemas de prompt_en y accept (con contracciones y formas)', async () => {
  const pcts = { alto: 85, justo: KNOWN_TOPIC_THRESHOLD, bajo: KNOWN_TOPIC_THRESHOLD - 1 };
  const items = [
    item('a.tres', ['bajo'], 'Elephants sleep.'),
    item('a.dos', ['justo'], 'Children sing.'),
    item('a.uno', ['alto'], 'She walked home.', ["She doesn't walk home."]),
  ];
  const d = await knownLemmasDetailed(await newDb(), { table, base: false, mastery: fakeMastery(pcts), items });
  for (const l of ['walk', 'home', 'do', 'not', 'child', 'sing']) assert.ok(d.lemmas.has(l), l);
  assert.equal(d.lemmas.has('elephant'), false);
  assert.equal(d.lemmas.has('sleep'), false);
  assert.deepEqual(d.topicsUsed, ['alto', 'justo']); // en orden alfabético aunque los ítems vengan al revés
});
test('los distractores no cuentan', async () => {
  const items = [item('a.b', ['t'], 'I like it.', null, [{ text: 'banana' }, { text: 'orange' }])];
  const d = await knownLemmasDetailed(await newDb(), { table, base: false, mastery: fakeMastery({ t: 100 }), items });
  assert.equal(d.lemmas.has('banana'), false);
  assert.equal(d.lemmas.has('like'), true);
});
test('un ítem en varios temas cuenta si CUALQUIERA llega al umbral', async () => {
  const items = [item('a.b', ['x', 'y'], 'Dogs run.')];
  const d = await knownLemmasDetailed(await newDb(), { table, base: false, mastery: fakeMastery({ x: 10, y: 70 }), items });
  assert.ok(d.lemmas.has('dog') && d.lemmas.has('run'));
});
test('una forma con dos lemas añade los dos (left)', async () => {
  const d = await knownLemmasDetailed(await newDb(), { table, base: false, mastery: fakeMastery({ t: 90 }), items: [item('a.b', ['t'], 'left')] });
  assert.ok(d.lemmas.has('leave') && d.lemmas.has('left'));
});
test('números, siglas y códigos de los textos no añaden nada', async () => {
  const d = await knownLemmasDetailed(await newDb(), { table, base: false, mastery: fakeMastery({ t: 90 }), items: [item('a.b', ['t'], '3rd U.S. mp3 42')] });
  assert.equal(d.lemmas.size, 0);
});
test('un tema cuyo dominio falla o no es número se salta y se informa', async () => {
  const pcts = { malo: new Error('boom'), nan: NaN, nulo: undefined, bien: 90 };
  const items = ['malo', 'nan', 'nulo', 'bien'].map((t) => item(`a.${t}`, [t], `${t === 'bien' ? 'cat' : 'banana'}`));
  const d = await knownLemmasDetailed(await newDb(), { table, base: false, mastery: fakeMastery(pcts), items });
  assert.deepEqual(d.topicsSkipped, [{ topic: 'malo', reason: 'compute' }, { topic: 'nan', reason: 'pct' }, { topic: 'nulo', reason: 'pct' }]);
  assert.deepEqual(d.topicsUsed, ['bien']);
  assert.equal(d.lemmas.has('banana'), false);
});
test('cada tema se calcula una sola vez, aunque tenga muchos ítems', async () => {
  const calls = [];
  const items = [item('a.1', ['t'], 'cat'), item('a.2', ['t'], 'dog'), item('a.3', ['t'], 'bird')];
  const k = await knownLemmas(await newDb(), { table, base: false, mastery: fakeMastery({ t: 90 }, calls), items });
  assert.deepEqual(calls, ['t']);
  assert.deepEqual([...k].sort(), ['bird', 'cat', 'dog']);
});
test('items puede ser una función asíncrona; sin mastery o sin items la fuente de temas se omite', async () => {
  const items = async () => [item('a.b', ['t'], 'cat')];
  assert.deepEqual([...await knownLemmas(await newDb(), { table, base: false, mastery: fakeMastery({ t: 90 }), items })], ['cat']);
  const sinMastery = await knownLemmas(await newDb(), { table, base: false, items: [item('a.b', ['t'], 'cat')] });
  assert.equal(sinMastery.size, 0);
  const sinItems = await knownLemmas(await newDb(), { table, base: false, mastery: fakeMastery({ t: 90 }) });
  assert.equal(sinItems.size, 0);
});
test('ítems dañados se ignoran sin lanzar', async () => {
  const items = [null, 5, 'x', {}, { topics: 'x' }, { topics: [5, ''], prompt_en: 'cat' }, { topics: ['t'], prompt_en: 7, accept: [1, null, 'dog'] }];
  const d = await knownLemmasDetailed(await newDb(), { table, base: false, mastery: fakeMastery({ t: 90 }), items });
  assert.deepEqual([...d.lemmas], ['dog']);
});
test('umbral propio: 0 acepta todo tema medido; fuera de rango o no numérico lanza', async () => {
  const items = [item('a.b', ['t'], 'cat')];
  assert.ok((await knownLemmas(await newDb(), { table, base: false, mastery: fakeMastery({ t: 0 }), items, threshold: 0 })).has('cat'));
  assert.ok(!(await knownLemmas(await newDb(), { table, base: false, mastery: fakeMastery({ t: 99 }), items, threshold: 100 })).has('cat'));
  const db = await newDb();
  for (const bad of [-1, 101, NaN, '60', null, Infinity]) await assert.rejects(() => knownLemmas(db, { table, threshold: bad }), /umbral/);
});
test('el cálculo de dominio recibe `now`', async () => {
  const seen = [];
  const mastery = { compute: async (id, now) => { seen.push(now); return { pct: 90 }; } };
  const now = new Date('2026-10-25T10:00:00Z');
  await knownLemmas(await newDb(), { table, mastery, now, items: [item('a.b', ['t'], 'cat')] });
  assert.deepEqual(seen, [now]);
});
test('usos incorrectos lanzan Error en español', async () => {
  const db = await newDb();
  await assert.rejects(() => knownLemmas(null, { table }), /base de datos/);
  await assert.rejects(() => knownLemmas({}, { table }), /base de datos/);
  await assert.rejects(() => knownLemmas(db, {}), /tabla de lemas/);
  await assert.rejects(() => knownLemmas(db), /tabla de lemas/);
  await assert.rejects(() => knownLemmas(db, { table, mastery: {} }), /compute/);
  await assert.rejects(() => knownLemmas(db, { table, base: 'cat' }), /arreglo/);
});
test('un fallo de la base se propaga (no se inventa un conjunto)', async () => {
  const db = { query: async () => { throw new Error('base caída'); } };
  await assert.rejects(() => knownLemmas(db, { table }), /base caída/);
});
test('el conjunto devuelto es nuevo en cada llamada (cambiarlo no afecta a la siguiente)', async () => {
  const db = await newDb();
  const a = await knownLemmas(db, { table });
  a.add('zzz'); a.delete('dog');
  const b = await knownLemmas(db, { table });
  assert.ok(b.has('dog') && !b.has('zzz'));
});
test('ejemplo de punta a punta: texto → lemas del texto contra el conocido', async () => {
  const db = await newDb([{ id: 'walk', state: 'known' }]);
  const k = await knownLemmas(db, { table, base: false });
  const lemmasText = tokenize('She walked, and he walks.').flatMap((t) => table.analyze(t).parts.flatMap((p) => p.lemmas));
  assert.deepEqual(lemmasText.filter((l) => k.has(l)), ['walk', 'walk']);
});

// ---------- rendimiento y entradas hostiles ----------
test('la tabla se construye rápido y consultar millones de veces es lineal', () => {
  const t0 = Date.now();
  createLemmaTable(REAL);
  assert.ok(Date.now() - t0 < 1000);
  const t1 = Date.now();
  for (let i = 0; i < 300000; i += 1) table.lemmasOf(i % 2 ? 'walked' : 'zzz');
  assert.ok(Date.now() - t1 < 1000);
});
test('texto enorme de un ítem: lineal', async () => {
  const big = 'dog '.repeat(200000);
  const t0 = Date.now();
  const d = await knownLemmasDetailed(await newDb(), { table, base: false, mastery: fakeMastery({ t: 90 }), items: [item('a.b', ['t'], big)] });
  assert.ok(d.lemmas.has('dog'));
  assert.ok(Date.now() - t0 < 3000);
});

// ---------- con el motor de dominio real ----------
test('con createMastery real: un tema sin ver no aporta; con umbral 0 sí', async () => {
  const db = await newDb();
  const catalog = createErrorCatalog(JSON.parse(fs.readFileSync(new URL('../content/taxonomy/error_codes.json', import.meta.url), 'utf8')));
  const clock = { now: () => new Date('2026-10-25T12:00:00Z') };
  const mastery = createMastery({ db, events: createEvents({ db, clock }), errors: createErrors({ db, catalog, clock }), srs: createSrs({ settings: { get: async () => undefined } }), clock });
  const items = [item('a.b', ['topic.x'], 'The cat sleeps.')];
  const d = await knownLemmasDetailed(db, { table, base: false, mastery, items });
  assert.deepEqual(d.topicsUsed, []);
  assert.deepEqual(d.topicsSkipped, []);
  assert.equal(d.lemmas.size, 0);
  const z = await knownLemmasDetailed(db, { table, base: false, mastery, items, threshold: 0 });
  assert.deepEqual(z.topicsUsed, ['topic.x']);
  assert.ok(z.lemmas.has('cat') && z.lemmas.has('sleep'));
});

// ---------- huecos cerrados tras las roturas (4.R) ----------
test('tope de lemas: justo en el tope pasa, uno más se rechaza', () => {
  const letters = (i) => [0, 1, 2, 3].map((k) => String.fromCharCode(97 + (Math.floor(i / 26 ** k) % 26))).join('');
  const mk = (n) => tiny(Array.from({ length: n }, (_, i) => [letters(i)]));
  assert.equal(createLemmaTable(mk(20000)).size, 20000);
  assert.throws(() => createLemmaTable({ ...mk(20000), lemmas: [...mk(20000).lemmas, { lemma: 'extra', pos: ['noun'], band: '1K' }] }), /más de/);
});
test('pos con un elemento vacío o que no es texto se rechaza', () => {
  for (const pos of [[''], [5], [null], ['noun', '']]) assert.throws(() => createLemmaTable({ schema: 1, lemmas: [{ lemma: 'dog', pos, band: '1K' }] }), /pos/);
});
test('info congela también pos; size cuenta lemas y no formas', () => {
  assert.ok(Object.isFrozen(table.info('walk').pos));
  assert.equal(createLemmaTable(tiny([['a', ['b', 'c']]])).size, 1);
});
test('lemmasOf devuelve una copia: cambiarla no afecta a la tabla', () => {
  const r = table.lemmasOf('dog');
  r.push('x');
  assert.deepEqual(table.lemmasOf('dog'), ['dog']);
});
test('formas con apóstrofo de la tabla se aceptan (o\'clock)', () => {
  assert.deepEqual(createLemmaTable(tiny([['clock', ["o'clock"]]])).lemmasOf("o'clock"), ['clock']);
});
test('loadLemmas: ruta vacía usa la de siempre; ruta propia se respeta', async () => {
  const seen = [];
  const f = async (u) => { seen.push(u); return res(JSON.stringify(tiny([['a']]))); };
  await loadLemmas(f, { path: '' });
  await loadLemmas(f, { path: 'otra/ruta.json' });
  assert.deepEqual(seen, [LEMMAS_PATH, 'otra/ruta.json']);
});
test('loadLemmas: tiempo por defecto largo; un timeoutMs inválido (0, -1, NaN) no corta la descarga', async () => {
  const lenta = async () => { await new Promise((r) => setTimeout(r, 40)); return res(JSON.stringify(tiny([['a']]))); };
  assert.equal((await loadLemmas(lenta)).ok, true);
  for (const t of [0, -1, NaN, 'x']) assert.equal((await loadLemmas(lenta, { timeoutMs: t })).ok, true, String(t));
});
test('loadLemmas: tope de bytes exacto: justo en el tope pasa, uno menos falla', async () => {
  const body = JSON.stringify(tiny([['a']]));
  assert.equal((await loadLemmas(async () => res(body), { maxBytes: body.length })).ok, true);
  assert.equal((await loadLemmas(async () => res(body), { maxBytes: body.length - 1 })).error.code, 'TOO_BIG');
});
test('loadLemmas: cuerpo que no es texto → BAD_JSON; formato malo → mensaje que nombra lemmas.json', async () => {
  assert.equal((await loadLemmas(async () => ({ ok: true, text: async () => 123 }))).error.code, 'BAD_JSON');
  const r = await loadLemmas(async () => res('{"schema":1,"lemmas":[]}'));
  assert.match(r.error.message, /lemmas\.json/);
});
test('loadLemmas: pasa una señal a fetch y la aborta al agotarse el tiempo', async () => {
  let signal = null;
  const r = await loadLemmas((u, init) => { signal = init && init.signal; return new Promise(() => {}); }, { timeoutMs: 20 });
  assert.equal(r.error.code, 'TIMEOUT');
  assert.ok(signal && signal.aborted === true);
});
test('loadLemmas: limpia su temporizador al terminar (ni éxito ni fallo lo dejan vivo)', async () => {
  const set = globalThis.setTimeout; const clear = globalThis.clearTimeout;
  const live = new Set();
  globalThis.setTimeout = (fn, ms, ...a) => { const id = set(fn, ms, ...a); live.add(id); return id; };
  globalThis.clearTimeout = (id) => { live.delete(id); clear(id); };
  try {
    await loadLemmas(async () => res(JSON.stringify(tiny([['a']]))));
    await loadLemmas(async () => { throw new Error('x'); });
    await loadLemmas(async () => res('', false, 404));
  } finally { globalThis.setTimeout = set; globalThis.clearTimeout = clear; }
  assert.equal(live.size, 0);
});
test('knownLemmas: entradas vacías o de otro tipo en base, palabras y temas se ignoran', async () => {
  const db = await newDb([{ id: '  ', state: 'known' }, { id: 'ok', state: 'known' }]);
  const calls = [];
  const k = await knownLemmas(db, { table, base: ['', '  ', 'cat'], mastery: fakeMastery({ t: 90 }, calls), items: [item('a.b', [''], 'dog'), item('a.c', ['t'], 'bird')] });
  assert.deepEqual([...k].sort(), ['bird', 'cat', 'ok']);
  assert.deepEqual(calls, ['t']);
});
test('knownLemmasDetailed sin opciones lanza el mensaje de tabla', async () => {
  const db = await newDb();
  await assert.rejects(() => knownLemmasDetailed(db), /tabla de lemas/);
});
test('una base con filas raras (id numérico, null) no rompe: solo cuentan los ids de texto', async () => {
  const db = { query: async (store, o) => (o.value === 'known' ? [{ id: 5 }, null, { id: ' X ' }, {}] : []) };
  assert.deepEqual([...await knownLemmas(db, { table, base: false })], ['x']);
});
