// @purpose: Mediana personal de tiempo por tipo de ejercicio, calculada con los últimos eventos correctos.
// Mediana personal de tiempo por tipo de ejercicio (subparte 1.5, cuarto 2). Roadmap 1.5.
// "La mediana personal se calcula por exerciseType con los últimos 30 eventos correctos (mínimo 8; antes de eso se usan
// constantes por tipo)". Es la `baselineMs` que recibe `rate` (core/grading.js). Puro salvo `loadBaselines` (solo lee).
//
//   collectSamples(events, config?) → Map<exerciseType, ms[]>    las `window` muestras MÁS RECIENTES por tipo (más nueva primero)
//   baselineFor(exerciseType, events, config?) → { ms, source: 'personal' | 'default', samples }
//   loadBaselines({ events, now, config? }) → Promise<{ forType(t), types() }>    lee `events.since(now - lookbackDays)` una sola vez
//   medianOf(numbers) → número | null
//
// Qué cuenta como muestra: evento `answer` con `result: 'correct'`, SIN pista y sin "no sé", con `ms` finito y > 0.
// (Un "casi", un fallo o una respuesta con pista no representan el tiempo normal de acierto.) El evento no guarda si la
// pestaña estuvo oculta: el cronómetro del cuarto 3 ya descuenta esas pausas antes de guardar `ms`. Como la mediana es
// robusta, un tiempo raro aislado no la mueve; aun así se descarta lo imposible (≤ 0, no finito, más de 24 h).
// La fuente es 'personal' solo con ≥ `minSamples` muestras; si no, la constante de `defaultBaselineMs`.
import { GRADING } from './grading.config.js';
import { defaultBaselineMs, validateConfig } from './grading.js';
import { LIMITS } from './eventSchema.js';

const DAY_MS = 86400000;

function checked(config) {
  const v = validateConfig(config);
  if (!v.ok) throw new Error(`gradingBaseline: configuración no válida: ${v.problems.join('; ')}`);
  return config;
}

export function medianOf(numbers) {
  if (!Array.isArray(numbers)) throw new Error('medianOf: se necesita una lista');
  const v = numbers.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = v.length >> 1;
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

const isSample = (e) => e !== null && typeof e === 'object' && e.type === 'answer' && e.result === 'correct'
  && e.hint !== true && e.dontKnow !== true && typeof e.exerciseType === 'string' && e.exerciseType !== ''
  && typeof e.ts === 'string' && typeof e.ms === 'number' && Number.isFinite(e.ms) && e.ms > 0 && e.ms <= LIMITS.msMax;

// Más reciente primero: por `ts` y, si empatan, por `id` (el mismo orden de events.js, invertido).
const newestFirst = (a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : (a.id ?? '') < (b.id ?? '') ? 1 : (a.id ?? '') > (b.id ?? '') ? -1 : 0);

export function collectSamples(events, config = GRADING) {
  const cfg = checked(config);
  if (!Array.isArray(events)) throw new Error('gradingBaseline: se necesita una lista de eventos');
  const out = new Map();
  for (const e of events.filter(isSample).sort(newestFirst)) {
    const list = out.get(e.exerciseType);
    if (!list) out.set(e.exerciseType, [e.ms]);
    else if (list.length < cfg.window) list.push(e.ms);
  }
  return out;
}

function resolve(exerciseType, samples, cfg) {
  const n = samples ? samples.length : 0;
  if (n >= cfg.minSamples) {
    const m = medianOf(samples);
    if (m !== null && m > 0) return { ms: m, source: 'personal', samples: n };
  }
  return { ms: defaultBaselineMs(exerciseType, cfg), source: 'default', samples: n };
}

export function baselineFor(exerciseType, events, config = GRADING) {
  const cfg = checked(config);
  const all = collectSamples(events, cfg);
  return resolve(exerciseType, typeof exerciseType === 'string' ? all.get(exerciseType) : undefined, cfg);
}

export async function loadBaselines({ events, now, config = GRADING } = {}) {
  const cfg = checked(config);
  if (!events || typeof events.since !== 'function') throw new Error('loadBaselines: se necesita la API de eventos (core/events.js)');
  const nowDate = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(nowDate.getTime())) throw new Error('loadBaselines: `now` debe ser una fecha válida');
  const rows = await events.since(new Date(nowDate.getTime() - cfg.lookbackDays * DAY_MS));
  const all = collectSamples(rows, cfg);
  return Object.freeze({
    forType: (t) => resolve(t, typeof t === 'string' ? all.get(t) : undefined, cfg),
    types: () => [...all.keys()].sort(),
  });
}
