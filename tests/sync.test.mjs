// @purpose: Pruebas del respaldo de la 1.12-T1 (core/sync.js): ida y vuelta, vista previa del impacto, modos fusionar y reemplazar, claves y versiones.
// Pruebas de core/sync.js (subparte 1.12-T1) con base en memoria: exportBackup, previewBackup e importBackup.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryDb, createMemoryDisk } from '../core/db.memory.js';
import { createSync, MAX_BACKUP_CHARS } from '../core/sync.js';
import { STORES, DbError, EXPORT_FORMAT } from '../core/db.js';
import { makeCard, makeEvent, makeClock, resetFactories } from './_helpers.mjs';

const KEY1 = 'clave-de-prueba-123';
const KEY2 = 'otra-clave-de-prueba-456';
const strip = (x) => { const { exportedAt, ...rest } = x; return rest; };
const code = (c) => (e) => e instanceof DbError && e.code === c && typeof e.friendly === 'string' && e.friendly.length > 10;
const state = async (db) => strip(await db.exportAll({ includeSecrets: true }));

async function mkDb(opts = {}) {
  const db = createMemoryDb({ disk: createMemoryDisk(), clock: makeClock(), ...opts });
  await db.open();
  return db;
}
async function seed(db) {
  resetFactories();
  await db.put('cards', makeCard({ id: 'c1' }));
  await db.put('cards', makeCard({ id: 'c2' }));
  await db.put('events', makeEvent({ id: 'e1' }));
  await db.put('events', makeEvent({ id: 'e2' }));
  await db.put('errors', { id: 'er1', day: '2026-10-17', code: 'ART_MISSING', topics: ['articles'], texto: '“¿Qué tal?” ’quote’ 😀' });
  await db.put('words', { id: 'w1', state: 'known', nested: { a: [1, 2, { b: null }], n: 0, s: '' } });
  await db.put('generated', { id: 'g1', itemId: 'i1', text: 'ñandú' });
  await db.put('sessions', { id: 's1', day: '2026-10-17', done: true });
  await db.put('plans', { day: '2026-10-18', items: ['a', 'b'] });
  await db.put('notes', { id: 'n1', text: `Mañana ${'é'.repeat(300)}` });
  await db.put('content_cache', { pack_id: 'p1', version: 3, items: [] });
  await db.put('audio_index', { id: 'a1', url: 'x' });
  await db.put('settings', { key: 'theme', value: 'neo' });
  await db.put('settings', { key: 'aiKey', value: KEY1, secret: true });
  await db.put('meta', { key: 'nombre', value: 'Glossa' });
}
const backupOf = (stores, extra = {}) => JSON.stringify({ format: EXPORT_FORMAT, schemaVersion: 1, exportedAt: '2026-10-25T10:00:00.000Z', stores, ...extra });

// ---------- exportBackup ----------
test('exportBackup: formato, nombre, conteos y sin claves por defecto', async () => {
  const db = await mkDb();
  await seed(db);
  const sync = createSync({ db, clock: { now: () => new Date(2026, 9, 25, 12) } });
  const out = await sync.exportBackup();
  const data = JSON.parse(out.json);
  assert.equal(data.format, EXPORT_FORMAT);
  assert.equal(data.schemaVersion, 1);
  assert.equal(out.filename, 'glossa-respaldo-2026-10-25.json');
  assert.equal(out.includesSecrets, false);
  assert.equal(out.counts.cards, 2);
  assert.equal(out.counts.settings, 1);
  assert.equal(out.json.includes(KEY1), false);
  assert.equal(data.stores.settings.some((r) => r.secret === true), false);
});

test('exportBackup: con includeSecrets las claves sí van; cualquier otro valor de includeSecrets no cuenta como sí', async () => {
  const db = await mkDb();
  await seed(db);
  const sync = createSync({ db });
  const out = await sync.exportBackup({ includeSecrets: true });
  assert.equal(out.includesSecrets, true);
  assert.ok(out.json.includes(KEY1));
  for (const v of ['true', 1, 'yes', {}, null, undefined]) {
    const o = await sync.exportBackup({ includeSecrets: v });
    assert.equal(o.includesSecrets, false, String(v));
    assert.equal(o.json.includes(KEY1), false, String(v));
  }
});

test('exportBackup: quita las claves aunque el motor las entregue (defensa doble)', async () => {
  const leaky = {
    async exportAll() {
      return { format: EXPORT_FORMAT, schemaVersion: 1, exportedAt: 'x', stores: { settings: [{ key: 'aiKey', value: KEY1, secret: true }, { key: 'theme', value: 'neo' }], cards: [] } };
    },
  };
  const out = await createSync({ db: leaky }).exportBackup();
  assert.equal(out.json.includes(KEY1), false);
  assert.deepEqual(out.counts, { settings: 1, cards: 0 });
});

// ---------- Ida y vuelta ----------
test('ida y vuelta sin pérdida: exportar con claves e importar en una base vacía deja los mismos datos', async () => {
  const a = await mkDb();
  await seed(a);
  const out = await createSync({ db: a }).exportBackup({ includeSecrets: true });
  const b = await mkDb();
  const res = await createSync({ db: b }).importBackup(out.json, { mode: 'replace' });
  assert.deepEqual(await state(b), await state(a));
  assert.equal(res.mode, 'replace');
  assert.equal(res.total, Object.values(out.counts).reduce((x, n) => x + n, 0));
  assert.deepEqual(res.stores, out.counts);
});

test('ida y vuelta por defecto: lo restaurado es lo de antes menos las claves', async () => {
  const a = await mkDb();
  await seed(a);
  const out = await createSync({ db: a }).exportBackup();
  const b = await mkDb();
  await createSync({ db: b }).importBackup(out.json);
  const expected = await state(a);
  expected.stores.settings = expected.stores.settings.filter((r) => !r.secret);
  assert.deepEqual(await state(b), expected);
});

test('ida y vuelta: exportar lo restaurado da el mismo texto (salvo la fecha)', async () => {
  const a = await mkDb();
  await seed(a);
  const sa = createSync({ db: a });
  const first = await sa.exportBackup({ includeSecrets: true });
  const b = await mkDb();
  const sb = createSync({ db: b });
  await sb.importBackup(first.json);
  const second = await sb.exportBackup({ includeSecrets: true });
  assert.deepEqual(strip(JSON.parse(second.json)), strip(JSON.parse(first.json)));
});

test('importar el mismo respaldo dos veces, en cualquier modo, no cambia nada la segunda vez', async () => {
  const a = await mkDb();
  await seed(a);
  const out = await createSync({ db: a }).exportBackup({ includeSecrets: true });
  const b = await mkDb();
  const sb = createSync({ db: b });
  await sb.importBackup(out.json, { mode: 'merge' });
  const once = await state(b);
  await sb.importBackup(out.json, { mode: 'merge' });
  assert.deepEqual(await state(b), once);
  await sb.importBackup(out.json, { mode: 'replace' });
  assert.deepEqual(await state(b), once);
});

// ---------- Vista previa ----------
test('previewBackup en reemplazar: cuenta lo que se añade, cambia, queda igual y se pierde', async () => {
  const db = await mkDb();
  await db.put('notes', { id: 'igual', t: 1 });
  await db.put('notes', { id: 'cambia', t: 1 });
  await db.put('notes', { id: 'solo-aqui', t: 1 });
  await db.put('cards', makeCard({ id: 'c-otra' }));
  const text = backupOf({ notes: [{ id: 'igual', t: 1 }, { id: 'cambia', t: 2 }, { id: 'nueva', t: 1 }] });
  const p = await createSync({ db }).previewBackup(text, { mode: 'replace' });
  assert.deepEqual(p.stores.notes, { before: 3, incoming: 3, added: 1, overwritten: 1, unchanged: 1, removed: 1, kept: 0, after: 3 });
  assert.deepEqual(Object.keys(p.stores), ['notes']);
  assert.deepEqual(p.totals, { incoming: 3, added: 1, overwritten: 1, unchanged: 1, removed: 1, kept: 0 });
  assert.equal(p.mode, 'replace');
  assert.equal(p.format, EXPORT_FORMAT);
  assert.equal(p.schemaVersion, 1);
  assert.equal(p.exportedAt, '2026-10-25T10:00:00.000Z');
  assert.equal(p.migratedFrom, null);
  assert.equal(p.hasSecrets, false);
});

test('previewBackup en fusionar: nunca hay pérdidas y after = before + añadidos', async () => {
  const db = await mkDb();
  await db.put('notes', { id: 'igual', t: 1 });
  await db.put('notes', { id: 'solo-aqui', t: 1 });
  const text = backupOf({ notes: [{ id: 'igual', t: 1 }, { id: 'nueva', t: 1 }] });
  const p = await createSync({ db }).previewBackup(text, { mode: 'merge' });
  assert.deepEqual(p.stores.notes, { before: 2, incoming: 2, added: 1, overwritten: 0, unchanged: 1, removed: 0, kept: 0, after: 3 });
  assert.equal(p.totals.removed, 0);
});

test('previewBackup compara por contenido: el orden de las claves no cambia el resultado, el de las listas sí', async () => {
  const db = await mkDb();
  await db.put('notes', { id: 'a', x: { p: 1, q: [1, 2] } });
  await db.put('notes', { id: 'b', x: [1, 2] });
  const text = backupOf({ notes: [{ x: { q: [1, 2], p: 1 }, id: 'a' }, { id: 'b', x: [2, 1] }] });
  const p = await createSync({ db }).previewBackup(text, { mode: 'merge' });
  assert.equal(p.stores.notes.unchanged, 1);
  assert.equal(p.stores.notes.overwritten, 1);
});

test('previewBackup no escribe nada: la base queda idéntica y no hay ninguna escritura', async () => {
  const db = await mkDb();
  await seed(db);
  const before = await state(db);
  let writes = 0;
  db.setWriteHook(() => { writes += 1; });
  const sync = createSync({ db });
  const text = backupOf({ cards: [], notes: [{ id: 'z' }], settings: [] });
  await sync.previewBackup(text, { mode: 'replace' });
  await sync.previewBackup(text, { mode: 'merge' });
  assert.equal(writes, 0);
  assert.deepEqual(await state(db), before);
});

test('la vista previa predice exactamente lo que importar deja (todos los almacenes, ambos modos, con y sin keepSecrets)', async () => {
  const src = await mkDb();
  await seed(src);
  await src.put('notes', { id: 'n1', text: 'distinto' });
  await src.put('notes', { id: 'n-extra', text: 'x' });
  await src.delete('cards', 'c2');
  const text = (await createSync({ db: src }).exportBackup({ includeSecrets: false })).json;
  for (const mode of ['replace', 'merge']) {
    for (const keepSecrets of [true, false]) {
      const dst = await mkDb();
      await seed(dst);
      await dst.put('notes', { id: 'n-solo-dst', text: 'y' });
      await dst.put('events', makeEvent({ id: 'e-solo-dst' }));
      const sync = createSync({ db: dst });
      const prev = await sync.previewBackup(text, { mode, keepSecrets });
      await sync.importBackup(text, { mode, keepSecrets });
      for (const [name, s] of Object.entries(prev.stores)) {
        const real = (await dst.query(name)).filter((r) => !(name === 'meta' && r.key === 'schemaVersion')).length;
        assert.equal(real, s.after, `${mode}/${keepSecrets}/${name}`);
      }
    }
  }
});

test('claves: reemplazar con un respaldo sin claves las conserva (kept) o las pierde (keepSecrets false)', async () => {
  const db = await mkDb();
  await db.put('settings', { key: 'theme', value: 'neo' });
  await db.put('settings', { key: 'aiKey', value: KEY1, secret: true });
  await db.put('settings', { key: 'azureKey', value: KEY2, secret: true });
  const sync = createSync({ db });
  const text = backupOf({ settings: [{ key: 'theme', value: 'aurora' }] });
  const keep = await sync.previewBackup(text, { mode: 'replace', keepSecrets: true });
  assert.deepEqual(keep.stores.settings, { before: 3, incoming: 1, added: 0, overwritten: 1, unchanged: 0, removed: 0, kept: 2, after: 3 });
  const lose = await sync.previewBackup(text, { mode: 'replace', keepSecrets: false });
  assert.deepEqual(lose.stores.settings, { before: 3, incoming: 1, added: 0, overwritten: 1, unchanged: 0, removed: 2, kept: 0, after: 1 });
  const merged = await sync.previewBackup(text, { mode: 'merge', keepSecrets: false });
  assert.equal(merged.stores.settings.removed, 0);
  assert.equal(merged.stores.settings.kept, 0);
  await sync.importBackup(text, { mode: 'replace' });
  assert.equal((await db.get('settings', 'aiKey')).value, KEY1);
  assert.equal((await db.get('settings', 'theme')).value, 'aurora');
});

test('claves: si el respaldo trae una clave, hasSecrets avisa; una clave que viene en el respaldo no cuenta como conservada', async () => {
  const db = await mkDb();
  await db.put('settings', { key: 'aiKey', value: KEY1, secret: true });
  const text = backupOf({ settings: [{ key: 'aiKey', value: KEY2, secret: true }] });
  const p = await createSync({ db }).previewBackup(text, { mode: 'replace' });
  assert.equal(p.hasSecrets, true);
  assert.equal(p.stores.settings.kept, 0);
  assert.equal(p.stores.settings.overwritten, 1);
  assert.equal(p.stores.settings.removed, 0);
});

test('la vista previa ignora lo reservado: meta.schemaVersion del respaldo no cuenta ni se importa', async () => {
  const db = await mkDb();
  const text = backupOf({ meta: [{ key: 'schemaVersion', value: 99 }, { key: 'nombre', value: 'X' }] });
  const sync = createSync({ db });
  const p = await sync.previewBackup(text, { mode: 'replace' });
  assert.deepEqual(p.stores.meta, { before: 0, incoming: 1, added: 1, overwritten: 0, unchanged: 0, removed: 0, kept: 0, after: 1 });
  await sync.importBackup(text);
  assert.deepEqual(await db.get('meta', 'schemaVersion'), { key: 'schemaVersion', value: 1 });
});

test('un respaldo vacío de un almacén en reemplazar anuncia que se pierde todo lo de ese almacén y solo de ese', async () => {
  const db = await mkDb();
  await seed(db);
  const p = await createSync({ db }).previewBackup(backupOf({ events: [] }), { mode: 'replace' });
  assert.deepEqual(Object.keys(p.stores), ['events']);
  assert.equal(p.stores.events.removed, 2);
  assert.equal(p.stores.events.after, 0);
});

// ---------- Versiones y formato ----------
test('versión: un respaldo de una versión más nueva se rechaza con NEWER_VERSION; la vista previa y la importación coinciden', async () => {
  const db = await mkDb();
  await seed(db);
  const before = await state(db);
  const text = backupOf({ notes: [] }, { schemaVersion: 2 });
  const sync = createSync({ db });
  await assert.rejects(sync.previewBackup(text), code('NEWER_VERSION'));
  await assert.rejects(sync.importBackup(text), code('NEWER_VERSION'));
  assert.deepEqual(await state(db), before);
});

test('versión y formato inválidos → BAD_IMPORT en la vista previa y en la importación, sin tocar nada', async () => {
  const db = await mkDb();
  await seed(db);
  const before = await state(db);
  const sync = createSync({ db });
  const bad = [
    backupOf({}, { schemaVersion: 0 }), backupOf({}, { schemaVersion: -1 }), backupOf({}, { schemaVersion: 1.5 }),
    backupOf({}, { schemaVersion: '1' }), backupOf({}, { schemaVersion: null }),
    backupOf({}, { format: 'otra-app' }), backupOf({}, { format: undefined }),
    JSON.stringify({ format: EXPORT_FORMAT, schemaVersion: 1 }),
    backupOf({ notes: 'no es lista' }), backupOf({ notes: [1] }), backupOf({ notes: [{ id: 'a' }, { id: 'a' }] }),
    backupOf({ notes: [{ texto: 'sin id' }] }), backupOf({ almacenInventado: [] }),
    'null', '[]', '5', '"texto"', 'true',
  ];
  for (const text of bad) {
    await assert.rejects(sync.previewBackup(text), code('BAD_IMPORT'), text.slice(0, 60));
    await assert.rejects(sync.importBackup(text), code('BAD_IMPORT'), text.slice(0, 60));
  }
  assert.deepEqual(await state(db), before);
});

test('el formato antiguo sophia-ingles-db se sigue aceptando', async () => {
  const db = await mkDb();
  const text = backupOf({ notes: [{ id: 'viejo' }] }, { format: 'sophia-ingles-db' });
  const sync = createSync({ db });
  assert.equal((await sync.previewBackup(text)).stores.notes.added, 1);
  await sync.importBackup(text);
  assert.equal((await db.get('notes', 'viejo')).id, 'viejo');
});

test('versión anterior: se migra y la vista previa lo dice (migratedFrom)', async () => {
  const v2Schema = { ...STORES, cards: { ...STORES.cards, indexes: { ...STORES.cards.indexes, level: { path: 'level' } } } };
  const v2Step = { to: 2, description: 'cards.level', transform: { cards: (c) => ({ ...c, level: 2 }) } };
  const db = await mkDb({ schema: v2Schema, migrations: [v2Step] });
  const sync = createSync({ db, schema: v2Schema, schemaVersion: 2, migrations: [v2Step] });
  const text = backupOf({ cards: [makeCard({ id: 'viejo' })] });
  const p = await sync.previewBackup(text, { mode: 'replace' });
  assert.equal(p.migratedFrom, 1);
  assert.equal(p.schemaVersion, 1);
  assert.equal(p.stores.cards.added, 1);
  const res = await sync.importBackup(text);
  assert.equal(res.migratedFrom, 1);
  assert.equal((await db.get('cards', 'viejo')).level, 2);
});

// ---------- Entradas malas ----------
test('texto vacío, solo espacios, no-texto, demasiado grande o JSON roto → BAD_IMPORT con mensaje en español', async () => {
  const db = await mkDb();
  const sync = createSync({ db });
  for (const text of ['', '   \n ', null, undefined, 5, {}, '{no es json', 'x'.repeat(MAX_BACKUP_CHARS + 1)]) {
    for (const fn of [sync.previewBackup, sync.importBackup]) {
      await assert.rejects(fn(text), (e) => code('BAD_IMPORT')(e) && /respaldo/i.test(e.message));
    }
  }
});

test('modo desconocido → BAD_IMPORT; sin base → UNAVAILABLE en los tres métodos', async () => {
  const db = await mkDb();
  const sync = createSync({ db });
  for (const mode of ['otro', '', null, 5, 'REPLACE']) {
    await assert.rejects(sync.previewBackup(backupOf({}), { mode }), code('BAD_IMPORT'));
    await assert.rejects(sync.importBackup(backupOf({}), { mode }), code('BAD_IMPORT'));
  }
  const none = createSync({});
  await assert.rejects(none.exportBackup(), (e) => e.code === 'UNAVAILABLE');
  await assert.rejects(none.previewBackup(backupOf({})), (e) => e.code === 'UNAVAILABLE');
  await assert.rejects(none.importBackup(backupOf({})), (e) => e.code === 'UNAVAILABLE');
});

test('una importación que falla a mitad no deja nada a medias', async () => {
  const db = await mkDb();
  await seed(db);
  const before = await state(db);
  db.setWriteHook(() => { throw Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' }); });
  await assert.rejects(createSync({ db }).importBackup(backupOf({ notes: [{ id: 'x' }], cards: [] })), code('QUOTA'));
  db.setWriteHook(null);
  assert.deepEqual(await state(db), before);
});

test('texto con acentos, ñ, emoji, comillas curvas y números extremos sobrevive tal cual', async () => {
  const a = await mkDb();
  const rec = { id: 'ñ-😀', text: 'Mañana, “¿qué tal?” ’quote’ — ünï', n: [0, -0.5, 1e21, 2 ** 53 - 1], nul: null, vacio: '' };
  await a.put('notes', rec);
  const out = await createSync({ db: a }).exportBackup();
  const b = await mkDb();
  await createSync({ db: b }).importBackup(out.json);
  assert.deepEqual(await b.get('notes', 'ñ-😀'), rec);
});

// ---------- Rendimiento ----------
test('rendimiento: la vista previa de un respaldo de 10.000 eventos (mediana de 5 corridas) cabe en 1,5 s', async () => {
  const db = await mkDb();
  const rows = Array.from({ length: 10000 }, (_, i) => ({ id: `ev${i}`, ts: `2026-10-17T10:${String(i % 60).padStart(2, '0')}:00.000Z`, day: '2026-10-17', type: 'answer', topics: [`t${i % 10}`] }));
  await db.tx(['events'], async (tx) => { for (const r of rows) await tx.put('events', r); });
  const text = backupOf({ events: rows.map((r, i) => (i % 2 ? { ...r, type: 'review' } : r)) });
  const sync = createSync({ db });
  const times = [];
  let last;
  for (let i = 0; i < 5; i += 1) {
    const t0 = performance.now();
    last = await sync.previewBackup(text, { mode: 'replace' });
    times.push(performance.now() - t0);
  }
  times.sort((x, y) => x - y);
  assert.equal(last.stores.events.overwritten, 5000);
  assert.equal(last.stores.events.unchanged, 5000);
  assert.ok(times[2] < 1500, `mediana ${times[2].toFixed(0)} ms`);
  process.stdout.write(`# vista previa de 10.000 eventos: mediana ${times[2].toFixed(0)} ms\n`);
});

// ---------- Huecos cerrados tras la 4.R ----------
test('mensajes: vacío dice «vacío» y demasiado grande dice «demasiado grande»', async () => {
  const sync = createSync({ db: await mkDb() });
  for (const text of ['', '   \n ']) {
    for (const fn of [sync.previewBackup, sync.importBackup]) await assert.rejects(fn(text), (e) => code('BAD_IMPORT')(e) && /vac[ií]o/i.test(e.message));
  }
  const big = 'x'.repeat(MAX_BACKUP_CHARS + 1);
  for (const fn of [sync.previewBackup, sync.importBackup]) await assert.rejects(fn(big), (e) => code('BAD_IMPORT')(e) && /demasiado grande/i.test(e.message));
});

test('el tope es exacto: un respaldo válido de justo MAX_BACKUP_CHARS caracteres se acepta y uno de un carácter más no', async () => {
  const sync = createSync({ db: await mkDb() });
  const base = backupOf({ notes: [{ id: 'a' }] });
  const exact = base + ' '.repeat(MAX_BACKUP_CHARS - base.length);
  assert.equal(exact.length, MAX_BACKUP_CHARS);
  assert.equal((await sync.previewBackup(exact)).stores.notes.added, 1);
  await assert.rejects(sync.previewBackup(`${exact} `), (e) => code('BAD_IMPORT')(e) && /demasiado grande/i.test(e.message));
});

test('previewBackup compara con rigor: lista contra objeto, listas más largas y objetos con más claves cuentan como cambio', async () => {
  const db = await mkDb();
  await db.put('notes', { id: 'lista-obj', x: { 0: 'a' } });
  await db.put('notes', { id: 'lista-larga', x: [1] });
  await db.put('notes', { id: 'obj-mas', x: { p: 1 } });
  await db.put('notes', { id: 'obj-menos', x: { p: 1, q: 2 } });
  await db.put('notes', { id: 'lista-corta', x: [1, 2] });
  const text = backupOf({ notes: [
    { id: 'lista-obj', x: ['a'] }, { id: 'lista-larga', x: [1, 2] }, { id: 'obj-mas', x: { p: 1, q: 2 } },
    { id: 'obj-menos', x: { p: 1 } }, { id: 'lista-corta', x: [1] },
  ] });
  const p = await createSync({ db }).previewBackup(text, { mode: 'merge' });
  assert.equal(p.stores.notes.overwritten, 5);
  assert.equal(p.stores.notes.unchanged, 0);
});

test('previewBackup: sin exportedAt (o con uno que no es texto) da null; el formato antiguo se informa tal cual', async () => {
  const sync = createSync({ db: await mkDb() });
  const noDate = JSON.stringify({ format: 'sophia-ingles-db', schemaVersion: 1, stores: {} });
  const p = await sync.previewBackup(noDate);
  assert.equal(p.exportedAt, null);
  assert.equal(p.format, 'sophia-ingles-db');
  assert.equal((await sync.previewBackup(backupOf({}, { exportedAt: 12345 }))).exportedAt, null);
});

test('los valores por defecto: sin opciones, la vista previa y la importación reemplazan y conservan las claves', async () => {
  const db = await mkDb();
  await db.put('notes', { id: 'solo-aqui' });
  await db.put('settings', { key: 'aiKey', value: KEY1, secret: true });
  const sync = createSync({ db });
  const text = backupOf({ notes: [{ id: 'nueva' }], settings: [] });
  const p = await sync.previewBackup(text);
  assert.equal(p.mode, 'replace');
  assert.equal(p.stores.notes.removed, 1);
  assert.equal(p.stores.settings.kept, 1);
  assert.equal(p.stores.settings.removed, 0);
  assert.equal(p.totals.kept, 1);
  const res = await sync.importBackup(text);
  assert.equal(res.mode, 'replace');
  assert.deepEqual((await db.query('notes')).map((r) => r.id), ['nueva']);
  assert.equal((await db.get('settings', 'aiKey')).value, KEY1);
});

// ---------- Administrador, 2026-10-26: «reemplazar» sustituye todo lo que trae el respaldo, ajustes incluidos ----------
test('reemplazar: los ajustes del respaldo sustituyen a todos los del dispositivo; solo se conservan las claves que el respaldo no trae', async () => {
  const db = await mkDb();
  await db.put('settings', { key: 'theme', value: 'neo' });
  await db.put('settings', { key: 'textSize', value: 'large' }); // el respaldo no la trae: se pierde (no es una clave)
  await db.put('settings', { key: 'aiKey', value: KEY1, secret: true }); // el respaldo no la trae: se conserva
  await db.put('settings', { key: 'azureKey', value: KEY2, secret: true }); // el respaldo sí la trae: manda el respaldo
  await db.put('notes', { id: 'n1', text: 'solo del dispositivo' }); // almacén que el respaldo no trae: no se toca
  const text = backupOf({ settings: [{ key: 'theme', value: 'aurora' }, { key: 'azureKey', value: 'clave-del-respaldo-789', secret: true }] });
  const sync = createSync({ db });
  const prev = await sync.previewBackup(text, { mode: 'replace' });
  assert.deepEqual(prev.stores.settings, { before: 4, incoming: 2, added: 0, overwritten: 2, unchanged: 0, removed: 1, kept: 1, after: 3 });
  assert.equal(prev.stores.notes, undefined);
  await sync.importBackup(text, { mode: 'replace' });
  const keys = (await db.query('settings')).map((r) => r.key).sort();
  assert.deepEqual(keys, ['aiKey', 'azureKey', 'theme']);
  assert.equal((await db.get('settings', 'theme')).value, 'aurora');
  assert.equal((await db.get('settings', 'textSize')), null);
  assert.equal((await db.get('settings', 'aiKey')).value, KEY1);
  assert.equal((await db.get('settings', 'azureKey')).value, 'clave-del-respaldo-789');
  assert.equal((await db.get('notes', 'n1')).text, 'solo del dispositivo');
});
