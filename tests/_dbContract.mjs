// Suite de CONTRATO de almacenamiento (subparte 0.7). No es una prueba por sí sola (empieza con "_"): la ejecuta
// tests/db.contract.test.mjs contra cada motor. Un motor nuevo cumple el contrato si pasa todo esto sin excepciones.
//
// harness = {
//   label,                       nombre para los títulos
//   newDisk(),                   medio persistente nuevo y vacío (memoria: objeto; IndexedDB: nombre de base único)
//   create(disk, { schema?, schemaVersion?, migrations?, clock? }) → motor SIN abrir
//   hooks: boolean,              ¿permite simular fallos de escritura con setWriteHook? (memoria sí; IndexedDB real no)
//   perfBudgetMs: number|null,   límite de la consulta de 5.000 tarjetas (null = solo se mide y se informa)
// }
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STORES, DbError, EXPORT_FORMAT } from '../core/db.js';
import { makeCard, makeEvent, makeClock, resetFactories } from './_helpers.mjs';

const code = (c) => (e) => e instanceof DbError && e.code === c && typeof e.friendly === 'string' && e.friendly.length > 10;
const rejects = (p, c) => assert.rejects(p, code(c));
const quota = () => Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' });
const strip = (x) => { const { exportedAt, ...rest } = x; return rest; };

// Esquema v2 de prueba: cards gana el índice numérico `level` y aparece el almacén `tags`.
const v2Schema = {
  ...STORES,
  cards: { ...STORES.cards, indexes: { ...STORES.cards.indexes, level: { path: 'level' } } },
  tags: { keyPath: 'id', indexes: {} },
};
const v2Step = { to: 2, description: 'cards.level', transform: { cards: (c) => ({ ...c, level: c.reps >= 3 ? 2 : 1 }) } };
const v3Step = {
  to: 3, description: 'events.source; limpia notas borradas',
  transform: { events: (e) => ({ ...e, source: 'app' }), notes: (n) => (n.deleted ? null : n) },
};

export function runDbContract(harness) {
  const { label, newDisk, create, hooks, perfBudgetMs } = harness;
  const t = (name, fn) => test(`[${label}] ${name}`, fn);
  async function fresh(opts = {}) {
    const disk = newDisk();
    const db = create(disk, opts);
    await db.open();
    return { db, disk };
  }
  const state = async (db) => strip(await db.exportAll({ includeSecrets: true }));

  // ---------- Ciclo de vida ----------
  t('open: devuelve la versión, es idempotente y guarda schemaVersion en meta', async () => {
    const disk = newDisk();
    const db = create(disk);
    const [a, b] = await Promise.all([db.open(), db.open()]);
    assert.equal(a.schemaVersion, 1);
    assert.equal(a.migratedFrom, null);
    assert.equal(typeof a.persistent, 'boolean');
    assert.deepEqual(b, a);
    assert.deepEqual(await db.get('meta', 'schemaVersion'), { key: 'schemaVersion', value: 1 });
    assert.deepEqual(await db.open(), a);
  });

  t('antes de open → NOT_OPEN; después de close → CLOSED; reabrir conserva los datos', async () => {
    const disk = newDisk();
    const db = create(disk);
    for (const op of [() => db.get('cards', 'x'), () => db.put('cards', makeCard()), () => db.query('cards'), () => db.exportAll(), () => db.tx(['cards'], async () => 1)]) {
      await rejects(op(), 'NOT_OPEN');
    }
    await db.open();
    await db.put('notes', { id: 'n1', text: 'hola' });
    await db.close();
    await rejects(db.get('notes', 'n1'), 'CLOSED');
    await db.open();
    assert.deepEqual(await db.get('notes', 'n1'), { id: 'n1', text: 'hola' });
  });

  t('otra instancia sobre el mismo medio ve lo guardado (persistencia)', async () => {
    const { db, disk } = await fresh();
    await db.put('notes', { id: 'n1', text: 'persistente' });
    await db.close();
    const db2 = create(disk);
    await db2.open();
    assert.equal((await db2.get('notes', 'n1')).text, 'persistente');
  });

  // ---------- put / get / delete ----------
  t('put/get: ida y vuelta, get de lo que no existe es null, devuelve y guarda COPIAS', async () => {
    const { db } = await fresh();
    resetFactories();
    const card = makeCard({ topics: ['a', 'b'] });
    assert.equal(await db.put('cards', card), card.id);
    const got = await db.get('cards', card.id);
    assert.deepEqual(got, card);
    got.topics.push('mutado');
    card.topics.push('mutado-origen');
    assert.deepEqual((await db.get('cards', card.id)).topics, ['a', 'b']);
    assert.equal(await db.get('cards', 'no-existe'), null);
  });

  t('put sobrescribe; delete devuelve true/false', async () => {
    const { db } = await fresh();
    await db.put('notes', { id: 'n', v: 1 });
    await db.put('notes', { id: 'n', v: 2 });
    assert.equal((await db.get('notes', 'n')).v, 2);
    assert.equal(await db.count('notes'), 1);
    assert.equal(await db.delete('notes', 'n'), true);
    assert.equal(await db.delete('notes', 'n'), false);
    assert.equal(await db.get('notes', 'n'), null);
  });

  t('put y get en orden aunque no se espere el primero', async () => {
    const { db } = await fresh();
    const p1 = db.put('notes', { id: 'x', v: 1 });
    const p2 = db.get('notes', 'x');
    await p1;
    assert.equal((await p2)?.v, 1);
  });

  t('cada almacén usa su propia clave primaria (8.13)', async () => {
    const { db } = await fresh();
    for (const [name, def] of Object.entries(STORES)) {
      if (name === 'meta') continue;
      await db.put(name, { [def.keyPath]: `k-${name}`, dato: name });
      assert.equal((await db.get(name, `k-${name}`)).dato, name);
    }
  });

  t('texto con acentos, ñ, emoji, apóstrofos curvos y 5.000 caracteres', async () => {
    const { db } = await fresh();
    const text = `Mañana, “¿qué tal?” ’quote’ 😀 ñandú ${'é'.repeat(5000)}`;
    await db.put('notes', { id: 'ñ-😀', text });
    assert.equal((await db.get('notes', 'ñ-😀')).text, text);
  });

  t('errores de entrada: BAD_KEY, BAD_RECORD, UNKNOWN_STORE y no cambian nada', async () => {
    const { db } = await fresh();
    await db.put('notes', { id: 'ok', v: 1 });
    const before = await state(db);
    for (const bad of [{ v: 1 }, { id: '' }, { id: 5 }, { id: null }]) await rejects(db.put('notes', bad), 'BAD_KEY');
    for (const bad of [null, undefined, 'texto', 5, [], [{ id: 'a' }]]) await rejects(db.put('notes', bad), 'BAD_RECORD');
    await rejects(db.put('notes', { id: 'f', fn() {} }), 'BAD_RECORD');
    await rejects(db.get('notes', ''), 'BAD_KEY');
    await rejects(db.get('notes', 5), 'BAD_KEY');
    await rejects(db.delete('notes', null), 'BAD_KEY');
    for (const op of ['get', 'delete']) await rejects(db[op]('nada', 'k'), 'UNKNOWN_STORE');
    await rejects(db.put('nada', { id: 'a' }), 'UNKNOWN_STORE');
    await rejects(db.query('nada'), 'UNKNOWN_STORE');
    await rejects(db.count('toString'), 'UNKNOWN_STORE');
    assert.deepEqual(await state(db), before);
  });

  t('meta.schemaVersion es reservada: se puede leer, no escribir ni borrar', async () => {
    const { db } = await fresh();
    await rejects(db.put('meta', { key: 'schemaVersion', value: 99 }), 'RESERVED_KEY');
    await rejects(db.delete('meta', 'schemaVersion'), 'RESERVED_KEY');
    await db.put('meta', { key: 'otra', value: 1 });
    assert.equal((await db.get('meta', 'schemaVersion')).value, 1);
  });

  // ---------- query / count ----------
  async function seedCards(db) {
    resetFactories();
    const cards = [
      makeCard({ id: 'c1#0', itemId: 'c1', due: '2026-10-18T00:00:00.000Z', state: 2, topics: ['t.a', 't.b'] }),
      makeCard({ id: 'c2#0', itemId: 'c2', due: '2026-10-16T00:00:00.000Z', state: 0, topics: ['t.a'] }),
      makeCard({ id: 'c3#0', itemId: 'c3', due: '2026-10-16T00:00:00.000Z', state: 1, topics: ['t.c'] }),
      makeCard({ id: 'c4#0', itemId: 'c4', due: '2026-10-20T00:00:00.000Z', state: 2, topics: [] }),
    ];
    for (const c of cards) await db.put('cards', c);
    return cards;
  }
  const ids = (rows) => rows.map((r) => r.id);

  t('query por índice: orden por clave y, en empate, por id; dirección y límite', async () => {
    const { db } = await fresh();
    await seedCards(db);
    assert.deepEqual(ids(await db.query('cards', { index: 'due' })), ['c2#0', 'c3#0', 'c1#0', 'c4#0']);
    assert.deepEqual(ids(await db.query('cards', { index: 'due', direction: 'prev' })), ['c4#0', 'c1#0', 'c3#0', 'c2#0']);
    assert.deepEqual(ids(await db.query('cards', { index: 'due', limit: 2 })), ['c2#0', 'c3#0']);
    assert.deepEqual(await db.query('cards', { index: 'due', limit: 0 }), []);
  });

  t('query: value, rangos (gt/gte/lt/lte) y números', async () => {
    const { db } = await fresh();
    await seedCards(db);
    assert.deepEqual(ids(await db.query('cards', { index: 'state', value: 2 })), ['c1#0', 'c4#0']);
    assert.deepEqual(ids(await db.query('cards', { index: 'due', range: { lte: '2026-10-16T00:00:00.000Z' } })), ['c2#0', 'c3#0']);
    assert.deepEqual(ids(await db.query('cards', { index: 'due', range: { gt: '2026-10-16T00:00:00.000Z', lt: '2026-10-20T00:00:00.000Z' } })), ['c1#0']);
    assert.deepEqual(ids(await db.query('cards', { index: 'state', range: { gte: 1 } })), ['c3#0', 'c1#0', 'c4#0']);
    assert.deepEqual(await db.query('cards', { index: 'state', value: 99 }), []);
    assert.deepEqual(ids(await db.query('cards', { index: 'itemId', value: 'c3' })), ['c3#0']);
  });

  t('índice multi (topics): un registro aparece por cada tema y una sola vez en un rango', async () => {
    const { db } = await fresh();
    await seedCards(db);
    assert.deepEqual(ids(await db.query('cards', { index: 'topics', value: 't.a' })), ['c1#0', 'c2#0']);
    assert.deepEqual(ids(await db.query('cards', { index: 'topics', value: 't.b' })), ['c1#0']);
    assert.deepEqual(ids(await db.query('cards', { index: 'topics', range: { gte: 't.a', lte: 't.b' } })), ['c1#0', 'c2#0']);
    assert.equal(await db.count('cards', { index: 'topics', range: { gte: 't.a' } }), 3);
  });

  t('índice multi con rango: se ordena por la clave que cumple más baja (next) o más alta (prev)', async () => {
    const { db } = await fresh();
    await db.put('cards', { id: 'x', topics: ['t.z', 't.b'] });
    await db.put('cards', { id: 'y', topics: ['t.c'] });
    await db.put('cards', { id: 'w', topics: ['t.a', 't.q'] });
    assert.deepEqual(ids(await db.query('cards', { index: 'topics', range: { gte: 't.b' } })), ['x', 'y', 'w']);
    assert.deepEqual(ids(await db.query('cards', { index: 'topics', range: { gte: 't.b' }, direction: 'prev' })), ['x', 'w', 'y']);
    assert.deepEqual(ids(await db.query('cards', { index: 'topics', range: { lte: 't.b' } })), ['w', 'x']);
  });

  t('registros sin el campo (o con null/booleano) no entran al índice pero sí a la lista general', async () => {
    const { db } = await fresh();
    await db.put('cards', { id: 'a', due: '2026-01-01', state: 1 });
    await db.put('cards', { id: 'b', state: 1 });
    await db.put('cards', { id: 'c', due: null, state: true });
    await db.put('cards', { id: 'd', due: { x: 1 }, state: 1 });
    assert.deepEqual(ids(await db.query('cards', { index: 'due' })), ['a']);
    assert.deepEqual(ids(await db.query('cards', { index: 'state' })), ['a', 'b', 'd']);
    assert.deepEqual(ids(await db.query('cards')), ['a', 'b', 'c', 'd']);
  });

  t('query sin índice ordena por clave primaria y admite rango sobre ella', async () => {
    const { db } = await fresh();
    for (const id of ['b', 'a', 'ñ', 'c']) await db.put('notes', { id });
    assert.deepEqual(ids(await db.query('notes')), ['a', 'b', 'c', 'ñ']);
    assert.deepEqual(ids(await db.query('notes', { range: { gte: 'b', lt: 'ñ' } })), ['b', 'c']);
    assert.deepEqual(ids(await db.query('notes', { direction: 'prev', limit: 1 })), ['ñ']);
    assert.deepEqual(await db.query('notes', undefined), await db.query('notes', {}));
  });

  t('count con y sin filtros; count no acepta limit ni direction', async () => {
    const { db } = await fresh();
    await seedCards(db);
    assert.equal(await db.count('cards'), 4);
    assert.equal(await db.count('cards', { index: 'state', value: 2 }), 2);
    await rejects(db.count('cards', { limit: 1 }), 'BAD_QUERY');
    await rejects(db.count('cards', { direction: 'prev' }), 'BAD_QUERY');
  });

  t('consultas mal formadas → BAD_QUERY', async () => {
    const { db } = await fresh();
    const bad = [
      { index: 'nada' }, { index: 5 }, { limt: 3 }, { value: 'x', range: { gte: 'a' } }, { index: 'due', value: null },
      { index: 'due', value: {} }, { index: 'due', limit: -1 }, { index: 'due', limit: 1.5 }, { index: 'due', limit: '3' },
      { index: 'due', direction: 'up' }, { index: 'due', range: { gt: 'a', gte: 'a' } }, { index: 'due', range: { eq: 'a' } },
      { index: 'due', range: { gt: null } }, { index: 'due', range: 'x' }, 'texto', [],
    ];
    for (const q of bad) await rejects(db.query('cards', q), 'BAD_QUERY');
  });

  t('query devuelve copias', async () => {
    const { db } = await fresh();
    await seedCards(db);
    const rows = await db.query('cards');
    rows[0].topics.push('x');
    rows[0].state = 99;
    assert.notEqual((await db.get('cards', rows[0].id)).state, 99);
  });

  // ---------- Transacciones ----------
  t('tx: confirma varios almacenes a la vez, lee lo que escribió y devuelve el resultado de fn', async () => {
    const { db } = await fresh();
    resetFactories();
    const card = makeCard({ id: 'tx#0', itemId: 'tx' });
    const ev = makeEvent({ id: 'evt_tx', cardId: 'tx#0' });
    const out = await db.tx(['cards', 'events'], async (tx) => {
      await tx.put('events', ev);
      await tx.put('cards', { ...card, reps: 1 });
      assert.equal((await tx.get('cards', 'tx#0')).reps, 1);
      assert.equal((await tx.query('events', { index: 'cardId', value: 'tx#0' })).length, 1);
      assert.equal(await tx.count('events'), 1);
      return 'listo';
    });
    assert.equal(out, 'listo');
    assert.equal((await db.get('cards', 'tx#0')).reps, 1);
    assert.equal((await db.get('events', 'evt_tx')).cardId, 'tx#0');
  });

  t('tx: dentro ve sus borrados; fuera no se ve nada hasta confirmar', async () => {
    const { db } = await fresh();
    await db.put('notes', { id: 'a' });
    await db.put('notes', { id: 'b' });
    await db.tx(['notes'], async (tx) => {
      assert.equal(await tx.delete('notes', 'a'), true);
      assert.equal(await tx.get('notes', 'a'), null);
      assert.deepEqual(ids(await tx.query('notes')), ['b']);
      await tx.put('notes', { id: 'c' });
      assert.deepEqual(ids(await tx.query('notes')), ['b', 'c']);
    });
    assert.deepEqual(ids(await db.query('notes')), ['b', 'c']);
  });

  t('tx: si fn lanza, no queda NADA escrito y se propaga ese mismo error', async () => {
    const { db } = await fresh();
    await db.put('notes', { id: 'previo', v: 1 });
    const before = await state(db);
    const boom = new Error('boom');
    await assert.rejects(db.tx(['notes', 'cards'], async (tx) => {
      await tx.put('notes', { id: 'previo', v: 2 });
      await tx.put('notes', { id: 'nuevo' });
      await tx.put('cards', makeCard());
      await tx.delete('notes', 'previo');
      throw boom;
    }), (e) => e === boom);
    assert.deepEqual(await state(db), before);
  });

  t('tx: un registro inválido a mitad revierte lo anterior', async () => {
    const { db } = await fresh();
    const before = await state(db);
    await rejects(db.tx(['notes'], async (tx) => {
      await tx.put('notes', { id: 'bien' });
      await tx.put('notes', { sinId: true });
    }), 'BAD_KEY');
    assert.deepEqual(await state(db), before);
  });

  t('tx: almacén fuera de alcance, uso tras terminar y argumentos malos → TX_SCOPE / UNKNOWN_STORE', async () => {
    const { db } = await fresh();
    await rejects(db.tx(['notes'], (tx) => tx.put('cards', makeCard())), 'TX_SCOPE');
    await rejects(db.tx(['notes'], (tx) => tx.get('events', 'x')), 'TX_SCOPE');
    let kept;
    await db.tx(['notes'], async (tx) => { kept = tx; });
    await rejects(kept.get('notes', 'x'), 'TX_SCOPE');
    await rejects(db.tx([], async () => 1), 'TX_SCOPE');
    await rejects(db.tx('notes', async () => 1), 'TX_SCOPE');
    await rejects(db.tx(['notes'], null), 'TX_SCOPE');
    await rejects(db.tx(['nada'], async () => 1), 'UNKNOWN_STORE');
    assert.equal(await db.count('notes'), 0);
  });

  t('tx: 20 transacciones simultáneas de leer-sumar-escribir no se pisan', async () => {
    const { db } = await fresh();
    await db.put('meta', { key: 'contador', value: 0 });
    await Promise.all(Array.from({ length: 20 }, () => db.tx(['meta'], async (tx) => {
      const c = await tx.get('meta', 'contador');
      await Promise.resolve();
      await tx.put('meta', { key: 'contador', value: c.value + 1 });
    })));
    assert.equal((await db.get('meta', 'contador')).value, 20);
  });

  t('una tx fallida no bloquea las siguientes', async () => {
    const { db } = await fresh();
    const bad = db.tx(['notes'], async () => { throw new Error('x'); });
    const good = db.tx(['notes'], async (tx) => tx.put('notes', { id: 'ok' }));
    await assert.rejects(bad);
    assert.equal(await good, 'ok');
  });

  // ---------- Exportar / importar ----------
  async function seedAll(db) {
    resetFactories();
    await seedCards(db);
    await db.put('events', makeEvent({ id: 'e1' }));
    await db.put('settings', { key: 'tema', value: 'aurora' });
    await db.put('settings', { key: 'ai.clave', value: 'secreto', secret: true });
    await db.put('notes', { id: 'n1', text: 'hola' });
    await db.put('meta', { key: 'nombre', value: 'Sophia' });
  }

  t('exportAll: formato, versión, fecha del reloj, todos los almacenes, orden estable y sin secretos', async () => {
    const clock = makeClock('2026-10-17T10:00:00.000Z');
    const { db } = await fresh({ clock });
    await seedAll(db);
    const x = await db.exportAll();
    assert.equal(x.format, EXPORT_FORMAT);
    assert.equal(x.schemaVersion, 1);
    assert.equal(x.exportedAt, '2026-10-17T10:00:00.000Z');
    assert.deepEqual(Object.keys(x.stores), Object.keys(STORES));
    assert.deepEqual(x.stores.cards.map((c) => c.id), ['c1#0', 'c2#0', 'c3#0', 'c4#0']);
    assert.deepEqual(x.stores.meta, [{ key: 'nombre', value: 'Sophia' }]);
    assert.deepEqual(x.stores.settings.map((s) => s.key), ['tema']);
    assert.equal((await db.exportAll({ includeSecrets: true })).stores.settings.length, 2);
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(x)));
  });

  t('exportar → importar en una base vacía deja los mismos datos (ida y vuelta)', async () => {
    const { db: a } = await fresh();
    await seedAll(a);
    const backup = JSON.parse(JSON.stringify(await a.exportAll({ includeSecrets: true })));
    const { db: b } = await fresh();
    const res = await b.importAll(backup);
    assert.equal(res.stores.cards, 4);
    assert.equal(res.migratedFrom, null);
    assert.deepEqual(await state(b), await state(a));
    assert.deepEqual(backup, JSON.parse(JSON.stringify(backup)));
  });

  t('importAll replace: solo vacía los almacenes que trae el respaldo; merge no vacía nada', async () => {
    const { db } = await fresh();
    await seedAll(db);
    const partial = { format: EXPORT_FORMAT, schemaVersion: 1, exportedAt: 'x', stores: { notes: [{ id: 'nuevo' }] } };
    await db.importAll(partial);
    assert.deepEqual(ids(await db.query('notes')), ['nuevo']);
    assert.equal(await db.count('cards'), 4);
    await db.importAll({ ...partial, stores: { notes: [{ id: 'otro' }, { id: 'nuevo', v: 2 }] } }, { mode: 'merge' });
    assert.deepEqual(ids(await db.query('notes')), ['nuevo', 'otro']);
    assert.equal((await db.get('notes', 'nuevo')).v, 2);
    await rejects(db.importAll(partial, { mode: 'fusionar' }), 'BAD_IMPORT');
  });

  t('importAll: las claves secretas actuales sobreviven a un respaldo sin claves (keepSecrets)', async () => {
    const { db } = await fresh();
    await seedAll(db);
    const noSecrets = JSON.parse(JSON.stringify(await db.exportAll()));
    noSecrets.stores.settings = [{ key: 'tema', value: 'noche' }];
    await db.importAll(noSecrets);
    assert.equal((await db.get('settings', 'tema')).value, 'noche');
    assert.equal((await db.get('settings', 'ai.clave')).value, 'secreto');
    await db.importAll(noSecrets, { keepSecrets: false });
    assert.equal(await db.get('settings', 'ai.clave'), null);
    await db.put('settings', { key: 'ai.clave', value: 'viejo', secret: true });
    await db.importAll({ ...noSecrets, stores: { settings: [{ key: 'ai.clave', value: 'nuevo', secret: true }] } });
    assert.equal((await db.get('settings', 'ai.clave')).value, 'nuevo');
  });

  t('importAll: respaldos inválidos se rechazan enteros y no cambian nada', async () => {
    const { db } = await fresh();
    await seedAll(db);
    const before = await state(db);
    const ok = { format: EXPORT_FORMAT, schemaVersion: 1, stores: {} };
    const cases = [
      [null, 'BAD_IMPORT'], ['texto', 'BAD_IMPORT'], [[], 'BAD_IMPORT'], [{}, 'BAD_IMPORT'],
      [{ ...ok, format: 'otro' }, 'BAD_IMPORT'], [{ ...ok, schemaVersion: 'x' }, 'BAD_IMPORT'], [{ ...ok, schemaVersion: 0 }, 'BAD_IMPORT'],
      [{ ...ok, schemaVersion: 99 }, 'NEWER_VERSION'], [{ ...ok, stores: undefined }, 'BAD_IMPORT'], [{ ...ok, stores: [] }, 'BAD_IMPORT'],
      [{ ...ok, stores: { notes: 'x' } }, 'BAD_IMPORT'], [{ ...ok, stores: { notes: [5] } }, 'BAD_IMPORT'],
      [{ ...ok, stores: { nada: [] } }, 'BAD_IMPORT'], [{ ...ok, stores: { notes: [{ id: 'a' }, { id: 'a' }] } }, 'BAD_IMPORT'],
      [{ ...ok, stores: { notes: [{ id: 'a' }, { sinId: 1 }] } }, 'BAD_IMPORT'], [{ ...ok, stores: { cards: [{ id: '' }] } }, 'BAD_IMPORT'],
    ];
    for (const [data, c] of cases) await rejects(db.importAll(data), c);
    assert.deepEqual(await state(db), before);
  });

  t('importAll: el problema se describe (BAD_IMPORT.problems) y hay tope de mensajes', async () => {
    const { db } = await fresh();
    const rows = Array.from({ length: 50 }, (_, i) => ({ sinId: i }));
    await assert.rejects(db.importAll({ format: EXPORT_FORMAT, schemaVersion: 1, stores: { notes: rows } }), (e) => (
      e.code === 'BAD_IMPORT' && Array.isArray(e.problems) && e.problems.length === 20 && /y 30 más/.test(e.message)));
  });

  t('importAll ignora meta.schemaVersion del respaldo (no se puede falsear la versión)', async () => {
    const { db } = await fresh();
    await db.importAll({ format: EXPORT_FORMAT, schemaVersion: 1, stores: { meta: [{ key: 'schemaVersion', value: 99 }, { key: 'x', value: 1 }] } });
    assert.equal((await db.get('meta', 'schemaVersion')).value, 1);
    assert.equal((await db.get('meta', 'x')).value, 1);
  });

  // ---------- Migraciones ----------
  const v1Cards = () => [
    makeCard({ id: 'm1#0', itemId: 'm1', reps: 5 }),
    makeCard({ id: 'm2#0', itemId: 'm2', reps: 0 }),
  ];
  async function seedV1(disk) {
    const old = create(disk);
    await old.open();
    for (const c of v1Cards()) await old.put('cards', c);
    await old.put('events', makeEvent({ id: 'm-e1' }));
    await old.put('notes', { id: 'keep', deleted: false });
    await old.put('notes', { id: 'gone', deleted: true });
    await old.put('settings', { key: 'tema', value: 'noche' });
    await old.close();
  }

  t('migración v1→v2: conserva los datos, aplica la transformación y estrena índice y almacén', async () => {
    resetFactories();
    const disk = newDisk();
    await seedV1(disk);
    const db = create(disk, { schema: v2Schema, migrations: [v2Step] });
    const info = await db.open();
    assert.equal(info.schemaVersion, 2);
    assert.equal(info.migratedFrom, 1);
    assert.equal((await db.get('meta', 'schemaVersion')).value, 2);
    assert.equal((await db.get('cards', 'm1#0')).level, 2);
    assert.equal((await db.get('cards', 'm2#0')).level, 1);
    assert.equal((await db.get('cards', 'm1#0')).itemId, 'm1');
    assert.deepEqual(ids(await db.query('cards', { index: 'level', value: 2 })), ['m1#0']);
    assert.equal((await db.get('settings', 'tema')).value, 'noche');
    assert.equal(await db.count('notes'), 2);
    await db.put('tags', { id: 't1' });
    assert.equal(await db.count('tags'), 1);
    const again = create(disk, { schema: v2Schema, migrations: [v2Step] });
    assert.equal((await again.open()).migratedFrom, null);
  });

  t('migración encadenada v1→v3: aplica los pasos en orden y puede descartar registros', async () => {
    resetFactories();
    const disk = newDisk();
    await seedV1(disk);
    const db = create(disk, { schema: v2Schema, migrations: [v2Step, v3Step] });
    const info = await db.open();
    assert.deepEqual([info.schemaVersion, info.migratedFrom], [3, 1]);
    assert.equal((await db.get('events', 'm-e1')).source, 'app');
    assert.deepEqual(ids(await db.query('notes')), ['keep']);
    assert.equal((await db.get('cards', 'm1#0')).level, 2);
  });

  t('migración que falla: open rechaza con MIGRATION y los datos viejos quedan intactos', async () => {
    resetFactories();
    const disk = newDisk();
    await seedV1(disk);
    const broken = { to: 2, description: 'rota', transform: { cards: (c) => { if (c.id === 'm2#0') throw new Error('fallo a propósito'); return { ...c, level: 1 }; } } };
    const db = create(disk, { schema: v2Schema, migrations: [broken] });
    await rejects(db.open(), 'MIGRATION');
    await rejects(db.get('cards', 'm1#0'), 'NOT_OPEN');
    const old = create(disk);
    const info = await old.open();
    assert.equal(info.schemaVersion, 1);
    assert.equal((await old.get('cards', 'm1#0')).level, undefined);
    assert.equal(await old.count('cards'), 2);
    const lost = { to: 2, description: 'pierde la clave', transform: { cards: (c) => ({ ...c, id: undefined }) } };
    await rejects(create(disk, { schema: v2Schema, migrations: [lost] }).open(), 'MIGRATION');
    assert.equal(await old.count('cards'), 2);
  });

  t('datos de una versión más nueva que el código → NEWER_VERSION y no se tocan', async () => {
    const disk = newDisk();
    const nuevo = create(disk, { schema: v2Schema, migrations: [v2Step] });
    await nuevo.open();
    await nuevo.put('cards', makeCard({ id: 'z#0', itemId: 'z' }));
    await nuevo.close();
    await rejects(create(disk).open(), 'NEWER_VERSION');
    const again = create(disk, { schema: v2Schema, migrations: [v2Step] });
    await again.open();
    assert.equal(await again.count('cards'), 1);
  });

  t('importar un respaldo de la v1 en una base v2 lo migra', async () => {
    resetFactories();
    const { db: v1 } = await fresh();
    for (const c of v1Cards()) await v1.put('cards', c);
    const backup = JSON.parse(JSON.stringify(await v1.exportAll()));
    const { db } = await fresh({ schema: v2Schema, migrations: [v2Step] });
    const res = await db.importAll(backup);
    assert.equal(res.migratedFrom, 1);
    assert.equal((await db.get('cards', 'm1#0')).level, 2);
    assert.deepEqual((await db.exportAll()).schemaVersion, 2);
    await rejects(v1.importAll(JSON.parse(JSON.stringify(await db.exportAll()))), 'NEWER_VERSION');
  });

  // ---------- Fallos de escritura simulados ----------
  if (hooks) {
    t('cuota llena: put → QUOTA amable, lo anterior intacto, y se recupera al liberar espacio', async () => {
      const { db } = await fresh();
      await db.put('notes', { id: 'previo', v: 1 });
      const before = await state(db);
      db.setWriteHook(() => { throw quota(); });
      await assert.rejects(db.put('notes', { id: 'nuevo' }), (e) => code('QUOTA')(e) && e.retryable === true);
      await rejects(db.put('notes', { id: 'previo', v: 2 }), 'QUOTA');
      await rejects(db.delete('notes', 'previo'), 'QUOTA');
      assert.deepEqual(await state(db), before);
      db.setWriteHook(null);
      await db.put('notes', { id: 'nuevo' });
      assert.equal(await db.count('notes'), 2);
    });

    t('fallo al confirmar una tx de varios almacenes: no se aplica ninguno', async () => {
      const { db } = await fresh();
      const before = await state(db);
      db.setWriteHook(() => { throw new Error('disco roto'); });
      await rejects(db.tx(['cards', 'events', 'notes'], async (tx) => {
        await tx.put('cards', makeCard());
        await tx.put('events', makeEvent());
        await tx.put('notes', { id: 'n' });
      }), 'UNKNOWN');
      db.setWriteHook(null);
      assert.deepEqual(await state(db), before);
    });

    t('fallo durante importAll: no se pierde nada de lo que había', async () => {
      const { db } = await fresh();
      await seedAll(db);
      const before = await state(db);
      db.setWriteHook(() => { throw quota(); });
      await rejects(db.importAll({ format: EXPORT_FORMAT, schemaVersion: 1, stores: { cards: [], notes: [{ id: 'x' }] } }), 'QUOTA');
      db.setWriteHook(null);
      assert.deepEqual(await state(db), before);
    });
  } else {
    test(`[${label}] fallos de escritura simulados — OMITIDO: este motor no permite inyectarlos (se cubren en el motor en memoria)`, { skip: true }, () => {});
  }

  // ---------- Rendimiento ----------
  t('5.000 tarjetas: consulta por vencimiento con límite', async () => {
    const { db } = await fresh();
    resetFactories();
    const day = Date.parse('2026-10-01T00:00:00.000Z');
    await db.tx(['cards'], async (tx) => {
      for (let i = 0; i < 5000; i += 1) {
        await tx.put('cards', makeCard({ id: `p${String(i).padStart(4, '0')}#0`, itemId: `p${i}`, due: new Date(day + (i % 400) * 3600000).toISOString(), topics: [`t.${i % 25}`] }));
      }
    });
    assert.equal(await db.count('cards'), 5000);
    const cutoff = new Date(day + 100 * 3600000).toISOString();
    const t0 = performance.now();
    const due = await db.query('cards', { index: 'due', range: { lte: cutoff }, limit: 50 });
    const ms = performance.now() - t0;
    process.stdout.write(`# [${label}] 5.000 tarjetas: query(due ≤ corte, limit 50) = ${ms.toFixed(1)} ms\n`);
    assert.equal(due.length, 50);
    for (let i = 1; i < due.length; i += 1) assert.ok(due[i - 1].due <= due[i].due);
    if (perfBudgetMs != null) assert.ok(ms < perfBudgetMs, `tardó ${ms.toFixed(1)} ms (límite ${perfBudgetMs})`);
    const byTopic = await db.query('cards', { index: 'topics', value: 't.3' });
    assert.equal(byTopic.length, 200);
  });
}
