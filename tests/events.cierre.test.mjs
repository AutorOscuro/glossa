// @purpose: Criterios de aceptación de la 1.1, de punta a punta con createEvents y datos reales.
// Cierre de la 1.1: los 4 criterios de aceptación del roadmap, comprobados de punta a punta con la API pública (createEvents) y datos reales.
// Cada criterio tiene además pruebas más finas en eventSchema.test.mjs, events.test.mjs y _eventsContract.mjs (memoria e IndexedDB real).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEvents } from '../core/events.js';
import { createMemoryDb } from '../core/db.memory.js';
import { makeClock, makeRng } from './_helpers.mjs';

const answer = (over = {}) => ({
  type: 'answer', itemId: 'g.pp.0001', cardId: 'g.pp.0001#0', topics: ['gram.present_perfect.for_since'], exerciseType: 'fix_error',
  result: 'wrong', rating: 1, ms: 8400, responseRaw: 'I live here since two years', errorCodes: ['TNS.SINCE_FOR'], mode: 'mech', channel: 'keyboard', ...over,
});
async function open(clock = makeClock()) {
  const db = createMemoryDb();
  await db.open();
  return { db, events: createEvents({ db, clock, rng: makeRng(5) }) };
}

test('CA-1: un evento inválido se rechaza con un error que dice qué campo falla y no escribe nada', async () => {
  const { db, events } = await open();
  for (const [bad, field] of [[answer({ result: 'bien' }), 'result'], [answer({ type: 'respuesta' }), 'type'], [answer({ topics: 'x' }), 'topics'], [answer({ ms: -1 }), 'ms'], [null, null], ['texto', null]]) {
    await assert.rejects(() => events.log(bad), (e) => e.code === 'BAD_EVENT' && typeof e.message === 'string' && e.message.length > 10 && (field === null || e.message.includes(field)));
  }
  assert.equal(await db.count('events', {}), 0);
});

test('CA-2: 10.000 llamadas seguidas (mismo reloj congelado) dan 10.000 ids distintos, todos guardados', async () => {
  const { db, events } = await open(makeClock());
  const saved = await Promise.all(Array.from({ length: 10000 }, (_, i) => events.log(answer({ ms: i }))));
  assert.equal(new Set(saved.map((e) => e.id)).size, 10000);
  assert.equal(await db.count('events', {}), 10000);
});

test('CA-3: el día guardado es el día LOCAL en la medianoche, en extremos de zona y en el cambio de hora (cada zona por separado)', async () => {
  const cases = [
    ['America/Bogota', '2026-10-16T04:59:59.999Z', '2026-10-15'], ['America/Bogota', '2026-10-16T05:00:00.000Z', '2026-10-16'],
    ['Pacific/Kiritimati', '2026-10-15T09:59:59.999Z', '2026-10-15'], ['Pacific/Kiritimati', '2026-10-15T10:00:00.000Z', '2026-10-16'],
    ['Pacific/Pago_Pago', '2026-10-16T10:59:59.999Z', '2026-10-15'], ['Pacific/Pago_Pago', '2026-10-16T11:00:00.000Z', '2026-10-16'],
    ['America/New_York', '2026-11-01T05:30:00.000Z', '2026-11-01'], ['America/New_York', '2026-11-01T06:30:00.000Z', '2026-11-01'], ['America/New_York', '2026-11-02T05:00:00.000Z', '2026-11-02'],
  ];
  const before = process.env.TZ;
  try {
    for (const [tz, ts, day] of cases) {
      process.env.TZ = tz;
      const { events } = await open();
      assert.equal((await events.log(answer({ ts }))).day, day, `${tz} ${ts}`);
    }
  } finally { if (before === undefined) delete process.env.TZ; else process.env.TZ = before; }
});

test('CA-4: las consultas por rango leen por índice y devuelven exactamente lo del rango (nunca recorren el almacén completo)', async () => {
  const { db, events } = await open();
  for (let d = 0; d < 10; d += 1) for (let k = 0; k < 3; k += 1) await events.log(answer({ ts: new Date(2026, 9, 1 + d, 8 + k).toISOString(), errorCodes: k === 0 ? ['A.B'] : [] }));
  const seen = [];
  const spy = { ...db, query: (store, opts) => { seen.push(opts); return db.query(store, opts); }, tx: db.tx.bind(db) };
  const ev2 = createEvents({ db: spy, clock: makeClock(), rng: makeRng(6) });
  const win = await ev2.since(new Date(2026, 9, 8).toISOString());
  assert.equal(win.length, 9);
  assert.deepEqual(await ev2.countByDay({ from: '2026-10-09', to: '2026-10-10' }), { '2026-10-09': 3, '2026-10-10': 3 });
  assert.equal((await ev2.recentErrorsByCode('A.B', { since: new Date(2026, 9, 9).toISOString() })).length, 2);
  assert.equal(seen.length, 3);
  for (const q of seen) assert.ok(q && (q.index === 'ts' || q.index === 'day') && q.range, JSON.stringify(q));
});
