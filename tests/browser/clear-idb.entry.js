// @purpose: Mide en IndexedDB real cuánto tarda vaciar 10.000 eventos (clearAll, Borrar todo y reemplazar un respaldo); lo abre tools/idb-check.py clear.
// Banco de pruebas de la subparte 1.12-T1 (borrado de almacenes). Mismas medidas antes y después de añadir clear(store):
// cada corrida llena la base con 10.000 eventos (6 índices) y mide UNA operación; se informa la mediana de 5 corridas (4.R.9).
// Deja los resultados en window.__sophia con la misma forma que las demás páginas. No forma parte de `npm run check`.
globalThis.__sophia = { results: [], log: [], done: false };
const say = (s) => globalThis.__sophia.log.push(s);
const { createIdbDb } = await import('../../core/db.idb.js');
const { createEvents } = await import('../../core/events.js');
const { createDataTools } = await import('../../app/dataTools.js');
const { createSync } = await import('../../core/sync.js');

const params = new URLSearchParams(location.search);
const RUNS = Number(params.get('runs') || 5);
const only = params.get('only');
const VOLUME = 10000;
const names = [];
let n = 0;
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const eventRows = () => Array.from({ length: VOLUME }, (_, i) => ({
  id: `ev${String(i).padStart(6, '0')}`, ts: new Date(1700000000000 + i * 1000).toISOString(), day: `2026-10-${String(1 + (i % 28)).padStart(2, '0')}`,
  type: i % 2 ? 'review' : 'answer', cardId: `c${i % 500}`, itemId: `i${i % 300}`, topics: [`t${i % 20}`],
}));

async function filled() {
  const name = `sophia-clear-${Date.now()}-${n += 1}`;
  names.push(name);
  const db = createIdbDb({ name });
  await db.open();
  const rows = eventRows();
  await db.tx(['events'], async (t) => { for (const r of rows) await t.put('events', r); });
  return db;
}
async function timed(fn) { const t0 = performance.now(); const out = await fn(); return [performance.now() - t0, out]; }

async function bench(key, label, op, after) {
  if (only && only !== key) return;
  const times = [];
  try {
    for (let i = 0; i < RUNS; i += 1) {
      const db = await filled();
      const [ms, out] = await timed(() => op(db));
      times.push(ms);
      await after(db, out);
      await db.close();
    }
    const m = median(times);
    say(`# ${label}: mediana ${m.toFixed(0)} ms de ${RUNS} corridas (${times.map((x) => x.toFixed(0)).join(', ')}) con ${VOLUME} eventos`);
    globalThis.__sophia.results.push({ name: `${label} (${VOLUME} eventos)`, status: 'pass' });
  } catch (e) {
    globalThis.__sophia.results.push({ name: label, status: 'fail', error: String(e && e.stack || e) });
  }
}
const expectZero = async (db) => { if ((await db.count('events')) !== 0) throw new Error('quedaron eventos'); };

await bench('clearAll', 'events.clearAll()', (db) => createEvents({ db }).clearAll(), expectZero);
await bench('wipe', 'wipeAll() de Ajustes', (db) => createDataTools({ db, settings: { clearSecrets: async () => {}, load: async () => {} } }).wipeAll(), expectZero);
await bench('import', 'importBackup en modo reemplazar (respaldo vacío)', async (db) => {
  const empty = JSON.stringify({ format: 'glossa-db', schemaVersion: 1, exportedAt: new Date().toISOString(), stores: { events: [] } });
  return createSync({ db }).importBackup(empty, { mode: 'replace' });
}, expectZero);

await new Promise((res) => setTimeout(res, 50));
await Promise.all(names.map((id) => new Promise((res) => { const r = indexedDB.deleteDatabase(id); r.onsuccess = r.onerror = r.onblocked = () => res(); })));
globalThis.__sophia.done = true;
