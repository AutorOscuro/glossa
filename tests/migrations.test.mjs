// @purpose: Pruebas de core/migrations.js, core/dbErrors.js y los ayudantes puros de core/db.js.
// Pruebas de core/migrations.js, core/dbErrors.js y de los ayudantes puros de core/db.js (subparte 0.7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MIGRATIONS, latestVersion, checkMigrations, runMigrations,
} from '../core/migrations.js';
import { DbError, DB_CODES, classifyError, friendlyMessage } from '../core/dbErrors.js';
import {
  STORES, SCHEMA_VERSION, validateSchema, compareKeys, indexKeys, compileQuery, runQuery, buildExport, prepareImport, planImport,
  isReserved, EXPORT_FORMAT,
} from '../core/db.js';
import { createMemoryDb } from '../core/db.memory.js';

const kp = (s) => (STORES[s] ? STORES[s].keyPath : null);

test('la lista real de migraciones es válida y coincide con SCHEMA_VERSION', () => {
  assert.equal(checkMigrations(MIGRATIONS), latestVersion(MIGRATIONS));
  assert.equal(latestVersion(MIGRATIONS), SCHEMA_VERSION);
  assert.ok(Object.isFrozen(MIGRATIONS));
});

test('checkMigrations exige pasos consecutivos desde la v2', () => {
  assert.equal(checkMigrations([]), 1);
  assert.equal(checkMigrations([{ to: 2 }, { to: 3 }]), 3);
  for (const bad of [[{ to: 3 }], [{ to: 2 }, { to: 2 }], [{ to: 2 }, { to: 4 }], [{ to: '2' }], [null], 'x', [{ to: 2, transform: 5 }], [{ to: 2, transform: null }]]) {
    assert.throws(() => checkMigrations(bad), (e) => e instanceof DbError && e.code === 'MIGRATION');
  }
});

test('runMigrations: aplica en orden, no muta la entrada y puede descartar', () => {
  const steps = [
    { to: 2, transform: { a: (r) => ({ ...r, v2: true }) } },
    { to: 3, transform: { a: (r) => (r.drop ? null : { ...r, v3: r.v2 === true }) } },
  ];
  const input = { a: [{ id: '1' }, { id: '2', drop: true }], b: [{ id: 'x' }] };
  const frozen = structuredClone(input);
  const out = runMigrations(input, { from: 1, to: 3, migrations: steps });
  assert.deepEqual(out, { a: [{ id: '1', v2: true, v3: true }], b: [{ id: 'x' }] });
  assert.deepEqual(input, frozen);
  assert.deepEqual(runMigrations(input, { from: 2, to: 3, migrations: steps }).a.map((r) => r.id), ['1']);
  assert.deepEqual(runMigrations(input, { from: 3, migrations: steps }), input);
  assert.deepEqual(runMigrations({ a: [] }, { from: 1, migrations: steps }), { a: [] });
});

test('runMigrations: un almacén que no existía se trata como vacío', () => {
  const out = runMigrations({}, { from: 1, migrations: [{ to: 2, transform: { nuevo: (r) => r } }] });
  assert.deepEqual(out, { nuevo: [] });
});

test('runMigrations: entradas inválidas y fallos → DbError con el código correcto', () => {
  const m = [{ to: 2, transform: { a: (r) => r } }];
  const code = (c) => (e) => e instanceof DbError && e.code === c;
  assert.throws(() => runMigrations(null, { from: 1, migrations: m }), code('MIGRATION'));
  assert.throws(() => runMigrations([], { from: 1, migrations: m }), code('MIGRATION'));
  assert.throws(() => runMigrations({}, { from: 0, migrations: m }), code('MIGRATION'));
  assert.throws(() => runMigrations({}, { from: 1.5, migrations: m }), code('MIGRATION'));
  assert.throws(() => runMigrations({}, { from: 1, to: 5, migrations: m }), code('MIGRATION'));
  assert.throws(() => runMigrations({}, { from: 3, migrations: m }), code('NEWER_VERSION'));
  assert.throws(() => runMigrations({ a: [{ id: '1' }] }, { from: 1, migrations: [{ to: 2, transform: { a: () => { throw new Error('x'); } } }] }), code('MIGRATION'));
  assert.throws(() => runMigrations({ a: [{ id: '1' }] }, { from: 1, migrations: [{ to: 2, transform: { a: () => 5 } }] }), code('MIGRATION'));
  assert.throws(() => runMigrations({ a: [{ id: '1' }] }, { from: 1, migrations: [{ to: 2, transform: { a: () => [] } }] }), code('MIGRATION'));
  assert.throws(() => runMigrations({ a: [{ id: '1' }] }, { from: 1, migrations: [{ to: 2, transform: { a: 'no' } }] }), code('MIGRATION'));
  assert.throws(() => runMigrations({ cards: [{ id: 'c' }] }, { from: 1, keyPathOf: kp, migrations: [{ to: 2, transform: { cards: () => ({ otro: 1 }) } }] }), code('MIGRATION'));
  assert.throws(() => runMigrations({ f: [() => 1] }, { from: 1, migrations: m }), code('MIGRATION'));
});

test('DbError: código válido, texto amable y reintento sugerido', () => {
  for (const c of DB_CODES) {
    const e = new DbError(c);
    assert.equal(e.code, c);
    assert.ok(e.friendly.length > 20, c);
    assert.equal(friendlyMessage(c), e.friendly);
  }
  assert.equal(new DbError('RARO').code, 'UNKNOWN');
  assert.equal(new DbError('QUOTA').retryable, true);
  assert.equal(new DbError('BAD_KEY').retryable, false);
  assert.equal(new DbError('BAD_KEY', 'x', { retryable: true }).retryable, true);
  assert.equal(friendlyMessage('nada'), friendlyMessage('UNKNOWN'));
});

test('classifyError traduce los errores de IndexedDB y nunca lanza', () => {
  const dom = (name, message = 'x', extra = {}) => Object.assign(new Error(message), { name, ...extra });
  const cases = [
    [dom('QuotaExceededError'), 'QUOTA'], [dom('Otro', 'x', { code: 22 }), 'QUOTA'], [dom('UnknownError', 'disk quota exceeded'), 'QUOTA'],
    [dom('DataCloneError'), 'BAD_RECORD'], [dom('VersionError'), 'NEWER_VERSION'], [dom('NotFoundError'), 'UNKNOWN_STORE'],
    [dom('AbortError'), 'ABORTED'], [dom('ConstraintError'), 'ABORTED'], [dom('TransactionInactiveError'), 'ABORTED'],
    [dom('InvalidStateError'), 'CLOSED'], [dom('SecurityError'), 'UNAVAILABLE'], [new Error('cualquier cosa'), 'UNKNOWN'],
    [null, 'UNKNOWN'], [undefined, 'UNKNOWN'], ['texto', 'UNKNOWN'], [42, 'UNKNOWN'],
  ];
  for (const [e, c] of cases) assert.equal(classifyError(e).code, c, String(e && e.name));
  const own = new DbError('BAD_KEY');
  assert.equal(classifyError(own), own);
  const raw = dom('QuotaExceededError');
  assert.equal(classifyError(raw, { store: 'cards' }).store, 'cards');
  assert.equal(classifyError(raw).cause, raw);
});

test('validateSchema acepta el esquema real y rechaza esquemas rotos', () => {
  assert.doesNotThrow(() => validateSchema(STORES));
  assert.deepEqual(Object.keys(STORES), ['meta', 'settings', 'cards', 'events', 'errors', 'words', 'generated', 'sessions', 'plans', 'notes', 'content_cache', 'audio_index']);
  assert.deepEqual(Object.keys(STORES.cards.indexes), ['due', 'itemId', 'topics', 'state']);
  assert.deepEqual(Object.keys(STORES.events.indexes), ['ts', 'day', 'cardId', 'itemId', 'type', 'topics']);
  assert.equal(STORES.plans.keyPath, 'day');
  assert.equal(STORES.content_cache.keyPath, 'pack_id');
  const bad = [null, [], 'x', {}, { meta: { keyPath: 'key' } }, { meta: { keyPath: '', indexes: {} } },
    { meta: { keyPath: 'k', indexes: { i: {} } } }, { meta: { keyPath: 'k', indexes: { i: { path: 'p', multi: 'si' } } } }];
  for (const s of bad) assert.throws(() => validateSchema(s), /validateSchema/);
});

test('createMemoryDb valida su configuración', () => {
  assert.throws(() => createMemoryDb({ schema: {} }), /meta/);
  assert.throws(() => createMemoryDb({ migrations: [{ to: 2 }], schemaVersion: 1 }), /no coincide/);
  assert.throws(() => createMemoryDb({ migrations: [{ to: 3 }] }), (e) => e.code === 'MIGRATION');
});

test('compareKeys: números antes que textos; textos por unidad de código', () => {
  assert.ok(compareKeys(1, 2) < 0 && compareKeys(2, 1) > 0 && compareKeys(2, 2) === 0);
  assert.ok(compareKeys(999, '0') < 0);
  assert.ok(compareKeys('a', 'b') < 0 && compareKeys('B', 'a') < 0 && compareKeys('a', 'ñ') < 0);
  assert.ok(compareKeys('', 'a') < 0);
  assert.equal(compareKeys(-1, -1), 0);
});

test('indexKeys: simple, multi sin duplicados, ignora lo no indexable', () => {
  const d = STORES.cards;
  assert.deepEqual(indexKeys(d, 'due', { due: 'x' }), ['x']);
  assert.deepEqual(indexKeys(d, 'state', { state: 0 }), [0]);
  assert.deepEqual(indexKeys(d, 'due', {}), []);
  for (const v of [null, true, {}, [], NaN, Infinity]) assert.deepEqual(indexKeys(d, 'due', { due: v }), [], String(v));
  assert.deepEqual(indexKeys(d, 'topics', { topics: ['a', 'b', 'a', null, 3, {}] }), ['a', 'b', 3]);
  assert.deepEqual(indexKeys(d, 'topics', { topics: 'solo' }), ['solo']);
  assert.deepEqual(indexKeys(d, 'topics', { topics: [] }), []);
});

test('compileQuery/runQuery: plan, límites y orden sin tocar los datos', () => {
  const d = STORES.notes;
  const rows = [{ id: 'b' }, { id: 'a' }, { id: 'c' }];
  const copy = structuredClone(rows);
  assert.deepEqual(runQuery(d, compileQuery('notes', d), rows).map((r) => r.id), ['a', 'b', 'c']);
  assert.deepEqual(runQuery(d, compileQuery('notes', d, { range: { gt: 'a' }, direction: 'prev', limit: 1 }), rows).map((r) => r.id), ['c']);
  assert.deepEqual(rows, copy);
  assert.throws(() => compileQuery('notes', d, { index: 'x' }), (e) => e.code === 'BAD_QUERY');
  assert.throws(() => compileQuery('notes', d, { limit: 1 }, { countOnly: true }), (e) => e.code === 'BAD_QUERY');
  assert.doesNotThrow(() => compileQuery('notes', d, null));
});

test('buildExport es determinista, filtra secretos y reservadas', () => {
  const rowsByStore = {
    meta: [{ key: 'schemaVersion', value: 1 }, { key: 'b', value: 1 }, { key: 'a', value: 1 }],
    settings: [{ key: 'k', secret: true }, { key: 't', value: 1 }],
  };
  const x = buildExport({ schema: STORES, schemaVersion: 1, rowsByStore, exportedAt: 'T' });
  assert.deepEqual(x.stores.meta.map((r) => r.key), ['a', 'b']);
  assert.deepEqual(x.stores.settings.map((r) => r.key), ['t']);
  assert.equal(x.stores.cards.length, 0);
  assert.equal(buildExport({ schema: STORES, schemaVersion: 1, rowsByStore, exportedAt: 'T', includeSecrets: true }).stores.settings.length, 2);
  rowsByStore.meta[1].value = 99;
  assert.equal(x.stores.meta.find((r) => r.key === 'b').value, 1);
  assert.ok(isReserved('meta', 'schemaVersion') && !isReserved('meta', 'x') && !isReserved('notes', 'schemaVersion'));
});

test('prepareImport migra y cuenta; planImport decide qué vaciar y qué conservar', () => {
  const steps = [{ to: 2, transform: { notes: (n) => ({ ...n, v2: 1 }) } }];
  const schema = { ...STORES };
  const data = { format: EXPORT_FORMAT, schemaVersion: 1, stores: { notes: [{ id: 'a' }], settings: [{ key: 'tema', value: 1 }] } };
  const frozen = structuredClone(data);
  const prep = prepareImport(data, { schema, schemaVersion: 2, migrations: steps });
  assert.deepEqual(data, frozen);
  assert.equal(prep.migratedFrom, 1);
  assert.deepEqual(prep.counts, { notes: 1, settings: 1 });
  assert.equal(prep.stores.notes[0].v2, 1);
  const plan = planImport(prep, { mode: 'replace', currentSettings: [{ key: 'clave', secret: true }, { key: 'tema', value: 0 }] });
  assert.deepEqual(plan.clear, ['notes', 'settings']);
  assert.deepEqual(plan.records.map((r) => r[1].key ?? r[1].id), ['a', 'tema', 'clave']);
  assert.deepEqual(planImport(prep, { mode: 'merge' }).clear, []);
  assert.equal(planImport(prep, { keepSecrets: false, currentSettings: [{ key: 'clave', secret: true }] }).records.length, 2);
  assert.throws(() => planImport(prep, { mode: 'x' }), (e) => e.code === 'BAD_IMPORT');
  assert.equal(prepareImport({ ...data, schemaVersion: 2 }, { schema, schemaVersion: 2, migrations: steps }).migratedFrom, null);
});
