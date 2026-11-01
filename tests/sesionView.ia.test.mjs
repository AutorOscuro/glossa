// @purpose: Pruebas de «Preguntas IA» dentro de la vista de sesión (2.7-T3): botón en la barra, CA 1 (el ejercicio no se pierde), «Llevar al chat» con la respuesta en curso, cronómetro y orden fijo.
// 2.7-T3. Usa el harness de la vista con fuentes falsas; el cableado real llega con 2.9-T3.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mk, openNew, fakeHost } from './_sesionHarness.mjs';
import { createAiHelpSource } from '../app/aiHelpSource.js';
import { parseChatBlock } from '../core/syncChat.js';

const realDocument = globalThis.document;
afterEach(() => { globalThis.document = realDocument; });

const aiSource = (over = {}) => createAiHelpSource({ ai: { availability: () => ({ available: false, reason: 'no_ai' }) }, ...over });
const labels = (t) => t.q('.actionbar button').map((b) => b.querySelectorAll('.btn__label')[0].textContent);
const aiBtn = (t) => t.q('.actionbar button').find((b) => b.querySelectorAll('.btn__label')[0].textContent === 'Preguntas IA');
const closeBtn = (t) => t.env.doc.body.querySelectorAll('button').find((b) => b.getAttribute('aria-label') === 'Cerrar');
const sheetText = (t) => t.env.doc.body.querySelectorAll('.ai')[0]?.textContent ?? '';
const bring = (t) => t.env.doc.body.querySelectorAll('.ai__bring')[0];
const clipboardOf = (copied, fail = false) => ({ writeText: async (x) => { if (fail) throw new Error('denegado'); copied.push(x); } });

test('sin fuente de IA no hay botón; con ella aparece «Preguntas IA» (y solo ella si no hay otras)', async () => {
  const none = await mk(); await openNew(none);
  assert.equal(none.q('.actionbar').length, 0);
  const t = await mk({ services: { aiHelp: aiSource() } });
  await openNew(t);
  assert.deepEqual(labels(t), ['Preguntas IA']);
});

test('el orden es el fijo de 7.7: ejemplos, correcciones, preguntas IA', async () => {
  const ex = { forEntry: async () => ({ examples: [], count: 0, enough: false }) };
  const co = { forEntry: async () => ({ corrections: [], count: 0 }) };
  const t = await mk({ services: { aiHelp: aiSource(), corrections: co, examples: ex } });
  await openNew(t);
  assert.deepEqual(labels(t), ['Otros ejemplos', 'Correcciones', 'Preguntas IA']);
});

test('CA 1 · sin IA la hoja dice «Conecta tu clave en Ajustes» y el ejercicio sigue montado', async () => {
  const t = await mk({ services: { aiHelp: aiSource() } });
  await openNew(t);
  const mounted = t.host.calls.mounted.length; const destroyed = t.host.calls.destroyed;
  t.click(aiBtn(t)); await t.flush();
  assert.match(sheetText(t), /Conecta tu clave en Ajustes/);
  assert.equal(bring(t).textContent, 'Llevar al chat');
  assert.equal(t.host.calls.mounted.length, mounted);
  assert.equal(t.host.calls.destroyed, destroyed);
  t.click(closeBtn(t)); await t.flush();
  t.click(t.btn('Comprobar')); await t.flush();
  assert.equal((await t.events()).length, 1);
});

test('CA 3 · «Llevar al chat» copia un bloque válido con el tema, la respuesta en curso y el dominio', async () => {
  const copied = [];
  const host = fakeHost();
  const mount = host.mount.bind(host);
  host.mount = async (slot, entry, ctx) => { const h = await mount(slot, entry, ctx); return { ...h, getResponse: () => 'I live here' }; };
  const t = await mk({ host, services: { aiHelp: aiSource({ mastery: { compute: async () => ({ pct: 30, label: 'Inicio' }) } }), clipboard: clipboardOf(copied) } });
  await openNew(t);
  t.click(aiBtn(t)); await t.flush();
  t.click(bring(t)); await t.flush(); await t.flush();
  assert.equal(copied.length, 1);
  const back = parseChatBlock(copied[0]);
  assert.equal(back.ok, true);
  assert.equal(back.kind, 'llevar_al_chat');
  assert.equal(back.payload.tema, t.host.calls.mounted[0].topic);
  assert.equal(back.payload.respuesta, 'I live here');
  assert.deepEqual(back.payload.dominio, { pct: 30, banda: 'Inicio' });
  assert.match(sheetText(t), /Copiado/);
  assert.ok(t.btn('Comprobar'), 'el ejercicio sigue ahí');
});

test('CA 3 · si el portapapeles falla en la sesión, el bloque queda a la vista para copiarlo a mano', async () => {
  const t = await mk({ services: { aiHelp: aiSource(), clipboard: clipboardOf([], true) } });
  await openNew(t);
  t.click(aiBtn(t)); await t.flush();
  t.click(bring(t)); await t.flush(); await t.flush();
  const box = t.env.doc.body.querySelectorAll('.ai__block')[0];
  assert.match(box.value, /^=== SOPHIA-EN-SYNC v1 ===\ntipo: llevar_al_chat/);
  assert.ok(t.btn('Comprobar'));
});

test('el rato con la hoja abierta no cuenta en el tiempo de respuesta', async () => {
  const t = await mk({ services: { aiHelp: aiSource() } });
  await openNew(t);
  t.clock.advance(1000);
  t.click(aiBtn(t)); await t.flush();
  t.clock.advance(30000);
  t.click(closeBtn(t)); await t.flush();
  t.clock.advance(500);
  t.click(t.btn('Comprobar')); await t.flush();
  assert.equal((await t.events())[0].ms, 1500);
});

test('si la fuente falla al preparar, el aviso es amable, el motivo va al log y el ejercicio no se toca', async () => {
  const src = { status: () => ({ available: false, reason: 'no_ai' }), prepare: async () => { throw new Error('roto'); } };
  const t = await mk({ services: { aiHelp: src, clipboard: clipboardOf([]) } });
  await openNew(t);
  const realError = console.error; const logged = [];
  console.error = (...a) => logged.push(a);
  try { t.click(aiBtn(t)); await t.flush(); t.click(bring(t)); await t.flush(); await t.flush(); } finally { console.error = realError; }
  assert.match(sheetText(t), /No pude preparar el bloque/);
  assert.ok(logged.length >= 1);
  assert.equal(t.host.calls.destroyed, 0);
  assert.ok(t.btn('Comprobar'));
});

test('al salir de la vista la hoja se limpia sin fugas', async () => {
  const t = await mk({ services: { aiHelp: aiSource() } });
  await openNew(t);
  t.click(aiBtn(t)); await t.flush();
  t.view2.destroy();
  assert.equal(t.env.doc.body.querySelectorAll('.ai').length, 0);
  assert.equal(t.q('.actionbar').length, 0);
});

// ---- 2.7-T4 · Diccionario dentro de la sesión ----
import { createDictionarySource } from '../app/dictionarySource.js';
const LEX = [{ id: 'vocab.t.knee', lemma: 'knee', pos: 'noun', family: 'vocab.t', level: 'A1', es: ['rodilla'], def_en: 'a joint', examples: [] }];
const diBtn = (t) => t.q('.actionbar button').find((b) => b.querySelectorAll('.btn__label')[0].textContent === 'Diccionario');
const diText = (t) => t.env.doc.body.querySelectorAll('.dictionary')[0]?.textContent ?? '';

test('con fuente de diccionario aparece «Diccionario» en el orden fijo y CA 1: abrir no desmonta el ejercicio', async () => {
  const dictionary = createDictionarySource({ loadLexicon: async () => LEX });
  const t = await mk({ services: { aiHelp: aiSource(), dictionary } });
  await openNew(t);
  assert.deepEqual(labels(t), ['Preguntas IA', 'Diccionario']);
  const mounted = t.host.calls.mounted.length; const destroyed = t.host.calls.destroyed;
  t.click(diBtn(t)); await t.flush(); await t.flush();
  const field = t.env.doc.body.querySelectorAll('.dictionary__field')[0];
  field.value = 'KNEE'; field.dispatchEvent({ type: 'input' });
  assert.match(diText(t), /rodilla/);
  assert.equal(t.host.calls.mounted.length, mounted);
  assert.equal(t.host.calls.destroyed, destroyed);
  t.click(closeBtn(t)); await t.flush();
  t.click(t.btn('Comprobar')); await t.flush();
  assert.equal((await t.events()).length, 1);
});

test('Diccionario: el rato con la hoja abierta no cuenta en el tiempo y las 4 acciones salen juntas en orden', async () => {
  const dictionary = createDictionarySource({ loadLexicon: async () => LEX });
  const ex = { forEntry: async () => ({ examples: [], count: 0, enough: false }) };
  const co = { forEntry: async () => ({ corrections: [], count: 0 }) };
  const t = await mk({ services: { examples: ex, corrections: co, aiHelp: aiSource(), dictionary } });
  await openNew(t);
  assert.deepEqual(labels(t), ['Otros ejemplos', 'Correcciones', 'Preguntas IA', 'Diccionario']);
  t.clock.advance(1000);
  t.click(diBtn(t)); await t.flush(); await t.flush();
  t.clock.advance(30000);
  t.click(t.env.doc.body.querySelectorAll('button').filter((b) => b.getAttribute('aria-label') === 'Cerrar').at(-1)); await t.flush();
  t.clock.advance(500);
  t.click(t.btn('Comprobar')); await t.flush();
  assert.equal((await t.events())[0].ms, 1500);
});

test('Diccionario: si el léxico no carga, el ejercicio queda intacto y al salir no hay fugas', async () => {
  const dictionary = createDictionarySource({ loadLexicon: async () => { throw new Error('sin paquetes'); } });
  const t = await mk({ services: { dictionary } });
  await openNew(t);
  const realError = console.error; console.error = () => {};
  try { t.click(diBtn(t)); await t.flush(); await t.flush(); } finally { console.error = realError; }
  assert.match(diText(t), /No pude abrir el diccionario/);
  assert.ok(t.btn('Comprobar'));
  t.view2.destroy();
  assert.equal(t.env.doc.body.querySelectorAll('.dictionary').length, 0);
});
