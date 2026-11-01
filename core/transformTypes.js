// @purpose: Lógica pura de transform, keyword_transform, join_sentences y pronoun_placement (2.5-T4, puntos 3 y 5): oración base, instrucción, palabra clave o conector y calificación con «sin cambios», clave ausente, trampa y pista del detector; sin DOM.
// Los cuatro tipos se contestan ESCRIBIENDO la oración reescrita en inglés (el ítem trae `accept`). Contrato de datos ya congelado en 1.3-2A (familia `transform`, que incluye join_sentences):
//   `data.source` (la oración base, en inglés; en join_sentences, las oraciones que se unen), `data.instruction_es` (qué hay que hacer; null si no hay) y `data.keyword` (la palabra clave; null si no hay).
//   pronoun_placement es de la familia `text_input` (sin `data.source`): su oración base es `prompt_en`, como en fix_error (8.3). Este punto NO añade campos al contenido. Sin DOM, sin reloj y sin azar.
//   join_sentences: `data.keyword` es el CONECTOR que hay que usar («because», «so»); es opcional. pronoun_placement no tiene palabra clave.
//
//   TRANSFORM_TYPES = ['transform', 'keyword_transform', 'join_sentences', 'pronoun_placement']
//   KEYWORD_TYPES = ['keyword_transform', 'join_sentences']   los que pueden traer palabra clave o conector
//   isTransformType(type) → bool
//   sourceOf(item, type?) → texto de `data.source` sin espacios en los bordes | null si falta o está vacío. Solo con type 'pronoun_placement' y sin `data.source`, vale `prompt_en`.
//   keywordOf(item, type) → palabra clave de `data.keyword` (sin espacios en los bordes); solo existe en KEYWORD_TYPES: en transform y pronoun_placement, o sin texto, es null.
//   instructionFor(type, item?) → `data.instruction_es` si trae texto; si no, `prompt_es`; si no, la de siempre
//       (transform «Reescribe la oración como se pide.»; keyword_transform «Reescribe la oración con la palabra clave, sin cambiarla.»; join_sentences «Une las oraciones en una sola.»;
//       pronoun_placement «Cambia el objeto por un pronombre y colócalo bien.»). Tipo desconocido lanza Error en español.
//   promptPlan(item, type) → { instruction, main: { text, lang: 'en' } | null, keyword: string | null }
//   hasKeyword(text, keyword) → bool   la palabra clave aparece TAL CUAL (palabras enteras, sin mayúsculas ni apóstrofos tipográficos); una clave vacía siempre está.
//       Si la clave tiene varias palabras, deben aparecer seguidas y en ese orden. «does» no cuenta como «do»: la clave no se cambia.
//   gradeTransform(item, text, type, opts?) → { ...gradeText, unchanged, keyword, keywordMissing, trap, hits, hint }   (opts: compare inyectable y detect(text) → hit[] del detector de 1.6)
//       unchanged       lo escrito es la MISMA oración base (comparada con `compare`): result 'wrong' y errorCodes = los `error_codes` del ítem. Se mira ANTES que 'almost'.
//       keyword         la palabra clave del ítem (o null).
//       keywordMissing  solo en keyword_transform, solo si el resultado es 'wrong' y no es «sin cambios»: la respuesta no usa la palabra clave. No cambia el resultado: es una pista.
//       trap            { text, code } si lo escrito es un distractor conocido; su código se suma a errorCodes. Solo si no acierta ni es «sin cambios».
//       hits, hint      el detector solo se pregunta si el resultado es 'wrong', hay texto y no es «sin cambios»; TAMBIÉN con trampa (su pista se conserva en `hint`, pero el código que suma es el de la trampa
//                       y la pantalla pinta solo el aviso de la trampa). hint = pista del primer aviso; sin trampa, su código se suma a errorCodes.
//                       Si `detect` lanza, no hay hits (nunca rompe la calificación).
//       Si acierta (o es 'almost' por una errata), todo lo extra queda en su valor vacío. Un ítem sin accept lanza Error en español; un tipo desconocido, también.
import { compare as defaultCompare } from './compare.js';
import { gradeText, isBlank } from './textAnswer.js';
import { trapOf } from './translateTypes.js';

export const TRANSFORM_TYPES = Object.freeze(['transform', 'keyword_transform', 'join_sentences', 'pronoun_placement']);
export const KEYWORD_TYPES = Object.freeze(['keyword_transform', 'join_sentences']);

const INSTRUCTIONS = Object.freeze({
  transform: 'Reescribe la oración como se pide.',
  keyword_transform: 'Reescribe la oración con la palabra clave, sin cambiarla.',
  join_sentences: 'Une las oraciones en una sola.',
  pronoun_placement: 'Cambia el objeto por un pronombre y colócalo bien.',
});
const clean = (v) => (typeof v === 'string' && !isBlank(v) ? v.trim() : null);
const dataOf = (item) => (item !== null && typeof item === 'object' && item.data !== null && typeof item.data === 'object' && !Array.isArray(item.data) ? item.data : {});

export function isTransformType(type) {
  return typeof type === 'string' && TRANSFORM_TYPES.includes(type);
}

function mustBeType(type, who) {
  if (!isTransformType(type)) throw new Error(`${who}: tipo desconocido (${String(type).slice(0, 40)})`);
}

export function sourceOf(item, type) {
  const own = clean(dataOf(item).source);
  if (own !== null || type !== 'pronoun_placement') return own;
  return item !== null && typeof item === 'object' ? clean(item.prompt_en) : null;
}

export function keywordOf(item, type) {
  return KEYWORD_TYPES.includes(type) ? clean(dataOf(item).keyword) : null;
}

export function instructionFor(type, item) {
  mustBeType(type, 'transformTypes');
  const own = clean(dataOf(item).instruction_es) ?? (item !== null && typeof item === 'object' ? clean(item.prompt_es) : null);
  return own ?? INSTRUCTIONS[type];
}

export function promptPlan(item, type) {
  mustBeType(type, 'promptPlan');
  const text = sourceOf(item, type);
  return { instruction: instructionFor(type, item), main: text === null ? null : { text, lang: 'en' }, keyword: keywordOf(item, type) };
}

const words = (s) => s.replace(/[\u2019\u2018\u02BC\u00B4`]/g, "'").toLowerCase().split(/[^a-z0-9'à-ÿ-]+/u).filter((w) => w !== '' && w !== "'" && w !== '-');

export function hasKeyword(text, keyword) {
  const key = typeof keyword === 'string' ? words(keyword) : [];
  if (key.length === 0) return true;
  const have = typeof text === 'string' ? words(text) : [];
  for (let i = 0; i < have.length; i += 1) {
    if (key.every((w, k) => have[i + k] === w)) return true;
  }
  return false;
}

const codesOf = (item) => (Array.isArray(item?.error_codes) ? [...new Set(item.error_codes.filter((c) => typeof c === 'string' && c.trim() !== '').map((c) => c.trim()))] : []);
const add = (list, code) => (typeof code === 'string' && code !== '' && !list.includes(code) ? [...list, code] : list);

export function gradeTransform(item, text, type, opts = {}) {
  mustBeType(type, 'gradeTransform');
  const g = gradeText(item, text, opts);
  const keyword = keywordOf(item, type);
  const none = { unchanged: false, keyword, keywordMissing: false, trap: null, hits: [], hint: null };
  if (g.empty || g.result === 'correct') return { ...g, ...none };
  const run = typeof opts?.compare === 'function' ? opts.compare : defaultCompare;
  const source = sourceOf(item, type);
  if (source !== null && (run(g.typed, [source], {}) ?? {}).result === 'correct') {
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
  return { ...g, result: 'wrong', errorCodes, unchanged: false, keyword, keywordMissing: !hasKeyword(g.typed, keyword), trap, hits, hint };
}
