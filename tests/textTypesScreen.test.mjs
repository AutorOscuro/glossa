// @purpose: Pruebas de los envoltorios de los 6 tipos de palabra y colocación (2.5-T2 punto 2): instrucción, hueco, idioma de la respuesta, máscara, envío y registro real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWordType, registerWordTypes, TT_TEXT } from '../ui/exercises/textTypes.js';
import { createExerciseRegistry } from '../ui/exercises/index.js';
import { WORD_TYPES, instructionFor } from '../core/textTypes.js';
import { makeEnv } from './_fakeDom.mjs';

const ev = (type, extra = {}) => ({ type, preventDefault() {}, ...extra });
const click = (el) => el.dispatchEvent(ev('click'));
const CONTROLS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;

const ITEMS = {
  fill_verb: { id: 'g.fv.0001', type: 'fill_verb', prompt_es: 'Ella va a la escuela.', prompt_en: 'She ___ (go) to school.', accept: ['goes'], data: {} },
  translate_word: { id: 'v.tw.0001', type: 'translate_word', prompt_es: 'perro', accept: ['dog'], data: {} },
  first_letter: { id: 'v.fl.0001', type: 'first_letter', prompt_es: 'Estoy muy feliz hoy.', prompt_en: 'I am very ___ today.', accept: ['happy'], data: {} },
  collocation_fill: { id: 'v.cf.0001', type: 'collocation_fill', prompt_es: 'tomar una decisión', prompt_en: 'make a ___', accept: ['decision'], data: {} },
  def_to_word: { id: 'v.dw.0001', type: 'def_to_word', prompt_es: 'Un lugar donde se compran libros.', prompt_en: 'A place where you buy books', accept: ['bookshop', 'bookstore'], data: {} },
  derive_form: { id: 'v.df.0001', type: 'derive_form', prompt_es: 'Es un buen cantante.', prompt_en: 'He is a good ___ (sing).', accept: ['singer'], data: {} },
};
// Ítem con `prompt_en` (la respuesta): la dirección es siempre español → inglés y ese texto no se enseña (respuesta 8 del Administrador).
const REVERSE = { id: 'v.tw.0002', type: 'translate_word', prompt_es: 'perro', prompt_en: 'dog', accept: ['dog'], data: {} };

function setup(type, item, { submit, compare, confusables, log, ctx = {} } = {}) {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const calls = [];
  const sub = async (a) => { calls.push(a); return submit ? submit(a, calls.length) : { status: 'saved' }; };
  const m = createWordType(type, { compare, confusables, log }).mount(root, item, { doc: env.doc, submit: sub, ...ctx });
  const btn = (label) => root.querySelectorAll('button').find((b) => b.textContent.includes(label));
  const input = root.querySelectorAll('input')[0];
  const type_ = (v) => { input.value = v; input.dispatchEvent(ev('input')); };
  const one = (cls) => root.querySelectorAll(cls)[0];
  return { env, root, m, calls, btn, input, typeText: type_, one };
}

test('createWordType: un tipo que no es de la tabla lanza en español; los 6 valen y devuelven un componente congelado', () => {
  for (const bad of [undefined, null, 5, '', 'three_forms', 'fix_error', 'toString', '__proto__', ['fill_verb']]) {
    assert.throws(() => createWordType(bad), /createWordType: tipo desconocido/, String(bad));
  }
  for (const t of WORD_TYPES) {
    const c = createWordType(t);
    assert.equal(typeof c.mount, 'function', t);
    assert.ok(Object.isFrozen(c), t);
  }
});

test('cada tipo pinta su instrucción, el enunciado principal con su idioma y el campo de ejercicio', () => {
  for (const t of WORD_TYPES) {
    const { one, input, root } = setup(t, ITEMS[t]);
    assert.equal(one('.ta__instruction').textContent, instructionFor(ITEMS[t]), t);
    assert.ok(one('.ta__prompt'), t);
    assert.equal(root.querySelectorAll('.ta').length, 1, t);
    assert.equal(input.getAttribute('autocapitalize'), 'off', t);
    assert.equal(input.getAttribute('autocorrect'), 'off', t);
    assert.equal(input.getAttribute('spellcheck'), 'false', t);
    assert.equal(input.getAttribute('lang'), 'en', t);
  }
});

test('con prompt_en: la frase inglesa va con su hueco accesible y la traducción española queda como apoyo', () => {
  for (const t of WORD_TYPES.filter((x) => x !== 'translate_word' && x !== 'def_to_word')) {
    const { one, root } = setup(t, ITEMS[t]);
    assert.equal(one('.ta__prompt').getAttribute('lang'), 'en', t);
    const gaps = root.querySelectorAll('.ta__gap');
    assert.equal(gaps.length, 1, t);
    assert.equal(gaps[0].getAttribute('role'), 'img', t);
    assert.equal(gaps[0].getAttribute('aria-label'), TT_TEXT.gap, t);
    assert.equal(gaps[0].textContent, '_____', t);
    assert.equal(one('.ta__prompt').textContent, ITEMS[t].prompt_en.replace(/_{2,}/, '_____'), t);
    assert.equal(one('.ta__aside').getAttribute('lang'), 'es', t);
    assert.equal(one('.ta__aside').textContent, ITEMS[t].prompt_es, t);
  }
});

test('el texto accesible del hueco es «hueco» y no se puede cambiar', () => {
  assert.equal(TT_TEXT.gap, 'hueco');
  assert.ok(Object.isFrozen(TT_TEXT));
  const { root } = setup('fill_verb', ITEMS.fill_verb);
  assert.equal(root.querySelectorAll('.ta__gap')[0].getAttribute('aria-label'), 'hueco');
});

test('def_to_word sin hueco: la definición inglesa se lee tal cual y el español acompaña', () => {
  const { one, root } = setup('def_to_word', ITEMS.def_to_word);
  assert.equal(root.querySelectorAll('.ta__gap').length, 0);
  assert.equal(one('.ta__prompt').textContent, 'A place where you buy books');
  assert.equal(one('.ta__aside').textContent, 'Un lugar donde se compran libros.');
});

test('sin prompt_en: el texto principal es la palabra española, sin apoyo ni hueco', () => {
  const { one, root } = setup('translate_word', ITEMS.translate_word);
  assert.equal(one('.ta__instruction').textContent, 'Traduce al inglés.');
  assert.equal(one('.ta__prompt').textContent, 'perro');
  assert.equal(one('.ta__prompt').getAttribute('lang'), 'es');
  assert.equal(root.querySelectorAll('.ta__aside').length, 0);
  assert.equal(root.querySelectorAll('.ta__gap').length, 0);
});

test('traducir palabra con prompt_en en el ítem: se enseña la palabra española, el campo lleva lang en y la respuesta inglesa no se ve', async () => {
  let seen = null;
  const compare = (t, a, o) => { seen = o; return { result: 'correct', matched: a[0], diff: [], spellingFlags: [], errorCodes: [] }; };
  const { env, one, input, root, btn, typeText } = setup('translate_word', REVERSE, { compare });
  assert.equal(one('.ta__instruction').textContent, 'Traduce al inglés.');
  assert.equal(one('.ta__prompt').textContent, 'perro');
  assert.equal(one('.ta__prompt').getAttribute('lang'), 'es');
  assert.equal(input.getAttribute('lang'), 'en');
  assert.equal(root.querySelectorAll('.ta__aside').length, 0);
  assert.ok(!root.textContent.includes('dog'), 'la respuesta no debe verse antes de contestar');
  typeText('dog');
  click(btn('Comprobar'));
  await env.flush();
  assert.notEqual(seen.lang, 'es');
  assert.equal(seen.almostAtWordEnd, true);
});

test('el mismo componente, con o sin prompt_en en el ítem, siempre responde en inglés', () => {
  const comp = createWordType('translate_word');
  const langs = [];
  for (const it of [ITEMS.translate_word, REVERSE, ITEMS.translate_word, REVERSE]) {
    const env = makeEnv();
    const root = env.doc.createElement('div');
    env.doc.body.appendChild(root);
    comp.mount(root, it, { doc: env.doc, submit: async () => ({ status: 'saved' }) });
    langs.push(root.querySelectorAll('input')[0].getAttribute('lang'));
  }
  assert.deepEqual(langs, ['en', 'en', 'en', 'en']);
});

test('almostAtWordEnd solo lo recibe translate_word; los otros 5 tipos no', async () => {
  for (const t of WORD_TYPES) {
    let seen = null;
    const compare = (txt, a, o) => { seen = o; return { result: 'correct', matched: a[0], diff: [], spellingFlags: [], errorCodes: [] }; };
    const { env, btn, typeText } = setup(t, ITEMS[t], { compare });
    typeText(ITEMS[t].accept[0]);
    click(btn('Comprobar'));
    await env.flush();
    assert.equal(seen.almostAtWordEnd === true, t === 'translate_word', t);
  }
});

test('first_letter muestra la primera letra por defecto; un none explícito la quita y length no la enseña', () => {
  const a = setup('first_letter', ITEMS.first_letter);
  assert.equal(a.one('.ta__mask').textContent, 'h _ _ _ _');
  const b = setup('first_letter', { ...ITEMS.first_letter, data: { mask: 'none' } });
  assert.equal(b.root.querySelectorAll('.ta__mask').length, 0);
  const c = setup('first_letter', { ...ITEMS.first_letter, data: { mask: 'length' } });
  assert.ok(c.one('.ta__mask'));
  assert.ok(!c.one('.ta__mask').textContent.includes('h'));
});

test('los otros 5 tipos no traen máscara si el ítem no la pide, y la respetan si la pide', () => {
  for (const t of WORD_TYPES.filter((x) => x !== 'first_letter')) {
    assert.equal(setup(t, ITEMS[t]).root.querySelectorAll('.ta__mask').length, 0, t);
    assert.equal(setup(t, { ...ITEMS[t], data: { mask: 'first_letter' } }).root.querySelectorAll('.ta__mask').length, 1, t);
  }
});

test('la máscara por defecto no cambia el ítem recibido (ni siquiera congelado)', () => {
  const frozen = Object.freeze({ ...ITEMS.first_letter, data: Object.freeze({}), accept: Object.freeze(['happy']) });
  setup('first_letter', frozen);
  assert.deepEqual(frozen.data, {});
});

test('acierto en los 6 tipos: envía correct con el texto escrito y pinta el veredicto', async () => {
  for (const t of WORD_TYPES) {
    const { env, calls, root, btn, typeText } = setup(t, ITEMS[t]);
    typeText(`  ${ITEMS[t].accept[0]}  `);
    click(btn('Comprobar'));
    await env.flush();
    assert.equal(calls.length, 1, t);
    assert.equal(calls[0].result, 'correct', t);
    assert.equal(calls[0].responseRaw, ITEMS[t].accept[0], t);
    assert.equal(root.querySelectorAll('.fb__verdict--correct').length, 1, t);
  }
});

test('error: la corrección enseña la respuesta y el texto enviado no lleva caracteres de control', async () => {
  const { env, calls, root, btn, typeText } = setup('fill_verb', ITEMS.fill_verb);
  typeText('go\u0007ing');
  click(btn('Comprobar'));
  await env.flush();
  assert.notEqual(calls[0].result, 'correct');
  assert.ok(!CONTROLS.test(calls[0].responseRaw));
  assert.ok(root.querySelectorAll('.fb__correct')[0].textContent.includes('goes'));
});

test('vacío no se envía y «No sé» envía dont_know sin texto (en los 6 tipos)', async () => {
  for (const t of WORD_TYPES) {
    const { env, calls, btn, root } = setup(t, ITEMS[t]);
    click(btn('Comprobar'));
    await env.flush();
    assert.equal(calls.length, 0, t);
    assert.ok(root.querySelectorAll('.ta__msg')[0].textContent.length > 0, t);
    click(btn('No sé'));
    await env.flush();
    assert.equal(calls.length, 1, t);
    assert.equal(calls[0].result, 'dont_know', t);
    assert.equal(calls[0].dontKnow, true, t);
    assert.equal('responseRaw' in calls[0], false, t);
  }
});

test('un ítem sin respuestas aceptadas o sin forma de ítem lanza TypeError al montar', () => {
  for (const t of WORD_TYPES) {
    for (const bad of [{ ...ITEMS[t], accept: [] }, { ...ITEMS[t], accept: undefined }, null, undefined, 'texto']) {
      assert.throws(() => setup(t, bad), TypeError, `${t} ${JSON.stringify(bad)}`);
    }
  }
});

test('texto hostil del contenido entra como texto, nunca como HTML', () => {
  const evil = { ...ITEMS.fill_verb, prompt_en: '<img src=x onerror=alert(1)> ___ <b>x</b>', prompt_es: '<script>1</script>' };
  const { root, one } = setup('fill_verb', evil);
  assert.equal(root.querySelectorAll('img').length, 0);
  assert.equal(root.querySelectorAll('b').length, 0);
  assert.equal(root.querySelectorAll('script').length, 0);
  assert.ok(one('.ta__prompt').textContent.includes('<img src=x onerror=alert(1)>'));
  assert.equal(one('.ta__aside').textContent, '<script>1</script>');
});

test('destroy quita la pantalla y repetirlo no lanza', () => {
  const { root, m } = setup('fill_verb', ITEMS.fill_verb);
  assert.equal(root.querySelectorAll('.ta').length, 1);
  m.destroy();
  assert.equal(root.querySelectorAll('.ta').length, 0);
  assert.doesNotThrow(() => m.destroy());
});

test('log llega a la pantalla base: un envío que lanza se avisa y se puede reintentar', async () => {
  const logged = [];
  const { env, calls, btn, typeText, root } = setup('derive_form', ITEMS.derive_form, {
    log: (...a) => logged.push(a), submit: (a, n) => { if (n === 1) throw new Error('rota'); return { status: 'saved' }; },
  });
  typeText('singer');
  click(btn('Comprobar'));
  await env.flush();
  assert.equal(logged.length, 1);
  assert.match(String(logged[0][0]), /no se pudo enviar/);
  assert.equal(root.querySelectorAll('.fb__verdict').length, 0);
  click(btn('Comprobar'));
  await env.flush();
  assert.equal(calls.length, 2);
  assert.equal(root.querySelectorAll('.fb__verdict--correct').length, 1);
});

// ---- registro ----
function spyRegistry() {
  const table = new Map();
  return { table, register: (type, component) => { if (table.has(type)) throw new Error('ya registrado'); table.set(type, component); } };
}

test('registerWordTypes registra los 6 en un registro real, devuelve la lista y no toca otros tipos', () => {
  const reg = createExerciseRegistry({ log: () => {} });
  assert.deepEqual(registerWordTypes(reg), [...WORD_TYPES]);
  for (const t of WORD_TYPES) assert.equal(reg.has(t), true, t);
  for (const other of ['three_forms', 'fix_error', 'cloze_bank', 'phrase_cloze', 'mcq_en_es']) assert.equal(reg.has(other), false, other);
});

test('confusables llega a compare desde el envoltorio y desde el registro', async () => {
  const table = { marca: 'mia' };
  const seen = [];
  const compare = (t, a, o) => { seen.push(o.confusables); return { result: 'correct', matched: a[0], diff: [], spellingFlags: [], errorCodes: [] }; };
  const one = setup('fill_verb', ITEMS.fill_verb, { compare, confusables: table });
  one.typeText('goes');
  click(one.btn('Comprobar'));
  await one.env.flush();
  const reg = spyRegistry();
  registerWordTypes(reg, { compare, confusables: table });
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  reg.table.get('derive_form').mount(root, ITEMS.derive_form, { doc: env.doc, submit: async () => ({ status: 'saved' }) });
  root.querySelectorAll('input')[0].value = 'singer';
  root.querySelectorAll('input')[0].dispatchEvent(ev('input'));
  click(root.querySelectorAll('button').find((b) => b.textContent.includes('Comprobar')));
  await env.flush();
  assert.deepEqual(seen, [table, table]);
});

test('un ítem sin textos de enunciado enseña solo la instrucción y no avisa a log', () => {
  const logged = [];
  const { root, one } = setup('fill_verb', { ...ITEMS.fill_verb, prompt_es: null, prompt_en: null }, { log: (...a) => logged.push(a) });
  assert.equal(one('.ta__instruction').textContent, instructionFor(ITEMS.fill_verb));
  assert.equal(root.querySelectorAll('.ta__prompt').length, 0);
  assert.equal(root.querySelectorAll('.ta__aside').length, 0);
  assert.deepEqual(logged, []);
});

test('el tipo del envoltorio manda: un ítem sin type, o con otro, igual lleva su instrucción y su dirección', () => {
  const noType = { ...REVERSE };
  delete noType.type;
  const a = setup('translate_word', noType);
  assert.equal(a.one('.ta__instruction').textContent, 'Traduce al inglés.');
  assert.equal(a.input.getAttribute('lang'), 'en');
  const b = setup('fill_verb', { ...ITEMS.fill_verb, type: 'mcq_en_es' });
  assert.equal(b.one('.ta__instruction').textContent, instructionFor(ITEMS.fill_verb));
  assert.equal(b.root.querySelectorAll('.ta')[0].dataset.type, 'fill_verb');
  const c = setup('first_letter', { ...ITEMS.first_letter, type: undefined });
  assert.equal(c.one('.ta__mask').textContent, 'h _ _ _ _');
});

test('el ítem original no cambia cuando el envoltorio le pone su tipo', () => {
  const frozen = Object.freeze({ ...ITEMS.fill_verb, type: 'otro' });
  setup('fill_verb', frozen);
  assert.equal(frozen.type, 'otro');
});

test('registrar dos veces lanza y un registro inválido lanza en español', () => {
  const reg = createExerciseRegistry({ log: () => {} });
  registerWordTypes(reg);
  assert.throws(() => registerWordTypes(reg));
  for (const bad of [undefined, null, 5, {}, { register: 3 }]) assert.throws(() => registerWordTypes(bad), /registerWordTypes: falta el registro de ejercicios/);
});

test('cada tipo recibe su propio componente y compare y log llegan a todos', async () => {
  const reg = spyRegistry();
  const logged = [];
  let compared = 0;
  const compare = (t, a) => { compared += 1; return { result: 'correct', matched: a[0], diff: [], spellingFlags: [], errorCodes: [] }; };
  registerWordTypes(reg, { compare, log: (...a) => logged.push(a) });
  assert.deepEqual([...reg.table.keys()], [...WORD_TYPES]);
  assert.equal(new Set(reg.table.values()).size, 6);
  for (const t of WORD_TYPES) {
    const env = makeEnv();
    const root = env.doc.createElement('div');
    env.doc.body.appendChild(root);
    reg.table.get(t).mount(root, ITEMS[t], { doc: env.doc, submit: async () => { throw new Error('rota'); } });
    root.querySelectorAll('input')[0].value = ITEMS[t].accept[0];
    root.querySelectorAll('input')[0].dispatchEvent(ev('input'));
    click(root.querySelectorAll('button').find((b) => b.textContent.includes('Comprobar')));
    await env.flush();
  }
  assert.equal(compared, 6);
  assert.equal(logged.length, 6);
});

test('de punta a punta con el registro real: monta, envía con el tipo y un ítem sin accept se cuenta como no soportado', async () => {
  const all = { ...Object.fromEntries(Object.values(ITEMS).map((i) => [i.id, i])), [REVERSE.id]: REVERSE, bad: { ...ITEMS.fill_verb, id: 'bad', accept: [] } };
  const logged = [];
  const reg = createExerciseRegistry({ resolveItem: async (id) => all[id] ?? null, log: (...a) => logged.push(a) });
  registerWordTypes(reg);
  const env = makeEnv();
  const slot = env.doc.createElement('div');
  slot.ownerDocument = env.doc; // TRAMPA-26: en el DOM falso el contenedor no trae ownerDocument
  env.doc.body.appendChild(slot);
  const sent = [];
  const submit = async (a) => { sent.push(a); return { status: 'saved' }; };
  const handle = await reg.mount(slot, { itemId: REVERSE.id }, { index: 0, total: 1, submit });
  assert.ok(handle && typeof handle.destroy === 'function' && typeof handle.getResponse === 'function');
  assert.equal(slot.querySelectorAll('input')[0].getAttribute('lang'), 'en');
  slot.querySelectorAll('input')[0].value = 'dog';
  slot.querySelectorAll('input')[0].dispatchEvent(ev('input'));
  assert.equal(handle.getResponse(), 'dog');
  click(slot.querySelectorAll('button').find((b) => b.textContent.includes('Comprobar')));
  await env.flush();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].result, 'correct');
  assert.equal(sent[0].exerciseType, 'translate_word');
  handle.destroy();
  const none = await reg.mount(slot, { itemId: 'bad' }, { index: 0, total: 1, submit });
  assert.equal(none, null);
  assert.ok(logged.some((a) => /falló al mostrarse/.test(String(a[0]))));
});

// ---- cableado en app/main.js (2.5-T2 punto 3) ----
test('registerWordTypes se llama una sola vez desde app/exerciseTypes.js, en su sitio, y main.js usa ese ayudante', async () => {
  const fs = await import('node:fs');
  const ET = fs.readFileSync(new URL('../app/exerciseTypes.js', import.meta.url), 'utf8');
  const MAIN = fs.readFileSync(new URL('../app/main.js', import.meta.url), 'utf8');
  assert.match(ET, /import \{ registerWordTypes \} from '\.\.\/ui\/exercises\/textTypes\.js';/);
  assert.equal(ET.match(/registerWordTypes\(/g).length, 1);
  assert.match(ET, /registerWordTypes\(registry, \{ catalog, log \}\)/);
  assert.ok(ET.indexOf('registerBuildTypes(') < ET.indexOf('registerWordTypes('));
  assert.match(MAIN, /registerExerciseTypes\(app\.services\.exercises, \{ catalog: \(\) => app\.services\.study\?\.catalog \?\? null, log: console\.error \}\)/);
  assert.ok(MAIN.indexOf('registerExerciseTypes(app') < MAIN.indexOf('startFirstRun('));
});
