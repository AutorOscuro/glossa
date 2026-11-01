// @purpose: Capa de disco del validador de contenido (lectura de archivos y carpetas), compartida por validate-content y add-pack.
// Capa de archivos del validador de contenido (subparte 1.3, cuarto 3, mitad 3B). Roadmap 1.3.
// La lógica de validación vive en core/ (pura). Aquí solo está lo que toca el disco, y lo reutilizará `add-pack` (cuarto 4):
// una sola implementación de «leer, armar el contexto y validar».
//
//   readJsonFile(file) → { ok:true, value } | { ok:false, rule, message }   lectura segura (sin enlaces simbólicos, con tope de tamaño, con BOM)
//   collectCandidates(inputs, cwd) → { candidates, skipped }                  archivos y carpetas → archivos .json a considerar
//   loadPackFiles(candidates) → { entries, skipped }                          lee cada uno; decide cuáles son paquetes
//   loadTaxonomy(root) → { ok, files, ctx }                                   valida error_codes.json y topics.json y arma el contexto base
//   loadInstalled(root, except?) → { entries, problems }                      resúmenes de lo que ya hay en content/packs/
//   contextFor(base, installed, batch, index) → ctx                           contexto de validatePack para el paquete `index` del lote
// Nunca escribe en el disco. Nunca sigue enlaces simbólicos. Nunca lanza por un archivo malo (lo devuelve como problema);
// lanza `UsageError` solo ante un uso incorrecto (ruta que no existe, carpeta raíz inválida).
import fs from 'node:fs';
import path from 'node:path';
import { validateErrorCodes, errorCodeSet } from '../core/contentCodes.js';
import { validateTopics, topicIdSet, topicInfo } from '../core/contentTaxonomy.js';
import { summarizePack } from '../core/contentInstalled.js';
import { isPlain } from '../core/contentCommon.js';

export const MAX_FILE_BYTES = 20 * 1024 * 1024; // un paquete de 5.000 ítems pesa ≈ 5 MB
export const MAX_PACK_FILES = 1000;
export const TAXONOMY_FILES = Object.freeze({ errorCodes: 'content/taxonomy/error_codes.json', topics: 'content/taxonomy/topics.json' });
export const PACKS_DIR = 'content/packs';

export class UsageError extends Error {
  constructor(message) { super(message); this.name = 'UsageError'; }
}

const fail = (rule, message) => ({ ok: false, rule, message });
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const toPosix = (p) => p.split(path.sep).join('/');

// Un informe sintético para un archivo que ni siquiera se pudo leer (mismo formato que `validatePack`).
export function fileReport(rule, message) {
  return { ok: false, errors: [{ path: '', rule, message }], warnings: [], errorTotal: 1, warningTotal: 0 };
}

// Línea y columna (desde 1) de una posición dentro de un texto.
export function lineColumn(text, pos) {
  let line = 1;
  let last = -1;
  const end = Math.min(Math.max(pos, 0), text.length);
  for (let i = 0; i < end; i += 1) if (text.charCodeAt(i) === 10) { line += 1; last = i; }
  return { line, column: end - last };
}

function jsonErrorMessage(e, raw) {
  const msg = String((e && e.message) || e).slice(0, 160);
  const at = /\(line (\d+) column (\d+)\)/.exec(msg);
  if (at) return `JSON no válido (línea ${at[1]}, columna ${at[2]}): ${msg}`;
  const pos = /position (\d+)/.exec(msg);
  if (pos) { const lc = lineColumn(raw, Number(pos[1])); return `JSON no válido (línea ${lc.line}, columna ${lc.column}): ${msg}`; }
  // Algunos mensajes de V8 no traen la posición pero sí un fragmento del texto: se busca en el archivo para dar la línea aproximada.
  const snip = /, (?:\.\.\.)?"([\s\S]*?)"(?:\.\.\.)? is not valid JSON/.exec(String((e && e.message) || ''));
  const at2 = snip && snip[1] ? raw.indexOf(snip[1]) : -1;
  if (at2 >= 0) return `JSON no válido (cerca de la línea ${lineColumn(raw, at2 + snip[1].length).line}): ${msg}`;
  if (/end of JSON/i.test(msg)) return `JSON no válido (el archivo termina antes de tiempo, en la línea ${lineColumn(raw, raw.length).line}): ${msg}`;
  return `JSON no válido: ${msg}`;
}

// Lee un `.json` sin seguir enlaces simbólicos y sin cargar archivos enormes.
export function readJsonFile(file) {
  let st;
  try { st = fs.lstatSync(file); } catch (e) {
    return e && e.code === 'ENOENT' ? fail('FILE_MISSING', 'el archivo no existe') : fail('FILE_UNREADABLE', `no se pudo leer el archivo (${(e && e.code) || 'error'})`);
  }
  if (st.isSymbolicLink()) return fail('FILE_SYMLINK', 'es un enlace simbólico: por seguridad no se siguen');
  if (!st.isFile()) return fail('FILE_NOT_REGULAR', 'no es un archivo');
  if (st.size === 0) return fail('FILE_EMPTY', 'el archivo está vacío');
  if (st.size > MAX_FILE_BYTES) return fail('FILE_TOO_BIG', `pesa ${(st.size / 1048576).toFixed(1)} MB y el máximo es ${MAX_FILE_BYTES / 1048576} MB`);
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch (e) { return fail('FILE_UNREADABLE', `no se pudo leer el archivo (${(e && e.code) || 'error'})`); }
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1); // algunos editores de Windows lo agregan
  if (raw.trim() === '') return fail('FILE_EMPTY', 'el archivo está vacío');
  try { return { ok: true, value: JSON.parse(raw) }; } catch (e) { return fail('JSON_INVALID', jsonErrorMessage(e, raw)); }
}

// ¿Parece un paquete? (objeto con alguna de las claves propias de un paquete). Sirve para ignorar un informe suelto dentro de una carpeta.
export function looksLikePack(v) {
  return isPlain(v) && ['pack_id', 'items', 'lexicon', 'stories', 'schema'].some((k) => has(v, k));
}

// Rutas dadas por el usuario (archivos o carpetas) → archivos `.json` candidatos. Las carpetas se leen sin entrar en subcarpetas.
// Un archivo dado a mano siempre se trata como paquete (`explicit`); los de una carpeta solo si lo parecen.
export function collectCandidates(inputs, cwd = process.cwd()) {
  const candidates = [];
  const skipped = [];
  const seen = new Map();
  const add = (file, explicit) => {
    const prev = seen.get(file);
    if (prev) { prev.explicit = prev.explicit || explicit; return; } // un archivo nombrado a mano nunca se omite en silencio
    const c = { file, explicit };
    seen.set(file, c);
    candidates.push(c);
  };
  for (const input of inputs) {
    if (typeof input !== 'string' || input === '') throw new UsageError('Una de las rutas está vacía.');
    const full = path.resolve(cwd, input);
    let st;
    try { st = fs.lstatSync(full); } catch { throw new UsageError(`No existe la ruta: ${input}`); }
    if (st.isSymbolicLink()) throw new UsageError(`La ruta es un enlace simbólico y por seguridad no se sigue: ${input}`);
    if (st.isFile()) { add(full, true); continue; }
    if (!st.isDirectory()) throw new UsageError(`La ruta no es un archivo ni una carpeta: ${input}`);
    let names;
    try { names = fs.readdirSync(full).sort(); } catch { throw new UsageError(`No se pudo leer la carpeta: ${input}`); }
    for (const name of names) {
      if (name.startsWith('.')) continue; // .gitkeep, .DS_Store…
      const child = path.join(full, name);
      let cst;
      try { cst = fs.lstatSync(child); } catch { continue; }
      if (cst.isSymbolicLink()) skipped.push({ file: child, reason: 'es un enlace simbólico (no se siguen)' });
      else if (cst.isDirectory()) skipped.push({ file: child, reason: 'es una subcarpeta (solo se leen los archivos de la carpeta indicada)' });
      else if (!name.toLowerCase().endsWith('.json')) skipped.push({ file: child, reason: 'no es un archivo .json' });
      else add(child, false);
    }
  }
  if (candidates.length > MAX_PACK_FILES) throw new UsageError(`Demasiados archivos (${candidates.length}); el máximo por ejecución es ${MAX_PACK_FILES}.`);
  return { candidates, skipped };
}

// Lee los candidatos. `entries`: { file, explicit, value } (paquete leído) o { file, explicit, problem } (no se pudo leer o no es JSON).
export function loadPackFiles(candidates) {
  const entries = [];
  const skipped = [];
  for (const c of candidates) {
    const read = readJsonFile(c.file);
    if (!read.ok) { entries.push({ file: c.file, explicit: c.explicit, problem: { rule: read.rule, message: read.message } }); continue; }
    if (!c.explicit && !looksLikePack(read.value)) { skipped.push({ file: c.file, reason: 'no parece un paquete (no tiene pack_id, items, lexicon ni stories)' }); continue; }
    entries.push({ file: c.file, explicit: c.explicit, value: read.value });
  }
  return { entries, skipped };
}

function loadOne(root, rel, validate) {
  const file = path.join(root, rel);
  const read = readJsonFile(file);
  if (!read.ok) return { file: rel, value: null, report: fileReport(read.rule, read.message), summary: '' };
  return { file: rel, value: read.value, report: validate(read.value), summary: '' };
}

// Valida primero `error_codes.json` y luego `topics.json` (que usa los códigos) y arma el contexto base de los paquetes.
// Si alguno de los dos tiene errores, `ctx` es null: validar paquetes contra una taxonomía rota solo produce errores en cascada.
export function loadTaxonomy(root) {
  const codes = loadOne(root, TAXONOMY_FILES.errorCodes, (v) => validateErrorCodes(v));
  const codeSet = codes.value ? errorCodeSet(codes.value) : undefined;
  const topics = loadOne(root, TAXONOMY_FILES.topics, (v) => validateTopics(v, codeSet ? { errorCodes: codeSet } : {}));
  if (codes.report.ok) codes.summary = `${codeSet.size} códigos`;
  if (topics.report.ok) topics.summary = `${topicIdSet(topics.value).size} temas`;
  const ok = codes.report.ok && topics.report.ok;
  const ctx = ok ? { errorCodes: codeSet, topicIds: topicIdSet(topics.value), topicInfo: topicInfo(topics.value) } : null;
  return { ok, files: [codes, topics], ctx };
}

// Paquetes ya instalados (content/packs/*.json) como resúmenes serializables. Uno ilegible NO se ignora: es un problema,
// porque sin él no se pueden comprobar los ids únicos. `exceptFiles` (rutas absolutas) deja fuera lo que ya va en el lote.
export function loadInstalled(root, exceptFiles = new Set()) {
  const dir = path.join(root, PACKS_DIR);
  const entries = [];
  const problems = [];
  let names = [];
  try { names = fs.readdirSync(dir).sort(); } catch { return { entries, problems }; } // sin carpeta: no hay nada instalado
  for (const name of names) {
    if (name.startsWith('.') || !name.toLowerCase().endsWith('.json')) continue;
    const file = path.join(dir, name);
    if (exceptFiles.has(file)) continue;
    const read = readJsonFile(file);
    if (!read.ok) { problems.push({ file, rule: 'INSTALLED_UNREADABLE', message: `paquete instalado ilegible (${read.message}); arréglalo antes: sin él no se pueden comprobar los ids únicos` }); continue; }
    if (!looksLikePack(read.value)) continue; // un .json ajeno dentro de la carpeta no es un paquete (igual que al validar los instalados)
    const summary = summarizePack(read.value);
    if (!summary) { problems.push({ file, rule: 'INSTALLED_UNREADABLE', message: 'el paquete instalado no tiene un pack_id válido; arréglalo antes: sin él no se pueden comprobar los ids únicos' }); continue; }
    entries.push({ file, summary });
  }
  return { entries, problems };
}

// Contexto de `validatePack` para el paquete `index` del lote: la taxonomía, más lo que YA existe fuera de él.
// Un instalado cuyo pack_id viene en el lote se está reemplazando, así que no cuenta; el resto del lote sí (si no, dos paquetes nuevos
// podrían traer el mismo id). Con el mismo pack_id que él mismo, `installedIndex` ya lo deja fuera (reemplazo).
export function contextFor(base, installedSummaries, batchSummaries, index) {
  const inBatch = new Set(batchSummaries.filter(Boolean).map((s) => s.pack_id));
  const installed = installedSummaries.filter((s) => !inBatch.has(s.pack_id));
  const others = batchSummaries.filter((s, i) => s && i !== index);
  return { ...base, installed: [...installed, ...others] };
}

export function relativePosix(root, file) {
  return toPosix(path.relative(root, file));
}
