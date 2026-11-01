// @purpose: Corre el respaldo, la importación idempotente de errores del chat y las entradas hostiles contra IndexedDB real en un navegador (lo abre tools/idb-check.py sync).
// Prueba core/sync.js (subparte 1.12, T1 a T4) sobre core/db.idb.js: ida y vuelta, claves fuera, reimportar no duplica, sobrevive a cerrar y reabrir, y lo hostil se rechaza sin tocar nada.
// Deja los resultados en window.__sophia. No forma parte de `npm run check`.
globalThis.process = { stdout: { write: (s) => { (globalThis.__sophia.log ??= []).push(String(s).trim()); } } };
globalThis.__sophia = { results: [], log: [], done: false };
const { test, runAll } = await import('./node-test-shim.js');
const { default: assert } = await import('./node-assert-shim.js');
const { createIdbDb } = await import('../../core/db.idb.js');
const { createSync } = await import('../../core/sync.js');
const { createErrors } = await import('../../core/errors.js');
const { createErrorCatalog } = await import('../../core/errorCatalog.js');
const { EXPORT_FORMAT } = await import('../../core/db.js');

const CATALOG = createErrorCatalog(await (await fetch('../../content/taxonomy/error_codes.json')).json());
const NOW = '2026-10-25T12:00:00.000Z';
const clock = { now: () => new Date(NOW), nowMs: () => Date.parse(NOW) };
const names = [];
let n = 0;
const fresh = () => { const id = `sophia-sync-${Date.now()}-${n += 1}`; names.push(id); return id; };
async function open(name) {
  const db = createIdbDb({ name });
  await db.open();
  const errors = createErrors({ db, catalog: CATALOG, clock });
  return { db, errors, sync: createSync({ db, clock, errors, catalog: CATALOG }) };
}
const state = async (db) => { const { exportedAt, ...rest } = await db.exportAll({ includeSecrets: true }); return rest; };
const block = (errores, gen = NOW) => `=== SOPHIA-EN-SYNC v1 ===\ntipo: errores\ngenerado: ${gen}\n${JSON.stringify({ errores })}\n=== FIN ===`;
const E1 = { original: "I didn't can to send it", code: 'VRB.CAN_TO' };
const E2 = { original: 'She go to school', code: 'VRB.THIRD_S_OMIT' };
const nested = (k) => `${'['.repeat(k)}${']'.repeat(k)}`;

async function seed(db) {
  await db.put('cards', { id: 'c1', itemId: 'i1', due: NOW, state: 2, stability: 3.5, nested: { a: [1, 2, { b: null }], n: 0, s: '' } });
  await db.put('notes', { id: 'n1', text: `Mañana “¿qué tal?” ’quote’ 😀 ${'é'.repeat(300)}` });
  await db.put('words', { id: 'w1', state: 'known', big: 9007199254740991 });
  await db.put('plans', { day: '2026-10-26', items: ['a', 'b'] });
  await db.put('settings', { key: 'theme', value: 'neo' });
  await db.put('settings', { key: 'aiKey', value: 'clave-de-prueba-123', secret: true });
  await db.put('meta', { key: 'nombre', value: 'Glossa' });
}

test('IndexedDB: ida y vuelta del respaldo con claves deja una base idéntica (comparación profunda)', async () => {
  const a = await open(fresh());
  await seed(a.db);
  await a.sync.importChatErrors(block([E1, E2]));
  const out = await a.sync.exportBackup({ includeSecrets: true });
  const b = await open(fresh());
  const res = await b.sync.importBackup(out.json, { mode: 'replace', keepSecrets: false });
  assert.ok(res.total > 5);
  assert.deepEqual(await state(b.db), await state(a.db));
  a.db.close?.(); b.db.close?.();
});

test('IndexedDB: el respaldo por defecto no lleva claves y restaurarlo conserva las del dispositivo', async () => {
  const a = await open(fresh());
  await seed(a.db);
  const out = await a.sync.exportBackup();
  assert.equal(out.includesSecrets, false);
  assert.ok(!out.json.includes('clave-de-prueba-123'));
  const b = await open(fresh());
  await b.db.put('settings', { key: 'aiKey', value: 'otra-clave-de-prueba-456', secret: true });
  await b.sync.importBackup(out.json);
  const keys = (await b.db.query('settings')).filter((r) => r.secret);
  assert.deepEqual(keys.map((r) => r.value), ['otra-clave-de-prueba-456']);
  a.db.close?.(); b.db.close?.();
});

test('IndexedDB: la vista previa de un respaldo no escribe nada y predice el resultado', async () => {
  const a = await open(fresh());
  await seed(a.db);
  const out = await a.sync.exportBackup({ includeSecrets: true });
  const b = await open(fresh());
  await b.db.put('notes', { id: 'viejo', text: 'se perderá' });
  const antes = await state(b.db);
  const pv = await b.sync.previewBackup(out.json, { mode: 'replace', keepSecrets: true });
  assert.deepEqual(await state(b.db), antes);
  assert.equal(pv.stores.notes.removed, 1);
  const hecho = await b.sync.importBackup(out.json, { mode: 'replace', keepSecrets: true });
  assert.equal(hecho.stores.notes, pv.stores.notes.incoming);
  assert.equal((await b.db.query('notes')).length, pv.stores.notes.after);
  a.db.close?.(); b.db.close?.();
});

test('IndexedDB: importar errores del chat guarda con source chat y reimportar el mismo bloque no duplica (CA 2)', async () => {
  const { db, sync } = await open(fresh());
  const texto = block([E1, E2]);
  const pv = await sync.previewChatErrors(texto);
  assert.deepEqual(pv.totals, { new: 2, repeat: 0, replay: 0, invalid: 0, skipped: 0 });
  assert.equal((await db.query('errors', {})).length, 0);
  const r1 = await sync.importChatErrors(texto);
  assert.equal(r1.applied, 2);
  const filas = await db.query('errors', {});
  assert.equal(filas.length, 2);
  assert.ok(filas.every((f) => f.source === 'chat' && f.count === 1 && f.ts === NOW));
  const despues = await state(db);
  for (let i = 0; i < 3; i += 1) {
    const r = await sync.importChatErrors(texto);
    assert.deepEqual(r.totals, { new: 0, repeat: 0, replay: 2, invalid: 0, skipped: 0 });
    assert.equal(r.applied, 0);
  }
  assert.deepEqual(await state(db), despues);
  db.close?.();
});

test('IndexedDB: un bloque nuevo cuenta otra ocurrencia, y todo sobrevive a cerrar y reabrir sin duplicar', async () => {
  const name = fresh();
  const one = await open(name);
  await one.sync.importChatErrors(block([E1], '2026-10-24T09:00:00.000Z'));
  await one.sync.importChatErrors(block([E1], '2026-10-25T09:00:00.000Z'));
  assert.equal((await one.db.query('errors', {}))[0].count, 2);
  one.db.close?.();
  const two = await open(name);
  const r = await two.sync.importChatErrors(block([E1], '2026-10-24T09:00:00.000Z'));
  assert.equal(r.totals.replay, 1);
  const filas = await two.db.query('errors', {});
  assert.equal(filas.length, 1);
  assert.equal(filas[0].count, 2);
  two.db.close?.();
});

test('IndexedDB: 200 errores (el máximo de un bloque) entran, se repiten sin duplicar y caben en el tiempo', async () => {
  const { db, sync } = await open(fresh());
  const errores = Array.from({ length: 200 }, (_, i) => ({ original: `I am agree number ${i}`, code: 'SUBJ.OMIT' }));
  const t0 = performance.now();
  const r = await sync.importChatErrors(block(errores));
  const ms = performance.now() - t0;
  globalThis.__sophia.log.push(`200 errores importados en ${Math.round(ms)} ms`);
  assert.equal(r.applied, 200);
  assert.ok(ms < 15000, `${ms} ms`);
  const again = await sync.importChatErrors(block(errores));
  assert.equal(again.totals.replay, 200);
  assert.equal((await db.query('errors', {})).length, 200);
  db.close?.();
});

test('IndexedDB: entradas hostiles (__proto__, demasiado hondo, JSON roto, bloque hostil) se rechazan sin tocar la base ni el prototipo', async () => {
  const { db, sync } = await open(fresh());
  await seed(db);
  const antes = await state(db);
  const respaldos = [
    `{"format":"${EXPORT_FORMAT}","schemaVersion":1,"stores":{"notes":[{"id":"x","__proto__":{"polluted":1}}]}}`,
    `{"format":"${EXPORT_FORMAT}","schemaVersion":1,"stores":{"notes":[{"id":"x","v":${nested(50_000)}}]}}`,
    `{"format":"${EXPORT_FORMAT}","schemaVersion":1,"stores":{"notes":[{"id":"x","v":1e999}]}}`,
    '{"format":"glossa-db","sche', '[]', '',
  ];
  for (const t of respaldos) {
    for (const modo of ['replace', 'merge']) {
      let error = null;
      try { await sync.importBackup(t, { mode: modo }); } catch (e) { error = e; }
      assert.equal(error && error.code, 'BAD_IMPORT');
    }
    let pv = null;
    try { await sync.previewBackup(t); } catch (e) { pv = e; }
    assert.equal(pv && pv.code, 'BAD_IMPORT');
  }
  const hostil = block([E1]).replace('"original"', '"__proto__"');
  assert.equal((await sync.importChatErrors(hostil)).error.code, 'HOSTILE');
  assert.equal((await sync.previewChatErrors('=== SOPHIA-EN-SYNC v1 ===\ntipo: errores\n{"errores":[')).ok, false);
  assert.deepEqual(await state(db), antes);
  assert.equal(({}).polluted, undefined);
  db.close?.();
});

await runAll((r) => globalThis.__sophia.results.push(r));
await new Promise((res) => setTimeout(res, 50));
await Promise.all(names.map((id) => new Promise((res) => { const r = indexedDB.deleteDatabase(id); r.onsuccess = r.onerror = r.onblocked = () => res(); })));
globalThis.__sophia.done = true;
