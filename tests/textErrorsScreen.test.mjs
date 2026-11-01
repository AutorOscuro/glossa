// @purpose: Pruebas de pantalla del detector y el registro de errores de la familia de texto (2.5-T5): pista `.ta__detect`, `errors` en el envío, degradación sin catálogo, promoción de «casi» y three_forms.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createErrorCatalog } from '../core/errorCatalog.js';
import { createErrors } from '../core/errors.js';
import { createMemoryDb } from '../core/db.memory.js';
import { createWordType } from '../ui/exercises/textTypes.js';
import { createTranslateType } from '../ui/exercises/translateTypes.js';
import { createFixError } from '../ui/exercises/fixError.js';
import { createTransformType } from '../ui/exercises/transformTypes.js';
import { createThreeForms, TF_TEXT } from '../ui/exercises/threeForms.js';
import { createTextAnswer, TA_TEXT } from '../ui/exercises/textAnswer.js';
import { makeEnv } from './_fakeDom.mjs';
import { makeClock } from './_helpers.mjs';

const CATALOG = createErrorCatalog(JSON.parse(fs.readFileSync(new URL('../content/taxonomy/error_codes.json', import.meta.url), 'utf8')));
const ERRORS = createErrors({ db: createMemoryDb(), catalog: CATALOG, clock: makeClock() });
const ev = (type, extra = {}) => ({ type, preventDefault() {}, ...extra });
const click = (el) => el.dispatchEvent(ev('click'));
const flush = () => new Promise((r) => setTimeout(r, 0));

const FILL = (extra = {}) => ({ id: 'w.left', type: 'fill_verb', prompt_es: 'Ayer salió temprano.', prompt_en: 'Yesterday he ___ early.', accept: ['left'], situation: 'En la oficina', topics: ['gram.past_simple'], ...extra });
const FIX = (extra = {}) => ({ id: 'f.came', type: 'fix_error', prompt_es: 'Corrige el error.', prompt_en: 'They had come late?', accept: ['They had come late.'], situation: 'En el cine', ...extra });
const SING = (extra = {}) => ({ id: 'v.leave', type: 'three_forms', prompt_es: 'salir', situation: 'Verbos', topics: ['gram.irregular_verbs'], data: { forms: { present: 'leave', past: 'left', participle: 'left' } }, ...extra });

function mountWith(make, item, { submit, ctx = {} } = {}) {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const calls = [];
  const sub = async (a) => { calls.push(a); return submit ? submit(a, calls.length) : { status: 'saved' }; };
  const m = make().mount(root, item, { doc: env.doc, submit: sub, ...ctx });
  const btn = (label) => root.querySelectorAll('button').find((b) => b.textContent.trim() === label);
  const inputs = root.querySelectorAll('input');
  const type = (...vals) => vals.forEach((v, i) => { inputs[i].value = v; inputs[i].dispatchEvent(ev('input')); });
  const one = (cls) => root.querySelectorAll(cls)[0];
  const all = (cls) => root.querySelectorAll(cls);
  const send = async (...vals) => { type(...vals); click(btn(TA_TEXT.check)); for (let i = 0; i < 4; i += 1) await flush(); };
  return { env, root, m, calls, btn, inputs, type, one, all, send };
}
const word = (opts, item = FILL(), extra) => mountWith(() => createWordType('fill_verb', opts), item, extra);

test('fill_verb con catálogo: «leaved» → pista del detector, código en errorCodes y entrada válida en `errors`', async () => {
  const { calls, one, send } = word({ catalog: CATALOG });
  await send('leaved');
  assert.equal(calls.length, 1);
  const a = calls[0];
  assert.equal(a.result, 'wrong');
  assert.ok(a.errorCodes.includes('VRB.IRREG_REGULARIZE'));
  assert.equal(a.errors.length, 1);
  assert.deepEqual(a.errors[0], { code: 'VRB.IRREG_REGULARIZE', original: 'leaved', correction: 'left', context: 'En la oficina', topics: ['gram.past_simple'] });
  assert.doesNotThrow(() => ERRORS.prepare({ ...a.errors[0], itemId: 'w.left' }));
  const note = one('.ta__detect');
  assert.ok(note, 'falta la pista del detector');
  assert.equal(note.getAttribute('role'), 'note');
  assert.ok(note.textContent.startsWith(`${TA_TEXT.detectHint} `) && note.textContent.length > TA_TEXT.detectHint.length + 5, note.textContent);
});

test('catálogo como función: se lee al comprobar (los servicios llegan tras el arranque)', async () => {
  let cat = null;
  const { calls, send } = word({ catalog: () => cat });
  await send('eated');
  assert.equal(calls[0].errors, undefined, 'sin catálogo no hay `errors`: el commit rechazaría la respuesta entera');
  assert.equal(calls[0].result, 'wrong');
  cat = CATALOG;
  const second = word({ catalog: () => cat });
  await second.send('eated');
  assert.equal(second.calls[0].errors[0].code, 'VRB.IRREG_REGULARIZE');
});

test('sin catálogo ni detector todo queda como antes: sin pista, sin `errors` y errorCodes de compare', async () => {
  const { calls, one, send } = word({});
  await send('leaved');
  assert.equal(calls[0].errors, undefined);
  assert.equal(one('.ta__detect'), undefined);
  assert.equal(calls[0].errorCodes.includes('VRB.IRREG_REGULARIZE'), false);
});

test('un catálogo a medias (solo has/hint) detecta por reglas, sin pista de catálogo, y aun así registra', async () => {
  const half = { has: (c) => c === 'VRB.IRREG_REGULARIZE', hint: () => 'Es irregular.' };
  const { calls, send } = word({ catalog: half });
  await send('leaved');
  assert.equal(calls[0].errors[0].code, 'VRB.IRREG_REGULARIZE');
});

test('acierto, «no sé» y respuesta mala sin aviso: ni pista ni `errors`', async () => {
  for (const typed of ['left', 'stayed']) {
    const { calls, one, send } = word({ catalog: CATALOG });
    await send(typed);
    assert.equal(calls[0].errors, undefined, typed);
    assert.equal(one('.ta__detect'), undefined, typed);
  }
  const dk = word({ catalog: CATALOG });
  click(dk.btn(TA_TEXT.dontKnow));
  for (let i = 0; i < 4; i += 1) await flush();
  assert.equal(dk.calls[0].dontKnow, true);
  assert.equal(dk.calls[0].errors, undefined);
});

test('una errata de una letra («pased») sigue siendo «casi» y no registra error de gramática', async () => {
  const { calls, one, send } = word({ catalog: CATALOG }, FILL({ accept: ['passed'] }));
  await send('pased');
  assert.equal(calls[0].result, 'almost');
  assert.equal(calls[0].errors, undefined);
  assert.equal(one('.ta__detect'), undefined);
});

test('«had came» frente a «come» NO es una errata: pasa a «mal», registra TNS.PERF_FORM y no crea tarjeta de deletreo', async () => {
  const spelled = [];
  const cards = { ensureSpell: async (f) => { spelled.push(f); return { status: 'created' }; } };
  const { calls, one, send } = mountWith(() => createFixError({ catalog: CATALOG }), FIX(), { ctx: { cards } });
  await send('They had came late.');
  assert.equal(calls[0].result, 'wrong');
  assert.equal(calls[0].errors[0].code, 'TNS.PERF_FORM');
  assert.equal(calls[0].errors[0].original, 'had came');
  assert.equal(spelled.length, 0, 'no debe crear tarjeta de deletreo');
  assert.equal(one('.ta__spell'), undefined);
  assert.ok(one('.ta__detect'));
});

test('la errata de verdad con tarjeta de deletreo sigue igual («writen» → casi + deletreo)', async () => {
  const spelled = [];
  const cards = { ensureSpell: async (f) => { spelled.push(f); return { status: 'created' }; } };
  const { calls, one, send } = mountWith(() => createFixError({ catalog: CATALOG }), FIX({ accept: ['He has written it.'], prompt_en: 'He has wrote it.' }), { ctx: { cards } });
  await send('He has writen it.');
  assert.equal(calls[0].result, 'almost');
  assert.equal(calls[0].errors, undefined);
  assert.equal(spelled.length, 1);
  assert.ok(one('.ta__spell'));
});

test('fix_error: «sin cambios» no registra nada; el error de gramática distinto sí', async () => {
  const same = mountWith(() => createFixError({ catalog: CATALOG }), FIX({ prompt_en: 'She can to swim.', accept: ['She can swim.'] }));
  await same.send('She can to swim.');
  assert.equal(same.calls[0].errors, undefined);
  assert.ok(same.one('.ta__unchanged'));
  const other = mountWith(() => createFixError({ catalog: CATALOG }), FIX({ prompt_en: 'She can to swim.', accept: ['She can swim.'] }));
  await other.send('She can to swim fast.');
  assert.equal(other.calls[0].errors[0].code, 'VRB.CAN_TO');
});

test('transform: el aviso del detector y la entrada coinciden', async () => {
  const item = { id: 't.1', type: 'transform', prompt_es: 'Pasa a negativa.', prompt_en: 'I know something.', accept: ["I don't know anything."], situation: 'Charla' };
  const { calls, one, send } = mountWith(() => createTransformType('transform', { catalog: CATALOG }), item);
  await send("I don't know nothing.");
  assert.equal(calls[0].errors[0].code, 'NEG.DOUBLE');
  assert.ok(one('.ta__detect'));
});

test('trap_translate: la trampa conocida manda (su código, su aviso); el detector no pinta un segundo aviso', async () => {
  const cat = { has: (c) => c === 'LEX.HAVE_AGE' || c === 'VRB.CAN_TO', hint: () => 'La edad usa «be», no «have».' };
  const item = { id: 't.age', type: 'trap_translate', prompt_es: 'Tengo 20 años.', accept: ['I am 20 years old.'], distractors: [{ text: 'I have 20 years.', code: 'LEX.HAVE_AGE' }], situation: 'Charla' };
  const { calls, one, all, send } = mountWith(() => createTranslateType('trap_translate', { catalog: cat }), item);
  await send('I have 20 years.');
  assert.equal(calls[0].errors[0].code, 'LEX.HAVE_AGE');
  assert.equal(calls[0].errors[0].original, 'I have 20 years.');
  assert.ok(one('.ta__trap'));
  assert.equal(all('.ta__detect').length, 0);
});

test('three_forms: la forma de la faceta («leaved» en el pasado) lleva pista y entrada; la faceta acertada no registra', async () => {
  const past = mountWith(() => createThreeForms({ catalog: CATALOG }), SING(), { ctx: { entry: { facet: 1 } } });
  await past.send('leave', 'leaved', 'left');
  assert.equal(past.calls[0].result, 'wrong');
  assert.deepEqual(past.calls[0].errors, [{ code: 'VRB.IRREG_REGULARIZE', original: 'leaved', correction: 'left', context: 'Verbos', topics: ['gram.irregular_verbs'] }]);
  assert.ok(past.calls[0].errorCodes.includes('VRB.IRREG_REGULARIZE'));
  assert.ok(past.one('.ta__detect'));
  const present = mountWith(() => createThreeForms({ catalog: CATALOG }), SING(), { ctx: { entry: { facet: 0 } } });
  await present.send('leave', 'leaved', 'left');
  assert.equal(present.calls[0].result, 'correct');
  assert.equal(present.calls[0].errors, undefined);
  assert.equal(present.one('.ta__detect'), undefined);
});

test('three_forms sin faceta: registra cada forma incorrecta (máximo 5) y sin catálogo no manda `errors`', async () => {
  const all = mountWith(() => createThreeForms({ catalog: CATALOG }), SING());
  await all.send('leave', 'leaved', 'leaved');
  assert.deepEqual(all.calls[0].errors.map((e) => e.original), ['leaved']);
  const none = mountWith(() => createThreeForms({}), SING(), { ctx: { entry: { facet: 1 } } });
  await none.send('leave', 'leaved', 'left');
  assert.equal(none.calls[0].errors, undefined);
  assert.ok(TF_TEXT.detectHint);
});

test('un detector que lanza nunca rompe la respuesta (se envía igual, sin pista)', async () => {
  const logged = [];
  const { calls, one, send } = word({ detect: () => { throw new Error('boom'); }, log: (...a) => logged.push(a) });
  await send('leaved');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].result, 'wrong');
  assert.equal(one('.ta__detect'), undefined);
});

test('createTextAnswer directo: `detect` inyectado pinta la pista aunque no haya catálogo, pero no manda `errors`', async () => {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const calls = [];
  const m = createTextAnswer({ detect: () => [{ code: 'VRB.IRREG_REGULARIZE', text: 'leaved', hint: 'Pista de prueba' }] })
    .mount(root, FILL(), { doc: env.doc, submit: async (a) => { calls.push(a); return { status: 'saved' }; } });
  const input = root.querySelectorAll('input')[0];
  input.value = 'leaved'; input.dispatchEvent(ev('input'));
  click(root.querySelectorAll('button').find((b) => b.textContent.trim() === TA_TEXT.check));
  for (let i = 0; i < 4; i += 1) await flush();
  assert.equal(calls[0].errors, undefined);
  assert.equal(root.querySelectorAll('.ta__detect')[0].textContent, 'Pista: Pista de prueba');
  m.destroy();
});
