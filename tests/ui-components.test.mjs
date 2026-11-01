// @purpose: Pruebas de la biblioteca de componentes UI con DOM falso.
// Pruebas de la biblioteca de componentes UI (subparte 0.5) con DOM falso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, makeTimers } from './_fakeDom.mjs';
import * as ui from '../ui/components/index.js';
import fs from 'node:fs';
import { wordDiff } from '../core/wordDiff.js';
import { compare } from '../core/compare.js';

const ev = (type, extra = {}) => ({ type, preventDefault() { this.prevented = true; }, ...extra });
const fire = (el, type, extra) => el.dispatchEvent(ev(type, extra));
const key = (env, k, extra = {}) => env.doc.dispatch('keydown', ev('keydown', { key: k, ...extra }));
const setup = (o = {}) => { const env = makeEnv(o); return { env, base: { doc: env.doc, win: env.win } }; };
const throwsEs = (fn, re) => assert.throws(fn, (e) => e instanceof TypeError && re.test(e.message));

// ---------- botón ----------
test('button: variantes, estados, doble toque y propagación de errores', async () => {
  const { env, base } = setup();
  throwsEs(() => ui.createButton({ ...base }), /necesita "label" o "ariaLabel"/);
  throwsEs(() => ui.createButton({ ...base, label: 'x', variant: 'rojo' }), /uno de: primary/);
  throwsEs(() => ui.createButton({ ...base, ariaLabel: 'Cerrar' }), /necesita "icon"/);
  let n = 0;
  const b = ui.createButton({ ...base, label: 'Comprobar', variant: 'primary', onClick: () => { n += 1; } });
  assert.match(b.el.getAttribute('class'), /btn btn--primary/);
  fire(b.el, 'click'); assert.equal(n, 1);
  b.setLoading(true);
  assert.equal(b.el.getAttribute('aria-busy'), 'true');
  fire(b.el, 'click'); assert.equal(n, 1, 'cargando ignora toques');
  b.setLoading(false); b.setDisabled(true);
  assert.ok(b.el.hasAttribute('disabled'));
  fire(b.el, 'click'); assert.equal(n, 1);
  b.destroy(); b.destroy();
  assert.equal(env.stats.live(), 0);
  // lockMs con reloj inyectado
  let t = 1000; let m = 0;
  const l = ui.createButton({ ...base, label: 'x', lockMs: 300, now: () => t, onClick: () => { m += 1; } });
  fire(l.el, 'click'); t += 100; fire(l.el, 'click'); t += 300; fire(l.el, 'click');
  assert.equal(m, 2);
  // promesa pendiente → cargando; rechazo se propaga
  let reject;
  const p = ui.createButton({ ...base, label: 'x', busyWhilePending: true, onClick: () => new Promise((_, r) => { reject = r; }) });
  const out = p.el._l.get('click').values().next().value({ preventDefault() {} });
  assert.equal(p.isBusy(), true);
  reject(new Error('boom'));
  await assert.rejects(out, /boom/);
  assert.equal(p.isBusy(), false);
  assert.throws(() => ui.createButton({ ...base, ariaLabel: 'Cerrar', icon: '✕' }).setLabel('x'), /solo icono/);
});

test('textos largos y con símbolos: se muestran como texto, no como HTML', () => {
  const { base } = setup();
  const evil = '<img src=x onerror=alert(1)> & "comillas"';
  const long = 'palabra'.repeat(40);
  for (const make of [
    () => ui.createButton({ ...base, label: evil }), () => ui.createChip({ ...base, label: evil }),
    () => ui.createBadge({ ...base, kind: 'review', text: evil }), () => ui.createCard({ ...base, title: evil }),
    () => ui.createEmptyState({ ...base, title: evil }), () => ui.createToggle({ ...base, label: evil }),
    () => ui.createWordChip({ ...base, word: evil }), () => ui.createWordDiff({ ...base, words: [{ text: evil, status: 'wrong' }] }),
    () => ui.createModal({ ...base, title: evil, message: evil }), () => ui.createSheet({ ...base, title: evil }),
  ]) {
    const c = make();
    assert.ok(!c.el.outerHTML.includes('<img'), c.el.outerHTML.slice(0, 80));
    assert.ok(c.el.textContent.includes('onerror=alert(1)'));
    c.destroy();
  }
  const c = ui.createChip({ ...base, label: long });
  assert.equal(c.el.textContent.length, long.length);
  assert.throws(() => ui.createChip({ ...base, label: 'x'.repeat(5000) }), /demasiado largo/);
});

// ---------- chip / badge / card ----------
test('chip: elegible, de acción, truncado y deshabilitado', () => {
  const { base } = setup();
  const seen = [];
  const c = ui.createChip({ ...base, label: 'A2', onChange: (v) => seen.push(v) });
  assert.equal(c.el.getAttribute('aria-pressed'), 'false');
  fire(c.el, 'click'); fire(c.el, 'click');
  assert.deepEqual(seen, [true, false]);
  c.setDisabled(true); fire(c.el, 'click'); assert.equal(seen.length, 2);
  let p = 0;
  const a = ui.createChip({ ...base, label: 'Filtro', selectable: false, onPress: () => { p += 1; } });
  assert.equal(a.el.hasAttribute('aria-pressed'), false);
  fire(a.el, 'click'); assert.equal(p, 1);
  const t = ui.createChip({ ...base, label: 'Texto largo', truncate: true });
  assert.equal(t.el.getAttribute('title'), 'Texto largo');
  throwsEs(() => ui.createChip({ ...base }), /falta "label"/);
});

test('badge: nivel 1–5, New, Repaso, ayuda "?" y entradas inválidas', () => {
  const { base } = setup();
  assert.equal(ui.createBadge({ ...base, kind: 'level', level: 3 }).el.textContent, 'Nivel 3');
  assert.equal(ui.createBadge({ ...base, kind: 'new' }).el.textContent, 'New');
  assert.equal(ui.createBadge({ ...base, kind: 'review', text: 'Repaso en 4 sems' }).el.textContent, 'Repaso en 4 sems');
  for (const bad of [0, 6, 2.5, '3', NaN]) assert.throws(() => ui.createBadge({ ...base, kind: 'level', level: bad }), TypeError);
  throwsEs(() => ui.createBadge({ ...base, kind: 'level' }), /necesita "level"/);
  throwsEs(() => ui.createBadge({ ...base, kind: 'new', onHelp() {} }), /solo existe en el tipo "level"/);
  let h = 0;
  const b = ui.createBadge({ ...base, kind: 'level', level: 2, onHelp: () => { h += 1; } });
  const help = b.el.querySelector('button');
  assert.ok(help.getAttribute('aria-label'));
  fire(help, 'click'); assert.equal(h, 1);
  b.setLevel(5); assert.match(b.el.textContent, /Nivel 5/);
});

test('card: interactiva con teclado, carga, error y exclusiones', () => {
  const { env, base } = setup();
  throwsEs(() => ui.createCard({ ...base, title: 'x', onPress() {}, href: '#/a' }), /no las dos/);
  throwsEs(() => ui.createCard({ ...base, onPress() {} }), /nombre accesible/);
  let n = 0;
  const c = ui.createCard({ ...base, title: 'Tema', meta: 'A2', children: ['hola'], onPress: () => { n += 1; } });
  assert.equal(c.el.getAttribute('role'), 'button');
  fire(c.el, 'keydown', { key: 'Enter', target: c.el }); fire(c.el, 'keydown', { key: ' ', target: c.el });
  fire(c.el, 'keydown', { key: 'a', target: c.el });
  assert.equal(n, 2);
  c.setLoading(true);
  assert.ok(c.el.querySelector('.skeleton'));
  fire(c.el, 'click'); assert.equal(n, 2);
  c.setLoading(false); assert.ok(!c.el.querySelector('.skeleton'));
  assert.equal(c.body.textContent, 'hola');
  c.setError('No se pudo cargar'); assert.match(c.el.getAttribute('class'), /card--error/);
  c.setError(null); assert.ok(c.el.querySelector('.card__error').hasAttribute('hidden'));
  c.setDisabled(true); fire(c.el, 'click'); assert.equal(n, 2);
  const link = ui.createCard({ ...base, title: 'L', href: '#/tema/x' });
  assert.equal(link.el.tagName, 'A'); link.destroy();
  assert.throws(() => ui.createCard({ ...base, title: 'L', href: 'javascript:alert(1)' }), /URL no permitida/);
  c.destroy(); assert.equal(env.stats.live(), 0);
});

// ---------- hoja ----------
test('dragDecision: umbral, velocidad y entradas raras', () => {
  assert.equal(ui.dragDecision({ dy: 0, ms: 100, height: 400 }), false);
  assert.equal(ui.dragDecision({ dy: -50, ms: 100, height: 400 }), false);
  assert.equal(ui.dragDecision({ dy: 96, ms: 2000, height: 800 }), true);
  assert.equal(ui.dragDecision({ dy: 50, ms: 2000, height: 800 }), false);
  assert.equal(ui.dragDecision({ dy: 50, ms: 50, height: 800 }), true, 'gesto rápido');
  assert.equal(ui.dragDecision({ dy: 30, ms: 10, height: 800 }), false, 'muy corto');
  assert.equal(ui.dragDecision({ dy: 40, ms: 0, height: NaN }), true);
  assert.equal(ui.dragDecision({ dy: NaN, ms: 1, height: 1 }), false);
});

test('sheet: abrir/cerrar, Esc, foco atrapado y devuelto, scroll y toque rápido en el fondo', () => {
  const { env, base } = setup();
  let t = 0; const reasons = [];
  const opener = env.doc.createElement('button'); env.doc.body.appendChild(opener); opener.focus();
  const s = ui.createSheet({ ...base, title: 'Nivel', children: ['texto', env.doc.createElement('button')], now: () => t, onClose: (r) => reasons.push(r) });
  assert.equal(s.el.getAttribute('role'), 'dialog');
  assert.equal(s.el.getAttribute('aria-modal'), 'true');
  assert.equal(s.el.getAttribute('aria-labelledby'), s.el.querySelector('h2').getAttribute('id'));
  assert.equal(s.open(), true); assert.equal(s.open(), false, 'abrir dos veces no hace nada');
  assert.ok(s.isOpen()); assert.ok(env.doc.documentElement.classList.contains('no-scroll'));
  assert.ok(s.el.classList.contains('is-open'));
  // toque en el fondo a los 100 ms: ignorado; a los 400 ms: cierra
  t = 100; fire(s.backdrop, 'click'); assert.ok(s.isOpen());
  // Tab cicla
  const inner = s.el.querySelectorAll('button');
  const last = inner[inner.length - 1]; last.focus();
  let prevented = false;
  env.doc.dispatch('keydown', { key: 'Tab', preventDefault() { prevented = true; } });
  assert.equal(env.doc.activeElement, inner[0]); assert.ok(prevented);
  inner[0].focus(); env.doc.dispatch('keydown', ev('keydown', { key: 'Tab', shiftKey: true }));
  assert.equal(env.doc.activeElement, last);
  t = 400; fire(s.backdrop, 'click');
  assert.ok(!s.isOpen()); assert.deepEqual(reasons, ['backdrop']);
  assert.equal(env.doc.activeElement, opener, 'el foco vuelve al botón que abrió');
  assert.ok(!env.doc.documentElement.classList.contains('no-scroll'));
  s.open(); key(env, 'Escape'); assert.deepEqual(reasons, ['backdrop', 'escape']);
  s.open(); fire(s.el.querySelector('.btn--icon'), 'click'); assert.equal(reasons.at(-1), 'button');
  assert.equal(s.close(), false, 'cerrar una hoja cerrada no hace nada');
  s.destroy(); s.destroy();
  assert.equal(env.stats.live(), 0, 'sin listeners tras destroy');
});

test('sheet: arrastre cierra si pasa el umbral y vuelve si no; contenido nuevo; props inválidas', () => {
  const { env, base } = setup();
  let t = 0;
  const s = ui.createSheet({ ...base, title: 'T', now: () => t });
  s.open();
  const grab = s.el.querySelector('.sheet__grab');
  fire(grab, 'pointerdown', { pointerId: 1, clientY: 100 });
  t = 1000; fire(grab, 'pointermove', { pointerId: 1, clientY: 130 });
  assert.equal(s.el.style.getPropertyValue('--drag-y'), '30px');
  fire(grab, 'pointerup', { pointerId: 1, clientY: 130 });
  assert.ok(s.isOpen()); assert.equal(s.el.style.getPropertyValue('--drag-y'), '0px');
  t = 2000; fire(grab, 'pointerdown', { pointerId: 2, clientY: 0 });
  t = 3000; fire(grab, 'pointermove', { pointerId: 2, clientY: 200 });
  fire(grab, 'pointerup', { pointerId: 2, clientY: 200 });
  assert.ok(!s.isOpen());
  s.setContent('uno', ['dos']); assert.equal(s.body.textContent, 'unodos');
  assert.throws(() => s.setContent({}), /los hijos deben ser/);
  throwsEs(() => ui.createSheet({ ...base }), /falta "title"/);
  const fixed = ui.createSheet({ ...base, title: 'F', dismissible: false });
  fixed.open(); key(env, 'Escape'); assert.ok(fixed.isOpen());
  fixed.close(); fixed.destroy(); s.destroy();
  assert.equal(env.stats.live(), 0);
});

test('capas: Esc cierra solo la de arriba y el bloqueo de scroll se mantiene hasta cerrar todas', () => {
  const { env, base } = setup();
  const sheet = ui.createSheet({ ...base, title: 'Hoja' });
  const modal = ui.createModal({ ...base, title: 'Seguro' });
  sheet.open(); const p = modal.open();
  key(env, 'Escape');
  assert.ok(sheet.isOpen()); assert.ok(!modal.isOpen());
  assert.ok(env.doc.documentElement.classList.contains('no-scroll'));
  return p.then((r) => {
    assert.equal(r, false);
    key(env, 'Escape'); assert.ok(!sheet.isOpen());
    assert.ok(!env.doc.documentElement.classList.contains('no-scroll'));
    sheet.destroy(); modal.destroy();
  });
});

// ---------- modal / confirmDanger ----------
test('modal: resuelve true/false, una sola vez, misma promesa y foco seguro en danger', async () => {
  const { env, base } = setup();
  const m = ui.createModal({ ...base, title: '¿Salir?', message: 'Se guarda lo respondido.', danger: true, confirmLabel: 'Salir' });
  assert.equal(m.el.getAttribute('role'), 'alertdialog');
  const p1 = m.open(); const p2 = m.open();
  assert.equal(p1, p2);
  assert.equal(env.doc.activeElement, m.cancelButton, 'danger enfoca Cancelar');
  fire(m.confirmButton, 'click'); fire(m.confirmButton, 'click');
  assert.equal(await p1, true); assert.ok(!m.isOpen());
  const p3 = m.open(); fire(m.cancelButton, 'click'); assert.equal(await p3, false);
  const p4 = m.open(); fire(m.backdrop, 'click');
  const t = m.open(); assert.equal(t, p4, 'el toque inmediato en el fondo se ignora');
  m.close(true); assert.equal(await p4, true);
  const p5 = m.open(); m.destroy(); assert.equal(await p5, false);
  assert.equal(env.stats.live(), 0);
  assert.equal(ui.createModal({ ...base, title: 'x', hideCancel: true }).cancelButton, null);
});

test('confirmDanger: exige la frase exacta y se limpia al reabrir', async () => {
  const { env, base } = setup();
  const d = ui.createConfirmDanger({ ...base, title: 'Borrar todo', message: 'No se puede deshacer.' });
  const confirmBtn = d.el.querySelectorAll('button').find((b) => b.textContent === 'Borrar');
  const input = d.el.querySelector('input');
  let p = d.open();
  assert.ok(confirmBtn.hasAttribute('disabled'));
  for (const [val, ok] of [['borrar', false], ['BORRA', false], [' BORRAR ', true], ['BORRAR', true]]) {
    input.value = val; fire(input, 'input');
    assert.equal(!confirmBtn.hasAttribute('disabled'), ok, val);
  }
  fire(input, 'keydown', { key: 'Enter' });
  assert.equal(await p, true);
  p = d.open(); assert.equal(input.value, ''); assert.ok(confirmBtn.hasAttribute('disabled'));
  fire(input, 'keydown', { key: 'Enter' }); assert.ok(d.isOpen(), 'Enter sin frase no confirma');
  d.destroy(); assert.equal(await p, false);
  assert.equal(env.stats.live(), 0);
  const free = ui.createConfirmDanger({ ...base, title: 'x', requirePhrase: false });
  const q = free.open(); fire(free.el.querySelectorAll('button').find((b) => b.textContent === 'Borrar'), 'click');
  assert.equal(await q, true); free.destroy();
});

// ---------- progreso / mascota ----------
test('progressBar: porcentaje, pasos X/N, límites, mascota, indeterminada y error', () => {
  const { base } = setup();
  const p = ui.createProgressBar({ ...base, label: 'Sesión', current: 7, total: 20, showText: true });
  const bar = p.el.querySelector('.progress');
  assert.equal(bar.getAttribute('role'), 'progressbar');
  assert.equal(bar.getAttribute('aria-valuenow'), '7'); assert.equal(bar.getAttribute('aria-valuemax'), '20');
  assert.equal(bar.getAttribute('aria-valuetext'), '7 de 20');
  assert.equal(p.el.style.getPropertyValue('--value'), '35');
  assert.equal(p.el.querySelector('.progress-bar__text').textContent, '7/20');
  p.setSteps(20, 20); assert.equal(p.el.style.getPropertyValue('--value'), '100');
  assert.throws(() => p.setSteps(21, 20), /entre 0 y 20/);
  assert.throws(() => p.setSteps(1.5, 20), /entero/);
  p.setValue(50); assert.equal(p.el.style.getPropertyValue('--value'), '50');
  assert.throws(() => p.setValue(101), TypeError); assert.throws(() => p.setValue(-1), TypeError); assert.throws(() => p.setValue(NaN), TypeError);
  const m = ui.createMascot(base);
  p.setMascot(m.el); assert.match(p.el.getAttribute('class'), /has-mascot/);
  p.setMascot(null); assert.ok(!/has-mascot/.test(p.el.getAttribute('class')));
  assert.throws(() => p.setMascot('x'), /nodo del DOM/);
  p.setIndeterminate(true); assert.equal(bar.hasAttribute('aria-valuenow'), false);
  p.setIndeterminate(false); p.setError(true); assert.match(bar.getAttribute('class'), /progress--danger/);
  throwsEs(() => ui.createProgressBar({ ...base }), /falta "label"/);
  throwsEs(() => ui.createProgressBar({ ...base, label: 'x', current: 1 }), /necesita también "total"/);
  assert.equal(ui.createProgressBar({ ...base, label: 'x', value: 0 }).el.style.getPropertyValue('--value'), '0');
});

test('mascot: tres estados, decorativa/etiquetada, repite el salto y respeta movimiento reducido', () => {
  const { env, base } = setup();
  const m = ui.createMascot(base);
  assert.equal(m.el.getAttribute('aria-hidden'), 'true');
  for (const s of ui.MASCOT_STATES) { m.setState(s); assert.equal(m.el.getAttribute('data-state'), s); assert.equal(m.getState(), s); }
  m.setState('happy'); const a = m.el.getAttribute('class');
  m.setState('happy'); assert.notEqual(m.el.getAttribute('class'), a, 'alterna animación gemela');
  assert.equal((m.el.getAttribute('class').match(/hop-\d/g) ?? []).length, 1, 'nunca dos clases de salto a la vez');
  m.setState('neutral'); assert.doesNotMatch(m.el.getAttribute('class'), /hop-/);
  assert.throws(() => m.setState('enojada'), /uno de: neutral, happy, thinking/);
  assert.equal(ui.createMascot({ ...base, label: 'Chispa' }).el.getAttribute('role'), 'img');
  assert.doesNotMatch(m.el.getAttribute('class'), /is-still/);
  const quiet = { ...env.win, matchMedia: () => ({ matches: true }) };
  assert.match(ui.createMascot({ doc: env.doc, win: quiet }).el.getAttribute('class'), /is-still/);
  const broken = { ...env.win, matchMedia: () => { throw new Error('x'); } };
  const orig = console.error; console.error = () => {};
  try { assert.ok(ui.createMascot({ doc: env.doc, win: broken }).el); } finally { console.error = orig; }
  throwsEs(() => ui.createMascot({ ...base, size: 'xl' }), /uno de: sm, md, lg/);
});

// ---------- tabs / segmentado / interruptor / deslizador ----------
test('tabs: ARIA, flechas, carga perezosa, ids únicos', () => {
  const { env, base } = setup();
  let built = 0; const changes = [];
  const t = ui.createTabs({ ...base, label: 'Secciones', onChange: (id) => changes.push(id), tabs: [
    { id: 'a', label: 'A', panel: 'uno' }, { id: 'b', label: 'B', panel: () => { built += 1; return 'dos'; } }, { id: 'c', label: 'C', panel: 'tres' }] });
  const tabs = t.el.querySelectorAll('[role="tab"]'); const panels = t.el.querySelectorAll('[role="tabpanel"]');
  assert.equal(built, 0);
  assert.equal(tabs[0].getAttribute('aria-selected'), 'true'); assert.equal(tabs[1].getAttribute('tabindex'), '-1');
  assert.ok(panels[1].hasAttribute('hidden'));
  tabs[0].focus(); fire(t.el.querySelector('[role="tablist"]'), 'keydown', { key: 'ArrowRight' });
  assert.equal(t.getSelected(), 'b'); assert.equal(built, 1); assert.equal(panels[1].textContent, 'dos');
  fire(t.el.querySelector('[role="tablist"]'), 'keydown', { key: 'End' }); assert.equal(t.getSelected(), 'c');
  fire(t.el.querySelector('[role="tablist"]'), 'keydown', { key: 'ArrowRight' }); assert.equal(t.getSelected(), 'a', 'vuelve al inicio');
  t.select('b'); assert.equal(built, 1); assert.deepEqual(changes, ['b', 'c', 'a', 'b']);
  assert.throws(() => t.select('z'), /no existe/);
  throwsEs(() => ui.createTabs({ ...base, label: 'x', tabs: [{ id: 'a', label: 'A', panel: 'x' }, { id: 'a', label: 'B', panel: 'y' }] }), /repetido/);
  throwsEs(() => ui.createTabs({ ...base, label: 'x', tabs: [{ id: 'a', label: 'A', panel: 'x' }] }), /entre 2 y 8/);
  t.destroy(); assert.equal(env.stats.live(), 0);
});

test('segmented: elección única, flechas saltan deshabilitadas, errores', () => {
  const { env, base } = setup();
  const seen = [];
  const s = ui.createSegmented({ ...base, label: 'Tema', value: 'a', onChange: (v) => seen.push(v), options: [
    { value: 'a', label: 'Aurora' }, { value: 'b', label: 'Neo', disabled: true }, { value: 'c', label: 'Claro' }] });
  const group = s.el.querySelector('[role="radiogroup"]');
  const radios = s.el.querySelectorAll('[role="radio"]');
  assert.equal(radios[0].getAttribute('aria-checked'), 'true');
  radios[0].focus(); fire(group, 'keydown', { key: 'ArrowRight' });
  assert.equal(s.getValue(), 'c', 'salta la deshabilitada');
  fire(radios[1], 'click'); assert.equal(s.getValue(), 'c');
  fire(radios[0], 'click'); assert.deepEqual(seen, ['c', 'a']);
  assert.throws(() => s.setValue('zzz'), /no está en las opciones/);
  s.setError('Elige uno'); assert.equal(s.el.querySelector('.field__error').textContent, 'Elige uno');
  const none = ui.createSegmented({ ...base, label: 'x', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] });
  assert.equal(none.getValue(), null);
  assert.equal(none.el.querySelectorAll('[role="radio"]').filter((r) => r.getAttribute('tabindex') === '0').length, 1);
  throwsEs(() => ui.createSegmented({ ...base, label: 'x', options: [{ value: 'a', label: 'A' }, { value: 'a', label: 'B' }] }), /repetido/);
  throwsEs(() => ui.createSegmented({ ...base, label: 'x', value: 'q', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] }), /no está en las opciones/);
  s.destroy(); none.destroy(); assert.equal(env.stats.live(), 0);
});

test('toggle: interruptor accesible con carga, error y deshabilitado', () => {
  const { env, base } = setup();
  const seen = [];
  const t = ui.createToggle({ ...base, label: 'Sonidos', description: 'Efectos suaves', onChange: (v) => seen.push(v) });
  assert.equal(t.button.getAttribute('role'), 'switch'); assert.equal(t.button.getAttribute('aria-checked'), 'false');
  assert.ok(t.button.getAttribute('aria-describedby'));
  fire(t.button, 'click'); assert.equal(t.isChecked(), true);
  t.setLoading(true); fire(t.button, 'click'); assert.equal(t.isChecked(), true);
  t.setLoading(false); t.setDisabled(true); fire(t.button, 'click'); assert.deepEqual(seen, [true]);
  t.setError('No se pudo guardar'); assert.equal(t.el.querySelector('.field__error').textContent, 'No se pudo guardar');
  assert.throws(() => t.setChecked('sí'), /verdadero o falso/);
  t.destroy(); assert.equal(env.stats.live(), 0);
});

test('slider: límites, paso, saltos (stops), formato y entradas inválidas', () => {
  const { env, base } = setup();
  assert.equal(ui.clampValue(5, 0, 3), 3); assert.equal(ui.snapValue(0.34, 0, 1, 0.1), 0.3); assert.equal(ui.snapValue(47, 0, 100, 5), 45);
  const s = ui.createSlider({ ...base, label: 'Retención', min: 80, max: 95, step: 1, value: 90, unit: ' %' });
  assert.equal(s.getValue(), 90); assert.equal(s.el.querySelector('output').textContent, '90 %');
  s.input.value = '200'; fire(s.input, 'input'); assert.equal(s.getValue(), 95);
  s.input.value = 'abc'; fire(s.input, 'change'); assert.equal(s.getValue(), 95);
  s.setValue(1000); assert.equal(s.getValue(), 95);
  assert.throws(() => s.setValue('x'), TypeError);
  assert.equal(s.el.style.getPropertyValue('--pct'), '100');
  const got = []; 
  const st = ui.createSlider({ ...base, label: 'Tiempo', stops: [{ value: 15, label: '15 min' }, { value: 30, label: '30 min' }, { value: 999, label: 'más' }], value: 30, onChange: (v) => got.push(v) });
  assert.equal(st.input.getAttribute('max'), '2'); assert.equal(st.input.getAttribute('aria-valuetext'), '30 min');
  st.input.value = '2'; fire(st.input, 'change'); assert.deepEqual(got, [999]);
  assert.throws(() => st.setValue(20), /no es uno de los saltos/);
  throwsEs(() => ui.createSlider({ ...base, label: 'x', min: 5, max: 5 }), /"max" debe ser mayor/);
  throwsEs(() => ui.createSlider({ ...base, label: 'x', step: 0 }), /"step"/);
  throwsEs(() => ui.createSlider({ ...base, label: 'x', stops: [{ value: 2, label: 'a' }, { value: 1, label: 'b' }] }), /ascendentes/);
  s.setDisabled(true); assert.ok(s.input.hasAttribute('disabled'));
  s.destroy(); st.destroy(); assert.equal(env.stats.live(), 0);
});

test('textInput: teclado de ejercicio, error accesible, Enter, IME y estados', () => {
  const { env, base } = setup();
  throwsEs(() => ui.createTextInput({ ...base }), /necesita "label" o "ariaLabel"/);
  const sent = [];
  const t = ui.createTextInput({ ...base, label: 'Tu respuesta', mode: 'exercise', onSubmit: (v) => sent.push(v) });
  for (const [k, v] of [['autocapitalize', 'off'], ['autocorrect', 'off'], ['spellcheck', 'false'], ['autocomplete', 'off'], ['lang', 'en'], ['enterkeyhint', 'done']]) assert.equal(t.input.getAttribute(k), v, k);
  assert.equal(t.el.querySelector('label').getAttribute('for'), t.input.getAttribute('id'));
  t.input.value = "I've lived here"; fire(t.input, 'keydown', { key: 'Enter' });
  fire(t.input, 'keydown', { key: 'Enter', isComposing: true });
  assert.deepEqual(sent, ["I've lived here"]);
  t.setError('Escribe algo'); assert.equal(t.input.getAttribute('aria-invalid'), 'true');
  assert.match(t.input.getAttribute('aria-describedby'), /-error$/);
  t.setError(null); assert.equal(t.input.hasAttribute('aria-invalid'), false);
  t.setLoading(true); fire(t.input, 'keydown', { key: 'Enter' }); assert.equal(sent.length, 1);
  assert.ok(t.input.hasAttribute('readonly'));
  const extra = [ui.createTextInput({ ...base, label: 'x', multiline: true, rows: 5 }), ui.createTextInput({ ...base, label: 'x', mode: 'password' }), ui.createTextInput({ ...base, label: 'x', optional: true })];
  assert.equal(extra[0].input.tagName, 'TEXTAREA'); assert.equal(extra[1].input.getAttribute('type'), 'password');
  assert.equal(extra[2].el.textContent.includes('(opcional)'), true);
  extra.forEach((x) => x.destroy());
  throwsEs(() => ui.createTextInput({ ...base, label: 'x', mode: 'raro' }), /uno de/);
  throwsEs(() => ui.createTextInput({ ...base, label: 'x', maxLength: 0 }), /entre 1/);
  const big = 'ñ😀'.repeat(400); t.setValue(big); assert.equal(t.getValue(), big);
  t.destroy(); assert.equal(env.stats.live(), 0);
});

// ---------- vacío / esqueleto / palabras ----------
test('emptyState y skeleton', () => {
  const { env, base } = setup();
  let n = 0;
  const e = ui.createEmptyState({ ...base, title: 'Aún no hay temas', message: 'Carga un paquete.', icon: '🌱', actionLabel: 'Cargar', onAction: () => { n += 1; } });
  fire(e.el.querySelector('button'), 'click'); assert.equal(n, 1);
  assert.equal(e.el.querySelector('h2').textContent, 'Aún no hay temas');
  throwsEs(() => ui.createEmptyState({ ...base, title: 'x', actionLabel: 'y' }), /van juntos/);
  e.destroy();
  const s = ui.createSkeleton({ ...base, lines: 4 });
  assert.equal(s.el.getAttribute('role'), 'status'); assert.equal(s.el.querySelectorAll('.skeleton__shape--line').length, 4);
  assert.equal(s.el.querySelector('.sr-only').textContent, 'Cargando');
  assert.equal(ui.createSkeleton({ ...base, variant: 'card', lines: 1 }).el.querySelectorAll('.skeleton__shape').length, 2);
  for (const bad of [0, 21, 1.5]) assert.throws(() => ui.createSkeleton({ ...base, lines: bad }), TypeError);
  s.destroy(); assert.equal(env.stats.live(), 0);
});

test('wordChip: estados, texto para lector de pantalla y marca de conocimiento', () => {
  const { env, base } = setup();
  const seen = [];
  const w = ui.createWordChip({ ...base, word: 'since', onPress: (x) => seen.push(x) });
  fire(w.el, 'click'); assert.deepEqual(seen, ['since']);
  w.setState('selected'); assert.equal(w.el.getAttribute('aria-pressed'), 'true');
  w.setState('correct'); assert.match(w.el.textContent, /✓/); assert.match(w.el.querySelector('.sr-only').textContent, /correcta/);
  w.setState('used'); assert.ok(w.el.hasAttribute('disabled')); fire(w.el, 'click'); assert.equal(seen.length, 1);
  w.setState('default'); w.setKnowledge('learning'); assert.equal(w.el.getAttribute('data-knowledge'), 'learning');
  assert.match(w.el.querySelector('.sr-only').textContent, /aprendiendo/);
  assert.throws(() => w.setState('x'), /uno de/); assert.throws(() => w.setKnowledge('x'), /uno de/);
  throwsEs(() => ui.createWordChip({ ...base, word: '' }), /no puede estar vacío/);
  w.destroy(); assert.equal(env.stats.live(), 0);
});

test('wordDiff: verde/ámbar/rojo/falta/sobra, alias, texto accesible y errores claros', () => {
  const { base } = setup();
  assert.deepEqual(ui.normalizeDiffWords(['a', { text: 'b', status: 'AMBER' }, { text: 'c', status: 'bad' }, { text: 'd', status: 'gap' }, { text: 'e' }, { text: 'f', status: 'extra' }, { text: 'g', status: 'Surplus' }]).map((x) => x.status),
    ['correct', 'almost', 'wrong', 'missing', 'correct', 'extra', 'extra']);
  assert.throws(() => ui.normalizeDiffWords('hola'), /arreglo/);
  assert.throws(() => ui.normalizeDiffWords(['']), /vacía/);
  assert.throws(() => ui.normalizeDiffWords([{ status: 'ok' }]), /falta \"words\[0\].text\"/);
  assert.throws(() => ui.normalizeDiffWords(new Array(501).fill('a')), /demasiadas/);
  const d = ui.createWordDiff({ ...base, showLegend: true, words: ['I', { text: 'leaved', status: 'wrong' }, { text: 'home', status: 'almost' }, { text: 'early', status: 'missing' }, { text: 'very', status: 'extra' }] });
  assert.deepEqual(d.counts(), { correct: 1, almost: 1, wrong: 1, missing: 1, extra: 1 });
  assert.equal(d.el.querySelectorAll('.word-diff__word--wrong').length, 2, 'una en la frase y una en la leyenda');
  assert.equal(d.el.querySelectorAll('.word-diff__word--extra').length, 2, 'una en la frase y una en la leyenda');
  assert.match(d.el.textContent, /leaved \(no coincide\)/);
  assert.match(d.el.textContent, /very \(sobra\)/);
  d.setWords([]); assert.deepEqual(d.counts(), { correct: 0, almost: 0, wrong: 0, missing: 0, extra: 0 });
  d.destroy();
});

test('wordDiff: un estado desconocido se ve como «no coincide», sin lanzar (decisión del Administrador)', () => {
  const { base } = setup();
  for (const status of ['azul', '', 'EXTRA!', 7, {}, true, 'constructor', '__proto__', 'toString']) {
    assert.equal(ui.normalizeDiffWords([{ text: 'x', status }])[0].status, 'wrong', JSON.stringify(status));
  }
  const d = ui.createWordDiff({ ...base, words: [{ text: 'x', status: 'azul' }] });
  assert.deepEqual(d.counts(), { correct: 0, almost: 0, wrong: 1, missing: 0, extra: 0 });
  assert.equal(d.el.querySelectorAll('.word-diff__word--wrong').length, 1);
  d.destroy();
});

test('wordDiff: entiende el formato de core/wordDiff.js SIN adaptador (ok, close, wrong, extra, missing)', () => {
  const { base } = setup();
  const diff = wordDiff('I leaved at the home yesterday', 'I left at home yesterdy', {});
  const d = ui.createWordDiff({ ...base, words: diff });
  const statuses = ui.normalizeDiffWords(diff).map((t) => t.status);
  assert.ok(statuses.includes('wrong') && statuses.includes('extra'), statuses.join());
  assert.equal(statuses.length, diff.length);
  assert.equal(d.el.querySelectorAll('.word-diff__word').length, diff.length);
  d.destroy();
  const all = ui.createWordDiff({ ...base, words: [{ text: 'a', status: 'ok' }, { text: 'recieve', status: 'close', expected: 'receive' }, { text: 'went', status: 'wrong', expected: 'go' }, { text: 'to', status: 'extra' }, { text: 'dog', status: 'missing' }] });
  assert.deepEqual(all.counts(), { correct: 1, almost: 1, wrong: 1, missing: 1, extra: 1 });
  all.destroy();
});

test('wordDiff: `expected` solo se lee por lector de pantalla y el texto de la persona nunca se interpreta como HTML', () => {
  const { base } = setup();
  const evil = '<img src=x onerror=alert(1)>';
  const d = ui.createWordDiff({ ...base, words: [{ text: 'went', status: 'wrong', expected: 'go' }, { text: evil, status: 'extra' }, { text: 'recieve', status: 'close', expected: evil }] });
  assert.match(d.el.textContent, /went \(no coincide; se esperaba: go\)/);
  assert.match(d.el.textContent, /recieve \(casi: error de ortografía; se esperaba: <img src=x onerror=alert\(1\)>\)/);
  assert.equal(d.el.querySelectorAll('img').length, 0);
  assert.throws(() => ui.normalizeDiffWords([{ text: 'a', status: 'wrong', expected: {} }]), /debe ser texto/);
  assert.equal(ui.normalizeDiffWords([{ text: 'a', status: 'ok', expected: 'b' }])[0].expected, undefined, 'solo wrong y close guardan expected');
  assert.equal(Object.hasOwn(ui.normalizeDiffWords([{ text: 'a', status: 'wrong', expected: '' }])[0], 'expected'), false, 'un expected vacío no se guarda');
  d.destroy();
});

test('wordDiff: un diff completo de compare (250 + 250 palabras) cabe en el límite de 500 elementos', () => {
  const { base } = setup();
  const a = Array.from({ length: 250 }, (_, i) => `u${i}`).join(' ');
  const b = Array.from({ length: 250 }, (_, i) => `r${i}`).join(' ');
  const r = compare(a, [b], {});
  assert.ok(r.diff.length <= 500);
  const d = ui.createWordDiff({ ...base, words: r.diff });
  assert.equal(d.counts().wrong, 250);
  d.destroy();
});

test('wordDiff: la hoja de estilos distingue "sobra" de "incorrecta" sin depender del color', () => {
  const css = fs.readFileSync(new URL('../ui/styles/widgets.css', import.meta.url), 'utf8');
  const rule = (name) => new RegExp(`\\.word-diff__word--${name}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
  assert.match(rule('extra'), /line-through/);
  assert.match(rule('extra'), /var\(--danger\)/);
  assert.match(rule('wrong'), /wavy/);
  assert.doesNotMatch(rule('wrong'), /line-through/);
});

// ---------- sin fugas: todo junto ----------
test('destroy de TODOS los componentes no deja listeners ni capas, y es idempotente', () => {
  const { env, base } = setup();
  const timers = makeTimers();
  const all = [
    ui.createButton({ ...base, label: 'a', onClick() {} }), ui.createChip({ ...base, label: 'a' }), ui.createBadge({ ...base, kind: 'level', level: 1, onHelp() {} }),
    ui.createCard({ ...base, title: 'a', onPress() {} }), ui.createSheet({ ...base, title: 'a', timers }), ui.createModal({ ...base, title: 'a', timers }),
    ui.createConfirmDanger({ ...base, title: 'a' }), ui.createProgressBar({ ...base, label: 'a', value: 1 }), ui.createMascot(base),
    ui.createTabs({ ...base, label: 'a', tabs: [{ id: '1', label: 'a', panel: 'x' }, { id: '2', label: 'b', panel: 'y' }] }),
    ui.createSegmented({ ...base, label: 'a', options: [{ value: '1', label: 'a' }, { value: '2', label: 'b' }] }), ui.createToggle({ ...base, label: 'a' }),
    ui.createSlider({ ...base, label: 'a' }), ui.createTextInput({ ...base, label: 'a', onInput() {} }), ui.createEmptyState({ ...base, title: 'a', actionLabel: 'b', onAction() {} }),
    ui.createSkeleton(base), ui.createWordChip({ ...base, word: 'a', onPress() {} }), ui.createWordDiff({ ...base, words: ['a'] }),
  ];
  assert.ok(env.stats.live() > 20);
  all[4].open(); all[5].open();
  for (const c of all) { c.destroy(); c.destroy(); }
  assert.equal(env.stats.live(), 0);
  assert.equal(timers.pending(), 0);
  assert.equal(env.doc.body.children.filter((x) => /sheet|modal/.test(x.getAttribute('class') ?? '')).length, 0);
  assert.ok(!env.doc.documentElement.classList.contains('no-scroll'));
});

test('makeCtx: sin documento y opciones inválidas dan error claro', () => {
  const saved = globalThis.document;
  assert.equal(saved, undefined);
  throwsEs(() => ui.createButton({ label: 'x' }), /no hay documento/);
  throwsEs(() => ui.createButton(null), /las opciones deben ser un objeto/);
  throwsEs(() => ui.createButton([]), /las opciones deben ser un objeto/);
});
