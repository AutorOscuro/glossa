// @purpose: Pruebas del registro de los 2 tipos de construir (ui/exercises/buildTypes.js, 2.4-T3 punto 4) y de su cableado en app/main.js: tabla, registro, rng, log y envío por tipo.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BUILD_TYPES, registerBuildTypes } from '../ui/exercises/buildTypes.js';
import { ORDER_TYPES } from '../ui/exercises/orderTypes.js';
import { CHOICE_TYPES } from '../ui/exercises/choiceTypes.js';
import { createExerciseRegistry } from '../ui/exercises/index.js';
import { BP_TEXT } from '../ui/exercises/buildPieces.js';
import { createRng } from '../core/rng.js';
import { resetFirstRunForTests } from '../app/firstRun.js';
import { makeEnv } from './_fakeDom.mjs';

const TWO = ['unscramble_letters', 'build_from_keywords'];
const MAIN = fs.readFileSync(new URL('../app/main.js', import.meta.url), 'utf8');
const click = (el) => el.dispatchEvent({ type: 'click', preventDefault() {} });
const ITEMS = {
  unscramble_letters: { id: 'g.let.0001', type: 'unscramble_letters', prompt_es: 'Forma la palabra «gato».', data: { pieces: ['c', 'a', 't'], extra_pieces: ['x'], shuffle: false } },
  build_from_keywords: { id: 'g.kw.0001', type: 'build_from_keywords', prompt_es: 'Arma la frase.', data: { pieces: ['I', 'like', 'tea'], extra_pieces: ['are'], shuffle: false } },
};

function spyRegistry() {
  const table = new Map();
  return { table, register: (type, component) => { if (table.has(type)) throw new Error('ya registrado'); table.set(type, component); } };
}

function mountType(type, { submit, rng = createRng(7), log } = {}) {
  const reg = spyRegistry();
  registerBuildTypes(reg, { rng, ...(log ? { log } : {}) });
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const calls = [];
  const comp = reg.table.get(type).mount(root, ITEMS[type], { doc: env.doc, submit: async (a) => { calls.push(a); return submit ? submit(a) : { status: 'saved' }; } });
  const tray = () => root.querySelectorAll('.bp__tray .bp__piece');
  const trayPiece = (t) => tray().find((b) => b.textContent === t);
  const btn = (label) => root.querySelectorAll('button').find((b) => b.textContent.trim() === label);
  return { env, root, calls, comp, tray, btn, put: (...ts) => { for (const t of ts) click(trayPiece(t)); } };
}

test('la tabla trae exactamente los 2 tipos de construir y está congelada', () => {
  assert.deepEqual(Object.keys(BUILD_TYPES), TWO);
  assert.ok(Object.isFrozen(BUILD_TYPES));
  for (const o of Object.values(BUILD_TYPES)) { assert.ok(Object.isFrozen(o)); assert.deepEqual(o, {}); }
});

test('registerBuildTypes registra los 2 en un registro real y devuelve la lista', () => {
  const reg = createExerciseRegistry({ log: () => {} });
  assert.deepEqual(registerBuildTypes(reg, { rng: createRng(1) }), TWO);
  for (const type of TWO) assert.equal(reg.has(type), true, type);
  for (const other of ['order_blocks', 'cloze_bank', 'match_pairs', 'phrase_cloze']) assert.equal(reg.has(other), false, other);
});

test('registrar dos veces lanza (no se silencia) y un registro inválido lanza en español', () => {
  const reg = createExerciseRegistry({ log: () => {} });
  registerBuildTypes(reg);
  assert.throws(() => registerBuildTypes(reg));
  for (const bad of [undefined, null, 5, {}, { register: 3 }]) assert.throws(() => registerBuildTypes(bad), /registerBuildTypes: falta el registro de ejercicios/);
});

test('cada tipo recibe su propio componente y todo se registra con el nombre del tipo', () => {
  const reg = spyRegistry();
  registerBuildTypes(reg);
  assert.deepEqual([...reg.table.keys()], TWO);
  assert.notEqual(reg.table.get(TWO[0]), reg.table.get(TWO[1]));
  for (const c of reg.table.values()) assert.equal(typeof c.mount, 'function');
});

test('el rng recibido se usa en los dos tipos (la bandeja se baraja al montar)', () => {
  for (const type of TWO) {
    const reg = spyRegistry();
    let used = 0;
    registerBuildTypes(reg, { rng: { shuffle: (l) => { used += 1; return [...l].reverse(); } } });
    const env = makeEnv();
    const root = env.doc.createElement('div');
    const it = { ...ITEMS[type], data: { ...ITEMS[type].data, shuffle: true } };
    reg.table.get(type).mount(root, it, { doc: env.doc });
    assert.equal(used, 1, type);
  }
});

test('sin rng cada componente monta con el azar del sistema', () => {
  const reg = spyRegistry();
  registerBuildTypes(reg);
  const env = makeEnv();
  const root = env.doc.createElement('div');
  const comp = reg.table.get('unscramble_letters').mount(root, ITEMS.unscramble_letters, { doc: env.doc });
  assert.ok(comp.el);
});

test('unscramble_letters: las letras se unen SIN espacio y el envío lleva el tipo de respuesta correcto', async () => {
  const s = mountType('unscramble_letters');
  s.put('c', 'a', 't');
  click(s.btn(BP_TEXT.check));
  await s.env.flush();
  assert.deepEqual(s.calls, [{ result: 'correct', hint: false, responseRaw: 'cat', errorCodes: [] }]);
  assert.equal(s.root.querySelector('.fb__verdict').textContent, BP_TEXT.correct);
});

test('build_from_keywords: las palabras se unen con UN espacio', async () => {
  const s = mountType('build_from_keywords');
  s.put('I', 'like', 'tea');
  click(s.btn(BP_TEXT.check));
  await s.env.flush();
  assert.deepEqual(s.calls, [{ result: 'correct', hint: false, responseRaw: 'I like tea', errorCodes: [] }]);
});

test('cada tipo usa su propio texto: «palabra» para letras y «frase» para palabras clave', () => {
  const a = mountType('unscramble_letters');
  const b = mountType('build_from_keywords');
  assert.equal(a.root.querySelector('.bp__instruction').textContent, BP_TEXT.instructionLetters);
  assert.equal(b.root.querySelector('.bp__instruction').textContent, BP_TEXT.instructionWords);
  assert.ok(a.root.querySelector('.bp__line--letters'));
  assert.ok(b.root.querySelector('.bp__line--words'));
  assert.equal(a.root.querySelector('.bp').getAttribute('data-type') ?? a.root.querySelector('article').dataset.type, 'unscramble_letters');
});

test('un orden mal envía wrong y «No sé» envía dont_know, por los dos tipos', async () => {
  for (const type of TWO) {
    const bad = mountType(type);
    const order = ITEMS[type].data.pieces;
    bad.put(order[1], order[0], order[2]);
    click(bad.btn(BP_TEXT.check));
    await bad.env.flush();
    assert.equal(bad.calls[0].result, 'wrong', type);
    const dk = mountType(type);
    click(dk.btn(BP_TEXT.dontKnow));
    await dk.env.flush();
    assert.deepEqual(dk.calls, [{ result: 'dont_know', dontKnow: true, hint: false }], type);
  }
});

test('el log recibido llega al componente: un fallo al pintar la corrección se registra', async () => {
  const logs = [];
  const s = mountType('build_from_keywords', { log: (...a) => logs.push(a) });
  s.put('I', 'like', 'tea');
  s.root.querySelector('.bp__feedback').replaceChildren = () => { throw new Error('boom'); };
  click(s.btn(BP_TEXT.check));
  await s.env.flush();
  assert.equal(logs.length, 1);
});

test('un ítem con datos inválidos hace lanzar al montar, con el prefijo del componente', () => {
  const reg = spyRegistry();
  registerBuildTypes(reg);
  const env = makeEnv();
  const root = env.doc.createElement('div');
  const bad = { id: 'x', type: 'unscramble_letters', prompt_es: 'x', data: { pieces: ['a'] } };
  assert.throws(() => reg.table.get('unscramble_letters').mount(root, bad, { doc: env.doc }), /build_pieces: el ítem de construir no es válido/);
});

test('los tipos de construir no chocan con los de ordenar ni con los de elección', () => {
  for (const t of TWO) {
    assert.ok(!Object.keys(ORDER_TYPES).includes(t), t);
    assert.ok(!Object.keys(CHOICE_TYPES).includes(t), t);
    assert.notEqual(t, 'phrase_cloze');
  }
});

// ---- cableado en app/main.js ----
let n = 0;
const real = { document: globalThis.document, window: globalThis.window };
afterEach(() => { globalThis.document = real.document; globalThis.window = real.window; });

test('main.js se importa de verdad con los 2 tipos de construir registrados y sin errores de arranque', async () => {
  resetFirstRunForTests();
  const env = makeEnv({ hash: '#/ajustes' });
  globalThis.document = env.doc;
  globalThis.window = env.win;
  const errors = [];
  const orig = console.error; console.error = (...a) => errors.push(a);
  try {
    n += 1;
    await import(`../app/main.js?build-wiring=${n}`);
    for (let i = 0; i < 12; i += 1) await env.flush();
  } finally { console.error = orig; }
  assert.deepEqual(errors.filter((e) => /No se pudo iniciar la app/.test(String(e[0]))), []);
  assert.equal(env.doc.getElementById('boot')?.textContent?.includes('No se pudo iniciar la app') ?? false, false);
});

test('registerBuildTypes se llama una sola vez desde app/exerciseTypes.js, en su sitio, y main.js usa ese ayudante', async () => {
  const ET = (await import('node:fs')).readFileSync(new URL('../app/exerciseTypes.js', import.meta.url), 'utf8');
  assert.match(ET, /import \{ registerBuildTypes \} from '\.\.\/ui\/exercises\/buildTypes\.js';/);
  assert.equal(ET.match(/registerBuildTypes\(/g).length, 1);
  assert.match(ET, /registerBuildTypes\(registry, \{ log \}\)/);
  for (const t of TWO) assert.ok(!ET.includes(`register('${t}'`) && !MAIN.includes(`register('${t}'`), `${t} ya no se registra a mano`);
  assert.ok(ET.indexOf('registerOrderTypes(') < ET.indexOf('registerBuildTypes('));
  assert.match(MAIN, /registerExerciseTypes\(app\.services\.exercises, \{ catalog: \(\) => app\.services\.study\?\.catalog \?\? null, log: console\.error \}\)/);
  assert.ok(MAIN.indexOf('registerExerciseTypes(app') < MAIN.indexOf('startFirstRun('));
});
