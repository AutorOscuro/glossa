// @purpose: Corre el contrato de events.log() contra IndexedDB real en un navegador (lo abre tools/idb-check.py); deja los resultados en window.__sophia.
// Corre el contrato de events.log() (tests/_eventsContract.mjs) contra core/db.idb.js en un navegador real (subparte 1.1, cuarto 2 mitad B).
// Lo abre tools/idb-check.py events; deja los resultados en window.__sophia. No forma parte de `npm run check`.
globalThis.process = { stdout: { write: (s) => { (globalThis.__sophia.log ??= []).push(String(s).trim()); } } };
globalThis.__sophia = { results: [], log: [], done: false };
const { runAll } = await import('./node-test-shim.js');
const { runEventsContract } = await import('../_eventsContract.mjs');
const { createIdbDb } = await import('../../core/db.idb.js');
let n = 0;
const names = [];
runEventsContract({
  label: 'indexeddb',
  newDisk: () => { const id = `sophia-events-${Date.now()}-${n += 1}`; names.push(id); return id; },
  create: (disk) => createIdbDb({ name: disk }),
  volume: 2000,
  queryVolume: 50000,
  perfBudgetMs: null, // en IndexedDB real solo se documenta el tiempo
});
await runAll((r) => globalThis.__sophia.results.push(r));
await new Promise((res) => setTimeout(res, 50));
await Promise.all(names.map((id) => new Promise((res) => { const r = indexedDB.deleteDatabase(id); r.onsuccess = r.onerror = r.onblocked = () => res(); })));
globalThis.__sophia.done = true;
