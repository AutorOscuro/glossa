// @purpose: Rendimiento y exactitud de core/stats.js con 50.000 eventos (1.9-T3, CA 3): cada consulta < 200 ms y la ruta «leer ventana de 14 días + estadísticas» también.
// Los datos son periódicos a propósito para que los resultados salgan de cuentas a mano; la retención se comprueba con una cuenta independiente a fuerza bruta.
// Se mide el MEJOR de varias pasadas (el ruido de otros procesos solo suma tiempo). Los tiempos medidos se escriben como diagnóstico de la prueba.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  activityByDay, accuracyByType, accuracyByTopic, accuracyByArea, avgTimeByType, retentionReport, plannedVsDone, xpSummary, cardsByLevel, forecastReviews,
} from '../core/stats.js';
import { createEvents } from '../core/events.js';
import { createMemoryDb } from '../core/db.memory.js';
import { buildEvent, createIdGenerator } from '../core/eventSchema.js';
import { makeClock, makeRng } from './_helpers.mjs';

const BUDGET_MS = 200;
const N = 50000;
const DAY_MS = 86400000;
const TYPES = ['fix_error', 'cloze_bank', 'mcq_en_es', 'fill_verb'];
const RESULTS = ['correct', 'correct', 'almost', 'wrong', 'skipped'];
const dayOf = (i) => new Date(Date.UTC(2026, 6, 1) + Math.floor(i / 400) * DAY_MS).toISOString().slice(0, 10); // 400 eventos por día → 125 días

function bigList() {
  const out = new Array(N);
  for (let i = 0; i < N; i += 1) {
    const result = RESULTS[i % 5];
    const day = dayOf(i);
    out[i] = {
      id: `evt_${i}`, ts: `${day}T${String(Math.floor((i % 400) / 20)).padStart(2, '0')}:${String(i % 20).padStart(2, '0')}:00.000Z`, day, type: 'answer',
      cardId: `c${i % 2000}#0`, itemId: `c${i % 2000}`, topics: [`t.${i % 40}`, 't.all'], exerciseType: TYPES[i % 4], result,
      rating: result === 'wrong' ? 1 : 3, ms: 1500,
    };
  }
  return out;
}
const TOPICS = Array.from({ length: 40 }, (_, i) => ({ id: `t.${i}`, area: i % 2 === 0 ? 'gram' : 'vocab' }));

function best(fn, rounds = 5) {
  let min = Infinity; let last;
  for (let i = 0; i < rounds; i += 1) { const t = performance.now(); last = fn(); min = Math.min(min, performance.now() - t); }
  return { ms: min, value: last };
}

test('CA 3: cada consulta con 50.000 eventos tarda < 200 ms y da el resultado exacto', (t) => {
  const events = bigList();
  const plans = Array.from({ length: 125 }, (_, d) => ({ day: dayOf(d * 400), minutes: 8 }));
  const timings = [];
  const run = (name, fn, check) => {
    const { ms, value } = best(fn);
    timings.push(`${name} ${ms.toFixed(1)} ms`);
    assert.ok(ms < BUDGET_MS, `${name}: ${ms.toFixed(1)} ms (límite ${BUDGET_MS})`);
    check(value);
  };
  // Por cada 5 eventos hay 4 intentos (1 `skipped`): 40.000 intentos, 20.000 correct, 10.000 almost, 10.000 wrong. 400 eventos/día → 320 intentos/día = 8 min (1 500 ms cada uno).
  run('activityByDay', () => activityByDay(events), (r) => {
    assert.equal(r.length, 125);
    assert.deepEqual(r[0], { day: '2026-07-01', minutes: 8, items: 320, ms: 480000 });
    assert.equal(r.reduce((a, d) => a + d.items, 0), 40000);
  });
  // Los 4 tipos reparten por igual: 10.000 intentos cada uno, 5.000 correct + 2.500 almost + 2.500 wrong → acierto 0,75.
  run('accuracyByType', () => accuracyByType(events), (r) => {
    assert.deepEqual(r.map((x) => [x.key, x.attempts, x.correct, x.almost, x.wrong, x.accuracy]).sort(), [...TYPES].sort().map((k) => [k, 10000, 5000, 2500, 2500, 0.75]));
  });
  run('accuracyByTopic', () => accuracyByTopic(events), (r) => {
    // Los temas 4, 9, 14… 39 (i % 40 con i % 5 = 4) solo salen en eventos `skipped`, que no son intentos: quedan 32 temas + 't.all'.
    assert.equal(r.length, 33);
    assert.equal(r.find((x) => x.key === 't.all').attempts, 40000); // todo intento lleva 't.all'
    assert.equal(r.reduce((a, x) => a + (x.key === 't.all' ? 0 : x.attempts), 0), 40000); // y uno de los 32 temas
  });
  run('accuracyByArea', () => accuracyByArea(events, TOPICS), (r) => {
    // Cada evento cuenta una vez por área: 't.all' no tiene área (unknown) y el tema par/impar da gram/vocab.
    assert.deepEqual(r.map((x) => [x.key, x.attempts]), [['gram', 20000], ['unknown', 40000], ['vocab', 20000]]);
  });
  run('avgTimeByType', () => avgTimeByType(events), (r) => assert.deepEqual(r.map((x) => [x.type, x.samples, x.avgMs]).sort(), [...TYPES].sort().map((k) => [k, 10000, 1500])));
  run('plannedVsDone', () => plannedVsDone(events, plans), (r) => {
    assert.equal(r.days.length, 125);
    assert.deepEqual(r.totals, { plannedDays: 125, plannedMinutes: 1000, doneMinutes: 1000, differenceMinutes: 0, unplannedMinutes: 0, plannedHours: 16.67, doneHours: 16.67 });
  });
  // XP: por cada 5 eventos 10 + 10 + 7 + 3 = 30 → 10.000 grupos = 300.000 XP; por día 80 grupos = 2.400. Rango más alto (12.000) y sin siguiente.
  run('xpSummary', () => xpSummary(events), (r) => {
    assert.equal(r.xp, 300000); assert.equal(r.attempts, 40000); assert.equal(r.byDay.length, 125); assert.deepEqual(r.byDay[0], { day: '2026-07-01', xp: 2400 });
    assert.equal(r.rank.id, 'forest'); assert.equal(r.next, null);
  });
  run('retentionReport', () => retentionReport(events), (r) => {
    // Cuenta independiente: el primer intento de cada tarjeta (por orden de `ts`, luego `id`) es aprender; los demás son repasos; retenido = rating ≥ 2.
    const seen = new Set(); let reviews = 0; let retained = 0;
    for (const e of events.filter((x) => x.result !== 'skipped').sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : a.id < b.id ? -1 : 1))) {
      if (!seen.has(e.cardId)) { seen.add(e.cardId); continue; }
      reviews += 1; if (e.rating >= 2) retained += 1;
    }
    assert.equal(r.reviews, reviews); assert.equal(r.retained, retained);
    assert.equal(r.series.reduce((a, d) => a + d.reviews, 0), reviews);
    assert.ok(r.reviews > 35000 && r.reviews < 40000);
  });
  t.diagnostic(`50.000 eventos (mejor de 5): ${timings.join(' · ')}`);
});

test('CA 3: 50.000 tarjetas → cardsByLevel y forecastReviews también < 200 ms', (t) => {
  const NOW = new Date(2026, 9, 25, 12);
  const cards = Array.from({ length: N }, (_, i) => ({ id: `c${i}`, state: 2, suspended: false, stability: [0.5, 2, 10, 50, 200][i % 5], due: new Date(2026, 9, 20 + (i % 30), 9).toISOString() }));
  const a = best(() => cardsByLevel(cards));
  const b = best(() => forecastReviews(cards, NOW));
  assert.deepEqual(a.value.map((r) => r.count), [10000, 10000, 10000, 10000, 10000]);
  assert.equal(b.value.length, 14);
  // días 20..24 de octubre ya vencidos (5 de 30 días × 1.666,67 tarjetas) caen en hoy; el 25 es hoy mismo.
  assert.equal(b.value[0].count, b.value[0].overdue + cards.filter((c, i) => i % 30 === 5).length);
  assert.ok(a.ms < BUDGET_MS && b.ms < BUDGET_MS, `cardsByLevel ${a.ms.toFixed(1)} ms, forecastReviews ${b.ms.toFixed(1)} ms`);
  t.diagnostic(`50.000 tarjetas (mejor de 5): cardsByLevel ${a.ms.toFixed(1)} ms · forecastReviews ${b.ms.toFixed(1)} ms`);
});

test('CA 3: base en memoria con 50.000 eventos → leer 14 días + todas las estadísticas < 200 ms; la lectura completa solo se documenta', async (t) => {
  const db = createMemoryDb(); await db.open();
  try {
    const events = createEvents({ db, clock: makeClock('2026-10-25T10:00:00.000Z'), rng: makeRng(7) });
    const idGen = createIdGenerator({ rng: makeRng(21) });
    const DAYS = 80; const per = 625; const rows = [];
    for (let d = 0; d < DAYS; d += 1) {
      for (let k = 0; k < per; k += 1) {
        const ts = new Date(2026, 7, 1 + d, 6 + (k % 16), (k * 7) % 60, k % 60, k % 1000).toISOString();
        const result = RESULTS[k % 5] === 'skipped' ? 'dont_know' : RESULTS[k % 5];
        rows.push(buildEvent({
          type: 'answer', ts, itemId: `g.i${k % 300}`, cardId: `g.i${k % 300}#0`, topics: [`t.${k % 40}`, 't.all'], exerciseType: TYPES[k % 4], result,
          rating: result === 'wrong' || result === 'dont_know' ? 1 : 3, ms: 1500, responseRaw: 'x', errorCodes: [], mode: 'mech', channel: 'keyboard',
        }, { now: new Date(ts), idGen }));
      }
    }
    for (let b = 0; b < rows.length; b += 5000) await db.tx(['events'], async (tx) => { for (const r of rows.slice(b, b + 5000)) await tx.put('events', r); });
    assert.equal(await db.count('events', {}), N);

    const screen = (list) => ({
      a: activityByDay(list), t: accuracyByType(list), tp: accuracyByTopic(list), ar: accuracyByArea(list, TOPICS), av: avgTimeByType(list),
      r: retentionReport(list), p: plannedVsDone(list, []), x: xpSummary(list),
    });
    const since14 = new Date(2026, 7, 1 + DAYS - 14);
    let min14 = Infinity; let shown;
    for (let i = 0; i < 3; i += 1) {
      const t0 = performance.now();
      const window = await events.since(since14);
      shown = screen(window);
      min14 = Math.min(min14, performance.now() - t0);
      assert.equal(window.length, 14 * per);
    }
    assert.equal(shown.a.reduce((n, d) => n + d.items, 0), 14 * per); // sin `skipped`: todos son intentos
    assert.equal(shown.a.length, 14);
    assert.ok(min14 < BUDGET_MS, `leer 14 días y calcular la pantalla: ${min14.toFixed(1)} ms (límite ${BUDGET_MS})`);

    const t1 = performance.now();
    const every = await events.since(new Date('2000-01-01T00:00:00.000Z'));
    const readAll = performance.now() - t1;
    const t2 = performance.now();
    screen(every);
    const statsAll = performance.now() - t2;
    assert.equal(every.length, N);
    t.diagnostic(`ventana de 14 días (${14 * per} eventos) leer + pantalla: ${min14.toFixed(1)} ms · historial completo (${N}): leer ${readAll.toFixed(0)} ms + pantalla entera ${statsAll.toFixed(0)} ms (no se exige: pregunta 1 de PROJECT_STATE)`);
  } finally { await db.close(); }
});
