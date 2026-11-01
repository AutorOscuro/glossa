// @purpose: Textos exactos del veredicto en textAnswer y threeForms tras migrar al panel común (2.6-T1 punto 2): cierran roturas vivas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTextAnswer } from '../ui/exercises/textAnswer.js';
import { createThreeForms } from '../ui/exercises/threeForms.js';
import { createPhraseCloze } from '../ui/exercises/phraseCloze.js';
import { makeEnv } from './_fakeDom.mjs';

const ev = (type) => ({ type, preventDefault() {} });
const click = (el) => el.dispatchEvent(ev('click'));
const settle = async (env) => { for (let i = 0; i < 6; i += 1) await env.flush(); };

function mount(factory, item) {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  factory().mount(root, item, { doc: env.doc, submit: async () => ({ status: 'saved' }) });
  const btn = (l) => root.querySelectorAll('button').find((b) => b.textContent.includes(l));
  const inputs = root.querySelectorAll('input');
  const type = (...vs) => vs.forEach((v, i) => { inputs[i].value = v; inputs[i].dispatchEvent(ev('input')); });
  const verdict = () => root.querySelectorAll('.fb__verdict')[0].textContent;
  return { env, root, btn, type, verdict };
}

const taItem = { id: 'x', type: 'fill_verb', prompt_es: 'Ella trabaja aquí.', accept: ['works'], data: {} };
const tfItem = { id: 'v', type: 'three_forms', prompt_es: 'cantar', data: { forms: { present: 'sing', past: 'sang', participle: 'sung' } } };

test('textAnswer: textos exactos del veredicto (mal, no sé)', async () => {
  const a = mount(createTextAnswer, taItem);
  a.type('work'); click(a.btn('Comprobar')); await settle(a.env);
  assert.equal(a.verdict(), 'Todavía no. Fíjate en la corrección:');
  const b = mount(createTextAnswer, taItem);
  click(b.btn('No sé')); await settle(b.env);
  assert.equal(b.verdict(), 'No pasa nada: así se dice.');
});

test('threeForms: textos exactos del veredicto (mal, casi, no sé)', async () => {
  const a = mount(createThreeForms, tfItem);
  a.type('sing', 'sang', 'sing'); click(a.btn('Comprobar')); await settle(a.env);
  assert.equal(a.verdict(), 'Todavía no. Fíjate en cada forma:');
  const b = mount(createThreeForms, tfItem);
  b.type('sing', 'sangg', 'sung'); click(b.btn('Comprobar')); await settle(b.env);
  assert.equal(b.verdict(), 'Casi: revisa la ortografía.');
  const c = mount(createThreeForms, tfItem);
  click(c.btn('No sé')); await settle(c.env);
  assert.equal(c.verdict(), 'No pasa nada: son estas.');
});

// ---- choice (elegir): notas del ítem desde el panel común ----
import { createChoice, CH_TEXT } from '../ui/exercises/choice.js';
import { createRng } from '../core/rng.js';

function chooseSetup(extra = {}) {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const it = {
    id: 'c1', type: 'choose_correct', prompt_es: 'Elige.', explain_es: 'Se usa for con duración.', grammar_note_es: 'for + periodo.', nuance_es: 'Suena natural.',
    data: { options: ["I've lived here for two years.", 'I live here since two years.'], correct: 0, shuffle: false }, ...extra,
  };
  createChoice({ rng: createRng(5) }).mount(root, it, { doc: env.doc, submit: async () => ({ status: 'saved' }) });
  const opt = (t) => root.querySelectorAll('.ch__option').find((o) => o.querySelector('.ch__text').textContent === t);
  const btn = (l) => root.querySelectorAll('button').find((b) => b.textContent.trim() === l);
  return { env, root, opt, btn };
}

test('choice: al fallar salen explicación, gramática y matiz; al acertar solo el matiz breve', async () => {
  const a = chooseSetup();
  click(a.opt('I live here since two years.')); click(a.btn(CH_TEXT.check)); await settle(a.env);
  assert.equal(a.root.querySelectorAll('.fb__explain')[0].textContent, 'Se usa for con duración.');
  assert.equal(a.root.querySelectorAll('.fb__grammar').length, 1);
  assert.equal(a.root.querySelectorAll('.fb__nuance').length, 1);
  const b = chooseSetup();
  click(b.opt("I've lived here for two years.")); click(b.btn(CH_TEXT.check)); await settle(b.env);
  assert.equal(b.root.querySelectorAll('.fb__explain').length, 0);
  assert.equal(b.root.querySelectorAll('.fb__grammar').length, 0);
  assert.equal(b.root.querySelectorAll('.fb__nuance').length, 1);
});

// ---- order_blocks (ordenar): notas del ítem desde el panel común ----
import { createOrderBlocks, OB_TEXT } from '../ui/exercises/orderBlocks.js';

function orderSetup() {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const it = { id: 'o1', type: 'order_blocks', prompt_es: 'Ordena.', explain_es: 'Orden: sujeto, verbo, objeto.', grammar_note_es: 'SVO.', nuance_es: 'Neutro.', data: { blocks: ['I would like', 'a coffee', 'please'] } };
  createOrderBlocks({ rng: createRng(7) }).mount(root, it, { doc: env.doc, submit: async () => ({ status: 'saved' }) });
  const btn = (l) => root.querySelectorAll('button').find((b) => b.textContent.trim() === l);
  const put = (...ts) => { for (const t of ts) click(root.querySelectorAll('.ob__tray .ob__block').find((b) => b.textContent === t)); };
  return { env, root, btn, put };
}

test('order_blocks: al fallar salen las notas y la respuesta; al acertar solo el matiz breve', async () => {
  const a = orderSetup();
  a.put('please', 'a coffee', 'I would like'); click(a.btn(OB_TEXT.check)); await settle(a.env);
  assert.equal(a.root.querySelectorAll('.fb__verdict--wrong').length, 1);
  assert.equal(a.root.querySelectorAll('.ob__correct').length, 1);
  assert.equal(a.root.querySelectorAll('.fb__explain')[0].textContent, 'Orden: sujeto, verbo, objeto.');
  assert.equal(a.root.querySelectorAll('.fb__grammar').length, 1);
  const b = orderSetup();
  b.put('I would like', 'a coffee', 'please'); click(b.btn(OB_TEXT.check)); await settle(b.env);
  assert.equal(b.root.querySelectorAll('.fb__verdict--correct').length, 1);
  assert.equal(b.root.querySelectorAll('.fb__explain').length, 0);
  assert.equal(b.root.querySelectorAll('.fb__nuance').length, 1);
});

test('order_blocks: acierto sin respuesta repetida; «No sé» con veredicto propio, respuesta, notas y sin aviso de bloques', async () => {
  const b = orderSetup();
  b.put('I would like', 'a coffee', 'please'); click(b.btn(OB_TEXT.check)); await settle(b.env);
  assert.equal(b.root.querySelectorAll('.ob__correct').length, 0);
  const d = orderSetup();
  d.put('please'); click(d.btn(OB_TEXT.dontKnow)); await settle(d.env);
  assert.equal(d.root.querySelectorAll('.fb__verdict--dont').length, 1);
  assert.equal(d.root.querySelectorAll('.fb__verdict')[0].textContent, 'No pasa nada: así va en orden correcto:');
  assert.equal(d.root.querySelectorAll('.ob__correct').length, 1);
  assert.equal(d.root.querySelectorAll('.ob__misplaced').length, 0);
  assert.equal(d.root.querySelectorAll('.fb__explain').length, 1);
});

// ---- match_pairs (emparejar): notas del ítem desde el panel común ----
import { createMatchPairs, MA_TEXT } from '../ui/exercises/matchPairs.js';

const PAIRS = [{ left: 'dog', right: 'perro' }, { left: 'cat', right: 'gato' }, { left: 'bird', right: 'pájaro' }];
function matchSetup() {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const it = { id: 'm1', type: 'match_pairs', prompt_es: 'Une.', explain_es: 'Vocabulario de animales.', grammar_note_es: 'Sustantivos.', nuance_es: 'Básico.', data: { pairs: PAIRS } };
  createMatchPairs({ rng: createRng(7) }).mount(root, it, { doc: env.doc, submit: async () => ({ status: 'saved' }) });
  const L = (t) => root.querySelectorAll('.ma__card--left').find((b) => PAIRS[Number(b.dataset.index)].left === t);
  const R = (t) => root.querySelectorAll('.ma__card--right').find((b) => PAIRS[Number(b.dataset.index)]?.right === t);
  const join = (l, r) => { click(L(l)); click(R(r)); };
  const btn = (l) => root.querySelectorAll('button').find((b) => b.textContent.trim() === l);
  return { env, root, join, btn };
}

test('match_pairs: con fallos salen las parejas y las notas; sin fallos solo el matiz breve; «No sé» con su veredicto', async () => {
  const a = matchSetup();
  a.join('dog', 'gato'); a.join('dog', 'perro'); a.join('cat', 'gato'); a.join('bird', 'pájaro'); await settle(a.env);
  assert.equal(a.root.querySelectorAll('.fb__verdict--wrong').length, 1);
  assert.equal(a.root.querySelectorAll('.ma__correct').length, 1);
  assert.equal(a.root.querySelectorAll('.fb__explain')[0].textContent, 'Vocabulario de animales.');
  assert.equal(a.root.querySelectorAll('.fb__grammar').length, 1);
  const b = matchSetup();
  b.join('dog', 'perro'); b.join('cat', 'gato'); b.join('bird', 'pájaro'); await settle(b.env);
  assert.equal(b.root.querySelectorAll('.fb__verdict--correct').length, 1);
  assert.equal(b.root.querySelectorAll('.ma__correct').length, 0);
  assert.equal(b.root.querySelectorAll('.fb__explain').length, 0);
  assert.equal(b.root.querySelectorAll('.fb__nuance').length, 1);
  const d = matchSetup();
  click(d.btn(MA_TEXT.dontKnow)); await settle(d.env);
  assert.equal(d.root.querySelectorAll('.fb__verdict--dont').length, 1);
  assert.equal(d.root.querySelectorAll('.fb__verdict')[0].textContent, 'No pasa nada: así van las parejas:');
  assert.equal(d.root.querySelectorAll('.ma__correct').length, 1);
  assert.equal(d.root.querySelectorAll('.fb__explain').length, 1);
});

// ---- cloze_bank (huecos con banco): notas del ítem desde el panel común ----
import { createClozeBank, CB_TEXT } from '../ui/exercises/clozeBank.js';

function clozeSetup() {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const it = { id: 'k1', type: 'cloze_bank', prompt_es: 'Completa.', explain_es: 'Por medio de transporte: by.', grammar_note_es: 'by + transporte.', nuance_es: 'Habitual.', data: { text: 'I ___ to school ___ bus.', answers: [['go'], ['by']], bank: ['go', 'by', 'at', 'goes'] } };
  createClozeBank({ rng: createRng(7) }).mount(root, it, { doc: env.doc, submit: async () => ({ status: 'saved' }) });
  const btn = (l) => root.querySelectorAll('button').find((b) => b.textContent.trim() === l);
  const put = (...ts) => { for (const t of ts) click(root.querySelectorAll('.cb__tray .cb__word').find((b) => b.textContent === t)); };
  return { env, root, btn, put };
}

test('cloze_bank: con fallos salen solución, aviso de huecos y notas; sin fallos solo el matiz breve; «No sé» con su veredicto', async () => {
  const a = clozeSetup();
  a.put('by', 'go'); click(a.btn(CB_TEXT.check)); await settle(a.env);
  assert.equal(a.root.querySelectorAll('.fb__verdict--wrong').length, 1);
  assert.equal(a.root.querySelectorAll('.cb__correct').length, 1);
  assert.equal(a.root.querySelectorAll('.cb__review').length, 1);
  assert.equal(a.root.querySelectorAll('.fb__explain')[0].textContent, 'Por medio de transporte: by.');
  assert.equal(a.root.querySelectorAll('.fb__grammar').length, 1);
  const b = clozeSetup();
  b.put('go', 'by'); click(b.btn(CB_TEXT.check)); await settle(b.env);
  assert.equal(b.root.querySelectorAll('.fb__verdict--correct').length, 1);
  assert.equal(b.root.querySelectorAll('.cb__correct').length, 0);
  assert.equal(b.root.querySelectorAll('.fb__explain').length, 0);
  assert.equal(b.root.querySelectorAll('.fb__nuance').length, 1);
  const d = clozeSetup();
  d.put('at'); click(d.btn(CB_TEXT.dontKnow)); await settle(d.env);
  assert.equal(d.root.querySelectorAll('.fb__verdict--dont').length, 1);
  assert.equal(d.root.querySelectorAll('.fb__verdict')[0].textContent, 'No pasa nada: así queda bien:');
  assert.equal(d.root.querySelectorAll('.cb__correct').length, 1);
  assert.equal(d.root.querySelectorAll('.cb__review').length, 0);
  assert.equal(d.root.querySelectorAll('.fb__explain').length, 1);
});

// ---- build_from_keywords (construir piezas): notas del ítem desde el panel común ----
import { createBuildPieces, BP_TEXT } from '../ui/exercises/buildPieces.js';

function buildSetup() {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const it = { id: 'b1', type: 'build_from_keywords', prompt_es: 'Construye.', explain_es: 'Presente perfecto: have + participio.', grammar_note_es: 'have eaten.', nuance_es: 'Resultado presente.', data: { pieces: ['I', 'have', 'eaten'], extra_pieces: ['has'] } };
  createBuildPieces({ rng: createRng(7) }).mount(root, it, { doc: env.doc, submit: async () => ({ status: 'saved' }) });
  const btn = (l) => root.querySelectorAll('button').find((b) => b.textContent.trim() === l);
  const put = (...ix) => { for (const i of ix) click(root.querySelectorAll('.bp__tray .bp__piece').find((b) => b.dataset.index === String(i))); };
  return { env, root, btn, put };
}

test('build_from_keywords: con fallos salen solución, aviso y notas; sin fallos solo el matiz breve; «No sé» con su veredicto', async () => {
  const a = buildSetup();
  a.put(1, 0, 2); click(a.btn(BP_TEXT.check)); await settle(a.env);
  assert.equal(a.root.querySelectorAll('.fb__verdict--wrong').length, 1);
  assert.equal(a.root.querySelectorAll('.fb__verdict')[0].textContent, BP_TEXT.wrongWords);
  assert.equal(a.root.querySelectorAll('.bp__correct').length, 1);
  assert.equal(a.root.querySelectorAll('.bp__misplaced').length > 0, true);
  assert.equal(a.root.querySelectorAll('.fb__explain')[0].textContent, 'Presente perfecto: have + participio.');
  assert.equal(a.root.querySelectorAll('.fb__grammar').length, 1);
  const b = buildSetup();
  b.put(0, 1, 2); click(b.btn(BP_TEXT.check)); await settle(b.env);
  assert.equal(b.root.querySelectorAll('.fb__verdict--correct').length, 1);
  assert.equal(b.root.querySelectorAll('.bp__correct').length, 0);
  assert.equal(b.root.querySelectorAll('.fb__explain').length, 0);
  assert.equal(b.root.querySelectorAll('.fb__nuance').length, 1);
  const d = buildSetup();
  d.put(1); click(d.btn(BP_TEXT.dontKnow)); await settle(d.env);
  assert.equal(d.root.querySelectorAll('.fb__verdict--dont').length, 1);
  assert.equal(d.root.querySelectorAll('.fb__verdict')[0].textContent, 'No pasa nada: así va la frase:');
  assert.equal(d.root.querySelectorAll('.bp__correct').length, 1);
  assert.equal(d.root.querySelectorAll('.bp__misplaced').length, 0);
  assert.equal(d.root.querySelectorAll('.fb__explain').length, 1);
});

// phrase_cloze (2.6-T1 punto 3): gramática y matiz ya están a la vista en el recuadro del ítem antes de contestar; el panel solo añade explain_es.
test('phrase_cloze: con fallo salen veredicto, solución y explicación sin repetir gramática ni matiz; acierto sin explicación; «casi» y «No sé» con su veredicto', async () => {
  const pcItem = {
    id: 'p', type: 'phrase_cloze', prompt_es: 'No pude enviarlo.', explain_es: 'Usa couldn\'t + verbo base.',
    grammar_note_es: 'Couldn\'t es el pasado de can\'t.', nuance_es: 'Suena natural y breve.',
    accept: ['No, I couldn\'t send it.'], data: { text: 'No, I ___ send it.', answers: [['couldn\'t']] },
  };
  const go = async (factoryOpts, act) => {
    const env = makeEnv();
    const root = env.doc.createElement('div');
    env.doc.body.appendChild(root);
    createPhraseCloze(factoryOpts).mount(root, pcItem, { doc: env.doc, submit: async () => ({ status: 'saved' }) });
    const btn = (l) => root.querySelectorAll('button').find((b) => b.textContent.includes(l));
    const input = root.querySelectorAll('input')[0];
    act({ btn, type: (v) => { input.value = v; input.dispatchEvent(ev('input')); } });
    await settle(env);
    const q = (s) => root.querySelectorAll(s);
    return { q, verdict: () => q('.fb__verdict')[0].textContent, order: () => q('.pc__feedback')[0].children.map((n) => String(n.className ?? n.getAttribute?.('class') ?? '').split(' ')[0]) };
  };
  const wrong = await go({}, (a) => { a.type('can'); click(a.btn('Comprobar')); });
  assert.equal(wrong.verdict(), 'Todavía no. Fíjate en la corrección:');
  assert.ok(wrong.q('.pc__correct')[0].textContent.includes('couldn\'t'));
  assert.equal(wrong.q('.fb__explain').length, 1);
  assert.equal(wrong.q('.pc__grammar').length, 1);
  assert.equal(wrong.q('.pc__nuance').length, 1);
  assert.equal(wrong.q('.fb__grammar').length + wrong.q('.fb__nuance').length, 0);
  assert.equal(wrong.q('.pc__verdict').length, 0);
  const ok = await go({}, (a) => { a.type('couldn\'t'); click(a.btn('Comprobar')); });
  assert.equal(ok.verdict(), '¡Bien!');
  assert.equal(ok.q('.fb__verdict--correct').length, 1);
  assert.equal(ok.q('.pc__correct').length + ok.q('.fb__explain').length + ok.q('.fb__nuance').length, 0);
  const almost = await go({ compare: () => ({ result: 'almost', matched: 'No, I couldn\'t send it.', diff: [], spellingFlags: [{ word: 'couldnt', expected: 'couldn\'t' }], errorCodes: [] }) },
    (a) => { a.type('couldnt'); click(a.btn('Comprobar')); });
  assert.equal(almost.verdict(), 'Casi: revisa la ortografía de la palabra marcada.');
  assert.equal(almost.q('.fb__verdict--almost').length, 1);
  assert.deepEqual(almost.order(), ['fb__verdict', 'pc__spell', 'pc__correct', 'fb__explain']);
  const dont = await go({}, (a) => click(a.btn('No sé')));
  assert.equal(dont.verdict(), 'No pasa nada: así se dice.');
  assert.equal(dont.q('.fb__verdict--dont').length, 1);
  assert.ok(dont.q('.pc__correct')[0].textContent.includes('couldn\'t'));
  assert.equal(dont.q('.fb__explain').length, 1);
});
