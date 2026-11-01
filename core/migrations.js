// @purpose: Migraciones hacia adelante de los datos, para abrir bases viejas e importar respaldos antiguos.
// Migraciones hacia adelante (subparte 0.7). PURAS: no tocan ninguna base; trabajan sobre
// `data = { nombreAlmacén: registro[] }` y devuelven una COPIA. Sirven igual para abrir una base vieja y para importar un respaldo viejo.
//
// Un paso es: { to: n, description: '…', transform?: { [almacén]: (registro) => registro | null } }
//   · `to` = versión a la que lleva el paso (consecutivas: 2, 3, 4…).
//   · `transform` convierte cada registro del almacén (devuelve otro objeto con la misma clave primaria, o null para descartarlo).
//   · Los almacenes e índices NUEVOS no se declaran aquí: salen del esquema de la versión nueva (core/db.js).
// REGLA (roadmap 8.13): nunca se pierden datos sin querer; todo paso nuevo lleva su prueba con datos de la versión previa.
import { DbError } from './dbErrors.js';

// Lista real de la app. La versión 1 es el esquema inicial: aún no hay pasos.
export const MIGRATIONS = Object.freeze([]);

export function latestVersion(migrations = MIGRATIONS, base = 1) {
  return migrations.length ? migrations[migrations.length - 1].to : base;
}

export function checkMigrations(migrations) {
  if (!Array.isArray(migrations)) throw new DbError('MIGRATION', 'Las migraciones deben ser un arreglo');
  let prev = 1;
  for (const m of migrations) {
    if (!m || !Number.isInteger(m.to) || m.to !== prev + 1) {
      throw new DbError('MIGRATION', `Migraciones no consecutivas: se esperaba el paso a v${prev + 1} y llegó ${String(m && m.to)}`);
    }
    if (m.transform !== undefined && (m.transform === null || typeof m.transform !== 'object')) {
      throw new DbError('MIGRATION', `Paso a v${m.to}: transform debe ser un objeto { almacén: función }`);
    }
    prev = m.to;
  }
  return prev;
}

// Aplica los pasos (from, to]. `keyPathOf(store)` valida que la clave primaria sobreviva (si no se da, no se valida).
export function runMigrations(data, { from, to, migrations = MIGRATIONS, keyPathOf } = {}) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new DbError('MIGRATION', 'Los datos a migrar no son un objeto');
  if (!Number.isInteger(from) || from < 1) throw new DbError('MIGRATION', `Versión de origen no válida: ${String(from)}`);
  const top = checkMigrations(migrations);
  const target = to ?? top;
  if (!Number.isInteger(target) || target > top) throw new DbError('MIGRATION', `No hay migraciones hasta la v${String(target)} (la última es la v${top})`);
  if (from > target) throw new DbError('NEWER_VERSION', `Los datos son de la v${from}; esta app llega a la v${target}`);
  let out;
  try { out = structuredClone(data); } catch (e) { throw new DbError('MIGRATION', 'Los datos a migrar no se pueden copiar', { cause: e }); }
  for (const step of migrations.filter((m) => m.to > from && m.to <= target)) {
    for (const [store, fn] of Object.entries(step.transform ?? {})) {
      if (typeof fn !== 'function') throw new DbError('MIGRATION', `Paso a v${step.to}: la transformación de "${store}" no es una función`, { store });
      const rows = Array.isArray(out[store]) ? out[store] : [];
      const next = [];
      for (const row of rows) {
        let res;
        try { res = fn(structuredClone(row)); } catch (e) {
          throw new DbError('MIGRATION', `Paso a v${step.to} falló en "${store}": ${e && e.message}`, { store, cause: e });
        }
        if (res === null) continue;
        if (!res || typeof res !== 'object' || Array.isArray(res)) throw new DbError('MIGRATION', `Paso a v${step.to}: "${store}" devolvió algo que no es un registro`, { store });
        const kp = keyPathOf ? keyPathOf(store) : null;
        if (kp && (typeof res[kp] !== 'string' || res[kp] === '')) throw new DbError('MIGRATION', `Paso a v${step.to}: "${store}" perdió su clave "${kp}"`, { store });
        next.push(res);
      }
      out[store] = next;
    }
  }
  return out;
}
