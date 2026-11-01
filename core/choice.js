// @purpose: Lógica pura de la familia de elección (2.3-T1): lee las opciones de un ítem, las ordena con azar inyectable y califica la selección; sin DOM.
// Lógica pura de la familia de elección (subparte 2.3, tramo 1). Sin DOM, sin reloj y sin azar propio: el azar entra por `rng` (core/rng.js).
//
//   CHOICE_LIMITS = { min: 2, max: 8, response: 2000 }   (las mismas cotas que `data.options` en core/contentData.js y `responseRaw` del evento)
//   readChoice(item, { multiple? }) → { ok: true, options, correct, multiple, shuffle } | { ok: false, reason }
//       Lee `item.data` ({ options, correct, shuffle? }, contrato 8.3). `correct` sale SIEMPRE como lista de índices ordenada y sin repetidos.
//       Con multiple: true, `data.correct` puede ser un entero o una lista de enteros (extensión del COMPONENTE: el contrato de contenido sigue con un entero).
//       reason ∈ no_data | bad_options | bad_correct.
//   arrange(count, { rng, shuffle? }) → permutación de 0..count-1 = índices ORIGINALES en el orden en que se muestran.
//       shuffle: false devuelve el orden original. Con shuffle, exige rng.shuffle y comprueba que el resultado sea una permutación (no se pierde ni se repite ninguna opción).
//   gradeChoice(item, picked, { multiple? }) → { result, picked, correct, missed, distractors, errorCodes, typed, empty }
//       picked: índices ORIGINALES elegidos (entero, lista o null; lo que no sea un índice válido se ignora). result ∈ correct | wrong (la elección no tiene «casi»).
//       Sin multiple se exige exactamente una opción; con multiple, el conjunto elegido debe ser IGUAL al correcto (faltar una o sobrar una es wrong).
//       distractors: [{ index, text, code }] de las opciones elegidas que no son correctas; `code` sale de `item.distractors` casando el texto normalizado
//       (null si no hay distractor, o si su code no tiene la forma de 8.8: un code mal formado invalidaría el evento entero).
//       missed: índices correctos que no se eligieron (solo con multiple). errorCodes: codes sin repetir. typed: textos elegidos unidos con « | » (≤ 2000), con los
//       caracteres de control que el evento rechaza cambiados por espacios (2.3-T2 FIX: antes un texto así invalidaba el evento y se perdía la respuesta).
//       empty: true si no hay una elección calificable (el componente no la envía). Un ítem inválido lanza Error en español.
import { normalize } from './normalize.js';
import { CODE_RE } from './contentRules.js';
import { toResponseRaw } from './responseText.js';

export const CHOICE_LIMITS = Object.freeze({ min: 2, max: 8, response: 2000 });

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const validIndex = (i, n) => Number.isInteger(i) && i >= 0 && i < n;
const unique = (list) => [...new Set(list)];
const sorted = (list) => [...list].sort((a, b) => a - b);

export function readChoice(item, { multiple = false } = {}) {
  const d = isPlain(item) && isPlain(item.data) ? item.data : null;
  if (d === null) return { ok: false, reason: 'no_data' };
  const opts = d.options;
  if (!Array.isArray(opts) || opts.length < CHOICE_LIMITS.min || opts.length > CHOICE_LIMITS.max
    || !opts.every((o) => typeof o === 'string' && o.trim() !== '')) return { ok: false, reason: 'bad_options' };
  const raw = multiple && Array.isArray(d.correct) ? d.correct : [d.correct];
  const correct = sorted(unique(raw));
  const goodList = raw.length > 0 && raw.every((i) => validIndex(i, opts.length)) && correct.length === raw.length;
  if (!goodList) return { ok: false, reason: 'bad_correct' };
  return { ok: true, options: [...opts], correct, multiple: multiple === true, shuffle: d.shuffle !== false };
}

export function arrange(count, { rng, shuffle = true } = {}) {
  if (!Number.isInteger(count) || count < 1 || count > CHOICE_LIMITS.max) throw new Error(`arrange: el número de opciones debe ser un entero de 1 a ${CHOICE_LIMITS.max}`);
  const base = Array.from({ length: count }, (_, i) => i);
  if (shuffle === false) return base;
  if (!isPlain(rng) || typeof rng.shuffle !== 'function') throw new Error('arrange: falta un rng con shuffle (core/rng.js)');
  const out = rng.shuffle(base);
  const isPermutation = Array.isArray(out) && out.length === count && sorted(unique(out)).every((v, i) => v === i) && unique(out).length === count;
  if (!isPermutation) throw new Error('arrange: el rng no devolvió una permutación de las opciones');
  return out;
}

function codeOf(item, text) {
  const list = Array.isArray(item.distractors) ? item.distractors : [];
  const wanted = normalize(text);
  for (const d of list) {
    if (isPlain(d) && typeof d.text === 'string' && typeof d.code === 'string' && CODE_RE.test(d.code) && normalize(d.text) === wanted) return d.code;
  }
  return null;
}

export function gradeChoice(item, picked, { multiple = false } = {}) {
  const c = readChoice(item, { multiple });
  if (!c.ok) throw new Error(`gradeChoice: el ítem de elección no es válido (${c.reason})`);
  const n = c.options.length;
  const list = (Array.isArray(picked) ? picked : [picked]).filter((i) => validIndex(i, n));
  const chosen = sorted(unique(list));
  const empty = chosen.length === 0 || (!c.multiple && chosen.length !== 1);
  const exact = chosen.length === c.correct.length && chosen.every((v, i) => v === c.correct[i]);
  const wrongPicks = chosen.filter((i) => !c.correct.includes(i));
  const distractors = wrongPicks.map((i) => ({ index: i, text: c.options[i], code: codeOf(item, c.options[i]) }));
  return {
    result: !empty && exact ? 'correct' : 'wrong',
    picked: chosen,
    correct: c.correct,
    missed: c.multiple ? c.correct.filter((i) => !chosen.includes(i)) : [],
    distractors,
    errorCodes: unique(distractors.map((d) => d.code).filter(Boolean)),
    typed: toResponseRaw(chosen.map((i) => c.options[i]).join(' | '), CHOICE_LIMITS.response),
    empty,
  };
}
