import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../core/dbOpen.js';
import { requestPersistence, PERSIST_KEY } from '../core/persist.js';
import { createMemoryDb } from '../core/db.memory.js';
import { DbError } from '../core/dbErrors.js';

const fakeIdb = (err) => ({ kind: 'idb', open: async () => { if (err) throw err; return { persistent: true, schemaVersion: 1 }; }, close: async () => {} });

test('openDatabase: con IndexedDB usa el motor real, persistent true y sin aviso', async () => {
  const r = await openDatabase({ name: 'x', factory: {}, createIdb: () => fakeIdb() });
  assert.equal(r.mode, 'indexeddb'); assert.equal(r.persistent, true); assert.equal(r.warning, null);
});
test('openDatabase: sin IndexedDB cae a memoria con aviso amable', async () => {
  const r = await openDatabase({ name: 'x', factory: null });
  assert.equal(r.mode, 'memory'); assert.equal(r.persistent, false);
  assert.equal(r.warning.code, 'UNAVAILABLE'); assert.ok(r.warning.message.includes('no se conservará'));
  await r.db.put('notes', { id: 'a' });
  assert.equal((await r.db.get('notes', 'a')).id, 'a');
});
test('openDatabase: UNAVAILABLE al abrir también cae a memoria', async () => {
  const r = await openDatabase({ name: 'x', factory: {}, createIdb: () => fakeIdb(new DbError('UNAVAILABLE')) });
  assert.equal(r.mode, 'memory'); assert.ok(r.warning);
});
test('openDatabase: otros errores NO caen a memoria en silencio', async () => {
  for (const code of ['NEWER_VERSION', 'MIGRATION', 'BLOCKED', 'QUOTA']) {
    await assert.rejects(openDatabase({ name: 'x', factory: {}, createIdb: () => fakeIdb(new DbError(code)) }), (e) => e.code === code);
  }
  await assert.rejects(openDatabase({ name: 'x', factory: {}, createIdb: () => fakeIdb(new Error('raro')) }), /raro/);
  await assert.rejects(openDatabase({}), /name/);
});

const mk = async () => { const db = createMemoryDb(); await db.open(); return db; };
const st = (o = {}) => { const s = { calls: 0, persisted: async () => false, persist: async () => { s.calls += 1; return true; }, ...o }; return s; };

test('persist: sin soporte → unsupported; sin sesión real → not-yet y no pide', async () => {
  const db = await mk();
  assert.equal((await requestPersistence({ db, storage: undefined, sessionDone: true })).status, 'unsupported');
  assert.equal((await requestPersistence({ db, storage: {}, sessionDone: true })).status, 'unsupported');
  const s = st();
  assert.equal((await requestPersistence({ db, storage: s, sessionDone: false })).status, 'not-yet');
  assert.equal(s.calls, 0);
});
test('persist: concede → granted, se guarda y no se vuelve a pedir', async () => {
  const db = await mk(); const s = st();
  const now = new Date('2026-10-17T12:00:00Z');
  assert.deepEqual(await requestPersistence({ db, storage: s, now, sessionDone: true }), { status: 'granted', granted: true });
  assert.deepEqual(await db.get('meta', PERSIST_KEY), { key: PERSIST_KEY, asked: true, granted: true, at: '2026-10-17T12:00:00.000Z' });
  assert.equal((await requestPersistence({ db, storage: s, sessionDone: true })).status, 'skipped');
  assert.equal(s.calls, 1);
});
test('persist: negado → denied y no insiste después', async () => {
  const db = await mk(); const s = st({ persist: async () => { s.calls += 1; return false; } });
  assert.deepEqual(await requestPersistence({ db, storage: s, sessionDone: true }), { status: 'denied', granted: false });
  assert.deepEqual(await requestPersistence({ db, storage: s, sessionDone: true }), { status: 'skipped', granted: false });
  assert.equal(s.calls, 1);
});
test('persist: ya concedido por el navegador → already sin pedir', async () => {
  const db = await mk(); const s = st({ persisted: async () => true });
  assert.deepEqual(await requestPersistence({ db, storage: s, sessionDone: true }), { status: 'already', granted: true });
  assert.equal(s.calls, 0);
});
test('persist: si falla al pedir → error y NO se marca como pedido (se reintenta)', async () => {
  const db = await mk(); let boom = true;
  const s = st({ persist: async () => { if (boom) throw new Error('x'); s.calls += 1; return true; } });
  assert.equal((await requestPersistence({ db, storage: s, sessionDone: true })).status, 'error');
  assert.equal(await db.get('meta', PERSIST_KEY), null);
  boom = false;
  assert.equal((await requestPersistence({ db, storage: s, sessionDone: true })).status, 'granted');
});
