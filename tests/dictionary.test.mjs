// @purpose: Pruebas de la fuente y la hoja «Diccionario» (2.7-T4): búsqueda tolerante (CA 4), «añadir» a `words` sin pisar nada, fallos sin culpa y limpieza.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv } from './_fakeDom.mjs';
import { createMemoryDb } from '../core/db.memory.js';
import { createDictionarySource } from '../app/dictionarySource.js';
import { createDictionarySheet, DI_TEXT } from '../ui/dictionarySheet.js';
import { makeClock } from './_helpers.mjs';

const realDocument = globalThis.document;
afterEach(() => { globalThis.document = realDocument; });
const E = (lemma, es, extra = {}) => ({ id: `vocab.t.${lemma}`, lemma, pos: 'noun', family: 'vocab.t', level: 'A1', es, def_en: `def of ${lemma}`, examples: [], ...extra });
const LEX = [E('knee', ['rodilla']), E('café', ['café']), E('year', ['año'], { false_friend_note_es: 'No es «ano».' })];

async function srcWith(over = {}) {
  const db = createMemoryDb(); await db.open();
  const logs = [];
  const source = createDictionarySource({ loadLexicon: async () => LEX, db, clock: makeClock('2026-10-31T12:00:00.000Z'), log: (...a) => logs.push(a), ...over });
  return { db, source, logs };
}

test('fuente: antes de prepare() no hay nada; después busca sin distinguir mayúsculas ni acentos (CA 4)', async () => {
  const { source } = await srcWith();
  assert.equal(source.search('knee').found, false);
  await source.prepare();
  for (const q of ['KNEE', 'Knee ', 'rodilla', 'CAFE', 'Café']) assert.equal(source.search(q).found, true, q);
  assert.equal(source.search('zzyzx').reason, 'none');
});

test('fuente: prepare() vuelve a cargar en cada llamada y se rechaza si el cargador falla', async () => {
  let n = 0;
  const { source } = await srcWith({ loadLexicon: async () => { n += 1; if (n === 3) throw new Error('sin paquetes'); return n === 1 ? [] : LEX; } });
  await source.prepare(); assert.equal(source.search('knee').found, false);
  await source.prepare(); assert.equal(source.search('knee').found, true);
  await assert.rejects(() => source.prepare(), /sin paquetes/);
  assert.throws(() => createDictionarySource({}), /loadLexicon/);
  const odd = await srcWith({ loadLexicon: async () => 'no es lista' });
  await odd.source.prepare(); assert.equal(odd.source.search('knee').found, false);
});

test('fuente: añadir guarda {id, state:unknown, source, added} en `words`, con el lema en minúsculas', async () => {
  const { db, source } = await srcWith();
  assert.deepEqual(await source.add('  Cat  '), { ok: true, id: 'cat', existed: false });
  assert.deepEqual(await db.get('words', 'cat'), { id: 'cat', state: 'unknown', source: 'dictionary', added: '2026-10-31T12:00:00.000Z' });
  assert.equal((await source.add("don't")).ok, true);
  assert.equal((await source.add('ice  cream')).id, 'ice cream');
});

test('fuente: no pisa una palabra que ya está en `words` (conserva su estado)', async () => {
  const { db, source } = await srcWith();
  await db.put('words', { id: 'cat', state: 'known' });
  assert.deepEqual(await source.add('CAT'), { ok: true, id: 'cat', existed: true });
  assert.equal((await db.get('words', 'cat')).state, 'known');
});

test('fuente: palabras no válidas, sin base y fallos de la base', async () => {
  const { source, db } = await srcWith();
  for (const bad of ['', '   ', '123', '<b>x</b>', 'a'.repeat(80), null, undefined, 5, '-x', 'x_y']) assert.deepEqual(await source.add(bad), { ok: false, reason: 'invalid' }, String(bad));
  assert.deepEqual(await createDictionarySource({ loadLexicon: async () => [] }).add('cat'), { ok: false, reason: 'no_db' });
  const logs = [];
  const broken = createDictionarySource({ loadLexicon: async () => [], db: { get: async () => null, put: async () => { throw new Error('disco lleno'); } }, log: (...a) => logs.push(a) });
  assert.deepEqual(await broken.add('cat'), { ok: false, reason: 'failed' });
  assert.equal(logs.length, 1);
  assert.equal((await db.query('words', {})).length, 0);
});

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

test('hoja: al abrir pide el léxico, muestra el buscador y busca mientras se escribe (CA 4)', async () => {
  const { source } = await srcWith();
  const t = sheetOf(source);
  await t.s.open(); await t.env.flush();
  assert.match(t.text(), /Escribe una palabra para buscarla/);
  t.type('KNEE'); assert.match(t.text(), /knee/); assert.match(t.text(), /rodilla/); assert.match(t.text(), /def of knee/);
  t.type('cafe'); assert.match(t.text(), /café/);
  t.type('ANO'); assert.match(t.text(), /year/); assert.match(t.text(), /No es «ano»/);
  t.type(''); assert.match(t.text(), /Escribe una palabra/);
});

test('hoja: si la palabra no está ofrece «Añadir», la guarda y avisa; segunda vez dice que ya estaba', async () => {
  const { source, db } = await srcWith();
  const t = sheetOf(source);
  await t.s.open(); await t.env.flush();
  t.type('Zebra');
  assert.match(t.text(), /No encontré «Zebra»/);
  const add = t.q('.dictionary__add')[0];
  assert.equal(add.textContent, 'Añadir «Zebra»');
  t.click(add); await t.env.flush(); await t.env.flush();
  assert.match(t.text(), /Listo: «zebra» quedó en tus palabras/);
  assert.equal((await db.get('words', 'zebra')).state, 'unknown');
  t.click(t.q('.dictionary__add')[0]); await t.env.flush(); await t.env.flush();
  assert.match(t.text(), /«zebra» ya estaba en tus palabras/);
});

test('hoja: palabra no válida y fallo al añadir dan avisos amables', async () => {
  const { source } = await srcWith();
  const t = sheetOf(source);
  await t.s.open(); await t.env.flush();
  t.type('x9'); t.click(t.q('.dictionary__add')[0]); await t.env.flush(); await t.env.flush();
  assert.match(t.text(), /Solo puedo añadir palabras con letras/);
  const bad = sheetOf({ prepare: async () => {}, search: () => ({ found: false, results: [], reason: 'none' }), add: async () => { throw new Error('x'); } });
  await bad.s.open(); await bad.env.flush();
  bad.type('cat'); bad.click(bad.q('.dictionary__add')[0]); await bad.env.flush(); await bad.env.flush();
  assert.match(bad.text(), /No pude añadir esa palabra/);
  assert.equal(bad.logs.length, 1);
});

test('hoja: si el léxico no carga, aviso sin culpa, motivo al log; si search lanza, la hoja sigue', async () => {
  const t = sheetOf({ prepare: async () => { throw new Error('sin léxico'); }, search: () => ({}), add: async () => ({}) });
  await t.s.open(); await t.env.flush();
  assert.match(t.text(), /No pude abrir el diccionario/);
  assert.match(t.text(), /Tu ejercicio sigue como lo dejaste/);
  assert.equal(t.logs.length, 1);
  const w = sheetOf({ prepare: async () => {}, search: () => { throw new Error('x'); }, add: async () => ({}) });
  await w.s.open(); await w.env.flush(); w.type('a');
  assert.match(w.text(), /Escribe una palabra/);
  assert.equal(w.logs.length, 2, 'una al abrir y otra al escribir');
});

test('hoja: cerrar antes de que cargue no pinta nada; la fuente se valida; los textos no culpan', async () => {
  let release; const gate = new Promise((r) => { release = r; });
  const t = sheetOf({ prepare: () => gate, search: () => ({}), add: async () => ({}) });
  const opening = t.s.open(); t.s.close(); release(); await opening; await t.env.flush();
  assert.equal(t.q('.dictionary__field').length, 0);
  assert.throws(() => createDictionarySheet({}), TypeError);
  assert.throws(() => createDictionarySheet({ source: { prepare() {}, search() {} } }), TypeError);
  assert.equal(DI_TEXT.title, 'Diccionario');
});
