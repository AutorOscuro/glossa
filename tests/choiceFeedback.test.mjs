// @purpose: Pruebas de la retroalimentación de la familia de elección (core/choiceFeedback.js, 2.3-T2): pista del catálogo, entradas de error válidas y textos hostiles.
// Pruebas de core/choiceFeedback.js (subparte 2.3, tramo 2): la pista del distractor, las entradas para errors.record y la garantía de que ninguna es rechazada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { explainChoice } from '../core/choiceFeedback.js';
import { gradeChoice } from '../core/choice.js';
import { createErrorCatalog } from '../core/errorCatalog.js';
import { createErrors, LIMITS } from '../core/errors.js';
import { createMemoryDb } from '../core/db.memory.js';
import { makeClock } from './_helpers.mjs';

const FILE = JSON.parse(fs.readFileSync(new URL('../content/taxonomy/error_codes.json', import.meta.url), 'utf8'));
const CATALOG = createErrorCatalog(FILE);
const PISTA = (id) => FILE.codes.find((c) => c.id === id).pista_corta_es;
const TOPIC = 'gram.present_perfect.for_since';

const OK = "I've lived here for two years.";
const D1 = 'I live here since two years.';
const D2 = "I'm living here since two years.";
const D3 = 'I lived here for two years ago.';

const mk = (over = {}) => ({
  id: 'g.pp.0001', type: 'choose_correct', topics: [TOPIC], prompt_es: 'Elige la frase correcta.', situation: 'Presentarse con un nuevo vecino',
  data: { options: [OK, D1, D2, D3], correct: 0 },
  distractors: [{ text: D1, code: 'TNS.SINCE_FOR' }, { text: D2, code: 'TNS.SINCE_FOR' }, { text: D3, code: 'TNS.PP_PS' }],
  ...over,
});
const grade = (item, picked, o = {}) => gradeChoice(item, picked, o);
const explain = (item, picked, o = {}) => explainChoice(item, grade(item, picked, o.multiple ? { multiple: true } : {}), { catalog: CATALOG, ...o.explain });

test('un distractor con code: da su pista del catálogo y una entrada de error completa', () => {
  const r = explain(mk(), 1);
  assert.deepEqual(r.hints, [{ index: 1, text: D1, code: 'TNS.SINCE_FOR', hint: PISTA('TNS.SINCE_FOR') }]);
  assert.ok(r.hints[0].hint.length > 10);
  assert.deepEqual(r.errors, [{ code: 'TNS.SINCE_FOR', original: D1, correction: OK, context: 'Presentarse con un nuevo vecino', topics: [TOPIC] }]);
});

test('cada distractor da la pista de SU código', () => {
  assert.equal(explain(mk(), 3).hints[0].hint, PISTA('TNS.PP_PS'));
  assert.notEqual(PISTA('TNS.PP_PS'), PISTA('TNS.SINCE_FOR'));
});

test('un acierto no da pistas ni errores', () => {
  assert.deepEqual(explain(mk(), 0), { hints: [], errors: [] });
});

test('«No sé» (sin elección) no da pistas ni errores', () => {
  const item = mk();
  assert.deepEqual(explainChoice(item, grade(item, null), { catalog: CATALOG }), { hints: [], errors: [] });
  assert.deepEqual(explainChoice(item, grade(item, []), { catalog: CATALOG }), { hints: [], errors: [] });
  assert.deepEqual(explainChoice(item, { result: 'dont_know', correct: [0], distractors: [] }, { catalog: CATALOG }), { hints: [], errors: [] });
});

test('un distractor sin code, o con un code mal formado, no da pistas ni errores (pero sigue siendo wrong)', () => {
  const item = mk({ distractors: [{ text: D1 }, { text: D2, code: 'mal formado' }] });
  const g = grade(item, 1);
  assert.equal(g.result, 'wrong');
  assert.deepEqual(explainChoice(item, g, { catalog: CATALOG }), { hints: [], errors: [] });
  assert.deepEqual(explain(item, 2), { hints: [], errors: [] });
});

test('un code con forma válida que NO está en el catálogo se descarta (registrarlo rechazaría toda la respuesta)', () => {
  const item = mk({ distractors: [{ text: D1, code: 'ZZZ.NO_EXISTE' }, { text: D2, code: 'TNS.SINCE_FOR' }] });
  assert.deepEqual(explain(item, 1), { hints: [], errors: [] });
  assert.equal(explain(item, 2).errors.length, 1);
});

test('sin catálogo, o con uno inservible, no hay registro de errores y no lanza', () => {
  const item = mk();
  const g = grade(item, 1);
  for (const catalog of [undefined, null, {}, { has: () => true }, { hint: () => 'x' }, 'catalogo', []]) {
    assert.deepEqual(explainChoice(item, g, { catalog }), { hints: [], errors: [] });
  }
  assert.deepEqual(explainChoice(item, g), { hints: [], errors: [] });
  assert.deepEqual(explainChoice(item, g, undefined), { hints: [], errors: [] });
});

test('un code del catálogo sin pista: la entrada de error existe y la pista es null', () => {
  const fake = { has: (c) => c === 'TNS.SINCE_FOR', hint: () => null };
  const r = explainChoice(mk(), grade(mk(), 1), { catalog: fake });
  assert.equal(r.hints[0].hint, null);
  assert.equal(r.errors.length, 1);
  const blank = { has: () => true, hint: () => '   ' };
  assert.equal(explainChoice(mk(), grade(mk(), 1), { catalog: blank }).hints[0].hint, null);
});

test('los temas del ítem: se quitan los mal formados, los repetidos y los que pasan de 10', () => {
  const long = `${'a'.repeat(LIMITS.topicLength)}.x`;
  const topics = ['Bad Topic', 'gram.a.b', 'gram.a.b', 123, null, long, 'sin_punto', 'gram.c.d'];
  assert.deepEqual(explain(mk({ topics }), 1).errors[0].topics, ['gram.a.b', 'gram.c.d']);
  const many = Array.from({ length: 15 }, (_, i) => `gram.t.n${i}`);
  assert.deepEqual(explain(mk({ topics: many }), 1).errors[0].topics, many.slice(0, LIMITS.topics));
});

test('sin temas válidos el campo topics se omite (el registro usa los del código)', () => {
  for (const topics of [[], ['Bad'], undefined, 'gram.a.b', null]) {
    const e = explain(mk({ topics }), 1).errors[0];
    assert.equal('topics' in e, false);
  }
});

test('la lista de temas de salida es una copia: cambiarla no toca el ítem', () => {
  const item = mk();
  const e = explain(item, 1).errors[0];
  e.topics.push('gram.x.y');
  assert.deepEqual(item.topics, [TOPIC]);
});

test('textos largos se recortan a los topes del registro (original y correction 500, context 200)', () => {
  const longOk = 'c'.repeat(600);
  const longBad = 'x'.repeat(600);
  const item = mk({ situation: 's'.repeat(300), data: { options: [longOk, longBad, D2, D3], correct: 0 }, distractors: [{ text: longBad, code: 'TNS.SINCE_FOR' }] });
  const e = explain(item, 1).errors[0];
  assert.equal(e.original.length, LIMITS.original);
  assert.equal(e.correction.length, LIMITS.correction);
  assert.equal(e.context.length, LIMITS.context);
  assert.equal(explain(item, 1).hints[0].text, longBad);
});

test('el recorte no deja medio emoji al final', () => {
  const bad = `${'a'.repeat(LIMITS.original - 1)}😀`;
  const item = mk({ data: { options: [OK, bad, D2, D3], correct: 0 }, distractors: [{ text: bad, code: 'TNS.SINCE_FOR' }] });
  const e = explain(item, 1).errors[0];
  assert.equal(e.original, 'a'.repeat(LIMITS.original - 1));
  const exact = `${'b'.repeat(LIMITS.original - 2)}😀`;
  const item2 = mk({ data: { options: [OK, exact, D2, D3], correct: 0 }, distractors: [{ text: exact, code: 'TNS.SINCE_FOR' }] });
  assert.equal(explain(item2, 1).errors[0].original, exact);
});

test('los caracteres de control se cambian por espacios y un texto que solo es control se descarta', () => {
  const bad = 'I live\u0007 here\u0000 now';
  const junk = '\u0007\u0001';
  const item = mk({ data: { options: [OK, bad, junk, D3], correct: 0 }, distractors: [{ text: bad, code: 'TNS.SINCE_FOR' }, { text: junk, code: 'TNS.PP_PS' }] });
  assert.equal(explain(item, 1).errors[0].original, 'I live  here  now');
  assert.deepEqual(explain(item, 2), { hints: [], errors: [] });
  assert.equal(explain(mk({ situation: 'a\u0007b' }), 1).errors[0].context, 'a b');
});

test('el salto de línea se conserva (el registro lo admite)', () => {
  const bad = 'I live\nhere';
  const item = mk({ data: { options: [OK, bad, D2, D3], correct: 0 }, distractors: [{ text: bad, code: 'TNS.SINCE_FOR' }] });
  assert.equal(explain(item, 1).errors[0].original, 'I live\nhere');
});

test('sin situación (o solo espacios) no hay campo context; con una opción correcta rara no hay correction vacía', () => {
  for (const situation of [undefined, null, '   ', 7]) assert.equal('context' in explain(mk({ situation }), 1).errors[0], false);
  const item = mk({ data: { options: ['\u0007', D1, D2, D3], correct: 0 } });
  assert.equal('correction' in explain(item, 1).errors[0], false);
});

test('selección múltiple: un error por distractor elegido, en orden, y la corrección junta las correctas', () => {
  const item = mk({ data: { options: ['A ok', 'B ok', 'C mal', 'D mal'], correct: [0, 1] }, distractors: [{ text: 'C mal', code: 'TNS.PP_PS' }, { text: 'D mal', code: 'TNS.SINCE_FOR' }] });
  const r = explain(item, [0, 2, 3], { multiple: true });
  assert.deepEqual(r.hints.map((h) => [h.index, h.code]), [[2, 'TNS.PP_PS'], [3, 'TNS.SINCE_FOR']]);
  assert.deepEqual(r.errors.map((e) => e.original), ['C mal', 'D mal']);
  assert.equal(r.errors[0].correction, 'A ok | B ok');
  const missed = explain(item, [0], { multiple: true });
  assert.equal(missed.errors.length, 0);
});

test('dos opciones que son el mismo error (mismo code y mismo texto normalizado) se anotan una sola vez', () => {
  const item = mk({ data: { options: [OK, 'I live here.', 'i  live here', D3], correct: 0 }, distractors: [{ text: 'I live here.', code: 'TNS.SINCE_FOR' }] });
  const r = explain(item, [1, 2], { multiple: true });
  assert.equal(r.errors.length, 1);
  assert.equal(r.hints.length, 1);
  // Textos distintos tras normalizar, aunque compartan code, son dos errores distintos.
  assert.equal(explain(mk(), [1, 2], { multiple: true }).errors.length, 2);
});

test('no modifica sus entradas (ítem y calificación congelados)', () => {
  const freeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === 'object') freeze(v); return Object.freeze(o); };
  const item = freeze(mk());
  const g = freeze(grade(mk(), 1));
  const r = explainChoice(item, g, { catalog: CATALOG });
  assert.equal(r.errors.length, 1);
});

test('entradas inválidas lanzan un Error en español', () => {
  const g = grade(mk(), 1);
  for (const item of [null, undefined, 'x', [], 5]) assert.throws(() => explainChoice(item, g, { catalog: CATALOG }), /explainChoice: falta el ítem/);
  for (const bad of [null, undefined, {}, [], 'x', { distractors: [] }, { correct: [], distractors: 'x' }, { distractors: [], correct: 0 }]) {
    assert.throws(() => explainChoice(mk(), bad, { catalog: CATALOG }), /explainChoice: falta la elección calificada/);
  }
});

// Azar determinista: 300 ítems con textos hostiles. La garantía es que errors.record NUNCA rechaza una entrada que salga de aquí.
function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

test('ninguna entrada generada con textos hostiles es rechazada por el registro real de errores', async () => {
  const rnd = lcg(20261027);
  const pool = ['a', 'B', ' ', '\t', '\n', '\u0000', '\u0007', '\u001f', '\u007f', '\u0085', 'ñ', 'é', '😀', '👩‍👩‍👧', '\u2028', '’', "'", '"', '<', '&', '0'];
  const word = (max) => { const n = Math.floor(rnd() * max); let s = ''; for (let i = 0; i < n; i += 1) s += pool[Math.floor(rnd() * pool.length)]; return s; };
  const topicPool = [TOPIC, 'gram.a.b', 'Bad', 'x', '', 'gram..b', `${'z'.repeat(120)}.q`, 'vocab.house.rooms'];
  const db = createMemoryDb();
  await db.open();
  const errors = createErrors({ db, catalog: CATALOG, clock: makeClock('2026-10-15T14:00:00.000Z') });
  let total = 0;
  for (let n = 0; n < 300; n += 1) {
    const count = 2 + Math.floor(rnd() * 7);
    const options = Array.from({ length: count }, (_, i) => `${i}${rnd() < 0.15 ? word(900) : word(30)}`);
    const codes = ['TNS.SINCE_FOR', 'TNS.PP_PS', 'VRB.CAN_TO', 'ZZZ.NO', 'bad', null];
    const item = {
      id: `x.${n}`, type: 'choose_correct', prompt_es: 'x', situation: rnd() < 0.5 ? word(400) : undefined,
      topics: Array.from({ length: Math.floor(rnd() * 14) }, () => topicPool[Math.floor(rnd() * topicPool.length)]),
      data: { options, correct: Math.floor(rnd() * count) },
      distractors: options.map((o) => ({ text: o, code: codes[Math.floor(rnd() * codes.length)] })).filter((d) => d.code !== null),
    };
    const pick = Math.floor(rnd() * count);
    const r = explainChoice(item, gradeChoice(item, pick), { catalog: CATALOG });
    assert.equal(r.errors.length, r.hints.length);
    for (const entry of r.errors) {
      const out = await errors.record({ ...entry, itemId: item.id });
      assert.equal(typeof out.record.id, 'string');
      total += 1;
    }
  }
  assert.ok(total > 50, `se esperaban muchas entradas generadas (hubo ${total})`);
});

test('de punta a punta con el registro real: el error queda con el tema del ítem y la segunda vez cuenta 2', async () => {
  const db = createMemoryDb();
  await db.open();
  const errors = createErrors({ db, catalog: CATALOG, clock: makeClock('2026-10-15T14:00:00.000Z') });
  const item = mk();
  const first = explain(item, 1).errors[0];
  const a = await errors.record({ ...first, itemId: item.id, ts: new Date('2026-10-15T14:00:00.000Z') });
  const b = await errors.record({ ...first, itemId: item.id, ts: new Date('2026-10-16T14:00:00.000Z') });
  assert.deepEqual([a.created, b.created, b.counted], [true, false, true]);
  assert.equal(b.record.count, 2);
  assert.deepEqual(b.record.topics, [TOPIC]);
  assert.equal(b.record.original, D1);
  assert.equal(b.record.correction, OK);
});

// ---- Huecos que dejó la ronda de roturas 4.R (2.3-T2 punto 4): cada prueba mata una rotura concreta ----
const FAKE = { has: () => true, hint: () => null };
const gw = (over = {}) => ({ result: 'wrong', picked: [1], correct: [0], missed: [], distractors: [{ index: 1, text: D1, code: 'TNS.SINCE_FOR' }], errorCodes: [], typed: '', empty: false, ...over });
const errOf = (text, over = {}) => explainChoice(mk(), gw({ distractors: [{ index: 1, text, code: 'TNS.SINCE_FOR' }] }), { catalog: FAKE, ...over }).errors[0];

test('si graded dice «correct» no hay pistas ni errores, aunque traiga distractores', () => {
  assert.deepEqual(explainChoice(mk(), gw({ result: 'correct' }), { catalog: FAKE }), { hints: [], errors: [] });
});

test('un ítem sin data o con opciones raras no lanza y simplemente omite la corrección', () => {
  const sinData = explainChoice({ topics: [TOPIC] }, gw(), { catalog: FAKE }).errors[0];
  assert.equal(sinData.original, D1);
  assert.ok(!('correction' in sinData));
  const texto = explainChoice(mk({ data: { options: 'abc', correct: 0 } }), gw(), { catalog: FAKE }).errors[0];
  assert.ok(!('correction' in texto));
  const numero = explainChoice(mk({ data: { options: [5, D1], correct: 0 } }), gw(), { catalog: FAKE }).errors[0];
  assert.ok(!('correction' in numero));
});

test('un distractor nulo o con code que no es texto se salta sin lanzar', () => {
  const r = explainChoice(mk(), gw({ distractors: [null, { index: 2, text: D2, code: 5 }, { index: 1, text: D1, code: 'TNS.SINCE_FOR' }] }), { catalog: FAKE });
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0].original, D1);
});

test('el mismo texto con dos códigos distintos da dos errores (la clave incluye el código)', () => {
  const r = explainChoice(mk(), gw({ distractors: [{ index: 1, text: D1, code: 'TNS.SINCE_FOR' }, { index: 2, text: D1, code: 'TNS.PP_PS' }] }), { catalog: FAKE });
  assert.deepEqual(r.errors.map((e) => e.code), ['TNS.SINCE_FOR', 'TNS.PP_PS']);
});

test('recorte: un texto del largo exacto no se cambia, salvo para no dejar medio par sustituto', () => {
  const exacto = 'a'.repeat(499) + '\ud83d';
  assert.equal(errOf(exacto).original.length, 500);
  for (const par of ['\ud800\udc00', '\udbff\udfff', '\ud83d\ude00']) {
    const o = errOf('a'.repeat(499) + par).original;
    assert.equal(o, 'a'.repeat(499), `par ${par.charCodeAt(0).toString(16)}`);
  }
  const conEspacio = errOf('a'.repeat(499) + ' b').original;
  assert.equal(conEspacio, 'a'.repeat(499));
});

test('control: tabulador, tabulador vertical y C1 final se cambian por espacio', () => {
  assert.equal(errOf('x\u000By').original, 'x y');
  assert.equal(errOf('x\u009Fy').original, 'x y');
  assert.equal(errOf('x\u0009y').original, 'x y');
});

test('un tema de exactamente 100 caracteres cuenta; de 101 se descarta', () => {
  const t100 = 'gram.' + 'a'.repeat(95);
  assert.equal(t100.length, LIMITS.topicLength);
  assert.deepEqual(errOf(D1, {}).topics, [TOPIC]);
  assert.deepEqual(explainChoice(mk({ topics: [t100] }), gw(), { catalog: FAKE }).errors[0].topics, [t100]);
  assert.ok(!('topics' in explainChoice(mk({ topics: [t100 + 'a'] }), gw(), { catalog: FAKE }).errors[0]));
});
