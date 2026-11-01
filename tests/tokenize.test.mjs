// @purpose: Pruebas del tokenizador de la lista blanca (core/tokenize.js): contracciones, guiones, números, siglas, emoji, vacío y textos hostiles.
// Pruebas de core/tokenize.js (subparte 1.11, tramo T1). CA-1 y CA-4 de la 1.11 más bordes (4.1) y entradas hostiles (4.3, pasada 4).
import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, splitContraction, TOKEN_KINDS } from '../core/tokenize.js';

const norms = (text) => tokenize(text).map((t) => t.norm);
const partsOf = (text) => tokenize(text).map((t) => t.parts);
const kinds = (text) => tokenize(text).map((t) => t.kind);

// ---------- CA-1: don't, well-known, U.S., 3rd ----------
test('CA-1 don\'t: una palabra con dos partes a buscar', () => {
  const [t, ...rest] = tokenize("don't");
  assert.equal(rest.length, 0);
  assert.deepEqual(t, { text: "don't", start: 0, end: 5, kind: 'word', norm: "don't", parts: ['do', 'not'], hyphenated: false, cap: 'lower', sentenceStart: true });
});

test('CA-1 well-known: una palabra unida por guion con dos partes', () => {
  const [t, ...rest] = tokenize('well-known');
  assert.equal(rest.length, 0);
  assert.deepEqual(t, { text: 'well-known', start: 0, end: 10, kind: 'word', norm: 'well-known', parts: ['well', 'known'], hyphenated: true, cap: 'lower', sentenceStart: true });
});

test('CA-1 U.S.: sigla con puntos, un solo token, sin partes que buscar', () => {
  const [t, ...rest] = tokenize('U.S.');
  assert.equal(rest.length, 0);
  assert.deepEqual(t, { text: 'U.S.', start: 0, end: 4, kind: 'acronym', norm: 'u.s.', parts: [], hyphenated: false, cap: 'upper', sentenceStart: true });
});

test('CA-1 3rd: ordinal, un número sin partes y sin mayúsculas que valgan', () => {
  const [t, ...rest] = tokenize('3rd');
  assert.equal(rest.length, 0);
  assert.deepEqual(t, { text: '3rd', start: 0, end: 3, kind: 'number', norm: '3rd', parts: [], hyphenated: false, cap: 'none', sentenceStart: true });
});

test('CA-1 en una frase: las cuatro formas juntas', () => {
  const tokens = tokenize("I don't like the well-known U.S. 3rd edition.");
  assert.deepEqual(tokens.map((t) => t.text), ['I', "don't", 'like', 'the', 'well-known', 'U.S.', '3rd', 'edition']);
  assert.deepEqual(tokens.map((t) => t.kind), ['word', 'word', 'word', 'word', 'word', 'acronym', 'number', 'word']);
});

// ---------- CA-4: texto vacío y emoji ----------
test('CA-4 vacío: sin tokens y sin lanzar, con cualquier tipo de entrada', () => {
  for (const value of ['', ' ', '   \t\n ', '\u200B', '\uFEFF\u00AD', null, undefined, NaN, Infinity, {}, [], () => 1, true, Symbol('x'), 10n]) {
    assert.deepEqual(tokenize(value), [], String(typeof value));
  }
});

test('CA-4 emoji: no son tokens y las palabras de alrededor se conservan', () => {
  assert.deepEqual(norms('I love 😀 you'), ['i', 'love', 'you']);
  assert.deepEqual(norms('😀'), []);
  assert.deepEqual(norms('😀😀😀'), []);
  assert.deepEqual(norms('hello😀world'), ['hello', 'world']);
  assert.deepEqual(norms('family 👨‍👩‍👧‍👦 time'), ['family', 'time']); // secuencia con ZWJ
  assert.deepEqual(norms('thumbs 👍🏽 up'), ['thumbs', 'up']); // con tono de piel
  assert.deepEqual(norms('flag 🇨🇴 here'), ['flag', 'here']); // bandera (dos indicadores regionales)
  assert.deepEqual(norms('heart ❤️ beat'), ['heart', 'beat']); // con selector de variación
  assert.deepEqual(norms('★ ☆ © ® ™ → ←'), []);
});

test('CA-4 emoji: las posiciones siguen siendo las del texto original', () => {
  const text = 'a 😀 bc';
  const [a, bc] = tokenize(text);
  assert.equal(a.start, 0);
  assert.equal(bc.start, 5); // el emoji ocupa 2 unidades UTF-16
  assert.equal(text.slice(bc.start, bc.end), 'bc');
});

// ---------- contracciones ----------
test('splitContraction: la tabla de contracciones comunes', () => {
  const table = [
    ["don't", ['do', 'not']], ["doesn't", ['does', 'not']], ["didn't", ['did', 'not']], ["isn't", ['is', 'not']], ["aren't", ['are', 'not']],
    ["wasn't", ['was', 'not']], ["weren't", ['were', 'not']], ["haven't", ['have', 'not']], ["hasn't", ['has', 'not']], ["hadn't", ['had', 'not']],
    ["couldn't", ['could', 'not']], ["shouldn't", ['should', 'not']], ["wouldn't", ['would', 'not']], ["mustn't", ['must', 'not']],
    ["can't", ['can', 'not']], ["won't", ['will', 'not']], ["shan't", ['shall', 'not']], ["ain't", ['be', 'not']],
    ["I'm", ['i', 'am']], ["you're", ['you', 'are']], ["they've", ['they', 'have']], ["we'll", ['we', 'will']],
    ["it's", ['it']], ["John's", ['john']], ["dogs'", ['dogs']], ["I'd", ['i']], ["she'd", ['she']],
    ["let's", ['let', 'us']], ["y'all", ['you', 'all']], ["o'clock", ['clock']],
    ["shouldn't've", ['should', 'not', 'have']], ["I'd've", ['i', 'have']], ["rock'n'roll", ['rock', 'n', 'roll']],
    ['hello', ['hello']], ['HELLO', ['hello']], ['', []],
  ];
  for (const [word, expected] of table) assert.deepEqual(splitContraction(word), expected, word);
});

test('splitContraction: apóstrofos curvos y de otros tipos valen igual que el recto', () => {
  for (const apostrophe of ['\u2019', '\u2018', '\u02BC', '\u00B4', '\u0060', '\u2032']) {
    assert.deepEqual(splitContraction(`don${apostrophe}t`), ['do', 'not'], apostrophe);
    assert.deepEqual(splitContraction(`can${apostrophe}t`), ['can', 'not'], apostrophe);
  }
});

test('splitContraction: entradas que no son texto no lanzan y devuelven []', () => {
  for (const value of [null, undefined, {}, [], NaN]) assert.deepEqual(splitContraction(value), []);
  assert.deepEqual(splitContraction(42), ['42']);
});

test('splitContraction: devuelve una lista nueva cada vez (no se puede ensuciar la tabla interna)', () => {
  const a = splitContraction("won't");
  a.push('x');
  assert.deepEqual(splitContraction("won't"), ['will', 'not']);
  assert.deepEqual(splitContraction('toString'), ['tostring']);
  assert.deepEqual(splitContraction('__proto__'), ['__proto__']);
});

test('tokenize: contracciones con apóstrofo curvo, en mayúsculas y con la `I`', () => {
  assert.deepEqual(partsOf('I don’t know'), [['i'], ['do', 'not'], ['know']]);
  assert.deepEqual(partsOf("DON'T SHOUT"), [['do', 'not'], ['shout']]);
  assert.deepEqual(partsOf("I'm sure I'll go"), [['i', 'am'], ['sure'], ['i', 'will'], ['go']]);
  assert.equal(tokenize('don’t')[0].text, 'don’t'); // el texto original se conserva
  assert.equal(tokenize('don’t')[0].norm, "don't"); // y norm lleva el apóstrofo recto
});

test('tokenize: apóstrofos en el borde se ignoran', () => {
  assert.deepEqual(norms("'hello'"), ['hello']);
  assert.deepEqual(norms("the dogs' bones"), ['the', 'dogs', 'bones']);
  assert.deepEqual(norms("'"), []);
  assert.deepEqual(norms("''' hi '''"), ['hi']);
  assert.deepEqual(norms("hello'"), ['hello']);
});

// ---------- guiones ----------
test('tokenize: palabras con guion, números compuestos y cifras dentro', () => {
  assert.deepEqual(partsOf('twenty-one'), [['twenty', 'one']]);
  assert.deepEqual(partsOf('mother-in-law'), [['mother', 'in', 'law']]);
  assert.deepEqual(partsOf('5-year-old'), [['year', 'old']]);
  assert.deepEqual(partsOf('long-term'), [['long', 'term']]);
  assert.equal(tokenize('5-year-old')[0].kind, 'word');
  assert.equal(tokenize('well-known')[0].hyphenated, true);
  assert.equal(tokenize('known')[0].hyphenated, false);
});

test('tokenize: guion largo, medio y espaciado separan; los guiones Unicode unen', () => {
  assert.deepEqual(norms('word—word'), ['word', 'word']);
  assert.deepEqual(norms('word–word'), ['word', 'word']);
  assert.deepEqual(norms('word - word'), ['word', 'word']);
  assert.deepEqual(norms('word -- word'), ['word', 'word']);
  for (const hyphen of ['\u2010', '\u2011', '\u2012', '\u2212']) assert.deepEqual(partsOf(`well${hyphen}known`), [['well', 'known']], hyphen);
  assert.deepEqual(norms('well\u2011known'), ['well-known']);
});

test('tokenize: guion en el borde o repetido no crea partes vacías', () => {
  assert.deepEqual(norms('well-'), ['well']);
  assert.deepEqual(norms('-well'), ['well']);
  assert.deepEqual(norms('---'), []);
  assert.deepEqual(norms('a--b'), ['a', 'b']);
  assert.deepEqual(partsOf('a-b-c'), [['a', 'b', 'c']]);
});

test('tokenize: contracción dentro de un compuesto con guion', () => {
  assert.deepEqual(partsOf("don't-care"), [['do', 'not', 'care']]);
  assert.deepEqual(partsOf("Mother's-day"), [['mother', 'day']]);
});

// ---------- números ----------
test('tokenize: números de todo tipo son un solo token de tipo number', () => {
  const numbers = ['42', '3.5', '1,000', '1,000,000.50', '10:30', '12/25/2026', '2026-10-25', '5-10', '3rd', '1st', '2nd', '4th', '1990s', '10am', '5pm', '0.5', '007'];
  for (const n of numbers) {
    const tokens = tokenize(n);
    assert.equal(tokens.length, 1, n);
    assert.equal(tokens[0].kind, 'number', n);
    assert.deepEqual(tokens[0].parts, [], n);
    assert.equal(tokens[0].text, n, n);
    assert.equal(tokens[0].cap, 'none', n);
  }
});

test('tokenize: el punto o la coma al final de un número no forman parte de él', () => {
  assert.deepEqual(norms('I have 3.'), ['i', 'have', '3']);
  assert.deepEqual(norms('1, 2, 3'), ['1', '2', '3']);
  assert.deepEqual(norms('It costs $5.50 now'), ['it', 'costs', '5.50', 'now']);
  assert.deepEqual(norms('50% off'), ['50', 'off']);
  assert.deepEqual(norms('3.x'), ['3', 'x']);
});

test('tokenize: letras con cifras que no son número son alnum, sin partes', () => {
  for (const code of ['mp3', '4x4', 'B2B', 'A1', '3D', '5km', '3.5kg', '1th2']) {
    const [t, ...rest] = tokenize(code);
    assert.equal(rest.length, 0, code);
    assert.equal(t.kind, 'alnum', code);
    assert.deepEqual(t.parts, [], code);
  }
  assert.deepEqual(partsOf('mp3-player'), [['player']]);
  assert.equal(tokenize('mp3-player')[0].kind, 'word');
});

test('tokenize: cifras que no son ASCII también son números', () => {
  assert.deepEqual(kinds('٣ ٤٥ ½'), ['number', 'number', 'number']);
});

// ---------- siglas ----------
test('tokenize: siglas con puntos', () => {
  for (const sigla of ['U.S.', 'U.S.A.', 'U.K.', 'e.g.', 'i.e.', 'a.m.', 'p.m.', 'U.S.A', 'I.O.U.']) {
    const [t, ...rest] = tokenize(sigla);
    assert.equal(rest.length, 0, sigla);
    assert.equal(t.kind, 'acronym', sigla);
    assert.equal(t.text, sigla, sigla);
    assert.deepEqual(t.parts, [], sigla);
  }
});

test('tokenize: las siglas sin puntos y las abreviaturas con un punto son palabras', () => {
  assert.deepEqual(kinds('NASA TV OK'), ['word', 'word', 'word']);
  assert.deepEqual(partsOf('NASA'), [['nasa']]);
  assert.equal(tokenize('NASA')[0].cap, 'upper');
  assert.deepEqual(norms('Mr. Smith'), ['mr', 'smith']);
  assert.deepEqual(kinds('plan B. Then'), ['word', 'word', 'word']);
});

test('tokenize: una sigla pegada a otra palabra no se confunde', () => {
  assert.deepEqual(norms('school.He left'), ['school', 'he', 'left']);
  assert.deepEqual(norms('I live in the U.S. now'), ['i', 'live', 'in', 'the', 'u.s.', 'now']);
  assert.deepEqual(kinds('U.S.is'), ['word', 'word', 'word']); // sin separación no hay sigla: U, S, is
  assert.deepEqual(norms('U.S'), ['u', 's']); // una sola pareja con punto no es sigla (hace falta al menos U.S.)
});

// ---------- tipos, mayúsculas, inicio de frase ----------
test('TOKEN_KINDS lista los cuatro tipos y cada token usa uno', () => {
  assert.deepEqual([...TOKEN_KINDS], ['word', 'number', 'acronym', 'alnum']);
  assert.throws(() => { 'use strict'; TOKEN_KINDS.push('x'); });
  for (const t of tokenize("a 1 U.S. mp3 don't")) assert.ok(TOKEN_KINDS.includes(t.kind));
});

test('cap: minúsculas, título, mayúsculas y mezcla', () => {
  const caps = (text) => tokenize(text).map((t) => t.cap);
  assert.deepEqual(caps('house House HOUSE hOUSE McDonald iPhone'), ['lower', 'title', 'upper', 'mixed', 'mixed', 'mixed']);
  assert.deepEqual(caps('I a A'), ['title', 'lower', 'title']);
  assert.deepEqual(caps('3rd 42'), ['none', 'none']);
  assert.deepEqual(caps('B2B'), ['upper']);
  assert.deepEqual(caps('Café ÉCOLE école'), ['title', 'upper', 'lower']);
});

test('sentenceStart: el primero, tras . ! ? … o salto de línea; no tras coma ni emoji', () => {
  const flags = (text) => tokenize(text).map((t) => t.sentenceStart);
  assert.deepEqual(flags('Hello there. How are you? Fine! ok'), [true, false, true, false, false, true, true]);
  assert.deepEqual(flags('wait… Okay'), [true, true]);
  assert.deepEqual(flags('one\ntwo\r\nthree'), [true, true, true]);
  assert.deepEqual(flags('yes, Paris'), [true, false]);
  assert.deepEqual(flags('😀 Hello'), [true]);
  assert.deepEqual(flags('Hi 😀 Bob'), [true, false]);
  assert.deepEqual(flags('He said "stop." Then left'), [true, false, false, true, false]);
});

// ---------- posiciones y texto original ----------
test('invariante: text.slice(start, end) === token.text y los tokens van en orden sin solaparse', () => {
  const samples = [
    "I don’t know the well‐known U.S. 3rd-place winner — really! 😀 Café déjà vu, 1,000.50 mp3s.",
    'a\u200Bb c\u00ADd e\uFEFFf', 'e\u0301cole', '   leading and trailing   ', '😀a😀b😀', "'a' -b- (c) [d] {e}", 'A.B.C.D. x1.y2.',
    '\u0000\u0001 a \uD800 b', 'tab\tsep\nnewline', '日本語 text', 'ñandú ÑANDÚ', '1.2.3.4', 'a,b;c:d/e\\f|g',
  ];
  for (const text of samples) {
    let last = 0;
    for (const t of tokenize(text)) {
      assert.equal(text.slice(t.start, t.end), t.text, JSON.stringify(text));
      assert.ok(t.start >= last, `orden en ${JSON.stringify(text)}`);
      assert.ok(t.end > t.start);
      last = t.end;
    }
  }
});

test('espacios y puntuación alrededor no cambian los tokens', () => {
  const plain = norms('I like it');
  assert.deepEqual(norms('  I   like\tit  '), plain);
  assert.deepEqual(norms('"I like it!"'), plain);
  assert.deepEqual(norms('(I) [like] {it}'), plain);
  assert.deepEqual(norms('I, like; it:'), plain);
  assert.deepEqual(norms('I\u00A0like\u2003it'), plain);
});

// ---------- invisibles, acentos, otros alfabetos ----------
test('invisibles dentro de una palabra se quitan de norm y de parts, no de text', () => {
  const [t] = tokenize('co\u00ADoperate');
  assert.equal(t.text, 'co\u00ADoperate');
  assert.equal(t.norm, 'cooperate');
  assert.deepEqual(t.parts, ['cooperate']);
  assert.deepEqual(norms('a\u200Bb'), ['ab']);
  assert.deepEqual(norms('\uFEFFhello'), ['hello']);
  assert.deepEqual(norms('hel\u200Dlo'), ['hello']);
});

test('acentos: NFC y NFD dan la misma palabra', () => {
  assert.deepEqual(norms('caf\u00E9'), ['caf\u00E9']);
  assert.deepEqual(norms('cafe\u0301'), ['caf\u00E9']);
  assert.deepEqual(partsOf('NIÑO'), [['niño']]);
  assert.deepEqual(norms('Straße'), ['straße']);
});

test('otros alfabetos no lanzan y dan palabras (no se ponen en la lista)', () => {
  assert.deepEqual(kinds('привет мир'), ['word', 'word']);
  assert.equal(tokenize('日本語')[0].kind, 'word');
  assert.deepEqual(norms('über-cool'), ['über-cool']);
});

// ---------- entradas que no son texto, hostiles y rendimiento ----------
test('un número finito se trata como su texto; otros valores no son texto', () => {
  assert.deepEqual(norms(42), ['42']);
  assert.deepEqual(kinds(3.5), ['number']);
  assert.deepEqual(norms(-7), ['7']);
});

test('texto con propiedades de objeto en el medio no se confunde con tablas internas', () => {
  assert.deepEqual(norms('constructor __proto__ toString hasOwnProperty'), ['constructor', 'proto', 'tostring', 'hasownproperty']);
});

test('texto largo: 1 millón de caracteres en menos de 5 s y cadenas patológicas en tiempo lineal', () => {
  const big = 'word '.repeat(200000);
  let started = Date.now();
  assert.equal(tokenize(big).length, 200000);
  assert.ok(Date.now() - started < 5000, 'texto largo');
  const hostile = ['U.'.repeat(100000), `${'U.'.repeat(100000)}1`, 'a-'.repeat(100000), '1.'.repeat(100000), "a'".repeat(100000), '\u200D'.repeat(100000), '😀'.repeat(100000), '-'.repeat(100000), "'".repeat(100000)];
  for (const text of hostile) {
    started = Date.now();
    tokenize(text);
    assert.ok(Date.now() - started < 3000, `hostil ${text.slice(0, 4)}`);
  }
});

test('es pura: la misma entrada da lo mismo y no cambia nada fuera', () => {
  const text = "Don't stop, well-known U.S. 3rd 😀";
  const a = tokenize(text);
  const b = tokenize(text);
  assert.deepEqual(a, b);
  a[0].parts.push('x');
  assert.deepEqual(tokenize(text)[0].parts, ['do', 'not']);
});

// ---------- huecos que cerraron las roturas intencionales (4.R) ----------
test('invisibles: la unión de palabras (2060) también se quita; un segmento solo de invisibles no cuenta como guion', () => {
  assert.deepEqual(norms('a\u2060b'), ['ab']);
  assert.equal(tokenize('a-\u200B')[0].hyphenated, false);
  assert.deepEqual(partsOf('a-\u200B-b'), [['a', 'b']]);
});

test('siglas: no empiezan pegadas a una letra, una cifra o un punto', () => {
  assert.deepEqual(norms('ab.U.S.'), ['ab', 'u', 's']);
  assert.deepEqual(kinds('3U.S.'), ['alnum', 'word']);
  assert.deepEqual(kinds('(U.S.)'), ['acronym']);
});

test('números con cifras que no son ASCII y sufijo ordinal', () => {
  assert.deepEqual(kinds('\u0663rd'), ['number']);
});

test('sentenceStart: un salto de línea solo con \\r cuenta, y una sigla con puntos no parte la frase', () => {
  assert.deepEqual(tokenize('one\rtwo').map((t) => t.sentenceStart), [true, true]);
  assert.deepEqual(tokenize('the U.S. economy grows').map((t) => t.sentenceStart), [true, false, false, false]);
  assert.deepEqual(tokenize('see a.m. and p.m. times').map((t) => t.sentenceStart), [true, false, false, false, false]);
});

test('splitContraction: un sufijo suelto no desaparece y NFD da lo mismo que NFC', () => {
  assert.deepEqual(splitContraction("'s"), ['s']);
  assert.deepEqual(splitContraction("n't"), ['n', 't']);
  assert.deepEqual(splitContraction("'ll"), ['ll']);
  assert.deepEqual(splitContraction("'d"), ['d']);
  assert.deepEqual(splitContraction('cafe\u0301'), ['caf\u00E9']);
  assert.deepEqual(splitContraction("cafe\u0301's"), ['caf\u00E9']);
});
