// @purpose: Validación estricta de una entrada léxica (LexEntry) del vocabulario.
// Validación estricta de una entrada léxica, `LexEntry` (subparte 1.3, cuarto 1, mitad B). Roadmap 8.11. Puro.
//   validateLexEntry(input, ctx?) → { ok, errors, warnings, errorTotal, warningTotal }   (nunca lanza; no modifica la entrada)
//   checkLexEntry(report, path, input, ctx?)   escribe en un informe existente con una ruta base (`lexicon[4]`).
// Obligatorios: id, lemma, pos, family, level, es, def_en, examples. Opcionales: band (null), priority (3), collocations ([]), derivation ([]),
// false_friend_note_es (null), audio (null), image (null). El id debe empezar por la familia: `vocab.body.knee` en la familia `vocab.body`.
import { LEVELS, LIMITS, createReport, joinPath, check, text, int, oneOf, idOf, list, obj, optional, nullable } from './contentRules.js';
import { ID_RE, isPlain, longText, audioPath, imagePath } from './contentCommon.js';

// Provisional (DECISIONS.md 1.3-1B): 8.11 solo muestra `noun`; 4.1 pide categoría y banda de frecuencia.
export const LEX_POS = Object.freeze(['noun', 'verb', 'adjective', 'adverb', 'preposition', 'pronoun', 'determiner', 'conjunction', 'interjection', 'numeral', 'phrase', 'phrasal_verb']);
// Banda de frecuencia: `1K`…`20K` (mil palabras más frecuentes) u `OFF` (fuera de las listas).
export const LEX_BAND_RE = /^(?:(?:[1-9]|1[0-9]|20)K|OFF)$/;

const EXAMPLE = obj({ en: text(), es: text() });

const LEX_SPEC = obj({
  id: idOf(ID_RE, 'un id como vocab.body.knee (minúsculas, dígitos, _ y puntos)'),
  lemma: text(60),
  pos: oneOf(LEX_POS),
  family: idOf(ID_RE, 'una familia con al menos dos tramos, como vocab.body'),
  level: oneOf(LEVELS),
  band: nullable(idOf(LEX_BAND_RE, 'una banda como 1K, 2K… 20K u OFF')),
  priority: optional(int(1, 5)),
  es: list(text(LIMITS.short), { min: 1, max: 10, unique: true }),
  def_en: text(),
  examples: list(EXAMPLE, { max: 20 }),
  collocations: optional(list(text(LIMITS.short), { max: 20 })),
  derivation: optional(list(text(60), { max: 20 })),
  false_friend_note_es: nullable(longText()),
  audio: audioPath(),
  image: imagePath(),
});

function crossChecks(r, path, v) {
  if (!isPlain(v)) return;
  const e = { ...v };
  if (typeof e.id === 'string' && typeof e.family === 'string' && ID_RE.test(e.id) && ID_RE.test(e.family) && !e.id.startsWith(`${e.family}.`)) {
    r.error(joinPath(path, 'id'), 'LEX_FAMILY_MISMATCH', `el id debe empezar por la familia ("${e.family}.")`);
  }
  if (Array.isArray(e.examples) && e.examples.length === 0) r.warn(joinPath(path, 'examples'), 'LEX_NO_EXAMPLE', 'una palabra sin ejemplos es difícil de estudiar: agrega al menos uno');
}

export function checkLexEntry(r, path, input, ctx = {}) {
  check(r, path, input, LEX_SPEC, ctx);
  try { crossChecks(r, path, input); } catch { /* entrada hostil: `check` ya informó UNREADABLE */ }
}

export function validateLexEntry(input, ctx = {}) {
  const r = createReport();
  checkLexEntry(r, '', input, ctx);
  return r.result();
}
