// @purpose: Guarda una respuesta en UNA transacción (evento + tarjeta + errores), con doble toque idempotente por sesión y tarjeta.
// Persistencia atómica de una respuesta (subparte 2.1, tramo 2). Roadmap 2.1-T2 y 8.6, 8.4, 8.8. Une lo que 1.5 deja listo y NO calcula nada.
//
//   createAnswerCommit({ db, events, errors?, board? }) → objeto congelado { commit }
//     db      motor de core/db.js (solo `tx`).   events  createEvents(...) o su versión envuelta (usa `prepare`, `insertIn`).
//     errors  createErrors(...) (usa `prepare`, `applyIn`); sin él, `commit` rechaza si se le piden errores.
//     board   createMasteryBoard(...) (opcional): tras guardar invalida el dominio de los temas del evento y de los errores (los errores no pasan por `events.log`).
//
//   commit({ grade, errors? }) → Promesa { duplicate, event, card, cardSaved, errors }
//     grade   lo que devuelve gradeAnswer o gradeManual (1.5): { event, card, scheduled, … }. `event.cardId` debe ser `card.id`.
//     errors  lista (≤ 20) de entradas para errors.record ({ code, original, correction?, context?, topics?, … }); `ts` por defecto el del evento e `itemId` el del evento.
//     Atómico (todo o nada): el evento, la tarjeta (solo si `grade.scheduled`) y cada error se escriben en la MISMA transacción; si algo falla no queda nada.
//     Todo se valida ANTES de abrir la transacción: una entrada mala lanza (EventError, ErrorRecordError o Error) sin tocar la base.
//     Si la base falla rechaza con DbError y no se guardó nada.
//     Doble toque: si el evento trae `sessionId` y ya hay un evento `answer` con ese `sessionId` para la misma tarjeta, NO escribe nada y devuelve
//     { duplicate: true, event: el ya guardado, card: null, cardSaved: false, errors: [] }. Sin `sessionId` no se puede detectar y siempre escribe.
//     Resultado normal: { duplicate: false, event: el guardado, card: la tarjeta guardada o null si no se programó, cardSaved, errors: [resultado de applyIn por error] }.
//     Una tarjeta suspendida o con datos dañados (scheduled false) guarda el evento y NO toca la tarjeta: la respuesta nunca se pierde.
//     La última escritura gana: no se comprueba si otra pestaña cambió la tarjeta mientras tanto (un solo usuario).
import { classifyError, DbError } from './db.js';

export const MAX_ERRORS_PER_ANSWER = 20;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function createAnswerCommit({ db, events, errors = null, board = null } = {}) {
  if (!db || typeof db.tx !== 'function') throw new Error('createAnswerCommit: falta la base de datos (db.tx)');
  if (!events || typeof events.prepare !== 'function' || typeof events.insertIn !== 'function') throw new Error('createAnswerCommit: faltan events.prepare y events.insertIn');
  if (errors !== null && (typeof errors.prepare !== 'function' || typeof errors.applyIn !== 'function')) throw new Error('createAnswerCommit: errors necesita prepare y applyIn');
  if (board !== null && typeof board.invalidate !== 'function') throw new Error('createAnswerCommit: board necesita invalidate');

  async function commit({ grade, errors: errorInputs = [] } = {}) {
    if (!isObj(grade) || !isObj(grade.event) || !isObj(grade.card)) throw new Error('commit: grade debe traer event y card (lo que devuelve gradeAnswer)');
    if (typeof grade.card.id !== 'string' || grade.card.id === '') throw new Error('commit: la tarjeta necesita un id');
    if (grade.event.cardId !== grade.card.id) throw new Error('commit: el evento y la tarjeta deben ser de la misma tarjeta (event.cardId ≠ card.id)');
    if (!Array.isArray(errorInputs)) throw new Error('commit: errors debe ser una lista');
    if (errorInputs.length > MAX_ERRORS_PER_ANSWER) throw new Error(`commit: demasiados errores en una respuesta (máximo ${MAX_ERRORS_PER_ANSWER})`);
    if (errorInputs.length > 0 && !errors) throw new Error('commit: no hay registro de errores (falta el catálogo): no se guardó nada');

    const built = events.prepare(grade.event);
    const prepared = errorInputs.map((e) => {
      if (!isObj(e)) throw new Error('commit: cada error debe ser un objeto');
      return errors.prepare({ ts: built.ts, itemId: built.itemId, ...e });
    });
    const stores = errors ? ['events', 'cards', 'errors'] : ['events', 'cards'];
    const saveCard = grade.scheduled === true;

    let out;
    try {
      out = await db.tx(stores, async (t) => {
        if (built.sessionId) {
          const rows = await t.query('events', { index: 'cardId', value: built.cardId });
          const twin = rows.find((r) => r.type === 'answer' && r.sessionId === built.sessionId);
          if (twin) return { duplicate: true, event: twin, card: null, cardSaved: false, errors: [] };
        }
        const event = await events.insertIn(t, built);
        if (saveCard) await t.put('cards', grade.card);
        const results = [];
        for (const p of prepared) results.push(await errors.applyIn(t, p));
        return { duplicate: false, event, card: saveCard ? { ...grade.card } : null, cardSaved: saveCard, errors: results };
      });
    } catch (e) {
      throw e instanceof DbError ? e : classifyError(e, { store: 'events' });
    }

    if (!out.duplicate && board) {
      const topics = new Set(out.event.topics ?? []);
      for (const r of out.errors) for (const tp of r.record?.topics ?? []) topics.add(tp);
      try { board.invalidate([...topics]); } catch { /* el dominio se recalcula solo con el día o las tarjetas */ }
    }
    return out;
  }

  return Object.freeze({ commit });
}
