// @purpose: Pruebas del componente base de elección (ui/exercises/choice.js, 2.3-T1) con DOM falso: render, barajado, respuesta, «No sé», doble toque, múltiple y limpieza.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createChoice, CH_TEXT } from '../ui/exercises/choice.js';
import { createExerciseRegistry } from '../ui/exercises/index.js';
import { arrange } from '../core/choice.js';
import { createRng } from '../core/rng.js';
import { makeEnv } from './_fakeDom.mjs';

const ev = (type, extra = {}) => ({ type, preventDefault() {}, ...extra });
const click = (el) => el.dispatchEvent(ev('click'));

const item = (extra = {}) => ({
  id: 'g.x.0001', type: 'choose_correct', prompt_es: 'Completa la frase.', prompt_en: 'She ___ to work.', situation: 'Rutina',
  data: { options: ['go', 'goes', 'going', 'gone'], correct: 1 },
  distractors: [{ text: 'go', code: 'GRM.S3' }, { text: 'going', code: 'GRM.ING' }, { text: 'gone', code: 'GRM.PP' }],
  ...extra,
});

function setup({ it = item(), factory = {}, submit } = {}) {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const calls = [];
  const sub = async (a) => { calls.push(a); return submit ? submit(a) : { status: 'saved' }; };
  const m = createChoice({ rng: createRng(5), log: () => {}, ...factory }).mount(root, it, { doc: env.doc, submit: sub });
  const opts = () => root.querySelectorAll('.ch__option');
  const optByText = (t) => opts().find((o) => o.querySelector('.ch__text').textContent === t);
  const btn = (label) => root.querySelectorAll('button').find((b) => b.textContent.trim() === label);
  const on = () => opts().filter((o) => o.getAttribute('aria-checked') === 'true').map((o) => o.querySelector('.ch__text').textContent);
  const verdict = () => root.querySelector('.fb__verdict');
  const flagOf = (t) => optByText(t).querySelector('.ch__flag').textContent;
  const hidden = (el) => el.getAttribute('hidden') !== null;
  return { env, root, m, calls, opts, optByText, btn, on, verdict, flagOf, hidden };
}

test('render: enunciado, hueco accesible, situación, opciones con letra y roles de radio', () => {
  const { root, opts } = setup();
  assert.equal(root.querySelector('.ch__situation').textContent, 'Situación: Rutina');
  assert.equal(root.querySelector('.ch__prompt').textContent, 'Completa la frase.');
  const stem = root.querySelector('.ch__stem');
  assert.equal(stem.getAttribute('lang'), 'en');
  const gap = stem.querySelector('.ch__gap');
  assert.equal(gap.getAttribute('role'), 'img');
  assert.equal(gap.getAttribute('aria-label'), CH_TEXT.gap);
  assert.equal(root.querySelector('.ch__instruction').textContent, CH_TEXT.pickOne);
  const group = root.querySelector('.ch__options');
  assert.equal(group.getAttribute('role'), 'radiogroup');
  assert.equal(group.getAttribute('aria-labelledby'), root.querySelector('.ch__prompt').getAttribute('id'));
  assert.equal(opts().length, 4);
  assert.deepEqual(opts().map((o) => o.querySelector('.ch__mark').textContent), ['A', 'B', 'C', 'D']);
  for (const o of opts()) {
    assert.equal(o.tagName.toLowerCase(), 'button');
    assert.equal(o.getAttribute('type'), 'button');
    assert.equal(o.getAttribute('role'), 'radio');
    assert.equal(o.getAttribute('aria-checked'), 'false');
    assert.equal(o.querySelector('.ch__text').getAttribute('lang'), 'en');
  }
  // Roving tabindex: solo la primera es tabulable.
  assert.deepEqual(opts().map((o) => o.getAttribute('tabindex')), ['0', '-1', '-1', '-1']);
});

test('sin prompt_en, sin situación y con optionsLang/stemLang: solo se pinta lo que hay', () => {
  const { root, opts } = setup({ it: item({ prompt_en: undefined, situation: undefined }), factory: { optionsLang: 'es', stemLang: 'es' } });
  assert.equal(root.querySelector('.ch__stem'), null);
  assert.equal(root.querySelector('.ch__situation'), null);
  assert.equal(opts()[0].querySelector('.ch__text').getAttribute('lang'), 'es');
});

test('barajado: el orden en pantalla es el de arrange con la misma semilla y cada botón conserva su índice original', () => {
  const { opts } = setup();
  const expected = arrange(4, { rng: createRng(5) });
  assert.deepEqual(opts().map((o) => Number(o.dataset.index)), expected);
  const texts = ['go', 'goes', 'going', 'gone'];
  assert.deepEqual(opts().map((o) => o.querySelector('.ch__text').textContent), expected.map((i) => texts[i]));
  assert.notDeepEqual(expected, [0, 1, 2, 3], 'la semilla de la prueba debería mover algo');
});

test('data.shuffle === false conserva el orden del contenido', () => {
  const it = item({ data: { options: ['A uno', 'B dos', 'C tres'], correct: 0, shuffle: false } });
  const { opts } = setup({ it });
  assert.deepEqual(opts().map((o) => o.querySelector('.ch__text').textContent), ['A uno', 'B dos', 'C tres']);
});

test('elegir: una sola opción marcada a la vez; tocar la elegida no la quita', () => {
  const { optByText, opts, on } = setup();
  click(optByText('go'));
  assert.deepEqual(on(), ['go']);
  click(optByText('goes'));
  assert.deepEqual(on(), ['goes']);
  click(optByText('goes'));
  assert.deepEqual(on(), ['goes']);
  assert.equal(opts().filter((o) => o.getAttribute('tabindex') === '0').length, 1);
  assert.equal(optByText('goes').getAttribute('tabindex'), '0');
});

test('«Comprobar» sin elegir: no envía, avisa y no bloquea; elegir borra el aviso', async () => {
  const { env, root, calls, btn, optByText } = setup();
  click(btn(CH_TEXT.check));
  await env.flush();
  assert.equal(calls.length, 0);
  assert.equal(root.querySelector('.ch__msg').textContent, CH_TEXT.emptyOne);
  click(optByText('goes'));
  assert.equal(root.querySelector('.ch__msg').textContent, '');
});

test('acierto: envía correct con responseRaw y sin códigos, pinta veredicto, marca y oculta las acciones', async () => {
  const { env, calls, btn, optByText, verdict, flagOf, hidden, root, opts } = setup();
  click(optByText('goes'));
  click(btn(CH_TEXT.check));
  await env.flush();
  assert.deepEqual(calls, [{ result: 'correct', hint: false, responseRaw: 'goes', errorCodes: [] }]);
  assert.equal(verdict().textContent, CH_TEXT.correct);
  assert.ok(verdict().classList.contains('fb__verdict--correct'));
  assert.equal(root.querySelector('.ch__correct'), null);
  assert.equal(flagOf('goes'), CH_TEXT.flagRight);
  assert.ok(optByText('goes').classList.contains('ch__option--right'));
  assert.ok(hidden(root.querySelector('.ch__actions')));
  assert.ok(opts().every((o) => o.getAttribute('aria-disabled') === 'true'));
});

test('fallo con distractor con code: envía wrong + errorCodes y muestra la correcta marcada', async () => {
  const { env, calls, btn, optByText, verdict, flagOf, root } = setup();
  click(optByText('go'));
  click(btn(CH_TEXT.check));
  await env.flush();
  assert.deepEqual(calls, [{ result: 'wrong', hint: false, responseRaw: 'go', errorCodes: ['GRM.S3'] }]);
  assert.equal(verdict().textContent, CH_TEXT.wrong);
  assert.equal(root.querySelector('.ch__correct').textContent, `${CH_TEXT.answerIs} goes`);
  assert.equal(flagOf('go'), CH_TEXT.flagYours);
  assert.ok(optByText('go').classList.contains('ch__option--wrong'));
  assert.equal(flagOf('goes'), CH_TEXT.flagRight);
  assert.equal(flagOf('going'), '');
});

test('CA 2: «No sé» envía dont_know sin elección, marca la correcta y no marca ninguna como tuya', async () => {
  const { env, calls, btn, optByText, verdict, flagOf, opts } = setup();
  click(btn(CH_TEXT.dontKnow));
  await env.flush();
  assert.deepEqual(calls, [{ result: 'dont_know', dontKnow: true, hint: false }]);
  assert.equal(verdict().textContent, CH_TEXT.dont);
  assert.ok(verdict().classList.contains('fb__verdict--dont'));
  assert.equal(flagOf('goes'), CH_TEXT.flagRight);
  assert.ok(opts().every((o) => !o.classList.contains('ch__option--wrong')));
});

test('«No sé» con una opción ya elegida no la cuenta como respuesta', async () => {
  const { env, calls, btn, optByText } = setup();
  click(optByText('go'));
  click(btn(CH_TEXT.dontKnow));
  await env.flush();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].result, 'dont_know');
  assert.equal(calls[0].responseRaw, undefined);
});

test('«No sé» está siempre en el DOM, también con 8 opciones y en modo múltiple', () => {
  const eight = item({ data: { options: Array.from({ length: 8 }, (_, i) => `opción ${i}`), correct: 3 }, distractors: [] });
  for (const [it, factory] of [[eight, {}], [item(), { multiple: true }], [item(), { confirm: false }]]) {
    const { btn } = setup({ it, factory });
    assert.ok(btn(CH_TEXT.dontKnow), JSON.stringify(factory));
  }
});

test('doble toque: «Comprobar» dos veces envía una sola vez; tocar opciones después no cambia nada', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const { env, calls, btn, optByText, on } = setup({ submit: () => gate.then(() => ({ status: 'saved' })) });
  click(optByText('goes'));
  click(btn(CH_TEXT.check));
  click(btn(CH_TEXT.check));
  click(btn(CH_TEXT.dontKnow));
  click(optByText('go'));
  assert.equal(calls.length, 1);
  assert.deepEqual(on(), ['goes']);
  release();
  await env.flush();
  click(btn(CH_TEXT.check));
  click(optByText('go'));
  await env.flush();
  assert.equal(calls.length, 1);
  assert.deepEqual(on(), ['goes']);
});

test('mientras se guarda, las opciones y los botones están bloqueados', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const { env, btn, optByText, opts, root } = setup({ submit: () => gate.then(() => ({ status: 'saved' })) });
  click(optByText('goes'));
  click(btn(CH_TEXT.check));
  assert.ok(opts().every((o) => o.getAttribute('aria-disabled') === 'true'));
  assert.ok(btn(CH_TEXT.check).disabled || btn(CH_TEXT.check).hasAttribute('disabled'));
  assert.equal(root.querySelector('.fb__verdict'), null, 'sin corrección hasta que se guarde');
  release();
  await env.flush();
  assert.ok(root.querySelector('.fb__verdict'));
});

test('si submit devuelve error o lanza: se desbloquea, avisa y se puede reintentar', async () => {
  for (const failing of [() => ({ status: 'error', message: 'Sin espacio.' }), () => ({ status: 'error' }), () => { throw new Error('x'); }]) {
    let n = 0;
    const { env, calls, btn, optByText, root, opts, verdict } = setup({ submit: (a) => { n += 1; return n === 1 ? failing(a) : { status: 'saved' }; } });
    click(optByText('goes'));
    click(btn(CH_TEXT.check));
    await env.flush();
    assert.equal(verdict(), null);
    assert.ok(root.querySelector('.ch__msg').textContent.length > 0);
    assert.ok(opts().every((o) => o.getAttribute('aria-disabled') === null));
    click(btn(CH_TEXT.check));
    await env.flush();
    assert.equal(calls.length, 2);
    assert.equal(verdict().textContent, CH_TEXT.correct);
  }
});

test('submit ignorado (ejercicio ya cerrado) no pinta corrección; duplicate sí', async () => {
  const a = setup({ submit: () => ({ status: 'ignored' }) });
  click(a.optByText('goes'));
  click(a.btn(CH_TEXT.check));
  await a.env.flush();
  assert.equal(a.verdict(), null);
  const b = setup({ submit: () => ({ status: 'duplicate' }) });
  click(b.optByText('goes'));
  click(b.btn(CH_TEXT.check));
  await b.env.flush();
  assert.ok(b.verdict());
});

test('destroy mientras se guarda: no pinta, no lanza y no deja listeners', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const base = makeEnv().stats.live();
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const m = createChoice({ rng: createRng(1) }).mount(root, item(), { doc: env.doc, submit: () => gate.then(() => ({ status: 'saved' })) });
  const before = env.stats.live();
  assert.ok(before > base);
  click(root.querySelectorAll('.ch__option')[0]);
  click(root.querySelectorAll('button').find((b) => b.textContent.trim() === CH_TEXT.check));
  m.destroy();
  m.destroy();
  release();
  await env.flush();
  assert.equal(root.querySelector('.ch'), null);
  assert.equal(env.stats.live(), 0, 'quedan listeners vivos');
});

test('ciclos de montar y destruir no acumulan listeners (≥ 6)', () => {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const noop = async () => ({ status: 'saved' });
  for (let i = 0; i < 8; i += 1) {
    const m = createChoice({ rng: createRng(i + 1), multiple: i % 2 === 0 }).mount(root, item(), { doc: env.doc, submit: noop });
    m.destroy();
  }
  assert.equal(env.stats.live(), 0);
});

test('getResponse: la elección actual, null sin elegir, y lo enviado tras responder', async () => {
  const { env, m, btn, optByText } = setup();
  assert.equal(m.getResponse(), null);
  click(optByText('going'));
  assert.equal(m.getResponse(), 'going');
  click(btn(CH_TEXT.check));
  await env.flush();
  assert.equal(m.getResponse(), 'going');
  const d = setup();
  click(d.btn(CH_TEXT.dontKnow));
  await d.env.flush();
  assert.equal(d.m.getResponse(), null);
});

test('selección múltiple: casillas, alternar, conjunto exacto correct y aviso propio si está vacío', async () => {
  const it = { type: 'choose_correct', prompt_es: 'Elige dos.', data: { options: ['apple', 'water', 'book', 'money'], correct: [0, 2], shuffle: false } };
  const a = setup({ it, factory: { multiple: true } });
  assert.equal(a.root.querySelector('.ch__options').getAttribute('role'), 'group');
  assert.equal(a.root.querySelector('.ch__instruction').textContent, CH_TEXT.pickMany);
  assert.ok(a.opts().every((o) => o.getAttribute('role') === 'checkbox' && o.getAttribute('tabindex') === '0'));
  click(a.btn(CH_TEXT.check));
  assert.equal(a.root.querySelector('.ch__msg').textContent, CH_TEXT.emptyMany);
  click(a.optByText('apple'));
  click(a.optByText('book'));
  click(a.optByText('water'));
  click(a.optByText('water'));
  assert.deepEqual(a.on(), ['apple', 'book']);
  click(a.btn(CH_TEXT.check));
  await a.env.flush();
  assert.deepEqual(a.calls, [{ result: 'correct', hint: false, responseRaw: 'apple | book', errorCodes: [] }]);
  assert.equal(a.root.querySelector('.ch__correct'), null);
});

test('múltiple: faltar una marca «Faltó esta» y muestra las respuestas; sobrar marca la elegida de más', async () => {
  const it = { type: 'choose_correct', prompt_es: 'Elige dos.', data: { options: ['apple', 'water', 'book'], correct: [0, 2], shuffle: false }, distractors: [{ text: 'water', code: 'LEX.UNC' }] };
  const a = setup({ it, factory: { multiple: true } });
  click(a.optByText('apple'));
  click(a.btn(CH_TEXT.check));
  await a.env.flush();
  assert.equal(a.calls[0].result, 'wrong');
  assert.equal(a.flagOf('apple'), CH_TEXT.flagRight);
  assert.equal(a.flagOf('book'), CH_TEXT.flagMissed);
  assert.equal(a.root.querySelector('.ch__correct').textContent, `${CH_TEXT.answersAre} apple · book`);
  const b = setup({ it, factory: { multiple: true } });
  for (const t of ['apple', 'water', 'book']) click(b.optByText(t));
  click(b.btn(CH_TEXT.check));
  await b.env.flush();
  assert.deepEqual(b.calls[0].errorCodes, ['LEX.UNC']);
  assert.equal(b.flagOf('water'), CH_TEXT.flagYours);
});

test('múltiple: «No sé» marca todas las correctas como «Correcta»', async () => {
  const it = { type: 'choose_correct', prompt_es: 'Elige dos.', data: { options: ['apple', 'water', 'book'], correct: [0, 2], shuffle: false } };
  const a = setup({ it, factory: { multiple: true } });
  click(a.btn(CH_TEXT.dontKnow));
  await a.env.flush();
  assert.equal(a.flagOf('apple'), CH_TEXT.flagRight);
  assert.equal(a.flagOf('book'), CH_TEXT.flagRight);
});

test('confirm: false → tocar una opción responde al instante y no hay «Comprobar»; en múltiple se ignora confirm', async () => {
  const a = setup({ factory: { confirm: false } });
  assert.equal(a.btn(CH_TEXT.check), undefined);
  click(a.optByText('goes'));
  click(a.optByText('go'));
  await a.env.flush();
  assert.deepEqual(a.calls.map((c) => c.result), ['correct']);
  const m = setup({ factory: { confirm: false, multiple: true } });
  assert.ok(m.btn(CH_TEXT.check));
  click(m.optByText('goes'));
  await m.env.flush();
  assert.equal(m.calls.length, 0);
});

test('teclado: ↓/↑ mueven y eligen en una sola opción; con «tocar = responder» solo mueven el foco', async () => {
  const a = setup();
  const group = a.root.querySelector('.ch__options');
  const key = (target, k) => group.dispatchEvent(ev('keydown', { key: k, target }));
  a.opts()[0].focus = () => {};
  key(a.opts()[0], 'ArrowDown');
  assert.equal(a.on().length, 1);
  assert.equal(a.opts()[1].getAttribute('aria-checked'), 'true');
  key(a.opts()[1], 'ArrowUp');
  assert.equal(a.opts()[0].getAttribute('aria-checked'), 'true');
  key(a.opts()[0], 'End');
  assert.equal(a.opts()[3].getAttribute('aria-checked'), 'true');
  const b = setup({ factory: { confirm: false } });
  const g2 = b.root.querySelector('.ch__options');
  g2.dispatchEvent(ev('keydown', { key: 'ArrowDown', target: b.opts()[0] }));
  await b.env.flush();
  assert.equal(b.calls.length, 0);
  assert.equal(b.on().length, 0);
});

test('seguridad: el texto del contenido entra como texto, nunca como HTML', () => {
  const evil = '<img src=x onerror=alert(1)> & "comillas"';
  const it = item({ prompt_es: evil, prompt_en: evil, data: { options: [evil, 'ok'], correct: 1 }, distractors: [] });
  const { root } = setup({ it });
  assert.equal(root.querySelectorAll('img').length, 0);
  assert.ok(root.querySelector('.ch__text').textContent.includes('<img'));
});

test('montaje inválido: lanza TypeError en español (el registro lo convierte en «no soportado»)', () => {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  const comp = createChoice({ rng: createRng(1) });
  const at = (container, it) => () => comp.mount(container, it, { doc: env.doc });
  assert.throws(at(null, item()), /contenedor/);
  assert.throws(at(root, null), /sin tipo|tipo/);
  assert.throws(at(root, item({ type: '' })), /tipo/);
  assert.throws(at(root, item({ prompt_es: ' ' })), /prompt_es/);
  assert.throws(at(root, item({ data: { options: ['a'], correct: 0 } })), /bad_options/);
  assert.throws(at(root, item({ data: { options: ['a', 'b'], correct: 5 } })), /bad_correct/);
  assert.equal(root.querySelector('.ch'), null, 'un montaje fallido no deja nada en el contenedor');
});

test('opciones de createChoice inválidas lanzan en voz alta', () => {
  assert.throws(() => createChoice({ rng: {} }), /rng/);
  assert.throws(() => createChoice({ multiple: 'sí' }), /multiple/);
  assert.throws(() => createChoice({ confirm: 1 }), /confirm/);
  assert.throws(() => createChoice({ optionsLang: 'English' }), /optionsLang/);
  assert.doesNotThrow(() => createChoice());
  assert.doesNotThrow(() => createChoice(null));
});

test('con el registro real de ejercicios: monta, responde con exerciseType y un ítem inválido da «no soportado»', async () => {
  const env = makeEnv();
  const slot = env.doc.createElement('div');
  // El DOM falso no define ownerDocument (el navegador real sí); el registro no pasa `doc`, así que se lo damos al contenedor.
  slot.ownerDocument = env.doc;
  env.doc.body.appendChild(slot);
  const items = { ok: item(), broken: item({ data: { options: ['solo'], correct: 0 } }) };
  const reg = createExerciseRegistry({ resolveItem: (id) => items[id], components: { choose_correct: createChoice({ rng: createRng(2), log: () => {} }) }, log: () => {} });
  const got = [];
  const ctx = { index: 0, total: 1, submit: async (a) => { got.push(a); return { status: 'saved' }; } };
  const h = await reg.mount(slot, { itemId: 'ok', exerciseType: 'choose_correct' }, ctx);
  assert.ok(h);
  const opts = slot.querySelectorAll('.ch__option');
  click(opts.find((o) => o.querySelector('.ch__text').textContent === 'goes'));
  click(slot.querySelectorAll('button').find((b) => b.textContent.trim() === CH_TEXT.check));
  await env.flush();
  assert.equal(got.length, 1);
  assert.equal(got[0].exerciseType, 'choose_correct');
  assert.equal(got[0].result, 'correct');
  h.destroy();
  assert.equal(slot.querySelector('.ch'), null);
  const slot2 = env.doc.createElement('div');
  assert.equal(await reg.mount(slot2, { itemId: 'broken', exerciseType: 'choose_correct' }, ctx), null);
});
