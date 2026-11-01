// @purpose: Pruebas del arranque del almacenamiento (app/storage.js) con base, aviso y navegador falsos.
// Pruebas de app/storage.js (subparte 0.7, B2b) con base, aviso y navegador falsos + una prueba de integración con el shell.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStorage, FIRST_SESSION_KEY, ACK_LABEL } from '../app/storage.js';
import { createMemoryDb } from '../core/db.memory.js';
import { DbError } from '../core/dbErrors.js';
import { createUpdateNotice } from '../ui/components/updateNotice.js';
import { startApp, VIEWS } from '../app/shell.js';
import { createView } from '../ui/views/_viewBase.js';
import { makeEnv, makeTimers } from './_fakeDom.mjs';
import { makeClock } from './_helpers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fakeNotice = () => { const n = { shown: [], hid: 0, show(o) { n.shown.push(o); }, hide() { n.hid += 1; } }; return n; };
const memOpen = (mode = 'indexeddb', warning = null) => async () => { const db = createMemoryDb(); const info = await db.open(); return { db, mode, persistent: mode === 'indexeddb', info, warning }; };
const win = (granted = true) => { const s = { calls: 0, persisted: async () => false, persist: async () => { s.calls += 1; return granted; } }; return { indexedDB: {}, navigator: { storage: s }, s }; };

test('storage: con IndexedDB no hay aviso, db listo y persist NO se pide sin primera sesión', async () => {
  const n = fakeNotice(); const w = win();
  const r = await startStorage({ name: 'x', notice: n, win: w, open: memOpen() });
  await new Promise((res) => setTimeout(res, 5));
  assert.equal(r.mode, 'indexeddb'); assert.ok(r.db); assert.equal(n.shown.length, 0); assert.equal(w.s.calls, 0);
});
test('storage: modo memoria → aviso visible con "Entendido" que lo cierra; persist nunca se pide', async () => {
  const n = fakeNotice(); const w = win();
  const warning = { code: 'UNAVAILABLE', message: 'no se conservará nada' };
  const r = await startStorage({ name: 'x', notice: n, win: w, open: memOpen('memory', warning) });
  assert.equal(r.mode, 'memory'); assert.equal(n.shown.length, 1);
  assert.equal(n.shown[0].message, 'no se conservará nada'); assert.equal(n.shown[0].actionLabel, ACK_LABEL);
  n.shown[0].onAction(); assert.equal(n.hid, 1);
  assert.deepEqual(await r.markSessionDone(), { status: 'unsupported', granted: false }); assert.equal(w.s.calls, 0);
});
test('storage: markSessionDone guarda la primera sesión UNA vez y pide persist; el siguiente arranque ya no insiste', async () => {
  const clock = makeClock('2026-10-17T12:00:00.000Z'); const w = win(true);
  const db = createMemoryDb(); await db.open();
  const open = async () => ({ db, mode: 'indexeddb', persistent: true, info: {}, warning: null });
  const r = await startStorage({ name: 'x', notice: fakeNotice(), win: w, clock, open });
  assert.equal((await r.markSessionDone()).status, 'granted');
  const first = await db.get('meta', FIRST_SESSION_KEY);
  assert.equal(first.at, '2026-10-17T12:00:00.000Z');
  clock.advanceDays(1);
  assert.equal((await r.markSessionDone()).status, 'skipped');
  assert.equal((await db.get('meta', FIRST_SESSION_KEY)).at, first.at);
  const r2 = await startStorage({ name: 'x', notice: fakeNotice(), win: w, clock, open });
  await new Promise((res) => setTimeout(res, 5));
  assert.equal(w.s.calls, 1); assert.equal(r2.mode, 'indexeddb');
});
test('storage: si la base no abre → no lanza, db null y aviso con el texto amable del error', async () => {
  const n = fakeNotice();
  const r = await startStorage({ name: 'x', notice: n, win: win(), open: async () => { throw new DbError('NEWER_VERSION'); } });
  assert.equal(r.db, null); assert.equal(r.mode, 'none'); assert.equal(r.error.code, 'NEWER_VERSION');
  assert.ok(n.shown[0].message.includes('Actualiza la app'));
  const r2 = await startStorage({ name: 'x', notice: fakeNotice(), win: win(), open: async () => { throw new Error('raro'); } });
  assert.equal(r2.mode, 'none');
});
test('storage: un aviso que falla no tumba el arranque', async () => {
  const bad = { show() { throw new Error('x'); }, hide() {} };
  const r = await startStorage({ name: 'x', notice: bad, win: win(), open: memOpen('memory', { message: 'm' }) });
  assert.equal(r.mode, 'memory');
});
test('storage: el aviso real (createUpdateNotice) es visible, persistente y se cierra con Entendido', async () => {
  const env = makeEnv(); const container = env.doc.createElement('div'); env.doc.body.appendChild(container);
  const notice = createUpdateNotice({ doc: env.doc, container });
  await startStorage({ name: 'x', notice, win: win(), open: memOpen('memory', { message: 'Solo memoria: no se conservará' }) });
  assert.equal(notice.isVisible(), true);
  const btn = container.querySelectorAll('button').find((b) => b.textContent === ACK_LABEL);
  assert.ok(btn); assert.ok(container.textContent.includes('Solo memoria'));
  btn.dispatchEvent({ type: 'click' });
  assert.equal(notice.isVisible(), false);
});
test('shell: startApp expone los mismos services que reciben las vistas (main.js les añade db)', async () => {
  const env = makeEnv(); const real = globalThis.document; globalThis.document = env.doc;
  try {
    const seen = [];
    const views = { hoy: createView((ctx) => { seen.push(ctx.services); }) };
    const app = startApp({ doc: env.doc, win: env.win, version: '9.9.9', views: { ...VIEWS, ...views }, log: () => {}, timers: makeTimers() });
    await env.flush();
    assert.equal(seen.length, 1);
    assert.equal(seen[0], app.services); // el mismo objeto: lo que main.js le añada después lo ven las vistas
    app.services.db = 'la-base';
    assert.equal(seen[0].db, 'la-base');
    app.destroy();
  } finally { globalThis.document = real; }
});
test('main.js cablea el almacenamiento con DB_NAME y el aviso', () => {
  const src = fs.readFileSync(path.join(ROOT, 'app/main.js'), 'utf8');
  assert.match(src, /startStorage\(\{ name: DB_NAME/); assert.match(src, /services\.storageReady/); assert.match(src, /services\.db = storage\.db/);
});
