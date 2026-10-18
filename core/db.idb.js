// Motor de almacenamiento sobre IndexedDB REAL (subparte 0.7, mitad B1). Cumple el MISMO contrato y lanza los MISMOS errores
// que core/db.memory.js (la suite tests/_dbContract.mjs corre idéntica contra ambos; este se prueba en Chromium real porque Node no trae IndexedDB).
//
// Diseño:
//   · Cada registro se guarda en un SOBRE { k: clave, v: registro, x: { índice: [claves] } }. Las claves de índice las calcula
//     indexKeys() de core/db.js (no el navegador), así "qué se indexa" es idéntico al motor en memoria (sin campo, null, booleanos,
//     objetos, fechas o arreglos en índice simple → no se indexa). Todos los índices son multiEntry sobre x.<nombre>.
//   · La versión de IndexedDB = schemaVersion. Subir de versión dispara la migración DENTRO de la transacción de cambio de versión:
//     si falla, se aborta y la base queda como estaba (datos y versión intactos).
//   · Todas las operaciones pasan por una cola FIFO (como en memoria). Una transacción = una transacción de IndexedDB.
//   · tx(stores, fn): usa SOLO el objeto `t`. Si dentro de fn esperas algo ajeno a IndexedDB (un timer, fetch…), el navegador
//     cierra la transacción por su cuenta y falla con ABORTED. Es una regla de IndexedDB, no del motor.
//   · No hay setWriteHook: IndexedDB real no permite inyectar fallos (la suite lo declara OMITIDO; se cubre en memoria).
import {
  STORES, SCHEMA_VERSION, DbError, classifyError, validateSchema, storeDef, assertKeyArg, cloneRecord, recordKey,
  compileQuery, indexKeys, compareKeys, isReserved, RESERVED, buildExport, prepareImport, planImport,
} from './db.js';
import { MIGRATIONS, runMigrations, checkMigrations, latestVersion } from './migrations.js';
import { systemClock } from './clock.js';

const BLOCKED_WAIT_MS = 3000;
const EMPTY = Symbol('rango-vacío');

// Convierte una petición de IndexedDB en Promesa.
const req = (r) => new Promise((resolve, reject) => {
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error);
});

const wrap = (def, rec) => {
  const key = rec[def.keyPath];
  const x = {};
  for (const ix of Object.keys(def.indexes)) x[ix] = indexKeys(def, ix, rec);
  return { k: key, v: rec, x };
};

function createStores(db, schema) {
  for (const [name, def] of Object.entries(schema)) {
    const os = db.createObjectStore(name, { keyPath: 'k' });
    for (const [ix] of Object.entries(def.indexes)) os.createIndex(ix, `x.${ix}`, { multiEntry: true });
  }
}

// Rango de IndexedDB a partir de las opciones YA validadas por compileQuery. EMPTY = nada puede cumplirlo.
function idbRange(o) {
  if (!o) return null;
  if (o.value !== undefined) return IDBKeyRange.only(o.value);
  const r = o.range;
  if (!r) return null;
  const lo = r.gt !== undefined ? [r.gt, true] : r.gte !== undefined ? [r.gte, false] : null;
  const hi = r.lt !== undefined ? [r.lt, true] : r.lte !== undefined ? [r.lte, false] : null;
  if (lo && hi) {
    const c = compareKeys(lo[0], hi[0]);
    if (c > 0 || (c === 0 && (lo[1] || hi[1]))) return EMPTY;
    return IDBKeyRange.bound(lo[0], hi[0], lo[1], hi[1]);
  }
  if (lo) return IDBKeyRange.lowerBound(lo[0], lo[1]);
  if (hi) return IDBKeyRange.upperBound(hi[0], hi[1]);
  return null;
}

export function createIdbDb({ name = 'sophia-ingles', schema = STORES, schemaVersion, migrations = MIGRATIONS, clock = systemClock, factory } = {}) {
  validateSchema(schema);
  if (typeof name !== 'string' || name === '') throw new Error('createIdbDb: name debe ser un texto no vacío');
  const top = checkMigrations(migrations);
  const version = schemaVersion ?? (migrations === MIGRATIONS ? SCHEMA_VERSION : latestVersion(migrations));
  if (version !== top) throw new Error(`createIdbDb: schemaVersion (${version}) no coincide con la última migración (${top})`);
  const idbFactory = factory ?? globalThis.indexedDB;
  let conn = null;
  let state = 'new'; // new | open | closed
  let opening = null;
  let chain = Promise.resolve();

  const exclusive = (fn) => {
    const run = chain.then(fn);
    chain = run.then(() => undefined, () => undefined);
    return run;
  };
  const need = () => {
    if (state === 'new') throw new DbError('NOT_OPEN', 'La base no está abierta: llama a open() primero');
    if (state === 'closed') throw new DbError('CLOSED', 'La base está cerrada');
  };
  const guard = (fn, raw = () => null) => exclusive(async () => {
    need();
    try { await ensure(); return await fn(); } catch (e) { const u = raw(); if (u && u.e === e) throw e; throw classifyError(e); }
  });

  async function ensure() {
    if (conn) return;
    conn = (await openRaw()).db;
  }

  // ---------- Apertura y migración ----------
  async function upgrade(db, tx, oldVersion) {
    if (oldVersion === 0) {
      createStores(db, schema);
      tx.objectStore('meta').put({ k: 'schemaVersion', v: { key: 'schemaVersion', value: version }, x: {} });
      return null;
    }
    const found = (await req(tx.objectStore('meta').get('schemaVersion')))?.v?.value;
    if (!Number.isInteger(found)) throw new DbError('MIGRATION', 'Los datos guardados no indican su versión');
    const data = {};
    for (const n of Object.keys(schema)) {
      if (db.objectStoreNames.contains(n)) data[n] = (await req(tx.objectStore(n).getAll())).map((e) => e.v);
    }
    const migrated = runMigrations(data, { from: found, to: version, migrations, keyPathOf: (s) => (schema[s] ? schema[s].keyPath : null) });
    const next = {};
    for (const [n, def] of Object.entries(schema)) {
      next[n] = (migrated[n] ?? []).map((r) => cloneRecord(n, def, r));
      for (const r of next[n]) recordKey(n, def, r);
    }
    for (const n of Object.keys(schema)) if (db.objectStoreNames.contains(n)) db.deleteObjectStore(n);
    createStores(db, schema);
    for (const [n, def] of Object.entries(schema)) {
      const os = tx.objectStore(n);
      for (const r of next[n]) if (!isReserved(n, r[def.keyPath])) os.put(wrap(def, r));
    }
    tx.objectStore('meta').put({ k: 'schemaVersion', v: { key: 'schemaVersion', value: version }, x: {} });
    return found;
  }

  function openRaw() {
    return new Promise((resolve, reject) => {
      if (!idbFactory) { reject(new DbError('UNAVAILABLE', 'Este navegador no ofrece IndexedDB')); return; }
      let r;
      try { r = idbFactory.open(name, version); } catch (e) { reject(classifyError(e)); return; }
      let migratedFrom = null;
      let failure = null;
      let settled = false;
      let timer = null;
      const done = (fn, v) => { if (settled) return false; settled = true; if (timer) clearTimeout(timer); fn(v); return true; };
      r.onupgradeneeded = (ev) => {
        const tx = r.transaction;
        upgrade(r.result, tx, ev.oldVersion).then((m) => { migratedFrom = m; }, (e) => {
          failure = classifyError(e);
          if (failure.code === 'UNKNOWN') failure = new DbError('MIGRATION', `No se pudo actualizar la base: ${e && e.message}`, { cause: e });
          try { tx.abort(); } catch { /* ya terminó */ }
        });
      };
      r.onsuccess = () => {
        const db = r.result;
        if (!done(resolve, { db, migratedFrom })) { db.close(); return; } // se rindió por BLOCKED: no dejar conexiones colgadas
        // Otra pestaña/instancia quiere subir de versión: soltamos la conexión para no bloquearla. Si luego esa subida se aborta,
        // la siguiente operación reabre sola (ensure); si salió bien, reabrir da NEWER_VERSION (hay que actualizar la app).
        db.onversionchange = () => { db.close(); if (conn === db) conn = null; };
      };
      r.onerror = (ev) => {
        if (ev && ev.preventDefault) ev.preventDefault();
        done(reject, failure ?? classifyError(r.error));
      };
      r.onblocked = () => {
        if (timer || settled) return;
        timer = setTimeout(() => done(reject, new DbError('BLOCKED', 'Otra conexión impide actualizar la base')), BLOCKED_WAIT_MS);
      };
    });
  }

  // Ejecuta fn(os) dentro de una transacción de IndexedDB sobre `names` y espera a que se CONFIRME.
  // fn debe usar solo peticiones de IndexedDB (nada ajeno a ellas) para que la transacción siga viva.
  async function run(names, mode, fn) {
    const idbTx = conn.transaction(names, mode);
    const finished = new Promise((resolve, reject) => {
      idbTx.oncomplete = () => resolve();
      idbTx.onabort = () => reject(idbTx.error ?? new DOMException('Transacción abortada', 'AbortError'));
      idbTx.onerror = () => { /* el error llega por onabort o por la petición */ };
    });
    finished.catch(() => undefined);
    let result;
    try { result = await fn(idbTx); } catch (e) {
      try { idbTx.abort(); } catch { /* ya terminó */ }
      await finished.catch(() => undefined);
      throw e;
    }
    await finished;
    return result;
  }

  const unwrapAll = (envs) => envs.map((e) => e.v);

  // Operaciones sobre una transacción abierta. `scope` = Set de almacenes permitidos (null = ya validado).
  function makeOps(idbTx, scope) {
    const check = (n) => {
      const def = storeDef(schema, n);
      if (scope && !scope.has(n)) throw new DbError('TX_SCOPE', `El almacén "${n}" no está en esta transacción`, { store: n });
      return def;
    };
    const reserved = (n, key) => { if (isReserved(n, key)) throw new DbError('RESERVED_KEY', `${n}.${key} es de uso interno`, { store: n }); };

    async function cursorRows(n, def, plan, opts, keysOnly) {
      const range = idbRange(opts);
      if (range === EMPTY || plan.limit === 0) return [];
      const os = idbTx.objectStore(n);
      const source = plan.index === undefined ? os : os.index(plan.index);
      const multi = plan.index !== undefined && def.indexes[plan.index].multi === true;
      const seen = multi ? new Set() : null;
      const out = [];
      const r = keysOnly ? source.openKeyCursor(range, plan.direction) : source.openCursor(range, plan.direction);
      await new Promise((resolve, reject) => {
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const c = r.result;
          if (!c) { resolve(); return; }
          const pk = keysOnly ? c.primaryKey : c.value.k;
          if (!seen || !seen.has(pk)) {
            if (seen) seen.add(pk);
            out.push(keysOnly ? pk : c.value.v);
            if (plan.limit !== undefined && out.length >= plan.limit) { resolve(); return; }
          }
          c.continue();
        };
      });
      return out;
    }

    return {
      async get(n, key) {
        check(n); assertKeyArg(n, key);
        const e = await req(idbTx.objectStore(n).get(key));
        return e === undefined ? null : e.v;
      },
      async put(n, rec) {
        const def = check(n);
        const copy = cloneRecord(n, def, rec);
        const key = recordKey(n, def, copy);
        reserved(n, key);
        await req(idbTx.objectStore(n).put(wrap(def, copy)));
        return key;
      },
      async delete(n, key) {
        check(n); assertKeyArg(n, key); reserved(n, key);
        const os = idbTx.objectStore(n);
        const existed = (await req(os.count(key))) > 0;
        if (existed) await req(os.delete(key));
        return existed;
      },
      async query(n, opts) {
        const def = check(n);
        const plan = compileQuery(n, def, opts);
        return cursorRows(n, def, plan, opts ?? {}, false);
      },
      async count(n, opts) {
        const def = check(n);
        const plan = compileQuery(n, def, opts, { countOnly: true });
        const range = idbRange(opts ?? {});
        if (range === EMPTY) return 0;
        const os = idbTx.objectStore(n);
        if (plan.index === undefined) return req(os.count(range ?? undefined));
        if (!def.indexes[plan.index].multi) return req(os.index(plan.index).count(range ?? undefined));
        return (await cursorRows(n, def, plan, opts ?? {}, true)).length;
      },
    };
  }

  const direct = (n, fn) => guard(() => run([n], 'readwrite', (idbTx) => fn(makeOps(idbTx, null))));
  const readOnly = (n, fn) => guard(() => run([n], 'readonly', (idbTx) => fn(makeOps(idbTx, null))));

  const api = {
    kind: 'indexeddb',
    name,

    open() {
      if (state === 'open') return opening;
      if (opening && state === 'new') return opening;
      const p = exclusive(async () => {
        const { db, migratedFrom } = await openRaw();
        const missing = Object.keys(schema).filter((n) => !db.objectStoreNames.contains(n));
        if (missing.length) { db.close(); throw new DbError('MIGRATION', `Faltan almacenes en la base guardada: ${missing.join(', ')}`); }
        conn = db;
        state = 'open';
        return { schemaVersion: version, migratedFrom, persistent: true };
      });
      opening = p;
      p.catch(() => { if (opening === p) opening = null; });
      return p;
    },
    close() {
      return exclusive(async () => {
        if (conn) { conn.close(); conn = null; }
        state = 'closed';
        opening = null;
      });
    },

    get: (n, key) => readOnly(n, (o) => o.get(n, key)),
    put: (n, rec) => direct(n, (o) => o.put(n, rec)),
    delete: (n, key) => direct(n, (o) => o.delete(n, key)),
    query: (n, opts) => readOnly(n, (o) => o.query(n, opts)),
    count: (n, opts) => readOnly(n, (o) => o.count(n, opts)),

    tx(stores, fn) {
      let userErr = null; // un error lanzado por TU función se relanza tal cual (igual que en memoria); el resto se clasifica
      return guard(async () => {
        if (!Array.isArray(stores) || stores.length === 0) throw new DbError('TX_SCOPE', 'tx necesita la lista de almacenes que va a usar');
        if (typeof fn !== 'function') throw new DbError('TX_SCOPE', 'tx necesita una función');
        for (const s of stores) storeDef(schema, s);
        const names = [...new Set(stores)];
        return run(names, 'readwrite', async (idbTx) => {
          const ops = makeOps(idbTx, new Set(names));
          let live = true;
          const t = {};
          for (const k of Object.keys(ops)) {
            t[k] = (...a) => {
              if (!live) return Promise.reject(new DbError('TX_SCOPE', 'La transacción ya terminó'));
              return ops[k](...a);
            };
          }
          try { return await fn(t); } catch (e) { userErr = { e }; throw e; } finally { live = false; }
        });
      }, () => userErr);
    },

    exportAll({ includeSecrets = false } = {}) {
      return guard(async () => {
        const names = Object.keys(schema);
        const rowsByStore = await run(names, 'readonly', async (idbTx) => {
          const out = {};
          await Promise.all(names.map(async (n) => { out[n] = unwrapAll(await req(idbTx.objectStore(n).getAll())); }));
          return out;
        });
        return buildExport({ schema, schemaVersion: version, rowsByStore, exportedAt: clock.iso(), includeSecrets });
      });
    },

    importAll(data, { mode = 'replace', keepSecrets = true } = {}) {
      return guard(async () => {
        const prepared = prepareImport(data, { schema, schemaVersion: version, migrations });
        const names = Object.keys(schema);
        await run(names, 'readwrite', async (idbTx) => {
          const currentSettings = unwrapAll(await req(idbTx.objectStore('settings').getAll()));
          const plan = planImport(prepared, { mode, keepSecrets, currentSettings });
          for (const n of plan.clear) {
            const os = idbTx.objectStore(n);
            if ((RESERVED[n] ?? []).length === 0) { os.clear(); continue; }
            for (const k of await req(os.getAllKeys())) if (!isReserved(n, k)) os.delete(k);
          }
          for (const [n, rec] of plan.records) {
            const def = schema[n];
            idbTx.objectStore(n).put(wrap(def, structuredClone(rec)));
          }
        });
        return { stores: prepared.counts, migratedFrom: prepared.migratedFrom };
      });
    },
  };
  return api;
}
