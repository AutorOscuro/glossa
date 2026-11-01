// @purpose: Evidencia de los 4 criterios de aceptación de 2.7 (barra de 4 acciones) de punta a punta: vista de sesión real con las cuatro fuentes reales y la base en memoria.
// 2.7-T4 (cierre). CA 1 las 4 acciones abren su hoja sin perder el ejercicio · CA 2 contador de correcciones exacto · CA 3 «Llevar al chat» copia el bloque, con alternativa si el portapapeles falla · CA 4 el diccionario tolera mayúsculas y acentos.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mk, openNew, CATALOG, TOPIC } from './_sesionHarness.mjs';
import { createExamplesSource } from '../app/examplesSource.js';
import { createCorrectionsSource } from '../app/correctionsSource.js';
import { createAiHelpSource } from '../app/aiHelpSource.js';
import { createDictionarySource } from '../app/dictionarySource.js';
import { parseChatBlock } from '../core/syncChat.js';

const realDocument = globalThis.document;
afterEach(() => { globalThis.document = realDocument; });

const ITEMS = ['She is happy.', 'We are late.', 'They are here.', 'I am tired.'].map((en, i) => ({ id: `x${i}`, type: 'fix_error', topic: TOPIC, topics: [TOPIC], prompt_en: en, accept: [en], examples: [{ en, es: null }] }));
const LEX = [{ id: 'vocab.t.knee', lemma: 'knee', pos: 'noun', family: 'vocab.t', level: 'A1', es: ['rodilla'], def_en: 'a joint', examples: [] }, { id: 'vocab.t.cafe', lemma: 'café', pos: 'noun', family: 'vocab.t', level: 'A1', es: ['café'], def_en: 'a small shop', examples: [] }];
const labels = (t) => t.q('.actionbar button').map((b) => b.querySelectorAll('.btn__label')[0].textContent);
const btn = (t, label) => t.q('.actionbar button').find((b) => b.querySelectorAll('.btn__label')[0].textContent === label);
const close = (t) => t.click(t.env.doc.body.querySelectorAll('button').filter((b) => b.getAttribute('aria-label') === 'Cerrar').at(-1));
const body = (t, cls) => t.env.doc.body.querySelectorAll(cls)[0]?.textContent ?? '';
const badge = (t) => t.q('.actionbar__badge').find((b) => !b.hasAttribute('hidden'))?.textContent ?? null;

async function full({ clipboard, errorsToRecord = [], loadItems = async () => ITEMS } = {}) {
  const t = await mk({ cards: 4 });
  for (const e of errorsToRecord) await t.study.errors.record(e);
  const corrections = createCorrectionsSource({ errors: t.study.errors, catalog: CATALOG });
  t.services.examples = createExamplesSource({ loadItems });
  t.services.corrections = corrections;
  t.services.aiHelp = createAiHelpSource({ ai: { availability: () => ({ available: false, reason: 'no_key' }) }, corrections, mastery: t.study.mastery });
  t.services.dictionary = createDictionarySource({ loadLexicon: async () => LEX, db: t.db, clock: t.clock });
  if (clipboard) t.services.clipboard = clipboard;
  await openNew(t); await t.flush();
  return t;
}

test('CA 1 · las 4 acciones salen en el orden fijo y cada una abre su hoja sin desmontar ni reiniciar el ejercicio', async () => {
  const t = await full();
  assert.deepEqual(labels(t), ['Otros ejemplos', 'Correcciones', 'Preguntas IA', 'Diccionario']);
  const mounted = t.host.calls.mounted.length; const destroyed = t.host.calls.destroyed;
  const sheets = { 'Otros ejemplos': '.examples', Correcciones: '.corrections', 'Preguntas IA': '.ai', Diccionario: '.dictionary' };
  for (const [label, cls] of Object.entries(sheets)) {
    t.click(btn(t, label)); await t.flush(); await t.flush();
    assert.ok(t.env.doc.body.querySelectorAll(cls)[0], `${label}: la hoja se abrió`);
    assert.ok(t.btn('Comprobar'), `${label}: el ejercicio sigue ahí`);
    close(t); await t.flush();
  }
  assert.equal(t.host.calls.mounted.length, mounted, 'ningún ejercicio se montó de nuevo');
  assert.equal(t.host.calls.destroyed, destroyed, 'ningún ejercicio se destruyó');
  t.click(t.btn('Comprobar')); await t.flush();
  assert.equal((await t.events()).length, 1, 'se puede responder con normalidad después de abrir las 4');
});

test('CA 1 · un fallo en cualquiera de las fuentes no rompe la sesión ni toca el ejercicio', async () => {
  const t = await full({ loadItems: async () => { throw new Error('roto'); } });
  const realError = console.error; console.error = () => {};
  try { t.click(btn(t, 'Otros ejemplos')); await t.flush(); await t.flush(); } finally { console.error = realError; }
  assert.match(body(t, '.examples'), /No pude buscar ejemplos/);
  assert.ok(t.btn('Comprobar'));
});

test('CA 2 · el contador de correcciones es exacto: cada error distinto cuenta una vez, repetirlo no lo duplica y los de otros temas no entran', async () => {
  const t = await full({ errorsToRecord: [
    { original: "I didn't can to send it", code: 'VRB.CAN_TO', topics: [TOPIC], ts: '2026-10-26T10:00:00.000Z' },
    { original: "I didn't can to send it", code: 'VRB.CAN_TO', topics: [TOPIC], ts: '2026-10-26T11:00:00.000Z' },
    { original: 'I can to go', code: 'VRB.CAN_TO', topics: [TOPIC], ts: '2026-10-26T12:00:00.000Z' },
    { original: 'unrelated', code: 'VRB.CAN_TO', topics: ['gram.other.topic'], ts: '2026-10-26T13:00:00.000Z' },
  ] });
  assert.equal(badge(t), '2', 'dos errores distintos del tema; el repetido cuenta una vez y el de otro tema no cuenta');
  t.click(btn(t, 'Correcciones')); await t.flush(); await t.flush();
  assert.equal(t.env.doc.body.querySelectorAll('.corrections__item').length, 2, 'la hoja lista exactamente lo que dice la insignia');
  assert.match(body(t, '.corrections'), /Ha salido 2 veces/);
});

test('CA 2 · sin errores no hay insignia', async () => {
  const t = await full();
  assert.equal(badge(t), null);
});

test('CA 3 · «Llevar al chat» copia un bloque 8.14 válido con el tema, la respuesta en curso y los errores', async () => {
  const copied = [];
  const t = await full({ clipboard: { writeText: async (x) => { copied.push(x); } }, errorsToRecord: [{ original: 'I can to go', code: 'VRB.CAN_TO', correction: 'I can go', topics: [TOPIC], ts: '2026-10-26T12:00:00.000Z' }] });
  t.click(btn(t, 'Preguntas IA')); await t.flush();
  assert.match(body(t, '.ai'), /Conecta tu clave en Ajustes/);
  t.click(t.env.doc.body.querySelectorAll('.ai__bring')[0]); await t.flush(); await t.flush();
  assert.equal(copied.length, 1);
  assert.match(copied[0], /^=== SOPHIA-EN-SYNC v1 ===\ntipo: llevar_al_chat\ngenerado: /);
  assert.match(copied[0], /\n=== FIN ===$/);
  const back = parseChatBlock(copied[0]);
  assert.equal(back.ok, true);
  assert.equal(back.payload.tema, TOPIC);
  assert.deepEqual(back.payload.errores, [{ code: 'VRB.CAN_TO', original: 'I can to go', correction: 'I can go' }]);
  assert.match(body(t, '.ai'), /Copiado/);
});

test('CA 3 · si el portapapeles falla, el bloque queda a la vista seleccionado para copiarlo a mano y el fallo se anota', async () => {
  const t = await full({ clipboard: { writeText: async () => { throw new Error('denegado'); } } });
  t.click(btn(t, 'Preguntas IA')); await t.flush();
  const realError = console.error; const logged = []; console.error = (...a) => logged.push(a);
  try { t.click(t.env.doc.body.querySelectorAll('.ai__bring')[0]); await t.flush(); await t.flush(); } finally { console.error = realError; }
  const box = t.env.doc.body.querySelectorAll('.ai__block')[0];
  assert.ok(box, 'aparece el cuadro con el bloque');
  assert.equal(parseChatBlock(box.value).ok, true, 'lo que hay en el cuadro es un bloque válido');
  assert.equal(box._selected, true);
  assert.match(body(t, '.ai'), /No se pudo copiar solo/);
  assert.ok(logged.length >= 1, 'el motivo va al log');
  assert.ok(t.btn('Comprobar'));
});

test('CA 4 · el diccionario encuentra la palabra sin importar mayúsculas ni acentos y ofrece «Añadir» si no está', async () => {
  const t = await full();
  t.click(btn(t, 'Diccionario')); await t.flush(); await t.flush();
  const type = (v) => { const f = t.env.doc.body.querySelectorAll('.dictionary__field')[0]; f.value = v; f.dispatchEvent({ type: 'input' }); };
  for (const q of ['KNEE', 'Knee', ' knee ', 'RODILLA']) { type(q); assert.match(body(t, '.dictionary'), /rodilla/, q); }
  for (const q of ['cafe', 'CAFÉ', 'Cafe']) { type(q); assert.match(body(t, '.dictionary'), /small shop/, q); }
  type('Zebra');
  assert.match(body(t, '.dictionary'), /No encontré «Zebra»/);
  t.click(t.env.doc.body.querySelectorAll('.dictionary__add')[0]); await t.flush(); await t.flush();
  assert.equal((await t.db.get('words', 'zebra')).state, 'unknown');
  assert.ok(t.btn('Comprobar'));
});

test('el rato con cualquiera de las 4 hojas abiertas no cuenta en el tiempo de respuesta', async () => {
  const t = await full();
  t.clock.advance(1000);
  for (const label of ['Otros ejemplos', 'Correcciones', 'Preguntas IA', 'Diccionario']) {
    t.click(btn(t, label)); await t.flush(); await t.flush();
    t.clock.advance(20000);
    close(t); await t.flush();
  }
  t.clock.advance(500);
  t.click(t.btn('Comprobar')); await t.flush();
  assert.equal((await t.events())[0].ms, 1500);
});
