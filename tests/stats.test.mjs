// @purpose: Pruebas de core/stats.js (1.9-T1): minutos e ítems por día, acierto por tipo, tema y área, tiempo medio por tipo; vacíos, rangos y entradas hostiles.
// Los resultados esperados están calculados a mano en la propia prueba (no con el código evaluado).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activityByDay, accuracyByType, accuracyByTopic, accuracyByArea, avgTimeByType } from '../core/stats.js';
import { createEvents } from '../core/events.js';
import { createMemoryDb } from '../core/db.memory.js';
import { makeClock, makeEvent } from './_helpers.mjs';

const ev = (day, exerciseType, result, ms, topics = ['gram.a']) => makeEvent({ day, exerciseType, result, ms, topics, ts: `${day}T12:00:00.000Z` });

// Datos conocidos. Día 10-20: 3 intentos (60 000 + 30 000 + 15 000 ms = 105 000 → 1,75 min) y un `skipped` que no cuenta.
// Día 10-22: 2 intentos (90 000 + sin ms → 1,5 min). Día 10-24: 1 intento (1 500 ms → 0,03 min).
const DATA = [
  ev('2026-10-22', 'fix_error', 'correct', 90000, ['gram.b']),
  ev('2026-10-20', 'fix_error', 'correct', 60000, ['gram.a']),
  ev('2026-10-20', 'fix_error', 'almost', 30000, ['gram.a', 'gram.b']),
  ev('2026-10-20', 'mcq_en_es', 'wrong', 15000, ['prep.c']),
  ev('2026-10-20', 'mcq_en_es', 'skipped', 99999, ['prep.c']),
  ev('2026-10-22', 'mcq_en_es', 'dont_know', null, ['prep.c']),
  ev('2026-10-24', 'fix_error', 'correct', 1500, ['gram.a']),
  makeEvent({ type: 'session_start', day: '2026-10-20', result: null, exerciseType: null, ms: 600000, topics: [] }),
];
const AREAS = [{ id: 'gram.a', area: 'gram' }, { id: 'gram.b', area: 'gram' }, { id: 'prep.c', area: 'prep' }];

test('activityByDay: minutos e ítems por día, en orden y sin días vacíos', () => {
  assert.deepEqual(activityByDay(DATA), [
    { day: '2026-10-20', minutes: 1.75, items: 3, ms: 105000 },
    { day: '2026-10-22', minutes: 1.5, items: 2, ms: 90000 },
    { day: '2026-10-24', minutes: 0.03, items: 1, ms: 1500 },
  ]);
});

test('activityByDay: el rango es inclusivo en los dos extremos', () => {
  assert.deepEqual(activityByDay(DATA, { from: '2026-10-22', to: '2026-10-24' }).map((d) => d.day), ['2026-10-22', '2026-10-24']);
  assert.deepEqual(activityByDay(DATA, { to: '2026-10-20' }).map((d) => d.day), ['2026-10-20']);
  assert.deepEqual(activityByDay(DATA, { from: '2026-10-24' }).map((d) => d.day), ['2026-10-24']);
  assert.deepEqual(activityByDay(DATA, { from: '2026-10-22', to: '2026-10-22' }).map((d) => d.items), [2]);
});

test('accuracyByType: conteos y acierto (almost cuenta como acierto, skipped no es intento)', () => {
  assert.deepEqual(accuracyByType(DATA), [
    { key: 'fix_error', attempts: 4, correct: 3, almost: 1, wrong: 0, dontKnow: 0, accuracy: 1 },
    { key: 'mcq_en_es', attempts: 2, correct: 0, almost: 0, wrong: 1, dontKnow: 1, accuracy: 0 },
  ]);
});

test('accuracyByTopic: un evento con varios temas cuenta en cada uno', () => {
  assert.deepEqual(accuracyByTopic(DATA), [
    { key: 'gram.a', attempts: 3, correct: 2, almost: 1, wrong: 0, dontKnow: 0, accuracy: 1 },
    { key: 'gram.b', attempts: 2, correct: 1, almost: 1, wrong: 0, dontKnow: 0, accuracy: 1 },
    { key: 'prep.c', attempts: 2, correct: 0, almost: 0, wrong: 1, dontKnow: 1, accuracy: 0 },
  ]);
});

test('accuracyByArea: agrupa por el área del tema y cuenta una vez por área', () => {
  // gram: 4 intentos (el de dos temas gram cuenta UNA vez): 3 correct + 1 almost → 4 de 4. prep: 2 intentos (1 wrong, 1 dont_know).
  assert.deepEqual(accuracyByArea(DATA, AREAS), [
    { key: 'gram', attempts: 4, correct: 3, almost: 1, wrong: 0, dontKnow: 0, accuracy: 1 },
    { key: 'prep', attempts: 2, correct: 0, almost: 0, wrong: 1, dontKnow: 1, accuracy: 0 },
  ]);
});

test('accuracyByArea: tema sin área conocida → unknown; área con mezcla da fracción', () => {
  const evs = [ev('2026-10-20', 'fix_error', 'correct', 1000, ['x.y']), ev('2026-10-20', 'fix_error', 'wrong', 1000, ['gram.a']), ev('2026-10-20', 'fix_error', 'correct', 1000, ['gram.a'])];
  assert.deepEqual(accuracyByArea(evs, AREAS), [
    { key: 'gram', attempts: 2, correct: 1, almost: 0, wrong: 1, dontKnow: 0, accuracy: 0.5 },
    { key: 'unknown', attempts: 1, correct: 1, almost: 0, wrong: 0, dontKnow: 0, accuracy: 1 },
  ]);
});

test('avgTimeByType: media redondeada, solo intentos con ms válido', () => {
  // fix_error: 90 000, 60 000, 30 000, 1 500 → 181 500 / 4 = 45 375. mcq_en_es: 15 000 (el `skipped` y el de ms nulo no entran).
  assert.deepEqual(avgTimeByType(DATA), [
    { type: 'fix_error', samples: 4, avgMs: 45375 },
    { type: 'mcq_en_es', samples: 1, avgMs: 15000 },
  ]);
  assert.deepEqual(avgTimeByType(DATA, { from: '2026-10-22', to: '2026-10-22' }), [{ type: 'fix_error', samples: 1, avgMs: 90000 }]);
});

test('vacíos: sin eventos, rango sin datos o sin intentos devuelven [] y no lanzan', () => {
  for (const f of [activityByDay, accuracyByType, accuracyByTopic, avgTimeByType]) {
    assert.deepEqual(f([]), []);
    assert.deepEqual(f(DATA, { from: '2030-01-01', to: '2030-01-31' }), []);
    assert.deepEqual(f([makeEvent({ type: 'note', result: null, responseRaw: 'x' })]), []);
  }
  assert.deepEqual(accuracyByArea([], AREAS), []);
  assert.deepEqual(accuracyByArea(DATA, [], { from: '2030-01-01' }), []);
  assert.deepEqual(accuracyByArea(DATA, AREAS, { from: '2030-01-01' }), []);
});

test('entradas ilegibles: se ignoran los elementos rotos; los argumentos mal usados lanzan Error en español', () => {
  const dirty = [null, 5, 'x', [], {}, { type: 'answer' }, { type: 'answer', result: 'correct', day: '2026-13-40' }, ev('2026-10-20', 'fix_error', 'correct', Number.NaN), ev('2026-10-20', 'fix_error', 'correct', -5), ev('2026-10-20', 'fix_error', 'correct', 1000)];
  assert.deepEqual(activityByDay(dirty), [{ day: '2026-10-20', minutes: 0.02, items: 3, ms: 1000 }]);
  assert.deepEqual(avgTimeByType(dirty), [{ type: 'fix_error', samples: 1, avgMs: 1000 }]);
  assert.throws(() => activityByDay(null), /lista/);
  assert.throws(() => accuracyByType('x'), /lista/);
  assert.throws(() => accuracyByArea(DATA, null), /lista/);
  assert.throws(() => activityByDay(DATA, { from: '2026-10-25', to: '2026-10-20' }), /posterior/);
  assert.throws(() => activityByDay(DATA, { from: '2026-02-30' }), /día real/);
  assert.throws(() => activityByDay(DATA, { to: 5 }), /día real/);
  assert.throws(() => activityByDay(DATA, { desde: '2026-10-20' }), /desconocido/);
  assert.throws(() => activityByDay(DATA, []), /objeto/);
});

test('bordes de ms, tipo, temas y área (cierran las variantes vivas de la tanda de roturas)', () => {
  // ms: -1, Infinity y texto no son tiempos válidos (el intento cuenta, el tiempo no); 0 sí lo es.
  const msEvs = [ev('2026-10-20', 'a_t', 'correct', -1), ev('2026-10-20', 'a_t', 'correct', Infinity), ev('2026-10-20', 'a_t', 'correct', '5000'), ev('2026-10-20', 'a_t', 'correct', 0)];
  assert.deepEqual(activityByDay(msEvs), [{ day: '2026-10-20', minutes: 0, items: 4, ms: 0 }]);
  assert.deepEqual(avgTimeByType(msEvs), [{ type: 'a_t', samples: 1, avgMs: 0 }]);
  // tipo ausente o vacío: el intento cuenta por día, pero no tiene fila por tipo ni tiempo por tipo.
  const noType = [ev('2026-10-20', null, 'correct', 1000), ev('2026-10-20', '', 'wrong', 2000), ev('2026-10-20', 'b_t', 'correct', 3000)];
  assert.deepEqual(accuracyByType(noType).map((r) => r.key), ['b_t']);
  assert.deepEqual(avgTimeByType(noType), [{ type: 'b_t', samples: 1, avgMs: 3000 }]);
  assert.equal(activityByDay(noType)[0].items, 3);
  // media con decimales: 1000 y 1001 → 1000,5 → se redondea a 1001 (no se trunca).
  assert.deepEqual(avgTimeByType([ev('2026-10-20', 'c_t', 'correct', 1000), ev('2026-10-20', 'c_t', 'correct', 1001)]), [{ type: 'c_t', samples: 2, avgMs: 1001 }]);
  // temas repetidos, vacíos o que no son texto: un tema cuenta una vez por evento y lo ilegible se descarta.
  const odd = [ev('2026-10-20', 'a_t', 'correct', 1000, ['gram.a', 'gram.a', '', 5, null])];
  assert.deepEqual(accuracyByTopic(odd).map((r) => [r.key, r.attempts]), [['gram.a', 1]]);
  assert.deepEqual(accuracyByArea(odd, AREAS).map((r) => [r.key, r.attempts]), [['gram', 1]]);
  // área: si un tema aparece dos veces en la lista, vale la primera; un área vacía o ilegible es unknown.
  const dup = [{ id: 'gram.a', area: 'gram' }, { id: 'gram.a', area: 'prep' }, { id: 'v.v', area: '' }, { id: 'w.w', area: 7 }, null, 4];
  const evs = [ev('2026-10-20', 'a_t', 'correct', 1000, ['gram.a']), ev('2026-10-20', 'a_t', 'correct', 1000, ['v.v']), ev('2026-10-20', 'a_t', 'correct', 1000, ['w.w'])];
  assert.deepEqual(accuracyByArea(evs, dup).map((r) => [r.key, r.attempts]), [['gram', 1], ['unknown', 2]]);
  // un rango null equivale a «sin rango»
  assert.deepEqual(activityByDay(DATA, null), activityByDay(DATA));
});

test('no modifica los eventos de entrada y devuelve estructuras nuevas', () => {
  const copy = structuredClone(DATA);
  const a = activityByDay(DATA); a[0].items = 999;
  accuracyByType(DATA); accuracyByTopic(DATA); accuracyByArea(DATA, AREAS); avgTimeByType(DATA);
  assert.deepEqual(DATA, copy);
  assert.equal(activityByDay(DATA)[0].items, 3);
});

test('integración: con eventos reales guardados en la base en memoria', async () => {
  const db = createMemoryDb(); await db.open();
  const clock = makeClock('2026-10-25T10:00:00.000Z');
  const events = createEvents({ db, clock });
  const base = { sessionId: 'ses_a', mode: 'mech', channel: 'keyboard', hint: false };
  await events.log({ ...base, type: 'answer', itemId: 'i.one', cardId: 'i.one#0', topics: ['gram.a'], exerciseType: 'fix_error', result: 'correct', rating: 3, ms: 12000 });
  clock.advance(1000);
  await events.log({ ...base, type: 'answer', itemId: 'i.two', cardId: 'i.two#0', topics: ['prep.c'], exerciseType: 'mcq_en_es', result: 'wrong', rating: 1, ms: 6000 });
  const all = await events.since(new Date('2000-01-01T00:00:00.000Z'));
  const day = all[0].day;
  assert.deepEqual(activityByDay(all), [{ day, minutes: 0.3, items: 2, ms: 18000 }]);
  assert.deepEqual(accuracyByArea(all, AREAS).map((r) => [r.key, r.accuracy]), [['gram', 1], ['prep', 0]]);
  assert.deepEqual(avgTimeByType(all).map((r) => [r.type, r.avgMs]), [['fix_error', 12000], ['mcq_en_es', 6000]]);
});
