// @purpose: Pruebas de core/compare.js: comparación de la respuesta con las aceptadas.
// Pruebas de core/compare.js (subparte 1.2, cuarto 2B). Contrato: docs/CONTRACTS.md 8.5 y 1.2-2B.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compare } from '../core/compare.js';
import { createConfusables } from '../core/confusables.js';
import { normalize } from '../core/normalize.js';
import { makeRng } from './_helpers.mjs';

const data = JSON.parse(fs.readFileSync(new URL('../content/taxonomy/confusables.json', import.meta.url), 'utf8'));
const C = createConfusables(data);
const WITH = { confusables: C };

// [usuario, aceptadas, opciones, resultado esperado, aceptada esperada (o null)]
const TABLE = [
  // ---- correct: igualdad tras normalizar ----
  ['I have a dog', ['I have a dog'], WITH, 'correct', 'I have a dog'],
  ['  I   have  a dog. ', ['I have a dog'], WITH, 'correct', 'I have a dog'],
  ['I HAVE A DOG', ['I have a dog'], WITH, 'correct', 'I have a dog'],
  ['Hello!', ['hello'], WITH, 'correct', 'hello'],
  ['hello', ['Hello?'], WITH, 'correct', 'Hello?'],
  ['hello...', ['hello'], WITH, 'correct', 'hello'],
  ['I\'ve a dog', ['I have a dog'], WITH, 'correct', 'I have a dog'],
  ['I have a dog', ['I\'ve a dog'], WITH, 'correct', 'I\'ve a dog'],
  ['Don\'t go', ['Do not go'], WITH, 'correct', 'Do not go'],
  ['do not go', ['Don’t go'], WITH, 'correct', 'Don’t go'],
  ['I can\'t swim', ['I cannot swim'], WITH, 'correct', 'I cannot swim'],
  ['I can not swim', ['I can\'t swim'], WITH, 'correct', 'I can\'t swim'],
  ['I\'m happy', ['I am happy'], WITH, 'correct', 'I am happy'],
  ['I won’t go', ['I will not go'], WITH, 'correct', 'I will not go'],
  ['She isn\'t here', ['She is not here'], WITH, 'correct', 'She is not here'],
  ['They\'re late', ['They are late'], WITH, 'correct', 'They are late'],
  ['b', ['a', 'b'], WITH, 'correct', 'b'],
  ['colour', ['color', 'colour'], WITH, 'correct', 'colour'],
  ['He\'s here', ['He\'s here', 'He is here'], WITH, 'correct', 'He\'s here'],
  ['He is here', ['He\'s here', 'He is here'], WITH, 'correct', 'He is here'],
  ['I have a dog', ['I have a dog'], undefined, 'correct', 'I have a dog'],
  ['I have a dog', 'I have a dog', WITH, 'correct', 'I have a dog'],
  ['canción', ['cancion'], { lang: 'es' }, 'correct', 'cancion'],
  ['NIÑO', ['niño'], { lang: 'es' }, 'correct', 'niño'],
  ['Hello.', ['Hello.'], { keepFinalPunctuation: true }, 'correct', 'Hello.'],
  // ---- almost: UNA palabra a distancia 1, ≥ 4 letras, no confusable, error que no toca la última letra ----
  ['I recieve it', ['I receive it'], WITH, 'almost', 'I receive it'],
  ['She is begining', ['She is beginning'], WITH, 'almost', 'She is beginning'],
  ['I went to the libary', ['I went to the library'], WITH, 'almost', 'I went to the library'],
  ['Tomorow is Monday', ['Tomorrow is Monday'], WITH, 'almost', 'Tomorrow is Monday'],
  ['I definately agree', ['I definitely agree'], WITH, 'almost', 'I definitely agree'],
  ['My freind is here', ['My friend is here'], WITH, 'almost', 'My friend is here'],
  ['It occured yesterday', ['It occurred yesterday'], WITH, 'almost', 'It occurred yesterday'],
  ['Wich one?', ['Which one'], WITH, 'almost', 'Which one'],
  ['I like banans', ['I like bananas'], WITH, 'almost', 'I like bananas'],
  ['A diferent plan', ['A different plan'], WITH, 'almost', 'A different plan'],
  ['A beutiful house', ['A beautiful house'], WITH, 'almost', 'A beautiful house'],
  ['I stayed becuase of it', ['I stayed because of it'], WITH, 'almost', 'I stayed because of it'],
  ['I am glaad', ['I am happy', 'I am glad'], WITH, 'almost', 'I am glad'],
  ['I recieve it', ['I receive it'], undefined, 'almost', 'I receive it'],
  ['cancion', ['canción'], undefined, 'almost', 'canción'],
  ['Hello, I recieve it.', ['Hello, I receive it.'], { keepFinalPunctuation: true }, 'almost', 'Hello, I receive it.'],
  // ---- confusables: con la lista NUNCA almost; sin ella solo manda la distancia ----
  ['Good lock', ['Good luck'], WITH, 'wrong', null],
  ['Good lock', ['Good luck'], undefined, 'almost', 'Good luck'],
  ['I went a coffee', ['I want a coffee'], WITH, 'wrong', null],
  ['I went a coffee', ['I want a coffee'], undefined, 'almost', 'I want a coffee'],
  ['Better then me', ['Better than me'], WITH, 'wrong', null],
  ['Better then me', ['Better than me'], undefined, 'almost', 'Better than me'],
  ['A gift form me', ['A gift from me'], WITH, 'wrong', null],
  ['A gift form me', ['A gift from me'], undefined, 'almost', 'A gift from me'],
  ['Please full the glass', ['Please fill the glass'], WITH, 'wrong', null],
  ['Please tall me', ['Please tell me'], WITH, 'wrong', null],
  ['Where you late', ['Were you late'], WITH, 'wrong', null],
  // ---- wrong: los casos del diagnóstico de William y otros ----
  ['I leaved home', ['I left home'], WITH, 'wrong', null],
  ['I eated pizza', ['I ate pizza'], WITH, 'wrong', null],
  ['He didn\'t went', ['He didn\'t go'], WITH, 'wrong', null],
  ['She can to swim', ['She can swim'], WITH, 'wrong', null],
  ['I goed to school', ['I went to school'], WITH, 'wrong', null],
  ['I have went', ['I have gone'], WITH, 'wrong', null],
  ['I leaved home', ['I leave home'], WITH, 'wrong', null],
  ['He work here', ['He works here'], WITH, 'wrong', null],
  ['I send it yesterday', ['I sent it yesterday'], WITH, 'wrong', null],
  ['I have take it', ['I have taken it'], WITH, 'wrong', null],
  ['I am agree', ['I agree'], WITH, 'wrong', null],
  ['I live here since two years', ['I have lived here for two years'], WITH, 'wrong', null],
  ['I recieve a leter', ['I receive a letter'], WITH, 'wrong', null],
  ['I have a cat', ['I have a dog'], WITH, 'wrong', null],
  ['I like cts', ['I like cats'], WITH, 'wrong', null],
  ['Ha\'s here', ['He\'s here'], WITH, 'wrong', null],
  ['I definatly agree', ['I definitely agree'], WITH, 'wrong', null],
  ['I have 2015 books', ['I have 2025 books'], WITH, 'wrong', null],
  ['go undefinxd', ['go'], WITH, 'wrong', null],
  ['The cat', ['The car'], WITH, 'wrong', null],
  ['I have 2025 books', ['I have 2026 books'], WITH, 'wrong', null],
  ['A well-knwon actor', ['A well-known actor'], WITH, 'wrong', null],
  ['I havent a car', ['I haven\'t a car'], WITH, 'wrong', null],
  ['Yes I do', ['Yes, I do'], WITH, 'correct', 'Yes, I do'],
  ['Yes, I do', ['Yes I do'], WITH, 'correct', 'Yes I do'],
  ['Well , yes . I do', ['Well, yes. I do.'], WITH, 'correct', 'Well, yes. I do.'],
  ['Well yes I do', ['Well, yes. I do!'], WITH, 'correct', 'Well, yes. I do!'],
  ['Yes I recieve it', ['Yes, I receive it'], WITH, 'almost', 'Yes, I receive it'],
  ['No I recieve a leter', ['No, I receive a letter'], WITH, 'wrong', null],
  ['A well known actor', ['A well-known actor'], WITH, 'wrong', null],
  ['I dont go', ['I don\'t go'], WITH, 'wrong', null],
  ['It costs 3.5 euros', ['It costs 3,5 euros'], WITH, 'wrong', null],
  ['It costs 35 euros', ['It costs 3.5 euros'], WITH, 'wrong', null],
  ['Yes I do', ['Yes, I do'], { keepFinalPunctuation: true }, 'correct', 'Yes, I do'],
  ['Yes I do', ['Yes, I do.'], { keepFinalPunctuation: true }, 'wrong', null],
  ['Yes I do.', ['Yes, I do.'], { keepFinalPunctuation: true }, 'correct', 'Yes, I do.'],
  ['Hello', ['Hello.'], { keepFinalPunctuation: true }, 'wrong', null],
  ['Hello!', ['Hello.'], { keepFinalPunctuation: true }, 'wrong', null],
  ['I recieve it!', ['I receive it.'], { keepFinalPunctuation: true }, 'wrong', null],
  ['cancion', ['canción'], { lang: 'es' }, 'correct', 'canción'],
  ['I like it', ['I like it very much'], WITH, 'wrong', null],
  ['', ['I have a dog'], WITH, 'wrong', null],
  ['   ', ['I have a dog'], WITH, 'wrong', null],
  ['I have a dog', [], WITH, 'wrong', null],
];

test('tabla: más de 60 casos con el resultado y la respuesta aceptada esperados', () => {
  assert.ok(TABLE.length >= 60, `solo ${TABLE.length}`);
  for (const [user, accept, opts, expected, matched] of TABLE) {
    const r = compare(user, accept, opts);
    assert.equal(r.result, expected, `${JSON.stringify(user)} vs ${JSON.stringify(accept)} → ${r.result}`);
    assert.equal(r.matched, matched, `matched de ${JSON.stringify(user)}`);
  }
});

test('forma del resultado: result, matched, diff, spellingFlags y errorCodes (el contenido de diff y flags: compare.diff.test.mjs)', () => {
  const r = compare('I have a dog', ['I have a dog'], WITH);
  assert.deepEqual(Object.keys(r).sort(), ['diff', 'errorCodes', 'matched', 'result', 'spellingFlags']);
  assert.deepEqual(r.diff.map((t) => t.status), ['ok', 'ok', 'ok', 'ok']);
  assert.deepEqual(r.spellingFlags, []);
  assert.deepEqual(r.errorCodes, []);
  assert.notEqual(compare('a', ['a']).diff, compare('a', ['a']).diff, 'cada llamada devuelve arreglos nuevos');
  assert.notEqual(compare('a', ['a']).spellingFlags, compare('a', ['a']).spellingFlags);
});

test('CA-1 (5): la I minúscula marca MECH.CAP_I y NO invalida', () => {
  for (const [user, expected] of [['i have a dog', 'correct'], ['i\'m happy', 'correct'], ['i recieve it', 'almost'], ['i like cats', 'wrong']]) {
    const accept = expected === 'wrong' ? ['I like dogs'] : [user.replace(/^i/, 'I').replace('recieve', 'receive')];
    const r = compare(user, accept, WITH);
    assert.equal(r.result, expected, user);
    assert.deepEqual(r.errorCodes, ['MECH.CAP_I'], user);
  }
  assert.deepEqual(compare('I have a dog', ['I have a dog']).errorCodes, []);
  assert.deepEqual(compare('big idea', ['big idea']).errorCodes, [], 'una i dentro de una palabra no es el pronombre');
});

test('CAP_I se mira en el texto original, también con typos y con lang "es" no se mira', () => {
  assert.deepEqual(compare('Yo i', ['yo i'], { lang: 'es' }).errorCodes, []);
  assert.deepEqual(compare('i’ve a dog', ['I have a dog']).errorCodes, ['MECH.CAP_I']);
});

test('CA-3: I\'ve/I have, don\'t/do not, can\'t/cannot, I\'m/I am son equivalentes en los dos sentidos', () => {
  for (const [a, b] of [['I\'ve', 'I have'], ['don\'t', 'do not'], ['can\'t', 'cannot'], ['I\'m', 'I am'], ['won\'t', 'will not']]) {
    assert.equal(compare(`${a} go`, [`${b} go`]).result, 'correct', `${a} → ${b}`);
    assert.equal(compare(`${b} go`, [`${a} go`]).result, 'correct', `${b} → ${a}`);
  }
});

test('CA-2: "almost" nunca cuando el cambio crea otra palabra válida, con TODA la lista a 1 edición con ≥ 4 letras', () => {
  let probed = 0;
  for (const [a, b] of data.pairs) {
    const letters = (w) => w.replace(/'/g, '').length;
    if (letters(a) < 4 || letters(b) < 4) continue;
    probed += 1;
    // Con `atEnd` activo el último filtro (la última letra) no ayuda: solo la lista puede impedir el "almost".
    assert.notEqual(compare(`say ${a} now`, [`say ${b} now`], { confusables: C, almostAtWordEnd: true }).result, 'almost', `${a}/${b}`);
    assert.notEqual(compare(`say ${b} now`, [`say ${a} now`], { confusables: C, almostAtWordEnd: true }).result, 'almost', `${b}/${a}`);
  }
  assert.ok(probed >= 15, `se probaron ${probed} parejas`);
});

test('la lista de confusables manda aunque las mayúsculas o el apóstrofo curvo cambien', () => {
  assert.equal(compare('GOOD LOCK', ['good luck'], WITH).result, 'wrong');
  assert.equal(compare('Good Lock!', ['Good luck.'], WITH).result, 'wrong');
});

test('un detector roto o que no es detector se ignora o es prudente, sin lanzar', () => {
  assert.equal(compare('I recieve it', ['I receive it'], { confusables: { areConfusable: 5 } }).result, 'almost');
  assert.equal(compare('I recieve it', ['I receive it'], { confusables: {} }).result, 'almost');
  assert.equal(compare('I recieve it', ['I receive it'], { confusables: null }).result, 'almost');
  const boom = { areConfusable() { throw new Error('boom'); } };
  assert.equal(compare('I recieve it', ['I receive it'], { confusables: boom }).result, 'wrong', 'si el detector falla no se da "casi"');
});

test('la última letra: work/works, send/sent, take/taken son wrong; con almostAtWordEnd pasan a almost', () => {
  for (const [u, a] of [['He work here', 'He works here'], ['I send it', 'I sent it'], ['I have take it', 'I have taken it']]) {
    assert.equal(compare(u, [a], WITH).result, 'wrong', u);
    assert.equal(compare(u, [a], { ...WITH, almostAtWordEnd: true }).result, 'almost', `${u} con almostAtWordEnd`);
  }
  assert.equal(compare('He work here', ['He works here'], { confusables: C, almostAtWordEnd: 'yes' }).result, 'wrong', 'solo true activa la opción');
});

test('solo UNA palabra con error: dos palabras con typo son wrong', () => {
  assert.equal(compare('I recieve a leter', ['I receive a letter'], WITH).result, 'wrong');
  assert.equal(compare('I recieve a letter', ['I receive a letter'], WITH).result, 'almost');
});

test('una palabra de 3 letras o menos nunca es almost (para no confundir con otra palabra válida)', () => {
  assert.equal(compare('the cta', ['the cat'], WITH).result, 'wrong');
  assert.equal(compare('the lmap', ['the lamp'], WITH).result, 'almost', 'la de 4 letras con la errata en medio sí');
  assert.equal(compare('the cat', ['the car'], WITH).result, 'wrong');
});

test('la puntuación pegada a la palabra es otra diferencia: no es almost', () => {
  assert.equal(compare('I recieve it', ['I receive it'], { ...WITH, keepFinalPunctuation: true }).result, 'almost');
  assert.equal(compare('Hello wrold!', ['Hello world.'], { ...WITH, keepFinalPunctuation: true }).result, 'wrong');
  assert.equal(compare('Hello wrold.', ['Hello world.'], { ...WITH, keepFinalPunctuation: true }).result, 'almost', 'misma puntuación pegada y typo en medio');
  assert.equal(compare('Hello wrold', ['Hello world']).result, 'almost', 'wrold/world: intercambio en medio, la última letra coincide');
  assert.equal(compare('Hello wrold!', ['Hello wrold.'], { keepFinalPunctuation: true }).result, 'wrong');
});

test('varias aceptadas: gana la exacta aunque otra anterior sea "almost"', () => {
  const r = compare('I recieve it', ['I receive it', 'I recieve it'], WITH);
  assert.equal(r.result, 'correct');
  assert.equal(r.matched, 'I recieve it');
});

test('varias aceptadas: la primera "almost" cuando no hay exacta', () => {
  const r = compare('I like colur', ['I like color', 'I like colour'], WITH);
  assert.equal(r.result, 'almost');
  assert.equal(r.matched, 'I like color');
});

test('lang "es": quita diacríticos; en inglés (sin lang) un acento de más o de menos cuenta como edición', () => {
  assert.equal(compare('que facil', ['qué fácil'], { lang: 'es' }).result, 'correct');
  assert.equal(compare('que facil', ['qué fácil']).result, 'wrong', 'dos palabras distintas');
  assert.equal(compare('Cafe', ['café'], { lang: 'es' }).result, 'correct');
  assert.equal(compare('cafe', ['café'], { lang: 'en' }).result, 'wrong', 'en inglés la é es otra letra y es la última: no hay "casi"');
});

test('Unicode: NFC/NFD, invisibles, emoji, İ turca y apóstrofos raros', () => {
  assert.equal(compare('cafe\u0301', ['café']).result, 'correct');
  assert.equal(compare('hel\u200Blo', ['hello']).result, 'correct');
  assert.equal(compare('🙂', ['🙂']).result, 'correct');
  assert.equal(compare('I like 🍕', ['I like 🍕']).result, 'correct');
  assert.equal(compare('I like 🍕🍕', ['I like 🍕']).result, 'wrong');
  assert.equal(compare('İstanbul', ['İstanbul']).result, 'correct');
  assert.equal(compare('İstanbul', ['istanbul']).result, 'wrong', 'en inglés la marca del punto cuenta; en español (lang es) se quita');
  assert.equal(compare('İstanbul', ['istanbul'], { lang: 'es' }).result, 'correct');
  assert.equal(compare('don`t go', ['do not go']).result, 'correct');
  assert.equal(compare('don\u02BCt go', ['do not go']).result, 'correct');
});

test('CA-5: vacío, null, undefined, números, objetos y emoji no lanzan', () => {
  const weird = [undefined, null, '', ' ', 0, NaN, Infinity, -1, 42, true, false, {}, [], () => 1, Symbol('x'), '🙂', '\u0000', '\uD800'];
  for (const u of weird) {
    for (const acc of [undefined, null, [], [''], [null], [undefined, 5, {}], 'x', 7, {}, ['I have a dog'], [Symbol('s')]]) {
      for (const o of [undefined, null, 0, 'x', [], {}, { confusables: C, lang: 'es' }]) {
        const r = compare(u, acc, o);
        assert.ok(['correct', 'almost', 'wrong'].includes(r.result));
      }
    }
  }
  assert.equal(compare('', [''], WITH).result, 'wrong', 'una respuesta vacía nunca es correcta');
  assert.equal(compare(null, [null], WITH).result, 'wrong');
  assert.equal(compare(42, ['42'], WITH).result, 'correct', 'un número finito se compara como texto');
  assert.equal(compare('42', [42], WITH).result, 'correct');
  assert.equal(compare('42', [42], WITH).matched, '42');
});

test('textos enormes y palabras gigantes: no se cuelga ni lanza', () => {
  const big = 'word '.repeat(5000);
  const t0 = Date.now();
  assert.equal(compare(big, [big], WITH).result, 'correct');
  const longWord = 'a'.repeat(5000);
  assert.equal(compare(`x ${longWord}`, [`x ${longWord}b`], WITH).result, 'wrong');
  assert.equal(compare('I recieve it', Array.from({ length: 5000 }, (_, i) => `answer ${i}`), WITH).result, 'wrong');
  assert.ok(Date.now() - t0 < 2000, 'tardó demasiado');
});

test('no modifica la lista de aceptadas ni las opciones', () => {
  const accept = ['I have a dog', 'I\'ve a cat'];
  const opts = { confusables: C, lang: 'es' };
  const accSnap = JSON.stringify(accept);
  compare('I recieve it', accept, opts);
  assert.equal(JSON.stringify(accept), accSnap);
  assert.deepEqual(Object.keys(opts), ['confusables', 'lang']);
});

const ALPHABET = ['a', 'b', 'e', 'i', 'o', 't', 'n', 'd', ' ', ' ', '\'', '’', '.', ',', '!', '?', 'É', 'ñ', '🙂', '\u200B', '\t', 'I', 'ı', 'İ', 'ß', '1', '-'];
const WORDS = ['I', 'have', 'dog', 'don\'t', 'do', 'not', 'can\'t', 'cannot', 'go', 'went', 'want', 'bad', 'bed', 'receive', 'recieve', 'luck', 'lock', 'works', 'work'];

function randomString(rng) {
  if (rng.next() < 0.5) {
    return Array.from({ length: rng.int(0, 20) }, () => rng.pick(ALPHABET)).join('');
  }
  return Array.from({ length: rng.int(0, 6) }, () => rng.pick(WORDS)).join(rng.next() < 0.8 ? ' ' : '  ');
}

test('fuzz: 1000 cadenas aleatorias no lanzan y cumplen las propiedades', () => {
  const rng = makeRng(20261018);
  for (let i = 0; i < 1000; i += 1) {
    const user = randomString(rng);
    const accept = Array.from({ length: rng.int(0, 3) }, () => randomString(rng));
    const opts = { confusables: rng.next() < 0.5 ? C : undefined, lang: rng.next() < 0.3 ? 'es' : 'en', keepFinalPunctuation: rng.next() < 0.3 };
    const r = compare(user, accept, opts);
    assert.ok(['correct', 'almost', 'wrong'].includes(r.result));
    assert.equal(r.matched === null, r.result === 'wrong', `matched/result incoherentes: ${JSON.stringify([user, accept, r])}`);
    if (r.matched !== null) assert.ok(accept.includes(r.matched), 'matched debe ser una de las aceptadas');
    if (normalize(user, { contractions: 'expand', stripDiacritics: opts.lang === 'es', keepFinalPunctuation: opts.keepFinalPunctuation }) !== '') {
      const self = compare(user, [user], opts);
      assert.equal(self.result, 'correct', `una respuesta es correcta contra sí misma: ${JSON.stringify(user)}`);
      assert.equal(compare(user, [user, ...accept], opts).result, 'correct');
    } else {
      assert.equal(r.result, 'wrong');
    }
    if (r.result === 'correct') {
      assert.equal(compare(r.matched, [user], opts).result, 'correct', `simetría de correct: ${JSON.stringify([user, r.matched])}`);
    }
  }
});

test('fuzz: con confusables, un par de la lista nunca da almost aunque se mezcle el contexto', () => {
  const rng = makeRng(77);
  const near = data.pairs.filter(([a, b]) => a.replace(/'/g, '').length >= 4 && b.replace(/'/g, '').length >= 4);
  for (let i = 0; i < 500; i += 1) {
    const [a, b] = rng.pick(near);
    const before = Array.from({ length: rng.int(0, 3) }, () => rng.pick(WORDS)).join(' ');
    const after = Array.from({ length: rng.int(0, 3) }, () => rng.pick(WORDS)).join(' ');
    const wrap = (w) => [before, w, after].filter(Boolean).join(' ');
    const r = compare(wrap(a), [wrap(b)], { confusables: C, almostAtWordEnd: true });
    assert.notEqual(r.result, 'almost', `${wrap(a)} / ${wrap(b)}`);
  }
});
