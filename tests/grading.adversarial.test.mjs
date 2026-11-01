// @purpose: Pasada adversarial de la 1.5: intenta romper la calificación con textos raros, datos basura, volumen y reloj cambiado.
// Pasada 4 (adversarial) de la 1.5: intenta romper la calificación con textos raros, datos basura, volumen y reloj cambiado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradeAnswer, gradeManual } from '../core/gradeAnswer.js';
import { collectSamples, baselineFor, loadBaselines } from '../core/gradingBaseline.js';
import { rate } from '../core/grading.js';
import { createSrs } from '../core/srsEngine.js';
import { newCard } from '../core/srs.js';
import { createEvents } from '../core/events.js';
import { validateEvent, LIMITS } from '../core/eventSchema.js';
import { createMemoryDb } from '../core/db.memory.js';
import { makeClock, makeRng } from './_helpers.mjs';

const NOW = new Date('2026-10-20T15:00:00.000Z');
const D = 86400000;
const srs = createSrs();
const TYPE = 'fix_error';
const fresh = (id = 'g.pp.0001') => newCard(id, 0, NOW, ['gram.present_perfect.for_since']);
const grade = (answer, over = {}) => gradeAnswer({ answer, card: fresh(), srs, now: NOW, exerciseType: TYPE, baselineMs: 10000, ...over });

test('textos raros en la respuesta (ñ, acentos, emoji, comillas curvas, espacios, 1000 caracteres) no rompen el evento ni cambian el rating', () => {
  const texts = ['  Ñandú café — “ya” ’s  ', 'I have 😀 a dog 👨‍👩‍👧 ', 'x'.repeat(1000), ' ', '\t\n', 'İstanbul ǅ ß'];
  for (const responseRaw of texts) {
    const g = grade({ result: 'correct', ms: 8000, responseRaw });
    assert.equal(g.rating, 3);
    assert.equal(validateEvent(g.event).ok, true, responseRaw.slice(0, 10));
    assert.equal(g.event.responseRaw === null || typeof g.event.responseRaw === 'string', true);
  }
  // por encima del límite del evento: no lanza ni pierde la calificación (el esquema lo recorta o lo avisa, pero la respuesta sale)
  const long = 'y'.repeat(LIMITS.responseRaw + 500);
  let g; try { g = grade({ result: 'correct', ms: 8000, responseRaw: long }); } catch (e) { assert.match(e.message, /responseRaw|largo|evento/i, 'el error debe ser claro'); }
  if (g) assert.ok(g.event.responseRaw.length <= LIMITS.responseRaw);
});

test('ids con emoji y de 1000 caracteres: la tarjeta y el evento salen coherentes o el error es claro', () => {
  for (const itemId of ['g.😀.0001', 'ñandú.café.0001', 'i'.repeat(1000)]) {
    let g; try { g = grade({ result: 'correct', ms: 3000 }, { card: fresh(itemId) }); } catch (e) { assert.ok(e instanceof Error && e.message.length > 10, 'error en español y claro'); continue; }
    assert.equal(g.event.itemId, itemId); assert.equal(g.card.itemId, itemId); assert.equal(g.scheduled, true);
  }
});

test('el cargador de medianas ignora eventos basura sin lanzar y no los cuenta', () => {
  const good = (ms, i) => ({ type: 'answer', ts: new Date(NOW.getTime() + i * 1000).toISOString(), exerciseType: TYPE, result: 'correct', ms, hint: false, dontKnow: false });
  const trash = [null, undefined, 42, 'texto', [], {}, { type: 'answer' }, { type: 'answer', exerciseType: TYPE, result: 'correct', ms: 'rápido' },
    { ...good(NaN, 1) }, { ...good(Infinity, 2) }, { ...good(-5, 3) }, { ...good(0, 4) }, { ...good(LIMITS.msMax + 1, 5) }, { ...good(2000, 6), ts: 12345 }, { type: 'review', exerciseType: TYPE }];
  const events = [...trash, ...Array.from({ length: 8 }, (_, i) => good(2000 + i * 100, 10 + i))];
  const samples = collectSamples(events);
  assert.equal(samples.get(TYPE).length, 8);
  assert.deepEqual(baselineFor(TYPE, events), { ms: 2350, source: 'personal', samples: 8 });
  assert.throws(() => collectSamples(null), /lista de eventos/);
  assert.throws(() => collectSamples('x'), /lista de eventos/);
});

test('rendimiento: 50.000 eventos → mediana en < 200 ms; 5.000 calificaciones en < 200 ms', () => {
  const rng = makeRng(77);
  const events = Array.from({ length: 50000 }, (_, i) => ({
    type: 'answer', ts: new Date(NOW.getTime() + i * 1000).toISOString(), exerciseType: ['fix_error', 'mcq_en_es', 'translate_es_en'][i % 3],
    result: 'correct', ms: rng.int(1000, 9999), hint: false, dontKnow: false,
  }));
  let t = performance.now(); const b = baselineFor(TYPE, events); const dt1 = performance.now() - t;
  assert.equal(b.source, 'personal'); assert.ok(dt1 < 200, `mediana tardó ${dt1.toFixed(0)} ms`);
  t = performance.now();
  for (let i = 0; i < 5000; i += 1) rate({ result: 'correct', ms: 1000 + (i % 9000), hint: i % 7 === 0 }, b.ms);
  const dt2 = performance.now() - t; assert.ok(dt2 < 200, `5.000 rate tardaron ${dt2.toFixed(0)} ms`);
});

test('base de datos con 5.000 respuestas: loadBaselines sigue siendo ágil y correcto', async () => {
  const clock = makeClock('2026-10-20T10:00:00.000Z'); const db = createMemoryDb(); await db.open();
  const events = createEvents({ db, clock, rng: makeRng(4) });
  for (let i = 0; i < 5000; i += 1) {
    await events.log({ type: 'answer', itemId: `g.${i % 50}`, cardId: `g.${i % 50}#0`, topics: ['gram.x'], exerciseType: TYPE, result: 'correct', rating: 3, ms: 3000 + (i % 5) * 100, mode: 'mech', channel: 'keyboard' });
    clock.advance(1000);
  }
  const t = performance.now(); const b = await loadBaselines({ events, now: clock.now() }); const dt = performance.now() - t;
  assert.equal(b.forType(TYPE).source, 'personal'); assert.equal(b.forType(TYPE).samples, 30);
  assert.ok(dt < 500, `loadBaselines tardó ${dt.toFixed(0)} ms (límite de referencia 500 ms en memoria)`);
});

test('reloj del dispositivo cambiado (fechas futuras y pasadas): no corrompe la tarjeta ni lanza', () => {
  for (const now of [new Date(NOW.getTime() - 400 * D), new Date(NOW.getTime() + 4000 * D), new Date('2000-01-01T00:00:00Z')]) {
    const g = gradeAnswer({ answer: { result: 'correct', ms: 3000 }, card: fresh(), srs, now, exerciseType: TYPE, baselineMs: 10000 });
    assert.equal(g.scheduled, true); assert.equal(g.event.ts, now.toISOString());
    assert.ok(g.card.due instanceof Date ? Number.isFinite(g.card.due.getTime()) : Number.isFinite(Date.parse(g.card.due)), 'fecha de repaso válida');
  }
  assert.throws(() => gradeAnswer({ answer: { result: 'correct', ms: 1 }, card: fresh(), srs, now: 'ayer', exerciseType: TYPE, baselineMs: 10000 }), /now|fecha/i);
});

test('doble toque / doble envío: calificar dos veces lo mismo da lo mismo y no toca la tarjeta de entrada', () => {
  const card = Object.freeze(fresh());
  const args = { answer: { result: 'correct', ms: 4000 }, card, srs, now: NOW, exerciseType: TYPE, baselineMs: 10000 };
  const a = gradeAnswer(args); const b = gradeAnswer(args);
  assert.equal(a.rating, b.rating); assert.deepEqual(a.card, b.card); assert.deepEqual(a.event, b.event);
  const m1 = gradeManual({ rating: 3, card, srs, now: NOW, exerciseType: TYPE }); const m2 = gradeManual({ rating: 3, card, srs, now: NOW, exerciseType: TYPE });
  assert.deepEqual(m1.card, m2.card); assert.equal(card.reps, 0, 'la tarjeta original no cambió');
});

test('entradas inválidas por función pública: error claro en español, nunca un TypeError críptico', () => {
  const bad = [undefined, null, 7, 'a', [], {}];
  for (const answer of bad) assert.throws(() => grade(answer), (e) => e instanceof Error && !(e instanceof TypeError && /undefined|null/.test(e.message)) );
  for (const rating of [0, 5, 2.5, '3', null, undefined, NaN]) assert.throws(() => gradeManual({ rating, card: fresh(), srs, now: NOW, exerciseType: TYPE }), /rating/);
  assert.throws(() => gradeAnswer(), Error);
  assert.throws(() => gradeManual(), Error);
});
