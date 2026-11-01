// @purpose: Corre la suite de contrato de almacenamiento contra IndexedDB real en un navegador (lo abre tools/idb-check.py); deja los resultados en window.__sophia.
// Corre la suite de contrato (tests/_dbContract.mjs) contra core/db.idb.js en un navegador real (subparte 0.7B).
// Lo abre tools/idb-check.py; deja los resultados en window.__sophia. No forma parte de `npm run check` (Node no trae IndexedDB).
globalThis.process = { stdout: { write: (s) => { (globalThis.__sophia.log ??= []).push(String(s).trim()); } } };
globalThis.__sophia = { results: [], log: [], done: false };
const { runAll } = await import('./node-test-shim.js');
const { runDbContract } = await import('../_dbContract.mjs');
const { createIdbDb } = await import('../../core/db.idb.js');
let n = 0;
const names = [];
runDbContract({
  label: 'indexeddb',
  newDisk: () => { const id = `sophia-contract-${Date.now()}-${n += 1}`; names.push(id); return id; },
  create: (disk, opts = {}) => createIdbDb({ name: disk, ...opts }),
  hooks: false,
  perfBudgetMs: 100,
});
await runAll((r) => globalThis.__sophia.results.push(r));
await new Promise((res) => setTimeout(res, 50));
await Promise.all(names.map((id) => new Promise((res) => { const r = indexedDB.deleteDatabase(id); r.onsuccess = r.onerror = r.onblocked = () => res(); })));
globalThis.__sophia.done = true;
