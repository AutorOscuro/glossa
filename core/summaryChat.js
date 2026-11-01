// @purpose: Arma el bloque «Llevar al chat» del resumen de sesión (2.8-T3 punto 2): elige lo más importante (errores que vuelven, errores nuevos, dominio que bajó) y reúsa buildAskBlock; puro, nunca lanza.
// Subparte 2.8-T3. Sin DOM ni reloj propio. El formato del bloque (8.14) vive en core/syncChat.js; el recorte de textos, en core/aiAsk.js.
//
//   summaryChatWorthy(summary) → boolean   true si hay algo que llevar: errores tocados, tarjetas fallidas o un tema cuyo dominio bajó. Una sesión vacía no.
//   buildSummaryChatBlock(summary, { topicName?, now? }) → { ok:true, text, payload } | { ok:false, error:{ code, message } }
//     summary    el resumen CRUDO de core/sessionSummary.js (no el texto de describeSummary).
//     topicName  (id) → nombre legible del tema; por defecto el id.
//   Qué lleva: tema = el del primer error (los que vuelven primero); ítem = una línea con las cifras de la sesión; errores = hasta 5 (los que vuelven, luego los nuevos);
//   dominio = el del tema elegido; mensaje = qué se pide al chat. Sin errores ni fallos el tema sale del primer dominio que bajó.
import { buildAskBlock } from './aiAsk.js';

export const SUMMARY_CHAT_TEXT = Object.freeze({
  nothing: 'No hay nada del resumen que llevar al chat todavía.',
  msgErrors: 'Terminé una sesión de práctica y quiero entender lo que más me costó. ¿Me explicas estos errores uno por uno, empezando por el que más se repite?',
  msgFailed: 'Terminé una sesión de práctica y algunos ejercicios no me salieron. ¿Me ayudas a entender qué repasar primero?',
  msgMastery: 'Terminé una sesión de práctica y mi dominio de un tema bajó. ¿Me ayudas a ver qué repasar?',
  msgPartial: 'Dejé la sesión a medias y quiero aprovechar lo que ya hice. ¿Me ayudas con lo que me costó?',
  item: (answered, correct, pct, partial) => `${partial ? 'Sesión a medias' : 'Sesión de práctica'}: ${answered} ${answered === 1 ? 'ejercicio' : 'ejercicios'}, ${correct} ${correct === 1 ? 'acierto' : 'aciertos'}${pct === null ? '' : ` (${pct} %)`}.`,
});

const MAX_ERRORS = 5;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const list = (v) => (Array.isArray(v) ? v : []);
const nat = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const text = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

const errorsOf = (s) => [...list(s.errors?.recurrent), ...list(s.errors?.fresh)].filter((e) => isObj(e) && text(e.code) && text(e.original));
const droppedOf = (s) => list(s.mastery?.changes).filter((m) => isObj(m) && m.direction === 'down' && typeof m.after === 'number' && Number.isFinite(m.after));

export function summaryChatWorthy(summary) {
  try {
    if (!isObj(summary) || summary.empty === true) return false;
    return errorsOf(summary).length > 0 || list(summary.failed).length > 0 || droppedOf(summary).length > 0;
  } catch { return false; }
}

export function buildSummaryChatBlock(summary, { topicName, now } = {}) {
  try {
    if (!summaryChatWorthy(summary)) return { ok: false, error: { code: 'NOTHING_TO_SEND', message: SUMMARY_CHAT_TEXT.nothing } };
    const name = (id) => { try { return text(typeof topicName === 'function' ? topicName(id) : null) ?? String(id); } catch { return String(id); } };
    const errors = errorsOf(summary).slice(0, MAX_ERRORS);
    const dropped = droppedOf(summary);
    const topicId = text(list(errors[0]?.topics)[0]) ?? text(dropped[0]?.topicId) ?? text(list(summary.mastery?.changes)[0]?.topicId);
    const level = topicId ? list(summary.mastery?.changes).find((m) => isObj(m) && m.topicId === topicId && typeof m.after === 'number' && Number.isFinite(m.after)) : null;
    const answered = nat(summary.answered);
    const pct = typeof summary.accuracyPct === 'number' && Number.isFinite(summary.accuracyPct) ? Math.round(summary.accuracyPct) : null;
    const T = SUMMARY_CHAT_TEXT;
    const message = summary.partial === true ? T.msgPartial : errors.length > 0 ? T.msgErrors : list(summary.failed).length > 0 ? T.msgFailed : T.msgMastery;
    return buildAskBlock({
      topic: topicId ? name(topicId) : undefined,
      item: T.item(answered, nat(summary.counts?.correct), pct, summary.partial === true),
      errors: errors.map((e) => ({ code: e.code, original: e.original, correction: e.correction ?? undefined })),
      mastery: level ? { pct: level.after, band: level.band ?? undefined } : undefined,
      message,
    }, now === undefined ? undefined : { now });
  } catch {
    return { ok: false, error: { code: 'BAD_PAYLOAD', message: 'No pude armar el bloque.' } };
  }
}
