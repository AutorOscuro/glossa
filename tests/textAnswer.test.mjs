// @purpose: Pruebas de core/textAnswer.js (2.5-T1, punto 1): lectura del ítem, respuesta vacía, opciones por tipo, pista de máscara y calificación con compare real y con compare falso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MASKS, TYPE_OPTIONS, isBlank, readText, optionsFor, maskHint, gradeText } from '../core/textAnswer.js';

const item = (over = {}) => ({ type: 'fill_verb', prompt_es: 'Completa.', accept: ['takes'], ...over });

// ---------------------------------------------------------------- isBlank

test('isBlank: vacío, solo espacios y lo que no es texto cuentan como vacío', () => {
  for (const v of ['', ' ', '   ', '\t\n', '\u00A0', '\u200B', '\u200B \uFEFF', '\u2060', null, undefined, 0, 5, {}, [], ['a'], true]) {
    assert.equal(isBlank(v), true, `debería ser vacío: ${JSON.stringify(v)}`);
  }
});

test('isBlank: solo caracteres de control (0–1F, 7F–9F) también es vacío, con una letra no', () => {
  for (let cp = 0; cp <= 0x9F; cp += 1) {
    if (cp > 0x1F && cp < 0x7F) continue;
    assert.equal(isBlank(String.fromCodePoint(cp)), true, `U+${cp.toString(16)}`);
    assert.equal(isBlank(` ${String.fromCodePoint(cp)}\u200B`), true);
    assert.equal(isBlank(`a${String.fromCodePoint(cp)}`), false);
  }
  assert.equal(gradeText({ type: 'fill_verb', accept: ['works'] }, '\u0001').empty, true);
});

test('isBlank: cada carácter de ancho cero (200B, 200C, 200D, 2060, FEFF) cuenta como vacío', () => {
  for (const ch of ['\u200B', '\u200C', '\u200D', '\u2060', '\uFEFF']) {
    assert.equal(isBlank(ch), true, `U+${ch.codePointAt(0).toString(16)}`);
    assert.equal(isBlank(`a${ch}`), false);
  }
});

test('isBlank: cualquier carácter visible lo hace no vacío', () => {
  for (const v of ['a', ' a ', '0', '.', '’', 'é', '😀', '\u200Ba']) assert.equal(isBlank(v), false, JSON.stringify(v));
});

// ---------------------------------------------------------------- readText

test('readText: ítem válido con tipo, respuestas, pista y máscara', () => {
  const r = readText(item({ accept: ['takes', 'is taking'], data: { hint: ' verbo take ', mask: 'first_letter' } }));
  assert.deepEqual(r, { ok: true, type: 'fill_verb', accept: ['takes', 'is taking'], hint: 'verbo take', mask: 'first_letter' });
});

test('readText: sin data, hint ni máscara se leen como null y «none»', () => {
  assert.deepEqual(readText(item()), { ok: true, type: 'fill_verb', accept: ['takes'], hint: null, mask: 'none' });
});

test('readText: lo que no es un objeto es no_item', () => {
  for (const v of [null, undefined, 'texto', 5, true, [], [item()]]) assert.deepEqual(readText(v), { ok: false, reason: 'no_item' }, JSON.stringify(v));
});

test('readText: accept ausente, vacío o sin textos útiles es no_accept', () => {
  for (const accept of [undefined, null, [], [''], ['  '], [5], [null, {}], 'takes', { 0: 'takes' }, ['\u200B']]) {
    assert.deepEqual(readText(item({ accept })), { ok: false, reason: 'no_accept' }, JSON.stringify(accept));
  }
});

test('readText: de accept solo se quedan los textos útiles y se conserva el orden', () => {
  assert.deepEqual(readText(item({ accept: ['', 'b', 7, ' ', 'a', null] })).accept, ['b', 'a']);
});

test('readText: data dañado (null, lista, texto) se ignora', () => {
  for (const data of [null, [], 'texto', 5, [{ mask: 'length' }]]) {
    const r = readText(item({ data }));
    assert.equal(r.ok, true);
    assert.equal(r.hint, null);
    assert.equal(r.mask, 'none');
  }
});

test('readText: la máscara solo vale si es una de las tres; la pista en blanco es null', () => {
  for (const mask of MASKS) assert.equal(readText(item({ data: { mask } })).mask, mask);
  for (const mask of ['First_letter', 'all', '', null, 3, [], 'length ']) assert.equal(readText(item({ data: { mask } })).mask, 'none', JSON.stringify(mask));
  assert.equal(readText(item({ data: { hint: '   ' } })).hint, null);
  assert.equal(readText(item({ data: { hint: 5 } })).hint, null);
});

test('readText: un tipo que no es texto da tipo vacío; no muta el ítem', () => {
  assert.equal(readText(item({ type: 5 })).type, '');
  const it = item({ accept: ['a', '', 'b'], data: { hint: ' x ', mask: 'length' } });
  const copia = JSON.stringify(it);
  readText(it);
  assert.equal(JSON.stringify(it), copia);
});

test('readText: la lista de respuestas que devuelve no es la del ítem', () => {
  const it = item({ accept: ['a', 'b'] });
  const r = readText(it);
  r.accept.push('c');
  assert.deepEqual(it.accept, ['a', 'b']);
});

// ---------------------------------------------------------------- optionsFor

test('optionsFor: tipo sin opciones propias da {} y translate_word activa almostAtWordEnd', () => {
  assert.deepEqual(optionsFor('fill_verb'), {});
  assert.deepEqual(optionsFor('first_letter'), {});
  assert.deepEqual(optionsFor(undefined), {});
  assert.deepEqual(optionsFor('translate_word'), { almostAtWordEnd: true });
});

test('optionsFor: nombres heredados de Object no se tratan como tipos', () => {
  for (const t of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) assert.deepEqual(optionsFor(t), {}, t);
});

test('optionsFor: extra manda sobre el tipo solo con true o false', () => {
  assert.equal(optionsFor('translate_word', { almostAtWordEnd: false }).almostAtWordEnd, false);
  assert.equal(optionsFor('fill_verb', { almostAtWordEnd: true }).almostAtWordEnd, true);
  for (const v of ['true', 1, null, undefined, 0]) assert.equal(optionsFor('translate_word', { almostAtWordEnd: v }).almostAtWordEnd, true, String(v));
  for (const v of ['true', 1, null, undefined, 0]) assert.equal('almostAtWordEnd' in optionsFor('fill_verb', { almostAtWordEnd: v }), false, String(v));
});

test('optionsFor: lang solo vale «es»; keepFinalPunctuation solo con true; confusables pasa tal cual', () => {
  assert.equal(optionsFor('fill_verb', { lang: 'es' }).lang, 'es');
  for (const v of ['en', 'ES', 'es ', '', null, 5]) assert.equal('lang' in optionsFor('fill_verb', { lang: v }), false, String(v));
  assert.equal(optionsFor('fill_verb', { keepFinalPunctuation: true }).keepFinalPunctuation, true);
  for (const v of [false, 'true', 1, null]) assert.equal('keepFinalPunctuation' in optionsFor('fill_verb', { keepFinalPunctuation: v }), false, String(v));
  const conf = { areConfusable: () => false };
  assert.equal(optionsFor('fill_verb', { confusables: conf }).confusables, conf);
  assert.equal('confusables' in optionsFor('fill_verb', { confusables: null }), false);
});

test('optionsFor: un extra que no es objeto se ignora y no se cuelan otras claves', () => {
  for (const e of [null, undefined, 'es', 5, true]) assert.deepEqual(optionsFor('translate_word', e), { almostAtWordEnd: true }, String(e));
  assert.deepEqual(optionsFor('fill_verb', { compare: () => 1, rng: 1, lang: 'es', extra: 'x' }), { lang: 'es' });
});

test('optionsFor: devuelve un objeto nuevo y TYPE_OPTIONS queda congelado e intacto', () => {
  const o = optionsFor('translate_word');
  o.almostAtWordEnd = false;
  o.otra = 1;
  assert.deepEqual(optionsFor('translate_word'), { almostAtWordEnd: true });
  assert.equal(Object.isFrozen(TYPE_OPTIONS), true);
  assert.equal(Object.isFrozen(TYPE_OPTIONS.translate_word), true);
  assert.equal(Object.isFrozen(MASKS), true);
});

// ---------------------------------------------------------------- maskHint

test('maskHint: first_letter deja la primera letra y una raya por cada otra', () => {
  assert.equal(maskHint(item({ accept: ['take'], data: { mask: 'first_letter' } })), 't _ _ _');
});

test('maskHint: length deja una raya por letra', () => {
  assert.equal(maskHint(item({ accept: ['take'], data: { mask: 'length' } })), '_ _ _ _');
});

test('maskHint: varias palabras se separan con tres espacios', () => {
  assert.equal(maskHint(item({ accept: ['look after'], data: { mask: 'first_letter' } })), 'l _ _ _   a _ _ _ _');
  assert.equal(maskHint(item({ accept: ['look after'], data: { mask: 'length' } })), '_ _ _ _   _ _ _ _ _');
  assert.equal(maskHint(item({ accept: ['a  b\tc'], data: { mask: 'length' } })), '_   _   _');
});

test('maskHint: el apóstrofo queda visible (recto y tipográfico)', () => {
  assert.equal(maskHint(item({ accept: ['don\'t'], data: { mask: 'first_letter' } })), 'd _ _ \' _');
  assert.equal(maskHint(item({ accept: ['don’t'], data: { mask: 'length' } })), '_ _ _ ’ _');
});

test('maskHint: sin máscara, con máscara «none» o inválida es null', () => {
  assert.equal(maskHint(item()), null);
  assert.equal(maskHint(item({ data: { mask: 'none' } })), null);
  assert.equal(maskHint(item({ data: { mask: 'otra' } })), null);
});

test('maskHint: ítem inválido o sin respuestas es null y nunca lanza', () => {
  for (const v of [null, undefined, 5, 'x', [], item({ accept: [], data: { mask: 'length' } }), item({ accept: undefined, data: { mask: 'length' } })]) {
    assert.equal(maskHint(v), null, JSON.stringify(v));
  }
});

test('maskHint: sale de la primera respuesta útil, no de las demás', () => {
  assert.equal(maskHint(item({ accept: [' ', 'go', 'goes'], data: { mask: 'length' } })), '_ _');
  assert.equal(maskHint(item({ accept: ['  go  ', 'goes'], data: { mask: 'length' } })), '_ _');
});

test('maskHint: cuenta letras, no unidades de código (tildes y emoji)', () => {
  assert.equal(maskHint(item({ accept: ['niño'], data: { mask: 'first_letter' } })), 'n _ _ _');
  assert.equal(maskHint(item({ accept: ['😀a'], data: { mask: 'length' } })), '_ _');
});

test('maskHint: no muta el ítem', () => {
  const it = item({ accept: ['take'], data: { mask: 'first_letter' } });
  const copia = JSON.stringify(it);
  maskHint(it);
  assert.equal(JSON.stringify(it), copia);
});

// ---------------------------------------------------------------- gradeText con compare real

test('gradeText: respuesta exacta es correct, con matched, sin diferencias y no vacía', () => {
  const g = gradeText(item({ accept: ['takes'] }), 'takes');
  assert.equal(g.result, 'correct');
  assert.equal(g.matched, 'takes');
  assert.equal(g.empty, false);
  assert.equal(g.typed, 'takes');
  assert.deepEqual(g.spellingFlags, []);
  assert.deepEqual(g.errorCodes, []);
  assert.ok(g.diff.every((d) => d.status === 'ok'));
});

test('gradeText: mayúsculas, espacios en los bordes y puntuación interior no cambian el resultado', () => {
  const it = item({ accept: ['Yes, I do'] });
  for (const t of ['yes i do', '  Yes, I do  ', 'YES, I DO', 'Yes I do']) assert.equal(gradeText(it, t).result, 'correct', t);
});

test('gradeText: cualquier variante de accept vale y matched dice cuál', () => {
  const it = item({ accept: ['has been', 'has been being'] });
  assert.equal(gradeText(it, 'has been').matched, 'has been');
  const g = gradeText(it, 'has been being');
  assert.equal(g.result, 'correct');
  assert.equal(g.matched, 'has been being');
});

test('gradeText: contracciones, escritas de cualquier forma, valen (I’m ≡ I am)', () => {
  assert.equal(gradeText(item({ accept: ['I am tired'] }), 'I\'m tired').result, 'correct');
  assert.equal(gradeText(item({ accept: ['I\'m tired'] }), 'I am tired').result, 'correct');
  assert.equal(gradeText(item({ accept: ['I am tired'] }), 'I’m tired').result, 'correct');
  assert.equal(gradeText(item({ accept: ['they do not know'] }), 'they don\'t know').result, 'correct');
  assert.equal(gradeText(item({ accept: ['cannot go'] }), 'can\'t go').result, 'correct');
});

test('gradeText: «\'s» y «\'d» no se expanden, así que el contenido lista las dos formas', () => {
  assert.equal(gradeText(item({ accept: ['he is here'] }), 'he\'s here').result, 'wrong');
  assert.equal(gradeText(item({ accept: ['he is here', 'he\'s here'] }), 'he\'s here').result, 'correct');
  assert.equal(gradeText(item({ accept: ['he is here', 'he\'s here'] }), 'he is here').result, 'correct');
});

test('gradeText: una errata de tecleo es almost y marca la palabra para la tarjeta de ortografía', () => {
  const g = gradeText(item({ accept: ['I receive it'] }), 'I recieve it');
  assert.equal(g.result, 'almost');
  assert.equal(g.matched, 'I receive it');
  assert.deepEqual(g.spellingFlags, [{ word: 'recieve', expected: 'receive', index: 1 }]);
});

test('gradeText: la última letra solo da almost en translate_word (almostAtWordEnd)', () => {
  const base = { accept: ['little'] };
  assert.equal(gradeText(item({ ...base, type: 'fill_verb' }), 'littl').result, 'wrong');
  assert.equal(gradeText(item({ ...base, type: 'first_letter' }), 'littl').result, 'wrong');
  const g = gradeText(item({ ...base, type: 'translate_word' }), 'littl');
  assert.equal(g.result, 'almost');
  assert.deepEqual(g.spellingFlags, [{ word: 'littl', expected: 'little', index: 0 }]);
});

test('gradeText: work por works es wrong en fill_verb (error de gramática, no de tecleo)', () => {
  assert.equal(gradeText(item({ accept: ['he works'] }), 'he work').result, 'wrong');
});

test('gradeText: opts.almostAtWordEnd puede apagarlo en translate_word o encenderlo en otro tipo', () => {
  const it = item({ type: 'translate_word', accept: ['little'] });
  assert.equal(gradeText(it, 'littl', { almostAtWordEnd: false }).result, 'wrong');
  assert.equal(gradeText(item({ accept: ['little'] }), 'littl', { almostAtWordEnd: true }).result, 'almost');
});

test('gradeText: respuesta incorrecta es wrong, sin matched, con la corrección en diff', () => {
  const g = gradeText(item({ accept: ['takes'] }), 'make');
  assert.equal(g.result, 'wrong');
  assert.equal(g.matched, null);
  assert.equal(g.empty, false);
  assert.ok(g.diff.length > 0);
  assert.ok(g.diff.some((d) => d.status !== 'ok'));
});

test('gradeText: «i» minúscula como pronombre sigue siendo correcta y avisa con MECH.CAP_I', () => {
  const g = gradeText(item({ accept: ['I go'] }), 'i go');
  assert.equal(g.result, 'correct');
  assert.deepEqual(g.errorCodes, ['MECH.CAP_I']);
});

test('gradeText: con lang es se ignoran las tildes; en inglés (por defecto) no', () => {
  const it = item({ type: 'translate_word', accept: ['café'] });
  assert.equal(gradeText(it, 'cafe', { lang: 'es' }).result, 'correct');
  assert.notEqual(gradeText(it, 'cafe').result, 'correct');
  assert.notEqual(gradeText(it, 'cafe', { lang: 'en' }).result, 'correct');
});

// ---------------------------------------------------------------- respuesta vacía

test('gradeText: vacío, solo espacios y lo que no es texto dan empty true, wrong y typed vacío', () => {
  for (const t of ['', '   ', '\t\n', '\u00A0', '\u200B', null, undefined, 5, {}, []]) {
    const g = gradeText(item(), t);
    assert.equal(g.empty, true, JSON.stringify(t));
    assert.equal(g.result, 'wrong', JSON.stringify(t));
    assert.equal(g.matched, null, JSON.stringify(t));
  }
  assert.equal(gradeText(item(), '  ').typed, '');
  assert.equal(gradeText(item(), 7).typed, '');
});

test('gradeText: un texto con solo caracteres de ancho cero es vacío aunque typed no quede en blanco', () => {
  assert.equal(gradeText(item(), '\u200B\u200B').empty, true);
});

test('gradeText: cualquier carácter visible lo hace no vacío', () => {
  assert.equal(gradeText(item(), '.').empty, false);
  assert.equal(gradeText(item(), 'a').empty, false);
  assert.equal(gradeText(item(), ' x ').typed, 'x');
});

// ---------------------------------------------------------------- ítem inválido

test('gradeText: un ítem inválido lanza un Error en español con el motivo', () => {
  for (const v of [null, undefined, 5, 'x', [], [item()]]) assert.throws(() => gradeText(v, 'a'), /gradeText: el ítem no es un objeto/, JSON.stringify(v));
  for (const accept of [undefined, [], [' '], [3]]) assert.throws(() => gradeText(item({ accept }), 'a'), /gradeText: el ítem no tiene respuestas aceptadas/);
});

test('gradeText: no muta el ítem ni su accept', () => {
  const it = item({ accept: ['a b', 'c'], data: { hint: 'x', mask: 'length' } });
  const copia = JSON.stringify(it);
  gradeText(it, 'a bb');
  gradeText(it, '');
  assert.equal(JSON.stringify(it), copia);
});

// ---------------------------------------------------------------- compare inyectado

function fakeCompare(ret) {
  const calls = [];
  const fn = (...args) => { calls.push(args); return typeof ret === 'function' ? ret(...args) : ret; };
  fn.calls = calls;
  return fn;
}

test('gradeText: compare recibe lo escrito sin espacios, las aceptadas válidas y las opciones del tipo', () => {
  const cmp = fakeCompare({ result: 'correct', matched: 'a', diff: [], spellingFlags: [], errorCodes: [] });
  gradeText(item({ type: 'translate_word', accept: ['', 'a', 'b'] }), '  hola  ', { compare: cmp });
  assert.equal(cmp.calls.length, 1);
  assert.deepEqual(cmp.calls[0], ['hola', ['a', 'b'], { almostAtWordEnd: true }]);
});

test('gradeText: en otros tipos compare recibe opciones vacías, sin almostAtWordEnd', () => {
  const cmp = fakeCompare({ result: 'wrong' });
  gradeText(item({ type: 'fill_verb' }), 'x', { compare: cmp });
  assert.deepEqual(cmp.calls[0][2], {});
  assert.equal('almostAtWordEnd' in cmp.calls[0][2], false);
});

test('gradeText: confusables, lang y keepFinalPunctuation se reenvían a compare', () => {
  const cmp = fakeCompare({ result: 'wrong' });
  const confusables = { areConfusable: () => false };
  gradeText(item(), 'x', { compare: cmp, confusables, lang: 'es', keepFinalPunctuation: true });
  assert.deepEqual(cmp.calls[0][2], { confusables, lang: 'es', keepFinalPunctuation: true });
});

test('gradeText: lo que no es una función en opts.compare se ignora y se usa el compare real', () => {
  for (const c of [null, 'x', 5, {}, true]) assert.equal(gradeText(item(), 'takes', { compare: c }).result, 'correct', String(c));
});

test('gradeText: sin opts o con opts nulo funciona', () => {
  assert.equal(gradeText(item(), 'takes').result, 'correct');
  assert.equal(gradeText(item(), 'takes', undefined).result, 'correct');
  assert.equal(gradeText(item(), 'takes', null).result, 'correct');
});

test('gradeText: un compare que devuelve algo raro se ve como wrong con listas vacías', () => {
  for (const ret of [null, undefined, {}, { result: null, matched: undefined, diff: 'x', spellingFlags: 5, errorCodes: {} }]) {
    const g = gradeText(item(), 'x', { compare: fakeCompare(ret) });
    assert.equal(g.result, 'wrong');
    assert.equal(g.matched, null);
    assert.deepEqual(g.diff, []);
    assert.deepEqual(g.spellingFlags, []);
    assert.deepEqual(g.errorCodes, []);
  }
});

test('gradeText: lo que devuelve compare pasa tal cual (resultado, matched, diff, marcas y códigos)', () => {
  const ret = { result: 'almost', matched: 'm', diff: [{ text: 'a', status: 'ok' }], spellingFlags: [{ word: 'a', expected: 'b', index: 0 }], errorCodes: ['X'] };
  const g = gradeText(item(), 'a', { compare: fakeCompare(ret) });
  assert.equal(g.result, 'almost');
  assert.equal(g.matched, 'm');
  assert.deepEqual(g.diff, ret.diff);
  assert.deepEqual(g.spellingFlags, ret.spellingFlags);
  assert.deepEqual(g.errorCodes, ret.errorCodes);
});

test('gradeText: el resultado de compare no cambia empty ni typed', () => {
  const g = gradeText(item(), '  ', { compare: fakeCompare({ result: 'correct', matched: 'x' }) });
  assert.equal(g.empty, true);
  assert.equal(g.typed, '');
  assert.equal(g.result, 'correct');
});
