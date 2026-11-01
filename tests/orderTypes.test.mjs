// @purpose: Pruebas de los envoltorios de ordenar (ui/exercises/orderTypes.js, 2.4-T1 punto 7) y de order_dialogue en pantalla: tabla, registro, «Hablante: texto», envío sin hablante y corrección por renglones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ORDER_TYPES, registerOrderTypes } from '../ui/exercises/orderTypes.js';
import { createExerciseRegistry } from '../ui/exercises/index.js';
import { OB_TEXT } from '../ui/exercises/orderBlocks.js';
import { createRng } from '../core/rng.js';
import { makeEnv } from './_fakeDom.mjs';

const TWO = ['order_blocks', 'order_dialogue'];
const click = (el) => el.dispatchEvent({ type: 'click', preventDefault() {} });
const has = (el, name) => el.getAttribute(name) !== null && el.getAttribute(name) !== undefined;
const dialogue = (extra = {}, data = {}) => ({
  id: 'g.dlg.0001', type: 'order_dialogue', prompt_es: 'Ordena el diálogo.',
  data: { lines: [{ speaker: 'Ana', text: 'Hi!' }, { speaker: 'Ben', text: 'Hello, Ana.' }, { speaker: 'Ana', text: 'How are you?' }], ...data }, ...extra,
});

function spyRegistry() {
  const table = new Map();
  return { table, register: (type, component) => { if (table.has(type)) throw new Error('ya registrado'); table.set(type, component); } };
}

function mountType(type, { it = dialogue(), submit, rng = createRng(7) } = {}) {
  const reg = spyRegistry();
  registerOrderTypes(reg, { rng });
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const calls = [];
  const comp = reg.table.get(type).mount(root, it, { doc: env.doc, submit: async (a) => { calls.push(a); return submit ? submit(a) : { status: 'saved' }; } });
  const tray = () => root.querySelectorAll('.ob__tray .ob__block');
  const trayBlock = (t) => tray().find((b) => b.textContent === t);
  const btn = (label) => root.querySelectorAll('button').find((b) => b.textContent.trim() === label);
  return { env, root, calls, comp, tray, trayBlock, btn, put: (...ts) => { for (const t of ts) click(trayBlock(t)); } };
}

test('la tabla trae exactamente los 2 tipos de ordenar y está congelada', () => {
  assert.deepEqual(Object.keys(ORDER_TYPES), TWO);
  assert.ok(Object.isFrozen(ORDER_TYPES));
  for (const o of Object.values(ORDER_TYPES)) { assert.ok(Object.isFrozen(o)); assert.deepEqual(o, {}); }
});

test('registerOrderTypes registra los 2 en un registro real y devuelve la lista', () => {
  const reg = createExerciseRegistry({ log: () => {} });
  assert.deepEqual(registerOrderTypes(reg, { rng: createRng(1) }), TWO);
  for (const type of TWO) assert.equal(reg.has(type), true, type);
  assert.equal(reg.has('phrase_cloze'), false);
  assert.equal(reg.has('choose_correct'), false);
});

test('registrar dos veces lanza (no se silencia) y un registro inválido lanza en español', () => {
  const reg = createExerciseRegistry({ log: () => {} });
  registerOrderTypes(reg);
  assert.throws(() => registerOrderTypes(reg));
  for (const bad of [undefined, null, 5, {}, { register: 3 }]) assert.throws(() => registerOrderTypes(bad), /falta el registro de ejercicios/);
});

test('cada tipo recibe su propio componente', () => {
  const reg = spyRegistry();
  registerOrderTypes(reg);
  assert.notEqual(reg.table.get('order_blocks'), reg.table.get('order_dialogue'));
});

test('el rng recibido se usa en los dos tipos', () => {
  for (const type of TWO) {
    const reg = spyRegistry();
    let used = 0;
    registerOrderTypes(reg, { rng: { shuffle: (l) => { used += 1; return [...l].reverse(); } } });
    const env = makeEnv();
    const root = env.doc.createElement('div');
    const it = type === 'order_blocks' ? { id: 'x', type, prompt_es: 'x', data: { blocks: ['a', 'b', 'c'] } } : dialogue();
    reg.table.get(type).mount(root, it, { doc: env.doc });
    assert.equal(used, 1, type);
  }
});

test('order_dialogue: cada bloque se muestra «Hablante: texto»', () => {
  const s = mountType('order_dialogue');
  assert.deepEqual(s.tray().map((b) => b.textContent).sort(), ['Ana: Hi!', 'Ana: How are you?', 'Ben: Hello, Ana.']);
});

test('order_dialogue: colocar muestra el bloque con hablante y la bandeja lo marca como usado', () => {
  const s = mountType('order_dialogue');
  s.put('Ben: Hello, Ana.');
  assert.equal(s.root.querySelector('.ob__block--placed').textContent, 'Ben: Hello, Ana.');
  assert.equal(s.trayBlock('Ben: Hello, Ana.').getAttribute('aria-label'), OB_TEXT.usedName('Ben: Hello, Ana.'));
});

test('order_dialogue: en el orden correcto se envía correct y responseRaw lleva solo el texto, sin hablante', async () => {
  const s = mountType('order_dialogue');
  s.put('Ana: Hi!', 'Ben: Hello, Ana.', 'Ana: How are you?');
  click(s.btn(OB_TEXT.check));
  await s.env.flush();
  assert.deepEqual(s.calls, [{ result: 'correct', hint: false, responseRaw: 'Hi! Hello, Ana. How are you?', errorCodes: [] }]);
  assert.equal(s.root.querySelector('.fb__verdict').textContent, OB_TEXT.correct);
});

test('order_dialogue: un orden alternativo de accept (escrito sin hablante) es correcto', async () => {
  const it = dialogue({ accept: ['Hello, Ana. Hi! How are you?'] });
  const s = mountType('order_dialogue', { it });
  s.put('Ben: Hello, Ana.', 'Ana: Hi!', 'Ana: How are you?');
  click(s.btn(OB_TEXT.check));
  await s.env.flush();
  assert.equal(s.calls[0].result, 'correct');
});

test('order_dialogue: orden incorrecto envía wrong y muestra cada línea correcta en su renglón con su hablante', async () => {
  const s = mountType('order_dialogue');
  s.put('Ben: Hello, Ana.', 'Ana: Hi!', 'Ana: How are you?');
  click(s.btn(OB_TEXT.check));
  await s.env.flush();
  assert.equal(s.calls[0].result, 'wrong');
  const strongs = s.root.querySelectorAll('.ob__correct strong');
  assert.deepEqual(strongs.map((x) => x.textContent), ['Ana: Hi!', 'Ben: Hello, Ana.', 'Ana: How are you?']);
  assert.equal(s.root.querySelectorAll('.ob__correct br').length, 2);
  assert.equal(s.root.querySelector('.ob__misplaced').textContent, OB_TEXT.misplaced('1, 2'));
});

test('order_dialogue: «No sé» envía dont_know y muestra el diálogo con hablantes', async () => {
  const s = mountType('order_dialogue');
  click(s.btn(OB_TEXT.dontKnow));
  await s.env.flush();
  assert.deepEqual(s.calls, [{ result: 'dont_know', dontKnow: true, hint: false }]);
  assert.equal(s.root.querySelectorAll('.ob__correct strong').length, 3);
});

test('order_dialogue: getResponse da el texto sin hablante', () => {
  const s = mountType('order_dialogue');
  s.put('Ben: Hello, Ana.', 'Ana: Hi!');
  assert.equal(s.comp.getResponse(), 'Hello, Ana. Hi!');
});

test('order_dialogue: turnos seguidos del mismo hablante y textos repetidos se colocan por separado', async () => {
  const it = dialogue({}, { lines: [{ speaker: 'A', text: 'Yes.' }, { speaker: 'A', text: 'Yes.' }, { speaker: 'A', text: 'Sure.' }], shuffle: false });
  const s = mountType('order_dialogue', { it });
  for (const b of s.tray()) click(b);
  click(s.btn(OB_TEXT.check));
  await s.env.flush();
  assert.equal(s.calls[0].result, 'correct');
  assert.equal(s.calls[0].responseRaw, 'Yes. Yes. Sure.');
});

test('order_dialogue con 2 y con 8 líneas funciona', async () => {
  for (const n of [2, 8]) {
    const lines = Array.from({ length: n }, (_, i) => ({ speaker: i % 2 ? 'B' : 'A', text: `t${i}` }));
    const s = mountType('order_dialogue', { it: dialogue({}, { lines, shuffle: false }) });
    for (const b of s.tray()) click(b);
    click(s.btn(OB_TEXT.check));
    await s.env.flush();
    assert.equal(s.calls[0].result, 'correct', `n=${n}`);
  }
});

test('order_dialogue: un ítem con data.blocks en vez de data.lines lanza en español', () => {
  assert.throws(() => mountType('order_dialogue', { it: { id: 'x', type: 'order_dialogue', prompt_es: 'x', data: { blocks: ['a', 'b'] } } }), /bad_lines/);
});

test('order_blocks sigue mostrando solo el texto (sin hablante) por el mismo envoltorio', () => {
  const s = mountType('order_blocks', { it: { id: 'x', type: 'order_blocks', prompt_es: 'x', data: { blocks: ['a', 'b'], shuffle: false } } });
  assert.deepEqual(s.tray().map((b) => b.textContent), ['a', 'b']);
  assert.equal(s.root.querySelector('.ob__correct--lines'), null);
});

test('el espaciador y la frase vacía siguen igual en order_dialogue', () => {
  const s = mountType('order_dialogue');
  assert.equal(has(s.root.querySelector('.ob__spacer'), 'hidden'), false);
  s.put('Ana: Hi!');
  assert.equal(has(s.root.querySelector('.ob__spacer'), 'hidden'), true);
});

// ---- huecos que dejaron vivas las roturas (2.4-T1, punto 7) ----
test('el log recibido llega al componente: un fallo al pintar la corrección se registra', async () => {
  const reg = spyRegistry();
  const logs = [];
  registerOrderTypes(reg, { rng: createRng(7), log: (...a) => logs.push(a) });
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const comp = reg.table.get('order_dialogue').mount(root, dialogue(), { doc: env.doc, submit: async () => ({ status: 'saved' }) });
  const tray = () => root.querySelectorAll('.ob__tray .ob__block');
  for (const t of ['Ben: Hello, Ana.', 'Ana: Hi!', 'Ana: How are you?']) click(tray().find((b) => b.textContent === t));
  root.querySelector('.ob__feedback').replaceChildren = () => { throw new Error('boom'); };
  click(root.querySelectorAll('button').find((b) => b.textContent.trim() === OB_TEXT.check));
  await env.flush();
  assert.equal(logs.length, 1);
  assert.ok(comp);
});

test('order_dialogue: los nombres accesibles también llevan el hablante', () => {
  const s = mountType('order_dialogue');
  assert.equal(s.trayBlock('Ben: Hello, Ana.').getAttribute('aria-label'), OB_TEXT.trayName('Ben: Hello, Ana.'));
  s.put('Ben: Hello, Ana.');
  const placed = s.root.querySelector('.ob__block--placed');
  assert.equal(placed.getAttribute('aria-label'), OB_TEXT.placedName(1, 'Ben: Hello, Ana.'));
});

test('order_dialogue: tras un orden incorrecto, cada línea puesta dice con texto si está fuera de lugar y con su hablante', async () => {
  const s = mountType('order_dialogue');
  s.put('Ben: Hello, Ana.', 'Ana: Hi!', 'Ana: How are you?');
  click(s.btn(OB_TEXT.check));
  await s.env.flush();
  const placed = s.root.querySelectorAll('.ob__block--placed');
  assert.ok(placed[0].getAttribute('aria-label').includes('Ben: Hello, Ana.'));
  assert.ok(placed[0].getAttribute('aria-label').includes(OB_TEXT.flagOff));
  assert.ok(placed[2].getAttribute('aria-label').includes('Ana: How are you?'));
  assert.ok(placed[2].getAttribute('aria-label').includes(OB_TEXT.flagOk));
});

test('order_dialogue: cada línea de la solución lleva el idioma de los bloques', async () => {
  const s = mountType('order_dialogue');
  click(s.btn(OB_TEXT.dontKnow));
  await s.env.flush();
  for (const x of s.root.querySelectorAll('.ob__correct strong')) assert.equal(x.getAttribute('lang'), 'en');
});
