// @purpose: Fachada del motor de repaso: elige entre FSRS y el planificador simple según el ajuste srsEngine.
// Fachada del motor de repaso (subparte 1.4, cuarto 4): elige entre FSRS (normal) y el planificador simple (emergencia)
// según el ajuste `srsEngine`, y pasa a cada uno los ajustes vivos (retención, umbral de sanguijuela, tope diario).
//   const srs = createSrs({ settings })   // `settings` es el objeto de core/settings.js; sin él se usan los valores por defecto
//   srs.engine() → 'fsrs' | 'simple'     · srs.newCard · srs.review(card, rating, now) · srs.retrievability(card, now)
//   srs.previewIntervals(card, now) · srs.levelOf(card) · srs.dueLabel(card, now) · srs.rescue(cards, now) · srs.leechList(cards)
// No cambia de motor por su cuenta: solo cuando la persona lo cambia en Ajustes.
import * as fsrs from './srs.js';
import * as simple from './srs.simple.js';
import { rescuePlan } from './srsRescue.js';
import { leechList } from './srsLeech.js';

export const ENGINES = Object.freeze({ fsrs, simple });

export function createSrs({ settings = null } = {}) {
  const read = (key, fallback) => {
    const v = settings && typeof settings.get === 'function' ? settings.get(key) : undefined;
    return v === undefined ? fallback : v;
  };
  const engineName = () => (read('srsEngine', 'fsrs') === 'simple' ? 'simple' : 'fsrs');
  const impl = () => ENGINES[engineName()];
  const opts = () => ({ retention: read('retention', fsrs.DEFAULT_RETENTION), leechThreshold: read('leechThreshold', 8) });
  return {
    engine: engineName,
    newCard: (itemId, facet, now, topics) => fsrs.newCard(itemId, facet, now, topics),
    review: (card, rating, now) => impl().review(card, rating, now, opts()),
    retrievability: (card, now) => impl().retrievability(card, now, opts()),
    previewIntervals: (card, now) => impl().previewIntervals(card, now, opts()),
    levelOf: (card) => fsrs.levelOf(card),
    dueLabel: (card, now) => fsrs.dueLabel(card, now),
    rescue: (cards, now) => rescuePlan(cards, now, { dailyCap: read('dailyReviewCap', fsrs.DEFAULT_DAILY_REVIEW_CAP), retrievability: (c, n) => impl().retrievability(c, n, opts()) }),
    leechList: (cards) => leechList(cards),
  };
}
