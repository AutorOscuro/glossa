// @purpose: Pruebas de la respuesta de phrase_cloze (2.2-T2): lógica pura, pista progresiva, «No sé», vacío, doble toque, corrección y limpieza.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countGaps, fillGaps, acceptList, hintFor, grade } from '../core/phraseCloze.js';
import { createPhraseCloze } from '../ui/exercises/phraseCloze.js';
import { makeEnv } from './_fakeDom.mjs';

const ev = (type, extra = {}) => ({ type, preventDefault() {}, ...extra });
const click = (el) => el.dispatchEvent(ev('click'));

const item = (extra = {}) => ({
  id: 'x', type: 'phrase_cloze', prompt_es: 'No pude enviarlo.', explain_es: 'Usa couldn\'t + verbo base.',
  accept: ['No, I couldn\'t send it.', 'No, I could not send it.'],
  data: { text: 'No, I ___ send it.', answers: [['couldn\'t', 'could not']] }, ...extra,
});

test('puro: huecos, relleno y aceptadas (de accept o del producto de answers)', () => {
  assert.equal(countGaps('a ___ b ____ c'), 2);
  assert.equal(countGaps('a _ b'), 0);
  assert.equal(fillGaps('a ___ b ___', ['x', ' y ']), 'a x b y');
  assert.equal(fillGaps('a ___ b ___', ['x']), 'a x b ');
  assert.deepEqual(acceptList(item()), item().accept);
  const noAcc = item({ accept: null, data: { text: 'I ___ it ___', answers: [['a', 'b'], ['c']] } });
  assert.deepEqual(acceptList(noAcc), ['I a it c', 'I b it c']);
  assert.deepEqual(acceptList({ data: {} }), []);
});

test('puro: pista nivel 1 = primera letra, nivel 2 = estructura, otro nivel = null', () => {
  assert.equal(hintFor(item(), 1), 'Empieza con «c…»');
  assert.equal(hintFor(item(), 2), 'c _ _ _ _ _ \' _');
  assert.equal(hintFor(item(), 0), null);
  assert.equal(hintFor(item(), 3), null);
  assert.equal(hintFor({ data: {} }, 1), null);
});

test('puro: grade correcto, con contracción equivalente, incorrecto y vacío', () => {
  assert.equal(grade(item(), ['couldn\'t']).result, 'correct');
  assert.equal(grade(item(), ['could not']).result, 'correct');
  assert.equal(grade(item(), ['can']).result, 'wrong');
  const e = grade(item(), ['  ']);
  assert.equal(e.empty, true);
  assert.equal(e.result, 'wrong');
  assert.equal(grade(item(), ['can']).typed, 'No, I can send it.');
});

test('puro: grade usa el compare inyectado y tolera basura', () => {
  const g = grade(item(), ['x'], { compare: () => ({ result: 'almost', matched: 'm', diff: [{ text: 'a', status: 'ok' }], spellingFlags: [{ word: 'a' }], errorCodes: ['MECH.CAP_I'] }) });
  assert.equal(g.result, 'almost');
  assert.deepEqual(g.errorCodes, ['MECH.CAP_I']);
  const b = grade(item(), ['x'], { compare: () => null });
  assert.equal(b.result, 'wrong');
  assert.deepEqual(b.diff, []);
  assert.equal(grade(null, null).empty, true);
});

function setup(it = item(), submit, factory = {}) {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const calls = [];
  const sub = submit ?? (async (a) => { calls.push(a); return { status: 'saved' }; });
  const wrapped = async (a) => { if (submit) calls.push(a); return sub(a); };
  const m = createPhraseCloze(factory).mount(root, it, { doc: env.doc, submit: wrapped });
  const btn = (label) => root.querySelectorAll('button').find((b) => b.textContent.includes(label));
  const type = (i, v) => { const inp = root.querySelectorAll('input')[i]; inp.value = v; inp.dispatchEvent(ev('input')); };
  return { env, root, m, calls, btn, type };
}

test('responder bien: envía correct con el texto completo y pinta la corrección', async () => {
  const { env, root, m, calls, btn, type } = setup();
  type(0, 'couldn\'t');
  click(btn('Comprobar'));
  await env.flush();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].result, 'correct');
  assert.equal(calls[0].hint, false);
  assert.equal(calls[0].responseRaw, 'No, I couldn\'t send it.');
  assert.ok(root.querySelectorAll('.fb__verdict--correct').length === 1);
  assert.equal(m.getResponse(), 'No, I couldn\'t send it.');
});

test('responder mal: envía wrong, muestra wordDiff, la respuesta correcta y la explicación', async () => {
  const { env, root, calls, btn, type } = setup();
  type(0, 'can');
  click(btn('Comprobar'));
  await env.flush();
  assert.equal(calls[0].result, 'wrong');
  assert.equal(root.querySelectorAll('.word-diff-wrap').length, 1);
  assert.ok(root.querySelectorAll('.pc__correct')[0].textContent.includes('No, I couldn\'t send it.'));
  assert.equal(root.querySelectorAll('.fb__explain').length, 1);
});

test('vacío no se envía y avisa; «No sé» envía dont_know sin lenguaje de fallo', async () => {
  const { env, root, calls, btn } = setup();
  click(btn('Comprobar'));
  await env.flush();
  assert.equal(calls.length, 0);
  assert.ok(root.querySelectorAll('.pc__msg')[0].textContent.includes('No sé'));
  click(btn('No sé'));
  await env.flush();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].result, 'dont_know');
  assert.equal(calls[0].dontKnow, true);
  assert.equal(root.querySelectorAll('.word-diff-wrap').length, 0);
  assert.ok(root.querySelectorAll('.pc__correct')[0].textContent.includes('couldn\'t'));
});

test('pista progresiva: 1.ª letra, luego estructura, luego se deshabilita; envía hint:true', async () => {
  const { env, root, calls, btn, type } = setup();
  click(btn('Ver pista'));
  assert.equal(root.querySelectorAll('.pc__hint')[0].textContent, 'Empieza con «c…»');
  click(btn('Otra pista'));
  assert.equal(root.querySelectorAll('.pc__hint')[0].textContent, 'c _ _ _ _ _ \' _');
  assert.equal(btn('Sin más pistas').getAttribute('disabled') !== null, true);
  type(0, 'couldn\'t');
  click(btn('Comprobar'));
  await env.flush();
  assert.equal(calls[0].hint, true);
});

test('doble toque en Comprobar solo envía una vez y después se bloquea todo', async () => {
  const { env, root, calls, btn, type } = setup();
  type(0, 'couldn\'t');
  const b = btn('Comprobar');
  click(b); click(b);
  await env.flush();
  assert.equal(calls.length, 1);
  assert.ok(root.querySelectorAll('input')[0].getAttribute('disabled') !== null);
});

test('si el guardado da error se puede reintentar y se avisa', async () => {
  let n = 0;
  const { env, root, calls, btn, type } = setup(item(), async (a) => { n += 1; return n === 1 ? { status: 'error', message: 'Fallo al guardar' } : { status: 'saved' }; });
  type(0, 'couldn\'t');
  click(btn('Comprobar'));
  await env.flush();
  assert.equal(root.querySelectorAll('.pc__msg')[0].textContent, 'Fallo al guardar');
  assert.equal(root.querySelectorAll('.fb__verdict').length, 0);
  click(btn('Comprobar'));
  await env.flush();
  assert.equal(calls.length, 2);
  assert.equal(root.querySelectorAll('.fb__verdict--correct').length, 1);
});

test('el micrófono está deshabilitado con aviso «disponible pronto»; los campos son de ejercicio', () => {
  const { root, btn } = setup();
  assert.ok(btn('Decir la respuesta').getAttribute('disabled') !== null);
  assert.ok(root.querySelectorAll('.pc__mic-note')[0].textContent.includes('disponible pronto'));
  const inp = root.querySelectorAll('input')[0];
  assert.equal(inp.getAttribute('autocapitalize'), 'off');
  assert.equal(inp.getAttribute('spellcheck'), 'false');
});

test('dos huecos: un campo por hueco y la frase se arma completa', async () => {
  const it = item({ accept: ['I have been here for two days.'], data: { text: 'I ___ been here ___ two days.', answers: [['have'], ['for']] } });
  const { env, root, calls, btn, type } = setup(it);
  assert.equal(root.querySelectorAll('input').length, 2);
  type(0, 'have'); type(1, 'for');
  click(btn('Comprobar'));
  await env.flush();
  assert.equal(calls[0].result, 'correct');
});

test('destroy es idempotente, no deja oyentes y un envío posterior no pinta nada', async () => {
  const { env, root, m, btn, type } = setup();
  type(0, 'couldn\'t');
  m.destroy(); m.destroy();
  assert.equal(root.querySelectorAll('.pc').length, 0);
  assert.equal(env.stats.live(), 0);
  void btn;
});

test('puro: dos guiones bajos ya son un hueco; accept propio manda sobre answers; grupo vacío no inventa aceptadas', () => {
  assert.equal(countGaps('a __ b'), 1);
  assert.deepEqual(acceptList({ accept: ['Solo esta.'], data: { text: 'I ___', answers: [['otra']] } }), ['Solo esta.']);
  assert.deepEqual(acceptList({ data: { text: 'I ___', answers: [[]] } }), []);
});

test('«No sé» después de una pista envía hint:true', async () => {
  const { env, calls, btn } = setup();
  click(btn('Ver pista'));
  click(btn('No sé'));
  await env.flush();
  assert.equal(calls[0].hint, true);
});

test('un clic extra en la pista ya agotada no cambia el texto', () => {
  const { root, btn } = setup();
  click(btn('Ver pista')); click(btn('Otra pista'));
  const t = root.querySelectorAll('.pc__hint')[0].textContent;
  click(btn('Sin más pistas'));
  assert.equal(root.querySelectorAll('.pc__hint')[0].textContent, t);
});

test('Enter dos veces en el campo solo envía una respuesta', async () => {
  const { env, root, calls, type } = setup();
  type(0, 'couldn\'t');
  const inp = root.querySelectorAll('input')[0];
  inp.dispatchEvent(ev('keydown', { key: 'Enter' }));
  inp.dispatchEvent(ev('keydown', { key: 'Enter' }));
  await env.flush();
  assert.equal(calls.length, 1);
});

test('acierto: sin línea de respuesta ni explicación (solo el elogio breve y la corrección)', async () => {
  const { env, root, btn, type } = setup();
  type(0, 'couldn\'t');
  click(btn('Comprobar'));
  await env.flush();
  assert.equal(root.querySelectorAll('.pc__correct').length, 0);
  assert.equal(root.querySelectorAll('.fb__explain').length, 0);
});

test('si la tarjeta se destruye con el envío en curso, al resolver no pinta nada', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const { env, m, btn, type } = setup(item(), async () => { await gate; return { status: 'saved' }; });
  type(0, 'couldn\'t');
  click(btn('Comprobar'));
  m.destroy();
  release();
  await env.flush();
  assert.equal(m.el.querySelectorAll('.fb__verdict').length, 0);
});

test('los códigos de mecánica de compare viajan en la respuesta enviada', async () => {
  const compare = () => ({ result: 'correct', matched: 'm', diff: [], spellingFlags: [], errorCodes: ['MECH.CAP_I'] });
  const { env, calls, btn, type } = setup(item(), undefined, { compare });
  type(0, 'x');
  click(btn('Comprobar'));
  await env.flush();
  assert.deepEqual(calls[0].errorCodes, ['MECH.CAP_I']);
});

test('con el registro real: monta por itemId, pone exerciseType y la respuesta llega a submit', async () => {
  const { createExerciseRegistry } = await import('../ui/exercises/index.js');
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  root.ownerDocument = env.doc; // en el navegador todo elemento lo trae; el DOM falso no
  const reg = createExerciseRegistry({ resolveItem: (id) => (id === 'x' ? item() : null) });
  reg.register('phrase_cloze', createPhraseCloze());
  const got = [];
  const handle = await reg.mount(root, { cardId: 'c', itemId: 'x', exerciseType: 'phrase_cloze' }, { index: 0, total: 1, doc: env.doc, submit: async (a) => { got.push(a); return { status: 'saved' }; } });
  assert.ok(handle, 'se montó');
  assert.equal(root.querySelectorAll('.pc').length, 1);
  const inp = root.querySelectorAll('input')[0];
  inp.value = 'could not'; inp.dispatchEvent(ev('input'));
  click(root.querySelectorAll('button').find((b) => b.textContent === 'Comprobar'));
  await env.flush();
  assert.equal(got[0].exerciseType, 'phrase_cloze');
  assert.equal(got[0].result, 'correct');
  handle.destroy();
});
