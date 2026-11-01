// @purpose: CA 1–6 de la subparte 2.5 (familia de producción corta) con pantallas, calificación, detector, catálogo y registro de errores reales, sobre los 14 tipos.
// CA 1 variantes y contracciones · CA 2 «casi» marca ortografía · CA 3 vacío no se envía · CA 4 three_forms por forma · CA 5 errores conocidos se detectan y REGISTRAN (hasta la base) · CA 6 teclado móvil sin autocorrección ni mayúscula forzada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createErrorCatalog } from '../core/errorCatalog.js';
import { createErrors } from '../core/errors.js';
import { createEvents } from '../core/events.js';
import { createAnswerCommit } from '../core/answerCommit.js';
import { gradeAnswer } from '../core/gradeAnswer.js';
import { createSrs } from '../core/srsEngine.js';
import { createMemoryDb } from '../core/db.memory.js';
import { createRng } from '../core/rng.js';
import { WORD_TYPES } from '../core/textTypes.js';
import { createExerciseRegistry } from '../ui/exercises/index.js';
import { registerWordTypes, createWordType } from '../ui/exercises/textTypes.js';
import { registerTranslateTypes, createTranslateType } from '../ui/exercises/translateTypes.js';
import { registerFixError, createFixError } from '../ui/exercises/fixError.js';
import { registerTransformTypes, createTransformType } from '../ui/exercises/transformTypes.js';
import { createThreeForms } from '../ui/exercises/threeForms.js';
import { TA_TEXT } from '../ui/exercises/textAnswer.js';
import { TF_TEXT } from '../ui/exercises/threeForms.js';
import { makeEnv } from './_fakeDom.mjs';
import { makeClock } from './_helpers.mjs';

const CATALOG = createErrorCatalog(JSON.parse(fs.readFileSync(new URL('../content/taxonomy/error_codes.json', import.meta.url), 'utf8')));
const FAMILY = [...WORD_TYPES, 'trap_translate', 'translate_bank', 'three_forms', 'fix_error', 'transform', 'keyword_transform', 'join_sentences', 'pronoun_placement'];
const ev = (type, extra = {}) => ({ type, preventDefault() {}, ...extra });
const click = (el) => el.dispatchEvent(ev('click'));
const flush = async () => { for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0)); };

function registry() {
  const reg = createExerciseRegistry({ log: () => {} });
  const o = { catalog: CATALOG };
  registerWordTypes(reg, o); registerTranslateTypes(reg, o); registerFixError(reg, o); registerTransformTypes(reg, o);
  reg.register('three_forms', createThreeForms(o));
  return reg;
}

// El componente de cada tipo, como lo cablea app/main.js (con el catálogo real). El registro del plan (entry + resolveItem) se prueba en tests/exerciseRegistry.test.mjs.
function component(type, o = { catalog: CATALOG }) {
  if (WORD_TYPES.includes(type)) return createWordType(type, o);
  if (type === 'trap_translate' || type === 'translate_bank') return createTranslateType(type, o);
  if (type === 'three_forms') return createThreeForms(o);
  if (type === 'fix_error') return createFixError(o);
  return createTransformType(type, o);
}

function item(type, extra = {}) {
  const base = { id: `x.${type}`, type, prompt_es: 'Texto de prueba.', prompt_en: 'Test sentence.', accept: ['left'], situation: 'En la oficina', topics: ['gram.past_simple'] };
  if (type === 'three_forms') return { ...base, accept: undefined, prompt_es: 'salir', data: { forms: { present: 'leave', past: 'left', participle: 'left' } }, ...extra };
  if (type === 'keyword_transform' || type === 'join_sentences') return { ...base, data: { source: 'It rained. We stayed.', keyword: 'because' }, ...extra };
  return { ...base, ...extra };
}

function mount(type, it, { comp = component(type), ctx = {}, submit } = {}) {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const calls = [];
  const sub = async (a) => { calls.push(a); return submit ? submit(a, calls.length) : { status: 'saved' }; };
  const m = comp.mount(root, it, { doc: env.doc, submit: sub, ...ctx });
  const inputs = root.querySelectorAll('input');
  const btn = (label) => root.querySelectorAll('button').find((b) => b.textContent.trim() === label);
  const type_ = (...vals) => vals.forEach((v, i) => { inputs[i].value = v; inputs[i].dispatchEvent(ev('input')); });
  const send = async (...vals) => { type_(...vals); click(btn(TA_TEXT.check)); await flush(); };
  return { m, root, calls, inputs, btn, send, one: (c) => root.querySelectorAll(c)[0] };
}

test('los 14 tipos de la familia están registrados y se montan con un ítem válido', () => {
  const reg = registry();
  assert.deepEqual([...FAMILY].sort(), FAMILY.filter((t) => reg.has(t)).sort());
  for (const t of FAMILY) {
    const x = mount(t, item(t));
    assert.ok(x.m, `${t} no se montó`);
    assert.ok(x.inputs.length >= 1, t);
  }
});

// ---------- CA 1 ----------
test('CA 1: variantes y contracciones equivalentes se aceptan (por accept y por normalización); mayúsculas y puntuación no cuentan', async () => {
  const cases = [
    ['fill_verb', ["don't", 'do not'], 'do not'], ['fill_verb', ["don't"], 'do not'], ['fill_verb', ['do not'], "don't"],
    ['translate_bank', ["I'm tired."], 'I am tired'], ['translate_bank', ["I've finished."], 'I have finished.'], ['translate_bank', ["He won't go."], 'he will not go'],
    ['translate_bank', ['I can\'t swim.'], 'I cannot swim.'], ['translate_bank', ["It's late.", 'It is late.'], 'It is late.'], ['translate_bank', ["It's late.", 'It is late.'], 'it’s late'],
    ['fix_error', ['She can swim.'], 'she can swim'], ['transform', ["He doesn't know."], 'He does not know.'],
  ];
  for (const [type, accept, typed] of cases) {
    const x = mount(type, item(type, { accept }));
    await x.send(typed);
    assert.equal(x.calls[0].result, 'correct', `${type} «${typed}» frente a ${JSON.stringify(accept)}`);
  }
});

// ---------- CA 2 ----------
test('CA 2: «casi» marca ortografía y crea la tarjeta de deletreo; en translate_word el error en la última letra también es «casi»', async () => {
  for (const [type, accept, typed] of [['fill_verb', ['passed'], 'pased'], ['collocation_fill', ['necessary'], 'neccessary'], ['translate_word', ['career'], 'carrer']]) {
    const flags = [];
    const x = mount(type, item(type, { accept }), { ctx: { cards: { ensureSpell: async (f) => { flags.push(f); return { status: 'created' }; } } } });
    await x.send(typed);
    assert.equal(x.calls[0].result, 'almost', `${type} ${typed}`);
    assert.equal(flags.length, 1, `${type}: tarjeta de deletreo`);
    assert.ok(x.one('.ta__spell'), `${type}: aviso de ortografía`);
    assert.equal(x.calls[0].errors, undefined, 'una errata no es un error de gramática');
  }
  const w = mount('translate_word', item('translate_word', { accept: ['house'] }));
  await w.send('housa');
  assert.equal(w.calls[0].result, 'almost');
});

// ---------- CA 3 ----------
test('CA 3: la respuesta vacía (espacios, NBSP, ancho cero) no se envía en los 14 tipos y avisa', async () => {
  for (const t of FAMILY) {
    for (const blank of ['', '   ', '\u00A0\u00A0', '\u200B', '\t']) {
      const x = mount(t, item(t));
      const vals = x.inputs.map(() => blank);
      await x.send(...vals);
      assert.equal(x.calls.length, 0, `${t} envió «${JSON.stringify(blank)}»`);
      assert.ok(x.one('.ta__msg').textContent.length > 0, `${t} no avisó`);
      assert.ok([TA_TEXT.empty, TF_TEXT.empty].includes(x.one('.ta__msg').textContent), t);
    }
  }
});

// ---------- CA 4 ----------
test('CA 4: three_forms califica por forma: cada faceta se juzga solo por su propia forma', async () => {
  const typed = ['leave', 'leaved', 'leaved']; // presente bien, pasado y participio mal
  const expected = ['correct', 'wrong', 'wrong'];
  for (const facet of [0, 1, 2]) {
    const x = mount('three_forms', item('three_forms'), { ctx: { entry: { facet } } });
    await x.send(...typed);
    assert.equal(x.calls[0].result, expected[facet], `faceta ${facet}`);
  }
  const mixed = mount('three_forms', item('three_forms'), { ctx: { entry: { facet: 2 } } });
  await mixed.send('leaved', 'leaved', 'left');
  assert.equal(mixed.calls[0].result, 'correct', 'el participio acertado no se arrastra por las otras formas');
  const swapped = mount('three_forms', item('three_forms', { data: { forms: { present: 'sing', past: 'sang', participle: 'sung' } } }), { ctx: { entry: { facet: 1 } } });
  await swapped.send('sing', 'sung', 'sung');
  assert.equal(swapped.calls[0].result, 'wrong', 'la forma de otro tiempo cuenta como incorrecta');
});

// ---------- CA 5 (de punta a punta, hasta la base) ----------
test('CA 5: los errores conocidos se detectan y se REGISTRAN en la base con su código, el trozo y la corrección', async () => {
  const srs = createSrs();
  const NOW = new Date('2026-10-31T15:00:00.000Z');
  const real = createMemoryDb(); await real.open();
  const clock = makeClock(NOW.toISOString());
  const events = createEvents({ db: real, clock, rng: createRng(7) });
  const errors = createErrors({ db: real, catalog: CATALOG, clock });
  const { commit } = createAnswerCommit({ db: real, events, errors });
  const TABLE = [
    ['fill_verb', ['left'], 'leaved', 'VRB.IRREG_REGULARIZE', 'leaved'],
    ['fix_error', ['She can swim.'], 'She can to swim.', 'VRB.CAN_TO', 'can to swim'],
    ['fix_error', ["She didn't go home."], "She didn't went home.", 'VRB.DOUBLE_PAST', "didn't went"],
    ['translate_bank', ['I have gone to Cali.'], 'I have went to Cali.', 'TNS.PERF_FORM', 'have went'],
    ['transform', ["I don't know anything."], "I don't know nothing.", 'NEG.DOUBLE', "don't know nothing"],
    ['fix_error', ["I've lived here for two years."], "I'm living here since two years.", 'TNS.SINCE_FOR', 'since two years'],
  ];
  let n = 0;
  for (const [type, accept, typed, code, original] of TABLE) {
    n += 1;
    const itemId = `ca5.${n}`;
    const card = srs.newCard(itemId, 0, NOW, ['gram.past_simple']); await real.put('cards', card);
    let saved = null;
    const x = mount(type, item(type, { id: itemId, accept }), {
      submit: async (answer) => {
        const grade = gradeAnswer({ answer: { ...answer, ms: 4000 }, card, srs, now: NOW, exerciseType: type, baselineMs: 6000, sessionId: `ses_${n}`, mode: 'mech', channel: 'keyboard' });
        saved = await commit({ grade, errors: answer.errors ?? [] });
        return { status: 'saved' };
      },
    });
    await x.send(typed);
    assert.ok(saved, `${type} «${typed}»: no se guardó`);
    assert.equal(saved.errors.length >= 1, true, `${type} «${typed}»: no registró errores`);
    const rec = saved.errors[0].record;
    assert.equal(rec.code, code);
    assert.equal(rec.original, original);
    assert.equal(rec.correction, accept[0]);
    assert.equal(rec.itemId, itemId);
    assert.ok(x.one('.ta__detect') || x.one('.ta__trap'), `${type}: sin pista`);
  }
  const all = await real.query('errors', {});
  assert.equal(all.length, TABLE.length);
  assert.equal(new Set(all.map((e) => e.code)).size, TABLE.length);
});

test('CA 5 (no perder la respuesta): sin catálogo (sin services.errors) se guarda igual, sin errores, y no se rompe', async () => {
  const srs = createSrs();
  const NOW = new Date('2026-10-31T15:00:00.000Z');
  const real = createMemoryDb(); await real.open();
  const events = createEvents({ db: real, clock: makeClock(NOW.toISOString()), rng: createRng(7) });
  const { commit } = createAnswerCommit({ db: real, events, errors: null });
  const card = srs.newCard('ca5.nocat', 0, NOW, ['gram.past_simple']); await real.put('cards', card);
  let saved = null;
  const x = mount('fix_error', item('fix_error', { id: 'ca5.nocat', accept: ['She can swim.'] }), {
    comp: createFixError({ catalog: () => null }),
    submit: async (answer) => {
      saved = await commit({ grade: gradeAnswer({ answer: { ...answer, ms: 4000 }, card, srs, now: NOW, exerciseType: 'fix_error', baselineMs: 6000, sessionId: 's', mode: 'mech', channel: 'keyboard' }), errors: answer.errors ?? [] });
      return { status: 'saved' };
    },
  });
  await x.send('She can to swim.');
  assert.ok(saved && saved.duplicate === false);
  assert.deepEqual(saved.errors, []);
  assert.equal((await real.query('events', {})).length, 1);
});

// ---------- CA 6 ----------
test('CA 6: el teclado móvil no autocorrige ni pone mayúscula forzada en ningún campo de los 14 tipos, y la respuesta va en inglés', () => {
  for (const t of FAMILY) {
    const x = mount(t, item(t));
    assert.ok(x.inputs.length >= 1, t);
    for (const input of x.inputs) {
      assert.equal(input.getAttribute('autocapitalize'), 'off', `${t} autocapitalize`);
      assert.equal(input.getAttribute('autocorrect'), 'off', `${t} autocorrect`);
      assert.equal(input.getAttribute('spellcheck'), 'false', `${t} spellcheck`);
      assert.equal(input.getAttribute('autocomplete'), 'off', `${t} autocomplete`);
      assert.equal(input.getAttribute('lang'), 'en', `${t} lang`);
    }
  }
});
