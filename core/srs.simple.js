// @purpose: Planificador de respaldo tipo Leitner, sin FSRS y con la misma interfaz que srs.js (solo para emergencias).
// Planificador SIMPLE de respaldo (subparte 1.4, cuarto 4): intervalos tipo Leitner, sin FSRS.
// Solo para emergencias (Ajustes → Repaso → Motor de repaso). Misma interfaz que core/srs.js:
//   newCard · review(card, rating, now, opts?) · retrievability(card, now) · previewIntervals(card, now) · levelOf · dueLabel
// Usa los MISMOS campos de la tarjeta 8.4, así se puede cambiar de motor en cualquier momento sin migrar nada:
//   `stability` = intervalo actual en días (la «caja»); `state` pasa a 2 tras el primer repaso; `difficulty` se conserva, pero
//   si valía < 1 (tarjeta nueva) se fija en 5 (neutra): FSRS exige 1–10 en una tarjeta ya vista y así puede retomarla.
// Sin Date.now() ni Math.random(). Ignora `opts.retention` y `opts.fuzz` (no los necesita).
import { toDate } from './clock.js';
import { markLeech, DEFAULT_LEECH_THRESHOLD } from './srsLeech.js';
import { parseCard, parseRating, RATING_NAMES } from './srsValid.js';
import { dueLabel } from './srs.js';

export { newCard, levelOf, dueLabel } from './srs.js';

const MS_DAY = 86400000;
// Cajas de Leitner: días hasta el siguiente repaso.
export const NEUTRAL_DIFFICULTY = 5;
export const LEITNER_DAYS = Object.freeze([1, 3, 7, 14, 30, 60, 120, 240]);

// Caja actual de una tarjeta: la más alta cuyo intervalo no supera la estabilidad guardada (admite tarjetas que vienen de FSRS).
function boxOf(card) {
  if (card.state === 0 || !(card.stability >= LEITNER_DAYS[0])) return 0;
  let box = 0;
  for (let i = 0; i < LEITNER_DAYS.length; i += 1) if (LEITNER_DAYS[i] <= card.stability) box = i;
  return box;
}

function effectiveNow(last, now) {
  const n = toDate(now);
  return last && n < last ? last : n; // reloj hacia atrás: como si no hubiera pasado tiempo
}

// Again → caja 1 · Hard → misma caja · Good → +1 caja · Easy → +2 cajas. Una tarjeta nueva: Again/Hard caja 1, Good caja 2, Easy caja 3.
function nextBox(card, rating) {
  const top = LEITNER_DAYS.length - 1;
  if (rating === 1) return 0;
  if (card.state === 0) return rating === 2 ? 0 : rating === 3 ? 1 : 2;
  const cur = boxOf(card);
  return Math.min(top, rating === 2 ? cur : cur + (rating === 3 ? 1 : 2));
}

export function review(card, rating, now, opts = {}) {
  const r = parseRating(rating);
  if (card && card.suspended === true) throw new Error('review: la tarjeta está suspendida');
  const { last } = parseCard(card, 'review');
  const at = effectiveNow(last, now);
  const days = LEITNER_DAYS[nextBox(card, r)];
  const out = {
    ...card, state: 2, due: new Date(at.getTime() + days * MS_DAY).toISOString(), stability: days,
    difficulty: card.difficulty >= 1 ? card.difficulty : NEUTRAL_DIFFICULTY,
    reps: card.reps + 1, lapses: card.lapses + (r === 1 && card.state !== 0 ? 1 : 0), last_review: at.toISOString(),
  };
  return r === 1 ? markLeech(out, opts.leechThreshold ?? DEFAULT_LEECH_THRESHOLD) : out;
}

// Probabilidad de recordar: 0,9 justo al cumplirse el intervalo y decreciente con el tiempo. Nueva → 0. Siempre en [0, 1].
export function retrievability(card, now) {
  const { last } = parseCard(card, 'retrievability');
  if (card.state === 0 || !(card.stability > 0)) return 0;
  const t = Math.max(0, (effectiveNow(last, now).getTime() - last.getTime()) / MS_DAY);
  const v = 0.9 ** (t / card.stability);
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}

export function previewIntervals(card, now, opts = {}) {
  const { last } = parseCard(card, 'previewIntervals');
  const out = {};
  for (const [name, r] of Object.entries(RATING_NAMES)) {
    const next = review({ ...card, suspended: false }, r, now, opts);
    out[name] = { due: next.due, label: dueLabel(next, effectiveNow(last, now)) };
  }
  return out;
}
