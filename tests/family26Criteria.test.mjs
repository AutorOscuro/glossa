// @purpose: CA 1 y 3 de la subparte 2.6 (panel de feedback común) sobre TODOS los tipos del registro: al fallar y con «No sé» sale el veredicto del panel (CA 1) y la respuesta correcta queda visible (CA 3).
// CA 1 veredicto `.fb__verdict` del panel, sin clases propias, con las notas del ítem · CA 3 respuesta correcta visible tras fallar y tras «No sé».
// Excepción documentada (DECISIONS 2.6-T1 punto 3): phrase_cloze pinta gramática y matiz en sus recuadros previos (`.pc__grammar`, `.pc__nuance`); el panel solo añade `explain_es`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createErrorCatalog } from '../core/errorCatalog.js';
import { createRng } from '../core/rng.js';
import { WORD_TYPES } from '../core/textTypes.js';
import { createExerciseRegistry } from '../ui/exercises/index.js';
import { registerWordTypes, createWordType } from '../ui/exercises/textTypes.js';
import { registerTranslateTypes, createTranslateType } from '../ui/exercises/translateTypes.js';
import { registerFixError, createFixError } from '../ui/exercises/fixError.js';
import { registerTransformTypes, createTransformType } from '../ui/exercises/transformTypes.js';
import { registerChoiceTypes, CHOICE_TYPES } from '../ui/exercises/choiceTypes.js';
import { registerOrderTypes, ORDER_TYPES } from '../ui/exercises/orderTypes.js';
import { registerBuildTypes, BUILD_TYPES } from '../ui/exercises/buildTypes.js';
import { createThreeForms } from '../ui/exercises/threeForms.js';
import { createPhraseCloze } from '../ui/exercises/phraseCloze.js';
import { createMatchPairs } from '../ui/exercises/matchPairs.js';
import { createClozeBank } from '../ui/exercises/clozeBank.js';
import { makeEnv } from './_fakeDom.mjs';

const CATALOG = createErrorCatalog(JSON.parse(fs.readFileSync(new URL('../content/taxonomy/error_codes.json', import.meta.url), 'utf8')));
const ev = (type) => ({ type, preventDefault() {} });
const click = (el) => el.dispatchEvent(ev('click'));
const settle = async (env) => { for (let i = 0; i < 6; i += 1) await env.flush(); };
const NOTES = { explain_es: 'EXPLICA-26', grammar_note_es: 'GRAMATICA-26', nuance_es: 'MATIZ-26' };

// Todos los componentes, como los cablea app/main.js.
function fullRegistry() {
  const reg = createExerciseRegistry({ log: () => {} });
  const o = { catalog: CATALOG, rng: createRng(7) };
  reg.register('phrase_cloze', createPhraseCloze());
  registerChoiceTypes(reg, o); registerOrderTypes(reg, o);
  reg.register('match_pairs', createMatchPairs({ rng: o.rng }));
  reg.register('cloze_bank', createClozeBank({ rng: o.rng }));
  registerBuildTypes(reg, o); registerWordTypes(reg, o); registerTranslateTypes(reg, o);
  reg.register('three_forms', createThreeForms(o));
  registerFixError(reg, o); registerTransformTypes(reg, o);
  return reg;
}

function component(type) {
  const o = { catalog: CATALOG, rng: createRng(7) };
  if (WORD_TYPES.includes(type)) return createWordType(type, o);
  if (type === 'trap_translate' || type === 'translate_bank') return createTranslateType(type, o);
  if (type === 'three_forms') return createThreeForms(o);
  if (type === 'fix_error') return createFixError(o);
  if (['transform', 'keyword_transform', 'join_sentences', 'pronoun_placement'].includes(type)) return createTransformType(type, o);
  return null;
}

// Una pantalla por tipo: ítem válido con las tres notas, cómo fallar, y qué texto debe quedar visible como respuesta correcta.
const PAIRS = [{ left: 'dog', right: 'perro' }, { left: 'cat', right: 'gato' }, { left: 'bird', right: 'pájaro' }];
const LINES = [{ speaker: 'Ana', text: 'Hi!' }, { speaker: 'Ben', text: 'Hello, Ana.' }, { speaker: 'Ana', text: 'How are you?' }];
function spec(type) {
  const base = { id: `x.${type}`, type, prompt_es: 'Texto de prueba.', prompt_en: 'Test sentence.', situation: 'En la oficina', topics: ['gram.past_simple'], ...NOTES };
  if (type === 'phrase_cloze') {
    return { comp: createPhraseCloze(), it: { ...base, accept: ['No, I couldn\'t send it.'], data: { text: 'No, I ___ send it.', answers: [['couldn\'t']] } }, answer: 'couldn\'t',
      fail: (x) => { x.type(0, 'can'); click(x.btn('Comprobar')); }, notes: { grammar: '.pc__grammar', nuance: '.pc__nuance' } };
  }
  if (type in CHOICE_TYPES) {
    return { it: { ...base, data: { options: ['alfa', 'beta', 'gamma'], correct: 1, shuffle: false } }, marker: (x) => x.root.querySelectorAll('.ch__option--right').length === 1,
      fail: (x) => { click(x.root.querySelectorAll('.ch__option').find((o) => o.querySelector('.ch__text').textContent === 'alfa')); click(x.btn('Comprobar')); } };
  }
  if (type === 'order_blocks' || type === 'order_dialogue') {
    const dlg = type === 'order_dialogue';
    const correct = dlg ? LINES.map((l) => `${l.speaker}: ${l.text}`) : ['I would like', 'a coffee', 'please'];
    return { it: { ...base, data: dlg ? { lines: LINES } : { blocks: correct } }, answer: correct[0],
      fail: (x) => { for (const t of [...correct].reverse()) { const b = x.root.querySelectorAll('.ob__tray .ob__block').find((n) => n.textContent === t); assert.ok(b, `${type}: no está el bloque «${t}»`); click(b); } click(x.btn('Comprobar')); } };
  }
  if (type === 'match_pairs') {
    return { comp: createMatchPairs({ rng: createRng(7) }), it: { ...base, data: { pairs: PAIRS } }, answer: 'dog',
      fail: (x) => { const L = (t) => x.root.querySelectorAll('.ma__card--left').find((b) => PAIRS[Number(b.dataset.index)].left === t); const R = (t) => x.root.querySelectorAll('.ma__card--right').find((b) => PAIRS[Number(b.dataset.index)]?.right === t);
        for (const [l, r] of [['dog', 'gato'], ['dog', 'perro'], ['cat', 'gato'], ['bird', 'pájaro']]) { click(L(l)); click(R(r)); } } };
  }
  if (type === 'cloze_bank') {
    return { comp: createClozeBank({ rng: createRng(7) }), it: { ...base, data: { text: 'I ___ to school ___ bus.', answers: [['go'], ['by']], bank: ['go', 'by', 'at', 'goes'] } }, answer: 'go',
      fail: (x) => { for (const t of ['by', 'go']) click(x.root.querySelectorAll('.cb__tray .cb__word').find((b) => b.textContent === t)); click(x.btn('Comprobar')); } };
  }
  if (type === 'build_from_keywords' || type === 'unscramble_letters') {
    const letters = type === 'unscramble_letters';
    return { it: { ...base, data: letters ? { pieces: ['c', 'a', 't'], extra_pieces: ['x'], shuffle: false } : { pieces: ['I', 'have', 'eaten'], extra_pieces: ['has'] } }, answer: letters ? 'cat' : 'I have eaten',
      fail: (x) => { for (const i of letters ? [1, 0, 2] : [1, 0, 2]) click(x.root.querySelectorAll('.bp__tray .bp__piece').find((b) => b.dataset.index === String(i))); click(x.btn('Comprobar')); } };
  }
  if (type === 'three_forms') {
    return { comp: component(type), it: { ...base, accept: undefined, prompt_es: 'salir', data: { forms: { present: 'leave', past: 'left', participle: 'left' } } }, answer: 'left',
      fail: (x) => { x.type(0, 'aaa'); x.type(1, 'bbb'); x.type(2, 'ccc'); click(x.btn('Comprobar')); } };
  }
  const it = ['keyword_transform', 'join_sentences'].includes(type) ? { ...base, accept: ['left'], data: { source: 'It rained. We stayed.', keyword: 'because' } } : { ...base, accept: ['left'] };
  return { comp: component(type), it, answer: 'left', fail: (x) => { x.type(0, 'zzz'); click(x.btn('Comprobar')); } };
}

const TYPES = [
  'phrase_cloze', ...Object.keys(CHOICE_TYPES), ...Object.keys(ORDER_TYPES), 'match_pairs', 'cloze_bank', ...Object.keys(BUILD_TYPES),
  ...WORD_TYPES, 'trap_translate', 'translate_bank', 'three_forms', 'fix_error', 'transform', 'keyword_transform', 'join_sentences', 'pronoun_placement',
];

// Monta con el registro real y entrega el componente por tipo (un registro espía que guarda cada componente).
function componentFromRegistry(type) {
  const table = new Map();
  const spy = { register: (t, c) => { table.set(t, c); } };
  const o = { catalog: CATALOG, rng: createRng(7) };
  spy.register('phrase_cloze', createPhraseCloze());
  registerChoiceTypes(spy, o); registerOrderTypes(spy, o);
  spy.register('match_pairs', createMatchPairs({ rng: o.rng }));
  spy.register('cloze_bank', createClozeBank({ rng: o.rng }));
  registerBuildTypes(spy, o); registerWordTypes(spy, o); registerTranslateTypes(spy, o);
  spy.register('three_forms', createThreeForms(o));
  registerFixError(spy, o); registerTransformTypes(spy, o);
  return table.get(type);
}

function mount(type) {
  const s = spec(type);
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const comp = s.comp ?? componentFromRegistry(type);
  comp.mount(root, s.it, { doc: env.doc, submit: async () => ({ status: 'saved' }) });
  const btn = (label) => root.querySelectorAll('button').find((b) => b.textContent.trim() === label);
  const inputs = root.querySelectorAll('input');
  const typeIn = (i, v) => { inputs[i].value = v; inputs[i].dispatchEvent(ev('input')); };
  return { s, env, root, btn, type: typeIn };
}

const classesOf = (el) => String(el.className ?? el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
const sel = (x, q) => x.root.querySelectorAll(q);
// Recorre todos los nodos (el DOM falso no admite selectores de atributo) y devuelve las clases `*__verdict*` que no son del panel.
function ownVerdictClasses(node, out = []) {
  if (node && typeof node.getAttribute === 'function') for (const c of classesOf(node)) if (/__verdict/.test(c) && !c.startsWith('fb__verdict')) out.push(c);
  for (const k of node?.childNodes ?? []) ownVerdictClasses(k, out);
  return out;
}

test('la tabla de este cruce cubre exactamente los tipos del registro cableado', () => {
  const reg = fullRegistry();
  assert.deepEqual([...TYPES].sort(), TYPES.filter((t) => reg.has(t)).sort());
  assert.equal(new Set(TYPES).size, TYPES.length);
  assert.deepEqual([...TYPES].sort(), reg.types());
});

for (const type of TYPES) {
  test(`${type}: al fallar, veredicto del panel (CA 1) y respuesta correcta visible (CA 3)`, async () => {
    const x = mount(type);
    x.s.fail(x);
    await settle(x.env);
    const verdicts = sel(x, '.fb__verdict');
    assert.equal(verdicts.length, 1, `${type}: debe haber un solo .fb__verdict`);
    const cls = classesOf(verdicts[0]);
    assert.ok(cls.includes('fb__verdict--wrong') || cls.includes('fb__verdict--almost'), `${type}: clases ${cls.join(' ')}`);
    assert.ok(!/Bien/.test(verdicts[0].textContent), `${type}: no debe decir que acertó`);
    assert.deepEqual(ownVerdictClasses(x.root), [], `${type}: veredicto con clases propias`);
    // CA 1: notas del ítem
    assert.equal(sel(x, '.fb__explain')[0]?.textContent, 'EXPLICA-26', `${type}: explicación`);
    const n = x.s.notes ?? { grammar: '.fb__grammar', nuance: '.fb__nuance' };
    assert.match(sel(x, n.grammar)[0]?.textContent ?? '', /GRAMATICA-26/, `${type}: gramática`);
    assert.match(sel(x, n.nuance)[0]?.textContent ?? '', /MATIZ-26/, `${type}: matiz`);
    // CA 3: la respuesta correcta está visible
    if (x.s.marker) assert.ok(x.s.marker(x), `${type}: la opción correcta no está marcada`);
    else assert.ok(verdicts[0].parentNode.textContent.includes(x.s.answer), `${type}: falta la respuesta «${x.s.answer}» en el panel`);
  });

  test(`${type}: con «No sé», veredicto del panel (CA 1) y respuesta correcta visible (CA 3)`, async () => {
    const x = mount(type);
    click(x.btn('No sé'));
    await settle(x.env);
    const verdicts = sel(x, '.fb__verdict');
    assert.equal(verdicts.length, 1, `${type}: debe haber un solo .fb__verdict`);
    assert.ok(classesOf(verdicts[0]).includes('fb__verdict--dont'), `${type}: clases ${classesOf(verdicts[0]).join(' ')}`);
    assert.match(verdicts[0].textContent, /^No pasa nada/, type);
    assert.equal(sel(x, '.fb__explain')[0]?.textContent, 'EXPLICA-26', `${type}: explicación`);
    if (x.s.marker) assert.ok(x.s.marker(x), `${type}: la opción correcta no está marcada`);
    else assert.ok(verdicts[0].parentNode.textContent.includes(x.s.answer), `${type}: falta la respuesta «${x.s.answer}» tras «No sé»`);
  });
}
