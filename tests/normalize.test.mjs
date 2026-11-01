// @purpose: Pruebas de la normalización de respuestas (core/normalize.js): contracciones, I minúscula y diacríticos.
// Pruebas de core/normalize.js (subparte 1.2, cuartos 1A y 1B): normalización base, contracciones, `I` minúscula y diacríticos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, expandContractions, hasLowercaseI } from '../core/normalize.js';

const CASES = [
  // [entrada, esperado, nota]
  ['Hello', 'hello', 'minúsculas'],
  ['  hello  ', 'hello', 'trim'],
  ['I   have   a  dog', 'i have a dog', 'espacios dobles'],
  ['I\thave\na dog', 'i have a dog', 'tab y salto de línea'],
  ['I\u00A0have', 'i have', 'espacio duro (NBSP)'],
  ['I\u200Bhave', 'ihave', 'ancho cero se elimina sin unir como espacio'],
  ['Hello.', 'hello', 'punto final'],
  ['Hello!', 'hello', 'exclamación final'],
  ['Hello?', 'hello', 'interrogación final'],
  ['Hello,', 'hello', 'coma final'],
  ['Hello...', 'hello', 'tres puntos'],
  ['Hello\u2026', 'hello', 'puntos suspensivos Unicode'],
  ['Hello?!', 'hello', 'puntuación final mezclada'],
  ['Hello . ', 'hello', 'espacio antes del punto'],
  ['Hello, world.', 'hello, world', 'solo se quita la puntuación FINAL'],
  ["I don’t know", "i don't know", 'apóstrofo curvo'],
  ['I don‘t know', "i don't know", 'apóstrofo izquierdo'],
  ['I don`t know', "i don't know", 'acento grave'],
  ['I don´t know', "i don't know", 'acento agudo'],
  ["I don't know", "i don't know", 'apóstrofo recto no cambia'],
  ['CAN’T', "can't", 'mayúsculas + apóstrofo'],
  ['', '', 'vacía'],
  ['   ', '', 'solo espacios'],
  ['...', '', 'solo puntuación'],
  ['?!', '', 'solo puntuación final'],
  ['café', 'café', 'los diacríticos se conservan (cuarto 1B los trata en ES)'],
  ['CAFE\u0301', 'caf\u00E9', 'NFC: e + acento combinado = é'],
  ['😀', '😀', 'emoji'],
  ['I love 😀!', 'i love 😀', 'emoji y puntuación final'],
  ['42', '42', 'números'],
];

for (const [input, expected, note] of CASES) {
  test(`normalize: ${note}`, () => assert.equal(normalize(input), expected));
}

test('normalize: entradas que no son texto no lanzan y devuelven cadena vacía', () => {
  for (const v of [null, undefined, {}, [], () => 1, true, NaN, Infinity, Symbol('x')]) {
    assert.equal(normalize(v), '');
  }
  assert.equal(normalize(7), '7');
});

test('normalize: keepFinalPunctuation conserva la puntuación final', () => {
  assert.equal(normalize('Hello!  ', { keepFinalPunctuation: true }), 'hello!');
  assert.equal(normalize('Hello...', { keepFinalPunctuation: true }), 'hello...');
  assert.equal(normalize('Hello.', { keepFinalPunctuation: false }), 'hello');
  assert.equal(normalize('Hello.', null), 'hello');
  assert.equal(normalize('Hello.', 'x'), 'hello');
});

test('normalize: es idempotente y no muta', () => {
  for (const [input] of CASES) {
    const once = normalize(input);
    assert.equal(normalize(once), once);
  }
});

test('normalize: un texto larguísimo se corta y no tarda', () => {
  const t0 = Date.now();
  const out = normalize('a '.repeat(500000));
  assert.ok(out.length <= 10000);
  assert.ok(Date.now() - t0 < 500);
});

test('normalize: fuzz con 1000 cadenas aleatorias no lanza y siempre devuelve texto', () => {
  let seed = 12345;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const pieces = ['a', 'B', ' ', '\t', '\n', "'", '\u2019', '.', ',', '!', '?', '\u2026', '😀', '\u0301', 'é', '\u200B', '\uD800', '\u00A0', 'İ'];
  for (let i = 0; i < 1000; i += 1) {
    let s = '';
    const n = Math.floor(rnd() * 30);
    for (let j = 0; j < n; j += 1) s += pieces[Math.floor(rnd() * pieces.length)];
    const out = normalize(s);
    assert.equal(typeof out, 'string');
    assert.equal(out, out.trim());
    assert.ok(!/ {2}/.test(out));
    assert.equal(normalize(out), out);
  }
});

// ================= 1B: contracciones =================
const EXPAND = { contractions: 'expand' };

const CONTRACTION_CASES = [
  ["I've", 'i have'], ['I have', 'i have'], ["I’ve", 'i have'],
  ["don't", 'do not'], ['do not', 'do not'], ["DON'T", 'do not'],
  ["I'm", 'i am'], ['I am', 'i am'], ["I’m", 'i am'],
  ["won't", 'will not'], ['will not', 'will not'],
  ["can't", 'cannot'], ['cannot', 'cannot'], ['can not', 'cannot'], ['Can Not', 'cannot'],
  ["doesn't", 'does not'], ["didn't", 'did not'], ["isn't", 'is not'], ["aren't", 'are not'],
  ["wasn't", 'was not'], ["weren't", 'were not'], ["hasn't", 'has not'], ["haven't", 'have not'],
  ["hadn't", 'had not'], ["couldn't", 'could not'], ["shouldn't", 'should not'], ["wouldn't", 'would not'],
  ["mustn't", 'must not'], ["needn't", 'need not'], ["shan't", 'shall not'],
  ["you're", 'you are'], ["we're", 'we are'], ["they're", 'they are'],
  ["you've", 'you have'], ["we've", 'we have'], ["they've", 'they have'],
  ["could've", 'could have'], ["would've", 'would have'], ["should've", 'should have'],
  ["I'll", 'i will'], ["she'll", 'she will'], ["they'll", 'they will'],
  ["let's go", 'let us go'],
  ["I don't know.", 'i do not know'],
  ["I've got it!", 'i have got it'],
  ["I don't, I can't", 'i do not, i cannot'],
  // NO se expanden (ambiguas o desconocidas): se conservan tal cual
  ["he's here", "he's here"], ["she'd go", "she'd go"], ["John's car", "john's car"],
  ["ain't", "ain't"], ["rock'n'roll", "rock'n'roll"], ["o'clock", "o'clock"], ["'tis", "'tis"],
  ["john't", "john't"], ["5don't", "5don't"], ["x'don't", "x'don't"], ["you'd", "you'd"], ["it's", "it's"],
  ['cannot be', 'cannot be'], ['I can nothing', 'i can nothing'], ['scan not', 'scan not'],
];
for (const [input, expected] of CONTRACTION_CASES) {
  test(`contracciones: ${input} → ${expected}`, () => assert.equal(normalize(input, EXPAND), expected));
}

test('contracciones: sin la opción no se toca nada (la 1A sigue igual)', () => {
  assert.equal(normalize("I've"), "i've");
  assert.equal(normalize("don't", {}), "don't");
  assert.equal(normalize("don't", { contractions: 'keep' }), "don't");
  assert.equal(normalize("don't", { contractions: true }), "don't");
});

test('contracciones: las dos formas son equivalentes entre sí', () => {
  const pairs = [["I've", 'I have'], ["don't", 'do not'], ["I'm", 'I am'], ["won't", 'will not'], ["can't", 'cannot'], ['can not', "can't"]];
  for (const [a, b] of pairs) assert.equal(normalize(a, EXPAND), normalize(b, EXPAND), `${a} ≡ ${b}`);
});

test('contracciones: expandContractions es segura con entradas raras', () => {
  assert.equal(expandContractions(null), '');
  assert.equal(expandContractions(undefined), '');
  assert.equal(expandContractions({}), '');
  assert.equal(expandContractions("don't"), 'do not');
});

test('contracciones: no confunde otras palabras que terminan igual', () => {
  assert.equal(normalize('Canton', EXPAND), 'canton');
  assert.equal(normalize("l'amour", EXPAND), "l'amour");
  assert.equal(normalize("d'accord", EXPAND), "d'accord");
});

// ================= 1B: `I` minúscula (MECH.CAP_I) =================
test('hasLowercaseI: detecta la i suelta en minúscula', () => {
  for (const t of ['i think so', 'so do i', "i'm tired", "i've done it", "i'll go", "i'd go", 'me and i.', 'yes, i did', 'i', '(i)', 'I think and i know', 'i’m tired']) {
    assert.equal(hasLowercaseI(t), true, t);
  }
});

test('hasLowercaseI: no marca la I mayúscula ni la i dentro de palabras', () => {
  for (const t of ['I think so', "I'm tired", "I've", 'This is it', 'hi', 'si', 'ice', 'Mi casa', 'taxi', 'in', 'is', "it's", '', '   ']) {
    assert.equal(hasLowercaseI(t), false, t);
  }
});

test('hasLowercaseI: entradas que no son texto devuelven false sin lanzar', () => {
  for (const v of [null, undefined, 5, {}, [], NaN]) assert.equal(hasLowercaseI(v), false);
});

test('hasLowercaseI: no invalida la respuesta (normalize iguala I e i)', () => {
  assert.equal(normalize('i think so'), normalize('I think so'));
  assert.equal(hasLowercaseI('i think so'), true);
  assert.equal(hasLowercaseI('I think so'), false);
});

test('hasLowercaseI: un texto larguísimo no se cuelga', () => {
  const t0 = Date.now();
  assert.equal(hasLowercaseI('a '.repeat(500000)), false);
  assert.ok(Date.now() - t0 < 500);
});

// ================= 1B: diacríticos (solo comparación ES) =================
test('diacríticos: stripDiacritics quita tildes, diéresis y ñ', () => {
  const o = { stripDiacritics: true };
  assert.equal(normalize('Canción', o), 'cancion');
  assert.equal(normalize('ÑANDÚ', o), 'nandu');
  assert.equal(normalize('pingüino', o), 'pinguino');
  assert.equal(normalize('CAFE\u0301', o), 'cafe');
  assert.equal(normalize('naïve', o), 'naive');
  assert.equal(normalize('árbol, ¿qué?', o), 'arbol, ¿que');
});

test('diacríticos: sin la opción se conservan (inglés no los pierde)', () => {
  assert.equal(normalize('Canción'), 'canción');
  assert.equal(normalize('Canción', { stripDiacritics: false }), 'canción');
  assert.equal(normalize('Canción', { stripDiacritics: 'yes' }), 'canción');
});

test('diacríticos: no rompe emoji ni texto sin acentos', () => {
  assert.equal(normalize('I love 😀', { stripDiacritics: true }), 'i love 😀');
  assert.equal(normalize('hello', { stripDiacritics: true }), 'hello');
});

// ================= 1B: combinaciones y fuzz con TODAS las opciones =================
test('opciones combinadas: contracciones + diacríticos + puntuación final', () => {
  const all = { contractions: 'expand', stripDiacritics: true };
  assert.equal(normalize("  I’ve  DON'T   Canción!!  ", all), 'i have do not cancion');
  assert.equal(normalize("I can’t.", { ...all, keepFinalPunctuation: true }), 'i cannot.');
});

test('opciones combinadas: fuzz de 1000 cadenas no lanza y es idempotente', () => {
  let seed = 987;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const pieces = ['I', 'i', "'", '\u2019', "don't", "can't", 'can not', "I've", ' ', '.', '!', '😀', 'é', 'ñ', '\u0301', "he's", "n't", "'s", 'let', 'will', 'wo', 'a', '\u200B', '\uD800'];
  const optionSets = [EXPAND, { stripDiacritics: true }, { contractions: 'expand', stripDiacritics: true, keepFinalPunctuation: true }];
  for (let i = 0; i < 1000; i += 1) {
    let str = '';
    const n = Math.floor(rnd() * 20);
    for (let j = 0; j < n; j += 1) str += pieces[Math.floor(rnd() * pieces.length)];
    assert.equal(typeof hasLowercaseI(str), 'boolean');
    for (const o of optionSets) {
      const out = normalize(str, o);
      assert.equal(typeof out, 'string');
      assert.equal(normalize(out, o), out, JSON.stringify(str));
    }
  }
});
