// Pruebas de bottomNav, toast y errorBoundary (subparte 0.4) con DOM falso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBottomNav, TABS } from '../ui/components/bottomNav.js';
import { createToaster } from '../ui/components/toast.js';
import { formatErrorDetail, renderErrorScreen } from '../ui/components/errorBoundary.js';
import { makeEnv, makeTimers } from './_fakeDom.mjs';

// ---------- bottomNav ----------
test('bottomNav: 5 pestañas en orden Hoy · Mapa · Practicar · Errores · Más, con enlaces reales', () => {
  const { doc } = makeEnv();
  const nav = createBottomNav({ doc });
  const links = nav.el.querySelectorAll('a');
  assert.deepEqual(links.map((a) => a.textContent), ['Hoy', 'Mapa', 'Practicar', 'Errores', 'Más']);
  assert.deepEqual(links.map((a) => a.getAttribute('href')), ['#/hoy', '#/mapa', '#/practicar', '#/errores', '#/mas']);
  assert.equal(TABS.length, 5);
  assert.equal(nav.el.getAttribute('aria-label'), 'Navegación principal');
});

test('bottomNav: los iconos están ocultos para lectores de pantalla y son SVG', () => {
  const { doc } = makeEnv();
  const svgs = createBottomNav({ doc }).el.querySelectorAll('svg');
  assert.equal(svgs.length, 5);
  for (const s of svgs) {
    assert.equal(s.getAttribute('aria-hidden'), 'true');
    assert.equal(s.namespaceURI, 'http://www.w3.org/2000/svg');
  }
});

test('bottomNav: setActive marca solo una pestaña (aria-current + clase); null o desconocida limpia todas', () => {
  const { doc } = makeEnv();
  const nav = createBottomNav({ doc });
  const current = () => nav.el.querySelectorAll('[aria-current]').map((a) => a.getAttribute('data-tab'));
  nav.setActive('mapa');
  assert.deepEqual(current(), ['mapa']);
  assert.equal(nav.el.querySelectorAll('.is-active').length, 1);
  nav.setActive('mas');
  assert.deepEqual(current(), ['mas']);
  assert.equal(nav.el.querySelector('[aria-current]').getAttribute('aria-current'), 'page');
  nav.setActive(null);
  assert.deepEqual(current(), []);
  nav.setActive('inventada');
  assert.deepEqual(current(), []);
  assert.equal(nav.el.querySelectorAll('.is-active').length, 0);
});

test('bottomNav: destroy lo retira del documento', () => {
  const { doc } = makeEnv();
  const nav = createBottomNav({ doc });
  doc.body.appendChild(nav.el);
  nav.destroy();
  assert.equal(doc.body.querySelector('.bottom-nav'), null);
});

// ---------- toast ----------
function toaster(opts = {}) {
  const env = makeEnv();
  const container = env.doc.createElement('div');
  env.doc.body.appendChild(container);
  const timers = makeTimers();
  return { ...env, container, timers, t: createToaster({ doc: env.doc, container, timers, ...opts }) };
}

test('toast: muestra el mensaje con su icono y rol; danger usa role=alert', () => {
  const { t, container } = toaster();
  const a = t.show('success', 'Guardado');
  const b = t.show('danger', 'Falló');
  const c = t.show('info', 'Ojo');
  assert.equal(a.getAttribute('role'), 'status');
  assert.equal(b.getAttribute('role'), 'alert');
  assert.ok(a.getAttribute('class').includes('toast--success'));
  assert.equal(container.children.length, 3);
  assert.deepEqual([a, b, c].map((e) => e.children[0].textContent), ['✓', '!', 'i']);
  assert.equal(a.children[0].getAttribute('aria-hidden'), 'true');
});

test('toast: tipo desconocido cae en info; mensaje con HTML, null o número se muestra como texto', () => {
  const { t } = toaster();
  const x = t.show('raro', '<b onclick=alert(1)>hola</b>');
  assert.ok(x.getAttribute('class').includes('toast--info'));
  assert.equal(x.children.length, 2);
  assert.equal(x.children[1].children.length, 0);
  assert.equal(x.children[1].textContent, '<b onclick=alert(1)>hola</b>');
  assert.equal(t.show('info', null).children[1].textContent, '');
  assert.equal(t.show('info', 7).children[1].textContent, '7');
});

test('toast: máximo 3 a la vez (se retira el más viejo) y cada uno se cierra solo a los 4 s', () => {
  const { t, container, timers } = toaster();
  const first = t.show('info', '1');
  t.show('info', '2');
  t.show('info', '3');
  t.show('info', '4');
  assert.equal(container.children.length, 3);
  assert.equal(first.parentNode, null);
  timers.advance(3999);
  assert.equal(container.children.length, 3);
  timers.advance(2);
  assert.equal(container.children.length, 0);
  assert.equal(timers.pending(), 0);
});

test('toast: tocar cierra; duración propia; dismissAll y destroy limpian los temporizadores', () => {
  const { t, container, timers } = toaster();
  const a = t.show('info', 'a');
  a.dispatchEvent({ type: 'click' });
  assert.equal(container.children.length, 0);
  t.show('info', 'rápido', { duration: 100 });
  timers.advance(101);
  assert.equal(container.children.length, 0);
  t.show('info', 'x');
  t.show('info', 'y');
  t.dismissAll();
  assert.equal(container.children.length, 0);
  t.show('info', 'z');
  t.destroy();
  assert.equal(timers.pending(), 0);
});

test('toast: sin contenedor lanza error', () => {
  assert.throws(() => createToaster({}), /falta el contenedor/);
});

// ---------- errorBoundary ----------
test('formatErrorDetail: Error, texto, null, objeto, circular y fecha inválida', () => {
  const ctx = { version: '0.4.0', route: '#/mas', now: new Date('2026-10-16T10:00:00.000Z') };
  const e = new Error('boom');
  const d = formatErrorDetail(e, ctx);
  for (const part of ['Versión: 0.4.0', 'Ruta: #/mas', 'Fecha: 2026-10-16T10:00:00.000Z', 'Error: Error: boom', 'Detalle técnico:']) assert.ok(d.includes(part), part);
  assert.ok(formatErrorDetail('texto suelto', ctx).includes('Error: texto suelto'));
  assert.ok(formatErrorDetail(null, ctx).includes('Error: null'));
  assert.ok(formatErrorDetail(undefined, ctx).includes('Error: undefined'));
  assert.ok(formatErrorDetail({ a: 1 }, ctx).includes('{"a":1}'));
  const circ = {};
  circ.self = circ;
  assert.doesNotThrow(() => formatErrorDetail(circ, ctx));
  assert.ok(formatErrorDetail('x', { now: new Date('nope') }).includes('Fecha: ?'));
});

test('formatErrorDetail: recorta trazas larguísimas', () => {
  const e = new Error('x');
  e.stack = 'a'.repeat(50000);
  assert.ok(formatErrorDetail(e).length < 2000);
});

function screen(extra = {}) {
  const env = makeEnv();
  const logs = [];
  let retries = 0;
  const el = renderErrorScreen({ doc: env.doc, error: new Error('<b>mal</b>'), version: '0.4.0', route: '#/mas', now: new Date('2026-10-16T10:00:00Z'),
    onRetry: () => { retries += 1; }, clipboard: env.clip, log: (...a) => logs.push(a), ...extra });
  env.doc.body.appendChild(el);
  return { ...env, el, logs, retries: () => retries };
}
const button = (el, text) => el.querySelectorAll('button').find((b) => b.textContent === text);

test('pantalla de error: título amable, role=alert, botones Reintentar y Copiar detalle', () => {
  const { el } = screen();
  assert.equal(el.getAttribute('role'), 'alert');
  assert.equal(el.querySelector('h1').textContent, 'Algo no salió bien');
  assert.ok(button(el, 'Reintentar') && button(el, 'Copiar detalle'));
});

test('pantalla de error: Reintentar llama a onRetry; sin onRetry no falla', () => {
  const s = screen();
  button(s.el, 'Reintentar').dispatchEvent({ type: 'click' });
  assert.equal(s.retries(), 1);
  const s2 = screen({ onRetry: undefined });
  assert.doesNotThrow(() => button(s2.el, 'Reintentar').dispatchEvent({ type: 'click' }));
});

test('pantalla de error: el mensaje con HTML no crea elementos (se muestra como texto en el detalle)', async () => {
  const { el, clip, flush } = screen();
  button(el, 'Copiar detalle').dispatchEvent({ type: 'click' });
  await flush();
  assert.ok(clip.calls[0].includes('<b>mal</b>'));
  assert.equal(el.querySelectorAll('b').length, 0);
});

test('pantalla de error: Copiar detalle usa el portapapeles y confirma', async () => {
  const { el, clip, flush } = screen();
  button(el, 'Copiar detalle').dispatchEvent({ type: 'click' });
  await flush();
  assert.equal(clip.calls.length, 1);
  assert.ok(clip.calls[0].includes('Versión: 0.4.0') && clip.calls[0].includes('Ruta: #/mas'));
  assert.ok(el.querySelector('[role="status"]').textContent.includes('copiado'));
  assert.equal(el.querySelector('textarea'), null);
});

test('pantalla de error: si el portapapeles falla o no existe, el detalle queda en un cuadro para copiar a mano', async () => {
  for (const clipboard of [{ writeText: () => Promise.reject(new Error('denegado')) }, null, {}]) {
    const { el, logs, flush } = screen({ clipboard });
    button(el, 'Copiar detalle').dispatchEvent({ type: 'click' });
    await flush();
    const box = el.querySelector('textarea');
    assert.ok(box, 'debe aparecer el cuadro de texto');
    assert.equal(box.getAttribute('readonly'), '');
    assert.ok(box.value.includes('Versión: 0.4.0'));
    assert.equal(logs.length, 1);
    button(el, 'Copiar detalle').dispatchEvent({ type: 'click' });
    await flush();
    assert.equal(el.querySelectorAll('textarea').length, 1, 'no se duplica el cuadro');
  }
});
