// @purpose: Prueba que la barra de ayudas aparece en la vista de sesión con los 4 servicios reales de app/helpServices.js y que, sin IA configurada, «Preguntas IA» ofrece «Llevar al chat».
// Subparte 2.9-T3, punto 5. Usa el arnés de la vista (DOM falso, base en memoria y estudio real); las fachadas leen los servicios de ese mismo arnés.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mk, openNew, TOPIC } from './_sesionHarness.mjs';
import { createHelpServices } from '../app/helpServices.js';
import { createItemResolver } from '../app/itemResolver.js';
import { parseChatBlock } from '../core/syncChat.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const reply = (text) => ({ ok: true, status: 200, text: async () => text, json: async () => JSON.parse(text) });
const repoFetch = async (url) => reply(fs.readFileSync(path.join(ROOT, url), 'utf8'));
const realDocument = globalThis.document;
afterEach(() => { globalThis.document = realDocument; });

const labels = (t) => t.q('.actionbar button').map((b) => b.querySelectorAll('.btn__label')[0].textContent);
const barBtn = (t, label) => t.q('.actionbar button').find((b) => b.querySelectorAll('.btn__label')[0].textContent === label);
const sheetText = (t, cls) => t.env.doc.body.querySelectorAll(cls)[0]?.textContent ?? '';
const closeBtn = (t) => t.env.doc.body.querySelectorAll('button').find((b) => b.getAttribute('aria-label') === 'Cerrar');

// Arma la sesión con los 4 servicios reales. `live` es el mismo objeto que usa la vista: se completa tras crear el arnés, como hace app.services al arrancar.
async function open({ clipboard, settings } = {}) {
  const live = {};
  const help = createHelpServices({ services: live, fetchFn: async () => reply('{}'), log: () => {} });
  const extra = { ...help, ...(clipboard ? { clipboard } : {}) };
  const t = await mk({ services: extra });
  Object.assign(live, t.services, { itemResolver: createItemResolver({ fetchFn: repoFetch, log: () => {} }), ...(settings ? { settings } : {}) });
  await openNew(t);
  return t;
}

test('la barra aparece con las 4 acciones en el orden fijo, usando los servicios reales', async () => {
  const t = await open();
  assert.deepEqual(labels(t), ['Otros ejemplos', 'Correcciones', 'Preguntas IA', 'Diccionario']);
});

test('sin IA configurada, «Preguntas IA» dice «Conecta tu clave en Ajustes» y ofrece «Llevar al chat» sin perder el ejercicio', async () => {
  const t = await open();
  const mounted = t.host.calls.mounted.length; const destroyed = t.host.calls.destroyed;
  t.click(barBtn(t, 'Preguntas IA')); await t.flush();
  assert.match(sheetText(t, '.ai'), /Conecta tu clave en Ajustes/);
  const bring = t.env.doc.body.querySelectorAll('.ai__bring')[0];
  assert.equal(bring.textContent, 'Llevar al chat');
  assert.equal(t.host.calls.mounted.length, mounted);
  assert.equal(t.host.calls.destroyed, destroyed);
});

test('«Llevar al chat» con la fachada real copia un bloque válido con el tema del ejercicio', async () => {
  const copied = [];
  const t = await open({ clipboard: { writeText: async (x) => { copied.push(x); } } });
  t.click(barBtn(t, 'Preguntas IA')); await t.flush();
  t.click(t.env.doc.body.querySelectorAll('.ai__bring')[0]); await t.flush(); await t.flush();
  assert.equal(copied.length, 1);
  assert.ok(parseChatBlock(copied[0]), 'el bloque se lee de vuelta');
  assert.ok(copied[0].includes(TOPIC));
});

test('con una clave guardada la hoja ya no pide conectar la clave (el estado lo lee de los ajustes en vivo)', async () => {
  const settings = { get: (k) => ({ aiMode: 'auto', aiProvider: 'groq', aiModel: '', aiKey: 'gsk_prueba' })[k] };
  const t = await open({ settings });
  t.click(barBtn(t, 'Preguntas IA')); await t.flush();
  assert.doesNotMatch(sheetText(t, '.ai'), /Conecta tu clave en Ajustes/);
});

test('«Correcciones» abre su hoja con cuenta 0 cuando no hay errores guardados, sin avisos de fallo', async () => {
  const t = await open();
  t.click(barBtn(t, 'Correcciones')); await t.flush(); await t.flush();
  assert.equal(t.logs.length, 0, 'ningún error anotado');
  assert.ok(t.env.doc.body.querySelectorAll('button').some((b) => b.getAttribute('aria-label') === 'Cerrar'));
  t.click(closeBtn(t)); await t.flush();
  t.click(t.btn('Comprobar')); await t.flush();
  assert.equal((await t.events()).length, 1, 'el ejercicio sigue y se puede responder');
});

test('«Diccionario» abre con el léxico de los paquetes (la semilla no trae) y deja buscar sin lanzar', async () => {
  const t = await open();
  t.click(barBtn(t, 'Diccionario')); await t.flush(); await t.flush();
  assert.equal(t.logs.length, 0);
  assert.ok(t.env.doc.body.querySelectorAll('input').length >= 1, 'hay un campo de búsqueda');
});
