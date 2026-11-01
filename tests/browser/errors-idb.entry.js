// @purpose: Corre el registro de errores y su hook contra IndexedDB real en un navegador (lo abre tools/idb-check.py); deja los resultados en window.__sophia.
// Corre el registro de errores (core/errors.js, subparte 1.6) y el hook con el detector contra core/db.idb.js en un navegador real.
// Lo abre tools/idb-check.py errors; deja los resultados en window.__sophia. No forma parte de `npm run check`.
globalThis.process = { stdout: { write: (s) => { (globalThis.__sophia.log ??= []).push(String(s).trim()); } } };
globalThis.__sophia = { results: [], log: [], done: false };
const { test, runAll } = await import('./node-test-shim.js');
const { default: assert } = await import('./node-assert-shim.js');
const { createIdbDb } = await import('../../core/db.idb.js');
const { createErrors } = await import('../../core/errors.js');
const { createErrorCatalog } = await import('../../core/errorCatalog.js');
const { createErrorDetector } = await import('../../core/errorDetect.js');
const { createErrorHook } = await import('../../core/errorHook.js');

const CATALOG = createErrorCatalog(await (await fetch('../../content/taxonomy/error_codes.json')).json());
const DETECTOR = createErrorDetector({ catalog: CATALOG });
const names = [];
let n = 0;
const fresh = () => { const id = `sophia-errors-${Date.now()}-${n += 1}`; names.push(id); return id; };
const noon = (d) => new Date(2026, 9, d, 12, 0, 0).toISOString();
const clock = { now: () => new Date('2026-10-20T12:00:00.000Z'), nowMs: () => Date.parse('2026-10-20T12:00:00.000Z') };
async function open(name) { const db = createIdbDb({ name }); await db.open(); return { db, errors: createErrors({ db, catalog: CATALOG, clock }) }; }

test('IndexedDB: crear, repetir la misma ocurrencia (replay) y ocurrencia nueva', async () => {
  const { db, errors } = await open(fresh());
  const a = await errors.record({ original: "I didn't can to send it", code: 'VRB.CAN_TO', ts: noon(1) });
  assert.deepEqual([a.created, a.counted, a.replay], [true, true, false]);
  const b = await errors.record({ original: "  i DIDN’T can to send it.  ", code: 'VRB.CAN_TO', ts: noon(1) });
  assert.deepEqual([b.created, b.counted, b.replay], [false, false, true]);
  const c = await errors.record({ original: "I didn't can to send it", code: 'VRB.CAN_TO', ts: noon(2) });
  assert.deepEqual([c.created, c.counted, c.replay], [false, true, false]);
  assert.equal(c.record.count, 2);
  assert.equal(c.record.id, a.record.id);
  assert.equal(await errors.count(), 1);
  db.close?.();
});

test('IndexedDB: los datos sobreviven a cerrar y reabrir, y el reenvío sigue siendo replay', async () => {
  const name = fresh();
  const one = await open(name);
  await one.errors.record({ original: 'I have seen him yesterday', code: 'TNS.PP_PS', ts: noon(3) });
  one.db.close?.();
  const two = await open(name);
  assert.equal(await two.errors.count(), 1);
  const r = await two.errors.record({ original: 'I have seen him yesterday', code: 'TNS.PP_PS', ts: noon(3) });
  assert.equal(r.replay, true);
  assert.equal((await two.errors.list({}))[0].count, 1);
  two.db.close?.();
});

test('IndexedDB: top por frecuencia × impacto, con y sin rango, y byTopic', async () => {
  const { db, errors } = await open(fresh());
  const data = [
    ['MECH.CAP_I', 'i like it', 'low', [1, 2, 3, 4, 5, 6]],
    ['NEG.DOUBLE', "I don't know nothing", 'high', [7]],
    ['TNS.SINCE_FOR', 'I live here since two years', 'mid', [16, 17]],
    ['VRB.CAN_TO', "I didn't can to go", 'high', [10, 11, 12]],
    ['TNS.PP_PS', 'I have seen him yesterday', 'mid', [13, 14, 15]],
    ['ADJ.PLURAL', 'The movies were awesomes', 'mid', [8, 9]],
  ];
  for (const [code, original, impact, days] of data) for (const d of days) await errors.record({ original, code, impact, ts: noon(d) });
  assert.deepEqual((await errors.top(10, {})).map((e) => e.key), ['VRB.CAN_TO', 'MECH.CAP_I', 'TNS.PP_PS', 'TNS.SINCE_FOR', 'ADJ.PLURAL', 'NEG.DOUBLE']);
  assert.deepEqual((await errors.top(10, { from: '2026-10-13' })).map((e) => e.key), ['TNS.PP_PS', 'TNS.SINCE_FOR']);
  assert.equal(await errors.count(), 6);
  const topic = CATALOG.get('VRB.CAN_TO').temas_relacionados[0];
  assert.ok((await errors.byTopic(topic)).some((r) => r.code === 'VRB.CAN_TO'));
  db.close?.();
});

test('IndexedDB: detector → hook → registro con frases reales; las correctas no dejan rastro', async () => {
  const { db, errors } = await open(fresh());
  const hook = createErrorHook({ errors, catalog: CATALOG, classifier: DETECTOR });
  const malas = ['I live here since last week.', "I'm living here since two years.", 'She like pizza.', 'I have 22 years old.', 'yesterday i went to the market.'];
  const buenas = ["I've been living here for two years.", 'My boss makes me work on Saturdays.', 'I will graduate next year.'];
  const out = await hook.classifyAndRecord([...malas, ...buenas].map((original, i) => ({ original, ts: noon(1 + i) })), { classify: 'all' });
  assert.deepEqual(out.results.map((r) => r.status), [...malas.map(() => 'recorded'), ...buenas.map(() => 'unclassified')]);
  assert.equal(await errors.count(), malas.length);
  const again = await hook.classifyAndRecord(malas.map((original, i) => ({ original, ts: noon(1 + i) })), { classify: 'all' });
  assert.ok(again.results.every((r) => r.result.replay === true));
  assert.equal(await errors.count(), malas.length);
  db.close?.();
});

await runAll((r) => globalThis.__sophia.results.push(r));
await new Promise((res) => setTimeout(res, 50));
await Promise.all(names.map((id) => new Promise((res) => { const r = indexedDB.deleteDatabase(id); r.onsuccess = r.onerror = r.onblocked = () => res(); })));
globalThis.__sophia.done = true;
