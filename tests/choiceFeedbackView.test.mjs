// @purpose: Pruebas del componente de elección con catálogo de errores (ui/exercises/choice.js, 2.3-T2) con DOM falso: pista del distractor, envío de errors y casos límite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createChoice, CH_TEXT } from '../ui/exercises/choice.js';
import { createErrorCatalog } from '../core/errorCatalog.js';
import { createRng } from '../core/rng.js';
import { makeEnv } from './_fakeDom.mjs';

const FILE = JSON.parse(fs.readFileSync(new URL('../content/taxonomy/error_codes.json', import.meta.url), 'utf8'));
const CATALOG = createErrorCatalog(FILE);
const PISTA = (id) => FILE.codes.find((c) => c.id === id).pista_corta_es;
const TOPIC = 'gram.present_perfect.for_since';
const click = (el) => el.dispatchEvent({ type: 'click', preventDefault() {} });

const item = (extra = {}) => ({
  id: 'g.pp.0001', type: 'choose_correct', prompt_es: 'Elige la frase correcta.', situation: 'Presentarse con un nuevo vecino', topics: [TOPIC],
  data: { options: ["I've lived here for two years.", 'I live here since two years.', "I'm living here since two years.", 'I lived here for two years ago.'], correct: 0 },
  distractors: [{ text: 'I live here since two years.', code: 'TNS.SINCE_FOR' }, { text: "I'm living here since two years.", code: 'TNS.SINCE_FOR' }, { text: 'I lived here for two years ago.', code: 'TNS.PP_PS' }],
  ...extra,
});

function setup({ it = item(), factory = {}, submit } = {}) {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const calls = [];
  const logs = [];
  const sub = async (a) => { calls.push(a); return submit ? submit(a) : { status: 'saved' }; };
  createChoice({ rng: createRng(5), log: (...a) => logs.push(a), ...factory }).mount(root, it, { doc: env.doc, submit: sub });
  const opt = (t) => root.querySelectorAll('.ch__option').find((o) => o.querySelector('.ch__text').textContent === t);
  const btn = (label) => root.querySelectorAll('button').find((b) => b.textContent.trim() === label);
  const why = () => root.querySelectorAll('.ch__why');
  const answer = async (...texts) => { for (const t of texts) click(opt(t)); click(btn(CH_TEXT.check)); await env.flush(); };
  return { env, root, calls, logs, opt, btn, why, answer };
}

test('con catálogo, un distractor con code: envía errors al conductor y pinta su pista', async () => {
  const s = setup({ factory: { catalog: CATALOG } });
  await s.answer('I live here since two years.');
  assert.equal(s.calls.length, 1);
  const a = s.calls[0];
  assert.equal(a.result, 'wrong');
  assert.deepEqual(a.errorCodes, ['TNS.SINCE_FOR']);
  assert.deepEqual(a.errors, [{ code: 'TNS.SINCE_FOR', original: 'I live here since two years.', correction: "I've lived here for two years.", context: 'Presentarse con un nuevo vecino', topics: [TOPIC] }]);
  assert.equal(s.why().length, 1);
  assert.equal(s.why()[0].textContent, `${CH_TEXT.hintLabel} ${PISTA('TNS.SINCE_FOR')}`);
  assert.equal(s.why()[0].getAttribute('lang'), 'es');
});

test('la pista de cada distractor es la de su code', async () => {
  const s = setup({ factory: { catalog: CATALOG } });
  await s.answer('I lived here for two years ago.');
  assert.ok(s.why()[0].textContent.endsWith(PISTA('TNS.PP_PS')));
  assert.equal(s.calls[0].errors[0].code, 'TNS.PP_PS');
});

test('sin catálogo (comportamiento de 2.3-T1): ni errors ni pista, pero el evento lleva errorCodes', async () => {
  const s = setup();
  await s.answer('I live here since two years.');
  assert.equal('errors' in s.calls[0], false);
  assert.deepEqual(s.calls[0].errorCodes, ['TNS.SINCE_FOR']);
  assert.equal(s.why().length, 0);
  assert.ok(s.root.querySelector('.fb__verdict'), 'la corrección sí se pinta');
});

test('un acierto no envía errors ni pinta pista', async () => {
  const s = setup({ factory: { catalog: CATALOG } });
  await s.answer("I've lived here for two years.");
  assert.equal(s.calls[0].result, 'correct');
  assert.equal('errors' in s.calls[0], false);
  assert.equal(s.why().length, 0);
});

test('«No sé» envía exactamente dont_know, sin errors ni pista', async () => {
  const s = setup({ factory: { catalog: CATALOG } });
  click(s.btn(CH_TEXT.dontKnow));
  await s.env.flush();
  assert.deepEqual(s.calls, [{ result: 'dont_know', dontKnow: true, hint: false }]);
  assert.equal(s.why().length, 0);
  assert.equal(s.root.querySelector('.fb__verdict').textContent, CH_TEXT.dont);
});

test('elegir un distractor y luego «No sé» cuenta solo como «No sé»: no registra el error', async () => {
  const s = setup({ factory: { catalog: CATALOG } });
  click(s.opt('I live here since two years.'));
  click(s.btn(CH_TEXT.dontKnow));
  await s.env.flush();
  assert.equal(s.calls.length, 1);
  assert.equal(s.calls[0].result, 'dont_know');
  assert.equal('errors' in s.calls[0], false);
});

test('un distractor sin code, o con un code que el catálogo no conoce: sin errors ni pista (el evento conserva el code)', async () => {
  const noCode = setup({ factory: { catalog: CATALOG }, it: item({ distractors: [{ text: 'I live here since two years.' }] }) });
  await noCode.answer('I live here since two years.');
  assert.equal('errors' in noCode.calls[0], false);
  assert.equal(noCode.why().length, 0);
  const unknown = setup({ factory: { catalog: CATALOG }, it: item({ distractors: [{ text: 'I live here since two years.', code: 'ZZZ.NO_EXISTE' }] }) });
  await unknown.answer('I live here since two years.');
  assert.equal('errors' in unknown.calls[0], false);
  assert.deepEqual(unknown.calls[0].errorCodes, ['ZZZ.NO_EXISTE']);
  assert.equal(unknown.why().length, 0);
});

test('el catálogo puede ser una función y se lee al COMPROBAR, no al montar (los servicios llegan tras el arranque)', async () => {
  let current = null;
  let reads = 0;
  const s = setup({ factory: { catalog: () => { reads += 1; return current; } } });
  assert.equal(reads, 0, 'montar no lee el catálogo');
  current = CATALOG;
  await s.answer('I live here since two years.');
  assert.equal(reads, 1);
  assert.equal(s.calls[0].errors.length, 1);
  assert.equal(s.why().length, 1);
});

test('una función de catálogo que devuelve null o lanza: se responde igual, sin errors, y el fallo va al log', async () => {
  const nul = setup({ factory: { catalog: () => null } });
  await nul.answer('I live here since two years.');
  assert.equal('errors' in nul.calls[0], false);
  assert.equal(nul.logs.length, 0);
  const boom = setup({ factory: { catalog: () => { throw new Error('servicios caídos'); } } });
  await boom.answer('I live here since two years.');
  assert.equal(boom.calls.length, 1);
  assert.equal(boom.calls[0].result, 'wrong');
  assert.equal('errors' in boom.calls[0], false);
  assert.equal(boom.logs.length, 1);
  assert.ok(boom.root.querySelector('.fb__verdict'), 'la corrección se pinta igual');
});

test('selección múltiple: una pista por opción elegida cuando las pistas difieren', async () => {
  const it = item({ data: { options: ['ok1', 'ok2', 'I live here since two years.', 'I lived here for two years ago.'], correct: [0, 1] } });
  const s = setup({ it, factory: { catalog: CATALOG, multiple: true } });
  await s.answer('ok1', 'I live here since two years.', 'I lived here for two years ago.');
  assert.deepEqual(s.calls[0].errors.map((e) => e.code), ['TNS.SINCE_FOR', 'TNS.PP_PS']);
  assert.equal(s.calls[0].errors[0].correction, 'ok1 | ok2');
  assert.equal(s.why().length, 2);
  const opts = s.why().map((p) => p.querySelector('.ch__why-opt').textContent);
  assert.deepEqual(opts, ['«I live here since two years.»', '«I lived here for two years ago.»']);
  assert.ok(s.why()[0].textContent.endsWith(PISTA('TNS.SINCE_FOR')));
  assert.ok(s.why()[1].textContent.endsWith(PISTA('TNS.PP_PS')));
  assert.equal(s.why()[0].querySelector('.ch__why-opt').getAttribute('lang'), 'en');
});

test('selección múltiple: si varias opciones comparten la misma pista se muestra una sola vez', async () => {
  const it = item({ data: { options: ['ok1', 'ok2', 'I live here since two years.', "I'm living here since two years."], correct: [0, 1] } });
  const s = setup({ it, factory: { catalog: CATALOG, multiple: true } });
  await s.answer('ok1', 'I live here since two years.', "I'm living here since two years.");
  assert.equal(s.calls[0].errors.length, 2, 'son dos errores distintos aunque la pista sea la misma');
  assert.equal(s.why().length, 1);
  assert.equal(s.why()[0].textContent, `${CH_TEXT.hintLabel} ${PISTA('TNS.SINCE_FOR')}`);
});

test('si el conductor devuelve error, no se pinta nada y el reintento vuelve a enviar los errors', async () => {
  let n = 0;
  const s = setup({ factory: { catalog: CATALOG }, submit: () => (++n === 1 ? { status: 'error', message: 'No se pudo guardar.' } : { status: 'saved' }) });
  await s.answer('I live here since two years.');
  assert.equal(s.why().length, 0);
  assert.equal(s.root.querySelector('.fb__verdict'), null);
  click(s.btn(CH_TEXT.check));
  await s.env.flush();
  assert.equal(s.calls.length, 2);
  assert.deepEqual(s.calls[1].errors, s.calls[0].errors);
  assert.equal(s.why().length, 1);
});

test('si el conductor ignora la respuesta (otra pantalla, doble toque) tampoco se pinta la pista', async () => {
  const s = setup({ factory: { catalog: CATALOG }, submit: () => ({ status: 'ignored', reason: 'stale' }) });
  await s.answer('I live here since two years.');
  assert.equal(s.why().length, 0);
});

test('la pista entra como TEXTO: un catálogo con HTML en la pista no crea elementos', async () => {
  const evil = { has: () => true, hint: () => '<img src=x onerror=alert(1)><b>mal</b>' };
  const s = setup({ factory: { catalog: evil } });
  await s.answer('I live here since two years.');
  assert.ok(s.why()[0].textContent.includes('<img src=x onerror=alert(1)><b>mal</b>'));
  assert.equal(s.root.querySelectorAll('img').length, 0);
  assert.equal(s.root.querySelectorAll('b').length, 0);
  assert.equal(s.why()[0].querySelectorAll('strong').length, 1, 'solo la etiqueta «Pista:»');
});

test('un code sin pista en el catálogo: se registra el error pero no se pinta una pista vacía', async () => {
  const mute = { has: () => true, hint: () => null };
  const s = setup({ factory: { catalog: mute } });
  await s.answer('I live here since two years.');
  assert.equal(s.calls[0].errors.length, 1);
  assert.equal(s.why().length, 0);
});

test('la opción catalog se valida al crear el componente', () => {
  for (const bad of ['catalogo', 5, true, [], {}, { has() {} }, { hint() {} }]) assert.throws(() => createChoice({ catalog: bad }), /catalog debe ser un catálogo de errores/);
  for (const ok of [undefined, null, CATALOG, () => CATALOG]) assert.doesNotThrow(() => createChoice({ catalog: ok }));
});

test('una pista muy larga se pinta completa (no se recorta)', async () => {
  const long = `${'palabra '.repeat(80)}fin`;
  const odd = { has: () => true, hint: () => long };
  const s = setup({ factory: { catalog: odd } });
  await s.answer('I live here since two years.');
  assert.equal(s.why()[0].textContent, `${CH_TEXT.hintLabel} ${long}`);
});
