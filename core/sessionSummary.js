// @purpose: Cálculo puro del resumen de sesión desde los eventos: cifras, tiempo, dominio por tema, errores nuevos y recurrentes, próximos repasos y fallos; sin DOM, base ni reloj.
// Resumen de sesión (subparte 2.8, tramo 1). Roadmap 2.8 y 17. Función PURA: no lee la base, el reloj ni el azar; recibe datos ya leídos y no los modifica.
// La pantalla (2.8-T2) y las acciones «Repetir los que fallé» y «Llevar al chat» (2.8-T3) usan lo que devuelve; aquí no se dibuja ni se redacta nada.
//
//   buildSessionSummary(input) → resumen CONGELADO en profundidad. Nunca lanza: con entradas absurdas devuelve un resumen vacío con `degraded: true`.
//     input = {
//       events         eventos guardados (core/events.js). Cuentan solo los `answer` de `sessionId` (si se da), sin repetir ids. Es la ÚNICA fuente de las cifras.
//       sessionId      identificador de la sesión. Sin él cuentan todos los `answer` que lleguen.
//       state          estado del ejecutor (core/sessionRunner.js), opcional: da lo planeado (`total`) y el motivo de cierre (`ended`).
//                      Sin él, planeado = respondidas y `ended` = null.
//       errors         registros de error (core/errors.js, ErrorRecord de 8.8) que pueden haber tocado la sesión; cuentan los que traen una ocurrencia de esta sesión.
//       catalog        catálogo de errores (core/errorCatalog.js), opcional: da `title` y `hint` (la microexplicación). Sin él quedan en null.
//       masteryBefore  [{ topicId, pct, band?, confidence? }] dominio ANTES de la sesión (p. ej. la última foto de `mastery_snap:`).
//       masteryAfter   [{ topicId, pct, band?, confidence?, lowEvidence? }] dominio DESPUÉS (`board.results`). Sin esta lista no hay cambios que mostrar.
//       cards          tarjetas actuales [{ id, due }] (las que se respondieron). Sin una tarjeta no se sabe cuándo vuelve: va a `nextReviews.unknown`.
//       now            Date | ms | ISO: «ahora», para contar los días hasta cada repaso. Sin él se usa el `ts` del último evento; sin eventos no hay repasos que contar.
//     }
//
//   Forma de la salida (todos los números son finitos; ninguno es NaN ni Infinity; lo que no se puede calcular es null):
//     v: 1, sessionId | null, ended: 'completed' | 'quit' | 'empty' | null,
//     empty      true si no hubo ninguna respuesta registrada.
//     partial    true si la sesión se dejó a medias (`ended` 'quit', o quedaron ítems sin responder). Una sesión vacía no es parcial.
//     planned    ítems que tenía la sesión.   answered  respuestas con evento.   pending  ítems a los que no se llegó (planned − respuestas del estado).
//     skippedWithoutEvent  ítems saltados SIN evento (ejercicio todavía no disponible: no se castigan ni se cuentan como fallo).
//     counts     { correct, almost, wrong, dontKnow, skipped }  desde los eventos.
//     accuracy   correct / answered (0–1) o null sin respuestas;  accuracyPct  el mismo dato redondeado a entero 0–100, o null.
//     time       { ms, avgMs | null, counted }  suma de `ms` de los eventos que lo traen (finito y ≥ 0); `counted` = cuántos lo traían.
//     byTopic    [{ topicId, answered, correct, almost, wrong, dontKnow, skipped }]  por tema de cada respuesta; más respondidas primero, luego por id.
//     mastery    { changes, improved, declined, newTopics }
//                changes = [{ topicId, before | null, after, delta | null, direction: 'up'|'same'|'down'|'new', band | null, confidence: 'low'|'mid'|'high'|null, lowEvidence: boolean }]
//                solo de los temas que se practicaron y tienen dato «después». Orden: new, up (más subida primero), same, down; empata por id.
//                direction 'up' / 'down' = el porcentaje, ya redondeado a entero, subió / bajó al menos 1 punto; 'new' = antes no había dato (primera evidencia).
//     errors     { fresh, recurrent, total }  total = fresh + recurrent (errores DISTINTOS tocados en la sesión).
//                entrada = { id, code, title | null, hint | null, original, correction | null, topics, kind, times, priorCount, count, itemId | null }
//                times = veces en esta sesión; priorCount = veces ANTES de la sesión (count − times, nunca negativo); fresh = priorCount 0; recurrent = priorCount ≥ 1.
//                Una ocurrencia es «de esta sesión» si el registro trae, en `seen`, el `ts` de una respuesta de la sesión al mismo ítem (así lo guarda `answerCommit`).
//                Orden: más veces en la sesión, luego sistemáticos primero, luego por id.
//     nextReviews { items, groups, unknown, earliest }
//                items = [{ cardId, itemId, due, days, bucket }] por fecha de repaso; days = días LOCALES desde hoy (0 = hoy o vencida; nunca negativo);
//                bucket 'today' (0) | 'tomorrow' (1) | 'week' (2–7) | 'later' (8 o más);  groups = { today, tomorrow, week, later };
//                unknown = tarjetas respondidas sin dato de repaso;  earliest = la fecha `due` más próxima o null.
//     failed     [{ cardId, itemId, result }]  tarjetas cuya ÚLTIMA respuesta de la sesión fue `wrong` o `dont_know`, en el orden en que se respondieron (para la mini-sesión de 2.8-T3).
//                `almost` (casi) NO es fallo: la respuesta se entendió y solo faltó ortografía.
//     degraded   true solo si el cálculo falló y se devolvió el resumen vacío.
import { toDate, localDay } from './clock.js';
import { RESULTS } from './eventSchema.js';

export const SUMMARY_VERSION = 1;
const MS_MAX = 86400000; // el mismo tope por respuesta que el esquema de eventos
const CONFIDENCE = new Set(['low', 'mid', 'high']);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const list = (v) => (Array.isArray(v) ? v : []);
const str = (v) => (typeof v === 'string' && v !== '' ? v : null);
const fin = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const textList = (v) => list(v).filter((x) => typeof x === 'string' && x !== '');

function deepFreeze(o) {
  if (o !== null && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const k of Object.keys(o)) deepFreeze(o[k]); }
  return o;
}

function dayNumber(day) {
  const [y, m, d] = day.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

function empty(state) {
  const planned = isObj(state) && Number.isInteger(state.total) && state.total >= 0 ? state.total : 0;
  return {
    v: SUMMARY_VERSION, sessionId: null, ended: isObj(state) && ['completed', 'quit', 'empty'].includes(state.ended) ? state.ended : null,
    empty: true, partial: false, planned, answered: 0, pending: 0, skippedWithoutEvent: 0,
    counts: { correct: 0, almost: 0, wrong: 0, dontKnow: 0, skipped: 0 }, accuracy: null, accuracyPct: null,
    time: { ms: 0, avgMs: null, counted: 0 }, byTopic: [],
    mastery: { changes: [], improved: 0, declined: 0, newTopics: 0 },
    errors: { fresh: [], recurrent: [], total: 0 },
    nextReviews: { items: [], groups: { today: 0, tomorrow: 0, week: 0, later: 0 }, unknown: 0, earliest: null },
    failed: [], degraded: false,
  };
}

// Eventos `answer` de la sesión, sin repetir ids, en el orden en que llegaron.
function sessionAnswers(events, sessionId) {
  const seen = new Set();
  const out = [];
  for (const e of list(events)) {
    if (!isObj(e) || e.type !== 'answer' || !RESULTS.includes(e.result)) continue;
    if (sessionId !== null && e.sessionId !== sessionId) continue;
    if (typeof e.id === 'string') { if (seen.has(e.id)) continue; seen.add(e.id); }
    out.push(e);
  }
  return out;
}

function countTopics(answers) {
  const map = new Map();
  for (const e of answers) {
    for (const topicId of new Set(textList(e.topics))) {
      const row = map.get(topicId) ?? { topicId, answered: 0, correct: 0, almost: 0, wrong: 0, dontKnow: 0, skipped: 0 };
      row.answered += 1;
      if (e.result === 'correct') row.correct += 1;
      else if (e.result === 'almost') row.almost += 1;
      else if (e.result === 'wrong') row.wrong += 1;
      else if (e.result === 'dont_know') row.dontKnow += 1;
      else row.skipped += 1;
      map.set(topicId, row);
    }
  }
  return [...map.values()].sort((a, b) => b.answered - a.answered || (a.topicId < b.topicId ? -1 : 1));
}

function masteryChanges(topicIds, before, after) {
  const index = (rows) => {
    const m = new Map();
    for (const r of list(rows)) if (isObj(r) && typeof r.topicId === 'string' && fin(r.pct) !== null) m.set(r.topicId, r);
    return m;
  };
  const b = index(before);
  const a = index(after);
  const rank = { new: 0, up: 1, same: 2, down: 3 };
  const changes = [];
  for (const topicId of topicIds) {
    const now = a.get(topicId);
    if (!now) continue;
    const was = b.get(topicId);
    const afterPct = Math.max(0, Math.min(100, Math.round(now.pct)));
    const beforePct = was ? Math.max(0, Math.min(100, Math.round(was.pct))) : null;
    const delta = beforePct === null ? null : afterPct - beforePct;
    const direction = delta === null ? 'new' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'same'; // delta es resta de enteros ya redondeados
    changes.push({
      topicId, before: beforePct, after: afterPct, delta, direction,
      band: str(now.band), confidence: CONFIDENCE.has(now.confidence) ? now.confidence : null, lowEvidence: now.lowEvidence === true,
    });
  }
  changes.sort((x, y) => rank[x.direction] - rank[y.direction] || (y.delta ?? 0) - (x.delta ?? 0) || (x.topicId < y.topicId ? -1 : 1));
  return {
    changes, improved: changes.filter((c) => c.direction === 'up').length,
    declined: changes.filter((c) => c.direction === 'down').length, newTopics: changes.filter((c) => c.direction === 'new').length,
  };
}

function sessionErrors(records, answers, catalog) {
  // ts de cada respuesta de la sesión, por ítem: así se reconoce una ocurrencia que es de esta sesión.
  const tsByItem = new Map();
  for (const e of answers) {
    if (typeof e.itemId !== 'string' || typeof e.ts !== 'string') continue;
    if (!tsByItem.has(e.itemId)) tsByItem.set(e.itemId, new Set());
    tsByItem.get(e.itemId).add(e.ts);
  }
  const fresh = [];
  const recurrent = [];
  const used = new Set();
  for (const r of list(records)) {
    if (!isObj(r) || typeof r.id !== 'string' || used.has(r.id) || typeof r.code !== 'string') continue;
    const stamps = typeof r.itemId === 'string' ? tsByItem.get(r.itemId) : undefined;
    if (!stamps) continue;
    const times = new Set(textList(r.seen).filter((t) => stamps.has(t))).size;
    if (times === 0) continue;
    used.add(r.id);
    const count = Number.isInteger(r.count) && r.count >= times ? r.count : times;
    const priorCount = count - times;
    let meta = null;
    try { meta = catalog && typeof catalog.get === 'function' ? catalog.get(r.code) : null; } catch { meta = null; }
    const entry = {
      id: r.id, code: r.code, title: str(meta?.titulo_es), hint: str(meta?.pista_corta_es),
      original: str(r.original) ?? '', correction: str(r.correction), topics: textList(r.topics),
      kind: r.kind === 'systematic' ? 'systematic' : 'slip', times, priorCount, count, itemId: r.itemId,
    };
    (priorCount === 0 ? fresh : recurrent).push(entry);
  }
  const order = (a, b) => b.times - a.times || (a.kind === b.kind ? 0 : a.kind === 'systematic' ? -1 : 1) || (a.id < b.id ? -1 : 1);
  fresh.sort(order); recurrent.sort(order);
  return { fresh, recurrent, total: fresh.length + recurrent.length };
}

function nextReviews(answers, cards, now) {
  const cardIds = [];
  const itemOf = new Map();
  for (const e of answers) {
    if (typeof e.cardId !== 'string' || e.cardId === '' || itemOf.has(e.cardId)) continue;
    itemOf.set(e.cardId, typeof e.itemId === 'string' ? e.itemId : null);
    cardIds.push(e.cardId);
  }
  const byId = new Map();
  for (const c of list(cards)) if (isObj(c) && typeof c.id === 'string') byId.set(c.id, c);
  const groups = { today: 0, tomorrow: 0, week: 0, later: 0 };
  const items = [];
  let unknown = 0;
  let today = null;
  if (now !== null) { try { today = localDay(now); } catch { today = null; } }
  for (const cardId of cardIds) {
    let dueDay = null;
    let dueMs = null;
    const card = byId.get(cardId);
    if (card && typeof card.due === 'string') { try { const d = toDate(card.due); dueMs = d.getTime(); dueDay = localDay(d); } catch { dueDay = null; } }
    if (today === null || dueDay === null || !DAY_RE.test(dueDay)) { unknown += 1; continue; }
    const days = Math.max(0, dayNumber(dueDay) - dayNumber(today));
    const bucket = days === 0 ? 'today' : days === 1 ? 'tomorrow' : days <= 7 ? 'week' : 'later';
    groups[bucket] += 1;
    items.push({ cardId, itemId: itemOf.get(cardId), due: card.due, days, bucket, _ms: dueMs });
  }
  items.sort((a, b) => a._ms - b._ms || (a.cardId < b.cardId ? -1 : 1));
  for (const it of items) delete it._ms;
  return { items, groups, unknown, earliest: items.length > 0 ? items[0].due : null };
}

function build(input) {
  const state = isObj(input.state) ? input.state : null;
  const sessionId = str(input.sessionId);
  const answers = sessionAnswers(input.events, sessionId);
  const out = empty(state);
  out.sessionId = sessionId;
  out.answered = answers.length;
  out.empty = answers.length === 0;
  const c = out.counts;
  for (const e of answers) {
    if (e.result === 'correct') c.correct += 1;
    else if (e.result === 'almost') c.almost += 1;
    else if (e.result === 'wrong') c.wrong += 1;
    else if (e.result === 'dont_know') c.dontKnow += 1;
    else c.skipped += 1;
  }
  if (answers.length > 0) {
    out.accuracy = c.correct / answers.length;
    out.accuracyPct = Math.round(out.accuracy * 100);
  }
  // Tiempo: solo cuentan los `ms` finitos y no negativos; lo demás no inventa tiempo.
  let ms = 0; let counted = 0;
  for (const e of answers) { const v = fin(e.ms); if (v !== null && v >= 0) { ms += Math.min(v, MS_MAX); counted += 1; } }
  out.time = { ms, avgMs: counted > 0 ? Math.round(ms / counted) : null, counted };
  // Lo planeado y lo pendiente salen del estado; sin estado, lo planeado es lo respondido.
  const stateAnswers = state ? list(state.answers) : [];
  out.planned = state && Number.isInteger(state.total) && state.total >= 0 ? Math.max(state.total, answers.length) : answers.length;
  const reached = state ? Math.max(stateAnswers.length, answers.length) : answers.length;
  out.pending = Math.max(0, out.planned - reached);
  const stateSkipped = stateAnswers.filter((a) => isObj(a) && a.result === 'skipped').length;
  out.skippedWithoutEvent = state ? Math.max(0, stateSkipped - c.skipped) : 0;
  out.partial = !out.empty && (out.ended === 'quit' || out.pending > 0);
  out.byTopic = countTopics(answers);
  out.mastery = masteryChanges(out.byTopic.map((t) => t.topicId), input.masteryBefore, input.masteryAfter);
  out.errors = sessionErrors(input.errors, answers, input.catalog);
  let now = null;
  if (input.now !== undefined && input.now !== null) { try { now = toDate(input.now); } catch { now = null; } }
  if (now === null) { for (const e of answers) { try { const d = toDate(e.ts); if (now === null || d > now) now = d; } catch { /* ts ilegible: no sirve de reloj */ } } }
  out.nextReviews = nextReviews(answers, input.cards, now);
  // Fallos: la ÚLTIMA respuesta de cada tarjeta decide (una tarjeta repetida y acertada ya no es fallo).
  const last = new Map();
  for (const e of answers) { if (typeof e.cardId === 'string' && e.cardId !== '') last.set(e.cardId, e); }
  out.failed = [...last.values()].filter((e) => e.result === 'wrong' || e.result === 'dont_know')
    .map((e) => ({ cardId: e.cardId, itemId: typeof e.itemId === 'string' ? e.itemId : null, result: e.result }));
  return out;
}

export function buildSessionSummary(input) {
  try {
    return deepFreeze(build(isObj(input) ? input : {}));
  } catch {
    // Un resumen roto no debe romper la pantalla de cierre: se devuelve vacío y marcado. Ni lo lanzado ni `state` se vuelven a leer: podrían ser hostiles.
    const out = empty(null);
    out.degraded = true;
    return deepFreeze(out);
  }
}
