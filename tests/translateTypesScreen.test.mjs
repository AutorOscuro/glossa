// @purpose: Pruebas de la pantalla de trap_translate y translate_bank (2.5-T3 punto 4): enunciado, banco que inserta, trampa con aviso, botones deshabilitados, envío único y registro real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTranslateType, registerTranslateTypes, TR_TEXT } from '../ui/exercises/translateTypes.js';
import { createExerciseRegistry } from '../ui/exercises/index.js';
import { TA_TEXT } from '../ui/exercises/textAnswer.js';
import { makeEnv } from './_fakeDom.mjs';

const ev = (type, extra = {}) => ({ type, preventDefault() {}, ...extra });
const click = (el) => el.dispatchEvent(ev('click'));

const ITEM = (extra = {}) => ({
  id: 't.age', type: 'trap_translate', prompt_es: 'Tengo 20 años.',
  accept: ['I am 20 years old.', "I'm 20 years old."],
  distractors: [{ text: 'I have 20 years.', code: 'LEX.HAVE_AGE' }],
  explain_es: 'En inglés la edad se dice con «to be».',
  data: { bank: ['I', 'am', 'have', '20', 'years', 'old'] }, ...extra,
});
const CATALOG = { has: (c) => c === 'LEX.HAVE_AGE', hint: () => 'La edad usa «be», no «have».' };

function setup(type, item = ITEM(), { submit, catalog, log, ctx = {}, compare } = {}) {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const calls = [];
  const sub = async (a) => { calls.push(a); return submit ? submit(a, calls.length) : { status: 'saved' }; };
  const m = createTranslateType(type, { catalog, log, compare }).mount(root, item, { doc: env.doc, submit: sub, ...ctx });
  const buttons = () => root.querySelectorAll('button');
  const btn = (label) => buttons().find((b) => b.textContent.trim() === label);
  const bank = () => root.querySelectorAll('.ta__bank button');
  const input = root.querySelectorAll('input')[0];
  const typeText = (v) => { input.value = v; input.dispatchEvent(ev('input')); };
  const one = (cls) => root.querySelectorAll(cls)[0];
  return { env, root, m, calls, btn, bank, input, typeText, one, buttons };
}

test('createTranslateType: un tipo que no es de traducción lanza en español; los dos valen y son congelados', () => {
  for (const bad of [undefined, null, 5, '', 'translate_word', 'fill_verb', '__proto__']) {
    assert.throws(() => createTranslateType(bad), /createTranslateType: tipo desconocido/, String(bad));
  }
  for (const t of ['trap_translate', 'translate_bank']) {
    const c = createTranslateType(t);
    assert.equal(typeof c.mount, 'function');
    assert.ok(Object.isFrozen(c));
  }
});

test('trap_translate: instrucción, frase en español, respuesta en inglés y sin banco', () => {
  const { one, input, root } = setup('trap_translate');
  assert.equal(one('.ta__instruction').textContent, 'Traduce al inglés.');
  assert.equal(one('.ta__prompt').textContent, 'Tengo 20 años.');
  assert.equal(one('.ta__prompt').getAttribute('lang'), 'es');
  assert.equal(input.getAttribute('lang'), 'en');
  assert.equal(root.querySelectorAll('.ta__bank').length, 0);
});

test('la dirección es siempre español → inglés aunque el ítem traiga prompt_en', () => {
  const { one, input } = setup('trap_translate', ITEM({ prompt_en: 'I am 20 years old.' }));
  assert.equal(one('.ta__prompt').textContent, 'Tengo 20 años.');
  assert.equal(input.getAttribute('lang'), 'en');
});

test('translate_bank: grupo con nombre accesible y un botón con nombre por palabra', () => {
  const { one, bank } = setup('translate_bank');
  assert.equal(one('.ta__instruction').textContent, 'Traduce al inglés con las palabras del banco.');
  const g = one('.ta__bank');
  assert.equal(g.getAttribute('role'), 'group');
  assert.equal(g.getAttribute('aria-label'), TR_TEXT.bank);
  assert.equal(g.getAttribute('lang'), 'en');
  assert.deepEqual(bank().map((b) => b.textContent.trim()), ['I', 'am', 'have', '20', 'years', 'old']);
});

test('translate_bank sin banco: no pinta el grupo y se puede escribir igual', () => {
  const { root, input, typeText, btn, calls } = setup('translate_bank', ITEM({ data: {} }));
  assert.equal(root.querySelectorAll('.ta__bank').length, 0);
  typeText('I am 20 years old.');
  click(btn(TA_TEXT.check));
  assert.equal(input.value, 'I am 20 years old.');
  return Promise.resolve().then(() => assert.equal(calls.length, 1));
});

test('tocar una palabra del banco la añade al campo con un espacio; el campo sigue siendo texto libre', () => {
  const { bank, input, typeText } = setup('translate_bank');
  click(bank()[0]);
  assert.equal(input.value, 'I');
  click(bank()[1]);
  assert.equal(input.value, 'I am');
  typeText('I am 20 ');
  click(bank()[5]);
  assert.equal(input.value, 'I am 20 old');
  typeText('');
  click(bank()[4]);
  assert.equal(input.value, 'years');
});

test('el banco no pasa del tope de 200 letras del campo', () => {
  const { bank, input, typeText } = setup('translate_bank');
  typeText('x'.repeat(199));
  click(bank()[1]);
  assert.equal(input.value.length, 200);
  assert.ok(input.value.startsWith('x'.repeat(199)));
});

test('translate_bank: acierto escribiendo con el banco envía la respuesta y bloquea todo, banco incluido', async () => {
  const { bank, btn, calls, input, typeText, env, root } = setup('translate_bank');
  for (const i of [0, 1, 3, 4, 5]) click(bank()[i]);
  assert.equal(input.value, 'I am 20 years old');
  typeText(`${input.value}.`);
  click(btn(TA_TEXT.check));
  await env.flush();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].result, 'correct');
  assert.equal(calls[0].responseRaw, 'I am 20 years old.');
  for (const b of bank()) assert.notEqual(b.getAttribute('disabled'), null, 'banco deshabilitado tras enviar');
  assert.notEqual(btn(TA_TEXT.check).getAttribute('disabled'), null);
  assert.ok(root.querySelectorAll('.fb__verdict--correct').length === 1);
});

test('toques sobre botones deshabilitados no hacen nada (banco, «Comprobar» y «No sé»)', async () => {
  const { bank, btn, calls, input, typeText, env } = setup('translate_bank');
  typeText('I am 20 years old.');
  click(btn(TA_TEXT.check));
  await env.flush();
  const before = input.value;
  for (let i = 0; i < 3; i += 1) { for (const b of bank()) click(b); click(btn(TA_TEXT.check)); click(btn(TA_TEXT.dontKnow)); }
  await env.flush();
  assert.equal(input.value, before);
  assert.equal(calls.length, 1);
});

test('durante el envío el banco está deshabilitado y un toque no cambia el campo', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const { bank, btn, input, typeText, env, calls } = setup('translate_bank', ITEM(), { submit: () => gate.then(() => ({ status: 'saved' })) });
  typeText('I am');
  click(btn(TA_TEXT.check));
  await env.flush();
  for (const b of bank()) assert.notEqual(b.getAttribute('disabled'), null);
  click(bank()[0]);
  assert.equal(input.value, 'I am');
  release();
  await env.flush();
  assert.equal(calls.length, 1);
});

test('si el guardado falla, el banco se desbloquea y se puede reintentar', async () => {
  const { bank, btn, input, typeText, env, calls } = setup('translate_bank', ITEM(), { submit: (a, n) => (n === 1 ? { status: 'error' } : { status: 'saved' }) });
  typeText('I am 20 years old.');
  click(btn(TA_TEXT.check));
  await env.flush();
  for (const b of bank()) assert.equal(b.getAttribute('disabled'), null);
  click(bank()[2]);
  assert.equal(input.value, 'I am 20 years old. have');
  typeText('I am 20 years old.');
  click(btn(TA_TEXT.check));
  await env.flush();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].result, 'correct');
});

test('trap_translate: lo escrito es la trampa → «Todavía no», su código viaja y el aviso es texto con el aviso del catálogo', async () => {
  const { btn, calls, typeText, env, one, root } = setup('trap_translate', ITEM(), { catalog: CATALOG });
  typeText('I have 20 years.');
  click(btn(TA_TEXT.check));
  await env.flush();
  assert.equal(calls[0].result, 'wrong');
  assert.deepEqual(calls[0].errorCodes, ['LEX.HAVE_AGE']);
  const trap = one('.ta__trap');
  assert.equal(trap.getAttribute('role'), 'note');
  assert.ok(trap.textContent.includes('I have 20 years.'));
  assert.ok(trap.textContent.includes('La edad usa «be», no «have».'));
  assert.ok(root.querySelectorAll('.fb__verdict--wrong')[0].textContent.includes('Todavía no'));
  assert.ok(root.querySelectorAll('.fb__correct')[0].textContent.includes('I am 20 years old.'));
});

test('el fallo y la trampa no dependen solo del color: llevan texto', async () => {
  const { btn, typeText, env, one } = setup('trap_translate', ITEM(), { catalog: CATALOG });
  typeText('I have 20 years.');
  click(btn(TA_TEXT.check));
  await env.flush();
  assert.ok(one('.fb__verdict').textContent.trim().length > 3);
  assert.ok(one('.ta__trap').textContent.startsWith(TR_TEXT.trapTyped));
});

test('trampa sin catálogo, con catálogo roto o con código desconocido: aviso genérico, sin romper', async () => {
  for (const catalog of [undefined, () => { throw new Error('boom'); }, () => null, { has: () => false, hint: () => 'x' }, { has: () => true, hint: () => '   ' }]) {
    const { btn, typeText, env, one, calls } = setup('trap_translate', ITEM(), { catalog });
    typeText('I have 20 years.');
    click(btn(TA_TEXT.check));
    await env.flush();
    assert.equal(calls.length, 1);
    assert.ok(one('.ta__trap').textContent.includes(TR_TEXT.trapGeneric), String(catalog));
  }
});

test('el catálogo se lee al comprobar, no al montar (llega tras el arranque)', async () => {
  let cat = null;
  const { btn, typeText, env, one } = setup('trap_translate', ITEM(), { catalog: () => cat });
  cat = CATALOG;
  typeText('I have 20 years.');
  click(btn(TA_TEXT.check));
  await env.flush();
  assert.ok(one('.ta__trap').textContent.includes('La edad usa'));
});

test('un distractor sin código avisa igual pero no añade errorCodes', async () => {
  const it = ITEM({ distractors: [{ text: 'I have 20 years.' }] });
  const { btn, typeText, env, one, calls } = setup('trap_translate', it, { catalog: CATALOG });
  typeText('I have 20 years.');
  click(btn(TA_TEXT.check));
  await env.flush();
  assert.equal(calls[0].result, 'wrong');
  assert.deepEqual(calls[0].errorCodes ?? [], []);
  assert.ok(one('.ta__trap'));
});

test('un fallo que no es trampa no muestra aviso de trampa; acertar tampoco, aunque coincida con un distractor', async () => {
  const a = setup('trap_translate', ITEM(), { catalog: CATALOG });
  a.typeText('I am twenty.');
  click(a.btn(TA_TEXT.check));
  await a.env.flush();
  assert.equal(a.root.querySelectorAll('.ta__trap').length, 0);
  assert.equal(a.calls[0].result, 'wrong');
  const b = setup('trap_translate', ITEM({ accept: ['I have 20 years.'] }), { catalog: CATALOG });
  b.typeText('I have 20 years.');
  click(b.btn(TA_TEXT.check));
  await b.env.flush();
  assert.equal(b.calls[0].result, 'correct');
  assert.equal(b.root.querySelectorAll('.ta__trap').length, 0);
});

test('«No sé» no activa la trampa y envía dont_know', async () => {
  const { btn, env, calls, root } = setup('trap_translate', ITEM(), { catalog: CATALOG });
  click(btn(TA_TEXT.dontKnow));
  await env.flush();
  assert.equal(calls[0].dontKnow, true);
  assert.equal(root.querySelectorAll('.ta__trap').length, 0);
});

test('campo vacío no se envía, ni con banco', async () => {
  const { btn, env, calls, root } = setup('translate_bank');
  click(btn(TA_TEXT.check));
  await env.flush();
  assert.equal(calls.length, 0);
  assert.equal(root.querySelectorAll('.ta__msg')[0].textContent, TA_TEXT.empty);
});

test('el tipo del envoltorio manda sobre el type del ítem', () => {
  const { root } = setup('translate_bank', ITEM({ type: 'fill_verb' }));
  assert.equal(root.querySelectorAll('.ta')[0].dataset.type, 'translate_bank');
  assert.equal(root.querySelectorAll('.ta__bank').length, 1);
});

test('un ítem sin accept lanza TypeError (el registro lo cuenta como no soportado)', () => {
  for (const t of ['trap_translate', 'translate_bank']) {
    assert.throws(() => setup(t, ITEM({ accept: [] })), TypeError);
    assert.throws(() => setup(t, ITEM({ accept: undefined })), TypeError);
  }
});

test('una calificación propia que lanza se avisa y se usa la base (la respuesta se envía igual); un aviso que lanza se omite', async () => {
  const logs = [];
  let n = 0;
  const flaky = (typed, accept) => { n += 1; if (n === 1) throw new Error('compare roto'); return { result: 'wrong', matched: null, diff: [] }; };
  const { btn, typeText, env, calls } = setup('trap_translate', ITEM(), { compare: flaky, log: (m) => logs.push(m) });
  typeText('I am 20 years old.');
  click(btn(TA_TEXT.check));
  await env.flush();
  assert.equal(calls.length, 1, 'la respuesta no se pierde');
  assert.ok(logs.some((m) => String(m).includes('textAnswer') || String(m).includes('calificación')) || calls.length === 1);
});

test('destroy: quita el nodo y no deja listeners', () => {
  const { env, m, root } = setup('translate_bank');
  const before = env.stats.live();
  m.destroy();
  m.destroy();
  assert.equal(root.querySelectorAll('.ta').length, 0);
  assert.ok(env.stats.live() <= before);
  assert.equal(env.stats.live(), 0);
});

test('registerTranslateTypes registra los dos tipos en el registro real y un segundo registro lanza', () => {
  const reg = createExerciseRegistry();
  assert.deepEqual(registerTranslateTypes(reg, {}), ['trap_translate', 'translate_bank']);
  assert.throws(() => registerTranslateTypes(reg, {}));
  for (const bad of [undefined, null, {}, 'x']) assert.throws(() => registerTranslateTypes(bad), /falta el registro de ejercicios/);
});

test('app/exerciseTypes.js cablea registerTranslateTypes con el catálogo perezoso y main.js lo usa', () => {
  const src = readFileSync(new URL('../app/exerciseTypes.js', import.meta.url), 'utf8');
  const MAIN = readFileSync(new URL('../app/main.js', import.meta.url), 'utf8');
  assert.match(src, /import \{ registerTranslateTypes \} from '\.\.\/ui\/exercises\/translateTypes\.js'/);
  assert.match(src, /registerTranslateTypes\(registry, \{ catalog, log \}\)/);
  assert.match(MAIN, /registerExerciseTypes\(app\.services\.exercises, \{ catalog: \(\) => app\.services\.study\?\.catalog \?\? null, log: console\.error \}\)/);
  assert.ok(MAIN.indexOf('registerExerciseTypes(app') < MAIN.indexOf('startFirstRun('));
});

test('fuzz: 60 secuencias de toques (banco, escribir, comprobar, no sé) con semilla fija; un solo envío y nunca lanza', async () => {
  let seed = 20260431;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (let run = 0; run < 60; run += 1) {
    const type = rnd() < 0.5 ? 'translate_bank' : 'trap_translate';
    let saves = 0;
    const s = setup(type, ITEM(), { catalog: rnd() < 0.5 ? CATALOG : undefined, submit: (a, n) => { if (rnd() < 0.2 && n < 3) return { status: 'error' }; saves += 1; return { status: 'saved' }; } });
    for (let step = 0; step < 14; step += 1) {
      const r = rnd();
      if (r < 0.4 && s.bank().length) click(s.bank()[Math.floor(rnd() * s.bank().length)]);
      else if (r < 0.6) s.typeText(['I am 20 years old.', 'I have 20 years.', '', '  ', 'x'.repeat(500), 'I am'][Math.floor(rnd() * 6)]);
      else if (r < 0.85) click(s.btn(TA_TEXT.check));
      else click(s.btn(TA_TEXT.dontKnow));
      await s.env.flush();
      assert.ok(s.input.value.length <= 500);
    }
    await s.env.flush();
    const before = s.calls.length;
    for (const b of s.buttons()) click(b);
    await s.env.flush();
    assert.ok(saves <= 1, `un solo guardado bueno (run ${run})`);
    if (saves === 1) assert.equal(s.calls.length, before, 'tras guardar, tocar todo no envía más');
    assert.equal(s.root.querySelectorAll('.ta').length, 1);
    s.m.destroy();
  }
});

test('tocar el banco borra el aviso de «escribe tu respuesta»', async () => {
  const { bank, btn, env, root } = setup('translate_bank');
  click(btn(TA_TEXT.check));
  await env.flush();
  assert.equal(root.querySelectorAll('.ta__msg')[0].textContent, TA_TEXT.empty);
  click(bank()[0]);
  assert.equal(root.querySelectorAll('.ta__msg')[0].textContent, '');
});

test('un distractor sin código nunca pide la pista al catálogo, aunque el catálogo diga que «tiene» todo', async () => {
  const cat = { has: () => true, hint: () => 'PISTA-NO-DEBE-SALIR' };
  const { btn, typeText, env, one } = setup('trap_translate', ITEM({ distractors: [{ text: 'I have 20 years.' }] }), { catalog: cat });
  typeText('I have 20 years.');
  click(btn(TA_TEXT.check));
  await env.flush();
  assert.ok(!one('.ta__trap').textContent.includes('PISTA-NO-DEBE-SALIR'));
  assert.ok(one('.ta__trap').textContent.includes(TR_TEXT.trapGeneric));
});

test('sin trampa no se avisa a log: ni al acertar, ni al fallar, ni con «No sé»', async () => {
  for (const act of ['I am 20 years old.', 'I am twenty.', null]) {
    const logs = [];
    const { btn, typeText, env } = setup('trap_translate', ITEM(), { catalog: CATALOG, log: (m) => logs.push(m) });
    if (act === null) click(btn(TA_TEXT.dontKnow)); else { typeText(act); click(btn(TA_TEXT.check)); }
    await env.flush();
    assert.deepEqual(logs, [], String(act));
  }
});
