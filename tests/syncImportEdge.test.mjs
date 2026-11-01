// @purpose: Pruebas de la 1.12-T3, parte 2 (core/syncImport.js): ocurrencias antiguas, bordes de tamaño, bloques de 200 errores, reloj y huecos que cerraron las roturas de 4.R.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createChatImport } from '../core/syncImport.js';
import { createSync } from '../core/sync.js';
import { makeChatBlock, parseChatBlock } from '../core/syncChat.js';
import { createErrors } from '../core/errors.js';
import { createErrorCatalog } from '../core/errorCatalog.js';
import { createMastery } from '../core/mastery.js';
import { createMasteryBoard } from '../core/masteryBoard.js';
import { createEvents } from '../core/events.js';
import { createSrs } from '../core/srsEngine.js';
import { createMemoryDb } from '../core/db.memory.js';
import { DbError, friendlyMessage } from '../core/db.js';
import { makeClock } from './_helpers.mjs';

const NOW = '2026-10-25T12:00:00.000Z';
const CATALOG = createErrorCatalog(JSON.parse(fs.readFileSync(new URL('../content/taxonomy/error_codes.json', import.meta.url), 'utf8')));
const TOPICS = JSON.parse(fs.readFileSync(new URL('../content/taxonomy/topics.json', import.meta.url), 'utf8')).topics;
const E1 = { original: "I didn't can to send it", code: 'VRB.CAN_TO', correction: "I couldn't send it" };
const E2 = { original: 'She go to school', code: 'VRB.THIRD_S_OMIT' };
const E3 = { original: 'I am agree', code: 'SUBJ.OMIT' };
const at = (iso) => new Date(iso);
const block = (errores, iso = NOW, extra = {}) => makeChatBlock('errores', { errores, ...extra }, { now: at(iso) });
const noDate = (payload) => `=== SOPHIA-EN-SYNC v1 ===\ntipo: errores\n${JSON.stringify(payload, null, 2)}\n=== FIN ===`;

async function setup({ nowIso = NOW, topics, board } = {}) {
  const db = createMemoryDb();
  await db.open();
  const clock = makeClock(nowIso);
  const errors = createErrors({ db, catalog: CATALOG, clock });
  const imp = createChatImport({ db, errors, catalog: CATALOG, clock, topics, board });
  return { db, clock, errors, imp };
}
const rows = async (db) => (await db.query('errors', {})).sort((a, b) => (a.id < b.id ? -1 : 1));
const statuses = (r) => r.items.map((i) => i.status);
const snap = async (db) => JSON.stringify((await db.exportAll()).stores); // sin `exportedAt`, que cambia en cada llamada


// ---------- revisión 1.12-T3: ocurrencias antiguas, bordes y hostiles ----------
const dated = (n, base = E2) => Array.from({ length: n }, (_, i) => ({ ...base, ts: `2026-09-${String(i + 1).padStart(2, '0')}T10:00:00.000Z` }));
const raw = (errores, iso = NOW) => `=== SOPHIA-EN-SYNC v1 ===\ntipo: errores\ngenerado: ${iso}\n${JSON.stringify({ errores })}\n=== FIN ===`;

test('idempotencia con más de 10 fechas: las ocurrencias más viejas (fuera de las 10 que recuerda `seen`) tampoco se cuentan dos veces', async () => {
  const { db, imp } = await setup();
  const b = block(dated(12));
  const first = await imp.importErrors(b);
  assert.deepEqual(first.totals, { new: 1, repeat: 11, replay: 0, invalid: 0, skipped: 0 });
  const snapshot = await snap(db);
  for (let i = 0; i < 3; i += 1) {
    const preview = await imp.previewErrors(b);
    assert.deepEqual(preview.totals, { new: 0, repeat: 0, replay: 12, invalid: 0, skipped: 0 }, `vista previa ${i}`);
    assert.equal(preview.canImport, false);
    const again = await imp.importErrors(b);
    assert.deepEqual(again.totals, { new: 0, repeat: 0, replay: 12, invalid: 0, skipped: 0 }, `importación ${i}`);
    assert.deepEqual(again.items.map((it) => it.countAfter), Array(12).fill(12));
    assert.equal(await snap(db), snapshot);
  }
  assert.equal((await rows(db))[0].count, 12);
});

test('con más de 10 fechas el orden del bloque no cambia el resultado (se procesan de la más vieja a la más nueva)', async () => {
  const list = dated(12);
  const results = [];
  for (const order of [list, [...list].reverse(), [...list.slice(6), ...list.slice(0, 6)]]) {
    const { db, imp } = await setup();
    const r = await imp.importErrors(block(order));
    assert.deepEqual(r.totals, { new: 1, repeat: 11, replay: 0, invalid: 0, skipped: 0 });
    assert.deepEqual(r.items.map((it) => it.index), order.map((_, i) => i), 'los ítems salen en el orden del bloque');
    const rec = (await rows(db))[0];
    results.push([rec.count, rec.ts, rec.kind, rec.seen.join()]);
  }
  assert.deepEqual(results[1], results[0]);
  assert.deepEqual(results[2], results[0]);
  assert.equal(results[0][0], 12);
});

test('una fecha vieja que la app nunca contó, con menos de 10 recordadas, sí cuenta; y la vista previa lo sabe', async () => {
  const { db, imp } = await setup();
  await imp.importErrors(block(dated(3)));
  const extra = block([{ ...E2, ts: '2026-08-01T10:00:00.000Z' }]);
  const p = await imp.previewErrors(extra);
  assert.deepEqual(p.totals, { new: 0, repeat: 1, replay: 0, invalid: 0, skipped: 0 });
  assert.equal((await imp.importErrors(extra)).items[0].countAfter, 4);
  assert.equal((await rows(db))[0].count, 4);
});

test('si `generado:` está en el futuro, el mensaje habla de esa fecha del bloque y no de un «ts» que la persona no ve', async () => {
  const { db, imp } = await setup();
  const before = await snap(db);
  const r = await imp.previewErrors(raw([E1], '2999-01-01T00:00:00.000Z'));
  assert.equal(r.items[0].status, 'invalid');
  assert.match(r.items[0].message, /generado/);
  assert.doesNotMatch(r.items[0].message, /\bts\b/);
  assert.equal(r.items[0].tsSource, 'block');
  const own = await imp.previewErrors(raw([{ ...E1, ts: '2999-01-01T00:00:00.000Z' }]));
  assert.match(own.items[0].message, /\bts\b/);
  assert.equal((await imp.importErrors(raw([E1], '2999-01-01T00:00:00.000Z'))).totals.invalid, 1);
  assert.equal(await snap(db), before);
});

test('el límite de 500 caracteres: 500 exactos entran; 501 rechazan el bloque entero sin tocar la base; emoji y comillas curvas se conservan', async () => {
  const { db, imp } = await setup();
  const before = await snap(db);
  const r501 = await imp.importErrors(raw([{ original: 'a'.repeat(501), code: 'VRB.THIRD_S_OMIT' }]));
  assert.equal(r501.ok, false);
  assert.match(r501.error.message, /500/);
  assert.equal(await snap(db), before);
  const ok = await imp.importErrors(raw([
    { original: 'a'.repeat(500), code: 'VRB.THIRD_S_OMIT' },
    { original: '😀'.repeat(250), code: 'VRB.THIRD_S_OMIT' },
    { original: 'I don’t know “this”', code: 'VRB.THIRD_S_OMIT' },
  ]));
  assert.deepEqual(ok.totals, { new: 3, repeat: 0, replay: 0, invalid: 0, skipped: 0 });
  assert.ok((await rows(db)).some((r) => r.original === 'I don’t know “this”'));
  assert.deepEqual((await imp.importErrors(raw([{ original: 'I don’t know “this”', code: 'VRB.THIRD_S_OMIT' }]))).totals.replay, 1);
});

test('200 errores distintos: reimportarlos (varias veces) da 200 replay y la base queda igual', async () => {
  const { db, imp } = await setup();
  const list = Array.from({ length: 200 }, (_, i) => ({ original: `She go to place number ${i}`, code: 'VRB.THIRD_S_OMIT' }));
  const b = block(list);
  assert.equal((await imp.importErrors(b)).totals.new, 200);
  const snapshot = await snap(db);
  for (let i = 0; i < 2; i += 1) assert.equal((await imp.importErrors(b)).totals.replay, 200);
  assert.deepEqual((await imp.previewErrors(b)).totals, { new: 0, repeat: 0, replay: 200, invalid: 0, skipped: 0 });
  assert.equal(await snap(db), snapshot);
});

test('reloj hacia atrás: con la hora de la app antes del bloque, un bloque con más de 24 h de adelanto se omite y uno con menos entra', async () => {
  const { db, imp } = await setup({ nowIso: '2026-10-20T00:00:00.000Z' });
  const far = await imp.importErrors(block([E1], '2026-10-25T12:00:00.000Z'));
  assert.deepEqual(far.totals, { new: 0, repeat: 0, replay: 0, invalid: 1, skipped: 0 });
  assert.equal((await rows(db)).length, 0);
  const near = await imp.importErrors(block([E1], '2026-10-20T20:00:00.000Z'));
  assert.deepEqual(near.totals, { new: 1, repeat: 0, replay: 0, invalid: 0, skipped: 0 });
});

test('el texto de la persona no aparece en los mensajes de omisión', async () => {
  const { imp } = await setup();
  const r = await imp.previewErrors(raw([{ original: 'SECRETO-DE-LA-PERSONA', code: 'NO.EXISTE' }, { original: 'SECRETO-DE-LA-PERSONA', code: 'VRB.THIRD_S_OMIT', correction: 'SECRETO-DE-LA-PERSONA', topics: ['mal'] }]));
  assert.equal(r.totals.invalid, 2);
  for (const it of r.items) assert.doesNotMatch(it.message, /SECRETO/);
});

// ---------- revisión 1.12-T3 (roturas): registros viejos, itemId, fechas intermedias, mensajes ----------
const LEGACY = { id: 'err_legacy_1', ts: '2026-10-01T10:00:00.000Z', day: '2026-10-01', original: E2.original, correction: null, context: null, code: 'VRB.THIRD_S_OMIT', origin: 'transfer_es', kind: 'slip', impact: 'mid', source: 'chat', itemId: null };

test('un registro viejo del chat (sin count, sin seen y sin topics) se cuenta como 1 y al sumarle una ocurrencia queda en 2, sin fallar', async () => {
  const { db, imp } = await setup();
  await db.put('errors', LEGACY);
  const b = block([E2], '2026-10-25T09:00:00.000Z');
  const prev = await imp.previewErrors(b);
  assert.deepEqual(prev.totals, { new: 0, repeat: 1, replay: 0, invalid: 0, skipped: 0 });
  assert.equal(prev.items[0].countAfter, 2);
  assert.equal(prev.canImport, true, 'solo repeticiones también se pueden importar');
  const r = await imp.importErrors(b);
  assert.equal(r.items[0].countAfter, 2);
  assert.equal(r.canImport, true);
  assert.equal(r.applied, 1);
  assert.equal((await rows(db))[0].count, 2);
  assert.equal((await imp.previewErrors(b)).totals.replay, 1);
});

test('un registro dañado sin `original` en la base no tumba la vista previa ni la importación', async () => {
  const { db, imp } = await setup();
  await db.put('errors', { id: 'err_roto_1', code: 'VRB.THIRD_S_OMIT', ts: '2026-10-01T10:00:00.000Z', count: 3 });
  assert.equal((await imp.previewErrors(block([E2]))).totals.new, 1);
  assert.equal((await imp.importErrors(block([E2]))).totals.new, 1);
  assert.equal((await rows(db)).length, 2);
});

test('itemId forma parte de «el mismo error»: con otro itemId es otro error, y con el mismo se reconoce al reimportar', async () => {
  const { db, imp } = await setup();
  const withItem = block([{ ...E2, itemId: 'item.0001' }]);
  assert.equal((await imp.importErrors(withItem)).totals.new, 1);
  assert.equal((await imp.previewErrors(withItem)).totals.replay, 1);
  assert.equal((await imp.importErrors(withItem)).totals.replay, 1);
  assert.deepEqual((await imp.importErrors(block([E2, { ...E2, itemId: 'item.0002' }]))).totals, { new: 2, repeat: 0, replay: 0, invalid: 0, skipped: 0 });
  assert.equal((await rows(db)).length, 3);
});

test('con las 10 fechas recordadas llenas, una fecha intermedia que nunca se contó sí cuenta; y la regla de las demás sigue igual', async () => {
  const { db, imp } = await setup();
  await imp.importErrors(block(dated(10).map((e, i) => ({ ...e, ts: `2026-09-${String(i + 10).padStart(2, '0')}T10:00:00.000Z` }))));
  assert.equal((await rows(db))[0].seen.length, 10);
  const middle = block([{ ...E2, ts: '2026-09-15T12:00:00.000Z' }]);
  assert.deepEqual((await imp.previewErrors(middle)).totals, { new: 0, repeat: 1, replay: 0, invalid: 0, skipped: 0 });
  assert.equal((await imp.importErrors(middle)).totals.repeat, 1);
  assert.equal((await rows(db))[0].count, 11);
  assert.equal((await imp.previewErrors(block([{ ...E2, ts: '2026-09-02T10:00:00.000Z' }]))).totals.replay, 1);
});

test('la vista previa y la importación coinciden con fechas más viejas que las recordadas y una repetida: la lista de fechas se mantiene en orden', async () => {
  const day = (n) => `2026-09-${String(n).padStart(2, '0')}T10:00:00.000Z`;
  const { db, imp } = await setup();
  await imp.importErrors(block(Array.from({ length: 9 }, (_, i) => ({ ...E2, ts: day(i + 10) })))); // 10..18: 9 fechas
  const b = block([{ ...E2, ts: day(18) }, { ...E2, ts: day(7) }, { ...E2, ts: day(5) }]);
  const prev = await imp.previewErrors(b);
  assert.deepEqual(statuses(prev), ['replay', 'repeat', 'repeat']);
  assert.deepEqual(prev.items.map((i) => i.countAfter), [11, 11, 10]); // el replay informa el conteo final; las repeticiones, el de su momento (de la más vieja a la más nueva)
  const r = await imp.importErrors(b);
  assert.deepEqual(statuses(r), statuses(prev));
  assert.deepEqual(r.items.map((i) => i.countAfter), prev.items.map((i) => i.countAfter));
  const rec = (await rows(db))[0];
  assert.equal(rec.count, 11);
  assert.deepEqual(rec.seen, [day(7), ...Array.from({ length: 9 }, (_, i) => day(i + 10))]);
});

test('una repetición con fecha anterior a la de un duplicado: el replay cuenta lo que ya estaba y lo nuevo se suma', async () => {
  const { imp } = await setup();
  await imp.importErrors(block([{ ...E2, ts: '2026-10-20T10:00:00.000Z' }]));
  const b = block([{ ...E2, ts: '2026-10-10T10:00:00.000Z' }, { ...E2, ts: '2026-10-20T10:00:00.000Z' }]);
  const prev = await imp.previewErrors(b);
  assert.deepEqual(statuses(prev), ['repeat', 'replay']);
  assert.deepEqual(prev.items.map((i) => i.countAfter), [2, 2]);
  const r = await imp.importErrors(b);
  assert.deepEqual(statuses(r), ['repeat', 'replay']);
  assert.deepEqual(r.items.map((i) => i.countAfter), [2, 2]);
});

test('un tema de la lista sin estado se muestra con current null; los mensajes juntan varios problemas con «; » y nombran «generado:» solo cuando la fecha es del bloque', async () => {
  const { imp } = await setup({ topics: [{ id: 'gram.modals.can_could' }] });
  const t = await imp.previewErrors(block([E1], NOW, { temas: [{ id: 'gram.modals.can_could', estado: 'active' }] }));
  assert.deepEqual(t.topicAdjustments, [{ id: 'gram.modals.can_could', estado: 'active', status: 'ok', current: null }]);
  const bad = await imp.previewErrors(raw([{ original: 'Same words', code: 'NO.EXISTE', correction: 'same words', topics: ['mal'] }]));
  const msg = bad.items[0].message;
  assert.ok(msg.includes('; '), msg);
  assert.ok(msg.split('; ').length >= 3, msg);
  const own = await imp.previewErrors(raw([{ original: 'x', code: 'VRB.THIRD_S_OMIT', ts: '2999-01-01T00:00:00.000Z' }]));
  assert.match(own.items[0].message, /ts está más de 24 h/);
});

test('un `ts` propio sin milisegundos sale normalizado en la vista previa y se reconoce al reimportar con otra escritura', async () => {
  const { imp } = await setup();
  const a = raw([{ ...E2, ts: '2026-10-24T10:00:00Z' }]);
  const prev = await imp.previewErrors(a);
  assert.equal(prev.items[0].ts, '2026-10-24T10:00:00.000Z');
  assert.equal(prev.items[0].tsSource, 'own');
  await imp.importErrors(a);
  assert.equal((await imp.previewErrors(raw([{ ...E2, ts: '2026-10-24T10:00:00.000Z' }]))).totals.replay, 1);
});

test('un registro dañado sin `original` no se confunde con un texto que al normalizarse queda vacío («...»)', async () => {
  const { db, imp } = await setup();
  await db.put('errors', { id: 'err_roto_2', code: 'VRB.THIRD_S_OMIT', ts: '2026-10-01T10:00:00.000Z', count: 3 });
  const b = raw([{ original: '...', code: 'VRB.THIRD_S_OMIT' }]);
  assert.equal((await imp.previewErrors(b)).items[0].status, 'new');
  assert.equal((await imp.importErrors(b)).items[0].status, 'new');
  assert.equal((await rows(db)).find((r) => r.id === 'err_roto_2').count, 3);
});

test('si errors.record dice que esa ocurrencia ya estaba contada (otra importación se adelantó), sale replay y NO se invalida el tablero', async () => {
  const { db } = await setup();
  const calls = [];
  const errors = { record: async () => ({ created: false, counted: false, replay: true, record: { count: 3, topics: ['gram.modals.can_could'] } }) };
  const board = { invalidate: (ids) => calls.push(ids) };
  const imp = createChatImport({ db, errors, catalog: CATALOG, clock: makeClock(NOW), board });
  const r = await imp.importErrors(block([E1]));
  assert.deepEqual(statuses(r), ['replay']);
  assert.equal(r.items[0].countAfter, 3);
  assert.deepEqual(r.totals, { new: 0, repeat: 0, replay: 1, invalid: 0, skipped: 0 });
  assert.equal(r.applied, 0);
  assert.deepEqual(calls, []);
});

// ---------- huecos cerrados por las roturas de 4.R ----------
test('un solo cambio de estado de tema ya genera el aviso de que no se aplica', async () => {
  const { imp } = await setup();
  const r = await imp.previewErrors(block([E1], NOW, { temas: [{ id: 'gram.x.y', estado: 'draft' }] }));
  assert.equal(r.topicAdjustments.length, 1);
  assert.ok(r.warnings.some((w) => /no se aplican/.test(w)));
});

test('con tablero: un error con UN solo tema también invalida ese tema', async () => {
  const calls = [];
  const { imp } = await setup({ board: { invalidate: (ids) => calls.push([...ids]) } });
  await imp.importErrors(block([E2]));
  assert.deepEqual(calls, [[...CATALOG.get('VRB.THIRD_S_OMIT').temas_relacionados]]);
});

test('stopped.message es el texto amable de la base, no el técnico', async () => {
  const { db, errors } = await setup();
  const flaky = { ...errors, record: async () => { throw new DbError('UNAVAILABLE', 'detalle técnico del motor'); } };
  const imp = createChatImport({ db, errors: flaky, catalog: CATALOG, clock: makeClock(NOW) });
  const r = await imp.importErrors(block([E1]));
  assert.equal(r.stopped.message, friendlyMessage('UNAVAILABLE'));
  assert.notEqual(r.stopped.message, 'detalle técnico del motor');
});

test('sin reloj propio usa el del sistema: un bloque de ahora mismo se importa', async () => {
  const db = createMemoryDb();
  await db.open();
  const errors = createErrors({ db, catalog: CATALOG });
  const imp = createChatImport({ db, errors, catalog: CATALOG });
  const r = await imp.importErrors(makeChatBlock('errores', { errores: [E1] }, { now: new Date() }));
  assert.deepEqual(statuses(r), ['new']);
});

test('un bloque de 200 errores que ya existían: todos cuentan una ocurrencia más, y reimportarlo no cambia nada', async () => {
  const { db, imp } = await setup({ nowIso: '2026-10-27T00:00:00.000Z' });
  const list = Array.from({ length: 200 }, (_, i) => ({ original: `She go to repeated place ${i}`, code: 'VRB.THIRD_S_OMIT' }));
  await imp.importErrors(block(list, '2026-10-25T10:00:00.000Z'));
  const second = block(list, '2026-10-26T10:00:00.000Z');
  const r = await imp.importErrors(second);
  assert.deepEqual(r.totals, { new: 0, repeat: 200, replay: 0, invalid: 0, skipped: 0 });
  assert.ok(r.items.every((i) => i.countAfter === 2));
  const after = await snap(db);
  const again = await imp.importErrors(second);
  assert.equal(again.totals.replay, 200);
  assert.equal(await snap(db), after);
});
