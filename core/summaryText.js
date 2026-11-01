// @purpose: Contenido de la pantalla de resumen (2.8-T2): convierte el resumen de core/sessionSummary.js en textos y listas listos para dibujar, con mensaje final cálido y honesto; puro, sin DOM.
// Resumen de sesión (subparte 2.8, tramo 2, punto 2). Roadmap 2.8: «mensaje final cálido y honesto (nunca de culpa, nunca falso elogio)».
// Aquí solo se decide QUÉ se dice; cómo se dibuja es de la vista. Todo texto pasa por la auditoría sin culpa (tests/summaryText.test.mjs y tests/noBlame26.test.mjs).
//
//   describeSummary(summary, { topicName? }?) → objeto congelado, nunca lanza (con algo que no es un resumen devuelve el de «sin respuestas»)
//     topicName(id) → texto   nombre legible del tema; por defecto se muestra el id.
//     { kind: 'empty' | 'partial' | 'full', title, message,
//       stats:     [{ id, label, value }]               ejercicios, aciertos, precisión (solo si hay respuestas) y tiempo
//       breakdown: [{ id, text }]                       «Casi», «Para repasar», «Saltados»: solo los que no son 0
//       mastery:   { lines: [{ topicId, text }], more }  hasta 6 temas; `more` = cuántos quedaron fuera. Cada porcentaje lleva SIEMPRE su confianza.
//       errors:    { fresh: [línea], recurrent: [línea], more }   línea = { id, code, title|null, text, hint|null, note|null, topics: [nombre] }; hasta 5 en total
//       reviews:   { lines: [texto], unknown: texto|null }
//       actions:   { retry: { count, label } | null, chat: { label } | null }   «Repetir los que fallé» solo si hay tarjetas fallidas; «Llevar al chat» solo si hay algo que llevar (core/summaryChat.js)
//     }
//   Honestidad del mensaje: no celebra lo que no se midió. Con menos de 3 respuestas dice que es pronto para sacar conclusiones; el elogio fuerte
//   exige ≥ 5 respuestas y ≥ 85 % de aciertos; con poca precisión habla de lo que costó sin culpa y de que lo difícil ya está anotado.
// Las funciones de texto toleran argumentos que faltan o no son números/texto: nunca escriben «undefined» ni «NaN».
import { summaryChatWorthy } from './summaryChat.js';

const n0 = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);
const nm = (v) => (typeof v === 'string' && v !== '' ? v : v === undefined || v === null ? '' : String(v));
const times = (n, one, many) => (n0(n) === 1 ? one : many);
export const SUMMARY_TEXT = Object.freeze({
  titleFull: 'Sesión terminada',
  titlePartial: 'Sesión a medias',
  titleEmpty: 'Sesión sin ejercicios',
  msgEmpty: 'Todavía no respondiste ningún ejercicio, y está bien. Cuando quieras, empezamos con calma.',
  msgShort: 'Fue una sesión corta: con tan pocos ejercicios todavía es pronto para sacar conclusiones. Lo que hiciste quedó guardado.',
  msgStrong: 'Sesión sólida: la mayoría salió bien. Lo poco que quedó pendiente volverá en el momento justo.',
  msgSteady: 'Buen avance. Lo que hoy no salió ya quedó anotado para repasarlo, sin prisa.',
  msgHard: 'Hoy costó más, y es normal cuando algo es nuevo. Lo difícil ya quedó anotado y volverá en el momento justo.',
  msgPartial: (answered, pending) => `Dejaste la sesión a mitad y guardé lo que hiciste: ${n0(answered)} ${times(answered, 'ejercicio', 'ejercicios')}. `
    + `Quedaron ${n0(pending)} sin ver; los retomas cuando quieras.`,
  msgPartialAll: (answered) => `Cerraste la sesión antes de tiempo y guardé lo que hiciste: ${n0(answered)} ${times(answered, 'ejercicio', 'ejercicios')}.`,
  statAnswered: 'Ejercicios', statCorrect: 'Aciertos', statAccuracy: 'Precisión', statTime: 'Tiempo',
  almost: (n) => `Casi: ${n0(n)}`, review: (n) => `Para repasar: ${n0(n)}`, skipped: (n) => `Saltados: ${n0(n)}`,
  masteryNew: (name, after) => `${nm(name)}: primer dato, ${n0(after)} %`,
  masteryUp: (name, before, after) => `${nm(name)}: subió de ${n0(before)} % a ${n0(after)} %`,
  masterySame: (name, after) => `${nm(name)}: se mantiene en ${n0(after)} %`,
  masteryDown: (name, before, after) => `${nm(name)}: bajó de ${n0(before)} % a ${n0(after)} %`,
  confLow: 'todavía es pronto para fiarse', confLowEvidence: 'poca evidencia todavía', confMid: 'va tomando forma', confHigh: 'dato firme', confNone: 'sin confianza medida',
  moreTopics: (n) => `y ${n0(n)} ${times(n, 'tema más', 'temas más')}`,
  moreErrors: (n) => `y ${n0(n)} más`,
  errorEarlier: (n) => `Ya había aparecido ${n0(n)} ${times(n, 'vez', 'veces')} antes.`,
  errorTwice: 'Apareció dos veces hoy.',
  errorMany: (n) => `Apareció ${n0(n)} veces hoy.`,
  errorSystematic: 'Conviene practicarlo con calma.',
  reviewToday: (n) => `Hoy o antes: ${n0(n)}`, reviewTomorrow: (n) => `Mañana: ${n0(n)}`, reviewWeek: (n) => `En los próximos 7 días: ${n0(n)}`, reviewLater: (n) => `Más adelante: ${n0(n)}`,
  reviewUnknown: (n) => `Sin fecha de repaso todavía: ${n0(n)}`,
  chat: 'Llevar al chat',
  retry: (n) => (n0(n) === 1 ? 'Repetir el que no me salió' : `Repetir los ${n0(n)} que no me salieron`),
});

const T = SUMMARY_TEXT;
const MAX_MASTERY = 6;
const MAX_ERRORS = 5;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const nat = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const text = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

export function formatMinutes(ms) {
  const m = nat(ms) / 60000;
  if (m < 1) return 'menos de 1 min';
  const total = Math.round(m);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${h} h` : `${h} h ${String(rest).padStart(2, '0')} min`;
}

const confidenceText = (c) => (c === 'low' ? T.confLow : c === 'mid' ? T.confMid : c === 'high' ? T.confHigh : T.confNone);

function messageFor(s, kind) {
  if (kind === 'empty') return T.msgEmpty;
  if (kind === 'partial') return nat(s.pending) > 0 ? T.msgPartial(s.answered, s.pending) : T.msgPartialAll(s.answered);
  if (s.answered < 3) return T.msgShort;
  if (s.answered >= 5 && s.accuracyPct >= 85) return T.msgStrong;
  if (s.accuracyPct >= 50) return T.msgSteady;
  return T.msgHard;
}

function errorLine(e, topicName) {
  const bits = [];
  if (e.priorCount > 0) bits.push(T.errorEarlier(e.priorCount));
  else if (e.times === 2) bits.push(T.errorTwice);
  else if (e.times > 2) bits.push(T.errorMany(e.times));
  if (e.kind === 'systematic') bits.push(T.errorSystematic);
  const original = text(e.original) ?? '';
  const said = text(e.correction) ? `«${original}» → «${text(e.correction)}»` : `«${original}»`;
  return { id: e.id, code: e.code, title: text(e.title), text: said, hint: text(e.hint), note: bits.length > 0 ? bits.join(' ') : null, topics: (Array.isArray(e.topics) ? e.topics : []).map(topicName) };
}

function build(summary, topicName) {
  const s = summary;
  const kind = s.empty ? 'empty' : s.partial ? 'partial' : 'full';
  const stats = [];
  const planned = Math.max(nat(s.planned), nat(s.answered));
  stats.push({ id: 'answered', label: T.statAnswered, value: kind === 'partial' ? `${s.answered} de ${planned}` : String(nat(s.answered)) });
  stats.push({ id: 'correct', label: T.statCorrect, value: String(nat(s.counts?.correct)) });
  if (typeof s.accuracyPct === 'number' && Number.isFinite(s.accuracyPct)) stats.push({ id: 'accuracy', label: T.statAccuracy, value: `${s.accuracyPct} %` });
  if (kind !== 'empty') stats.push({ id: 'time', label: T.statTime, value: formatMinutes(s.time?.ms) });

  const c = s.counts ?? {};
  const breakdown = [];
  if (nat(c.almost) > 0) breakdown.push({ id: 'almost', text: T.almost(nat(c.almost)) });
  if (nat(c.wrong) + nat(c.dontKnow) > 0) breakdown.push({ id: 'review', text: T.review(nat(c.wrong) + nat(c.dontKnow)) });
  if (nat(c.skipped) > 0) breakdown.push({ id: 'skipped', text: T.skipped(nat(c.skipped)) });

  const fin = (v) => typeof v === 'number' && Number.isFinite(v);
  // Un cambio solo se muestra si se puede afirmar con números: «después» siempre; «antes» también para subir o bajar.
  const changes = (Array.isArray(s.mastery?.changes) ? s.mastery.changes : []).filter((m) => isObj(m) && fin(m.after) && (m.direction === 'up' || m.direction === 'down' ? fin(m.before) : true));
  const lines = changes.slice(0, MAX_MASTERY).map((m) => {
    const name = topicName(m.topicId);
    const body = m.direction === 'new' ? T.masteryNew(name, m.after) : m.direction === 'up' ? T.masteryUp(name, m.before, m.after)
      : m.direction === 'down' ? T.masteryDown(name, m.before, m.after) : T.masterySame(name, m.after);
    return { topicId: m.topicId, text: `${body} (${m.lowEvidence === true ? T.confLowEvidence : confidenceText(m.confidence)})` };
  });

  const fresh = Array.isArray(s.errors?.fresh) ? s.errors.fresh : [];
  const recurrent = Array.isArray(s.errors?.recurrent) ? s.errors.recurrent : [];
  const shownRecurrent = recurrent.slice(0, MAX_ERRORS);
  const shownFresh = fresh.slice(0, Math.max(0, MAX_ERRORS - shownRecurrent.length));

  const g = s.nextReviews?.groups ?? {};
  const revLines = [];
  if (nat(g.today) > 0) revLines.push(T.reviewToday(nat(g.today)));
  if (nat(g.tomorrow) > 0) revLines.push(T.reviewTomorrow(nat(g.tomorrow)));
  if (nat(g.week) > 0) revLines.push(T.reviewWeek(nat(g.week)));
  if (nat(g.later) > 0) revLines.push(T.reviewLater(nat(g.later)));
  const unknown = nat(s.nextReviews?.unknown);

  const failed = Array.isArray(s.failed) ? s.failed.length : 0;
  return {
    kind, title: kind === 'empty' ? T.titleEmpty : kind === 'partial' ? T.titlePartial : T.titleFull, message: messageFor(s, kind),
    stats, breakdown, mastery: { lines, more: Math.max(0, changes.length - lines.length) },
    errors: { fresh: shownFresh.map((e) => errorLine(e, topicName)), recurrent: shownRecurrent.map((e) => errorLine(e, topicName)), more: Math.max(0, fresh.length + recurrent.length - shownFresh.length - shownRecurrent.length) },
    reviews: { lines: revLines, unknown: unknown > 0 ? T.reviewUnknown(unknown) : null },
    actions: { retry: failed > 0 ? { count: failed, label: T.retry(failed) } : null, chat: summaryChatWorthy(s) ? { label: T.chat } : null },
  };
}

const EMPTY_SUMMARY = Object.freeze({ empty: true, partial: false, answered: 0, planned: 0, pending: 0, counts: {}, accuracyPct: null, time: { ms: 0 }, mastery: { changes: [] }, errors: { fresh: [], recurrent: [] }, nextReviews: { groups: {}, unknown: 0 }, failed: [] });

function deepFreeze(o) {
  if (o !== null && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const k of Object.keys(o)) deepFreeze(o[k]); }
  return o;
}

export function describeSummary(summary, { topicName } = {}) {
  const name = (id) => { try { const n = typeof topicName === 'function' ? topicName(id) : null; return text(n) ?? String(id); } catch { return String(id); } };
  try {
    return deepFreeze(build(isObj(summary) ? summary : EMPTY_SUMMARY, name));
  } catch {
    return deepFreeze(build(EMPTY_SUMMARY, name));
  }
}
