// @purpose: Pruebas del catálogo de errores (core/errorCatalog.js) y de la completitud de error_codes.json.
// Pruebas de core/errorCatalog.js (subparte 1.6, cuarto 1): catálogo consultable y completitud de error_codes.json (CA 1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createErrorCatalog, COMPLETE_FIELDS } from '../core/errorCatalog.js';

const load = (name) => JSON.parse(fs.readFileSync(new URL(`../content/taxonomy/${name}`, import.meta.url), 'utf8'));
const FILE = load('error_codes.json');
const mini = (codes) => ({ schema: 1, codes });
const full = (id, over = {}) => ({
  id, titulo_es: `Título ${id}`, descripcion_es: 'Una descripción.', origen_tipico: 'transfer_es', impacto_defecto: 'high',
  temas_relacionados: ['gram.modals.can_could'], ejemplo_malo: 'I can to go.', ejemplo_bueno: 'I can go.', pista_corta_es: 'Tras can va el verbo sin to.', ...over,
});

// El catálogo del roadmap 8.8 (los 45 códigos iniciales). El archivo puede traer más, nunca menos.
const ROADMAP_CODES = ['TNS.PP_PS', 'TNS.SINCE_FOR', 'TNS.PERF_FORM', 'VRB.IRREG_REGULARIZE', 'VRB.DOUBLE_PAST', 'VRB.CAN_TO', 'VRB.THIRD_S_OMIT', 'VRB.THIRD_S_EXTRA',
  'Q.WORD_ORDER', 'Q.AUX_OMIT', 'Q.INDIRECT', 'GER.INF_AFTER_PREP', 'GER.AVOID_TO', 'GER.STOP_REMEMBER', 'PREP.DEP', 'NEG.DOUBLE', 'SUBJ.OMIT',
  'CONN.CONTRAST_BECAUSE', 'CONN.DESPITE_OF', 'FUT.WILL_PLAN', 'FUT.WILL_PAST', 'FUT.AUX_MIX', 'ADJ.SUPERLATIVE', 'ADJ.ADV_CONFUSION', 'ADJ.BORED_BORING',
  'ADJ.ORDER', 'ADJ.PLURAL', 'NOUN.COUNT_UNCOUNT', 'NOUN.PLURAL_IRREG', 'CAUS.MAKE_ME_WORKS', 'LEX.FALSE_FRIEND', 'LEX.CALQUE', 'SPELL.GENERAL', 'MECH.CAP_I',
  'MECH.EVERYDAY', 'ART.GEO', 'PRON.-ED', 'PRON.-S', 'PRON.CLUSTER', 'PRON.S_CLUSTER', 'PRON.VOWEL', 'PRON.V_B', 'PRON.TH', 'PRON.FINAL_VOICING', 'PRON.R'];

test('CA 1: el archivo real trae ≥ 45 códigos, todos los del roadmap 8.8, y todos COMPLETOS', () => {
  const cat = createErrorCatalog(FILE);
  assert.ok(cat.size >= 45, `solo ${cat.size} códigos`);
  assert.equal(cat.size, FILE.codes.length);
  for (const id of ROADMAP_CODES) assert.ok(cat.has(id), `falta ${id}`);
  assert.deepEqual(cat.incomplete(), []);
  assert.equal(cat.isComplete(), true);
});

test('CA 1: cada código tiene los 8 campos con contenido útil (no basura de relleno)', () => {
  const cat = createErrorCatalog(FILE);
  for (const e of cat.all()) {
    assert.ok(e.titulo_es.length >= 8, `${e.id}: título muy corto`);
    assert.ok(e.descripcion_es.length >= 60, `${e.id}: descripción muy corta`);
    assert.ok(['transfer_es', 'developmental', 'unknown_pure'].includes(e.origen_tipico), `${e.id}: origen`);
    assert.ok(['low', 'mid', 'high'].includes(e.impacto_defecto), `${e.id}: impacto`);
    assert.ok(e.temas_relacionados.length >= 1, `${e.id}: sin temas`);
    assert.ok(e.ejemplo_malo.length >= 3 && e.ejemplo_bueno.length >= 3, `${e.id}: ejemplos`);
    assert.notEqual(e.ejemplo_malo, e.ejemplo_bueno, `${e.id}: el ejemplo malo y el bueno son iguales`);
    assert.ok(e.pista_corta_es.length >= 20 && e.pista_corta_es.length <= 220, `${e.id}: la pista debe ser corta (${e.pista_corta_es.length})`);
    const prose = `${e.titulo_es} ${e.descripcion_es} ${e.pista_corta_es}`;
    assert.doesNotMatch(prose, /[<>]|\bTODO\b|\bFIXME\b/, `${e.id}: marcas de borrador o HTML`); // sensible a mayúsculas: «todo» es una palabra normal
    assert.doesNotMatch(prose, /lorem ipsum/i, `${e.id}: texto de relleno`);
  }
});

test('integridad cruzada: todo tema citado por un código existe en topics.json', () => {
  const topics = new Set(load('topics.json').topics.map((t) => t.id));
  assert.ok(topics.size > 100);
  for (const e of createErrorCatalog(FILE).all()) for (const t of e.temas_relacionados) assert.ok(topics.has(t), `${e.id} cita el tema ${t}, que no existe`);
});

test('el impacto de los errores de ALTO impacto del perfil 7.10 es «high»', () => {
  const cat = createErrorCatalog(FILE);
  for (const id of ['TNS.PP_PS', 'TNS.SINCE_FOR', 'VRB.IRREG_REGULARIZE', 'VRB.DOUBLE_PAST', 'VRB.CAN_TO', 'Q.WORD_ORDER', 'GER.AVOID_TO', 'PREP.DEP', 'NEG.DOUBLE', 'SUBJ.OMIT']) {
    assert.equal(cat.get(id).impacto_defecto, 'high', id);
  }
});

test('ids(): orden del archivo y copia; has/get/hint con el caso feliz y con entradas absurdas', () => {
  const cat = createErrorCatalog(FILE);
  const ids = cat.ids();
  assert.deepEqual(ids, FILE.codes.map((c) => c.id));
  ids.push('X.Y'); // es copia
  assert.equal(cat.has('X.Y'), false);
  assert.equal(cat.has('VRB.CAN_TO'), true);
  const e = cat.get('VRB.CAN_TO');
  assert.equal(e.id, 'VRB.CAN_TO');
  assert.equal(cat.hint('VRB.CAN_TO'), e.pista_corta_es);
  for (const bad of [undefined, null, 5, {}, [], '', 'vrb.can_to', 'VRB.NOPE', Symbol.iterator.toString(), '__proto__', 'constructor']) {
    assert.equal(cat.has(bad), false);
    assert.equal(cat.get(bad), null);
    assert.equal(cat.hint(bad), null);
  }
});

test('get() devuelve entradas inmutables: no se pueden alterar ni ellas ni sus listas', () => {
  const cat = createErrorCatalog(FILE);
  const e = cat.get('TNS.SINCE_FOR');
  assert.ok(Object.isFrozen(e) && Object.isFrozen(e.temas_relacionados));
  assert.throws(() => { 'use strict'; e.titulo_es = 'otro'; }, TypeError);
  assert.throws(() => e.temas_relacionados.push('x.y'), TypeError);
  assert.equal(cat.get('TNS.SINCE_FOR').titulo_es, FILE.codes.find((c) => c.id === 'TNS.SINCE_FOR').titulo_es);
  assert.ok(Object.isFrozen(cat));
  assert.ok(cat.all().every(Object.isFrozen));
});

test('el catálogo no comparte memoria con el JSON de entrada (cambiarlo después no lo altera)', () => {
  const raw = JSON.parse(JSON.stringify(FILE));
  const cat = createErrorCatalog(raw);
  const before = cat.get('VRB.CAN_TO').titulo_es;
  raw.codes[5].titulo_es = 'ROTO';
  raw.codes[5].temas_relacionados.push('x.y');
  assert.equal(cat.get('VRB.CAN_TO').titulo_es, before);
  assert.equal(cat.get('VRB.CAN_TO').temas_relacionados.includes('x.y'), false);
});

test('byTopic: devuelve los códigos de un tema en el orden del archivo, copia, y [] si no hay o la entrada es absurda', () => {
  const cat = createErrorCatalog(mini([
    full('A.ONE', { temas_relacionados: ['gram.a.b', 'gram.c.d'] }),
    full('A.TWO', { temas_relacionados: ['gram.c.d'] }),
    full('A.THREE', { temas_relacionados: ['gram.e.f'] }),
  ]));
  assert.deepEqual(cat.byTopic('gram.c.d'), ['A.ONE', 'A.TWO']);
  assert.deepEqual(cat.byTopic('gram.e.f'), ['A.THREE']);
  const r = cat.byTopic('gram.c.d');
  r.push('X');
  assert.deepEqual(cat.byTopic('gram.c.d'), ['A.ONE', 'A.TWO']);
  for (const bad of ['gram.no.existe', '', undefined, null, 3, {}]) assert.deepEqual(cat.byTopic(bad), []);
  // En el catálogo real: el tema «can/could + to» apunta a VRB.CAN_TO.
  assert.ok(createErrorCatalog(FILE).byTopic('gram.modals.no_to').includes('VRB.CAN_TO'));
});

test('incomplete(): detecta cada campo que falta, también las listas vacías', () => {
  const cat = createErrorCatalog(mini([
    full('OK.ALL'),
    { id: 'MIN.ONLY', titulo_es: 'Solo título' }, // formato válido en 1.3, pero incompleto
    full('BAD.LIST', { temas_relacionados: [], ejemplo_bueno: undefined }), // lista vacía = sin temas
    { ...full('BAD.HINT'), pista_corta_es: undefined, descripcion_es: undefined },
  ]));
  const gaps = cat.incomplete();
  assert.deepEqual(gaps.map((g) => g.id), ['MIN.ONLY', 'BAD.LIST', 'BAD.HINT']);
  assert.deepEqual(gaps[0].missing, COMPLETE_FIELDS.filter((f) => f !== 'titulo_es'));
  assert.deepEqual(gaps[1].missing, ['temas_relacionados', 'ejemplo_bueno']);
  assert.deepEqual(gaps[2].missing, ['descripcion_es', 'pista_corta_es']);
  assert.equal(cat.isComplete(), false);
  gaps[0].missing.push('x'); // copia
  assert.equal(cat.incomplete()[0].missing.includes('x'), false);
});

test('un código incompleto se consulta igual: los opcionales ausentes salen como null / lista vacía', () => {
  const cat = createErrorCatalog(mini([{ id: 'MIN.ONLY', titulo_es: 'Solo título' }]));
  const e = cat.get('MIN.ONLY');
  assert.deepEqual({ ...e }, { id: 'MIN.ONLY', titulo_es: 'Solo título', descripcion_es: null, origen_tipico: null, impacto_defecto: null, temas_relacionados: [], ejemplo_malo: null, ejemplo_bueno: null, pista_corta_es: null });
  assert.equal(cat.hint('MIN.ONLY'), null);
});

test('un catálogo no válido se rechaza con un mensaje en español y no se usa a medias', () => {
  const dup = mini([full('A.ONE'), full('A.ONE')]);
  const cases = [null, undefined, 'texto', 7, [], {}, { schema: 1 }, { schema: 2, codes: [full('A.ONE')] }, mini([]), mini('no es lista'), mini([null]), mini([{ id: 'sin_forma', titulo_es: 'x' }]),
    mini([{ id: 'A.ONE' }]), mini([full('A.ONE', { origen_tipico: 'otro' })]), mini([full('A.ONE', { impacto_defecto: 'enorme' })]), dup];
  for (const c of cases) {
    assert.throws(() => createErrorCatalog(c), (e) => e instanceof Error && /^createErrorCatalog: el catálogo de errores no es válido/.test(e.message), JSON.stringify(c)?.slice(0, 60));
  }
  assert.throws(() => createErrorCatalog(dup), /repetido/);
});

test('rendimiento y robustez: 500 códigos (el máximo) se cargan y consultan sin problema; entrada hostil no cuelga', () => {
  const codes = Array.from({ length: 500 }, (_, i) => full(`BIG.C${i}`));
  const t0 = Date.now();
  const cat = createErrorCatalog(mini(codes));
  for (let i = 0; i < 5000; i += 1) cat.get(`BIG.C${i % 500}`);
  assert.equal(cat.size, 500);
  assert.ok(Date.now() - t0 < 1000);
  assert.throws(() => createErrorCatalog(mini([...codes, full('BIG.C500')])), /no es válido/); // 501 > máximo
});
