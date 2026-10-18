// Pruebas de core/events.js (subparte 1.1, cuarto 2 mitad A): log atómico, unicidad contra la base e inmutabilidad.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEvents, MAX_ID_TRIES } from '../core/events.js';
import { createMemoryDb, createMemoryDisk } from '../core/db.memory.js';
import { validateEvent, createIdGenerator, EventError, buildEvent } from '../core/eventSchema.js';
import { DbError } from '../core/db.js';
import { makeClock, makeRng } from './_helpers.mjs';

const answer = (over = {}) => ({
  type: 'answer', itemId: 'g.pp.0001', cardId: 'g.pp.0001#0', topics: ['gram.present_perfect.for_since'], exerciseType: 'fix_error',
  result: 'wrong', rating: 1, ms: 8400, responseRaw: 'I live here since two years', errorCodes: ['TNS.SINCE_FOR'], mode: 'mech', channel: 'keyboard', ...over,
});

async function setup({ onWrite = null, disk, clock = makeClock(), rng = makeRng(7), idGen } = {}) {
  const db = createMemoryDb({ onWrite, disk });
  await db.open();
  const events = createEvents({ db, clock, rng, idGen });
  return { db, events, clock };
}
const all = (db) => db.query('events', {});

test('log guarda un evento completo (18 campos), con id, ts del reloj y day local, y devuelve una copia', async () => {
  const { db, events } = await setup();
  const saved = await events.log(answer());
  assert.equal(saved.ts, '2026-10-15T14:00:00.000Z');
  assert.match(saved.id, /^evt_20261015T1400_[a-z0-9]{4,}$/);
  assert.equal(saved.day.length, 10);
  assert.equal(Object.keys(saved).length, 18);
  assert.deepEqual(await db.get('events', saved.id), saved);
  assert.equal(validateEvent(saved, { stored: true }).ok, true);
  saved.topics.push('x'); // la copia devuelta no es la guardada
  assert.equal((await db.get('events', saved.id)).topics.length, 1);
});

test('el ts de la entrada manda sobre el reloj; sin ts se usa el reloj en el momento de la llamada', async () => {
  const { events, clock } = await setup();
  const a = await events.log(answer({ ts: '2026-01-02T03:04:05.678Z' }));
  assert.equal(a.ts, '2026-01-02T03:04:05.678Z');
  clock.advance(60000);
  const b = await events.log(answer());
  assert.equal(b.ts, '2026-10-15T14:01:00.000Z');
});

test('un evento inválido rechaza con EventError y no escribe nada', async () => {
  let writes = 0;
  const { db, events } = await setup({ onWrite: () => { writes += 1; } });
  const bad = [null, undefined, 5, 'x', [], {}, answer({ type: 'otro' }), answer({ id: 'evt_x' }), answer({ day: '2026-10-15' }), answer({ campoRaro: 1 }), answer({ result: 'bien' }), answer({ topics: [] })];
  for (const b of bad) {
    await assert.rejects(() => events.log(b), (e) => e instanceof EventError && e.code === 'BAD_EVENT' && e.problems.length > 0);
  }
  assert.equal(writes, 0);
  assert.equal((await all(db)).length, 0);
});

test('el error de un evento inválido no incluye el texto escrito por la persona', async () => {
  const { events } = await setup();
  await assert.rejects(() => events.log(answer({ result: 'ZZ-secreto-ZZ', responseRaw: 'ZZ-privado-ZZ' })), (e) => !e.message.includes('ZZ-secreto-ZZ') && !e.message.includes('ZZ-privado-ZZ'));
});

test('si la base falla (cuota), log rechaza con DbError QUOTA, no queda nada y el siguiente log funciona', async () => {
  let fail = true;
  const { db, events } = await setup({ onWrite: () => { if (fail) { const e = new Error('lleno'); e.name = 'QuotaExceededError'; throw e; } } });
  await assert.rejects(() => events.log(answer()), (e) => e instanceof DbError && e.code === 'QUOTA');
  assert.equal((await all(db)).length, 0);
  fail = false;
  const ok = await events.log(answer());
  assert.equal((await all(db)).length, 1);
  assert.equal((await all(db))[0].id, ok.id);
});

test('base cerrada o sin abrir → DbError con su código, no una excepción rara', async () => {
  const db = createMemoryDb();
  const events = createEvents({ db, clock: makeClock(), rng: makeRng(1) });
  await assert.rejects(() => events.log(answer()), (e) => e instanceof DbError && e.code === 'NOT_OPEN');
  await db.open(); await db.close();
  await assert.rejects(() => events.log(answer()), (e) => e instanceof DbError && e.code === 'CLOSED');
});

test('nunca pisa un evento existente: si el id ya está, toma otro y el viejo queda intacto', async () => {
  const { db } = await setup();
  const stolen = createIdGenerator({ rng: makeRng(3) }).next('2026-10-15T14:00:00.000Z'); // el id que producirá el primer log de abajo
  const donor = createEvents({ db, clock: makeClock(), idGen: createIdGenerator({ rng: makeRng(99) }) });
  const old = { ...(await donor.log(answer({ responseRaw: 'viejo' }))), id: stolen };
  await db.put('events', old);
  const events = createEvents({ db, clock: makeClock(), idGen: createIdGenerator({ rng: makeRng(3) }) });
  const fresh = await events.log(answer({ responseRaw: 'nuevo' }));
  assert.notEqual(fresh.id, stolen);
  assert.deepEqual(await db.get('events', stolen), old);
  assert.equal((await db.get('events', fresh.id)).responseRaw, 'nuevo');
  assert.equal((await all(db)).length, 3);
});

test(`si ${MAX_ID_TRIES} ids seguidos ya existen, rechaza con ABORTED y no cambia nada`, async () => {
  const { db } = await setup();
  const stub = { next: () => 'evt_20261015T1400_aaaa000', peek: () => 0 };
  const events = createEvents({ db, clock: makeClock(), idGen: stub });
  const first = await events.log(answer({ responseRaw: 'primero' }));
  assert.equal(first.id, 'evt_20261015T1400_aaaa000');
  let calls = 0;
  const stub2 = { next: () => { calls += 1; return 'evt_20261015T1400_aaaa000'; }, peek: () => 0 };
  const again = createEvents({ db, clock: makeClock(), idGen: stub2 });
  await assert.rejects(() => again.log(answer({ responseRaw: 'segundo' })), (e) => e instanceof DbError && e.code === 'ABORTED' && e.retryable === true);
  assert.equal(calls, MAX_ID_TRIES, 'un id al construir y MAX_ID_TRIES − 1 de reemplazo');
  const rows = await all(db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].responseRaw, 'primero');
});

test('dos instancias con el MISMO azar sobre la misma base no se pisan (100 eventos → 100 guardados)', async () => {
  const { db } = await setup();
  const a = createEvents({ db, clock: makeClock(), rng: makeRng(5) });
  const b = createEvents({ db, clock: makeClock(), rng: makeRng(5) });
  const jobs = [];
  for (let i = 0; i < 50; i += 1) { jobs.push(a.log(answer({ responseRaw: `a${i}` }))); jobs.push(b.log(answer({ responseRaw: `b${i}` }))); }
  const saved = await Promise.all(jobs);
  assert.equal(new Set(saved.map((e) => e.id)).size, 100);
  const rows = await all(db);
  assert.equal(rows.length, 100);
  assert.deepEqual(rows.map((r) => r.responseRaw).sort(), saved.map((e) => e.responseRaw).sort());
});

test('CA-2: 10.000 llamadas en el mismo ms producen 10.000 eventos con ids únicos en la base', async () => {
  const { db, events } = await setup();
  const t0 = Date.now();
  const saved = await Promise.all(Array.from({ length: 10000 }, (_, i) => events.log(answer({ ms: i }))));
  assert.equal(new Set(saved.map((e) => e.id)).size, 10000);
  assert.equal((await all(db)).length, 10000);
  assert.ok(Date.now() - t0 < 30000, 'terminó en un tiempo razonable');
});

test('cada log es atómico: si la escritura falla a mitad de una ráfaga, los demás eventos sí quedan y el fallido no', async () => {
  let n = 0;
  const { db, events } = await setup({ onWrite: () => { n += 1; if (n === 3) throw new Error('boom'); } });
  const results = await Promise.allSettled(Array.from({ length: 5 }, (_, i) => events.log(answer({ ms: i }))));
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 4);
  assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
  assert.equal((await all(db)).length, 4);
});

test('sobrevive a cerrar y reabrir: lo registrado sigue ahí y los ids nuevos no chocan', async () => {
  const disk = createMemoryDisk();
  const one = await setup({ disk });
  const a = await one.events.log(answer());
  await one.db.close();
  const two = await setup({ disk });
  const b = await two.events.log(answer());
  assert.notEqual(a.id, b.id);
  assert.equal((await all(two.db)).length, 2);
});

test('createEvents rechaza dependencias no válidas', () => {
  assert.throws(() => createEvents(), /db/);
  assert.throws(() => createEvents({ db: {} }), /db/);
  assert.throws(() => createEvents({ db: { tx() {} }, clock: {} }), /reloj/);
});

test('la zona horaria decide el day: un evento a las 02:00 UTC del 16 cuenta como día 15 en Bogotá', async () => {
  const prev = process.env.TZ;
  try {
    process.env.TZ = 'America/Bogota';
    const { events } = await setup({ clock: makeClock('2026-10-16T02:00:00.000Z') });
    const e = await events.log(answer());
    assert.equal(e.ts, '2026-10-16T02:00:00.000Z');
    assert.equal(e.day, '2026-10-15');
  } finally {
    if (prev === undefined) delete process.env.TZ; else process.env.TZ = prev;
  }
});

test('un fallo crudo de la base (no DbError) sale clasificado como DbError, nunca como excepción rara', async () => {
  const raw = new Error('algo raro');
  const events = createEvents({ db: { tx: async () => { throw raw; } }, clock: makeClock(), rng: makeRng(1) });
  await assert.rejects(() => events.log(answer()), (e) => e instanceof DbError && e.code === 'UNKNOWN' && e.cause === raw && e.store === 'events');
});

test('la transacción abarca SOLO el almacén events y el objeto devuelto no comparte nada con la entrada ni con la base', async () => {
  const seen = [];
  const { db } = await setup();
  const spy = { tx: (stores, fn) => { seen.push([...stores]); return db.tx(stores, fn); } };
  const events = createEvents({ db: spy, clock: makeClock(), rng: makeRng(2) });
  const src = answer();
  const saved = await events.log(src);
  assert.deepEqual(seen, [['events']]);
  assert.notEqual(saved.topics, src.topics);
  saved.topics.push('x'); saved.errorCodes.length = 0;
  assert.deepEqual((await db.get('events', saved.id)).errorCodes, ['TNS.SINCE_FOR']);
  assert.equal(src.topics.length, 1);
});

test('modo "solo memoria" (sin IndexedDB): log funciona con la base que elige openDatabase', async () => {
  const { openDatabase } = await import('../core/dbOpen.js');
  const res = await openDatabase({ name: 'sophia-test', factory: null });
  assert.equal(res.mode, 'memory');
  assert.equal(res.persistent, false);
  const events = createEvents({ db: res.db, clock: makeClock(), rng: makeRng(4) });
  const saved = await events.log(answer());
  assert.deepEqual(await res.db.get('events', saved.id), saved);
  await res.db.close();
});

// ---------- Consultas: lo que no depende del motor ----------
const ev = (id, ts, over = {}) => ({ id, ts, day: ts.slice(0, 10), type: 'answer', sessionId: null, cardId: 'a.b.0001#0', itemId: 'a.b.0001', topics: ['t.x'], exerciseType: 'fix_error', result: 'correct', rating: 3, ms: 1, hint: false, dontKnow: false, responseRaw: null, errorCodes: [], mode: 'mech', channel: 'keyboard', ...over });

test('las consultas ordenan por ts y luego por id aunque el motor devuelva las filas desordenadas', async () => {
  const rows = [
    ev('evt_20261015T1403_0001aaa', '2026-10-15T14:03:30.000Z'), // mismo minuto, ts posterior pero id anterior
    ev('evt_20261015T1403_0002aaa', '2026-10-15T14:03:10.000Z'),
    ev('evt_20261015T1403_0004aaa', '2026-10-15T14:03:10.000Z'), // empate de ts con el anterior: manda el id
    ev('evt_20261015T1403_0003aaa', '2026-10-15T14:03:10.000Z'),
    ev('evt_20261015T1402_0009zzz', '2026-10-15T14:02:59.999Z'),
  ];
  const scrambled = [rows[3], rows[0], rows[4], rows[2], rows[1]];
  const db = { tx: async () => undefined, query: async () => scrambled.map((r) => structuredClone(r)) };
  const events = createEvents({ db, clock: makeClock(), rng: makeRng(1) });
  const want = ['evt_20261015T1402_0009zzz', 'evt_20261015T1403_0002aaa', 'evt_20261015T1403_0003aaa', 'evt_20261015T1403_0004aaa', 'evt_20261015T1403_0001aaa'];
  for (const q of [() => events.byCard('a.b.0001#0'), () => events.byItem('a.b.0001'), () => events.byTopic('t.x')]) {
    assert.deepEqual((await q()).map((r) => r.id), want);
  }
  assert.deepEqual((await events.byItem('a.b.0001', { order: 'desc' })).map((r) => r.id), want.slice().reverse());
  assert.deepEqual((await events.byItem('a.b.0001', { order: 'desc', limit: 2 })).map((r) => r.id), want.slice().reverse().slice(0, 2));
});

test('un fallo crudo de la base en una consulta sale como DbError clasificado', async () => {
  const raw = new Error('boom');
  const events = createEvents({ db: { tx: async () => undefined, query: async () => { throw raw; } }, clock: makeClock(), rng: makeRng(1) });
  for (const call of [() => events.byCard('a#0'), () => events.byItem('a'), () => events.byTopic('a'), () => events.since('2026-10-15T14:00:00.000Z')]) {
    await assert.rejects(call, (e) => e instanceof DbError && e.code === 'UNKNOWN' && e.cause === raw && e.store === 'events');
  }
});

// ---------- countByDay y recentErrorsByCode: lo que no depende del motor (cuarto 3, mitad B) ----------
const spyDb = (rows = []) => {
  const calls = [];
  return { calls, db: { tx: async () => undefined, query: async (store, opts) => { calls.push([store, structuredClone(opts)]); return rows.map((r) => structuredClone(r)); } } };
};

test('CA-4: countByDay y recentErrorsByCode hacen UNA consulta por índice con rango y nunca recorren el almacén sin índice', async () => {
  const { calls, db } = spyDb();
  const events = createEvents({ db, clock: makeClock(), rng: makeRng(1) });
  await events.countByDay({ from: '2026-10-10', to: '2026-10-12' });
  await events.countByDay({ from: '2026-10-10' });
  await events.countByDay({ to: '2026-10-12' });
  await events.countByDay({});
  await events.recentErrorsByCode('TNS.SINCE_FOR', { since: '2026-10-15T14:00:00.000Z' });
  await events.recentErrorsByCode('TNS.SINCE_FOR', { since: new Date('2026-10-15T14:00:00.000Z'), order: 'desc', limit: 3 });
  assert.deepEqual(calls, [
    ['events', { index: 'day', range: { gte: '2026-10-10', lte: '2026-10-12' } }],
    ['events', { index: 'day', range: { gte: '2026-10-10' } }],
    ['events', { index: 'day', range: { lte: '2026-10-12' } }],
    ['events', { index: 'day' }],
    ['events', { index: 'ts', range: { gte: '2026-10-15T14:00:00.000Z' } }],
    ['events', { index: 'ts', range: { gte: '2026-10-15T14:00:00.000Z' } }],
  ]);
});

test('un argumento no válido en countByDay o recentErrorsByCode no llega a tocar la base', async () => {
  const { calls, db } = spyDb();
  const events = createEvents({ db, clock: makeClock(), rng: makeRng(1) });
  const bad = (e) => e instanceof DbError && e.code === 'BAD_QUERY';
  await assert.rejects(() => events.countByDay(), bad);
  await assert.rejects(() => events.countByDay({ from: '2026-02-29' }), bad); // 2026 no es bisiesto
  await assert.rejects(() => events.countByDay({ from: '2026-10-12', to: '2026-10-11' }), bad);
  await assert.rejects(() => events.recentErrorsByCode('TNS.SINCE_FOR'), bad);
  await assert.rejects(() => events.recentErrorsByCode('', { since: 0 }), bad);
  assert.deepEqual(calls, []);
  assert.deepEqual(await events.countByDay({ from: '2028-02-29', to: '2028-02-29' }), {}); // 2028 sí lo es: es un día real
  assert.equal(calls.length, 1);
});

test('countByDay agrupa bien aunque el motor devuelva las filas desordenadas, y deja las claves en orden cronológico', async () => {
  const rows = [
    ev('evt_20261015T1403_0001aaa', '2026-10-15T14:03:00.000Z', { day: '2026-10-15' }),
    ev('evt_20261012T1000_0002aaa', '2026-10-12T10:00:00.000Z', { day: '2026-10-12' }),
    ev('evt_20261015T1404_0003aaa', '2026-10-15T14:04:00.000Z', { day: '2026-10-15' }),
    ev('evt_20261009T0900_0004aaa', '2026-10-09T09:00:00.000Z', { day: '2026-10-09' }),
    ev('evt_20261015T1405_0005aaa', '2026-10-15T14:05:00.000Z', { day: '2026-10-15' }),
  ];
  const events = createEvents({ db: spyDb(rows).db, clock: makeClock(), rng: makeRng(1) });
  const res = await events.countByDay({});
  assert.deepEqual(res, { '2026-10-09': 1, '2026-10-12': 1, '2026-10-15': 3 });
  assert.deepEqual(Object.keys(res), ['2026-10-09', '2026-10-12', '2026-10-15']);
  assert.equal(Object.getPrototypeOf(res), Object.prototype);
});

test('recentErrorsByCode filtra, ordena y recorta aunque el motor devuelva todo desordenado, y tolera filas sin errorCodes', async () => {
  const rows = [
    ev('evt_20261015T1403_0003aaa', '2026-10-15T14:03:10.000Z', { errorCodes: ['A.B'] }),
    ev('evt_20261015T1401_0001aaa', '2026-10-15T14:01:00.000Z', { errorCodes: ['A.B', 'C.D'] }),
    ev('evt_20261015T1402_0002aaa', '2026-10-15T14:02:00.000Z', { errorCodes: [] }),
    { ...ev('evt_20261015T1404_0004aaa', '2026-10-15T14:04:00.000Z'), errorCodes: undefined },
    ev('evt_20261015T1403_0002bbb', '2026-10-15T14:03:10.000Z', { errorCodes: ['A.B'] }), // empate de ts con el primero: manda el id
    ev('evt_20261015T1405_0005aaa', '2026-10-15T14:05:00.000Z', { errorCodes: ['C.D'] }),
  ];
  const events = createEvents({ db: spyDb(rows).db, clock: makeClock(), rng: makeRng(1) });
  const since = '2026-10-15T14:00:00.000Z';
  const want = ['evt_20261015T1401_0001aaa', 'evt_20261015T1403_0002bbb', 'evt_20261015T1403_0003aaa'];
  assert.deepEqual((await events.recentErrorsByCode('A.B', { since })).map((r) => r.id), want);
  assert.deepEqual((await events.recentErrorsByCode('A.B', { since, order: 'desc', limit: 2 })).map((r) => r.id), want.slice().reverse().slice(0, 2));
  assert.deepEqual((await events.recentErrorsByCode('C.D', { since })).map((r) => r.id), ['evt_20261015T1401_0001aaa', 'evt_20261015T1405_0005aaa']);
});

test('un fallo crudo de la base en countByDay o recentErrorsByCode sale como DbError clasificado', async () => {
  const raw = new Error('boom');
  const events = createEvents({ db: { tx: async () => undefined, query: async () => { throw raw; } }, clock: makeClock(), rng: makeRng(1) });
  for (const call of [() => events.countByDay({}), () => events.recentErrorsByCode('A.B', { since: 0 })]) {
    await assert.rejects(call, (e) => e instanceof DbError && e.code === 'UNKNOWN' && e.cause === raw && e.store === 'events');
  }
});

// Cada fila: [zona, instante UTC, día local esperado]. Incluye extremos del huso (+14, −11) y el cambio de hora de Nueva York (1 de noviembre de 2026: 25 horas).
const DAY_CASES = [
  ['America/Bogota', '2026-10-16T02:00:00.000Z', '2026-10-15'],
  ['America/Bogota', '2026-10-16T05:00:00.000Z', '2026-10-16'],
  ['Pacific/Kiritimati', '2026-10-15T09:59:59.999Z', '2026-10-15'],
  ['Pacific/Kiritimati', '2026-10-15T10:00:00.000Z', '2026-10-16'],
  ['Pacific/Pago_Pago', '2026-10-16T10:59:59.999Z', '2026-10-15'],
  ['Pacific/Pago_Pago', '2026-10-16T11:00:00.000Z', '2026-10-16'],
  ['America/New_York', '2026-11-01T03:59:59.999Z', '2026-10-31'],
  ['America/New_York', '2026-11-01T04:00:00.000Z', '2026-11-01'],
  ['America/New_York', '2026-11-01T05:30:00.000Z', '2026-11-01'], // 01:30 EDT
  ['America/New_York', '2026-11-01T06:30:00.000Z', '2026-11-01'], // 01:30 EST (la misma hora de reloj otra vez)
  ['America/New_York', '2026-11-02T04:59:59.999Z', '2026-11-01'],
  ['America/New_York', '2026-11-02T05:00:00.000Z', '2026-11-02'],
];

test('countByDay respeta el día LOCAL: extremos de zona horaria, medianoche y cambio de hora (cada zona se prueba por separado)', async () => {
  const prev = process.env.TZ;
  try {
    for (const zone of [...new Set(DAY_CASES.map((c) => c[0]))]) {
      process.env.TZ = zone;
      const { events } = await setup();
      const cases = DAY_CASES.filter((c) => c[0] === zone);
      const want = {};
      for (const [, ts, day] of cases) { await events.log(answer({ ts })); want[day] = (want[day] ?? 0) + 1; }
      const sorted = Object.fromEntries(Object.entries(want).sort(([a], [b]) => (a < b ? -1 : 1)));
      assert.deepEqual(await events.countByDay({}), sorted, zone);
      // from/to con Date: se convierten al día local de ESA zona, no al día UTC.
      for (const [, ts, day] of cases) {
        assert.deepEqual(await events.countByDay({ from: new Date(ts), to: new Date(ts) }), { [day]: want[day] }, `${zone} ${ts}`);
      }
    }
  } finally {
    if (prev === undefined) delete process.env.TZ; else process.env.TZ = prev;
  }
});

// ---------- Inmutabilidad y borrar todo: lo que no depende del motor (cuarto 4, mitad A) ----------
test('clearAll es atómico: si la base falla al confirmar, no se borra NINGÚN evento y rechaza con el error clasificado', async () => {
  let fail = false;
  const { db, events } = await setup({ onWrite: () => { if (fail) { const e = new Error('lleno'); e.name = 'QuotaExceededError'; throw e; } } });
  for (let i = 0; i < 12; i += 1) await events.log(answer({ responseRaw: `r${i}` }));
  const before = await all(db);
  fail = true;
  await assert.rejects(() => events.clearAll(), (e) => e instanceof DbError && e.code === 'QUOTA');
  fail = false;
  assert.deepEqual(await all(db), before);
  assert.equal(await events.clearAll(), 12); // y cuando la base vuelve a funcionar, borra todo
});

test('clearAll hace UNA transacción sobre `events` y nada más', async () => {
  const calls = [];
  const real = createMemoryDb();
  await real.open();
  const spy = { ...real, tx: (stores, fn) => { calls.push(stores); return real.tx(stores, fn); }, query: real.query, get: real.get };
  const events = createEvents({ db: spy, clock: makeClock(), rng: makeRng(5) });
  await events.log(answer());
  calls.length = 0;
  await events.clearAll();
  assert.deepEqual(calls, [['events']]);
});

test('un fallo crudo en clearAll sale como DbError clasificado con la causa original', async () => {
  const raw = new Error('boom');
  const events = createEvents({ db: { tx: async () => { throw raw; } }, clock: makeClock(), rng: makeRng(1) });
  await assert.rejects(() => events.clearAll(), (e) => e instanceof DbError && e.code === 'UNKNOWN' && e.cause === raw && e.store === 'events');
});

test('clearAll con 10.000 eventos los borra todos (una sola transacción)', async () => {
  const { db, events } = await setup({ rng: makeRng(11) });
  const idGen = createIdGenerator({ rng: makeRng(12) });
  await db.tx(['events'], async (t) => {
    for (let i = 0; i < 10000; i += 1) {
      const ts = new Date(Date.UTC(2026, 9, 1, 0, 0, 0) + i * 61000).toISOString();
      await t.put('events', buildEvent(answer({ ts }), { now: new Date(ts), idGen }));
    }
  });
  assert.equal(await db.count('events', {}), 10000);
  assert.equal(await events.clearAll(), 10000);
  assert.equal(await db.count('events', {}), 0);
});
