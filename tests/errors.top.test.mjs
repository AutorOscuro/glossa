// @purpose: Pruebas de top(n, range) del registro de errores, por frecuencia e impacto.
// Pruebas del cuarto 2 de la 1.6 (parte 2): top(n, range) por frecuencia × impacto (CA 4 de la 1.6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createErrors, rankErrors, IMPACT_RANK } from '../core/errors.js';
import { createErrorCatalog } from '../core/errorCatalog.js';
import { createMemoryDb } from '../core/db.memory.js';
import { localDay } from '../core/clock.js';
import { makeClock, makeRng } from './_helpers.mjs';

const CATALOG = createErrorCatalog(JSON.parse(fs.readFileSync(new URL('../content/taxonomy/error_codes.json', import.meta.url), 'utf8')));
const noon = (d, m = 10) => new Date(2026, m - 1, d, 12, 0, 0).toISOString(); // mediodía LOCAL: el día local es el que dice el calendario, en cualquier huso

async function setup() {
  const db = createMemoryDb();
  await db.open();
  return { db, errors: createErrors({ db, catalog: CATALOG, clock: makeClock('2026-10-20T12:00:00.000Z') }) };
}
const code = async (fn) => { try { await fn(); } catch (e) { return e.code ?? e.name; } return 'NO LANZÓ'; };
async function add(errors, c, original, days, impact) {
  for (const d of days) await errors.record({ original, code: c, ts: noon(d), ...(impact ? { impact } : {}) });
}
const keys = (list) => list.map((e) => e.key);

test('top: ordena por frecuencia × impacto (low 1, mid 2, high 3), no solo por frecuencia ni solo por impacto', async () => {
  const { errors } = await setup();
  await add(errors, 'MECH.CAP_I', 'i like it', [1, 2, 3, 4, 5], 'low'); // 5 × 1 = 5
  await add(errors, 'NEG.DOUBLE', 'I dont know nothing', [6], 'high'); // 1 × 3 = 3
  await add(errors, 'TNS.SINCE_FOR', 'I live here since two years', [7, 8], 'mid'); // 2 × 2 = 4
  await add(errors, 'VRB.CAN_TO', 'I didnt can to go', [9, 10], 'high'); // 2 × 3 = 6
  const top = await errors.top(10, {});
  assert.deepEqual(keys(top), ['VRB.CAN_TO', 'MECH.CAP_I', 'TNS.SINCE_FOR', 'NEG.DOUBLE']);
  assert.deepEqual(top.map((e) => e.score), [6, 5, 4, 3]);
  assert.deepEqual(top.map((e) => [e.frequency, e.impact, e.weight]), [[2, 'high', 3], [5, 'low', 1], [2, 'mid', 2], [1, 'high', 3]]);
  assert.deepEqual(Object.keys(top[0]), ['key', 'by', 'code', 'record', 'records', 'topics', 'frequency', 'impact', 'weight', 'score', 'last']);
});

test('top: los pesos son los de IMPACT_RANK (1, 2, 3)', () => {
  assert.deepEqual({ ...IMPACT_RANK }, { low: 1, mid: 2, high: 3 });
});

test('top: con la misma puntuación gana más frecuencia, luego la más reciente, luego la clave', async () => {
  const { errors } = await setup();
  await add(errors, 'MECH.CAP_I', 'a', [1, 2, 3], 'low'); // score 3, freq 3
  await add(errors, 'NEG.DOUBLE', 'b', [4], 'high'); // score 3, freq 1
  assert.deepEqual(keys(await errors.top(5, {})), ['MECH.CAP_I', 'NEG.DOUBLE']); // más frecuencia primero
  await add(errors, 'PRON.TH', 'c', [20], 'high'); // score 3, freq 1, más reciente que NEG.DOUBLE
  assert.deepEqual(keys(await errors.top(5, {})), ['MECH.CAP_I', 'PRON.TH', 'NEG.DOUBLE']); // empate total salvo la fecha: la más reciente primero
  const { errors: e2 } = await setup();
  await add(e2, 'PRON.TH', 'x', [5], 'high');
  await add(e2, 'NEG.DOUBLE', 'y', [5], 'high'); // misma fecha, misma todo: manda la clave
  assert.deepEqual(keys(await e2.top(5, {})), ['NEG.DOUBLE', 'PRON.TH']);
});

test('top by "code" (por defecto): suma las frases distintas del mismo código; impact = el mayor; topics = unión ordenada', async () => {
  const { errors } = await setup();
  await add(errors, 'VRB.CAN_TO', 'frase uno', [1, 2], 'mid');
  await add(errors, 'VRB.CAN_TO', 'frase dos', [3], 'high');
  const [e] = await errors.top(5, {});
  assert.deepEqual([e.key, e.by, e.code, e.records, e.frequency, e.impact, e.score, e.record], ['VRB.CAN_TO', 'code', 'VRB.CAN_TO', 2, 3, 'high', 9, null]);
  assert.deepEqual(e.topics, [...CATALOG.get('VRB.CAN_TO').temas_relacionados].sort());
  assert.equal(e.last, noon(3));
});

test('top by "error": cada frase por separado, con una copia del registro', async () => {
  const { db, errors } = await setup();
  await add(errors, 'VRB.CAN_TO', 'frase uno', [1, 2], 'mid');
  await add(errors, 'VRB.CAN_TO', 'frase dos', [3], 'high');
  const top = await errors.top(5, {}, { by: 'error' });
  assert.deepEqual(top.map((e) => [e.record.original, e.frequency, e.score, e.by, e.records]), [['frase uno', 2, 4, 'error', 1], ['frase dos', 1, 3, 'error', 1]]);
  assert.equal(top[0].key, top[0].record.id);
  top[0].record.count = 99;
  assert.equal((await db.query('errors', {})).find((r) => r.original === 'frase uno').count, 2);
});

test('top: n limita; n = 0 da []; n mayor que lo que hay da todo; base vacía da []', async () => {
  const { errors } = await setup();
  assert.deepEqual(await errors.top(5, {}), []);
  await add(errors, 'VRB.CAN_TO', 'a', [1], 'high');
  await add(errors, 'NEG.DOUBLE', 'b', [2], 'high');
  await add(errors, 'PRON.TH', 'c', [3], 'low');
  assert.equal((await errors.top(1, {})).length, 1);
  assert.equal((await errors.top(2, {})).length, 2);
  assert.equal((await errors.top(500, {})).length, 3);
  assert.deepEqual(await errors.top(0, {}), []);
});

test('top: sin rango la frecuencia es `count` (incluye ocurrencias sin fecha, p. ej. del chat); con rango, solo las fechadas dentro', async () => {
  const { db, errors } = await setup();
  await db.put('errors', { id: 'err_chat', code: 'NEG.DOUBLE', original: 'x', ts: noon(5), count: 5, impact: 'high', topics: [] });
  assert.equal((await errors.top(5, {}))[0].frequency, 5);
  assert.equal((await errors.top(5, { from: '2026-10-01' }))[0].frequency, 1); // solo la fechada
});

test('top con rango: from y to INCLUSIVOS en días locales; lo de fuera no cuenta y un código sin nada dentro desaparece', async () => {
  const { errors } = await setup();
  await add(errors, 'VRB.CAN_TO', 'a', [1, 5, 10, 15], 'mid');
  await add(errors, 'NEG.DOUBLE', 'b', [20], 'high');
  const mid = await errors.top(5, { from: '2026-10-05', to: '2026-10-10' });
  assert.deepEqual(mid.map((e) => [e.key, e.frequency, e.last]), [['VRB.CAN_TO', 2, noon(10)]]); // 5 y 10 entran; 1, 15 y 20 no
  assert.deepEqual(keys(await errors.top(5, { from: '2026-10-15' })), ['NEG.DOUBLE', 'VRB.CAN_TO']); // 15 y 20: NEG 1×3=3 vs CAN 1×2=2
  assert.deepEqual(keys(await errors.top(5, { to: '2026-10-01' })), ['VRB.CAN_TO']);
  assert.deepEqual(await errors.top(5, { from: '2026-11-01' }), []);
  assert.deepEqual(keys(await errors.top(5, { from: '2026-10-20', to: '2026-10-20' })), ['NEG.DOUBLE']); // un solo día
});

test('top con rango: acepta Date y milisegundos (los pasa al día local) igual que events.countByDay', async () => {
  const { errors } = await setup();
  await add(errors, 'VRB.CAN_TO', 'a', [1, 5, 10], 'mid');
  const viaDate = await errors.top(5, { from: new Date(noon(5)), to: new Date(noon(10)) });
  const viaMs = await errors.top(5, { from: Date.parse(noon(5)), to: Date.parse(noon(10)) });
  assert.equal(viaDate[0].frequency, 2);
  assert.deepEqual(viaMs, viaDate);
});

test('top con rango: el día se mide en hora LOCAL, no UTC (23:30 local cuenta para ese día)', async () => {
  const { errors } = await setup();
  const late = new Date(2026, 9, 7, 23, 30).toISOString();
  await errors.record({ original: 'tarde', code: 'VRB.CAN_TO', ts: late });
  assert.equal(localDay(late), '2026-10-07');
  assert.equal((await errors.top(5, { from: '2026-10-07', to: '2026-10-07' })).length, 1);
  assert.equal((await errors.top(5, { to: '2026-10-06' })).length, 0);
  assert.equal((await errors.top(5, { from: '2026-10-08' })).length, 0);
});

test('top: un impacto ilegible pesa lo mínimo (low) y no rompe nada; un registro sin código se ignora', async () => {
  const { db, errors } = await setup();
  await db.put('errors', { id: 'err_a', code: 'NEG.DOUBLE', original: 'x', ts: noon(5), count: 2, impact: 'enorme', topics: 'no' });
  await db.put('errors', { id: 'err_b', original: 'sin código', ts: noon(5), count: 9, impact: 'high' });
  await db.put('errors', { id: 'err_c', code: 'PRON.TH', original: 'raro', count: 'mucho', seen: 7 });
  await db.put('errors', { id: 'err_d', code: 'MECH.CAP_I', original: 'sin fecha y count 0', count: 0, impact: 'low' }); // existe, así que ocurrió al menos una vez
  const top = await errors.top(5, {});
  assert.deepEqual(top.map((e) => [e.key, e.frequency, e.impact, e.weight, e.score]), [['NEG.DOUBLE', 2, 'low', 1, 2], ['MECH.CAP_I', 1, 'low', 1, 1], ['PRON.TH', 1, 'low', 1, 1]]);
  assert.deepEqual(top[0].topics, []);
  assert.equal(top[1].last, null);
  assert.equal(top[2].last, null);
});

test('top: opciones mal formadas → BAD_QUERY (n, range, claves, by, fechas imposibles, from > to)', async () => {
  const { errors } = await setup();
  for (const n of [undefined, null, -1, 1.5, '3', NaN, Infinity, {}]) assert.equal(await code(() => errors.top(n, {})), 'BAD_QUERY', `n=${String(n)}`);
  for (const r of [undefined, null, 'hoy', 5, [], { desde: 1 }, { from: 'ayer' }, { from: '2026-02-30' }, { from: '2026-13-01' }, { from: '20261001' }, { from: '2026-1-5' }, { to: '2026-10-5' }, { to: true }, { from: NaN }, { from: '2026-10-10', to: '2026-10-09' }]) {
    assert.equal(await code(() => errors.top(3, r)), 'BAD_QUERY', JSON.stringify(r));
  }
  for (const o of ['x', 5, [], { by: 'tema' }, { by: 5 }, { raro: 1 }]) assert.equal(await code(() => errors.top(3, {}, o)), 'BAD_QUERY', JSON.stringify(o));
  assert.deepEqual(await errors.top(3, {}, null), []);
  assert.deepEqual(await errors.top(3, {}, {}), []);
});

test('top: no escribe en la base y dos llamadas seguidas dan lo mismo', async () => {
  const { db, errors } = await setup();
  await add(errors, 'VRB.CAN_TO', 'a', [1, 2], 'high');
  await add(errors, 'NEG.DOUBLE', 'b', [3], 'mid');
  const before = JSON.stringify(await db.query('errors', {}));
  const a = await errors.top(5, {});
  const b = await errors.top(5, {});
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(await db.query('errors', {})), before);
});

test('top y recurrent devuelven copias aunque el motor de base devolviera referencias compartidas', async () => {
  const { db } = await setup();
  const shared = [{ id: 'err_1', code: 'VRB.CAN_TO', original: 'a', ts: noon(19), seen: [noon(17), noon(18), noon(19)], count: 3, impact: 'high', topics: ['gram.modals.no_to'] }];
  const leaky = { ...db, query: async () => shared };
  const errors = createErrors({ db: leaky, catalog: CATALOG, clock: makeClock('2026-10-20T12:00:00.000Z') });
  const [t] = await errors.top(5, {}, { by: 'error' });
  t.record.count = 99; t.record.topics.push('x.y.z'); t.topics.push('basura');
  const [r] = await errors.recurrent();
  r.record.count = 77; r.record.seen.length = 0;
  assert.deepEqual([shared[0].count, shared[0].topics, shared[0].seen.length], [3, ['gram.modals.no_to'], 3]);
});

test('top sin sumar de menos: un registro con count menor que sus fechas conocidas cuenta todas las fechas', async () => {
  const { db, errors } = await setup();
  await db.put('errors', { id: 'err_a', code: 'NEG.DOUBLE', original: 'x', ts: noon(5), seen: [noon(3), noon(4), noon(5)], count: 1, impact: 'low', topics: [] });
  assert.equal((await errors.top(5, {}))[0].frequency, 3);
});

test('top by "error": un registro sin código se ignora (también con by "code")', async () => {
  const { db, errors } = await setup();
  await db.put('errors', { id: 'err_b', original: 'sin código', ts: noon(5), count: 9, impact: 'high' });
  await db.put('errors', { id: 'err_a', code: 'NEG.DOUBLE', original: 'x', ts: noon(5), count: 1, impact: 'low', topics: [] });
  assert.deepEqual(keys(await errors.top(5, {}, { by: 'error' })), ['err_a']);
  assert.deepEqual(keys(await errors.top(5, {})), ['NEG.DOUBLE']);
});

test('rankErrors directo: por defecto agrupa por código', () => {
  const rows = [
    { id: 'a', code: 'X.Y', original: '1', ts: noon(1), seen: [noon(1)], count: 1, impact: 'low' },
    { id: 'b', code: 'X.Y', original: '2', ts: noon(2), seen: [noon(2)], count: 1, impact: 'low' },
  ];
  const out = rankErrors(rows);
  assert.deepEqual([out.length, out[0].key, out[0].by, out[0].frequency], [1, 'X.Y', 'code', 2]);
  assert.equal(rankErrors(rows, { by: 'error' }).length, 2);
});

test('top: el orden no depende del orden en que se guardaron los errores', async () => {
  const data = [['VRB.CAN_TO', 'a', [1, 2], 'high'], ['NEG.DOUBLE', 'b', [3], 'high'], ['MECH.CAP_I', 'c', [4, 5, 6], 'low'], ['PRON.TH', 'd', [7], 'low'], ['TNS.SINCE_FOR', 'e', [8, 9], 'mid']];
  const results = [];
  for (const order of [data, [...data].reverse(), [data[2], data[4], data[0], data[3], data[1]]]) {
    const { errors } = await setup();
    for (const [c, o, days, imp] of order) await add(errors, c, o, days, imp);
    results.push(keys(await errors.top(10, {})));
  }
  assert.deepEqual(results[1], results[0]);
  assert.deepEqual(results[2], results[0]);
});

test('CA 4 (propiedad): 40 conjuntos aleatorios de errores dan el MISMO orden que una referencia independiente, con y sin rango, por código y por error', async () => {
  const rng = makeRng(20261020);
  const ids = CATALOG.ids();
  const IMP = ['low', 'mid', 'high'];
  for (let round = 0; round < 40; round += 1) {
    const { db, errors } = await setup();
    const rows = [];
    const n = rng.int(0, 14);
    for (let i = 0; i < n; i += 1) {
      const occ = rng.int(1, 6);
      const days = Array.from({ length: occ }, () => rng.int(1, 28));
      const seen = [...new Set(days.map((d) => noon(d)))].sort();
      const rec = { id: `err_${round}_${i}`, code: ids[rng.int(0, 4)], original: `frase ${i}`, ts: seen[seen.length - 1], seen, count: seen.length, impact: IMP[rng.int(0, 2)], topics: [] };
      rows.push(rec);
      await db.put('errors', rec);
    }
    const from = rng.next() < 0.5 ? undefined : `2026-10-${String(rng.int(1, 14)).padStart(2, '0')}`;
    const to = rng.next() < 0.5 ? undefined : `2026-10-${String(rng.int(15, 28)).padStart(2, '0')}`;
    for (const by of ['code', 'error']) {
      // referencia: se calcula distinto (acumuladores por clave, sin reutilizar rankErrors)
      const acc = {};
      for (const r of rows) {
        const key = by === 'code' ? r.code : r.id;
        const inside = r.seen.filter((t) => (from === undefined || localDay(t) >= from) && (to === undefined || localDay(t) <= to));
        const freq = from === undefined && to === undefined ? r.count : inside.length;
        acc[key] ??= { key, freq: 0, w: 0, last: '' };
        acc[key].freq += freq;
        acc[key].w = Math.max(acc[key].w, IMPACT_RANK[r.impact]);
        for (const t of inside) if (t > acc[key].last) acc[key].last = t;
        if (from === undefined && to === undefined) acc[key].last = acc[key].last < r.ts ? r.ts : acc[key].last;
      }
      const expected = Object.values(acc).filter((a) => a.freq > 0)
        .sort((a, b) => (b.freq * b.w) - (a.freq * a.w) || b.freq - a.freq || (a.last < b.last ? 1 : a.last > b.last ? -1 : 0) || (a.key < b.key ? -1 : 1))
        .map((a) => a.key);
      const got = keys(await errors.top(100, { ...(from ? { from } : {}), ...(to ? { to } : {}) }, { by }));
      assert.deepEqual(got, expected, `ronda ${round} by ${by} from ${from} to ${to}`);
      assert.deepEqual(keys(rankErrors(rows, { by, from, to })), expected);
    }
  }
});

test('rendimiento: 2.000 errores se ordenan en una fracción de segundo', async () => {
  const { db, errors } = await setup();
  const ids = CATALOG.ids();
  for (let i = 0; i < 2000; i += 1) await db.put('errors', { id: `err_${i}`, code: ids[i % ids.length], original: `f${i}`, ts: noon(1 + (i % 28)), seen: [noon(1 + (i % 28))], count: 1 + (i % 5), impact: ['low', 'mid', 'high'][i % 3], topics: [] });
  const t0 = Date.now();
  assert.equal((await errors.top(10, {})).length, 10);
  assert.equal((await errors.top(10, { from: '2026-10-05' }, { by: 'error' })).length, 10);
  assert.ok(Date.now() - t0 < 1500);
});
