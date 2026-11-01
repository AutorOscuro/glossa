// @purpose: Pruebas de la validación de LexEntry y Story (core/contentLex.js y core/contentStory.js).
// Pruebas de core/contentLex.js y core/contentStory.js (subparte 1.3, cuarto 1, mitad B): LexEntry (8.11) y Story (8.12).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateLexEntry, checkLexEntry, LEX_POS, LEX_BAND_RE } from '../core/contentLex.js';
import { validateStory, checkStory, STORY_ID_RE } from '../core/contentStory.js';
import { createReport } from '../core/contentRules.js';

const probs = (res) => res.errors.map((e) => `${e.path}:${e.rule}`);
const warns = (res) => res.warnings.map((e) => `${e.path}:${e.rule}`);

// ---------------- LexEntry ----------------
const lex = (over = {}) => ({
  id: 'vocab.body.knee', lemma: 'knee', pos: 'noun', family: 'vocab.body', level: 'A1', band: '1K', priority: 1,
  es: ['rodilla'], def_en: 'the joint in the middle of your leg',
  examples: [{ en: 'My knee hurts.', es: 'Me duele la rodilla.' }],
  collocations: ['bend your knee'], derivation: [], false_friend_note_es: null, audio: null, image: null,
  ...over,
});

test('LexEntry: el ejemplo del contrato 8.11 pasa limpio', () => {
  const res = validateLexEntry(lex());
  assert.deepEqual([res.ok, res.errors, res.warnings], [true, [], []]);
});

test('LexEntry: mínimo válido (sin band, priority, collocations, derivation, nota, audio ni image)', () => {
  const min = { id: 'vocab.body.knee', lemma: 'knee', pos: 'noun', family: 'vocab.body', level: 'A1', es: ['rodilla'], def_en: 'a joint', examples: [{ en: 'My knee hurts.', es: 'Me duele.' }] };
  const res = validateLexEntry(min);
  assert.deepEqual([res.ok, res.errors, res.warnings], [true, [], []]);
});

test('LexEntry: cada obligatorio ausente se informa con su ruta', () => {
  for (const k of ['id', 'lemma', 'pos', 'family', 'level', 'es', 'def_en', 'examples']) {
    const e = lex(); delete e[k];
    assert.ok(probs(validateLexEntry(e)).includes(`${k}:REQUIRED`), k);
  }
});

test('LexEntry: id y familia — formato, y el id empieza por la familia', () => {
  assert.deepEqual(probs(validateLexEntry(lex({ id: 'Vocab.Knee' }))), ['id:FORMAT']);
  assert.deepEqual(probs(validateLexEntry(lex({ family: 'body' }))), ['family:FORMAT']);
  const res = validateLexEntry(lex({ id: 'vocab.home.knee' }));
  assert.deepEqual(probs(res), ['id:LEX_FAMILY_MISMATCH']); assert.match(res.errors[0].message, /vocab\.body/);
  assert.equal(validateLexEntry(lex({ id: 'phr.give_up', family: 'phr', lemma: 'give up', pos: 'phrasal_verb' })).ok, false); // familia de un solo tramo: no
  assert.equal(validateLexEntry(lex({ id: 'phr.core.give_up', family: 'phr.core', lemma: 'give up', pos: 'phrasal_verb' })).ok, true);
});

test('LexEntry: pos, level, band, priority', () => {
  for (const p of LEX_POS) assert.equal(validateLexEntry(lex({ pos: p })).ok, true, p);
  assert.deepEqual(probs(validateLexEntry(lex({ pos: 'sustantivo' }))), ['pos:ENUM']);
  assert.deepEqual(probs(validateLexEntry(lex({ level: 'A3' }))), ['level:ENUM']);
  for (const b of ['1K', '2K', '10K', '20K', 'OFF']) assert.equal(validateLexEntry(lex({ band: b })).ok, true, b);
  assert.equal(validateLexEntry(lex({ band: null })).ok, true);
  for (const b of ['0K', '21K', '1k', 'K', 'AWL ', 'a']) assert.deepEqual(probs(validateLexEntry(lex({ band: b }))), ['band:FORMAT'], b);
  assert.ok(LEX_BAND_RE.test('3K'));
  for (const p of [0, 6]) assert.deepEqual(probs(validateLexEntry(lex({ priority: p }))), ['priority:RANGE'], String(p));
  assert.deepEqual(probs(validateLexEntry(lex({ priority: '1' }))), ['priority:TYPE']);
});

test('LexEntry: es, def_en, ejemplos, colocaciones, derivación y nota', () => {
  assert.deepEqual(probs(validateLexEntry(lex({ es: [] }))), ['es:LIST_SIZE']);
  assert.deepEqual(probs(validateLexEntry(lex({ es: ['a', 'a'] }))), ['es[1]:DUPLICATE']);
  assert.deepEqual(probs(validateLexEntry(lex({ es: ['<b>x</b>'] }))), ['es[0]:TEXT_HTML']);
  assert.deepEqual(probs(validateLexEntry(lex({ def_en: '' }))), ['def_en:TEXT_EMPTY']);
  assert.deepEqual(probs(validateLexEntry(lex({ lemma: 'x'.repeat(61) }))), ['lemma:TEXT_TOO_LONG']);
  assert.deepEqual(probs(validateLexEntry(lex({ examples: [{ en: 'ok' }] }))), ['examples[0].es:REQUIRED']);
  assert.deepEqual(probs(validateLexEntry(lex({ examples: [{ en: 'ok', es: 'bien', x: 1 }] }))), ['examples[0].x:UNKNOWN_FIELD']);
  assert.deepEqual(warns(validateLexEntry(lex({ examples: [] }))), ['examples:LEX_NO_EXAMPLE']);
  assert.equal(validateLexEntry(lex({ examples: [] })).ok, true);
  assert.deepEqual(probs(validateLexEntry(lex({ collocations: ['a\u0000b'] }))), ['collocations[0]:TEXT_CONTROL']);
  assert.deepEqual(probs(validateLexEntry(lex({ derivation: 'x' }))), ['derivation:TYPE']);
  assert.deepEqual(probs(validateLexEntry(lex({ false_friend_note_es: '' }))), ['false_friend_note_es:TEXT_EMPTY']);
  assert.equal(validateLexEntry(lex({ false_friend_note_es: 'Ojo: no es "rodilla" siempre.' })).ok, true);
});

test('LexEntry: audio e image con ruta fija, y campos desconocidos', () => {
  assert.equal(validateLexEntry(lex({ audio: 'audio/vocab.body.knee.mp3', image: 'images/knee.png' })).ok, true);
  assert.deepEqual(probs(validateLexEntry(lex({ audio: '../x.mp3' }))), ['audio:FORMAT']);
  assert.deepEqual(probs(validateLexEntry(lex({ image: 'http://x.com/a.png' }))), ['image:FORMAT']);
  assert.deepEqual(probs(validateLexEntry(lex({ extra: 1 }))), ['extra:UNKNOWN_FIELD']);
});

test('LexEntry: checkLexEntry con ruta base; entradas raras y hostiles no lanzan', () => {
  const r = createReport(); checkLexEntry(r, 'lexicon[4]', lex({ def_en: '<i>x</i>' }));
  assert.deepEqual(probs(r.result()), ['lexicon[4].def_en:TEXT_HTML']);
  for (const bad of [null, undefined, 5, 'x', [], true]) assert.equal(validateLexEntry(bad).ok, false);
  const hostile = new Proxy({}, { get() { throw new Error('x'); }, ownKeys() { throw new Error('x'); } });
  assert.doesNotThrow(() => validateLexEntry(hostile));
});

test('LexEntry: fuzz de 1000 casos', () => {
  let seed = 99; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const junk = [null, undefined, 0, -3, 2.5, NaN, '', 'x', '<b>', [], {}, [1], { a: 1 }, true, 'x'.repeat(3000)];
  const keys = Object.keys(lex());
  for (let n = 0; n < 1000; n += 1) {
    const e = lex();
    for (let m = 0; m < 1 + Math.floor(rnd() * 3); m += 1) { const k = keys[Math.floor(rnd() * keys.length)]; if (rnd() < 0.2) delete e[k]; else e[k] = junk[Math.floor(rnd() * junk.length)]; }
    const res = validateLexEntry(e);
    assert.equal(res.ok, res.errorTotal === 0);
  }
});

// ---------------- Story ----------------
const question = (over = {}) => ({
  id: 'story.a1.0001.q1', type: 'read_local_q', topics: ['gram.present_simple.routines'], level: 'A1', prompt_es: '¿Qué hace Ana por la mañana?',
  data: {}, accept: ['She drinks coffee.'], explain_es: 'Lo dice el primer párrafo.', source: 'original', version: 1, ...over,
});
const story = (over = {}) => ({
  id: 'story.a1.0001', level: 'A1', title_en: 'Ana\'s morning', title_es: 'La mañana de Ana',
  topic_tags: ['daily_life'], grammar_targets: ['gram.present_simple.routines'], vocab_targets: ['vocab.home.kitchen'],
  segments: [
    { id: 's1', text: 'Ana wakes up at seven.', translation_es: 'Ana se despierta a las siete.', audio: 'audio/story.a1.0001.s1.mp3', new_words: ['wakes'] },
    { id: 's2', text: 'She drinks coffee.', translation_es: 'Ella toma café.', audio: null, new_words: [] },
  ],
  questions: [question()],
  comprehensibility: { known_pct_estimate: null },
  source: 'original', ...over,
});
const sctx = { errorCodes: new Set(['TNS.SINCE_FOR']), dataSpecs: {} }; // las reglas de `data` por familia se prueban en contentData.test.mjs

test('Story: el ejemplo del contrato 8.12 pasa limpio', () => {
  const res = validateStory(story(), sctx);
  assert.deepEqual([res.ok, res.errors, res.warnings], [true, [], []]);
  assert.ok(STORY_ID_RE.test('story.a1.0001') && !STORY_ID_RE.test('story') && !STORY_ID_RE.test('Story.a1') && !STORY_ID_RE.test('hist.a1.0001'));
});

test('Story: mínimo válido y obligatorios', () => {
  const min = { id: 'story.a1.0001', level: 'A1', title_en: 'x', title_es: 'y', segments: [{ id: 's1', text: 'Hi.' }], source: 'original' };
  assert.deepEqual([validateStory(min).ok, validateStory(min).warnings], [true, []]);
  for (const k of ['id', 'level', 'title_en', 'title_es', 'segments', 'source']) { const s = story(); delete s[k]; assert.ok(probs(validateStory(s, sctx)).includes(`${k}:REQUIRED`), k); }
  for (const k of ['topic_tags', 'grammar_targets', 'vocab_targets', 'questions', 'comprehensibility']) { const s = story(); delete s[k]; assert.equal(validateStory(s, sctx).ok, true, k); }
});

test('Story: id, level, source y títulos', () => {
  assert.deepEqual(probs(validateStory(story({ id: 'a1.0001' }), sctx)), ['id:FORMAT']);
  assert.deepEqual(probs(validateStory(story({ level: 'X' }), sctx)), ['level:ENUM']);
  assert.deepEqual(probs(validateStory(story({ source: 'bbc' }), sctx)), ['source:ENUM']);
  assert.deepEqual(probs(validateStory(story({ title_en: '<h1>x</h1>' }), sctx)), ['title_en:TEXT_HTML']);
  assert.equal(validateStory(story({ source: 'ai_generated_unverified' }), sctx).ok, true);
});

test('Story: segmentos — al menos uno, ids únicos, texto, traducción, audio y palabras nuevas', () => {
  assert.deepEqual(probs(validateStory(story({ segments: [] }), sctx)), ['segments:LIST_SIZE']);
  const dup = story(); dup.segments[1].id = 's1';
  assert.deepEqual(probs(validateStory(dup, sctx)), ['segments[1].id:DUPLICATE']);
  const t = story(); t.segments[0].text = '';
  assert.deepEqual(probs(validateStory(t, sctx)), ['segments[0].text:TEXT_EMPTY']);
  const h = story(); h.segments[1].translation_es = '<b>x</b>';
  assert.deepEqual(probs(validateStory(h, sctx)), ['segments[1].translation_es:TEXT_HTML']);
  const a = story(); a.segments[0].audio = 'audio/../x.mp3';
  assert.deepEqual(probs(validateStory(a, sctx)), ['segments[0].audio:FORMAT']);
  const w = story(); w.segments[0].new_words = ['a', 'a'];
  assert.deepEqual(probs(validateStory(w, sctx)), ['segments[0].new_words[1]:DUPLICATE']);
  const bad = story(); bad.segments[0].id = 'S 1';
  assert.deepEqual(probs(validateStory(bad, sctx)), ['segments[0].id:FORMAT']);
  const x = story(); x.segments[0].otro = 1;
  assert.deepEqual(probs(validateStory(x, sctx)), ['segments[0].otro:UNKNOWN_FIELD']);
  const big = story({ segments: Array.from({ length: 201 }, (_, i) => ({ id: `s${i}`, text: 'Hi.' })) });
  assert.deepEqual(probs(validateStory(big, sctx)), ['segments:LIST_SIZE']);
});

test('Story: etiquetas y objetivos', () => {
  assert.deepEqual(probs(validateStory(story({ topic_tags: ['Daily Life'] }), sctx)), ['topic_tags[0]:FORMAT']);
  assert.deepEqual(probs(validateStory(story({ topic_tags: ['a', 'a'] }), sctx)), ['topic_tags[1]:DUPLICATE']);
  assert.deepEqual(probs(validateStory(story({ grammar_targets: ['Gram.X'] }), sctx)), ['grammar_targets[0]:FORMAT']);
  assert.deepEqual(probs(validateStory(story({ vocab_targets: ['x'] }), sctx)), ['vocab_targets[0]:FORMAT']);
  const res = validateStory(story({ grammar_targets: ['gram.no_existe'] }), { ...sctx, topicIds: new Set(['gram.present_simple.routines']) });
  assert.deepEqual(probs(res), ['grammar_targets[0]:UNKNOWN_TOPIC']);
});

test('Story: las preguntas son ítems completos con ruta exacta', () => {
  const s = story(); s.questions[0].accept = ['ok', '<i>x</i>'];
  assert.deepEqual(probs(validateStory(s, sctx)), ['questions[0].accept[1]:TEXT_HTML']);
  const m = story(); delete m.questions[0].prompt_es;
  assert.deepEqual(probs(validateStory(m, sctx)), ['questions[0].prompt_es:REQUIRED']);
  assert.deepEqual(probs(validateStory(story({ questions: 'x' }), sctx)), ['questions:TYPE']);
});

test('Story: las preguntas deben ser de lectura o de escucha; ids de pregunta únicos', () => {
  const bad = story({ questions: [question({ type: 'mcq_en_es' })] });
  assert.deepEqual(probs(validateStory(bad, sctx)), ['questions[0].type:STORY_QUESTION_TYPE']);
  for (const t of ['read_tfng', 'listen_comprehension', 'dictation', 'read_inference']) assert.equal(validateStory(story({ questions: [question({ type: t })] }), sctx).ok, true, t);
  const dup = story({ questions: [question(), question()] });
  assert.deepEqual(probs(validateStory(dup, sctx)), ['questions[1].id:DUPLICATE']);
  assert.deepEqual(probs(validateStory(story({ questions: [question({ type: 'nada' })] }), sctx)), ['questions[0].type:UNKNOWN_TYPE']);
});

test('Story: comprehensibility', () => {
  assert.equal(validateStory(story({ comprehensibility: { known_pct_estimate: 92 } }), sctx).ok, true);
  assert.deepEqual(probs(validateStory(story({ comprehensibility: { known_pct_estimate: 101 } }), sctx)), ['comprehensibility.known_pct_estimate:RANGE']);
  assert.deepEqual(probs(validateStory(story({ comprehensibility: { known_pct_estimate: '90' } }), sctx)), ['comprehensibility.known_pct_estimate:TYPE']);
  assert.equal(validateStory(story({ comprehensibility: {} }), sctx).ok, true);
  assert.deepEqual(probs(validateStory(story({ comprehensibility: { x: 1 } }), sctx)), ['comprehensibility.x:UNKNOWN_FIELD']);
});

test('Story: campos desconocidos, checkStory con ruta base, entradas raras y hostiles', () => {
  assert.deepEqual(probs(validateStory(story({ extra: 1 }), sctx)), ['extra:UNKNOWN_FIELD']);
  const r = createReport(); checkStory(r, 'stories[2]', story({ level: 'Z' }), sctx);
  assert.deepEqual(probs(r.result()), ['stories[2].level:ENUM']);
  for (const bad of [null, undefined, 5, 'x', [], true]) assert.equal(validateStory(bad).ok, false);
  const hostile = new Proxy({}, { get() { throw new Error('x'); }, ownKeys() { throw new Error('x'); } });
  assert.doesNotThrow(() => validateStory(hostile));
  const evil = story(); Object.defineProperty(evil.segments[0], 'text', { enumerable: true, get() { throw new Error('x'); } });
  assert.doesNotThrow(() => validateStory(evil, sctx));
  const before = JSON.stringify(story()); const s = story(); validateStory(s, sctx); assert.equal(JSON.stringify(s), before);
});

test('Story: fuzz de 1000 casos', () => {
  let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const junk = [null, undefined, 0, -3, 2.5, NaN, '', 'x', '<b>', [], {}, [1], [{}], { a: 1 }, true, 'x'.repeat(3000)];
  const keys = Object.keys(story());
  for (let n = 0; n < 1000; n += 1) {
    const s = story();
    for (let m = 0; m < 1 + Math.floor(rnd() * 3); m += 1) { const k = keys[Math.floor(rnd() * keys.length)]; if (rnd() < 0.2) delete s[k]; else s[k] = junk[Math.floor(rnd() * junk.length)]; }
    const res = validateStory(s, sctx);
    assert.equal(res.ok, res.errorTotal === 0);
  }
});

// ---------------- límites y propagación del contexto ----------------
test('LexEntry: límites de lista (es 10, ejemplos 20, colocaciones 20, derivación 20)', () => {
  const n = (k, make) => Array.from({ length: k }, (_, i) => make(i));
  for (const [field, make, max] of [['es', (i) => `p${i}`, 10], ['examples', (i) => ({ en: `a${i}`, es: `b${i}` }), 20], ['collocations', (i) => `c${i}`, 20], ['derivation', (i) => `d${i}`, 20]]) {
    assert.equal(validateLexEntry(lex({ [field]: n(max, make) })).ok, true, `${field} ${max}`);
    assert.deepEqual(probs(validateLexEntry(lex({ [field]: n(max + 1, make) }))), [`${field}:LIST_SIZE`], `${field} ${max + 1}`);
  }
});

test('Story: audio e id de segmento — largo máximo; etiquetas de 40 caracteres; límite de palabras nuevas y de preguntas', () => {
  const seg = (id) => story({ segments: [{ id, text: 'Hi.' }] });
  assert.equal(validateStory(seg(`s${'a'.repeat(19)}`), sctx).ok, true);
  assert.deepEqual(probs(validateStory(seg(`s${'a'.repeat(20)}`), sctx)), ['segments[0].id:FORMAT']);
  assert.equal(validateStory(story({ topic_tags: ['a'.repeat(40)] }), sctx).ok, true);
  assert.deepEqual(probs(validateStory(story({ topic_tags: ['a'.repeat(41)] }), sctx)), ['topic_tags[0]:FORMAT']);
  const nw = (k) => story({ segments: [{ id: 's1', text: 'Hi.', new_words: Array.from({ length: k }, (_, i) => `w${i}`) }] });
  assert.equal(validateStory(nw(30), sctx).ok, true);
  assert.deepEqual(probs(validateStory(nw(31), sctx)), ['segments[0].new_words:LIST_SIZE']);
});

test('Story: el contexto llega a las preguntas (código de error inexistente en un distractor)', () => {
  const q = question({ distractors: [{ text: 'She drink coffee.', code: 'NOPE.X' }] });
  assert.deepEqual(probs(validateStory(story({ questions: [q] }), sctx)), ['questions[0].distractors[0].code:UNKNOWN_CODE']);
  assert.equal(validateStory(story({ questions: [q] })).ok, true);
});
