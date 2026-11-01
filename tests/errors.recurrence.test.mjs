// @purpose: Pruebas del registro de errores: regla de kind con umbral 3, reincidencia y byTopic.
// Pruebas del cuarto 2 de la 1.6 (parte 1): regla de `kind` con umbral 3, reincidencia (3 veces en 14 días) y byTopic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createErrors, recurrence, RECURRENCE, LIMITS } from '../core/errors.js';
import { createErrorCatalog } from '../core/errorCatalog.js';
import { createMemoryDb } from '../core/db.memory.js';
import { makeClock } from './_helpers.mjs';

const CATALOG = createErrorCatalog(JSON.parse(fs.readFileSync(new URL('../content/taxonomy/error_codes.json', import.meta.url), 'utf8')));
const NOW = '2026-10-20T12:00:00.000Z';
const DAY = 86400000;
const iso = (offsetMs) => new Date(Date.parse(NOW) + offsetMs).toISOString();

async function setup() {
  const db = createMemoryDb();
  await db.open();
  const clock = makeClock(NOW);
  return { db, clock, errors: createErrors({ db, catalog: CATALOG, clock }) };
}
const base = (over = {}) => ({ original: "I didn't can to send it", code: 'VRB.CAN_TO', ...over });
const code = async (fn) => { try { await fn(); } catch (e) { return e.code ?? e.name; } return 'NO LANZÓ'; };

// ---------- kind: umbral 3 (decisión del Administrador) ----------
test('kind: slip en la 1.ª y la 2.ª ocurrencia, systematic desde la 3.ª, y ya no baja', async () => {
  const { errors, clock } = await setup();
  const kinds = [];
  for (let i = 0; i < 5; i += 1) { clock.advance(1000); kinds.push((await errors.record(base())).record.kind); }
  assert.deepEqual(kinds, ['slip', 'slip', 'systematic', 'systematic', 'systematic']);
});

test('kind: el umbral de kind es el mismo de la reincidencia (RECURRENCE.times = 3, 14 días)', () => {
  assert.deepEqual({ ...RECURRENCE }, { times: 3, days: 14 });
  assert.ok(Object.isFrozen(RECURRENCE));
});

test('kind: una entrada que pide systematic se respeta también al repetirse (2.ª ocurrencia) y un slip explícito no lo baja', async () => {
  const { errors, clock } = await setup();
  await errors.record(base());
  clock.advance(1000);
  const b = await errors.record(base({ kind: 'systematic' }));
  assert.equal(b.record.count, 2);
  assert.equal(b.record.kind, 'systematic'); // explícito: se respeta
  clock.advance(1000);
  const c = await errors.record(base({ kind: 'slip' }));
  assert.equal(c.record.kind, 'systematic'); // nunca baja
});

test('kind: un registro del chat que ya era systematic con count 1 sigue systematic al repetirse en la 2.ª', async () => {
  const { db, errors } = await setup();
  await db.put('errors', {
    id: 'err_chat', ts: '2026-10-01T09:00:00.000Z', day: '2026-10-01', original: 'I can to go', correction: null, context: null, topics: ['gram.modals.no_to'],
    code: 'VRB.CAN_TO', origin: 'transfer_es', kind: 'systematic', impact: 'high', count: 1, source: 'chat', itemId: null,
  });
  const r = await errors.record({ original: 'I can to go', code: 'VRB.CAN_TO', ts: '2026-10-02T09:00:00.000Z' });
  assert.deepEqual([r.record.count, r.record.kind], [2, 'systematic']);
});

test('kind: un kind ilegible guardado cuenta como slip hasta la 3.ª ocurrencia', async () => {
  const { db, errors } = await setup();
  await db.put('errors', {
    id: 'err_raro', ts: '2026-10-01T09:00:00.000Z', day: '2026-10-01', original: 'I can to go', correction: null, context: null, topics: ['gram.modals.no_to'],
    code: 'VRB.CAN_TO', origin: 'transfer_es', kind: 'raro', impact: 'high', count: 1, source: 'chat', itemId: null,
  });
  const b = await errors.record({ original: 'I can to go', code: 'VRB.CAN_TO', ts: '2026-10-02T09:00:00.000Z' });
  assert.equal(b.record.kind, 'slip');
  const c = await errors.record({ original: 'I can to go', code: 'VRB.CAN_TO', ts: '2026-10-03T09:00:00.000Z' });
  assert.equal(c.record.kind, 'systematic');
});

// ---------- recurrence(): función pura ----------
const rec = (seen, extra = {}) => ({ id: 'e1', code: 'VRB.CAN_TO', ts: seen[seen.length - 1], seen, count: seen.length, ...extra });

test('recurrence: 3 ocurrencias fechadas en los últimos 14 días = reincidente; con 2 no', () => {
  const r3 = recurrence(rec([iso(-10 * DAY), iso(-5 * DAY), iso(-1 * DAY)]), NOW);
  assert.deepEqual(r3, { inWindow: 3, recurrent: true, last: iso(-1 * DAY) });
  const r2 = recurrence(rec([iso(-10 * DAY), iso(-1 * DAY)]), NOW);
  assert.deepEqual([r2.inWindow, r2.recurrent], [2, false]);
});

test('recurrence: los bordes de la ventana: justo 14 días atrás entra, 1 ms antes no; «ahora» entra, el futuro no', () => {
  const edge = recurrence(rec([iso(-14 * DAY), iso(-14 * DAY + 1), iso(0)]), NOW);
  assert.equal(edge.inWindow, 3);
  const out = recurrence(rec([iso(-14 * DAY - 1), iso(-5 * DAY), iso(-1 * DAY)]), NOW);
  assert.deepEqual([out.inWindow, out.recurrent], [2, false]);
  const future = recurrence(rec([iso(-2 * DAY), iso(-1 * DAY), iso(1)]), NOW);
  assert.deepEqual([future.inWindow, future.recurrent], [2, false]); // una ocurrencia «del futuro» (reloj raro) no cuenta
});

test('recurrence: las ocurrencias SIN fecha (count mayor que seen, p. ej. del chat) no cuentan', () => {
  const chat = { id: 'c', code: 'VRB.CAN_TO', ts: iso(-1 * DAY), count: 5 }; // 5 veces según el chat, una sola fecha conocida
  assert.deepEqual(recurrence(chat, NOW), { inWindow: 1, recurrent: false, last: iso(-1 * DAY) });
});

test('recurrence: registro vacío, dañado o no objeto → 0 ocurrencias, sin lanzar; un now ilegible sí lanza', () => {
  for (const bad of [null, undefined, 5, 'x', [], {}, { ts: 'basura', seen: 'no es lista' }, { ts: null, seen: [1, null, 'x'] }]) {
    assert.deepEqual(recurrence(bad, NOW), { inWindow: 0, recurrent: false, last: null }, JSON.stringify(bad));
  }
  assert.throws(() => recurrence(rec([iso(0)]), 'ayer'), /toDate/);
  assert.throws(() => recurrence(rec([iso(0)]), undefined), /toDate/);
});

test('recurrence: acepta now como Date, ms o ISO', () => {
  const r = rec([iso(-3 * DAY), iso(-2 * DAY), iso(-1 * DAY)]);
  for (const now of [new Date(NOW), Date.parse(NOW), NOW]) assert.equal(recurrence(r, now).inWindow, 3);
});

test('recurrence: no modifica el registro que recibe', () => {
  const r = rec([iso(-3 * DAY), iso(-2 * DAY), iso(-1 * DAY)]);
  const before = JSON.stringify(r);
  recurrence(r, NOW);
  assert.equal(JSON.stringify(r), before);
});

// ---------- recurrent(): sobre la base ----------
async function seed(errors, original, offsetsDays, over = {}) {
  for (const d of offsetsDays) await errors.record(base({ original, ts: iso(d * DAY), ...over }));
}

test('recurrent: lista solo los errores con 3+ ocurrencias en 14 días; ordena por ocurrencias, luego por la más reciente', async () => {
  const { errors } = await setup();
  await seed(errors, 'frase A', [-10, -5, -1]); // 3, última -1
  await seed(errors, 'frase B', [-20, -2, -1.5]); // solo 2 dentro (la de -20 no)
  await seed(errors, 'frase C', [-9, -8, -7, -3]); // 4, última -3
  await seed(errors, 'frase D', [-12, -6, -2]); // 3, última -2
  const out = await errors.recurrent();
  assert.deepEqual(out.map((e) => [e.record.original, e.inWindow]), [['frase C', 4], ['frase A', 3], ['frase D', 3]]); // empatan en 3: A es más reciente (-1) que D (-2)
  assert.deepEqual(Object.keys(out[0]), ['key', 'by', 'code', 'record', 'records', 'topics', 'inWindow', 'last']);
  assert.equal(out[0].by, 'error');
  assert.equal(out[0].last, iso(-3 * DAY));
  assert.equal(out[0].records, 1);
});

test('recurrent: el borde de la ventana es inclusivo a los 14 días justos y excluye 1 ms antes', async () => {
  const { errors } = await setup();
  await errors.record(base({ original: 'borde', ts: iso(-14 * DAY) }));
  await errors.record(base({ original: 'borde', ts: iso(-5 * DAY) }));
  await errors.record(base({ original: 'borde', ts: iso(-1 * DAY) }));
  assert.equal((await errors.recurrent()).length, 1);
  await errors.record(base({ original: 'fuera', ts: iso(-14 * DAY - 1) }));
  await errors.record(base({ original: 'fuera', ts: iso(-5 * DAY) }));
  await errors.record(base({ original: 'fuera', ts: iso(-1 * DAY) }));
  assert.deepEqual((await errors.recurrent()).map((e) => e.record.original), ['borde']); // «fuera» solo tiene 2 dentro
});

test('recurrent: con las mismas ocurrencias y la misma última fecha, manda la clave (orden determinista)', async () => {
  const { errors } = await setup();
  await seed(errors, 'frase uno', [-3, -2, -1]);
  await seed(errors, 'frase dos', [-3, -2, -1]);
  await seed(errors, 'frase tres', [-3, -2, -1]);
  const got = (await errors.recurrent()).map((e) => e.key);
  assert.equal(got.length, 3);
  assert.deepEqual(got, [...got].sort());
});

test('recurrent: el desempate por clave no depende del orden en que el motor devuelva las filas', async () => {
  const { db } = await setup();
  const seen = [iso(-3 * DAY), iso(-2 * DAY), iso(-1 * DAY)];
  const mk = (id) => ({ id, code: 'VRB.CAN_TO', original: id, ts: seen[2], seen, count: 3, impact: 'high', topics: [] });
  for (const order of [['err_a', 'err_b', 'err_c'], ['err_c', 'err_b', 'err_a'], ['err_b', 'err_c', 'err_a']]) {
    const errors = createErrors({ db: { ...db, query: async () => order.map(mk) }, catalog: CATALOG, clock: makeClock(NOW) });
    assert.deepEqual((await errors.recurrent()).map((e) => e.key), ['err_a', 'err_b', 'err_c']);
  }
});

test('recurrent: filtra por code y topic aunque el motor de base devolviera de más (defensa en profundidad)', async () => {
  const { db } = await setup();
  const rows = [
    { id: 'a', code: 'VRB.CAN_TO', original: 'a', ts: iso(-1 * DAY), seen: [iso(-3 * DAY), iso(-2 * DAY), iso(-1 * DAY)], count: 3, impact: 'high', topics: ['gram.modals.no_to'] },
    { id: 'b', code: 'NEG.DOUBLE', original: 'b', ts: iso(-1 * DAY), seen: [iso(-3 * DAY), iso(-2 * DAY), iso(-1 * DAY)], count: 3, impact: 'high', topics: ['gram.negation.double_negative'] },
  ];
  const errors = createErrors({ db: { ...db, query: async () => rows }, catalog: CATALOG, clock: makeClock(NOW) });
  assert.deepEqual((await errors.recurrent({ code: 'NEG.DOUBLE' })).map((e) => e.key), ['b']);
  assert.deepEqual((await errors.recurrent({ topic: 'gram.modals.no_to' })).map((e) => e.key), ['a']);
  assert.equal((await errors.recurrent()).length, 2);
});

test('recurrent: now fija la ventana; por defecto la del reloj', async () => {
  const { errors } = await setup();
  await seed(errors, 'frase A', [-10, -5, -1]);
  assert.equal((await errors.recurrent()).length, 1);
  assert.equal((await errors.recurrent({ now: iso(30 * DAY) })).length, 0); // un mes después ya no reincide
  assert.equal((await errors.recurrent({ now: iso(-1 * DAY) })).length, 1); // «ayer» a esa hora: la ocurrencia de ese instante entra (borde inclusivo)
  assert.equal((await errors.recurrent({ now: iso(-1 * DAY - 1) })).length, 0); // 1 ms antes solo conoce 2 (la tercera aún «no ocurrió»)
  assert.equal((await errors.recurrent({ now: new Date(iso(0)) })).length, 1);
});

test('recurrent: filtra por code y por topic', async () => {
  const { errors } = await setup();
  await seed(errors, 'frase A', [-3, -2, -1]);
  await seed(errors, 'since', [-3, -2, -1], { code: 'TNS.SINCE_FOR' });
  assert.equal((await errors.recurrent()).length, 2);
  assert.deepEqual((await errors.recurrent({ code: 'TNS.SINCE_FOR' })).map((e) => e.code), ['TNS.SINCE_FOR']);
  assert.deepEqual((await errors.recurrent({ topic: 'gram.present_perfect.for_since' })).map((e) => e.code), ['TNS.SINCE_FOR']);
  assert.deepEqual(await errors.recurrent({ topic: 'gram.no.existe' }), []);
  assert.deepEqual(await errors.recurrent({ code: 'NO.EXISTE' }), []);
});

test('recurrent by "code": frases distintas del mismo código suman; by "error" no', async () => {
  const { errors } = await setup();
  await seed(errors, 'frase A', [-3]);
  await seed(errors, 'frase B', [-2]);
  await seed(errors, 'frase C', [-1]);
  assert.deepEqual(await errors.recurrent(), []); // cada frase solo una vez
  const byCode = await errors.recurrent({ by: 'code' });
  assert.equal(byCode.length, 1);
  assert.deepEqual([byCode[0].key, byCode[0].by, byCode[0].code, byCode[0].records, byCode[0].inWindow, byCode[0].record], ['VRB.CAN_TO', 'code', 'VRB.CAN_TO', 3, 3, null]);
  assert.deepEqual(byCode[0].topics, [...CATALOG.get('VRB.CAN_TO').temas_relacionados].sort());
  assert.equal(byCode[0].last, iso(-1 * DAY));
});

test('recurrent: dos errores con el mismo ts (una frase con dos fallos) son dos ocurrencias del código', async () => {
  const { errors } = await setup();
  await errors.record(base({ original: 'frase A', ts: iso(-1 * DAY) }));
  await errors.record(base({ original: 'frase B', ts: iso(-1 * DAY) }));
  await errors.record(base({ original: 'frase C', ts: iso(-1 * DAY) }));
  assert.equal((await errors.recurrent({ by: 'code' }))[0].inWindow, 3);
});

test('recurrent: con más de 10 ocurrencias recientes, seen guarda 10 y sigue siendo reincidente', async () => {
  const { errors } = await setup();
  await seed(errors, 'frase A', Array.from({ length: 12 }, (_, i) => -12 + i));
  const [e] = await errors.recurrent();
  assert.equal(e.record.count, 12);
  assert.equal(e.inWindow, LIMITS.seen);
});

test('recurrent: un registro dañado o del chat sin seen no rompe la lista', async () => {
  const { db, errors } = await setup();
  await db.put('errors', { id: 'err_x', code: 'VRB.CAN_TO', original: 'x', ts: 'basura', seen: 'no', count: 'mucho', topics: 'no', impact: 'enorme' });
  await db.put('errors', { id: 'err_y', code: 'VRB.CAN_TO', original: 'y', ts: iso(-1 * DAY), count: 9, topics: ['gram.modals.no_to'] });
  await seed(errors, 'frase A', [-3, -2, -1]);
  const out = await errors.recurrent();
  assert.deepEqual(out.map((e) => e.record.original), ['frase A']);
});

test('recurrent: opciones mal formadas → BAD_QUERY, nunca «todo» en silencio', async () => {
  const { errors } = await setup();
  for (const bad of ['x', 5, [], { by: 'tema' }, { by: 5 }, { raro: 1 }, { topic: '' }, { code: 7 }, { now: 'ayer' }, { now: NaN }, { now: {} }]) {
    assert.equal(await code(() => errors.recurrent(bad)), 'BAD_QUERY', JSON.stringify(bad));
  }
  assert.deepEqual(await errors.recurrent(null), []);
  assert.deepEqual(await errors.recurrent({}), []);
});

test('recurrent: no escribe nada en la base', async () => {
  const { db, errors } = await setup();
  await seed(errors, 'frase A', [-3, -2, -1]);
  const before = JSON.stringify(await db.query('errors', {}));
  await errors.recurrent();
  await errors.recurrent({ by: 'code' });
  assert.equal(JSON.stringify(await db.query('errors', {})), before);
});

test('recurrent: el registro devuelto es una copia (cambiarla no toca la base)', async () => {
  const { db, errors } = await setup();
  await seed(errors, 'frase A', [-3, -2, -1]);
  const [e] = await errors.recurrent();
  e.record.count = 999;
  e.record.topics.push('x.y.z');
  assert.equal((await db.query('errors', {}))[0].count, 3);
});

// ---------- byTopic ----------
test('byTopic: devuelve los errores del tema, el más reciente primero, como copias', async () => {
  const { db, errors } = await setup();
  await errors.record(base({ original: 'uno', ts: iso(-3 * DAY) }));
  await errors.record(base({ original: 'dos', ts: iso(-1 * DAY) }));
  await errors.record({ original: 'since', code: 'TNS.SINCE_FOR', ts: iso(-2 * DAY) });
  const got = await errors.byTopic('gram.modals.no_to');
  assert.deepEqual(got.map((r) => r.original), ['dos', 'uno']);
  got[0].original = 'cambiado';
  assert.equal((await errors.byTopic('gram.modals.no_to'))[0].original, 'dos');
  assert.equal((await db.query('errors', {})).length, 3);
  assert.deepEqual(await errors.byTopic('gram.no.existe'), []);
});

test('byTopic: un id vacío, ausente o que no es texto lanza BAD_QUERY (no devuelve todo)', async () => {
  const { errors } = await setup();
  await errors.record(base());
  for (const bad of [undefined, null, '', 5, {}, []]) assert.equal(await code(() => errors.byTopic(bad)), 'BAD_QUERY', String(bad));
});

test('la API del registro es la esperada y está congelada', async () => {
  const { errors } = await setup();
  assert.deepEqual(Object.keys(errors), ['record', 'prepare', 'applyIn', 'get', 'list', 'count', 'byTopic', 'recurrent', 'top']);
  assert.ok(Object.isFrozen(errors));
});
