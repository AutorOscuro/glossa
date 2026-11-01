// @purpose: Contrato de events.log() sobre un motor de base, compartido por la prueba en memoria y la de IndexedDB real; ayudante, no es una prueba.
// Contrato de events.log() sobre un motor de base (subparte 1.1, cuarto 2 mitad B). No es una prueba por sí mismo:
// lo corren tests/events.contract.test.mjs (motor en memoria, en Node) y tests/browser/events-idb.entry.js (IndexedDB real, en Chromium).
//   runEventsContract({ label, newDisk(), create(disk) → db sin abrir, volume, queryVolume, perfBudgetMs })
//     volume        cuántas llamadas a log() en el mismo ms (CA-2).
//     queryVolume   eventos sembrados para la prueba de volumen de las consultas (CA-4; 50.000 por defecto).
//     perfBudgetMs  tope de tiempo de las consultas con ventana de 14 días (null = solo se documenta el tiempo; se usa en IndexedDB real).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEvents } from '../core/events.js';
import { validateEvent, createIdGenerator, buildEvent, EVENT_TYPES } from '../core/eventSchema.js';
import { DbError } from '../core/db.js';
import { makeClock, makeRng } from './_helpers.mjs';

const answer = (over = {}) => ({
  type: 'answer', itemId: 'g.pp.0001', cardId: 'g.pp.0001#0', topics: ['gram.present_perfect.for_since', 'gram.tense'], exerciseType: 'fix_error',
  result: 'wrong', rating: 1, ms: 8400, responseRaw: 'I live here since dos años ñandú 😀', errorCodes: ['TNS.SINCE_FOR'], mode: 'mech', channel: 'keyboard', ...over,
});

export function runEventsContract({ label, newDisk, create, volume = 2000, queryVolume = 50000, perfBudgetMs = null }) {
  const t = (name, fn) => test(`[${label}] ${name}`, fn);
  const open = async (disk, { seed = 7, clock = makeClock() } = {}) => {
    const db = create(disk);
    await db.open();
    return { db, events: createEvents({ db, clock, rng: makeRng(seed) }) };
  };

  t('log guarda un evento válido y completo, y los índices lo encuentran', async () => {
    const { db, events } = await open(newDisk());
    try {
      const saved = await events.log(answer());
      assert.deepEqual(await db.get('events', saved.id), saved);
      assert.equal(validateEvent(saved, { stored: true }).ok, true);
      assert.deepEqual((await db.query('events', { index: 'itemId', value: 'g.pp.0001' })).map((e) => e.id), [saved.id]);
      assert.deepEqual((await db.query('events', { index: 'topics', value: 'gram.tense' })).map((e) => e.id), [saved.id]);
      assert.deepEqual((await db.query('events', { index: 'day', value: saved.day })).map((e) => e.id), [saved.id]);
    } finally { await db.close(); }
  });

  t('un evento inválido no escribe nada', async () => {
    const { db, events } = await open(newDisk());
    try {
      await assert.rejects(() => events.log(answer({ result: 'bien' })), (e) => e.code === 'BAD_EVENT');
      assert.equal(await db.count('events', {}), 0);
    } finally { await db.close(); }
  });

  t('nunca pisa un evento existente: si el id está ocupado toma otro y el viejo queda intacto', async () => {
    const disk = newDisk();
    const { db } = await open(disk);
    try {
      const stolen = createIdGenerator({ rng: makeRng(3) }).next('2026-10-15T14:00:00.000Z');
      const donor = createEvents({ db, clock: makeClock(), idGen: createIdGenerator({ rng: makeRng(99) }) });
      const old = { ...(await donor.log(answer({ responseRaw: 'viejo' }))), id: stolen };
      await db.put('events', old);
      const events = createEvents({ db, clock: makeClock(), idGen: createIdGenerator({ rng: makeRng(3) }) });
      const fresh = await events.log(answer({ responseRaw: 'nuevo' }));
      assert.notEqual(fresh.id, stolen);
      assert.deepEqual(await db.get('events', stolen), old);
      assert.equal(await db.count('events', {}), 3);
    } finally { await db.close(); }
  });

  t('dos instancias con el MISMO azar sobre la misma base no se pisan', async () => {
    const { db } = await open(newDisk());
    try {
      const a = createEvents({ db, clock: makeClock(), rng: makeRng(5) });
      const b = createEvents({ db, clock: makeClock(), rng: makeRng(5) });
      const jobs = [];
      for (let i = 0; i < 40; i += 1) { jobs.push(a.log(answer({ responseRaw: `a${i}` }))); jobs.push(b.log(answer({ responseRaw: `b${i}` }))); }
      const saved = await Promise.all(jobs);
      assert.equal(new Set(saved.map((e) => e.id)).size, 80);
      assert.equal(await db.count('events', {}), 80);
    } finally { await db.close(); }
  });

  t('un volumen de llamadas en el mismo ms deja ese número de eventos con ids únicos', async () => {
    const { db, events } = await open(newDisk());
    try {
      const saved = await Promise.all(Array.from({ length: volume }, (_, i) => events.log(answer({ ms: i }))));
      assert.equal(new Set(saved.map((e) => e.id)).size, volume);
      assert.equal(await db.count('events', {}), volume);
    } finally { await db.close(); }
  });

  t('cerrar y reabrir conserva lo registrado y los ids nuevos no chocan', async () => {
    const disk = newDisk();
    const one = await open(disk);
    const a = await one.events.log(answer());
    await one.db.close();
    const two = await open(disk);
    try {
      const b = await two.events.log(answer());
      assert.notEqual(a.id, b.id);
      assert.equal(await two.db.count('events', {}), 2);
      assert.deepEqual(await two.db.get('events', a.id), a);
    } finally { await two.db.close(); }
  });

  t('con la base cerrada, log rechaza con DbError CLOSED y no lanza otra cosa', async () => {
    const { db, events } = await open(newDisk());
    await db.close();
    await assert.rejects(() => events.log(answer()), (e) => e instanceof DbError && e.code === 'CLOSED');
  });

  // ---------- Consultas (cuarto 3, mitad A) ----------
  const T = (min, sec = 0, ms = 0) => `2026-10-15T14:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms).padStart(3, '0')}Z`;
  // Siembra fuera de orden cronológico a propósito: a=14:05, b=14:01, c=14:03, d=14:03 (empate con c), e=14:02, f=14:04 (note sin card/item/topics).
  async function seed() {
    const ctx = await open(newDisk());
    const { events } = ctx;
    const mk = (over) => events.log(answer(over));
    const a = await mk({ ts: T(5), cardId: 'g.pp.0001#0', itemId: 'g.pp.0001', topics: ['gram.pp', 'gram.tense'] });
    const b = await mk({ ts: T(1), cardId: 'g.pp.0001#0', itemId: 'g.pp.0001', topics: ['gram.pp'] });
    const c = await mk({ ts: T(3), cardId: 'g.pp.0001#1', itemId: 'g.pp.0001', topics: ['gram.tense'] });
    const d = await mk({ ts: T(3), cardId: 'g.pp.0001#0', itemId: 'g.pp.0001', topics: ['gram.pp'] });
    const e = await mk({ ts: T(2), cardId: 'v.run.0001#0', itemId: 'v.run.0001', topics: ['vocab.run'] });
    const f = await events.log({ type: 'note', ts: T(4), responseRaw: 'sin tarjeta ni tema' });
    return { ...ctx, a, b, c, d, e, f };
  }
  const ids = (rows) => rows.map((r) => r.id);
  const byTs = (...evs) => evs.slice().sort((x, y) => (x.ts < y.ts ? -1 : x.ts > y.ts ? 1 : x.id < y.id ? -1 : 1));

  t('byCard devuelve solo los eventos de esa tarjeta, en orden cronológico (empate por id), aunque se guardaran desordenados', async () => {
    const { db, events, a, b, d } = await seed();
    try {
      assert.deepEqual(ids(await events.byCard('g.pp.0001#0')), ids(byTs(a, b, d)));
      assert.deepEqual((await events.byCard('g.pp.0001#0')).map((r) => r.ts), [T(1), T(3), T(5)]);
      assert.deepEqual(await events.byCard('no.existe#0'), []);
    } finally { await db.close(); }
  });

  t('byItem agrupa todas las facetas del ítem y byTopic encuentra un evento en CADA uno de sus temas', async () => {
    const { db, events, a, b, c, d } = await seed();
    try {
      assert.deepEqual(ids(await events.byItem('g.pp.0001')), ids(byTs(a, b, c, d)));
      assert.deepEqual(ids(await events.byTopic('gram.pp')), ids(byTs(a, b, d)));
      assert.deepEqual(ids(await events.byTopic('gram.tense')), ids(byTs(a, c)));
      assert.deepEqual(await events.byTopic('gram.nada'), []);
    } finally { await db.close(); }
  });

  t('un evento sin cardId, itemId ni temas (null) no aparece en byCard/byItem/byTopic, pero sí en since', async () => {
    const { db, events, f } = await seed();
    try {
      for (const rows of [await events.byCard('g.pp.0001#0'), await events.byItem('g.pp.0001'), await events.byTopic('gram.pp'), await events.byTopic('vocab.run')]) {
        assert.ok(!ids(rows).includes(f.id));
      }
      assert.ok(ids(await events.since(T(0))).includes(f.id));
    } finally { await db.close(); }
  });

  t("order 'desc' invierte exacto el orden y limit se aplica DESPUÉS de ordenar (los más recientes)", async () => {
    const { db, events, a, b, c, d } = await seed();
    try {
      const asc = ids(byTs(a, b, c, d));
      assert.deepEqual(ids(await events.byItem('g.pp.0001', { order: 'desc' })), asc.slice().reverse());
      assert.deepEqual(ids(await events.byItem('g.pp.0001', { order: 'desc', limit: 2 })), asc.slice().reverse().slice(0, 2));
      assert.deepEqual(ids(await events.byItem('g.pp.0001', { limit: 3 })), asc.slice(0, 3));
      assert.deepEqual(await events.byItem('g.pp.0001', { limit: 0 }), []);
      assert.deepEqual(ids(await events.byItem('g.pp.0001', { limit: 99 })), asc);
    } finally { await db.close(); }
  });

  t('since es INCLUSIVO, acepta Date, milisegundos y texto ISO, y respeta order y limit', async () => {
    const { db, events, a, b, c, d, e, f } = await seed();
    try {
      const all = byTs(a, b, c, d, e, f);
      const from3 = all.filter((x) => x.ts >= T(3));
      assert.deepEqual(ids(await events.since(T(3))), ids(from3));
      assert.deepEqual(ids(await events.since(new Date(T(3)))), ids(from3));
      assert.deepEqual(ids(await events.since(Date.parse(T(3)))), ids(from3));
      assert.deepEqual(ids(await events.since(T(3, 0, 1))), ids(all.filter((x) => x.ts > T(3))));
      assert.deepEqual(ids(await events.since(T(0))), ids(all));
      assert.deepEqual(await events.since(T(59)), []);
      assert.deepEqual(ids(await events.since(T(0), { order: 'desc', limit: 2 })), ids(all.slice().reverse().slice(0, 2)));
      assert.deepEqual(ids(await events.since(T(0), { limit: 2 })), ids(all.slice(0, 2)));
      assert.deepEqual(ids(await events.since(T(0), { order: 'desc' })), ids(all.slice().reverse())); // incluye el empate de c y d
    } finally { await db.close(); }
  });

  t('las consultas devuelven copias: modificar el resultado no cambia lo guardado', async () => {
    const { db, events, a } = await seed();
    try {
      const rows = await events.byCard('g.pp.0001#0');
      rows[0].topics.push('x'); rows[0].responseRaw = 'cambiado'; rows.length = 0;
      assert.deepEqual(await db.get('events', a.id), a);
      assert.equal((await events.byCard('g.pp.0001#0')).length, 3);
    } finally { await db.close(); }
  });

  t('argumentos no válidos rechazan con BAD_QUERY (nunca devuelven todo en silencio)', async () => {
    const { db, events } = await seed();
    const bad = (e) => e instanceof DbError && e.code === 'BAD_QUERY';
    try {
      for (const fn of [events.byCard, events.byItem, events.byTopic]) {
        for (const v of ['', null, undefined, 5, {}, ['a']]) await assert.rejects(() => fn(v), bad);
        for (const o of [{ foo: 1 }, { order: 'x' }, { order: 5 }, { limit: -1 }, { limit: 1.5 }, { limit: '2' }, { limit: NaN }, 'asc', ['asc']]) await assert.rejects(() => fn('g.pp.0001', o), bad);
      }
      for (const v of ['hola', '', null, undefined, NaN, {}, new Date('x')]) await assert.rejects(() => events.since(v), bad);
      await assert.rejects(() => events.since(T(1), { limite: 1 }), bad);
      await assert.rejects(() => events.since(T(1), { order: 'up' }), bad);
    } finally { await db.close(); }
  });

  t('con la base cerrada las consultas rechazan con DbError CLOSED', async () => {
    const { db, events } = await open(newDisk());
    await db.close();
    for (const call of [() => events.byCard('a#0'), () => events.byItem('a'), () => events.byTopic('a'), () => events.since(T(0))]) {
      await assert.rejects(call, (e) => e instanceof DbError && e.code === 'CLOSED');
    }
  });

  // ---------- countByDay y recentErrorsByCode (cuarto 3, mitad B) ----------
  // Horas LOCALES a propósito: el día que cuenta es el del dispositivo, así que las pruebas no dependen de la zona horaria de quien las corre.
  const at = (day, h = 12, m = 0, sec = 0, ms = 0) => new Date(2026, 9, day, h, m, sec, ms).toISOString();
  const D = (day) => `2026-10-${String(day).padStart(2, '0')}`;
  const badQ = (e) => e instanceof DbError && e.code === 'BAD_QUERY';
  // Día 10: 3 eventos de tipos distintos · 11: ninguno · 12: 2 (uno a las 00:00 exactas) · 13: 1 (23:59:59.999) · 14: 1 (00:00 exactas). Se guardan desordenados.
  async function seedDays() {
    const ctx = await open(newDisk());
    const { events } = ctx;
    await events.log(answer({ ts: at(12, 9) }));
    await events.log(answer({ ts: at(10, 18, 30) }));
    await events.log({ type: 'note', ts: at(13, 23, 59, 59, 999), responseRaw: 'casi medianoche' });
    await events.log(answer({ ts: at(14, 0, 0, 0, 0) }));
    await events.log({ type: 'session_start', ts: at(10, 23, 59), sessionId: 'ses_1' });
    await events.log(answer({ ts: at(12, 0, 0, 0, 0) }));
    await events.log(answer({ ts: at(10, 12) }));
    return ctx;
  }
  const ALL_DAYS = { [D(10)]: 3, [D(12)]: 2, [D(13)]: 1, [D(14)]: 1 };

  t('countByDay({}) cuenta TODOS los eventos por día local, sin días vacíos y con las claves en orden cronológico', async () => {
    const { db, events } = await seedDays();
    try {
      const res = await events.countByDay({});
      assert.deepEqual(res, ALL_DAYS);
      assert.deepEqual(Object.keys(res), [D(10), D(12), D(13), D(14)]);
      assert.ok(!(D(11) in res));
      assert.deepEqual(await events.countByDay({ from: D(15) }), {});
    } finally { await db.close(); }
  });

  t('countByDay: from y to son INCLUSIVOS, cada uno es opcional, y el borde de medianoche separa los días', async () => {
    const { db, events } = await seedDays();
    try {
      assert.deepEqual(await events.countByDay({ from: D(12), to: D(13) }), { [D(12)]: 2, [D(13)]: 1 });
      assert.deepEqual(await events.countByDay({ from: D(12), to: D(12) }), { [D(12)]: 2 });
      assert.deepEqual(await events.countByDay({ from: D(13) }), { [D(13)]: 1, [D(14)]: 1 });
      assert.deepEqual(await events.countByDay({ to: D(11) }), { [D(10)]: 3 });
      assert.deepEqual(await events.countByDay({ from: D(11), to: D(11) }), {});
      assert.deepEqual(await events.countByDay({ from: D(1), to: D(9) }), {});
      assert.deepEqual(await events.countByDay({ from: undefined, to: undefined }), ALL_DAYS);
      // 23:59:59.999 del 13 y 00:00:00.000 del 14 son días distintos.
      assert.deepEqual(await events.countByDay({ from: D(13), to: D(13) }), { [D(13)]: 1 });
      assert.deepEqual(await events.countByDay({ from: D(14), to: D(14) }), { [D(14)]: 1 });
    } finally { await db.close(); }
  });

  t('countByDay acepta Date y milisegundos (se pasan al día LOCAL) igual que el texto AAAA-MM-DD', async () => {
    const { db, events } = await seedDays();
    try {
      const want = { [D(12)]: 2, [D(13)]: 1 };
      assert.deepEqual(await events.countByDay({ from: new Date(2026, 9, 12, 20, 0), to: new Date(2026, 9, 13, 3, 0) }), want);
      assert.deepEqual(await events.countByDay({ from: new Date(2026, 9, 12, 20, 0).getTime(), to: new Date(2026, 9, 13, 3, 0).getTime() }), want);
      assert.deepEqual(await events.countByDay({ from: D(12), to: new Date(2026, 9, 13, 3, 0) }), want);
    } finally { await db.close(); }
  });

  t('countByDay cuenta por el campo `day` guardado: un evento registrado en otra zona horaria no se reubica', async () => {
    const { db, events } = await open(newDisk());
    try {
      const saved = await events.log(answer({ ts: at(10, 12) }));
      await db.put('events', { ...saved, day: D(20) }); // como si se hubiera registrado en otra zona y ese fuera su día
      assert.deepEqual(await events.countByDay({}), { [D(20)]: 1 });
      assert.deepEqual(await events.countByDay({ from: D(10), to: D(10) }), {});
    } finally { await db.close(); }
  });

  t('countByDay devuelve un objeto nuevo en cada llamada (modificarlo no cambia nada)', async () => {
    const { db, events } = await seedDays();
    try {
      const a = await events.countByDay({});
      a[D(10)] = 99; delete a[D(12)];
      assert.deepEqual(await events.countByDay({}), ALL_DAYS);
    } finally { await db.close(); }
  });

  t('countByDay con argumentos no válidos rechaza con BAD_QUERY (nunca cuenta todo en silencio)', async () => {
    const { db, events } = await seedDays();
    try {
      for (const r of [undefined, null, 5, 'x', [], true]) await assert.rejects(() => events.countByDay(r), badQ);
      for (const r of [
        { from: 'hoy' }, { from: '2026-02-30' }, { from: '2026-13-01' }, { from: '2026-00-10' }, { from: '2026-1-1' }, { from: '20261010' },
        { from: '2026-10-14T00:00:00Z' }, { from: '' }, { from: null }, { to: null }, { from: {} }, { from: [] }, { to: false }, { from: NaN }, { to: new Date('x') },
        { desde: D(10) }, { from: D(10), hasta: D(12) }, { from: D(14), to: D(10) },
      ]) await assert.rejects(() => events.countByDay(r), badQ);
    } finally { await db.close(); }
  });

  t('con la base cerrada countByDay y recentErrorsByCode rechazan con DbError CLOSED', async () => {
    const { db, events } = await open(newDisk());
    await db.close();
    for (const call of [() => events.countByDay({}), () => events.recentErrorsByCode('TNS.SINCE_FOR', { since: T(0) })]) {
      await assert.rejects(call, (e) => e instanceof DbError && e.code === 'CLOSED');
    }
  });

  // Errores: a=14:01 [SINCE_FOR] · b=14:02 [SINCE_FOR, AT_IN] · c=14:03 [AT_IN] · d=14:03 (empate con c) [SINCE_FOR] · e=14:04 [] · f=14:05 nota (sin errorCodes) · g=14:06 [SINCE_FOR]. Desordenados.
  async function seedErrors() {
    const ctx = await open(newDisk());
    const { events } = ctx;
    const mk = (over) => events.log(answer(over));
    const g = await mk({ ts: T(6), errorCodes: ['TNS.SINCE_FOR'] });
    const a = await mk({ ts: T(1), errorCodes: ['TNS.SINCE_FOR'] });
    const c = await mk({ ts: T(3), errorCodes: ['PREP.AT_IN'] });
    const e = await mk({ ts: T(4), result: 'correct', rating: 3, errorCodes: [] });
    const b = await mk({ ts: T(2), errorCodes: ['TNS.SINCE_FOR', 'PREP.AT_IN'] });
    const d = await mk({ ts: T(3), errorCodes: ['TNS.SINCE_FOR'] });
    const f = await events.log({ type: 'note', ts: T(5), responseRaw: 'sin errores' });
    return { ...ctx, a, b, c, d, e, f, g };
  }

  t('recentErrorsByCode devuelve solo los eventos con ese código (una vez cada uno), en orden cronológico con empate por id', async () => {
    const { db, events, a, b, c, d, g } = await seedErrors();
    try {
      const since = T(0);
      assert.deepEqual(ids(await events.recentErrorsByCode('TNS.SINCE_FOR', { since })), ids(byTs(a, b, d, g)));
      assert.deepEqual(ids(await events.recentErrorsByCode('PREP.AT_IN', { since })), ids(byTs(b, c))); // b trae dos códigos y sale en ambas consultas
      assert.deepEqual(await events.recentErrorsByCode('NO.EXISTE', { since }), []);
      for (const partial of ['TNS', 'TNS.SINCE', 'TNS.SINCE_FOR_X', 'tns.since_for', 'AT_IN']) assert.deepEqual(await events.recentErrorsByCode(partial, { since }), []); // el código es exacto: ni prefijos ni otra mayúscula
      assert.deepEqual(await events.recentErrorsByCode('TNS.SINCE_FOR', { since: T(59) }), []);
    } finally { await db.close(); }
  });

  t('recentErrorsByCode: since es INCLUSIVO, acepta Date, milisegundos y texto ISO', async () => {
    const { db, events, a, b, d, g } = await seedErrors();
    try {
      const code = 'TNS.SINCE_FOR';
      assert.deepEqual(ids(await events.recentErrorsByCode(code, { since: T(3) })), ids(byTs(d, g)));
      assert.deepEqual(ids(await events.recentErrorsByCode(code, { since: new Date(T(3)) })), ids(byTs(d, g)));
      assert.deepEqual(ids(await events.recentErrorsByCode(code, { since: Date.parse(T(3)) })), ids(byTs(d, g)));
      assert.deepEqual(ids(await events.recentErrorsByCode(code, { since: T(3, 0, 1) })), ids([g]));
      assert.deepEqual(ids(await events.recentErrorsByCode(code, { since: T(1) })), ids(byTs(a, b, d, g)));
    } finally { await db.close(); }
  });

  t("recentErrorsByCode: order 'desc' invierte exacto y limit se aplica DESPUÉS de filtrar (los N más recientes CON ese código)", async () => {
    const { db, events, a, b, d, g } = await seedErrors();
    try {
      const asc = ids(byTs(a, b, d, g));
      const code = 'TNS.SINCE_FOR';
      assert.deepEqual(ids(await events.recentErrorsByCode(code, { since: T(0), order: 'desc' })), asc.slice().reverse());
      assert.deepEqual(ids(await events.recentErrorsByCode(code, { since: T(0), order: 'desc', limit: 2 })), asc.slice().reverse().slice(0, 2)); // g y d: e y f (sin el código) no ocupan sitio
      assert.deepEqual(ids(await events.recentErrorsByCode(code, { since: T(0), limit: 3 })), asc.slice(0, 3));
      assert.deepEqual(await events.recentErrorsByCode(code, { since: T(0), limit: 0 }), []);
      assert.deepEqual(ids(await events.recentErrorsByCode(code, { since: T(0), limit: 99 })), asc);
    } finally { await db.close(); }
  });

  t('recentErrorsByCode devuelve copias: modificar el resultado no cambia lo guardado', async () => {
    const { db, events, a } = await seedErrors();
    try {
      const rows = await events.recentErrorsByCode('TNS.SINCE_FOR', { since: T(0) });
      rows[0].errorCodes.push('X.Y'); rows[0].responseRaw = 'cambiado'; rows.length = 0;
      assert.deepEqual(await db.get('events', a.id), a);
      assert.equal((await events.recentErrorsByCode('TNS.SINCE_FOR', { since: T(0) })).length, 4);
    } finally { await db.close(); }
  });

  t('recentErrorsByCode con argumentos no válidos rechaza con BAD_QUERY (since es obligatorio: no hay índice de errorCodes)', async () => {
    const { db, events } = await seedErrors();
    try {
      for (const c of ['', null, undefined, 5, {}, ['TNS.SINCE_FOR']]) await assert.rejects(() => events.recentErrorsByCode(c, { since: T(0) }), badQ);
      for (const o of [undefined, null, {}, { order: 'desc' }, { limit: 3 }, { since: undefined }]) {
        await assert.rejects(() => events.recentErrorsByCode('TNS.SINCE_FOR', o), (e) => badQ(e) && /since/.test(e.message) && /obligatorio/.test(e.message)); // el mensaje dice POR QUÉ
      }
      for (const o of ['x', ['a']]) await assert.rejects(() => events.recentErrorsByCode('TNS.SINCE_FOR', o), badQ);
      for (const sinceVal of ['hola', '', null, NaN, {}, new Date('x')]) await assert.rejects(() => events.recentErrorsByCode('TNS.SINCE_FOR', { since: sinceVal }), badQ);
      for (const o of [{ since: T(0), foo: 1 }, { since: T(0), order: 'up' }, { since: T(0), limit: -1 }, { since: T(0), limit: 1.5 }, { since: T(0), limit: '2' }, { since: T(0), from: T(0) }]) {
        await assert.rejects(() => events.recentErrorsByCode('TNS.SINCE_FOR', o), badQ);
      }
    } finally { await db.close(); }
  });

  // ---------- CA-4: volumen ----------
  t(`CA-4 volumen: ${queryVolume} eventos, resultados exactos y tiempo de las consultas por rango`, async () => {
    const { db, events } = await open(newDisk());
    try {
      const DAYS = 80;
      const perDay = Math.floor(queryVolume / DAYS);
      const total = DAYS * perDay;
      const pad = (n) => String(n).padStart(2, '0');
      const dayName = (d) => { const x = new Date(2026, 7, 1 + d); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
      const idGen = createIdGenerator({ rng: makeRng(21) });
      const rows = [];
      for (let d = 0; d < DAYS; d += 1) {
        for (let k = 0; k < perDay; k += 1) {
          const ts = new Date(2026, 7, 1 + d, 6 + (k % 16), (k * 7) % 60, k % 60, k % 1000).toISOString();
          const coded = k % 3 === 0;
          rows.push(buildEvent({
            type: 'answer', ts, itemId: `g.i${k % 300}`, cardId: `g.i${k % 300}#0`, topics: [`t.a${k % 40}`, 't.b'], exerciseType: 'fix_error',
            result: coded ? 'wrong' : 'correct', rating: coded ? 1 : 3, ms: 1000, responseRaw: 'x', errorCodes: coded ? [`TNS.C${k % 7}`] : [], mode: 'mech', channel: 'keyboard',
          }, { now: new Date(ts), idGen }));
        }
      }
      for (let b = 0; b < rows.length; b += 5000) {
        await db.tx(['events'], async (tx) => { for (const r of rows.slice(b, b + 5000)) await tx.put('events', r); });
      }
      assert.equal(await db.count('events', {}), total);

      // Referencia calculada aparte, a fuerza bruta, a partir de las filas sembradas.
      const tally = (from, to) => {
        const out = {};
        for (let d = from; d <= to; d += 1) out[dayName(d)] = perDay;
        return out;
      };
      const sorted = (list) => list.slice().sort((x, y) => (x.ts < y.ts ? -1 : x.ts > y.ts ? 1 : x.id < y.id ? -1 : 1));
      const wantErrors = (code, sinceIso) => sorted(rows.filter((r) => r.ts >= sinceIso && r.errorCodes.includes(code)));
      const win = { from: DAYS - 14, to: DAYS - 1 }; // los últimos 14 días: la ventana típica (p. ej. "el mismo error 3 veces en 14 días")
      const winSince = new Date(2026, 7, 1 + win.from).toISOString();

      // Exactitud
      assert.deepEqual(await events.countByDay({}), tally(0, DAYS - 1));
      assert.deepEqual(await events.countByDay({ from: dayName(win.from), to: dayName(win.to) }), tally(win.from, win.to));
      assert.deepEqual(await events.countByDay({ from: dayName(5), to: dayName(5) }), tally(5, 5));
      const errWin = await events.recentErrorsByCode('TNS.C3', { since: winSince });
      assert.deepEqual(ids(errWin), ids(wantErrors('TNS.C3', winSince)));
      assert.ok(errWin.length > 100);
      assert.deepEqual(ids(await events.recentErrorsByCode('TNS.C3', { since: winSince, order: 'desc', limit: 5 })), ids(wantErrors('TNS.C3', winSince).reverse().slice(0, 5)));

      // Tiempo: se toma el mejor de 3 intentos para que un tropiezo del sistema no falle la prueba.
      const best = async (fn) => { let min = Infinity; for (let i = 0; i < 3; i += 1) { const t0 = performance.now(); await fn(); min = Math.min(min, performance.now() - t0); } return min; };
      const msCount14 = await best(() => events.countByDay({ from: dayName(win.from), to: dayName(win.to) }));
      const msErr14 = await best(() => events.recentErrorsByCode('TNS.C3', { since: winSince }));
      const msCountAll = await best(() => events.countByDay({}));
      const msErrAll = await best(() => events.recentErrorsByCode('TNS.C3', { since: '2000-01-01T00:00:00.000Z' }));
      const eventsIn14 = 14 * perDay;
      process.stdout.write(`# [${label}] ${total} eventos en ${DAYS} días (${perDay}/día): countByDay 14 días (${eventsIn14} eventos) = ${msCount14.toFixed(0)} ms · recentErrorsByCode ventana 14 días = ${msErr14.toFixed(0)} ms\n`);
      process.stdout.write(`# [${label}] PEOR CASO (todos los ${total} eventos dentro de la ventana): countByDay({}) = ${msCountAll.toFixed(0)} ms · recentErrorsByCode desde siempre = ${msErrAll.toFixed(0)} ms (solo documentado; ver CONTRACTS 1.1-3B)\n`);
      if (perfBudgetMs != null) {
        assert.ok(msCount14 < perfBudgetMs, `countByDay de 14 días tardó ${msCount14.toFixed(0)} ms (límite ${perfBudgetMs})`);
        assert.ok(msErr14 < perfBudgetMs, `recentErrorsByCode de 14 días tardó ${msErr14.toFixed(0)} ms (límite ${perfBudgetMs})`);
      }

      // El peor caso también tiene que dar el resultado exacto (aunque su tiempo solo se documente).
      assert.deepEqual(await events.countByDay({}), tally(0, DAYS - 1));
      assert.deepEqual(ids(await events.recentErrorsByCode('TNS.C3', { since: '2000-01-01T00:00:00.000Z' })), ids(wantErrors('TNS.C3', '2000-01-01T00:00:00.000Z')));
    } finally { await db.close(); }
  });
  // ---------- Inmutabilidad y borrar todo (cuarto 4, mitad A) ----------
  t('clearAll borra todos los eventos y devuelve cuántos había; los índices y las consultas quedan vacíos', async () => {
    const { db, events } = await open(newDisk());
    try {
      for (let i = 0; i < 25; i += 1) await events.log(answer({ itemId: `g.i${i % 5}`, cardId: `g.i${i % 5}#0`, topics: ['t.a', `t.b${i % 3}`] }));
      assert.equal(await events.clearAll(), 25);
      assert.equal(await db.count('events', {}), 0);
      for (const q of [{ index: 'ts' }, { index: 'day' }, { index: 'itemId', value: 'g.i1' }, { index: 'cardId', value: 'g.i1#0' }, { index: 'topics', value: 't.a' }, { index: 'type', value: 'answer' }]) {
        assert.deepEqual(await db.query('events', q), [], JSON.stringify(q));
      }
      assert.deepEqual(await events.since(0), []);
      assert.deepEqual(await events.byTopic('t.a'), []);
      assert.deepEqual(await events.countByDay({}), {});
      assert.deepEqual(await events.recentErrorsByCode('TNS.SINCE_FOR', { since: 0 }), []);
    } finally { await db.close(); }
  });

  t('clearAll borra los eventos de CADA tipo (los 9), no solo las respuestas', async () => {
    const { db, events } = await open(newDisk());
    try {
      const byType = {
        answer: answer(), session_start: { type: 'session_start', sessionId: 'ses_1' }, session_end: { type: 'session_end', sessionId: 'ses_1', ms: 600000 },
        tap_word: { type: 'tap_word', responseRaw: 'ceiling' }, ai_call: { type: 'ai_call', mode: 'ai' }, exam_entry: { type: 'exam_entry', topics: ['gram.x'] },
        exam_exit: { type: 'exam_exit', topics: ['gram.x'] }, import: { type: 'import' }, note: { type: 'note', responseRaw: 'me confundí con for/since' },
      };
      assert.deepEqual(Object.keys(byType).sort(), [...EVENT_TYPES].sort()); // si el esquema gana un tipo, esta prueba obliga a cubrirlo
      for (const ev of Object.values(byType)) await events.log(ev);
      assert.equal(await db.count('events', {}), EVENT_TYPES.length);
      assert.equal(await events.clearAll(), EVENT_TYPES.length);
      assert.equal(await db.count('events', {}), 0);
      for (const type of EVENT_TYPES) assert.deepEqual(await db.query('events', { index: 'type', value: type }), [], type);
    } finally { await db.close(); }
  });

  t('clearAll con volumen: 10.000 eventos se borran todos en una sola operación y el tiempo queda documentado', async () => {
    const { db, events } = await open(newDisk());
    try {
      const N = 10000;
      const idGen = createIdGenerator({ rng: makeRng(31) });
      for (let b = 0; b < N; b += 5000) {
        await db.tx(['events'], async (tx) => {
          for (let i = b; i < b + 5000; i += 1) {
            const ts = new Date(Date.UTC(2026, 9, 1) + i * 61000).toISOString();
            await tx.put('events', buildEvent(answer({ ts }), { now: new Date(ts), idGen }));
          }
        });
      }
      assert.equal(await db.count('events', {}), N);
      const t0 = performance.now();
      assert.equal(await events.clearAll(), N);
      const ms = performance.now() - t0;
      process.stdout.write(`# [${label}] clearAll de ${N} eventos = ${ms.toFixed(0)} ms (solo documentado)\n`);
      assert.equal(await db.count('events', {}), 0);
      assert.deepEqual(await events.since(0), []);
    } finally { await db.close(); }
  });

  t('clearAll sobre un registro vacío devuelve 0 y no falla; llamarlo dos veces seguidas también', async () => {
    const { db, events } = await open(newDisk());
    try {
      assert.equal(await events.clearAll(), 0);
      await events.log(answer());
      assert.equal(await events.clearAll(), 1);
      assert.equal(await events.clearAll(), 0);
    } finally { await db.close(); }
  });

  t('clearAll solo toca `events`: tarjetas, ajustes y la versión del esquema siguen donde estaban', async () => {
    const { db, events } = await open(newDisk());
    try {
      await db.put('settings', { key: 'theme', value: 'dark' });
      await db.put('cards', { id: 'g.i1#0', itemId: 'g.i1', topics: ['t.a'], state: 'new', due: '2026-10-16T00:00:00.000Z' });
      await db.put('errors', { id: 'err_1', day: '2026-10-15', code: 'TNS.SINCE_FOR', topics: ['t.a'] });
      await events.log(answer());
      const before = { meta: await db.query('meta', {}), settings: await db.query('settings', {}), cards: await db.query('cards', {}), errors: await db.query('errors', {}) };
      assert.ok(before.meta.some((r) => r.key === 'schemaVersion'));
      await events.clearAll();
      assert.deepEqual({ meta: await db.query('meta', {}), settings: await db.query('settings', {}), cards: await db.query('cards', {}), errors: await db.query('errors', {}) }, before);
    } finally { await db.close(); }
  });

  t('después de clearAll el registro sigue siendo usable: log guarda, las consultas ven solo lo nuevo', async () => {
    const { db, events } = await open(newDisk());
    try {
      for (let i = 0; i < 10; i += 1) await events.log(answer());
      await events.clearAll();
      const fresh = await events.log(answer({ responseRaw: 'nuevo' }));
      assert.equal(await db.count('events', {}), 1);
      assert.deepEqual((await events.since(0)).map((e) => e.id), [fresh.id]);
      assert.deepEqual(Object.values(await events.countByDay({})), [1]);
    } finally { await db.close(); }
  });

  t('clearAll con la base cerrada rechaza con DbError y no inventa un resultado', async () => {
    const { db, events } = await open(newDisk());
    await events.log(answer());
    await db.close();
    await assert.rejects(() => events.clearAll(), (e) => e instanceof DbError);
  });

  t('los eventos son inmutables: la API pública no tiene update/put/delete/remove y está congelada', async () => {
    const { db, events } = await open(newDisk());
    try {
      assert.deepEqual(Object.keys(events).sort(), ['byCard', 'byItem', 'byTopic', 'clearAll', 'countByDay', 'insertIn', 'log', 'prepare', 'recentErrorsByCode', 'since']);
      for (const name of ['update', 'put', 'set', 'delete', 'remove', 'edit', 'patch', 'clear', 'purge', 'deleteAll']) assert.equal(events[name], undefined, name);
      assert.equal(Object.isFrozen(events), true);
      // Un módulo ES es estricto: tocar un objeto congelado lanza TypeError (se comprueba a mano porque el arnés del navegador no trae assert.throws).
      for (const touch of [() => { events.update = () => {}; }, () => { events.log = () => {}; }, () => { delete events.clearAll; }]) {
        let err = null;
        try { touch(); } catch (e) { err = e; }
        assert.ok(err instanceof TypeError);
      }
      // y un evento ya guardado no cambia aunque quien lo recibió lo modifique
      const saved = await events.log(answer());
      saved.result = 'correct';
      saved.topics.push('x');
      assert.equal((await db.get('events', saved.id)).result, 'wrong');
      assert.deepEqual((await db.get('events', saved.id)).topics, ['gram.present_perfect.for_since', 'gram.tense']);
    } finally { await db.close(); }
  });
}
