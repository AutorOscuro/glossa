// @purpose: Pruebas del reporte local de ítems (core/itemReport.js, 2.6-T2): un tipo por reporte, el último gana, dos tipos a la vez, quitar, lectura tolerante, validación y respaldo.
// 2.6-T2, punto 1. Base en memoria; el respaldo se prueba con exportAll/importAll reales.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createItemReport, REPORT_PREFIX, KINDS, keyOf } from '../core/itemReport.js';
import { createMemoryDb } from '../core/db.memory.js';
import { makeClock } from './_helpers.mjs';

async function world() {
  const clock = makeClock('2026-10-31T15:00:00.000Z');
  const db = createMemoryDb(); await db.open();
  return { clock, db, rep: createItemReport({ db, clock }) };
}

test('marcar como difícil guarda report:<itemId> con la forma { kind, at } del contrato', async () => {
  const { db, rep } = await world();
  const r = await rep.mark('pp_for_since_001', 'hard');
  assert.equal(r.key, 'report:pp_for_since_001');
  const row = await db.get('meta', 'report:pp_for_since_001');
  assert.equal(row.kind, 'hard');
  assert.equal(row.at, '2026-10-31T15:00:00.000Z');
  assert.equal(row.itemId, 'pp_for_since_001');
  assert.deepEqual(await rep.get('pp_for_since_001'), { itemId: 'pp_for_since_001', hard: '2026-10-31T15:00:00.000Z', doubt: null });
});

test('repetir el mismo tipo: el último gana y no hay duplicados', async () => {
  const { db, rep } = await world();
  await rep.mark('a1', 'doubt', '2026-10-31T10:00:00.000Z');
  await rep.mark('a1', 'doubt', '2026-10-31T11:00:00.000Z');
  assert.equal((await db.query('meta', {})).filter((r) => r.key.startsWith(REPORT_PREFIX)).length, 1);
  assert.equal((await rep.get('a1')).doubt, '2026-10-31T11:00:00.000Z');
});

test('un ítem puede estar difícil y dudoso a la vez; kind/at son el último', async () => {
  const { db, rep } = await world();
  await rep.mark('a1', 'hard', '2026-10-31T10:00:00.000Z');
  await rep.mark('a1', 'doubt', '2026-10-31T12:00:00.000Z');
  assert.deepEqual(await rep.get('a1'), { itemId: 'a1', hard: '2026-10-31T10:00:00.000Z', doubt: '2026-10-31T12:00:00.000Z' });
  const row = await db.get('meta', 'report:a1');
  assert.equal(row.kind, 'doubt'); assert.equal(row.at, '2026-10-31T12:00:00.000Z');
});

test('quitar un tipo conserva el otro; quitar el último borra el registro; quitar lo que no hay no falla', async () => {
  const { db, rep } = await world();
  await rep.mark('a1', 'hard', '2026-10-31T10:00:00.000Z');
  await rep.mark('a1', 'doubt', '2026-10-31T12:00:00.000Z');
  assert.equal((await rep.clear('a1', 'doubt')).removed, true);
  assert.deepEqual(await rep.get('a1'), { itemId: 'a1', hard: '2026-10-31T10:00:00.000Z', doubt: null });
  const row = await db.get('meta', 'report:a1');
  assert.equal(row.kind, 'hard'); assert.equal(row.at, '2026-10-31T10:00:00.000Z');
  assert.equal((await rep.clear('a1', 'doubt')).removed, false);
  assert.equal((await rep.clear('a1', 'hard')).removed, true);
  assert.equal(await db.get('meta', 'report:a1'), null);
  assert.equal(await rep.get('a1'), null);
  assert.equal((await rep.clear('nunca', 'hard')).removed, false);
});

test('list: por itemId y filtrada por tipo; ignora otras claves de meta y registros ilegibles', async () => {
  const { db, rep } = await world();
  await rep.mark('b2', 'hard'); await rep.mark('a1', 'doubt'); await rep.mark('c3', 'hard');
  await db.put('meta', { key: 'mastery_snap:2026-10-31', v: 1, day: '2026-10-31', results: [] });
  await db.put('meta', { key: 'ajeno:informe-9', kind: 'hard', at: '2026-10-31T10:00:00.000Z', marks: { hard: '2026-10-31T10:00:00.000Z' } });
  await db.put('meta', { key: 'report:roto', v: 1, kind: 'otro', at: 'ayer' });
  await db.put('meta', { key: 'report:sinfecha', kind: 'hard' });
  assert.deepEqual((await rep.list()).map((r) => r.itemId), ['a1', 'b2', 'c3']);
  assert.deepEqual((await rep.list('hard')).map((r) => r.itemId), ['b2', 'c3']);
  assert.deepEqual((await rep.list('doubt')).map((r) => r.itemId), ['a1']);
  await assert.rejects(() => rep.list('otro'), /kind/);
});

test('lee el registro con solo { kind, at } (forma del contrato) y lo completa al marcar el otro tipo', async () => {
  const { db, rep } = await world();
  await db.put('meta', { key: 'report:x9', kind: 'hard', at: '2026-10-30T08:00:00.000Z' });
  assert.deepEqual(await rep.get('x9'), { itemId: 'x9', hard: '2026-10-30T08:00:00.000Z', doubt: null });
  await rep.mark('x9', 'doubt', '2026-10-31T09:00:00.000Z');
  assert.equal((await rep.get('x9')).hard, '2026-10-30T08:00:00.000Z');
});

test('validación: itemId y kind inválidos se rechazan sin escribir', async () => {
  const { db, rep } = await world();
  for (const bad of ['', 'con espacio', 'a/b', "a'b", 'x'.repeat(201), 7, null, undefined]) {
    await assert.rejects(() => rep.mark(bad, 'hard'), /itemId/);
    assert.throws(() => keyOf(bad), /itemId/);
  }
  for (const bad of ['', 'easy', undefined, 1]) await assert.rejects(() => rep.mark('a1', bad), /kind/);
  await assert.rejects(() => rep.mark('a1', 'hard', 'no es fecha'), /now/);
  assert.equal((await db.query('meta', {})).filter((r) => r.key.startsWith(REPORT_PREFIX)).length, 0);
  assert.deepEqual([...KINDS], ['hard', 'doubt']);
});

test('una base que falla al escribir rechaza y no deja nada a medias', async () => {
  const { db, clock } = await world();
  const bad = { get: db.get, query: db.query, delete: db.delete, put: async () => { throw new Error('cuota'); } };
  const rep = createItemReport({ db: bad, clock });
  await assert.rejects(() => rep.mark('a1', 'hard'), /cuota/);
  assert.equal(await db.get('meta', 'report:a1'), null);
});

test('crear sin base o con reloj roto falla con mensaje claro', () => {
  assert.throws(() => createItemReport({}), /base de datos/);
  assert.throws(() => createItemReport({ db: {} }), /base de datos/);
  assert.throws(() => createItemReport({ db: { get() {}, put() {}, delete() {}, query() {} }, clock: {} }), /reloj/);
});

test('respaldo: los reportes salen en exportAll y vuelven con importAll', async () => {
  const { db, rep } = await world();
  await rep.mark('a1', 'hard', '2026-10-31T10:00:00.000Z');
  await rep.mark('a1', 'doubt', '2026-10-31T12:00:00.000Z');
  await rep.mark('b2', 'doubt', '2026-10-31T13:00:00.000Z');
  const dump = JSON.parse(JSON.stringify(await db.exportAll()));
  assert.ok(dump.stores.meta.some((r) => r.key === 'report:a1'));
  const db2 = createMemoryDb(); await db2.open();
  await db2.importAll(dump);
  const rep2 = createItemReport({ db: db2, clock: makeClock('2026-11-01T00:00:00.000Z') });
  assert.deepEqual(await rep2.list(), await rep.list());
  assert.equal((await rep2.get('a1')).hard, '2026-10-31T10:00:00.000Z');
});
