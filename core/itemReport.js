// @purpose: Reporte local de un ítem («Marcar como difícil» / «No me convence esta frase») en meta (report:<itemId>), uno por tipo, el último gana, y legible aunque falte el campo marks.
// Reporte local (subparte 2.6, tramo 2). Contrato en docs/CONTRACTS.md, secciones «2.6» y «2.6-T2 (punto 1)». Sin almacén nuevo: usa `meta`, que ya entra en el respaldo (exportAll).
//
//   createItemReport({ db, clock? }) → objeto congelado { mark, clear, get, list, keyOf }
//     db  motor de core/db.js (solo se usa el almacén `meta`).   clock  reloj con now() (por defecto el del sistema).
//   mark(itemId, kind, now?) → Promesa { key, itemId, kind, at, changed: true }
//     kind: 'hard' (difícil) o 'doubt' (no me convence). Escribe `meta` con clave `report:<itemId>`:
//       { key, v: 1, itemId, kind, at, marks: { hard?: ISO, doubt?: ISO } }
//     `kind` y `at` son el ÚLTIMO reporte (la forma { kind, at } del contrato); `marks` guarda uno por tipo, así un ítem puede estar
//     marcado como difícil y también como dudoso. Repetir el mismo tipo reemplaza su fecha (el último gana); no crea duplicados.
//   clear(itemId, kind) → Promesa { key, itemId, kind, removed } · quita ese tipo; si no queda ninguno borra el registro. Sin reporte → removed false.
//   get(itemId) → Promesa { itemId, hard: ISO|null, doubt: ISO|null } o null si no hay reporte. Lee también el registro con solo { kind, at }.
//   list(kind?) → Promesa [{ itemId, hard, doubt }] ordenada por itemId; con kind solo los ítems que lo tienen. Ignora registros ilegibles.
//   Si la base falla se rechaza con el error de la base y no se escribe nada a medias (una sola escritura por llamada).
import { toDate, systemClock } from './clock.js';

export const REPORT_PREFIX = 'report:';
export const REPORT_VERSION = 1;
export const KINDS = Object.freeze(['hard', 'doubt']);
export const MAX_ITEM_ID = 200;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

function checkId(itemId) {
  if (typeof itemId !== 'string' || itemId === '' || itemId.length > MAX_ITEM_ID || /[\s/\\'"]/.test(itemId)) {
    throw new Error('itemReport: itemId debe ser un texto de 1 a 200 caracteres sin espacios, barras ni comillas');
  }
}
function checkKind(kind) {
  if (!KINDS.includes(kind)) throw new Error("itemReport: kind debe ser 'hard' o 'doubt'");
}
export const keyOf = (itemId) => { checkId(itemId); return `${REPORT_PREFIX}${itemId}`; };

// Lee los tipos de un registro, nuevo (marks) o con solo { kind, at }; descarta lo ilegible.
function marksOf(row) {
  if (!isObj(row)) return null;
  const out = {};
  if (isObj(row.marks)) {
    for (const k of KINDS) if (typeof row.marks[k] === 'string' && ISO_RE.test(row.marks[k])) out[k] = row.marks[k];
  } else if (KINDS.includes(row.kind) && typeof row.at === 'string' && ISO_RE.test(row.at)) {
    out[row.kind] = row.at;
  }
  return Object.keys(out).length > 0 ? out : null;
}
// Con dos tipos posibles, al quitar uno queda como mucho uno: ese es el último reporte.
const remainingKind = (marks) => KINDS.find((k) => marks[k] !== undefined) ?? null;
const view = (itemId, marks) => ({ itemId, hard: marks.hard ?? null, doubt: marks.doubt ?? null });

export function createItemReport({ db, clock = systemClock } = {}) {
  if (!db || typeof db.get !== 'function' || typeof db.put !== 'function' || typeof db.delete !== 'function' || typeof db.query !== 'function') {
    throw new Error('createItemReport: falta la base de datos');
  }
  if (!clock || typeof clock.now !== 'function') throw new Error('createItemReport: reloj no válido');

  async function mark(itemId, kind, now) {
    checkId(itemId); checkKind(kind);
    let at;
    try { at = toDate(now === undefined ? clock.now() : now).toISOString(); } catch { throw new Error('itemReport: now debe ser una fecha (Date, milisegundos o texto ISO)'); }
    const key = keyOf(itemId);
    const marks = { ...(marksOf(await db.get('meta', key)) ?? {}), [kind]: at };
    await db.put('meta', { key, v: REPORT_VERSION, itemId, kind, at, marks });
    return { key, itemId, kind, at, changed: true };
  }

  async function clear(itemId, kind) {
    checkId(itemId); checkKind(kind);
    const key = keyOf(itemId);
    const marks = marksOf(await db.get('meta', key));
    if (marks === null || marks[kind] === undefined) return { key, itemId, kind, removed: false };
    delete marks[kind];
    const last = remainingKind(marks);
    if (last === null) await db.delete('meta', key);
    else await db.put('meta', { key, v: REPORT_VERSION, itemId, kind: last, at: marks[last], marks });
    return { key, itemId, kind, removed: true };
  }

  async function get(itemId) {
    const marks = marksOf(await db.get('meta', keyOf(itemId)));
    return marks === null ? null : view(itemId, marks);
  }

  async function list(kind) {
    if (kind !== undefined) checkKind(kind);
    const out = [];
    for (const row of await db.query('meta', {})) {
      const k = row?.key;
      if (typeof k !== 'string' || !k.startsWith(REPORT_PREFIX)) continue;
      const itemId = k.slice(REPORT_PREFIX.length);
      if (itemId === '' || itemId.length > MAX_ITEM_ID) continue;
      const marks = marksOf(row);
      if (marks === null || (kind !== undefined && marks[kind] === undefined)) continue;
      out.push(view(itemId, marks));
    }
    return out.sort((a, b) => (a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0));
  }

  return Object.freeze({ mark, clear, get, list, keyOf });
}
