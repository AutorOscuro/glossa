// @purpose: Pruebas de los envoltorios de la familia de elección (ui/exercises/choiceTypes.js, 2.3-T3 parte 1): los 9 tipos, sus opciones y el registro.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHOICE_TYPES, registerChoiceTypes } from '../ui/exercises/choiceTypes.js';
import { createExerciseRegistry } from '../ui/exercises/index.js';
import { CH_TEXT } from '../ui/exercises/choice.js';
import { createRng } from '../core/rng.js';
import { makeEnv } from './_fakeDom.mjs';

const NINE = ['choose_correct', 'ab_natural', 'mcq_en_es', 'mcq_es_en', 'pick_fits', 'odd_one_out', 'choose_tense', 'prep_pick', 'particle_pick'];
const click = (el) => el.dispatchEvent({ type: 'click', preventDefault() {} });
const item = (type, extra = {}) => ({
  id: `x.${type}.0001`, type, prompt_es: 'Elige.', data: { options: ['alfa', 'beta', 'gamma'], correct: 1 },
  distractors: [{ text: 'alfa', code: 'GRM.A' }], ...extra,
});

// Registro espía: guarda cada componente por tipo para montarlo sin pasar por la vista de sesión.
function spyRegistry() {
  const table = new Map();
  return { table, register: (type, component) => { if (table.has(type)) throw new Error('ya registrado'); table.set(type, component); } };
}

function mountType(registry, type, { it = item(type), submit } = {}) {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const calls = [];
  registry.table.get(type).mount(root, it, { doc: env.doc, submit: async (a) => { calls.push(a); return submit ? submit(a) : { status: 'saved' }; } });
  const opt = (t) => root.querySelectorAll('.ch__option').find((o) => o.querySelector('.ch__text').textContent === t);
  const btn = (label) => root.querySelectorAll('button').find((b) => b.textContent.trim() === label);
  return { env, root, calls, opt, btn };
}

test('la tabla trae exactamente los 9 tipos de la subparte 2.3 y está congelada', () => {
  assert.deepEqual(Object.keys(CHOICE_TYPES), NINE);
  assert.ok(Object.isFrozen(CHOICE_TYPES));
  for (const o of Object.values(CHOICE_TYPES)) assert.ok(Object.isFrozen(o));
});

test('solo mcq_en_es cambia opciones: sus opciones están en español', () => {
  for (const type of NINE) assert.deepEqual(CHOICE_TYPES[type], type === 'mcq_en_es' ? { optionsLang: 'es' } : {}, type);
});

test('registerChoiceTypes registra los 9 en un registro real y devuelve la lista', () => {
  const reg = createExerciseRegistry({ log: () => {} });
  assert.deepEqual(registerChoiceTypes(reg, { rng: createRng(1) }), NINE);
  for (const type of NINE) assert.equal(reg.has(type), true, type);
  assert.equal(reg.has('phrase_cloze'), false);
});

test('registrar dos veces lanza (el registro no se silencia)', () => {
  const reg = createExerciseRegistry({ log: () => {} });
  registerChoiceTypes(reg);
  assert.throws(() => registerChoiceTypes(reg), /ya está registrado/);
});

test('sin un registro válido lanza un Error en español', () => {
  for (const bad of [undefined, null, 5, {}, { register: 'x' }]) assert.throws(() => registerChoiceTypes(bad), /falta el registro de ejercicios/);
});

test('un rng o un catálogo mal formados lanzan al registrar (lo valida createChoice)', () => {
  assert.throws(() => registerChoiceTypes(spyRegistry(), { rng: {} }), /rng/);
  assert.throws(() => registerChoiceTypes(spyRegistry(), { catalog: 5 }), /catalog/);
});

test('el idioma de las opciones: mcq_en_es en «es»; los demás en «en»', () => {
  const reg = spyRegistry();
  registerChoiceTypes(reg, { rng: createRng(3) });
  for (const type of NINE) {
    const m = mountType(reg, type);
    const langs = m.root.querySelectorAll('.ch__text').map((e) => e.getAttribute('lang'));
    assert.deepEqual([...new Set(langs)], [type === 'mcq_en_es' ? 'es' : 'en'], type);
  }
});

test('cada uno de los 9 tipos responde: acierto → correct, y «No sé» → dont_know', async () => {
  const reg = spyRegistry();
  registerChoiceTypes(reg, { rng: createRng(9) });
  for (const type of NINE) {
    const a = mountType(reg, type);
    click(a.opt('beta'));
    click(a.btn(CH_TEXT.check));
    await a.env.flush();
    assert.equal(a.calls.length, 1, type);
    assert.equal(a.calls[0].result, 'correct', type);
    const b = mountType(reg, type);
    click(b.btn(CH_TEXT.dontKnow));
    await b.env.flush();
    assert.equal(b.calls[0].result, 'dont_know', type);
  }
});

test('el catálogo en función se lee al comprobar, no al montar ni al registrar', async () => {
  let reads = 0;
  const reg = spyRegistry();
  registerChoiceTypes(reg, { rng: createRng(2), catalog: () => { reads += 1; return { has: (c) => c === 'GRM.A', hint: () => 'pista de prueba' }; } });
  assert.equal(reads, 0);
  const m = mountType(reg, 'prep_pick');
  assert.equal(reads, 0);
  click(m.opt('alfa'));
  click(m.btn(CH_TEXT.check));
  await m.env.flush();
  assert.ok(reads >= 1);
  assert.equal(m.calls[0].result, 'wrong');
  assert.equal(m.calls[0].errors[0].code, 'GRM.A');
});

test('cada tipo tiene su propio componente (no comparten instancia)', () => {
  const reg = spyRegistry();
  registerChoiceTypes(reg);
  assert.equal(new Set([...reg.table.values()]).size, 9);
});

test('el log llega al componente: un catálogo que lanza se informa por ahí y la respuesta se envía igual', async () => {
  const logs = [];
  const reg = spyRegistry();
  registerChoiceTypes(reg, { rng: createRng(4), catalog: () => { throw new Error('sin catálogo'); }, log: (...a) => logs.push(a) });
  const m = mountType(reg, 'choose_tense');
  click(m.opt('alfa'));
  click(m.btn(CH_TEXT.check));
  await m.env.flush();
  assert.equal(m.calls[0].result, 'wrong');
  assert.ok(!('errors' in m.calls[0]));
  assert.equal(logs.length, 1);
  assert.match(String(logs[0][0]), /catálogo de errores/);
});
