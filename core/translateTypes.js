// @purpose: Lógica pura de trap_translate y translate_bank (2.5-T3, punto 3): instrucción, banco de palabras, plan del enunciado y calificación con detección de la trampa; sin DOM.
// Los dos tipos son de la familia de texto (se ESCRIBE la traducción al inglés; el ítem trae `accept`). Sin DOM, sin reloj y sin azar (barajar el banco es cosa de la pantalla).
//
//   TRANSLATE_TYPES = ['trap_translate', 'translate_bank']
//   isTranslateType(type) → bool
//   instructionFor(type) → instrucción en español («Traduce al inglés.»; con banco: «…con las palabras del banco.»). Tipo desconocido lanza Error en español.
//   bankOf(item) → lista de palabras del banco (`item.data.bank`: textos no vacíos, sin espacios en los bordes, sin repetidos exactos y como mucho 30); [] si no hay.
//   promptPlan(item, type) → { instruction, main: { text, lang: 'es' } | null, bank: string[] }   main = prompt_es; el banco solo en translate_bank.
//   trapOf(item, typed, opts?) → { text, code } | null
//       La trampa es un error típico conocido: `item.distractors[{ text, code }]` (roadmap 8.3). Coincide si lo escrito, comparado con `compare`, ES ese distractor
//       (normalización y contracciones incluidas); una errata de un distractor NO cuenta. Devuelve el primero que coincide; `code` vale null si el distractor no trae código.
//   gradeTranslation(item, text, opts?) → { ...gradeText, trap }   (compare inyectable en opts.compare; un ítem sin accept lanza Error en español)
//       Si lo escrito no acierta y es una trampa conocida: result 'wrong' (aunque compare lo viera cercano), `trap` trae { text, code } y el código se suma a errorCodes sin repetirse.
//       Si acierta, `trap` es null aunque coincida con un distractor (manda `accept`).
import { compare as defaultCompare } from './compare.js';
import { gradeText, isBlank } from './textAnswer.js';

export const TRANSLATE_TYPES = Object.freeze(['trap_translate', 'translate_bank']);
export const BANK_MAX = 30;

const INSTRUCTIONS = Object.freeze({
  trap_translate: 'Traduce al inglés.',
  translate_bank: 'Traduce al inglés con las palabras del banco.',
});

export function isTranslateType(type) {
  return typeof type === 'string' && TRANSLATE_TYPES.includes(type);
}

export function instructionFor(type) {
  if (!isTranslateType(type)) throw new Error(`translateTypes: tipo desconocido (${String(type).slice(0, 40)})`);
  return INSTRUCTIONS[type];
}

export function bankOf(item) {
  const raw = item?.data?.bank;
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const w of raw) {
    if (typeof w !== 'string' || isBlank(w)) continue;
    const t = w.trim();
    if (!out.includes(t)) out.push(t);
    if (out.length === BANK_MAX) break;
  }
  return out;
}

export function promptPlan(item, type) {
  const instruction = instructionFor(type);
  const text = typeof item?.prompt_es === 'string' && item.prompt_es.trim() !== '' ? item.prompt_es.trim() : null;
  return { instruction, main: text === null ? null : { text, lang: 'es' }, bank: type === 'translate_bank' ? bankOf(item) : [] };
}

export function trapOf(item, typed, opts = {}) {
  if (isBlank(typed) || !Array.isArray(item?.distractors)) return null;
  const run = typeof opts?.compare === 'function' ? opts.compare : defaultCompare;
  for (const d of item.distractors) {
    if (d === null || typeof d !== 'object' || typeof d.text !== 'string' || isBlank(d.text)) continue;
    if ((run(typed.trim(), [d.text.trim()], {}) ?? {}).result === 'correct') {
      return { text: d.text.trim(), code: typeof d.code === 'string' && d.code.trim() !== '' ? d.code.trim() : null };
    }
  }
  return null;
}

export function gradeTranslation(item, text, opts = {}) {
  const g = gradeText(item, text, opts);
  if (g.empty || g.result === 'correct') return { ...g, trap: null };
  const trap = trapOf(item, g.typed, opts);
  if (trap === null) return { ...g, trap: null };
  const errorCodes = trap.code !== null && !g.errorCodes.includes(trap.code) ? [...g.errorCodes, trap.code] : g.errorCodes;
  return { ...g, result: 'wrong', errorCodes, trap };
}
