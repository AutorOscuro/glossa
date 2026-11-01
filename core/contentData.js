// @purpose: Contrato del campo data de cada familia de ejercicio autocalificable y sus comprobaciones.
// Contrato `data` por familia autocalificable (subparte 1.3, cuarto 2, mitad A). Roadmap 8.3 y 8.9. Puro.
//   DATA_SPECS { choice, text_input, ordering, matching, cloze, transform, audio, speak, reading, writing, mediation, open_ai }   (las 12 familias)  (mismo formato que `ctx.dataSpecs` de validateItem)
//   checkChoiceDistractors(report, path, item)   regla cruzada de los ítems de elección con `Item.distractors` (roadmap 8.10, regla de calidad)
//   checkPhraseClozeItem(report, path, item)     reglas cruzadas de `key_es`, `key_en` y `turns` (solo `phrase_cloze`; 2.2); PHRASE_CLOZE_FIELDS
//   checkOrderItem(report, path, item)           reglas cruzadas de la familia `ordering`: `blocks` (order_blocks), `lines` (order_dialogue) o `pieces` (los demás); ORDER_ONLY (2.4-T1)
//   checkFormsItem(report, path, item)           reglas cruzadas de `data.forms`: obligatorio en three_forms, prohibido en los demás de text_input (2.5-T3); FORM_FIELDS
//   checkAudioItem(report, path, item)           reglas cruzadas de los ítems de audio con `accept` y el tipo (2B, parte 1)
//   checkTypedItem(report, path, item)           obligatorios por tipo en speak, reading, writing, mediation y open_ai (2B, parte 2)
//   CODE_OPTIONAL_CHOICE_TYPES                   tipos de elección de vocabulario donde el `code` del distractor es opcional (decisión del Administrador, pregunta 5)
// Lo cablea `contentItem.js`: sin `ctx.dataSpecs` se usa DATA_SPECS. Contrato de cada `data`: docs/CONTRACTS.md 1.3-2A.
import { LIMITS, check as checkSpec, joinPath, text, int, bool, oneOf, list, obj, custom, optional, nullable } from './contentRules.js';
import { isPlain } from './contentCommon.js';
import { normalize } from './normalize.js';
import { typeInfo } from './contentTypes.js';
import { ORDER_LIMITS, DIALOGUE_LIMITS } from './orderBlocks.js';

export const BLANK = '___';

// Decisión del Administrador (pregunta 5, 2026-10-18): en los tipos de elección de la fila «Vocabulario» de 8.9 el `code` del distractor es
// OPCIONAL (un distractor puede ser solo «otra palabra parecida»; exigir un code obligaría a inventar errores y ensuciaría el registro).
// En el resto de tipos de elección (gramática, verbos, preposiciones, ortografía…) sigue siendo obligatorio. Si trae code, debe existir
// en error_codes.json (`UNKNOWN_CODE`, lo valida el contexto). El falso amigo o calco de verdad debe llevar `LEX.FALSE_FRIEND` o
// `LEX.CALQUE`: lo hace el chat de contenido, el validador no lo exige.
export const CODE_OPTIONAL_CHOICE_TYPES = Object.freeze(['mcq_en_es', 'mcq_es_en', 'odd_one_out', 'pick_fits', 'lightning']);
const blanks = (s) => (typeof s === 'string' ? s.split(BLANK).length - 1 : 0);

const choice = obj({
  options: list(text(LIMITS.text), { min: 2, max: 8, unique: true }),
  correct: custom((r, path, v, ctx) => {
    if (!Number.isInteger(v) || v < 0 || v > 7) r.error(path, 'RANGE', 'debe ser un entero 0–7 (índice en options)');
  }),
  shuffle: optional({ kind: 'bool' }),
});

// `forms` es solo de three_forms (2.5-T3, respuestas 9 y 10): las tres formas del verbo, cada una con un texto o una lista de grafías válidas («learnt», «learned»).
const formValue = custom((r, path, v, ctx) => {
  if (typeof v === 'string') checkSpec(r, path, v, text(LIMITS.short), ctx);
  else checkSpec(r, path, v, list(text(LIMITS.short), { min: 1, max: 10 }), ctx);
});
export const FORM_FIELDS = Object.freeze(['present', 'past', 'participle']);
const text_input = obj({
  hint: nullable(text()),
  mask: optional(oneOf(['none', 'first_letter', 'length'])),
  forms: optional(obj({ present: formValue, past: formValue, participle: formValue })),
});

// `pieces` y `extra_pieces` los usan los tipos que no son order_blocks ni order_dialogue; `blocks` (order_blocks), `lines` (order_dialogue) y
// `shuffle` son de esos dos (ampliación 1.3-2A de 2.4-T1). Qué tipo exige qué lo dice `checkOrderItem`.
const ordering = obj({
  pieces: optional(list(text(LIMITS.short), { min: 2, max: 12 })), // en el orden CORRECTO; la app los mezcla
  extra_pieces: optional(list(text(LIMITS.short), { max: 4 })),
  blocks: optional(list(text(ORDER_LIMITS.blockLength), { min: ORDER_LIMITS.min, max: ORDER_LIMITS.max })), // order_blocks, en el orden CORRECTO
  lines: optional(list(obj({ speaker: text(DIALOGUE_LIMITS.speakerLength), text: text(ORDER_LIMITS.blockLength) }), { min: DIALOGUE_LIMITS.min, max: DIALOGUE_LIMITS.max })), // order_dialogue
  shuffle: optional(bool()), // false conserva el orden dado
});

const matching = obj({
  pairs: list(obj({ left: text(LIMITS.short), right: text(LIMITS.short) }), { min: 2, max: 10 }),
  extra_right: optional(list(text(LIMITS.short), { max: 4 })),
});

const cloze = obj({
  text: text(LIMITS.text),
  answers: list(list(text(LIMITS.short), { min: 1, max: 10 }), { min: 1, max: 6 }), // por hueco, las respuestas válidas
  bank: optional(list(text(LIMITS.short), { max: 20 })),
  // Solo en `phrase_cloze` (decisión del Administrador, 2026-10-27): la palabra clave en ES y EN y los turnos A/B de la tarjeta.
  key_es: optional(text(120)),
  key_en: optional(text(60)),
  turns: optional(list(obj({ who: oneOf(['A', 'B']), es: text(300), en: optional(text(LIMITS.text)) }), { min: 2, max: 6 })),
});

const transform = obj({
  source: text(),
  instruction_es: nullable(text()),
  keyword: nullable(text(LIMITS.short)),
});

// Familia `audio` (2B, parte 1): los 9 tipos de escucha. El audio real vive en `Item.audio` (puede faltar: mientras tanto la app lee
// `transcript` con la voz del navegador). Se contesta escribiendo (`accept` del Item) o eligiendo (`options` + `correct`).
const audio = obj({
  transcript: text(LIMITS.long, { multiline: true }), // lo que dice el audio: respaldo de voz y texto que se revela al final
  text: optional(text(LIMITS.text)), // cloze_audio: la frase con ___
  options: optional(list(text(LIMITS.text), { min: 2, max: 6, unique: true })),
  correct: optional(int(0, 5)),
  speed: optional(oneOf(['slow', 'normal', 'fast'])), // velocidad inicial
  max_plays: optional(int(1, 10)),
  show_transcript: optional(bool()), // false = sin transcripción mientras se contesta
});

// Familias de la 2B, parte 2. Todos los campos son opcionales en la especificación; lo que cada TIPO exige lo dice REQUIRED_BY_TYPE.
const speak = obj({
  target: optional(text(LIMITS.text)), // lo que se lee, repite o practica
  sound: optional(text(LIMITS.short)), // sound_drill: el sonido (p. ej. /ɪ/)
  pair: optional(list(text(LIMITS.short), { min: 2, max: 2 })), // minimal_pair_speak
  syllables: optional(list(text(LIMITS.short), { min: 2, max: 8 })), // stress_mark
  stress: optional(int(0, 7)), // stress_mark: índice de la sílaba tónica
  scenario_es: optional(text(LIMITS.long, { multiline: true })), // describe_image_speak, voice_chat: la consigna
  tip_es: optional(text(LIMITS.text)), // pista de cómo colocar la boca
  max_seconds: optional(int(5, 300)),
});
const SEGMENT_ID_RE = /^[a-z][a-z0-9_]{0,19}$/;
const reading = obj({
  passage: optional(text(LIMITS.long, { multiline: true })), // el texto; en una Story el ítem lo toma de sus segmentos
  segment: optional({ kind: 'id', re: SEGMENT_ID_RE, what: 'un id de segmento como s1 (minúsculas, dígitos y _)' }),
  options: optional(list(text(LIMITS.text), { min: 2, max: 6, unique: true })),
  correct: optional(int(0, 5)),
  answer: optional(oneOf(['true', 'false', 'not_stated'])), // solo read_tfng
});
const rubric = optional(list(text(), { min: 1, max: 8 })); // criterios que ve la IA y, al final, William
const writing = obj({
  min_words: optional(int(1, 2000)),
  max_words: optional(int(1, 2000)),
  goals: optional(list(text(LIMITS.short), { min: 1, max: 10, unique: true })), // estructuras ocultas (write_hidden_goals)
  source_text: optional(text(LIMITS.long, { multiline: true })), // texto a reescribir o continuar
  rubric_es: rubric,
});
export const SPEECH_ACTS = Object.freeze(['request', 'refuse', 'apologize', 'suggest', 'complain', 'thank']);
const mediation = obj({
  source_text: optional(text(LIMITS.long, { multiline: true })),
  source_lang: optional(oneOf(['en', 'es'])),
  audience_es: optional(text(LIMITS.short)), // para quién se media: un amigo, tu jefe…
  speech_act: optional(oneOf(SPEECH_ACTS)),
  register: optional(oneOf(['informal', 'neutral', 'formal'])),
  rubric_es: rubric,
});
const open_ai = obj({
  target: optional(text(LIMITS.text)), // la palabra, estructura, verbo o regla que se practica
  source_text: optional(text(LIMITS.long, { multiline: true })), // translate_free, summarize_one_line
  min_words: optional(int(1, 2000)),
  max_words: optional(int(1, 2000)),
  rubric_es: rubric,
});

// Campos que cada tipo exige además de la forma (`DATA_FIELD_REQUIRED`).
const REQUIRED_BY_TYPE = Object.freeze({
  read_aloud_score: ['target'], echo_repeat: ['target'], rhythm_sentence: ['target'], sound_drill: ['target', 'sound'],
  minimal_pair_speak: ['pair'], stress_mark: ['syllables', 'stress'], describe_image_speak: ['scenario_es'], voice_chat: ['scenario_es'],
  read_tfng: ['answer'],
  write_hidden_goals: ['goals'], write_rewrite: ['source_text'], write_continue_story: ['source_text'],
  med_summarize: ['source_text'], med_explain_layperson: ['source_text'], med_register: ['source_text', 'register'],
  med_speech_act: ['speech_act'], med_cross_language: ['source_text', 'source_lang'],
  own_sentence_word: ['target'], own_sentence_grammar: ['target'], own_sentence_verb: ['target'], explain_rule: ['target'],
  translate_free: ['source_text'], summarize_one_line: ['source_text'],
});

// `options` y `correct` van juntos y `correct` cae dentro de la lista (audio y reading).
function checkChoicePair(r, path, d, code) {
  const hasOptions = d.options !== undefined;
  const hasCorrect = d.correct !== undefined;
  if (hasOptions && !hasCorrect) r.error(`${path}.correct`, code, 'si hay options, falta correct (índice de la opción correcta)');
  else if (hasCorrect && !hasOptions) r.error(`${path}.options`, code, 'si hay correct, faltan las options');
  else if (hasOptions && Array.isArray(d.options) && d.correct >= d.options.length) {
    r.error(`${path}.correct`, 'RANGE', `apunta a la opción ${d.correct}, pero options solo tiene ${d.options.length}`);
  }
}

// Reglas entre campos de `data` (se aplican con checkData).
export function checkData(r, path, family, data) {
  if (!isPlain(data)) return;
  const d = { ...data };
  if (family === 'choice' && Array.isArray(d.options) && Number.isInteger(d.correct) && d.correct >= d.options.length) {
    r.error(`${path}.correct`, 'RANGE', `apunta a la opción ${d.correct}, pero options solo tiene ${d.options.length}`);
  }
  if (family === 'audio') checkChoicePair(r, path, d, 'AUDIO_CHOICE_INCOMPLETE');
  if (family === 'reading') checkChoicePair(r, path, d, 'READING_CHOICE_INCOMPLETE');
  if (family === 'speak' && Array.isArray(d.syllables) && Number.isInteger(d.stress) && d.stress >= d.syllables.length) {
    r.error(`${path}.stress`, 'RANGE', `apunta a la sílaba ${d.stress}, pero syllables solo tiene ${d.syllables.length}`);
  }
  if ((family === 'writing' || family === 'open_ai') && Number.isInteger(d.min_words) && Number.isInteger(d.max_words) && d.min_words > d.max_words) {
    r.error(`${path}.max_words`, 'WORDS_RANGE', `max_words (${d.max_words}) no puede ser menor que min_words (${d.min_words})`);
  }
  if (family === 'matching' && Array.isArray(d.pairs)) {
    for (const side of ['left', 'right']) {
      const seen = new Set();
      d.pairs.slice(0, 10).forEach((p, i) => {
        if (!isPlain(p) || typeof p[side] !== 'string') return;
        if (seen.has(p[side])) r.error(`${path}.pairs[${i}].${side}`, 'DUPLICATE', 'está repetido');
        else seen.add(p[side]);
      });
    }
  }
  if (family === 'cloze' && typeof d.text === 'string' && Array.isArray(d.answers)) {
    const n = blanks(d.text);
    if (n === 0) r.error(`${path}.text`, 'CLOZE_NO_BLANK', `debe llevar al menos un hueco (${BLANK})`);
    else if (n !== d.answers.length) r.error(`${path}.answers`, 'CLOZE_BLANKS_MISMATCH', `el texto tiene ${n} hueco(s) y answers tiene ${d.answers.length} lista(s)`);
    else if (Array.isArray(d.bank) && d.bank.length > 0) {
      // Con banco de palabras, cada hueco debe poder resolverse con una palabra del banco.
      const bank = new Set(d.bank.slice(0, 20).filter((b) => typeof b === 'string').map((b) => normalize(b)));
      d.answers.slice(0, 6).forEach((list_, i) => {
        if (Array.isArray(list_) && !list_.some((a) => typeof a === 'string' && bank.has(normalize(a)))) {
          r.error(`${path}.answers[${i}]`, 'CLOZE_BANK_MISSING_ANSWER', 'ninguna respuesta válida de este hueco está en bank');
        }
      });
    }
  }
}

// Reglas cruzadas de un ítem de la familia `cloze` (con `data` ya sin errores). `key_es`, `key_en` y `turns` solo existen en `phrase_cloze`; y `key_es`
// debe aparecer como fragmento (sin distinguir mayúsculas) en `prompt_es` o en algún `turns[].es`, para que la tarjeta pueda resaltarla.
export const PHRASE_CLOZE_FIELDS = Object.freeze(['key_es', 'key_en', 'turns']);
export function checkPhraseClozeItem(r, path, item) {
  if (!isPlain(item)) return;
  const it = { ...item };
  const d = isPlain(it.data) ? { ...it.data } : null;
  if (!d) return;
  const dataPath = joinPath(path, 'data');
  if (it.type !== 'phrase_cloze') {
    for (const f of PHRASE_CLOZE_FIELDS) {
      if (d[f] !== undefined) r.error(joinPath(dataPath, f), 'PHRASE_CLOZE_ONLY', `data.${f} solo se usa en phrase_cloze (el tipo es ${it.type})`);
    }
    return;
  }
  if (typeof d.key_es === 'string') {
    const key = d.key_es.toLowerCase();
    const where = [it.prompt_es, ...(Array.isArray(d.turns) ? d.turns.map((t) => (isPlain(t) ? t.es : undefined)) : [])];
    if (!where.some((w) => typeof w === 'string' && w.toLowerCase().includes(key))) {
      r.error(joinPath(dataPath, 'key_es'), 'KEY_NOT_IN_TEXT', 'key_es debe aparecer en prompt_es o en algún turns[].es');
    }
  }
}

// Reglas cruzadas de un ítem de audio (con `data` ya sin errores): debe poder contestarse (`data.options` o `accept`; `extensive_listening`
// se califica por tiempo de escucha y queda exento) y `cloze_audio` lleva en `data.text` la frase con hueco.
export function checkAudioItem(r, path, item) {
  if (!isPlain(item)) return;
  const it = { ...item };
  const d = isPlain(it.data) ? { ...it.data } : null;
  if (!d) return;
  const hasAccept = Array.isArray(it.accept) && it.accept.length > 0;
  if (it.type !== 'extensive_listening' && d.options === undefined && !hasAccept) {
    r.error(joinPath(path, 'accept'), 'AUDIO_NOT_ANSWERABLE', `el tipo ${it.type} necesita accept (respuesta escrita) o data.options + data.correct (elección)`);
  }
  if (it.type === 'cloze_audio' && blanks(d.text) === 0) {
    r.error(joinPath(joinPath(path, 'data'), 'text'), 'CLOZE_NO_BLANK', `cloze_audio necesita data.text con al menos un hueco (${BLANK})`);
  }
}

// Reglas cruzadas de un ítem de la familia `ordering` (con `data` ya sin errores; 2.4-T1, ampliación 1.3-2A). order_blocks exige `data.blocks`,
// order_dialogue exige `data.lines`, y los demás tipos de la familia siguen con `data.pieces`. Cada campo solo vale en su tipo (`ORDER_ONLY`);
// `accept` (opcional) no se mira aquí: su tope (ORDER_LIMITS.acceptLength = LIMITS.text = 600) ya lo impone el Item común (una prueba vigila que sean iguales).
const ORDER_OWN = Object.freeze({ order_blocks: 'blocks', order_dialogue: 'lines' });
export function checkOrderItem(r, path, item) {
  if (!isPlain(item)) return;
  const it = { ...item };
  const d = isPlain(it.data) ? { ...it.data } : null;
  if (!d) return;
  const dataPath = joinPath(path, 'data');
  const own = ORDER_OWN[it.type] || 'pieces';
  if (d[own] === undefined) r.error(joinPath(dataPath, own), 'DATA_FIELD_REQUIRED', `el tipo ${it.type} necesita data.${own}`);
  for (const f of ['pieces', 'extra_pieces', 'blocks', 'lines', 'shuffle']) {
    const mine = f === own || (own === 'pieces' && f === 'extra_pieces') || (f === 'shuffle' && ORDER_OWN[it.type] !== undefined);
    if (!mine && d[f] !== undefined) r.error(joinPath(dataPath, f), 'ORDER_ONLY', `data.${f} no se usa en el tipo ${it.type}${ORDER_OWN[it.type] ? `: este tipo usa data.${own}` : ''}`);
  }
}

// Reglas cruzadas de la familia `text_input` (con `data` ya sin errores; 2.5-T3, ampliación 1.3-2A): three_forms exige `data.forms` con las tres formas
// (presente, pasado y participio); `forms` en cualquier otro tipo de la familia es un error (`FORMS_ONLY`). Su `accept` es opcional (ver contentTypes.js).
export function checkFormsItem(r, path, item) {
  if (!isPlain(item)) return;
  const it = { ...item };
  const d = isPlain(it.data) ? { ...it.data } : null;
  if (!d) return;
  const dataPath = joinPath(path, 'data');
  if (it.type === 'three_forms') {
    if (d.forms === undefined) r.error(joinPath(dataPath, 'forms'), 'DATA_FIELD_REQUIRED', 'el tipo three_forms necesita data.forms con present, past y participle');
  } else if (d.forms !== undefined) {
    r.error(joinPath(dataPath, 'forms'), 'FORMS_ONLY', `data.forms solo se usa en three_forms, no en ${it.type}`);
  }
}

// Obligatorios por tipo en speak, reading, writing, mediation y open_ai (con `data` ya sin errores). En reading además: `answer` solo en
// `read_tfng`, y todo tipo salvo `read_tfng` y `free_read_tap` (no se califica) debe poder contestarse con `data.options` + `correct` o `accept`.
export function checkTypedItem(r, path, item) {
  if (!isPlain(item)) return;
  const it = { ...item };
  const d = isPlain(it.data) ? { ...it.data } : null;
  if (!d) return;
  for (const field of REQUIRED_BY_TYPE[it.type] || []) {
    if (d[field] === undefined) r.error(joinPath(joinPath(path, 'data'), field), 'DATA_FIELD_REQUIRED', `el tipo ${it.type} necesita data.${field}`);
  }
  const family = typeInfo(it.type)?.family;
  if (family === 'reading') {
    if (it.type !== 'read_tfng' && d.answer !== undefined) {
      r.error(joinPath(joinPath(path, 'data'), 'answer'), 'READING_ANSWER_ONLY_TFNG', 'answer solo se usa en read_tfng (verdadero, falso o el texto no lo dice)');
    }
    const hasAccept = Array.isArray(it.accept) && it.accept.length > 0;
    if (it.type !== 'read_tfng' && it.type !== 'free_read_tap' && d.options === undefined && !hasAccept) {
      r.error(joinPath(path, 'accept'), 'READING_NOT_ANSWERABLE', `el tipo ${it.type} necesita accept (respuesta escrita) o data.options + data.correct (elección)`);
    }
  }
}

// Regla cruzada de los ítems de elección: la 8.10 pide que todo ítem de elección traiga distractores basados en errores reales
// (campo `code`). Aquí: cada opción incorrecta tiene un distractor con `code`; ningún distractor es la opción correcta ni una
// frase que no esté en `options`; las opciones no se repiten al normalizar. Si `data` ya está mal, no apila más errores.
export function checkChoiceDistractors(r, path, item) {
  if (!isPlain(item)) return;
  const it = { ...item };
  const d = isPlain(it.data) ? { ...it.data } : null;
  if (!d || !Array.isArray(d.options) || !Number.isInteger(d.correct) || d.correct < 0 || d.correct >= d.options.length) return;
  const opts = d.options.slice(0, 8).map((o) => (typeof o === 'string' ? normalize(o) : null));
  const dataPath = joinPath(path, 'data');
  const distPath = joinPath(path, 'distractors');

  const firstAt = new Map();
  opts.forEach((o, i) => {
    if (o === null) return;
    if (firstAt.has(o)) r.error(joinPath(joinPath(dataPath, 'options'), i), 'DUPLICATE', 'es la misma opción que otra de la lista al normalizar (mayúsculas, puntuación final)');
    else firstAt.set(o, i);
  });

  const optionalCode = CODE_OPTIONAL_CHOICE_TYPES.includes(it.type); // vocabulario: sin distractor ni code obligatorios
  const correctN = opts[d.correct];
  const coded = new Set(); // índices de opciones incorrectas con un distractor con code
  const mentioned = new Set(); // índices de opciones incorrectas con algún distractor
  const dists = Array.isArray(it.distractors) ? it.distractors.slice(0, 20) : [];
  dists.forEach((x, i) => {
    if (!isPlain(x) || typeof x.text !== 'string') return;
    const here = joinPath(distPath, i);
    const n = normalize(x.text);
    if (n === correctN) { r.error(joinPath(here, 'text'), 'CHOICE_DISTRACTOR_IS_CORRECT', 'es la opción correcta de data.options: se marcaría como error algo correcto'); return; }
    const idx = firstAt.has(n) ? firstAt.get(n) : -1;
    if (idx === -1) { r.error(joinPath(here, 'text'), 'DISTRACTOR_NOT_OPTION', 'no es ninguna de las opciones de data.options'); return; }
    mentioned.add(idx);
    if (typeof x.code === 'string' && x.code !== '') coded.add(idx);
    else if (!optionalCode) r.error(joinPath(here, 'code'), 'CHOICE_CODE_MISSING', 'los distractores de un ítem de elección llevan el code del error real que representan (8.10)');
  });

  opts.forEach((o, i) => {
    if (optionalCode || o === null || i === d.correct || firstAt.get(o) !== i) return;
    if (!mentioned.has(i)) r.error(joinPath(joinPath(dataPath, 'options'), i), 'CHOICE_DISTRACTOR_MISSING', 'esta opción incorrecta no tiene su distractor con code en distractors (8.10)');
  });
}

// Envuelve cada especificación para que también aplique las reglas entre campos.
const wrap = (family, spec) => custom((r, path, v, ctx) => {
  const before = r.result().errorTotal;
  checkSpec(r, path, v, spec, ctx);
  if (r.result().errorTotal === before) checkData(r, path, family, v);
});

export const DATA_SPECS = Object.freeze({
  choice: wrap('choice', choice),
  text_input: wrap('text_input', text_input),
  ordering: wrap('ordering', ordering),
  matching: wrap('matching', matching),
  cloze: wrap('cloze', cloze),
  transform: wrap('transform', transform),
  audio: wrap('audio', audio),
  speak: wrap('speak', speak),
  reading: wrap('reading', reading),
  writing: wrap('writing', writing),
  mediation: wrap('mediation', mediation),
  open_ai: wrap('open_ai', open_ai),
});
