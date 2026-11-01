// @purpose: Pruebas de la pantalla de three_forms (ui/exercises/threeForms.js, 2.5-T3 punto 2): tres campos, vacío sin envío, resultado por faceta, forma cambiada, «No sé», un solo envío y limpieza.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createThreeForms, TF_TEXT } from '../ui/exercises/threeForms.js';
import { newCard } from '../core/srs.js';
import { makeEnv } from './_fakeDom.mjs';

const ev = (type, extra = {}) => ({ type, preventDefault() {}, ...extra });
const click = (el) => el.dispatchEvent(ev('click'));

const item = (extra = {}) => ({
  id: 'v.sing', type: 'three_forms', prompt_es: 'cantar', explain_es: 'Es un verbo irregular.',
  grammar_note_es: 'sing, sang, sung.', nuance_es: 'Patrón i-a-u.',
  data: { forms: { present: 'sing', past: 'sang', participle: 'sung' }, hint: 'Patrón i-a-u' }, ...extra,
});

function setup(it = item(), { submit, factory = {}, ctx = {} } = {}) {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const calls = [];
  const sub = async (a) => { calls.push(a); return submit ? submit(a, calls.length) : { status: 'saved' }; };
  const m = createThreeForms(factory).mount(root, it, { doc: env.doc, submit: sub, ...ctx });
  const btn = (label) => root.querySelectorAll('button').find((b) => b.textContent.includes(label));
  const inputs = root.querySelectorAll('input');
  const type = (a, b, c) => [a, b, c].forEach((v, i) => { inputs[i].value = v; inputs[i].dispatchEvent(ev('input')); });
  const row = (key) => root.querySelectorAll('.tf__form').find((r) => r.getAttribute('data-form') === key);
  return { env, root, m, calls, btn, inputs, type, row };
}
const settle = async (env) => { for (let i = 0; i < 6; i += 1) await env.flush(); };

test('pinta instrucción, el verbo en español, tres campos con nombre y los botones', () => {
  const { root, inputs, btn } = setup();
  assert.equal(inputs.length, 3);
  assert.equal(root.querySelectorAll('.ta__instruction')[0].textContent, TF_TEXT.instruction);
  assert.equal(root.querySelectorAll('.ta__prompt')[0].textContent, 'cantar');
  assert.equal(root.querySelectorAll('.ta__prompt')[0].getAttribute('lang'), 'es');
  for (const name of ['Presente', 'Pasado', 'Participio']) assert.ok(root.textContent.includes(name), name);
  for (const input of inputs) { assert.equal(input.getAttribute('autocapitalize'), 'off'); assert.equal(input.getAttribute('lang'), 'en'); }
  assert.ok(btn('Comprobar') && btn('No sé') && btn('Ver pista'));
});

test('con un campo vacío «Comprobar» no envía y avisa; los campos quedan libres', async () => {
  const { env, root, calls, btn, type, inputs } = setup();
  type('sing', '   ', 'sung');
  click(btn('Comprobar'));
  await settle(env);
  assert.equal(calls.length, 0);
  assert.equal(root.querySelectorAll('.ta__msg')[0].textContent, TF_TEXT.empty);
  assert.equal(inputs.some((i) => i.hasAttribute('disabled')), false);
});

test('las tres bien: envía correct con responseRaw de las tres formas y pinta una fila por forma', async () => {
  const { env, root, calls, btn, type, row } = setup();
  type('sing', 'sang', 'sung');
  click(btn('Comprobar'));
  await settle(env);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].result, 'correct');
  assert.equal(calls[0].responseRaw, 'sing / sang / sung');
  assert.equal(calls[0].hint, false);
  assert.deepEqual(calls[0].errorCodes, []);
  assert.equal(root.querySelectorAll('.fb__verdict')[0].textContent, TF_TEXT.correct);
  for (const k of ['present', 'past', 'participle']) assert.ok(row(k).textContent.includes(TF_TEXT.formCorrect), k);
});

test('el resultado es el de la faceta de la tarjeta: fallar OTRA forma no la penaliza (CA 4)', async () => {
  const wrongPast = ['sing', 'sung', 'sung'];
  const a = setup(item(), { ctx: { entry: { cardId: 'c0', facet: 0 } } });
  a.type(...wrongPast); click(a.btn('Comprobar')); await settle(a.env);
  assert.equal(a.calls[0].result, 'correct');
  const b = setup(item(), { ctx: { entry: { cardId: 'c1', facet: 1 } } });
  b.type(...wrongPast); click(b.btn('Comprobar')); await settle(b.env);
  assert.equal(b.calls[0].result, 'wrong');
  const c = setup(item(), { ctx: { entry: { cardId: 'c2', facet: 2 } } });
  c.type(...wrongPast); click(c.btn('Comprobar')); await settle(c.env);
  assert.equal(c.calls[0].result, 'correct');
  assert.ok(a.row('past').textContent.includes(TF_TEXT.formWrong), 'la corrección de la otra forma se enseña igual');
});

test('sin faceta válida el resultado es el global de las tres formas', async () => {
  for (const entry of [undefined, { facet: null }, { facet: 7 }, { facet: 'x' }, { facet: -1 }]) {
    const { env, calls, btn, type } = setup(item(), { ctx: { entry } });
    type('sing', 'sung', 'sung'); click(btn('Comprobar')); await settle(env);
    assert.equal(calls[0].result, 'wrong', JSON.stringify(entry));
  }
});

test('la forma de otro hueco avisa con cuál se confundió y enseña la correcta', async () => {
  const { env, calls, btn, type, row } = setup();
  type('sing', 'sung', 'sung');
  click(btn('Comprobar'));
  await settle(env);
  assert.equal(calls[0].result, 'wrong');
  assert.ok(row('past').textContent.includes(`${TF_TEXT.swapped} participio.`));
  assert.ok(row('past').textContent.includes(`${TF_TEXT.answerIs}: sang`));
  assert.equal(row('participle').textContent.includes(TF_TEXT.swapped), false);
});

test('errata de la propia forma: casi, con la corrección; variantes aceptadas todas', async () => {
  const a = setup();
  a.type('sing', 'sangg', 'sung'); click(a.btn('Comprobar')); await settle(a.env);
  assert.equal(a.calls[0].result, 'almost');
  assert.ok(a.row('past').textContent.includes(TF_TEXT.formAlmost));
  const it = item({ data: { forms: { present: 'learn', past: ['learnt', 'learned'], participle: ['learnt', 'learned'] } } });
  const b = setup(it);
  b.type('learn', 'learned', 'learnt'); click(b.btn('Comprobar')); await settle(b.env);
  assert.equal(b.calls[0].result, 'correct');
});

test('«No sé» envía dont_know sin responseRaw y enseña las tres formas', async () => {
  const { env, root, calls, btn, row } = setup();
  click(btn('No sé'));
  await settle(env);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].result, 'dont_know');
  assert.equal(calls[0].dontKnow, true);
  assert.equal('responseRaw' in calls[0], false);
  assert.equal(root.querySelectorAll('.fb__verdict')[0].textContent, TF_TEXT.dont);
  assert.ok(row('present').textContent.includes('sing') && row('past').textContent.includes('sang') && row('participle').textContent.includes('sung'));
});

test('un solo envío: tras guardar todo queda deshabilitado y un toque más no envía', async () => {
  const { env, root, calls, btn, type } = setup();
  type('sing', 'sang', 'sung');
  click(btn('Comprobar')); click(btn('Comprobar'));
  await settle(env);
  click(btn('Comprobar')); click(btn('No sé'));
  await settle(env);
  assert.equal(calls.length, 1);
  for (const x of [...root.querySelectorAll('button'), ...root.querySelectorAll('input')]) assert.ok(x.hasAttribute('disabled') || x.getAttribute('aria-disabled') === 'true');
});

test('si guardar falla se avisa, se desbloquea y se puede reintentar; ignored no pinta nada', async () => {
  const a = setup(item(), { submit: (_, n) => (n === 1 ? { status: 'error', message: 'Sin espacio.' } : { status: 'saved' }) });
  a.type('sing', 'sang', 'sung'); click(a.btn('Comprobar')); await settle(a.env);
  assert.equal(a.root.querySelectorAll('.ta__msg')[0].textContent, 'Sin espacio.');
  assert.equal(a.root.querySelectorAll('.fb__verdict').length, 0);
  click(a.btn('Comprobar')); await settle(a.env);
  assert.equal(a.calls.length, 2);
  assert.equal(a.root.querySelectorAll('.fb__verdict').length, 1);
  const b = setup(item(), { submit: () => ({ status: 'ignored' }) });
  b.type('sing', 'sang', 'sung'); click(b.btn('Comprobar')); await settle(b.env);
  assert.equal(b.root.querySelectorAll('.fb__verdict').length, 0);
  const c = setup(item(), { submit: () => { throw new Error('boom'); }, factory: { log: () => {} } });
  c.type('sing', 'sang', 'sung'); click(c.btn('Comprobar')); await settle(c.env);
  assert.equal(c.root.querySelectorAll('.ta__msg')[0].textContent, TF_TEXT.saveFail);
});

test('la pista se muestra una vez, marca hint y no hay botón si el ítem no la trae', async () => {
  const { env, root, calls, btn, type } = setup();
  click(btn('Ver pista')); click(btn('Pista mostrada'));
  assert.equal(root.querySelectorAll('.ta__hint')[0].textContent, 'Patrón i-a-u');
  type('sing', 'sang', 'sung'); click(btn('Comprobar')); await settle(env);
  assert.equal(calls[0].hint, true);
  const none = setup(item({ data: { forms: { present: 'sing', past: 'sang', participle: 'sung' } } }));
  assert.equal(none.btn('Ver pista'), undefined);
});

test('en un fallo se pintan explicación y cajas; en un acierto no', async () => {
  const bad = setup();
  bad.type('sing', 'sing', 'sing'); click(bad.btn('Comprobar')); await bad.env.flush(); await settle(bad.env);
  assert.equal(bad.root.querySelectorAll('.fb__explain').length, 1);
  assert.equal(bad.root.querySelectorAll('.fb__grammar').length, 1);
  const ok = setup();
  ok.type('sing', 'sang', 'sung'); click(ok.btn('Comprobar')); await settle(ok.env);
  assert.equal(ok.root.querySelectorAll('.fb__explain').length, 0);
  assert.equal(ok.root.querySelectorAll('.fb__grammar').length, 0);
});

test('getResponse: lo escrito mientras se responde, null si no hay nada y lo enviado después', async () => {
  const { env, m, btn, type } = setup();
  assert.equal(m.getResponse(), null);
  type(' sing ', '', 'sung');
  assert.equal(m.getResponse(), 'sing /  / sung');
  type('sing', 'sang', 'sung'); click(btn('Comprobar')); await settle(env);
  assert.equal(m.getResponse(), 'sing / sang / sung');
});

test('un ítem sin las tres formas o un contenedor ausente lanzan TypeError', () => {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  const f = createThreeForms();
  assert.throws(() => f.mount(root, { type: 'three_forms', data: { forms: { present: 'go', past: 'went' } } }, { doc: env.doc }), TypeError);
  assert.throws(() => f.mount(root, null, { doc: env.doc }), TypeError);
  assert.throws(() => f.mount(null, item(), {}), TypeError);
});

test('destroy es idempotente, quita el nodo, devuelve los listeners y nada se envía después', async () => {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const before = env.stats.live();
  const calls = [];
  const m = createThreeForms().mount(root, item(), { doc: env.doc, submit: async (a) => { calls.push(a); return { status: 'saved' }; } });
  const btnC = root.querySelectorAll('button').find((b) => b.textContent.includes('Comprobar'));
  m.destroy(); m.destroy();
  click(btnC);
  await settle(env);
  assert.equal(calls.length, 0);
  assert.equal(root.querySelectorAll('.tf').length, 0);
  assert.equal(env.stats.live(), before);
});

test('una respuesta de 5000 letras se envía acotada y la pantalla no lanza', async () => {
  const { env, calls, btn, type } = setup();
  type('a'.repeat(5000), 'sang', 'sung'); click(btn('Comprobar')); await settle(env);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].responseRaw.length <= 2000);
});

// ---- cierre de roturas vivas (4.R) ----
const keydownEnter = (el) => el.dispatchEvent({ type: 'keydown', key: 'Enter', preventDefault() {} });
const cardsSpy = () => { const reads = []; return { reads, cards: { read: async (id) => { reads.push(id); return null; } } }; };

test('Enter en un campo envía como «Comprobar»', async () => {
  const { env, calls, inputs, type } = setup();
  type('sing', 'sang', 'sung');
  keydownEnter(inputs[1]);
  await settle(env);
  assert.equal(calls.length, 1);
});

test('con un campo vacío el foco va al primer campo vacío', async () => {
  const { env, inputs, btn, type } = setup();
  type('sing', '', '');
  click(btn('Comprobar'));
  await settle(env);
  assert.equal(env.doc.activeElement, inputs[1]);
});

test('la situación se muestra si el ítem la trae', () => {
  const { root } = setup(item({ situation: 'Cantando en la ducha' }));
  assert.equal(root.querySelectorAll('.ta__situation')[0].textContent, 'Situación: Cantando en la ducha');
  assert.equal(setup().root.querySelectorAll('.ta__situation').length, 0);
});

test('los errores de montaje dicen qué falta', () => {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  assert.throws(() => createThreeForms().mount(null, item(), {}), /falta el contenedor/);
  assert.throws(() => createThreeForms().mount(root, { data: { forms: { present: 'go' } } }, { doc: env.doc }), /no tiene las tres formas/);
});

test('cada fila enseña lo escrito, las variantes aceptadas solo si falla y su clase de veredicto', async () => {
  const it = item({ data: { forms: { present: 'learn', past: ['learnt', 'learned'], participle: ['learnt', 'learned'] } } });
  const { env, btn, type, row } = setup(it);
  type('learn', 'lerned', 'learnt');
  click(btn('Comprobar'));
  await settle(env);
  assert.ok(row('past').textContent.includes('lerned'), 'lo escrito se ve');
  assert.ok(row('past').textContent.includes(`${TF_TEXT.answerIs}: learnt / learned`), 'todas las variantes');
  assert.equal(row('present').textContent.includes(TF_TEXT.answerIs), false, 'un acierto no repite la respuesta');
  assert.ok(row('present').getAttribute('class').includes('tf__form--correct'));
  assert.ok(row('past').getAttribute('class').includes('tf__form--almost'));
});

test('con una errata o con «No sé» también se pintan la explicación y las cajas', async () => {
  const a = setup();
  a.type('sing', 'sangg', 'sung'); click(a.btn('Comprobar')); await settle(a.env);
  assert.equal(a.root.querySelectorAll('.fb__explain').length, 1);
  const b = setup();
  click(b.btn('No sé')); await settle(b.env);
  assert.equal(b.root.querySelectorAll('.fb__explain').length, 1);
  assert.equal(b.root.querySelectorAll('.fb__nuance').length, 1);
});

test('una faceta fuera de 0 a 2 (incluida 3) usa el resultado global', async () => {
  const { env, calls, btn, type } = setup(item(), { ctx: { entry: { facet: 3 } } });
  type('sing', 'sung', 'sung'); click(btn('Comprobar')); await settle(env);
  assert.equal(calls[0].result, 'wrong');
});

test('compare y confusables se pasan a cada forma', async () => {
  const seen = [];
  const compare = (typed, accept, o) => { seen.push([typed, accept, o.confusables]); return { result: 'correct', matched: accept[0], diff: [], spellingFlags: [], errorCodes: [] }; };
  const conf = { id: 'conf' };
  const { env, btn, type } = setup(item(), { factory: { compare, confusables: conf } });
  type('sing', 'sang', 'sung'); click(btn('Comprobar')); await settle(env);
  assert.deepEqual(seen.map((s) => [s[0], s[1]]), [['sing', ['sing']], ['sang', ['sang']], ['sung', ['sung']]]);
  assert.ok(seen.every((s) => s[2] === conf));
});

test('errorCodes: los de la forma de la tarjeta; sin faceta, los de las tres', async () => {
  let n = 0;
  const compare = () => { n += 1; return { result: 'wrong', matched: null, diff: [], spellingFlags: [], errorCodes: [`E${n % 3}`] }; };
  const run = async (entry) => {
    n = 0;
    const s = setup(item(), { factory: { compare }, ctx: { entry } });
    s.type('a', 'b', 'c'); click(s.btn('Comprobar')); await settle(s.env);
    return s.calls[0].errorCodes;
  };
  assert.deepEqual(await run({ facet: 1 }), ['E2']);
  assert.deepEqual(await run({ facet: 2 }), ['E0']);
  assert.deepEqual(await run({}), ['E1', 'E2', 'E0']);
});

test('«No sé» tras ver la pista marca hint; el botón de pista queda deshabilitado y sigue así tras un fallo de guardado', async () => {
  const s = setup(item(), { submit: (_, k) => (k === 1 ? { status: 'error' } : { status: 'saved' }) });
  click(s.btn('Ver pista'));
  assert.ok(s.btn('Pista mostrada').hasAttribute('disabled') || s.btn('Pista mostrada').getAttribute('aria-disabled') === 'true');
  click(s.btn('No sé')); await settle(s.env);
  assert.equal(s.calls[0].hint, true);
  const hb = s.btn('Pista mostrada');
  assert.ok(hb.hasAttribute('disabled') || hb.getAttribute('aria-disabled') === 'true', 'tras el fallo la pista sigue deshabilitada');
  click(s.btn('No sé')); await settle(s.env);
  assert.equal(s.calls.length, 2);
});

test('con acciones de tarjeta y cardId se lee la tarjeta al montar y se refresca tras guardar; sin cardId no se lee', async () => {
  const a = cardsSpy();
  const s = setup(item(), { ctx: { cards: a.cards, entry: { cardId: 'c1', facet: 1 } } });
  await settle(s.env);
  assert.deepEqual(a.reads, ['c1']);
  s.type('sing', 'sang', 'sung'); click(s.btn('Comprobar')); await settle(s.env);
  assert.deepEqual(a.reads, ['c1', 'c1']);
  const b = cardsSpy();
  const t = setup(item(), { ctx: { cards: b.cards, entry: { facet: 1 } } });
  await settle(t.env);
  assert.deepEqual(b.reads, []);
});

test('si se destruye mientras se guarda, no se pinta ni se refresca la tarjeta', async () => {
  const a = cardsSpy();
  let release;
  const gate = new Promise((r) => { release = r; });
  const s = setup(item(), { ctx: { cards: a.cards, entry: { cardId: 'c1' } }, submit: async () => { await gate; return { status: 'saved' }; } });
  await settle(s.env);
  s.type('sing', 'sang', 'sung'); click(s.btn('Comprobar'));
  s.m.destroy();
  release();
  await settle(s.env);
  assert.deepEqual(a.reads, ['c1'], 'sin refresco tras destruir');
  assert.equal(s.root.querySelectorAll('.fb__verdict').length, 0);
  assert.equal(s.m.el.querySelectorAll('.fb__verdict').length, 0, 'tampoco se pinta en el nodo ya destruido');
});

test('destroy cierra también la barra de la tarjeta: los listeners vuelven a la cifra de antes de montar', async () => {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const NOW = new Date('2026-10-27T12:00:00.000Z');
  const cards = { now: () => NOW, read: async () => newCard('it1', 0, NOW, ['t']), setFav: async () => ({}) };
  const before = env.stats.live();
  const m = createThreeForms().mount(root, item(), { doc: env.doc, cards, entry: { cardId: 'it1#0', facet: 0 }, submit: async () => ({ status: 'saved' }) });
  await settle(env);
  assert.ok(env.stats.live() > before + 4, 'la barra y los campos registran listeners');
  m.destroy();
  assert.equal(env.stats.live(), before);
});

// ---- punto 5: registro real, cableado en app/main.js y resultado por faceta de la tarjeta ----
import { readFileSync } from 'node:fs';
import { createExerciseRegistry } from '../ui/exercises/index.js';

// El registro no pasa `doc` (en el navegador el contenedor trae `ownerDocument`; el DOM falso no): se ofrece el documento falso como global y se restaura.
const withGlobalDoc = async (env, fn) => {
  const prev = globalThis.document;
  globalThis.document = env.doc;
  try { return await fn(); } finally { globalThis.document = prev; }
};

test('a través del registro real: una tarjeta por faceta, el resultado es el de SU forma y las otras no lo cambian', async () => {
  const wrongPast = ['sing', 'sung', 'sung']; // el pasado está mal (forma cambiada); presente y participio bien
  const expected = { 0: 'correct', 1: 'wrong', 2: 'correct' };
  for (const facet of [0, 1, 2]) {
    const env = makeEnv();
    const root = env.doc.createElement('div');
    env.doc.body.appendChild(root);
    const got = [];
    const reg = createExerciseRegistry({ resolveItem: () => item(), log: () => {} });
    reg.register('three_forms', createThreeForms());
    const handle = await withGlobalDoc(env, () => reg.mount(root, { cardId: `v.sing#${facet}`, itemId: 'v.sing', facet, exerciseType: 'three_forms' }, {
      index: 0, total: 1, submit: async (a) => { got.push(a); return { status: 'saved' }; },
    }));
    assert.ok(handle, `faceta ${facet}: monta`);
    const inputs = root.querySelectorAll('input');
    wrongPast.forEach((v, i) => { inputs[i].value = v; inputs[i].dispatchEvent(ev('input')); });
    click(root.querySelectorAll('button').find((b) => b.textContent.includes('Comprobar')));
    await settle(env);
    assert.equal(got.length, 1, `faceta ${facet}: un solo envío`);
    assert.equal(got[0].result, expected[facet], `faceta ${facet}`);
    assert.equal(got[0].exerciseType, 'three_forms');
    assert.equal(got[0].responseRaw, 'sing / sung / sung', 'las tres respuestas van en responseRaw');
    handle.destroy();
  }
});

test('un ítem sin las tres formas hace que el registro responda «tipo no soportado» (null) sin lanzar', async () => {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const logs = [];
  const reg = createExerciseRegistry({ resolveItem: () => item({ data: { forms: { present: 'sing' } } }), log: (...a) => logs.push(a) });
  reg.register('three_forms', createThreeForms());
  const out = await withGlobalDoc(env, () => reg.mount(root, { cardId: 'v.sing#0', itemId: 'v.sing', facet: 0, exerciseType: 'three_forms' }, { index: 0, total: 1, submit: async () => ({ status: 'saved' }) }));
  assert.equal(out, null);
  assert.ok(logs.some((l) => String(l[1]).includes('las tres formas')), 'null por faltar formas, no por otra causa');
});

test('app/exerciseTypes.js importa y registra three_forms una sola vez, y main.js lo llama antes del primer arranque', () => {
  const src = readFileSync(new URL('../app/exerciseTypes.js', import.meta.url), 'utf8');
  const MAIN = readFileSync(new URL('../app/main.js', import.meta.url), 'utf8');
  assert.match(src, /import \{ createThreeForms \} from '\.\.\/ui\/exercises\/threeForms\.js';/);
  assert.equal(src.match(/register\('three_forms'/g).length, 1);
  assert.match(src, /register\('three_forms', createThreeForms\(\{ catalog, log \}\)\)/);
  assert.match(MAIN, /registerExerciseTypes\(app\.services\.exercises, \{ catalog: \(\) => app\.services\.study\?\.catalog \?\? null, log: console\.error \}\)/);
  assert.ok(MAIN.indexOf('registerExerciseTypes(app') < MAIN.indexOf('startFirstRun('));
});

test('los estilos de la fila por forma existen (.tf__form y sus tres veredictos)', () => {
  const css = readFileSync(new URL('../ui/styles/widgets.css', import.meta.url), 'utf8');
  for (const sel of ['.tf__form {', '.tf__form--correct', '.tf__form--almost', '.tf__form--wrong']) assert.ok(css.includes(sel), sel);
});
