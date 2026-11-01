// @purpose: Pruebas del menú «⋯» de reporte (ui/reportMenu.js, 2.6-T2): abrir y cerrar, carga del estado, marcar y quitar, error de guardado sin cambiar el estado, doble pulsación y datos hostiles.
// 2.6-T2, punto 2. DOM falso y core/itemReport.js real sobre base en memoria.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { h as domH } from '../ui/dom.js';
import { reportMenu, RM_TEXT } from '../ui/reportMenu.js';
import { createItemReport } from '../core/itemReport.js';
import { createMemoryDb } from '../core/db.memory.js';
import { makeEnv } from './_fakeDom.mjs';
import { makeClock } from './_helpers.mjs';

const env = makeEnv();
const { h } = domH.with(env.doc);
const click = (el) => el.dispatchEvent({ type: 'click', preventDefault() {} });
const q = (root, sel) => root.querySelector(sel);

async function world() {
  const db = createMemoryDb(); await db.open();
  const report = createItemReport({ db, clock: makeClock('2026-10-31T15:00:00.000Z') });
  return { db, report };
}
const opts = (root) => ({ toggle: q(root, '.fb__report-toggle'), list: q(root, '.fb__report-list'), hard: q(root, '.fb__report-option'), doubt: root.querySelectorAll('.fb__report-option')[1], status: q(root, '.fb__report-status') });

test('estructura: botón «⋯» con nombre accesible, lista oculta, dos opciones y zona de estado', async () => {
  const { report } = await world();
  const root = reportMenu({ h, itemId: 'a1', report });
  const e = opts(root);
  assert.equal(e.toggle.textContent, '⋯');
  assert.equal(e.toggle.getAttribute('aria-label'), RM_TEXT.toggleLabel);
  assert.equal(e.toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(e.toggle.getAttribute('aria-controls'), e.list.getAttribute('id'));
  assert.ok(e.list.hasAttribute ? e.list.hasAttribute('hidden') : e.list.getAttribute('hidden') !== null, 'la lista empieza oculta');
  assert.equal(root.querySelectorAll('.fb__report-option').length, 2);
  assert.equal(e.status.getAttribute('role'), 'status');
  assert.equal(e.status.getAttribute('aria-live'), 'polite');
  await env.flush();
});

test('abrir y cerrar con «⋯» actualiza aria-expanded y la lista', async () => {
  const { report } = await world();
  const root = reportMenu({ h, itemId: 'a1', report });
  const e = opts(root);
  click(e.toggle);
  assert.equal(e.toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(e.list.getAttribute('hidden'), null);
  click(e.toggle);
  assert.equal(e.toggle.getAttribute('aria-expanded'), 'false');
  assert.notEqual(e.list.getAttribute('hidden'), null);
  await env.flush();
});

test('las opciones llevan aria-disabled hasta cargar y luego quedan activas, sin marcar', async () => {
  const { report } = await world();
  const root = reportMenu({ h, itemId: 'a1', report });
  const e = opts(root);
  assert.equal(e.hard.getAttribute('aria-disabled'), 'true');
  await env.flush(); await env.flush();
  assert.equal(e.hard.getAttribute('aria-disabled'), 'false');
  assert.equal(e.hard.hasAttribute ? e.hard.hasAttribute('disabled') : e.hard.getAttribute('disabled') !== null, false, 'nunca `disabled`: perdería el foco');
  assert.equal(e.hard.textContent, RM_TEXT.hard);
  assert.equal(e.hard.getAttribute('aria-pressed'), 'false');
  assert.equal(e.doubt.textContent, RM_TEXT.doubt);
});

test('marcar como difícil guarda en el almacén, cambia el texto y avisa con texto', async () => {
  const { report } = await world();
  const calls = [];
  const root = reportMenu({ h, itemId: 'a1', report, onChange: (k, m) => calls.push([k, m]) });
  const e = opts(root);
  await env.flush(); await env.flush();
  click(e.hard); await env.flush(); await env.flush();
  assert.equal((await report.get('a1')).hard !== null, true);
  assert.equal(e.hard.textContent, RM_TEXT.hardOn);
  assert.equal(e.hard.getAttribute('aria-pressed'), 'true');
  assert.equal(e.status.textContent, RM_TEXT.savedHard);
  assert.deepEqual(calls, [['hard', true]]);
  assert.equal(e.doubt.getAttribute('aria-pressed'), 'false', 'el otro tipo no cambia');
});

test('volver a pulsar quita la marca del almacén', async () => {
  const { report } = await world();
  const root = reportMenu({ h, itemId: 'a1', report });
  const e = opts(root);
  await env.flush(); await env.flush();
  click(e.doubt); await env.flush(); await env.flush();
  assert.equal(e.status.textContent, RM_TEXT.savedDoubt);
  click(e.doubt); await env.flush(); await env.flush();
  assert.equal(await report.get('a1'), null);
  assert.equal(e.doubt.textContent, RM_TEXT.doubt);
  assert.equal(e.status.textContent, RM_TEXT.clearedDoubt);
});

test('un ítem ya marcado se muestra marcado al crear el menú', async () => {
  const { report } = await world();
  await report.mark('a1', 'hard');
  const root = reportMenu({ h, itemId: 'a1', report });
  const e = opts(root);
  await env.flush(); await env.flush();
  assert.equal(e.hard.getAttribute('aria-pressed'), 'true');
  assert.equal(e.hard.textContent, RM_TEXT.hardOn);
  assert.equal(e.doubt.getAttribute('aria-pressed'), 'false');
});

test('un ítem marcado solo como «no me convence», o con los dos tipos, se muestra tal cual', async () => {
  const { report } = await world();
  await report.mark('d1', 'doubt'); await report.mark('b2', 'hard'); await report.mark('b2', 'doubt');
  const only = opts(reportMenu({ h, itemId: 'd1', report }));
  const both = opts(reportMenu({ h, itemId: 'b2', report }));
  await env.flush(); await env.flush();
  assert.deepEqual([only.hard.getAttribute('aria-pressed'), only.doubt.getAttribute('aria-pressed')], ['false', 'true']);
  assert.equal(only.doubt.textContent, RM_TEXT.doubtOn);
  assert.deepEqual([both.hard.getAttribute('aria-pressed'), both.doubt.getAttribute('aria-pressed')], ['true', 'true']);
});

test('si guardar falla: el estado no cambia, el aviso no culpa y se puede reintentar', async () => {
  const { report: real } = await world();
  let fail = true;
  const report = { keyOf: real.keyOf, get: real.get, clear: real.clear, mark: async (...a) => { if (fail) throw new Error('cuota'); return real.mark(...a); } };
  const calls = [];
  const root = reportMenu({ h, itemId: 'a1', report, onChange: (k, m) => calls.push([k, m]) });
  const e = opts(root);
  await env.flush(); await env.flush();
  click(e.hard); await env.flush(); await env.flush();
  assert.equal(e.status.textContent, RM_TEXT.failed);
  assert.equal(e.hard.getAttribute('aria-pressed'), 'false');
  assert.equal(e.hard.getAttribute('aria-disabled'), 'false', 'se puede reintentar');
  assert.deepEqual(calls, []);
  fail = false;
  click(e.hard); await env.flush(); await env.flush();
  assert.equal(e.status.textContent, RM_TEXT.savedHard);
  assert.deepEqual(calls, [['hard', true]]);
});

test('doble pulsación mientras guarda: una sola escritura', async () => {
  const { report: real } = await world();
  let n = 0; let release;
  const gate = new Promise((r) => { release = r; });
  const report = { keyOf: real.keyOf, get: real.get, clear: real.clear, mark: async (...a) => { n += 1; await gate; return real.mark(...a); } };
  const root = reportMenu({ h, itemId: 'a1', report });
  const e = opts(root);
  await env.flush(); await env.flush();
  click(e.hard); click(e.hard); click(e.doubt);
  assert.equal(e.hard.getAttribute('aria-disabled'), 'true');
  release(); await env.flush(); await env.flush();
  assert.equal(n, 1);
  assert.equal((await real.get('a1')).doubt, null);
});

test('si la lectura inicial falla, las opciones se muestran sin marcar y activas', async () => {
  const { report: real } = await world();
  const report = { keyOf: real.keyOf, get: async () => { throw new Error('cerrada'); }, mark: real.mark, clear: real.clear };
  const root = reportMenu({ h, itemId: 'a1', report });
  const e = opts(root);
  await env.flush(); await env.flush();
  assert.equal(e.hard.getAttribute('aria-disabled'), 'false');
  assert.equal(e.hard.getAttribute('aria-pressed'), 'false');
});

test('un onChange que lanza no rompe el aviso', async () => {
  const { report } = await world();
  const root = reportMenu({ h, itemId: 'a1', report, onChange: () => { throw new Error('x'); } });
  const e = opts(root);
  await env.flush(); await env.flush();
  click(e.hard); await env.flush(); await env.flush();
  assert.equal(e.status.textContent, RM_TEXT.savedHard);
});

test('datos hostiles: sin report o itemId inválido devuelve null; sin h lanza TypeError', async () => {
  const { report } = await world();
  for (const bad of [undefined, null, 5, {}, { get() {}, mark() {}, clear() {} }]) assert.equal(reportMenu({ h, itemId: 'a1', report: bad }), null);
  for (const id of ['', 'con espacio', 'a/b', undefined, null, 7, 'x'.repeat(201)]) assert.equal(reportMenu({ h, itemId: id, report }), null);
  assert.throws(() => reportMenu({ itemId: 'a1', report }), TypeError);
  assert.throws(() => reportMenu(undefined), TypeError);
});

test('cada menú tiene su propio id de lista (varios en pantalla no chocan)', async () => {
  const { report } = await world();
  const a = reportMenu({ h, itemId: 'a1', report }); const b = reportMenu({ h, itemId: 'b2', report });
  assert.notEqual(q(a, '.fb__report-list').getAttribute('id'), q(b, '.fb__report-list').getAttribute('id'));
  await env.flush();
});

test('los textos no culpan ni usan lenguaje de fallo', () => {
  for (const v of Object.values(RM_TEXT)) assert.doesNotMatch(v, /error|mal\b|fallaste|culpa|incorrect/i);
});
