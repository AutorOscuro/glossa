// @purpose: Respaldo exportar/importar de la base con vista previa del impacto (modos fusionar y reemplazar, claves fuera por defecto) y nombre del archivo.
// Respaldo exportar/importar (subparte 0.8, ampliado en la 1.12-T1) y puente con el chat (1.12-T2: makeChatBlock / parseChatBlock,
// formato SOPHIA-EN-SYNC v1; la lógica vive en core/syncChat.js y aquí solo se ofrece con los nombres de 8.15). 1.12-T3: importación de errores
// del chat (core/syncImport.js) y bitácora en texto plano (core/syncLog.js).
//
//   createSync({ db, clock?, schema? = STORES, schemaVersion? = SCHEMA_VERSION, migrations? = MIGRATIONS, errors?, catalog?, topics?, board? }) → {
//     errors / catalog / topics / board son OPCIONALES y solo hacen falta para las funciones del chat que los usan (errors + catalog: importar errores y errores top de la
//     bitácora; topics: reconocer temas; board + topics: dominio por área en la bitácora y refresco de la caché tras importar). Sin ellos esas funciones lanzan Error en español.
//     exportBackup({ includeSecrets? = false }) → Promesa de { json, filename, counts, includesSecrets }
//         json = texto JSON del respaldo (db.exportAll). Sin includeSecrets las claves NO van en el archivo: se quitan aquí
//         aunque el motor las entregara (defensa doble).
//     previewBackup(text, { mode? = 'replace', keepSecrets? = true }) → Promesa de {
//         format, schemaVersion, exportedAt, migratedFrom, mode, hasSecrets,
//         stores: { nombre: { before, incoming, added, overwritten, unchanged, removed, kept, after } },   solo los almacenes que trae el respaldo
//         totals: { incoming, added, overwritten, unchanged, removed, kept }
//     }
//         NO escribe nada. Valida igual que importar (versión, formato, registros) y lanza lo mismo que importBackup.
//         added = registros que aún no están; overwritten = ya están y cambian; unchanged = ya están y son idénticos;
//         removed = solo en modo reemplazar: registros actuales que el respaldo no trae (se perderán);
//         kept = claves secretas actuales que se conservan (reemplazar con keepSecrets);  after = before − removed + added.
//     importBackup(text, { mode? = 'replace', keepSecrets? = true }) → Promesa de { stores, migratedFrom, total, mode }
//         Valida antes de tocar nada; si el texto no es un respaldo válido lanza DbError('BAD_IMPORT') y no cambia nada.
//         Por defecto reemplaza y CONSERVA las claves que ya hay en este dispositivo (el respaldo normal no las trae).
//     makeChatBlock(kind, payload, { now? = clock/ahora }) → texto del bloque; parseChatBlock(text) → { ok, … }   (puras; ver core/syncChat.js)
//     previewChatErrors(text) / importChatErrors(text) → Promesa de { ok, … }   importación IDEMPOTENTE de un bloque `errores` (ver core/syncImport.js; necesita errors y catalog)
//     buildLog(data?) → Promesa de texto   bitácora en texto plano (core/syncLog.js). Completa por su cuenta, si no se los das, `topErrors` (errors.top de los últimos
//         `windowDays` = 14 días, con el título del catálogo) y `areas` (board.byArea sobre `topics`, solo áreas con temas vistos).
//     makeLogBlock(data?) → Promesa de texto   la bitácora ya envuelta en un bloque `bitacora` listo para pegar.
//   }
//   backupFilename(date) → "glossa-respaldo-AAAA-MM-DD.json" (día local). Importar no mira el nombre del archivo: los "sophia-respaldo-…" viejos valen.
import { DbError } from './dbErrors.js';
import { localDay } from './clock.js';
import { STORES, SCHEMA_VERSION, prepareImport, isReserved, isSecretRecord } from './db.js';
import { MIGRATIONS } from './migrations.js';
import { makeChatBlock, parseChatBlock, scanValue } from './syncChat.js';
import { createChatImport } from './syncImport.js';
import { buildLogText, LOG_LIMITS } from './syncLog.js';

export { makeChatBlock, parseChatBlock };

export const MAX_BACKUP_CHARS = 50_000_000;
// Un respaldo real no pasa de unos 20 niveles (registro → campos → listas); más de esto es un archivo hostil o roto, y comparar o copiar algo tan hondo desborda la pila.
export const MAX_BACKUP_DEPTH = 100;

export function backupFilename(date) {
  return `glossa-respaldo-${localDay(date)}.json`;
}

function parseBackupText(text) {
  if (typeof text !== 'string' || text.trim() === '') throw new DbError('BAD_IMPORT', 'El respaldo está vacío');
  if (text.length > MAX_BACKUP_CHARS) throw new DbError('BAD_IMPORT', 'El respaldo es demasiado grande');
  let data;
  try { data = JSON.parse(text); } catch (e) { throw new DbError('BAD_IMPORT', 'El respaldo no es un JSON válido', { cause: e }); }
  // Sin tope de nodos (el tamaño ya lo limita MAX_BACKUP_CHARS); sí de profundidad y de nombres de campo prohibidos (__proto__, constructor, prototype).
  const problem = scanValue(data, { maxDepth: MAX_BACKUP_DEPTH, maxNodes: Infinity });
  if (problem) throw new DbError('BAD_IMPORT', `El respaldo no se puede leer: ${problem}`);
  return data;
}

function checkMode(mode) {
  if (mode !== 'replace' && mode !== 'merge') throw new DbError('BAD_IMPORT', `Modo de importación desconocido: ${String(mode)}`);
}

// Igualdad profunda de valores que vienen de JSON (el orden de las claves de un objeto no cuenta; el de una lista sí).
function sameValue(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((v, i) => sameValue(v, b[i]));
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && sameValue(a[k], b[k]));
}

export function createSync({ db, clock, schema = STORES, schemaVersion = SCHEMA_VERSION, migrations = MIGRATIONS, errors, catalog, topics, board } = {}) {
  const need = () => {
    if (!db) throw new DbError('UNAVAILABLE');
    return db;
  };
  const nowDate = () => (clock ? clock.now() : new Date());
  let chatImport = null;
  const importer = () => {
    if (!errors || !catalog) throw new Error('createSync: para importar errores del chat faltan `errors` y `catalog`');
    chatImport ??= createChatImport({ db: need(), errors, catalog, clock, topics, board });
    return chatImport;
  };

  async function buildLogAt(data, now) {
    if (data === null || typeof data !== 'object' || Array.isArray(data)) throw new Error('buildLog: los datos deben ser un objeto');
    buildLogText({ ...data, topErrors: [], areas: [] }, { now }); // solo valida `data` antes de leer la base
    const days = data.windowDays ?? 14;
    const out = { ...data };
    if (out.topErrors === undefined && errors && catalog) {
      const top = await errors.top(LOG_LIMITS.topErrors, { from: localDay(new Date(now.getTime() - days * 86400000)), to: localDay(now) });
      out.topErrors = top.map((e) => ({ code: e.code, title: catalog.get(e.code)?.titulo_es ?? undefined, frequency: e.frequency, impact: e.impact }));
    }
    if (out.areas === undefined && board && Array.isArray(topics)) {
      const res = await board.byArea(topics, now);
      out.areas = res.groups.filter((g) => g.seen > 0).map((g) => ({ area: g.key, pct: g.pct, band: g.label }));
    }
    return buildLogText(out, { now });
  }
  const buildLog = (data = {}) => buildLogAt(data, nowDate());

  async function previewBackup(text, { mode = 'replace', keepSecrets = true } = {}) {
    const d = need();
    checkMode(mode);
    const data = parseBackupText(text);
    const prepared = prepareImport(data, { schema, schemaVersion, migrations });
    const stores = {};
    const totals = { incoming: 0, added: 0, overwritten: 0, unchanged: 0, removed: 0, kept: 0 };
    let hasSecrets = false;
    for (const [name, rows] of Object.entries(prepared.stores)) {
      const keyPath = schema[name].keyPath;
      const current = (await d.query(name)).filter((r) => !isReserved(name, r[keyPath]));
      const byKey = new Map(current.map((r) => [r[keyPath], r]));
      const incomingKeys = new Set();
      let added = 0;
      let overwritten = 0;
      let unchanged = 0;
      for (const rec of rows) {
        const key = rec[keyPath];
        incomingKeys.add(key);
        if (isSecretRecord(name, rec)) hasSecrets = true;
        const cur = byKey.get(key);
        if (!cur) added += 1;
        else if (sameValue(cur, rec)) unchanged += 1;
        else overwritten += 1;
      }
      let removed = 0;
      let kept = 0;
      if (mode === 'replace') {
        for (const cur of current) {
          if (incomingKeys.has(cur[keyPath])) continue;
          if (keepSecrets && isSecretRecord(name, cur)) kept += 1;
          else removed += 1;
        }
      }
      stores[name] = { before: current.length, incoming: rows.length, added, overwritten, unchanged, removed, kept, after: current.length - removed + added };
      totals.incoming += rows.length;
      totals.added += added;
      totals.overwritten += overwritten;
      totals.unchanged += unchanged;
      totals.removed += removed;
      totals.kept += kept;
    }
    return {
      format: data.format,
      schemaVersion: data.schemaVersion,
      exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : null,
      migratedFrom: prepared.migratedFrom,
      mode,
      hasSecrets,
      stores,
      totals,
    };
  }

  return {
    async exportBackup({ includeSecrets = false } = {}) {
      const withSecrets = includeSecrets === true;
      const data = await need().exportAll({ includeSecrets: withSecrets });
      if (!withSecrets) {
        for (const [name, rows] of Object.entries(data.stores)) data.stores[name] = rows.filter((r) => !isSecretRecord(name, r));
      }
      const counts = Object.fromEntries(Object.entries(data.stores).map(([k, rows]) => [k, rows.length]));
      return { json: JSON.stringify(data), filename: backupFilename(nowDate()), counts, includesSecrets: withSecrets };
    },
    previewBackup,
    makeChatBlock: (kind, payload, opts = {}) => makeChatBlock(kind, payload, { now: nowDate(), ...opts }),
    parseChatBlock,
    previewChatErrors: (text) => importer().previewErrors(text),
    importChatErrors: (text) => importer().importErrors(text),
    buildLog,
    async makeLogBlock(data = {}) {
      const now = nowDate();
      return makeChatBlock('bitacora', { texto: await buildLogAt(data, now) }, { now });
    },
    async importBackup(text, { mode = 'replace', keepSecrets = true } = {}) {
      const d = need();
      checkMode(mode);
      const data = parseBackupText(text);
      const res = await d.importAll(data, { mode, keepSecrets });
      return { ...res, total: Object.values(res.stores).reduce((a, n) => a + n, 0), mode };
    },
  };
}
