// @purpose: Pruebas de core/stats.js y core/stats.config.js, tramo 3 (1.9-T3): horas planeadas vs. hechas y XP/rango opcionales, sin penalizaciones.
// Los resultados esperados están calculados a mano en la propia prueba (no con el código evaluado).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plannedVsDone, xpSummary, activityByDay, retentionReport } from '../core/stats.js';
import { STATS_CONFIG } from '../core/stats.config.js';
import { createEvents } from '../core/events.js';
import { createMemoryDb } from '../core/db.memory.js';
import { makeClock, makeEvent, makeRng } from './_helpers.mjs';

const ev = (day, result, ms, over = {}) => makeEvent({ day, result, ms, ts: `${day}T12:00:00.000Z`, ...over });

// ---------- plannedVsDone ----------
// 10-20: 3 intentos (60 000 + 120 000 + 30 000 = 210 000 ms = 3,5 min); plan 5.  → diferencia −1,5
// 10-21: 1 intento de 600 000 ms = 10 min; plan 10.                              → 0
// 10-22: 2 intentos de 90 000 ms = 3 min; SIN plan.                              → planeado null
// 10-23: sin actividad; plan 20.                                                 → −20
// 10-24: 1 intento de 2 610 000 ms = 43,5 min; plan 15 y luego 30 (vale 30).     → +13,5
const EVENTS = [
  ev('2026-10-20', 'correct', 60000), ev('2026-10-20', 'wrong', 120000), ev('2026-10-20', 'almost', 30000),
  ev('2026-10-20', 'skipped', 999999), makeEvent({ type: 'session_start', day: '2026-10-20', result: null, ms: 999999 }),
  ev('2026-10-21', 'correct', 600000),
  ev('2026-10-22', 'correct', 90000), ev('2026-10-22', 'dont_know', 90000),
  ev('2026-10-24', 'correct', 2610000),
];
const PLANS = [
  { day: '2026-10-24', minutes: 15 }, { day: '2026-10-20', minutes: 5 }, { day: '2026-10-21', minutes: 10 },
  { day: '2026-10-23', minutes: 20 }, { day: '2026-10-24', minutes: 30 },
];

test('plannedVsDone: datos conocidos, plan sustituido, día sin plan y día sin actividad', () => {
  const r = plannedVsDone(EVENTS, PLANS);
  assert.deepEqual(r.days, [
    { day: '2026-10-20', plannedMinutes: 5, doneMinutes: 3.5, differenceMinutes: -1.5 },
    { day: '2026-10-21', plannedMinutes: 10, doneMinutes: 10, differenceMinutes: 0 },
    { day: '2026-10-22', plannedMinutes: null, doneMinutes: 3, differenceMinutes: null },
    { day: '2026-10-23', plannedMinutes: 20, doneMinutes: 0, differenceMinutes: -20 },
    { day: '2026-10-24', plannedMinutes: 30, doneMinutes: 43.5, differenceMinutes: 13.5 },
  ]);
  // Planeado 5 + 10 + 20 + 30 = 65 min (1,08 h). Hecho en días con plan: 3,5 + 10 + 0 + 43,5 = 57 min (0,95 h). Diferencia 57 − 65 = −8. Sin plan: 3.
  assert.deepEqual(r.totals, { plannedDays: 4, plannedMinutes: 65, doneMinutes: 57, differenceMinutes: -8, unplannedMinutes: 3, plannedHours: 1.08, doneHours: 0.95 });
});

test('plannedVsDone: el rango recorta planes y actividad; vacío → estructura vacía', () => {
  const r = plannedVsDone(EVENTS, PLANS, { from: '2026-10-21', to: '2026-10-23' });
  assert.deepEqual(r.days.map((d) => d.day), ['2026-10-21', '2026-10-22', '2026-10-23']);
  assert.deepEqual(r.totals, { plannedDays: 2, plannedMinutes: 30, doneMinutes: 10, differenceMinutes: -20, unplannedMinutes: 3, plannedHours: 0.5, doneHours: 0.17 });
  const zero = { plannedDays: 0, plannedMinutes: 0, doneMinutes: 0, differenceMinutes: 0, unplannedMinutes: 0, plannedHours: 0, doneHours: 0 };
  assert.deepEqual(plannedVsDone([], []), { days: [], totals: zero });
  assert.deepEqual(plannedVsDone(EVENTS, PLANS, { from: '2030-01-01' }), { days: [], totals: zero });
  // solo plan, sin eventos: el día aparece con 0 hecho (no se inventa actividad)
  assert.deepEqual(plannedVsDone([], [{ day: '2026-10-23', minutes: 0 }]).days, [{ day: '2026-10-23', plannedMinutes: 0, doneMinutes: 0, differenceMinutes: 0 }]);
});

test('plannedVsDone: planes ilegibles se ignoran; usos incorrectos lanzan en español', () => {
  const junk = [null, 7, 'x', { day: '2026-10-21' }, { day: '2026-10-21', minutes: -1 }, { day: '2026-10-21', minutes: '10' }, { day: '2026-10-21', minutes: NaN },
    { day: '2026-10-21', minutes: Infinity }, { day: '2026-02-30', minutes: 10 }, { day: 'ayer', minutes: 10 }, { minutes: 10 }];
  assert.deepEqual(plannedVsDone(EVENTS, junk).days.map((d) => d.plannedMinutes), [null, null, null, null]);
  // un plan ilegible posterior NO borra el bueno anterior
  assert.equal(plannedVsDone([], [{ day: '2026-10-21', minutes: 10 }, { day: '2026-10-21', minutes: -5 }]).days[0].plannedMinutes, 10);
  assert.throws(() => plannedVsDone(EVENTS, null), /planes/);
  assert.throws(() => plannedVsDone(EVENTS, {}), /planes/);
  assert.throws(() => plannedVsDone(null, []), /lista/);
  assert.throws(() => plannedVsDone(EVENTS, [], { from: '2026-10-25', to: '2026-10-20' }), /posterior/);
  assert.throws(() => plannedVsDone(EVENTS, [], { desde: '2026-10-20' }), /desconocido/);
});

test('plannedVsDone: lo hecho coincide con activityByDay y no se modifican las entradas', () => {
  const evCopy = structuredClone(EVENTS); const plCopy = structuredClone(PLANS);
  const r = plannedVsDone(EVENTS, PLANS);
  assert.deepEqual(r.days.map((d) => [d.day, d.doneMinutes]), activityByDay(EVENTS).concat([{ day: '2026-10-23', minutes: 0 }]).sort((a, b) => (a.day < b.day ? -1 : 1)).map((d) => [d.day, d.minutes]));
  assert.deepEqual(EVENTS, evCopy); assert.deepEqual(PLANS, plCopy);
  r.days[0].doneMinutes = 99; r.totals.plannedMinutes = 99;
  assert.equal(plannedVsDone(EVENTS, PLANS).days[0].doneMinutes, 3.5);
});

test('plannedVsDone: nada habla de deuda ni de atraso (solo informativo)', () => {
  const r = plannedVsDone(EVENTS, PLANS);
  const names = new Set([...Object.keys(r), ...Object.keys(r.totals), ...r.days.flatMap((d) => Object.keys(d))]);
  for (const bad of ['debt', 'deuda', 'late', 'behind', 'atraso', 'missed', 'streak', 'racha', 'penalty', 'overdue']) assert.ok(![...names].some((n) => n.toLowerCase().includes(bad)), bad);
});

// ---------- xpSummary ----------
test('xpSummary: XP por resultado con valores del archivo de configuración, calculado a mano', () => {
  // 3 correct (30) + 2 almost (14) + 1 wrong (3) + 2 dont_know (6) = 53 XP; 4 `skipped` no dan nada. 8 intentos.
  const day1 = [ev('2026-10-20', 'correct', 1000), ev('2026-10-20', 'correct', 1000), ev('2026-10-20', 'almost', 1000), ev('2026-10-20', 'skipped', 1000)]; // 10+10+7 = 27
  const day2 = [ev('2026-10-21', 'correct', 1000), ev('2026-10-21', 'almost', 1000), ev('2026-10-21', 'wrong', 1000), ev('2026-10-21', 'dont_know', 1000), ev('2026-10-21', 'dont_know', 1000), ev('2026-10-21', 'skipped', null)]; // 10+7+3+3+3 = 26
  const r = xpSummary([...day2, ...day1, makeEvent({ type: 'session_end', day: '2026-10-21', result: null })]);
  assert.equal(r.xp, 53);
  assert.equal(r.attempts, 8);
  assert.deepEqual(r.byDay, [{ day: '2026-10-20', xp: 27 }, { day: '2026-10-21', xp: 26 }]);
  assert.deepEqual(r.rank, { index: 0, id: 'seed', label: 'Semilla', min: 0 });
  assert.deepEqual(r.next, { id: 'sprout', label: 'Brote', min: 100, remaining: 47 });
  assert.equal(r.progress, 0.53);
});

test('xpSummary: bordes de rango (99, 100, 12 000) y último peldaño', () => {
  const many = (n, result) => Array.from({ length: n }, () => ev('2026-10-20', result, 1000));
  // 9 correct (90) + wrong + wrong + dont_know (9) = 99 → sigue en Semilla, falta 1.
  const r99 = xpSummary([...many(9, 'correct'), ...many(2, 'wrong'), ...many(1, 'dont_know')]);
  assert.equal(r99.xp, 99); assert.equal(r99.rank.id, 'seed'); assert.equal(r99.next.remaining, 1);
  // 10 correct = 100 → Brote exacto, avance 0 hacia Tallo (min 300): faltan 200.
  const r100 = xpSummary(many(10, 'correct'));
  assert.equal(r100.xp, 100); assert.deepEqual(r100.rank, { index: 1, id: 'sprout', label: 'Brote', min: 100 });
  assert.deepEqual(r100.next, { id: 'stem', label: 'Tallo', min: 300, remaining: 200 }); assert.equal(r100.progress, 0);
  // 200 XP: a mitad de Brote → progreso 0,5.
  assert.equal(xpSummary(many(20, 'correct')).progress, 0.5);
  // 1 200 correct = 12 000 → último peldaño, sin siguiente, progreso 1.
  const top = xpSummary(many(1200, 'correct'));
  assert.equal(top.xp, 12000); assert.equal(top.rank.id, 'forest'); assert.equal(top.rank.index, 7); assert.equal(top.next, null); assert.equal(top.progress, 1);
  assert.equal(xpSummary(many(1199, 'correct')).rank.id, 'fruit'); // 11 990
});

test('xpSummary: vacío y rango', () => {
  const r = xpSummary([]);
  assert.equal(r.xp, 0); assert.equal(r.attempts, 0); assert.deepEqual(r.byDay, []);
  assert.equal(r.rank.id, 'seed'); assert.equal(r.next.min, 100); assert.equal(r.progress, 0);
  const evs = [ev('2026-10-20', 'correct', 1), ev('2026-10-21', 'correct', 1), ev('2026-10-22', 'correct', 1)];
  assert.equal(xpSummary(evs, { from: '2026-10-21', to: '2026-10-21' }).xp, 10);
  assert.equal(xpSummary(evs, { from: '2026-10-21' }).xp, 20);
  assert.equal(xpSummary(evs, { to: '2026-10-21' }).xp, 20);
  assert.equal(xpSummary(evs, { from: '2030-01-01' }).xp, 0);
  assert.throws(() => xpSummary(null), /lista/);
  assert.throws(() => xpSummary(evs, { from: '2026-10-22', to: '2026-10-21' }), /posterior/);
  assert.throws(() => xpSummary(evs, { from: 'mañana' }), /día real/);
});

test('xpSummary: es opcional; desactivada devuelve null y no calcula ni valida nada', () => {
  const evs = [ev('2026-10-20', 'correct', 1)];
  assert.equal(xpSummary(evs, { enabled: false }), null);
  assert.equal(xpSummary(null, { enabled: false }), null); // ni siquiera mira los eventos
  assert.equal(xpSummary(evs, { config: { ...STATS_CONFIG.xp, enabled: false } }), null);
  assert.equal(xpSummary(evs, { config: { ...STATS_CONFIG.xp, enabled: false }, enabled: true }).xp, 10); // el ajuste de la pantalla manda sobre el archivo
  assert.equal(xpSummary(evs, { enabled: true }).xp, 10);
  assert.throws(() => xpSummary(evs, { enabled: 'no' }), /verdadero o falso/);
  assert.throws(() => xpSummary(evs, { enabled: 0 }), /verdadero o falso/);
});

test('xpSummary: sin penalizaciones (propiedad): añadir un evento nunca baja el XP ni el rango', () => {
  const rng = makeRng(2026);
  const results = ['correct', 'almost', 'wrong', 'dont_know', 'skipped'];
  const events = [];
  let prev = xpSummary(events);
  for (let i = 0; i < 300; i += 1) {
    events.push(ev(`2026-10-${String(10 + rng.int(0, 10)).padStart(2, '0')}`, rng.pick(results), rng.int(0, 20000)));
    const now = xpSummary(events);
    assert.ok(now.xp >= prev.xp, `el XP bajó en el evento ${i}`);
    assert.ok(now.rank.index >= prev.rank.index);
    assert.ok(now.byDay.every((d) => d.xp >= 0));
    prev = now;
  }
  // Fallar o decir «No sé» da algo (≥ 0) y «No sé» no sale más caro que fallar.
  assert.ok(STATS_CONFIG.xp.perResult.dont_know >= STATS_CONFIG.xp.perResult.wrong && STATS_CONFIG.xp.perResult.wrong >= 0);
  assert.ok(STATS_CONFIG.xp.perResult.correct > STATS_CONFIG.xp.perResult.almost && STATS_CONFIG.xp.perResult.almost > STATS_CONFIG.xp.perResult.wrong);
});

test('xpSummary: config propia válida; configs inválidas lanzan en español', () => {
  const mine = { enabled: true, perResult: { correct: 1, almost: 1, wrong: 1, dont_know: 1 }, ranks: [{ id: 'a', label: 'A', min: 0 }, { id: 'b', label: 'B', min: 2.5 }] };
  const three = [ev('2026-10-20', 'correct', 1), ev('2026-10-20', 'wrong', 1), ev('2026-10-20', 'dont_know', 1)];
  const r = xpSummary(three, { config: mine });
  assert.equal(r.xp, 3); assert.equal(r.rank.id, 'b'); assert.equal(r.next, null); assert.equal(r.progress, 1);
  assert.equal(xpSummary(three.slice(0, 2), { config: mine }).rank.id, 'a');
  assert.equal(xpSummary(three.slice(0, 2), { config: mine }).next.remaining, 0.5);
  const bad = (patch, re) => assert.throws(() => xpSummary(three, { config: { ...mine, ...patch } }), re);
  bad({ perResult: { ...mine.perResult, wrong: -1 } }, /no resta/);
  bad({ perResult: { ...mine.perResult, correct: NaN } }, /no resta/);
  bad({ perResult: { correct: 1, almost: 1, wrong: 1 } }, /dont_know/);
  bad({ perResult: null }, /perResult/);
  bad({ ranks: [] }, /al menos un rango/);
  bad({ ranks: 'x' }, /al menos un rango/);
  bad({ ranks: [{ id: 'a', label: 'A', min: 1 }] }, /empezar en 0/);
  bad({ ranks: [{ id: 'a', label: 'A', min: 0 }, { id: 'b', label: 'B', min: 0 }] }, /ascendente/);
  bad({ ranks: [{ id: 'a', label: 'A', min: 0 }, { id: 'b', label: 'B', min: 5 }, { id: 'c', label: 'C', min: 3 }] }, /ascendente/);
  bad({ ranks: [{ id: 'a', label: 'A', min: 0 }, { id: 'a', label: 'B', min: 5 }] }, /repetido/);
  bad({ ranks: [{ id: 'a', label: 'A', min: 0 }, { id: '', label: 'B', min: 5 }] }, /\{ id, label, min \}/);
  bad({ ranks: [{ id: 'a', label: 7, min: 0 }] }, /\{ id, label, min \}/);
  bad({ ranks: [{ id: 'a', label: 'A', min: -2 }] }, /\{ id, label, min \}/);
  assert.throws(() => xpSummary(three, { config: null }), /debe ser un objeto \{ enabled/);
  assert.throws(() => xpSummary(three, { config: [] }), /debe ser un objeto \{ enabled/); // una lista no es una configuración
  assert.throws(() => xpSummary(three, { config: 'x' }), /debe ser un objeto \{ enabled/);
});

test('stats.config.js: valores válidos y congelados a fondo', () => {
  assert.ok(Object.isFrozen(STATS_CONFIG) && Object.isFrozen(STATS_CONFIG.xp) && Object.isFrozen(STATS_CONFIG.xp.perResult) && Object.isFrozen(STATS_CONFIG.xp.ranks) && Object.isFrozen(STATS_CONFIG.xp.ranks[0]));
  assert.throws(() => { 'use strict'; STATS_CONFIG.xp.perResult.correct = 999; }, TypeError);
  assert.equal(STATS_CONFIG.xp.ranks[0].min, 0);
  assert.doesNotThrow(() => xpSummary([], {})); // la configuración por defecto pasa su propia validación
  assert.deepEqual(STATS_CONFIG.xp.ranks.map((r) => r.min), [0, 100, 300, 700, 1500, 3000, 6000, 12000]);
  // Nombres neutros: ni constancia ni rachas.
  for (const r of STATS_CONFIG.xp.ranks) assert.ok(!/racha|streak|constan|diari|perd/i.test(r.label));
});


// ---------- redondeos, ceros y bordes de la configuración ----------
test('plannedVsDone: redondea a 2 decimales cada día y cada total (sin ruido de coma flotante)', () => {
  // Plan 0,1 + 0,2 = 0,30000000000000004 en coma flotante → 0,3. Hecho: 61 234 ms = 1,02056… min → 1,02; y 36 700 ms = 0,61166… → 0,61 (sin plan).
  const evs = [ev('2026-10-20', 'correct', 61234), ev('2026-10-21', 'correct', 36700)];
  const r = plannedVsDone(evs, [{ day: '2026-10-20', minutes: 0.1 }, { day: '2026-10-22', minutes: 0.2 }, { day: '2026-10-19', minutes: 7.126 }]);
  assert.deepEqual(r.days, [
    { day: '2026-10-19', plannedMinutes: 7.13, doneMinutes: 0, differenceMinutes: -7.13 },
    { day: '2026-10-20', plannedMinutes: 0.1, doneMinutes: 1.02, differenceMinutes: 0.92 },
    { day: '2026-10-21', plannedMinutes: null, doneMinutes: 0.61, differenceMinutes: null },
    { day: '2026-10-22', plannedMinutes: 0.2, doneMinutes: 0, differenceMinutes: -0.2 },
  ]);
  // planeado 7,126 + 0,1 + 0,2 = 7,426 → 7,43; hecho en días con plan 1,02056… → 1,02; sin plan 0,61; diferencia 1,02056 − 7,426 = −6,40544 → −6,41.
  assert.deepEqual(r.totals, { plannedDays: 3, plannedMinutes: 7.43, doneMinutes: 1.02, differenceMinutes: -6.41, unplannedMinutes: 0.61, plannedHours: 0.12, doneHours: 0.02 });
  // La suma 0,1 + 0,2 sola: sin redondear daría 0,30000000000000004.
  assert.equal(plannedVsDone([], [{ day: '2026-10-20', minutes: 0.1 }, { day: '2026-10-21', minutes: 0.2 }]).totals.plannedMinutes, 0.3);
});

test('xpSummary: redondea a 2 decimales el XP, el de cada día y lo que falta para el siguiente rango', () => {
  const cfg = { enabled: true, perResult: { correct: 0.1, almost: 0.1, wrong: 0.1, dont_know: 0.1 }, ranks: [{ id: 'a', label: 'A', min: 0 }, { id: 'b', label: 'B', min: 1 }] };
  const three = [ev('2026-10-20', 'correct', 1), ev('2026-10-20', 'wrong', 1), ev('2026-10-20', 'dont_know', 1)];
  const r = xpSummary(three, { config: cfg });
  // 0,1 + 0,1 + 0,1 = 0,30000000000000004 → 0,3; faltan 1 − 0,3 = 0,7.
  assert.equal(r.xp, 0.3); assert.deepEqual(r.byDay, [{ day: '2026-10-20', xp: 0.3 }]); assert.equal(r.next.remaining, 0.7);
  assert.equal(r.progress, 0.3); // el avance sale del XP ya redondeado: (0,3 − 0) / (1 − 0)
});

test('xpSummary: lo que falta para el siguiente rango sale sin ruido de coma flotante', () => {
  const cfg = { enabled: true, perResult: { correct: 0.3, almost: 0.3, wrong: 0.3, dont_know: 0.3 }, ranks: [{ id: 'a', label: 'A', min: 0 }, { id: 'b', label: 'B', min: 1 }] };
  const three = [ev('2026-10-20', 'correct', 1), ev('2026-10-20', 'correct', 1), ev('2026-10-20', 'correct', 1)];
  // 3 × 0,3 = 0,8999999999999999 → 0,9; faltan 1 − 0,9 = 0,1 (sin redondear saldría 0,09999999999999998).
  const r = xpSummary(three, { config: cfg });
  assert.equal(r.xp, 0.9); assert.equal(r.next.remaining, 0.1);
});

test('xpSummary: 0 XP por resultado es válido (no resta); un solo rango es válido', () => {
  const zero = { enabled: true, perResult: { correct: 5, almost: 5, wrong: 0, dont_know: 0 }, ranks: [{ id: 'only', label: 'Único', min: 0 }] };
  const evs = [ev('2026-10-20', 'correct', 1), ev('2026-10-20', 'wrong', 1), ev('2026-10-20', 'dont_know', 1)];
  const r = xpSummary(evs, { config: zero });
  assert.equal(r.xp, 5); assert.equal(r.attempts, 3); assert.equal(r.rank.id, 'only'); assert.equal(r.next, null); assert.equal(r.progress, 1);
});

test('xpSummary: un `min` que no es un número finito se rechaza en cualquier posición', () => {
  const base = { enabled: true, perResult: { correct: 1, almost: 1, wrong: 1, dont_know: 1 } };
  for (const min of [NaN, Infinity, '5', null, undefined]) {
    assert.throws(() => xpSummary([], { config: { ...base, ranks: [{ id: 'a', label: 'A', min: 0 }, { id: 'b', label: 'B', min }] } }), /\{ id, label, min \}/, String(min));
    assert.throws(() => xpSummary([], { config: { ...base, ranks: [{ id: 'a', label: 'A', min }] } }), /\{ id, label, min \}|empezar/, String(min));
  }
});

test('retentionReport: los eventos con día ilegible se ignoran (usa el mismo comprobador de días)', () => {
  const mk = (day, rating, ts) => makeEvent({ day, rating, ts, cardId: 'c#0', result: rating === 1 ? 'wrong' : 'correct' });
  const evs = [mk('2026-10-20', 3, '2026-10-20T10:00:00.000Z'), mk('2026-10-21', 3, '2026-10-21T10:00:00.000Z'), mk('2026-02-30', 3, '2026-10-21T11:00:00.000Z'),
    mk('ayer', 1, '2026-10-21T12:00:00.000Z'), mk(undefined, 1, '2026-10-21T13:00:00.000Z'), mk(20261021, 1, '2026-10-21T14:00:00.000Z')];
  const r = retentionReport(evs);
  // Solo valen los 2 primeros: el primero es aprender, el segundo es 1 repaso retenido. Los de día ilegible (también el 30 de febrero) no cuentan ni como «primer intento».
  assert.equal(r.reviews, 1); assert.equal(r.retained, 1); assert.deepEqual(r.series.map((d) => d.day), ['2026-10-21']);
  // Con un día ilegible repetido muchas veces sigue ignorándose (el comprobador recuerda el resultado de cada texto).
  const many = [mk('2026-10-20', 3, '2026-10-20T10:00:00.000Z'), ...Array.from({ length: 50 }, () => mk('2026-13-45', 1, '2026-10-21T10:00:00.000Z')), mk('2026-10-21', 1, '2026-10-21T11:00:00.000Z')];
  assert.deepEqual([retentionReport(many).reviews, retentionReport(many).retained], [1, 0]);
});

// ---------- topes contra desbordes (hallados con un fuzz de datos hostiles en 1.9-T3) ----------
test('topes: un `ms` mayor que 24 h no suma (como en el esquema de eventos) pero el intento cuenta', () => {
  const MAX = 86400000;
  const ok = [ev('2026-10-20', 'correct', MAX), ev('2026-10-20', 'correct', MAX)];
  assert.deepEqual(activityByDay(ok), [{ day: '2026-10-20', minutes: 2880, items: 2, ms: 2 * MAX }]); // 24 h exactas sí suman
  const over = [ev('2026-10-20', 'correct', MAX + 1), ev('2026-10-20', 'correct', 1e308), ev('2026-10-20', 'correct', 1e308), ev('2026-10-20', 'correct', 60000)];
  assert.deepEqual(activityByDay(over), [{ day: '2026-10-20', minutes: 1, items: 4, ms: 60000 }]);
  assert.equal(plannedVsDone(over, [{ day: '2026-10-20', minutes: 1 }]).totals.doneMinutes, 1);
  assert.equal(xpSummary(over).xp, 40); // los 4 intentos dan XP aunque su tiempo sea ilegible
});

test('topes: un plan de más de un día (1440 min) es ilegible y se ignora; 1440 sí vale', () => {
  assert.deepEqual(plannedVsDone([], [{ day: '2026-10-20', minutes: 1440 }]).days, [{ day: '2026-10-20', plannedMinutes: 1440, doneMinutes: 0, differenceMinutes: -1440 }]);
  assert.deepEqual(plannedVsDone([], [{ day: '2026-10-20', minutes: 1441 }]).days, []);
  const huge = plannedVsDone([], [{ day: '2026-10-20', minutes: 1e308 }, { day: '2026-10-21', minutes: 1e308 }, { day: '2026-10-22', minutes: 60 }]);
  assert.deepEqual(huge.days.map((d) => d.day), ['2026-10-22']);
  assert.equal(huge.totals.plannedMinutes, 60); assert.ok(Number.isFinite(huge.totals.plannedHours));
});

test('topes: en la configuración, XP por intento ≤ 1000 y `min` ≤ 1 000 000 000', () => {
  const mk = (xp, min) => ({ enabled: true, perResult: { correct: xp, almost: 1, wrong: 1, dont_know: 1 }, ranks: [{ id: 'a', label: 'A', min: 0 }, { id: 'b', label: 'B', min }] });
  const one = [ev('2026-10-20', 'correct', 1)];
  assert.equal(xpSummary(one, { config: mk(1000, 1e9) }).xp, 1000);
  assert.equal(xpSummary(one, { config: mk(1000, 1e9) }).next.remaining, 1e9 - 1000);
  assert.throws(() => xpSummary(one, { config: mk(1001, 5) }), /entre 0 y 1000/);
  assert.throws(() => xpSummary(one, { config: mk(1e308, 5) }), /entre 0 y 1000/);
  assert.throws(() => xpSummary(one, { config: mk(1, 1e9 + 1) }), /entre 0 y 1000000000/);
  assert.throws(() => xpSummary(one, { config: mk(1, 1e308) }), /entre 0 y 1000000000/);
});

// ---------- integración ----------
test('integración: eventos reales en la base en memoria → horas hechas y XP', async () => {
  const db = createMemoryDb(); await db.open();
  const clock = makeClock('2026-10-25T10:00:00.000Z');
  const events = createEvents({ db, clock });
  const base = { sessionId: 'ses_a', mode: 'mech', channel: 'keyboard', hint: false, topics: ['gram.a'], exerciseType: 'fix_error' };
  await events.log({ ...base, type: 'answer', itemId: 'i.one', cardId: 'i.one#0', result: 'correct', rating: 3, ms: 1200000 }); // 20 min, 10 XP
  clock.advance(1000);
  await events.log({ ...base, type: 'answer', itemId: 'i.two', cardId: 'i.two#0', result: 'dont_know', rating: 1, ms: 600000 }); // 10 min, 3 XP
  const all = await events.since(new Date('2000-01-01T00:00:00.000Z'));
  const day = all[0].day;
  const r = plannedVsDone(all, [{ day, minutes: 45 }]);
  assert.deepEqual(r.days, [{ day, plannedMinutes: 45, doneMinutes: 30, differenceMinutes: -15 }]);
  assert.equal(r.totals.plannedHours, 0.75); assert.equal(r.totals.doneHours, 0.5);
  const x = xpSummary(all);
  assert.equal(x.xp, 13); assert.deepEqual(x.byDay, [{ day, xp: 13 }]);
});
