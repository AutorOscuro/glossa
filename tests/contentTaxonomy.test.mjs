// @purpose: Pruebas de core/contentTaxonomy.js y del archivo real content/taxonomy/topics.json.
// Pruebas de core/contentTaxonomy.js y de content/taxonomy/topics.json (subparte 1.3, cuarto 3, mitad 3A, parte 2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateTopics, topicIdSet, topicInfo, TOPICS_SCHEMA, MAX_TOPICS } from '../core/contentTaxonomy.js';
import { errorCodeSet } from '../core/contentCodes.js';
import { validatePack } from '../core/contentPack.js';

const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const seed = read('content/taxonomy/topics.json');
const codes = errorCodeSet(read('content/taxonomy/error_codes.json'));
const probs = (res) => res.errors.map((e) => `${e.path}:${e.rule}`);
const warns = (res) => res.warnings.map((e) => `${e.path}:${e.rule}`);
const topic = (id, over = {}) => ({ id, area: id.split('.')[0], level: 'A2', title_es: `Tema ${id}`, title_en: `Topic ${id}`, prereq: [], priority: 1, status: 'draft', ...over });
const file = (topics, over = {}) => ({ schema: 1, topics, ...over });

// ---------- el archivo real ----------
test('topics.json real: pasa el validador, con los códigos reales, sin errores ni avisos', () => {
  const res = validateTopics(seed, { errorCodes: codes });
  assert.deepEqual([res.ok, res.errors, res.warnings], [true, [], []]);
  assert.equal(seed.schema, TOPICS_SCHEMA);
});
test('topics.json real: taxonomía completa de C2 (150–250 temas de gramática, en borrador) y la semilla de prioridad 1 intacta', () => {
  const gram = seed.topics.filter((t) => t.area === 'gram');
  assert.ok(gram.length >= 150 && gram.length <= 250, `trae ${gram.length} temas de gramática (deben ser 150–250)`);
  assert.ok(seed.topics.length >= 150 && seed.topics.length <= 250, `trae ${seed.topics.length} temas en total`);
  for (const t of seed.topics) {
    assert.equal(t.status, 'draft', t.id); // ninguno es active hasta que su lote traiga contenido y teoría
    assert.equal(t.id.split('.')[0], t.area, t.id);
    assert.ok(t.priority >= 1 && t.priority <= 5, t.id);
    if (t.priority === 1) assert.equal(t.diagnosed_gap, true, `${t.id}: prioridad 1 sin hueco diagnosticado`); // prioridad 1 = hueco de alto impacto (7.10)
    assert.ok(t.tags.some((g) => /^c\d+$/.test(g)), `${t.id}: sin etiqueta de lote (c3…c14)`);
  }
  const byId = new Map(seed.topics.map((t) => [t.id, t]));
  // los 18 temas de la semilla de 1.3: ids estables (8.1), siguen en prioridad 1 y con hueco diagnosticado
  const SEED_IDS = [
    'gram.present_perfect.form',
    'gram.present_perfect.for_since',
    'gram.present_perfect.vs_past_simple',
    'gram.past_perfect.form',
    'verb.irregular.past_simple',
    'verb.irregular.past_participle',
    'gram.past_simple.did_support',
    'gram.questions.word_order',
    'gram.questions.subject_object',
    'gram.questions.how_long_perfect',
    'gram.questions.indirect',
    'gram.modals.no_to',
    'prep.patterns.gerund_after_verbs',
    'prep.patterns.gerund_after_prepositions',
    'prep.dependent.adjective_prep',
    'prep.dependent.verb_prep',
    'gram.negation.double_negative',
    'gram.subject.dummy_it',
  ];
  assert.equal(SEED_IDS.length, 18);
  for (const id of SEED_IDS) {
    const t = byId.get(id);
    assert.ok(t, `falta el tema de la semilla ${id}`);
    assert.equal(t.priority, 1, id);
    assert.equal(t.diagnosed_gap, true, id);
  }
  // un tema por cada grupo de errores de ALTO impacto del roadmap 7.10 (los dos primeros son los del ejemplo de 8.2 y de los ejemplos de 8.10)
  for (const id of [
    'gram.present_perfect.form', 'gram.present_perfect.for_since', 'gram.present_perfect.vs_past_simple', // 1. tiempos perfectos
    'verb.irregular.past_simple', 'gram.past_simple.did_support', // 2. irregulares y pasado
    'gram.questions.word_order', 'gram.questions.indirect', // 3. preguntas
    'gram.modals.no_to', 'prep.patterns.gerund_after_verbs', 'prep.patterns.gerund_after_prepositions', // 4. gerundio, infinitivo y can + to
    'prep.dependent.adjective_prep', 'prep.dependent.verb_prep', // 5. preposiciones dependientes
    'gram.negation.double_negative', 'gram.subject.dummy_it', // 6. doble negación y sujeto
  ]) assert.ok(byId.has(id), `falta ${id}`);
});
test('topics.json real: sirve de `topicIds` y de `topicInfo` para validar paquetes', () => {
  const ids = topicIdSet(seed);
  assert.equal(ids.size, seed.topics.length);
  assert.ok(ids.has('gram.present_perfect.for_since') && !ids.has('gram.no.existe'));
  const info = topicInfo(seed);
  assert.deepEqual(info.get('gram.modals.no_to'), { status: 'draft', min_items: 12 });
  const pack = { schema: 1, pack_id: 'prueba_v1', version: 1, title_es: 'x', created: '2026-10-20', authors: 'x', license_note: 'x', topics: ['gram.present_perfect.for_since', 'gram.no.existe'], items: [] };
  const res = validatePack(pack, { topicIds: ids, errorCodes: codes });
  assert.deepEqual(probs(res), ['topics[1]:UNKNOWN_TOPIC', ':PACK_EMPTY']);
});

// ---------- forma del archivo ----------
test('forma: schema, lista y campos desconocidos', () => {
  assert.deepEqual(probs(validateTopics(file([topic('gram.a.b')], { schema: 2 }))), ['schema:ENUM']);
  assert.deepEqual(probs(validateTopics({ topics: [topic('gram.a.b')] })), ['schema:REQUIRED']);
  assert.deepEqual(probs(validateTopics({ schema: 1 })), ['topics:REQUIRED']);
  assert.deepEqual(probs(validateTopics(file('x'))), ['topics:TYPE']);
  assert.deepEqual(probs(validateTopics(file([]))), ['topics:LIST_SIZE']);
  assert.deepEqual(probs(validateTopics(file([topic('gram.a.b')], { extra: 1 }))), ['extra:UNKNOWN_FIELD']);
  for (const bad of [null, [], 'x', 3, undefined]) assert.ok(probs(validateTopics(bad)).length > 0, String(bad));
  assert.equal(validateTopics(file([topic('gram.a.b')])).ok, true);
});
test('cada tema se valida con checkTopic y la ruta dice cuál (topics[i].campo)', () => {
  const res = validateTopics(file([topic('gram.a.b'), topic('gram.c.d', { level: 'Z9' }), topic('vocab.x.y', { area: 'gram' })]));
  assert.deepEqual(probs(res), ['topics[1].level:ENUM', 'topics[2].id:AREA_MISMATCH']);
  assert.deepEqual(probs(validateTopics(file(['x', null]))), ['topics[0]:TYPE', 'topics[1]:TYPE']);
});
test('los códigos de los errores típicos se comprueban contra el catálogo cuando viene', () => {
  const t = topic('gram.a.b', { status: 'draft', theory: { rule_es: 'x', examples: [], typical_errors: [{ wrong: 'a', right: 'b', why_es: 'x', code: 'TNS.NO_EXISTE' }] } });
  assert.deepEqual(probs(validateTopics(file([t]), { errorCodes: codes })), ['topics[0].theory.typical_errors[0].code:UNKNOWN_CODE']);
  assert.equal(validateTopics(file([t])).ok, true); // sin catálogo solo se mira el formato
});
test('el aviso de un tema activo sin teoría sale con su ruta', () => {
  assert.deepEqual(warns(validateTopics(file([topic('gram.a.b', { status: 'active' })]))), ['topics[0].theory:THEORY_MISSING']);
});

// ---------- ids únicos ----------
test('ids repetidos: error en la ruta del repetido, que nombra al primero', () => {
  const res = validateTopics(file([topic('gram.a.b'), topic('gram.c.d'), topic('gram.a.b')]));
  assert.deepEqual(probs(res), ['topics[2].id:DUPLICATE']);
  assert.match(res.errors[0].message, /topics\[0\]/);
  assert.deepEqual(probs(validateTopics(file([topic('gram.a.b'), topic('gram.a.b'), topic('gram.a.b')]))), ['topics[1].id:DUPLICATE', 'topics[2].id:DUPLICATE']);
});

// ---------- prerrequisitos ----------
test('prereq inexistente: error con la ruta exacta; uno con formato roto solo da FORMAT', () => {
  assert.deepEqual(probs(validateTopics(file([topic('gram.a.b'), topic('gram.c.d', { prereq: ['gram.a.b', 'gram.z.z'] })]))), ['topics[1].prereq[1]:UNKNOWN_PREREQ']);
  assert.deepEqual(probs(validateTopics(file([topic('gram.a.b', { prereq: ['Mal Tema'] })]))), ['topics[0].prereq[0]:FORMAT']);
  assert.deepEqual(probs(validateTopics(file([topic('gram.a.b', { prereq: [3] })]))), ['topics[0].prereq[0]:TYPE']);
  const res = validateTopics(file([topic('gram.a.b', { prereq: ['gram.z.z'] })]));
  assert.match(res.errors[0].message, /gram\.z\.z/);
});
test('prereq válidos en cualquier orden (hacia delante y hacia atrás) pasan; un rombo no es un ciclo', () => {
  const t = [topic('gram.d.d', { prereq: ['gram.b.b', 'gram.c.c'] }), topic('gram.b.b', { prereq: ['gram.a.a'] }), topic('gram.c.c', { prereq: ['gram.a.a'] }), topic('gram.a.a')];
  assert.deepEqual(probs(validateTopics(file(t))), []);
});
test('un tema prerrequisito de sí mismo da SELF_REFERENCE y no un ciclo', () => {
  assert.deepEqual(probs(validateTopics(file([topic('gram.a.b', { prereq: ['gram.a.b'] })]))), ['topics[0].prereq[0]:SELF_REFERENCE']);
});
test('ciclos: de 2, de 3 y con cola; la ruta cae en la arista que cierra y el mensaje dice el anillo', () => {
  const two = validateTopics(file([topic('gram.a.a', { prereq: ['gram.b.b'] }), topic('gram.b.b', { prereq: ['gram.a.a'] })]));
  assert.deepEqual(probs(two), ['topics[1].prereq[0]:PREREQ_CYCLE']);
  assert.match(two.errors[0].message, /gram\.a\.a → gram\.b\.b → gram\.a\.a/);
  const three = validateTopics(file([topic('gram.a.a', { prereq: ['gram.b.b'] }), topic('gram.b.b', { prereq: ['gram.c.c'] }), topic('gram.c.c', { prereq: ['gram.a.a'] })]));
  assert.deepEqual(probs(three), ['topics[2].prereq[0]:PREREQ_CYCLE']);
  assert.match(three.errors[0].message, /gram\.a\.a → gram\.b\.b → gram\.c\.c → gram\.a\.a/);
  // la cola (z → a) no entra en el anillo
  const tail = validateTopics(file([topic('gram.z.z', { prereq: ['gram.a.a'] }), topic('gram.a.a', { prereq: ['gram.b.b'] }), topic('gram.b.b', { prereq: ['gram.a.a'] })]));
  assert.deepEqual(probs(tail), ['topics[2].prereq[0]:PREREQ_CYCLE']);
  assert.doesNotMatch(tail.errors[0].message, /gram\.z\.z/);
});
test('dos ciclos separados se informan los dos; un ciclo no se informa dos veces', () => {
  const t = [
    topic('gram.a.a', { prereq: ['gram.b.b'] }), topic('gram.b.b', { prereq: ['gram.a.a'] }),
    topic('gram.c.c', { prereq: ['gram.d.d'] }), topic('gram.d.d', { prereq: ['gram.c.c'] }),
    topic('gram.e.e', { prereq: ['gram.a.a', 'gram.c.c'] }), // apunta a los dos anillos pero no cierra ninguno
  ];
  assert.deepEqual(probs(validateTopics(file(t))), ['topics[1].prereq[0]:PREREQ_CYCLE', 'topics[3].prereq[0]:PREREQ_CYCLE']);
});
test('un id repetido no inventa ciclos: sus aristas no cuentan, pero su prereq inexistente sí se informa', () => {
  const t = [topic('gram.a.a', { prereq: ['gram.b.b'] }), topic('gram.b.b'), topic('gram.b.b', { prereq: ['gram.a.a', 'gram.z.z'] })];
  assert.deepEqual(probs(validateTopics(file(t))), ['topics[2].id:DUPLICATE', 'topics[2].prereq[1]:UNKNOWN_PREREQ']);
});
test('cadena larga (2.000 temas) y anillo de 2.000: sin desbordar la pila, un solo ciclo', () => {
  const n = MAX_TOPICS;
  const id = (i) => `gram.t.t${i}`;
  const chain = Array.from({ length: n }, (_, i) => topic(id(i), { prereq: i > 0 ? [id(i - 1)] : [] }));
  assert.deepEqual(probs(validateTopics(file(chain))), []);
  const ring = chain.map((t, i) => (i === 0 ? { ...t, prereq: [id(n - 1)] } : t));
  const res = validateTopics(file(ring));
  // la búsqueda parte del tema 0 y recorre 0 → 1999 → … → 1; la arista que vuelve a 0 es la del tema 1
  assert.deepEqual(probs(res), ['topics[1].prereq[0]:PREREQ_CYCLE']);
  assert.equal(res.errors[0].message.split(' → ').length, n + 1);
  assert.deepEqual(probs(validateTopics(file([...chain, topic('gram.t.extra')]))), ['topics:LIST_SIZE']);
});

test('una escalera de 60 niveles (2^60 caminos) se recorre rápido: cada tema se visita una sola vez', () => {
  const id = (lvl, k) => `gram.l${lvl}.k${k}`;
  const t = [];
  for (let lvl = 0; lvl < 60; lvl += 1) for (const k of [0, 1]) t.push(topic(id(lvl, k), { prereq: lvl === 0 ? [] : [id(lvl - 1, 0), id(lvl - 1, 1)] }));
  const t0 = Date.now();
  assert.deepEqual(probs(validateTopics(file(t))), []);
  assert.ok(Date.now() - t0 < 1000, `tardó ${Date.now() - t0} ms`);
});

// ---------- hostil ----------
test('validateTopics no lanza con entradas hostiles y no modifica la entrada', () => {
  const hostile = { get schema() { throw new Error('boom'); }, topics: [topic('gram.a.b')] };
  assert.doesNotThrow(() => validateTopics(hostile));
  assert.equal(validateTopics(new Proxy({}, { get() { throw new Error('x'); }, ownKeys() { throw new Error('y'); } })).ok, false);
  const bad = file([topic('gram.a.b'), { get id() { throw new Error('x'); }, get prereq() { throw new Error('y'); } }]);
  assert.doesNotThrow(() => validateTopics(bad));
  assert.equal(validateTopics(bad).ok, false);
  const f = file([topic('gram.a.a', { prereq: ['gram.b.b'] }), topic('gram.b.b', { prereq: ['gram.a.a'] })]); const before = JSON.stringify(f);
  validateTopics(f); assert.equal(JSON.stringify(f), before);
});

// ---------- topicIdSet y topicInfo ----------
test('topicInfo: estado y mínimo de ítems por tema; con id repetido manda el primero', () => {
  const info = topicInfo(file([topic('gram.a.b', { status: 'active', min_items: 20 }), topic('gram.c.d'), topic('gram.a.b', { status: 'draft' })]));
  assert.deepEqual([...info.keys()], ['gram.a.b', 'gram.c.d']);
  assert.deepEqual(info.get('gram.a.b'), { status: 'active', min_items: 20 });
  assert.deepEqual(info.get('gram.c.d'), { status: 'draft', min_items: 12 }); // sin min_items: el 12 de 8.10
});
test('topicIdSet: un Set de ids; ignora lo raro y nunca lanza', () => {
  const s = topicIdSet(file([topic('gram.a.b'), { id: 3 }, null, 'x', topic('gram.c.d')]));
  assert.ok(s instanceof Set);
  assert.deepEqual([...s], ['gram.a.b', 'gram.c.d']);
  for (const bad of [null, undefined, 3, 'x', [], {}, { topics: 'x' }]) assert.equal(topicIdSet(bad).size, 0);
  assert.equal(topicIdSet(new Proxy({}, { get() { throw new Error('x'); } })).size, 0);
  // un fallo a mitad de la lista no deja un mapa parcial: entrada hostil = nada es válido
  assert.equal(topicIdSet(file([topic('gram.a.b'), { get id() { throw new Error('x'); } }])).size, 0);
  assert.equal(topicInfo(file([topic('gram.a.b'), { get status() { throw new Error('x'); }, id: 'gram.c.d' }])).size, 0);
});
