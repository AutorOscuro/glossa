// @purpose: Pruebas de la fachada de la lista blanca (core/whitelist.js): check, isWithinTarget, markNew, nombres propios, entradas hostiles y rendimiento.
// Pruebas de 1.11-T3. Los CA de la subparte y los 10 textos de control viven en tests/whitelist.ca.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as facade from '../core/whitelist.js';
import { createWhitelist, isWithinTarget } from '../core/whitelist.js';
import { createLemmaTable } from '../core/lemmas.js';
import { TARGET_RANGE } from '../core/whitelist.config.js';

const REAL = JSON.parse(fs.readFileSync(new URL('../content/taxonomy/lemmas.json', import.meta.url), 'utf8'));
const table = createLemmaTable(REAL);
const wl = createWhitelist({ table });
const tiny = createLemmaTable({ schema: 1, bands: ['1K'], lemmas: [['cat', ['cats']], ['run', ['ran', 'running']], ['left'], ['leave', ['left']], ['the'], ['a']].map(([lemma, forms = []]) => ({ lemma, pos: ['noun'], band: '1K', forms })) });
const wt = createWhitelist({ table: tiny });
const set = (...l) => new Set(l);

// ---------- fachada ----------
test('la fachada reexporta lo de T1 y T2 y el rango objetivo', () => {
  for (const name of ['createWhitelist', 'isWithinTarget', 'knownLemmas', 'knownLemmasDetailed', 'createLemmaTable', 'loadLemmas', 'tokenize', 'TARGET_RANGE']) assert.equal(typeof facade[name] === 'undefined', false, name);
  assert.deepEqual({ ...TARGET_RANGE }, { min: 0.9, max: 0.95 });
  assert.ok(Object.isFrozen(TARGET_RANGE));
});
test('createWhitelist: devuelve un objeto congelado y exige la tabla', () => {
  assert.ok(Object.isFrozen(wl));
  assert.deepEqual(Object.keys(wl).sort(), ['check', 'isWithinTarget', 'markNew']);
  for (const bad of [undefined, {}, { table: null }, { table: {} }, { table: { lemmasOf() {} } }]) assert.throws(() => createWhitelist(bad), /tabla de lemas/);
  assert.throws(() => createWhitelist({ table, properNouns: 'sí' }), /properNouns/);
  assert.throws(() => createWhitelist(null), /tabla de lemas/);
});
test('wl.isWithinTarget es la misma función suelta', () => {
  assert.equal(wl.isWithinTarget, isWithinTarget);
});

// ---------- isWithinTarget ----------
test('isWithinTarget: extremos incluidos y fuera por un pelo', () => {
  assert.equal(isWithinTarget(0.9), true);
  assert.equal(isWithinTarget(0.95), true);
  assert.equal(isWithinTarget(0.925), true);
  assert.equal(isWithinTarget(0.8999999), false);
  assert.equal(isWithinTarget(0.9500001), false);
  assert.equal(isWithinTarget(1), false);
  assert.equal(isWithinTarget(0), false);
});
test('isWithinTarget: 9/10 y 19/20 caen justo en el borde (la división da el mismo número que el literal)', () => {
  assert.equal(isWithinTarget(9 / 10), true);
  assert.equal(isWithinTarget(19 / 20), true);
  assert.equal(isWithinTarget(57 / 60), true);
  assert.equal(isWithinTarget(171 / 180), true);
});
test('isWithinTarget: rango propio, parcial y con extremos iguales', () => {
  assert.equal(isWithinTarget(0.8, { min: 0.8, max: 0.85 }), true);
  assert.equal(isWithinTarget(0.86, { min: 0.8, max: 0.85 }), false);
  assert.equal(isWithinTarget(0.99, { max: 1 }), true); // min por defecto 0.9
  assert.equal(isWithinTarget(0.85, { min: 0.8 }), true); // max por defecto 0.95
  assert.equal(isWithinTarget(0.97, { min: 0.8 }), false);
  assert.equal(isWithinTarget(0.5, { min: 0.5, max: 0.5 }), true);
  assert.equal(isWithinTarget(0.93, undefined), true);
  assert.equal(isWithinTarget(0.93, null), true);
  assert.equal(isWithinTarget(0.93, 'x'), true);
});
test('isWithinTarget: valores que no son fracción dan false (null, NaN, texto, fuera de 0..1)', () => {
  for (const v of [null, undefined, NaN, Infinity, -Infinity, '0.92', {}, [], -0.5, 92, 1.0001, true]) assert.equal(isWithinTarget(v), false, String(v));
});
test('isWithinTarget: rango inválido lanza Error en español', () => {
  for (const r of [{ min: 0.96, max: 0.9 }, { min: -0.1 }, { max: 1.1 }, { min: NaN }, { max: '0.95' }, { min: 90, max: 95 }]) assert.throws(() => isWithinTarget(0.92, r), /min y max/, JSON.stringify(r));
  assert.throws(() => isWithinTarget(null, { min: 2 }), /min y max/); // se valida aunque pct no sirva
});
test('isWithinTarget no modifica el rango que se le pasa ni TARGET_RANGE', () => {
  const r = { min: 0.8 };
  isWithinTarget(0.85, r);
  assert.deepEqual(r, { min: 0.8 });
  assert.deepEqual({ ...TARGET_RANGE }, { min: 0.9, max: 0.95 });
});

// ---------- check: forma del resultado y reglas ----------
test('check: el resultado tiene exactamente los campos del contrato', () => {
  const r = wt.check('the cat', set('the'));
  assert.deepEqual(Object.keys(r).sort(), ['ignored', 'knownCount', 'names', 'pctKnown', 'total', 'unknown', 'unknownCount']);
  assert.deepEqual(Object.keys(r.unknown[0]).sort(), ['count', 'end', 'lemma', 'lemmas', 'listed', 'norm', 'parts', 'start', 'text']);
  assert.deepEqual(Object.keys(r.ignored).sort(), ['acronyms', 'codes', 'names', 'numbers']);
});
test('check: `known` puede ser Set o arreglo (se pasa a minúscula y se recorta); lo demás lanza', () => {
  assert.equal(wt.check('the CAT', ['The ', ' CAT']).pctKnown, 1);
  assert.equal(wt.check('the cat', ['the', 7, null, '', 'cat']).pctKnown, 1);
  for (const bad of [undefined, null, 'the', {}, 5, new Map()]) assert.throws(() => wt.check('the', bad), /known/);
  assert.throws(() => wt.markNew('the', null), /known/);
});
test('check: no modifica el conjunto de conocidas', () => {
  const k = set('the');
  wt.check('the cat', k);
  assert.deepEqual([...k], ['the']);
});
test('check: una forma con dos lemas vale si CUALQUIERA está en lo conocido', () => {
  assert.equal(wt.check('left', set('leave')).pctKnown, 1);
  assert.equal(wt.check('left', set('left')).pctKnown, 1);
  assert.equal(wt.check('left', set('cat')).pctKnown, 0);
});
test('check: una forma flexionada vale por su lema (ran → run), y el lema solo cuenta si está en known', () => {
  assert.equal(wt.check('ran running run', set('run')).pctKnown, 1);
  assert.equal(wt.check('ran', set('cat')).pctKnown, 0);
});
test('check: una parte que la tabla no lista vale si ella misma está en known (palabras de `words` entran tal cual)', () => {
  assert.equal(wt.check('zork', set('zork')).pctKnown, 1);
  assert.equal(wt.check('zork', set('the')).pctKnown, 0);
});
test('check: la forma suelta en known también vale (el id de words puede ser la forma)', () => {
  assert.equal(wt.check('cats', set('cats')).pctKnown, 1);
});
test('check: una compuesta es conocida solo si TODAS sus partes lo son', () => {
  assert.equal(wt.check('cat-run', set('cat', 'run')).pctKnown, 1);
  const r = wt.check('cat-run', set('cat'));
  assert.deepEqual([r.pctKnown, r.unknown[0].text, r.unknown[0].lemma, r.unknown[0].parts.map((p) => p.part)], [0, 'cat-run', 'run', ['run']]);
});
test('check: una compuesta con dos partes desconocidas junta sus lemas sin repetir', () => {
  const r = wt.check('cat-cats', set('the'));
  assert.deepEqual([r.unknown[0].lemma, r.unknown[0].lemmas, r.unknown[0].parts.length], ['cat', ['cat'], 2]);
});
test('check: contracciones: la parte `not` y la `do` cuentan por separado y \'s no aporta parte', () => {
  const t = createWhitelist({ table: createLemmaTable({ schema: 1, bands: ['1K'], lemmas: ['do', 'not', 'cat', 'it'].map((lemma) => ({ lemma, pos: ['x'], band: '1K', forms: [] })) }) });
  assert.equal(t.check("don't", set('do', 'not')).pctKnown, 1);
  assert.equal(t.check("don't", set('do')).pctKnown, 0);
  assert.equal(t.check("cat's it's", set('cat', 'it')).pctKnown, 1);
});
test('check: cuenta cada aparición, pero `unknown` trae una sola entrada por palabra (clave: minúsculas)', () => {
  const r = wt.check('Cat cat CAT the the', set('the'));
  assert.deepEqual([r.total, r.knownCount, r.unknownCount, r.unknown.length], [5, 2, 3, 1]);
  assert.deepEqual([r.unknown[0].text, r.unknown[0].count, r.unknown[0].start, r.unknown[0].end], ['Cat', 3, 0, 3]);
});
test('check: `unknown` sale en orden de aparición, no alfabético', () => {
  assert.deepEqual(wt.check('run cat the cats ran', set('the')).unknown.map((u) => u.norm), ['run', 'cat', 'cats', 'ran']);
});
test('check: pctKnown es la fracción exacta conocidas / total (no se redondea)', () => {
  assert.equal(wt.check('the the cat', set('the')).pctKnown, 2 / 3);
  assert.equal(wt.check('cat', set('cat')).pctKnown, 1);
  assert.equal(wt.check('cat', set('the')).pctKnown, 0);
});
test('check: un resultado nuevo en cada llamada (no comparte listas)', () => {
  const a = wt.check('cat', set('the'));
  const b = wt.check('cat', set('the'));
  assert.notEqual(a, b);
  a.unknown.push('x');
  assert.equal(b.unknown.length, 1);
});
test('check: números, siglas y códigos no cuentan ni como conocidos ni como desconocidos', () => {
  const r = wt.check('3rd U.S. mp3 1990s 10:30 the', set('the'));
  assert.deepEqual([r.total, r.pctKnown, r.ignored], [1, 1, { numbers: 3, acronyms: 1, codes: 1, names: 0 }]);
});
test('check: `t-shirt` (una parte sin lema) es desconocida con su forma original; `T-shirt` en medio de frase se toma por nombre (límite conocido)', () => {
  const r = wt.check('a t-shirt', set('a'));
  assert.deepEqual([r.unknown[0].text, r.unknown[0].lemma, r.unknown[0].listed], ['t-shirt', 't', false]);
  assert.equal(wt.check('a T-shirt', set('a')).ignored.names, 1);
  assert.equal(wt.check('T-shirt a', set('a')).unknown[0].text, 'T-shirt'); // al inicio de frase no se presume nombre
});

// ---------- nombres propios ----------
test('nombres propios: en medio de la frase y sin estar en la tabla se omiten y se listan', () => {
  const r = wt.check('the cat met Zelda and Bruno-Luis', set('the', 'cat'));
  assert.deepEqual([r.total, r.knownCount, r.ignored.names, r.names], [4, 2, 2, ['Zelda', 'Bruno-Luis']]);
  assert.deepEqual(r.unknown.map((u) => u.text), ['met', 'and']);
});
test('nombres propios: al inicio de frase NO se presumen nombres (conservador), salvo si aparecen como nombre en otro lugar', () => {
  assert.deepEqual(wt.check('Zelda the cat', set('the', 'cat')).unknown.map((u) => u.text), ['Zelda']);
  assert.equal(wt.check('Zelda the cat. We met Zelda.', set('the', 'cat')).ignored.names, 2);
  assert.equal(wt.check('We met Zelda.\nZelda the cat', set('the', 'cat')).ignored.names, 2);
  assert.equal(wt.check('We met zelda. Zelda ran.', set('the')).ignored.names, 0); // en minúscula no es nombre
});
test('nombres propios: una palabra de la tabla con mayúscula NO es nombre (Cat en medio sigue siendo desconocida)', () => {
  const r = wt.check('the Cat', set('the'));
  assert.deepEqual([r.ignored.names, r.unknown[0].text], [0, 'Cat']);
});
test('nombres propios: una MAYÚSCULA TOTAL (ZELDA) no es nombre; mayúscula mezclada (McZelda) sí', () => {
  assert.equal(wt.check('the ZELDA', set('the')).ignored.names, 0);
  assert.equal(wt.check('the McZelda', set('the')).ignored.names, 1);
});
test('nombres propios: si la persona los marcó como conocidos, cuentan como conocidos y no como nombres', () => {
  const r = wt.check('the Zelda', set('the', 'zelda'));
  assert.deepEqual([r.total, r.knownCount, r.ignored.names], [2, 2, 0]);
});
test("nombres propios: properNouns 'count' los trata como palabras (por defecto de la fábrica o por llamada)", () => {
  const strict = createWhitelist({ table: tiny, properNouns: 'count' });
  const r = strict.check('the cat met Zelda', set('the', 'cat'));
  assert.deepEqual([r.total, r.ignored.names, r.unknown.map((u) => u.text)], [4, 0, ['met', 'Zelda']]);
  assert.equal(wt.check('the Zelda', set('the'), { properNouns: 'count' }).total, 2);
  assert.equal(strict.check('the Zelda', set('the'), { properNouns: 'ignore' }).total, 1);
  assert.throws(() => wt.check('the', set('the'), { properNouns: 'nunca' }), /properNouns/);
  assert.throws(() => wt.markNew('the', set('the'), { properNouns: 1 }), /properNouns/);
});
test('nombres propios: `Zelda\'s` se trata como `zelda`', () => {
  assert.equal(wt.check("the cat met Zelda's cat", set('the', 'cat')).ignored.names, 1);
});

// ---------- markNew ----------
test('markNew: señales por aparición, tramos que cubren el texto entero y lista de estudio', () => {
  const text = 'The cat ran. A cat ran!';
  const m = wt.markNew(text, set('the', 'a'));
  assert.deepEqual(m.marks.map((x) => [x.start, x.end, x.text, x.lemma]), [[4, 7, 'cat', 'cat'], [8, 11, 'ran', 'run'], [15, 18, 'cat', 'cat'], [19, 22, 'ran', 'run']]);
  assert.equal(m.segments.map((s) => s.text).join(''), text);
  assert.deepEqual(m.segments.map((s) => [s.start, s.end, s.isNew]), [[0, 4, false], [4, 7, true], [7, 8, false], [8, 11, true], [11, 15, false], [15, 18, true], [18, 19, false], [19, 22, true], [22, 23, false]]);
  assert.deepEqual(m.newWords.map((w) => [w.text, w.lemma, w.count]), [['cat', 'cat', 2], ['ran', 'run', 2]]);
  assert.deepEqual([m.total, m.pctKnown], [6, 2 / 6]);
});
test('markNew: sin palabras nuevas, un solo tramo con todo el texto; texto vacío, sin tramos', () => {
  const m = wt.markNew('the a', set('the', 'a'));
  assert.deepEqual([m.marks, m.newWords, m.segments], [[], [], [{ text: 'the a', start: 0, end: 5, isNew: false }]]);
  const e = wt.markNew('', set('the'));
  assert.deepEqual([e.marks, e.segments, e.newWords, e.pctKnown, e.total], [[], [], [], null, 0]);
});
test('markNew: texto que empieza o termina con palabra nueva, y con emoji y comillas curvas en medio', () => {
  const text = '😀 cat “the” cat';
  const m = wt.markNew(text, set('the'));
  assert.equal(m.segments.map((s) => s.text).join(''), text);
  assert.deepEqual(m.segments.map((s) => s.isNew), [false, true, false, true]);
  assert.equal(m.segments[0].text, '😀 ');
  assert.equal(m.segments[3].text, 'cat');
});
test('markNew: números, nombres y siglas no se marcan como nuevas', () => {
  const m = wt.markNew('the 3rd U.S. cat met Zelda', set('the', 'cat'));
  assert.deepEqual(m.marks.map((x) => x.text), ['met']);
});
test('markNew: acepta entradas que no son texto sin lanzar', () => {
  for (const t of [null, undefined, {}, NaN, [], true]) assert.deepEqual(wt.markNew(t, set('the')).segments, []);
  assert.deepEqual(wt.markNew(42, set('the')).segments, [{ text: '42', start: 0, end: 2, isNew: false }]); // un número finito vale como su texto (igual que tokenize)
});
test('markNew y check coinciden: mismas desconocidas, mismo pctKnown', () => {
  const text = "The cats ran and Zelda's cat left. Don't run, 3rd U.S. cat!";
  const k = set('the', 'and');
  const c = wt.check(text, k);
  const m = wt.markNew(text, k);
  assert.deepEqual(m.newWords, c.unknown);
  assert.equal(m.pctKnown, c.pctKnown);
  assert.equal(m.marks.length, c.unknownCount);
});

// ---------- invariantes con textos al azar ----------
test('invariantes: tramos cubren el texto, cuentas cuadran y no se lanza (400 textos al azar)', () => {
  const frags = ['the', 'The', 'cat', 'CATS', 'ran', 'left', "don't", 'don’t', 'well-known', '3rd', 'U.S.', 'mp3', 'Zelda', '😀', '“', '”', '.', ',', '!', '\n', ' ', '  ', 'ñandú', 'café', '—', '-', "'", '1,000', 'x'];
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < 400; i += 1) {
    let text = '';
    const n = Math.floor(rnd() * 25);
    for (let j = 0; j < n; j += 1) text += frags[Math.floor(rnd() * frags.length)] + (rnd() < 0.7 ? ' ' : '');
    const k = rnd() < 0.5 ? set('the', 'cat') : set();
    const c = wt.check(text, k);
    const m = wt.markNew(text, k);
    assert.equal(c.knownCount + c.unknownCount, c.total, JSON.stringify(text));
    assert.equal(c.pctKnown, c.total === 0 ? null : c.knownCount / c.total);
    assert.equal(c.unknown.reduce((s, u) => s + u.count, 0), c.unknownCount);
    assert.equal(m.segments.map((s) => s.text).join(''), text);
    assert.equal(m.marks.length, c.unknownCount);
    for (const mk of m.marks) assert.equal(text.slice(mk.start, mk.end), mk.text);
    assert.ok(c.pctKnown === null || (c.pctKnown >= 0 && c.pctKnown <= 1));
  }
});

// ---------- entradas hostiles y rendimiento ----------
test('hostiles: nombres de propiedades de objeto como palabras no rompen nada', () => {
  const r = wt.check('constructor __proto__ tostring hasownproperty prototype valueof', set('the'));
  assert.equal(r.total, 6);
  assert.equal(r.knownCount, 0);
  const camel = wt.check('constructor __proto__ toString hasOwnProperty prototype valueOf', set('the')); // en mayúscula mezclada y sin lema: nombres
  assert.deepEqual([camel.total, camel.ignored.names], [3, 3]);
  assert.deepEqual(Object.getPrototypeOf(r.ignored), Object.prototype);
  assert.equal(wt.check('constructor', set('constructor')).pctKnown, 1);
});
test('hostiles: cadenas patológicas se resuelven rápido', () => {
  for (const text of ['U.'.repeat(50000), 'a-'.repeat(50000), "a'".repeat(50000), '😀'.repeat(50000), 'the '.repeat(100000)]) {
    const t0 = performance.now();
    wt.check(text, set('the'));
    assert.ok(performance.now() - t0 < 3000);
  }
});
test('rendimiento (4.R.9): 800.000 caracteres con el lemmas.json real, mediana de 5 corridas < 3 s', () => {
  const para = 'The quick brown fox jumps over the lazy dog while Maria walks home with her mother, and they don\'t talk about the 3rd U.S. game. ';
  const text = para.repeat(Math.ceil(800000 / para.length)).slice(0, 800000);
  const known = new Set(['the', 'over', 'with', 'and', 'they', 'do', 'not', 'talk', 'about', 'her', 'home']);
  const times = [];
  for (let i = 0; i < 5; i += 1) {
    const t0 = performance.now();
    const r = wl.check(text, known);
    times.push(performance.now() - t0);
    assert.ok(r.total > 100000);
  }
  times.sort((a, b) => a - b);
  assert.ok(times[2] < 3000, `mediana ${times[2].toFixed(0)} ms`);
});

// ---------- huecos cerrados tras la primera tanda de roturas (4.R) ----------
test('isWithinTarget: 0 es una fracción válida (rango propio que incluye el 0)', () => {
  assert.equal(isWithinTarget(0, { min: 0, max: 0.5 }), true);
  assert.equal(isWithinTarget(0, { min: 0, max: 0 }), true);
});
test('createWhitelist: la tabla debe tener lemasOf y también analyze', () => {
  assert.throws(() => createWhitelist({ table: { analyze() {} } }), /tabla de lemas/);
  assert.throws(() => createWhitelist({ table: { lemmasOf() {} } }), /tabla de lemas/);
});
test('check: una compuesta con una parte sin lema que la persona YA conoce y otra desconocida no es nombre', () => {
  const r = wt.check('the Zork-Cat', set('the', 'zork'));
  assert.deepEqual([r.ignored.names, r.unknown.map((u) => u.text)], [0, ['Zork-Cat']]);
});
test('check: `listed` es falso si ALGUNA parte desconocida no está en la tabla', () => {
  const r = wt.check('cat-zork', set('the'));
  assert.deepEqual([r.unknown[0].listed, r.unknown[0].parts.map((p) => p.listed)], [false, [true, false]]);
  assert.equal(wt.check('cat-run', set('the')).unknown[0].listed, true);
});
test('markNew: sin tramos vacíos (palabra nueva al inicio, dos nuevas seguidas)', () => {
  const m = wt.markNew('cat run the', set('the'));
  assert.deepEqual(m.segments.map((s) => [s.text, s.isNew]), [['cat', true], [' ', false], ['run', true], [' the', false]]);
  assert.ok(m.segments.every((s) => s.text !== ''));
});
