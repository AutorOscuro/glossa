// @purpose: Calificación por acierto y tiempo: traduce resultado, tiempo y pista a los 4 niveles de FSRS (puro).
// Calificación por acierto + tiempo (subparte 1.5, cuarto 1): traduce resultado + tiempo + pista a los 4 niveles de FSRS.
// Puro: sin DOM, sin base de datos, sin reloj ni azar. Los números están en core/grading.config.js.
//
//   rate({ result, ms, hint, dontKnow, interrupted }, baselineMs, config?) → 1 | 2 | 3 | 4        (contrato 8.15)
//   rateDetailed(…mismos argumentos…) → { rating, reason, time }     reason: por qué; time: cómo se leyó el tiempo
//   timeClass(ms, baselineMs, interrupted?, config?) → { cls: 'fast'|'normal'|'slow'|'ignored', why? }
//   defaultBaselineMs(exerciseType) → ms     (constante por tipo, mientras no haya mediana personal)
//   validateConfig(config) → { ok, problems }
//
// Reglas (roadmap 1.5):
//   Again(1): wrong, dont_know, skipped, o dontKnow=true (SIEMPRE, aunque venga con pista o rápido).
//   Hard(2):  almost; o correcto con pista; o correcto y más de slowFactor × mediana.
//   Good(3):  correcto en rango normal, o con el tiempo ignorado (distracción, pestaña oculta, tiempo ilegible).
//   Easy(4):  correcto, sin pista y menos de fastFactor × mediana.
// Un tiempo ignorado NUNCA baja el rating (queda en Good): no se castiga una distracción.
import { RESULTS } from './eventSchema.js';
import { typeInfo } from './contentTypes.js';
import { GRADING, FAMILY_BASELINE_MS, TYPE_BASELINE_MS } from './grading.config.js';

export const RATING = Object.freeze({ again: 1, hard: 2, good: 3, easy: 4 });

const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isPosNum = (v) => isNum(v) && v > 0;

export function validateConfig(config) {
  const problems = [];
  const c = config;
  if (!c || typeof c !== 'object') return { ok: false, problems: ['la configuración debe ser un objeto'] };
  for (const k of ['slowFactor', 'fastFactor', 'ignoreFactor']) if (!isPosNum(c[k])) problems.push(`${k} debe ser un número mayor que 0`);
  if (!problems.length) {
    if (!(c.fastFactor < 1)) problems.push('fastFactor debe ser menor que 1');
    if (!(c.slowFactor > 1)) problems.push('slowFactor debe ser mayor que 1');
    if (!(c.ignoreFactor > c.slowFactor)) problems.push('ignoreFactor debe ser mayor que slowFactor');
  }
  for (const k of ['minSamples', 'window', 'lookbackDays']) if (!Number.isInteger(c[k]) || c[k] < 1) problems.push(`${k} debe ser un entero ≥ 1`);
  if (Number.isInteger(c.minSamples) && Number.isInteger(c.window) && c.minSamples > c.window) problems.push('minSamples no puede superar window');
  if (!isNum(c.interruptAfterHiddenMs) || c.interruptAfterHiddenMs < 0) problems.push('interruptAfterHiddenMs debe ser un número ≥ 0');
  if (!isPosNum(c.fallbackBaselineMs)) problems.push('fallbackBaselineMs debe ser un número mayor que 0');
  return { ok: problems.length === 0, problems };
}

function checkedConfig(config) {
  const v = validateConfig(config);
  if (!v.ok) throw new Error(`grading: configuración no válida: ${v.problems.join('; ')}`);
  return config;
}

export function defaultBaselineMs(exerciseType, config = GRADING) {
  if (typeof exerciseType === 'string') {
    if (own(TYPE_BASELINE_MS, exerciseType)) return TYPE_BASELINE_MS[exerciseType];
    const info = typeInfo(exerciseType);
    if (info && own(FAMILY_BASELINE_MS, info.family)) return FAMILY_BASELINE_MS[info.family];
  }
  return config.fallbackBaselineMs;
}

// Cómo se lee el tiempo de una respuesta correcta. Nunca lanza: un tiempo o una mediana ilegibles se ignoran.
export function timeClass(ms, baselineMs, interrupted = false, config = GRADING) {
  if (interrupted === true) return { cls: 'ignored', why: 'interrupted' };
  if (!isPosNum(ms)) return { cls: 'ignored', why: 'unknown_time' };
  if (!isPosNum(baselineMs)) return { cls: 'ignored', why: 'no_baseline' };
  if (ms > config.ignoreFactor * baselineMs) return { cls: 'ignored', why: 'extreme' };
  if (ms > config.slowFactor * baselineMs) return { cls: 'slow' };
  if (ms < config.fastFactor * baselineMs) return { cls: 'fast' };
  return { cls: 'normal' };
}

function readInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('grading: se necesita un objeto { result, ms, hint, dontKnow }');
  const { result, ms, hint, dontKnow, interrupted } = input;
  if (typeof result !== 'string' || !RESULTS.includes(result)) throw new Error(`grading: result debe ser uno de: ${RESULTS.join(', ')}`);
  for (const [k, v] of [['hint', hint], ['dontKnow', dontKnow], ['interrupted', interrupted]]) {
    if (v !== undefined && v !== null && typeof v !== 'boolean') throw new Error(`grading: ${k} debe ser verdadero o falso`);
  }
  return { result, ms, hint: hint === true, dontKnow: dontKnow === true, interrupted: interrupted === true };
}

export function rateDetailed(input, baselineMs, config = GRADING) {
  const cfg = checkedConfig(config);
  const { result, ms, hint, dontKnow, interrupted } = readInput(input);

  if (dontKnow || result === 'dont_know') return { rating: RATING.again, reason: 'again_dont_know', time: null };
  if (result === 'wrong') return { rating: RATING.again, reason: 'again_wrong', time: null };
  if (result === 'skipped') return { rating: RATING.again, reason: 'again_skipped', time: null };

  const time = timeClass(ms, baselineMs, interrupted, cfg);
  if (result === 'almost') return { rating: RATING.hard, reason: 'hard_almost', time };
  if (hint) return { rating: RATING.hard, reason: 'hard_hint', time };
  if (time.cls === 'slow') return { rating: RATING.hard, reason: 'hard_slow', time };
  if (time.cls === 'fast') return { rating: RATING.easy, reason: 'easy_fast', time };
  if (time.cls === 'ignored') return { rating: RATING.good, reason: 'good_time_ignored', time };
  return { rating: RATING.good, reason: 'good_normal', time };
}

export function rate(input, baselineMs, config = GRADING) {
  return rateDetailed(input, baselineMs, config).rating;
}
