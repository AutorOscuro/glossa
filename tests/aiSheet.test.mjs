// @purpose: Pruebas de la hoja «Preguntas IA» (ui/aiSheet.js, 2.7-T3): estado sin IA, «Llevar al chat» que copia, fallback seleccionable si el portapapeles falla y fallos sin culpa.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv } from './_fakeDom.mjs';
import { createAiSheet, AI_TEXT } from '../ui/aiSheet.js';

const realDocument = globalThis.document;
afterEach(() => { globalThis.document = realDocument; });
const BLOCK = '=== SOPHIA-EN-SYNC v1 ===\ntipo: llevar_al_chat\ngenerado: 2026-10-31T12:00:00.000Z\n{}\n=== FIN ===';

function setup({ status = { available: false, reason: 'no_ai' }, prepare, clipboard, getAnswer } = {}) {
  const env = makeEnv(); globalThis.document = env.doc;
  const logs = []; const calls = [];
  const source = { status: () => status, prepare: prepare ?? (async (entry, opts) => { calls.push({ entry, opts }); return { ok: true, text: BLOCK }; }) };
  const s = createAiSheet({ doc: env.doc, source, getEntry: () => ({ itemId: 'it1' }), getAnswer, clipboard, log: (...a) => logs.push(a) });
  const q = (sel) => env.doc.body.querySelectorAll(sel);
  const bring = () => q('.ai__bring')[0];
  const click = (el) => el.dispatchEvent({ type: 'click', preventDefault() {} });
  return { env, s, logs, calls, q, bring, click, text: () => q('.ai')[0]?.textContent ?? '' };
}

test('sin IA: dice «Conecta tu clave en Ajustes» y ofrece «Llevar al chat»', async () => {
  for (const reason of ['no_ai', 'no_key']) {
    const t = setup({ status: { available: false, reason } });
    t.s.open();
    assert.match(t.text(), /Conecta tu clave en Ajustes/);
    assert.equal(t.bring().textContent, 'Llevar al chat');
  }
});

test('con IA conectada es honesto: las preguntas internas llegan después y el camino al chat sigue', () => {
  const t = setup({ status: { available: true, reason: null } });
  t.s.open();
  assert.match(t.text(), /llegan en una próxima versión/);
  assert.doesNotMatch(t.text(), /Conecta tu clave/);
  assert.ok(t.bring());
});

test('con IA no disponible por otro motivo (cupo, clave rechazada) no manda a conectar la clave', () => {
  const t = setup({ status: { available: false, reason: 'rate_limit' } });
  t.s.open();
  assert.match(t.text(), /no está disponible ahora mismo/);
  assert.doesNotMatch(t.text(), /Conecta tu clave/);
});

test('CA 3 · «Llevar al chat» copia el bloque al portapapeles y avisa', async () => {
  const copied = [];
  const t = setup({ clipboard: { writeText: async (x) => { copied.push(x); } }, getAnswer: () => 'live' });
  t.s.open();
  t.q('.ai__doubt')[0].value = '¿Por qué?';
  t.click(t.bring()); await t.env.flush(); await t.env.flush();
  assert.deepEqual(copied, [BLOCK]);
  assert.equal(t.calls[0].entry.itemId, 'it1');
  assert.deepEqual(t.calls[0].opts, { answer: 'live', message: '¿Por qué?' });
  assert.match(t.text(), /Copiado\. Pégalo en el chat/);
  assert.equal(t.q('.ai__block').length, 0);
});

test('CA 3 · si el portapapeles falla, muestra el bloque seleccionable y lo anota (nunca un error mudo)', async () => {
  const t = setup({ clipboard: { writeText: async () => { throw new Error('denegado'); } } });
  t.s.open();
  t.click(t.bring()); await t.env.flush(); await t.env.flush();
  const box = t.q('.ai__block')[0];
  assert.ok(box, 'aparece el cuadro con el bloque');
  assert.equal(box.value, BLOCK);
  assert.equal(box._selected, true);
  assert.equal(box.hasAttribute('readonly'), true);
  assert.match(t.text(), /No se pudo copiar solo/);
  assert.equal(t.logs.length, 1);
});

test('CA 3 · sin portapapeles del navegador también cae al cuadro seleccionable', async () => {
  for (const clipboard of [undefined, {}, { writeText: 'no' }]) {
    const t = setup({ clipboard });
    t.s.open();
    t.click(t.bring()); await t.env.flush(); await t.env.flush();
    assert.equal(t.q('.ai__block')[0]?.value, BLOCK);
  }
});

test('si no se puede armar el bloque: aviso sin culpa, motivo al log, ejercicio como estaba', async () => {
  const t = setup({ prepare: async () => ({ ok: false, error: { code: 'BAD_PAYLOAD', message: 'x' } }), clipboard: { writeText: async () => {} } });
  t.s.open();
  t.click(t.bring()); await t.env.flush(); await t.env.flush();
  assert.match(t.text(), /No pude preparar el bloque/);
  assert.match(t.text(), /Tu ejercicio sigue como lo dejaste/);
  assert.equal(t.logs.length, 1);
  const boom = setup({ prepare: async () => { throw new Error('roto'); } });
  boom.s.open();
  boom.click(boom.bring()); await boom.env.flush(); await boom.env.flush();
  assert.match(boom.text(), /No pude preparar el bloque/);
});

test('si getAnswer o status fallan, la hoja sigue funcionando', async () => {
  const t = setup({ getAnswer: () => { throw new Error('x'); }, clipboard: { writeText: async () => {} } });
  t.s.open();
  t.click(t.bring()); await t.env.flush(); await t.env.flush();
  assert.equal(t.calls[0].opts.answer, null);
  const env = makeEnv(); globalThis.document = env.doc;
  const s = createAiSheet({ doc: env.doc, source: { status: () => { throw new Error('x'); }, prepare: async () => ({ ok: true, text: BLOCK }) }, log: () => {} });
  s.open();
  assert.match(env.doc.body.querySelectorAll('.ai')[0].textContent, /Conecta tu clave/);
});

test('un segundo toque mientras prepara no duplica; cerrar antes de que llegue lo ignora; abrir repinta', async () => {
  let release; const gate = new Promise((r) => { release = r; });
  const copied = [];
  const t = setup({ prepare: async () => { await gate; return { ok: true, text: BLOCK }; }, clipboard: { writeText: async (x) => { copied.push(x); } } });
  t.s.open();
  const b = t.bring();
  t.click(b); t.click(b);
  t.s.close();
  release(); await t.env.flush(); await t.env.flush();
  assert.deepEqual(copied, [], 'la hoja se cerró: no se copia nada a escondidas');
  assert.equal(t.s.isOpen(), false);
  assert.equal(t.s.open(), true);
  assert.equal(t.q('.ai__block').length, 0);
});

test('el constructor pide una fuente válida y los textos no culpan', () => {
  assert.throws(() => createAiSheet({}), TypeError);
  assert.throws(() => createAiSheet({ source: { status() {} } }), TypeError);
  assert.equal(AI_TEXT.noKey, 'Conecta tu clave en Ajustes');
});
