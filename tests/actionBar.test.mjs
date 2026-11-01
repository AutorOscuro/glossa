// @purpose: Pruebas de la barra de ayudas (ui/actionBar.js, 2.7-T1): orden fijo, solo las acciones recibidas, insignia con cuenta accesible, avisos y limpieza.
// 2.7-T1 con DOM falso. El contador real de Correcciones (CA 2) llega en 2.7-T2; aquí se prueba el mecanismo de la insignia.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv } from './_fakeDom.mjs';
import { createActionBar, ACTION_IDS, ACTION_TEXT } from '../ui/actionBar.js';

const realDocument = globalThis.document;
afterEach(() => { globalThis.document = realDocument; });
const setup = (opts) => { const env = makeEnv(); globalThis.document = env.doc; const bar = createActionBar({ doc: env.doc, ...opts }); return { env, bar, btns: () => bar.el.querySelectorAll('button') }; };

test('las 4 acciones se dibujan siempre en el orden de 7.7, aunque se pidan desordenadas', () => {
  const { bar, btns } = setup({ actions: ['dictionary', 'examples', 'ai', 'corrections'] });
  assert.deepEqual([...bar.ids], ['examples', 'corrections', 'ai', 'dictionary']);
  assert.deepEqual(btns().map((b) => b.querySelectorAll('.btn__label')[0].textContent), ['Otros ejemplos', 'Correcciones', 'Preguntas IA', 'Diccionario']);
  assert.deepEqual([...ACTION_IDS], ['examples', 'corrections', 'ai', 'dictionary']);
});

test('solo dibuja las acciones recibidas; sin ninguna, la barra queda oculta', () => {
  const one = setup({ actions: ['examples'] });
  assert.equal(one.btns().length, 1);
  assert.equal(one.bar.has('examples'), true);
  assert.equal(one.bar.has('ai'), false);
  assert.equal(one.bar.el.hasAttribute('hidden'), false);
  const none = setup({ actions: [] });
  assert.equal(none.btns().length, 0);
  assert.equal(none.bar.el.hasAttribute('hidden'), true);
});

test('es un grupo con nombre accesible y cada botón es un button real con texto visible', () => {
  const { bar, btns } = setup({ actions: [...ACTION_IDS] });
  assert.equal(bar.el.getAttribute('role'), 'group');
  assert.equal(bar.el.getAttribute('aria-label'), ACTION_TEXT.group);
  for (const b of btns()) { assert.equal(b.tagName.toLowerCase(), 'button'); assert.equal(b.getAttribute('type'), 'button'); assert.ok(b.querySelectorAll('.btn__label')[0].textContent.length > 0); }
});

test('tocar una acción avisa con su id y su botón; un onOpen que lanza no rompe la barra', () => {
  const seen = [];
  const { bar, btns } = setup({ actions: ['examples', 'ai'], onOpen: (id, el) => { seen.push([id, el]); if (id === 'ai') throw new Error('boom'); } });
  const errors = []; const real = console.error; console.error = (...a) => errors.push(a);
  try {
    btns()[0].dispatchEvent({ type: 'click', preventDefault() {} });
    btns()[1].dispatchEvent({ type: 'click', preventDefault() {} });
    btns()[0].dispatchEvent({ type: 'click', preventDefault() {} });
  } finally { console.error = real; }
  assert.deepEqual(seen.map((s) => s[0]), ['examples', 'ai', 'examples']);
  assert.equal(seen[0][1], btns()[0]);
  assert.equal(errors.length, 1);
  assert.ok(bar.has('ai'));
});

test('insignia: muestra la cuenta, 99+ para cifras grandes, y la quita con 0, null o valores no válidos', () => {
  const { bar, btns } = setup({ actions: ['corrections', 'examples'] });
  const badge = () => btns()[1].querySelectorAll('.actionbar__badge')[0]; // el orden fijo pone «examples» primero
  const cBadge = () => btns().find((b) => b.querySelectorAll('.btn__label')[0].textContent === 'Correcciones').querySelectorAll('.actionbar__badge')[0];
  void badge;
  assert.equal(cBadge().hasAttribute('hidden'), true);
  bar.setBadge('corrections', 3);
  assert.equal(cBadge().textContent, '3');
  assert.equal(cBadge().hasAttribute('hidden'), false);
  const btn = btns().find((b) => b.querySelectorAll('.btn__label')[0].textContent === 'Correcciones');
  assert.equal(btn.getAttribute('aria-label'), 'Correcciones: 3 en total', 'el lector de pantalla oye la cuenta');
  bar.setBadge('corrections', 150);
  assert.equal(cBadge().textContent, '99+');
  for (const bad of [0, null, undefined, -2, 1.5, NaN, '4', Infinity]) {
    bar.setBadge('corrections', 2); bar.setBadge('corrections', bad);
    assert.equal(cBadge().hasAttribute('hidden'), true, String(bad));
    assert.equal(btn.hasAttribute('aria-label'), false, String(bad));
  }
  assert.doesNotThrow(() => bar.setBadge('ai', 5), 'un id que no está dibujado se ignora');
});

test('la insignia es texto (no solo color) y no estorba al lector: aria-hidden', () => {
  const { bar, btns } = setup({ actions: ['corrections'] });
  bar.setBadge('corrections', 7);
  const b = btns()[0].querySelectorAll('.actionbar__badge')[0];
  assert.equal(b.getAttribute('aria-hidden'), 'true');
  assert.equal(b.textContent, '7');
});

test('opciones no válidas lanzan TypeError claro', () => {
  const env = makeEnv(); globalThis.document = env.doc;
  assert.throws(() => createActionBar({ doc: env.doc }), /"actions" debe ser una lista/);
  assert.throws(() => createActionBar({ doc: env.doc, actions: 'examples' }), /debe ser una lista/);
  assert.throws(() => createActionBar({ doc: env.doc, actions: ['examples', 'otra'] }), /acción desconocida "otra"/);
  assert.throws(() => createActionBar({ doc: env.doc, actions: ['examples', 'examples'] }), /repetida/);
  assert.throws(() => createActionBar({ doc: env.doc, actions: ['examples'], onOpen: 'x' }), /"onOpen" debe ser una función/);
  assert.throws(() => createActionBar(), /debe ser una lista/);
});

test('destroy es idempotente, quita la barra y los botones dejan de avisar', () => {
  const seen = [];
  const { env, bar, btns } = setup({ actions: ['examples'], onOpen: (id) => seen.push(id) });
  const host = env.doc.getElementById('app'); host.appendChild(bar.el);
  const b = btns()[0];
  bar.destroy(); bar.destroy();
  assert.equal(host.querySelectorAll('.actionbar').length, 0);
  b.dispatchEvent({ type: 'click', preventDefault() {} });
  assert.deepEqual(seen, []);
  assert.doesNotThrow(() => { bar.setBadge('examples', 2); bar.focus('examples'); });
});

test('el texto de las acciones no se repite en nombres ni se pierde con texto largo (cadenas únicas)', () => {
  const labels = ACTION_IDS.map((id) => ACTION_TEXT[id]);
  assert.equal(new Set(labels).size, 4);
});
