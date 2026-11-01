// @purpose: Pruebas del bloque «Llevar al chat» del resumen (core/summaryChat.js y app/chatCopy.js, 2.8-T3 punto 2): qué se elige, formato 8.14 que se lee de vuelta, límites, entradas hostiles y copia con alternativa.
// 2.8-T3 punto 2. Funciones puras y un portapapeles falso; la conexión con el panel y la vista va en summaryPanel.test.mjs y sesionView.resumen.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSummaryChatBlock, summaryChatWorthy, SUMMARY_CHAT_TEXT } from '../core/summaryChat.js';
import { copyForChat } from '../app/chatCopy.js';
import { parseChatBlock } from '../core/syncChat.js';

const err = (id, over = {}) => ({ id, code: 'TNS.SINCE_FOR', original: 'since two years', correction: 'for two years', topics: ['t.a'], times: 1, priorCount: 0, ...over });
const base = (over = {}) => ({ empty: false, partial: false, answered: 5, counts: { correct: 3 }, accuracyPct: 60, mastery: { changes: [] }, errors: { fresh: [], recurrent: [], total: 0 }, failed: [], ...over });
const NOW = new Date('2026-10-31T12:00:00.000Z');
const read = (r) => { assert.equal(r.ok, true, JSON.stringify(r)); const p = parseChatBlock(r.text); assert.equal(p.ok, true, JSON.stringify(p)); return p; };

test('summaryChatWorthy: solo hay algo que llevar con errores, fallos o dominio que bajó', () => {
  assert.equal(summaryChatWorthy(base()), false);
  assert.equal(summaryChatWorthy(base({ empty: true, failed: [{}] })), false);
  assert.equal(summaryChatWorthy(base({ errors: { fresh: [err('e1')], recurrent: [] } })), true);
  assert.equal(summaryChatWorthy(base({ failed: [{ cardId: 'c1' }] })), true);
  assert.equal(summaryChatWorthy(base({ mastery: { changes: [{ topicId: 't.a', after: 40, direction: 'down' }] } })), true);
  assert.equal(summaryChatWorthy(base({ mastery: { changes: [{ topicId: 't.a', after: 80, direction: 'up' }] } })), false);
});

test('el bloque sale en el formato 8.14 y se lee de vuelta con tema, errores y dominio', () => {
  const s = base({ errors: { fresh: [err('e2', { code: 'ART.A_AN', original: 'a apple', correction: 'an apple', topics: ['t.b'] })], recurrent: [err('e1')] }, mastery: { changes: [{ topicId: 't.a', after: 55, band: 'progress', direction: 'down' }] } });
  const r = buildSummaryChatBlock(s, { topicName: (id) => `Tema ${id}`, now: NOW });
  const p = read(r);
  assert.equal(p.kind, 'llevar_al_chat');
  assert.equal(p.payload.tema, 'Tema t.a', 'el tema es el del error que vuelve');
  assert.deepEqual(p.payload.errores.map((e) => e.code), ['TNS.SINCE_FOR', 'ART.A_AN'], 'primero los que vuelven');
  assert.deepEqual(p.payload.dominio, { pct: 55, banda: 'progress' });
  assert.match(p.payload.item, /5 ejercicios, 3 aciertos \(60 %\)/);
  assert.equal(p.payload.mensaje, SUMMARY_CHAT_TEXT.msgErrors);
});

test('lleva como mucho 5 errores y recorta lo largo', () => {
  const many = Array.from({ length: 9 }, (_, i) => err(`e${i}`, { code: `C.${i}`, original: 'x'.repeat(900) }));
  const p = read(buildSummaryChatBlock(base({ errors: { fresh: many, recurrent: [] } }), { now: NOW }));
  assert.equal(p.payload.errores.length, 5);
  assert.ok(p.payload.errores.every((e) => e.original.length <= 500));
});

test('sin errores pero con fallos pide ayuda para repasar; con dominio que bajó, para ver qué repasar', () => {
  assert.equal(read(buildSummaryChatBlock(base({ failed: [{ cardId: 'c1' }] }), { now: NOW })).payload.mensaje, SUMMARY_CHAT_TEXT.msgFailed);
  const p = read(buildSummaryChatBlock(base({ mastery: { changes: [{ topicId: 't.z', after: 30, direction: 'down' }] } }), { now: NOW }));
  assert.equal(p.payload.mensaje, SUMMARY_CHAT_TEXT.msgMastery);
  assert.equal(p.payload.tema, 't.z');
  assert.deepEqual(p.payload.dominio, { pct: 30 });
});

test('en un resumen parcial lo dice y no habla de terminar', () => {
  const p = read(buildSummaryChatBlock(base({ partial: true, answered: 1, counts: { correct: 0 }, accuracyPct: 0, failed: [{ cardId: 'c1' }] }), { now: NOW }));
  assert.match(p.payload.item, /^Sesión a medias: 1 ejercicio, 0 aciertos/);
  assert.equal(p.payload.mensaje, SUMMARY_CHAT_TEXT.msgPartial);
});

test('sin nada que llevar devuelve un error claro en vez de un bloque vacío', () => {
  const r = buildSummaryChatBlock(base());
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'NOTHING_TO_SEND');
});

test('entradas hostiles no lanzan ni escriben undefined/NaN', () => {
  for (const bad of [null, undefined, 5, 'x', [], { errors: 3 }, { errors: { fresh: [null, 4, { code: 'A' }] }, failed: 'x' }, { mastery: { changes: [null, { direction: 'down', after: NaN }] }, failed: [1] }]) {
    const r = buildSummaryChatBlock(bad, { topicName: () => { throw new Error('boom'); } });
    if (r.ok) assert.doesNotMatch(r.text, /undefined|NaN/);
    else assert.equal(typeof r.error.message, 'string');
  }
  assert.equal(summaryChatWorthy(null), false);
});

test('un nombre de tema que falla se cambia por el id', () => {
  const p = read(buildSummaryChatBlock(base({ failed: [{}], errors: { fresh: [err('e1')], recurrent: [] } }), { topicName: () => { throw new Error('x'); }, now: NOW }));
  assert.equal(p.payload.tema, 't.a');
});

test('copyForChat: copia y avisa; sin portapapeles o si falla devuelve el texto para copiar a mano y anota el motivo', async () => {
  const copied = []; const logs = [];
  assert.deepEqual(await copyForChat('hola', { writeText: async (x) => { copied.push(x); } }, { log: (...a) => logs.push(a) }), { status: 'copied' });
  assert.deepEqual(copied, ['hola']);
  assert.deepEqual(await copyForChat('hola', undefined, { log: (...a) => logs.push(a) }), { status: 'manual', text: 'hola' });
  assert.deepEqual(await copyForChat('hola', { writeText: () => { throw new Error('denegado'); } }, { log: (...a) => logs.push(a) }), { status: 'manual', text: 'hola' });
  assert.deepEqual(await copyForChat('hola', { writeText: async () => { throw new Error('denegado'); } }, { log: () => { throw new Error('log roto'); } }), { status: 'manual', text: 'hola' });
  assert.equal(logs.length, 2);
});
