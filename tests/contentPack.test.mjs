// @purpose: Pruebas de la validación estricta de un Pack (core/contentPack.js).
// Pruebas de core/contentPack.js (subparte 1.3, cuarto 1, mitad B): validación estricta de un Pack (8.10) con sus ítems, léxico e historias.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePack, checkPack, PACK_ID_RE, PACK_LIMITS } from '../core/contentPack.js';
import { createReport } from '../core/contentRules.js';

const T1 = 'gram.present_perfect.form';
const T2 = 'gram.present_perfect.for_since';
const item = (n, over = {}) => ({
  id: `g.pp.${String(n).padStart(4, '0')}`, type: 'fix_error', topics: [T2], level: 'A2', prompt_es: 'Corrige el error en la oración.',
  prompt_en: "I'm living here since two years.", data: {}, accept: ["I've lived here for two years.", 'I have lived here for two years.'],
  distractors: [{ text: 'I live here since two years.', code: 'TNS.SINCE_FOR' }], explain_es: "Con 'for' usamos present perfect.",
  error_codes: ['TNS.SINCE_FOR'], needs_ai: false, source: 'original', version: 1, ...over,
});
const lexEntry = (over = {}) => ({ id: 'vocab.body.knee', lemma: 'knee', pos: 'noun', family: 'vocab.body', level: 'A1', es: ['rodilla'], def_en: 'a joint', examples: [{ en: 'My knee hurts.', es: 'Me duele.' }], ...over });
const story = (over = {}) => ({
  id: 'story.a1.0001', level: 'A1', title_en: 'x', title_es: 'y', segments: [{ id: 's1', text: 'Hi.' }],
  questions: [item(900, { id: 'story.a1.0001.q1', type: 'read_local_q', accept: ['Hi.'], distractors: undefined, error_codes: undefined })], source: 'original', ...over,
});
const pack = (over = {}) => ({
  schema: 1, pack_id: 'gram_perfect_tenses_v1', version: 1, title_es: 'Tiempos perfectos (A2-B1)', created: '2026-10-20', authors: 'Claude', license_note: 'Original',
  topics: [T1, T2], items: [item(1, { topics: [T1] }), item(2)], ...over,
});
const probs = (res) => res.errors.map((e) => `${e.path}:${e.rule}`);
const warns = (res) => res.warnings.map((e) => `${e.path}:${e.rule}`);
const ctx = { errorCodes: new Set(['TNS.SINCE_FOR']) };

test('el paquete de ejemplo del contrato 8.10 pasa limpio', () => {
  const res = validatePack(pack(), ctx);
  assert.deepEqual([res.ok, res.errors, res.warnings], [true, [], []]);
});

test('con léxico e historias también pasa limpio', () => {
  const res = validatePack(pack({ lexicon: [lexEntry()], stories: [story()] }), ctx);
  assert.deepEqual([res.ok, res.errors, res.warnings], [true, [], []]);
});

test('cada campo obligatorio ausente se informa; lexicon y stories son opcionales', () => {
  for (const k of ['schema', 'pack_id', 'version', 'title_es', 'created', 'authors', 'license_note', 'topics', 'items']) {
    const p = pack(); delete p[k];
    assert.ok(probs(validatePack(p, ctx)).includes(`${k}:REQUIRED`), k);
  }
  assert.equal(validatePack(pack({ lexicon: undefined, stories: undefined }), ctx).ok, true);
});

test('schema debe ser exactamente 1', () => {
  for (const s of [2, 0, '1', null, 1.5]) assert.ok(probs(validatePack(pack({ schema: s }), ctx)).some((p) => p.startsWith('schema:')), String(s));
  assert.deepEqual(probs(validatePack(pack({ schema: 2 }), ctx)), ['schema:ENUM']);
});

test('pack_id: minúsculas, dígitos y guion bajo; 3 a 60 caracteres, empieza por letra', () => {
  for (const ok of ['gram_perfect_tenses_v1', 'abc', 's0', 'a'.repeat(60)]) assert.equal(PACK_ID_RE.test(ok), ok.length >= 3, ok);
  for (const bad of ['Gram_x', 'gram-x', 'gram.x', '1gram', 'ab', 'a'.repeat(61), 'gram x', '../x', 'gram/x', '']) assert.deepEqual(probs(validatePack(pack({ pack_id: bad }), ctx)), ['pack_id:FORMAT'], bad);
  assert.deepEqual(probs(validatePack(pack({ pack_id: 5 }), ctx)), ['pack_id:TYPE']);
});

test('version, títulos y autoría', () => {
  for (const v of [0, 10000]) assert.deepEqual(probs(validatePack(pack({ version: v }), ctx)), ['version:RANGE'], String(v));
  assert.deepEqual(probs(validatePack(pack({ version: '1' }), ctx)), ['version:TYPE']);
  assert.deepEqual(probs(validatePack(pack({ title_es: '' }), ctx)), ['title_es:TEXT_EMPTY']);
  assert.deepEqual(probs(validatePack(pack({ authors: '<b>x</b>' }), ctx)), ['authors:TEXT_HTML']);
  assert.deepEqual(probs(validatePack(pack({ license_note: 'x'.repeat(121) }), ctx)), ['license_note:TEXT_TOO_LONG']);
});

test('created: fecha de calendario AAAA-MM-DD real', () => {
  for (const ok of ['2026-10-20', '2024-02-29', '2000-01-01']) assert.equal(validatePack(pack({ created: ok }), ctx).ok, true, ok);
  for (const bad of ['2026-13-01', '2026-02-30', '2025-02-29', '20261020', '2026-10-20T00:00:00Z', '2026-1-5', '', ' 2026-10-20', '1999-12-31']) assert.deepEqual(probs(validatePack(pack({ created: bad }), ctx)), ['created:FORMAT'], bad);
  assert.deepEqual(probs(validatePack(pack({ created: 20261020 }), ctx)), ['created:TYPE']);
});

test('topics: al menos uno, formato, sin repetidos y (con ctx.topicIds) existentes', () => {
  assert.deepEqual(probs(validatePack(pack({ topics: [], items: [] , lexicon: [lexEntry()] }), ctx)), ['topics:LIST_SIZE']);
  assert.deepEqual(probs(validatePack(pack({ topics: [T1, T1, T2] }), ctx)), ['topics[1]:DUPLICATE']);
  assert.deepEqual(probs(validatePack(pack({ topics: [T1, 'Gram.X', T2] }), ctx)), ['topics[1]:FORMAT']);
  const topicIds = new Set([T1]);
  assert.deepEqual(probs(validatePack(pack(), { ...ctx, topicIds })), ['topics[1]:UNKNOWN_TOPIC', 'items[1].topics[0]:UNKNOWN_TOPIC']);
  assert.equal(validatePack(pack(), { ...ctx, topicIds: new Set([T1, T2]) }).ok, true);
});

test('un ítem con error se señala con la ruta exacta items[12].accept[0]', () => {
  const items = Array.from({ length: 14 }, (_, i) => item(i + 1));
  items[12] = item(13, { accept: ['<b>mal</b>', 'bien'] });
  const res = validatePack(pack({ items }), ctx);
  assert.deepEqual(probs(res), ['items[12].accept[0]:TEXT_HTML']);
  assert.match(res.errors[0].message, /HTML/);
});

test('ids de ítem repetidos dentro del paquete', () => {
  const res = validatePack(pack({ items: [item(1), item(2), item(1)] }), ctx);
  assert.deepEqual(probs(res), ['items[2].id:DUPLICATE']);
  assert.match(res.errors[0].message, /items\[0\]/);
});

test('el tema de cada ítem debe estar en la lista topics del paquete', () => {
  const res = validatePack(pack({ items: [item(1, { topics: [T2, 'gram.otro_tema'] })] }), ctx);
  assert.deepEqual(probs(res), ['items[0].topics[1]:ITEM_TOPIC_NOT_IN_PACK']);
});

test('léxico: errores con ruta exacta e ids repetidos', () => {
  assert.deepEqual(probs(validatePack(pack({ lexicon: [lexEntry(), lexEntry({ def_en: '' })] }), ctx)), ['lexicon[1].def_en:TEXT_EMPTY', 'lexicon[1].id:DUPLICATE']);
  assert.deepEqual(probs(validatePack(pack({ lexicon: 'x' }), ctx)), ['lexicon:TYPE']);
});

test('historias: errores con ruta exacta, ids repetidos y preguntas con ids repetidos frente a los ítems', () => {
  assert.deepEqual(probs(validatePack(pack({ stories: [story({ level: 'Z' })] }), ctx)), ['stories[0].level:ENUM']);
  assert.deepEqual(probs(validatePack(pack({ stories: [story(), story({ segments: [{ id: 's1', text: 'Bye.' }] })] }), ctx)), ['stories[1].id:DUPLICATE', 'stories[1].questions[0].id:DUPLICATE']);
  const clash = story(); clash.questions[0].id = 'g.pp.0001';
  const res = validatePack(pack({ stories: [clash] }), ctx);
  assert.deepEqual(probs(res), ['stories[0].questions[0].id:DUPLICATE']); assert.match(res.errors[0].message, /items\[0\]/);
  const q = story(); q.questions.push({ ...q.questions[0] });
  assert.deepEqual(probs(validatePack(pack({ stories: [q] }), ctx)), ['stories[0].questions[1].id:DUPLICATE']); // un solo aviso, no dos
  const t = story(); t.questions[0].topics = ['gram.otro_tema'];
  assert.deepEqual(probs(validatePack(pack({ stories: [t] }), ctx)), ['stories[0].questions[0].topics[0]:ITEM_TOPIC_NOT_IN_PACK']);
});

test('paquete vacío: sin ítems, léxico ni historias es un error', () => {
  const res = validatePack(pack({ items: [] }), ctx);
  assert.deepEqual(probs(res), [':PACK_EMPTY']); assert.equal(res.errors[0].path, '');
  assert.equal(validatePack(pack({ items: [], lexicon: [lexEntry()] }), ctx).ok, true);
  assert.equal(validatePack(pack({ items: [], stories: [story()] }), ctx).ok, true);
});

test('aviso: un tema del paquete sin ningún ítem (solo si hay ítems)', () => {
  assert.deepEqual(warns(validatePack(pack({ items: [item(1, { topics: [T1] })] }), ctx)), ['topics[1]:TOPIC_WITHOUT_ITEMS']);
  assert.deepEqual(warns(validatePack(pack({ items: [], lexicon: [lexEntry()] }), ctx)), []);
  // una pregunta de historia sobre T2 también cuenta como ítem de ese tema
  const withStory = validatePack(pack({ items: [item(1, { topics: [T1] })], stories: [story()] }), ctx);
  assert.deepEqual(warns(withStory), []);
});

test('aviso: un ítem generado por IA dentro de un paquete', () => {
  assert.deepEqual(warns(validatePack(pack({ items: [item(1, { topics: [T1] }), item(2, { source: 'ai_generated_unverified' })] }), ctx)), ['items[1].source:AI_SOURCE_IN_PACK']);
});

test('los avisos de los ítems (apóstrofo curvo) salen con su ruta y no invalidan', () => {
  const res = validatePack(pack({ items: [item(1, { topics: [T1], accept: ['I\u2019ve lived here.'] }), item(2)] }), ctx);
  assert.equal(res.ok, true); assert.deepEqual(warns(res), ['items[0].accept[0]:TEXT_CURLY_APOSTROPHE']);
});

test('límites: más de 5000 ítems, 5000 palabras o 500 historias es un error', () => {
  assert.equal(PACK_LIMITS.items, 5000);
  assert.ok(probs(validatePack(pack({ items: Array.from({ length: 5001 }, (_, i) => item(i + 1)) }), ctx)).includes('items:LIST_SIZE'));
  assert.ok(probs(validatePack(pack({ lexicon: Array.from({ length: 5001 }, () => ({})) }), ctx)).includes('lexicon:LIST_SIZE'));
  assert.ok(probs(validatePack(pack({ stories: Array.from({ length: 501 }, () => ({})) }), ctx)).includes('stories:LIST_SIZE'));
});

test('campos desconocidos, entradas que no son objeto y objetos hostiles', () => {
  assert.deepEqual(probs(validatePack(pack({ extra: 1 }), ctx)), ['extra:UNKNOWN_FIELD']);
  for (const bad of [null, undefined, 5, 'x', [], true, [pack()]]) assert.equal(validatePack(bad, ctx).ok, false);
  const hostile = new Proxy({}, { get() { throw new Error('x'); }, ownKeys() { throw new Error('x'); } });
  assert.doesNotThrow(() => validatePack(hostile, ctx));
  const p = pack(); Object.defineProperty(p.items[0], 'id', { enumerable: true, get() { throw new Error('x'); } });
  assert.doesNotThrow(() => validatePack(p, ctx));
  assert.ok(probs(validatePack(p, ctx)).includes('items[0]:UNREADABLE'));
  assert.doesNotThrow(() => validatePack(JSON.parse('{"__proto__":{"a":1},"items":[{"__proto__":1}]}'), ctx));
});

test('checkPack escribe en un informe existente y no modifica la entrada', () => {
  const p = pack({ items: [item(1, { topics: [T1] }), item(2, { level: 'X' })] }); const before = JSON.stringify(p);
  const r = createReport(); checkPack(r, 'packs/x.json', p, ctx);
  assert.deepEqual(probs(r.result()), ['packs/x.json.items[1].level:ENUM']);
  assert.equal(JSON.stringify(p), before);
});

test('un paquete roto con miles de errores guarda solo 200 pero los cuenta todos', () => {
  const items = Array.from({ length: 2000 }, (_, i) => item(i + 1, { level: 'X' }));
  const res = validatePack(pack({ items }), ctx);
  assert.equal(res.errors.length, 200); assert.ok(res.errorTotal >= 2000);
});

test('rendimiento: un paquete válido de 2.000 ítems se valida en menos de 1 s', () => {
  const items = Array.from({ length: 2000 }, (_, i) => item(i + 1, { topics: [i % 2 ? T1 : T2], accept: [`I've lived here for ${i} years.`, `I have lived here for ${i} years.`] }));
  const p = pack({ items });
  validatePack(p, ctx); // calienta
  const t0 = performance.now(); const res = validatePack(p, ctx); const ms = performance.now() - t0;
  assert.equal(res.ok, true, JSON.stringify(res.errors.slice(0, 2)));
  assert.ok(ms < 1000, `tardó ${ms.toFixed(0)} ms`);
});

test('fuzz: 500 paquetes mutados al azar no lanzan', () => {
  let seed = 2026; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const junk = [null, undefined, 0, -1, NaN, '', 'x', '<b>', [], {}, [null], [{}], { a: 1 }, true, 'x'.repeat(3000)];
  const keys = Object.keys(pack({ lexicon: [lexEntry()], stories: [story()] }));
  for (let n = 0; n < 500; n += 1) {
    const p = pack({ lexicon: [lexEntry()], stories: [story()] });
    for (let m = 0; m < 1 + Math.floor(rnd() * 4); m += 1) { const k = keys[Math.floor(rnd() * keys.length)]; if (rnd() < 0.2) delete p[k]; else p[k] = junk[Math.floor(rnd() * junk.length)]; }
    const res = validatePack(p, ctx);
    assert.equal(res.ok, res.errorTotal === 0);
  }
});

test('el contexto llega a los ítems y a las preguntas de las historias (códigos de error inexistentes)', () => {
  const bad = item(2, { distractors: [{ text: 'mal', code: 'NOPE.X' }] });
  assert.deepEqual(probs(validatePack(pack({ items: [item(1, { topics: [T1] }), bad] }), ctx)), ['items[1].distractors[0].code:UNKNOWN_CODE']);
  assert.equal(validatePack(pack({ items: [item(1, { topics: [T1] }), bad] })).ok, true);
  const s = story(); s.questions[0].distractors = [{ text: 'mal', code: 'NOPE.X' }];
  assert.deepEqual(probs(validatePack(pack({ stories: [s] }), ctx)), ['stories[0].questions[0].distractors[0].code:UNKNOWN_CODE']);
});

test('aviso de tema sin ítems: con solo preguntas de historia también se calcula', () => {
  const res = validatePack(pack({ items: [], stories: [story()] }), ctx); // la pregunta usa T2; T1 queda sin ítems
  assert.deepEqual(warns(res), ['topics[0]:TOPIC_WITHOUT_ITEMS']);
  assert.equal(res.ok, true);
});

test('created: el día 00 y el 31 en un mes de 30 días no existen', () => {
  for (const bad of ['2026-10-00', '2026-04-31', '2026-00-10', '2026-12-32']) assert.deepEqual(probs(validatePack(pack({ created: bad }), ctx)), ['created:FORMAT'], bad);
  for (const ok of ['2026-12-31', '2026-04-30', '2028-02-29']) assert.equal(validatePack(pack({ created: ok }), ctx).ok, true, ok);
});
