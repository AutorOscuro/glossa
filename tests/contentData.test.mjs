// @purpose: Pruebas del contrato data de cada familia de ejercicio (core/contentData.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { DATA_SPECS, CODE_OPTIONAL_CHOICE_TYPES } from '../core/contentData.js';
import { typeInfo, typesOfFamily } from '../core/contentTypes.js';
import { validateItem } from '../core/contentItem.js';

const base = (type, data, extra = {}) => ({
  id: 'gram.pp.0001', type, topics: ['gram.present_perfect.form'], level: 'A2', prompt_es: 'x', data,
  explain_es: 'x', source: 'original', version: 1, ...extra,
});
const run = (type, data, extra) => validateItem(base(type, data, extra), { dataSpecs: DATA_SPECS });
const rules = (r) => r.errors.map((e) => e.rule);

test('DATA_SPECS cubre las 12 familias del catálogo', () => {
  assert.deepEqual(Object.keys(DATA_SPECS).sort(), ['audio', 'choice', 'cloze', 'matching', 'mediation', 'open_ai', 'ordering', 'reading', 'speak', 'text_input', 'transform', 'writing']);
});
test('choice válido y con correct fuera de rango', () => {
  const dist = { distractors: [{ text: 'a', code: 'TNS.SINCE_FOR' }] };
  assert.equal(run('choose_correct', { options: ['a', 'b'], correct: 1 }, dist).ok, true);
  assert.ok(rules(run('choose_correct', { options: ['a', 'b'], correct: 2 })).includes('RANGE'));
  assert.ok(rules(run('choose_correct', { options: ['a'], correct: 0 })).includes('LIST_SIZE'));
});
test('ordering y matching', () => {
  assert.equal(run('order_blocks', { blocks: ['I', 'have', 'eaten'] }, { accept: ['I have eaten'] }).ok, true);
  assert.ok(rules(run('order_blocks', { blocks: ['I'] })).includes('LIST_SIZE'));
  assert.equal(run('build_from_keywords', { pieces: ['I', 'have', 'eaten'] }, { accept: ['I have eaten'] }).ok, true);
  assert.equal(run('match_pairs', { pairs: [{ left: 'a', right: 'b' }, { left: 'c', right: 'd' }] }).ok, true);
  assert.ok(rules(run('match_pairs', { pairs: [{ left: 'a', right: 'b' }, { left: 'a', right: 'd' }] })).includes('DUPLICATE'));
});
test('cloze: huecos y respuestas deben coincidir', () => {
  assert.equal(run('cloze_bank', { text: 'I ___ it.', answers: [['saw']] }).ok, true);
  assert.ok(rules(run('cloze_bank', { text: 'I ___ it.', answers: [['saw'], ['x']] })).includes('CLOZE_BLANKS_MISMATCH'));
  assert.ok(rules(run('cloze_bank', { text: 'I saw it.', answers: [['saw']] })).includes('CLOZE_NO_BLANK'));
});
test('text_input y transform; campo desconocido se rechaza', () => {
  assert.equal(run('fill_verb', { hint: null }, { accept: ['went'] }).ok, true);
  assert.equal(run('transform', { source: 'He went.', instruction_es: null, keyword: null }, { accept: ['He did go.'] }).ok, true);
  assert.ok(rules(run('fill_verb', { hint: null, raro: 1 }, { accept: ['went'] })).includes('UNKNOWN_FIELD'));
});

// ---------- 2A: distractores con `code` en los ítems de elección (roadmap 8.10, regla de calidad) ----------
const D = (text, code = 'TNS.SINCE_FOR') => ({ text, code });
const choiceItem = (data, distractors, extra = {}) => ({ type: 'choose_correct', data, distractors, ...extra });
const runChoice = (o, ctx) => validateItem(base(o.type, o.data, { distractors: o.distractors, ...(o.extra || {}) }), ctx);
const at = (r) => r.errors.map((e) => `${e.path}:${e.rule}`);
const OPTS = { options: ['I have lived here for two years.', 'I live here since two years.', 'I am living here since two years.'], correct: 0 };

test('choice con distractores con code para cada opción incorrecta pasa', () => {
  const r = runChoice(choiceItem(OPTS, [D(OPTS.options[1]), D(OPTS.options[2], 'TNS.PRES_CONT_STATE')]));
  assert.deepEqual(at(r), []);
  assert.equal(r.ok, true);
});
test('choice sin distractores: falta uno por cada opción incorrecta', () => {
  assert.deepEqual(at(runChoice(choiceItem(OPTS, undefined))), ['data.options[1]:CHOICE_DISTRACTOR_MISSING', 'data.options[2]:CHOICE_DISTRACTOR_MISSING']);
  assert.deepEqual(at(runChoice(choiceItem(OPTS, [D(OPTS.options[1])]))), ['data.options[2]:CHOICE_DISTRACTOR_MISSING']);
});
test('choice: un distractor sin code es error', () => {
  const r = runChoice(choiceItem(OPTS, [D(OPTS.options[1]), { text: OPTS.options[2], code: null }]));
  assert.deepEqual(at(r), ['distractors[1].code:CHOICE_CODE_MISSING']);
  const r2 = runChoice(choiceItem(OPTS, [D(OPTS.options[1]), { text: OPTS.options[2] }]));
  assert.deepEqual(at(r2), ['distractors[1].code:CHOICE_CODE_MISSING']);
});
test('choice: el distractor debe ser una de las opciones y no la correcta', () => {
  const stray = runChoice(choiceItem(OPTS, [D(OPTS.options[1]), D(OPTS.options[2]), D('Otra frase.')]));
  assert.deepEqual(at(stray), ['distractors[2].text:DISTRACTOR_NOT_OPTION']);
  const isCorrect = runChoice(choiceItem(OPTS, [D(OPTS.options[1]), D(OPTS.options[2]), D('i have lived here for two years')]));
  assert.deepEqual(at(isCorrect), ['distractors[2].text:CHOICE_DISTRACTOR_IS_CORRECT']);
});
test('choice: opciones repetidas al normalizar son error', () => {
  const r = runChoice(choiceItem({ options: ['Went', 'went.', 'gone'], correct: 0 }, [D('went.'), D('gone')]));
  assert.ok(at(r).includes('data.options[1]:DUPLICATE'));
});
test('choice: el code del distractor debe existir si el contexto trae el catálogo', () => {
  const ctx = { errorCodes: new Set(['TNS.SINCE_FOR']) };
  const r = runChoice(choiceItem(OPTS, [D(OPTS.options[1]), D(OPTS.options[2], 'TNS.NO_EXISTE')]), ctx);
  assert.deepEqual(at(r), ['distractors[1].code:UNKNOWN_CODE']);
});
test('choice: si data ya está mal no se apilan errores de distractores', () => {
  const r = runChoice(choiceItem({ options: ['a', 'b'], correct: 5 }, undefined));
  assert.deepEqual(at(r), ['data.correct:RANGE']);
  // data con otro error (shuffle mal tipado) y sin distractores: solo se informa el error de data
  const r2 = runChoice(choiceItem({ options: ['a', 'b', 'c'], correct: 0, shuffle: 'si' }, undefined));
  assert.deepEqual(at(r2), ['data.shuffle:TYPE']);
});
test('las demás familias no exigen distractores', () => {
  assert.equal(run('order_blocks', { blocks: ['I', 'have', 'eaten'] }, { accept: ['I have eaten'] }).ok, true);
  assert.equal(run('cloze_bank', { text: 'I ___ it.', answers: [['saw']] }).ok, true);
});

// ---------- 2A: DATA_SPECS se cablea por defecto en el validador ----------
test('validateItem usa DATA_SPECS por defecto; un ctx propio lo reemplaza', () => {
  const item = base('choose_correct', { options: ['a'], correct: 0 }, { distractors: [] });
  assert.ok(rules(validateItem(item)).includes('LIST_SIZE'));
  assert.ok(rules(validateItem(item, {})).includes('LIST_SIZE'));
  assert.ok(rules(validateItem(item, { errorCodes: new Set() })).includes('LIST_SIZE'));
  assert.equal(validateItem(item, { dataSpecs: {} }).ok, true); // un ctx explícito manda (solo exige objeto)
});

// ---------- 2A: cloze con banco ----------
test('cloze con banco: cada hueco debe tener una respuesta dentro del banco', () => {
  const ok = run('cloze_bank', { text: 'I ___ it.', answers: [['saw']], bank: ['saw', 'seen'] });
  assert.equal(ok.ok, true);
  const bad = run('cloze_bank', { text: 'I ___ it.', answers: [['saw']], bank: ['seen', 'see'] });
  assert.deepEqual(at(bad), ['data.answers[0]:CLOZE_BANK_MISSING_ANSWER']);
});

// ---------- 2B, parte 1: familia `audio` ----------
const aud = (type, data, extra) => validateItem(base(type, data, extra));
test('audio escrito (dictation): transcript + accept pasa', () => {
  assert.deepEqual(at(aud('dictation', { transcript: 'I have lived here for two years.' }, { accept: ['I have lived here for two years.'] })), []);
  assert.equal(aud('dictation', { transcript: 'Hi.', speed: 'slow', max_plays: 3, show_transcript: false }, { accept: ['Hi.'] }).ok, true);
});
test('audio de elección: options + correct, ambos o ninguno, correct en rango', () => {
  assert.equal(aud('minimal_pair_listen', { transcript: 'ship', options: ['ship', 'sheep'], correct: 0 }).ok, true);
  assert.deepEqual(at(aud('minimal_pair_listen', { transcript: 'ship', options: ['ship', 'sheep'], correct: 2 })), ['data.correct:RANGE']);
  assert.deepEqual(at(aud('minimal_pair_listen', { transcript: 'ship', options: ['ship', 'sheep'] })), ['data.correct:AUDIO_CHOICE_INCOMPLETE']);
  assert.deepEqual(at(aud('minimal_pair_listen', { transcript: 'ship', correct: 0 }, { accept: ['ship'] })), ['data.options:AUDIO_CHOICE_INCOMPLETE']);
});
test('audio: debe poder contestarse (options o accept), salvo extensive_listening', () => {
  assert.deepEqual(at(aud('dictation', { transcript: 'Hi.' })), ['accept:AUDIO_NOT_ANSWERABLE']);
  assert.deepEqual(at(aud('dictation', { transcript: 'Hi.' }, { accept: [] })), ['accept:AUDIO_NOT_ANSWERABLE']);
  assert.equal(aud('extensive_listening', { transcript: 'A long story.' }).ok, true);
});
test('cloze_audio exige text con hueco', () => {
  assert.equal(aud('cloze_audio', { transcript: 'I saw it.', text: 'I ___ it.' }, { accept: ['saw'] }).ok, true);
  assert.deepEqual(at(aud('cloze_audio', { transcript: 'I saw it.' }, { accept: ['saw'] })), ['data.text:CLOZE_NO_BLANK']);
  assert.deepEqual(at(aud('cloze_audio', { transcript: 'I saw it.', text: 'I saw it.' }, { accept: ['saw'] })), ['data.text:CLOZE_NO_BLANK']);
});
test('audio: forma de data (transcript obligatorio, enumerados, rangos, campo desconocido)', () => {
  assert.deepEqual(at(aud('dictation', {}, { accept: ['x'] })), ['data.transcript:REQUIRED']);
  assert.deepEqual(at(aud('dictation', { transcript: 'x', speed: 'turbo' }, { accept: ['x'] })), ['data.speed:ENUM']);
  assert.deepEqual(at(aud('dictation', { transcript: 'x', max_plays: 0 }, { accept: ['x'] })), ['data.max_plays:RANGE']);
  assert.deepEqual(at(aud('dictation', { transcript: 'x', raro: 1 }, { accept: ['x'] })), ['data.raro:UNKNOWN_FIELD']);
});
test('audio: si data tiene errores no se apilan los de respuesta', () => {
  assert.deepEqual(at(aud('dictation', { speed: 'turbo' })), ['data.transcript:REQUIRED', 'data.speed:ENUM']);
});

// ---------- Decisión del Administrador sobre la pregunta 5: `code` opcional en los tipos de elección de vocabulario ----------
test('CODE_OPTIONAL_CHOICE_TYPES: exactamente los de elección de la fila Vocabulario de 8.9', () => {
  assert.deepEqual([...CODE_OPTIONAL_CHOICE_TYPES].sort(), ['lightning', 'mcq_en_es', 'mcq_es_en', 'odd_one_out', 'pick_fits']);
  assert.ok(Object.isFrozen(CODE_OPTIONAL_CHOICE_TYPES));
  for (const t of CODE_OPTIONAL_CHOICE_TYPES) assert.equal(typeInfo(t).family, 'choice', t);
});
test('los de gramática, verbos y preposiciones siguen exigiendo code en el distractor', () => {
  for (const t of typesOfFamily('choice').filter((x) => !CODE_OPTIONAL_CHOICE_TYPES.includes(x))) {
    const r = runChoice({ type: t, data: OPTS, distractors: undefined });
    assert.deepEqual(at(r), ['data.options[1]:CHOICE_DISTRACTOR_MISSING', 'data.options[2]:CHOICE_DISTRACTOR_MISSING'], t);
    const r2 = runChoice({ type: t, data: OPTS, distractors: [D(OPTS.options[1]), { text: OPTS.options[2], code: null }] });
    assert.deepEqual(at(r2), ['distractors[1].code:CHOICE_CODE_MISSING'], t);
  }
});
test('vocabulario: distractores y code opcionales; sin distractores pasa', () => {
  for (const t of CODE_OPTIONAL_CHOICE_TYPES) {
    assert.deepEqual(at(runChoice({ type: t, data: OPTS, distractors: undefined })), [], t);
    assert.deepEqual(at(runChoice({ type: t, data: OPTS, distractors: [{ text: OPTS.options[1], code: null }, { text: OPTS.options[2] }] })), [], t);
    assert.deepEqual(at(runChoice({ type: t, data: OPTS, distractors: [D(OPTS.options[1], 'LEX.FALSE_FRIEND')] })), [], t);
  }
});
test('vocabulario: un distractor presente sigue sin poder ser la correcta ni estar fuera de options', () => {
  const r = runChoice({ type: 'mcq_en_es', data: OPTS, distractors: [{ text: 'Otra frase.', code: null }, { text: OPTS.options[0], code: null }] });
  assert.deepEqual(at(r), ['distractors[0].text:DISTRACTOR_NOT_OPTION', 'distractors[1].text:CHOICE_DISTRACTOR_IS_CORRECT']);
});
test('vocabulario: si trae code, debe existir en el catálogo', () => {
  const r = runChoice({ type: 'mcq_es_en', data: OPTS, distractors: [D(OPTS.options[1], 'LEX.NO_EXISTE')] }, { errorCodes: new Set(['LEX.FALSE_FRIEND']) });
  assert.deepEqual(at(r), ['distractors[0].code:UNKNOWN_CODE']);
});

// ---------- 2B: speak, reading, writing, mediation, open_ai ----------
const A = (type, data, extra) => at(validateItem(base(type, data, { needs_ai: true, ...extra })));
test('speak: obligatorios por tipo', () => {
  assert.deepEqual(A('read_aloud_score', {}), ['data.target:DATA_FIELD_REQUIRED']);
  assert.deepEqual(A('echo_repeat', {}), ['data.target:DATA_FIELD_REQUIRED']);
  assert.deepEqual(A('rhythm_sentence', {}), ['data.target:DATA_FIELD_REQUIRED']);
  assert.deepEqual(A('sound_drill', { target: 'ship' }), ['data.sound:DATA_FIELD_REQUIRED']);
  assert.deepEqual(A('minimal_pair_speak', {}), ['data.pair:DATA_FIELD_REQUIRED']);
  assert.deepEqual(A('stress_mark', { syllables: ['ta', 'ble'] }), ['data.stress:DATA_FIELD_REQUIRED']);
  assert.deepEqual(A('describe_image_speak', {}), ['data.scenario_es:DATA_FIELD_REQUIRED']);
  assert.deepEqual(A('voice_chat', {}), ['data.scenario_es:DATA_FIELD_REQUIRED']);
});
test('speak: ejemplos válidos, rangos y formas', () => {
  assert.deepEqual(A('read_aloud_score', { target: 'I think so.', tip_es: 'Lengua entre los dientes.', max_seconds: 30 }), []);
  assert.deepEqual(A('sound_drill', { target: 'ship', sound: '/ɪ/' }), []);
  assert.deepEqual(A('minimal_pair_speak', { pair: ['ship', 'sheep'] }), []);
  assert.deepEqual(A('stress_mark', { syllables: ['ta', 'ble'], stress: 0 }), []);
  assert.deepEqual(A('stress_mark', { syllables: ['ta', 'ble'], stress: 2 }), ['data.stress:RANGE']);
  assert.deepEqual(A('minimal_pair_speak', { pair: ['ship'] }), ['data.pair:LIST_SIZE']);
  assert.deepEqual(A('echo_repeat', { target: 'x', max_seconds: 1 }), ['data.max_seconds:RANGE']);
  assert.deepEqual(A('echo_repeat', { target: 'x', raro: 1 }), ['data.raro:UNKNOWN_FIELD']);
});
test('reading: tfng exige answer; las demás se contestan con options+correct o accept; free_read_tap exento', () => {
  assert.deepEqual(A('read_tfng', { passage: 'Tom is tall.' }), ['data.answer:DATA_FIELD_REQUIRED']);
  assert.deepEqual(A('read_tfng', { passage: 'Tom is tall.', answer: 'not_stated' }), []);
  assert.deepEqual(A('read_tfng', { answer: 'maybe' }), ['data.answer:ENUM']);
  assert.deepEqual(A('read_local_q', { passage: 'Tom is tall.' }), ['accept:READING_NOT_ANSWERABLE']);
  assert.deepEqual(A('read_local_q', { passage: 'Tom is tall.', options: ['Tom', 'Ana'], correct: 0 }), []);
  assert.deepEqual(A('read_global_q', { segment: 's1' }, { accept: ['Tom'] }), []);
  assert.deepEqual(A('read_inference', { options: ['a', 'b'] }), ['data.correct:READING_CHOICE_INCOMPLETE']);
  assert.deepEqual(A('read_reference', { correct: 0 }, { accept: ['x'] }), ['data.options:READING_CHOICE_INCOMPLETE']);
  assert.deepEqual(A('read_reference', { options: ['a', 'b'], correct: 3 }), ['data.correct:RANGE']);
  assert.deepEqual(A('free_read_tap', { passage: 'Tom is tall.' }), []);
  assert.deepEqual(A('read_local_q', { options: ['a', 'b'], correct: 0, answer: 'true' }), ['data.answer:READING_ANSWER_ONLY_TFNG']);
  assert.deepEqual(A('read_local_q', { segment: 'Mal Id', options: ['a', 'b'], correct: 0 }), ['data.segment:FORMAT']);
});
test('writing: obligatorios por tipo y rango de palabras', () => {
  assert.deepEqual(A('write_hidden_goals', {}), ['data.goals:DATA_FIELD_REQUIRED']);
  assert.deepEqual(A('write_rewrite', {}), ['data.source_text:DATA_FIELD_REQUIRED']);
  assert.deepEqual(A('write_continue_story', {}), ['data.source_text:DATA_FIELD_REQUIRED']);
  assert.deepEqual(A('write_hidden_goals', { goals: ['gram.present_perfect.form'], min_words: 40, max_words: 80, rubric_es: ['Usa el tema.'] }), []);
  assert.deepEqual(A('write_email', {}), []);
  assert.deepEqual(A('write_essay', { min_words: 100, max_words: 50 }), ['data.max_words:WORDS_RANGE']);
  assert.deepEqual(A('write_own_errors', { goals: [] }), ['data.goals:LIST_SIZE']);
});
test('mediation: obligatorios por tipo', () => {
  assert.deepEqual(A('med_summarize', {}), ['data.source_text:DATA_FIELD_REQUIRED']);
  assert.deepEqual(A('med_explain_layperson', {}), ['data.source_text:DATA_FIELD_REQUIRED']);
  assert.deepEqual(A('med_register', { source_text: 'Give me the file.' }), ['data.register:DATA_FIELD_REQUIRED']);
  assert.deepEqual(A('med_speech_act', {}), ['data.speech_act:DATA_FIELD_REQUIRED']);
  assert.deepEqual(A('med_cross_language', { source_text: 'Hola' }), ['data.source_lang:DATA_FIELD_REQUIRED']);
  assert.deepEqual(A('med_register', { source_text: 'Give me the file.', register: 'formal', audience_es: 'tu jefe' }), []);
  assert.deepEqual(A('med_speech_act', { speech_act: 'apologize' }), []);
  assert.deepEqual(A('med_speech_act', { speech_act: 'gritar' }), ['data.speech_act:ENUM']);
  assert.deepEqual(A('med_cross_language', { source_text: 'Hola', source_lang: 'es' }), []);
});
test('open_ai: obligatorios por tipo', () => {
  for (const t of ['own_sentence_word', 'own_sentence_grammar', 'own_sentence_verb', 'explain_rule']) assert.deepEqual(A(t, {}), ['data.target:DATA_FIELD_REQUIRED'], t);
  for (const t of ['translate_free', 'summarize_one_line']) assert.deepEqual(A(t, {}), ['data.source_text:DATA_FIELD_REQUIRED'], t);
  assert.deepEqual(A('own_sentence_word', { target: 'knee' }), []);
  assert.deepEqual(A('translate_free', { source_text: 'Hoy llueve.', rubric_es: ['Tiempo verbal'] }), []);
  assert.deepEqual(A('explain_rule', { target: 'for/since', min_words: 5, max_words: 2 }), ['data.max_words:WORDS_RANGE']);
});
test('familias nuevas: tipos solo-IA siguen exigiendo needs_ai; no se apilan errores sobre data roto', () => {
  assert.ok(rules(validateItem(base('write_email', {}))).includes('AI_REQUIRED'));
  assert.deepEqual(A('read_aloud_score', { raro: 1 }), ['data.raro:UNKNOWN_FIELD']);
  assert.deepEqual(A('med_register', { register: 'rudo' }), ['data.register:ENUM']);
});
test('el ctx propio sigue reemplazando las reglas de las familias nuevas', () => {
  assert.equal(validateItem(base('write_hidden_goals', {}, { needs_ai: true }), { dataSpecs: {} }).ok, true);
});
