// @purpose: Puente de calificación: convierte respuesta y tiempo en rating, tarjeta nueva y evento listos para guardar (no guarda nada).
// Puente de calificación (subparte 1.5, cuarto 3, mitad B). Une lo que ya existe y NO guarda nada:
//   respuesta + tiempo  →  rating 1..4 (core/grading.js)  →  tarjeta nueva (srs.review)  +  evento 8.6 listo para events.log.
// Puro: sin DOM, sin base de datos, sin reloj ni azar (todo llega por parámetro). Quien lo llama (el ejecutor de sesión, 2.1)
// guarda el resultado: PRIMERO events.log(result.event) y DESPUÉS db.put('cards', result.card) (si falla lo segundo, queda el
// evento —que es la verdad— y la tarjeta se recalcula; al revés, una tarjeta cambiada sin evento no tiene explicación).
//
//   gradeAnswer({ answer, card, srs, now, exerciseType, baselineMs?, baselines?, sessionId?, topics?, mode?, channel? }) → GradeResult
//     answer  { result, ms?, hint?, dontKnow?, interrupted?, responseRaw?, errorCodes? }
//             result ∈ correct | almost | wrong | skipped | dont_know (lo que devuelve compare de 1.2 o el ejercicio);
//             ms e interrupted salen de createAnswerTimer().stop() (1.5-3A). `dontKnow: true` gana sobre `result` (y al revés).
//     card    tarjeta 8.4 (no se modifica).      srs   createSrs({ settings }) de core/srsEngine.js (o algo con review/dueLabel).
//     now     Date (core/clock.js).              exerciseType   tipo del ítem (8.9); lo exige el evento 8.6.
//     baselineMs  mediana en ms (loadBaselines(...).forType(t).ms). Si falta, `baselines.forType(exerciseType).ms`; si tampoco,
//                 la constante por tipo (defaultBaselineMs). topics: por defecto los de la tarjeta. mode 'mech'; channel 'keyboard'.
//   gradeManual({ rating, card, srs, now, exerciseType, sessionId?, topics?, mode?, channel? }) → GradeResult
//     Tarjetas de recuerdo libre SIN verificación (la persona se califica con los 4 botones): rating 1..4 directo, SIN pasar por rate.
//
//   GradeResult = { rating, reason, time, event, card, scheduled, notScheduled, dueLabel }
//     rating/reason/time  lo que decidió rateDetailed (en gradeManual: reason 'manual_<nombre>', time null).
//     event      objeto válido para events.log (type 'answer', cardId, itemId, topics, exerciseType, result, rating, ms, hint, dontKnow,
//                responseRaw, errorCodes, mode, channel, ts = now). Sin id ni day: los asigna log().
//                Si la tarjeta aún no vencía (repaso adelantado, 2.1-T2) trae además `early: true`; en cualquier otro caso el campo no existe.
//     card       la tarjeta siguiente (copia) si se programó; si no, una copia SIN cambios.
//     scheduled  true si srs.review programó la tarjeta. false si no se pudo (tarjeta suspendida o sanguijuela, o datos de la
//                tarjeta dañados): la respuesta NO se pierde (el evento sale igual) y notScheduled = { code, message } dice por qué.
//     dueLabel   «Repaso en 4 d…» de la tarjeta nueva (null si no se programó o el motor no sabe decirlo).
// Entradas inválidas (falta srs/card/now/exerciseType, result raro, rating fuera de 1–4…) lanzan Error en español; un evento que no
// pasa validateEvent lanza EventError. En ambos casos NO se llama a review: o sale todo o no sale nada.
import { rateDetailed, defaultBaselineMs, RATING } from './grading.js';
import { validateEvent, EventError, RESULTS, LIMITS } from './eventSchema.js';
import { toDate, toIso } from './clock.js';
import { earlyInfo } from './earlyReview.js';

const RATING_NAME = Object.freeze({ 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' });
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isPosNum = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;

function need(cond, message) { if (!cond) throw new Error(`gradeAnswer: ${message}`); }

// Comprobaciones comunes. Devuelve { nowDate, topics, mode, channel }.
function readContext(args, defaultChannel) {
  need(isObj(args), 'se necesita un objeto de opciones');
  const { card, srs, now, exerciseType } = args;
  need(isObj(card) && typeof card.id === 'string' && typeof card.itemId === 'string', 'falta la tarjeta (con id e itemId)');
  need(isObj(srs) && typeof srs.review === 'function', 'falta el motor de repaso (createSrs de core/srsEngine.js)');
  need(typeof exerciseType === 'string' && exerciseType !== '', 'falta exerciseType (el tipo del ejercicio)');
  let nowDate;
  try { nowDate = toDate(now); } catch { need(false, '`now` debe ser una fecha válida'); }
  const topics = args.topics === undefined || args.topics === null ? (Array.isArray(card.topics) ? card.topics : []) : args.topics;
  need(Array.isArray(topics), 'topics debe ser una lista de temas');
  return { nowDate, topics, mode: args.mode ?? 'mech', channel: args.channel ?? defaultChannel };
}

// Programa la tarjeta SIN dejar que un fallo del motor pierda la respuesta.
function schedule(srs, card, rating, nowDate) {
  if (card.suspended === true) {
    return { card: { ...card }, scheduled: false, dueLabel: null,
      notScheduled: { code: 'SUSPENDED', message: card.leech === true ? 'la tarjeta es una sanguijuela (suspendida): se guardó la respuesta, pero no se reprograma' : 'la tarjeta está suspendida: se guardó la respuesta, pero no se reprograma' } };
  }
  let next;
  try {
    next = srs.review(card, rating, nowDate);
  } catch (e) {
    return { card: { ...card }, scheduled: false, dueLabel: null,
      notScheduled: { code: 'REVIEW_FAILED', message: `no se pudo reprogramar la tarjeta (${e && e.message ? e.message : 'error desconocido'}): se guardó la respuesta` } };
  }
  let dueLabel = null;
  if (typeof srs.dueLabel === 'function') { try { dueLabel = srs.dueLabel(next, nowDate); } catch { dueLabel = null; } }
  return { card: next, scheduled: true, dueLabel, notScheduled: null };
}

// Repaso adelantado (2.1-T2): `early: true` solo si la tarjeta ya tiene historia y aún no vence; si no, no se añade nada al evento.
const earlyFlag = (card, nowDate) => (earlyInfo(card, nowDate).early ? { early: true } : {});

// Valida el evento ANTES de tocar la tarjeta (todo o nada).
function checkedEvent(ev) {
  const v = validateEvent(ev);
  if (!v.ok) throw new EventError(v.problems);
  return v.value;
}

export function gradeAnswer(args) {
  const { nowDate, topics, mode, channel } = readContext(args, 'keyboard');
  const { answer, card, srs, exerciseType } = args;
  need(isObj(answer), 'falta la respuesta ({ result, ms, hint, dontKnow })');
  need(typeof answer.result === 'string' && RESULTS.includes(answer.result), `result debe ser uno de: ${RESULTS.join(', ')}`);
  for (const k of ['hint', 'dontKnow', 'interrupted']) {
    need(answer[k] === undefined || answer[k] === null || typeof answer[k] === 'boolean', `${k} debe ser verdadero o falso`);
  }
  const hint = answer.hint === true;
  // «No sé» gana siempre: el evento exige que result y dontKnow coincidan.
  const dontKnow = answer.dontKnow === true || answer.result === 'dont_know';
  const result = dontKnow ? 'dont_know' : answer.result;

  let baselineMs = args.baselineMs;
  if (baselineMs === undefined || baselineMs === null) {
    const b = args.baselines && typeof args.baselines.forType === 'function' ? args.baselines.forType(exerciseType) : null;
    baselineMs = b && isPosNum(b.ms) ? b.ms : defaultBaselineMs(exerciseType);
  }
  need(isPosNum(baselineMs), 'baselineMs debe ser un número mayor que 0');

  const decision = rateDetailed({ result, ms: answer.ms, hint, dontKnow, interrupted: answer.interrupted === true }, baselineMs);
  const msOk = typeof answer.ms === 'number' && Number.isFinite(answer.ms) && answer.ms >= 0;
  const event = checkedEvent({
    type: 'answer', ts: toIso(nowDate), sessionId: args.sessionId ?? null,
    cardId: card.id, itemId: card.itemId, topics, exerciseType,
    result, rating: decision.rating, ms: msOk ? Math.min(answer.ms, LIMITS.msMax) : null, hint, dontKnow,
    responseRaw: answer.responseRaw ?? null, errorCodes: answer.errorCodes ?? [], mode, channel,
    ...earlyFlag(card, nowDate),
  });
  return { rating: decision.rating, reason: decision.reason, time: decision.time, event, ...schedule(srs, card, decision.rating, nowDate) };
}

export function gradeManual(args) {
  const { nowDate, topics, mode, channel } = readContext(args, 'tap');
  const { rating, card, srs, exerciseType } = args;
  need(Number.isInteger(rating) && rating >= RATING.again && rating <= RATING.easy, 'rating debe ser un entero de 1 a 4');
  // Sin verificación no hay «correcto» objetivo: Otra vez = no lo recordó (wrong); Difícil/Bien/Fácil = lo recordó (correct).
  // `ms` va vacío a propósito: el tiempo hasta pulsar un botón no es tiempo de respuesta y no debe entrar en la mediana personal.
  const event = checkedEvent({
    type: 'answer', ts: toIso(nowDate), sessionId: args.sessionId ?? null,
    cardId: card.id, itemId: card.itemId, topics, exerciseType,
    result: rating === RATING.again ? 'wrong' : 'correct', rating, ms: null, hint: false, dontKnow: false,
    responseRaw: null, errorCodes: [], mode, channel,
    ...earlyFlag(card, nowDate),
  });
  return { rating, reason: `manual_${RATING_NAME[rating]}`, time: null, event, ...schedule(srs, card, rating, nowDate) };
}
