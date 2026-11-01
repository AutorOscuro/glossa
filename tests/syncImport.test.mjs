// @purpose: Pruebas de la 1.12-T3 (core/syncImport.js y su conexión en createSync): importar errores del chat sin duplicar, vista previa que no escribe, fallos a medias y bitácora.
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

// ---------- vista previa ----------
test('la vista previa no escribe nada y dice qué pasaría: errores nuevos con la fecha del bloque', async () => {
  const { db, imp } = await setup();
  const before = await snap(db);
  const r = await imp.previewErrors(block([E1, E2]));
  assert.equal(r.ok, true);
  assert.equal(r.kind, 'errores');
  assert.equal(r.generatedAt, NOW);
  assert.deepEqual(r.totals, { new: 2, repeat: 0, replay: 0, invalid: 0, skipped: 0 });
  assert.equal(r.canImport, true);
  assert.deepEqual(statuses(r), ['new', 'new']);
  assert.deepEqual(r.items[0], { index: 0, status: 'new', code: 'VRB.CAN_TO', original: "I didn't can to send it", ts: NOW, tsSource: 'block', topics: [...CATALOG.get('VRB.CAN_TO').temas_relacionados], countAfter: 1 });
  assert.deepEqual(r.items.map((i) => Object.keys(i).includes('input') || Object.keys(i).includes('key')), [false, false]);
  assert.equal(await snap(db), before);
  assert.deepEqual(r.topicAdjustments, []);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.others, 0);
});

test('importar guarda cada error con source chat, la fecha del bloque, count 1 y los temas del catálogo', async () => {
  const { db, imp } = await setup();
  const r = await imp.importErrors(block([E1, E2]));
  assert.equal(r.ok, true);
  assert.equal(r.applied, 2);
  assert.equal(r.stopped, null);
  assert.deepEqual(r.totals, { new: 2, repeat: 0, replay: 0, invalid: 0, skipped: 0 });
  const saved = await rows(db);
  assert.equal(saved.length, 2);
  for (const rec of saved) {
    assert.equal(rec.source, 'chat');
    assert.equal(rec.ts, NOW);
    assert.equal(rec.count, 1);
    assert.deepEqual(rec.seen, [NOW]);
  }
  const can = saved.find((x) => x.code === 'VRB.CAN_TO');
  assert.equal(can.correction, "I couldn't send it");
  assert.deepEqual(can.topics, [...CATALOG.get('VRB.CAN_TO').temas_relacionados]);
  assert.equal(can.origin, CATALOG.get('VRB.CAN_TO').origen_tipico);
});

test('CA 2: reimportar el mismo bloque no duplica ni cambia nada (ni una vez ni diez)', async () => {
  const { db, imp } = await setup();
  const b = block([E1, E2, E3]);
  await imp.importErrors(b);
  const before = JSON.stringify(await rows(db));
  for (let i = 0; i < 10; i += 1) {
    const prev = await imp.previewErrors(b);
    assert.deepEqual(statuses(prev), ['replay', 'replay', 'replay']);
    assert.equal(prev.canImport, false);
    const r = await imp.importErrors(b);
    assert.deepEqual(statuses(r), ['replay', 'replay', 'replay']);
    assert.equal(r.applied, 0);
    assert.deepEqual(r.items.map((x) => x.countAfter), [1, 1, 1]);
  }
  assert.equal(JSON.stringify(await rows(db)), before);
});

test('la idempotencia no depende de la hora de importar ni del formato del bloque', async () => {
  const a = await setup({ nowIso: '2026-10-25T12:05:00.000Z' });
  const b = block([E1]);
  await a.imp.importErrors(b);
  a.clock.advanceDays(3);
  assert.deepEqual(statuses(await a.imp.importErrors(b)), ['replay']);
  // mismo instante escrito de otra manera (sin milisegundos, con Z)
  const reformatted = b.replace('generado: 2026-10-25T12:00:00.000Z', 'generado: 2026-10-25T12:00:00Z');
  assert.deepEqual(statuses(await a.imp.importErrors(reformatted)), ['replay']);
  // pegado con texto alrededor, vallas, citas y comillas curvas
  const messy = `Claro, aquí tienes:\n\n\`\`\`\n${b}\n\`\`\`\n\n¿Algo más?`;
  assert.deepEqual(statuses(await a.imp.importErrors(messy)), ['replay']);
  assert.equal((await rows(a.db)).length, 1);
  assert.equal((await rows(a.db))[0].count, 1);
});

test('un bloque nuevo (otro generado) con el mismo error cuenta otra ocurrencia; a la 3.ª es sistemático; y los anteriores siguen siendo replay', async () => {
  const { db, imp } = await setup();
  const days = ['2026-10-20T10:00:00.000Z', '2026-10-22T10:00:00.000Z', '2026-10-24T10:00:00.000Z'];
  const blocks = days.map((d) => block([E1], d));
  const out = [];
  for (const b of blocks) out.push(await imp.importErrors(b));
  assert.deepEqual(out.map(statuses), [['new'], ['repeat'], ['repeat']]);
  assert.deepEqual(out.map((r) => r.items[0].countAfter), [1, 2, 3]);
  const [rec] = await rows(db);
  assert.equal(rec.count, 3);
  assert.equal(rec.kind, 'systematic');
  assert.equal(rec.ts, days[2]);
  assert.deepEqual(rec.seen, days);
  for (const b of blocks) assert.deepEqual(statuses(await imp.importErrors(b)), ['replay']);
  assert.equal((await rows(db))[0].count, 3);
});

test('un error con ts propio usa ese ts (tsSource own) y también es idempotente; el ts propio manda sobre el del bloque', async () => {
  const { db, imp } = await setup();
  const own = '2026-10-18T08:30:00.000Z';
  const b = block([{ ...E1, ts: own }, E2]);
  const prev = await imp.previewErrors(b);
  assert.deepEqual(prev.items.map((i) => [i.tsSource, i.ts]), [['own', own], ['block', NOW]]);
  await imp.importErrors(b);
  assert.deepEqual(statuses(await imp.importErrors(b)), ['replay', 'replay']);
  const saved = await rows(db);
  assert.deepEqual(saved.map((r) => r.ts).sort(), [own, NOW].sort());
});

test('sin «generado:» y sin ts propio el error se omite con un mensaje claro; con ts propio sí entra', async () => {
  const { db, imp } = await setup();
  const text = noDate({ errores: [E1, { ...E2, ts: '2026-10-20T09:00:00.000Z' }] });
  assert.equal(parseChatBlock(text).generatedAt, null);
  const prev = await imp.previewErrors(text);
  assert.deepEqual(statuses(prev), ['invalid', 'new']);
  assert.match(prev.items[0].message, /^errores\[0\]: no tiene fecha/);
  assert.equal(prev.items[0].ts, null);
  assert.equal(prev.items[0].tsSource, null);
  const r = await imp.importErrors(text);
  assert.deepEqual(statuses(r), ['invalid', 'new']);
  assert.equal((await rows(db)).length, 1);
  assert.deepEqual(statuses(await imp.importErrors(text)), ['invalid', 'replay']);
  const none = await imp.importErrors(noDate({ errores: [E1, E3] }));
  assert.equal(none.canImport, false);
  assert.equal(none.applied, 0);
  assert.equal((await rows(db)).length, 1);
});

test('lo inválido se omite y se explica; lo válido se importa (código desconocido, ts futuro, corrección igual, tema mal escrito)', async () => {
  const { db, imp } = await setup();
  const b = block([
    E1,
    { original: 'Hello there', code: 'NOPE.NOPE' },
    { ...E2, ts: '2027-03-01T00:00:00.000Z' },
    { original: 'I like it', code: 'VRB.CAN_TO', correction: 'i like it.' },
    { original: 'Other thing', code: 'VRB.CAN_TO', topics: ['Gram.Mal'] },
    E3,
  ]);
  const prev = await imp.previewErrors(b);
  assert.deepEqual(statuses(prev), ['new', 'invalid', 'invalid', 'invalid', 'invalid', 'new']);
  assert.match(prev.items[1].message, /^errores\[1\]: code el código NOPE\.NOPE no está en el catálogo/);
  assert.match(prev.items[2].message, /ts está más de 24 h en el futuro/);
  assert.match(prev.items[3].message, /correction es igual al original/);
  assert.match(prev.items[4].message, /^errores\[4\]: topics\[0\]/);
  assert.deepEqual(prev.totals, { new: 2, repeat: 0, replay: 0, invalid: 4, skipped: 0 });
  assert.equal((await rows(db)).length, 0);
  const r = await imp.importErrors(b);
  assert.deepEqual(statuses(r), statuses(prev));
  assert.deepEqual(r.items.map((i) => i.message), prev.items.map((i) => i.message));
  assert.equal(r.applied, 2);
  assert.equal((await rows(db)).length, 2);
});

test('dos errores iguales dentro de un mismo bloque son UNA ocurrencia (el segundo es replay), igual en la vista previa y al importar', async () => {
  const { db, imp } = await setup();
  const b = block([E1, E2, { ...E1 }, { ...E1, original: "  I DIDN'T can to send it  " }]);
  const prev = await imp.previewErrors(b);
  assert.deepEqual(statuses(prev), ['new', 'new', 'replay', 'replay']);
  const r = await imp.importErrors(b);
  assert.deepEqual(statuses(r), ['new', 'new', 'replay', 'replay']);
  assert.deepEqual((await rows(db)).map((x) => x.count), [1, 1]);
});

test('el orden de los errores dentro del bloque no cambia el resultado', async () => {
  const a = await setup();
  const b = await setup();
  await a.imp.importErrors(block([E1, E2, E3, E1]));
  await b.imp.importErrors(block([E1, E3, E2, E1].reverse()));
  assert.equal(JSON.stringify(await rows(a.db)), JSON.stringify(await rows(b.db)));
});

test('la vista previa y la importación coinciden en un caso mixto con datos ya existentes (los de la app también cuentan)', async () => {
  const { db, imp, errors } = await setup();
  await errors.record({ ...E2, ts: '2026-10-10T10:00:00.000Z' }); // ya existe desde la app
  await imp.importErrors(block([E1], '2026-10-24T10:00:00.000Z'));
  const b = block([E1, E2, E3, { original: 'x', code: 'NOPE' }, { ...E1, ts: '2026-10-24T10:00:00.000Z' }], '2026-10-25T09:00:00.000Z');
  const before = JSON.stringify(await rows(db));
  const prev = await imp.previewErrors(b);
  assert.deepEqual(statuses(prev), ['repeat', 'repeat', 'new', 'invalid', 'replay']);
  assert.deepEqual(prev.items.map((i) => i.countAfter), [2, 2, 1, null, 2]);
  assert.equal(JSON.stringify(await rows(db)), before); // la vista previa no cambió nada
  const r = await imp.importErrors(b);
  assert.deepEqual(statuses(r), statuses(prev));
  assert.deepEqual(r.items.map((i) => i.countAfter), prev.items.map((i) => i.countAfter));
  assert.deepEqual(r.totals, prev.totals);
  const saved = await rows(db);
  assert.equal(saved.find((x) => x.code === 'VRB.THIRD_S_OMIT').source, 'app'); // la fuente original se conserva al sumar
});

test('lo que no es un bloque de errores no se importa: mensaje en español, nunca lanza y no toca la base', async () => {
  const { db, imp } = await setup();
  const before = await snap(db);
  const wrong = makeChatBlock('bitacora', { texto: 'hola' }, { now: at(NOW) });
  const cases = [
    [wrong, 'WRONG_KIND', /tipo «bitacora»/],
    ['', 'NO_TEXT', /No hay nada que leer/], [null, 'NO_TEXT', /No hay nada/], [42, 'NO_TEXT', /No hay nada/],
    ['hola, esto no es un bloque', 'NO_BLOCK', /No encuentro el inicio/],
    [block([E1]).replace('=== FIN ===', ''), 'NO_END', /falta la línea/],
    [block([E1]).replace('"VRB.CAN_TO"', '"VRB.CAN_TO",'), 'BAD_JSON', /JSON válido/],
    [makeChatBlock('estado', { notas: 'x' }, { now: at(NOW) }), 'WRONG_KIND', /tipo «estado»/],
    [block([E1]).replace('"original"', '"__proto__"'), 'HOSTILE', /prohibido/],
    [noDate({ errores: [] }), 'BAD_PAYLOAD', /no puede venir vacío/],
    [noDate({ errores: [{ ...E1, extra: 1 }] }), 'BAD_PAYLOAD', /no se admite el campo/],
  ];
  for (const [text, code, re] of cases) {
    for (const fn of [imp.previewErrors, imp.importErrors]) {
      const r = await fn(text);
      assert.equal(r.ok, false, String(text).slice(0, 40));
      assert.equal(r.error.code, code);
      assert.match(r.error.message, re);
    }
  }
  assert.equal(await snap(db), before);
});

test('hostil: un bloque con __proto__ o demasiado profundo se rechaza sin tocar la base ni el Object.prototype', async () => {
  const { db, imp } = await setup();
  const evil = `=== SOPHIA-EN-SYNC v1 ===\ntipo: errores\ngenerado: ${NOW}\n{"errores":[{"original":"a","code":"VRB.CAN_TO"}],"__proto__":{"polluted":true}}\n=== FIN ===`;
  const r = await imp.importErrors(evil);
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'HOSTILE');
  assert.equal({}.polluted, undefined);
  const deep = `=== SOPHIA-EN-SYNC v1 ===\ntipo: errores\ngenerado: ${NOW}\n${'['.repeat(40)}${']'.repeat(40)}\n=== FIN ===`;
  assert.equal((await imp.importErrors(deep)).ok, false);
  assert.equal((await rows(db)).length, 0);
});

test('el máximo de 200 errores entra completo y se reimporta sin duplicar', async () => {
  const { db, imp } = await setup();
  const list = Array.from({ length: 200 }, (_, i) => ({ original: `error number ${i}`, code: 'SPELL.GENERAL' }));
  const b = block(list);
  const r = await imp.importErrors(b);
  assert.equal(r.totals.new, 200);
  assert.equal((await rows(db)).length, 200);
  const again = await imp.importErrors(b);
  assert.equal(again.totals.replay, 200);
  assert.equal((await rows(db)).length, 200);
});

// ---------- fallos a medias ----------
test('si la base falla a la mitad: stopped dice dónde paró, lo demás queda skipped y repetir el bloque termina sin duplicar', async () => {
  const { db, imp, errors } = await setup();
  let calls = 0;
  const flaky = { ...errors, record: async (input) => { calls += 1; if (calls === 2) throw new DbError('UNAVAILABLE'); return errors.record(input); } };
  const clock = makeClock(NOW);
  const impFlaky = createChatImport({ db, errors: flaky, catalog: CATALOG, clock });
  const b = block([E1, E2, E3]);
  const r = await impFlaky.importErrors(b);
  assert.equal(r.ok, true);
  assert.deepEqual(statuses(r), ['new', 'skipped', 'skipped']);
  assert.equal(r.stopped.index, 1);
  assert.equal(typeof r.stopped.message, 'string');
  assert.match(r.items[1].message, /repite el bloque/);
  assert.equal(r.applied, 1);
  assert.equal((await rows(db)).length, 1);
  const done = await imp.importErrors(b);
  assert.deepEqual(statuses(done), ['replay', 'new', 'new']);
  assert.equal(done.stopped, null);
  assert.deepEqual((await rows(db)).map((x) => x.count), [1, 1, 1]);
});

test('un fallo que no es de la base (error de programación) se propaga: no se esconde', async () => {
  const { db } = await setup();
  const boom = { record: async () => { throw new TypeError('boom'); } };
  const imp = createChatImport({ db, errors: boom, catalog: CATALOG, clock: makeClock(NOW) });
  await assert.rejects(imp.importErrors(block([E1])), TypeError);
});

test('si errors.record rechaza un error ya validado, solo ese queda invalid y el resto sigue', async () => {
  const { db, errors } = await setup();
  const { ErrorRecordError } = await import('../core/errors.js');
  const picky = { record: async (input) => { if (input.code === 'VRB.THIRD_S_OMIT') throw new ErrorRecordError([{ path: 'original', message: 'no me gusta' }]); return errors.record(input); } };
  const imp = createChatImport({ db, errors: picky, catalog: CATALOG, clock: makeClock(NOW) });
  const r = await imp.importErrors(block([E1, E2, E3]));
  assert.deepEqual(statuses(r), ['new', 'invalid', 'new']);
  assert.match(r.items[1].message, /^errores\[1\]: original no me gusta/);
  assert.equal((await rows(db)).length, 2);
});

test('la vista previa lanza el DbError de la base si no puede leer (nada se escribió)', async () => {
  const { errors } = await setup();
  const dead = { query: async () => { throw new DbError('UNAVAILABLE'); } };
  const imp = createChatImport({ db: dead, errors, catalog: CATALOG, clock: makeClock(NOW) });
  await assert.rejects(imp.previewErrors(block([E1])), DbError);
});

// ---------- ajustes de estado de temas ----------
test('temas: se validan y se muestran, pero no se aplican ni se guardan', async () => {
  const known = TOPICS.slice(0, 3).map((t) => ({ id: t.id, status: t.status }));
  const { db, imp } = await setup({ topics: known });
  const before = await snap(db);
  const temas = [
    { id: known[0].id, estado: 'active' },
    { id: known[1].id, estado: known[1].status },
    { id: known[2].id, estado: 'learning' },
    { id: 'gram.no.existe', estado: 'draft' },
  ];
  const b = block([E1], NOW, { temas });
  const prev = await imp.previewErrors(b);
  assert.deepEqual(prev.topicAdjustments.map((t) => t.status), ['ok', 'unchanged', 'bad_status', 'unknown_topic']);
  assert.deepEqual(prev.topicAdjustments.map((t) => t.current), [known[0].status, known[1].status, known[2].status, null]);
  assert.ok(prev.warnings.some((w) => /no se aplican/.test(w)));
  assert.equal(await snap(db), before);
  const withoutErrors = async () => JSON.stringify({ ...(await db.exportAll()).stores, errors: null });
  const otherStores = await withoutErrors();
  const r = await imp.importErrors(b);
  assert.deepEqual(r.topicAdjustments, prev.topicAdjustments);
  assert.ok(r.warnings.some((w) => /no se aplican/.test(w)));
  assert.equal(await withoutErrors(), otherStores); // ningún almacén salvo `errors` cambió: el estado de los temas no se guarda
  assert.equal((await db.query('errors', {})).length, 1);
});

test('temas sin lista de la taxonomía: no se puede saber si existen (ok), pero el estado sí se valida', async () => {
  const { imp } = await setup();
  const r = await imp.previewErrors(block([E1], NOW, { temas: [{ id: 'gram.x.y', estado: 'deprecated' }, { id: 'gram.x.z', estado: 'raro' }] }));
  assert.deepEqual(r.topicAdjustments.map((t) => [t.status, t.current]), [['ok', null], ['bad_status', null]]);
});

test('si el texto trae varios bloques solo se lee el primero y se avisa', async () => {
  const { db, imp } = await setup();
  const two = `${block([E1])}\n\n${block([E2], '2026-10-26T00:00:00.000Z')}\n\n${block([E3])}`;
  const prev = await imp.previewErrors(two);
  assert.equal(prev.others, 2);
  assert.ok(prev.warnings.includes('El texto traía 2 bloques más: solo se lee el primero.'));
  const r = await imp.importErrors(`${block([E1])}\n${block([E2])}`);
  assert.ok(r.warnings.includes('El texto traía 1 bloque más: solo se lee el primero.'));
  assert.equal((await rows(db)).length, 1);
});

// ---------- tablero de dominio ----------
test('con tablero: al importar se invalidan solo los temas de los errores contados (los replay no)', async () => {
  const calls = [];
  const board = { invalidate: (ids) => calls.push([...ids].sort()) };
  const { imp } = await setup({ board });
  const b = block([E1, E2]);
  await imp.importErrors(b);
  const expected = [...new Set([...CATALOG.get('VRB.CAN_TO').temas_relacionados, ...CATALOG.get('VRB.THIRD_S_OMIT').temas_relacionados])].sort();
  assert.deepEqual(calls, [expected]);
  await imp.importErrors(b); // todo replay
  assert.equal(calls.length, 1);
  await imp.previewErrors(block([E3], '2026-10-26T00:00:00.000Z')); // la vista previa no invalida
  assert.equal(calls.length, 1);
});

test('si el tablero falla al invalidar, la importación sigue valiendo y avisa', async () => {
  const board = { invalidate: () => { throw new Error('caché rota'); } };
  const { db, imp } = await setup({ board });
  const r = await imp.importErrors(block([E1]));
  assert.equal(r.applied, 1);
  assert.equal((await rows(db)).length, 1);
  assert.ok(r.warnings.some((w) => /No se pudo refrescar el dominio/.test(w)));
});

test('integración real: sin invalidar el tablero se quedaría con la señal E vieja; con el tablero conectado se actualiza', async () => {
  const TOPIC = 'gram.modals.no_to';
  const db = createMemoryDb();
  await db.open();
  const clock = makeClock(NOW);
  const errors = createErrors({ db, catalog: CATALOG, clock });
  const mastery = createMastery({ db, events: createEvents({ db, clock }), errors, srs: createSrs(), clock });
  const board = createMasteryBoard({ mastery, db, clock });
  const imp = createChatImport({ db, errors, catalog: CATALOG, clock, topics: TOPICS, board });
  assert.equal((await board.get(TOPIC)).signals.E, 0);
  for (const d of ['2026-10-22T10:00:00.000Z', '2026-10-23T10:00:00.000Z', '2026-10-24T10:00:00.000Z']) await imp.importErrors(block([E1], d));
  assert.equal((await board.get(TOPIC)).signals.E, 0.25);
  const noBoard = createChatImport({ db, errors, catalog: CATALOG, clock, topics: TOPICS });
  await noBoard.importErrors(block([E1], '2026-10-25T09:00:00.000Z'));
  const stale = (await board.get(TOPIC)).signals.E;
  const fresh = (await mastery.compute(TOPIC)).signals.E;
  assert.equal(stale, 0.25);
  assert.equal(fresh, 0.5);
  await imp.importErrors(block([E1], '2026-10-25T10:00:00.000Z'));
  assert.equal((await board.get(TOPIC)).signals.E, (await mastery.compute(TOPIC)).signals.E);
});

// ---------- dependencias ----------
test('createChatImport exige lo que necesita y devuelve un objeto congelado', async () => {
  const { db, errors } = await setup();
  const clock = makeClock(NOW);
  const ok = { db, errors, catalog: CATALOG, clock };
  assert.throws(() => createChatImport(), /falta la base de datos/);
  assert.throws(() => createChatImport({ ...ok, db: {} }), /falta la base de datos/);
  assert.throws(() => createChatImport({ ...ok, errors: {} }), /falta el registro de errores/);
  assert.throws(() => createChatImport({ ...ok, catalog: {} }), /falta el catálogo/);
  assert.throws(() => createChatImport({ ...ok, clock: {} }), /reloj no válido/);
  assert.throws(() => createChatImport({ ...ok, clock: null }), /reloj no válido/);
  assert.throws(() => createChatImport({ ...ok, topics: 'x' }), /topics debe ser una lista/);
  assert.throws(() => createChatImport({ ...ok, board: {} }), /necesita invalidate/);
  const imp = createChatImport(ok);
  assert.ok(Object.isFrozen(imp));
  assert.deepEqual(Object.keys(imp).sort(), ['importErrors', 'previewErrors']);
});

// ---------- createSync ----------
async function syncWorld({ withErrors = true, board, topics, nowIso = NOW } = {}) {
  const db = createMemoryDb();
  await db.open();
  const clock = makeClock(nowIso);
  const errors = createErrors({ db, catalog: CATALOG, clock });
  const sync = createSync(withErrors ? { db, clock, errors, catalog: CATALOG, board, topics } : { db, clock });
  return { db, clock, errors, sync };
}

test('createSync: previewChatErrors e importChatErrors funcionan con los mismos resultados; sin errors y catalog lanzan un Error claro', async () => {
  const { db, sync } = await syncWorld();
  const b = sync.makeChatBlock('errores', { errores: [E1, E2] });
  assert.deepEqual(statuses(await sync.previewChatErrors(b)), ['new', 'new']);
  assert.equal((await sync.importChatErrors(b)).applied, 2);
  assert.deepEqual(statuses(await sync.importChatErrors(b)), ['replay', 'replay']);
  assert.equal((await rows(db)).length, 2);
  const bare = (await syncWorld({ withErrors: false })).sync;
  assert.throws(() => bare.previewChatErrors(b), /faltan `errors` y `catalog`/);
  assert.throws(() => bare.importChatErrors(b), /faltan `errors` y `catalog`/);
  const halfway = createSync({ db, errors: (await syncWorld()).errors });
  assert.throws(() => halfway.importChatErrors(b), /faltan `errors` y `catalog`/);
});

test('createSync: makeChatBlock con el reloj da un bloque que previewChatErrors lee con esa fecha', async () => {
  const { sync, clock } = await syncWorld();
  const b = sync.makeChatBlock('errores', { errores: [E1] });
  assert.equal((await sync.previewChatErrors(b)).generatedAt, clock.iso());
});

test('bitácora con datos reales: errores top de los últimos 14 días con el título del catálogo, y solo los de esa ventana', async () => {
  const { sync, errors } = await syncWorld();
  await errors.record({ ...E1, ts: '2026-10-20T10:00:00.000Z' });
  await errors.record({ ...E1, ts: '2026-10-21T10:00:00.000Z', impact: 'high' });
  await errors.record({ ...E2, ts: '2026-10-24T10:00:00.000Z' });
  await errors.record({ ...E3, ts: '2026-09-01T10:00:00.000Z' }); // fuera de la ventana
  const text = await sync.buildLog({ done: ['Importé errores del chat'], pending: ['Repasar modales'] });
  const lines = text.split('\n');
  const start = lines.indexOf('ERRORES TOP (últimos 14 días)');
  const top = lines.slice(start + 1, lines.indexOf('PENDIENTES') - 1);
  assert.equal(top.length, 2);
  assert.match(top[0], new RegExp(`^1\\. VRB\\.CAN_TO — ${CATALOG.get('VRB.CAN_TO').titulo_es.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}: 2 veces · impacto `));
  assert.match(top[1], /^2\. VRB\.THIRD_S_OMIT — .+: 1 vez/);
  assert.ok(!text.includes('SUBJ.OMIT'));
  assert.ok(!text.includes("I didn't can")); // el texto de la persona no sale
  assert.ok(text.includes('- Importé errores del chat'));
  assert.equal(lines[1], `Generada: ${NOW}`);
});

test('bitácora: windowDays cambia la ventana; topErrors y areas dados por quien llama mandan sobre lo calculado', async () => {
  const { sync, errors } = await syncWorld();
  await errors.record({ ...E3, ts: '2026-09-20T10:00:00.000Z' });
  assert.ok(!(await sync.buildLog()).includes('SUBJ.OMIT'));
  const wide = await sync.buildLog({ windowDays: 60 });
  assert.ok(wide.includes('ERRORES TOP (últimos 60 días)') && wide.includes('SUBJ.OMIT'));
  const given = await sync.buildLog({ topErrors: [{ code: 'X.Y', frequency: 3 }], areas: [{ area: 'gram', pct: 12 }] });
  assert.ok(given.includes('1. X.Y: 3 veces') && given.includes('- Gramática: 12 %') && !given.includes('SUBJ.OMIT'));
  const none = await sync.buildLog({ topErrors: [], areas: [] });
  assert.equal(none.split('\n').filter((l) => l === '- (nada registrado)').length, 5);
});

test('bitácora: sin errors/board no calcula nada y no falla; datos mal formados fallan antes de leer la base', async () => {
  const { sync } = await syncWorld({ withErrors: false });
  const text = await sync.buildLog();
  assert.equal(text.split('\n').filter((l) => l === '- (nada registrado)').length, 5);
  const world = await syncWorld();
  await assert.rejects(world.sync.buildLog({ topErrors: 'x' }), /topErrors debe ser una lista/);
  await assert.rejects(world.sync.buildLog({ windowDays: 0 }), /windowDays/);
  await assert.rejects(world.sync.buildLog(null), /los datos deben ser un objeto/);
  await assert.rejects(world.sync.buildLog([]), /los datos deben ser un objeto/);
  await assert.rejects(world.sync.buildLog({ nope: 1 }), /campo desconocido/);
});

test('bitácora: el dominio por área sale del tablero (solo áreas con temas vistos) y llama con los temas y la hora del reloj', async () => {
  const seen = [];
  const board = {
    byArea: async (topics, now) => {
      seen.push([topics, now.toISOString()]);
      return { groups: [{ key: 'gram', pct: 42, label: 'En progreso', seen: 3 }, { key: 'vocab', pct: 0, label: 'Sin ver', seen: 0 }, { key: 'verb', pct: 88, label: null, seen: 1 }] };
    },
  };
  const topics = TOPICS.slice(0, 5);
  const { sync } = await syncWorld({ board, topics });
  const text = await sync.buildLog();
  assert.ok(text.includes('- Gramática: 42 % (En progreso)'));
  assert.ok(text.includes('- Verbos: 88 %\n'));
  assert.ok(!text.includes('Vocabulario'));
  assert.deepEqual(seen, [[topics, NOW]]);
  const noTopics = (await syncWorld({ board })).sync; // tablero sin lista de temas: no se puede calcular
  assert.ok(!(await noTopics.buildLog()).includes('Gramática'));
});

test('bitácora con el tablero real: refleja el dominio de las áreas con temas vistos', async () => {
  const db = createMemoryDb();
  await db.open();
  const clock = makeClock(NOW);
  const rawEvents = createEvents({ db, clock });
  const errors = createErrors({ db, catalog: CATALOG, clock });
  const mastery = createMastery({ db, events: rawEvents, errors, srs: createSrs(), clock });
  const board = createMasteryBoard({ mastery, db, clock });
  const topics = TOPICS.filter((t) => t.area === 'gram').slice(0, 4);
  const sync = createSync({ db, clock, errors, catalog: CATALOG, board, topics });
  const empty = await sync.buildLog();
  assert.ok(!empty.includes('Gramática')); // nada visto todavía
  const direct = await board.byArea(topics, clock.now());
  assert.equal(direct.groups.filter((g) => g.seen > 0).length, 0);
});

test('makeLogBlock: un bloque bitacora que parseChatBlock devuelve idéntico, con la misma hora arriba y en el texto', async () => {
  const { sync, clock, errors } = await syncWorld();
  await errors.record({ ...E1, ts: '2026-10-24T10:00:00.000Z' });
  const b = await sync.makeLogBlock({ done: ['Hecho'], decisions: ['D1'] });
  const back = parseChatBlock(b);
  assert.equal(back.ok, true);
  assert.equal(back.kind, 'bitacora');
  assert.equal(back.generatedAt, clock.iso());
  assert.equal(back.payload.texto, await sync.buildLog({ done: ['Hecho'], decisions: ['D1'] }));
  assert.ok(back.payload.texto.includes(`Generada: ${back.generatedAt}`));
  await assert.rejects(sync.makeLogBlock({ done: 5 }), /done debe ser una lista/);
});

// ---------- Administrador, 2026-10-26: «N errores omitidos por no traer fecha» en la vista previa ----------
test('sin fecha: la vista previa y la importación avisan «N errores omitidos por no traer fecha» (singular y plural)', async () => {
  const { imp } = await setup();
  const own = { ...E2, ts: '2026-10-20T09:00:00.000Z' };
  const uno = noDate({ errores: [E1, own] });
  const dos = noDate({ errores: [E1, E3, own] });
  for (const [text, frase] of [[uno, '1 error omitido por no traer fecha.'], [dos, '2 errores omitidos por no traer fecha.']]) {
    const prev = await imp.previewErrors(text);
    assert.ok(prev.warnings.includes(frase), `vista previa: ${JSON.stringify(prev.warnings)}`);
    const done = await imp.importErrors(text);
    assert.ok(done.warnings.includes(frase), `importación: ${JSON.stringify(done.warnings)}`);
  }
});

test('sin fecha: sin errores sin fecha no hay aviso; un error inválido por otra causa no cuenta como «sin fecha»', async () => {
  const { imp } = await setup();
  const bueno = await imp.previewErrors(block([E1, E2]));
  assert.deepEqual(bueno.warnings, []);
  const otraCausa = await imp.previewErrors(block([E1, { original: 'texto', code: 'NO.EXISTE' }]));
  assert.deepEqual(statuses(otraCausa), ['new', 'invalid']);
  assert.equal(otraCausa.warnings.some((w) => /por no traer fecha/.test(w)), false);
  const mixto = await imp.previewErrors(noDate({ errores: [E1, { original: 'texto', code: 'NO.EXISTE', ts: '2026-10-20T09:00:00.000Z' }] }));
  assert.ok(mixto.warnings.includes('1 error omitido por no traer fecha.'));
  assert.equal(mixto.items[1].status, 'invalid'); // el segundo trae fecha: falla por su código, no se cuenta como «sin fecha»
});

test('sin fecha: el aviso convive con los demás avisos y la vista previa sigue sin escribir', async () => {
  const { db, imp } = await setup();
  const text = noDate({ errores: [E1], temas: [{ id: 'gram.modals.can_could', estado: 'active' }] });
  const antes = await snap(db);
  const prev = await imp.previewErrors(text);
  assert.equal(prev.warnings.length, 2);
  assert.equal(prev.warnings[0], '1 error omitido por no traer fecha.');
  assert.match(prev.warnings[1], /estado de tema se muestran pero no se aplican/);
  assert.equal(await snap(db), antes);
});
