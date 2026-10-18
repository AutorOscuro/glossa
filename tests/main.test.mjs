// Prueba de extremo a extremo de app/main.js (subparte 0.8, cuarto 4B): se importa de verdad con window y document falsos
// (sin indexedDB: la base cae a memoria con su aviso). Comprueba el cableado del primer arranque que ninguna otra prueba toca.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv } from './_fakeDom.mjs';
import { resetFirstRunForTests } from '../app/firstRun.js';

const real = { document: globalThis.document, window: globalThis.window };
afterEach(() => { globalThis.document = real.document; globalThis.window = real.window; });

let n = 0;
async function launch(hash, { afterImport } = {}) {
  resetFirstRunForTests();
  const env = makeEnv({ hash });
  globalThis.document = env.doc;
  globalThis.window = env.win;
  const errors = [];
  const orig = console.error; console.error = (...a) => errors.push(a);
  try {
    n += 1;
    await import(`../app/main.js?launch=${n}`); // cada importación es una "carga de página" nueva
    afterImport?.(env); // antes de que terminen de cargar la base y los ajustes
    for (let i = 0; i < 12; i += 1) await env.flush();
  } finally { console.error = orig; }
  const main = () => env.doc.getElementById('view');
  return { env, main, errors, h1: () => main()?.querySelector('h1')?.textContent };
}

test('main.js: primera vez que se abre la app (sin hash) → bienvenida', async () => {
  const t = await launch('');
  assert.equal(t.env.win.location.hash, '#/bienvenida');
  assert.match(t.h1(), /Me alegra que estés aquí/);
});

test('main.js: abrir un enlace a propósito (#/ajustes) NO pasa por la bienvenida', async () => {
  const t = await launch('#/ajustes');
  assert.equal(t.env.win.location.hash, '#/ajustes');
  assert.equal(t.h1(), 'Ajustes');
});

test('main.js: la bienvenida terminada → Hoy, y "Repetir bienvenida" en Ajustes la vuelve a abrir', async () => {
  const t = await launch('');
  const press = async (label) => {
    t.main().querySelectorAll('button').find((b) => b.textContent === label).dispatchEvent({ type: 'click', preventDefault() {} });
    for (let i = 0; i < 8; i += 1) await t.env.flush();
  };
  await press('Saltar por ahora');
  assert.equal(t.env.win.location.hash, '#/hoy');
  assert.equal(t.h1(), 'Hoy');
  t.env.win.location.hash = '#/ajustes';
  for (let i = 0; i < 8; i += 1) await t.env.flush();
  await press('Repetir bienvenida');
  assert.equal(t.env.win.location.hash, '#/bienvenida');
  assert.match(t.h1(), /Me alegra que estés aquí/);
});

test('main.js: enlace a propósito (#/ajustes) y la persona toca Hoy mientras cargan los ajustes: no se le lleva a la bienvenida', async () => {
  const t = await launch('#/ajustes', { afterImport: (env) => { env.win.location.hash = '#/hoy'; } });
  assert.equal(t.env.win.location.hash, '#/hoy');
  assert.equal(t.h1(), 'Hoy');
});

test('main.js: terminar la bienvenida del primer arranque deja un historial limpio; repetirla desde Ajustes vuelve a Ajustes con "Atrás"', async () => {
  const t = await launch('');
  const press = async (label) => {
    t.main().querySelectorAll('button').find((b) => b.textContent === label).dispatchEvent({ type: 'click', preventDefault() {} });
    for (let i = 0; i < 8; i += 1) await t.env.flush();
  };
  await press('Saltar por ahora');
  assert.deepEqual(t.env.win.historyEntries(), ['#/hoy']);
  t.env.win.location.hash = '#/ajustes';
  for (let i = 0; i < 8; i += 1) await t.env.flush();
  await press('Repetir bienvenida');
  await press('Saltar por ahora');
  assert.equal(t.env.win.location.hash, '#/hoy');
  t.env.win.back();
  for (let i = 0; i < 8; i += 1) await t.env.flush();
  assert.equal(t.env.win.location.hash, '#/ajustes', 'Atrás vuelve a Ajustes, no a una bienvenida ya hecha');
});
