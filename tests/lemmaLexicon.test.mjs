// @purpose: Pruebas del Diccionario básico (2.9-T4): léxico de lemas, mezcla con paquetes, traducción propia, hoja con banda y medición de la búsqueda (50 ms).
// Decisión del Administrador (2026-11-01, pregunta 1): el Diccionario busca en content/taxonomy/lemmas.json, muestra «Palabra del inglés, banda X», ofrece «Añadir mi traducción» (nota local) y no marca nada como «conocida».
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeEnv } from './_fakeDom.mjs';
import { createMemoryDb } from '../core/db.memory.js';
import { createLemmaTable } from '../core/lemmas.js';
import { lemmaEntries, mergeLexicon, createLemmaLexicon } from '../app/lemmaLexicon.js';
import { createDictionarySource } from '../app/dictionarySource.js';
import { createDictionarySheet, DI_TEXT } from '../ui/dictionarySheet.js';
import { createLexSearch } from '../core/lexSearch.js';
import { makeClock } from './_helpers.mjs';

const realDocument = globalThis.document;
afterEach(() => { globalThis.document = realDocument; });

const REAL = JSON.parse(fs.readFileSync(new URL('../content/taxonomy/lemmas.json', import.meta.url), 'utf8'));
const MINI = { schema: 1, version: 1, source: 'original', bands: ['1K', '2K'], lemmas: [
  { lemma: 'go', pos: ['verb'], band: '1K', forms: ['go', 'goes', 'going', 'went', 'gone'] },
  { lemma: 'knee', pos: ['noun'], band: '2K', forms: ['knee', 'knees'] },
] };
const reply = (text) => ({ ok: true, status: 200, text: async () => text });
const miniFetch = async () => reply(JSON.stringify(MINI));

// ---------- core/lemmas.js: entries() ----------

test('entries(): lista { lemma, pos, band, forms } en el orden del archivo y es una copia', () => {
  const t = createLemmaTable(MINI);
  const e = t.entries();
  assert.deepEqual(e.map((x) => x.lemma), ['go', 'knee']);
  assert.deepEqual(e[0], { lemma: 'go', pos: ['verb'], band: '1K', forms: ['go', 'goes', 'going', 'went', 'gone'] });
  e[0].forms.push('XX'); e.pop();
  assert.equal(t.entries().length, 2);
  assert.ok(!t.entries()[0].forms.includes('XX'), 'tocar el resultado no cambia la tabla');
});

test('entries() con el archivo real devuelve todos los lemas (más de 3.000)', () => {
  const all = createLemmaTable(REAL).entries();
  assert.equal(all.length, REAL.lemmas.length);
  assert.ok(all.length >= 3000);
});

// ---------- app/lemmaLexicon.js ----------

test('lemmaEntries: básicas, sin traducción, y `derivation` sin repetir el lema', () => {
  const list = lemmaEntries(createLemmaTable(MINI));
  assert.deepEqual(list[0], { lemma: 'go', band: '1K', pos: ['verb'], derivation: ['goes', 'going', 'went', 'gone'], es: [], basic: true });
  assert.ok(list.every((e) => e.basic === true && e.es.length === 0));
  for (const bad of [null, undefined, {}, 'x', { entries: 5 }]) assert.deepEqual(lemmaEntries(bad), []);
});

test('mergeLexicon: la entrada de un paquete manda sobre la básica del mismo lema', () => {
  const pack = [{ id: 'vocab.body.knee', lemma: 'Knee', es: ['rodilla'] }];
  const basic = lemmaEntries(createLemmaTable(MINI));
  const out = mergeLexicon(pack, basic);
  assert.deepEqual(out.map((e) => e.lemma), ['Knee', 'go']);
  assert.equal(out[0].es[0], 'rodilla');
  assert.deepEqual(mergeLexicon(null, basic).map((e) => e.lemma), ['go', 'knee']);
  assert.deepEqual(mergeLexicon([null, 5, { lemma: 3 }], undefined), []);
});

test('createLemmaLexicon: carga una vez y guarda el resultado', async () => {
  let calls = 0;
  const lex = createLemmaLexicon({ fetchFn: async (...a) => { calls += 1; return miniFetch(...a); }, log: () => {} });
  const a = await lex.load(); const b = await lex.load();
  assert.equal(a.length, 2); assert.equal(a, b);
  assert.equal(calls, 1);
});

test('createLemmaLexicon: sin red o con archivo dañado da [], lo anota y NO guarda el fallo (se reintenta)', async () => {
  const logs = [];
  let ok = false;
  const lex = createLemmaLexicon({ fetchFn: async () => (ok ? miniFetch() : reply('{no es json')), log: (...a) => logs.push(a) });
  assert.deepEqual(await lex.load(), []);
  assert.equal(logs.length, 1);
  ok = true;
  assert.equal((await lex.load()).length, 2, 'al volver a abrir, ya funciona');
  const none = createLemmaLexicon({ fetchFn: null, log: (...a) => logs.push(a) });
  assert.deepEqual(await none.load(), []);
  const boom = createLemmaLexicon({ fetchFn: async () => { throw new Error('sin red'); }, log: (...a) => logs.push(a) });
  assert.deepEqual(await boom.load(), []);
  assert.equal(logs.length, 3);
});

// ---------- búsqueda con el archivo real ----------

test('búsqueda real: «went» encuentra «go», cada resultado trae banda y ninguno trae traducción', () => {
  const idx = createLexSearch(lemmaEntries(createLemmaTable(REAL)));
  const r = idx.search('went');
  assert.equal(r.found, true);
  assert.ok(r.results.some((x) => x.entry.lemma === 'go' && x.via === 'derivation'));
  const go = idx.search('go').results[0].entry;
  assert.equal(go.lemma, 'go');
  assert.match(go.band, /^[123]K$/);
  assert.ok(r.results.every((x) => x.entry.es.length === 0));
  assert.equal(idx.search('zzyzx').reason, 'none');
});

test('rendimiento: buscar en los 3.477 lemas cuesta menos de 50 ms (si no, habría que indexar por prefijo)', () => {
  const entries = lemmaEntries(createLemmaTable(REAL));
  assert.ok(entries.length >= 3000);
  const idx = createLexSearch(entries);
  const queries = ['a', 'go', 'went', 'ing', 'ed', 'under', 'zzyzx', 'th', 'knee', 'wa'];
  idx.search('go'); // calentar
  const times = [];
  for (const q of queries) { const t0 = performance.now(); idx.search(q); times.push(performance.now() - t0); }
  times.sort((x, y) => x - y);
  const median = times[Math.floor(times.length / 2)];
  assert.ok(median < 50, `mediana ${median.toFixed(1)} ms`);
  assert.ok(times[times.length - 1] < 1000, `peor caso ${times[times.length - 1].toFixed(1)} ms (margen muy amplio: con la suite en paralelo hay picos)`);
});

// ---------- fuente: addTranslation y mine ----------

async function srcWith(over = {}) {
  const db = createMemoryDb(); await db.open();
  const logs = [];
  const source = createDictionarySource({ loadLexicon: async () => lemmaEntries(createLemmaTable(MINI)), db, clock: makeClock('2026-11-01T12:00:00.000Z'), log: (...a) => logs.push(a), ...over });
  return { db, source, logs };
}

test('addTranslation guarda una nota local `dict_es:<lema>` y NO toca `words`', async () => {
  const { db, source } = await srcWith();
  await source.prepare();
  assert.deepEqual(await source.addTranslation('  Knee ', '  rodilla  '), { ok: true, id: 'knee', existed: false });
  assert.deepEqual(await db.get('notes', 'dict_es:knee'), { id: 'dict_es:knee', kind: 'translation', lemma: 'knee', text: 'rodilla', added: '2026-11-01T12:00:00.000Z' });
  assert.equal((await db.query('words', {})).length, 0, 'no marca la palabra ni como conocida ni como desconocida');
  assert.equal(source.mine('KNEE'), 'rodilla');
  assert.equal(source.mine('go'), null);
});

test('addTranslation reemplaza la anterior (existed) y limpia caracteres de control y longitud', async () => {
  const { db, source } = await srcWith();
  await source.addTranslation('go', 'ir');
  assert.deepEqual(await source.addTranslation('go', 'ir\u0000 \n  a   algún sitio'), { ok: true, id: 'go', existed: true });
  assert.equal((await db.get('notes', 'dict_es:go')).text, 'ir a algún sitio');
  await source.addTranslation('go', 'x'.repeat(300));
  assert.equal(source.mine('go').length, 120);
  assert.equal((await db.query('notes', {})).length, 1);
});

test('addTranslation: textos o palabras no válidos, sin base y fallo de la base', async () => {
  const { source } = await srcWith();
  for (const [l, t] of [['go', ''], ['go', '   '], ['go', null], ['go', 5], ['', 'ir'], ['x9', 'ir'], [null, 'ir'], ['<b>', 'ir']]) assert.deepEqual(await source.addTranslation(l, t), { ok: false, reason: 'invalid' }, `${l}/${t}`);
  assert.deepEqual(await createDictionarySource({ loadLexicon: async () => [] }).addTranslation('go', 'ir'), { ok: false, reason: 'no_db' });
  const logs = [];
  const broken = createDictionarySource({ loadLexicon: async () => [], db: { get: async () => null, put: async () => { throw new Error('disco lleno'); } }, log: (...a) => logs.push(a) });
  assert.deepEqual(await broken.addTranslation('go', 'ir'), { ok: false, reason: 'failed' });
  assert.equal(logs.length, 1);
  assert.equal(broken.mine('go'), null, 'si no se guardó, mine no la devuelve');
});

test('mine se recupera de la base en prepare() y un fallo al leer las notas no rompe el diccionario', async () => {
  const { db, source } = await srcWith();
  await db.put('notes', { id: 'dict_es:go', kind: 'translation', lemma: 'go', text: 'ir', added: 'x' });
  await db.put('notes', { id: 'otra', kind: 'otra cosa', lemma: 'knee', text: 'no' });
  assert.equal(source.mine('go'), null, 'antes de prepare() no hay nada');
  await source.prepare();
  assert.equal(source.mine('go'), 'ir');
  assert.equal(source.mine('knee'), null, 'solo cuentan las notas de traducción');
  const logs = [];
  const odd = createDictionarySource({ loadLexicon: async () => lemmaEntries(createLemmaTable(MINI)), db: { query: async () => { throw new Error('x'); } }, log: (...a) => logs.push(a) });
  await odd.prepare();
  assert.equal(odd.search('went').found, true);
  assert.equal(logs.length, 1);
});

// ---------- hoja ----------

function sheetOf(source) {
  const env = makeEnv(); globalThis.document = env.doc;
  const logs = [];
  const s = createDictionarySheet({ doc: env.doc, source, log: (...a) => logs.push(a) });
  const q = (sel) => env.doc.body.querySelectorAll(sel);
  const type = (v) => { const f = q('.dictionary__field')[0]; f.value = v; f.dispatchEvent({ type: 'input' }); };
  const text = () => q('.dictionary')[0]?.textContent ?? '';
  const click = (el) => el.dispatchEvent({ type: 'click', preventDefault() {} });
  return { env, s, logs, q, type, text, click };
}

test('hoja: una palabra básica muestra «Palabra del inglés, banda X», la nota «básico por ahora» y ninguna traducción inventada', async () => {
  const { source } = await srcWith();
  const t = sheetOf(source);
  await t.s.open(); await t.env.flush();
  t.type('went');
  assert.match(t.text(), /go/);
  assert.match(t.text(), /Palabra del inglés, banda 1K\./);
  assert.match(t.text(), /El Diccionario es básico por ahora/);
  assert.doesNotMatch(t.text(), /conocida|ya la sabes|sabida/i, 'no marca nada como conocida');
  assert.equal(t.q('.dictionary__add-mine').length, 1);
  assert.equal(t.q('.dictionary__add-mine')[0].textContent, 'Añadir mi traducción');
});

test('hoja: «Añadir mi traducción» abre el campo, guarda la nota y la muestra; vacío da aviso amable', async () => {
  const { source, db } = await srcWith();
  const t = sheetOf(source);
  await t.s.open(); await t.env.flush();
  t.type('knee');
  t.click(t.q('.dictionary__add-mine')[0]);
  t.click(t.q('.dictionary__save-mine')[0]); await t.env.flush(); await t.env.flush();
  assert.match(t.text(), /Escribe tu traducción para guardarla/);
  assert.equal((await db.query('notes', {})).length, 0);
  t.q('.dictionary__mine-field')[0].value = 'rodilla';
  t.click(t.q('.dictionary__save-mine')[0]); await t.env.flush(); await t.env.flush();
  assert.equal((await db.get('notes', 'dict_es:knee')).text, 'rodilla');
  assert.match(t.text(), /Tu traducción: rodilla/);
  assert.equal((await db.query('words', {})).length, 0);
});

test('hoja: un fallo al guardar la traducción da aviso sin culpa y va al log', async () => {
  const bad = sheetOf({ prepare: async () => {}, search: () => ({ found: true, reason: null, results: [{ entry: { lemma: 'go', band: '1K', basic: true, es: [], derivation: [] }, match: 'exact', via: 'lemma' }] }), add: async () => ({}), addTranslation: async () => { throw new Error('x'); } });
  await bad.s.open(); await bad.env.flush();
  bad.type('go');
  bad.click(bad.q('.dictionary__add-mine')[0]);
  bad.q('.dictionary__mine-field')[0].value = 'ir';
  bad.click(bad.q('.dictionary__save-mine')[0]); await bad.env.flush(); await bad.env.flush();
  assert.match(bad.text(), /No pude guardar esa traducción ahora/);
  assert.equal(bad.logs.length, 1);
});

test('hoja: sin addTranslation en la fuente no hay botón; una entrada de paquete (no básica) no lo lleva', async () => {
  const entry = { lemma: 'knee', es: ['rodilla'], derivation: [], examples: [] };
  const found = { found: true, reason: null, results: [{ entry, match: 'exact', via: 'lemma' }] };
  const plain = sheetOf({ prepare: async () => {}, search: () => ({ ...found, results: [{ ...found.results[0], entry: { ...entry, basic: true, band: '1K', es: [] } }] }), add: async () => ({}) });
  await plain.s.open(); await plain.env.flush(); plain.type('knee');
  assert.equal(plain.q('.dictionary__add-mine').length, 0);
  const pack = sheetOf({ prepare: async () => {}, search: () => found, add: async () => ({}), addTranslation: async () => ({ ok: true }) });
  await pack.s.open(); await pack.env.flush(); pack.type('knee');
  assert.equal(pack.q('.dictionary__add-mine').length, 0);
  assert.doesNotMatch(pack.text(), /básico por ahora/);
});

test('textos del Diccionario básico: sin culpa y la nota de M1 está', () => {
  assert.equal(DI_TEXT.basicNote, 'El Diccionario es básico por ahora.');
  assert.equal(DI_TEXT.addMine, 'Añadir mi traducción');
  for (const k of ['mineEmpty', 'mineFailed', 'mineSaved', 'mineUpdated']) assert.doesNotMatch(DI_TEXT[k], /error|incorrect|mal |fallaste|culpa/i, k);
});
