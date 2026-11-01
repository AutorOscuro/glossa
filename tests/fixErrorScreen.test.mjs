// @purpose: Pruebas de la pantalla de fix_error (2.5-T4 punto 2): oración con error, campo vacío, «sin cambios», trampa, pista del detector, envío único y registro real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFixError, registerFixError, FX_TEXT } from '../ui/exercises/fixError.js';
import { createExerciseRegistry } from '../ui/exercises/index.js';
import { TA_TEXT } from '../ui/exercises/textAnswer.js';
import { makeEnv } from './_fakeDom.mjs';

const ev = (type, extra = {}) => ({ type, preventDefault() {}, ...extra });
const click = (el) => el.dispatchEvent(ev('click'));
const none = (root, ...classes) => classes.every((c) => root.querySelectorAll(c).length === 0);
const flush = () => new Promise((r) => setTimeout(r, 0));

const ITEM = (extra = {}) => ({
  id: 'f.canto', type: 'fix_error', prompt_es: 'Corrige el error en la oración.', prompt_en: 'She can to swim.',
  accept: ['She can swim.'],
  distractors: [{ text: 'She cans swim.', code: 'GRM.CAN_S' }],
  error_codes: ['GRM.CAN_TO'], explain_es: 'Después de «can» va el verbo solo.', ...extra,
});
const DETECT = (t) => (/can to/i.test(t) ? [{ code: 'GRM.CAN_TO', hint: 'Parece que usaste «can to»: después de can va el verbo solo.' }] : []);
const CATALOG = { has: (c) => c === 'GRM.CAN_S', hint: () => 'En «can» no se añade -s.', get: () => null };

function setup(item = ITEM(), { submit, catalog, detect = DETECT, log, ctx = {} } = {}) {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const calls = [];
  const sub = async (a) => { calls.push(a); return submit ? submit(a, calls.length) : { status: 'saved' }; };
  const m = createFixError({ catalog, detect, log }).mount(root, item, { doc: env.doc, submit: sub, ...ctx });
  const btn = (label) => root.querySelectorAll('button').find((b) => b.textContent.trim() === label);
  const input = root.querySelectorAll('input')[0];
  const typeText = (v) => { input.value = v; input.dispatchEvent(ev('input')); };
  const one = (cls) => root.querySelectorAll(cls)[0];
  const send = async (v) => { typeText(v); click(btn(TA_TEXT.check)); await flush(); };
  return { env, root, m, calls, btn, input, typeText, one, send };
}

test('enunciado: instrucción en español, oración con error en inglés y campo en inglés', () => {
  const { one, input } = setup();
  assert.equal(one('.ta__instruction').textContent, 'Corrige el error en la oración.');
  assert.equal(one('.ta__prompt').textContent, 'She can to swim.');
  assert.equal(one('.ta__prompt').getAttribute('lang'), 'en');
  assert.equal(input.getAttribute('lang'), 'en');
});

test('el campo arranca VACÍO: la oración con error no se copia en el campo', () => {
  const { input } = setup();
  assert.equal(input.value, '');
});

test('sin prompt_es usa la instrucción por defecto; el tipo del envoltorio manda sobre el del ítem', () => {
  const { one, root } = setup(ITEM({ prompt_es: undefined, type: 'fill_verb' }));
  assert.equal(one('.ta__instruction').textContent, 'Corrige el error en la oración.');
  assert.equal(root.querySelectorAll('article')[0].dataset.type, 'fix_error');
});

test('un ítem sin accept lanza TypeError; el envoltorio es congelado', () => {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  const c = createFixError({});
  assert.ok(Object.isFrozen(c));
  assert.throws(() => c.mount(root, ITEM({ accept: undefined }), { doc: env.doc }), TypeError);
});

test('acierto: Bien, un solo envío con correct y sin avisos', async () => {
  const { send, calls, one, root } = setup();
  await send('She can swim.');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].result, 'correct');
  assert.equal(one('.fb__verdict').textContent, TA_TEXT.correct);
  assert.ok(none(root, '.ta__unchanged', '.ta__trap', '.ta__detect'));
});

test('sin cambios: Todavía no, aviso en texto y los error_codes del ítem viajan', async () => {
  const { send, calls, one, root } = setup();
  await send('She can to swim.');
  assert.equal(calls[0].result, 'wrong');
  assert.ok(calls[0].errorCodes.includes('GRM.CAN_TO'));
  assert.equal(one('.ta__unchanged').textContent, FX_TEXT.unchanged);
  assert.equal(one('.ta__unchanged').getAttribute('role'), 'note');
  assert.equal(root.querySelectorAll('.ta__detect').length, 0);
});

test('trampa conocida: aviso con la pista del catálogo y su código', async () => {
  const { send, calls, one } = setup(ITEM(), { catalog: CATALOG });
  await send('She cans swim.');
  assert.equal(calls[0].result, 'wrong');
  assert.ok(calls[0].errorCodes.includes('GRM.CAN_S'));
  assert.match(one('.ta__trap').textContent, /Ese es un error típico: escribiste «She cans swim\.»/);
  assert.match(one('.ta__trap').textContent, /En «can» no se añade -s\./);
});

test('trampa sin catálogo: aviso genérico', async () => {
  const { send, one } = setup(ITEM());
  await send('She cans swim.');
  assert.match(one('.ta__trap').textContent, new RegExp(FX_TEXT.trapGeneric));
});

test('pista del detector: otra corrección mala que repite «can to» muestra la pista y su código', async () => {
  const { send, calls, one, root } = setup(ITEM({ distractors: [] }));
  await send('He can to run.');
  assert.equal(calls[0].result, 'wrong');
  assert.match(one('.ta__detect').textContent, /Pista: Parece que usaste «can to»/);
  assert.ok(calls[0].errorCodes.includes('GRM.CAN_TO'));
  assert.ok(none(root, '.ta__trap', '.ta__unchanged'));
});

test('si el detector lanza, la calificación sigue y se avisa a log', async () => {
  const logs = [];
  const { send, calls, root } = setup(ITEM({ distractors: [] }), { detect: () => { throw new Error('boom'); }, log: (...a) => logs.push(a) });
  await send('He can to run.');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].result, 'wrong');
  assert.equal(root.querySelectorAll('.ta__detect').length, 0);
  assert.ok(logs.length >= 1);
});

test('sin detector inyectado y sin catálogo usa las reglas puras y no rompe', async () => {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const calls = [];
  createFixError({}).mount(root, ITEM({ distractors: [] }), { doc: env.doc, submit: async (a) => { calls.push(a); return { status: 'saved' }; } });
  const input = root.querySelectorAll('input')[0];
  input.value = 'He can to run.'; input.dispatchEvent(ev('input'));
  click(root.querySelectorAll('button').find((b) => b.textContent.trim() === TA_TEXT.check));
  await flush();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].result, 'wrong');
});

test('vacío no se envía; «No sé» envía dont_know; un solo envío', async () => {
  const { typeText, btn, calls, root, send } = setup();
  typeText('   ');
  click(btn(TA_TEXT.check));
  await flush();
  assert.equal(calls.length, 0);
  assert.equal(root.querySelectorAll('.ta__msg')[0].textContent, TA_TEXT.empty);
  click(btn(TA_TEXT.dontKnow));
  await flush();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].result, 'dont_know');
  await send('She can swim.');
  assert.equal(calls.length, 1);
});

test('destroy es idempotente y getResponse devuelve lo escrito', async () => {
  const { m, send } = setup();
  await send('She can swim.');
  assert.equal(m.getResponse(), 'She can swim.');
  m.destroy();
  assert.doesNotThrow(() => m.destroy());
});

test('registro real: registerFixError monta el tipo; sin registro o repetido lanza', () => {
  assert.throws(() => registerFixError(null), /registerFixError: falta el registro/);
  const reg = createExerciseRegistry();
  assert.deepEqual(registerFixError(reg, {}), ['fix_error']);
  assert.throws(() => registerFixError(reg, {}));
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const out = reg.mount(root, ITEM(), { doc: env.doc, submit: async () => ({ status: 'saved' }) });
  assert.ok(out);
});
