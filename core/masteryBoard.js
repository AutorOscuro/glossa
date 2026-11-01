// @purpose: Tablero del dominio por tema: calcula muchos temas con caché invalidada por eventos y responde por nivel, área, riesgo y estudio.
// Tablero del dominio (subparte 1.7, tramo 3). Roadmap 7.5, 8.7 y 17. Une `mastery.compute` (un tema) con las consultas puras de core/masteryAgg.js.
//   createMasteryBoard({ mastery, db, clock?, config? }) → objeto congelado
//     mastery  createMastery(...)   db  el mismo motor que usa `mastery` (se leen las tarjetas por el índice `topics` para la firma de la caché)
//   get(topicId, now?)        → resultado de compute, de la caché si sigue vigente (el resultado devuelto es inmutable y puede compartirse)
//   results(topics, now?)     → Map topicId → resultado (un solo `now` para todos; ids repetidos se calculan una vez)
//   byLevel(topics, now?) · byArea(topics, now?) → aggregate(...)   atRisk(topics, now?) · toStudy(topics, now?) → listas de masteryAgg
//   invalidate(topicIds?)     → borra de la caché un tema, una lista de temas o (sin argumento) todo
//   wrapEvents(events)        → copia de `events` cuyo `log` invalida los temas del evento que se le pasa (si el `log` falla no invalida): úsala para registrar eventos
//   explain(topicId, now?, { codeLabels? }) → desglose en español (core/masteryExplain.js) del resultado de `get`
//   stats()                   → { hits, misses, size }
// Caché: una entrada por tema. Es válida si coinciden (1) el día local de `now` (R decae con el tiempo), (2) la firma de las tarjetas del tema
// (id, due, reps, lapses, suspended, stability, last_review: repasar o suspender la cambia sin pasar por `log`) y (3) que nadie haya llamado a
// `invalidate` (lo hace `wrapEvents` en cada `log`). Los errores (store `errors`) NO entran en la firma: quien los registre sin un `log`
// posterior debe llamar a `invalidate(topicIds)`. Un cálculo en curso cuando se invalida no se guarda.
import { toDate, localDay } from './clock.js';
import { MASTERY_CONFIG } from './mastery.config.js';
import { aggregate, atRisk, toStudy } from './masteryAgg.js';
import { explain } from './masteryExplain.js';

function freezeDeep(v) {
  if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v)) freezeDeep(v[k]);
  }
  return v;
}

const cardSig = (c) => [c.id, c.due, c.reps, c.lapses, c.suspended, c.stability, c.last_review];
const okId = (id) => typeof id === 'string' && id !== '';

export function createMasteryBoard({ mastery, db, clock, config = MASTERY_CONFIG } = {}) {
  if (!mastery || typeof mastery.compute !== 'function') throw new Error('createMasteryBoard: falta el dominio (mastery.compute)');
  if (!db || typeof db.query !== 'function') throw new Error('createMasteryBoard: falta la base de datos (db.query)');
  if (clock !== undefined && (!clock || typeof clock.now !== 'function')) throw new Error('createMasteryBoard: reloj no válido');

  const entries = new Map(); // topicId → { day, sig, result }
  const epochs = new Map(); // topicId → veces que se invalidó (descarta cálculos en curso)
  let all = 0; // veces que se invalidó todo
  const epochOf = (id) => all + (epochs.get(id) ?? 0);
  let hits = 0;
  let misses = 0;

  function resolveNow(now) {
    try { return toDate(now === undefined ? (clock ? clock.now() : new Date()) : now); } catch { throw new Error('mastery board: now debe ser una fecha (Date, milisegundos o texto ISO)'); }
  }

  async function getAt(topicId, at) {
    if (!okId(topicId)) throw new Error('mastery board: topicId debe ser un texto no vacío');
    const day = localDay(at);
    const epoch = epochOf(topicId);
    const cards = await db.query('cards', { index: 'topics', value: topicId });
    const sig = JSON.stringify(cards.map(cardSig).sort()); // JSON: ningún valor puede imitar un separador
    const hit = entries.get(topicId);
    if (hit && hit.day === day && hit.sig === sig) { hits += 1; return hit.result; }
    misses += 1;
    const result = freezeDeep(structuredClone(await mastery.compute(topicId, at)));
    if (epochOf(topicId) === epoch) entries.set(topicId, { day, sig, result });
    return result;
  }

  const get = async (topicId, now) => getAt(topicId, resolveNow(now));
  const explainTopic = async (topicId, now, opts) => explain(await get(topicId, now), { config, ...opts });

  async function results(topics, now) {
    if (!Array.isArray(topics)) throw new Error('mastery board: topics debe ser una lista');
    const at = resolveNow(now);
    const map = new Map();
    for (const t of topics) {
      if (!t || !okId(t.id)) throw new Error('mastery board: cada tema debe ser un objeto con id de texto');
      if (!map.has(t.id)) map.set(t.id, await getAt(t.id, at));
    }
    return map;
  }

  function invalidate(topicIds) {
    if (topicIds === undefined) {
      all += 1;
      entries.clear();
      return;
    }
    const list = typeof topicIds === 'string' ? [topicIds] : topicIds;
    if (!Array.isArray(list) || !list.every(okId)) throw new Error('mastery board: invalidate espera un id, una lista de ids o nada');
    for (const id of list) { epochs.set(id, (epochs.get(id) ?? 0) + 1); entries.delete(id); }
  }

  function wrapEvents(events) {
    if (!events || typeof events.log !== 'function') throw new Error('mastery board: wrapEvents necesita events.log');
    const log = async (input) => {
      const saved = await events.log(input);
      invalidate((input && Array.isArray(input.topics) ? input.topics : []).filter(okId));
      return saved;
    };
    return Object.freeze({ ...events, log });
  }

  const query = (fn, by) => async (topics, now) => fn(topics, await results(topics, now), by ? { by, config } : { config });
  return Object.freeze({
    get, results, invalidate, wrapEvents, explain: explainTopic,
    byLevel: query(aggregate, 'level'), byArea: query(aggregate, 'area'), atRisk: query(atRisk), toStudy: query(toStudy),
    stats: () => ({ hits, misses, size: entries.size }),
  });
}
