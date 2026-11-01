// @purpose: Pruebas de la pantalla de transform y keyword_transform (2.5-T4 punto 4): enunciado, palabra clave en texto, campo vacío, avisos, envío único y registro real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTransformType, registerTransformTypes, TT_TEXT } from '../ui/exercises/transformTypes.js';
import { createExerciseRegistry } from '../ui/exercises/index.js';
import { TA_TEXT } from '../ui/exercises/textAnswer.js';
import { makeEnv } from './_fakeDom.mjs';

const ev = (type, extra = {}) => ({ type, preventDefault() {}, ...extra });
const click = (el) => el.dispatchEvent(ev('click'));
const flush = () => new Promise((r) => setTimeout(r, 0));
const none = (root, ...classes) => classes.every((c) => root.querySelectorAll(c).length === 0);

const ITEM = (extra = {}) => ({
  id: 't.tall', type: 'keyword_transform', prompt_es: 'Usa la palabra clave.',
  accept: ['She is taller than me.'],
  distractors: [{ text: 'She is more tall than me.', code: 'CMP.MORE_TALL' }], error_codes: ['CMP.AS'],
  data: { source: 'I am not as tall as her.', instruction_es: 'Reescribe con «taller».', keyword: 'taller' }, ...extra,
});
const DETECT = (t) => (/can to/i.test(t) ? [{ code: 'GRM.CAN_TO', hint: 'Parece que usaste «can to».' }] : []);
const CATALOG = { has: (c) => c === 'CMP.MORE_TALL', get: () => null, hint: () => 'Con adjetivos cortos se añade -er.' };

function setup(type = 'keyword_transform', item = ITEM(), { submit, catalog, detect = DETECT, log, ctx = {} } = {}) {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const calls = [];
  const sub = async (a) => { calls.push(a); return submit ? submit(a, calls.length) : { status: 'saved' }; };
  const m = createTransformType(type, { catalog, detect, log }).mount(root, item, { doc: env.doc, submit: sub, ...ctx });
  const btn = (label) => root.querySelectorAll('button').find((b) => b.textContent.trim() === label);
  const input = root.querySelectorAll('input')[0];
  const typeText = (v) => { input.value = v; input.dispatchEvent(ev('input')); };
  const one = (cls) => root.querySelectorAll(cls)[0];
  const send = async (v) => { typeText(v); click(btn(TA_TEXT.check)); await flush(); };
  return { env, root, m, calls, btn, input, typeText, one, send };
}

test('createTransformType: un tipo ajeno lanza en español; los cuatro valen y son congelados', () => {
  for (const bad of [undefined, null, 5, '', 'fix_error', 'register_shift', '__proto__']) {
    assert.throws(() => createTransformType(bad), /createTransformType: tipo desconocido/, String(bad));
  }
  for (const t of ['transform', 'keyword_transform', 'join_sentences', 'pronoun_placement']) assert.ok(Object.isFrozen(createTransformType(t)));
});

test('enunciado: instrucción, oración base en inglés, etiqueta de palabra clave en texto y campo en inglés', () => {
  const { one, input } = setup();
  assert.equal(one('.ta__instruction').textContent, 'Reescribe con «taller».');
  assert.equal(one('.ta__prompt').textContent, 'I am not as tall as her.');
  assert.equal(one('.ta__prompt').getAttribute('lang'), 'en');
  assert.equal(one('.ta__keyword').textContent, `${TT_TEXT.keywordLabel} taller`);
  assert.equal(input.getAttribute('lang'), 'en');
});

test('el campo arranca VACÍO: la oración base no se copia en el campo', () => {
  assert.equal(setup().input.value, '');
});

test('transform no pinta palabra clave aunque el ítem la traiga; keyword_transform sin clave tampoco', () => {
  assert.ok(none(setup('transform').root, '.ta__keyword'));
  assert.ok(none(setup('keyword_transform', ITEM({ data: { source: 'I go.', instruction_es: null, keyword: null } })).root, '.ta__keyword'));
});

test('instrucción por defecto por tipo y el tipo del envoltorio manda sobre el del ítem', () => {
  const d = { data: { source: 'I go.', instruction_es: null, keyword: null } };
  assert.equal(setup('transform', ITEM({ ...d, prompt_es: undefined, type: 'fix_error' })).one('.ta__instruction').textContent, 'Reescribe la oración como se pide.');
  const k = setup('keyword_transform', ITEM({ ...d, prompt_es: undefined }));
  assert.equal(k.one('.ta__instruction').textContent, 'Reescribe la oración con la palabra clave, sin cambiarla.');
  assert.equal(setup('transform', ITEM({ type: 'keyword_transform' })).root.querySelectorAll('article')[0].dataset.type, 'transform');
});

test('un ítem sin accept lanza TypeError', () => {
  const env = makeEnv();
  assert.throws(() => createTransformType('transform').mount(env.doc.createElement('div'), ITEM({ accept: undefined }), { doc: env.doc }), TypeError);
});

test('acierto: Bien, un solo envío con correct y sin avisos', async () => {
  const { send, calls, one, root } = setup();
  await send('She is taller than me.');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].result, 'correct');
  assert.equal(one('.fb__verdict').textContent, TA_TEXT.correct);
  assert.ok(none(root, '.ta__unchanged', '.ta__trap', '.ta__kwmissing', '.ta__detect'));
});

test('sin cambios: aviso solo, con los error_codes del ítem', async () => {
  const { send, calls, one, root } = setup();
  await send('I am not as tall as her.');
  assert.equal(calls[0].result, 'wrong');
  assert.ok(calls[0].errorCodes.includes('CMP.AS'));
  assert.equal(one('.ta__unchanged').textContent, TT_TEXT.unchanged);
  assert.equal(one('.ta__unchanged').getAttribute('role'), 'note');
  assert.ok(none(root, '.ta__kwmissing', '.ta__trap', '.ta__detect'));
});

test('palabra clave ausente: aviso en texto con la clave; el resultado sigue siendo wrong', async () => {
  const { send, calls, one } = setup();
  await send('She is bigger than me.');
  assert.equal(calls[0].result, 'wrong');
  assert.match(one('.ta__kwmissing').textContent, /Tu respuesta no usa la palabra clave\. Úsala tal cual, sin cambiarla: «taller»\./);
  assert.equal(one('.ta__kwmissing').getAttribute('role'), 'note');
});

test('con la clave puesta pero mal armada no sale el aviso de la clave', async () => {
  const { send, root } = setup(undefined, ITEM({ distractors: [] }));
  await send('She is taller as me.');
  assert.ok(none(root, '.ta__kwmissing'));
});

test('trampa conocida: aviso con la pista del catálogo y su código; sale junto al de la clave si falta', async () => {
  const { send, calls, one, root } = setup('keyword_transform', ITEM(), { catalog: CATALOG });
  await send('She is more tall than me.');
  assert.ok(calls[0].errorCodes.includes('CMP.MORE_TALL'));
  assert.match(one('.ta__trap').textContent, /Ese es un error típico: escribiste «She is more tall than me\.»/);
  assert.match(one('.ta__trap').textContent, /Con adjetivos cortos se añade -er\./);
  assert.equal(root.querySelectorAll('.ta__kwmissing').length, 1);
  assert.ok(none(root, '.ta__detect'));
});

test('trampa sin catálogo: aviso genérico', async () => {
  const { send, one } = setup();
  await send('She is more tall than me.');
  assert.match(one('.ta__trap').textContent, new RegExp(TT_TEXT.trapGeneric));
});

test('pista del detector: sale si no hay trampa, junto al aviso de la clave si falta', async () => {
  const { send, calls, one, root } = setup('keyword_transform', ITEM({ distractors: [] }));
  await send('She can to run.');
  assert.match(one('.ta__detect').textContent, /Pista: Parece que usaste «can to»\./);
  assert.ok(calls[0].errorCodes.includes('GRM.CAN_TO'));
  assert.equal(root.querySelectorAll('.ta__kwmissing').length, 1);
});

test('en transform no hay aviso de clave y la pista del detector sí sale', async () => {
  const { send, root, one } = setup('transform', ITEM({ distractors: [] }));
  await send('She can to run.');
  assert.ok(none(root, '.ta__kwmissing'));
  assert.equal(root.querySelectorAll('.ta__detect').length, 1);
  assert.ok(one('.ta__detect'));
});

test('si el detector lanza, la calificación sigue y se avisa a log', async () => {
  const logs = [];
  const { send, calls, root } = setup('keyword_transform', ITEM({ distractors: [] }), { detect: () => { throw new Error('boom'); }, log: (...a) => logs.push(a) });
  await send('She can to run.');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].result, 'wrong');
  assert.ok(none(root, '.ta__detect'));
  assert.ok(logs.length >= 1);
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
  await send('She is taller than me.');
  assert.equal(calls.length, 1);
});

test('destroy es idempotente y getResponse devuelve lo escrito', async () => {
  const { m, send } = setup();
  await send('She is taller than me.');
  assert.equal(m.getResponse(), 'She is taller than me.');
  m.destroy();
  assert.doesNotThrow(() => m.destroy());
});

test('registro real: registerTransformTypes monta los cuatro tipos; sin registro o repetido lanza', () => {
  assert.throws(() => registerTransformTypes(null), /registerTransformTypes: falta el registro/);
  const reg = createExerciseRegistry();
  assert.deepEqual(registerTransformTypes(reg, {}), ['transform', 'keyword_transform', 'join_sentences', 'pronoun_placement']);
  assert.throws(() => registerTransformTypes(reg, {}));
  for (const type of ['transform', 'keyword_transform', 'join_sentences', 'pronoun_placement']) {
    const env = makeEnv();
    const root = env.doc.createElement('div');
    env.doc.body.appendChild(root);
    assert.ok(reg.mount(root, ITEM({ type }), { doc: env.doc, submit: async () => ({ status: 'saved' }) }));
  }
});

const JOIN = (extra = {}) => ({
  id: 'g.join.0001', type: 'join_sentences', prompt_es: 'Une las oraciones.', accept: ['I stayed home because it was raining.'],
  distractors: [], error_codes: ['GRM.MISSING_SUBJ'], data: { source: 'It was raining. I stayed home.', instruction_es: null, keyword: 'because' }, ...extra,
});
const PRON = (extra = {}) => ({
  id: 'v.pron.0001', type: 'pronoun_placement', prompt_es: 'Cambia el objeto por un pronombre.', prompt_en: 'Pick up the box.',
  accept: ['Pick it up.'], distractors: [{ text: 'Pick up it.', code: 'PHR.PRON_AFTER' }], error_codes: ['PHR.PRON_AFTER'], data: {}, ...extra,
});

test('join_sentences: las oraciones a unir en inglés, etiqueta «Conector:» en texto y campo vacío', () => {
  const { one, input } = setup('join_sentences', JOIN());
  assert.equal(one('.ta__instruction').textContent, 'Une las oraciones.');
  assert.equal(one('.ta__prompt').textContent, 'It was raining. I stayed home.');
  assert.equal(one('.ta__keyword').textContent, `${TT_TEXT.connectorLabel} because`);
  assert.equal(input.value, '');
});

test('join_sentences: sin el conector sale el aviso del CONECTOR (no el de la palabra clave)', async () => {
  const { send, calls, one, root } = setup('join_sentences', JOIN());
  await send('I stayed home and it was raining.');
  assert.equal(calls[0].result, 'wrong');
  assert.match(one('.ta__kwmissing').textContent, /Tu respuesta no usa el conector\. Úsalo tal cual, sin cambiarlo: «because»\./);
  assert.ok(!/palabra clave/.test(one('.ta__kwmissing').textContent));
  const ok = setup('join_sentences', JOIN());
  await ok.send('I stayed home because it was raining.');
  assert.equal(ok.calls[0].result, 'correct');
  assert.ok(none(ok.root, '.ta__kwmissing'));
  assert.ok(root);
});

test('join_sentences sin conector no pinta etiqueta', () => {
  assert.ok(none(setup('join_sentences', JOIN({ data: { source: 'a. b.', instruction_es: null, keyword: null } })).root, '.ta__keyword'));
});

test('pronoun_placement: la oración sale de prompt_en, no hay etiqueta ni aviso de clave y el campo está vacío', async () => {
  const { one, input, root, send, calls } = setup('pronoun_placement', PRON(), { catalog: { has: (c) => c === 'PHR.PRON_AFTER', get: () => null, hint: () => 'El pronombre va entre el verbo y la partícula.' } });
  assert.equal(one('.ta__instruction').textContent, 'Cambia el objeto por un pronombre.');
  assert.equal(one('.ta__prompt').textContent, 'Pick up the box.');
  assert.equal(input.value, '');
  assert.ok(none(root, '.ta__keyword'));
  await send('Pick up it.');
  assert.equal(calls[0].result, 'wrong');
  assert.ok(calls[0].errorCodes.includes('PHR.PRON_AFTER'));
  assert.match(one('.ta__trap').textContent, /escribiste «Pick up it\.»/);
  assert.match(one('.ta__trap').textContent, /El pronombre va entre el verbo y la partícula\./);
  assert.ok(none(root, '.ta__kwmissing'));
});

test('pronoun_placement: acierta con «Pick it up» y dejar la oración es «sin cambios»', async () => {
  const a = setup('pronoun_placement', PRON());
  await a.send('Pick it up.');
  assert.equal(a.calls[0].result, 'correct');
  const b = setup('pronoun_placement', PRON());
  await b.send('Pick up the box.');
  assert.equal(b.calls[0].result, 'wrong');
  assert.equal(b.one('.ta__unchanged').textContent, TT_TEXT.unchanged);
});
