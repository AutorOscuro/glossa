// @purpose: Modo rescate: con muchas tarjetas vencidas, elige solo las más urgentes del día.
// Modo rescate (subparte 1.4, cuarto 3): si hay muchas tarjetas vencidas, hoy se estudian solo las más
// urgentes (menor retrievabilidad) y el resto espera, sin culpa. La retrievabilidad se INYECTA
// (`opts.retrievability(card, now)`): el cuarto 2 pasa `srs.retrievability`.
import { toDate } from './clock.js';

// Reglas del Administrador (2026-10-20): las cifras dependen del tope diario de repasos.
//   se activa cuando las vencidas superan  activation × tope diario  (por defecto 1,5 × 100 = más de 150)
//   en rescate, el cupo del día es         quota × tope diario       (por defecto 0,5 × 100 = 50)
// Los dos factores viven SOLO aquí (RESCUE_FACTORS); nada más en el código usa 1,5 ni 0,5.
export const DEFAULT_DAILY_REVIEW_CAP = 100;
export const RESCUE_FACTORS = Object.freeze({ activation: 1.5, quota: 0.5 });

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Vencida = ya vista (state ≠ 0), no suspendida, con `due` ≤ now. Las nuevas no cuentan como atraso.
export function overdueCards(cards, now) {
  if (!Array.isArray(cards)) throw new Error('overdueCards: se necesita una lista de tarjetas');
  const t = toDate(now).getTime();
  return cards.filter((c) => c && c.state !== 0 && c.suspended !== true && c.leech !== true && new Date(c.due).getTime() <= t);
}

// opts: { dailyCap = 100, factors = RESCUE_FACTORS, retrievability }  (retrievability es obligatoria)
export function rescuePlan(cards, now, opts = {}) {
  const { dailyCap = DEFAULT_DAILY_REVIEW_CAP, factors = RESCUE_FACTORS, retrievability } = opts;
  if (!Number.isInteger(dailyCap) || dailyCap < 1) throw new Error('rescuePlan: dailyCap debe ser un entero ≥ 1');
  const okNum = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
  if (!factors || !okNum(factors.activation) || !okNum(factors.quota) || factors.quota > 1) {
    throw new Error('rescuePlan: factors.activation debe ser > 0 y factors.quota debe estar en (0, 1]');
  }
  if (typeof retrievability !== 'function') throw new Error('rescuePlan: falta opts.retrievability(card, now)');
  const threshold = factors.activation * dailyCap;
  const quota = Math.max(1, Math.floor(factors.quota * dailyCap));
  const overdue = overdueCards(cards, now);
  const active = overdue.length > threshold;
  // Un valor no numérico cuenta como 0 (lo más urgente): ante la duda, mejor repasar que dejar pasar.
  const r = (c) => { const v = retrievability(c, now); return Number.isFinite(v) ? v : 0; };
  const keyed = overdue.map((c) => ({ c, r: active ? r(c) : 0 }));
  keyed.sort((a, b) => (active ? a.r - b.r : 0) || cmp(a.c.due, b.c.due) || cmp(a.c.id, b.c.id));
  const queue = keyed.map((k) => k.c);
  const today = active ? queue.slice(0, quota) : queue;
  const postponed = queue.length - today.length;
  return {
    active, overdueCount: overdue.length, threshold, quota, queue, today, postponed,
    message_es: active
      ? `Tienes ${overdue.length} repasos pendientes. Hoy haremos los ${today.length} más importantes; el resto puede esperar sin problema.`
      : null,
  };
}
