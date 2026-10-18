// Pruebas de app/firstRun.js (subparte 0.8, cuarto 4B): primer arranque → bienvenida una sola vez, sin quitar enlaces a propósito.
import { test, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from '../app/shell.js';
import { startFirstRun, isFrontDoor, resetFirstRunForTests } from '../app/firstRun.js';
import { createSettings } from '../core/settings.js';
import { createDataTools } from '../app/dataTools.js';
import { makeEnv } from './_fakeDom.mjs';

const realDocument = globalThis.document;
beforeEach(() => resetFirstRunForTests());
afterEach(() => { globalThis.document = realDocument; });

// Arranca el shell como main.js: primero startApp con el hash dado, luego los servicios y startFirstRun.
async function boot({ hash = '', done = false, name = '', settingsReady, noSettings = false } = {}) {
  resetFirstRunForTests(); // cada arranque simulado es una carga nueva de la página
  const env = makeEnv({ hash }); globalThis.document = env.doc;
  const initialHash = env.win.location.hash;
  const logs = [];
  const app = startApp({ doc: env.doc, win: env.win, version: '9.9.9', log: (...a) => logs.push(a) });
  const settings = createSettings(); await settings.load();
  if (done || name) await settings.setMany({ onboardingDone: done, userName: name });
  const ready = settingsReady ?? Promise.resolve(noSettings ? {} : { settings });
  app.services.storageReady = Promise.resolve({ db: null });
  app.services.settingsReady = ready;
  app.services.settings = settings;
  const result = startFirstRun({ settingsReady: ready, router: app.router, initialHash, log: (...a) => logs.push(a) });
  const settle = async () => { for (let i = 0; i < 8; i += 1) await env.flush(); };
  const main = () => env.doc.getElementById('view');
  return { env, app, settings, result, settle, logs, main, h1: () => main().querySelector('h1')?.textContent };
}

test('isFrontDoor: hash vacío, #/, #/hoy (con o sin consulta) son la puerta de entrada; lo demás no', () => {
  for (const h of ['', '#', '#/', '#/hoy', '#/HOY', '#/hoy?x=1', undefined, null]) assert.equal(isFrontDoor(h), true, String(h));
  for (const h of ['#/ajustes', '#/mapa', '#/sesion/a', '#/bienvenida', '#/nada', '#/404']) assert.equal(isFrontDoor(h), false, h);
});

test('primer arranque en la puerta de entrada y sin bienvenida vista: va a #/bienvenida', async () => {
  const t = await boot();
  assert.equal(await t.result, 'redirected');
  await t.settle();
  assert.equal(t.env.win.location.hash, '#/bienvenida');
  assert.match(t.h1(), /Me alegra que estés aquí/);
  assert.equal(t.env.doc.title, 'Bienvenida · Sophia Inglés');
  assert.equal(t.env.doc.querySelector('[aria-current]'), null, 'ninguna pestaña activa');
});

test('el primer arranque también aplica con hash #/hoy y con #/ (inicio de la app instalada)', async () => {
  for (const hash of ['#/hoy', '#/']) {
    const t = await boot({ hash });
    assert.equal(await t.result, 'redirected', hash);
    assert.equal(t.env.win.location.hash, '#/bienvenida', hash);
  }
});

test('reemplaza la entrada de Hoy: "atrás" no deja a la persona en una pantalla vacía de Hoy', async () => {
  const t = await boot();
  await t.result; await t.settle();
  t.env.win.back();
  await t.settle();
  assert.equal(t.env.win.location.hash, '#/bienvenida');
  assert.match(t.h1(), /Me alegra que estés aquí/);
});

test('si ya vio la bienvenida: no redirige', async () => {
  const t = await boot({ done: true });
  assert.equal(await t.result, 'skipped:done');
  await t.settle();
  assert.equal(t.env.win.location.hash, '#/hoy');
  assert.equal(t.h1(), 'Hoy');
});

test('un enlace a propósito (#/ajustes, #/sesion/x, #/tema/x) NO se desvía', async () => {
  for (const hash of ['#/ajustes', '#/sesion/abc', '#/tema/gram.pp', '#/mapa']) {
    const t = await boot({ hash });
    assert.equal(await t.result, 'skipped:deep-link', hash);
    await t.settle();
    assert.equal(t.env.win.location.hash, hash);
  }
});

test('un enlace desconocido (404) tampoco se desvía a la bienvenida', async () => {
  const t = await boot({ hash: '#/nada' });
  assert.equal(await t.result, 'skipped:deep-link');
  assert.equal(t.env.win.location.hash, '#/nada');
});

test('si la persona ya navegó a otra pantalla mientras cargaban los ajustes: no se la quitan', async () => {
  let release;
  const settingsReady = new Promise((res) => { release = res; });
  const t = await boot({ settingsReady });
  t.app.router.navigate('mapa');
  await t.settle();
  release({ settings: t.settings });
  assert.equal(await t.result, 'skipped:moved');
  await t.settle();
  assert.equal(t.env.win.location.hash, '#/mapa');
});

test('espera a los ajustes: mientras cargan se ve Hoy y al llegar pasa a la bienvenida', async () => {
  let release;
  const settingsReady = new Promise((res) => { release = res; });
  const t = await boot({ settingsReady });
  await t.settle();
  assert.equal(t.h1(), 'Hoy');
  release({ settings: t.settings });
  assert.equal(await t.result, 'redirected');
  await t.settle();
  assert.match(t.h1(), /Me alegra/);
});

test('si los ajustes no cargaron (sin settings o la promesa rechaza): no redirige y no lanza', async () => {
  const a = await boot({ noSettings: true });
  assert.equal(await a.result, 'skipped:no-settings');
  assert.equal(a.env.win.location.hash, '#/hoy');
  const b = await boot({ settingsReady: Promise.reject(Object.assign(new Error('x'), { code: 'BOOM' })) });
  assert.equal(await b.result, 'skipped:no-settings');
  assert.equal(b.env.win.location.hash, '#/hoy');
  assert.ok(b.logs.some((l) => String(l[0]).includes('Primer arranque')), 'se registra el motivo');
});

test('solo se decide una vez por carga: una segunda llamada no hace nada', async () => {
  const t = await boot();
  assert.equal(await t.result, 'redirected');
  assert.equal(await startFirstRun({ settingsReady: t.app.services.settingsReady, router: t.app.router, initialHash: '' }), 'skipped:again');
});

test('flujo completo: primer arranque → saltar → queda hecha y no vuelve a salir; Hoy queda en el historial limpio', async () => {
  const t = await boot();
  await t.result; await t.settle();
  const skip = t.main().querySelectorAll('button').find((b) => b.textContent === 'Saltar por ahora');
  skip.dispatchEvent({ type: 'click', preventDefault() {} });
  await t.settle();
  assert.equal(t.settings.get('onboardingDone'), true);
  assert.equal(t.env.win.location.hash, '#/hoy');
  assert.equal(t.h1(), 'Hoy');
  resetFirstRunForTests();
  const again = await startFirstRun({ settingsReady: Promise.resolve({ settings: t.settings }), router: t.app.router, initialHash: '' });
  assert.equal(again, 'skipped:done', 'al reabrir ya no sale');
});

test('"Borrar todo": onboardingDone vuelve a falso pero NO se lleva a la bienvenida al instante; sale al reabrir', async () => {
  const t = await boot({ done: true, name: 'Sophia' });
  assert.equal(await t.result, 'skipped:done');
  await t.settle();
  await createDataTools({ db: null, settings: t.settings }).wipeAll();
  await t.settle();
  assert.equal(t.settings.get('onboardingDone'), false);
  assert.equal(t.settings.get('userName'), '');
  assert.equal(t.env.win.location.hash, '#/hoy', 'la persona sigue donde estaba');
  // "Reabrir": nueva carga con los mismos ajustes (ya vacíos).
  resetFirstRunForTests();
  const env2 = makeEnv({ hash: '' }); globalThis.document = env2.doc;
  const app2 = startApp({ doc: env2.doc, win: env2.win, version: '9.9.9', log: () => {} });
  app2.services.settings = t.settings;
  const res = await startFirstRun({ settingsReady: Promise.resolve({ settings: t.settings }), router: app2.router, initialHash: '' });
  assert.equal(res, 'redirected');
  assert.equal(env2.win.location.hash, '#/bienvenida');
});

test('arranque directo en #/bienvenida: la vista monta antes de los servicios, carga y Empezar sale a Hoy', async () => {
  const t = await boot({ hash: '#/bienvenida' });
  assert.equal(await t.result, 'skipped:deep-link');
  await t.settle();
  assert.match(t.h1(), /Me alegra que estés aquí/);
  for (const label of ['Siguiente', 'Siguiente', 'Empezar']) {
    t.main().querySelectorAll('button').find((b) => b.textContent === label).dispatchEvent({ type: 'click', preventDefault() {} });
    await t.settle();
  }
  assert.equal(t.env.win.location.hash, '#/hoy');
  assert.equal(t.settings.get('onboardingDone'), true);
});

test('abrió un enlace a propósito y luego tocó Hoy mientras cargaban los ajustes: se respeta (no se le lleva a la bienvenida)', async () => {
  let release;
  const settingsReady = new Promise((res) => { release = res; });
  const t = await boot({ hash: '#/ajustes', settingsReady });
  t.app.router.navigate('hoy');
  await t.settle();
  release({ settings: t.settings });
  assert.equal(await t.result, 'skipped:deep-link');
  assert.equal(t.env.win.location.hash, '#/hoy');
});

test('tras terminar la bienvenida del primer arranque, "Atrás" no regresa a ella', async () => {
  const t = await boot();
  await t.result; await t.settle();
  t.main().querySelectorAll('button').find((b) => b.textContent === 'Saltar por ahora').dispatchEvent({ type: 'click', preventDefault() {} });
  await t.settle();
  assert.deepEqual(t.env.win.historyEntries(), ['#/hoy']);
  t.env.win.back();
  await t.settle();
  assert.equal(t.env.win.location.hash, '#/hoy');
});
