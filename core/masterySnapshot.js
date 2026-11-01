// @purpose: Foto diaria de dominio por tema: una por día local en meta (mastery_snap:<día>), solo temas con evidencia, hasta 400 días e idempotente.
// Foto diaria de dominio (subparte 2.1, tramo 2). Roadmap 17 («Foto diaria de dominio») y 2.1-T2. La leen `stats.masteryTrend`, 2.8 y 3.6.
//
//   createMasterySnapshot({ db, board, topics, clock?, maxDays? }) → objeto congelado { take, takeIfMissing, list, keyOf }
//     db      motor de core/db.js (solo se usa el almacén `meta`).   board  createMasteryBoard(...) (se usa `board.results`).
//     topics  lista de temas de topics.json ({ id, … }): se calcula el dominio de cada uno.   maxDays  fotos que se conservan (por defecto 400).
//   take(now?) → Promesa { day, key, saved, changed, count, pruned }
//     Calcula el dominio de todos los temas, guarda solo los que tienen respuestas (`evidence` > 0) y escribe UNA foto por día local en
//     `meta` con la clave `mastery_snap:<AAAA-MM-DD>`: { key, v: 1, day, results: [{ topicId, pct, band, confidence, evidence }] } (orden por topicId).
//     Idempotente: repetir la llamada con los mismos datos deja la foto igual (changed false, sin escribir); con datos nuevos del mismo día la última gana.
//     Sin ningún tema con evidencia NO se guarda foto (saved false). Después de escribir borra las más antiguas hasta quedar `maxDays` (pruned).
//   takeIfMissing(now?) → igual que take, pero si ya hay foto de ese día no calcula nada (saved false, changed false, count = las que había).
//   list({ from?, to? }?) → Promesa [{ day, results }] en orden de día, listas para `masteryTrend`; ignora registros ilegibles; rango inclusivo en días AAAA-MM-DD.
//   Si la base falla (cuota, cerrada…) se rechaza con DbError y no se borra nada. Si el cálculo falla no se escribe nada.
import { toDate, localDay, systemClock } from './clock.js';

export const SNAP_PREFIX = 'mastery_snap:';
export const SNAP_VERSION = 1;
export const DEFAULT_MAX_DAYS = 400;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const BANDS = new Set(['unseen', 'initial', 'progress', 'solid', 'mastered']);
const CONFIDENCE = new Set(['low', 'mid', 'high']);

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
export const keyOf = (day) => {
  if (typeof day !== 'string' || !DAY_RE.test(day)) throw new Error('masterySnapshot: el día debe ser AAAA-MM-DD');
  return `${SNAP_PREFIX}${day}`;
};
const dayOfKey = (key) => (typeof key === 'string' && key.startsWith(SNAP_PREFIX) && DAY_RE.test(key.slice(SNAP_PREFIX.length)) ? key.slice(SNAP_PREFIX.length) : null);

function cleanResult(r) {
  if (!isObj(r) || typeof r.topicId !== 'string' || r.topicId === '') return null;
  if (!Number.isFinite(r.pct) || !Number.isFinite(r.evidence) || r.evidence <= 0) return null;
  return {
    topicId: r.topicId, pct: Math.max(0, Math.min(100, Math.round(r.pct))), band: BANDS.has(r.band) ? r.band : 'initial',
    confidence: CONFIDENCE.has(r.confidence) ? r.confidence : 'low', evidence: Math.floor(r.evidence),
  };
}
const sameResults = (a, b) => Array.isArray(a) && a.length === b.length && a.every((x, i) => isObj(x) && ['topicId', 'pct', 'band', 'confidence', 'evidence'].every((k) => x[k] === b[i][k]));

export function createMasterySnapshot({ db, board, topics, clock = systemClock, maxDays = DEFAULT_MAX_DAYS } = {}) {
  if (!db || typeof db.get !== 'function' || typeof db.put !== 'function' || typeof db.query !== 'function') throw new Error('createMasterySnapshot: falta la base de datos');
  if (!board || typeof board.results !== 'function') throw new Error('createMasterySnapshot: falta el tablero de dominio (board.results)');
  if (!Array.isArray(topics)) throw new Error('createMasterySnapshot: topics debe ser una lista de temas');
  if (!clock || typeof clock.now !== 'function') throw new Error('createMasterySnapshot: reloj no válido');
  if (!Number.isInteger(maxDays) || maxDays < 1 || maxDays > 3650) throw new Error('createMasterySnapshot: maxDays debe ser un entero de 1 a 3650');
  const topicList = topics.filter((t) => isObj(t) && typeof t.id === 'string' && t.id !== '');

  const dayAt = (now) => {
    let at;
    try { at = toDate(now === undefined ? clock.now() : now); } catch { throw new Error('masterySnapshot: now debe ser una fecha (Date, milisegundos o texto ISO)'); }
    return { at, day: localDay(at) };
  };
  const snapKeys = async () => (await db.query('meta', {})).map((r) => r?.key).filter((k) => dayOfKey(k) !== null).sort();

  async function prune() {
    const keys = await snapKeys();
    const extra = keys.slice(0, Math.max(0, keys.length - maxDays));
    for (const k of extra) await db.delete('meta', k);
    return extra.length;
  }

  async function take(now) {
    const { at, day } = dayAt(now);
    const key = keyOf(day);
    const map = await board.results(topicList, at);
    const results = [...map.values()].map(cleanResult).filter(Boolean).sort((a, b) => (a.topicId < b.topicId ? -1 : a.topicId > b.topicId ? 1 : 0));
    if (results.length === 0) return { day, key, saved: false, changed: false, count: 0, pruned: 0 };
    const prev = await db.get('meta', key);
    if (isObj(prev) && sameResults(prev.results, results)) return { day, key, saved: true, changed: false, count: results.length, pruned: 0 };
    await db.put('meta', { key, v: SNAP_VERSION, day, results });
    const pruned = await prune();
    return { day, key, saved: true, changed: true, count: results.length, pruned };
  }

  async function takeIfMissing(now) {
    const { day } = dayAt(now);
    const prev = await db.get('meta', keyOf(day));
    if (isObj(prev) && Array.isArray(prev.results)) return { day, key: keyOf(day), saved: false, changed: false, count: prev.results.length, pruned: 0 };
    return take(now);
  }

  async function list({ from, to } = {}) {
    for (const [name, v] of [['from', from], ['to', to]]) if (v !== undefined && (typeof v !== 'string' || !DAY_RE.test(v))) throw new Error(`masterySnapshot: \`${name}\` debe ser AAAA-MM-DD`);
    const out = [];
    for (const row of await db.query('meta', {})) {
      const day = dayOfKey(row?.key);
      if (day === null || !isObj(row) || row.day !== day || !Array.isArray(row.results)) continue;
      if ((from !== undefined && day < from) || (to !== undefined && day > to)) continue;
      out.push({ day, results: row.results.map(cleanResult).filter(Boolean) });
    }
    return out.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  }

  return Object.freeze({ take, takeIfMissing, list, keyOf });
}
