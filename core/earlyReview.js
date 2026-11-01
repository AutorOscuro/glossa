// @purpose: Repasos adelantados (tarjetas que aún no vencen): detecta el adelanto y garantiza que un fallo en menos de 24 h reinicie la tarjeta.
// Repasos adelantados (subparte 2.1, tramo 2). Roadmap 17: los ítems `practice` y `error` no vencidos pasan por `srs.review` normal;
// un acierto adelantado no alarga más de lo normal y un fallo reinicia.
//
// Medido con el motor real (FSRS): hard, good y easy ya cumplen sin tocar nada (el intervalo crece con el tiempo transcurrido, así que
// adelantado nunca alarga más que a tiempo). Un fallo a partir de 24 h del último repaso también reinicia (intervalo corto). Pero un
// fallo en MENOS de 24 h del último repaso usa la fórmula «del mismo día» de FSRS: una tarjeta madura solo se encogía (46 días → 13).
// Esta capa arregla solo ese caso y deja el resto intacto.
//
//   earlyInfo(card, now) → { early, daysEarly }   early = la tarjeta ya tiene historia y su `due` es posterior a `now`; daysEarly = días que
//                                                  faltaban (redondeados a 2 decimales; 0 si no es adelantada). Sin lanzar: datos raros → false.
//   withEarlyReview(srs) → objeto congelado igual que `srs` pero con `review` y `previewIntervals` protegidos.
//     review(card, rating, now): igual que srs.review salvo si es un 'again' adelantado con menos de 24 h desde `last_review` (y el motor es
//       FSRS): se calcula como si hubieran pasado 24 h y el resultado se desplaza para que `due` sea ese intervalo contado desde `now` y
//       `last_review` sea `now`. Los demás casos (otros ratings, ≥ 24 h, a tiempo, tarjeta nueva, motor simple, reloj hacia atrás) delegan tal cual.
//     previewIntervals(card, now): igual, con la entrada `again` ya protegida (así lo que se muestra es lo que se guarda).
import { toDate, toIso } from './clock.js';
import { parseRating } from './srsValid.js';

export const DAY_MS = 24 * 60 * 60 * 1000;
const AGAIN = 1;

function times(card, now) {
  try {
    const n = toDate(now).getTime();
    const due = Date.parse(card?.due);
    const last = Date.parse(card?.last_review);
    if (!Number.isFinite(last)) return null; // due o now ilegibles dan NaN y las comparaciones de abajo salen falsas
    return { n, due, last };
  } catch { return null; }
}

export function earlyInfo(card, now) {
  const t = times(card, now);
  if (!t || card.state === 0 || !(t.due > t.n)) return { early: false, daysEarly: 0 };
  return { early: true, daysEarly: Math.round(((t.due - t.n) / DAY_MS) * 100) / 100 };
}

function needsGuard(srs, card, rating, now) {
  let r;
  try { r = parseRating(rating); } catch { return null; }
  if (r !== AGAIN) return null;
  if (typeof srs.engine === 'function' && srs.engine() !== 'fsrs') return null;
  const t = times(card, now);
  if (!t || card.state === 0 || !(t.due > t.n)) return null;
  const elapsed = t.n - t.last;
  if (elapsed < 0 || elapsed >= DAY_MS) return null;
  return t;
}

export function withEarlyReview(srs) {
  if (!srs || typeof srs.review !== 'function') throw new Error('withEarlyReview: falta srs.review');
  const review = (card, rating, now, ...rest) => {
    const t = needsGuard(srs, card, rating, now);
    if (!t) return srs.review(card, rating, now, ...rest);
    const virtual = t.last + DAY_MS;
    const next = srs.review(card, rating, new Date(virtual), ...rest);
    const shift = t.n - virtual;
    return { ...next, due: toIso(new Date(Date.parse(next.due) + shift)), last_review: toIso(new Date(t.n)) };
  };
  const previewIntervals = typeof srs.previewIntervals === 'function'
    ? (card, now) => {
      const out = srs.previewIntervals(card, now);
      if (!needsGuard(srs, card, 'again', now)) return out;
      const again = review({ ...card, suspended: false }, 'again', now);
      return { ...out, again: { due: again.due, label: typeof srs.dueLabel === 'function' ? srs.dueLabel(again, now) : out.again?.label } };
    }
    : undefined;
  return Object.freeze({ ...srs, review, ...(previewIntervals ? { previewIntervals } : {}) });
}
