// @purpose: Pruebas de la barra de ayudas y la hoja «Otros ejemplos» dentro de la vista de sesión (2.7-T1): CA 1 (el ejercicio no se pierde), cronómetro, ítems por venir y limpieza.
// 2.7-T1. Usa el harness de la vista con una fuente de ejemplos falsa; el cargador real de ítems llega con 2.9-T3.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mk, openNew } from './_sesionHarness.mjs';

const realDocument = globalThis.document;
afterEach(() => { globalThis.document = realDocument; });

const EXAMPLES = { examples: [{ en: 'I have lived here for two years.', es: null, kind: 'item' }, { en: 'She has known him since 2019.', es: null, kind: 'item' }, { en: 'We have studied since March.', es: null, kind: 'item' }], count: 3, enough: true };
const fakeSource = (over = {}) => { const calls = []; return { calls, forEntry: async (entry, opts) => { calls.push({ entry, opts }); return over.result ?? EXAMPLES; }, ...(over.forEntry ? { forEntry: over.forEntry } : {}) }; };
const bar = (t) => t.q('.actionbar')[0] ?? null;
const helpBtn = (t) => t.q('.actionbar button')[0];
const closeBtn = (t) => t.env.doc.body.querySelectorAll('button').find((b) => b.getAttribute('aria-label') === 'Cerrar');
const sheetEl = (t) => t.env.doc.body.querySelectorAll('.examples')[0] ?? null;

test('sin fuente de ejemplos no hay barra de ayudas: la sesión queda como antes', async () => {
  const t = await mk();
  await openNew(t);
  assert.equal(bar(t), null);
});

test('con fuente, la barra aparece con el ejercicio montado y solo con «Otros ejemplos»', async () => {
  const t = await mk({ services: { examples: fakeSource() } });
  await openNew(t);
  assert.ok(bar(t));
  assert.equal(bar(t).hasAttribute('hidden'), false);
  assert.deepEqual(t.q('.actionbar button').map((b) => b.querySelectorAll('.btn__label')[0].textContent), ['Otros ejemplos']);
});

test('CA 1 · abrir la hoja no desmonta ni reinicia el ejercicio, y al cerrar sigue como estaba', async () => {
  const src = fakeSource();
  const t = await mk({ services: { examples: src } });
  await openNew(t);
  const mountedBefore = t.host.calls.mounted.length;
  const destroyedBefore = t.host.calls.destroyed;
  t.click(helpBtn(t)); await t.flush();
  assert.ok(sheetEl(t), 'la hoja está abierta');
  assert.match(sheetEl(t).textContent, /I have lived here/);
  assert.equal(t.host.calls.mounted.length, mountedBefore);
  assert.equal(t.host.calls.destroyed, destroyedBefore);
  assert.ok(t.btn('Comprobar'), 'el botón del ejercicio sigue ahí');
  t.click(closeBtn(t)); await t.flush();
  assert.equal(t.host.calls.mounted.length, mountedBefore);
  t.click(t.btn('Comprobar')); await t.flush();
  assert.equal((await t.events()).length, 1, 'se puede responder con normalidad después');
});

test('la fuente recibe el ejercicio actual y excluye los ítems que aún no se presentaron', async () => {
  const src = fakeSource();
  const t = await mk({ cards: 3, services: { examples: src } });
  await openNew(t);
  t.click(helpBtn(t)); await t.flush();
  assert.equal(src.calls.length, 1);
  const { entry, opts } = src.calls[0];
  assert.equal(entry.itemId, t.host.calls.mounted[0].itemId);
  assert.equal(opts.excludeItemIds.length, 2, 'en el primero de 3, los otros 2 están por venir');
  assert.ok(!opts.excludeItemIds.includes(entry.itemId));
});

test('el rato con la hoja abierta no cuenta en el tiempo de respuesta', async () => {
  const t = await mk({ services: { examples: fakeSource() } });
  await openNew(t);
  t.clock.advance(1000);
  t.click(helpBtn(t)); await t.flush();
  t.clock.advance(30000);
  t.click(closeBtn(t)); await t.flush();
  t.clock.advance(500);
  t.click(t.btn('Comprobar')); await t.flush();
  assert.equal((await t.events())[0].ms, 1500);
});

test('si la fuente falla, el ejercicio sigue intacto y el aviso es amable', async () => {
  const src = fakeSource({ forEntry: async () => { throw new Error('sin contenido'); } });
  const t = await mk({ services: { examples: src } });
  await openNew(t);
  t.click(helpBtn(t)); await t.flush();
  assert.match(sheetEl(t).textContent, /No pude buscar ejemplos/);
  assert.ok(t.btn('Comprobar'));
  assert.equal(t.host.calls.destroyed, 0);
});

test('la barra sigue con cada ejercicio montado y desaparece en el resumen final', async () => {
  const t = await mk({ cards: 2, services: { examples: fakeSource() } });
  await openNew(t);
  assert.equal(bar(t).hasAttribute('hidden'), false);
  t.click(t.btn('Comprobar')); await t.flush();
  assert.equal(bar(t).hasAttribute('hidden'), false, 'con la corrección a la vista la ayuda sigue disponible');
  t.click(t.btn('Continuar')); await t.flush();
  assert.equal(bar(t).hasAttribute('hidden'), false, 'con el siguiente ejercicio también');
  t.click(t.btn('Comprobar')); await t.flush();
  t.click(t.btn('Continuar')); await t.flush();
  assert.equal(bar(t).hasAttribute('hidden'), true, 'en el resumen no hay ejercicio al que ayudar');
});

test('al salir de la vista la barra y la hoja se limpian sin fugas', async () => {
  const t = await mk({ services: { examples: fakeSource() } });
  await openNew(t);
  t.click(helpBtn(t)); await t.flush();
  t.view2.destroy();
  assert.equal(t.env.doc.body.querySelectorAll('.examples').length, 0);
  assert.equal(t.q('.actionbar').length, 0);
});

// ---- 2.7-T2 · Correcciones ----
const fakeCorrections = (result = { corrections: [{ id: 'e1', original: "I didn't can", correction: "I couldn't", code: 'VRB.CAN_TO', title: 'can + to', hint: null, count: 1, own: true }], count: 1 }) => {
  const calls = [];
  return { calls, forEntry: async (entry) => { calls.push(entry); return typeof result === 'function' ? result(entry) : result; } };
};
const labels = (t) => t.q('.actionbar button').map((b) => b.querySelectorAll('.btn__label')[0].textContent);
const badgeOf = (t) => t.q('.actionbar__badge').find((b) => !b.hasAttribute('hidden'))?.textContent ?? null;

test('2.7-T2 · con fuente de correcciones la barra suma «Correcciones» y la insignia lleva la cuenta exacta (CA 2)', async () => {
  const t = await mk({ services: { examples: fakeSource(), corrections: fakeCorrections() } });
  await openNew(t); await t.flush();
  assert.deepEqual(labels(t), ['Otros ejemplos', 'Correcciones']);
  assert.equal(badgeOf(t), '1');
});

test('2.7-T2 · solo con correcciones (sin ejemplos) la barra tiene solo esa acción; sin cuenta la insignia no se ve', async () => {
  const t = await mk({ services: { corrections: fakeCorrections({ corrections: [], count: 0 }) } });
  await openNew(t); await t.flush();
  assert.deepEqual(labels(t), ['Correcciones']);
  assert.equal(badgeOf(t), null);
});

test('2.7-T2 · CA 1 · abrir Correcciones no desmonta el ejercicio y al cerrar se puede responder', async () => {
  const src = fakeCorrections();
  const t = await mk({ services: { corrections: src } });
  await openNew(t); await t.flush();
  const mountedBefore = t.host.calls.mounted.length;
  t.click(helpBtn(t)); await t.flush();
  assert.match(t.env.doc.body.querySelectorAll('.corrections')[0].textContent, /Escribiste: I didn't can/);
  assert.equal(t.host.calls.mounted.length, mountedBefore);
  t.click(closeBtn(t)); await t.flush();
  t.click(t.btn('Comprobar')); await t.flush();
  assert.equal((await t.events()).length, 1);
});

test('2.7-T2 · si la fuente falla, la sesión sigue: sin insignia, motivo al log y el ejercicio intacto', async () => {
  const src = fakeCorrections(() => { throw new Error('base caída'); });
  const t = await mk({ services: { corrections: src } });
  const logged = []; const realError = console.error; console.error = (...a) => logged.push(a);
  try { await openNew(t); await t.flush(); } finally { console.error = realError; }
  assert.equal(badgeOf(t), null);
  assert.ok(logged.some((a) => /correcciones/.test(String(a[0]))), 'el motivo se anota');
  assert.ok(t.btn('Comprobar'));
});
