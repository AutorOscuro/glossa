// @purpose: Criterios de aceptación 1 a 4 de la subparte 1.12 (núcleo de sincronización) comprobados con oráculos independientes: ida y vuelta, reimportar no duplica, entradas hostiles y respaldo sin claves.
// CA de la 1.12 (cierre del M0.5). Cada prueba lleva el número del criterio. Los oráculos leen la base con `db.query` y no con las funciones de sync que se están probando.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createSync, MAX_BACKUP_CHARS } from '../core/sync.js';
import { parseChatBlock, makeChatBlock } from '../core/syncChat.js';
import { createMemoryDb } from '../core/db.memory.js';
import { createErrors } from '../core/errors.js';
import { createErrorCatalog } from '../core/errorCatalog.js';
import { STORES, DbError, EXPORT_FORMAT, isReserved } from '../core/db.js';
import { makeClock, makeCard, makeEvent, resetFactories } from './_helpers.mjs';

const NOW = '2026-10-25T12:00:00.000Z';
const CATALOG = createErrorCatalog(JSON.parse(fs.readFileSync(new URL('../content/taxonomy/error_codes.json', import.meta.url), 'utf8')));
const SECRET_A = 'clave-de-prueba-123';
const SECRET_B = 'otra-clave-de-prueba-456';
const SECRET_C = 'tercera-clave-de-prueba-789';

async function mk() {
  const db = createMemoryDb();
  await db.open();
  const clock = makeClock(NOW);
  const errors = createErrors({ db, catalog: CATALOG, clock });
  return { db, errors, sync: createSync({ db, clock, errors, catalog: CATALOG }) };
}
// Todo lo que hay en la base, leído fila a fila (sin pasar por exportAll ni por sync). Orden fijo para comparar.
async function dump(db, { secrets = true } = {}) {
  const out = {};
  for (const [name, def] of Object.entries(STORES)) {
    // lo reservado (meta.schemaVersion) no va en los respaldos: tampoco se compara
    const rows = (await db.query(name)).filter((r) => !isReserved(name, r[def.keyPath]));
    const keep = rows.filter((r) => secrets || r.secret !== true);
    out[name] = keep.sort((a, b) => (String(a[def.keyPath]) < String(b[def.keyPath]) ? -1 : 1));
  }
  return out;
}
async function seed(db) {
  resetFactories();
  await db.put('cards', makeCard({ id: 'c1' }));
  await db.put('cards', makeCard({ id: 'c2' }));
  await db.put('events', makeEvent({ id: 'e1' }));
  await db.put('events', makeEvent({ id: 'e2' }));
  await db.put('errors', { id: 'er1', day: '2026-10-17', code: 'ART_MISSING', topics: ['articles'], texto: '“¿Qué tal?” ’quote’ 😀 ñandú' });
  await db.put('words', { id: 'w1', state: 'known', nested: { a: [1, 2, { b: null }], n: 0, s: '', neg: -0.5, big: 9007199254740991, tiny: 5e-324, huge: 1.7976931348623157e308 } });
  await db.put('generated', { id: 'g1', itemId: 'i1', text: 'ñandú' });
  await db.put('sessions', { id: 's1', day: '2026-10-17', done: true });
  await db.put('plans', { day: '2026-10-18', items: ['a', 'b'] });
  await db.put('notes', { id: 'n1', text: `Mañana ${'é'.repeat(300)}\n\ttab y salto` });
  await db.put('content_cache', { pack_id: 'p1', version: 3, items: [{ id: 'x', accept: ['a', 'b'] }] });
  await db.put('audio_index', { id: 'a1', url: 'x' });
  await db.put('settings', { key: 'theme', value: 'neo' });
  await db.put('settings', { key: 'aiKey', value: SECRET_A, secret: true });
  await db.put('settings', { key: 'azureKey', value: SECRET_B, secret: true });
  await db.put('meta', { key: 'nombre', value: 'Glossa' });
}

// ---------- CA 1: ida y vuelta del respaldo sin pérdida (comparación profunda) ----------
test('CA 1: exportar con claves e importar en una base vacía deja cada fila de cada almacén idéntica (deepEqual)', async () => {
  const a = await mk();
  await seed(a.db);
  const original = await dump(a.db);
  const { json, counts } = await a.sync.exportBackup({ includeSecrets: true });
  for (const [name, rows] of Object.entries(original)) assert.equal(counts[name], rows.length, name);
  for (const modo of ['replace', 'merge']) {
    const b = await mk();
    await b.sync.importBackup(json, { mode: modo, keepSecrets: false });
    assert.deepEqual(await dump(b.db), original, modo);
  }
});

test('CA 1: sin claves, lo restaurado es exactamente lo de antes menos las claves, y el ciclo completo converge (exportar → importar → exportar da lo mismo)', async () => {
  const a = await mk();
  await seed(a.db);
  const sinClaves = await dump(a.db, { secrets: false });
  const { json } = await a.sync.exportBackup();
  const b = await mk();
  await b.sync.importBackup(json);
  assert.deepEqual(await dump(b.db), sinClaves);
  const otra = await b.sync.exportBackup();
  const quitaFecha = (t) => { const { exportedAt, ...resto } = JSON.parse(t); return resto; };
  assert.deepEqual(quitaFecha(otra.json), quitaFecha(json));
  const c = await mk();
  await c.sync.importBackup(otra.json);
  assert.deepEqual(await dump(c.db), sinClaves);
});

test('CA 1: restaurar sobre una base con datos propios en «reemplazar» deja solo lo del respaldo y en «fusionar» conserva lo demás', async () => {
  const a = await mk();
  await seed(a.db);
  const { json } = await a.sync.exportBackup({ includeSecrets: true });
  const b = await mk();
  await b.db.put('notes', { id: 'propia', text: 'solo en B' });
  await b.db.put('cards', makeCard({ id: 'c1', stability: 99 }));
  await b.sync.importBackup(json, { mode: 'merge', keepSecrets: false });
  const notas = (await b.db.query('notes')).map((r) => r.id).sort();
  assert.deepEqual(notas, ['n1', 'propia']);
  assert.deepEqual((await b.db.get('cards', 'c1')), (await a.db.get('cards', 'c1')));
  await b.sync.importBackup(json, { mode: 'replace', keepSecrets: false });
  assert.deepEqual((await b.db.query('notes')).map((r) => r.id), ['n1']);
  assert.deepEqual(await dump(b.db), await dump(a.db));
});

// Límite de JSON, aceptado: -0 se guarda como 0 (JSON no distingue el cero negativo); ningún dato de la app lo usa.
test('CA 1: texto con acentos, ñ, emoji, comillas curvas, saltos, tabuladores y números extremos sobrevive tal cual', async () => {
  const a = await mk();
  const raros = { id: 'r1', a: '“¿Qué tal?” ‘x’ — «hola» ñandú 😀👩🏽‍💻 \u00a0 \u200b', b: 'línea1\nlínea2\r\n\ttab', c: [0, 1e21, 1e-7, 123456789012345680000, 0.1 + 0.2], d: '', e: [], f: {}, g: null, h: false };
  await a.db.put('notes', raros);
  const { json } = await a.sync.exportBackup();
  const b = await mk();
  await b.sync.importBackup(json);
  assert.deepEqual(await b.db.get('notes', 'r1'), await a.db.get('notes', 'r1'));
});

// ---------- CA 2: reimportar el mismo bloque no duplica ----------
const E1 = { original: "I didn't can to send it", code: 'VRB.CAN_TO', correction: "I couldn't send it" };
const E2 = { original: 'She go to school', code: 'VRB.THIRD_S_OMIT' };
const E3 = { original: 'I am agree', code: 'SUBJ.OMIT', ts: '2026-10-20T08:00:00.000Z' };

test('CA 2: importar el mismo bloque 5 veces deja la base idéntica a la de la primera vez', async () => {
  const { db, sync } = await mk();
  const bloque = makeChatBlock('errores', { errores: [E1, E2, E3] }, { now: new Date('2026-10-25T09:00:00.000Z') });
  const primera = await sync.importChatErrors(bloque);
  assert.equal(primera.applied, 3);
  const despues = await dump(db);
  assert.equal(despues.errors.length, 3);
  for (let i = 0; i < 5; i += 1) {
    const r = await sync.importChatErrors(bloque);
    assert.deepEqual(r.totals, { new: 0, repeat: 0, replay: 3, invalid: 0, skipped: 0 });
    assert.deepEqual(await dump(db), despues);
  }
});

test('CA 2: el mismo contenido pegado con otro formato (vallas, texto alrededor, comillas curvas, otro orden) tampoco duplica', async () => {
  const { db, sync } = await mk();
  const base = makeChatBlock('errores', { errores: [E1, E2] }, { now: new Date('2026-10-25T09:00:00.000Z') });
  await sync.importChatErrors(base);
  const despues = await dump(db);
  const variantes = [
    `Aquí tienes:\n\n\`\`\`\n${base}\n\`\`\`\n\n¡Suerte!`,
    base.replace('=== SOPHIA-EN-SYNC v1 ===', '**=== SOPHIA-EN-SYNC v1 ===**').replace('tipo:', 'TIPO :'),
    makeChatBlock('errores', { errores: [E2, E1] }, { now: new Date('2026-10-25T09:00:00.000Z') }),
    base.replace(/\n/g, '\r\n'),
    `> ${base.split('\n')[0]}\n${base.split('\n').slice(1).join('\n')}`,
  ];
  for (const v of variantes) {
    const r = await sync.importChatErrors(v);
    assert.equal(r.ok, true, v.slice(0, 80));
    assert.deepEqual(r.totals, { new: 0, repeat: 0, replay: 2, invalid: 0, skipped: 0 }, v.slice(0, 80));
    assert.deepEqual(await dump(db), despues);
  }
});

test('CA 2: la vista previa lo anticipa (todo «replay», canImport false) y un bloque realmente nuevo sí suma una ocurrencia', async () => {
  const { db, sync } = await mk();
  const uno = makeChatBlock('errores', { errores: [E1] }, { now: new Date('2026-10-24T09:00:00.000Z') });
  await sync.importChatErrors(uno);
  const pv = await sync.previewChatErrors(uno);
  assert.equal(pv.canImport, false);
  assert.equal(pv.totals.replay, 1);
  const dos = makeChatBlock('errores', { errores: [E1] }, { now: new Date('2026-10-25T09:00:00.000Z') });
  assert.equal((await sync.previewChatErrors(dos)).totals.repeat, 1);
  await sync.importChatErrors(dos);
  const filas = await db.query('errors', {});
  assert.equal(filas.length, 1);
  assert.equal(filas[0].count, 2);
  await sync.importChatErrors(uno);
  await sync.importChatErrors(dos);
  assert.equal((await db.query('errors', {}))[0].count, 2);
});

test('CA 2: importar el mismo respaldo dos veces tampoco cambia nada la segunda vez, en los dos modos', async () => {
  const a = await mk();
  await seed(a.db);
  const { json } = await a.sync.exportBackup({ includeSecrets: true });
  for (const modo of ['replace', 'merge']) {
    const b = await mk();
    await b.sync.importBackup(json, { mode: modo, keepSecrets: false });
    const uno = await dump(b.db);
    await b.sync.importBackup(json, { mode: modo, keepSecrets: false });
    assert.deepEqual(await dump(b.db), uno, modo);
    const pv = await b.sync.previewBackup(json, { mode: modo, keepSecrets: false });
    assert.equal(pv.totals.added + pv.totals.overwritten, 0, modo);
  }
});

// ---------- CA 3: JSON malformado o malicioso rechazado con mensaje claro ----------
const CLARO = /[a-záéíóúñ]{4,}/i;
const bk = (stores, extra = {}) => JSON.stringify({ format: EXPORT_FORMAT, schemaVersion: 1, exportedAt: NOW, stores, ...extra });
const nested = (n) => `${'['.repeat(n)}${']'.repeat(n)}`;
const wrap = (head, body) => `=== SOPHIA-EN-SYNC v1 ===\n${head}\n${body}\n=== FIN ===`;

test('CA 3: 14 respaldos malformados o maliciosos se rechazan con BAD_IMPORT y mensaje en español, sin cambiar nada', async () => {
  const { db, sync } = await mk();
  await seed(db);
  const antes = await dump(db);
  const casos = {
    json_cortado: '{"format":"glossa-db","sche',
    coma_final: '{"format":"glossa-db",}',
    comillas_simples: "{'format':'glossa-db'}",
    no_objeto: '[]',
    vacio: '',
    solo_espacios: '   \n  ',
    proto_raiz: `{"format":"${EXPORT_FORMAT}","schemaVersion":1,"__proto__":{"polluted":1},"stores":{}}`,
    proto_en_registro: `{"format":"${EXPORT_FORMAT}","schemaVersion":1,"stores":{"notes":[{"id":"n","__proto__":{"polluted":1}}]}}`,
    constructor_prototype: `{"format":"${EXPORT_FORMAT}","schemaVersion":1,"stores":{"notes":[{"id":"n","constructor":{"prototype":{"polluted":1}}}]}}`,
    demasiado_hondo: `{"format":"${EXPORT_FORMAT}","schemaVersion":1,"stores":{"notes":[{"id":"n","v":${nested(10_000)}}]}}`,
    mil_corchetes: '['.repeat(1_000_000),
    demasiado_grande: 'x'.repeat(MAX_BACKUP_CHARS + 1),
    infinito: `{"format":"${EXPORT_FORMAT}","schemaVersion":1,"stores":{"notes":[{"id":"n","v":1e999}]}}`,
    almacen_inventado: bk({ inventado: [{ id: 'a' }] }),
  };
  assert.equal(Object.keys(casos).length, 14);
  for (const [nombre, texto] of Object.entries(casos)) {
    for (const f of [(t) => sync.previewBackup(t), (t) => sync.importBackup(t, { mode: 'merge' }), (t) => sync.importBackup(t)]) {
      await assert.rejects(() => f(texto), (e) => e instanceof DbError && e.code === 'BAD_IMPORT' && CLARO.test(e.message) && e.friendly.length > 10, nombre);
    }
  }
  assert.deepEqual(await dump(db), antes);
  assert.equal(({}).polluted, undefined);
});

test('CA 3: 14 bloques del chat malformados o maliciosos dan {ok:false} con código y mensaje en español, y no escriben nada', async () => {
  const { db, sync } = await mk();
  const antes = await dump(db);
  const casos = {
    json_cortado: [wrap('tipo: errores', '{"errores":[{"original":"a","code":"X"'), ['NO_JSON', 'BAD_JSON']],
    coma_final: [wrap('tipo: errores', '{"errores":[],}'), ['BAD_JSON']],
    sin_inicio: ['{"errores":[]}', ['NO_BLOCK']],
    sin_fin: [`=== SOPHIA-EN-SYNC v1 ===\ntipo: errores\n{"errores":[]}`, ['NO_END']],
    tipo_falso: [wrap('tipo: hackeo', '{}'), ['BAD_KIND']],
    version_futura: ['=== SOPHIA-EN-SYNC v9 ===\ntipo: errores\n{}\n=== FIN ===', ['NEWER_VERSION']],
    proto: [wrap('tipo: errores', '{"errores":[{"original":"a b","code":"VRB.CAN_TO"}],"__proto__":{"polluted":1}}'), ['HOSTILE']],
    constructor: [wrap('tipo: errores', '{"errores":[{"original":"a b","code":"VRB.CAN_TO","constructor":1}]}'), ['HOSTILE']],
    hondo: [wrap('tipo: errores', `{"errores":[{"original":"a b","code":"VRB.CAN_TO","x":${nested(30)}}]}`), ['HOSTILE']],
    muchos_nodos: [wrap('tipo: errores', `{"errores":[{"original":"a b","code":"VRB.CAN_TO"}],"x":[${new Array(25_000).fill(0).join(',')}]}`), ['HOSTILE']],
    demasiado_grande: ['x'.repeat(300_001), ['TOO_BIG']],
    doscientos_uno: [wrap('tipo: errores', JSON.stringify({ errores: Array.from({ length: 201 }, (_, i) => ({ original: `I am agree ${i}`, code: 'SUBJ.OMIT' })) })), ['BAD_PAYLOAD']],
    campo_extra: [wrap('tipo: errores', '{"errores":[{"original":"a b","code":"VRB.CAN_TO","admin":true}]}'), ['BAD_PAYLOAD']],
    fecha_rota: ['=== SOPHIA-EN-SYNC v1 ===\ntipo: errores\ngenerado: 2026-13-45\n{"errores":[]}\n=== FIN ===', ['BAD_DATE']],
  };
  assert.equal(Object.keys(casos).length, 14);
  for (const [nombre, [texto, codigos]] of Object.entries(casos)) {
    const lectura = parseChatBlock(texto);
    assert.equal(lectura.ok, false, nombre);
    assert.ok(codigos.includes(lectura.error.code), `${nombre}: ${lectura.error.code}`);
    assert.match(lectura.error.message, CLARO, nombre);
    for (const f of [sync.previewChatErrors, sync.importChatErrors]) {
      const r = await f(texto);
      assert.equal(r.ok, false, nombre);
      assert.equal(r.error.code, lectura.error.code, nombre);
    }
  }
  assert.deepEqual(await dump(db), antes);
});

test('CA 3: un bloque hostil de salida es imposible: lo que la app arma siempre pasa su propio lector, aun con texto raro', async () => {
  const { sync } = await mk();
  for (const [kind, payload] of [
    ['bitacora', { texto: '=== FIN ===\n"{}"\n```\n__proto__ \u0000 😀 “curvas”' }],
    ['llevar_al_chat', { tema: 'gram.x', item: 'a "b" \\ c', respuesta: '“¿qué?”', mensaje: 'línea1\nlínea2' }],
    ['estado', { dia: '2026-10-25', areas: [{ area: 'gram', pct: 42.5 }], notas: 'ñ 😀' }],
    ['errores', { errores: [E1, E2] }],
  ]) {
    let texto;
    try { texto = sync.makeChatBlock(kind, payload); } catch (e) { assert.equal(e.name, 'ChatBlockError'); continue; }
    const r = parseChatBlock(texto);
    assert.equal(r.ok, true, kind);
    assert.equal(r.kind, kind);
  }
});

// ---------- CA 4: el respaldo no contiene claves por defecto ----------
test('CA 4: el respaldo por defecto no trae ningún registro secreto ni el valor de ninguna clave, en ningún lugar del texto', async () => {
  const { db, sync } = await mk();
  await seed(db);
  await db.put('settings', { key: 'otraClave', value: SECRET_C, secret: true });
  const por = await sync.exportBackup();
  assert.equal(por.includesSecrets, false);
  for (const s of [SECRET_A, SECRET_B, SECRET_C]) assert.ok(!por.json.includes(s), s);
  const data = JSON.parse(por.json);
  for (const rows of Object.values(data.stores)) assert.ok(rows.every((r) => r.secret !== true));
  assert.deepEqual(data.stores.settings.map((r) => r.key).sort(), ['theme']);
  assert.equal(por.counts.settings, 1);
});

test('CA 4: solo includeSecrets === true incluye las claves; cualquier otro valor («true», 1, {}, "yes") no cuenta como sí', async () => {
  const { db, sync } = await mk();
  await seed(db);
  for (const v of ['true', 1, {}, 'yes', [], null, undefined, 0, false]) {
    const r = await sync.exportBackup({ includeSecrets: v });
    assert.equal(r.includesSecrets, false, String(v));
    assert.ok(!r.json.includes(SECRET_A), String(v));
  }
  const con = await sync.exportBackup({ includeSecrets: true });
  assert.equal(con.includesSecrets, true);
  for (const s of [SECRET_A, SECRET_B]) assert.ok(con.json.includes(s));
  assert.ok(!(await sync.exportBackup()).json.includes(SECRET_B));
});

test('CA 4: aunque el motor entregue las claves por error, el respaldo por defecto las quita (defensa doble)', async () => {
  const { db } = await mk();
  await seed(db);
  const torpe = { ...db, exportAll: (opts) => db.exportAll({ ...opts, includeSecrets: true }) };
  const sync = createSync({ db: torpe, clock: makeClock(NOW) });
  const r = await sync.exportBackup();
  assert.ok(!r.json.includes(SECRET_A) && !r.json.includes(SECRET_B));
  assert.equal(r.includesSecrets, false);
});

test('CA 4: restaurar un respaldo sin claves no borra las del dispositivo, y uno con claves las trae solo si se pide', async () => {
  const a = await mk();
  await seed(a.db);
  const sin = (await a.sync.exportBackup()).json;
  const con = (await a.sync.exportBackup({ includeSecrets: true })).json;
  const b = await mk();
  await b.db.put('settings', { key: 'aiKey', value: 'clave-local-de-prueba', secret: true });
  await b.sync.importBackup(sin);
  assert.equal((await b.db.get('settings', 'aiKey')).value, 'clave-local-de-prueba');
  const pv = await b.sync.previewBackup(con, { mode: 'replace', keepSecrets: true });
  assert.equal(pv.hasSecrets, true);
  assert.equal((await b.sync.previewBackup(sin)).hasSecrets, false);
  const c = await mk();
  await c.sync.importBackup(con, { keepSecrets: false });
  assert.equal((await c.db.get('settings', 'aiKey')).value, SECRET_A);
});

test('CA 4: ni la bitácora, ni el bloque «llevar al chat», ni el de estado pueden llevar una clave de la base', async () => {
  const { db, sync } = await mk();
  await seed(db);
  const textos = [await sync.buildLog(), await sync.makeLogBlock(), sync.makeChatBlock('estado', { dia: '2026-10-25', areas: [{ area: 'gram', pct: 10 }] }), sync.makeChatBlock('llevar_al_chat', { tema: 'gram.x', mensaje: 'duda' })];
  for (const t of textos) for (const s of [SECRET_A, SECRET_B]) assert.ok(!t.includes(s));
});
