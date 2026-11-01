// @purpose: Motor de almacenamiento en memoria: sirve para pruebas y como modo «solo memoria» si IndexedDB no está disponible.
// Motor de almacenamiento EN MEMORIA (subparte 0.7). Cumple el MISMO contrato y lanza los MISMOS errores que core/db.idb.js
// (la suite tests/db.contract.test.mjs corre idéntica contra ambos). Sirve para pruebas y como modo "solo memoria" de emergencia
// (si el navegador no ofrece IndexedDB: la app funciona pero nada se conserva; `open()` devuelve persistent:false).
//
// `disk` simula el medio persistente: dos instancias con el mismo `disk` ven los mismos datos (como dos pestañas sobre una base real)
// y sirve para probar "cerrar y reabrir" y las migraciones con datos de una versión previa.
//
// Transacciones: una a la vez (cola FIFO; todas las operaciones pasan por la cola, así que `put` seguido de `get` sin await respeta el orden).
// Las escrituras de una transacción viven en una capa aparte y solo se aplican al terminar bien: si algo falla, no queda nada a medias.
// IMPORTANTE: dentro de tx(fn) usa SOLO el objeto `t`; llamar a db.put/db.get desde fn esperaría a que termine la propia transacción.
import {
  STORES, SCHEMA_VERSION, DbError, classifyError, validateSchema, storeDef, assertKeyArg, cloneRecord, recordKey,
  compileQuery, runQuery, isReserved, buildExport, prepareImport, planImport,
} from './db.js';
import { MIGRATIONS, runMigrations, checkMigrations, latestVersion } from './migrations.js';
import { systemClock } from './clock.js';

const TOMB = Symbol('borrado');

export function createMemoryDisk() { return {}; }

// Copia en objetos simples de lo que hay "en disco" (para pruebas): { almacén: registro[] }.
export function memoryDiskSnapshot(disk) {
  const out = {};
  for (const [name, m] of Object.entries(disk.stores ?? {})) out[name] = structuredClone([...m.values()]);
  return out;
}

export function createMemoryDb({ schema = STORES, schemaVersion, migrations = MIGRATIONS, disk = createMemoryDisk(), clock = systemClock, onWrite = null } = {}) {
  validateSchema(schema);
  const top = checkMigrations(migrations);
  const version = schemaVersion ?? (migrations === MIGRATIONS ? SCHEMA_VERSION : latestVersion(migrations));
  if (version !== top) throw new Error(`createMemoryDb: schemaVersion (${version}) no coincide con la última migración (${top})`);
  const hooks = { onWrite };
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
  const guard = (fn) => exclusive(async () => { need(); return fn(); });

  const metaVersion = () => disk.stores?.meta?.get('schemaVersion')?.value;
  const writeVersion = (stores, n) => stores.meta.set('schemaVersion', { key: 'schemaVersion', value: n });

  function loadDisk() {
    if (!disk.stores) { // medio vacío: se crea con el esquema actual
      const stores = Object.fromEntries(Object.keys(schema).map((n) => [n, new Map()]));
      writeVersion(stores, version);
      disk.stores = stores;
      return null;
    }
    const found = metaVersion();
    if (!Number.isInteger(found)) throw new DbError('MIGRATION', 'Los datos guardados no indican su versión');
    if (found > version) throw new DbError('NEWER_VERSION', `Los datos son de la v${found} y esta app llega a la v${version}`);
    if (found === version) {
      for (const n of Object.keys(schema)) if (!disk.stores[n]) disk.stores[n] = new Map();
      return null;
    }
    // Migración hacia adelante: se calcula todo aparte y solo si sale bien se cambia el medio de una vez.
    const data = {};
    for (const [n, m] of Object.entries(disk.stores)) data[n] = [...m.values()];
    const migrated = runMigrations(data, { from: found, to: version, migrations, keyPathOf: (s) => (schema[s] ? schema[s].keyPath : null) });
    const next = {};
    for (const [n, def] of Object.entries(schema)) {
      const m = new Map();
      for (const r of migrated[n] ?? []) m.set(recordKey(n, def, r), cloneRecord(n, def, r));
      next[n] = m;
    }
    for (const n of Object.keys(disk.stores)) if (!next[n]) next[n] = disk.stores[n]; // almacenes ajenos al esquema: se conservan tal cual
    writeVersion(next, version);
    disk.stores = next;
    return found;
  }

  // ---- Lectura/escritura sobre disco + capa de cambios (`ov`: almacén → Map(clave → registro | TOMB)) ----
  const readOne = (ov, name, key) => {
    const o = ov.get(name);
    if (o && o.has(key)) { const v = o.get(key); return v === TOMB ? undefined : v; }
    return disk.stores[name].get(key);
  };
  const listAll = (ov, name) => {
    const o = ov.get(name);
    const base = disk.stores[name];
    if (!o || o.size === 0) return [...base.values()];
    const out = [];
    for (const [k, v] of base) if (!o.has(k)) out.push(v);
    for (const v of o.values()) if (v !== TOMB) out.push(v);
    return out;
  };
  const layer = (ov, name) => { if (!ov.has(name)) ov.set(name, new Map()); return ov.get(name); };

  function commit(ov, op) {
    let writes = 0;
    for (const m of ov.values()) writes += m.size;
    if (writes === 0) return;
    if (hooks.onWrite) {
      try { hooks.onWrite({ op, stores: [...ov.keys()], writes }); } catch (e) { throw classifyError(e); }
    }
    for (const [name, m] of ov) {
      const base = disk.stores[name];
      for (const [k, v] of m) { if (v === TOMB) base.delete(k); else base.set(k, v); }
    }
  }

  function makeOps(ov, scope) {
    const check = (name) => {
      const def = storeDef(schema, name);
      if (scope && !scope.has(name)) throw new DbError('TX_SCOPE', `El almacén "${name}" no está en esta transacción`, { store: name });
      return def;
    };
    return {
      async get(name, key) { check(name); assertKeyArg(name, key); const v = readOne(ov, name, key); return v === undefined ? null : structuredClone(v); },
      async put(name, rec) {
        const def = check(name);
        const copy = cloneRecord(name, def, rec);
        const key = recordKey(name, def, copy);
        if (isReserved(name, key)) throw new DbError('RESERVED_KEY', `${name}.${key} es de uso interno`, { store: name });
        layer(ov, name).set(key, copy);
        return key;
      },
      async delete(name, key) {
        check(name); assertKeyArg(name, key);
        if (isReserved(name, key)) throw new DbError('RESERVED_KEY', `${name}.${key} es de uso interno`, { store: name });
        const existed = readOne(ov, name, key) !== undefined;
        if (existed) layer(ov, name).set(key, TOMB);
        return existed;
      },
      async clear(name) {
        const def = check(name);
        const o = layer(ov, name);
        let removed = 0;
        for (const rec of listAll(ov, name)) {
          const key = rec[def.keyPath];
          if (isReserved(name, key)) continue;
          o.set(key, TOMB);
          removed += 1;
        }
        return removed;
      },
      async query(name, opts) {
        const def = check(name);
        return runQuery(def, compileQuery(name, def, opts), listAll(ov, name)).map((r) => structuredClone(r));
      },
      async count(name, opts) {
        const def = check(name);
        return runQuery(def, compileQuery(name, def, opts, { countOnly: true }), listAll(ov, name)).length;
      },
    };
  }

  const direct = (fn) => guard(async () => {
    const ov = new Map();
    const result = await fn(makeOps(ov, null));
    commit(ov, 'tx');
    return result;
  });

  const api = {
    kind: 'memory',
    disk,
    setWriteHook(fn) { hooks.onWrite = typeof fn === 'function' ? fn : null; },

    open() {
      if (state === 'open') return opening;
      if (opening && state === 'new') return opening;
      const p = exclusive(async () => {
        const migratedFrom = loadDisk();
        state = 'open';
        return { schemaVersion: version, migratedFrom, persistent: false };
      });
      opening = p;
      p.catch(() => { if (opening === p) opening = null; });
      return p;
    },
    close() { return exclusive(async () => { state = 'closed'; opening = null; }); },

    get: (name, key) => guard(() => makeOps(new Map(), null).get(name, key)),
    put: (name, rec) => direct((o) => o.put(name, rec)),
    delete: (name, key) => direct((o) => o.delete(name, key)),
    clear: (name) => direct((o) => o.clear(name)),
    query: (name, opts) => guard(() => makeOps(new Map(), null).query(name, opts)),
    count: (name, opts) => guard(() => makeOps(new Map(), null).count(name, opts)),

    tx(stores, fn) {
      return guard(async () => {
        if (!Array.isArray(stores) || stores.length === 0) throw new DbError('TX_SCOPE', 'tx necesita la lista de almacenes que va a usar');
        if (typeof fn !== 'function') throw new DbError('TX_SCOPE', 'tx necesita una función');
        for (const s of stores) storeDef(schema, s);
        const ov = new Map();
        const ops = makeOps(ov, new Set(stores));
        let live = true;
        const t = {};
        for (const k of Object.keys(ops)) {
          t[k] = (...a) => {
            if (!live) return Promise.reject(new DbError('TX_SCOPE', 'La transacción ya terminó'));
            return ops[k](...a);
          };
        }
        let result;
        try { result = await fn(t); } finally { live = false; }
        commit(ov, 'tx');
        return result;
      });
    },

    exportAll({ includeSecrets = false } = {}) {
      return guard(async () => {
        const rowsByStore = {};
        for (const n of Object.keys(schema)) rowsByStore[n] = [...disk.stores[n].values()];
        return buildExport({ schema, schemaVersion: version, rowsByStore, exportedAt: clock.iso(), includeSecrets });
      });
    },

    importAll(data, { mode = 'replace', keepSecrets = true } = {}) {
      return guard(async () => {
        const prepared = prepareImport(data, { schema, schemaVersion: version, migrations });
        const plan = planImport(prepared, { mode, keepSecrets, currentSettings: [...disk.stores.settings.values()] });
        const ov = new Map();
        const ops = makeOps(ov, null);
        for (const name of plan.clear) await ops.clear(name);
        for (const [name, rec] of plan.records) layer(ov, name).set(rec[schema[name].keyPath], structuredClone(rec));
        commit(ov, 'import');
        return { stores: prepared.counts, migratedFrom: prepared.migratedFrom };
      });
    },
  };
  return api;
}
