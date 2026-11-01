// @purpose: Criterios de aceptación 1 a 4 de la 2.9 con el paquete semilla real: errores típicos con su código por la pantalla real, y repasos vencidos a los 2 días simulados.
// 2.9-T5 (parte 3). CA 2: se recorre la vista de sesión REAL con el registro REAL de ejercicios y los ítems REALES del paquete; se elige o escribe el error típico y se lee la base.
// CA 3: simulación de 3 días con los servicios reales (tests/_simulation.mjs): el día 3 trae repasos vencidos de tarjetas ya respondidas.
// CA 1 (2.9-T5 parte 4): sesiones completas con los 6 tipos del paquete, respondidas bien por la pantalla real, hasta el resumen.
// CA 4 (2.9-T5 parte 5): con el sw.js REAL instalado y la red cortada (avión), contenido, sesión, errores, resumen y repasos de dos días después, con CERO peticiones a la red.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createExerciseRegistry } from '../ui/exercises/index.js';
import { registerExerciseTypes } from '../app/exerciseTypes.js';
import { CH_TEXT } from '../ui/exercises/choice.js';
import { TA_TEXT } from '../ui/exercises/textAnswer.js';
import { PC_TEXT } from '../ui/exercises/phraseCloze.js';
import { CB_TEXT } from '../ui/exercises/clozeBank.js';
import { OB_TEXT } from '../ui/exercises/orderBlocks.js';
import sesion from '../ui/views/sesion.js';
import { createSummarySource } from '../app/summarySource.js';
import { startContent } from '../app/contentStartup.js';
import { createItemResolver } from '../app/itemResolver.js';
import { createMemoryDb } from '../core/db.memory.js';
import { makeClock } from './_helpers.mjs';
import { mk, openNew } from './_sesionHarness.mjs';
import { simulate, SEED } from './_simulation.mjs';

const BY_ID = new Map(SEED.items.map((it) => [it.id, it]));
const click = (el) => el.dispatchEvent({ type: 'click', preventDefault() {} });
const TYPICAL = [
  { id: 'seed.can.0005', typed: 'I can to swim now.', code: 'VRB.CAN_TO', original: 'can to swim', topic: 'gram.modals.no_to' },
  { id: 'seed.irr.0002', pick: 'leaved', code: 'VRB.IRREG_REGULARIZE', original: 'leaved', topic: 'verb.irregular.past_simple' },
  { id: 'seed.pp.0001', pick: 'lives', code: 'TNS.SINCE_FOR', original: 'lives', topic: 'gram.present_perfect.for_since' },
];

// Abre una sesión real con SOLO esos ítems del paquete (tarjetas nuevas) y responde cada uno como lo haría la persona.
async function session(ids, answerFor, { summary = false, until = null, db = null, clock = null, resolveItem = null, putCards = true } = {}) {
  const holder = { study: null, current: null, logs: [] };
  const log = (...a) => holder.logs.push(a[0]);
  const registry = createExerciseRegistry({ resolveItem: resolveItem ?? ((id) => BY_ID.get(id) ?? null), log });
  registerExerciseTypes(registry, { catalog: () => holder.study?.catalog ?? null, log });
  const host = { mount: async (slot, entry, ctx) => { holder.current = entry.itemId; return registry.mount(slot, entry, ctx); } };
  const t = await mk({ host, cards: 0, ...(db ? { db } : {}), ...(clock ? { clock } : {}) });
  holder.study = t.study;
  if (summary) t.services.summarySource = createSummarySource({ study: t.study, log });
  if (putCards) for (const id of ids) await t.db.put('cards', t.study.srs.newCard(id, 0, t.clock.now(), BY_ID.get(id).topics));
  // La vista montada por mk() no vio las tarjetas: se vuelve a abrir la sesión nueva ya con ellas.
  t.view.destroy(); t.root.replaceChildren();
  t.view = sesion(); await t.view.mount(t.root, { id: 'nueva' }, t.services); await t.flush();
  await openNew(t); await t.flush();
  const seen = [];
  for (let n = 0; n < (until ? 200 : ids.length); n += 1) {
    if (until && t.root.textContent.includes(until)) break;
    const id = holder.current; seen.push(id);
    answerFor(t, BY_ID.get(id));
    await t.flush();
    click(t.foot().querySelectorAll('button')[0]); // «Continuar»
    await t.flush();
  }
  return { t, seen, logs: holder.logs };
}

function respond(t, item, how) {
  if (item.type === 'fix_error') {
    const input = t.q('input')[0];
    input.value = how.typed; input.dispatchEvent({ type: 'input', preventDefault() {} });
    click(t.btn(TA_TEXT.check));
  } else {
    click(t.q('.ch__option').find((o) => o.querySelector('.ch__text').textContent === how.pick));
    click(t.btn(CH_TEXT.check));
  }
}

// Respuesta CORRECTA de cada tipo del paquete, por la pantalla (toques y texto), como la daría la persona.
function correct(t, item) {
  const d = item.data ?? {};
  const typeIn = (input, text) => { input.value = text; input.dispatchEvent({ type: 'input', preventDefault() {} }); };
  const tapInOrder = (selector, words) => {
    const used = new Set();
    for (const w of words) {
      const el = t.q(selector).find((b) => !used.has(b) && b.textContent.trim() === w);
      assert.ok(el, `${item.id}: no hay «${w}» en ${selector}`);
      used.add(el); click(el);
    }
  };
  switch (item.type) {
    case 'choose_correct':
      click(t.q('.ch__option').find((o) => o.querySelector('.ch__text').textContent === d.options[d.correct]));
      click(t.btn(CH_TEXT.check)); break;
    case 'fix_error': case 'fill_verb':
      typeIn(t.q('input')[0], item.accept[0]); click(t.btn(TA_TEXT.check)); break;
    case 'phrase_cloze': {
      const fields = t.q('input');
      assert.equal(fields.length, d.answers.length, `${item.id}: un campo por hueco`);
      d.answers.forEach((a, i) => typeIn(fields[i], a[0]));
      click(t.btn(PC_TEXT.check)); break;
    }
    case 'cloze_bank': tapInOrder('.cb__word', d.answers.map((a) => a[0])); click(t.btn(CB_TEXT.check)); break;
    case 'order_blocks': tapInOrder('.ob__block', item.accept[0].replace(/[.?!]$/, '').split(' ')); click(t.btn(OB_TEXT.check)); break;
    default: assert.fail(`tipo sin respuesta de prueba: ${item.type}`);
  }
}

test('CA 2: los errores típicos («can to», «leaved», «since» con presente) se registran con su código, su ítem y su tema', async () => {
  const how = new Map(TYPICAL.map((x) => [x.id, x]));
  const { t, seen, logs } = await session(TYPICAL.map((x) => x.id), (tt, item) => respond(tt, item, how.get(item.id)));
  assert.deepEqual([...seen].sort(), TYPICAL.map((x) => x.id).sort(), 'la sesión pidió los 3 ítems');
  const saved = await t.db.query('errors', {});
  assert.equal(saved.length, 3, 'un error guardado por cada fallo, ni más ni menos');
  for (const exp of TYPICAL) {
    const e = saved.find((x) => x.itemId === exp.id);
    assert.ok(e, `hay un error guardado de ${exp.id}`);
    assert.equal(e.code, exp.code, `${exp.id}: código ${exp.code}`);
    assert.equal(e.original, exp.original, `${exp.id}: lo que escribiste`);
    assert.deepEqual(e.topics, [exp.topic], `${exp.id}: el tema`);
    assert.equal(e.source, 'app');
    assert.ok(typeof e.correction === 'string' && e.correction.length > 0, `${exp.id}: trae la corrección`);
  }
  const wrong = (await t.events()).filter((e) => e.type === 'answer' && e.result === 'wrong');
  assert.equal(wrong.length, 3, 'los 3 fallos quedaron como respuestas «wrong»');
  assert.deepEqual(logs, [], 'sin avisos ni errores internos en todo el recorrido');
});

test('CA 2 (control): con las respuestas correctas NO se guarda ningún error', async () => {
  const good = new Map([
    ['seed.can.0005', { typed: 'I can swim.' }],
    ['seed.irr.0002', { pick: 'left' }],
    ['seed.pp.0001', { pick: 'has lived' }],
  ]);
  const { t, logs } = await session(TYPICAL.map((x) => x.id), (tt, item) => respond(tt, item, good.get(item.id)));
  assert.equal((await t.db.query('errors', {})).length, 0, 'acertar no deja errores');
  const answers = (await t.events()).filter((e) => e.type === 'answer');
  assert.equal(answers.length, 3);
  assert.ok(answers.every((e) => e.result === 'correct'), JSON.stringify(answers.map((e) => e.result)));
  assert.deepEqual(logs, []);
});

const ONE_PER_TYPE = ['seed.pp.0001', 'seed.pp.0004', 'seed.pp.0007', 'seed.pp.0009', 'seed.pp.0011', 'seed.pp.0012'];

test('CA 1: una sesión con un ejercicio de cada tipo del paquete se completa bien, sin errores, y termina en el resumen', async () => {
  assert.deepEqual(ONE_PER_TYPE.map((id) => BY_ID.get(id).type).sort(), ['choose_correct', 'cloze_bank', 'fill_verb', 'fix_error', 'order_blocks', 'phrase_cloze']);
  const { t, seen, logs } = await session(ONE_PER_TYPE, correct, { summary: true });
  assert.deepEqual([...seen].sort(), [...ONE_PER_TYPE].sort(), 'la sesión pidió los 6 ejercicios');
  assert.match(t.root.textContent, /Sesión terminada/);
  assert.match(t.root.textContent, /Ejercicios6/, 'el resumen cuenta los 6');
  const answers = (await t.events()).filter((e) => e.type === 'answer');
  assert.equal(answers.length, 6, 'una respuesta guardada por ejercicio');
  assert.ok(answers.every((e) => e.result === 'correct'), JSON.stringify(answers.map((e) => [e.itemId, e.result])));
  assert.equal((await t.db.query('errors', {})).length, 0, 'sin fallos no hay errores guardados');
  assert.deepEqual(logs, [], 'sin avisos ni errores internos');
  assert.deepEqual(t.logs, [], 'ningún error en la consola de la vista');
  const cards = await t.db.query('cards', {});
  assert.equal(cards.length, 6);
  assert.ok(cards.every((c) => c.last_review), 'cada tarjeta quedó con su repaso registrado');
});

test('CA 1: la sesión que arma la app con los 60 ítems del paquete se completa de principio a fin, respondida bien y sin errores', async () => {
  const all = SEED.items.map((it) => it.id);
  const { t, seen, logs } = await session(all, correct, { summary: true, until: 'Sesión terminada' });
  assert.ok(seen.length >= 5, `la sesión trae ejercicios (${seen.length})`);
  assert.equal(new Set(seen).size, seen.length, 'ningún ejercicio se repite dentro de la sesión');
  assert.match(t.root.textContent, /Sesión terminada/);
  const answers = (await t.events()).filter((e) => e.type === 'answer');
  assert.equal(answers.length, seen.length, 'eventos = ejercicios resueltos');
  assert.ok(answers.every((e) => e.result === 'correct'));
  assert.equal((await t.db.query('errors', {})).length, 0);
  assert.deepEqual(logs, []);
  assert.deepEqual(t.logs, []);
});

// ---- CA 4: sin conexión. El sw.js REAL sirve los archivos REALES del repo y, tras instalar, se corta la red (como el modo avión). ----
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SW_SRC = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const BASE = 'https://example.test/glossa/';

// Misma técnica que tests/offlineFirstRun.test.mjs (aquí copiada a propósito para no tocar esa prueba).
function bootSw() {
  const handlers = {}; const store = new Map(); const state = { online: true, netHits: 0 };
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
  const net = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    if (!state.online) throw new TypeError('Failed to fetch');
    state.netHits += 1;
    const rel = decodeURIComponent(new URL(url).pathname.slice(new URL(BASE).pathname.length));
    const file = path.join(ROOT, rel);
    if (!rel || !file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return new Response('no', { status: 404 });
    return new Response(fs.readFileSync(file), { status: 200 });
  };
  const self = { location: { href: `${BASE}sw.js` }, addEventListener: (type, fn) => { handlers[type] = fn; }, skipWaiting() {}, clients: { claim: () => Promise.resolve() } };
  vm.runInContext(SW_SRC, vm.createContext({ self, URL, Request, Response, fetch: net, caches, Promise }));
  async function dispatch(type, extra = {}) {
    const waits = []; let responded;
    handlers[type]({ ...extra, waitUntil: (p) => waits.push(p), respondWith: (p) => { responded = p; } });
    const value = responded === undefined ? undefined : await responded;
    await Promise.all(waits);
    return { value, responded: responded !== undefined };
  }
  const appFetch = async (url) => {
    const request = { url: new URL(url, BASE).href, method: 'GET', mode: 'cors', headers: { get: () => null } };
    const r = await dispatch('fetch', { request });
    return r.responded ? r.value : net(request);
  };
  return { dispatch, state, appFetch };
}

async function installAndGoOffline() {
  const sw = bootSw();
  await sw.dispatch('install'); await sw.dispatch('activate');
  sw.state.online = false; sw.state.netHits = 0;
  return sw;
}

test('CA 4: instalada y en modo avión, se importa el contenido, se estudia una sesión (con un fallo), se ve el resumen y a los 2 días vuelven repasos, sin tocar la red', async () => {
  const sw = await installAndGoOffline();
  const db = createMemoryDb(); await db.open();
  const clock = makeClock('2026-11-01T08:00:00.000Z');
  const logs = [];
  const log = (...a) => logs.push(a[0]);
  const imp = await startContent({ storageReady: Promise.resolve({ db }), fetchFn: sw.appFetch, clock, log });
  assert.equal(imp.ok, true, JSON.stringify([imp, logs]));
  assert.equal((await db.query('cards', {})).length, SEED.items.length, 'las 60 tarjetas se importaron sin red');
  const resolveItem = createItemResolver({ fetchFn: sw.appFetch, log }).resolve;

  // Día 1: la sesión que arma la app, respondida por la pantalla; el primer ejercicio se falla a propósito si es de elección.
  let failed = 0;
  const answerFirst = (tt, item) => {
    if (failed === 0 && item.type === 'choose_correct') {
      failed += 1;
      click(tt.q('.ch__option').find((o) => o.querySelector('.ch__text').textContent === item.distractors[0].text));
      click(tt.btn(CH_TEXT.check));
    } else correct(tt, item);
  };
  const day1 = await session([], answerFirst, { summary: true, until: 'Sesión terminada', db, clock, resolveItem, putCards: false });
  assert.ok(day1.seen.length >= 5, `la sesión trae ejercicios (${day1.seen.length})`);
  assert.match(day1.t.root.textContent, /Sesión terminada/, 'sale el resumen');
  assert.equal(failed, 1, 'se falló un ejercicio a propósito');
  const answers1 = (await day1.t.events()).filter((e) => e.type === 'answer');
  assert.equal(answers1.length, day1.seen.length, 'eventos = ejercicios resueltos');
  assert.equal((await db.query('errors', {})).length, 1, 'el fallo dejó su error guardado, sin red');
  assert.equal(sw.state.netHits, 0, 'día 1: cero peticiones a la red');

  // A los 2 días (reloj de prueba), sigue sin red: hay repasos vencidos de lo ya respondido.
  clock.set(new Date(Date.parse('2026-11-01T08:00:00.000Z') + 2 * 86400000).toISOString());
  const day3 = await session([], correct, { summary: true, until: 'Sesión terminada', db, clock, resolveItem, putCards: false });
  const before = new Set(day1.seen);
  const reviews = day3.seen.filter((id) => before.has(id));
  assert.ok(reviews.length > 0, `a los 2 días hay repasos vencidos (sesión: ${day3.seen.join(', ')})`);
  assert.equal(sw.state.netHits, 0, 'día 3: cero peticiones a la red');
  assert.deepEqual(logs, [], 'sin avisos ni errores internos en todo el recorrido');
  assert.deepEqual(day1.logs, []); assert.deepEqual(day3.logs, []);
});

test('CA 4 (control): sin instalar la app y sin conexión no hay contenido que estudiar (la prueba de arriba no pasa por casualidad)', async () => {
  const sw = bootSw(); sw.state.online = false;
  const db = createMemoryDb(); await db.open();
  const imp = await startContent({ storageReady: Promise.resolve({ db }), fetchFn: sw.appFetch, clock: makeClock('2026-11-01T08:00:00.000Z'), log: () => {} });
  assert.equal((await db.query('cards', {})).length, 0);
  assert.equal(imp.results.length, 0);
});

for (const seed of [1, 2, 3]) {
  test(`CA 3 (semilla ${seed}): el primer día no hay repasos y a los 2 días aparecen repasos vencidos de tarjetas ya respondidas`, async () => {
    const sim = await simulate({ days: 3, seed, accuracy: 0.8 });
    const reviews = (d) => sim.days[d].planned - sim.days[d].newCards;
    assert.equal(reviews(0), 0, 'el día 1 todo es nuevo');
    assert.ok(reviews(2) > 0, `el día 3 hay repasos (planeadas ${sim.days[2].planned}, nuevas ${sim.days[2].newCards})`);
    const before = new Set(sim.answers.filter((a) => a.sessionId !== 'sim-2').map((a) => a.cardId));
    const day3 = sim.answers.filter((a) => a.sessionId === 'sim-2');
    const reviewed = day3.filter((a) => before.has(a.cardId));
    assert.equal(reviewed.length, reviews(2), 'cada repaso del día 3 es una tarjeta respondida antes');
    for (const a of reviewed) {
      const card = await sim.db.get('cards', a.cardId);
      assert.ok(card.last_review, `${a.cardId} tiene un repaso registrado`);
      assert.ok(Date.parse(card.due) > Date.parse(a.ts), `${a.cardId}: tras repasarla, su próxima fecha queda en el futuro`);
    }
  });
}

// 2.9-T5 (punto A, defecto de contenido): una nota de gramática solo puede estar en ítems de UN tema, y la de «since/for» solo en su tema.
test('paquete semilla: ninguna nota de gramática está copiada en ítems de otro tema', () => {
  const byNote = new Map();
  for (const it of SEED.items) {
    const note = it.grammar_note_es;
    if (!note) continue;
    if (!byNote.has(note)) byNote.set(note, new Set());
    byNote.get(note).add(it.topics[0]);
  }
  const shared = [...byNote].filter(([, topics]) => topics.size > 1).map(([note, topics]) => `${note.slice(0, 40)}… en ${[...topics].join(', ')}`);
  assert.deepEqual(shared, [], 'la misma nota aparece en temas distintos');
  const foreign = SEED.items
    .filter((it) => it.topics[0] !== 'gram.present_perfect.for_since' && /since|desde hace|estudio inglés desde/i.test(it.grammar_note_es || ''))
    .map((it) => it.id);
  assert.deepEqual(foreign, [], 'ítems con la nota de since/for fuera de su tema');
});
