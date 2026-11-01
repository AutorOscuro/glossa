// @purpose: Pruebas de la validación estricta de un Topic (core/contentTopic.js).
// Pruebas de core/contentTopic.js (subparte 1.3, cuarto 1, mitad A): validación estricta de un Topic (8.2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTopic, checkTopic, TOPIC_STATUSES, TOPIC_ID_RE } from '../core/contentTopic.js';
import { createReport } from '../core/contentRules.js';

// El ejemplo literal del contrato 8.2 (con textos reales y sin puntos suspensivos).
const topic = (over = {}) => ({
  id: 'gram.present_perfect.for_since',
  area: 'gram',
  level: 'A2',
  title_es: 'Present perfect con for y since',
  title_en: 'Present perfect with for / since',
  prereq: ['gram.present_perfect.form'],
  priority: 1,
  diagnosed_gap: true,
  theory: {
    rule_es: 'Con for + duración y since + punto de inicio usamos present perfect.',
    form: 'have/has + participio',
    use_es: 'Algo que empezó en el pasado y sigue siendo cierto.',
    examples: [{ en: "I've lived here for two years.", es: 'Vivo aquí desde hace dos años.' }],
    typical_errors: [{ wrong: "I'm living here since two years.", right: "I've lived here for two years.", why_es: 'En español usamos presente; en inglés, perfecto.', code: 'TNS.SINCE_FOR' }],
    es_contrast_es: 'El español dice "vivo aquí desde hace"; el inglés no usa presente.',
  },
  min_items: 12,
  tags: ['transfer_es'],
  status: 'active',
  ...over,
});
const probs = (res) => res.errors.map((e) => `${e.path}:${e.rule}`);
const codes = new Set(['TNS.SINCE_FOR']);

test('el tema de ejemplo del contrato 8.2 pasa limpio', () => {
  const res = validateTopic(topic(), { errorCodes: codes });
  assert.deepEqual([res.ok, res.errors, res.warnings], [true, [], []]);
});

test('mínimo válido: sin theory, sin diagnosed_gap, sin min_items ni tags (status draft)', () => {
  const t = { id: 'vocab.body', area: 'vocab', level: 'A1', title_es: 'El cuerpo', title_en: 'The body', prereq: [], priority: 3, status: 'draft' };
  const res = validateTopic(t);
  assert.deepEqual([res.ok, res.errors, res.warnings], [true, [], []]);
  assert.equal(validateTopic({ ...t, theory: null }).ok, true);
});

test('constantes: estados y forma del id', () => {
  assert.deepEqual([...TOPIC_STATUSES], ['active', 'draft', 'deprecated']);
  for (const ok of ['gram.present_perfect.for_since', 'vocab.body', 'verb.irregular.go_went_gone', 'spell.a1.b2']) assert.ok(TOPIC_ID_RE.test(ok), ok);
  for (const bad of ['gram', 'Gram.x', 'gram..x', '.gram.x', 'gram.x.', 'gram.x y', 'gram.ñ', '1gram.x', 'gram.x-y']) assert.ok(!TOPIC_ID_RE.test(bad), bad);
});

test('cada campo obligatorio ausente se informa con su ruta', () => {
  for (const k of ['id', 'area', 'level', 'title_es', 'title_en', 'prereq', 'priority', 'status']) {
    const t = topic(); delete t[k];
    const res = validateTopic(t);
    assert.ok(probs(res).includes(`${k}:REQUIRED`), k);
  }
});

test('los opcionales se pueden omitir uno a uno', () => {
  for (const k of ['diagnosed_gap', 'theory', 'min_items', 'tags']) { const t = topic(); delete t[k]; assert.equal(validateTopic(t, { errorCodes: codes }).ok, true, k); }
});

test('id: formato, y el primer tramo debe ser el área', () => {
  assert.deepEqual(probs(validateTopic(topic({ id: 'Gram.X' }))), ['id:FORMAT']);
  assert.deepEqual(probs(validateTopic(topic({ id: 'gram' }))), ['id:FORMAT']);
  assert.deepEqual(probs(validateTopic(topic({ id: 'a'.repeat(101) }))), ['id:FORMAT']);
  const res = validateTopic(topic({ id: 'vocab.body.knee' }));
  assert.deepEqual(probs(res), ['id:AREA_MISMATCH']); assert.match(res.errors[0].message, /gram/);
  assert.deepEqual(probs(validateTopic(topic({ id: 5 }))), ['id:TYPE']);
});

test('area, level, priority y status: enumerados y rangos', () => {
  assert.deepEqual(probs(validateTopic(topic({ area: 'math', id: 'math.x' }))), ['area:ENUM']);
  for (const lv of ['a2', 'A3', 'PREA1', '', null, 2]) assert.ok(probs(validateTopic(topic({ level: lv }))).some((p) => p.startsWith('level:')), String(lv));
  for (const lv of ['PreA1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']) assert.equal(validateTopic(topic({ level: lv })).ok, true, lv);
  for (const p of [0, 6, -1]) assert.deepEqual(probs(validateTopic(topic({ priority: p }))), ['priority:RANGE'], String(p));
  for (const p of [1.5, '1', null, NaN]) assert.deepEqual(probs(validateTopic(topic({ priority: p }))), ['priority:TYPE'], String(p));
  for (const p of [1, 2, 3, 4, 5]) assert.equal(validateTopic(topic({ priority: p })).ok, true);
  assert.deepEqual(probs(validateTopic(topic({ status: 'archived' }))), ['status:ENUM']);
});

test('títulos: texto obligatorio, sin HTML ni vacío', () => {
  assert.deepEqual(probs(validateTopic(topic({ title_es: '' }))), ['title_es:TEXT_EMPTY']);
  assert.deepEqual(probs(validateTopic(topic({ title_en: '<b>x</b>' }))), ['title_en:TEXT_HTML']);
  assert.deepEqual(probs(validateTopic(topic({ title_es: 'x'.repeat(121) }))), ['title_es:TEXT_TOO_LONG']);
});

test('prereq: lista de ids de tema, sin repetidos y sin el propio tema', () => {
  assert.deepEqual(probs(validateTopic(topic({ prereq: ['gram.present_perfect.for_since'] }))), ['prereq[0]:SELF_REFERENCE']);
  assert.deepEqual(probs(validateTopic(topic({ prereq: ['gram.a', 'gram.a'] }))), ['prereq[1]:DUPLICATE']);
  assert.deepEqual(probs(validateTopic(topic({ prereq: ['Gram.A'] }))), ['prereq[0]:FORMAT']);
  assert.deepEqual(probs(validateTopic(topic({ prereq: 'gram.a' }))), ['prereq:TYPE']);
  assert.equal(validateTopic(topic({ prereq: [] })).ok, true);
  assert.deepEqual(probs(validateTopic(topic({ prereq: Array.from({ length: 21 }, (_, i) => `gram.t${i}`) }))), ['prereq:LIST_SIZE']);
});

test('diagnosed_gap, min_items y tags', () => {
  assert.deepEqual(probs(validateTopic(topic({ diagnosed_gap: 'sí' }))), ['diagnosed_gap:TYPE']);
  for (const m of [0, 201]) assert.deepEqual(probs(validateTopic(topic({ min_items: m }))), ['min_items:RANGE'], String(m));
  assert.deepEqual(probs(validateTopic(topic({ min_items: 12.5 }))), ['min_items:TYPE']);
  assert.deepEqual(probs(validateTopic(topic({ tags: ['Transfer'] }))), ['tags[0]:FORMAT']);
  assert.deepEqual(probs(validateTopic(topic({ tags: ['a', 'a'] }))), ['tags[1]:DUPLICATE']);
  assert.deepEqual(probs(validateTopic(topic({ tags: 'transfer_es' }))), ['tags:TYPE']);
  assert.deepEqual(probs(validateTopic(topic({ tags: Array.from({ length: 13 }, (_, i) => `t${i}`) }))), ['tags:LIST_SIZE']);
});

test('campos desconocidos se rechazan (validación estricta), también dentro de theory', () => {
  assert.deepEqual(probs(validateTopic(topic({ extra: 1 }))), ['extra:UNKNOWN_FIELD']);
  const t = topic(); t.theory.otro = 'x';
  assert.deepEqual(probs(validateTopic(t)), ['theory.otro:UNKNOWN_FIELD']);
});

test('theory: rule_es obligatorio, ejemplos con en y es, errores típicos con ruta exacta', () => {
  let t = topic(); delete t.theory.rule_es;
  assert.deepEqual(probs(validateTopic(t)), ['theory.rule_es:REQUIRED']);
  t = topic(); t.theory.examples = [{ en: 'ok' }];
  assert.deepEqual(probs(validateTopic(t, { errorCodes: codes })), ['theory.examples[0].es:REQUIRED']);
  t = topic(); t.theory.examples = [{ en: 'ok', es: 'bien' }, { en: '<i>x</i>', es: 'y' }];
  assert.deepEqual(probs(validateTopic(t, { errorCodes: codes })), ['theory.examples[1].en:TEXT_HTML']);
  t = topic(); t.theory.typical_errors[0].why_es = '';
  assert.deepEqual(probs(validateTopic(t, { errorCodes: codes })), ['theory.typical_errors[0].why_es:TEXT_EMPTY']);
  t = topic(); t.theory.form = null; t.theory.use_es = null; t.theory.es_contrast_es = null; delete t.theory.typical_errors;
  assert.equal(validateTopic(t).ok, true);
  assert.deepEqual(probs(validateTopic(topic({ theory: 'texto' }))), ['theory:TYPE']);
  assert.deepEqual(probs(validateTopic(topic({ theory: [] }))), ['theory:TYPE']);
});

test('theory: el texto largo admite saltos de línea; los demás campos no', () => {
  let t = topic(); t.theory.rule_es = 'Regla 1.\nRegla 2.';
  assert.equal(validateTopic(t).ok, true);
  t = topic(); t.theory.form = 'have\nhas';
  assert.deepEqual(probs(validateTopic(t)), ['theory.form:TEXT_CONTROL']);
});

test('theory.typical_errors[].code: forma siempre; existencia solo si se da la lista de códigos', () => {
  const t = topic(); t.theory.typical_errors[0].code = 'TNS.OTRO';
  assert.equal(validateTopic(t).ok, true);
  assert.deepEqual(probs(validateTopic(t, { errorCodes: codes })), ['theory.typical_errors[0].code:UNKNOWN_CODE']);
  t.theory.typical_errors[0].code = 'minusculas';
  assert.deepEqual(probs(validateTopic(t)), ['theory.typical_errors[0].code:FORMAT']);
  t.theory.typical_errors[0].code = null;
  assert.equal(validateTopic(t).ok, true);
});

test('un tema active sin teoría (o con teoría sin ejemplos) da AVISO, no error; draft y deprecated no avisan', () => {
  let res = validateTopic(topic({ theory: null }));
  assert.equal(res.ok, true); assert.deepEqual(res.warnings.map((w) => `${w.path}:${w.rule}`), ['theory:THEORY_MISSING']);
  const t = topic(); t.theory.examples = [];
  res = validateTopic(t, { errorCodes: codes });
  assert.equal(res.ok, true); assert.deepEqual(res.warnings.map((w) => `${w.path}:${w.rule}`), ['theory.examples:THEORY_MISSING']);
  for (const st of ['draft', 'deprecated']) assert.deepEqual(validateTopic(topic({ theory: null, status: st })).warnings, [], st);
});

test('un tema active SIN el campo theory (ausente, no null) también da el aviso', () => {
  const t = topic(); delete t.theory;
  const res = validateTopic(t);
  assert.equal(res.ok, true); assert.deepEqual(res.warnings.map((w) => `${w.path}:${w.rule}`), ['theory:THEORY_MISSING']);
});

test('un tema de prioridad 1 con diagnosed_gap y status draft pasa (semilla antes de tener contenido)', () => {
  assert.equal(validateTopic(topic({ status: 'draft', theory: null })).ok, true);
});

test('todos los problemas se acumulan (no se detiene en el primero) y las rutas son exactas', () => {
  const res = validateTopic(topic({ level: 'Z9', priority: 9, title_es: '', prereq: 'x', extra: 1 }));
  assert.deepEqual(probs(res).sort(), ['extra:UNKNOWN_FIELD', 'level:ENUM', 'prereq:TYPE', 'priority:RANGE', 'title_es:TEXT_EMPTY']);
});

test('entradas que no son objeto → un solo error en la raíz, sin lanzar', () => {
  for (const v of [null, undefined, 5, 'x', [], true]) {
    const res = validateTopic(v);
    assert.equal(res.ok, false); assert.equal(res.errors[0].path, ''); assert.doesNotThrow(() => validateTopic(v), String(v));
  }
});

test('checkTopic escribe en un informe existente con una ruta base (topics[3].level)', () => {
  const r = createReport();
  checkTopic(r, 'topics[3]', topic({ level: 'Q' }), {});
  checkTopic(r, 'topics[4]', topic({ priority: 0 }), {});
  assert.deepEqual(r.result().errors.map((e) => `${e.path}:${e.rule}`), ['topics[3].level:ENUM', 'topics[4].priority:RANGE']);
});

test('validateTopic no modifica la entrada', () => {
  const t = topic(); const copy = JSON.stringify(t);
  validateTopic(t, { errorCodes: codes }); validateTopic(topic({ level: 'x' }));
  assert.equal(JSON.stringify(t), copy);
});

test('fuzz: 1000 temas mutados al azar no lanzan nunca', () => {
  let seed = 987;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const pool = [null, undefined, 0, -1, 7, 1.5, NaN, '', ' ', 'x', '<b>', '\u0000', '😀', true, [], [null], {}, { en: 1 }, 'gram.x', 'A2'];
  const keys = ['id', 'area', 'level', 'title_es', 'title_en', 'prereq', 'priority', 'diagnosed_gap', 'theory', 'min_items', 'tags', 'status'];
  for (let i = 0; i < 1000; i++) {
    const t = topic();
    for (let j = 0; j < 3; j++) t[keys[Math.floor(rnd() * keys.length)]] = pool[Math.floor(rnd() * pool.length)];
    if (rnd() < 0.3) t.theory = { rule_es: pool[Math.floor(rnd() * pool.length)], examples: pool[Math.floor(rnd() * pool.length)], typical_errors: pool[Math.floor(rnd() * pool.length)] };
    assert.doesNotThrow(() => validateTopic(t, { errorCodes: codes }), String(i));
  }
});
