// @purpose: Contrato de la capa de almacenamiento: esquema de almacenes, validación de registros, reglas de consulta y exportar/importar.
// Contrato de la capa de almacenamiento (subparte 0.7). Aquí vive todo lo que no depende del motor:
// esquema (roadmap 8.13), validación de registros, reglas de consulta, exportar/importar. Es puro y se prueba con Node.
// Los motores (core/db.memory.js y core/db.idb.js) solo guardan y leen; usan estas funciones para que la semántica sea idéntica.
//
// API que cumple cada motor (todo devuelve Promesa):
//   open() → { schemaVersion, migratedFrom|null, persistent }        idempotente
//   close()                                                           después, todo falla con CLOSED
//   get(store, key) → registro | null
//   put(store, registro) → key                                        sobrescribe; clave = campo keyPath del almacén
//   delete(store, key) → boolean                                      true si existía
//   clear(store) → número                                             vacía el almacén de una vez y devuelve cuántos registros había (1.12-T1);
//                                                                     las claves reservadas (meta.schemaVersion) se conservan y no cuentan
//   query(store, { index?, value?, range?, direction?, limit? }) → registro[]
//   count(store, { index?, value?, range? }) → número
//   tx(stores[], async (t) => …) → lo que devuelva fn                 t = { get, put, delete, clear, query, count } solo de esos almacenes;
//                                                                     si fn lanza, NADA de lo escrito dentro queda guardado
//   exportAll({ includeSecrets? }) → { format, schemaVersion, exportedAt, stores }
//   importAll(data, { mode: 'replace'|'merge', keepSecrets? }) → { stores: {nombre: n}, migratedFrom|null }
// Todos los errores son DbError (core/dbErrors.js) con el mismo `code` en ambos motores.
import { DbError, classifyError, friendlyMessage, DB_CODES } from './dbErrors.js';
import { MIGRATIONS, runMigrations } from './migrations.js';

export { DbError, classifyError, friendlyMessage, DB_CODES };

export const SCHEMA_VERSION = 1;
// Desde 0.9.3 la app se llama Glossa y los respaldos nuevos llevan 'glossa-db'. Los respaldos hechos con la app llamada Sophia Inglés
// ('sophia-ingles-db') se SIGUEN aceptando al importar: nadie pierde un respaldo por el cambio de nombre.
export const EXPORT_FORMAT = 'glossa-db';
export const LEGACY_EXPORT_FORMATS = Object.freeze(['sophia-ingles-db']);
export const MAX_PROBLEMS = 20;

// Roadmap 8.13. Un índice = { path: campo, multi?: true (el campo es un arreglo: se indexa cada elemento) }.
export const STORES = Object.freeze({
  meta: { keyPath: 'key', indexes: {} },
  settings: { keyPath: 'key', indexes: {} },
  cards: { keyPath: 'id', indexes: { due: { path: 'due' }, itemId: { path: 'itemId' }, topics: { path: 'topics', multi: true }, state: { path: 'state' } } },
  events: { keyPath: 'id', indexes: { ts: { path: 'ts' }, day: { path: 'day' }, cardId: { path: 'cardId' }, itemId: { path: 'itemId' }, type: { path: 'type' }, topics: { path: 'topics', multi: true } } },
  errors: { keyPath: 'id', indexes: { day: { path: 'day' }, code: { path: 'code' }, topics: { path: 'topics', multi: true } } },
  words: { keyPath: 'id', indexes: { state: { path: 'state' } } },
  generated: { keyPath: 'id', indexes: { itemId: { path: 'itemId' } } },
  sessions: { keyPath: 'id', indexes: { day: { path: 'day' } } },
  plans: { keyPath: 'day', indexes: {} },
  notes: { keyPath: 'id', indexes: {} },
  content_cache: { keyPath: 'pack_id', indexes: {} },
  audio_index: { keyPath: 'id', indexes: {} },
});

// Claves que solo el motor puede escribir (la versión del esquema vive en meta, roadmap 8.13).
export const RESERVED = Object.freeze({ meta: Object.freeze(['schemaVersion']) });
export const isReserved = (store, key) => (RESERVED[store] ?? []).includes(key);

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
export const isKey = (v) => typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v));

export function validateSchema(schema) {
  if (!isPlain(schema)) throw new Error('validateSchema: el esquema debe ser un objeto');
  if (!isPlain(schema.meta)) throw new Error('validateSchema: falta el almacén "meta"');
  for (const [name, def] of Object.entries(schema)) {
    if (!isPlain(def) || typeof def.keyPath !== 'string' || def.keyPath === '') throw new Error(`validateSchema: "${name}" necesita keyPath`);
    if (!isPlain(def.indexes)) throw new Error(`validateSchema: "${name}" necesita indexes (puede ser {})`);
    for (const [ix, d] of Object.entries(def.indexes)) {
      if (!isPlain(d) || typeof d.path !== 'string' || d.path === '') throw new Error(`validateSchema: índice "${name}.${ix}" necesita path`);
      if (d.multi !== undefined && typeof d.multi !== 'boolean') throw new Error(`validateSchema: índice "${name}.${ix}": multi debe ser booleano`);
    }
  }
  return schema;
}

export function storeDef(schema, name) {
  const def = Object.prototype.hasOwnProperty.call(schema, name) ? schema[name] : undefined;
  if (!def) throw new DbError('UNKNOWN_STORE', `Almacén desconocido: ${String(name)}`, { store: String(name) });
  return def;
}

// Clave primaria de un registro, o lanza BAD_KEY.
export function recordKey(name, def, rec) {
  const key = rec[def.keyPath];
  if (typeof key !== 'string' || key === '') throw new DbError('BAD_KEY', `${name}: falta la clave "${def.keyPath}" (texto no vacío)`, { store: name });
  return key;
}

export function assertKeyArg(name, key) {
  if (typeof key !== 'string' || key === '') throw new DbError('BAD_KEY', `${name}: la clave debe ser un texto no vacío`, { store: name });
}

// Valida un registro y devuelve su COPIA (los motores nunca guardan ni devuelven la referencia del llamante).
export function cloneRecord(name, def, rec) {
  if (!isPlain(rec)) throw new DbError('BAD_RECORD', `${name}: el registro debe ser un objeto`, { store: name });
  recordKey(name, def, rec);
  try { return structuredClone(rec); } catch (e) {
    throw new DbError('BAD_RECORD', `${name}: el registro contiene algo que no se puede guardar (${e && e.message})`, { store: name, cause: e });
  }
}

// Orden de claves como IndexedDB: números antes que textos; textos por unidad de código UTF-16.
export function compareKeys(a, b) {
  const ta = typeof a === 'number' ? 0 : 1;
  const tb = typeof b === 'number' ? 0 : 1;
  if (ta !== tb) return ta - tb;
  return a < b ? -1 : a > b ? 1 : 0;
}

// Claves de índice de un registro. Sin campo / null / booleano / objeto → no se indexa (como IndexedDB).
export function indexKeys(def, indexName, rec) {
  const ix = def.indexes[indexName];
  const v = rec[ix.path];
  if (ix.multi && Array.isArray(v)) {
    const seen = new Set();
    const out = [];
    for (const e of v) if (isKey(e) && !seen.has(e)) { seen.add(e); out.push(e); }
    return out;
  }
  return isKey(v) ? [v] : [];
}

const QUERY_KEYS = ['index', 'value', 'range', 'direction', 'limit'];
const RANGE_KEYS = ['gt', 'gte', 'lt', 'lte'];
const badQ = (name, msg) => new DbError('BAD_QUERY', `${name}: consulta no válida: ${msg}`, { store: name });

// Convierte las opciones de consulta en un plan. Rechaza opciones desconocidas (así un "limt" no pasa en silencio).
export function compileQuery(name, def, opts, { countOnly = false } = {}) {
  const o = opts === undefined || opts === null ? {} : opts;
  if (!isPlain(o)) throw badQ(name, 'las opciones deben ser un objeto');
  for (const k of Object.keys(o)) if (!QUERY_KEYS.includes(k)) throw badQ(name, `opción desconocida "${k}"`);
  const index = o.index;
  if (index !== undefined && (typeof index !== 'string' || !Object.prototype.hasOwnProperty.call(def.indexes, index))) {
    throw badQ(name, `no existe el índice "${String(index)}"`);
  }
  if (o.value !== undefined && o.range !== undefined) throw badQ(name, 'usa "value" o "range", no ambos');
  if (o.value !== undefined && !isKey(o.value)) throw badQ(name, '"value" debe ser un texto o un número');
  let test = () => true;
  if (o.value !== undefined) test = (k) => compareKeys(k, o.value) === 0;
  if (o.range !== undefined) {
    const r = o.range;
    if (!isPlain(r)) throw badQ(name, '"range" debe ser un objeto');
    for (const k of Object.keys(r)) if (!RANGE_KEYS.includes(k)) throw badQ(name, `límite de rango desconocido "${k}"`);
    for (const k of RANGE_KEYS) if (r[k] !== undefined && !isKey(r[k])) throw badQ(name, `"${k}" debe ser un texto o un número`);
    if (r.gt !== undefined && r.gte !== undefined) throw badQ(name, 'usa "gt" o "gte", no ambos');
    if (r.lt !== undefined && r.lte !== undefined) throw badQ(name, 'usa "lt" o "lte", no ambos');
    test = (k) => (r.gt === undefined || compareKeys(k, r.gt) > 0) && (r.gte === undefined || compareKeys(k, r.gte) >= 0)
      && (r.lt === undefined || compareKeys(k, r.lt) < 0) && (r.lte === undefined || compareKeys(k, r.lte) <= 0);
  }
  const direction = o.direction ?? 'next';
  if (countOnly && (o.direction !== undefined || o.limit !== undefined)) throw badQ(name, '"direction" y "limit" no aplican a count');
  if (direction !== 'next' && direction !== 'prev') throw badQ(name, '"direction" debe ser "next" o "prev"');
  if (o.limit !== undefined && (!Number.isInteger(o.limit) || o.limit < 0)) throw badQ(name, '"limit" debe ser un entero ≥ 0');
  return { index, test, direction, limit: o.limit };
}

// Ejecuta un plan sobre un conjunto de registros. Orden: por clave de índice (o primaria) y, en empate, por clave primaria.
// Un registro sale UNA sola vez aunque varias de sus claves de índice cumplan el rango. Devuelve referencias (el motor copia).
export function runQuery(def, plan, records) {
  const { index, test, direction } = plan;
  const kp = def.keyPath;
  const entries = [];
  for (const rec of records) {
    if (index === undefined) {
      if (test(rec[kp])) entries.push([rec[kp], rec]);
      continue;
    }
    let best;
    for (const k of indexKeys(def, index, rec)) {
      if (!test(k)) continue;
      if (best === undefined || (direction === 'next' ? compareKeys(k, best) < 0 : compareKeys(k, best) > 0)) best = k;
    }
    if (best !== undefined) entries.push([best, rec]);
  }
  const sign = direction === 'next' ? 1 : -1;
  entries.sort((a, b) => sign * (compareKeys(a[0], b[0]) || compareKeys(a[1][kp], b[1][kp])));
  const rows = entries.map((e) => e[1]);
  return plan.limit === undefined ? rows : rows.slice(0, plan.limit);
}

// ---------- Exportar ----------
export const isSecretRecord = (store, rec) => store === 'settings' && isPlain(rec) && rec.secret === true;

// rowsByStore: { nombre: registro[] }. Salida determinista (almacenes en orden del esquema, registros por clave primaria).
export function buildExport({ schema, schemaVersion, rowsByStore, exportedAt, includeSecrets = false }) {
  const stores = {};
  for (const [name, def] of Object.entries(schema)) {
    let rows = (rowsByStore[name] ?? []).filter((r) => !isReserved(name, r[def.keyPath]));
    if (!includeSecrets) rows = rows.filter((r) => !isSecretRecord(name, r));
    rows = rows.slice().sort((a, b) => compareKeys(a[def.keyPath], b[def.keyPath]));
    stores[name] = structuredClone(rows);
  }
  return { format: EXPORT_FORMAT, schemaVersion, exportedAt, stores };
}

// ---------- Importar ----------
const bad = (problems, extra = '') => new DbError(
  'BAD_IMPORT',
  `Respaldo no válido${extra ? ` (${extra})` : ''}: ${problems.slice(0, MAX_PROBLEMS).join('; ')}${problems.length > MAX_PROBLEMS ? `; y ${problems.length - MAX_PROBLEMS} más` : ''}`,
  { problems: problems.slice(0, MAX_PROBLEMS) },
);

// Valida un respaldo y lo lleva a la versión actual. NO toca ninguna base. Lanza BAD_IMPORT / NEWER_VERSION / MIGRATION.
export function prepareImport(data, { schema, schemaVersion, migrations = MIGRATIONS }) {
  if (!isPlain(data)) throw bad(['no es un objeto']);
  if (data.format !== EXPORT_FORMAT && !LEGACY_EXPORT_FORMATS.includes(data.format)) throw bad([`no es un respaldo de Glossa (formato "${String(data.format)}")`]);
  const v = data.schemaVersion;
  if (!Number.isInteger(v) || v < 1) throw bad([`versión no válida: ${String(v)}`]);
  if (v > schemaVersion) throw new DbError('NEWER_VERSION', `El respaldo es de la v${v} y esta app llega a la v${schemaVersion}`);
  if (!isPlain(data.stores)) throw bad(['falta "stores"']);
  const problems = [];
  const raw = {};
  for (const [name, rows] of Object.entries(data.stores)) {
    if (!Array.isArray(rows)) { problems.push(`"${name}" no es una lista`); continue; }
    rows.forEach((r, i) => { if (!isPlain(r)) problems.push(`${name}[${i}] no es un registro`); });
    raw[name] = rows;
  }
  if (problems.length) throw bad(problems);
  const keyPathOf = (s) => (Object.prototype.hasOwnProperty.call(schema, s) ? schema[s].keyPath : null);
  const migrated = runMigrations(raw, { from: v, to: schemaVersion, migrations, keyPathOf });
  const stores = {};
  const counts = {};
  for (const [name, rows] of Object.entries(migrated)) {
    if (!Object.prototype.hasOwnProperty.call(schema, name)) { problems.push(`almacén desconocido "${name}"`); continue; }
    const def = schema[name];
    const seen = new Set();
    const keep = [];
    rows.forEach((r, i) => {
      const key = r[def.keyPath];
      if (typeof key !== 'string' || key === '') { problems.push(`${name}[${i}]: falta la clave "${def.keyPath}"`); return; }
      if (isReserved(name, key)) return;
      if (seen.has(key)) { problems.push(`${name}: clave repetida "${key}"`); return; }
      try { structuredClone(r); } catch { problems.push(`${name}[${i}]: contiene datos no almacenables`); return; }
      seen.add(key);
      keep.push(r);
    });
    stores[name] = keep;
    counts[name] = keep.length;
  }
  if (problems.length) throw bad(problems);
  return { stores, counts, migratedFrom: v < schemaVersion ? v : null };
}

// Plan de escritura de una importación ya validada. `currentSettings` = registros actuales de `settings`.
//   replace: vacía solo los almacenes que trae el respaldo (los que no trae no se tocan) y escribe sus registros;
//            con keepSecrets (por defecto sí) conserva las claves secretas actuales que el respaldo no trae (un respaldo sin claves no las borra).
//   merge:   no vacía nada; cada registro del respaldo sobrescribe al que tenga la misma clave.
export function planImport(prepared, { mode = 'replace', keepSecrets = true, currentSettings = [] } = {}) {
  if (mode !== 'replace' && mode !== 'merge') throw new DbError('BAD_IMPORT', `Modo de importación desconocido: ${String(mode)}`);
  const clear = mode === 'replace' ? Object.keys(prepared.stores) : [];
  const records = [];
  for (const [store, rows] of Object.entries(prepared.stores)) for (const rec of rows) records.push([store, rec]);
  if (mode === 'replace' && keepSecrets && prepared.stores.settings) {
    const incoming = new Set(prepared.stores.settings.map((r) => r.key));
    for (const cur of currentSettings) if (isSecretRecord('settings', cur) && !incoming.has(cur.key)) records.push(['settings', cur]);
  }
  return { clear, records };
}
