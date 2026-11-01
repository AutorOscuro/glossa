// @purpose: Pruebas de la búsqueda local en el léxico (core/lexSearch.js, 2.7-T4): CA 4 (mayúsculas y acentos), orden de resultados, vacío y entradas hostiles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLexSearch, LEX_SEARCH } from '../core/lexSearch.js';

const E = (lemma, es, extra = {}) => ({ id: `vocab.t.${lemma}`, lemma, pos: 'noun', family: 'vocab.t', level: 'A1', es, def_en: 'x', examples: [], ...extra });
const LEX = [
  E('knee', ['rodilla']), E('café', ['café', 'cafetería']), E('year', ['año'], { derivation: ['yearly'] }),
  E('cafeteria', ['cafetería']), E('Résumé', ['currículum']), E('ankle', ['tobillo']), E('kneel', ['arrodillarse']),
];
const lemmas = (r) => r.results.map((x) => x.entry.lemma);
const s = createLexSearch(LEX);

test('CA 4 · tolera mayúsculas, acentos y espacios en la consulta y en las entradas', () => {
  for (const q of ['KNEE', 'Knee', '  knee ', 'knee.']) assert.deepEqual(lemmas(s.search(q))[0], 'knee', q);
  for (const q of ['cafe', 'CAFÉ', 'café', 'Cafe']) assert.ok(lemmas(s.search(q)).includes('café'), q);
  assert.deepEqual(lemmas(s.search('resume')), ['Résumé']);
  assert.deepEqual(lemmas(s.search('RÉSUMÉ')), ['Résumé']);
  assert.deepEqual(lemmas(s.search('curriculum')), ['Résumé'], 'también por la traducción sin acento');
  assert.deepEqual(lemmas(s.search('Rodilla')), ['knee', 'kneel'], 'exacto primero; «arrodillarse» contiene «rodilla»');
});

test('busca por traducción y por derivados, e indica por dónde coincidió', () => {
  const r = s.search('año');
  assert.equal(r.results[0].entry.lemma, 'year');
  assert.equal(r.results[0].via, 'es');
  assert.equal(s.search('yearly').results[0].via, 'derivation');
  assert.equal(s.search('ano').results[0].entry.lemma, 'year', 'ñ y n se juntan: es la tolerancia buscada');
});

test('el orden es exacto, luego prefijo, luego contiene; cada entrada sale una vez', () => {
  const r = s.search('kne');
  assert.deepEqual(lemmas(r), ['knee', 'kneel']);
  assert.deepEqual(r.results.map((x) => x.match), ['prefix', 'prefix']);
  const e = s.search('knee');
  assert.deepEqual(lemmas(e), ['knee', 'kneel']);
  assert.equal(e.results[0].match, 'exact');
  const c = s.search('nkl');
  assert.deepEqual(lemmas(c), ['ankle']);
  assert.equal(c.results[0].match, 'contains');
  const caf = s.search('cafe');
  assert.equal(new Set(lemmas(caf)).size, lemmas(caf).length);
  assert.deepEqual(lemmas(caf), ['café', 'cafeteria'], 'exacto antes que prefijo');
});

test('sin coincidencias: found false y reason «none» (ahí la hoja ofrecerá añadir)', () => {
  const r = s.search('zzyzx');
  assert.deepEqual({ found: r.found, reason: r.reason, n: r.results.length }, { found: false, reason: 'none', n: 0 });
});

test('consulta vacía, de solo símbolos o de una letra: no se inventa nada', () => {
  for (const q of ['', '   ', '...', undefined, null, 42, {}]) { const r = s.search(q); assert.equal(r.found, false, String(q)); assert.equal(r.reason, 'empty', String(q)); }
  const one = s.search('k');
  assert.deepEqual(lemmas(one), ['knee', 'kneel'], 'una letra sirve como prefijo');
  assert.equal(s.search('z').reason, 'short');
  assert.deepEqual(lemmas(s.search('n')), ['knee', 'kneel'].filter((l) => l.startsWith('n')), 'una letra no busca por «contiene»');
});

test('el límite por defecto y el propio se respetan, y los valores raros caen al defecto', () => {
  const many = createLexSearch(Array.from({ length: 50 }, (_, i) => E(`word${String(i).padStart(2, '0')}`, ['palabra'])));
  assert.equal(many.search('word').results.length, LEX_SEARCH.limit);
  assert.equal(many.search('word', { limit: 3 }).results.length, 3);
  assert.equal(many.search('word', { limit: -1 }).results.length, LEX_SEARCH.limit);
  assert.equal(many.search('word', { limit: 9999 }).results.length, 50);
  assert.equal(many.search('word').results[0].entry.lemma, 'word00', 'orden alfabético estable');
});

test('entradas hostiles o mal formadas se ignoran sin lanzar', () => {
  const bad = createLexSearch([null, 3, 'x', {}, { lemma: 5 }, { lemma: '  ' }, { lemma: 'ok', es: [1, null, 'bien'], derivation: 'no' }, E('fine', 'no es lista')]);
  assert.equal(bad.size, 2);
  assert.deepEqual(lemmas(bad.search('bien')), ['ok']);
  assert.equal(createLexSearch(undefined).size, 0);
  assert.equal(createLexSearch('texto').search('a').found, false);
  assert.equal(createLexSearch(LEX, { limit: 'x' }).search('knee').found, true);
});

test('consultas enormes se acotan y no cuelgan', () => {
  const t0 = Date.now();
  const r = s.search('a'.repeat(1_000_000));
  assert.equal(r.found, false);
  assert.ok(r.query.length <= LEX_SEARCH.maxQuery);
  assert.ok(Date.now() - t0 < 500);
});

test('no modifica las entradas y devuelve las mismas referencias', () => {
  const copy = JSON.stringify(LEX);
  const r = s.search('knee');
  assert.equal(r.results[0].entry, LEX[0]);
  assert.equal(JSON.stringify(LEX), copy);
});
