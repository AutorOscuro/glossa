// @purpose: Pruebas de las reglas que miran fuera de un paquete: paquetes instalados (core/contentInstalled.js) e ids únicos globales.
// Pruebas de las reglas que miran FUERA de un paquete (subparte 1.3, cuarto 3, mitad 3A, parte 2):
// core/contentInstalled.js (summarizePack, installedIndex) y, en core/contentPack.js, ids únicos globales y avisos de ≥ 12 ítems y ≥ 3 tipos por tema.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizePack, installedIndex } from '../core/contentInstalled.js';
import { validatePack } from '../core/contentPack.js';
import { topicInfo } from '../core/contentTaxonomy.js';

const T1 = 'gram.present_perfect.form';
const T2 = 'gram.present_perfect.for_since';
const TYPES = ['fix_error', 'fill_verb', 'translate_word', 'first_letter'];
const item = (id, over = {}) => ({
  id, type: 'fix_error', topics: [T2], level: 'A2', prompt_es: 'Corrige el error en la oración.', prompt_en: "I'm living here since two years.", data: {},
  accept: ["I've lived here for two years.", 'I have lived here for two years.'], distractors: [{ text: 'I live here since two years.', code: 'TNS.SINCE_FOR' }],
  explain_es: "Con 'for' usamos present perfect.", error_codes: ['TNS.SINCE_FOR'], needs_ai: false, source: 'original', version: 1, ...over,
});
const num = (prefix, n) => `${prefix}.${String(n).padStart(4, '0')}`;
// n ítems del tema `topic`, repartidos entre los primeros `kinds` tipos
const many = (prefix, n, topic, kinds = 3) => Array.from({ length: n }, (_, i) => item(num(prefix, i + 1), { topics: [topic], type: TYPES[i % kinds] }));
const lex = (id, over = {}) => ({ id, lemma: 'knee', pos: 'noun', family: id.split('.').slice(0, 2).join('.'), level: 'A1', es: ['rodilla'], def_en: 'a joint', examples: [{ en: 'My knee hurts.', es: 'Me duele.' }], ...over });
const story = (id, qid, over = {}) => ({
  id, level: 'A1', title_en: 'x', title_es: 'y', segments: [{ id: 's1', text: 'Hi.' }],
  questions: [item(qid, { type: 'read_local_q', accept: ['Hi.'], distractors: undefined, error_codes: undefined })], source: 'original', ...over,
});
const pack = (over = {}) => ({
  schema: 1, pack_id: 'gram_perfect_tenses_v1', version: 1, title_es: 'Tiempos perfectos (A2-B1)', created: '2026-10-20', authors: 'Claude', license_note: 'Original',
  topics: [T1, T2], items: [item('g.pp.0001', { topics: [T1] }), item('g.pp.0002')], ...over,
});
const codes = new Set(['TNS.SINCE_FOR']);
const probs = (res) => res.errors.map((e) => `${e.path}:${e.rule}`);
const warns = (res) => res.warnings.map((e) => `${e.path}:${e.rule}`);
const topics = (list) => ({ schema: 1, topics: list.map(([id, status, min_items]) => ({ id, area: id.split('.')[0], level: 'A2', title_es: 'x', title_en: 'x', prereq: [], priority: 1, status, ...(min_items ? { min_items } : {}) })) });

// ---------- summarizePack ----------
test('summarizePack: ids por espacio, y por tema cuántos ítems y de qué tipos (ítems + preguntas de historia)', () => {
  const p = pack({
    items: [item('g.pp.0001', { topics: [T1] }), item('g.pp.0002', { type: 'fill_verb' }), item('g.pp.0003', { topics: [T1, T2], type: 'fill_verb' })],
    lexicon: [lex('vocab.body.knee')], stories: [story('story.a1.0001', 'story.a1.0001.q1')],
  });
  const before = JSON.stringify(p);
  assert.deepEqual(summarizePack(p), {
    pack_id: 'gram_perfect_tenses_v1', version: 1,
    items: ['g.pp.0001', 'g.pp.0002', 'g.pp.0003', 'story.a1.0001.q1'], lexicon: ['vocab.body.knee'], stories: ['story.a1.0001'],
    topics: {
      [T1]: { count: 2, types: ['fill_verb', 'fix_error'] }, // 0001 (fix_error) y 0003 (fill_verb)
      [T2]: { count: 3, types: ['fill_verb', 'read_local_q'] }, // 0002 y 0003 (fill_verb) y la pregunta de la historia (read_local_q)
    },
  });
  assert.equal(JSON.stringify(p), before);
});
test('summarizePack: la pregunta de historia cuenta para sus temas', () => {
  const p = pack({ items: [item('g.pp.0001', { topics: [T1] })], stories: [story('story.a1.0001', 'story.a1.0001.q1', { questions: [item('story.a1.0001.q1', { type: 'read_local_q', topics: [T1], accept: ['Hi.'], distractors: undefined, error_codes: undefined })] })] });
  assert.deepEqual(summarizePack(p).topics, { [T1]: { count: 2, types: ['fix_error', 'read_local_q'] } });
});
test('summarizePack: un tema repetido dentro de un ítem cuenta una sola vez; el resumen se serializa sin pérdida', () => {
  const s = summarizePack(pack({ items: [item('g.pp.0001', { topics: [T1, T1] })] }));
  assert.deepEqual(s.topics, { [T1]: { count: 1, types: ['fix_error'] } });
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
});
test('summarizePack: devuelve null si no es un paquete y nunca lanza; salta lo ilegible', () => {
  for (const bad of [null, undefined, 3, 'x', [], {}, { pack_id: 3 }]) assert.equal(summarizePack(bad), null, String(bad));
  assert.equal(summarizePack(new Proxy({}, { get() { throw new Error('x'); }, ownKeys() { throw new Error('y'); } })), null);
  const s = summarizePack({ pack_id: 'a_b_c', version: 'x', items: [null, 3, { get id() { throw new Error('x'); } }, { id: 'g.a.0001', topics: 'x' }, { id: 'g.a.0002', topics: [T1, 3] }], lexicon: 'x', stories: [null] });
  assert.deepEqual(s, { pack_id: 'a_b_c', version: null, items: ['g.a.0001', 'g.a.0002'], lexicon: [], stories: [], topics: { [T1]: { count: 1, types: [] } } });
});

// ---------- installedIndex ----------
test('installedIndex: junta paquetes; con un id repetido manda el primero; suma conteos y une tipos', () => {
  const a = { pack_id: 'pack_a', version: 1, items: ['g.a.0001', 'g.a.0002'], lexicon: ['vocab.x.one'], stories: ['story.a'], topics: { [T1]: { count: 5, types: ['fix_error'] } } };
  const b = { pack_id: 'pack_b', version: 1, items: ['g.a.0002', 'g.b.0001'], lexicon: [], stories: [], topics: { [T1]: { count: 2, types: ['fill_verb'] }, [T2]: { count: 1, types: [] } } };
  const ix = installedIndex([a, b]);
  assert.equal(ix.items.get('g.a.0002'), 'pack_a');
  assert.equal(ix.items.get('g.b.0001'), 'pack_b');
  assert.equal(ix.lexicon.get('vocab.x.one'), 'pack_a');
  assert.equal(ix.stories.get('story.a'), 'pack_a');
  assert.deepEqual([ix.topics.get(T1).count, [...ix.topics.get(T1).types].sort()], [7, ['fill_verb', 'fix_error']]);
  assert.equal(ix.topics.get(T2).count, 1);
});
test('installedIndex: `exceptPackId` deja fuera la propia versión instalada', () => {
  const a = { pack_id: 'pack_a', items: ['g.a.0001'], lexicon: [], stories: [], topics: { [T1]: { count: 5, types: [] } } };
  const b = { pack_id: 'pack_b', items: ['g.b.0001'], lexicon: [], stories: [], topics: {} };
  const ix = installedIndex([a, b], 'pack_a');
  assert.deepEqual([...ix.items.keys()], ['g.b.0001']);
  assert.equal(ix.topics.size, 0);
});
test('installedIndex: ignora lo ilegible y nunca lanza; no-lista = índices vacíos', () => {
  for (const bad of [null, undefined, 3, 'x', {}]) {
    const ix = installedIndex(bad);
    assert.deepEqual([ix.items.size, ix.lexicon.size, ix.stories.size, ix.topics.size], [0, 0, 0, 0]);
  }
  const ok = { pack_id: 'pack_ok', items: ['g.ok.0001'], lexicon: [], stories: [], topics: { [T1]: { count: 1, types: ['fix_error'] } } };
  const hostile = new Proxy({}, { get() { throw new Error('x'); }, ownKeys() { throw new Error('y'); } });
  const ix = installedIndex([null, 3, { items: ['g.x.0001'] }, hostile, { pack_id: 'pack_raro', items: [3, 'g.r.0001'], topics: { [T2]: { count: -1, types: [] }, [T1]: { count: 'x' }, 'gram.ok.ok': { count: 2, types: [3, 'fix_error'] } } }, ok]);
  assert.deepEqual([...ix.items.keys()], ['g.r.0001', 'g.ok.0001']); // el resumen sin pack_id y el hostil se ignoran
  assert.deepEqual([...ix.topics.keys()].sort(), ['gram.ok.ok', T1].sort());
  assert.deepEqual([...ix.topics.get('gram.ok.ok').types], ['fix_error']);
});

// ---------- ids únicos globales ----------
const installed = (over = {}) => [{ pack_id: 'otro_paquete_v1', version: 1, items: ['g.pp.0002', 'g.zz.0001'], lexicon: ['vocab.body.knee'], stories: ['story.a1.0001'], topics: {}, ...over }];

test('id de ítem ya instalado en otro paquete: error en la ruta exacta, que nombra el paquete', () => {
  const res = validatePack(pack(), { errorCodes: codes, installed: installed() });
  assert.deepEqual(probs(res), ['items[1].id:DUPLICATE_INSTALLED']);
  assert.match(res.errors[0].message, /otro_paquete_v1/);
});
test('lo mismo para una palabra del léxico, una historia y la pregunta de una historia', () => {
  const p = pack({ lexicon: [lex('vocab.body.knee')], stories: [story('story.a1.0001', 'g.zz.0001')], items: [item('g.pp.0001', { topics: [T1] }), item('g.pp.0003')] });
  const res = validatePack(p, { errorCodes: codes, installed: installed() });
  assert.deepEqual(probs(res).sort(), ['lexicon[0].id:DUPLICATE_INSTALLED', 'stories[0].id:DUPLICATE_INSTALLED', 'stories[0].questions[0].id:DUPLICATE_INSTALLED'].sort());
});
test('el mismo `pack_id` es un reemplazo (versión nueva): no choca con su propia versión instalada', () => {
  const res = validatePack(pack({ version: 2 }), { errorCodes: codes, installed: installed({ pack_id: 'gram_perfect_tenses_v1' }) });
  assert.deepEqual([res.ok, res.errors], [true, []]);
});
test('sin `ctx.installed` (o vacío) no hay comprobación global; los espacios de ids no se mezclan', () => {
  assert.equal(validatePack(pack(), { errorCodes: codes }).ok, true);
  assert.equal(validatePack(pack(), { errorCodes: codes, installed: [] }).ok, true);
  // un ítem con el mismo id que una palabra instalada es otra entidad: no choca
  const res = validatePack(pack({ items: [item('g.pp.0001', { topics: [T1] }), item('vocab.body.knee')] }), { errorCodes: codes, installed: installed({ items: [] }) });
  assert.deepEqual(probs(res), []);
});
test('un id repetido dentro del paquete Y ya instalado: el instalado se marca solo en la primera aparición', () => {
  const p = pack({ items: [item('g.zz.0001', { topics: [T1] }), item('g.zz.0001')] });
  const res = validatePack(p, { errorCodes: codes, installed: installed() });
  assert.deepEqual(probs(res), ['items[0].id:DUPLICATE_INSTALLED', 'items[1].id:DUPLICATE']);
});

// ---------- avisos por tema activo ----------
const ctxT = (list, inst) => ({ errorCodes: codes, topicInfo: topicInfo(topics(list)), ...(inst ? { installed: inst } : {}) });

test('tema activo con pocos ítems y pocos tipos: dos avisos en topics[k]; no son errores', () => {
  const res = validatePack(pack(), ctxT([[T1, 'active'], [T2, 'active']]));
  assert.equal(res.ok, true);
  assert.deepEqual(warns(res), ['topics[0]:TOPIC_FEW_ITEMS', 'topics[0]:TOPIC_FEW_TYPES', 'topics[1]:TOPIC_FEW_ITEMS', 'topics[1]:TOPIC_FEW_TYPES']);
  assert.match(res.warnings[0].message, new RegExp(`${T1} suma 1 ítems en este paquete \\(mínimo 12\\)`));
  assert.match(res.warnings[1].message, /1 tipos de ejercicio en este paquete \(mínimo 3\)/);
});
test('12 ítems de 3 tipos: sin avisos; 11 ítems o 2 tipos: aviso (los límites exactos)', () => {
  const ctx = ctxT([[T2, 'active']]);
  const ok = validatePack(pack({ topics: [T2], items: many('g.pp', 12, T2, 3) }), ctx);
  assert.deepEqual([ok.ok, warns(ok)], [true, []]);
  assert.deepEqual(warns(validatePack(pack({ topics: [T2], items: many('g.pp', 11, T2, 3) }), ctx)), ['topics[0]:TOPIC_FEW_ITEMS']);
  assert.deepEqual(warns(validatePack(pack({ topics: [T2], items: many('g.pp', 12, T2, 2) }), ctx)), ['topics[0]:TOPIC_FEW_TYPES']);
});
test('un tema en borrador o retirado no avisa; `min_items` propio se respeta', () => {
  const p = pack({ topics: [T2], items: many('g.pp', 5, T2, 3) });
  assert.deepEqual(warns(validatePack(p, ctxT([[T2, 'draft']]))), []);
  assert.deepEqual(warns(validatePack(p, ctxT([[T2, 'deprecated']]))), []);
  assert.deepEqual(warns(validatePack(p, ctxT([[T2, 'active', 5]]))), []);
  assert.deepEqual(warns(validatePack(p, ctxT([[T2, 'active', 6]]))), ['topics[0]:TOPIC_FEW_ITEMS']);
});
test('suma los paquetes instalados (y une sus tipos), pero nunca la versión instalada del propio paquete', () => {
  const mine = pack({ topics: [T2], items: many('g.pp', 6, T2, 1) }); // 6 ítems, 1 tipo
  const other = { pack_id: 'otro_paquete_v1', items: [], lexicon: [], stories: [], topics: { [T2]: { count: 6, types: ['fill_verb', 'translate_word'] } } };
  const sum = validatePack(mine, ctxT([[T2, 'active']], [other]));
  assert.deepEqual(warns(sum), []); // 6 + 6 = 12 ítems; 1 + 2 = 3 tipos
  const old = { ...other, pack_id: 'gram_perfect_tenses_v1' }; // el propio paquete, versión anterior: se sustituye, no se suma
  const res = validatePack(mine, ctxT([[T2, 'active']], [old]));
  assert.deepEqual(warns(res), ['topics[0]:TOPIC_FEW_ITEMS', 'topics[0]:TOPIC_FEW_TYPES']);
  assert.match(res.warnings[0].message, /en este paquete/);
  const few = validatePack(mine, ctxT([[T2, 'active']], [{ ...other, topics: { [T2]: { count: 1, types: ['fill_verb'] } } }]));
  assert.match(few.warnings[0].message, /suma 7 ítems entre este paquete y los instalados/);
});
test('las preguntas de una historia cuentan para el tema', () => {
  const qs = Array.from({ length: 12 }, (_, i) => item(num('story.a1.0001.q', i + 1), { type: ['read_local_q', 'read_global_q', 'read_inference'][i % 3], topics: [T2], accept: ['Hi.'], distractors: undefined, error_codes: undefined }));
  const long = story('story.a1.0001', 'story.a1.0001.q0', { questions: qs.slice(0, 12) });
  const res = validatePack(pack({ topics: [T2], items: [], stories: [long] }), ctxT([[T2, 'active']]));
  assert.deepEqual([res.ok, warns(res)], [true, []]);
});
test('un ítem que repite un tema en su lista cuenta una sola vez para ese tema', () => {
  const res = validatePack(pack({ topics: [T2], items: [item('g.pp.0001', { topics: [T2, T2] })] }), ctxT([[T2, 'active']]));
  assert.match(res.warnings.find((w) => w.rule === 'TOPIC_FEW_ITEMS').message, /suma 1 ítems/);
});
test('un tema activo que ningún ítem usa solo da TOPIC_WITHOUT_ITEMS (no se duplica el aviso)', () => {
  const res = validatePack(pack({ topics: [T1, T2], items: [item('g.pp.0001', { topics: [T1] })] }), ctxT([[T1, 'draft'], [T2, 'active']]));
  assert.deepEqual(warns(res), ['topics[1]:TOPIC_WITHOUT_ITEMS']);
});
test('sin `topicInfo`, o con un tema que no está en él, no hay avisos de cantidad; un `topicInfo` raro no rompe', () => {
  assert.deepEqual(warns(validatePack(pack(), { errorCodes: codes })), []);
  assert.deepEqual(warns(validatePack(pack(), ctxT([['gram.otro.tema', 'active']]))), []);
  for (const bad of [null, 3, 'x', {}, { get() { throw new Error('x'); } }]) {
    assert.doesNotThrow(() => validatePack(pack(), { errorCodes: codes, topicInfo: bad }));
  }
});
