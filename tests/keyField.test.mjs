// @purpose: Pruebas del campo de clave secreta (ui/components/keyField.js) con DOM falso.
// Pruebas de ui/components/keyField.js (subparte 0.8, cuarto 2) con DOM falso.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv } from './_fakeDom.mjs';
import { createKeyField } from '../ui/components/index.js';

const SECRET = ['gsk', '_', 'PRUEBA', '9876543210'].join('');
const realDocument = globalThis.document;
afterEach(() => { globalThis.document = realDocument; });

function mk(o = {}) {
  const env = makeEnv();
  globalThis.document = env.doc;
  const calls = { save: [], clear: 0 };
  const kf = createKeyField({
    doc: env.doc, win: env.win, label: 'Clave de IA',
    onSave: async (v) => { calls.save.push(v); }, onClear: async () => { calls.clear += 1; }, ...o,
  });
  env.doc.body.appendChild(kf.el);
  const btn = (text) => kf.el.querySelectorAll('button').find((b) => b.textContent === text);
  const click = (b) => b.dispatchEvent({ type: 'click', preventDefault() {} });
  const type = (t) => { kf.input.value = t; };
  const status = () => kf.el.querySelector('.key-field__status').textContent;
  const error = () => kf.el.querySelector('.field__error').textContent;
  return { env, kf, calls, btn, click, type, status, error };
}

// Captura console.error durante una función.
async function withConsole(fn) {
  const seen = []; const orig = console.error;
  console.error = (...a) => seen.push(a.map(String).join(' '));
  try { await fn(); } finally { console.error = orig; }
  return seen;
}

test('opciones inválidas se rechazan en español', () => {
  const env = makeEnv(); const base = { doc: env.doc, win: env.win };
  const ok = { label: 'x', onSave() {}, onClear() {} };
  assert.throws(() => createKeyField({ ...base, ...ok, label: undefined }), (e) => e instanceof TypeError && /keyField: falta "label"/.test(e.message));
  assert.throws(() => createKeyField({ ...base, ...ok, onSave: undefined }), /falta "onSave"/);
  assert.throws(() => createKeyField({ ...base, ...ok, onClear: 5 }), /"onClear" debe ser una función/);
  assert.throws(() => createKeyField({ ...base, ...ok, saved: 'sí' }), /"saved" debe ser verdadero o falso/);
});

test('estado inicial: campo oculto sin autocompletar, aviso de privacidad, sin clave y borrar deshabilitado', () => {
  const t = mk();
  assert.equal(t.kf.input.getAttribute('type'), 'password');
  assert.equal(t.kf.input.getAttribute('autocomplete'), 'off');
  assert.equal(t.kf.input.getAttribute('spellcheck'), 'false');
  assert.match(t.kf.el.textContent, /Se guarda solo en este dispositivo/);
  assert.equal(t.status(), 'Todavía no hay clave guardada.');
  assert.ok(t.btn('Borrar clave').hasAttribute('disabled'));
  assert.equal(t.kf.isSaved(), false);
  assert.equal(t.kf.input.value, '', 'el campo nunca arranca con una clave dentro');
});

test('con clave ya guardada: solo dice "guardada", el campo sigue vacío y borrar está activo', () => {
  const t = mk({ saved: true });
  assert.equal(t.status(), 'Clave guardada en este dispositivo.');
  assert.equal(t.kf.input.value, '');
  assert.ok(!t.btn('Borrar clave').hasAttribute('disabled'));
});

test('mostrar/ocultar cambia el tipo del campo, el texto y aria-pressed', () => {
  const t = mk();
  const b = t.btn('Mostrar');
  assert.equal(b.getAttribute('aria-pressed'), 'false');
  t.click(b);
  assert.equal(t.kf.input.getAttribute('type'), 'text');
  const b2 = t.btn('Ocultar');
  assert.equal(b2.getAttribute('aria-pressed'), 'true');
  assert.match(b2.getAttribute('aria-label'), /Ocultar/);
  t.click(b2);
  assert.equal(t.kf.input.getAttribute('type'), 'password');
});

test('guardar vacío o solo espacios: error, sin llamar a onSave', async () => {
  const t = mk();
  t.type('   ');
  t.click(t.btn('Guardar clave')); await t.env.flush();
  assert.equal(t.calls.save.length, 0);
  assert.equal(t.error(), 'Escribe la clave antes de guardar.');
  assert.equal(t.kf.input.getAttribute('aria-invalid'), 'true');
});

test('guardar bien: recorta espacios, vacía el campo, lo oculta y pasa a "guardada"', async () => {
  const t = mk();
  t.click(t.btn('Mostrar'));
  t.type(`  ${SECRET}  `);
  t.click(t.btn('Guardar clave')); await t.env.flush();
  assert.deepEqual(t.calls.save, [SECRET]);
  assert.equal(t.kf.input.value, '');
  assert.equal(t.kf.input.getAttribute('type'), 'password');
  assert.equal(t.kf.isSaved(), true);
  assert.equal(t.status(), 'Clave guardada en este dispositivo.');
  assert.equal(t.error(), '');
  assert.ok(!t.btn('Borrar clave').hasAttribute('disabled'));
  assert.ok(!t.env.doc.documentElement.outerHTML.includes(SECRET), 'la clave no queda en el DOM');
});

test('Enter en el campo también guarda', async () => {
  const t = mk();
  t.type(SECRET);
  t.kf.input.dispatchEvent({ type: 'keydown', key: 'Enter', preventDefault() {} }); await t.env.flush();
  assert.deepEqual(t.calls.save, [SECRET]);
});

test('guardar falla con texto amable: se muestra ese texto, se conserva lo escrito y el mensaje interno NO se muestra ni se registra', async () => {
  const boom = Object.assign(new Error(`falló con ${SECRET}`), { friendly: 'No hay espacio para guardar.', code: 'QUOTA' });
  const t = mk({ onSave: async () => { throw boom; } });
  t.type(SECRET);
  const logs = await withConsole(async () => { t.click(t.btn('Guardar clave')); await t.env.flush(); });
  assert.equal(t.error(), 'No hay espacio para guardar.');
  assert.equal(t.kf.input.value, SECRET, 'lo escrito se conserva para reintentar');
  assert.equal(t.kf.isSaved(), false);
  assert.ok(!t.kf.el.textContent.includes(SECRET));
  assert.ok(!logs.join('\n').includes(SECRET), 'la consola no recibe la clave');
  assert.match(logs.join('\n'), /QUOTA/);
  assert.ok(!t.btn('Guardar clave').hasAttribute('disabled'), 'se puede reintentar');
});

test('error sin texto amable: mensaje genérico, nunca error.message', async () => {
  const t = mk({ onSave: async () => { throw new Error(`token ${SECRET} inválido`); } });
  t.type(SECRET);
  const logs = await withConsole(async () => { t.click(t.btn('Guardar clave')); await t.env.flush(); });
  assert.equal(t.error(), 'No se pudo guardar la clave. Inténtalo de nuevo.');
  assert.ok(!logs.join('\n').includes(SECRET));
});

test('doble toque: mientras guarda, los toques se ignoran; luego se puede reintentar', async () => {
  let release; let n = 0;
  const t = mk({ onSave: () => { n += 1; return new Promise((r) => { release = r; }); } });
  t.type(SECRET);
  const b = t.btn('Guardar clave');
  t.click(b); t.click(b); t.kf.input.dispatchEvent({ type: 'keydown', key: 'Enter', preventDefault() {} });
  assert.equal(n, 1);
  assert.equal(b.getAttribute('aria-busy'), 'true');
  assert.ok(t.kf.input.hasAttribute('disabled'), 'el campo se bloquea mientras guarda');
  release(); await t.env.flush();
  assert.equal(n, 1);
  assert.equal(t.kf.isSaved(), true);
  assert.ok(!t.kf.input.hasAttribute('disabled'));
});

test('borrar: llama a onClear, vuelve a "sin clave" y deshabilita borrar', async () => {
  const t = mk({ saved: true });
  t.click(t.btn('Borrar clave')); await t.env.flush();
  assert.equal(t.calls.clear, 1);
  assert.equal(t.kf.isSaved(), false);
  assert.equal(t.status(), 'Clave borrada.');
  assert.ok(t.btn('Borrar clave').hasAttribute('disabled'));
  t.click(t.btn('Borrar clave')); await t.env.flush();
  assert.equal(t.calls.clear, 1, 'borrar sin clave no hace nada');
});

test('borrar falla: sigue "guardada" y avisa', async () => {
  const t = mk({ saved: true, onClear: async () => { throw Object.assign(new Error('x'), { friendly: 'No se pudo borrar ahora.' }); } });
  await withConsole(async () => { t.click(t.btn('Borrar clave')); await t.env.flush(); });
  assert.equal(t.kf.isSaved(), true);
  assert.equal(t.error(), 'No se pudo borrar ahora.');
});

test('deshabilitado: nada responde; setSaved y textos propios', async () => {
  const t = mk({ disabled: true, text: { save: 'Guardar API' } });
  t.type(SECRET);
  t.click(t.btn('Guardar API')); await t.env.flush();
  assert.equal(t.calls.save.length, 0);
  t.kf.setDisabled(false); t.kf.setSaved(true);
  assert.equal(t.status(), 'Clave guardada en este dispositivo.');
});

test('destruir a mitad de un guardado: no lanza, vacía el campo y no deja listeners', async () => {
  let release;
  const t = mk({ onSave: () => new Promise((r) => { release = r; }) });
  t.type(SECRET);
  const input = t.kf.input;
  t.click(t.btn('Guardar clave'));
  t.kf.destroy(); t.kf.destroy();
  assert.equal(input.value, '', 'destroy vacía lo escrito');
  release(); await t.env.flush();
  assert.equal(t.env.stats.live(), 0, 'sin listeners colgados');
});

test('borrar mientras hay un guardado pendiente se ignora (no corren a la vez)', async () => {
  let release;
  const t = mk({ saved: true, onSave: () => new Promise((r) => { release = r; }) });
  t.type(SECRET);
  t.click(t.btn('Guardar clave'));
  t.click(t.btn('Borrar clave'));
  await t.env.flush();
  assert.equal(t.calls.clear, 0, 'el borrado no arranca durante un guardado');
  release(); await t.env.flush();
  assert.equal(t.kf.isSaved(), true);
});
