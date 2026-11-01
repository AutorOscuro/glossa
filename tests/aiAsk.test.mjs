// @purpose: Pruebas del bloque «Llevar al chat» de Preguntas IA (2.7-T3): formato 8.14 exacto, límites, entradas hostiles y fuente con partes que fallan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAskBlock, answerText, ASK_DEFAULT_MESSAGE } from '../core/aiAsk.js';
import { parseChatBlock, LIMITS } from '../core/syncChat.js';
import { createAiHelpSource } from '../app/aiHelpSource.js';

const NOW = new Date('2026-10-31T12:00:00.000Z');
const FULL = {
  topic: 'present_perfect.for_since', item: 'I ___ here for two years.', answer: 'live',
  errors: [{ code: 'tense.pp', original: 'I live here for two years', correction: 'I have lived here for two years' }],
  mastery: { pct: 41.6, band: 'En camino' }, message: '¿Por qué no vale «live»?',
};

test('el bloque sigue el formato 8.14: marcas, tipo, fecha ISO y JSON', () => {
  const r = buildAskBlock(FULL, { now: NOW });
  assert.equal(r.ok, true);
  const lines = r.text.split('\n');
  assert.equal(lines[0], '=== SOPHIA-EN-SYNC v1 ===');
  assert.equal(lines[1], 'tipo: llevar_al_chat');
  assert.equal(lines[2], 'generado: 2026-10-31T12:00:00.000Z');
  assert.equal(lines.at(-1), '=== FIN ===');
  assert.deepEqual(JSON.parse(lines.slice(3, -1).join('\n')), {
    tema: 'present_perfect.for_since', item: 'I ___ here for two years.', respuesta: 'live',
    errores: [{ code: 'tense.pp', original: 'I live here for two years', correction: 'I have lived here for two years' }],
    dominio: { pct: 42, banda: 'En camino' }, mensaje: '¿Por qué no vale «live»?',
  });
});

test('lo que la app genera lo lee el lector de bloques (ida y vuelta)', () => {
  const r = buildAskBlock(FULL, { now: NOW });
  const back = parseChatBlock(r.text);
  assert.equal(back.ok, true);
  assert.equal(back.kind, 'llevar_al_chat');
  assert.deepEqual(back.payload, r.payload);
});

test('sin duda escrita se usa la frase por defecto; sin nada más, el bloque sale igual', () => {
  const r = buildAskBlock({}, { now: NOW });
  assert.equal(r.ok, true);
  assert.deepEqual(r.payload, { mensaje: ASK_DEFAULT_MESSAGE });
  assert.equal(buildAskBlock(undefined).ok, true);
  assert.equal(buildAskBlock(null).ok, true);
});

test('recorta a los límites y se queda con 10 errores válidos', () => {
  const errors = [{ code: '', original: 'x' }, null, 5, ...Array.from({ length: 30 }, (_, i) => ({ code: `c${i}`, original: 'o'.repeat(900) }))];
  const r = buildAskBlock({ item: 'a'.repeat(5000), message: 'm'.repeat(50000), errors, answer: 'r'.repeat(5000) }, { now: NOW });
  assert.equal(r.ok, true);
  assert.equal(r.payload.errores.length, LIMITS.maxShortErrors);
  assert.equal(r.payload.errores[0].code, 'c0');
  assert.equal(r.payload.errores[0].original.length, LIMITS.maxOriginal);
  assert.equal(r.payload.item.length, LIMITS.maxString);
  assert.equal(r.payload.mensaje.length, LIMITS.maxLong);
  assert.ok(r.payload.item.endsWith('…'));
});

test('dominio: se redondea, se acota y sin número válido se omite', () => {
  assert.deepEqual(buildAskBlock({ mastery: { pct: 140 } }).payload.dominio, { pct: 100 });
  assert.deepEqual(buildAskBlock({ mastery: { pct: -3, label: 'Inicio' } }).payload.dominio, { pct: 0, banda: 'Inicio' });
  for (const bad of [{ pct: NaN }, { pct: '50' }, 'x', null, { pct: Infinity }]) assert.equal(buildAskBlock({ mastery: bad }).payload.dominio, undefined);
});

test('answerText: texto, objeto con text/value o nada', () => {
  assert.equal(answerText('go'), 'go');
  assert.equal(answerText({ text: 'went' }), 'went');
  assert.equal(answerText({ value: 'gone' }), 'gone');
  for (const bad of [null, undefined, 3, ['a'], { x: 1 }, true]) assert.equal(answerText(bad), undefined);
  assert.equal(buildAskBlock({ answer: { x: 1 } }).payload.respuesta, undefined);
});

test('entradas hostiles: no lanza, no cuela claves y los controles se limpian', () => {
  const r = buildAskBlock({ topic: 'a\u0000b\u0007c', item: { toString() { throw new Error('boom'); } }, message: '__proto__', extra: 'x', errors: 'no' }, { now: NOW });
  assert.equal(r.ok, true);
  assert.equal(r.payload.tema, 'a b c');
  assert.equal(r.payload.item, undefined);
  assert.equal(Object.keys(r.payload).includes('extra'), false);
});

test('una fecha inválida no lanza: devuelve ok:false con motivo', () => {
  const r = buildAskBlock(FULL, { now: 'no es fecha' });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'BAD_DATE');
});

test('fuente: status según availability(); sin cliente o si falla, no hay IA', () => {
  assert.deepEqual(createAiHelpSource({ ai: { availability: () => ({ available: true, reason: null }) } }).status(), { available: true, reason: null });
  assert.deepEqual(createAiHelpSource({ ai: { availability: () => ({ available: false, reason: 'no_key' }) } }).status(), { available: false, reason: 'no_key' });
  assert.deepEqual(createAiHelpSource({}).status(), { available: false, reason: 'no_ai' });
  const logs = [];
  assert.deepEqual(createAiHelpSource({ ai: { availability: () => { throw new Error('x'); } }, log: (...a) => logs.push(a) }).status(), { available: false, reason: 'no_ai' });
  assert.equal(logs.length, 1);
});

test('fuente: reúne tema, ítem, errores y dominio; si una parte falla, el bloque sale sin ella y el motivo va al log', async () => {
  const logs = [];
  const entry = { itemId: 'it1', topic: 'present_perfect.for_since', topics: ['present_perfect.for_since'] };
  const src = createAiHelpSource({
    corrections: { forEntry: async (e) => { assert.equal(e, entry); return { corrections: [{ code: 'tense.pp', original: 'I live', correction: 'I have lived' }], count: 1 }; } },
    mastery: { compute: async (t) => { assert.equal(t, 'present_perfect.for_since'); return { pct: 60, label: 'Sólido' }; } },
    describeItem: async () => 'I ___ here.', clock: { now: () => NOW }, log: (...a) => logs.push(a),
  });
  const ok = await src.prepare(entry, { answer: 'live', message: 'hola' });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.payload, { tema: 'present_perfect.for_since', item: 'I ___ here.', respuesta: 'live', errores: [{ code: 'tense.pp', original: 'I live', correction: 'I have lived' }], dominio: { pct: 60, banda: 'Sólido' }, mensaje: 'hola' });
  assert.match(ok.text, /generado: 2026-10-31T12:00:00.000Z/);

  const broken = createAiHelpSource({
    corrections: { forEntry: async () => { throw new Error('sin errores'); } },
    mastery: { compute: async () => { throw new Error('sin dominio'); } },
    describeItem: () => { throw new Error('sin ítem'); }, log: (...a) => logs.push(a),
  });
  const r = await broken.prepare(entry, { answer: 'live' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.payload, { tema: 'present_perfect.for_since', respuesta: 'live', mensaje: ASK_DEFAULT_MESSAGE });
  assert.equal(logs.length, 3);
});

test('fuente: sin ítem del plan no lanza', async () => {
  const r = await createAiHelpSource({}).prepare(undefined, {});
  assert.equal(r.ok, true);
});
