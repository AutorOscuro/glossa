// @purpose: Pruebas de los 4 servicios de la barra de ayudas (app/helpServices.js) y de byTopics y lexicon del resolvedor, con el paquete semilla real.
// Subparte 2.9-T3, punto 5. Las fachadas se prueban con el resolvedor real y estudio/ajustes falsos; la barra dentro de la vista de sesión, en tests/helpBar.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createItemResolver } from '../app/itemResolver.js';
import { createHelpServices } from '../app/helpServices.js';
import { createMemoryDb } from '../core/db.memory.js';
import { parseChatBlock } from '../core/syncChat.js';
import { createErrorCatalog } from '../core/errorCatalog.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const readText = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const SEED = JSON.parse(readText('content/packs/pack_seed_v1.json'));
const TOPIC = 'gram.modals.no_to';
const ofTopic = SEED.items.filter((i) => i.topics.includes(TOPIC));
const reply = (text) => ({ ok: true, status: 200, text: async () => text, json: async () => JSON.parse(text) });
const repoFetch = ({ calls = [], over = {} } = {}) => async (url) => {
  calls.push(url);
  if (url in over) { const v = over[url]; return typeof v === 'function' ? v() : v; }
  return reply(readText(url));
};
const quiet = () => {};
const KNEE = { id: 'vocab.body.knee', lemma: 'knee', pos: 'noun', family: 'vocab.body', level: 'A1', es: ['rodilla'], def_en: 'a joint', examples: [{ en: 'My knee hurts.', es: 'Me duele la rodilla.' }] };
const packWith = (lexicon) => reply(JSON.stringify({ ...SEED, lexicon }));

// ---------- resolvedor: byTopics y lexicon ----------

test('byTopics entrega exactamente los ítems del paquete que tocan el tema, y varios temas suman', async () => {
  const r = createItemResolver({ fetchFn: repoFetch(), log: quiet });
  const got = await r.byTopics([TOPIC]);
  assert.ok(ofTopic.length >= 5, 'la semilla trae al menos 5 ítems del tema');
  assert.deepEqual(got.map((i) => i.id).sort(), ofTopic.map((i) => i.id).sort());
  const other = 'prep.dependent.adjective_prep';
  const both = await r.byTopics([TOPIC, other]);
  assert.equal(both.length, ofTopic.length + SEED.items.filter((i) => i.topics.includes(other)).length);
});

test('byTopics con temas vacíos, raros o desconocidos da [] sin leer la red', async () => {
  const calls = [];
  const r = createItemResolver({ fetchFn: repoFetch({ calls }), log: quiet });
  for (const bad of [undefined, null, [], '', 7, {}, [''], [3, null]]) assert.deepEqual(await r.byTopics(bad), []);
  assert.equal(calls.length, 0, 'una consulta sin temas válidos no lee nada');
  assert.deepEqual(await r.byTopics(['no.existe.tema']), []);
  assert.equal(calls.filter((u) => u.startsWith('content/packs/')).length, 1, 'solo el tema desconocido llegó a leer el paquete, y una vez');
});

test('byTopics y lexicon con la red caída dan [] y lo anotan, sin rechazar', async () => {
  const logs = [];
  const r = createItemResolver({ fetchFn: async () => { throw new TypeError('Failed to fetch'); }, log: (...a) => logs.push(a) });
  assert.deepEqual(await r.byTopics([TOPIC]), []);
  assert.deepEqual(await r.lexicon(), []);
  assert.ok(logs.length >= 2);
});

test('lexicon: la semilla no trae léxico; con un paquete que sí lo trae lo entrega, con el primer lema repetido y como copia', async () => {
  assert.deepEqual(await createItemResolver({ fetchFn: repoFetch(), log: quiet }).lexicon(), []);
  const dup = { ...KNEE, id: 'vocab.body.knee2', es: ['otra'] };
  const r = createItemResolver({ fetchFn: repoFetch({ over: { 'content/packs/pack_seed_v1.json': () => packWith([KNEE, dup]) } }), log: quiet });
  const got = await r.lexicon();
  assert.equal(got.length, 1);
  assert.equal(got[0].lemma, 'knee');
  assert.deepEqual(got[0].es, ['rodilla']);
  got.length = 0;
  assert.equal((await r.lexicon()).length, 1, 'cambiar el resultado no cambia lo guardado');
});

test('byTopics reutiliza la lectura: un solo índice y un solo paquete aunque se pida varias veces', async () => {
  const calls = [];
  const r = createItemResolver({ fetchFn: repoFetch({ calls }), log: quiet });
  await Promise.all([r.byTopics([TOPIC]), r.byTopics([TOPIC]), r.lexicon(), r.resolve(SEED.items[0].id)]);
  assert.equal(calls.filter((u) => u === 'content/index.json').length, 1);
  assert.equal(calls.filter((u) => u === 'content/packs/pack_seed_v1.json').length, 1);
});

// ---------- fachadas ----------

const entryOf = (item) => ({ itemId: item.id, topic: item.topics[0], topics: item.topics, exerciseType: item.type });
const settingsOf = (values) => ({ get: (k) => values[k] });

test('createHelpServices exige un objeto de servicios y devuelve las 4 fachadas congeladas', () => {
  for (const bad of [undefined, null, 'x', 7]) assert.throws(() => createHelpServices({ services: bad }), /services/);
  assert.throws(() => createHelpServices({ services: {}, log: 'no' }), /log/);
  const help = createHelpServices({ services: {}, fetchFn: null, log: quiet });
  assert.deepEqual(Object.keys(help).sort(), ['aiHelp', 'corrections', 'dictionary', 'examples']);
  assert.ok(Object.isFrozen(help) && Object.isFrozen(help.examples) && Object.isFrozen(help.aiHelp));
});

test('examples: da ejemplos del mismo tema, nunca el propio ítem, y espera a studyReady', async () => {
  let release; const studyReady = new Promise((res) => { release = res; });
  const services = { studyReady, itemResolver: createItemResolver({ fetchFn: repoFetch(), log: quiet }), study: { topics: [] } };
  const { examples } = createHelpServices({ services, fetchFn: null, log: quiet });
  const current = ofTopic[0];
  let done = false;
  const pending = examples.forEntry(entryOf(current), { excludeItemIds: [current.id] }).then((r) => { done = true; return r; });
  await new Promise((res) => setTimeout(res, 15));
  assert.equal(done, false, 'espera a los servicios de estudio');
  release();
  const r = await pending;
  assert.ok(r.count >= 3, `trae al menos 3 ejemplos (trajo ${r.count})`);
  assert.ok(r.examples.every((e) => e.itemId !== current.id), 'no repite el ítem del ejercicio');
});

test('examples: sin resolvedor o con una entrada sin temas no lanza y no inventa ejemplos', async () => {
  const none = createHelpServices({ services: { study: { topics: [] } }, fetchFn: null, log: quiet });
  assert.equal((await none.examples.forEntry(entryOf(ofTopic[0]))).count, 0);
  const some = createHelpServices({ services: { itemResolver: createItemResolver({ fetchFn: repoFetch(), log: quiet }) }, fetchFn: null, log: quiet });
  assert.equal((await some.examples.forEntry({})).count, 0);
  assert.equal((await some.examples.forEntry(null)).count, 0);
});

test('studyReady que falla no rompe las ayudas: se anota y siguen con lo que haya', async () => {
  const logs = [];
  const studyReady = Promise.reject(new Error('sin base'));
  const services = { studyReady, itemResolver: createItemResolver({ fetchFn: repoFetch(), log: quiet }) };
  const help = createHelpServices({ services, fetchFn: null, log: (...a) => logs.push(a) });
  assert.equal((await help.corrections.forEntry(entryOf(ofTopic[0]))).count, 0);
  assert.ok(logs.some((l) => String(l[0]).includes('estudio')));
});

test('corrections: sin base ni catálogo da cuenta 0; con errores guardados cuenta cada uno una vez y sigue a `study` si cambia', async () => {
  const services = { study: { errors: null } };
  const { corrections } = createHelpServices({ services, fetchFn: null, log: quiet });
  assert.deepEqual(await corrections.forEntry(entryOf(ofTopic[0])), { corrections: [], count: 0 });
  const item = ofTopic[0];
  const rec = (id, over = {}) => ({ id, itemId: item.id, topics: [TOPIC], original: 'can to go', correction: 'can go', code: 'VRB.CAN_TO', count: 2, ts: '2026-11-01T10:00:00.000Z', ...over });
  services.study = { errors: { list: async () => [rec('e1'), rec('e2', { itemId: 'otro', original: 'he can sings' }), rec('e1')] }, catalog: null };
  const got = await corrections.forEntry(entryOf(item));
  assert.equal(got.count, 2, 'e1 repetido cuenta una vez');
  assert.equal(got.corrections[0].own, true, 'los del propio ítem van primero');
});

test('aiHelp.status: sin ajustes dice no_ai; cuando los ajustes llegan después, lo ve sin rearmar nada', () => {
  const services = {};
  const { aiHelp } = createHelpServices({ services, fetchFn: async () => reply('{}'), log: quiet });
  assert.deepEqual(aiHelp.status(), { available: false, reason: 'no_ai' });
  services.settings = settingsOf({ aiMode: 'auto', aiProvider: 'groq', aiModel: '', aiKey: '' });
  assert.deepEqual(aiHelp.status(), { available: false, reason: 'no_key' });
  services.settings = settingsOf({ aiMode: 'auto', aiProvider: 'groq', aiModel: '', aiKey: 'gsk_prueba' });
  assert.deepEqual(aiHelp.status(), { available: true, reason: null });
  services.settings = settingsOf({ aiMode: 'mechanical', aiProvider: 'groq', aiModel: '', aiKey: 'gsk_prueba' });
  assert.deepEqual(aiHelp.status(), { available: false, reason: 'no_ai' });
});

test('aiHelp.status nunca lanza: ajustes rotos o sin fetch dan no_ai', () => {
  const broken = { settings: { get: () => { throw new Error('boom'); } } };
  assert.equal(createHelpServices({ services: broken, fetchFn: async () => ({}), log: quiet }).aiHelp.status().available, false);
  const nofetch = { settings: settingsOf({ aiMode: 'auto', aiProvider: 'groq', aiKey: 'x' }) };
  assert.deepEqual(createHelpServices({ services: nofetch, fetchFn: null, log: quiet }).aiHelp.status(), { available: false, reason: 'no_ai' });
});

test('aiHelp.prepare arma el bloque para el chat con la consigna del ítem, el tema, los errores y el dominio', async () => {
  const item = ofTopic[0];
  const services = {
    itemResolver: createItemResolver({ fetchFn: repoFetch(), log: quiet }),
    study: {
      errors: { list: async () => [{ id: 'e1', itemId: item.id, topics: [TOPIC], original: 'she can sings', correction: 'she can sing', code: 'VRB.CAN_TO', count: 3, ts: '2026-11-01T10:00:00.000Z' }] },
      catalog: null, mastery: { compute: async () => ({ pct: 42, label: 'En camino' }) }, clock: { now: () => new Date('2027-03-05T12:00:00.000Z') },
    },
  };
  const { aiHelp } = createHelpServices({ services, fetchFn: null, log: quiet });
  const res = await aiHelp.prepare(entryOf(item), { answer: 'I can to go', message: '¿Por qué no?' });
  assert.equal(res.ok, true);
  const back = parseChatBlock(res.text);
  assert.ok(back, 'el bloque se puede leer de vuelta');
  assert.ok(res.text.includes(TOPIC), 'lleva el tema');
  assert.ok(res.text.includes('I can to go'), 'lleva la respuesta en curso');
  assert.ok(res.text.includes('she can sings'), 'lleva el error guardado, que no es la respuesta');
  assert.ok(res.text.includes('42'), 'lleva el dominio');
  assert.ok(res.text.includes('2027-03-05'), 'lleva la fecha del reloj del estudio, no la del sistema');
  const prompt = item.prompt_en ?? item.prompt_es;
  assert.ok(res.text.includes(prompt), 'lleva la consigna del ítem');
});

test('aiHelp.prepare sin estudio ni resolvedor igual da un bloque (cada parte que falta se omite)', async () => {
  const { aiHelp } = createHelpServices({ services: {}, fetchFn: null, log: quiet });
  const res = await aiHelp.prepare({ itemId: 'x', topic: TOPIC, topics: [TOPIC] }, { message: 'hola' });
  assert.equal(res.ok, true);
});

test('dictionary: busca en el léxico de los paquetes tolerando mayúsculas y acentos, y «añadir» guarda la palabra como unknown', async () => {
  const db = createMemoryDb(); await db.open();
  const accent = { ...KNEE, id: 'vocab.body.year', lemma: 'year', es: ['año'] };
  const services = {
    db, storageReady: Promise.resolve(), studyReady: Promise.resolve(),
    itemResolver: createItemResolver({ fetchFn: repoFetch({ over: { 'content/packs/pack_seed_v1.json': () => packWith([KNEE, accent]) } }), log: quiet }),
    study: { clock: { now: () => new Date('2026-11-01T12:00:00.000Z') } },
  };
  const { dictionary } = createHelpServices({ services, fetchFn: null, log: quiet });
  assert.equal(dictionary.search('knee').found, false, 'antes de prepare() no hay nada indexado');
  await dictionary.prepare();
  assert.equal(dictionary.search('KNEE').results[0].entry.lemma, 'knee');
  assert.equal(dictionary.search('rodilla').results[0].entry.lemma, 'knee');
  assert.equal(dictionary.search('ano').results[0].entry.lemma, 'year');
  const miss = dictionary.search('wether');
  assert.equal(miss.found, false);
  assert.equal(miss.reason, 'none');
  assert.deepEqual(await dictionary.add('Wether'), { ok: true, id: 'wether', existed: false });
  assert.deepEqual(await dictionary.add('wether'), { ok: true, id: 'wether', existed: true });
  const saved = await db.get('words', 'wether');
  assert.equal(saved.state, 'unknown');
  assert.equal(saved.added, '2026-11-01T12:00:00.000Z');
  assert.deepEqual(await dictionary.add('no es una palabra 123'), { ok: false, reason: 'invalid' });
});

test('dictionary con la semilla (sin léxico): busca sin resultados y ofrece añadir; sin base «añadir» responde no_db', async () => {
  const services = { itemResolver: createItemResolver({ fetchFn: repoFetch(), log: quiet }) };
  const { dictionary } = createHelpServices({ services, fetchFn: null, log: quiet });
  await dictionary.prepare();
  assert.equal(dictionary.search('knee').reason, 'none');
  assert.deepEqual(await dictionary.add('knee'), { ok: false, reason: 'no_db' });
  services.db = createMemoryDb(); await services.db.open();
  assert.equal((await dictionary.add('knee')).ok, true, 'cuando la base llega después, «añadir» ya funciona');
});

test('main.js crea las fachadas con createHelpServices y asigna los 4 servicios', () => {
  const main = readText('app/main.js');
  assert.match(main, /import \{ createHelpServices \} from '\.\/helpServices\.js'/);
  assert.match(main, /createHelpServices\(\{ services: app\.services/);
  for (const k of ['examples', 'corrections', 'aiHelp', 'dictionary']) assert.match(main, new RegExp(`app\\.services\\.${k} = help\\.${k}`));
});

// ---------- huecos cerrados tras las roturas ----------

test('byTopics incluye un ítem con VARIOS temas si toca alguno de los pedidos (no exige todos)', async () => {
  const multi = { ...SEED, items: SEED.items.map((it, i) => (i === 0 ? { ...it, topics: [TOPIC, 'prep.dependent.adjective_prep'] } : it)) };
  const r = createItemResolver({ fetchFn: repoFetch({ over: { 'content/packs/pack_seed_v1.json': () => reply(JSON.stringify(multi)) } }), log: quiet });
  const got = await r.byTopics([TOPIC]);
  assert.ok(got.some((i) => i.id === SEED.items[0].id), 'el ítem de dos temas sale al pedir solo uno de ellos');
});

test('corrections: con el catálogo real cada corrección lleva su título y su pista', async () => {
  const catalog = createErrorCatalog(JSON.parse(readText('content/taxonomy/error_codes.json')));
  const item = ofTopic[0];
  const study = { catalog, errors: { list: async () => [{ id: 'e1', itemId: item.id, topics: [TOPIC], original: 'can to go', correction: 'can go', code: 'VRB.CAN_TO', count: 1, ts: '2026-11-01T10:00:00.000Z' }] } };
  const { corrections } = createHelpServices({ services: { study }, fetchFn: null, log: quiet });
  const got = await corrections.forEntry(entryOf(item));
  assert.equal(typeof got.corrections[0].title, 'string');
  assert.notEqual(got.corrections[0].title.trim(), '');
});

test('corrections espera a studyReady: los errores existen solo cuando los servicios de estudio terminan', async () => {
  const item = ofTopic[0];
  const services = {};
  services.studyReady = new Promise((res) => setTimeout(() => {
    services.study = { errors: { list: async () => [{ id: 'e1', itemId: item.id, topics: [TOPIC], original: 'x', code: 'VRB.CAN_TO', count: 1, ts: '2026-11-01T10:00:00.000Z' }] } };
    res();
  }, 10));
  const { corrections } = createHelpServices({ services, fetchFn: null, log: quiet });
  assert.equal((await corrections.forEntry(entryOf(item))).count, 1);
});

test('aiHelp.prepare espera a studyReady (el dominio llega con el estudio) y lleva la fecha del reloj del estudio', async () => {
  const item = ofTopic[0];
  const services = { itemResolver: createItemResolver({ fetchFn: repoFetch(), log: quiet }) };
  services.studyReady = new Promise((res) => setTimeout(() => {
    services.study = { mastery: { compute: async () => ({ pct: 42, label: 'En camino' }) }, clock: { now: () => new Date('2027-03-05T12:00:00.000Z') } };
    res();
  }, 10));
  const { aiHelp } = createHelpServices({ services, fetchFn: null, log: quiet });
  const res = await aiHelp.prepare(entryOf(item), { answer: 'x' });
  assert.ok(res.text.includes('42'), 'incluye el dominio, que solo existe tras studyReady');
  assert.ok(res.text.includes('2027-03-05'), 'usa el reloj del estudio, no el del sistema');
});

test('aiHelp con ajustes sin get no lanza: dice no_ai y lo anota', () => {
  const logs = [];
  const { aiHelp } = createHelpServices({ services: { settings: {} }, fetchFn: async () => ({}), log: (...a) => logs.push(a) });
  assert.deepEqual(aiHelp.status(), { available: false, reason: 'no_ai' });
  assert.ok(logs.some((l) => String(l[0]).includes('cliente')), 'se anota que no se pudo preparar el cliente');
});

test('dictionary sin resolvedor prepara y busca sin lanzar', async () => {
  const { dictionary } = createHelpServices({ services: {}, fetchFn: null, log: quiet });
  await dictionary.prepare();
  assert.equal(dictionary.search('knee').found, false);
});

test('dictionary espera al almacén: «añadir» y prepare() lanzados antes de que la base exista usan la base cuando llega', async () => {
  const services = {};
  services.storageReady = new Promise((res) => setTimeout(async () => { services.db = createMemoryDb(); await services.db.open(); res(); }, 10));
  const { dictionary } = createHelpServices({ services, fetchFn: null, log: quiet });
  assert.deepEqual(await dictionary.add('knee'), { ok: true, id: 'knee', existed: false });
  const services2 = {};
  services2.storageReady = new Promise((res) => setTimeout(async () => { services2.db = createMemoryDb(); await services2.db.open(); res(); }, 10));
  const d2 = createHelpServices({ services: services2, fetchFn: null, log: quiet }).dictionary;
  await d2.prepare();
  assert.deepEqual(await d2.add('knee'), { ok: true, id: 'knee', existed: false });
});

test('examples: los ejemplos de teoría del tema salen de la taxonomía del estudio, y excludeItemIds quita el ítem pedido', async () => {
  const theory = { id: TOPIC, theory: { examples: [{ en: 'You can swim fast.', es: 'Sabes nadar rápido.' }] } };
  const services = { itemResolver: createItemResolver({ fetchFn: repoFetch(), log: quiet }), study: { topics: [theory] } };
  const { examples } = createHelpServices({ services, fetchFn: null, log: quiet });
  const current = ofTopic[0];
  const free = await examples.forEntry(entryOf(current));
  assert.ok(free.examples.some((e) => e.kind === 'theory' && e.en === 'You can swim fast.'), 'trae el ejemplo de teoría de la taxonomía');
  const banned = free.examples.find((e) => e.kind === 'item');
  assert.ok(banned, 'sin exclusión hay al menos un ejemplo de ítem (la comprobación siguiente no es vacía)');
  const r = await examples.forEntry(entryOf(current), { excludeItemIds: [banned.itemId] });
  assert.ok(r.examples.every((e) => e.itemId !== banned.itemId), 'no incluye el ítem excluido');
});

test('aiHelp.status sin ajustes ni estudio no anota nada (no es un fallo, solo aún no cargan)', () => {
  const logs = [];
  const { aiHelp } = createHelpServices({ services: {}, fetchFn: async () => ({}), log: (...a) => logs.push(a) });
  assert.deepEqual(aiHelp.status(), { available: false, reason: 'no_ai' });
  assert.equal(logs.length, 0);
});

test('aiHelp.prepare sin resolvedor no anota fallos: la consigna que falta no es un error', async () => {
  const logs = [];
  const { aiHelp } = createHelpServices({ services: {}, fetchFn: null, log: (...a) => logs.push(a) });
  assert.equal((await aiHelp.prepare({ itemId: 'x', topic: TOPIC, topics: [TOPIC] }, { message: 'hola' })).ok, true);
  assert.equal(logs.length, 0);
});

test('aiHelp.status con un estudio que lanza al leerlo da no_ai y lo anota', () => {
  const logs = [];
  const services = { study: { get mastery() { throw new Error('boom'); } } };
  const { aiHelp } = createHelpServices({ services, fetchFn: null, log: (...a) => logs.push(a) });
  assert.deepEqual(aiHelp.status(), { available: false, reason: 'no_ai' });
  assert.ok(logs.some((l) => String(l[0]).includes('disponibilidad')));
});

test('aiHelp con fetch por defecto: sin pasar fetchFn usa el del entorno y con clave queda disponible', () => {
  const settings = { get: (k) => ({ aiMode: 'auto', aiProvider: 'groq', aiModel: '', aiKey: 'gsk_prueba' })[k] };
  const { aiHelp } = createHelpServices({ services: { settings }, log: quiet });
  assert.equal(aiHelp.status().available, true);
});

test('dictionary: una búsqueda hecha antes de prepare() no fija un reloj viejo; «añadir» usa el reloj del estudio cuando ya existe', async () => {
  const db = createMemoryDb(); await db.open();
  const services = { db, storageReady: Promise.resolve() };
  const { dictionary } = createHelpServices({ services, fetchFn: null, log: quiet });
  dictionary.search('knee');
  services.study = { clock: { now: () => new Date('2027-03-05T12:00:00.000Z') } };
  await dictionary.add('knee');
  assert.equal((await db.get('words', 'knee')).added, '2027-03-05T12:00:00.000Z');
});

test('dictionary: prepare() lanzado antes de que llegue la base espera a que llegue y no pierde el índice', async () => {
  const services = { itemResolver: createItemResolver({ fetchFn: repoFetch({ over: { 'content/packs/pack_seed_v1.json': () => packWith([KNEE]) } }), log: quiet }) };
  let release; services.storageReady = new Promise((res) => { release = res; });
  const { dictionary } = createHelpServices({ services, fetchFn: null, log: quiet });
  let done = false;
  const pending = dictionary.prepare().then(() => { done = true; });
  await new Promise((res) => setTimeout(res, 25));
  assert.equal(done, false, 'espera al almacén');
  services.db = createMemoryDb(); await services.db.open();
  release();
  await pending;
  assert.equal(dictionary.search('knee').results[0].entry.lemma, 'knee');
});

// ---------- Diccionario básico (2.9-T4): lemmas.json real por la fachada ----------

test('dictionary básico: con el repositorio real busca en lemmas.json («went» → go, banda, sin traducción) aunque el paquete no traiga léxico', async () => {
  const services = { itemResolver: createItemResolver({ fetchFn: repoFetch(), log: quiet }) };
  const { dictionary } = createHelpServices({ services, fetchFn: repoFetch(), log: quiet });
  await dictionary.prepare();
  const r = dictionary.search('went');
  assert.equal(r.found, true);
  const go = r.results.find((x) => x.entry.lemma === 'go').entry;
  assert.equal(go.basic, true);
  assert.match(go.band, /^[123]K$/);
  assert.deepEqual(go.es, []);
  assert.equal(dictionary.search('knee').found, true, 'ya no responde «no encontrado» a todo');
  assert.equal(dictionary.search('zzyzx').reason, 'none');
  // El tiempo de búsqueda (50 ms) se mide con mediana en tests/lemmaLexicon.test.mjs; una sola muestra aquí fallaba con la suite en paralelo.
});

test('dictionary básico: la entrada de un paquete con traducción manda sobre la básica del mismo lema', async () => {
  const services = { itemResolver: createItemResolver({ fetchFn: repoFetch({ over: { 'content/packs/pack_seed_v1.json': () => packWith([KNEE]) } }), log: quiet }) };
  const { dictionary } = createHelpServices({ services, fetchFn: repoFetch(), log: quiet });
  await dictionary.prepare();
  const hits = dictionary.search('knee').results.filter((x) => x.entry.lemma === 'knee');
  assert.equal(hits.length, 1, 'el lema sale una sola vez');
  assert.deepEqual(hits[0].entry.es, ['rodilla']);
  assert.notEqual(hits[0].entry.basic, true);
});

test('dictionary básico: «Añadir mi traducción» guarda en `notes`, mine() la devuelve, sobrevive a una reapertura y no toca `words`', async () => {
  const db = createMemoryDb(); await db.open();
  const mk = () => createHelpServices({ services: { db, storageReady: Promise.resolve(), studyReady: Promise.resolve(), itemResolver: createItemResolver({ fetchFn: repoFetch(), log: quiet }), study: { clock: { now: () => new Date('2026-11-01T12:00:00.000Z') } } }, fetchFn: repoFetch(), log: quiet }).dictionary;
  const d1 = mk();
  await d1.prepare();
  assert.equal(d1.mine('go'), null);
  assert.deepEqual(await d1.addTranslation('go', 'ir'), { ok: true, id: 'go', existed: false });
  assert.equal(d1.mine('go'), 'ir');
  assert.equal((await db.get('notes', 'dict_es:go')).text, 'ir');
  assert.equal((await db.query('words', {})).length, 0);
  const d2 = mk(); await d2.prepare();
  assert.equal(d2.mine('Go'), 'ir', 'al volver a abrir el diccionario sigue ahí');
});

test('dictionary básico: si lemmas.json no llega, el diccionario sigue con lo de los paquetes y lo anota; al volver a abrir se reintenta', async () => {
  const logs = [];
  let down = true;
  const fetchFn = async (url) => (down && url.includes('lemmas.json') ? { ok: false, status: 500 } : repoFetch()(url));
  const services = { itemResolver: createItemResolver({ fetchFn: repoFetch({ over: { 'content/packs/pack_seed_v1.json': () => packWith([KNEE]) } }), log: quiet }) };
  const { dictionary } = createHelpServices({ services, fetchFn, log: (...a) => logs.push(a) });
  await dictionary.prepare();
  assert.equal(dictionary.search('knee').found, true);
  assert.equal(dictionary.search('went').found, false);
  assert.ok(logs.length >= 1);
  down = false;
  await dictionary.prepare();
  assert.equal(dictionary.search('went').found, true);
});
