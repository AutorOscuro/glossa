// @purpose: Recorrido real de los errores de elección (2.3-T2): vista de sesión, servicios y base en memoria; comprueba el registro del error por distractor y que «No sé» no registra nada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createChoice, CH_TEXT } from '../ui/exercises/choice.js';
import { createExerciseRegistry } from '../ui/exercises/index.js';
import { createRng } from '../core/rng.js';
import { mk, openNew, TOPIC } from './_sesionHarness.mjs';

const click = (el) => el.dispatchEvent({ type: 'click', preventDefault() {} });
const CODE_A = 'TNS.SINCE_FOR';
const CODE_B = 'TNS.PP_PS';

const makeItem = (id, extra = {}) => ({
  id, type: 'choose_correct', prompt_es: 'Completa la frase.', prompt_en: 'I ___ here for two years.', situation: 'Presentarse con un vecino',
  data: { options: ['have lived', 'live', 'am living', 'lived'], correct: 0 },
  distractors: [{ text: 'live', code: CODE_A }, { text: 'am living', code: CODE_A }, { text: 'lived', code: CODE_B }],
  topics: [TOPIC],
  ...extra,
});

// `holder.study` se completa tras mk(): el componente lee el catálogo al comprobar, como hará el registro de 2.3-T3.
async function flow({ items, withCatalog = true, wrapStudy } = {}) {
  const table = items ?? { it000: makeItem('it000'), it001: makeItem('it001'), it002: makeItem('it002') };
  const holder = { study: null };
  const exercises = createExerciseRegistry({ resolveItem: (id) => table[id] ?? null, log: () => {} });
  exercises.register('choose_correct', createChoice({ rng: createRng(11), log: () => {}, ...(withCatalog ? { catalog: () => holder.study?.catalog ?? null } : {}) }));
  const t = await mk({ host: exercises, cards: 3, ...(wrapStudy ? { wrapStudy } : {}) });
  holder.study = t.study;
  await openNew(t);
  await t.flush();
  return t;
}

const opt = (t, text) => t.q('.ch__option').find((o) => o.querySelector('.ch__text').textContent === text);
const answers = async (t) => (await t.events()).filter((e) => e.type === 'answer');
const saved = (t) => t.db.query('errors', {});
const answerWith = async (t, text) => { click(opt(t, text)); click(t.btn(CH_TEXT.check)); await t.flush(); };
const next = async (t) => { click(t.foot().querySelectorAll('button')[0]); await t.flush(); };

test('CA 3: un distractor con code deja UN error guardado con el tema, el ítem, la corrección y el contexto', async () => {
  const t = await flow();
  await answerWith(t, 'live');
  const [e] = await answers(t);
  assert.equal(e.result, 'wrong');
  assert.deepEqual(e.errorCodes, [CODE_A]);
  const list = await saved(t);
  assert.equal(list.length, 1);
  const r = list[0];
  assert.equal(r.code, CODE_A);
  assert.equal(r.original, 'live');
  assert.equal(r.correction, 'have lived');
  assert.equal(r.context, 'Presentarse con un vecino');
  assert.deepEqual(r.topics, [TOPIC]);
  assert.equal(r.itemId, e.itemId);
  assert.equal(r.source, 'app');
  assert.equal(r.count, 1);
  assert.equal(r.kind, 'slip');
  assert.equal(r.ts, e.ts, 'el error lleva el mismo instante que el evento');
});

test('la pista se ve en la pantalla de la sesión y «Continuar» sigue funcionando', async () => {
  const t = await flow();
  await answerWith(t, 'live');
  const why = t.q('.ch__why');
  assert.equal(why.length, 1);
  assert.ok(why[0].textContent.startsWith(CH_TEXT.hintLabel));
  assert.ok(why[0].textContent.length > CH_TEXT.hintLabel.length + 10);
  assert.equal(t.foot().getAttribute('hidden'), null);
  await next(t);
  assert.equal(t.q('.ch__why').length, 0, 'el ejercicio siguiente empieza sin pista');
});

test('el mismo error en 3 ítems distintos cuenta como reincidencia del código en el tema (señal E del dominio)', async () => {
  const t = await flow();
  const recurrent = () => t.study.errors.recurrent({ by: 'code', topic: TOPIC, now: t.clock.now() });
  for (let i = 0; i < 2; i += 1) { await answerWith(t, 'live'); await next(t); }
  assert.deepEqual(await recurrent(), [], 'con 2 ocurrencias todavía no reincide (umbral 3 en 14 días)');
  await answerWith(t, 'live');
  assert.equal((await saved(t)).length, 3, 'un registro por ítem');
  const rec = await recurrent();
  assert.equal(rec.length, 1);
  assert.equal(rec[0].code, CODE_A);
  assert.equal(rec[0].inWindow, 3);
});

test('dos distractores con códigos distintos en respuestas distintas: dos registros con su código', async () => {
  const t = await flow();
  await answerWith(t, 'lived');
  await next(t);
  await answerWith(t, 'am living');
  const byCode = (await saved(t)).map((r) => [r.code, r.original]).sort();
  assert.deepEqual(byCode, [[CODE_B, 'lived'], [CODE_A, 'am living']]);
});

test('CA 2: «No sé» guarda dont_know y NO registra ningún error', async () => {
  const t = await flow();
  click(t.btn(CH_TEXT.dontKnow));
  await t.flush();
  const [e] = await answers(t);
  assert.equal(e.result, 'dont_know');
  assert.equal(e.dontKnow, true);
  assert.deepEqual(e.errorCodes, []);
  assert.equal((await saved(t)).length, 0);
  assert.equal(t.q('.ch__why').length, 0);
});

test('un acierto no registra errores ni pinta pista', async () => {
  const t = await flow();
  await answerWith(t, 'have lived');
  assert.equal((await saved(t)).length, 0);
  assert.equal(t.q('.ch__why').length, 0);
});

test('sin la opción catalog del componente el evento lleva el code pero no se registra ningún error (la dependencia del tramo 3)', async () => {
  const t = await flow({ withCatalog: false });
  await answerWith(t, 'live');
  const [e] = await answers(t);
  assert.deepEqual(e.errorCodes, [CODE_A]);
  assert.equal((await saved(t)).length, 0);
  assert.equal(t.q('.ch__why').length, 0);
});

test('un code que no está en el catálogo no impide guardar la respuesta: evento con el code y cero errores', async () => {
  const t = await flow({ items: { it000: makeItem('it000', { distractors: [{ text: 'live', code: 'ZZZ.NO_EXISTE' }] }), it001: makeItem('it001'), it002: makeItem('it002') } });
  await answerWith(t, 'live');
  const [e] = await answers(t);
  assert.equal(e.result, 'wrong');
  assert.deepEqual(e.errorCodes, ['ZZZ.NO_EXISTE']);
  assert.equal((await saved(t)).length, 0);
  assert.equal((await t.db.get('cards', e.cardId)).reps, 1, 'la tarjeta también avanzó');
});

test('adversarial: una opción de 700 caracteres, con caracteres de control y emoji, se guarda recortada y la respuesta no se pierde', async () => {
  const long = `${'x\u0007😀'.repeat(300)}`;
  const items = { it000: makeItem('it000', { data: { options: ['have lived', long, 'am living', 'lived'], correct: 0 }, distractors: [{ text: long, code: CODE_A }] }), it001: makeItem('it001'), it002: makeItem('it002') };
  const t = await flow({ items });
  await answerWith(t, long);
  const [e] = await answers(t);
  assert.equal(e.result, 'wrong');
  const [r] = await saved(t);
  assert.ok(r.original.length <= 500);
  assert.equal(/[\u0000-\u0009\u000B-\u001F]/.test(r.original), false);
  assert.equal(t.q('.ch__why').length, 1);
});

test('adversarial: si el guardado falla, no queda nada a medias (ni evento ni error) y el reintento guarda ambos', async () => {
  let calls = 0;
  // El conductor usa study.commit tal como está en el objeto de servicios: se entrega una copia con un commit que falla la primera vez.
  const wrapStudy = (study) => ({ ...study, commit: async (arg) => { calls += 1; if (calls === 1) throw new Error('base ocupada'); return study.commit(arg); } });
  const t = await flow({ wrapStudy });
  await answerWith(t, 'live');
  assert.equal((await answers(t)).length, 0, 'el primer intento no guardó nada (todo o nada)');
  assert.equal((await saved(t)).length, 0);
  assert.equal(t.q('.ch__why').length, 0, 'tampoco se mostró la pista de algo que no se guardó');
  click(t.btn(CH_TEXT.check));
  await t.flush();
  assert.equal((await answers(t)).length, 1);
  assert.equal((await saved(t)).length, 1);
  assert.equal(t.q('.ch__why').length, 1);
});
