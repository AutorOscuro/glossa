// @purpose: Garantía del botón (ui/components/button.js) de la que dependen las guardas de fase de 2.4: un botón deshabilitado o cargando no dispara onClick, ni con toques repetidos.
// Condición 3a del Administrador (2.4-T4): las guardas de fase de ordenar, emparejar, banco y construir se apoyan en esto; si cambia, estas pruebas deben fallar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createButton } from '../ui/components/button.js';
import { makeEnv } from './_fakeDom.mjs';

const click = (el) => el.dispatchEvent({ type: 'click', preventDefault() {} });
function make(opts = {}) {
  const env = makeEnv();
  const calls = [];
  const b = createButton({ doc: env.doc, label: 'Comprobar', onClick: () => { calls.push(1); }, ...opts });
  env.doc.body.appendChild(b.el);
  return { env, b, calls };
}

test('un botón creado deshabilitado no dispara onClick, tampoco con 50 toques repetidos', () => {
  const { b, calls } = make({ disabled: true });
  assert.ok(b.el.hasAttribute('disabled'));
  for (let i = 0; i < 50; i += 1) click(b.el);
  assert.equal(calls.length, 0);
});

test('setDisabled(true) apaga el botón; con toques repetidos no dispara; setDisabled(false) lo devuelve a la vida', () => {
  const { b, calls } = make();
  click(b.el);
  assert.equal(calls.length, 1);
  b.setDisabled(true);
  assert.ok(b.el.hasAttribute('disabled'), 'el atributo disabled se pinta (el botón se ve apagado y el lector lo anuncia)');
  for (let i = 0; i < 20; i += 1) click(b.el);
  assert.equal(calls.length, 1, 'deshabilitado no dispara');
  b.setDisabled(false);
  assert.ok(!b.el.hasAttribute('disabled'), 'al volver, el atributo se quita');
  click(b.el);
  assert.equal(calls.length, 2);
});

test('el toque sobre un botón deshabilitado se descarta con preventDefault y no lanza', () => {
  const { b } = make({ disabled: true });
  let prevented = 0;
  assert.doesNotThrow(() => b.el.dispatchEvent({ type: 'click', preventDefault() { prevented += 1; } }));
  assert.equal(prevented, 1);
});

test('un botón cargando ignora los toques (también repetidos) y vuelve a responder al terminar', () => {
  const { b, calls } = make();
  b.setLoading(true);
  for (let i = 0; i < 20; i += 1) click(b.el);
  assert.equal(calls.length, 0);
  b.setLoading(false);
  click(b.el);
  assert.equal(calls.length, 1);
});

test('deshabilitado y cargando a la vez: sigue sin disparar al quitar solo la carga', () => {
  const { b, calls } = make({ disabled: true });
  b.setLoading(true);
  click(b.el);
  b.setLoading(false);
  for (let i = 0; i < 5; i += 1) click(b.el);
  assert.equal(calls.length, 0);
});

test('un onClick que deshabilita al propio botón no recibe un segundo toque aunque llegue enseguida', () => {
  const env = makeEnv();
  let n = 0;
  let b = null;
  b = createButton({ doc: env.doc, label: 'Enviar', onClick: () => { n += 1; b.setDisabled(true); } });
  env.doc.body.appendChild(b.el);
  for (let i = 0; i < 10; i += 1) click(b.el);
  assert.equal(n, 1);
});

test('con lockMs, los toques repetidos dentro del plazo no disparan', () => {
  const env = makeEnv();
  let n = 0;
  let t = 1000;
  const b = createButton({ doc: env.doc, label: 'Enviar', lockMs: 500, now: () => t, onClick: () => { n += 1; } });
  env.doc.body.appendChild(b.el);
  click(b.el); click(b.el); click(b.el);
  assert.equal(n, 1);
  t += 600;
  click(b.el);
  assert.equal(n, 2);
});

test('tras destroy() el botón no dispara', () => {
  const { b, calls } = make();
  b.destroy();
  click(b.el);
  assert.equal(calls.length, 0);
});
