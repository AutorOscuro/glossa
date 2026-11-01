// @purpose: Pruebas de las reglas de calificación (core/grading.js y core/grading.config.js).
// Pruebas de las reglas de calificación (subparte 1.5, cuarto 1): core/grading.js + core/grading.config.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rate, rateDetailed, timeClass, defaultBaselineMs, validateConfig, RATING } from '../core/grading.js';
import { GRADING, FAMILY_BASELINE_MS, TYPE_BASELINE_MS } from '../core/grading.config.js';
import { FAMILIES, ITEM_TYPES, INTEGRATOR_TYPES } from '../core/contentTypes.js';
import { RESULTS } from '../core/eventSchema.js';

const B = 10000; // mediana de referencia
// Las 6 lecturas del tiempo, con B = 10000: rápido, normal, lento, extremo, interrumpido (pestaña oculta), ilegible.
const TIMES = [
  { name: 'fast', ms: 3000 }, { name: 'normal', ms: 10000 }, { name: 'slow', ms: 20000 },
  { name: 'extreme', ms: 60000 }, { name: 'interrupted', ms: 10000, interrupted: true }, { name: 'unknown', ms: null },
];

// TABLA DE DECISIÓN COMPLETA, escrita a mano (no calculada): result × pista × "no sé" × lectura del tiempo = 120 casos.
//            result        hint   dontKnow  [rápido, normal, lento, extremo, interrumpido, ilegible]
const TABLE = [
  ['correct',    false, false, [4, 3, 2, 3, 3, 3]],
  ['correct',    true,  false, [2, 2, 2, 2, 2, 2]],
  ['correct',    false, true,  [1, 1, 1, 1, 1, 1]],
  ['correct',    true,  true,  [1, 1, 1, 1, 1, 1]],
  ['almost',     false, false, [2, 2, 2, 2, 2, 2]],
  ['almost',     true,  false, [2, 2, 2, 2, 2, 2]],
  ['almost',     false, true,  [1, 1, 1, 1, 1, 1]],
  ['almost',     true,  true,  [1, 1, 1, 1, 1, 1]],
  ['wrong',      false, false, [1, 1, 1, 1, 1, 1]],
  ['wrong',      true,  false, [1, 1, 1, 1, 1, 1]],
  ['wrong',      false, true,  [1, 1, 1, 1, 1, 1]],
  ['wrong',      true,  true,  [1, 1, 1, 1, 1, 1]],
  ['skipped',    false, false, [1, 1, 1, 1, 1, 1]],
  ['skipped',    true,  false, [1, 1, 1, 1, 1, 1]],
  ['skipped',    false, true,  [1, 1, 1, 1, 1, 1]],
  ['skipped',    true,  true,  [1, 1, 1, 1, 1, 1]],
  ['dont_know',  false, false, [1, 1, 1, 1, 1, 1]],
  ['dont_know',  true,  false, [1, 1, 1, 1, 1, 1]],
  ['dont_know',  false, true,  [1, 1, 1, 1, 1, 1]],
  ['dont_know',  true,  true,  [1, 1, 1, 1, 1, 1]],
];

test('CA 1: tabla de decisión completa (120 casos) y cubre todos los result del contrato', () => {
  assert.deepEqual([...new Set(TABLE.map((r) => r[0]))].sort(), [...RESULTS].sort());
  assert.equal(TABLE.length * TIMES.length, 120);
  for (const [result, hint, dontKnow, expected] of TABLE) {
    TIMES.forEach((t, i) => {
      const input = { result, hint, dontKnow, ms: t.ms, interrupted: t.interrupted === true };
      assert.equal(rate(input, B), expected[i], `${result} hint=${hint} dontKnow=${dontKnow} tiempo=${t.name}`);
    });
  }
});

test('bordes exactos del tiempo: > 1,8 × es Hard, < 0,6 × es Easy, > 5 × se ignora', () => {
  const r = (ms) => rate({ result: 'correct', ms, hint: false, dontKnow: false }, B);
  assert.equal(r(5999), RATING.easy); assert.equal(r(6000), RATING.good); // 0,6 × exacto NO es Easy
  assert.equal(r(18000), RATING.good); assert.equal(r(18001), RATING.hard); // 1,8 × exacto NO es Hard
  assert.equal(r(50000), RATING.hard); assert.equal(r(50001), RATING.good); // 5 × exacto aún cuenta; más se ignora
  assert.equal(r(1), RATING.easy);
});

test('CA 2: pestaña oculta o tiempo extremo nunca bajan el rating por debajo de Good', () => {
  for (const ms of [50001, 1e6, 1e12, Number.MAX_SAFE_INTEGER]) {
    assert.equal(rate({ result: 'correct', ms }, B), RATING.good);
  }
  for (const ms of [1, 3000, 10000, 20000, 60000, 1e9]) {
    assert.equal(rate({ result: 'correct', ms, interrupted: true }, B), RATING.good, `interrumpida, ${ms} ms`);
  }
  // Un tiempo ignorado tampoco puede dar Easy: "no se sabe" no premia.
  assert.equal(rate({ result: 'correct', ms: 1, interrupted: true }, B), RATING.good);
});

test('CA 4: dont_know vale 1 siempre, aunque venga rápido, sin pista o como "correct"', () => {
  for (const ms of [1, 3000, 10000, 1e9, null, undefined, NaN]) {
    for (const hint of [true, false]) {
      assert.equal(rate({ result: 'dont_know', ms, hint }, B), 1);
      assert.equal(rate({ result: 'correct', ms, hint, dontKnow: true }, B), 1);
      assert.equal(rate({ result: 'almost', ms, hint, dontKnow: true }, B), 1);
    }
  }
});

test('"casi" (almost) es Hard y nunca Easy, aunque sea rapidísimo', () => {
  assert.equal(rate({ result: 'almost', ms: 1 }, B), RATING.hard);
  assert.equal(rate({ result: 'almost', ms: 1e9 }, B), RATING.hard);
});

test('rateDetailed explica cada decisión con un motivo estable', () => {
  const d = (input) => rateDetailed({ ms: 10000, ...input }, B);
  assert.deepEqual(d({ result: 'correct' }), { rating: 3, reason: 'good_normal', time: { cls: 'normal' } });
  assert.equal(d({ result: 'correct', ms: 1000 }).reason, 'easy_fast');
  assert.equal(d({ result: 'correct', ms: 30000 }).reason, 'hard_slow');
  assert.equal(d({ result: 'correct', hint: true }).reason, 'hard_hint');
  assert.equal(d({ result: 'almost' }).reason, 'hard_almost');
  assert.equal(d({ result: 'wrong' }).reason, 'again_wrong');
  assert.equal(d({ result: 'skipped' }).reason, 'again_skipped');
  assert.equal(d({ result: 'dont_know' }).reason, 'again_dont_know');
  assert.equal(d({ result: 'correct', dontKnow: true }).reason, 'again_dont_know');
  const ign = d({ result: 'correct', ms: 99999 });
  assert.equal(ign.reason, 'good_time_ignored'); assert.deepEqual(ign.time, { cls: 'ignored', why: 'extreme' });
  assert.equal(d({ result: 'correct', interrupted: true }).time.why, 'interrupted');
  assert.equal(d({ result: 'correct', ms: null }).time.why, 'unknown_time');
});

test('tiempos o mediana ilegibles se ignoran sin lanzar ni dar NaN (reloj hacia atrás, valores raros)', () => {
  const bad = [NaN, Infinity, -Infinity, -1, 0, null, undefined, '5000', {}, [], true];
  for (const ms of bad) {
    const r = rateDetailed({ result: 'correct', ms }, B);
    assert.equal(r.rating, RATING.good, `ms=${String(ms)}`); assert.equal(r.time.cls, 'ignored');
  }
  for (const base of [NaN, 0, -5, Infinity, null, undefined, '10000']) {
    const r = rateDetailed({ result: 'correct', ms: 4000 }, base);
    assert.equal(r.rating, RATING.good, `mediana=${String(base)}`); assert.equal(r.time.why, 'no_baseline');
  }
});

test('entradas mal formadas lanzan un error claro en español (no rating silencioso)', () => {
  for (const x of [null, undefined, 5, 'correct', [], () => 1]) assert.throws(() => rate(x, B), /grading: se necesita un objeto/);
  for (const result of ['Correct', 'ok', '', null, undefined, 3, 'toString']) assert.throws(() => rate({ result, ms: 1 }, B), /result debe ser uno de/);
  for (const k of ['hint', 'dontKnow', 'interrupted']) {
    for (const v of ['true', 1, 0, {}]) assert.throws(() => rate({ result: 'correct', ms: 1, [k]: v }, B), new RegExp(`${k} debe ser verdadero o falso`));
  }
  assert.equal(rate({ result: 'correct', ms: B, hint: null, dontKnow: undefined }, B), RATING.good); // null/undefined = false
});

test('rate no modifica ni conserva su entrada, y da el mismo resultado siempre (puro)', () => {
  const input = Object.freeze({ result: 'correct', ms: 4000, hint: false, dontKnow: false });
  const first = rate(input, B);
  for (let i = 0; i < 50; i += 1) assert.equal(rate(input, B), first);
  assert.equal(rate({ ...input, extra: 'ignorado' }, B), first);
});

test('la configuración entregada es válida, está congelada y usa los valores del roadmap', () => {
  assert.deepEqual(validateConfig(GRADING), { ok: true, problems: [] });
  assert.equal(GRADING.slowFactor, 1.8); assert.equal(GRADING.fastFactor, 0.6); assert.equal(GRADING.ignoreFactor, 5);
  assert.equal(GRADING.minSamples, 8); assert.equal(GRADING.window, 30);
  for (const o of [GRADING, FAMILY_BASELINE_MS, TYPE_BASELINE_MS]) assert.ok(Object.isFrozen(o));
});

test('validateConfig rechaza configuraciones incoherentes, y rate no las acepta', () => {
  const ok = { ...GRADING };
  const cases = [
    [{ ...ok, fastFactor: 1 }, /fastFactor debe ser menor que 1/], [{ ...ok, fastFactor: 0 }, /fastFactor/],
    [{ ...ok, slowFactor: 1 }, /slowFactor debe ser mayor que 1/], [{ ...ok, slowFactor: NaN }, /slowFactor/],
    [{ ...ok, ignoreFactor: 1.8 }, /ignoreFactor debe ser mayor que slowFactor/], [{ ...ok, ignoreFactor: -1 }, /ignoreFactor/],
    [{ ...ok, interruptAfterHiddenMs: -1 }, /interruptAfterHiddenMs/], [{ ...ok, interruptAfterHiddenMs: NaN }, /interruptAfterHiddenMs/],
    [{ ...ok, lookbackDays: 0 }, /lookbackDays/], [{ ...ok, lookbackDays: 1.5 }, /lookbackDays/],
    [{ ...ok, minSamples: 0 }, /minSamples/], [{ ...ok, window: 2.5 }, /window/], [{ ...ok, minSamples: 31 }, /minSamples no puede superar window/],
    [{ ...ok, fallbackBaselineMs: 0 }, /fallbackBaselineMs/],
  ];
  for (const [cfg, re] of cases) {
    const v = validateConfig(cfg);
    assert.equal(v.ok, false); assert.match(v.problems.join(' '), re);
    assert.throws(() => rate({ result: 'correct', ms: 1 }, B, cfg), /configuración no válida/);
  }
  for (const x of [null, undefined, 5, 'x']) assert.equal(validateConfig(x).ok, false);
});

test('una configuración propia cambia los cortes (todo sale de la config, nada fijo en el código)', () => {
  const cfg = { ...GRADING, slowFactor: 3, fastFactor: 0.2, ignoreFactor: 10 };
  assert.equal(rate({ result: 'correct', ms: 20000 }, B, cfg), RATING.good); // con 1,8 × sería Hard
  assert.equal(rate({ result: 'correct', ms: 3000 }, B, cfg), RATING.good); // con 0,6 × sería Easy
  assert.equal(rate({ result: 'correct', ms: 31000 }, B, cfg), RATING.hard);
  assert.equal(rate({ result: 'correct', ms: 101000 }, B, cfg), RATING.good);
  assert.equal(timeClass(1500, B, false, cfg).cls, 'fast');
});

test('constantes por tipo: las 12 familias y los 85 tipos tienen mediana inicial positiva', () => {
  assert.deepEqual(Object.keys(FAMILY_BASELINE_MS).sort(), [...FAMILIES].sort());
  assert.equal(Object.keys(ITEM_TYPES).length, 85);
  for (const t of Object.keys(ITEM_TYPES)) {
    const ms = defaultBaselineMs(t);
    assert.ok(Number.isFinite(ms) && ms > 0, t);
    assert.equal(ms, TYPE_BASELINE_MS[t] ?? FAMILY_BASELINE_MS[ITEM_TYPES[t].family], t);
  }
  assert.equal(defaultBaselineMs('lightning'), 3000); // el tipo manda sobre su familia
  assert.equal(defaultBaselineMs('mcq_en_es'), FAMILY_BASELINE_MS.choice);
  for (const [k, v] of Object.entries(TYPE_BASELINE_MS)) { assert.ok(ITEM_TYPES[k], `${k} no es un tipo`); assert.ok(v > 0); }
});

test('tipos desconocidos o hostiles usan la constante general, sin excepciones', () => {
  const fb = GRADING.fallbackBaselineMs;
  for (const t of [...INTEGRATOR_TYPES, 'no_existe', '', 'constructor', '__proto__', 'toString', 'hasOwnProperty', null, undefined, 5, {}, ['choice']]) {
    assert.equal(defaultBaselineMs(t), fb, String(t));
  }
});

test('rendimiento: 100.000 calificaciones en < 200 ms', () => {
  const t0 = performance.now();
  let acc = 0;
  for (let i = 0; i < 100000; i += 1) acc += rate({ result: i % 7 === 0 ? 'wrong' : 'correct', ms: (i % 40) * 1000, hint: i % 11 === 0 }, B);
  assert.ok(acc > 0); assert.ok(performance.now() - t0 < 200, `tardó ${Math.round(performance.now() - t0)} ms`);
});
