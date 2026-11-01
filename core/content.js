// @purpose: Cargador de contenido: valida el índice y descarga los paquetes con fetch inyectado; reexporta la validación e importación de paquetes.
// Cargador de contenido (subparte 1.3, cuarto 4, mitad 4A, parte 1). Roadmap 8.10, 8.15 y 1.3. Sin DOM, sin base de datos, sin red propia:
// el `fetch` se inyecta (en la app es `fetch`; en las pruebas, uno falso).
//   validateIndex(input) → { ok, errors, warnings, errorTotal, warningTotal }   valida `content/index.json` (nunca lanza)
//   loadIndex(fetchFn, opts?)         → { ok:true, index, missing } | { ok:false, error }
//   loadPack(entry, fetchFn, opts?)   → { ok:true, pack, warnings } | { ok:false, error }
//   validatePack                      reexportado (8.15: content.validatePack)
// `error` = { code, message (español, para mostrar), detail? }. Ninguna función lanza. importPacksToDb(db, fetchFn, opts) → { ok, missing, results, failed } (parte 2 de la 4A; ver contentImport.js).
// opts: base ('content/'), timeoutMs (15000), maxBytes (20 MB de texto), ctx (contexto de validatePack: errorCodes, topicIds, …), validate (true).
import { createReport, check, joinPath, int, list, obj, oneOf, idOf, custom } from './contentRules.js';
import { topicRef, isPlain } from './contentCommon.js';
import { validatePack, PACK_ID_RE } from './contentPack.js';
import { importPackToDb, CACHE_STORE } from './contentImport.js';
import { classifyError } from './dbErrors.js';

export { validatePack, importPackToDb };
export { deprecatedItemIds, cardIdOf, initialCard } from './contentImport.js';
export const INDEX_SCHEMA = 1;
export const MAX_INDEX_PACKS = 1000;
export const DEFAULT_TIMEOUT_MS = 15000;
export const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;
export const PACK_PATH_RE = /^content\/packs\/[a-z][a-z0-9_]{2,59}\.json$/;
export const packPath = (packId) => `content/packs/${packId}.json`;

// ---------- el índice ----------
const ENTRY = obj({
  pack_id: idOf(PACK_ID_RE, 'un id de paquete como gram_perfect_tenses_v1'),
  version: int(1, 9999),
  path: idOf(PACK_PATH_RE, 'una ruta como content/packs/<pack_id>.json'),
  topics: list(topicRef(), { min: 1, max: 100, unique: true }),
  items_count: int(0, 1000000),
  size_kb: int(0, 1000000),
});

const PACKS = custom((r, path, v, ctx) => {
  check(r, path, v, list(ENTRY, { max: MAX_INDEX_PACKS }), ctx);
  if (!Array.isArray(v)) return;
  const seen = new Map();
  for (let i = 0; i < Math.min(v.length, MAX_INDEX_PACKS); i += 1) {
    const e = isPlain(v[i]) ? { ...v[i] } : null;
    if (!e || typeof e.pack_id !== 'string') continue;
    const at = joinPath(path, i);
    if (seen.has(e.pack_id)) r.error(joinPath(at, 'pack_id'), 'DUPLICATE', `el paquete ${e.pack_id} ya está en packs[${seen.get(e.pack_id)}]`);
    else seen.set(e.pack_id, i);
    // La ruta se deriva del pack_id: un índice no puede mandar a la app a pedir otro archivo.
    if (typeof e.path === 'string' && PACK_PATH_RE.test(e.path) && PACK_ID_RE.test(e.pack_id) && e.path !== packPath(e.pack_id)) {
      r.error(joinPath(at, 'path'), 'INDEX_PATH', `la ruta debe ser ${packPath(e.pack_id)}`);
    }
  }
});

const INDEX = obj({ schema: oneOf([INDEX_SCHEMA]), packs: PACKS });

export function validateIndex(input) {
  const r = createReport();
  check(r, '', input, INDEX, {});
  return r.result();
}

// ---------- red ----------
const err = (code, message, detail) => ({ ok: false, error: detail === undefined ? { code, message } : { code, message, detail } });

// Pide un texto con tiempo máximo. Nunca lanza.
async function getText(fetchFn, url, { timeoutMs, maxBytes }) {
  if (typeof fetchFn !== 'function') return err('NO_FETCH', 'No hay forma de pedir archivos en este entorno.');
  const ac = typeof AbortController === 'function' ? new AbortController() : null;
  let timer;
  const timeout = new Promise((resolve) => { timer = setTimeout(() => { if (ac) ac.abort(); resolve('timeout'); }, timeoutMs); });
  try {
    const res = await Promise.race([Promise.resolve().then(() => fetchFn(url, ac ? { signal: ac.signal } : undefined)), timeout]);
    if (res === 'timeout') return err('TIMEOUT', 'El servidor tardó demasiado en responder. Intenta de nuevo.', url);
    if (!res || typeof res.text !== 'function') return err('NETWORK', 'La respuesta del servidor no se pudo leer.', url);
    if (res.status === 404) return err('NOT_FOUND', 'No se encontró el archivo.', url);
    if (res.status === 503) return err('OFFLINE', 'Sin conexión, y este contenido todavía no está guardado en el dispositivo.', url);
    if (!res.ok) return err('HTTP', `El servidor respondió con un error (${res.status}).`, url);
    const text = await Promise.race([res.text(), timeout]);
    if (text === 'timeout') return err('TIMEOUT', 'El servidor tardó demasiado en responder. Intenta de nuevo.', url);
    if (typeof text !== 'string') return err('NETWORK', 'La respuesta del servidor no se pudo leer.', url);
    if (text.length > maxBytes) return err('TOO_BIG', 'El archivo es demasiado grande.', url);
    return { ok: true, text };
  } catch {
    return err('NETWORK', 'No se pudo descargar el contenido. Revisa tu conexión.', url);
  } finally {
    clearTimeout(timer);
  }
}

function parseJson(text, url) {
  try { return { ok: true, value: JSON.parse(text) }; } catch { return err('BAD_JSON', 'El archivo está dañado (no es JSON válido).', url); }
}

const settings = (opts) => ({
  base: typeof opts?.base === 'string' ? opts.base : 'content/',
  timeoutMs: Number.isFinite(opts?.timeoutMs) && opts.timeoutMs > 0 ? opts.timeoutMs : DEFAULT_TIMEOUT_MS,
  maxBytes: Number.isFinite(opts?.maxBytes) && opts.maxBytes > 0 ? opts.maxBytes : DEFAULT_MAX_BYTES,
});
const summarize = (res, max = 5) => res.errors.slice(0, max).map((p) => `${p.path || '(raíz)'}: ${p.message}`);

// ---------- cargadores ----------
// Un repo sin `content/index.json` todavía (aún no se instaló ningún paquete) NO es un fallo: índice vacío con `missing: true`.
export async function loadIndex(fetchFn, opts = {}) {
  const s = settings(opts);
  const url = `${s.base.replace(/\/?$/, '/')}index.json`;
  const got = await getText(fetchFn, url, s);
  if (!got.ok) {
    if (got.error.code === 'NOT_FOUND') return { ok: true, index: { schema: INDEX_SCHEMA, packs: [] }, missing: true };
    return got;
  }
  const parsed = parseJson(got.text, url);
  if (!parsed.ok) return parsed;
  const res = validateIndex(parsed.value);
  if (!res.ok) return err('BAD_INDEX', 'La lista de paquetes (index.json) no es válida.', summarize(res));
  return { ok: true, index: parsed.value, missing: false };
}

// `entry` es una entrada del índice YA validada. Comprueba que el paquete traído sea el que el índice anuncia (la caché del navegador
// puede mezclar versiones; desde 2.9-T3 el service worker sirve índice y paquetes de la misma instalación) y, salvo `validate: false`, que cumpla el contrato completo.
export async function loadPack(entry, fetchFn, opts = {}) {
  if (!isPlain(entry) || typeof entry.pack_id !== 'string' || !PACK_ID_RE.test(entry.pack_id)) return err('BAD_ENTRY', 'Falta indicar qué paquete cargar.');
  const s = settings(opts);
  const url = packPath(entry.pack_id); // nunca se pide `entry.path`: la ruta se deriva del id
  const got = await getText(fetchFn, url, s);
  if (!got.ok) return got;
  const parsed = parseJson(got.text, url);
  if (!parsed.ok) return parsed;
  const pack = parsed.value;
  if (!isPlain(pack) || pack.pack_id !== entry.pack_id) return err('PACK_MISMATCH', 'El archivo descargado no es el paquete que se pidió.', url);
  if (Number.isInteger(entry.version) && pack.version !== entry.version) {
    return err('STALE', 'El paquete guardado es de otra versión que la lista. Vuelve a abrir la app para actualizarlo.', { expected: entry.version, got: pack.version });
  }
  if (opts.validate === false) return { ok: true, pack, warnings: 0 };
  const res = validatePack(pack, opts.ctx || {});
  if (!res.ok) return err('INVALID_PACK', 'El paquete tiene errores y no se usará.', { total: res.errorTotal, first: summarize(res) });
  return { ok: true, pack, warnings: res.warningTotal };
}

// ---------- índice → paquetes → base (8.15: content.importPacksToDb) ----------
// Un paquete que falla no impide los demás. Si ya está importado en esa versión (o una mayor) NO se vuelve a descargar (así la app abre sin conexión);
// `force: true` lo descarga y comprueba otra vez (repara tarjetas que falten). `opts.now` (Date) es obligatorio. Nunca lanza.
export async function importPacksToDb(db, fetchFn, opts = {}) {
  const li = await loadIndex(fetchFn, opts);
  if (!li.ok) return { ok: false, error: li.error, missing: false, results: [], failed: [] };
  const results = [];
  const failed = [];
  for (const entry of li.index.packs) {
    if (!opts.force) {
      try {
        const have = await db.get(CACHE_STORE, entry.pack_id);
        if (have && Number.isInteger(have.version) && have.version >= entry.version) {
          results.push({ ok: true, pack_id: entry.pack_id, version: have.version, status: 'unchanged', skipped: true, cardsCreated: 0, cardsRetopiced: 0, deprecated: [], reactivated: [] });
          continue;
        }
      } catch (e) { failed.push({ pack_id: entry.pack_id, error: { code: 'DB', message: classifyError(e).friendly } }); continue; }
    }
    const lp = await loadPack(entry, fetchFn, opts);
    if (!lp.ok) { failed.push({ pack_id: entry.pack_id, error: lp.error }); continue; }
    const r = await importPackToDb(db, lp.pack, opts);
    if (r.ok) results.push(r); else failed.push({ pack_id: entry.pack_id, error: r.error });
  }
  return { ok: failed.length === 0, missing: li.missing, results, failed };
}
