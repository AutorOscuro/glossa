// @purpose: Pruebas de integración del shell (app/shell.js) con DOM y window falsos: navegación, 404 y errores.
// Pruebas de integración del shell (app/shell.js, subparte 0.4) con DOM y window falsos:
// navegación, atrás/adelante, 404, errores de vistas y errores globales, carreras asíncronas, desplazamiento y fugas.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, VIEWS } from '../app/shell.js';
import { createView } from '../ui/views/_viewBase.js';
import { makeEnv, makeTimers } from './_fakeDom.mjs';

const realDocument = globalThis.document;
afterEach(() => { globalThis.document = realDocument; });

function boot({ hash = '', views, light = false, search = '', clipboard } = {}) {
  const env = makeEnv({ hash, light, search, clipboard });
  globalThis.document = env.doc; // los componentes de las vistas usan h() con el documento global
  const logs = [];
  const timers = makeTimers();
  const app = startApp({ doc: env.doc, win: env.win, version: '9.9.9', views: views ? { ...VIEWS, ...views } : VIEWS, log: (...a) => logs.push(a), timers });
  const main = () => env.doc.getElementById('view');
  const h1 = () => main().querySelector('h1')?.textContent;
  const activeTab = () => env.doc.querySelector('[aria-current]')?.getAttribute('data-tab') ?? null;
  const click = (el) => el.dispatchEvent({ type: 'click' });
  const button = (text) => main().querySelectorAll('button').find((b) => b.textContent === text);
  return { ...env, app, logs, timers, main, h1, activeTab, click, button };
}

test('arranque: hash vacío → Hoy; título, pestaña activa, marca de arranque y texto de carga retirado', () => {
  const t = boot();
  assert.equal(t.win.location.hash, '#/hoy');
  assert.equal(t.h1(), 'Hoy');
  assert.equal(t.activeTab(), 'hoy');
  assert.equal(t.doc.title, 'Hoy · Glossa');
  assert.equal(t.doc.documentElement.dataset.booted, '1');
  assert.equal(t.doc.getElementById('boot'), null);
  assert.equal(t.doc.querySelectorAll('.bottom-nav a').length, 5);
  assert.equal(t.doc.querySelectorAll('main').length, 1);
});

test('arranque: el shell expone el contenedor de avisos (lo usa el aviso de actualización de la 0.6)', () => {
  const t = boot();
  assert.ok(t.app.toastStack);
  assert.ok(t.app.toastStack.classList.contains('toast-stack'));
  assert.equal(t.app.toastStack.parentNode, t.doc.getElementById('app'));
});

test('arranque: tema inicial = Aurora (aunque el sistema sea claro) o ?tema= válido; inválido se ignora', () => {
  assert.equal(boot().doc.documentElement.getAttribute('data-theme'), 'aurora');
  assert.equal(boot({ light: true }).doc.documentElement.getAttribute('data-theme'), 'aurora', 'ya no se sigue al sistema');
  assert.equal(boot({ search: '?tema=neo' }).doc.documentElement.getAttribute('data-theme'), 'neo');
  assert.equal(boot({ search: '?tema=<script>' }).doc.documentElement.getAttribute('data-theme'), 'aurora');
  assert.equal(boot().doc.querySelector('meta[name="theme-color"]').getAttribute('content'), '#070a1d');
});

test('arranque con ruta profunda: #/tema/<id> abre esa vista con su parámetro y la pestaña Mapa', () => {
  const t = boot({ hash: '#/tema/gram.pp' });
  assert.equal(t.h1(), 'Tema');
  assert.ok(t.main().textContent.includes('gram.pp'));
  assert.equal(t.activeTab(), 'mapa');
});

test('navegar por las 5 pestañas cambia la vista y la pestaña activa', () => {
  const t = boot();
  for (const [tab, title] of [['mapa', 'Mapa'], ['practicar', 'Practicar'], ['errores', 'Errores'], ['mas', 'Más'], ['hoy', 'Hoy']]) {
    t.win.location.hash = `#/${tab}`;
    assert.equal(t.h1(), title);
    assert.equal(t.activeTab(), tab);
    assert.equal(t.doc.title, `${title} · Glossa`);
  }
});

test('atrás y adelante del navegador funcionan', () => {
  const t = boot();
  t.win.location.hash = '#/mapa';
  t.win.location.hash = '#/errores';
  t.win.back();
  assert.equal(t.h1(), 'Mapa');
  t.win.back();
  assert.equal(t.h1(), 'Hoy');
  t.win.forward();
  assert.equal(t.h1(), 'Mapa');
});

test('ruta desconocida → pantalla 404 amable con la dirección y un botón a Hoy; ninguna pestaña activa', () => {
  const t = boot({ hash: '#/nada/raro' });
  assert.equal(t.h1(), 'No encontramos esa pantalla');
  assert.ok(t.main().textContent.includes('#/nada/raro'));
  assert.equal(t.main().querySelector('a').getAttribute('href'), '#/hoy');
  assert.equal(t.activeTab(), null);
  t.win.location.hash = '#/hoy';
  assert.equal(t.h1(), 'Hoy');
});

test('la dirección del 404 con HTML se muestra como texto, sin crear elementos', () => {
  const t = boot({ hash: '#/<img src=x onerror=alert(1)>' });
  assert.equal(t.main().querySelectorAll('img').length, 0);
  assert.ok(t.main().textContent.includes('<img src=x onerror=alert(1)>'));
});

test('sin fugas: ir y volver 30 veces entre vistas con listeners deja el conteo igual', () => {
  const t = boot();
  const base = t.stats.live();
  for (let i = 0; i < 30; i += 1) {
    t.win.location.hash = '#/mas';
    t.win.location.hash = '#/hoy';
  }
  assert.equal(t.stats.live(), base);
});

test('una vista que lanza al montar NO tumba la app: pantalla de error, navegación viva, se puede seguir', () => {
  const bad = createView(() => { throw new Error('vista rota'); });
  const t = boot({ views: { mapa: bad } });
  t.win.location.hash = '#/mapa';
  assert.equal(t.main().querySelector('h1').textContent, 'Algo no salió bien');
  assert.ok(t.main().querySelector('.error-screen'));
  assert.ok(t.doc.querySelector('.bottom-nav'));
  assert.equal(t.activeTab(), 'mapa');
  assert.ok(t.logs.some((l) => String(l[1]?.message ?? l[0]).includes('vista rota')));
  t.win.location.hash = '#/errores';
  assert.equal(t.h1(), 'Errores');
  assert.equal(t.main().querySelector('.error-screen'), null);
});

test('error de vista: "Reintentar" vuelve a montar y funciona si el fallo era pasajero', async () => {
  let calls = 0;
  const flaky = createView((ctx) => { calls += 1; if (calls === 1) throw new Error('pasajero'); ctx.root.appendChild(ctx.root.ownerDocument?.createElement?.('h1') ?? globalThis.document.createElement('h1')); ctx.root.querySelector('h1').textContent = 'Mapa listo'; });
  const t = boot({ views: { mapa: flaky } });
  t.win.location.hash = '#/mapa';
  t.click(t.button('Reintentar'));
  await t.flush();
  assert.equal(calls, 2);
  assert.equal(t.h1(), 'Mapa listo');
});

test('vista asíncrona que rechaza → pantalla de error', async () => {
  const bad = createView(async () => { throw new Error('async rota'); });
  const t = boot({ views: { mapa: bad } });
  t.win.location.hash = '#/mapa';
  await t.flush();
  assert.ok(t.main().querySelector('.error-screen'));
});

test('carrera: navegar mientras una vista asíncrona aún carga descarta la vieja (sin parpadeo ni fuga)', async () => {
  let release;
  let cleaned = 0;
  const gate = new Promise((r) => { release = r; });
  const slow = createView(async (ctx) => {
    await gate;
    if (ctx.alive()) ctx.root.appendChild(globalThis.document.createElement('p'));
    return () => { cleaned += 1; };
  });
  // Hoy real tiene un botón con su listener (2.9-T3); aquí se usa uno mínimo para medir solo lo que deja la vista lenta.
  const hoyMinimo = createView((ctx) => { ctx.root.appendChild(globalThis.document.createElement('h1')).textContent = 'Hoy'; });
  const t = boot({ views: { mapa: slow, hoy: hoyMinimo } });
  const base = t.stats.live();
  const scrolls0 = t.win.scrollCalls.length;
  t.win.location.hash = '#/mapa';
  t.win.location.hash = '#/errores';
  release();
  await t.flush();
  assert.equal(t.h1(), 'Errores');
  assert.equal(t.win.scrollCalls.length, scrolls0 + 1, 'la vista vieja no debe mover el desplazamiento ni el foco al terminar tarde');
  assert.equal(t.main().querySelectorAll('p').length >= 1, true);
  assert.ok(!t.main().textContent.includes('Mapa'));
  assert.equal(cleaned, 1);
  assert.equal(t.stats.live(), base);
});

test('navegación frenética: 40 cambios seguidos terminan en la última pantalla sin errores', () => {
  const t = boot();
  const tabs = ['mapa', 'practicar', 'errores', 'mas', 'hoy'];
  for (let i = 0; i < 40; i += 1) t.win.location.hash = `#/${tabs[i % 5]}`;
  assert.equal(t.h1(), 'Hoy');
  assert.equal(t.logs.length, 0);
  assert.equal(t.main().querySelectorAll('h1').length, 1);
});

test('error en destroy() de una vista no impide navegar y se registra', () => {
  const stubborn = () => ({ mount: (root) => { root.appendChild(globalThis.document.createElement('h1')); root.querySelector('h1').textContent = 'Terca'; }, destroy: () => { throw new Error('no se deja'); } });
  const t = boot({ views: { mapa: stubborn } });
  t.win.location.hash = '#/mapa';
  assert.equal(t.h1(), 'Terca');
  t.win.location.hash = '#/hoy';
  assert.equal(t.h1(), 'Hoy');
  assert.ok(t.logs.some((l) => String(l[0]).includes('destruir')));
});

test('error lanzado en un manejador de clic (window "error") → pantalla de error; se puede seguir navegando', () => {
  const t = boot({ hash: '#/mas' });
  t.click(t.button('Simular un error'));
  assert.ok(t.main().querySelector('.error-screen'));
  assert.ok(t.doc.querySelector('.bottom-nav'));
  t.win.location.hash = '#/mapa';
  assert.equal(t.h1(), 'Mapa');
});

test('promesa rechazada sin capturar (unhandledrejection) → pantalla de error con la ruta en el detalle', async () => {
  const t = boot({ hash: '#/mapa' });
  t.win.dispatch('unhandledrejection', { reason: new Error('promesa suelta') });
  assert.ok(t.main().querySelector('.error-screen'));
  t.click(t.button('Copiar detalle'));
  await t.flush();
  assert.ok(t.clip.calls[0].includes('promesa suelta'));
  assert.ok(t.clip.calls[0].includes('Ruta: #/mapa'));
  assert.ok(t.clip.calls[0].includes('Versión: 9.9.9'));
});

test('errores globales repetidos no re-dibujan la pantalla de error; ResizeObserver se ignora; razón vacía no rompe', () => {
  const t = boot();
  t.win.dispatch('error', { message: 'ResizeObserver loop limit exceeded' });
  assert.equal(t.main().querySelector('.error-screen'), null);
  t.win.dispatch('unhandledrejection', {});
  const first = t.main().querySelector('.error-screen');
  assert.ok(first);
  t.win.dispatch('error', { message: 'otro', error: new Error('otro') });
  assert.equal(t.main().querySelector('.error-screen'), first);
});

test('"Reintentar" tras un error global vuelve a mostrar la pantalla actual', async () => {
  const t = boot({ hash: '#/mapa' });
  t.win.dispatch('error', { error: new Error('x'), message: 'x' });
  t.click(t.button('Reintentar'));
  await t.flush();
  assert.equal(t.h1(), 'Mapa');
});

test('desplazamiento: cada pantalla recuerda su posición y se restaura al volver', () => {
  const t = boot();
  t.win.location.hash = '#/mapa';
  t.win.scrollY = 300;
  t.win.location.hash = '#/practicar';
  assert.equal(t.win.scrollY, 0);
  t.win.scrollY = 50;
  t.win.location.hash = '#/mapa';
  assert.equal(t.win.scrollY, 300);
  t.win.location.hash = '#/practicar';
  assert.equal(t.win.scrollY, 50);
  assert.ok(t.win.scrollCalls.every((c) => c.behavior === 'instant'), 'el desplazamiento restaurado debe ser instantáneo (no animado)');
});

test('foco: tras navegar el contenido recibe el foco (lectores de pantalla); en el arranque no', () => {
  const t = boot();
  assert.equal(t.doc.activeElement, null);
  t.win.location.hash = '#/mapa';
  assert.equal(t.doc.activeElement, t.main());
});

test('servicios: el botón de aviso de "Más" muestra un toast que se cierra solo', () => {
  const t = boot({ hash: '#/mas' });
  t.click(t.button('Probar un aviso'));
  assert.equal(t.doc.querySelectorAll('.toast').length, 1);
  t.timers.advance(4001);
  assert.equal(t.doc.querySelectorAll('.toast').length, 0);
});

test('"Más" muestra la versión de la app y el enlace a Ajustes', () => {
  const t = boot({ hash: '#/mas' });
  assert.ok(t.main().textContent.includes('Versión de la app: 9.9.9'));
  assert.equal(t.main().querySelector('a').getAttribute('href'), '#/ajustes');
});

test('destroy(): quita TODOS los listeners, el contenido y los avisos', () => {
  const t = boot({ hash: '#/mas' });
  t.click(t.button('Probar un aviso'));
  t.app.destroy();
  assert.equal(t.stats.live(), 0);
  assert.equal(t.doc.getElementById('app').childNodes.length, 0);
  t.win.location.hash = '#/mapa';
  assert.equal(t.doc.getElementById('app').childNodes.length, 0);
});

test('startApp: sin doc/win o sin #app lanza un error claro', () => {
  assert.throws(() => startApp({}), /se necesitan doc y win/);
  const env = makeEnv();
  env.doc.getElementById('app').remove();
  assert.throws(() => startApp({ doc: env.doc, win: env.win }), /falta <div id="app">/);
});
