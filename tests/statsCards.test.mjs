// @purpose: Pruebas de core/stats.js, tramo 2 (1.9-T2): tarjetas por nivel, pronóstico a 14 días, retención real vs. objetivo, mapa de calor y tendencias de dominio.
// Los resultados esperados están calculados a mano; las fechas del pronóstico se construyen en hora local para que pasen en cualquier zona horaria.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardsByLevel, forecastReviews, retentionReport, heatmap, masteryTrend } from '../core/stats.js';
import { makeEvent } from './_helpers.mjs';
import { MASTERY_CONFIG } from '../core/mastery.config.js';

const card = (id, over = {}) => ({ id, state: 2, stability: 5, due: '2026-10-25T12:00:00.000Z', suspended: false, leech: false, ...over });

test('cardsByLevel: cortes 1 / 4 / 21 / 90 días, sin contar nuevas ni suspendidas', () => {
  const cards = [
    card('a', { stability: 0.5 }), card('b', { stability: 0.99 }),               // nivel 1
    card('c', { stability: 1 }), card('d', { stability: 3.9 }),                   // nivel 2
    card('e', { stability: 4 }), card('f', { stability: 20.9 }),                  // nivel 3
    card('g', { stability: 21 }), card('h', { stability: 89.9 }),                 // nivel 4
    card('i', { stability: 90 }), card('j', { stability: 500 }),                  // nivel 5
    card('k', { state: 0, stability: 0 }),                                        // nueva: no cuenta
    card('l', { stability: 100, suspended: true, leech: true }),                  // suspendida: no cuenta
    null, 7,
  ];
  assert.deepEqual(cardsByLevel(cards), [{ level: 1, count: 2 }, { level: 2, count: 2 }, { level: 3, count: 2 }, { level: 4, count: 2 }, { level: 5, count: 2 }]);
  assert.deepEqual(cardsByLevel([card('a', { stability: 50 })]), [{ level: 1, count: 0 }, { level: 2, count: 0 }, { level: 3, count: 0 }, { level: 4, count: 1 }, { level: 5, count: 0 }]);
});

test('cardsByLevel: vacío o solo nuevas/suspendidas → []', () => {
  assert.deepEqual(cardsByLevel([]), []);
  assert.deepEqual(cardsByLevel([card('k', { state: 0 }), card('l', { suspended: true })]), []);
  assert.throws(() => cardsByLevel(null), /lista/);
});

const NOW = new Date(2026, 9, 25, 12, 0, 0); // 25-oct-2026 12:00 hora local
const local = (dayOffset, h, m = 0) => new Date(2026, 9, 25 + dayOffset, h, m, 0).toISOString();

test('forecastReviews: 14 días desde hoy; las vencidas caen hoy; fuera de ventana no cuenta', () => {
  const cards = [
    card('v1', { due: local(-3, 9) }), card('v2', { due: local(-1, 23, 59) }),   // vencidas → hoy
    card('h1', { due: local(0, 0, 5) }), card('h2', { due: local(0, 23, 30) }),  // hoy (límites del día)
    card('m1', { due: local(1, 0, 10) }),                                        // mañana
    card('u13', { due: local(13, 18) }),                                         // último día (índice 13)
    card('u14', { due: local(14, 1) }),                                          // fuera
    card('n', { state: 0, due: local(0, 10) }), card('s', { suspended: true, due: local(0, 10) }), // no cuentan
    card('x', { due: 'no es fecha' }),                                           // ilegible: se ignora
  ];
  const f = forecastReviews(cards, NOW);
  assert.equal(f.length, 14);
  assert.deepEqual(f[0], { day: '2026-10-25', count: 4, overdue: 2 });
  assert.deepEqual(f[1], { day: '2026-10-26', count: 1, overdue: 0 });
  assert.deepEqual(f[13], { day: '2026-11-07', count: 1, overdue: 0 });
  assert.equal(f.reduce((a, r) => a + r.count, 0), 6);
  assert.deepEqual(f.slice(2, 13).map((r) => r.count), new Array(11).fill(0));
  assert.deepEqual(forecastReviews(cards, NOW, { days: 3 }).map((r) => r.day), ['2026-10-25', '2026-10-26', '2026-10-27']);
});

test('forecastReviews: sin tarjetas contables → []; argumentos mal usados lanzan', () => {
  assert.deepEqual(forecastReviews([], NOW), []);
  assert.deepEqual(forecastReviews([card('n', { state: 0 })], NOW), []);
  assert.throws(() => forecastReviews(null, NOW), /lista/);
  assert.throws(() => forecastReviews([], 'ayer'), /fecha/);
  assert.throws(() => forecastReviews([], NOW, { days: 0 }), /days/);
  assert.throws(() => forecastReviews([], NOW, { days: 2.5 }), /days/);
  assert.throws(() => forecastReviews([], NOW, { days: 400 }), /days/);
});

const rev = (day, cardId, rating, extra = {}) => makeEvent({ day, ts: `${day}T12:00:00.${String(extra.n ?? 0).padStart(3, '0')}Z`, cardId, itemId: cardId.split('#')[0], rating, result: rating >= 2 ? 'correct' : 'wrong', ...extra });

test('retentionReport: el primer intento de cada tarjeta no es repaso; retenido = rating ≥ 2', () => {
  const evs = [
    rev('2026-10-23', 'i.b#0', 4, { n: 1 }), rev('2026-10-24', 'i.b#0', 3), // B: primer intento (aprender) y un repaso retenido
    rev('2026-10-22', 'i.a#0', 3), rev('2026-10-23', 'i.a#0', 1), rev('2026-10-24', 'i.a#0', 3, { n: 1 }), rev('2026-10-24', 'i.a#0', 4, { n: 2 }),
    makeEvent({ day: '2026-10-24', ts: '2026-10-24T13:00:00.000Z', cardId: 'i.c#0', itemId: 'i.c', result: 'skipped', rating: null }),
    makeEvent({ type: 'note', result: null, rating: null, responseRaw: 'x' }),
  ];
  // Repasos: A 10-23 (1 → no), A 10-24 (3 sí), A 10-24 (4 sí), B 10-24 (3 sí) → 4 repasos, 3 retenidos.
  const r = retentionReport(evs);
  assert.deepEqual(r, { target: 0.9, reviews: 4, retained: 3, actual: 0.75, series: [
    { day: '2026-10-23', reviews: 1, retained: 0, actual: 0 },
    { day: '2026-10-24', reviews: 3, retained: 3, actual: 1 },
  ] });
  // El rango se aplica después de decidir cuál es el primer intento.
  const r2 = retentionReport(evs, { from: '2026-10-24', to: '2026-10-24', target: 0.85 });
  assert.deepEqual([r2.target, r2.reviews, r2.retained, r2.actual], [0.85, 3, 3, 1]);
  assert.deepEqual(retentionReport(evs, { to: '2026-10-22' }), { target: 0.9, reviews: 0, retained: 0, actual: null, series: [] });
});

test('retentionReport: vacío → actual null; entradas inválidas', () => {
  assert.deepEqual(retentionReport([]), { target: 0.9, reviews: 0, retained: 0, actual: null, series: [] });
  assert.deepEqual(retentionReport([null, 4, {}, rev('2026-10-24', 'i.a#0', 3)]).reviews, 0); // un solo intento = aprender
  assert.throws(() => retentionReport(null), /lista/);
  assert.throws(() => retentionReport([], { target: 1 }), /target/);
  assert.throws(() => retentionReport([], { target: 0 }), /target/);
  assert.throws(() => retentionReport([], { target: '0.9' }), /target/);
  assert.throws(() => retentionReport([], { from: '2026-10-25', to: '2026-10-01' }), /posterior/);
});

const T = (id, area, level, min_items, extra = {}) => ({ id, area, level, min_items, status: 'active', ...extra });
const R = (topicId, pct, evidence, confidence) => ({ topicId, pct, evidence, confidence, band: 'x', signals: {}, caps: [] });

test('heatmap: área × nivel con la media ponderada por ítems', () => {
  const topics = [T('t1', 'gram', 'A1', 10), T('t2', 'gram', 'A1', 10), T('t3', 'gram', 'A2', 5), T('t4', 'prep', 'A1', 4), T('t5', 'gram', undefined, 3)];
  const results = [R('t1', 80, 5, 'mid'), R('t2', 40, 3, 'low'), R('t4', 100, 9, 'high')];
  const h = heatmap(topics, results);
  assert.deepEqual(h.areas, ['gram', 'prep']);
  assert.deepEqual(h.levels, ['A1', 'A2']);
  const pick = (c) => [c.area, c.level, c.topics, c.seen, c.weight, c.pct, c.band, c.confidence];
  assert.deepEqual(h.cells.map(pick), [
    ['gram', 'A1', 2, 2, 20, 60, 'solid', 'low'],     // (10·80 + 10·40) / 20 = 60; confianza (10·1 + 10·0)/20 = 0,5 → baja
    ['gram', 'A2', 1, 0, 5, 0, 'unseen', 'low'],
    ['prep', 'A1', 1, 1, 4, 100, 'mastered', 'high'],
  ]);
  assert.equal('key' in h.cells[0], false);
});

test('heatmap: vacío → estructuras vacías; entrada mal usada lanza', () => {
  assert.deepEqual(heatmap([], []), { areas: [], levels: [], cells: [] });
  assert.deepEqual(heatmap([T('t1', 'gram', 'A1', 1)], []).cells.map((c) => c.pct), [0]);
  assert.throws(() => heatmap(null, []), /lista/);
});

test('masteryTrend: serie por área, días en orden y la última foto del día gana', () => {
  const topics = [T('t1', 'gram', 'A1', 10), T('t4', 'prep', 'A1', 4)];
  const snaps = [
    { day: '2026-10-24', results: [R('t1', 10, 1, 'low')] },                                // sustituida por la siguiente del mismo día
    { day: '2026-10-24', results: [R('t1', 60, 3, 'mid'), R('t4', 100, 1, 'low')] },
    { day: '2026-10-22', results: [R('t1', 40, 2, 'low')] },
    null, { day: 'mal', results: [] }, { day: '2026-10-23', results: 'no' },
  ];
  assert.deepEqual(masteryTrend(snaps, topics), { by: 'area', days: ['2026-10-22', '2026-10-24'], series: [
    { key: 'gram', points: [{ day: '2026-10-22', pct: 40, seen: 1 }, { day: '2026-10-24', pct: 60, seen: 1 }] },
    { key: 'prep', points: [{ day: '2026-10-22', pct: 0, seen: 0 }, { day: '2026-10-24', pct: 100, seen: 1 }] },
  ] });
  assert.deepEqual(masteryTrend(snaps, topics, { by: 'level' }).series.map((s) => [s.key, s.points.map((p) => p.pct)]), [['A1', [29, 71]]]);
  // A1 el día 22: (10·40 + 4·0) / 14 = 28,57 → 29; el día 24: (10·60 + 4·100) / 14 = 71,43 → 71.
});

test('masteryTrend: sin fotos → vacío', () => {
  assert.deepEqual(masteryTrend([], [T('t1', 'gram', 'A1', 1)]), { by: 'area', days: [], series: [] });
  assert.deepEqual(masteryTrend([{ day: '2026-10-22', results: [] }], []), { by: 'area', days: ['2026-10-22'], series: [] });
  assert.throws(() => masteryTrend(null, []), /lista/);
  assert.throws(() => masteryTrend([], [], { by: 'x' }), /by/);
});

test('bordes de retentionReport, forecastReviews, heatmap y masteryTrend (cierran variantes vivas de las roturas)', () => {
  assert.equal(forecastReviews([card('a')], NOW, { days: 366 }).length, 366);
  assert.throws(() => forecastReviews([card('a')], NOW, { days: 367 }), /days/);

  const mk = (id, ts, cardId, rating, over = {}) => makeEvent({ id, ts, day: ts.slice(0, 10), cardId, itemId: cardId === null ? null : cardId.split('#')[0], rating, result: rating >= 2 ? 'correct' : 'wrong', ...over });
  const T0 = '2026-10-24T12:00:00.000Z';
  const evs = [
    // misma tarjeta y mismo ts: manda el id; 'aaaa' es el primer intento (aprender) y 'bbbb' (rating 2) el repaso, que cuenta como retenido
    mk('evt_20261024T1200_bbbb', T0, 'i.p#0', 2), mk('evt_20261024T1200_aaaa', T0, 'i.p#0', 1),
    // sin tarjeta (null o vacía): ningún intento se descarta como «primero»
    mk('evt_20261024T1200_cccc', T0, null, 3, { itemId: 'i.q' }), mk('evt_20261024T1200_dddd', T0, null, 1, { itemId: 'i.q' }),
    // un resultado `skipped` con rating no es intento; un rating decimal tampoco
    mk('evt_20261024T1200_eeee', T0, 'i.r#0', 3, { result: 'skipped' }), mk('evt_20261024T1201_eee2', '2026-10-24T12:01:00.000Z', 'i.r#0', 3, { result: 'skipped' }), mk('evt_20261024T1200_ffff', T0, 'i.s#0', 2.5), mk('evt_20261024T1201_gggg', '2026-10-24T12:01:00.000Z', 'i.s#0', 2.5),
    // otro tipo de evento con rating y cardId no cuenta
    mk('evt_20261024T1202_hhhh', '2026-10-24T12:02:00.000Z', 'i.t#0', 3, { type: 'note', responseRaw: 'x' }), mk('evt_20261024T1203_iiii', '2026-10-24T12:03:00.000Z', 'i.t#0', 3, { type: 'note', responseRaw: 'x' }),
  ];
  const r = retentionReport(evs);
  assert.deepEqual([r.reviews, r.retained], [3, 2]); // p (rating 2: retenido), q (3 y 1 sin tarjeta: uno retenido, uno no)
  // cardId vacío: dos intentos con '' también cuentan los dos
  const e2 = [mk('evt_20261024T1200_jjjj', T0, '', 3), mk('evt_20261024T1201_kkkk', '2026-10-24T12:01:00.000Z', '', 3)];
  assert.equal(retentionReport(e2).reviews, 2);
  // `day` no siempre sigue al `ts` (cambio de zona): la serie sale ordenada por día
  const back = [mk('evt_20261024T1200_llll', T0, 'i.u#0', 3, { day: '2026-10-24' }), mk('evt_20261024T1201_mmmm', '2026-10-24T12:01:00.000Z', 'i.u#0', 3, { day: '2026-10-25' }), mk('evt_20261024T1202_nnnn', '2026-10-24T12:02:00.000Z', 'i.u#0', 3, { day: '2026-10-23' })];
  assert.deepEqual(retentionReport(back).series.map((d) => d.day), ['2026-10-23', '2026-10-25']);

  // `config` llega al mapa de calor (orden de niveles personalizado) y los resultados pueden ser un Map
  const topics = [T('t1', 'gram', 'A1', 1), T('t2', 'gram', 'A2', 1)];
  assert.deepEqual(heatmap(topics, [], { config: { ...MASTERY_CONFIG, levels: ['A2', 'A1'] } }).levels, ['A2', 'A1']);
  assert.deepEqual(heatmap(topics, []).levels, ['A1', 'A2']);
  const withMap = masteryTrend([{ day: '2026-10-22', results: new Map([['t1', R('t1', 50, 2, 'low')]]) }], topics);
  assert.deepEqual(withMap.series[0].points, [{ day: '2026-10-22', pct: 25, seen: 1 }]); // (1·50 + 1·0) / 2 = 25
});
