// @purpose: Acciones sobre tarjetas de repaso para los ejercicios: leer una tarjeta, marcar favorita y crear la tarjeta de deletreo sin duplicados; tolera una base ausente.
// Acciones de tarjeta (subparte 2.2, tramo 3). Roadmap 4.7, 7.7 y 8.4.
//
//   createCardActions({ db, events?, clock?, log? }) → objeto CONGELADO { now(), read(cardId), setFav(cardId, fav), ensureSpell(flag, opts?) }
//     · Todo devuelve Promesas y NUNCA rechaza: un fallo de la base se registra con `log` y sale como estado.
//     · read(cardId) → tarjeta | null.
//     · setFav(cardId, fav) → { status: 'saved', card } | { status: 'missing' } | { status: 'error' }. Solo cambia `fav` (el resto de la tarjeta queda igual).
//     · ensureSpell(flag, { topic? }) → { status: 'created' | 'exists' | 'skipped' | 'error', word?, reason? }
//         'created' = evento `note` + tarjeta nueva `spell.<palabra>#0`; 'exists' = ya había tarjeta (no se escribe nada); 'skipped' = la palabra no sirve
//         (con apóstrofo, acento…); 'error' = no se pudo guardar. Orden: primero el evento (la verdad) y luego la tarjeta; si la tarjeta falla se informa error y un reintento no duplica la tarjeta.
//     · lazyCardActions(getStudy, log?) → función () => acciones | null: arma las acciones con `services.study` (db, events, clock) cuando ya existe (se completa tras el arranque;
//       sin base devuelve null) y reutiliza las mismas mientras `study` no cambie. Es lo que se le pasa al registro de ejercicios.
//     · `events` debe ser el `log` de `services.study.events` (el que invalida la caché del dominio). Sin `events` no se crean tarjetas de deletreo.
import { spellCardPlan } from '../core/spellCard.js';
import { systemClock } from '../core/clock.js';

export function createCardActions({ db = null, events = null, clock = systemClock, log = console.error } = {}) {
  const hasDb = db && typeof db.get === 'function' && typeof db.put === 'function';

  async function read(cardId) {
    if (!hasDb || typeof cardId !== 'string' || cardId === '') return null;
    try { return (await db.get('cards', cardId)) ?? null; } catch (e) { log('No se pudo leer la tarjeta', e); return null; }
  }

  async function setFav(cardId, fav) {
    if (!hasDb) return { status: 'error' };
    try {
      const card = typeof cardId === 'string' && cardId !== '' ? await db.get('cards', cardId) : null;
      if (!card) return { status: 'missing' };
      const next = { ...card, fav: fav === true };
      await db.put('cards', next);
      return { status: 'saved', card: next };
    } catch (e) {
      log('No se pudo guardar la favorita', e);
      return { status: 'error' };
    }
  }

  // Dos llamadas a la vez por la misma palabra comparten el trabajo: así nunca salen dos eventos ni dos tarjetas.
  const inflight = new Map();
  function ensureSpell(flag, opts = {}) {
    const key = `${flag?.expected ?? ''}`.trim().toLowerCase();
    if (key !== '' && inflight.has(key)) return inflight.get(key);
    const p = doEnsureSpell(flag, opts).finally(() => { inflight.delete(key); });
    if (key !== '') inflight.set(key, p);
    return p;
  }

  async function doEnsureSpell(flag, { topic } = {}) {
    if (!hasDb || !events || typeof events.log !== 'function') return { status: 'error', reason: 'no_service' };
    let plan = null;
    try {
      plan = spellCardPlan(flag, { now: clock.now(), ...(topic ? { topic } : {}) });
      if (!plan.ok) return { status: 'skipped', reason: plan.reason };
      if (await db.get('cards', plan.cardId)) return { status: 'exists', word: plan.word };
      await events.log(plan.event);
      await db.put('cards', plan.card);
      return { status: 'created', word: plan.word };
    } catch (e) {
      log('No se pudo crear la tarjeta de deletreo', e);
      return plan && plan.ok ? { status: 'error', word: plan.word } : { status: 'error' };
    }
  }

  return Object.freeze({ now: () => clock.now(), read, setFav, ensureSpell });
}

export function lazyCardActions(getStudy, log = console.error) {
  let made = null;
  let madeFor = null;
  return () => {
    const study = typeof getStudy === 'function' ? getStudy() : null;
    if (!study || !study.db) return null;
    if (madeFor !== study) {
      made = createCardActions({ db: study.db, events: study.events, clock: study.clock, log });
      madeFor = study;
    }
    return made;
  };
}
