// @purpose: Pruebas de la pantalla base de entrada de texto (2.5-T1 punto 2): atributos del teclado, envío único, vacío, «No sé», pista, errata, errores de guardado y limpieza.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTextAnswer, TA_TEXT } from '../ui/exercises/textAnswer.js';
import { makeEnv } from './_fakeDom.mjs';

const ev = (type, extra = {}) => ({ type, preventDefault() {}, ...extra });
const click = (el) => el.dispatchEvent(ev('click'));

const item = (extra = {}) => ({
  id: 'x', type: 'fill_verb', prompt_es: 'Ella trabaja aquí.', explain_es: 'Tercera persona: -s.',
  grammar_note_es: 'She works.', nuance_es: 'Presente simple.',
  accept: ['works', 'is working'], data: { hint: 'Verbo work', mask: 'first_letter' }, ...extra,
});

function setup(it = item(), { submit, factory = {}, ctx = {} } = {}) {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const calls = [];
  const sub = async (a) => { calls.push(a); return submit ? submit(a, calls.length) : { status: 'saved' }; };
  const m = createTextAnswer(factory).mount(root, it, { doc: env.doc, submit: sub, ...ctx });
  const btn = (label) => root.querySelectorAll('button').find((b) => b.textContent.includes(label));
  const input = root.querySelectorAll('input')[0];
  const type = (v) => { input.value = v; input.dispatchEvent(ev('input')); };
  return { env, root, m, calls, btn, input, type };
}

test('pinta enunciado, máscara con nombre accesible y campo de ejercicio sin autocorrección', () => {
  const { root, input } = setup();
  assert.equal(root.querySelectorAll('.ta__prompt')[0].textContent, 'Ella trabaja aquí.');
  assert.equal(root.querySelectorAll('.ta__mask')[0].textContent, 'w _ _ _ _');
  assert.ok(root.querySelectorAll('.ta__mask')[0].getAttribute('aria-label').includes('w _ _ _ _'));
  assert.equal(input.getAttribute('autocapitalize'), 'off');
  assert.equal(input.getAttribute('autocorrect'), 'off');
  assert.equal(input.getAttribute('spellcheck'), 'false');
  assert.equal(input.getAttribute('lang'), 'en');
});

test('answerLang es: el campo lleva lang es y compare recibe lang es', async () => {
  let seen = null;
  const compare = (t, a, o) => { seen = o; return { result: 'correct', matched: a[0], diff: [], spellingFlags: [], errorCodes: [] }; };
  const { env, input, btn, type } = setup(item({ type: 'translate_word' }), { factory: { answerLang: 'es', compare } });
  assert.equal(input.getAttribute('lang'), 'es');
  type('trabaja');
  click(btn('Comprobar'));
  await env.flush();
  assert.equal(seen.lang, 'es');
  assert.equal(seen.almostAtWordEnd, true);
});

test('acierto y variante: envía correct con el texto escrito y pinta el veredicto', async () => {
  for (const v of ['works', '  Works  ', 'is working']) {
    const { env, root, m, calls, btn, type } = setup();
    type(v);
    click(btn('Comprobar'));
    await env.flush();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].result, 'correct');
    assert.equal(calls[0].responseRaw, v.trim());
    assert.equal(root.querySelectorAll('.fb__verdict--correct').length, 1);
    assert.equal(m.getResponse(), v.trim());
  }
});

test('Enter en el campo envía como «Comprobar»', async () => {
  const { env, calls, input, type } = setup();
  type('works');
  input.dispatchEvent({ type: 'keydown', key: 'Enter', preventDefault() {} });
  await env.flush();
  assert.equal(calls.length, 1);
});

test('error: wrong con corrección, respuesta, explicación y notas; el acierto no las muestra', async () => {
  const { env, root, calls, btn, type } = setup();
  type('work');
  click(btn('Comprobar'));
  await env.flush();
  assert.notEqual(calls[0].result, 'correct');
  assert.ok(root.querySelectorAll('.fb__correct')[0].textContent.includes('works'));
  assert.equal(root.querySelectorAll('.fb__explain').length, 1);
  assert.equal(root.querySelectorAll('.fb__grammar').length, 1);
  assert.equal(root.querySelectorAll('.fb__nuance').length, 1);
  const ok = setup();
  ok.type('works');
  click(ok.btn('Comprobar'));
  await ok.env.flush();
  assert.equal(ok.root.querySelectorAll('.fb__explain').length, 0);
  assert.equal(ok.root.querySelectorAll('.fb__grammar').length, 0);
});

test('vacío (también espacios, NBSP y ancho cero) no se envía y avisa; el campo sigue libre', async () => {
  for (const v of ['', '   ', '\u00A0', '\u200B\uFEFF']) {
    const { env, root, calls, btn, type } = setup();
    type(v);
    click(btn('Comprobar'));
    await env.flush();
    assert.equal(calls.length, 0);
    assert.equal(root.querySelectorAll('.ta__msg')[0].textContent, TA_TEXT.empty);
    assert.equal(root.querySelectorAll('input')[0].getAttribute('disabled'), null);
  }
});

test('«No sé» envía dont_know sin diff y sin lenguaje de fallo, y muestra la respuesta', async () => {
  const { env, root, calls, btn } = setup();
  click(btn('No sé'));
  await env.flush();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].result, 'dont_know');
  assert.equal(calls[0].dontKnow, true);
  assert.equal(calls[0].responseRaw, undefined);
  assert.equal(root.querySelectorAll('.word-diff-wrap').length, 0);
  assert.equal(root.querySelectorAll('.fb__verdict')[0].textContent, TA_TEXT.dont);
  assert.ok(root.querySelectorAll('.fb__correct')[0].textContent.includes('works'));
});

test('pista: solo si el ítem la trae; envía hint:true', async () => {
  const a = setup();
  assert.ok(a.btn('Ver pista'));
  click(a.btn('Ver pista'));
  assert.equal(a.root.querySelectorAll('.ta__hint')[0].textContent, 'Verbo work');
  a.type('works');
  click(a.btn('Comprobar'));
  await a.env.flush();
  assert.equal(a.calls[0].hint, true);
  const b = setup(item({ data: {} }));
  assert.equal(b.btn('Ver pista'), undefined);
  b.type('works');
  click(b.btn('Comprobar'));
  await b.env.flush();
  assert.equal(b.calls[0].hint, false);
});

test('doble toque (Comprobar y «No sé») solo envía una vez y bloquea todo', async () => {
  const { env, root, calls, btn, type } = setup();
  type('works');
  click(btn('Comprobar')); click(btn('Comprobar')); click(btn('No sé'));
  await env.flush();
  assert.equal(calls.length, 1);
  assert.notEqual(root.querySelectorAll('input')[0].getAttribute('disabled'), null);
});

test('si el guardado da error se avisa y se puede reintentar (un solo veredicto al final)', async () => {
  const { env, root, calls, btn, type } = setup(item(), { submit: (a, n) => (n === 1 ? { status: 'error', message: 'Fallo al guardar' } : { status: 'saved' }) });
  type('works');
  click(btn('Comprobar'));
  await env.flush();
  assert.equal(root.querySelectorAll('.ta__msg')[0].textContent, 'Fallo al guardar');
  assert.equal(root.querySelectorAll('.fb__verdict').length, 0);
  click(btn('Comprobar'));
  await env.flush();
  assert.equal(calls.length, 2);
  assert.equal(root.querySelectorAll('.fb__verdict').length, 1);
});

test('TRAMPA-32: un carácter de control escrito no llega al responseRaw', async () => {
  const { env, calls, btn, type } = setup();
  type('wor\u0001ks\u0085');
  click(btn('Comprobar'));
  await env.flush();
  assert.equal(calls[0].responseRaw.includes('\u0001'), false);
  assert.equal(calls[0].responseRaw.includes('\u0085'), false);
});

test('errata (almost con marca): avisa de la ortografía y crea la tarjeta de deletreo tras guardar', async () => {
  const spelled = [];
  const order = [];
  const cards = { ensureSpell: async (f) => { order.push('spell'); spelled.push(f); return { status: 'created' }; } };
  const compare = () => ({ result: 'almost', matched: 'works', diff: [{ text: 'wrks', status: 'close', expected: 'works' }], spellingFlags: [{ word: 'wrks', expected: 'works' }], errorCodes: [] });
  const { env, root, btn, type } = setup(item(), { factory: { compare }, ctx: { cards, entry: {} }, submit: () => { order.push('save'); return { status: 'saved' }; } });
  type('wrks');
  click(btn('Comprobar'));
  await env.flush();
  assert.deepEqual(order, ['save', 'spell']);
  assert.equal(spelled[0].expected, 'works');
  assert.ok(root.querySelectorAll('.ta__spell')[0].textContent.includes('tarjeta de deletreo'));
  assert.equal(root.querySelectorAll('.fb__verdict--almost').length, 1);
});

test('errata con ensureSpell que falla: la respuesta queda guardada y se avisa', async () => {
  const cards = { ensureSpell: async () => { throw new Error('x'); } };
  const compare = () => ({ result: 'almost', matched: 'works', diff: [], spellingFlags: [{ word: 'wrks', expected: 'works' }], errorCodes: [] });
  const { env, root, calls, btn, type } = setup(item(), { factory: { compare }, ctx: { cards, entry: {} } });
  type('wrks');
  click(btn('Comprobar'));
  await env.flush();
  assert.equal(calls.length, 1);
  assert.ok(root.querySelectorAll('.ta__spell')[0].textContent.includes('no pude crear'));
});

test('getResponse: null sin nada, lo escrito mientras responde y lo enviado después', async () => {
  const { env, m, btn, type } = setup();
  assert.equal(m.getResponse(), null);
  type(' works ');
  assert.equal(m.getResponse(), 'works');
  click(btn('Comprobar'));
  await env.flush();
  assert.equal(m.getResponse(), 'works');
});

test('ítem sin accept o contenedor ausente: lanza TypeError (el registro lo cuenta como no soportado)', () => {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  assert.throws(() => createTextAnswer().mount(root, item({ accept: [] }), { doc: env.doc }), TypeError);
  assert.throws(() => createTextAnswer().mount(root, null, { doc: env.doc }), TypeError);
  assert.throws(() => createTextAnswer().mount(null, item(), {}), TypeError);
});

test('destroy es idempotente, quita el nodo y una respuesta que llega tarde no lanza', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const { env, root, m, btn, type } = setup(item(), { submit: async () => { await gate; return { status: 'saved' }; } });
  type('works');
  click(btn('Comprobar'));
  m.destroy();
  m.destroy();
  release();
  await env.flush();
  assert.equal(root.querySelectorAll('.ta').length, 0);
});

// ---- Cierre de roturas vivas (4.R) ----
const verdictOf = (res, extra = {}) => () => ({ result: res, matched: null, diff: [], spellingFlags: [], errorCodes: [], ...extra });

test('«No sé» tras ver la pista envía hint:true y getResponse da null', async () => {
  const { env, m, calls, btn } = setup();
  click(btn('Ver pista'));
  click(btn('No sé'));
  await env.flush();
  assert.equal(calls[0].hint, true);
  assert.equal(m.getResponse(), null);
});

test('los errorCodes de compare llegan al envío', async () => {
  const compare = verdictOf('wrong', { errorCodes: ['GRAM.S3'] });
  const { env, calls, btn, type } = setup(item(), { factory: { compare } });
  type('work');
  click(btn('Comprobar'));
  await env.flush();
  assert.deepEqual(calls[0].errorCodes, ['GRAM.S3']);
});

test('la respuesta mostrada es la variante que compare devolvió; en un acierto no se repite', async () => {
  const w = setup(item(), { factory: { compare: verdictOf('wrong', { matched: 'is working' }) } });
  w.type('x');
  click(w.btn('Comprobar'));
  await w.env.flush();
  assert.ok(w.root.querySelectorAll('.fb__correct')[0].textContent.includes('is working'));
  const ok = setup();
  ok.type('works');
  click(ok.btn('Comprobar'));
  await ok.env.flush();
  assert.equal(ok.root.querySelectorAll('.fb__correct').length, 0);
});

test('envío ignorado (otra pantalla ya siguió): no pinta corrección', async () => {
  const { env, root, btn, type } = setup(item(), { submit: () => ({ status: 'ignored' }) });
  type('works');
  click(btn('Comprobar'));
  await env.flush();
  assert.equal(root.querySelectorAll('.fb__verdict').length, 0);
});

test('destroy durante el envío: nada se pinta después', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const { env, m, btn, type } = setup(item(), { submit: async () => { await gate; return { status: 'saved' }; } });
  type('works');
  click(btn('Comprobar'));
  m.destroy();
  release();
  await env.flush();
  assert.equal(m.el.querySelectorAll('.fb__verdict').length, 0);
});

const almostFlag = verdictOf('almost', { matched: 'works', spellingFlags: [{ word: 'wrks', expected: 'works' }] });

test('errata: un envío duplicado también crea la tarjeta; uno con error no la crea', async () => {
  for (const [status, expected] of [['duplicate', 1], ['saved', 1], ['error', 0]]) {
    let n = 0;
    const cards = { ensureSpell: async () => { n += 1; return { status: 'created' }; } };
    const { env, btn, type } = setup(item(), { factory: { compare: almostFlag }, ctx: { cards, entry: {} }, submit: () => ({ status }) });
    type('wrks');
    click(btn('Comprobar'));
    await env.flush();
    assert.equal(n, expected, status);
  }
});

test('la marca ortográfica solo sale con «almost»; sin ensureSpell se avisa sin cola', async () => {
  let n = 0;
  const cards = { ensureSpell: async () => { n += 1; return { status: 'created' }; } };
  const w = setup(item(), { factory: { compare: verdictOf('wrong', { spellingFlags: [{ word: 'wrks', expected: 'works' }] }) }, ctx: { cards, entry: {} } });
  w.type('wrks');
  click(w.btn('Comprobar'));
  await w.env.flush();
  assert.equal(n, 0);
  assert.equal(w.root.querySelectorAll('.ta__spell').length, 0);
  const s = setup(item(), { factory: { compare: almostFlag }, ctx: { cards: {}, entry: {} } });
  s.type('wrks');
  click(s.btn('Comprobar'));
  await s.env.flush();
  const note = s.root.querySelectorAll('.ta__spell')[0].textContent;
  assert.ok(note.includes('works') && !note.includes('tarjeta'));
});

test('con tarjeta (cardId): las insignias se leen al montar y otra vez tras guardar', async () => {
  let reads = 0;
  const cards = { read: async () => { reads += 1; return null; }, now: () => new Date('2026-10-31T12:00:00Z') };
  const { env, btn, type } = setup(item(), { ctx: { cards, entry: { cardId: 'it#0' } } });
  await env.flush();
  const first = reads;
  assert.ok(first >= 1);
  type('works');
  click(btn('Comprobar'));
  await env.flush();
  assert.equal(reads, first + 1);
});

test('si el envío lanza, se registra en log y se puede reintentar', async () => {
  const logged = [];
  let n = 0;
  const { env, root, calls, btn, type } = setup(item(), { factory: { log: (...a) => logged.push(a) }, submit: () => { n += 1; if (n === 1) throw new Error('boom'); return { status: 'saved' }; } });
  type('works');
  click(btn('Comprobar'));
  await env.flush();
  assert.equal(logged.length, 1);
  assert.equal(root.querySelectorAll('.ta__msg')[0].textContent, TA_TEXT.saveFail);
  click(btn('Comprobar'));
  await env.flush();
  assert.equal(calls.length, 2);
});

// ---- opción `prompt` (2.5-T2, punto 2): el enunciado lo puede pintar quien registra el tipo ----
test('prompt: la función recibe el ítem y h, y su resultado sustituye al párrafo de prompt_es', () => {
  let seen = null;
  const prompt = (it, kit) => { seen = { it, hasH: typeof kit.h === 'function', hasDoc: Boolean(kit.doc) }; return kit.h('p', { class: 'mi-enunciado' }, 'Hecho a medida'); };
  const { root } = setup(item(), { factory: { prompt } });
  assert.equal(seen.it.id, 'x');
  assert.equal(seen.hasH, true);
  assert.equal(seen.hasDoc, true);
  assert.equal(root.querySelectorAll('.mi-enunciado')[0].textContent, 'Hecho a medida');
  assert.equal(root.querySelectorAll('.ta__prompt').length, 0);
});

test('prompt: una lista de nodos se pinta en orden, y null o lista vacía no pintan enunciado', () => {
  const two = (it, { h }) => [h('p', { class: 'uno' }, 'A'), null, h('p', { class: 'dos' }, 'B')];
  const a = setup(item(), { factory: { prompt: two } });
  assert.deepEqual(a.root.querySelectorAll('p').filter((p) => ['uno', 'dos'].includes(p.getAttribute('class'))).map((p) => p.textContent), ['A', 'B']);
  for (const nothing of [() => null, () => [], () => undefined]) {
    const b = setup(item(), { factory: { prompt: nothing } });
    assert.equal(b.root.querySelectorAll('.ta__prompt').length, 0);
    assert.ok(b.btn('Comprobar'));
  }
});

test('prompt: si la función lanza, se avisa a log y se usa el párrafo de prompt_es', () => {
  const logged = [];
  const { root } = setup(item(), { factory: { prompt: () => { throw new Error('rota'); }, log: (...a) => logged.push(a) } });
  assert.equal(logged.length, 1);
  assert.match(String(logged[0][0]), /no se pudo pintar el enunciado/);
  assert.equal(root.querySelectorAll('.ta__prompt')[0].textContent, 'Ella trabaja aquí.');
});

test('prompt: sin la opción, o con algo que no es función, el enunciado por defecto sigue igual y no se avisa a log', () => {
  for (const bad of [undefined, null, 'x', 5, {}]) {
    const logged = [];
    const { root } = setup(item(), { factory: { prompt: bad, log: (...a) => logged.push(a) } });
    assert.equal(root.querySelectorAll('.ta__prompt')[0].textContent, 'Ella trabaja aquí.');
    assert.equal(root.querySelectorAll('.ta__prompt')[0].getAttribute('lang'), 'es');
    assert.deepEqual(logged, []);
  }
});

test('enunciado por defecto: un ítem sin prompt_es (o de solo espacios) no pinta párrafo vacío', () => {
  for (const blank of [undefined, null, '', '   ']) {
    const { root } = setup(item({ prompt_es: blank }));
    assert.equal(root.querySelectorAll('.ta__prompt').length, 0, JSON.stringify(blank));
  }
});

test('prompt: el envío y la corrección no cambian con un enunciado propio', async () => {
  const { env, root, calls, btn, type } = setup(item(), { factory: { prompt: (it, { h }) => h('p', { class: 'ta__prompt' }, 'Otro') } });
  type('works');
  click(btn('Comprobar'));
  await env.flush();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].result, 'correct');
  assert.equal(root.querySelectorAll('.fb__verdict--correct').length, 1);
});

test('una respuesta de 5000 letras se guarda y la corrección se pinta recortada (sin lanzar)', async () => {
  const logs = [];
  const { env, root, calls, btn, type } = setup(item(), { factory: { log: (...a) => logs.push(a) } });
  type('a'.repeat(5000));
  click(btn('Comprobar'));
  for (let i = 0; i < 6; i += 1) await env.flush();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].responseRaw.length <= 2000, true);
  assert.equal(logs.length, 0, 'no debe avisar de ningún fallo');
  assert.equal(root.querySelectorAll('.fb__verdict').length, 1, 'se pinta el veredicto');
  assert.ok(root.textContent.includes('…'), 'el texto largo se recorta con «…»');
});

test('si wordDiff rechaza la diferencia, la respuesta ya guardada no se pierde y se avisa a log', async () => {
  const logs = [];
  const compare = () => ({ result: 'wrong', matched: null, diff: Array.from({ length: 501 }, () => ({ text: 'x', status: 'correct' })), spellingFlags: [], errorCodes: [] });
  const { env, root, calls, btn, type } = setup(item(), { factory: { compare, log: (...a) => logs.push(a) } });
  type('zzz');
  click(btn('Comprobar'));
  for (let i = 0; i < 6; i += 1) await env.flush();
  assert.equal(calls.length, 1);
  assert.equal(root.querySelectorAll('.fb__verdict').length, 1, 'el veredicto se pinta igual');
  assert.ok(logs.some((l) => String(l[0]).includes('no se pudo pintar la diferencia')), 'se avisa a log');
});
