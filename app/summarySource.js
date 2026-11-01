// @purpose: Fuente de datos del resumen de sesión (2.8-T2): lee con ventana los eventos, errores, tarjetas y dominio de la sesión y llama a buildSessionSummary; sin DOM.
// Pegamento entre la pantalla de resumen y core/sessionSummary.js. Cumple la regla de ventana de la sección 5 de PROJECT_STATE.md: nunca lee el historial entero.
//
//   createSummarySource({ study, log? }) → objeto congelado { load({ sessionId, state? }) }
//     study  servicios de estudio (app/services.js): usa `clock`, `events.since`, `errors.list`, `db.get`, `board.results`, `snapshot.list`, `topics` y `catalog`.
//     load → Promesa del resumen (core/sessionSummary.js). Lecturas, todas acotadas:
//       · eventos   `events.since(ahora − 24 h)` (la sesión guardada caduca a las 12 h) y solo cuentan los `answer` de `sessionId`.
//       · errores   `errors.list({ day })` solo para los días de esos eventos (no `list({})`).
//       · tarjetas  `db.get('cards', id)` solo de las tarjetas respondidas.
//       · dominio   «después» = `board.results` de los temas practicados; «antes» = la última foto diaria ANTERIOR a hoy (`snapshot.list({ to: ayer })`).
//                   Por eso «antes» es el último día con foto, no el inicio exacto de la sesión: si hubo otra sesión hoy, el cambio las suma. Sin foto, los temas salen 'new'.
//     Si fallan los EVENTOS la promesa se rechaza (un resumen de 0 respuestas sería falso). Si fallan errores, tarjetas o dominio, esa parte queda vacía, se avisa por `log` y el resto del resumen sale igual.
import { addDays, localDay, toDate } from '../core/clock.js';
import { buildSessionSummary } from '../core/sessionSummary.js';

export const SUMMARY_WINDOW_MS = 24 * 3600 * 1000;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const uniq = (list) => [...new Set(list)];

export function createSummarySource({ study, log = console.error } = {}) {
  if (!isObj(study) || !isObj(study.events) || typeof study.events.since !== 'function' || !study.clock) {
    throw new Error('createSummarySource: faltan los servicios de estudio (eventos y reloj)');
  }
  const soft = async (what, fn, fallback) => {
    try { return await fn(); } catch (e) { log(`No se pudo leer ${what} para el resumen; esa parte queda vacía`, e); return fallback; }
  };

  async function load({ sessionId, state } = {}) {
    const now = toDate(study.clock.now());
    const since = new Date(now.getTime() - SUMMARY_WINDOW_MS);
    const recent = await study.events.since(since);
    const mine = (Array.isArray(recent) ? recent : []).filter((e) => isObj(e) && e.type === 'answer' && e.sessionId === sessionId);

    const days = uniq(mine.map((e) => e.day).filter((d) => typeof d === 'string'));
    const errors = !study.errors || typeof study.errors.list !== 'function' ? [] : await soft('los errores', async () => {
      const out = [];
      for (const day of days) out.push(...await study.errors.list({ day }));
      return out;
    }, []);

    const cardIds = uniq(mine.map((e) => e.cardId).filter((c) => typeof c === 'string' && c !== ''));
    const cards = await soft('las tarjetas', async () => {
      const out = [];
      for (const id of cardIds) { const c = await study.db.get('cards', id); if (isObj(c)) out.push(c); }
      return out;
    }, []);

    const topicIds = new Set(mine.flatMap((e) => (Array.isArray(e.topics) ? e.topics : [])).filter((t) => typeof t === 'string'));
    const topicObjs = (Array.isArray(study.topics) ? study.topics : []).filter((t) => isObj(t) && topicIds.has(t.id));
    const toRows = (items) => items.map((m) => ({ topicId: m.topicId, pct: m.pct, band: m.band, confidence: m.confidence, lowEvidence: m.lowEvidence === true }));
    const masteryAfter = topicObjs.length === 0 || !study.board ? [] : await soft('el dominio', async () => toRows([...(await study.board.results(topicObjs, now)).values()]), []);
    const masteryBefore = masteryAfter.length === 0 || !study.snapshot ? [] : await soft('la foto de dominio', async () => {
      const snaps = await study.snapshot.list({ to: localDay(addDays(now, -1)) });
      const last = Array.isArray(snaps) && snaps.length > 0 ? snaps[snaps.length - 1] : null;
      return last && Array.isArray(last.results) ? last.results.filter((r) => topicIds.has(r.topicId)) : [];
    }, []);

    return buildSessionSummary({ events: mine, sessionId, state, errors, catalog: study.catalog, masteryBefore, masteryAfter, cards, now });
  }

  return Object.freeze({ load });
}
