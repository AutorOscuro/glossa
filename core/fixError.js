// @purpose: Lógica pura de fix_error (2.5-T4, punto 1): oración con error (prompt_en), calificación de la versión corregida, «sin cambios», trampa conocida y pista del detector mecánico; sin DOM.
// El ítem trae la oración con el error en `prompt_en`, la instrucción en `prompt_es` y las versiones válidas en `accept` (roadmap 8.3). Sin DOM, sin reloj y sin azar.
//
//   FIX_TYPE = 'fix_error'
//   sentenceOf(item) → texto de la oración con error (`prompt_en` sin espacios en los bordes) | null si falta o está vacío.
//   promptPlan(item) → { instruction, main: { text, lang: 'en' } | null }   instruction = `prompt_es` si trae texto; si no, «Corrige el error en la oración.».
//   gradeFix(item, text, opts?) → { ...gradeText, unchanged, trap, hits, hint }   (opts: compare inyectable y detect(text) → hit[] del detector de 1.6)
//       unchanged  lo escrito es la MISMA oración con error (comparada con `compare`): result 'wrong' y errorCodes = los `error_codes` del ítem (no vio el error).
//       trap       { text, code } si lo escrito es un distractor conocido (otra corrección mala típica); su código se suma a errorCodes. Solo si no acierta ni es «sin cambios».
//       hits, hint el detector solo se pregunta si el resultado es 'wrong', hay texto y no es «sin cambios»; TAMBIÉN con trampa (la pista se conserva, pero el código que suma es el de la trampa):
//                  hits son los avisos (ordenados) y hint la pista del primero («Parece que usaste can to…»); sin trampa, su código se suma a errorCodes. Si `detect` lanza, no hay hits (nunca rompe la calificación).
//       «Sin cambios» se mira ANTES que 'almost': dejar la oración tal cual nunca es una errata, aunque compare la vea cerca de una versión válida.
//       Si acierta (o es 'almost' por una errata), unchanged es false, trap es null y hits es []. Un ítem sin accept lanza Error en español.
import { compare as defaultCompare } from './compare.js';
import { gradeText, isBlank } from './textAnswer.js';
import { trapOf } from './translateTypes.js';

export const FIX_TYPE = 'fix_error';
const DEFAULT_INSTRUCTION = 'Corrige el error en la oración.';
const clean = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

export function sentenceOf(item) {
  return item !== null && typeof item === 'object' ? clean(item.prompt_en) : null;
}

export function promptPlan(item) {
  const text = sentenceOf(item);
  const instruction = item !== null && typeof item === 'object' ? clean(item.prompt_es) : null;
  return { instruction: instruction ?? DEFAULT_INSTRUCTION, main: text === null ? null : { text, lang: 'en' } };
}

const codesOf = (item) => (Array.isArray(item?.error_codes) ? [...new Set(item.error_codes.filter((c) => typeof c === 'string' && c.trim() !== '').map((c) => c.trim()))] : []);
const add = (list, code) => (typeof code === 'string' && code !== '' && !list.includes(code) ? [...list, code] : list);

export function gradeFix(item, text, opts = {}) {
  const g = gradeText(item, text, opts);
  const none = { unchanged: false, trap: null, hits: [], hint: null };
  if (g.empty || g.result === 'correct') return { ...g, ...none };
  const run = typeof opts?.compare === 'function' ? opts.compare : defaultCompare;
  const sentence = sentenceOf(item);
  if (sentence !== null && (run(g.typed, [sentence], {}) ?? {}).result === 'correct') {
    return { ...g, ...none, result: 'wrong', unchanged: true, errorCodes: codesOf(item).reduce(add, g.errorCodes) };
  }
  if (g.result === 'almost') return { ...g, ...none };
  const trap = trapOf(item, g.typed, opts);
  let hits = [];
  if (typeof opts?.detect === 'function') {
    try { const out = opts.detect(g.typed); hits = Array.isArray(out) ? out.filter((h) => h !== null && typeof h === 'object') : []; } catch { hits = []; }
  }
  const hint = hits.length > 0 && clean(hits[0].hint) !== null ? hits[0].hint.trim() : null;
  let errorCodes = g.errorCodes;
  if (trap !== null) errorCodes = add(errorCodes, trap.code);
  else if (hits.length > 0) errorCodes = add(errorCodes, hits[0].code);
  return { ...g, result: 'wrong', errorCodes, unchanged: false, trap, hits, hint };
}
