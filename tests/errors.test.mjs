// @purpose: Pruebas de core/errors.js: record() con deduplicación y contador, get, list y count.
// Pruebas de core/errors.js (subparte 1.6, cuarto 1): record() con deduplicación, contador e idempotencia; get/list/count.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createErrors, ErrorRecordError, errorKey, seenOf, LIMITS, ERROR_FIELDS } from '../core/errors.js';
import { createErrorCatalog } from '../core/errorCatalog.js';
import { createMemoryDb } from '../core/db.memory.js';
import { DbError } from '../core/db.js';
import { localDay } from '../core/clock.js';
import { makeClock } from './_helpers.mjs';

const FILE = JSON.parse(fs.readFileSync(new URL('../content/taxonomy/error_codes.json', import.meta.url), 'utf8'));
const CATALOG = createErrorCatalog(FILE);

async function setup({ onWrite = null, clock = makeClock('2026-10-15T14:00:00.000Z') } = {}) {
  const db = createMemoryDb({ onWrite });
  await db.open();
  const errors = createErrors({ db, catalog: CATALOG, clock });
  return { db, errors, clock };
}
const base = (over = {}) => ({ original: "I didn't can to send it", code: 'VRB.CAN_TO', ...over });
const rows = (db) => db.query('errors', {});

test('primera vez: crea el registro completo (15 campos), con defaults del catálogo, ts del reloj, day local y seen', async () => {
  const { db, errors } = await setup();
  const r = await errors.record(base({ correction: "I couldn't send it", context: 'email a profesor' }));
  assert.deepEqual([r.created, r.counted, r.replay], [true, true, false]);
  const rec = r.record;
  assert.deepEqual(Object.keys(rec), ERROR_FIELDS);
  assert.match(rec.id, /^err_[0-9a-z]{11}$/);
  assert.equal(rec.ts, '2026-10-15T14:00:00.000Z');
  assert.match(rec.day, /^2026-10-1[45]$/);
  assert.equal(rec.original, "I didn't can to send it");
  assert.equal(rec.correction, "I couldn't send it");
  assert.equal(rec.context, 'email a profesor');
  const entry = CATALOG.get('VRB.CAN_TO');
  assert.deepEqual(rec.topics, [...entry.temas_relacionados]);
  assert.equal(rec.origin, entry.origen_tipico);
  assert.equal(rec.impact, entry.impacto_defecto);
  assert.equal(rec.kind, 'slip');
  assert.equal(rec.count, 1);
  assert.equal(rec.source, 'app');
  assert.equal(rec.itemId, null);
  assert.deepEqual(rec.seen, ['2026-10-15T14:00:00.000Z']);
  assert.deepEqual(await db.get('errors', rec.id), rec);
  assert.equal((await rows(db)).length, 1);
});

test('la entrada puede fijar topics, origin, impact, kind, source, itemId y ts; lo demás sigue siendo del catálogo', async () => {
  const { errors } = await setup();
  const r = await errors.record(base({
    topics: ['gram.modals.no_to', 'gram.modals.no_to', 'gram.modals.can_ability'], origin: 'developmental', impact: 'low', kind: 'systematic', source: 'chat',
    itemId: 'g.modals.0007', ts: '2026-09-01T10:00:00.000Z',
  }));
  const rec = r.record;
  assert.deepEqual(rec.topics, ['gram.modals.no_to', 'gram.modals.can_ability']); // sin repetidos
  assert.deepEqual([rec.origin, rec.impact, rec.kind, rec.source, rec.itemId, rec.ts], ['developmental', 'low', 'systematic', 'chat', 'g.modals.0007', '2026-09-01T10:00:00.000Z']);
  assert.equal(rec.count, 1);
  const empty = await errors.record(base({ original: 'otra frase', topics: [] }));
  assert.deepEqual(empty.record.topics, [...CATALOG.get('VRB.CAN_TO').temas_relacionados]); // [] = los del código
});

test('mismo error otra vez: NO crea otro; count+1, ts/day/seen a la última; kind sigue slip en la 2.ª ocurrencia y pasa a systematic en la 3.ª', async () => {
  const { db, errors, clock } = await setup();
  const a = await errors.record(base());
  clock.advanceDays(2);
  const b = await errors.record(base());
  assert.deepEqual([b.created, b.counted, b.replay], [false, true, false]);
  assert.equal(b.record.id, a.record.id);
  assert.equal(b.record.count, 2);
  assert.equal(b.record.kind, 'slip'); // decisión del Administrador: systematic solo desde count ≥ 3
  assert.equal(b.record.ts, '2026-10-17T14:00:00.000Z');
  assert.deepEqual(b.record.seen, ['2026-10-15T14:00:00.000Z', '2026-10-17T14:00:00.000Z']);
  assert.equal(b.record.day, (await db.get('errors', a.record.id)).day);
  assert.equal((await rows(db)).length, 1);
  clock.advance(1000);
  const c = await errors.record(base());
  assert.equal(c.record.count, 3);
  assert.equal(c.record.kind, 'systematic');
});

test('IDEMPOTENCIA (CA 5): repetir la misma ocurrencia (mismo ts) no cambia nada, ni en 100 reenvíos', async () => {
  const { db, errors } = await setup();
  const first = await errors.record(base({ ts: '2026-10-10T08:00:00.000Z' }));
  const before = JSON.stringify(await rows(db));
  for (let i = 0; i < 100; i += 1) {
    const again = await errors.record(base({ ts: new Date('2026-10-10T08:00:00.000Z') })); // otra forma de escribir el mismo instante
    assert.deepEqual([again.created, again.counted, again.replay], [false, false, true]);
    assert.deepEqual(again.record, first.record);
  }
  assert.equal(JSON.stringify(await rows(db)), before);
  // el mismo instante dado como milisegundos o con otra zona también es la misma ocurrencia
  assert.equal((await errors.record(base({ ts: Date.parse('2026-10-10T08:00:00.000Z') }))).replay, true);
  assert.equal((await errors.record(base({ ts: '2026-10-10T03:00:00.000-05:00' }))).replay, true);
  // un instante distinto (aunque sea 1 ms después) es otra ocurrencia
  assert.equal((await errors.record(base({ ts: '2026-10-10T08:00:00.001Z' }))).counted, true);
});

test('idempotencia con el reloj: dos avisos en el mismo milisegundo del reloj son la misma ocurrencia (doble toque)', async () => {
  const { errors } = await setup();
  const a = await errors.record(base());
  const b = await errors.record(base());
  assert.equal(b.replay, true);
  assert.equal(b.record.count, 1);
  assert.deepEqual(b.record, a.record);
});

test('«el mismo error» se compara normalizado: mayúsculas, apóstrofo curvo, espacios y punto final no crean otro registro', async () => {
  const { db, errors, clock } = await setup();
  await errors.record(base({ original: "I didn't can to send it." }));
  for (const variant of ["  i DIDN’T   can to send it  ", "I didn't can to send it!", "I didn't\u00a0can to send it"]) {
    clock.advance(1000);
    const r = await errors.record(base({ original: variant }));
    assert.equal(r.created, false, variant);
  }
  const all = await rows(db);
  assert.equal(all.length, 1);
  assert.equal(all[0].count, 4);
  assert.equal(all[0].original, "I didn't can to send it."); // se conserva la primera redacción
});

test('distinto código, distinta frase o distinto itemId = otro error (otro registro)', async () => {
  const { db, errors, clock } = await setup();
  await errors.record(base());
  clock.advance(1000);
  await errors.record(base({ code: 'VRB.DOUBLE_PAST' }));
  clock.advance(1000);
  await errors.record(base({ original: "I can't to go" }));
  clock.advance(1000);
  await errors.record(base({ itemId: 'g.modals.0001' }));
  clock.advance(1000);
  await errors.record(base({ itemId: 'g.modals.0002' }));
  const all = await rows(db);
  assert.equal(all.length, 5);
  assert.equal(new Set(all.map((r) => r.id)).size, 5);
  assert.ok(all.every((r) => r.count === 1 && r.kind === 'slip'));
  assert.equal(await errors.count(), 5);
  assert.equal(await errors.count({ code: 'VRB.CAN_TO' }), 4);
});

test('al repetirse: se rellenan correction y context si estaban vacíos, pero nunca se pisan; impact toma el mayor; kind nunca baja', async () => {
  const { errors, clock } = await setup();
  await errors.record(base({ impact: 'mid' }));
  clock.advance(1000);
  const b = await errors.record(base({ correction: "I couldn't send it", context: 'chat', impact: 'high' }));
  assert.equal(b.record.correction, "I couldn't send it");
  assert.equal(b.record.context, 'chat');
  assert.equal(b.record.impact, 'high');
  clock.advance(1000);
  const c = await errors.record(base({ correction: 'otra', context: 'otro', impact: 'low', kind: 'slip' }));
  assert.equal(c.record.correction, "I couldn't send it");
  assert.equal(c.record.context, 'chat');
  assert.equal(c.record.impact, 'high'); // no baja
  assert.equal(c.record.kind, 'systematic'); // no baja
  assert.equal(c.record.count, 3);
  assert.equal(c.record.source, 'app'); // se queda con la fuente de la primera vez
});

test('una entrada que pide kind systematic desde la primera vez lo conserva con count 1', async () => {
  const { errors } = await setup();
  const r = await errors.record(base({ kind: 'systematic' }));
  assert.equal(r.record.kind, 'systematic');
  assert.equal(r.record.count, 1);
});

test('ocurrencias fuera de orden: la más nueva manda en ts/day, y todas cuentan', async () => {
  const { errors } = await setup();
  await errors.record(base({ ts: '2026-10-10T10:00:00.000Z' }));
  const newer = await errors.record(base({ ts: '2026-10-12T10:00:00.000Z' }));
  assert.equal(newer.record.ts, '2026-10-12T10:00:00.000Z');
  const older = await errors.record(base({ ts: '2026-10-08T10:00:00.000Z' })); // llegó tarde (p. ej. importada)
  assert.equal(older.counted, true);
  assert.equal(older.record.count, 3);
  assert.equal(older.record.ts, '2026-10-12T10:00:00.000Z');
  assert.deepEqual(older.record.seen, ['2026-10-08T10:00:00.000Z', '2026-10-10T10:00:00.000Z', '2026-10-12T10:00:00.000Z']);
  assert.equal(older.record.day, localDay('2026-10-12T10:00:00.000Z')); // el día también es el de la más reciente, no el de la que llegó tarde
  assert.notEqual(older.record.day, localDay('2026-10-08T10:00:00.000Z'));
});

test('seen guarda solo las 10 más recientes; count sigue creciendo; una vieja que ya no cabe cuenta pero no queda en seen', async () => {
  const { errors } = await setup();
  let last;
  for (let i = 1; i <= 12; i += 1) last = await errors.record(base({ ts: `2026-10-${String(i).padStart(2, '0')}T10:00:00.000Z` }));
  assert.equal(last.record.count, 12);
  assert.equal(last.record.seen.length, LIMITS.seen);
  assert.equal(last.record.seen[0], '2026-10-03T10:00:00.000Z');
  assert.equal(last.record.seen[9], '2026-10-12T10:00:00.000Z');
  const old = await errors.record(base({ ts: '2026-09-01T10:00:00.000Z' }));
  assert.equal(old.record.count, 13);
  assert.equal(old.record.seen.length, LIMITS.seen);
  assert.equal(old.record.seen.includes('2026-09-01T10:00:00.000Z'), false);
  assert.equal(old.record.ts, '2026-10-12T10:00:00.000Z');
});

test('un registro venido de fuera (chat, sin seen y con otro id) se reconoce por código + texto y se mezcla en el mismo registro', async () => {
  const { db, errors } = await setup();
  await db.put('errors', {
    id: 'err_20261001_chat1', ts: '2026-10-01T09:00:00.000Z', day: '2026-10-01', original: "I didn't can to send it", correction: null, context: null,
    topics: ['gram.modals.no_to'], code: 'VRB.CAN_TO', origin: 'transfer_es', kind: 'systematic', impact: 'high', count: 3, source: 'chat', itemId: null,
  });
  const r = await errors.record(base({ ts: '2026-10-05T09:00:00.000Z' }));
  assert.equal(r.created, false);
  assert.equal(r.record.id, 'err_20261001_chat1');
  assert.equal(r.record.count, 4);
  assert.deepEqual(r.record.seen, ['2026-10-01T09:00:00.000Z', '2026-10-05T09:00:00.000Z']);
  assert.equal(r.record.source, 'chat');
  assert.equal((await rows(db)).length, 1);
  // y repetir la ocurrencia que ya traía el registro del chat es una repetición, no una nueva
  assert.equal((await errors.record(base({ ts: '2026-10-01T09:00:00.000Z' }))).replay, true);
  assert.deepEqual(seenOf({ ts: 'basura', seen: [5, null, '2026-10-02T00:00:00Z', 'x'] }), ['2026-10-02T00:00:00.000Z']);
});

test('colisión de id: si el id calculado lo ocupa OTRO error, se busca el siguiente libre y nada se pisa', async () => {
  const { db, errors } = await setup();
  const a = await errors.record(base());
  await db.delete('errors', a.record.id);
  await db.put('errors', { ...a.record, code: 'VRB.DOUBLE_PAST', original: 'un ocupante distinto' }); // ocupa el id
  const b = await errors.record(base());
  assert.equal(b.created, true);
  assert.equal(b.record.id, `${a.record.id}_1`);
  assert.equal((await db.get('errors', a.record.id)).original, 'un ocupante distinto');
  const again = await errors.record(base({ ts: '2026-10-16T00:00:00.000Z' }));
  assert.equal(again.record.id, `${a.record.id}_1`);
  assert.equal(again.record.count, 2);
});

test('errorKey: estable, normalizada y sensible al código y al itemId', () => {
  assert.equal(errorKey('A.B', "Hello  World.", null), errorKey('A.B', "hello world", undefined));
  assert.notEqual(errorKey('A.B', 'x', null), errorKey('A.C', 'x', null));
  assert.notEqual(errorKey('A.B', 'x', null), errorKey('A.B', 'x', 'it1'));
});

const BAD = [
  ['entrada nula', null], ['entrada texto', 'texto'], ['entrada lista', []], ['entrada número', 5], ['entrada indefinida', undefined],
  ['sin original', { code: 'VRB.CAN_TO' }], ['original vacío', base({ original: '' })], ['original solo espacios', base({ original: '  \n ' })],
  ['original número', base({ original: 5 })], ['original 501', base({ original: 'a'.repeat(501) })], ['original con control', base({ original: 'a\u0000b' })],
  ['original con tabulador', base({ original: 'a\tb' })], ['sin code', { original: 'x y' }], ['code vacío', base({ code: '' })], ['code desconocido', base({ code: 'NO.EXISTE' })],
  ['code número', base({ code: 7 })], ['code minúscula', base({ code: 'vrb.can_to' })], ['campo desconocido', base({ corection: 'typo' })], ['correction igual', base({ correction: "I didn't can to send it." })],
  ['correction 501', base({ correction: 'a'.repeat(501) })], ['correction número', base({ correction: 4 })], ['context 201', base({ context: 'a'.repeat(201) })],
  ['topics no lista', base({ topics: 'gram.a.b' })], ['topic mal formado', base({ topics: ['Gram A'] })], ['topic número', base({ topics: [3] })],
  ['11 topics', base({ topics: Array.from({ length: 11 }, (_, i) => `gram.t.t${i}`) })], ['origin raro', base({ origin: 'otro' })], ['impact raro', base({ impact: 'enorme' })],
  ['kind raro', base({ kind: 'grave' })], ['source raro', base({ source: 'web' })], ['itemId vacío', base({ itemId: '' })], ['itemId número', base({ itemId: 3 })],
  ['ts basura', base({ ts: 'ayer' })], ['ts objeto', base({ ts: {} })], ['ts futuro (+25 h)', base({ ts: '2026-10-16T15:00:01.000Z' })], ['ts NaN', base({ ts: NaN })],
  ['ts año 10000', base({ ts: '+010000-01-01T00:00:00.000Z' })],
];
test('entradas no válidas: ErrorRecordError con detalle en español y la base queda intacta', async () => {
  const { db, errors } = await setup();
  await errors.record(base({ original: 'registro previo' }));
  const snapshot = JSON.stringify(await rows(db));
  for (const [name, input] of BAD) {
    await assert.rejects(errors.record(input), (e) => e instanceof ErrorRecordError && e.code === 'BAD_ERROR_RECORD' && e.problems.length >= 1 && /^Error registrado no válido: /.test(e.message) && typeof e.friendly === 'string', name);
  }
  assert.equal(JSON.stringify(await rows(db)), snapshot);
});

test('el límite exacto sí pasa: 500 caracteres, 10 temas, ts a +24 h justas', async () => {
  const { errors } = await setup();
  const r = await errors.record(base({
    original: 'a'.repeat(500), correction: 'b'.repeat(500), context: 'c'.repeat(200),
    topics: Array.from({ length: 10 }, (_, i) => `gram.t.t${i}`), ts: '2026-10-16T14:00:00.000Z',
  }));
  assert.equal(r.record.original.length, 500);
  assert.equal(r.record.topics.length, 10);
});

test('textos con ñ, tildes, emoji, comillas curvas y saltos de línea se guardan tal cual; los espacios de los bordes se recortan', async () => {
  const { errors } = await setup();
  const text = 'Mañana yo “fui” al colegio 😀 y\nviví allí';
  const r = await errors.record(base({ original: `  ${text}  `, context: 'práctica ñandú 🙂' }));
  assert.equal(r.record.original, text);
  assert.equal(r.record.context, 'práctica ñandú 🙂');
  assert.equal((await errors.record(base({ original: text, ts: '2026-10-15T14:00:01.000Z' }))).created, false);
});

test('record no modifica la entrada (ni congelada) y la copia devuelta no comparte memoria con la base', async () => {
  const { db, errors } = await setup();
  const input = Object.freeze(base({ topics: Object.freeze(['gram.modals.no_to']) }));
  const snapshot = JSON.stringify(input);
  const r = await errors.record(input);
  assert.equal(JSON.stringify(input), snapshot);
  r.record.topics.push('x.y');
  r.record.seen.push('basura');
  r.record.count = 99;
  const stored = await db.get('errors', r.record.id);
  assert.deepEqual(stored.topics, ['gram.modals.no_to']);
  assert.equal(stored.count, 1);
  assert.equal(stored.seen.length, 1);
});

test('si la base falla (cuota llena) no se guarda nada y rechaza con DbError; luego, ya sin fallo, funciona', async () => {
  let fail = true;
  const { db, errors } = await setup({ onWrite: () => { if (fail) { const e = new Error('lleno'); e.name = 'QuotaExceededError'; throw e; } } });
  await assert.rejects(errors.record(base()), (e) => e instanceof DbError && e.code === 'QUOTA');
  assert.equal((await rows(db)).length, 0);
  fail = false;
  const ok = await errors.record(base());
  assert.equal(ok.created, true);
  assert.equal(ok.record.count, 1); // el intento fallido no dejó medio contado
  fail = true;
  await assert.rejects(errors.record(base({ ts: '2026-10-16T00:00:00.000Z' })), (e) => e instanceof DbError);
  assert.equal((await db.get('errors', ok.record.id)).count, 1); // y tampoco subió el contador
});

test('avisos simultáneos: 6 ocurrencias distintas del mismo error a la vez → un solo registro con count 6; el mismo ts a la vez cuenta una vez', async () => {
  const { db, errors } = await setup();
  const results = await Promise.all(Array.from({ length: 6 }, (_, i) => errors.record(base({ ts: `2026-10-0${i + 1}T10:00:00.000Z` }))));
  assert.equal(results.filter((r) => r.created).length, 1);
  const all = await rows(db);
  assert.equal(all.length, 1);
  assert.equal(all[0].count, 6);
  const same = await Promise.all(Array.from({ length: 4 }, () => errors.record(base({ original: 'otro error', ts: '2026-10-09T10:00:00.000Z' }))));
  assert.equal(same.filter((r) => r.counted).length, 1);
  assert.equal((await rows(db)).find((r) => r.original === 'otro error').count, 1);
});

test('reloj cambiado: un reloj atrasado no rompe nada (cuenta como ocurrencia más antigua) y uno adelantado >24 h se rechaza', async () => {
  const { errors, clock } = await setup();
  await errors.record(base());
  clock.set('2026-01-01T00:00:00.000Z'); // reloj atrasado
  const r = await errors.record(base());
  assert.equal(r.counted, true);
  assert.equal(r.record.ts, '2026-10-15T14:00:00.000Z'); // la última sigue siendo la de octubre
  assert.equal(r.record.count, 2);
  await assert.rejects(errors.record(base({ ts: '2026-10-20T00:00:00.000Z' })), ErrorRecordError); // viene del futuro respecto al reloj
});

test('get: devuelve el registro (copia) o null; id inválido → DbError BAD_QUERY', async () => {
  const { errors } = await setup();
  const { record } = await errors.record(base());
  assert.deepEqual(await errors.get(record.id), record);
  assert.equal(await errors.get('err_noexiste'), null);
  for (const bad of ['', undefined, null, 5, {}]) await assert.rejects(errors.get(bad), (e) => e instanceof DbError && e.code === 'BAD_QUERY');
});

test('list: filtra por code, topic y day; orden por ts (desc por defecto); limit; combina filtros; copias', async () => {
  const { errors } = await setup();
  const mk = (original, code, ts, topics) => errors.record({ original, code, ts, ...(topics ? { topics } : {}) });
  await mk('uno uno', 'VRB.CAN_TO', '2026-10-01T12:00:00.000Z', ['gram.modals.no_to']);
  await mk('dos dos', 'VRB.CAN_TO', '2026-10-03T12:00:00.000Z', ['gram.modals.no_to', 'gram.modals.can_ability']);
  await mk('tres tres', 'TNS.SINCE_FOR', '2026-10-02T12:00:00.000Z');
  await mk('cuatro cuatro', 'NEG.DOUBLE', '2026-10-04T12:00:00.000Z');
  await mk('cinco cinco', 'NEG.DOUBLE', '2026-10-04T12:00:00.000Z'); // empata en ts con «cuatro»: desempata por id
  const orig = (rs) => rs.map((r) => r.original);
  const desc = orig(await errors.list());
  const asc = orig(await errors.list({ order: 'asc' }));
  assert.deepEqual(desc.slice(2), ['dos dos', 'tres tres', 'uno uno']);
  assert.deepEqual(asc.slice(0, 3), ['uno uno', 'tres tres', 'dos dos']);
  assert.deepEqual(new Set(desc.slice(0, 2)), new Set(['cuatro cuatro', 'cinco cinco']));
  assert.deepEqual(desc, [...asc].reverse()); // el desempate por id es estable: desc es exactamente el inverso de asc
  assert.deepEqual(orig(await errors.list({ code: 'VRB.CAN_TO' })), ['dos dos', 'uno uno']);
  assert.deepEqual(orig(await errors.list({ topic: 'gram.modals.can_ability' })), ['dos dos']);
  assert.deepEqual(orig(await errors.list({ code: 'VRB.CAN_TO', limit: 1 })), ['dos dos']);
  assert.deepEqual(orig(await errors.list({ code: 'VRB.CAN_TO', topic: 'gram.modals.can_ability' })), ['dos dos']);
  assert.deepEqual(await errors.list({ code: 'VRB.CAN_TO', limit: 0 }), []);
  assert.deepEqual(await errors.list({ code: 'PREP.DEP' }), []);
  const all = await errors.list();
  all[0].topics.push('mutado');
  assert.equal((await errors.list())[0].topics.includes('mutado'), false);
  const days = new Set((await errors.list()).map((r) => r.day));
  assert.ok(days.size >= 3);
  for (const d of days) assert.ok((await errors.list({ day: d })).every((r) => r.day === d));
});

test('list/count con opciones absurdas: DbError BAD_QUERY, nunca «todo» en silencio', async () => {
  const { errors } = await setup();
  await errors.record(base());
  const badList = [5, [], 'x', { colour: 'rojo' }, { code: '' }, { code: 3 }, { topic: null }, { day: 20261015 }, { order: 'up' }, { limit: -1 }, { limit: 1.5 }, { limit: '2' }];
  for (const o of badList) await assert.rejects(errors.list(o), (e) => e instanceof DbError && e.code === 'BAD_QUERY', JSON.stringify(o));
  for (const o of [5, [], { topic: 'x.y' }, { code: '' }, { code: 3 }]) await assert.rejects(errors.count(o), (e) => e instanceof DbError && e.code === 'BAD_QUERY', JSON.stringify(o));
  assert.equal((await errors.list(null)).length, 1);
  assert.equal(await errors.count(null), 1);
});

test('createErrors: argumentos inválidos fallan al crear con un mensaje claro', async () => {
  const db = createMemoryDb();
  await db.open();
  assert.throws(() => createErrors(), /falta la base de datos/);
  assert.throws(() => createErrors({ db: {} , catalog: CATALOG }), /falta la base de datos/);
  assert.throws(() => createErrors({ db }), /falta el catálogo/);
  assert.throws(() => createErrors({ db, catalog: {} }), /falta el catálogo/);
  assert.throws(() => createErrors({ db, catalog: CATALOG, clock: {} }), /reloj no válido/);
  assert.ok(Object.isFrozen(createErrors({ db, catalog: CATALOG })));
});

test('rendimiento: 300 errores distintos + 300 repeticiones se registran sin tardar y list/count responden al instante', async () => {
  const { errors, clock } = await setup();
  const t0 = Date.now();
  const codes = CATALOG.ids();
  for (let i = 0; i < 300; i += 1) { clock.advance(1000); await errors.record({ original: `frase ${i}`, code: codes[i % codes.length] }); }
  for (let i = 0; i < 300; i += 1) { clock.advance(1000); await errors.record({ original: `frase ${i}`, code: codes[i % codes.length] }); }
  assert.equal(await errors.count(), 300);
  const all = await errors.list();
  assert.equal(all.length, 300);
  assert.ok(all.every((r) => r.count === 2 && r.kind === 'slip'));
  assert.ok(Date.now() - t0 < 5000);
});

test('una fecha cuyo día local cae fuera de AAAA-MM-DD (año 0 en un huso al oeste, como Colombia) se rechaza en vez de guardar un día roto', async () => {
  const saved = process.env.TZ;
  process.env.TZ = 'America/Bogota';
  try {
    const { db, errors } = await setup();
    assert.doesNotMatch(localDay('0000-01-01T00:00:00.000Z'), /^\d{4}-\d{2}-\d{2}$/); // la premisa de la prueba: aquí el día local queda mal formado
    await assert.rejects(errors.record(base({ ts: '0000-01-01T00:00:00.000Z' })), (e) => e instanceof ErrorRecordError && e.problems[0].path === 'ts');
    assert.equal((await rows(db)).length, 0);
  } finally {
    if (saved === undefined) delete process.env.TZ; else process.env.TZ = saved;
  }
});

test('entrada hostil: un getter que lanza, un Proxy, __proto__ y objetos con prototipo raro dan ErrorRecordError o se tratan como datos, sin contaminar nada', async () => {
  const { db, errors } = await setup();
  const evil = { code: 'VRB.CAN_TO', get original() { throw new Error('boom'); } };
  await assert.rejects(errors.record(evil), (e) => e instanceof ErrorRecordError && /no se pudo leer/.test(e.message));
  const proxy = new Proxy({}, { ownKeys() { throw new Error('nope'); } });
  await assert.rejects(errors.record(proxy), ErrorRecordError);
  const proto = JSON.parse('{"original":"I can to go","code":"VRB.CAN_TO","__proto__":{"polluted":true}}');
  await assert.rejects(errors.record(proto), (e) => e instanceof ErrorRecordError && e.problems.some((p) => p.path === '__proto__'));
  assert.equal({}.polluted, undefined);
  const ok = await errors.record(Object.assign(Object.create({ original: 'heredado', code: 'NEG.DOUBLE' }), { original: 'I don\'t know nothing', code: 'NEG.DOUBLE' }));
  assert.equal(ok.record.original, "I don't know nothing"); // solo cuentan las propiedades propias
  assert.equal((await rows(db)).length, 1);
  // un texto con prefijos de prototipo como contenido es solo texto
  const txt = await errors.record(base({ original: '__proto__ constructor toString', context: 'hasOwnProperty' }));
  assert.equal(txt.record.original, '__proto__ constructor toString');
});

test('recorrido: una respuesta mal contestada se guarda como evento y como error; repetirla en otro día sube el contador y reenviar el mismo aviso no lo infla', async () => {
  const { createEvents } = await import('../core/events.js');
  const { db, errors, clock } = await setup();
  const events = createEvents({ db, clock });
  const answer = () => ({
    type: 'answer', itemId: 'g.modals.0007', cardId: 'g.modals.0007#0', topics: ['gram.modals.no_to'], exerciseType: 'fix_error', result: 'wrong', rating: 1,
    ms: 9000, responseRaw: "I didn't can to send it", errorCodes: ['VRB.CAN_TO'], mode: 'mech', channel: 'keyboard',
  });
  const day = async () => {
    const ev = await events.log(answer());
    return errors.record({ original: ev.responseRaw, code: ev.errorCodes[0], topics: ev.topics, itemId: ev.itemId, ts: ev.ts, correction: "I couldn't send it" });
  };
  const first = await day();
  assert.deepEqual([first.created, first.record.count, first.record.kind], [true, 1, 'slip']);
  const again = await errors.record({ original: "I didn't can to send it", code: 'VRB.CAN_TO', topics: ['gram.modals.no_to'], itemId: 'g.modals.0007', ts: first.record.ts });
  assert.equal(again.replay, true); // el mismo aviso reenviado
  clock.advanceDays(3);
  const second = await day();
  assert.deepEqual([second.created, second.record.count, second.record.kind, second.record.id], [false, 2, 'slip', first.record.id]);
  assert.equal((await events.recentErrorsByCode('VRB.CAN_TO', { since: '2026-10-01T00:00:00.000Z' })).length, 2); // los eventos y el contador coinciden
  assert.equal(await errors.count(), 1);
  assert.equal(second.record.seen.length, 2);
});

test('un registro guardado con campos dañados (impact ilegible, count 0, seen basura) se repara al repetirse en vez de propagar la basura', async () => {
  const { db, errors } = await setup();
  await db.put('errors', {
    id: 'err_dañado', ts: '2026-10-01T09:00:00.000Z', day: '2026-10-01', original: 'I can to go', correction: null, context: null, topics: ['gram.modals.no_to'],
    code: 'VRB.CAN_TO', origin: 'transfer_es', kind: 'slip', impact: 'enorme', count: 0, source: 'chat', itemId: null, seen: 'no es lista',
  });
  const r = await errors.record({ original: 'I can to go', code: 'VRB.CAN_TO', ts: '2026-10-02T09:00:00.000Z', impact: 'mid' });
  assert.equal(r.record.id, 'err_dañado');
  assert.equal(r.record.impact, 'mid'); // el impacto ilegible no gana
  assert.equal(r.record.count, 2); // count 0 se lee como 1
  assert.deepEqual(r.record.seen, ['2026-10-01T09:00:00.000Z', '2026-10-02T09:00:00.000Z']);
  assert.equal(r.record.kind, 'slip'); // solo 2 ocurrencias: sigue siendo un desliz
});
