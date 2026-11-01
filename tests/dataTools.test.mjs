// @purpose: Pruebas del respaldo (core/sync.js) y de las herramientas de datos de Ajustes (app/dataTools.js) con base en memoria.
// Pruebas de core/sync.js y app/dataTools.js (subparte 0.8, cuarto 3A) con base en memoria.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryDb, createMemoryDisk } from '../core/db.memory.js';
import { createSettings } from '../core/settings.js';
import { createSync, backupFilename, MAX_BACKUP_CHARS } from '../core/sync.js';
import { createDataTools } from '../app/dataTools.js';
import { DbError } from '../core/dbErrors.js';

const SECRET = ['gsk', '_', 'PRUEBA', '7777700000'].join('');

async function mk() {
  const disk = createMemoryDisk();
  const db = await openDb(disk);
  const settings = createSettings({ db });
  await settings.load();
  return { disk, db, settings, sync: createSync({ db, clock: { now: () => new Date(2026, 9, 17, 12) } }), tools: createDataTools({ db, settings }) };
}
async function openDb(disk) { const db = createMemoryDb({ disk }); await db.open(); return db; }
const card = (id) => ({ id, itemId: 'i1', due: '2026-10-18T00:00:00.000Z', topics: ['t1'], state: 1 });

test('backupFilename usa el día local', () => {
  assert.equal(backupFilename(new Date(2026, 0, 5, 23, 59)), 'glossa-respaldo-2026-01-05.json');
});

test('exportBackup: sin includeSecrets el texto no contiene la clave; con includeSecrets sí', async () => {
  const t = await mk();
  await t.settings.set('aiKey', SECRET);
  await t.settings.set('theme', 'neo');
  await t.db.put('cards', card('c1'));
  const plain = await t.sync.exportBackup();
  assert.equal(plain.json.includes(SECRET), false);
  assert.equal(plain.filename, 'glossa-respaldo-2026-10-17.json');
  assert.equal(plain.counts.cards, 1);
  assert.equal(plain.json.includes('"neo"'), true);
  const full = await t.sync.exportBackup({ includeSecrets: true });
  assert.equal(full.json.includes(SECRET), true);
  assert.equal((await t.sync.exportBackup({ includeSecrets: 'si' })).json.includes(SECRET), false); // solo true exacto
});

test('ida y vuelta: exportar, borrar todo e importar devuelve los datos', async () => {
  const t = await mk();
  await t.settings.set('theme', 'claro');
  await t.db.put('cards', card('c1')); await t.db.put('cards', card('c2'));
  const { json } = await t.sync.exportBackup();
  await t.tools.wipeAll();
  assert.equal(await t.db.count('cards'), 0);
  const res = await t.sync.importBackup(json);
  assert.equal(res.stores.cards, 2);
  assert.ok(res.total >= 3);
  await t.tools.afterRestore();
  assert.equal(await t.db.count('cards'), 2);
  assert.equal(t.settings.get('theme'), 'claro');
});

test('importar conserva la clave de este dispositivo por defecto', async () => {
  const t = await mk();
  const { json } = await t.sync.exportBackup();
  await t.settings.set('aiKey', SECRET);
  await t.sync.importBackup(json);
  await t.tools.afterRestore();
  assert.equal(t.settings.hasSecret('aiKey'), true);
  await t.sync.importBackup(json, { keepSecrets: false });
  await t.tools.afterRestore();
  assert.equal(t.settings.hasSecret('aiKey'), false);
});

test('importar un archivo inválido falla con BAD_IMPORT y no cambia nada', async () => {
  const t = await mk();
  await t.db.put('cards', card('c1'));
  for (const bad of ['', '   ', 'no es json', '[]', '{"format":"otro"}', JSON.stringify({ format: 'sophia-ingles-db', schemaVersion: 1, stores: { cards: 'x' } }), null, 42]) {
    await assert.rejects(() => t.sync.importBackup(bad), (e) => e instanceof DbError && e.code === 'BAD_IMPORT' && typeof e.friendly === 'string');
  }
  await assert.rejects(() => t.sync.importBackup('x'.repeat(MAX_BACKUP_CHARS + 1)), (e) => e.code === 'BAD_IMPORT');
  // Un respaldo válido pero demasiado grande (relleno de espacios) solo lo frena el tope de tamaño.
  const valid = (await t.sync.exportBackup()).json;
  await assert.rejects(() => t.sync.importBackup(valid + ' '.repeat(MAX_BACKUP_CHARS)), (e) => e.code === 'BAD_IMPORT' && /grande/.test(e.message));
  await t.sync.importBackup(valid);
  assert.equal(await t.db.count('cards'), 1);
});

test('importar un respaldo de una versión más nueva falla con NEWER_VERSION', async () => {
  const t = await mk();
  const text = JSON.stringify({ format: 'sophia-ingles-db', schemaVersion: 99, exportedAt: 'x', stores: {} });
  await assert.rejects(() => t.sync.importBackup(text), (e) => e.code === 'NEWER_VERSION');
});

test('RESPALDO VIEJO (0.9.3, cambio de nombre a Glossa): un archivo de la app llamada Sophia Inglés se importa igual; el nuevo lleva el formato glossa-db', async () => {
  const t = await mk();
  // Archivo escrito a mano como lo generaba la 0.9.2: formato antiguo, nombre de archivo antiguo, tema 'auto' (ya no existe).
  const legacy = JSON.stringify({
    format: 'sophia-ingles-db', schemaVersion: 1, exportedAt: '2026-10-17T12:00:00.000Z',
    stores: { cards: [card('viejo')], settings: [{ key: 'theme', value: 'auto' }, { key: 'userName', value: 'William' }] },
  });
  const r = await t.sync.importBackup(legacy);
  await t.tools.afterRestore();
  assert.equal(await t.db.count('cards'), 1);
  assert.ok(r.total >= 3);
  assert.equal(t.settings.get('userName'), 'William', 'los ajustes del respaldo viejo se conservan');
  assert.equal(t.settings.get('theme'), 'aurora', "el tema 'auto' del respaldo viejo pasa a Aurora");
  const out = JSON.parse((await t.sync.exportBackup()).json);
  assert.equal(out.format, 'glossa-db', 'el respaldo nuevo usa el nombre nuevo');
  await t.sync.importBackup(JSON.stringify(out)); // y el nuevo también se importa
});

test('sin base: exportar e importar lanzan UNAVAILABLE', async () => {
  const sync = createSync({});
  await assert.rejects(() => sync.exportBackup(), (e) => e.code === 'UNAVAILABLE');
  await assert.rejects(() => sync.importBackup('{}'), (e) => e.code === 'UNAVAILABLE');
});

test('clearKeys borra solo las claves', async () => {
  const t = await mk();
  await t.settings.set('aiKey', SECRET); await t.settings.set('azureKey', SECRET); await t.settings.set('theme', 'neo');
  await t.tools.clearKeys();
  assert.equal(t.settings.hasSecret('aiKey'), false);
  assert.equal(t.settings.hasSecret('azureKey'), false);
  assert.equal(t.settings.get('theme'), 'neo');
  assert.equal(await t.db.get('settings', 'aiKey'), null);
});

test('wipeAll borra todo (datos, ajustes y claves) y deja los valores por defecto', async () => {
  const t = await mk();
  await t.settings.set('aiKey', SECRET); await t.settings.set('theme', 'neo'); await t.settings.set('userName', 'Sophia');
  await t.db.put('cards', card('c1')); await t.db.put('notes', { id: 'n1', text: 'hola' }); await t.db.put('meta', { key: 'firstSession', at: 'x' });
  let notified = 0;
  t.settings.onAnyChange(() => { notified += 1; });
  await t.tools.wipeAll();
  for (const s of ['cards', 'notes', 'settings']) assert.equal(await t.db.count(s), 0, s);
  assert.equal(await t.db.get('meta', 'firstSession'), null);
  assert.ok(await t.db.get('meta', 'schemaVersion'), 'la versión del esquema se conserva');
  assert.equal(t.settings.get('theme'), 'aurora');
  assert.equal(t.settings.get('userName'), '');
  assert.equal(t.settings.hasSecret('aiKey'), false);
  assert.ok(notified >= 1, 'los cambios se avisan en vivo');
  assert.equal(JSON.stringify((await t.db.exportAll({ includeSecrets: true }))).includes(SECRET), false);
});

test('wipeAll es atómico: si falla, no se borra nada', async () => {
  const t = await mk();
  await t.db.put('cards', card('c1')); await t.settings.set('theme', 'neo');
  const realTx = t.db.tx.bind(t.db);
  const flaky = { ...t.db, tx: (stores, fn) => realTx(stores, async (tx) => { const r = await fn({ ...tx, clear: async (s) => { if (s === 'settings') throw new DbError('QUOTA'); return tx.clear(s); } }); return r; }) };
  const tools = createDataTools({ db: flaky, settings: t.settings });
  await assert.rejects(() => tools.wipeAll(), (e) => e.code === 'QUOTA');
  assert.equal(await t.db.count('cards'), 1);
  assert.equal(t.settings.get('theme'), 'neo');
});

test('wipeAll sin base solo restablece los ajustes en memoria', async () => {
  const settings = createSettings(); await settings.load();
  await settings.set('aiKey', SECRET); await settings.set('theme', 'neo');
  await createDataTools({ settings }).wipeAll();
  assert.equal(settings.get('theme'), 'aurora');
  assert.equal(settings.hasSecret('aiKey'), false);
});

test('la clave no aparece en el texto de ningún error ni en el snapshot tras borrar', async () => {
  const t = await mk();
  await t.settings.set('aiKey', SECRET);
  await t.tools.wipeAll();
  assert.equal(JSON.stringify(t.settings.snapshot()).includes(SECRET), false);
});

test('createDataTools exige settings', () => {
  assert.throws(() => createDataTools({}), TypeError);
});

test('afterChange: se llama tras wipeAll y afterRestore; si lanza, se anota y la operación sigue', async () => {
  const { db, settings } = await mk();
  const calls = []; const logs = [];
  const tools = createDataTools({ db, settings, afterChange: async () => { calls.push(1); throw new Error('fallo'); }, log: (m) => logs.push(m) });
  await db.put('cards', { id: 'c1', itemId: 'i', due: '2026-10-18T00:00:00.000Z', topics: ['t'], state: 1 });
  await tools.wipeAll();
  assert.equal(await db.count('cards'), 0, 'borró aunque afterChange falló');
  await tools.afterRestore();
  assert.equal(calls.length, 2);
  assert.equal(logs.length, 2);
  await createDataTools({ db, settings }).wipeAll(); // sin afterChange: igual que antes
});
