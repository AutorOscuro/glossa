// @purpose: Pruebas de la mediana personal de tiempo por tipo de ejercicio (core/gradingBaseline.js).
// Pruebas de la mediana personal (subparte 1.5, cuarto 2): core/gradingBaseline.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { medianOf, collectSamples, baselineFor, loadBaselines } from '../core/gradingBaseline.js';
import { rate, defaultBaselineMs } from '../core/grading.js';
import { GRADING } from '../core/grading.config.js';
import { createEvents } from '../core/events.js';
import { createMemoryDb } from '../core/db.memory.js';
import { makeClock, makeRng } from './_helpers.mjs';

// Evento mínimo con la forma de 8.6; `n` ordena por tiempo (más grande = más reciente).
const ev = (n, over = {}) => ({
  id: `evt_${String(n).padStart(8, '0')}`, ts: new Date(Date.parse('2026-10-01T00:00:00.000Z') + n * 60000).toISOString(),
  type: 'answer', exerciseType: 'fix_error', result: 'correct', ms: 5000, hint: false, dontKnow: false, ...over,
});
const many = (count, msOf, over = {}) => Array.from({ length: count }, (_, i) => ev(i + 1, { ms: msOf(i), ...over }));

test('medianOf: impar, par, un solo dato, vacío y datos no numéricos', () => {
  assert.equal(medianOf([3, 1, 2]), 2); assert.equal(medianOf([4, 1, 3, 2]), 2.5); assert.equal(medianOf([7]), 7);
  assert.equal(medianOf([]), null); assert.equal(medianOf([NaN, Infinity, 'x', null, 4]), 4);
  const input = [3, 1, 2]; medianOf(input); assert.deepEqual(input, [3, 1, 2]); // no reordena la entrada
  assert.throws(() => medianOf(null), /se necesita una lista/);
});

test('CA 3: con menos de 8 datos usa la constante del tipo; con 8 o más, la mediana personal', () => {
  const dflt = defaultBaselineMs('fix_error');
  for (const n of [0, 1, 7]) {
    const b = baselineFor('fix_error', many(n, () => 4000));
    assert.deepEqual(b, { ms: dflt, source: 'default', samples: n }, `n=${n}`);
  }
  const b8 = baselineFor('fix_error', many(8, () => 4000));
  assert.deepEqual(b8, { ms: 4000, source: 'personal', samples: 8 });
  assert.equal(baselineFor('fix_error', many(9, (i) => 1000 * (i + 1))).ms, 5000); // mediana de 1..9 s
});

test('usa solo los últimos 30 correctos: los más viejos quedan fuera', () => {
  const old = many(20, () => 60000); // 20 viejos y lentos
  const recent = Array.from({ length: 30 }, (_, i) => ev(100 + i, { ms: 3000 }));
  const b = baselineFor('fix_error', [...old, ...recent]);
  assert.deepEqual(b, { ms: 3000, source: 'personal', samples: 30 });
  const mixed = baselineFor('fix_error', [...old, ...recent.slice(0, 15)]); // 15 recientes + 15 viejos entran
  assert.equal(mixed.samples, 30); assert.equal(mixed.ms, (3000 + 60000) / 2);
  assert.equal(collectSamples([...old, ...recent]).get('fix_error').length, GRADING.window);
});

test('no importa el orden en que vengan los eventos', () => {
  const evs = [...many(10, (i) => 1000 * (i + 1)), ...Array.from({ length: 30 }, (_, i) => ev(200 + i, { ms: 9000 }))];
  const rev = [...evs].reverse(); const shuffled = makeRng(3).shuffle(evs);
  const base = baselineFor('fix_error', evs);
  assert.deepEqual(baselineFor('fix_error', rev), base); assert.deepEqual(baselineFor('fix_error', shuffled), base);
  assert.equal(base.ms, 9000);
});

test('cada tipo de ejercicio tiene su propia mediana', () => {
  const evs = [...many(8, () => 2000, { exerciseType: 'mcq_en_es' }), ...many(8, () => 20000, { exerciseType: 'write_email' }), ...many(3, () => 1, { exerciseType: 'cloze_bank' })];
  assert.equal(baselineFor('mcq_en_es', evs).ms, 2000); assert.equal(baselineFor('write_email', evs).ms, 20000);
  assert.deepEqual(baselineFor('cloze_bank', evs), { ms: defaultBaselineMs('cloze_bank'), source: 'default', samples: 3 });
  assert.deepEqual(baselineFor('translate_word', evs).source, 'default');
});

test('qué eventos cuentan: solo `answer` correcto, sin pista, sin "no sé" y con ms válido', () => {
  const good = many(8, () => 4000);
  const noise = [
    ev(50, { result: 'almost', ms: 1 }), ev(51, { result: 'wrong', ms: 1 }), ev(52, { result: 'skipped', ms: 1 }), ev(53, { result: 'dont_know', ms: 1 }),
    ev(54, { hint: true, ms: 1 }), ev(55, { dontKnow: true, ms: 1 }), ev(56, { type: 'tap_word', ms: 1 }), ev(57, { type: 'session_start', ms: 1 }),
    ev(58, { ms: 0 }), ev(59, { ms: -5 }), ev(60, { ms: NaN }), ev(61, { ms: Infinity }), ev(62, { ms: null }), ev(63, { ms: '3000' }), ev(64, { ms: 86400001 }),
    ev(65, { exerciseType: null }), ev(66, { exerciseType: '' }), ev(67, { ts: 5 }), null, undefined, 7, 'x', [], {},
  ];
  assert.deepEqual(baselineFor('fix_error', [...good, ...noise]), { ms: 4000, source: 'personal', samples: 8 });
  assert.equal(baselineFor('fix_error', noise).source, 'default');
  assert.equal(baselineFor('fix_error', [...good, ev(70, { ms: 86400000 })]).samples, 9); // 24 h exactas: límite válido
});

test('un tiempo extremo aislado no mueve la mediana (distracciones, pausas)', () => {
  const evs = [...many(9, () => 4000), ev(99, { ms: 80000000 }), ev(100, { ms: 5 })];
  assert.equal(baselineFor('fix_error', evs).ms, 4000);
});

test('empate de ts: se desempata por id y el resultado es estable', () => {
  const ts = '2026-10-05T10:00:00.000Z';
  const evs = Array.from({ length: 40 }, (_, i) => ({ ...ev(i + 1), ts, ms: i < 15 ? 1000 : 9000 }));
  const a = baselineFor('fix_error', evs); const b = baselineFor('fix_error', [...evs].reverse());
  assert.deepEqual(a, b); assert.equal(a.samples, 30);
  assert.equal(a.ms, 9000); // entran los 30 de id más reciente (5 lentos de 1 s y 25 de 9 s), no los primeros que lleguen
});

test('no modifica los eventos de entrada y entradas mal formadas lanzan un error claro', () => {
  const evs = Object.freeze(many(10, () => 4000).map((e) => Object.freeze(e)));
  assert.doesNotThrow(() => baselineFor('fix_error', evs));
  for (const x of [null, undefined, {}, 'x', 5]) assert.throws(() => baselineFor('fix_error', x), /se necesita una lista de eventos/);
  assert.throws(() => baselineFor('fix_error', [], { ...GRADING, minSamples: 0 }), /configuración no válida/);
  for (const t of [null, undefined, 5, {}, '', 'constructor', '__proto__']) {
    assert.deepEqual(baselineFor(t, evs), { ms: GRADING.fallbackBaselineMs, source: 'default', samples: 0 }, String(t));
  }
  assert.deepEqual(baselineFor('__proto__', [ev(1, { exerciseType: '__proto__' })]).samples, 1); // tipo hostil: sin contaminar nada
  assert.equal({}.polluted, undefined);
});

test('minSamples y window salen de la config (no están fijos en el código)', () => {
  const cfg = { ...GRADING, minSamples: 3, window: 4 };
  assert.deepEqual(baselineFor('fix_error', many(3, () => 2000), cfg), { ms: 2000, source: 'personal', samples: 3 });
  assert.equal(baselineFor('fix_error', many(10, (i) => (i < 6 ? 9000 : 1000)), cfg).samples, 4);
  assert.equal(baselineFor('fix_error', many(2, () => 2000), cfg).source, 'default');
});

test('con la mediana personal, el mismo tiempo se califica distinto que con la constante', () => {
  const slowLearner = many(10, () => 30000); // William tarda ~30 s en este tipo
  const personal = baselineFor('fix_error', slowLearner).ms; const dflt = baselineFor('fix_error', []).ms;
  const answer = { result: 'correct', ms: 30000 };
  assert.equal(rate(answer, dflt), 2); // contra la constante de 12 s sería "lento" (Hard)
  assert.equal(rate(answer, personal), 3); // contra su mediana es normal (Good)
  assert.equal(rate({ result: 'correct', ms: 15000 }, personal), 4);
});

// ---- Con la base de datos real en memoria (events.log + events.since) ----
async function setupDb(clock = makeClock('2026-10-20T10:00:00.000Z')) {
  const db = createMemoryDb(); await db.open();
  const events = createEvents({ db, clock, rng: makeRng(11) });
  return { db, events, clock };
}
const logAnswer = (events, over = {}) => events.log({
  type: 'answer', itemId: 'g.pp.0001', cardId: 'g.pp.0001#0', topics: ['gram.x'], exerciseType: 'fix_error', result: 'correct', rating: 3, ms: 4000,
  mode: 'mech', channel: 'keyboard', ...over,
});

test('loadBaselines lee la base: personal con 8 aciertos, constante con 7, y no cuenta lo anterior a lookbackDays', async () => {
  const { events, clock } = await setupDb();
  for (let i = 0; i < 8; i += 1) { await logAnswer(events, { ms: 3000 + i * 100 }); clock.advance(60000); }
  for (let i = 0; i < 7; i += 1) { await logAnswer(events, { exerciseType: 'mcq_en_es', ms: 1000 }); clock.advance(60000); }
  const b = await loadBaselines({ events, now: clock.now() });
  assert.deepEqual(b.forType('fix_error'), { ms: 3350, source: 'personal', samples: 8 });
  assert.deepEqual(b.forType('mcq_en_es'), { ms: defaultBaselineMs('mcq_en_es'), source: 'default', samples: 7 });
  assert.deepEqual(b.forType('nunca_visto').source, 'default'); assert.deepEqual(b.types(), ['fix_error', 'mcq_en_es']);
  const later = await loadBaselines({ events, now: new Date(clock.now().getTime() + 121 * 86400000) }); // todo quedó fuera de la ventana
  assert.equal(later.forType('fix_error').source, 'default'); assert.equal(later.forType('fix_error').samples, 0);
  assert.ok(Object.isFrozen(b));
});

test('loadBaselines: base vacía, `now` inválido y API de eventos ausente', async () => {
  const { events, clock } = await setupDb();
  const b = await loadBaselines({ events, now: clock.now() });
  assert.deepEqual(b.types(), []); assert.equal(b.forType('fix_error').ms, defaultBaselineMs('fix_error'));
  await assert.rejects(() => loadBaselines({ events, now: 'ayer' }), /now.*fecha válida/);
  await assert.rejects(() => loadBaselines({ events, now: undefined }), /now.*fecha válida/);
  await assert.rejects(() => loadBaselines({ now: clock.now() }), /API de eventos/);
  await assert.rejects(() => loadBaselines(), /API de eventos/);
  await assert.rejects(() => loadBaselines({ events: { since: () => 1 }, now: clock.now(), config: { ...GRADING, window: 0 } }), /configuración no válida/);
  assert.equal((await loadBaselines({ events, now: clock.now().getTime() })).types().length, 0); // milisegundos también valen
});

test('rendimiento: 50.000 eventos en < 200 ms', () => {
  const types = ['fix_error', 'mcq_en_es', 'write_email', 'cloze_bank', 'first_letter'];
  const evs = Array.from({ length: 50000 }, (_, i) => ev(i + 1, { exerciseType: types[i % 5], ms: 1000 + (i % 9) * 500 }));
  const t0 = performance.now(); const m = collectSamples(evs);
  assert.equal(m.size, 5); for (const l of m.values()) assert.equal(l.length, 30);
  assert.ok(performance.now() - t0 < 200, `tardó ${Math.round(performance.now() - t0)} ms`);
});
