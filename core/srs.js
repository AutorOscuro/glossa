// @purpose: Motor de repaso espaciado sobre FSRS: tarjetas nuevas, repaso, retrievabilidad y niveles; reexporta sanguijuelas y rescate.
// Motor de repaso espaciado (subparte 1.4, cuarto 1). Piezas que NO dependen de ts-fsrs:
//   newCard(itemId, facet, now, topics?) · levelOf(card) · dueLabel(card, now) · LEVEL_CUTS_DAYS
// Cuarto 3 (reexportado abajo): sanguijuelas (srsLeech.js) y modo rescate (srsRescue.js).
// Cuarto 2: `review`, `retrievability`, `previewIntervals` sobre vendor/ts-fsrs (FSRS-6), sin azar ni reloj ocultos.
// Sin Date.now() ni Math.random(): todo recibe `now` (Date) y lo guardado son cadenas ISO UTC.
import { toDate, toIso } from './clock.js';
import * as ts from '../vendor/ts-fsrs/index.mjs';
import { markLeech, DEFAULT_LEECH_THRESHOLD } from './srsLeech.js';
import { parseCard, parseRating, RATING_NAMES } from './srsValid.js';

export { DEFAULT_LEECH_THRESHOLD, isLeech, markLeech, releaseLeech, leechList } from './srsLeech.js';
export { DEFAULT_DAILY_REVIEW_CAP, RESCUE_FACTORS, overdueCards, rescuePlan } from './srsRescue.js';

const MS_MIN = 60000;
const MS_HOUR = 3600000;
const MS_DAY = 86400000;

// Cortes del nivel visible 1–5 por estabilidad en días (roadmap 8.4): L1 < 1 · L2 1–<4 · L3 4–<21 · L4 21–<90 · L5 ≥ 90.
export const LEVEL_CUTS_DAYS = Object.freeze([1, 4, 21, 90]);

// Tarjeta nueva con los valores iniciales de 8.4. `facet` 0=presente/único, 1=pasado, 2=participio.
export function newCard(itemId, facet, now, topics = []) {
  if (typeof itemId !== 'string' || itemId.trim() === '') throw new Error('newCard: itemId debe ser un texto no vacío');
  const f = facet ?? 0;
  if (!Number.isInteger(f) || f < 0 || f > 2) throw new Error('newCard: facet debe ser 0, 1 o 2');
  if (!Array.isArray(topics) || topics.some((t) => typeof t !== 'string')) throw new Error('newCard: topics debe ser una lista de textos');
  const iso = toIso(now);
  return {
    id: `${itemId}#${f}`, itemId, facet: f, topics: [...topics],
    state: 0, due: iso, stability: 0, difficulty: 0, reps: 0, lapses: 0, last_review: null,
    suspended: false, leech: false, fav: false, created: iso,
  };
}

// Nivel visible 1–5 según la estabilidad (en días). Una estabilidad ausente, negativa o no numérica cuenta como nivel 1.
export function levelOf(card) {
  const s = card && typeof card === 'object' ? card.stability : undefined;
  if (typeof s !== 'number' || !Number.isFinite(s) || s < 0) return 1;
  let level = 1;
  for (const cut of LEVEL_CUTS_DAYS) { if (s >= cut) level += 1; }
  return level;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Etiqueta "Repaso en …" desde `due`. Vencida o justo ahora → "Repaso ahora".
// Tramos: < 1 h en minutos (mínimo 1 min) · < 1 d en horas · < 7 d en días · < 56 d en semanas · < 365 d en meses · luego años.
// Siempre se redondea hacia abajo (nunca promete más espera de la que hay), salvo el mínimo de 1 min.
export function dueLabel(card, now) {
  const due = toDate(card && card.due);
  const diff = due.getTime() - toDate(now).getTime();
  if (diff <= 0) return 'Repaso ahora';
  if (diff < MS_HOUR) return `Repaso en ${Math.max(1, Math.floor(diff / MS_MIN))} min`;
  if (diff < MS_DAY) return `Repaso en ${Math.floor(diff / MS_HOUR)} h`;
  const days = diff / MS_DAY;
  if (days < 7) return `Repaso en ${Math.floor(days)} d`;
  if (days < 56) return `Repaso en ${plural(Math.floor(days / 7), 'sem', 'sems')}`;
  if (days < 365) return `Repaso en ${plural(Math.max(1, Math.floor(days / 30.4375)), 'mes', 'meses')}`;
  return `Repaso en ${plural(Math.floor(days / 365.25) || 1, 'año', 'años')}`;
}

// ───────── Cuarto 2: planificador FSRS ─────────
export const RATING = Object.freeze({ AGAIN: 1, HARD: 2, GOOD: 3, EASY: 4 });
export const DEFAULT_RETENTION = 0.9;
export const RETENTION_MIN = 0.7; // el motor acepta 0,70–0,99; Ajustes (1.x) ofrecerá 0,80–0,95
export const RETENTION_MAX = 0.99;
export const FSRS_VERSION = ts.FSRSVersion;

// Sin pasos de aprendizaje en minutos: la tarjeta de 8.4 no guarda `learning_steps`, así que una tarjeta nueva
// pasa directa a repaso (state 2) con intervalo en días. La repetición dentro de la sesión la maneja la 1.8.
function makeFsrs(opts) {
  const retention = opts.retention ?? DEFAULT_RETENTION;
  if (typeof retention !== 'number' || !(retention >= RETENTION_MIN && retention <= RETENTION_MAX)) {
    throw new Error(`retención: debe estar entre ${RETENTION_MIN} y ${RETENTION_MAX}`);
  }
  const fuzz = opts.fuzz === true;
  if (fuzz && (typeof opts.seed !== 'string' || opts.seed === '')) throw new Error('fuzz: requiere opts.seed (texto) para ser reproducible');
  const f = ts.fsrs({ request_retention: retention, enable_fuzz: fuzz, learning_steps: [], relearning_steps: [] });
  if (fuzz) f.useStrategy(ts.StrategyMode.SEED, function seed() { return `${opts.seed}|${this.current.reps}|${this.review_time.getTime()}`; });
  return f;
}

// Tarjeta 8.4 → tarjeta de ts-fsrs.
function toFsrsCard(card, who) {
  const { due, last } = parseCard(card, who);
  return { due, stability: card.stability, difficulty: card.difficulty, elapsed_days: 0, scheduled_days: 0, learning_steps: 0,
    reps: card.reps, lapses: card.lapses, state: card.state, last_review: last };
}

function effectiveNow(fc, now) {
  const n = toDate(now);
  return fc.last_review && n < fc.last_review ? fc.last_review : n; // reloj hacia atrás: como si no hubiera pasado tiempo
}

function applyResult(card, res, leechThreshold) {
  const c = res.card;
  const out = { ...card, state: c.state, due: c.due.toISOString(), stability: c.stability, difficulty: c.difficulty,
    reps: c.reps, lapses: c.lapses, last_review: c.last_review.toISOString() };
  for (const k of ['stability', 'difficulty']) if (!Number.isFinite(out[k]) || out[k] < 0) throw new Error(`review: resultado inválido en ${k}`);
  return res.log.rating === RATING.AGAIN ? markLeech(out, leechThreshold) : out;
}

// review(card, rating, now, opts?) → tarjeta nueva (no muta). opts: { retention, fuzz, seed, leechThreshold }.
export function review(card, rating, now, opts = {}) {
  const r = parseRating(rating);
  if (card && card.suspended === true) throw new Error('review: la tarjeta está suspendida');
  const fc = toFsrsCard(card, 'review');
  if (fc.state !== 0 && !(fc.difficulty >= 1 && fc.stability > 0)) throw new Error(`review: una tarjeta con state ${fc.state} necesita difficulty ≥ 1 y stability > 0`);
  const at = effectiveNow(fc, now);
  const res = makeFsrs(opts).next(fc, at, r);
  return applyResult(card, res, opts.leechThreshold ?? DEFAULT_LEECH_THRESHOLD);
}

// Probabilidad de recordar ahora, en [0, 1]. Nueva → 0. Reloj hacia atrás → como justo tras el último repaso.
export function retrievability(card, now, opts = {}) {
  const fc = toFsrsCard(card, 'retrievability');
  if (fc.state === 0 || !(fc.stability > 0)) return 0;
  const v = makeFsrs(opts).get_retrievability(fc, effectiveNow(fc, now), false);
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}

// Qué pasaría con cada respuesta: { again, hard, good, easy } → { due, label }.
export function previewIntervals(card, now, opts = {}) {
  const out = {};
  for (const [name, r] of Object.entries(RATING_NAMES)) {
    const next = review({ ...card, suspended: false }, r, now, opts);
    out[name] = { due: next.due, label: dueLabel(next, effectiveNow(toFsrsCard(card, 'previewIntervals'), now)) };
  }
  return out;
}
