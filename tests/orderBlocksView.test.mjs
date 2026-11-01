// @purpose: Pruebas del componente de ordenar bloques (ui/exercises/orderBlocks.js, 2.4-T1 punto 4a) con DOM falso: toques, deshacer, reiniciar, envío, corrección y casos límite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOrderBlocks, OB_TEXT } from '../ui/exercises/orderBlocks.js';
import { createRng } from '../core/rng.js';
import { makeEnv } from './_fakeDom.mjs';

const click = (el) => el.dispatchEvent({ type: 'click', preventDefault() {} });

const item = (extra = {}) => ({
  id: 'g.ord.0001', type: 'order_blocks', prompt_es: 'Ordena la frase.', situation: 'En la cafetería',
  data: { blocks: ['I would like', 'a coffee', 'please'] },
  ...extra,
});

function setup({ it = item(), factory = {}, submit } = {}) {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const calls = [];
  const logs = [];
  const sub = async (a) => { calls.push(a); return submit ? submit(a) : { status: 'saved' }; };
  const comp = createOrderBlocks({ rng: createRng(7), log: (...a) => logs.push(a), ...factory }).mount(root, it, { doc: env.doc, submit: sub });
  const tray = () => root.querySelectorAll('.ob__tray .ob__block');
  const trayBlock = (t) => tray().find((b) => b.textContent === t);
  const placed = () => root.querySelectorAll('.ob__block--placed');
  const placedTexts = () => placed().map((b) => b.textContent);
  const btn = (label) => root.querySelectorAll('button').find((b) => b.textContent.trim() === label);
  const put = (...texts) => { for (const t of texts) click(trayBlock(t)); };
  return { env, root, comp, calls, logs, tray, trayBlock, placed, placedTexts, btn, put };
}

test('monta la frase, la bandeja con todos los bloques y «No sé» a la vista', () => {
  const s = setup();
  assert.equal(s.tray().length, 3);
  assert.deepEqual(s.tray().map((b) => b.textContent).sort(), ['I would like', 'a coffee', 'please']);
  assert.equal(s.placed().length, 0);
  assert.ok(s.btn(OB_TEXT.dontKnow));
  assert.ok(s.btn(OB_TEXT.check));
  assert.ok(s.root.querySelector('.ob__situation').textContent.includes('En la cafetería'));
});

test('la bandeja no queda en el orden del contenido (con shuffle por defecto)', () => {
  for (let seed = 1; seed <= 20; seed += 1) {
    const s = setup({ factory: { rng: createRng(seed) } });
    assert.notDeepEqual(s.tray().map((b) => b.textContent), ['I would like', 'a coffee', 'please'], `semilla ${seed}`);
  }
});

test('data.shuffle === false conserva el orden del contenido', () => {
  const s = setup({ it: item({ data: { blocks: ['a', 'b', 'c'], shuffle: false } }) });
  assert.deepEqual(s.tray().map((b) => b.textContent), ['a', 'b', 'c']);
});

test('tocar un bloque de la bandeja lo coloca; la bandeja no cambia de sitio', () => {
  const s = setup();
  const before = s.tray().map((b) => b.textContent);
  s.put('a coffee');
  assert.deepEqual(s.placedTexts(), ['a coffee']);
  assert.deepEqual(s.tray().map((b) => b.textContent), before);
  assert.equal(s.trayBlock('a coffee').getAttribute('aria-disabled'), 'true');
});

test('un bloque ya colocado no se puede colocar dos veces desde la bandeja', () => {
  const s = setup();
  s.put('a coffee', 'a coffee');
  assert.deepEqual(s.placedTexts(), ['a coffee']);
});

test('tocar un bloque de la frase lo quita y vuelve a quedar libre en la bandeja', () => {
  const s = setup();
  s.put('please', 'a coffee');
  click(s.placed().find((b) => b.textContent === 'please'));
  assert.deepEqual(s.placedTexts(), ['a coffee']);
  assert.equal(s.trayBlock('please').getAttribute('aria-disabled'), null);
});

test('deshacer quita lo último que se hizo y reiniciar vacía la frase', () => {
  const s = setup();
  s.put('I would like', 'a coffee');
  click(s.btn(OB_TEXT.undo));
  assert.deepEqual(s.placedTexts(), ['I would like']);
  s.put('a coffee', 'please');
  click(s.btn(OB_TEXT.reset));
  assert.deepEqual(s.placedTexts(), []);
  assert.equal(s.tray().filter((b) => b.getAttribute('aria-disabled')).length, 0);
});

test('comprobar con la frase incompleta no envía y avisa', async () => {
  const s = setup();
  s.put('I would like');
  click(s.btn(OB_TEXT.check));
  await s.env.flush();
  assert.equal(s.calls.length, 0);
  assert.equal(s.root.querySelector('.ob__msg').textContent, OB_TEXT.incomplete);
});

test('orden correcto: envía correct con la frase y pinta «¡Bien!»', async () => {
  const s = setup();
  s.put('I would like', 'a coffee', 'please');
  click(s.btn(OB_TEXT.check));
  await s.env.flush();
  assert.deepEqual(s.calls, [{ result: 'correct', hint: false, responseRaw: 'I would like a coffee please', errorCodes: [] }]);
  assert.equal(s.root.querySelector('.fb__verdict').textContent, OB_TEXT.correct);
  assert.equal(s.root.querySelector('.ob__correct'), null);
  assert.equal(s.comp.getResponse(), 'I would like a coffee please');
});

test('otro orden válido de accept también cuenta como correcto', async () => {
  const s = setup({ it: item({ accept: ['please a coffee I would like'] }) });
  s.put('please', 'a coffee', 'I would like');
  click(s.btn(OB_TEXT.check));
  await s.env.flush();
  assert.equal(s.calls[0].result, 'correct');
});

test('orden incorrecto: envía wrong, muestra la solución y marca las posiciones', async () => {
  const s = setup();
  s.put('a coffee', 'I would like', 'please');
  click(s.btn(OB_TEXT.check));
  await s.env.flush();
  assert.equal(s.calls[0].result, 'wrong');
  assert.equal(s.root.querySelector('.fb__verdict').textContent, OB_TEXT.wrong);
  assert.equal(s.root.querySelector('.ob__correct').textContent, 'I would like a coffee please');
  assert.equal(s.root.querySelector('.ob__misplaced').textContent, OB_TEXT.misplaced('1, 2'));
  assert.equal(s.root.querySelectorAll('.ob__block--off').length, 2);
});

test('«No sé» envía dont_know sin elección y muestra la solución', async () => {
  const s = setup();
  s.put('please');
  click(s.btn(OB_TEXT.dontKnow));
  await s.env.flush();
  assert.deepEqual(s.calls, [{ result: 'dont_know', dontKnow: true, hint: false }]);
  assert.equal(s.root.querySelector('.fb__verdict').textContent, OB_TEXT.dont);
  assert.equal(s.root.querySelector('.ob__correct').textContent, 'I would like a coffee please');
  assert.equal(s.comp.getResponse(), null);
});

test('después de responder no se puede cambiar nada ni responder dos veces', async () => {
  const s = setup();
  s.put('I would like', 'a coffee', 'please');
  click(s.btn(OB_TEXT.check));
  await s.env.flush();
  click(s.btn(OB_TEXT.dontKnow));
  click(s.btn(OB_TEXT.undo));
  click(s.placed()[0]);
  await s.env.flush();
  assert.equal(s.calls.length, 1);
  assert.equal(s.placed().length, 3);
});

test('si guardar falla: se desbloquea, avisa y deja responder otra vez', async () => {
  let n = 0;
  const s = setup({ submit: () => (++n === 1 ? { status: 'error' } : { status: 'saved' }) });
  s.put('I would like', 'a coffee', 'please');
  click(s.btn(OB_TEXT.check));
  await s.env.flush();
  assert.equal(s.root.querySelector('.ob__msg').textContent, OB_TEXT.saveFail);
  assert.equal(s.root.querySelector('.fb__verdict'), null);
  click(s.btn(OB_TEXT.check));
  await s.env.flush();
  assert.equal(s.calls.length, 2);
  assert.equal(s.root.querySelector('.fb__verdict').textContent, OB_TEXT.correct);
});

test('bloques repetidos («very», «very») son distintos y se colocan por separado', async () => {
  const s = setup({ it: item({ data: { blocks: ['It is', 'very', 'very', 'good'], shuffle: false } }) });
  const very = s.tray().filter((b) => b.textContent === 'very');
  click(very[0]);
  click(very[1]);
  assert.equal(s.placed().length, 2);
});

test('texto con marcas HTML se muestra como texto, nunca como HTML', () => {
  const s = setup({ it: item({ data: { blocks: ['<b>x</b>', 'y'], shuffle: false } }) });
  assert.equal(s.tray()[0].textContent, '<b>x</b>');
  assert.equal(s.root.querySelectorAll('b').length, 0);
});

test('con 2 y con 12 bloques funciona (CA 5 de 2.4)', async () => {
  for (const n of [2, 12]) {
    const blocks = Array.from({ length: n }, (_, i) => `w${i}`);
    const s = setup({ it: item({ data: { blocks } }) });
    s.put(...blocks);
    click(s.btn(OB_TEXT.check));
    await s.env.flush();
    assert.equal(s.calls[0].result, 'correct', `n=${n}`);
  }
});

test('responseRaw sin controles y con tope de 2000 caracteres', async () => {
  const long = 'x'.repeat(200);
  const blocks = Array.from({ length: 12 }, (_, i) => (i === 0 ? `a\u0007b ${long.slice(0, 190)}` : long));
  const s = setup({ it: item({ data: { blocks, shuffle: false } }) });
  for (const b of s.tray()) click(b); // son iguales entre sí: se tocan uno por uno, no por texto
  click(s.btn(OB_TEXT.check));
  await s.env.flush();
  const raw = s.calls[0].responseRaw;
  assert.ok(raw.length <= 2000);
  assert.ok(!/[\u0000-\u001F\u007F]/.test(raw));
  assert.ok(raw.startsWith('a b '));
});

test('getResponse mientras se arma la frase: lo colocado, o null si no hay nada', () => {
  const s = setup();
  assert.equal(s.comp.getResponse(), null);
  s.put('please', 'a coffee');
  assert.equal(s.comp.getResponse(), 'please a coffee');
});

test('ítems inválidos y opciones inválidas lanzan error en español', () => {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  const mount = (it, f) => createOrderBlocks({ rng: createRng(1), ...f }).mount(root, it, { doc: env.doc });
  assert.throws(() => mount(item({ data: { blocks: ['solo'] } })), /bad_blocks/);
  assert.throws(() => mount(item({ data: null })), /no_data/);
  assert.throws(() => mount(item({ prompt_es: '' })), /prompt_es/);
  assert.throws(() => mount({ prompt_es: 'x', data: { blocks: ['a', 'b'] } }), /tipo/);
  assert.throws(() => createOrderBlocks({ rng: {} }), /rng/);
  assert.throws(() => createOrderBlocks({ lang: 'inglés' }), /lang/);
});

test('destroy retira el componente, es idempotente y no responde tarde', async () => {
  let release;
  const s = setup({ submit: () => new Promise((r) => { release = r; }) });
  s.put('I would like', 'a coffee', 'please');
  click(s.btn(OB_TEXT.check));
  s.comp.destroy();
  s.comp.destroy();
  release({ status: 'saved' });
  await s.env.flush();
  assert.equal(s.root.querySelector('.ob'), null);
});

test('un fallo al pintar la corrección se registra y la respuesta ya estaba enviada', async () => {
  const s = setup();
  s.put('a coffee', 'I would like', 'please');
  s.root.querySelector('.ob__feedback').replaceChildren = () => { throw new Error('boom'); };
  click(s.btn(OB_TEXT.check));
  await s.env.flush();
  assert.equal(s.calls.length, 1);
  assert.equal(s.logs.length, 1);
});

// ---- huecos que dejaron vivas las roturas (2.4-T1, punto 4a-bis) ----
const has = (el, name) => el.getAttribute(name) !== null && el.getAttribute(name) !== undefined;

test('un bloque usado lleva la clase is-used y su etiqueta dice que ya está colocado', () => {
  const s = setup();
  s.put('a coffee');
  const used = s.trayBlock('a coffee');
  const free = s.trayBlock('please');
  assert.ok(used.classList.contains('is-used'));
  assert.ok(!free.classList.contains('is-used'));
  assert.equal(used.getAttribute('aria-label'), OB_TEXT.usedName('a coffee'));
  assert.equal(free.getAttribute('aria-label'), OB_TEXT.trayName('please'));
});

test('deshacer y empezar de nuevo están desactivados sin nada que deshacer y se activan al colocar', () => {
  const s = setup();
  assert.ok(has(s.btn(OB_TEXT.undo), 'disabled'));
  assert.ok(has(s.btn(OB_TEXT.reset), 'disabled'));
  s.put('please');
  assert.ok(!has(s.btn(OB_TEXT.undo), 'disabled'));
  assert.ok(!has(s.btn(OB_TEXT.reset), 'disabled'));
  click(s.btn(OB_TEXT.reset));
  assert.ok(has(s.btn(OB_TEXT.undo), 'disabled'));
});

test('la frase se muestra en el orden en que se colocaron los bloques', () => {
  const s = setup();
  s.put('please', 'I would like', 'a coffee');
  assert.deepEqual(s.placedTexts(), ['please', 'I would like', 'a coffee']);
});

test('getResponse mientras se arma: sin controles y con tope de 2000', () => {
  const blocks = Array.from({ length: 12 }, (_, i) => (i === 0 ? 'a\u0007b' : 'y'.repeat(200)));
  const s = setup({ it: item({ data: { blocks, shuffle: false } }) });
  for (const b of s.tray()) click(b);
  const r = s.comp.getResponse();
  assert.equal(r.length, 2000);
  assert.ok(r.startsWith('a b y'));
});

test('el aviso de «frase incompleta» sigue hasta que algo cambia la frase', () => {
  const s = setup();
  s.put('please');
  click(s.btn(OB_TEXT.check));
  assert.equal(s.root.querySelector('.ob__msg').textContent, OB_TEXT.incomplete);
  click(s.trayBlock('please')); // ya colocado: no cambia nada
  assert.equal(s.root.querySelector('.ob__msg').textContent, OB_TEXT.incomplete);
  s.put('a coffee');
  assert.equal(s.root.querySelector('.ob__msg').textContent, '');
});

test('tras un fallo al guardar, deshacer y empezar de nuevo siguen activos', async () => {
  const s = setup({ submit: () => ({ status: 'error' }) });
  s.put('I would like', 'a coffee', 'please');
  click(s.btn(OB_TEXT.check));
  await s.env.flush();
  assert.ok(!has(s.btn(OB_TEXT.undo), 'disabled'));
  assert.ok(!has(s.btn(OB_TEXT.reset), 'disabled'));
  assert.ok(!has(s.btn(OB_TEXT.check), 'disabled'));
  assert.ok(!s.root.querySelector('.ob').classList.contains('is-locked'));
});

test('con status ignored no se pinta corrección', async () => {
  const s = setup({ submit: () => ({ status: 'ignored' }) });
  s.put('a coffee', 'I would like', 'please');
  click(s.btn(OB_TEXT.check));
  await s.env.flush();
  assert.equal(s.root.querySelector('.fb__verdict'), null);
});

test('si se destruye mientras se guarda, no se pinta nada en el componente retirado', async () => {
  let release;
  const s = setup({ submit: () => new Promise((r) => { release = r; }) });
  s.put('a coffee', 'I would like', 'please');
  click(s.btn(OB_TEXT.check));
  s.comp.destroy();
  release({ status: 'saved' });
  await s.env.flush();
  assert.equal(s.comp.el.querySelector('.fb__verdict'), null);
});

test('el rng recibido se usa: misma semilla, misma bandeja; semillas distintas, otras bandejas', () => {
  const blocks = Array.from({ length: 8 }, (_, i) => `w${i}`);
  const it = item({ data: { blocks } });
  const order = (seed) => setup({ it, factory: { rng: createRng(seed) } }).tray().map((b) => b.textContent).join(',');
  assert.equal(order(3), order(3));
  assert.ok(new Set([1, 2, 3, 4, 5].map(order)).size > 1);
  let used = 0;
  const spy = { shuffle: (l) => { used += 1; return [...l].reverse(); } };
  const s = setup({ it, factory: { rng: spy } });
  assert.equal(used, 1);
  assert.equal(s.tray()[0].textContent, 'w7');
});

test('la frase vacía se oculta al colocar y vuelve al quitar todo', () => {
  const s = setup();
  const empty = s.root.querySelector('.ob__empty');
  const spacer = s.root.querySelector('.ob__spacer');
  assert.ok(has(empty, 'hidden') === false && has(spacer, 'hidden') === false);
  s.put('please');
  assert.ok(has(empty, 'hidden') && has(spacer, 'hidden'));
  click(s.btn(OB_TEXT.reset));
  assert.ok(!has(empty, 'hidden') && !has(spacer, 'hidden'));
});

test('lang de los bloques: en por defecto y el de la opción si se da', () => {
  assert.equal(setup().tray()[0].getAttribute('lang'), 'en');
  assert.equal(setup({ factory: { lang: 'es' } }).tray()[0].getAttribute('lang'), 'es');
  const s = setup();
  s.put('please');
  assert.equal(s.placed()[0].getAttribute('lang'), 'en');
});
