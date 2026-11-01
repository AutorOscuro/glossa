// @purpose: Registro de los tipos de ejercicio y sus familias, con consulta de propiedades (autocalificable, IA, audio).
// Registro de tipos de ejercicio (subparte 1.3, cuarto 1, mitad B). Roadmap 8.9. Puro.
//   ITEM_TYPES        { tipo: { family, auto, ai, audio, acceptRequired } }   (congelado)
//   FAMILIES          las familias (`choice`, `text_input`, …): el cuarto 2 define el `data` de cada una
//   INTEGRATOR_TYPES  los 4 integradores de 8.9 (son SESIONES que arma core/session.js, no ítems)
//   typeInfo(t) → info | null · isItemType(t) · isIntegratorType(t) · typesOfFamily(f) · suggestType(t) → tipo parecido | null
// Banderas (columnas de 8.9): auto = se califica sin IA · ai = requiere o mejora con IA · audio = usa audio ·
// acceptRequired = la respuesta se ESCRIBE, así que el ítem debe traer `accept` (los de elección usan `data`). Excepción: three_forms (sus respuestas viven en data.forms; accept opcional).
// Las familias son una decisión de la 1.3 (DECISIONS.md, 1.3-1B): agrupan por mecánica, no por frente del catálogo.
import { damerauLevenshtein } from './normalize.js';

export const FAMILIES = Object.freeze([
  'choice', 'text_input', 'ordering', 'matching', 'cloze', 'transform',
  'audio', 'speak', 'reading', 'writing', 'mediation', 'open_ai',
]);

// familia → tipos. Un tipo aparece una sola vez (en 8.9 `order_blocks` está en dos filas: es el mismo componente).
const BY_FAMILY = {
  choice: ['mcq_en_es', 'mcq_es_en', 'odd_one_out', 'pick_fits', 'lightning', 'choose_correct', 'ab_natural', 'discover_rule',
    'choose_tense', 'phrasal_meaning', 'particle_pick', 'prep_pick', 'most_natural'],
  text_input: ['first_letter', 'collocation_fill', 'translate_word', 'def_to_word', 'derive_form', 'fill_verb', 'fix_error',
    'fix_paragraph', 'trap_translate', 'three_forms', 'pronoun_placement', 'formal_synonym', 'translate_bank'],
  ordering: ['unscramble_letters', 'order_blocks', 'build_from_keywords', 'order_dialogue', 'order_paragraphs'],
  matching: ['match_pairs', 'categorize', 'group_irregulars', 'match_headings'],
  cloze: ['cloze_bank', 'phrase_cloze', 'complete_dialogue', 'gap_sentences'],
  transform: ['transform', 'keyword_transform', 'join_sentences', 'register_shift'],
  audio: ['spell_from_audio', 'dictation', 'cloze_audio', 'connected_speech', 'minimal_pair_listen', 'listen_comprehension',
    'what_did_they_say', 'follow_instruction', 'extensive_listening'],
  speak: ['read_aloud_score', 'echo_repeat', 'minimal_pair_speak', 'sound_drill', 'stress_mark', 'rhythm_sentence',
    'describe_image_speak', 'voice_chat'],
  reading: ['read_local_q', 'read_global_q', 'read_tfng', 'read_reference', 'read_inference', 'free_read_tap'],
  writing: ['write_guided', 'write_hidden_goals', 'write_email', 'write_describe_image', 'write_continue_story', 'write_essay',
    'write_rewrite', 'write_own_errors'],
  mediation: ['med_summarize', 'med_explain_layperson', 'med_register', 'med_speech_act', 'med_cross_language'],
  open_ai: ['own_sentence_word', 'own_sentence_grammar', 'explain_rule', 'own_sentence_verb', 'translate_free', 'summarize_one_line'],
};

const AUTO_FAMILIES = new Set(['choice', 'text_input', 'ordering', 'matching', 'cloze', 'transform', 'audio', 'reading']);
const ACCEPT_FAMILIES = new Set(['text_input', 'transform']);
const ACCEPT_EXTRA = new Set(['phrase_cloze']); // cloze que se teclea (o se dicta)
const ACCEPT_OPTIONAL = new Set(['three_forms']); // se escribe, pero sus respuestas viven en data.forms; `accept` es opcional (2.5-T3, respuesta 9 del Administrador)
const AUDIO_EXTRA = new Set(['phrase_cloze']); // "teclado o voz" (8.9)
const SPEAK_AUTO_AI = true; // habla: ✔ (Azure) y IA

export const INTEGRATOR_TYPES = Object.freeze(['detective_errors', 'weekly_mission', 'simulacro', 'daily_session']);

function build() {
  const out = {};
  for (const [family, types] of Object.entries(BY_FAMILY)) {
    for (const t of types) {
      if (Object.prototype.hasOwnProperty.call(out, t)) throw new Error(`contentTypes: tipo repetido: ${t}`);
      const speak = family === 'speak';
      out[t] = Object.freeze({
        family,
        auto: AUTO_FAMILIES.has(family) || (speak && SPEAK_AUTO_AI),
        ai: speak || ['writing', 'mediation', 'open_ai'].includes(family),
        audio: family === 'audio' || speak || AUDIO_EXTRA.has(t),
        acceptRequired: (ACCEPT_FAMILIES.has(family) || ACCEPT_EXTRA.has(t)) && !ACCEPT_OPTIONAL.has(t),
      });
    }
  }
  return Object.freeze(out);
}

export const ITEM_TYPES = build();

const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

export function isItemType(t) { return typeof t === 'string' && own(ITEM_TYPES, t); }
export function isIntegratorType(t) { return typeof t === 'string' && INTEGRATOR_TYPES.includes(t); }
export function typeInfo(t) { return isItemType(t) ? ITEM_TYPES[t] : null; }
export function typesOfFamily(f) { return Object.keys(ITEM_TYPES).filter((t) => ITEM_TYPES[t].family === f); }

// El tipo del catálogo más parecido (hasta 2 ediciones), para el mensaje "¿quisiste decir…?". Nunca lanza.
export function suggestType(t) {
  if (typeof t !== 'string' || t === '' || t.length > 60) return null;
  let best = null;
  let bestD = 3;
  for (const name of Object.keys(ITEM_TYPES)) {
    const d = damerauLevenshtein(t, name, 2);
    if (d < bestD) { bestD = d; best = name; }
  }
  return best;
}
