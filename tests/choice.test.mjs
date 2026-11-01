// @purpose: Pruebas de la lógica pura de la familia de elección (core/choice.js, 2.3-T1): lectura del ítem, barajado estadístico y calificación con distractores.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHOICE_LIMITS, readChoice, arrange, gradeChoice } from '../core/choice.js';
import { createRng, systemRng } from '../core/rng.js';
import { validateEvent } from '../core/eventSchema.js';
import { makeEvent } from './_helpers.mjs';

const item = (extra = {}) => ({
  id: 'g.x.0001', type: 'choose_correct', prompt_es: 'Elige.',
  data: { options: ['He go', 'He goes', 'He going'], correct: 1 },
  distractors: [{ text: 'He go', code: 'GRM.S3' }, { text: 'He going', code: 'GRM.ING' }],
  ...extra,
});
const multi = (correct = [0, 2]) => ({ type: 'choose_correct', data: { options: ['a', 'b', 'c', 'd'], correct } });

test('límites: las mismas cotas que el contrato de contenido', () => {
  assert.deepEqual({ ...CHOICE_LIMITS }, { min: 2, max: 8, response: 2000 });
  assert.ok(Object.isFrozen(CHOICE_LIMITS));
});

test('readChoice: caso feliz y valores por defecto', () => {
  const r = readChoice(item());
  assert.deepEqual(r, { ok: true, options: ['He go', 'He goes', 'He going'], correct: [1], multiple: false, shuffle: true });
  assert.equal(readChoice(item({ data: { options: ['a', 'b'], correct: 0, shuffle: false } })).shuffle, false);
});

test('readChoice: devuelve copias (no deja mutar el ítem)', () => {
  const it = item();
  const r = readChoice(it);
  r.options.push('x');
  assert.equal(it.data.options.length, 3);
});

test('readChoice: sin data o ítem que no es objeto', () => {
  for (const bad of [null, undefined, 5, 'x', [], {}, { data: null }, { data: [] }]) assert.deepEqual(readChoice(bad), { ok: false, reason: 'no_data' }, JSON.stringify(bad));
});

test('readChoice: opciones inválidas (menos de 2, más de 8, no texto, vacías)', () => {
  const bad = (options) => readChoice({ data: { options, correct: 0 } }).reason;
  assert.equal(bad(['a']), 'bad_options');
  assert.equal(bad([]), 'bad_options');
  assert.equal(bad('ab'), 'bad_options');
  assert.equal(bad(Array.from({ length: 9 }, (_, i) => `o${i}`)), 'bad_options');
  assert.equal(bad(['a', 5]), 'bad_options');
  assert.equal(bad(['a', '  ']), 'bad_options');
  assert.equal(bad(['a', null]), 'bad_options');
  assert.equal(readChoice({ data: { options: Array.from({ length: 8 }, (_, i) => `o${i}`), correct: 7 } }).ok, true);
  assert.equal(readChoice({ data: { options: ['a', 'b'], correct: 1 } }).ok, true);
});

test('readChoice: correct inválido en modo de una sola opción', () => {
  const bad = (correct) => readChoice({ data: { options: ['a', 'b', 'c'], correct } }).reason;
  for (const c of [3, -1, 1.5, '1', null, undefined, NaN, [1], [0, 1]]) assert.equal(bad(c), 'bad_correct', String(c));
});

test('readChoice multiple: acepta entero o lista, ordena y rechaza repetidos, vacíos y fuera de rango', () => {
  assert.deepEqual(readChoice(multi([2, 0]), { multiple: true }).correct, [0, 2]);
  assert.deepEqual(readChoice(multi(1), { multiple: true }).correct, [1]);
  assert.equal(readChoice(multi([0, 0]), { multiple: true }).reason, 'bad_correct');
  assert.equal(readChoice(multi([]), { multiple: true }).reason, 'bad_correct');
  assert.equal(readChoice(multi([0, 4]), { multiple: true }).reason, 'bad_correct');
  assert.equal(readChoice(multi([0, '1']), { multiple: true }).reason, 'bad_correct');
  assert.equal(readChoice(multi([0, 2]), { multiple: true }).multiple, true);
});

test('arrange: sin barajar devuelve el orden original; barajando es siempre una permutación', () => {
  assert.deepEqual(arrange(4, { shuffle: false }), [0, 1, 2, 3]);
  assert.deepEqual(arrange(1, { rng: createRng(1) }), [0]);
  for (let n = 2; n <= 8; n += 1) {
    for (let seed = 1; seed <= 50; seed += 1) {
      const o = arrange(n, { rng: createRng(seed) });
      assert.deepEqual([...o].sort((a, b) => a - b), Array.from({ length: n }, (_, i) => i), `n=${n} seed=${seed}`);
    }
  }
});

test('arrange: es determinista con la misma semilla y distinto con otra', () => {
  assert.deepEqual(arrange(6, { rng: createRng(9) }), arrange(6, { rng: createRng(9) }));
  const seen = new Set();
  for (let s = 1; s <= 30; s += 1) seen.add(arrange(6, { rng: createRng(s) }).join());
  assert.ok(seen.size > 10, `solo ${seen.size} órdenes distintos en 30 semillas`);
});

test('CA 1: la posición de la correcta varía (prueba estadística con 4 y con 2 opciones)', () => {
  const count = (n, runs, mk) => {
    const at = new Array(n).fill(0);
    for (let i = 0; i < runs; i += 1) at[arrange(n, { rng: mk(i) }).indexOf(0)] += 1;
    return at;
  };
  const four = count(4, 4000, (i) => createRng(i + 1));
  for (const c of four) assert.ok(c / 4000 > 0.22 && c / 4000 < 0.28, `4 opciones: ${four}`);
  const two = count(2, 2000, (i) => createRng(i + 1));
  for (const c of two) assert.ok(c / 2000 > 0.45 && c / 2000 < 0.55, `2 opciones: ${two}`);
  // Con el azar del sistema: cotas anchas (más de 5 desviaciones típicas) para que no sea una prueba inestable.
  const sys = count(4, 2000, () => systemRng);
  for (const c of sys) assert.ok(c / 2000 > 0.18 && c / 2000 < 0.32, `sistema: ${sys}`);
  // La correcta no se queda siempre en el mismo sitio ni siempre fuera del primero.
  assert.ok(four.every((c) => c > 0));
});

test('arrange: entradas inválidas lanzan Error en español', () => {
  for (const n of [0, -1, 9, 2.5, '3', null, undefined, NaN]) assert.throws(() => arrange(n, { rng: createRng(1) }), /número de opciones/, String(n));
  assert.throws(() => arrange(3, {}), /falta un rng/);
  assert.throws(() => arrange(3), /falta un rng/);
  assert.throws(() => arrange(3, { rng: {} }), /falta un rng/);
  assert.throws(() => arrange(3, { rng: { shuffle: () => [0, 0, 1] } }), /permutación/);
  assert.throws(() => arrange(3, { rng: { shuffle: () => [0, 1] } }), /permutación/);
  assert.throws(() => arrange(3, { rng: { shuffle: () => [0, 1, 2, 2] } }), /permutación/, 'un elemento repetido de más');
  assert.throws(() => arrange(3, { rng: { shuffle: () => [0, 1, 3] } }), /permutación/);
  assert.throws(() => arrange(3, { rng: { shuffle: () => null } }), /permutación/);
  assert.doesNotThrow(() => arrange(3, { shuffle: false }));
});

test('gradeChoice: acierto, fallo con código, fallo sin código', () => {
  const ok = gradeChoice(item(), 1);
  assert.equal(ok.result, 'correct');
  assert.deepEqual(ok.picked, [1]);
  assert.deepEqual(ok.distractors, []);
  assert.deepEqual(ok.errorCodes, []);
  assert.equal(ok.typed, 'He goes');
  assert.equal(ok.empty, false);
  const bad = gradeChoice(item(), 0);
  assert.equal(bad.result, 'wrong');
  assert.deepEqual(bad.distractors, [{ index: 0, text: 'He go', code: 'GRM.S3' }]);
  assert.deepEqual(bad.errorCodes, ['GRM.S3']);
  const noCode = gradeChoice(item({ distractors: [] }), 0);
  assert.equal(noCode.result, 'wrong');
  assert.deepEqual(noCode.distractors, [{ index: 0, text: 'He go', code: null }]);
  assert.deepEqual(noCode.errorCodes, []);
});

test('gradeChoice: acepta entero o lista y las posiciones son índices ORIGINALES (no las de pantalla)', () => {
  assert.equal(gradeChoice(item(), [1]).result, 'correct');
  assert.equal(gradeChoice(item(), 1).result, 'correct');
  // Da igual cómo se haya barajado: se califica por índice original.
  const order = arrange(3, { rng: createRng(4) });
  for (const original of order) assert.equal(gradeChoice(item(), original).result, original === 1 ? 'correct' : 'wrong');
});

test('gradeChoice: el distractor se casa por texto normalizado (mayúsculas, puntuación, apóstrofo curvo)', () => {
  const it = { data: { options: ["I don't know.", 'I do not know'], correct: 1 }, distractors: [{ text: 'i DON’T know', code: 'GRM.NEG' }] };
  assert.deepEqual(gradeChoice(it, 0).errorCodes, ['GRM.NEG']);
});

test('gradeChoice: un code con forma inválida se descarta (invalidaría el evento entero)', () => {
  for (const code of ['mala forma', 'grm.s3', 'GRM', '', null, 5]) {
    const g = gradeChoice(item({ distractors: [{ text: 'He go', code }] }), 0);
    assert.deepEqual(g.errorCodes, [], String(code));
    assert.equal(g.distractors[0].code, null);
  }
});

test('gradeChoice: toma el primer distractor con code válido si hay varios con el mismo texto', () => {
  const g = gradeChoice(item({ distractors: [{ text: 'He go', code: 'mala' }, { text: 'He go', code: 'GRM.A' }, { text: 'He go', code: 'GRM.B' }] }), 0);
  assert.deepEqual(g.errorCodes, ['GRM.A']);
});

test('gradeChoice: distractors ausentes, mal formados o con la opción correcta no rompen ni marcan error', () => {
  for (const d of [undefined, null, 'x', {}, [null, 5, 'x', {}, { text: 5, code: 'GRM.A' }]]) assert.deepEqual(gradeChoice(item({ distractors: d }), 0).errorCodes, []);
  const g = gradeChoice(item({ distractors: [{ text: 'He goes', code: 'GRM.A' }] }), 1);
  assert.equal(g.result, 'correct');
  assert.deepEqual(g.distractors, []);
});

test('gradeChoice: elección vacía o no calificable → empty', () => {
  for (const p of [null, undefined, [], [7], [-1], [1.5], ['1'], [NaN], 'x', {}, [0, 1]]) {
    const g = gradeChoice(item(), p);
    assert.equal(g.empty, true, JSON.stringify(p));
    assert.equal(g.result, 'wrong');
  }
  assert.equal(gradeChoice(item(), []).typed, '');
});

test('gradeChoice: dos opciones en modo de una sola es empty; repetir el mismo índice cuenta una vez', () => {
  assert.equal(gradeChoice(item(), [0, 1]).empty, true);
  const g = gradeChoice(item(), [1, 1, 1]);
  assert.equal(g.empty, false);
  assert.deepEqual(g.picked, [1]);
  assert.equal(g.result, 'correct');
});

test('gradeChoice multiple: conjunto exacto = correct; faltar o sobrar = wrong', () => {
  const m = { multiple: true };
  assert.equal(gradeChoice(multi(), [2, 0], m).result, 'correct');
  const partial = gradeChoice(multi(), [0], m);
  assert.equal(partial.result, 'wrong');
  assert.deepEqual(partial.missed, [2]);
  const extra = gradeChoice(multi(), [0, 1, 2], m);
  assert.equal(extra.result, 'wrong');
  assert.deepEqual(extra.missed, []);
  assert.deepEqual(extra.distractors.map((d) => d.index), [1]);
  assert.equal(gradeChoice(multi(), [1, 3], m).result, 'wrong');
  assert.deepEqual(gradeChoice(multi(), [1, 3], m).missed, [0, 2]);
  assert.equal(gradeChoice(multi(), [], m).empty, true);
  assert.equal(gradeChoice(multi(), [0, 2], m).typed, 'a | c');
  // Una sola opción también es una elección válida en modo múltiple.
  assert.equal(gradeChoice(multi(1), [1], m).result, 'correct');
});

test('gradeChoice: sin multiple, missed siempre vacío', () => {
  assert.deepEqual(gradeChoice(item(), 0).missed, []);
});

test('gradeChoice: textos con acentos, ñ, emoji y mucho largo (typed se corta a 2000)', () => {
  const it = { data: { options: ['¿Qué tal, señor? 😀', 'x'.repeat(5000)], correct: 0 } };
  assert.equal(gradeChoice(it, 0).typed, '¿Qué tal, señor? 😀');
  const long = gradeChoice(it, 1);
  assert.equal(long.typed.length, 2000);
  assert.equal(long.result, 'wrong');
});

test('gradeChoice: errorCodes sin repetir cuando varias opciones elegidas comparten código', () => {
  const it = { data: { options: ['a', 'b', 'c'], correct: 2 }, distractors: [{ text: 'a', code: 'GRM.X' }, { text: 'b', code: 'GRM.X' }] };
  const g = gradeChoice(it, [0, 1], { multiple: true });
  assert.deepEqual(g.errorCodes, ['GRM.X']);
  assert.equal(g.distractors.length, 2);
});

test('gradeChoice: ítem inválido lanza Error en español y no muta el ítem', () => {
  for (const bad of [null, {}, { data: { options: ['a'], correct: 0 } }, { data: { options: ['a', 'b'], correct: 2 } }]) assert.throws(() => gradeChoice(bad, 0), /no es válido/);
  const it = item();
  const before = JSON.stringify(it);
  gradeChoice(it, 0);
  assert.equal(JSON.stringify(it), before);
});

// FIX 2.3-T2: `typed` va a `responseRaw` del evento, y el evento rechaza los caracteres de control: la respuesta entera se perdía.
test('typed nunca trae un carácter que el evento rechace (se barren todos los de control posibles)', () => {
  for (let code = 0; code <= 0x9f; code += 1) {
    const text = `a${String.fromCharCode(code)}b`;
    const it = item({ data: { options: ['ok', text, 'otra'], correct: 0 } });
    const g = gradeChoice(it, 1);
    const ev = makeEvent({ responseRaw: g.typed, result: 'wrong', rating: 1 });
    // id y day los asigna events.log(): no se envían.
    delete ev.id;
    delete ev.day;
    const v = validateEvent(ev);
    assert.equal(v.ok, true, `el carácter U+${code.toString(16).padStart(4, '0')} deja typed inválido para el evento: ${JSON.stringify(v.problems)}`);
  }
});

test('typed cambia los de control por espacios, conserva tab y salto de línea y sigue recortado a 2000', () => {
  const it = item({ data: { options: ['ok', 'x\u0007y\tz\nw', 'otra'], correct: 0 } });
  assert.equal(gradeChoice(it, 1).typed, 'x y\tz\nw');
  const big = item({ data: { options: ['ok', `${'\u0001'.repeat(3000)}`, 'otra'], correct: 0 } });
  assert.equal(gradeChoice(big, 1).typed.length, CHOICE_LIMITS.response);
});

// Huecos de la ronda de roturas 4.R (2.3-T2, punto 4).
test('typed sale en orden de opciones y sin repetir, aunque la elección llegue desordenada o repetida', () => {
  const it = item({ data: { options: ['a', 'b', 'c', 'd'], correct: [0, 1] } });
  assert.equal(gradeChoice(it, [2, 1, 2, 0], { multiple: true }).typed, 'a | b | c');
});

test('typed conserva el retorno de carro (el evento lo acepta) y limpia el resto de controles', () => {
  const it = item({ data: { options: ['ok', 'x\ry\u000Bz', 'otra'], correct: 0 } });
  assert.equal(gradeChoice(it, 1).typed, 'x\ry z');
});
