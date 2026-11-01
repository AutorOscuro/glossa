// @purpose: Pruebas del validador de códigos de error (core/contentCodes.js) y del catálogo real error_codes.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateErrorCodes, errorCodeSet, ERROR_CODES_SCHEMA } from '../core/contentCodes.js';
import { validateItem } from '../core/contentItem.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const catalog = JSON.parse(read('content/taxonomy/error_codes.json'));
const probs = (r) => r.errors.map((e) => `${e.path}:${e.rule}`);
const entry = (id, over = {}) => ({ id, titulo_es: `Título de ${id}`, ...over });
const file = (codes, over = {}) => ({ schema: 1, codes, ...over });

// Los códigos iniciales se leen del roadmap (8.8), no de un conteo a mano.
function roadmapCodes() {
  const line = read('docs/ROADMAP.md').split('\n').find((l) => l.startsWith('- **Catálogo inicial de códigos**'));
  assert.ok(line, 'no se encontró la línea del catálogo inicial en 8.8');
  return [...line.matchAll(/`([A-Z][A-Z0-9_]*\.[A-Z0-9_.-]+)`/g)].map((m) => m[1]).filter((c) => !c.endsWith('.json'));
}

test('error_codes.json real: pasa el validador y trae todos los códigos de 8.8', () => {
  const res = validateErrorCodes(catalog);
  assert.deepEqual([res.ok, res.errors, res.warnings], [true, [], []]);
  const want = roadmapCodes();
  assert.ok(want.length >= 45, `el roadmap lista ${want.length}`);
  const have = new Set(catalog.codes.map((c) => c.id));
  assert.deepEqual(want.filter((c) => !have.has(c)), []);
  assert.equal(catalog.schema, ERROR_CODES_SCHEMA);
});
test('error_codes.json real: cada código lleva un título propio en español', () => {
  for (const c of catalog.codes) assert.ok(c.titulo_es.length >= 4 && c.titulo_es !== c.id, c.id);
  assert.equal(new Set(catalog.codes.map((c) => c.titulo_es)).size, catalog.codes.length, 'títulos repetidos');
});

// C1: el catálogo real está completo y sigue la escala de 8.8 y el perfil de 7.10.
const HIGH_7_10 = ['TNS.PP_PS', 'TNS.SINCE_FOR', 'TNS.PERF_FORM', 'VRB.IRREG_REGULARIZE', 'VRB.DOUBLE_PAST', 'VRB.CAN_TO', 'Q.WORD_ORDER', 'Q.AUX_OMIT', 'Q.INDIRECT',
  'GER.INF_AFTER_PREP', 'GER.AVOID_TO', 'PREP.DEP', 'NEG.DOUBLE', 'SUBJ.OMIT'];
const MID_7_10 = ['CONN.CONTRAST_BECAUSE', 'CONN.DESPITE_OF', 'FUT.WILL_PLAN', 'FUT.WILL_PAST', 'FUT.AUX_MIX', 'ADJ.SUPERLATIVE', 'ADJ.ADV_CONFUSION', 'ADJ.BORED_BORING', 'ADJ.ORDER',
  'ADJ.PLURAL', 'ADJ.COMPARATIVE_DOUBLE', 'NOUN.COUNT_UNCOUNT', 'NOUN.QUANT_FEW', 'CAUS.MAKE_ME_WORKS', 'VRB.THIRD_S_OMIT', 'VRB.THIRD_S_EXTRA', 'LEX.FALSE_FRIEND', 'LEX.CALQUE'];
const FIELDS = ['descripcion_es', 'origen_tipico', 'impacto_defecto', 'temas_relacionados', 'ejemplo_malo', 'ejemplo_bueno', 'pista_corta_es'];
test('C1: cada código del catálogo real trae los 7 campos, con enumerados válidos y sin texto repetido', () => {
  assert.ok(catalog.codes.length >= 45);
  for (const c of catalog.codes) {
    for (const f of FIELDS) assert.ok(c[f] !== undefined && c[f] !== '' && !(Array.isArray(c[f]) && c[f].length === 0), `${c.id}.${f}`);
    assert.ok(['transfer_es', 'developmental', 'unknown_pure'].includes(c.origen_tipico), c.id);
    assert.ok(['low', 'mid', 'high'].includes(c.impacto_defecto), c.id);
    assert.notEqual(c.ejemplo_malo, c.ejemplo_bueno, c.id);
    assert.ok(c.pista_corta_es.length <= 140, `${c.id}: pista demasiado larga para mostrar al fallar`);
  }
  assert.equal(new Set(catalog.codes.map((c) => c.descripcion_es)).size, catalog.codes.length, 'descripciones repetidas');
});
test('C1: el impacto por defecto sigue 7.10 (alto, medio; el resto bajo)', () => {
  const by = Object.fromEntries(catalog.codes.map((c) => [c.id, c.impacto_defecto]));
  for (const id of HIGH_7_10) assert.equal(by[id], 'high', id);
  for (const id of MID_7_10) assert.equal(by[id], 'mid', id);
  for (const [id, imp] of Object.entries(by)) if (!HIGH_7_10.includes(id) && !MID_7_10.includes(id)) assert.equal(imp, 'low', id);
});
test('C1: cada tema relacionado tiene formato de id válido', () => {
  const re = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/;
  for (const c of catalog.codes) for (const t of c.temas_relacionados) assert.match(t, re, `${c.id}: ${t}`);
});

test('forma del archivo: schema, lista y tamaño', () => {
  assert.deepEqual(probs(validateErrorCodes(file([entry('TNS.PP_PS')], { schema: 2 }))), ['schema:ENUM']);
  assert.deepEqual(probs(validateErrorCodes({ codes: [entry('TNS.PP_PS')] })), ['schema:REQUIRED']);
  assert.deepEqual(probs(validateErrorCodes({ schema: 1 })), ['codes:REQUIRED']);
  assert.deepEqual(probs(validateErrorCodes(file('x'))), ['codes:TYPE']);
  assert.deepEqual(probs(validateErrorCodes(file([]))), ['codes:LIST_SIZE']);
  assert.deepEqual(probs(validateErrorCodes(file([entry('TNS.PP_PS')], { extra: 1 }))), ['extra:UNKNOWN_FIELD']);
  for (const bad of [null, [], 'x', 3]) assert.ok(probs(validateErrorCodes(bad)).length > 0, JSON.stringify(bad));
});
test('cada entrada: id con formato, título obligatorio y sin HTML, ids únicos con ruta exacta', () => {
  assert.deepEqual(probs(validateErrorCodes(file([entry('TNS.PP_PS'), entry('tns.pp')]))), ['codes[1].id:FORMAT']);
  assert.deepEqual(probs(validateErrorCodes(file([entry('TNS.PP_PS'), { id: 'TNS.SINCE_FOR' }]))), ['codes[1].titulo_es:REQUIRED']);
  assert.deepEqual(probs(validateErrorCodes(file([entry('TNS.PP_PS', { titulo_es: 'Usa <b>negrita</b>' })]))), ['codes[0].titulo_es:TEXT_HTML']);
  assert.deepEqual(probs(validateErrorCodes(file([entry('TNS.PP_PS'), entry('VRB.CAN_TO'), entry('TNS.PP_PS')]))), ['codes[2].id:DUPLICATE']);
  assert.deepEqual(probs(validateErrorCodes(file([entry('TNS.PP_PS', { raro: 1 })]))), ['codes[0].raro:UNKNOWN_FIELD']);
});
test('campos que completarán la 1.6 y C1: opcionales pero con forma', () => {
  const full = entry('TNS.PP_PS', {
    descripcion_es: 'Se usa el pasado simple donde va el present perfect.', origen_tipico: 'transfer_es', impacto_defecto: 'high',
    temas_relacionados: ['gram.present_perfect.form'], ejemplo_malo: 'I lived here since 2020.', ejemplo_bueno: 'I have lived here since 2020.', pista_corta_es: 'Si sigue vigente, usa have + participio.',
  });
  assert.equal(validateErrorCodes(file([full])).ok, true);
  assert.deepEqual(probs(validateErrorCodes(file([entry('TNS.PP_PS', { origen_tipico: 'otro' })]))), ['codes[0].origen_tipico:ENUM']);
  assert.deepEqual(probs(validateErrorCodes(file([entry('TNS.PP_PS', { impacto_defecto: 'alto' })]))), ['codes[0].impacto_defecto:ENUM']);
  assert.deepEqual(probs(validateErrorCodes(file([entry('TNS.PP_PS', { temas_relacionados: ['Mal Tema'] })]))), ['codes[0].temas_relacionados[0]:FORMAT']);
});
test('validateErrorCodes no lanza con entradas hostiles y no modifica la entrada', () => {
  const hostile = { get schema() { throw new Error('boom'); }, codes: [entry('TNS.PP_PS')] };
  assert.doesNotThrow(() => validateErrorCodes(hostile));
  assert.equal(validateErrorCodes(new Proxy({}, { get() { throw new Error('x'); }, ownKeys() { throw new Error('y'); } })).ok, false);
  const f = file([entry('TNS.PP_PS')]); const before = JSON.stringify(f);
  validateErrorCodes(f); assert.equal(JSON.stringify(f), before);
});

test('errorCodeSet: un Set de ids; ignora lo raro y nunca lanza', () => {
  const s = errorCodeSet(catalog);
  assert.ok(s instanceof Set);
  assert.equal(s.size, catalog.codes.length);
  assert.ok(s.has('TNS.SINCE_FOR') && s.has('PRON.-ED') && !s.has('NO.EXISTE'));
  assert.deepEqual([...errorCodeSet(file([entry('A.B'), { id: 3 }, null, 'x', entry('C.D')]))], ['A.B', 'C.D']);
  for (const bad of [null, undefined, 3, 'x', [], {}, { codes: 'x' }]) assert.equal(errorCodeSet(bad).size, 0);
  assert.equal(errorCodeSet(new Proxy({}, { get() { throw new Error('x'); } })).size, 0);
  // un fallo a mitad de la lista no deja un catálogo parcial: entrada hostil = nada es válido
  assert.equal(errorCodeSet(file([entry('A.B'), { get id() { throw new Error('x'); } }])).size, 0);
});

test('con el catálogo real, un distractor con code inexistente se rechaza (UNKNOWN_CODE) y uno real pasa', () => {
  const ctx = { errorCodes: errorCodeSet(catalog) };
  const mk = (code) => ({
    id: 'gram.pp.0001', type: 'choose_correct', topics: ['gram.present_perfect.for_since'], level: 'A2', prompt_es: 'x',
    data: { options: ['I have lived here for two years.', 'I live here since two years.'], correct: 0 },
    distractors: [{ text: 'I live here since two years.', code }], explain_es: 'x', source: 'original', version: 1,
  });
  assert.equal(validateItem(mk('TNS.SINCE_FOR'), ctx).ok, true);
  assert.deepEqual(probs(validateItem(mk('TNS.NO_EXISTE'), ctx)), ['distractors[0].code:UNKNOWN_CODE']);
});

test('error_codes.json real: cada id de temas_relacionados existe en topics.json (C1 y C2)', () => {
  const topics = JSON.parse(read('content/taxonomy/topics.json'));
  const known = new Set(topics.topics.map((t) => t.id));
  const missing = [];
  for (const c of catalog.codes) for (const id of c.temas_relacionados) if (!known.has(id)) missing.push(`${c.id} → ${id}`);
  assert.deepEqual(missing, []);
});
