// @purpose: Pruebas de la vista Hoy y su botón «Estudiar ahora» (espera al contenido, navega a la sesión nueva) con DOM falso.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv } from './_fakeDom.mjs';
import hoyView, { HOY_TEXT } from '../ui/views/hoy.js';

const realDocument = globalThis.document;
afterEach(() => { globalThis.document = realDocument; });

async function mk(contentReady, extra = {}) {
  const env = makeEnv();
  globalThis.document = env.doc;
  const root = env.doc.getElementById('app'); root.replaceChildren();
  const navs = [];
  const view = hoyView();
  const mounting = view.mount(root, {}, { navigate: (...a) => navs.push(a), contentReady, ...extra });
  const btn = () => root.querySelectorAll('button').find((b) => /Estudiar ahora|Preparando/.test(b.textContent));
  const click = (el) => el.dispatchEvent({ type: 'click', preventDefault() {} });
  const settle = async () => { for (let i = 0; i < 5; i += 1) await env.flush(); };
  return { env, root, view, navs, btn, click, settle, mounting };
}

test('mientras el contenido se prepara el botón dice «Preparando…» y está deshabilitado; luego «Estudiar ahora»', async () => {
  let done; const ready = new Promise((r) => { done = r; });
  const t = await mk(ready); await t.settle();
  assert.equal(t.btn().textContent, HOY_TEXT.preparing);
  assert.equal(t.btn().hasAttribute('disabled'), true);
  t.click(t.btn()); await t.settle();
  assert.equal(t.navs.length, 0, 'deshabilitado: no navega');
  done({ ok: true, results: [] }); await t.settle();
  assert.equal(t.btn().textContent, HOY_TEXT.study);
  assert.equal(t.btn().hasAttribute('disabled'), false);
  assert.doesNotMatch(t.root.textContent, /No pude preparar/);
});

test('«Estudiar ahora» va a la sesión nueva', async () => {
  const t = await mk(Promise.resolve({ ok: true })); await t.settle();
  t.click(t.btn()); await t.settle();
  assert.deepEqual(JSON.parse(JSON.stringify(t.navs)), [['sesion', { id: 'nueva' }]]);
});

test('si el contenido falló: aviso amable y el botón sigue disponible; contentReady que rechaza o falta tampoco lo rompe', async () => {
  const failed = await mk(Promise.resolve({ ok: false, skipped: false, results: [], failed: [{ pack_id: 'x' }] })); await failed.settle();
  assert.match(failed.root.textContent, /No pude preparar el contenido/);
  assert.equal(failed.btn().hasAttribute('disabled'), false);
  const rejected = await mk(Promise.reject(new Error('x'))); await rejected.settle();
  assert.equal(rejected.btn().textContent, HOY_TEXT.study);
  const none = await mk(undefined); await none.settle();
  assert.equal(none.btn().textContent, HOY_TEXT.study);
  assert.doesNotMatch(none.root.textContent, /No pude preparar/);
});

test('destruir la vista antes de que llegue el contenido no lanza ni deja listeners', async () => {
  let done; const ready = new Promise((r) => { done = r; });
  const t = await mk(ready); await t.settle();
  t.view.destroy();
  done({ ok: true }); await t.settle();
  assert.equal(t.env.stats.live(), 0);
  assert.equal(t.root.textContent, '');
});

test('si la vista ya se destruyó, el contenido que llega tarde no escribe nada en ella', async () => {
  let done; const ready = new Promise((r) => { done = r; });
  const t = await mk(ready); await t.settle();
  const note = t.root.querySelectorAll('p').find((p) => p.getAttribute('role') === 'status');
  const btn = t.btn();
  t.view.destroy();
  done({ ok: false }); await t.settle();
  assert.equal(note.textContent, '', 'el aviso no se escribe en una vista destruida');
  assert.equal(btn.textContent, HOY_TEXT.preparing, 'el botón tampoco cambia');
});

test('la vista se monta de forma SÍNCRONA (no retrasa la navegación, aunque el contenido tarde)', () => {
  const env = makeEnv(); globalThis.document = env.doc;
  const root = env.doc.getElementById('app'); root.replaceChildren();
  hoyView().mount(root, {}, { navigate() {}, contentReady: new Promise(() => {}) });
  const btn = root.querySelectorAll('button')[0];
  assert.ok(btn, 'el botón ya está en pantalla en el mismo turno, sin esperar a ninguna promesa');
  assert.equal(btn.textContent, HOY_TEXT.preparing);
});

test('conserva el título «Hoy»', async () => {
  const t = await mk(Promise.resolve({ ok: true })); await t.settle();
  assert.equal(t.root.querySelectorAll('h1')[0].textContent, 'Hoy');
});
