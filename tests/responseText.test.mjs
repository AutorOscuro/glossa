// @purpose: Pruebas de toResponseRaw (core/responseText.js, 2.4-T1 cierre): controles rechazados por el evento, recorte, bordes y guardia de que los ejercicios la usan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toResponseRaw, RESPONSE_RAW_MAX, EVENT_CONTROL } from '../core/responseText.js';
import { validateEvent, LIMITS } from '../core/eventSchema.js';
import { gradeChoice, CHOICE_LIMITS } from '../core/choice.js';
import { makeEvent } from './_helpers.mjs';

// id y day los asigna events.log(): no se envían (TRAMPA-28).
const asEvent = (responseRaw) => { const e = makeEvent({ responseRaw, result: 'correct', rating: 1 }); delete e.id; delete e.day; return e; };
const hex = (c) => `U+${c.toString(16).padStart(4, '0')}`;

test('el tope es el del evento (no se duplica un número distinto)', () => {
  assert.equal(RESPONSE_RAW_MAX, LIMITS.responseRaw);
  assert.equal(RESPONSE_RAW_MAX, 2000);
  assert.equal(CHOICE_LIMITS.response, RESPONSE_RAW_MAX);
});

test('barrido 0–0x9F: lo que sale siempre lo acepta validateEvent', () => {
  for (let code = 0; code <= 0x9f; code += 1) {
    const out = toResponseRaw(`a${String.fromCharCode(code)}b`);
    const v = validateEvent(asEvent(out));
    assert.equal(v.ok, true, `${hex(code)} deja responseRaw inválido: ${JSON.stringify(v.problems)}`);
  }
});

test('barrido 0–0x9F: solo se cambian los que el evento rechaza; tab, salto de línea y retorno se conservan', () => {
  for (let code = 0; code <= 0x9f; code += 1) {
    const ch = String.fromCharCode(code);
    const keep = code === 0x09 || code === 0x0a || code === 0x0d || (code >= 0x20 && code <= 0x7e);
    assert.equal(toResponseRaw(ch), keep ? ch : ' ', hex(code));
  }
});

test('desde U+00A0 nada se toca (acentos, ñ, emoji, separadores de línea)', () => {
  const s = '¿Qué tal, señor? 😀  ​';
  assert.equal(toResponseRaw(s), s);
});

test('cada control pasa a UN espacio (1 a 1) y el texto vecino queda igual', () => {
  assert.equal(toResponseRaw('a\u0007b\u0085c\td\r\ne'), 'a b c\td\r\ne');
  assert.equal(toResponseRaw('\u0000\u0001\u007f'), '   ');
});

test('recorta al máximo DESPUÉS de limpiar (limpiar es 1 a 1: el largo no cambia)', () => {
  const out = toResponseRaw(`${'\u0001'.repeat(1500)}${'x'.repeat(1500)}`);
  assert.equal(out.length, 2000);
  assert.equal(out, `${' '.repeat(1500)}${'x'.repeat(500)}`);
  assert.equal(validateEvent(asEvent(out)).ok, true);
});

test('el máximo se puede pasar; 0 da cadena vacía; uno inválido usa el del evento', () => {
  assert.equal(toResponseRaw('abcdef', 3), 'abc');
  assert.equal(toResponseRaw('abcdef', 0), '');
  for (const bad of [-1, 1.5, NaN, '5', null, undefined]) assert.equal(toResponseRaw('x'.repeat(2500), bad).length, 2000, String(bad));
  assert.equal(toResponseRaw('x'.repeat(1999)).length, 1999);
  assert.equal(toResponseRaw('x'.repeat(2000)).length, 2000);
  assert.equal(toResponseRaw('x'.repeat(2001)).length, 2000);
});

test('lo que no es texto da cadena vacía (nunca lanza)', () => {
  for (const v of [null, undefined, 5, {}, [], true]) assert.equal(toResponseRaw(v), '', String(v));
  assert.equal(toResponseRaw(''), '');
});

test('la expresión exportada no deja estado entre llamadas (flag g bien usado)', () => {
  assert.ok(EVENT_CONTROL.global);
  for (let i = 0; i < 4; i += 1) assert.equal(toResponseRaw('a\u0007b'), 'a b');
});

test('choice: gradeChoice.typed pasa por toResponseRaw (U+0085 y el recorte a 2000)', () => {
  const it = { type: 'choose_correct', data: { options: ['a\u0085b', 'c'], correct: 0 } };
  assert.equal(gradeChoice(it, 0).typed, 'a b');
});

// Guardia (TRAMPA-32): ningún ejercicio arma su propio responseRaw con otra lista de controles.
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
for (const [file, imp] of [
  ['core/choice.js', "from './responseText.js'"],
  ['ui/exercises/orderBlocks.js', "from '../../core/responseText.js'"],
  ['ui/exercises/phraseCloze.js', "from '../../core/responseText.js'"],
]) {
  test(`guardia: ${file} usa toResponseRaw y no trae su propia lista de controles`, () => {
    const src = read(file);
    assert.ok(src.includes(`import { toResponseRaw } ${imp}`), 'debe importar toResponseRaw');
    assert.ok(src.includes('toResponseRaw('), 'debe llamarla');
    assert.equal(/\\u0000-\\u00(08|1F)/.test(src), false, 'no debe definir su propia expresión de controles');
    assert.equal(/\.slice\(0, 2000\)/.test(src), false, 'no debe recortar a 2000 por su cuenta');
  });
}
