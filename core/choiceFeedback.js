// @purpose: Explicación y registro de errores de la familia de elección (2.3-T2): pista del catálogo por distractor y entradas válidas para errors.record; sin DOM.
// Retroalimentación de la familia de elección (subparte 2.3, tramo 2). Sin DOM, sin reloj y sin base: solo convierte la elección ya calificada en datos.
//
//   explainChoice(item, graded, { catalog? }) → { hints, errors }
//     item     el ítem de elección (usa item.data.options, item.topics e item.situation).
//     graded   lo que devuelve gradeChoice (core/choice.js): se usan `result`, `correct` y `distractors`.
//     catalog  createErrorCatalog (core/errorCatalog.js) o algo con `has(code)` y `hint(code)`. Sin catálogo (o con uno roto) NO hay registro de errores:
//              `services.errors` tampoco existe en ese caso y el commit rechazaría toda la respuesta si recibiera errores. Devuelve listas vacías, nunca lanza por eso.
//     hints    [{ index, text, code, hint }] de cada distractor elegido cuyo `code` EXISTE en el catálogo (sin repetir texto y código). `hint` es la `pista_corta_es` o null.
//     errors   entradas para `errors.record` / `answer.errors` del conductor: { code, original, correction?, context?, topics? }. Siempre válidas para errors.prepare:
//              `errors.record` RECHAZA (no recorta) textos largos, caracteres de control y temas mal formados, y un rechazo perdería la respuesta entera;
//              por eso aquí se limpian, se recortan a los topes de LIMITS y se descarta lo que no sirva. `ts` e `itemId` los pone el commit (los del evento).
//              `topics` son los del ÍTEM (los que cuentan para el dominio de ese tema); si ninguno es válido se omite y el registro usa los del código.
//     Solo hay hints y errores si result === 'wrong'. «No sé» (sin elección) y los aciertos devuelven listas vacías.
//     Un item o un graded que no son objetos lanzan Error en español.
import { normalize } from './normalize.js';
import { TOPIC_ID_RE } from './contentTopic.js';
import { LIMITS } from './errors.js';

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const CONTROL_G = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g;

// Texto listo para errors.record: sin caracteres de control, recortado a `max`, sin cortar un par sustituto; null si queda vacío.
export function clean(value, max) {
  if (typeof value !== 'string') return null;
  let t = value.replace(CONTROL_G, ' ').trim();
  if (t.length > max) {
    t = t.slice(0, max);
    const last = t.charCodeAt(t.length - 1);
    if (last >= 0xd800 && last <= 0xdbff) t = t.slice(0, -1);
    t = t.trim();
  }
  return t === '' ? null : t;
}

function usableCatalog(catalog) {
  return isPlain(catalog) && typeof catalog.has === 'function' && typeof catalog.hint === 'function';
}

function topicsOf(item) {
  if (!Array.isArray(item.topics)) return [];
  const ok = item.topics.filter((t) => typeof t === 'string' && t.length <= LIMITS.topicLength && TOPIC_ID_RE.test(t));
  return [...new Set(ok)].slice(0, LIMITS.topics);
}

export function explainChoice(item, graded, { catalog } = {}) {
  if (!isPlain(item)) throw new Error('explainChoice: falta el ítem de elección');
  if (!isPlain(graded) || !Array.isArray(graded.distractors) || !Array.isArray(graded.correct)) throw new Error('explainChoice: falta la elección calificada (gradeChoice)');
  const out = { hints: [], errors: [] };
  if (graded.result !== 'wrong' || !usableCatalog(catalog)) return out;

  const options = Array.isArray(item.data?.options) ? item.data.options : [];
  const correction = clean(graded.correct.map((i) => options[i]).filter((o) => typeof o === 'string').join(' | '), LIMITS.correction);
  const context = clean(item.situation, LIMITS.context);
  const topics = topicsOf(item);
  const seen = new Set();

  for (const d of graded.distractors) {
    if (!isPlain(d) || typeof d.code !== 'string' || !catalog.has(d.code)) continue;
    const original = clean(d.text, LIMITS.original);
    if (original === null) continue;
    const key = `${d.code}\u0000${normalize(original)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const hint = catalog.hint(d.code);
    out.hints.push({ index: d.index, text: d.text, code: d.code, hint: typeof hint === 'string' && hint.trim() !== '' ? hint : null });
    out.errors.push({
      code: d.code,
      original,
      ...(correction === null ? {} : { correction }),
      ...(context === null ? {} : { context }),
      ...(topics.length === 0 ? {} : { topics }),
    });
  }
  return out;
}
