// @purpose: Señales R, P y E del dominio por tema: funciones puras sobre datos ya leídos.
// Señales del dominio por tema (subparte 1.7, tramo 1). Roadmap 8.7. Funciones PURAS: reciben los datos ya leídos, no tocan la base.
//   signalR(cards, now, { retrievability, lastResult?, config? }) → { value: 0..1 | null, cards: n, ignored, failed }
//     R = retención media de las tarjetas del tema con ≥ minReps repasos. `retrievability(card, now)` viene del motor SRS (core/srsEngine.js).
//     `lastResult(card)` (OPCIONAL) devuelve el último resultado calificado de la tarjeta; si fue `wrong` o `dont_know` (y `config.R.zeroAfterFail`), esa tarjeta aporta 0 (FIX 2.9-T4).
//     Sin tarjetas repasadas → value null (no hay evidencia de retención; T2 reparte el peso).
//   signalP(events, topicId, now, { config? }) → { value: 0..1 | null, attempts: n }
//     P = acierto ponderado por recencia en producción (escribir/hablar) del tema en los últimos windowDays días.
//     Cuentan los eventos `answer` del tema con ts en [now − ventana, now] y resultado correct/almost/wrong/dont_know; `skipped` no es un intento.
//   signalE(rows, { config? }) → { value: 0..1, codes: [{ code, inWindow, contribution }] }
//     `rows` es el resultado de errors.recurrent({ by: 'code', topic, now }) (decisión del Administrador, 1.6). Sin reincidencia → 0 (no null).
//   isProduction(exerciseType, config?) → boolean
// Nada de esto lanza por datos raros dentro de las listas: un elemento ilegible se ignora y se cuenta aparte (`ignored`). Una lista que no es lista, sí lanza.
import { toDate } from './clock.js';
import { typeInfo } from './contentTypes.js';
import { MASTERY_CONFIG, MS_PER_DAY } from './mastery.config.js';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const clamp01 = (n) => Math.min(1, Math.max(0, n));

function needList(list, name) {
  if (!Array.isArray(list)) throw new Error(`${name} debe ser una lista`);
}
function needNow(now) {
  try { return toDate(now).getTime(); } catch { throw new Error('now debe ser una fecha (Date, milisegundos o texto ISO)'); }
}

export function isProduction(exerciseType, config = MASTERY_CONFIG) {
  if (typeof exerciseType !== 'string') return false;
  if (config.P.extraTypes.includes(exerciseType)) return true;
  const info = typeInfo(exerciseType);
  return info !== null && config.P.families.includes(info.family);
}

const FAILED = new Set(['wrong', 'dont_know']);

export function signalR(cards, now, { retrievability, lastResult, config = MASTERY_CONFIG } = {}) {
  needList(cards, 'cards');
  if (typeof retrievability !== 'function') throw new Error('signalR: falta retrievability (la del motor SRS)');
  if (lastResult !== undefined && typeof lastResult !== 'function') throw new Error('signalR: lastResult debe ser una función');
  const nowMs = needNow(now);
  let sum = 0;
  let n = 0;
  let ignored = 0;
  let failed = 0;
  for (const card of cards) {
    if (!isObj(card) || !Number.isInteger(card.reps)) { ignored += 1; continue; }
    if (card.reps < config.R.minReps) continue;
    n += 1;
    if (config.R.zeroAfterFail && lastResult && FAILED.has(lastResult(card))) { failed += 1; continue; } // último intento fallido: R = 0 hasta que acierte
    const r = retrievability(card, new Date(nowMs));
    sum += Number.isFinite(r) ? clamp01(r) : 0;
  }
  return { value: n === 0 ? null : sum / n, cards: n, ignored, failed };
}

export function signalP(events, topicId, now, { config = MASTERY_CONFIG } = {}) {
  needList(events, 'events');
  if (typeof topicId !== 'string' || topicId === '') throw new Error('signalP: topicId debe ser un texto no vacío');
  const nowMs = needNow(now);
  const from = nowMs - config.P.windowDays * MS_PER_DAY;
  let num = 0;
  let den = 0;
  let attempts = 0;
  let ignored = 0;
  for (const ev of events) {
    if (!isObj(ev) || typeof ev.ts !== 'string') { ignored += 1; continue; }
    if (ev.type !== 'answer' || !Array.isArray(ev.topics) || !ev.topics.includes(topicId) || !isProduction(ev.exerciseType, config)) continue;
    const v = config.P.value[ev.result];
    if (v === undefined) continue; // skipped u otro resultado: no es un intento
    const t = Date.parse(ev.ts);
    if (!Number.isFinite(t)) { ignored += 1; continue; }
    if (t < from || t > nowMs) continue;
    const w = 0.5 ** ((nowMs - t) / MS_PER_DAY / config.P.halfLifeDays);
    num += w * v;
    den += w;
    attempts += 1;
  }
  return { value: den === 0 ? null : num / den, attempts, ignored };
}

export function signalE(rows, { config = MASTERY_CONFIG } = {}) {
  needList(rows, 'rows');
  const codes = [];
  let none = 1; // probabilidad de «ninguna reincidencia aporta»
  for (const row of rows) {
    if (!isObj(row) || typeof row.code !== 'string' || !Number.isInteger(row.inWindow) || row.inWindow < 3) continue;
    const contribution = clamp01((row.inWindow - 3 + 1) / config.E.stepsToFull);
    codes.push({ code: row.code, inWindow: row.inWindow, contribution });
    none *= 1 - contribution;
  }
  return { value: clamp01(1 - none), codes };
}
