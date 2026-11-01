// @purpose: Pruebas de entradas hostiles de la 1.12-T4 sobre todo el puente: respaldo, bloques del chat, importación de errores y bitácora (__proto__, tamaños enormes, JSON roto).
// Entradas hostiles (subparte 1.12-T4, CA 3 de 1.12). Cada prueba exige tres cosas: respuesta clara en español (nunca un error crudo), la base intacta y Object.prototype sin tocar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createSync, MAX_BACKUP_CHARS, MAX_BACKUP_DEPTH } from '../core/sync.js';
import { parseChatBlock, makeChatBlock, scanValue, LIMITS } from '../core/syncChat.js';
import { buildLogText, LOG_LIMITS } from '../core/syncLog.js';
import { createMemoryDb } from '../core/db.memory.js';
import { createErrors } from '../core/errors.js';
import { createErrorCatalog } from '../core/errorCatalog.js';
import { DbError, EXPORT_FORMAT } from '../core/db.js';
import { makeClock } from './_helpers.mjs';

const NOW = '2026-10-25T12:00:00.000Z';
const CATALOG = createErrorCatalog(JSON.parse(fs.readFileSync(new URL('../content/taxonomy/error_codes.json', import.meta.url), 'utf8')));
const PROTO_BEFORE = Object.getOwnPropertyNames(Object.prototype).sort().join(',');

async function mk() {
  const db = createMemoryDb();
  await db.open();
  const clock = makeClock(NOW);
  const errors = createErrors({ db, catalog: CATALOG, clock });
  const sync = createSync({ db, clock, errors, catalog: CATALOG, topics: [{ id: 'gram.modals.no_to', status: 'draft' }] });
  return { db, sync };
}
const snap = async (db) => JSON.stringify((await db.exportAll({ includeSecrets: true })).stores);
const backup = (stores, extra = {}) => JSON.stringify({ format: EXPORT_FORMAT, schemaVersion: 1, exportedAt: NOW, stores, ...extra });
const wrap = (head, body) => `=== SOPHIA-EN-SYNC v1 ===\n${head}\n${body}\n=== FIN ===`;
const errBlock = (p, gen = NOW) => wrap(`tipo: errores\ngenerado: ${gen}`, JSON.stringify(p));
const E1 = { original: "I didn't can to send it", code: 'VRB.CAN_TO' };
const nested = (n) => `${'['.repeat(n)}${']'.repeat(n)}`;
// `friendly` es el texto amable fijo del código; `message` dice el motivo concreto (en español).
const isBadImport = (e) => e instanceof DbError && e.code === 'BAD_IMPORT' && typeof e.friendly === 'string' && e.friendly.length > 10 && /[a-záéíóúñ]{4,}/i.test(e.message);

// Tras cada prueba el prototipo de los objetos debe seguir igual (ninguna entrada hostil lo contamina).
test.afterEach(() => {
  assert.equal(Object.getOwnPropertyNames(Object.prototype).sort().join(','), PROTO_BEFORE);
  assert.equal(({}).polluted, undefined);
});

// ---------- respaldo ----------
test('respaldo: __proto__, constructor y prototype en cualquier nivel se rechazan (vista previa e importación) sin tocar la base', async () => {
  const { db, sync } = await mk();
  await db.put('notes', { id: 'n0', text: 'intacta' });
  const before = await snap(db);
  const casos = [
    `{"format":"${EXPORT_FORMAT}","schemaVersion":1,"__proto__":{"polluted":1},"stores":{}}`,
    `{"format":"${EXPORT_FORMAT}","schemaVersion":1,"stores":{"__proto__":[{"id":"a"}]}}`,
    `{"format":"${EXPORT_FORMAT}","schemaVersion":1,"stores":{"constructor":[{"id":"a"}]}}`,
    `{"format":"${EXPORT_FORMAT}","schemaVersion":1,"stores":{"notes":[{"id":"n1","__proto__":{"polluted":2}}]}}`,
    `{"format":"${EXPORT_FORMAT}","schemaVersion":1,"stores":{"notes":[{"id":"n1","x":{"y":[{"constructor":{"prototype":{"polluted":3}}}]}}]}}`,
    `{"format":"${EXPORT_FORMAT}","schemaVersion":1,"stores":{"notes":[{"id":"n1","prototype":1}]}}`,
  ];
  for (const text of casos) {
    await assert.rejects(() => sync.previewBackup(text), isBadImport, text);
    await assert.rejects(() => sync.importBackup(text, { mode: 'merge' }), isBadImport, text);
    await assert.rejects(() => sync.importBackup(text), isBadImport, text);
  }
  assert.equal(await snap(db), before);
});

test('respaldo: la profundidad tiene tope exacto (MAX_BACKUP_DEPTH) y lo más hondo se rechaza sin desbordar la pila', async () => {
  const { db, sync } = await mk();
  const before = await snap(db);
  // raíz (1) → stores (2) → lista (3) → registro (4) → k listas anidadas: la más honda queda a profundidad 4 + k
  const ok = backup({ notes: [{ id: 'n1', v: JSON.parse(nested(MAX_BACKUP_DEPTH - 4)) }] });
  const hondo = backup({ notes: [{ id: 'n1', v: JSON.parse(nested(MAX_BACKUP_DEPTH - 3)) }] });
  const pv = await sync.previewBackup(ok);
  assert.equal(pv.totals.added, 1);
  await assert.rejects(() => sync.previewBackup(hondo), (e) => isBadImport(e) && /niveles de anidación/.test(e.message));
  await assert.rejects(() => sync.importBackup(hondo), isBadImport);
  assert.equal(await snap(db), before);
  for (const n of [5000, 20_000, 100_000]) {
    const texto = `{"format":"${EXPORT_FORMAT}","schemaVersion":1,"stores":{"notes":[{"id":"d","v":${nested(n)}}]}}`;
    await assert.rejects(() => sync.previewBackup(texto), isBadImport, `profundidad ${n}`);
    await assert.rejects(() => sync.importBackup(texto), isBadImport, `profundidad ${n}`);
  }
  await sync.importBackup(ok, { mode: 'merge' });
  assert.equal((await db.query('notes')).length, 1);
});

test('respaldo: un millón de corchetes abiertos o cerrados, sin pila ni cuelgue, da «no es un JSON válido» o «demasiados niveles»', async () => {
  const { db, sync } = await mk();
  const before = await snap(db);
  const t0 = Date.now();
  for (const texto of ['['.repeat(1_000_000), '{"a":'.repeat(200_000), `${'['.repeat(500_000)}${']'.repeat(500_000)}`]) {
    await assert.rejects(() => sync.previewBackup(texto), isBadImport);
    await assert.rejects(() => sync.importBackup(texto), isBadImport);
  }
  assert.ok(Date.now() - t0 < 5000, `tardó ${Date.now() - t0} ms`);
  assert.equal(await snap(db), before);
});

test('respaldo: números infinitos (1e999) se rechazan: al exportar se volverían null', async () => {
  const { db, sync } = await mk();
  const texto = `{"format":"${EXPORT_FORMAT}","schemaVersion":1,"stores":{"notes":[{"id":"n","v":1e999}]}}`;
  await assert.rejects(() => sync.previewBackup(texto), (e) => isBadImport(e) && /fuera de rango/.test(e.message));
  await assert.rejects(() => sync.importBackup(texto), isBadImport);
  assert.equal((await db.query('notes')).length, 0);
});

test('respaldo: JSON malformado y formas imposibles dan BAD_IMPORT en español, nunca un error crudo', async () => {
  const { db, sync } = await mk();
  const before = await snap(db);
  const casos = [
    '{"format":"glossa-db","sche', '{"format":"glossa-db",}', "{'format':'glossa-db'}", '[]', 'null', '"x"', '42', 'true', '{}', 'undefined', '\u0000', '{"a":1}{"b":2}',
    backup({ notes: { id: 'a' } }), backup({ notes: [null] }), backup({ notes: ['x'] }), backup({ notes: [[1]] }), backup({ notes: [{ text: 'sin clave' }] }),
    backup({ notes: [{ id: 5 }] }), backup({ notes: [{ id: 'a' }, { id: 'a' }] }), backup({ inventada: [{ id: 'a' }] }), backup([]), backup(null),
    JSON.stringify({ format: EXPORT_FORMAT, schemaVersion: '1', stores: {} }), JSON.stringify({ format: EXPORT_FORMAT, schemaVersion: 1.5, stores: {} }),
    JSON.stringify({ format: 'otra-cosa', schemaVersion: 1, stores: {} }), JSON.stringify({ schemaVersion: 1, stores: {} }),
  ];
  for (const texto of casos) {
    await assert.rejects(() => sync.previewBackup(texto), isBadImport, texto.slice(0, 60));
    await assert.rejects(() => sync.importBackup(texto), isBadImport, texto.slice(0, 60));
  }
  for (const noTexto of [undefined, null, 5, {}, [], () => 1]) {
    await assert.rejects(() => sync.previewBackup(noTexto), isBadImport);
    await assert.rejects(() => sync.importBackup(noTexto), isBadImport);
  }
  assert.equal(await snap(db), before);
});

test('respaldo: demasiado grande se rechaza por tamaño antes de leerlo; un texto enorme pero válido de un solo campo sí cabe', async () => {
  const { db, sync } = await mk();
  const enorme = 'x'.repeat(MAX_BACKUP_CHARS + 1);
  await assert.rejects(() => sync.previewBackup(enorme), (e) => isBadImport(e) && /demasiado grande/.test(e.message));
  await assert.rejects(() => sync.importBackup(enorme), isBadImport);
  const grande = backup({ notes: [{ id: 'big', text: 'x'.repeat(5_000_000) }] });
  await sync.importBackup(grande, { mode: 'merge' });
  assert.equal((await db.query('notes'))[0].text.length, 5_000_000);
});

// Topes con el número escrito a mano: si alguien cambia la constante sin querer, esta prueba lo nota (con la constante importada, prueba y código se moverían juntos).
test('respaldo: los topes son exactamente 100 niveles y 50.000.000 caracteres', async () => {
  const { db, sync } = await mk();
  assert.equal(MAX_BACKUP_DEPTH, 100);
  assert.equal(MAX_BACKUP_CHARS, 50_000_000);
  const conNiveles = (k) => `{"format":"${EXPORT_FORMAT}","schemaVersion":1,"stores":{"notes":[{"id":"n1","v":${nested(k)}}]}}`;
  assert.equal((await sync.previewBackup(conNiveles(96))).totals.added, 1); // la lista más honda queda a profundidad 100
  await assert.rejects(() => sync.previewBackup(conNiveles(97)), (e) => isBadImport(e) && /niveles/.test(e.message));
  const base = backup({ notes: [{ id: 'n1', text: 'a' }] });
  const justo = base + ' '.repeat(50_000_000 - base.length);
  assert.equal(justo.length, 50_000_000);
  assert.equal((await sync.previewBackup(justo)).totals.added, 1);
  await assert.rejects(() => sync.previewBackup(`${justo} `), (e) => isBadImport(e) && /demasiado grande/.test(e.message));
  await assert.rejects(() => sync.importBackup(`${justo} `), isBadImport);
  assert.equal((await db.query('notes')).length, 0);
});

// ---------- bloques del chat ----------
test('bloque: una línea de cabecera gigante no cuelga el lector (antes, 140.000 caracteres tardaban más de un minuto)', () => {
  const casi = LIMITS.maxTextChars - 200;
  const lineas = {
    tipo: `tipo: bitacora${' _'.repeat(casi / 2)}x`,
    generado: `tipo: bitacora\ngenerado: 2026-10-25${' *'.repeat(casi / 2)}x`,
    tipoEspacios: `tipo:${' '.repeat(casi)}x`,
    adornos: `${'*_`> '.repeat(casi / 4)}tipo: bitacora`,
    nombre: `tipo${'*'.repeat(casi)}x`,
    inicio: `${'='.repeat(casi)}`,
    inicioEspacios: `=== SOPHIA-EN-SYNC v1 ${' '.repeat(casi)}x`,
    fin: `=== FIN ${'='.repeat(casi)}x`,
    valla: `\`\`\`${'a'.repeat(casi)}!`,
  };
  for (const [nombre, linea] of Object.entries(lineas)) {
    const texto = nombre === 'inicio' || nombre === 'inicioEspacios' ? linea : wrap(linea, '{"texto":"a"}');
    const t0 = Date.now();
    const r = parseChatBlock(texto);
    const ms = Date.now() - t0;
    assert.ok(ms < 1500, `${nombre}: ${ms} ms`);
    assert.equal(typeof r.ok, 'boolean', nombre);
    if (!r.ok) assert.equal(typeof r.error.message, 'string');
  }
});

test('bloque: la cabecera se sigue leyendo igual con adornos, mayúsculas y espacios (el lector nuevo da lo mismo que el anterior)', () => {
  const cuerpo = '{"texto":"hola"}';
  const variantes = ['tipo: bitacora', 'TIPO:bitacora', '  **tipo**: `bitacora`  ', '> _tipo_ :   BITACORA  ', '\u00a0tipo\u00a0:\u00a0bitacora', '`tipo`: *bitacora*'];
  for (const cabecera of variantes) {
    const r = parseChatBlock(wrap(`${cabecera}\ngenerado: ${NOW}`, cuerpo));
    assert.equal(r.ok, true, cabecera);
    assert.equal(r.kind, 'bitacora');
    assert.equal(r.generatedAt, NOW);
  }
  for (const [cabecera, code] of [['tipo bitacora', 'BAD_KIND'], ['tipos: bitacora', 'BAD_KIND'], ['tipo:', 'BAD_KIND'], ['tipo: ***', 'BAD_KIND'], ['tipo ?bitacora', 'BAD_KIND'], ['tipo - bitacora', 'BAD_KIND'], ['tipo: bitacora>', 'BAD_KIND'], ['tipo: bitacora\ngenerado:', 'BAD_DATE'], ['tipo: bitacora\ngenerado: ayer', 'BAD_DATE']]) {
    const r = parseChatBlock(wrap(cabecera, cuerpo));
    assert.equal(r.ok, false, cabecera);
    assert.equal(r.error.code, code, cabecera);
  }
});

test('bloque: límites de tamaño exactos (nodos, profundidad, errores, temas, textos) y un caso más allá de cada uno', () => {
  const code = (r) => (r.ok ? 'OK' : r.error.code);
  const bit = (obj) => parseChatBlock(wrap('tipo: bitacora', JSON.stringify(obj)));
  assert.equal(code(bit({ texto: 'a', x: new Array(LIMITS.maxNodes - 3).fill(0) })), 'BAD_PAYLOAD'); // en el tope de nodos pasa el filtro hostil y lo para el esquema
  assert.equal(code(bit({ texto: 'a', x: new Array(LIMITS.maxNodes).fill(0) })), 'HOSTILE');
  assert.equal(code(parseChatBlock(wrap('tipo: bitacora', `{"texto":"a","x":${nested(LIMITS.maxDepth - 2)}}`))), 'BAD_PAYLOAD');
  assert.equal(code(parseChatBlock(wrap('tipo: bitacora', `{"texto":"a","x":${nested(LIMITS.maxDepth)}}`))), 'HOSTILE');
  assert.equal(code(bit({ texto: 'x'.repeat(LIMITS.maxLong) })), 'OK');
  assert.equal(code(bit({ texto: 'x'.repeat(LIMITS.maxLong + 1) })), 'BAD_PAYLOAD');
  const errs = (n) => Array.from({ length: n }, (_, i) => ({ original: `I am agree ${i}`, code: 'SUBJ.OMIT' }));
  assert.equal(code(parseChatBlock(errBlock({ errores: errs(LIMITS.maxErrors) }))), 'OK');
  assert.equal(code(parseChatBlock(errBlock({ errores: errs(LIMITS.maxErrors + 1) }))), 'BAD_PAYLOAD');
  assert.equal(code(parseChatBlock(errBlock({ errores: [{ original: 'x'.repeat(LIMITS.maxOriginal + 1), code: 'SUBJ.OMIT' }] }))), 'BAD_PAYLOAD');
  const temas = (n) => Array.from({ length: n }, (_, i) => ({ id: `gram.t${i}`, estado: 'ready' }));
  assert.equal(code(parseChatBlock(errBlock({ errores: errs(1), temas: temas(LIMITS.maxTopics) }))), 'OK');
  assert.equal(code(parseChatBlock(errBlock({ errores: errs(1), temas: temas(LIMITS.maxTopics + 1) }))), 'BAD_PAYLOAD');
  assert.equal(code(parseChatBlock(`${wrap('tipo: bitacora', '{"texto":"a"}')}${' '.repeat(LIMITS.maxTextChars)}`)), 'TOO_BIG');
});

test('bloque: JSON malformado, cortado o con comillas rotas da un mensaje claro y nunca lanza', () => {
  const casos = [
    ['tipo: bitacora', '{"texto":"a"'], ['tipo: bitacora', '{"texto":"a",}'], ['tipo: bitacora', "{'texto':'a'}"], ['tipo: bitacora', '{texto:"a"}'],
    ['tipo: bitacora', '{"texto":"a" "b":1}'], ['tipo: bitacora', '{"texto":"\\u00zz"}'], ['tipo: bitacora', '{"texto":"a\nb"}'], ['tipo: bitacora', '{"texto":NaN}'],
    ['tipo: bitacora', '}{'], ['tipo: bitacora', 'nada de JSON'], ['tipo: bitacora', ''], ['tipo: errores', '{"errores":[{"original":"a","code":"X"'],
  ];
  for (const [head, body] of casos) {
    const r = parseChatBlock(wrap(head, body));
    assert.equal(r.ok, false, body);
    assert.ok(['NO_JSON', 'BAD_JSON'].includes(r.error.code), `${body} → ${r.error.code}`);
    assert.match(r.error.message, /[a-záéíóúñ]{4,}/i);
  }
});

test('bloque: cualquier cosa que no sea texto, o texto raro, da respuesta {ok:false} sin lanzar', () => {
  for (const x of [undefined, null, 0, 5, NaN, {}, [], () => 1, true, Symbol('x'), 10n, new Date()]) {
    const r = parseChatBlock(x);
    assert.equal(r.ok, false);
    assert.equal(r.error.code, 'NO_TEXT');
  }
  for (const texto of ['\u0000', '\ud800', '\u202e=== SOPHIA-EN-SYNC v1 ===', '=== FIN ===', '=== SOPHIA-EN-SYNC v1 ===', `${'=== SOPHIA-EN-SYNC v1 ===\n'.repeat(5000)}=== FIN ===`, '\n'.repeat(100_000)]) {
    const r = parseChatBlock(texto);
    assert.equal(typeof r.ok, 'boolean');
    if (!r.ok) assert.equal(typeof r.error.code, 'string');
  }
});

test('bloque: muchos bloques en el mismo texto se leen en tiempo razonable y solo cuenta el primero', () => {
  const uno = wrap('tipo: bitacora', '{"texto":"a"}');
  const t0 = Date.now();
  const r = parseChatBlock(Array.from({ length: 3000 }, () => uno).join('\n'));
  assert.ok(Date.now() - t0 < 1500);
  assert.equal(r.ok, true);
  assert.equal(r.others, 2999);
});

test('bloque: scanValue cuenta bien sin recursión (un millón de niveles no desborda la pila)', () => {
  assert.equal(scanValue(JSON.parse('{"a":[1,{"b":null}]}')), null);
  assert.match(scanValue(JSON.parse(`{"a":${nested(2000)}}`)), /niveles/);
  assert.match(scanValue(JSON.parse('[1e999]')), /fuera de rango/);
  assert.match(scanValue(JSON.parse('{"x":{"__proto__":1}}')), /prohibido/);
  assert.equal(scanValue(JSON.parse(`{"a":${nested(50)}}`), { maxDepth: 60 }), null);
  assert.match(scanValue(new Array(10).fill(0), { maxNodes: 5 }), /demasiados elementos/);
  assert.equal(scanValue(new Array(100_000).fill(0), { maxNodes: Infinity }), null);
});

// ---------- importación de errores del chat ----------
test('importar errores: códigos, temas e ids con nombres de Object.prototype se tratan como texto o se omiten, sin lanzar ni contaminar', async () => {
  const { db, sync } = await mk();
  const r = await sync.importChatErrors(errBlock({
    errores: [
      { original: 'a b', code: '__proto__' },
      { original: 'a b', code: 'constructor' },
      { original: 'a b', code: 'toString' },
      { original: 'x y', code: 'VRB.CAN_TO', topics: ['__proto__', 'constructor'] },
      { original: 'x y z', code: 'VRB.CAN_TO', itemId: '__proto__' },
      { original: 'x y w', code: 'VRB.CAN_TO', itemId: 'constructor' },
    ],
    temas: [{ id: '__proto__', estado: 'active' }, { id: 'constructor', estado: 'nope' }, { id: 'toString', estado: 'draft' }],
  }));
  assert.equal(r.ok, true);
  assert.deepEqual(r.items.map((i) => i.status), ['invalid', 'invalid', 'invalid', 'invalid', 'new', 'new']);
  assert.equal(r.applied, 2);
  assert.deepEqual(r.topicAdjustments.map((t) => t.status), ['unknown_topic', 'bad_status', 'unknown_topic']);
  const rows = await db.query('errors', {});
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((x) => x.itemId).sort(), ['__proto__', 'constructor']);
  const otra = await sync.importChatErrors(errBlock({ errores: [{ original: 'x y z', code: 'VRB.CAN_TO', itemId: '__proto__' }] }));
  assert.equal(otra.totals.replay, 1);
  assert.equal((await db.query('errors', {})).length, 2);
});

test('importar errores: textos con caracteres de control o de dirección se omiten uno a uno y lo bueno entra; uno vacío rechaza todo el bloque', async () => {
  const { db, sync } = await mk();
  const r = await sync.importChatErrors(errBlock({
    errores: [{ original: 'a\u0000b', code: 'VRB.CAN_TO' }, { original: '\u202e', code: 'VRB.CAN_TO' }, { original: '\ud800 solo', code: 'VRB.CAN_TO' }, E1],
  }));
  assert.equal(r.ok, true);
  assert.equal(r.items[0].status, 'invalid');
  assert.equal(r.items[3].status, 'new');
  assert.equal(r.applied, r.totals.new + r.totals.repeat);
  assert.ok(r.totals.invalid >= 1);
  const rows = await db.query('errors', {});
  assert.equal(rows.length, r.applied);
  assert.ok(rows.every((x) => !/[\u0000-\u001f]/.test(x.original)));
  const vacio = await sync.importChatErrors(errBlock({ errores: [{ original: '   ', code: 'VRB.CAN_TO' }, E1] }));
  assert.equal(vacio.ok, false);
  assert.equal(vacio.error.code, 'BAD_PAYLOAD');
  assert.equal((await db.query('errors', {})).length, rows.length);
});

test('importar errores: fechas hostiles del bloque (lejanas, futuras, imposibles) no lanzan y no escriben nada raro', async () => {
  const { db, sync } = await mk();
  const e = { errores: [{ original: 'I am agree', code: 'SUBJ.OMIT' }] };
  for (const gen of ['+275760-09-13T00:00:00.000Z', '2999-01-01', '-000001-01-01T00:00:00Z']) {
    const r = await sync.importChatErrors(errBlock(e, gen));
    assert.equal(r.ok, true, gen);
    assert.equal(r.items[0].status, 'invalid', gen);
    assert.equal(r.applied, 0);
  }
  for (const gen of ['2026-13-45', 'mañana', '']) {
    const r = await sync.importChatErrors(errBlock(e, gen));
    assert.equal(r.ok, false, gen);
    assert.equal(r.error.code, 'BAD_DATE');
  }
  assert.equal((await db.query('errors', {})).length, 0);
});

test('importar errores: un bloque de otro tipo, uno hostil o uno roto no escribe nada y dice por qué', async () => {
  const { db, sync } = await mk();
  const before = await snap(db);
  const malos = [
    [wrap('tipo: bitacora', '{"texto":"a"}'), 'WRONG_KIND'],
    [errBlock({ errores: [E1] }).replace('"original"', '"__proto__"'), 'HOSTILE'],
    [errBlock({ errores: [E1], extra: 1 }), 'BAD_PAYLOAD'],
    [errBlock({ errores: [] }), 'BAD_PAYLOAD'],
    [errBlock({ errores: 'x' }), 'BAD_PAYLOAD'],
    [errBlock({ errores: [E1] }).replace('=== FIN ===', ''), 'NO_END'],
    [`${'x'.repeat(LIMITS.maxTextChars + 1)}`, 'TOO_BIG'],
    ['', 'NO_TEXT'],
  ];
  for (const [texto, code] of malos) {
    for (const f of [sync.previewChatErrors, sync.importChatErrors]) {
      const r = await f(texto);
      assert.equal(r.ok, false, code);
      assert.equal(r.error.code, code);
      assert.match(r.error.message, /[a-záéíóúñ]{4,}/i);
    }
  }
  assert.equal(await snap(db), before);
});

test('importar errores: 200 errores (el máximo) entran, repetirlos no cambia nada y la vista previa coincide', async () => {
  const { db, sync } = await mk();
  const errores = Array.from({ length: LIMITS.maxErrors }, (_, i) => ({ original: `I am agree number ${i}`, code: 'SUBJ.OMIT' }));
  const texto = errBlock({ errores });
  const pv = await sync.previewChatErrors(texto);
  assert.equal(pv.totals.new, LIMITS.maxErrors);
  const t0 = Date.now();
  const r = await sync.importChatErrors(texto);
  assert.ok(Date.now() - t0 < 5000);
  assert.equal(r.applied, LIMITS.maxErrors);
  const after = await snap(db);
  const again = await sync.importChatErrors(texto);
  assert.equal(again.totals.replay, LIMITS.maxErrors);
  assert.equal(await snap(db), after);
});

// ---------- bitácora ----------
test('bitácora: nombres de Object.prototype como área o impacto no imprimen código de función', () => {
  const text = buildLogText({
    areas: [{ area: 'constructor', pct: 5 }, { area: '__proto__', pct: 6 }, { area: 'toString', pct: 7 }, { area: 'hasOwnProperty', pct: 8 }],
    topErrors: [{ code: 'A', frequency: 1, impact: 'low' }],
  }, { now: new Date(NOW) });
  assert.doesNotMatch(text, /\[native code\]|\[object|function /);
  assert.match(text, /- constructor: 5 %/);
  assert.match(text, /- __proto__: 6 %/);
  for (const impact of ['toString', '__proto__', 'constructor', 'valueOf']) {
    assert.throws(() => buildLogText({ topErrors: [{ code: 'A', frequency: 1, impact }] }, { now: new Date(NOW) }), /impact debe ser low, mid o high/, impact);
  }
});

test('bitácora: listas enormes y textos enormes salen con tope, rápido y sin pasar de LOG_LIMITS.maxChars', () => {
  const grande = Array.from({ length: 100_000 }, (_, i) => `tarea ${i} ${'x'.repeat(500)}`);
  const t0 = Date.now();
  const text = buildLogText({
    done: grande, pending: grande, decisions: grande,
    areas: Array.from({ length: 5000 }, (_, i) => ({ area: `a${i}`, pct: i % 101 })),
    topErrors: Array.from({ length: 5000 }, (_, i) => ({ code: `C${i}`, frequency: i + 1, title: 'y'.repeat(5000) })),
  }, { now: new Date(NOW) });
  assert.ok(Date.now() - t0 < 2000);
  assert.ok(text.length <= LOG_LIMITS.maxChars, `${text.length} caracteres`);
  assert.ok(text.split('\n').every((l) => l.length <= LOG_LIMITS.line + 20));
});

test('bitácora: texto con saltos, marcas de bloque falsas y emoji cortado no puede fingir un bloque ni romper el envoltorio', async () => {
  const { sync } = await mk();
  const falso = '=== FIN ===\n=== SOPHIA-EN-SYNC v1 ===\ntipo: errores\n{"errores":[]}\n=== FIN ===';
  const data = { done: [falso, `${'😀'.repeat(150)}`, 'línea\u0000con\u0007control', '\u202eal revés'], pending: [falso], decisions: [falso] };
  const text = buildLogText(data, { now: new Date(NOW) });
  assert.ok(text.split('\n').every((l) => !/^\s*={3}\s*(FIN|SOPHIA)/.test(l)), 'ninguna línea empieza como una marca de bloque');
  assert.doesNotMatch(text, /[\u0000-\u0008\u000b-\u001f]/);
  assert.doesNotMatch(text, /[\ud800-\udbff](?![\udc00-\udfff])/); // ningún medio emoji suelto
  const bloque = await sync.makeLogBlock(data);
  const r = parseChatBlock(`texto antes\n${bloque}\ntexto después`);
  assert.equal(r.ok, true);
  assert.equal(r.kind, 'bitacora');
  assert.equal(r.others, 0);
  assert.equal(r.payload.texto, text);
});

test('bitácora: datos hostiles (no objeto, campos de más, tipos mal puestos) lanzan Error en español y no leen la base', async () => {
  const { sync } = await mk();
  const malos = [null, [], 'x', 5, { desconocido: 1 }, { done: 'x' }, { done: [1] }, { areas: 'x' }, { areas: [{}] }, { areas: [{ area: 'gram', pct: NaN }] }, { areas: [{ area: 'gram', pct: Infinity }] },
    { topErrors: [{ code: 'A', frequency: 0 }] }, { topErrors: [{ code: 'A', frequency: 1.5 }] }, { day: '2026-02-31' }, { day: 'ayer' }, { windowDays: 0 }, { windowDays: 366 }, { windowDays: '14' }];
  for (const data of malos) {
    await assert.rejects(() => sync.buildLog(data), (e) => e instanceof Error && !(e instanceof DbError) && /buildLog|buildLogText/.test(e.message), JSON.stringify(data));
  }
  const raro = JSON.parse('{"__proto__":{"done":["x"]}}');
  await assert.rejects(() => sync.buildLog(raro), /campo desconocido/);
});

test('bloque de salida: lo que arma la app nunca trae claves ni se deja contaminar por lo que se le pide', async () => {
  const { db, sync } = await mk();
  await db.put('settings', { key: 'aiKey', value: 'clave-de-prueba-123', secret: true });
  const bloque = await sync.makeLogBlock({ done: ['clave-de-prueba-123 no debe salir de aquí? es texto de quien llama'] });
  assert.equal(parseChatBlock(bloque).ok, true);
  const { json } = await sync.exportBackup();
  assert.doesNotMatch(json, /clave-de-prueba-123/);
  for (const [kind, payload] of [['bitacora', { texto: 'a', __proto__x: 1 }], ['llevar_al_chat', { tema: 'a', extra: 1 }], ['errores', { errores: [E1], x: 1 }], ['estado', { areas: [{ area: 'gram', pct: 5, y: 1 }] }]]) {
    assert.throws(() => makeChatBlock(kind, payload), (e) => e.name === 'ChatBlockError' && e.code === 'BAD_PAYLOAD', kind);
  }
});
