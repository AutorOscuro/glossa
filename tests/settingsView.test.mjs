// Pruebas de ui/views/settings.js (subparte 0.8, cuarto 2B) con DOM falso, ajustes reales y base en memoria.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv } from './_fakeDom.mjs';
import { createSettings } from '../core/settings.js';
import { createMemoryDb, createMemoryDisk } from '../core/db.memory.js';
import { DbError } from '../core/dbErrors.js';
import { createAppearance } from '../app/appearance.js';
import settingsView from '../ui/views/settings.js';

const SECRET = ['gsk', '_', 'PRUEBA', '5555500000'].join('');
const realDocument = globalThis.document;
afterEach(() => { globalThis.document = realDocument; });

async function mk({ settings: given, services = {}, disk = createMemoryDisk() } = {}) {
  const env = makeEnv();
  globalThis.document = env.doc;
  const db = createMemoryDb({ disk }); await db.open();
  const settings = given ?? createSettings({ db });
  if (!given) await settings.load();
  const root = env.doc.getElementById('app');
  root.replaceChildren();
  const view = settingsView();
  await view.mount(root, {}, { version: '9.9.9', storageReady: Promise.resolve({ db }), settings, ...services });
  const q = (sel) => root.querySelectorAll(sel);
  const radio = (group, text) => q('.segmented').find((g) => g.getAttribute('aria-label') === group).querySelectorAll('button').find((b) => b.textContent === text);
  const click = (el) => el.dispatchEvent({ type: 'click', preventDefault() {} });
  const toggleBtn = (label) => q('button').find((b) => b.getAttribute('role') === 'switch' && b.textContent.startsWith(label));
  const sliderIn = (label) => q('.slider').find((s) => s.textContent.startsWith(label)).querySelector('input');
  const btnIn = (scope, text) => scope.querySelectorAll('button').find((b) => b.textContent === text);
  const keyFieldOf = (label) => q('.key-field').find((k) => k.textContent.includes(label));
  return { env, db, disk, settings, root, view, q, radio, click, toggleBtn, sliderIn, btnIn, keyFieldOf };
}
const tick = (t) => t.env.flush();

test('muestra título, las 10 tarjetas y los valores actuales', async () => {
  const t = await mk();
  assert.equal(t.root.querySelector('h1').textContent, 'Ajustes');
  const titles = t.q('h2').map((x) => x.textContent);
  assert.deepEqual(titles, ['Apariencia', 'Repaso', 'Sonido y vibración', 'Inteligencia artificial', 'Pronunciación (Azure)', 'Respaldo', 'Claves', 'Bienvenida', 'Acerca de', 'Zona de peligro']);
  assert.equal(t.radio('Tema', 'Automático').getAttribute('aria-checked'), 'true');
  assert.equal(t.radio('Tamaño de texto', 'Normal').getAttribute('aria-checked'), 'true');
  assert.equal(t.sliderIn('Retención objetivo').value, '0.9');
  assert.match(t.root.textContent, /90 %/);
  assert.match(t.root.textContent, /versión 9\.9\.9/);
  assert.match(t.root.textContent, /Más alta: recuerdas más/);
  assert.match(t.root.textContent, /solo en este dispositivo/);
});

test('cambiar tema y tamaño guarda y se ve en vivo (con la apariencia conectada)', async () => {
  const t = await mk();
  const ap = createAppearance({ doc: t.env.doc, win: t.env.win, settings: t.settings }); ap.apply();
  t.click(t.radio('Tema', 'Neo')); await tick(t);
  assert.equal(t.settings.get('theme'), 'neo');
  assert.equal(t.env.doc.documentElement.getAttribute('data-theme'), 'neo');
  t.click(t.radio('Tamaño de texto', 'Muy grande')); await tick(t);
  assert.equal(t.env.doc.documentElement.getAttribute('data-text-size'), 'xlarge');
  ap.destroy();
});

test('persiste: al abrir la pantalla otra vez con la misma base, los controles muestran lo guardado', async () => {
  const t = await mk();
  t.click(t.radio('Tema', 'Claro')); await tick(t);
  t.click(t.toggleBtn('Sonidos')); await tick(t);
  const t2 = await mk({ disk: t.disk });
  assert.equal(t2.radio('Tema', 'Claro').getAttribute('aria-checked'), 'true');
  assert.equal(t2.toggleBtn('Sonidos').getAttribute('aria-checked'), 'false');
});

test('deslizadores: retención, topes y sanguijuela se guardan al soltar', async () => {
  const t = await mk();
  const set = async (label, v) => { const i = t.sliderIn(label); i.value = String(v); i.dispatchEvent({ type: 'input' }); i.dispatchEvent({ type: 'change' }); await tick(t); };
  await set('Retención objetivo', 0.85); assert.equal(t.settings.get('retention'), 0.85);
  await set('Tope de repasos', 200); assert.equal(t.settings.get('dailyReviewCap'), 200);
  await set('Tarjetas nuevas', 0); assert.equal(t.settings.get('dailyNewCap'), 0);
  await set('Umbral de sanguijuela', 12); assert.equal(t.settings.get('leechThreshold'), 12);
  assert.match(t.q('.slider').find((s) => s.textContent.startsWith('Retención')).textContent, /85 %/);
});

test('interruptores y modo de IA', async () => {
  const t = await mk();
  t.click(t.toggleBtn('Tolerancia ortográfica')); await tick(t);
  t.click(t.toggleBtn('Vibración')); await tick(t);
  t.click(t.radio('Modo de IA', 'Siempre mecánico')); await tick(t);
  assert.equal(t.settings.get('spellingTolerance'), false);
  assert.equal(t.settings.get('vibration'), false);
  assert.equal(t.settings.get('aiMode'), 'mechanical');
});

test('modelo de IA: se guarda con Enter y se recorta; un texto demasiado largo se rechaza y el campo vuelve al valor real', async () => {
  const t = await mk();
  const input = t.q('input').find((i) => i.getAttribute('aria-label') === null && i.parentNode.textContent.includes('Modelo'));
  input.value = '  modelo-x  ';
  input.dispatchEvent({ type: 'keydown', key: 'Enter', preventDefault() {} }); await tick(t);
  assert.equal(t.settings.get('aiModel'), 'modelo-x');
  input.value = 'x'.repeat(101);
  input.dispatchEvent({ type: 'change' }); await tick(t);
  assert.equal(t.settings.get('aiModel'), 'modelo-x');
  assert.equal(input.value, 'modelo-x', 'vuelve al valor real');
  assert.ok(t.root.textContent.length > 0 && t.q('.field__error').some((e) => e.textContent !== ''), 'se avisa en español');
});

test('si guardar falla: el control vuelve al valor real y muestra el texto amable', async () => {
  const t = await mk();
  const real = t.settings.set.bind(t.settings);
  t.settings.set = async () => { throw new DbError('QUOTA'); };
  const logs = []; const orig = console.error; console.error = (...a) => logs.push(a.join(' '));
  try { t.click(t.radio('Tema', 'Claro')); await tick(t); } finally { console.error = orig; }
  assert.equal(t.radio('Tema', 'Automático').getAttribute('aria-checked'), 'true', 'vuelve a lo guardado');
  assert.equal(t.radio('Tema', 'Claro').getAttribute('aria-checked'), 'false');
  const err = t.q('.field__error').map((e) => e.textContent).find(Boolean);
  assert.ok(err && err.length > 5, 'texto amable visible');
  assert.match(logs.join(' '), /QUOTA/);
  t.settings.set = real;
});

test('clave de IA: se guarda, no aparece en ningún sitio y se puede borrar', async () => {
  const t = await mk();
  const kf = t.keyFieldOf('Clave de IA');
  const input = kf.querySelector('input');
  input.value = SECRET;
  t.click(t.btnIn(kf, 'Guardar clave')); await tick(t);
  assert.equal(t.settings.get('aiKey'), SECRET);
  assert.equal(t.settings.hasSecret('aiKey'), true);
  assert.equal(input.value, '');
  assert.ok(!t.env.doc.documentElement.outerHTML.includes(SECRET), 'la clave no está en el DOM');
  assert.ok(!JSON.stringify(t.settings.snapshot()).includes(SECRET));
  assert.match(kf.textContent, /Clave guardada en este dispositivo/);
  // la base guarda el registro marcado como secreto (el respaldo normal lo excluirá)
  assert.equal((await t.db.get('settings', 'aiKey')).secret, true);
  t.click(t.btnIn(kf, 'Borrar clave')); await tick(t);
  assert.equal(t.settings.get('aiKey'), '');
  assert.equal(await t.db.get('settings', 'aiKey'), null);
  assert.match(kf.textContent, /Clave borrada/);
});

test('clave de IA ya guardada: abre diciendo "guardada" sin mostrarla', async () => {
  const t = await mk();
  await t.settings.set('aiKey', SECRET);
  const t2 = await mk({ disk: t.disk });
  const kf = t2.keyFieldOf('Clave de IA');
  assert.match(kf.textContent, /Clave guardada en este dispositivo/);
  assert.ok(!t2.env.doc.documentElement.outerHTML.includes(SECRET));
  assert.equal(kf.querySelector('input').value, '');
});

test('Azure: campos presentes, deshabilitados y marcados "se activa en la Fase 8"', async () => {
  const t = await mk();
  assert.match(t.root.textContent, /Se activa en la Fase 8/);
  const kf = t.keyFieldOf('Clave de Azure');
  assert.ok(kf.querySelector('input').hasAttribute('disabled'));
  assert.ok(t.btnIn(kf, 'Guardar clave').hasAttribute('disabled'));
  const region = t.q('input').find((i) => i.parentNode.textContent.includes('Región de Azure'));
  assert.ok(region.hasAttribute('disabled'));
});

test('un cambio hecho desde fuera de la pantalla (otro módulo) se refleja en los controles', async () => {
  const t = await mk();
  await t.settings.set('theme', 'neo'); await t.settings.set('leechThreshold', 15); await t.settings.set('sounds', false);
  assert.equal(t.radio('Tema', 'Neo').getAttribute('aria-checked'), 'true');
  assert.equal(t.sliderIn('Umbral de sanguijuela').value, '15');
  assert.equal(t.toggleBtn('Sonidos').getAttribute('aria-checked'), 'false');
});

test('sin ajustes disponibles: mensaje amable en vez de romper', async () => {
  const env = makeEnv(); globalThis.document = env.doc;
  const root = env.doc.getElementById('app'); root.replaceChildren();
  const view = settingsView();
  await view.mount(root, {}, { version: '1', storageReady: Promise.resolve({ db: null }), settingsReady: Promise.resolve(null) });
  assert.match(root.textContent, /No se pudieron cargar los ajustes/);
  view.destroy();
});

test('espera a settingsReady cuando services.settings aún no existe', async () => {
  const env = makeEnv(); globalThis.document = env.doc;
  const root = env.doc.getElementById('app'); root.replaceChildren();
  const settings = createSettings(); await settings.load();
  const view = settingsView();
  await view.mount(root, {}, { version: '1', storageReady: Promise.resolve({ db: null }), settingsReady: Promise.resolve({ settings }) });
  assert.equal(root.querySelectorAll('.segmented').length, 3);
  view.destroy();
});

test('destruir: sin listeners colgados, y un cambio posterior en ajustes no toca el DOM ni lanza', async () => {
  const t = await mk();
  t.view.destroy(); t.view.destroy();
  assert.equal(t.env.stats.live(), 0);
  await t.settings.set('theme', 'claro');
  assert.equal(t.root.querySelectorAll('.segmented').length, 0);
});

test('destruir mientras espera la base: no pinta tarjetas', async () => {
  const env = makeEnv(); globalThis.document = env.doc;
  const root = env.doc.getElementById('app'); root.replaceChildren();
  let release; const gate = new Promise((r) => { release = r; });
  const settings = createSettings(); await settings.load();
  const view = settingsView();
  const mounting = view.mount(root, {}, { version: '1', storageReady: gate, settings });
  view.destroy(); release({ db: null }); await mounting;
  assert.equal(root.querySelectorAll('.card').length, 0);
  assert.equal(env.stats.live(), 0);
});

test('destruir da de baja la suscripción a los ajustes (sin fugas)', async () => {
  const settings = createSettings(); await settings.load();
  let active = 0;
  const orig = settings.onAnyChange.bind(settings);
  settings.onAnyChange = (fn) => { active += 1; const off = orig(fn); return () => { active -= 1; off(); }; };
  const t = await mk({ settings });
  assert.equal(active, 1);
  t.view.destroy();
  assert.equal(active, 0);
});

test('arranque directo en #/ajustes: el shell monta la vista ANTES de que main.js asigne los servicios y aun así carga', async () => {
  const { startApp } = await import('../app/shell.js');
  const env = makeEnv({ hash: '#/ajustes' }); globalThis.document = env.doc;
  const app = startApp({ doc: env.doc, win: env.win, version: '9.9.9', log: () => {} });
  // Igual que app/main.js: los servicios se asignan justo después de startApp.
  const settings = createSettings(); await settings.load();
  app.services.storageReady = Promise.resolve({ db: null });
  app.services.settingsReady = Promise.resolve({ settings });
  app.services.settings = settings;
  await env.flush();
  const main = env.doc.getElementById('view');
  assert.equal(main.querySelector('h1').textContent, 'Ajustes');
  assert.equal(main.querySelectorAll('.segmented').length, 3, `se pintaron los controles; texto: ${main.textContent.slice(0, 80)}`);
  assert.doesNotMatch(main.textContent, /No se pudieron cargar/);
});

test('destruir justo al montar (antes de leer los servicios): no lanza', async () => {
  const env = makeEnv(); globalThis.document = env.doc;
  const root = env.doc.getElementById('app'); root.replaceChildren();
  const view = settingsView();
  const mounting = view.mount(root, {}, { version: '1' });
  view.destroy();
  await mounting;
  assert.equal(root.querySelectorAll('h1').length, 0);
});

test('"Repetir bienvenida": navega a la bienvenida, sin guardar nada ni tocar el progreso', async () => {
  const nav = [];
  const t = await mk({ services: { navigate: (...a) => nav.push(a) } });
  const before = JSON.stringify(t.settings.snapshot());
  t.click(t.btnIn(t.root, 'Repetir bienvenida'));
  assert.deepEqual(nav, [['onboarding']]);
  assert.equal(JSON.stringify(t.settings.snapshot()), before, 'no cambia ningún ajuste');
  assert.equal(t.settings.get('onboardingDone'), false);
});

test('"Repetir bienvenida": navigate se lee al tocar (se asigna después de montar) y si falta no lanza', async () => {
  const env = makeEnv(); globalThis.document = env.doc;
  const settings = createSettings(); await settings.load();
  const services = { version: '9.9.9', storageReady: Promise.resolve({ db: null }), settings }; // mismo objeto que main.js completa después
  const root = env.doc.getElementById('app'); root.replaceChildren();
  const view = settingsView();
  await view.mount(root, {}, services);
  const press = () => root.querySelectorAll('button').find((b) => b.textContent === 'Repetir bienvenida').dispatchEvent({ type: 'click', preventDefault() {} });
  const orig = console.error; console.error = () => {};
  try { press(); } finally { console.error = orig; }
  const nav = [];
  services.navigate = (n) => nav.push(n);
  press();
  assert.deepEqual(nav, ['onboarding']);
});

test('"Repetir bienvenida" con el shell real: abre la bienvenida con el nombre guardado y Empezar vuelve a Hoy', async () => {
  const { startApp } = await import('../app/shell.js');
  const env = makeEnv({ hash: '#/ajustes' }); globalThis.document = env.doc;
  const settings = createSettings(); await settings.load();
  await settings.setMany({ onboardingDone: true, userName: 'Sophia' });
  const app = startApp({ doc: env.doc, win: env.win, version: '9.9.9', log: () => {} });
  app.services.storageReady = Promise.resolve({ db: null });
  app.services.settingsReady = Promise.resolve({ settings });
  app.services.settings = settings;
  for (let i = 0; i < 6; i += 1) await env.flush();
  const main = () => env.doc.getElementById('view');
  const btn = (text) => main().querySelectorAll('button').find((b) => b.textContent === text);
  btn('Repetir bienvenida').dispatchEvent({ type: 'click', preventDefault() {} });
  for (let i = 0; i < 6; i += 1) await env.flush();
  assert.equal(env.win.location.hash, '#/bienvenida');
  assert.match(main().querySelector('h1').textContent, /Me alegra que estés aquí/);
  assert.equal(main().querySelector('input').value, 'Sophia');
  for (const label of ['Siguiente', 'Siguiente', 'Empezar']) {
    btn(label).dispatchEvent({ type: 'click', preventDefault() {} });
    for (let i = 0; i < 6; i += 1) await env.flush();
  }
  assert.equal(env.win.location.hash, '#/hoy');
  assert.equal(main().querySelector('h1').textContent, 'Hoy');
});
