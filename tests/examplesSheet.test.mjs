// @purpose: Pruebas de la hoja «Otros ejemplos» (ui/examplesSheet.js, 2.7-T1): carga en cada apertura, lista con traducción, aviso honesto si hay menos de 3, fallo amable y limpieza.
// 2.7-T1 con DOM falso. CA 1 de 2.7: la hoja no toca el ejercicio; aquí se prueba que cerrar antes de que llegue la carga no pinta nada tarde.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv } from './_fakeDom.mjs';
import { createExamplesSheet, EX_TEXT } from '../ui/examplesSheet.js';

const realDocument = globalThis.document;
afterEach(() => { globalThis.document = realDocument; });
const ex = (en, es = null) => ({ en, es, kind: 'item' });
const ok = (examples, enough = examples.length >= 3) => ({ examples, count: examples.length, enough });
function setup(load, extra = {}) {
  const env = makeEnv(); globalThis.document = env.doc;
  const logs = []; const events = [];
  const s = createExamplesSheet({ doc: env.doc, load, log: (...a) => logs.push(a), onOpen: () => events.push('open'), onClose: (r) => events.push(`close:${r}`), ...extra });
  const text = () => env.doc.body.querySelectorAll('.examples')[0]?.textContent ?? '';
  const all = () => env.doc.body.querySelectorAll('.examples__en').map((n) => n.textContent);
  return { env, s, logs, events, text, all };
}

test('pinta «Buscando…» al abrir y después la lista en inglés con su traducción', async () => {
  let release; const gate = new Promise((r) => { release = r; });
  const t = setup(async () => { await gate; return ok([ex('I have lived here for two years.', 'Vivo aquí desde hace dos años.'), ex('She has known him since 2019.'), ex('We have studied since March.')]); });
  const opening = t.s.open();
  assert.equal(t.s.isOpen(), true);
  assert.match(t.text(), /Buscando ejemplos/);
  release(); await opening; await t.env.flush();
  assert.equal(t.all().length, 3);
  assert.equal(t.env.doc.body.querySelectorAll('.examples__es').length, 1, 'solo la frase con traducción lleva línea en español');
  assert.equal(t.env.doc.body.querySelectorAll('.examples__en')[0].getAttribute('lang'), 'en');
  assert.doesNotMatch(t.text(), /solo hay/);
});

test('con menos de 3 lo cuenta con honestidad: 1 y N en singular y plural', async () => {
  const one = setup(async () => ok([ex('She has known him since 2019.')]));
  await one.s.open(); await one.env.flush();
  assert.match(one.text(), new RegExp(EX_TEXT.fewOne.slice(0, 20)));
  const two = setup(async () => ok([ex('She has known him since 2019.'), ex('We have studied since March.')]));
  await two.s.open(); await two.env.flush();
  assert.match(two.text(), /solo hay 2 ejemplos/);
});

test('sin ejemplos: mensaje de «todavía no hay», sin lista', async () => {
  const t = setup(async () => ok([]));
  await t.s.open(); await t.env.flush();
  assert.match(t.text(), /Todavía no hay ejemplos/);
  assert.equal(t.all().length, 0);
});

test('si load falla: aviso amable sin culpa, el motivo va al log y la hoja sigue abierta', async () => {
  const t = setup(async () => { throw new Error('sin red'); });
  await t.s.open(); await t.env.flush();
  assert.match(t.text(), /No pude buscar ejemplos/);
  assert.match(t.text(), /Tu ejercicio sigue como lo dejaste/);
  assert.equal(t.logs.length, 1);
  assert.equal(t.s.isOpen(), true);
});

test('carga en CADA apertura y un segundo open() con la hoja abierta no hace nada', async () => {
  let calls = 0;
  const t = setup(async () => { calls += 1; return ok([ex('a b c d'), ex('e f g h'), ex('i j k l')]); });
  await t.s.open(); await t.env.flush();
  assert.equal(await t.s.open(), false);
  assert.equal(calls, 1);
  t.s.close(); await t.env.flush();
  await t.s.open(); await t.env.flush();
  assert.equal(calls, 2);
});

test('si se cierra antes de que llegue la carga, el resultado tardío se ignora', async () => {
  let release; const gate = new Promise((r) => { release = r; });
  const t = setup(async () => { await gate; return ok([ex('late one two'), ex('late three four'), ex('late five six')]); });
  const opening = t.s.open();
  t.s.close(); await t.env.flush();
  release(); await opening; await t.env.flush();
  assert.equal(t.all().length, 0);
});

test('onOpen/onClose avisan (la vista pausa el cronómetro con ellos) y destroy limpia y es idempotente', async () => {
  const t = setup(async () => ok([]));
  await t.s.open(); t.s.close(); await t.env.flush();
  assert.equal(t.events[0], 'open');
  assert.match(t.events[1], /^close:/);
  t.s.destroy(); t.s.destroy();
  assert.equal(await t.s.open(), false);
  assert.equal(t.env.doc.body.querySelectorAll('.examples').length, 0);
});

test('datos rotos en el resultado no lanzan: se ignoran las entradas sin inglés', async () => {
  const t = setup(async () => ({ examples: [null, { en: 5 }, ex('Good clean sentence here')], enough: false }));
  await t.s.open(); await t.env.flush();
  assert.equal(t.all().length, 1);
  const bad = setup(async () => null);
  await bad.s.open(); await bad.env.flush();
  assert.match(bad.text(), /Todavía no hay ejemplos/);
});

test('exige una función load', () => {
  assert.throws(() => createExamplesSheet({}), TypeError);
});
