// @purpose: Validación estricta de una historia (Story) y sus preguntas.
// Validación estricta de una historia, `Story` (subparte 1.3, cuarto 1, mitad B). Roadmap 8.12. Puro.
//   validateStory(input, ctx?) → { ok, errors, warnings, errorTotal, warningTotal }   (nunca lanza; no modifica la entrada)
//   checkStory(report, path, input, ctx?)   escribe en un informe existente con una ruta base (`stories[2]`).
// Obligatorios: id, level, title_en, title_es, segments (≥ 1), source. Opcionales: topic_tags, grammar_targets, vocab_targets, questions,
// comprehensibility. Las preguntas son ítems completos (checkItem) y deben ser de lectura o de escucha.
import { LEVELS, LIMITS, createReport, joinPath, check, text, int, oneOf, idOf, list, obj, custom, optional, nullable } from './contentRules.js';
import { ID_RE, TAG_RE, isPlain, audioPath, topicRef } from './contentCommon.js';
import { checkItem, ITEM_SOURCES } from './contentItem.js';
import { typeInfo } from './contentTypes.js';

export const STORY_ID_RE = /^story(\.[a-z0-9_]+)+$/;
const SEGMENT_ID_RE = /^[a-z][a-z0-9_]{0,19}$/;
const QUESTION_FAMILIES = new Set(['reading', 'audio']);

const SEGMENT = obj({
  id: idOf(SEGMENT_ID_RE, 'un id como s1 (minúsculas, dígitos y _; hasta 20)'),
  text: text(LIMITS.long),
  translation_es: nullable(text(LIMITS.long)),
  audio: audioPath(),
  new_words: optional(list(text(60), { max: 30, unique: true })),
});

const STORY_SPEC = obj({
  id: idOf(STORY_ID_RE, 'un id como story.a1.0001'),
  level: oneOf(LEVELS),
  title_en: text(LIMITS.short),
  title_es: text(LIMITS.short),
  topic_tags: optional(list(idOf(TAG_RE, 'una etiqueta en minúsculas como daily_life'), { max: 12, unique: true })),
  grammar_targets: optional(list(topicRef(), { max: 20, unique: true })),
  vocab_targets: optional(list(idOf(ID_RE, 'un id de familia o de palabra como vocab.home.kitchen'), { max: 20, unique: true })),
  segments: list(SEGMENT, { min: 1, max: 200 }),
  questions: optional(list(custom((r, path, v, ctx) => checkItem(r, path, v, ctx)), { max: 30 })),
  comprehensibility: optional(obj({ known_pct_estimate: nullable(int(0, 100)) })),
  source: oneOf(ITEM_SOURCES),
});

function crossChecks(r, path, v) {
  if (!isPlain(v)) return;
  const s = { ...v };
  if (Array.isArray(s.segments)) {
    const seen = new Map();
    s.segments.slice(0, 200).forEach((seg, i) => {
      if (!isPlain(seg)) return;
      const id = { ...seg }.id;
      if (typeof id !== 'string') return;
      if (seen.has(id)) r.error(joinPath(joinPath(joinPath(path, 'segments'), i), 'id'), 'DUPLICATE', `ya existe en segments[${seen.get(id)}]`);
      else seen.set(id, i);
    });
  }
  if (Array.isArray(s.questions)) {
    const seen = new Map();
    s.questions.slice(0, 30).forEach((q, i) => {
      if (!isPlain(q)) return;
      const it = { ...q };
      const qPath = joinPath(joinPath(path, 'questions'), i);
      const info = typeInfo(it.type);
      if (info && !QUESTION_FAMILIES.has(info.family)) r.error(joinPath(qPath, 'type'), 'STORY_QUESTION_TYPE', `una pregunta de historia debe ser de lectura o de escucha, no ${it.type}`);
      if (typeof it.id === 'string') {
        if (seen.has(it.id)) r.error(joinPath(qPath, 'id'), 'DUPLICATE', `ya existe en questions[${seen.get(it.id)}]`);
        else seen.set(it.id, i);
      }
    });
  }
}

export function checkStory(r, path, input, ctx = {}) {
  check(r, path, input, STORY_SPEC, ctx);
  try { crossChecks(r, path, input); } catch { /* entrada hostil: `check` ya informó UNREADABLE */ }
}

export function validateStory(input, ctx = {}) {
  const r = createReport();
  checkStory(r, '', input, ctx);
  return r.result();
}
