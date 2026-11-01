// @purpose: Reglas comunes de comparación (erratas cercanas, opciones, preparación del texto) compartidas por compare y wordDiff.
// Reglas comunes de comparación de respuestas (subparte 1.2, cuartos 2B y 3). Las usan `compare` (core/compare.js) y `wordDiff`
// (core/wordDiff.js) para que decidan igual. Contrato: docs/CONTRACTS.md 1.2-2B y 1.2-3A. Sin dependencias de DOM ni de red.
//
//   readOptions(opts) → { spanish, normOpts, detector, atEnd }   lee { lang, keepFinalPunctuation, confusables, almostAtWordEnd }; nunca lanza.
//   prepare(text, ropts) → string   normaliza (contracciones expandidas, diacríticos solo en 'es') y quita la puntuación INTERIOR
//                                   (`. , ! ? …` seguida de espacio): una coma que falta no vuelve mala una respuesta. Los apóstrofos
//                                   y guiones sí cuentan. Con keepFinalPunctuation se conserva la puntuación final del texto.
//   isNearTypo(userWord, answerWord, ropts) → boolean   ¿es un error de tecleo "casi" aceptable? (reglas de 8.5, ver compare.js)
//   wordCore(word) → string   la palabra sin la puntuación pegada al final (`world.` → `world`; solo queda con keepFinalPunctuation).
import { normalize, damerauLevenshtein } from './normalize.js';

const INTERIOR_PUNCTUATION = /[.,!?\u2026]+(?=\s)/gu;
const WORDLIKE = /^\p{L}+(?:'\p{L}+)*$/u;
const WORD_AND_TRAILING = /^(.*?)([.,!?\u2026]*)$/u;
const MIN_LETTERS = 4;

export function wordCore(word) {
  const m = WORD_AND_TRAILING.exec(word);
  return m ? m[1] : word;
}

export function readOptions(opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  const spanish = o.lang === 'es';
  return {
    spanish,
    normOpts: { contractions: 'expand', stripDiacritics: spanish, keepFinalPunctuation: o.keepFinalPunctuation === true },
    detector: o.confusables && typeof o.confusables.areConfusable === 'function' ? o.confusables : null,
    atEnd: o.almostAtWordEnd === true,
  };
}

export function prepare(text, ropts) {
  return normalize(text, ropts.normOpts).replace(INTERIOR_PUNCTUATION, '').replace(/\s+/g, ' ').trim();
}

function confusableSafe(detector, a, b) {
  if (!detector) return false;
  try {
    return Boolean(detector.areConfusable(a, b));
  } catch (_err) {
    return true; // detector roto: lo prudente es NO dar "casi" (no se puede descartar que sea otra palabra válida)
  }
}

function letterCount(core) {
  return Array.from(core.replace(/'/g, '')).length;
}

// Palabras ya preparadas y distintas. "Casi" = solo letras (apóstrofos interiores), ≥ 4 letras cada una, misma puntuación pegada,
// distancia de Damerau-Levenshtein 1, no confundibles, y (salvo `atEnd`) el cambio no toca la última letra: work/works,
// send/sent o take/taken son errores de gramática, no de tecleo.
export function isNearTypo(userWord, answerWord, ropts) {
  const u = WORD_AND_TRAILING.exec(userWord);
  const a = WORD_AND_TRAILING.exec(answerWord);
  if (!u || !a) return false;
  const [, uCore, uTail] = u;
  const [, aCore, aTail] = a;
  if (uTail !== aTail) return false;
  if (!WORDLIKE.test(uCore) || !WORDLIKE.test(aCore)) return false;
  if (letterCount(uCore) < MIN_LETTERS || letterCount(aCore) < MIN_LETTERS) return false;
  if (damerauLevenshtein(uCore, aCore, 1) !== 1) return false;
  if (!ropts.atEnd) {
    const U = Array.from(uCore);
    const A = Array.from(aCore);
    if (U[U.length - 1] !== A[A.length - 1]) return false;
  }
  return !confusableSafe(ropts.detector, uCore, aCore);
}
