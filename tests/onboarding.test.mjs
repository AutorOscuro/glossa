// Pruebas de ui/views/onboarding.js (subparte 0.8, cuarto 4A) con DOM falso, ajustes reales y base en memoria.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv } from './_fakeDom.mjs';
import { createSettings } from '../core/settings.js';
import { createMemoryDb, createMemoryDisk } from '../core/db.memory.js';
import { DbError } from '../core/dbErrors.js';
import onboardingView, { ENERGY_KEY, NAME_MAX } from '../ui/views/onboarding.js';

const realDocument = globalThis.document;
afterEach(() => { globalThis.document = realDocument; });

async function mk({ noDb = false, presets = {}, settingsOverride, services = {} } = {}) {
  const env = makeEnv();
  globalThis.document = env.doc;
  const db = noDb ? null : createMemoryDb({ disk: createMemoryDisk() });
  if (db) await db.open();
  const real = createSettings({ db });
  await real.load();
  if (Object.keys(presets).length) await real.setMany(presets);
  const settings = settingsOverride ? settingsOverride(real) : real;
  const nav = [];
  const navOptions = [];
  const root = env.doc.getElementById('app'); root.replaceChildren();
  const view = onboardingView();
  const clock = { now: () => new Date('2026-10-17T12:00:00.000Z') };
  await view.mount(root, {}, { storageReady: Promise.resolve({ db }), settings, navigate: (n, _p, o) => { nav.push(n); navOptions.push(o); }, clock, ...services });
  const q = (sel) => root.querySelectorAll(sel);
  const btn = (text) => q('button').find((b) => b.textContent === text);
  const click = (el) => el.dispatchEvent({ type: 'click', preventDefault() {} });
  const press = async (text) => { click(btn(text)); for (let i = 0; i < 5; i += 1) await env.flush(); };
  const type = (value) => { const input = q('input')[0]; input.value = value; input.dispatchEvent({ type: 'input' }); };
  const pick = (label) => click(q('.segmented button').find((b) => b.textContent === label));
  const title = () => q('h1')[0]?.textContent;
  const alerts = () => [...q('[role="alert"]'), ...q('.field__error')].map((a) => a.textContent).join(' ');
  return { env, db, real, settings, root, view, nav, navOptions, q, btn, click, press, type, pick, title, alerts };
}
const quiet = async (fn) => { const orig = console.error; console.error = () => {}; try { return await fn(); } finally { console.error = orig; } };

test('pantalla 1: bienvenida cálida, nombre opcional y botones para seguir o saltar', async () => {
  const t = await mk();
  assert.match(t.title(), /Me alegra que estés aquí/);
  assert.ok(t.q('input')[0], 'campo de nombre');
  assert.match(t.root.textContent, /opcional/i);
  for (const l of ['Siguiente', 'Saltar por ahora']) assert.ok(t.btn(l), l);
  assert.equal(t.btn('Atrás'), undefined, 'no hay "Atrás" en la primera');
  assert.match(t.root.textContent, /Paso 1 de 3/);
  assert.equal(t.q('[role="progressbar"]').length, 1);
  assert.equal(t.nav.length, 0);
});

test('recorre las 3 pantallas y guarda nombre, energía y onboardingDone; luego va a Hoy', async () => {
  const t = await mk();
  t.type('  Sophia  ');
  await t.press('Siguiente');
  assert.match(t.title(), /energía/); assert.match(t.root.textContent, /Paso 2 de 3/);
  t.pick('Normal');
  await t.press('Siguiente');
  assert.equal(t.title(), 'Sin rachas, sin culpa'); assert.match(t.root.textContent, /Paso 3 de 3/);
  assert.match(t.root.textContent, /Sophia, así funciona esto/);
  assert.equal(t.real.get('onboardingDone'), false, 'nada se guarda hasta el final');
  await t.press('Empezar');
  assert.equal(t.real.get('userName'), 'Sophia'); assert.equal(t.real.get('onboardingDone'), true);
  assert.deepEqual(await t.db.get('meta', ENERGY_KEY), { key: ENERGY_KEY, value: 'mid', at: '2026-10-17T12:00:00.000Z' });
  assert.deepEqual(t.nav, ['hoy']);
});

test('terminar sin escribir nada ni elegir energía también funciona y no guarda energía', async () => {
  const t = await mk();
  await t.press('Siguiente'); await t.press('Siguiente');
  assert.match(t.root.textContent, /^.*Así funciona esto:/);
  await t.press('Empezar');
  assert.equal(t.real.get('userName'), ''); assert.equal(t.real.get('onboardingDone'), true);
  assert.equal(await t.db.get('meta', ENERGY_KEY), null);
  assert.deepEqual(t.nav, ['hoy']);
});

test('Atrás conserva el nombre y la energía', async () => {
  const t = await mk();
  t.type('Ana'); await t.press('Siguiente'); t.pick('Alta'); await t.press('Siguiente');
  await t.press('Atrás');
  assert.equal(t.q('.segmented button').find((b) => b.getAttribute('aria-checked') === 'true').textContent, 'Alta');
  await t.press('Atrás');
  assert.equal(t.q('input')[0].value, 'Ana');
  await t.press('Siguiente'); await t.press('Siguiente'); await t.press('Empezar');
  assert.equal(t.real.get('userName'), 'Ana');
  assert.equal((await t.db.get('meta', ENERGY_KEY)).value, 'high');
});

test('se puede saltar desde la pantalla 1 y la 2: marca la bienvenida como vista y va a Hoy', async () => {
  const a = await mk();
  await a.press('Saltar por ahora');
  assert.equal(a.real.get('onboardingDone'), true); assert.deepEqual(a.nav, ['hoy']); assert.equal(a.real.get('userName'), '');
  const b = await mk();
  b.type('Luz'); await b.press('Siguiente'); b.pick('Baja');
  await b.press('Saltar por ahora');
  assert.equal(b.real.get('onboardingDone'), true); assert.equal(b.real.get('userName'), 'Luz');
  assert.equal((await b.db.get('meta', ENERGY_KEY)).value, 'low');
  assert.deepEqual(b.nav, ['hoy']);
});

test('nombre demasiado largo: no deja avanzar, avisa en el campo y se corrige', async () => {
  const t = await mk();
  t.type('x'.repeat(NAME_MAX + 1));
  await t.press('Siguiente');
  assert.match(t.title(), /Me alegra/);
  assert.match(t.alerts(), new RegExp(`${NAME_MAX} letras o menos`));
  t.type('x'.repeat(NAME_MAX));
  assert.equal(t.alerts().includes('letras o menos'), false, 'el aviso se quita al escribir');
  await t.press('Siguiente');
  assert.match(t.title(), /energía/);
});

test('saltar con un nombre demasiado largo: termina igual y no guarda ese nombre', async () => {
  const t = await mk({ presets: { userName: 'Ana' } });
  t.type('y'.repeat(NAME_MAX + 5));
  await t.press('Saltar por ahora');
  assert.equal(t.real.get('onboardingDone'), true); assert.equal(t.real.get('userName'), 'Ana');
  assert.deepEqual(t.nav, ['hoy']);
});

test('repetir la bienvenida: muestra el nombre guardado y se puede borrar', async () => {
  const t = await mk({ presets: { userName: 'Ana', onboardingDone: true } });
  assert.equal(t.q('input')[0].value, 'Ana');
  t.type('');
  await t.press('Siguiente'); await t.press('Siguiente'); await t.press('Empezar');
  assert.equal(t.real.get('userName'), ''); assert.equal(t.real.get('onboardingDone'), true);
  assert.deepEqual(t.nav, ['hoy']);
});

test('si guardar falla: se queda, muestra el texto amable, no marca nada y deja reintentar', async () => {
  let fail = true;
  const t = await mk({ settingsOverride: (s) => ({ ...s, get: s.get, setMany: async (p) => { if (fail) throw new DbError('QUOTA'); return s.setMany(p); } }) });
  t.type('Eva');
  await quiet(async () => { await t.press('Saltar por ahora'); });
  assert.deepEqual(t.nav, []);
  assert.match(t.alerts(), /No queda espacio/);
  assert.equal(t.real.get('onboardingDone'), false);
  assert.equal(t.btn('Saltar por ahora').hasAttribute('disabled'), false, 'botones libres');
  fail = false;
  await t.press('Saltar por ahora');
  assert.deepEqual(t.nav, ['hoy']); assert.equal(t.real.get('userName'), 'Eva');
});

test('un fallo genérico usa el texto de reserva', async () => {
  const t = await mk({ settingsOverride: (s) => ({ ...s, get: s.get, setMany: async () => { throw new Error('raro'); } }) });
  await quiet(async () => { await t.press('Saltar por ahora'); });
  assert.match(t.alerts(), /No se pudo guardar tu bienvenida/);
  assert.deepEqual(t.nav, []);
});

test('si falla guardar la energía, igualmente termina', async () => {
  const t = await mk();
  const realPut = t.db.put.bind(t.db);
  t.db.put = async (s, r) => { if (s === 'meta') throw new DbError('QUOTA'); return realPut(s, r); };
  await t.press('Siguiente'); t.pick('Alta');
  await quiet(async () => { await t.press('Saltar por ahora'); });
  assert.deepEqual(t.nav, ['hoy']); assert.equal(t.real.get('onboardingDone'), true);
});

test('sin base: termina bien y no intenta guardar la energía', async () => {
  const t = await mk({ noDb: true });
  await t.press('Siguiente'); t.pick('Normal'); await t.press('Siguiente'); await t.press('Empezar');
  assert.deepEqual(t.nav, ['hoy']); assert.equal(t.real.get('onboardingDone'), true);
});

test('doble toque en Empezar guarda y navega una sola vez', async () => {
  let calls = 0;
  const t = await mk({ settingsOverride: (s) => ({ ...s, get: s.get, setMany: async (p) => { calls += 1; return s.setMany(p); } }) });
  await t.press('Siguiente'); await t.press('Siguiente');
  const go = t.btn('Empezar'); t.click(go); t.click(go);
  for (let i = 0; i < 5; i += 1) await t.env.flush();
  assert.equal(calls, 1); assert.deepEqual(t.nav, ['hoy']);
});

test('sin ajustes disponibles: mensaje amable y botón para ir a Hoy', async () => {
  const env = makeEnv(); globalThis.document = env.doc;
  const root = env.doc.getElementById('app'); root.replaceChildren();
  const nav = [];
  const view = onboardingView();
  await view.mount(root, {}, { storageReady: Promise.resolve({ db: null }), settingsReady: Promise.resolve({ settings: null }), navigate: (n) => nav.push(n) });
  assert.match(root.textContent, /No pudimos preparar la bienvenida/);
  const go = root.querySelectorAll('button').find((b) => b.textContent === 'Ir a Hoy');
  go.dispatchEvent({ type: 'click', preventDefault() {} });
  assert.deepEqual(nav, ['hoy']);
  view.destroy(); assert.equal(env.stats.live(), 0);
});

test('al cambiar de pantalla el foco pasa al título (lectores de pantalla)', async () => {
  const t = await mk();
  await t.press('Siguiente');
  assert.equal(t.env.doc.activeElement, t.q('h1')[0]);
});

test('los textos no presionan ni culpan', async () => {
  const t = await mk();
  let all = t.root.textContent;
  await t.press('Siguiente'); all += t.root.textContent;
  await t.press('Siguiente'); all += t.root.textContent;
  assert.match(all, /Sin rachas, sin culpa/);
  assert.doesNotMatch(all, /debes|tienes que|obligatori|perder tu racha|castigo|fallaste|test inicial|examen/i);
});

test('el nombre entra como texto, nunca como HTML', async () => {
  const t = await mk();
  t.type('<b>Ana</b>'); await t.press('Siguiente'); await t.press('Siguiente');
  assert.equal(t.q('b').length, 0);
  assert.match(t.root.textContent, /<b>Ana<\/b>, así funciona/);
});

test('destruir deja cero listeners; destruir mientras espera la base no pinta nada', async () => {
  const t = await mk();
  await t.press('Siguiente');
  t.view.destroy(); t.view.destroy();
  assert.equal(t.env.stats.live(), 0);
  const env = makeEnv(); globalThis.document = env.doc;
  const root = env.doc.getElementById('app'); root.replaceChildren();
  let release; const gate = new Promise((r) => { release = r; });
  const settings = createSettings(); await settings.load();
  const view = onboardingView();
  const mounting = view.mount(root, {}, { storageReady: gate, settings, navigate() {} });
  view.destroy(); release({ db: null }); await mounting;
  assert.equal(root.querySelectorAll('h1').length, 0); assert.equal(env.stats.live(), 0);
});

test('destruir mientras guarda: no navega ni toca el DOM', async () => {
  let release;
  const slow = new Promise((r) => { release = r; });
  const t = await mk({ settingsOverride: (s) => ({ ...s, get: s.get, setMany: async (p) => { await slow; return s.setMany(p); } }) });
  t.click(t.btn('Saltar por ahora')); await t.env.flush();
  t.view.destroy(); release();
  for (let i = 0; i < 5; i += 1) await t.env.flush();
  assert.deepEqual(t.nav, []);
});

test('arranque directo: el shell monta la vista antes de que main.js asigne los servicios y aun así carga', async () => {
  const env = makeEnv(); globalThis.document = env.doc;
  const root = env.doc.getElementById('app'); root.replaceChildren();
  const services = {};
  const settings = createSettings(); await settings.load();
  const view = onboardingView();
  const mounting = view.mount(root, {}, services);
  const nav = [];
  services.settings = settings; services.storageReady = Promise.resolve({ db: null }); services.navigate = (n) => nav.push(n);
  await mounting;
  assert.match(root.querySelector('h1').textContent, /Me alegra/);
  root.querySelectorAll('button').find((b) => b.textContent === 'Saltar por ahora').dispatchEvent({ type: 'click', preventDefault() {} });
  for (let i = 0; i < 5; i += 1) await env.flush();
  assert.deepEqual(nav, ['hoy'], 'navigate asignado después de montar sí se usa');
});

test('al terminar o saltar, va a Hoy REEMPLAZANDO la entrada de la bienvenida (el botón atrás no regresa a ella)', async () => {
  for (const route of [['Saltar por ahora'], ['Siguiente', 'Siguiente', 'Empezar']]) {
    const t = await mk();
    for (const label of route) await t.press(label);
    assert.deepEqual(t.nav, ['hoy']);
    assert.deepEqual(t.navOptions, [{ replace: true }]);
  }
});
