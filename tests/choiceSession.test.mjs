// @purpose: Recorrido real del componente de elección (2.3-T1): vista de sesión, registro, servicios de estudio y base en memoria; comprueba el evento y la tarjeta guardados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createChoice, CH_TEXT } from '../ui/exercises/choice.js';
import { createExerciseRegistry } from '../ui/exercises/index.js';
import { createRng } from '../core/rng.js';
import { mk, openNew, TOPIC } from './_sesionHarness.mjs';

const click = (el) => el.dispatchEvent({ type: 'click', preventDefault() {} });
const codes = JSON.parse(fs.readFileSync(new URL('../content/taxonomy/error_codes.json', import.meta.url), 'utf8')).codes;
const [CODE_A, CODE_B] = [codes[0].id, codes[1].id];

const makeItem = (id) => ({
  id, type: 'choose_correct', prompt_es: 'Completa la frase.', prompt_en: 'She ___ to work.',
  data: { options: ['go', 'goes', 'going', 'gone'], correct: 1 },
  distractors: [{ text: 'go', code: CODE_A }, { text: 'going', code: CODE_B }, { text: 'gone', code: CODE_B }],
  topics: [TOPIC],
});
const ITEMS = { it000: makeItem('it000'), it001: makeItem('it001'), it002: makeItem('it002') };

async function realFlow() {
  const exercises = createExerciseRegistry({ resolveItem: (id) => ITEMS[id] ?? null, log: () => {} });
  exercises.register('choose_correct', createChoice({ rng: createRng(11), log: () => {} }));
  const t = await mk({ host: exercises, cards: 3 });
  await openNew(t);
  await t.flush();
  return t;
}

const opt = (t, text) => t.q('.ch__option').find((o) => o.querySelector('.ch__text').textContent === text);
const answers = async (t) => (await t.events()).filter((e) => e.type === 'answer');

test('recorrido real: acierto → un evento answer correcto y la tarjeta avanza', async () => {
  const t = await realFlow();
  assert.equal(t.q('.ch__option').length, 4);
  click(opt(t, 'goes'));
  click(t.btn(CH_TEXT.check));
  await t.flush();
  const list = await answers(t);
  assert.equal(list.length, 1);
  const e = list[0];
  assert.equal(e.result, 'correct');
  assert.equal(e.exerciseType, 'choose_correct');
  assert.equal(e.responseRaw, 'goes');
  assert.deepEqual(e.errorCodes, []);
  assert.equal(e.dontKnow, false);
  assert.equal(e.hint, false);
  const card = await t.db.get('cards', e.cardId);
  assert.equal(card.reps, 1);
  assert.ok(card.state > 0);
  assert.equal(t.foot().getAttribute('hidden'), null, 'aparece «Continuar»');
  assert.ok(t.q('.fb__verdict')[0]);
});

test('recorrido real (CA 3, parte del evento): un distractor con code guarda el code en el evento', async () => {
  const t = await realFlow();
  click(opt(t, 'go'));
  click(t.btn(CH_TEXT.check));
  await t.flush();
  const [e] = await answers(t);
  assert.equal(e.result, 'wrong');
  assert.equal(e.responseRaw, 'go');
  assert.deepEqual(e.errorCodes, [CODE_A]);
  assert.equal((await t.db.get('cards', e.cardId)).lapses, 0, 'una tarjeta nueva que falla aún no es un lapso');
});

test('recorrido real (CA 2): «No sé» guarda dont_know con calificación de fallo y sin texto', async () => {
  const t = await realFlow();
  click(t.btn(CH_TEXT.dontKnow));
  await t.flush();
  const list = await answers(t);
  assert.equal(list.length, 1);
  assert.equal(list[0].result, 'dont_know');
  assert.equal(list[0].dontKnow, true);
  assert.equal(list[0].rating, 1);
  assert.equal(list[0].responseRaw, null);
  assert.deepEqual(list[0].errorCodes, []);
  assert.equal((await t.db.get('cards', list[0].cardId)).reps, 1);
});

test('recorrido real: elegir una opción y luego «No sé» cuenta solo como «No sé»', async () => {
  const t = await realFlow();
  click(opt(t, 'goes'));
  click(t.btn(CH_TEXT.dontKnow));
  await t.flush();
  const list = await answers(t);
  assert.equal(list.length, 1);
  assert.equal(list[0].result, 'dont_know');
  assert.equal(list[0].responseRaw, null);
});

test('recorrido real: una elección vacía no guarda nada (ni evento ni tarjeta cambiada)', async () => {
  const t = await realFlow();
  const before = JSON.stringify((await t.db.query('cards', {})).sort((a, b) => (a.id < b.id ? -1 : 1)));
  click(t.btn(CH_TEXT.check));
  await t.flush();
  assert.equal((await answers(t)).length, 0);
  assert.equal(JSON.stringify((await t.db.query('cards', {})).sort((a, b) => (a.id < b.id ? -1 : 1))), before);
  assert.equal(t.foot().getAttribute('hidden') !== null, true, 'sin «Continuar»');
});

test('recorrido real: doble toque rápido en «Comprobar» guarda una sola respuesta', async () => {
  const t = await realFlow();
  click(opt(t, 'goes'));
  const check = t.btn(CH_TEXT.check);
  click(check);
  click(check);
  click(t.btn(CH_TEXT.dontKnow));
  await t.flush();
  const list = await answers(t);
  assert.equal(list.length, 1);
  assert.equal(list[0].result, 'correct');
  assert.equal((await t.db.get('cards', list[0].cardId)).reps, 1);
});

test('recorrido real: «Continuar» monta el siguiente ejercicio con otro orden posible y la sesión sigue', async () => {
  const t = await realFlow();
  const orderOf = () => t.q('.ch__option').map((o) => o.querySelector('.ch__text').textContent).join();
  const first = orderOf();
  click(opt(t, 'goes'));
  click(t.btn(CH_TEXT.check));
  await t.flush();
  click(t.foot().querySelectorAll('button')[0]);
  await t.flush();
  assert.equal(t.q('.ch__option').length, 4);
  assert.equal(t.q('.fb__verdict').length, 0, 'el ejercicio nuevo empieza limpio');
  assert.ok(t.q('.ch__option').every((o) => o.getAttribute('aria-checked') === 'false'));
  // Dos ejercicios consecutivos con la misma semilla encadenada: el orden no es una constante.
  const seen = new Set([first, orderOf()]);
  click(opt(t, 'goes'));
  click(t.btn(CH_TEXT.check));
  await t.flush();
  click(t.foot().querySelectorAll('button')[0]);
  await t.flush();
  seen.add(orderOf());
  assert.ok(seen.size >= 2, `siempre el mismo orden: ${[...seen]}`);
  assert.equal((await answers(t)).length, 2);
});

test('recorrido real: las tres respuestas de una sesión dejan 3 eventos y 3 tarjetas con una repetición', async () => {
  const t = await realFlow();
  for (const pick of ['goes', 'go', null]) {
    if (pick) { click(opt(t, pick)); click(t.btn(CH_TEXT.check)); } else click(t.btn(CH_TEXT.dontKnow));
    await t.flush();
    const next = t.foot().querySelectorAll('button')[0];
    click(next);
    await t.flush();
  }
  const list = await answers(t);
  assert.deepEqual(list.map((e) => e.result).sort(), ['correct', 'dont_know', 'wrong']);
  const cards = (await t.db.query('cards', {})).filter((c) => c.reps === 1);
  assert.equal(cards.length, 3);
  assert.equal(new Set(list.map((e) => e.cardId)).size, 3, 'cada respuesta fue a una tarjeta distinta');
});
