// @purpose: Pruebas de core/masteryAgg.js: media ponderada por nivel y área, temas «Sin ver», en riesgo y a estudiar, vacíos y entradas inválidas.
// 1.7-T3: agregación y consultas puras. Los números esperados están calculados a mano con las reglas de 8.7 y de la ficha 1.7-T3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregate, atRisk, toStudy, weightOf } from '../core/masteryAgg.js';
import { MASTERY_CONFIG } from '../core/mastery.config.js';

const topic = (id, extra = {}) => ({ id, area: 'gram', level: 'A1', priority: 3, min_items: 12, status: 'draft', ...extra });
const res = (topicId, pct, extra = {}) => ({
  topicId, pct, evidence: pct > 0 ? 5 : 0, band: 'x', confidence: 'low', caps: [], signals: { R: 0.9, P: null, U: null, E: 0 }, ...extra,
});
const ids = (list) => list.map((x) => x.topicId);

// ---------- weightOf ----------
test('weightOf: itemCount manda; sin él, min_items; lo inválido pesa 0', () => {
  assert.equal(weightOf({ id: 'a', itemCount: 30, min_items: 12 }), 30);
  assert.equal(weightOf({ id: 'a', min_items: 12 }), 12);
  assert.equal(weightOf({ id: 'a', itemCount: 0, min_items: 12 }), 0);
  assert.equal(weightOf({ id: 'a', itemCount: -1, min_items: 12 }), 12);
  assert.equal(weightOf({ id: 'a', itemCount: 'x', min_items: NaN }), 0);
  assert.equal(weightOf({ id: 'a' }), 0);
  assert.equal(weightOf(null), 0);
  assert.equal(weightOf({ id: 'a', itemCount: Infinity, min_items: 12 }), 12);
  assert.equal(weightOf({ id: 'a', itemCount: Infinity }), 0);
});

// ---------- aggregate ----------
test('aggregate por nivel: media ponderada con los «Sin ver» a 0 (cifras a mano)', () => {
  const topics = [
    topic('t1', { level: 'A1' }), topic('t2', { level: 'A1' }),
    topic('t3', { level: 'A2', itemCount: 30 }), topic('t4', { level: 'A2', itemCount: 10 }),
  ];
  const results = [res('t1', 80), res('t3', 50), res('t4', 20)]; // t2 sin resultado = Sin ver
  const out = aggregate(topics, results, { by: 'level' });
  assert.deepEqual(out.groups.map((g) => g.key), ['A1', 'A2']);
  const [a1, a2] = out.groups;
  // A1: (12·80 + 12·0) / 24 = 40
  assert.deepEqual([a1.topics, a1.seen, a1.weight, a1.avg, a1.pct, a1.band], [2, 1, 24, 40, 40, 'progress']);
  // A2: (30·50 + 10·20) / 40 = 42,5 → 43
  assert.deepEqual([a2.topics, a2.seen, a2.weight, a2.avg, a2.pct, a2.band], [2, 2, 40, 42.5, 43, 'progress']);
  assert.deepEqual([a2.label, a2.symbol], ['En progreso', '◑']);
  // todo: (960 + 0 + 1500 + 200) / 64 = 41,5625 → 42
  assert.deepEqual([out.all.key, out.all.topics, out.all.seen, out.all.weight, out.all.pct], ['all', 4, 3, 64, 42]);
  assert.deepEqual(out.skipped, []);
});

test('aggregate por área: agrupa por `area` y conserva el orden de primera aparición', () => {
  const topics = [topic('a', { area: 'verb' }), topic('b', { area: 'gram' }), topic('c', { area: 'verb' })];
  const out = aggregate(topics, new Map([['a', res('a', 100)], ['c', res('c', 60)]]), { by: 'area' });
  assert.deepEqual(out.groups.map((g) => g.key), ['verb', 'gram']);
  assert.equal(out.groups[0].pct, 80); // (12·100 + 12·60) / 24
  assert.equal(out.groups[1].pct, 0);
  assert.equal(out.groups[1].band, 'unseen');
});

test('aggregate: los niveles salen en el orden del config y los desconocidos al final por orden alfabético', () => {
  const topics = ['C1', 'zz', 'A2', 'PreA1', 'aa', 'B1'].map((l) => topic(`t_${l}`, { level: l }));
  const out = aggregate(topics, [], { by: 'level' });
  assert.deepEqual(out.groups.map((g) => g.key), ['PreA1', 'A2', 'B1', 'C1', 'aa', 'zz']);
});

test('aggregate: un grupo sin nada visto vale 0 «Sin ver» y confianza baja', () => {
  const out = aggregate([topic('a'), topic('b')], [], { by: 'level' });
  const g = out.groups[0];
  assert.deepEqual([g.pct, g.band, g.label, g.symbol, g.seen, g.confidence], [0, 'unseen', 'Sin ver', '○', 0, 'low']);
});

test('aggregate: con algo visto el mínimo es 1 (nunca «Sin ver») aunque la media redondee a 0', () => {
  const topics = [topic('v', { itemCount: 1 }), topic('u', { itemCount: 1000 })];
  const g = aggregate(topics, [res('v', 1)], { by: 'level' }).groups[0];
  assert.equal(g.avg < 0.5, true);
  assert.deepEqual([g.pct, g.band], [1, 'initial']);
});

test('aggregate: un tema con peso 0 no pesa; si todos pesan 0 y hay algo visto, vale 1', () => {
  const topics = [topic('a', { itemCount: 10 }), topic('b', { itemCount: 0 })];
  assert.equal(aggregate(topics, [res('a', 40), res('b', 100)], { by: 'level' }).groups[0].pct, 40);
  const zero = [topic('a', { itemCount: 0, min_items: 0 })];
  const g = aggregate(zero, [res('a', 90)], { by: 'level' }).groups[0];
  assert.deepEqual([g.weight, g.avg, g.pct, g.seen], [0, 0, 1, 1]);
});

test('aggregate: un resultado con evidencia 0 cuenta como «Sin ver» aunque traiga pct', () => {
  const g = aggregate([topic('a')], [res('a', 70, { evidence: 0 })], { by: 'level' }).groups[0];
  assert.deepEqual([g.seen, g.pct], [0, 0]);
});

test('aggregate: los temas sin level/area se listan en skipped y solo cuentan en `all`', () => {
  const topics = [topic('a'), topic('b', { level: undefined }), topic('c', { level: '' }), topic('d', { level: 4 })];
  const out = aggregate(topics, [res('a', 50), res('b', 50)], { by: 'level' });
  assert.deepEqual(out.skipped, ['b', 'c', 'd']);
  assert.deepEqual(out.groups.map((g) => [g.key, g.topics]), [['A1', 1]]);
  assert.equal(out.all.topics, 4);
});

test('aggregate: la confianza del grupo es el nivel medio ponderado de los temas vistos, redondeado hacia abajo', () => {
  const conf = (a, wa, b, wb) => aggregate(
    [topic('a', { itemCount: wa }), topic('b', { itemCount: wb })],
    [res('a', 50, { confidence: a }), res('b', 50, { confidence: b })], { by: 'level' },
  ).groups[0].confidence;
  assert.equal(conf('low', 12, 'high', 12), 'mid'); // (0·12 + 2·12) / 24 = 1
  assert.equal(conf('low', 30, 'high', 10), 'low'); // 20 / 40 = 0,5 → 0
  assert.equal(conf('mid', 10, 'high', 10), 'mid'); // 1,5 → 1
  assert.equal(conf('high', 5, 'high', 7), 'high');
  assert.equal(conf('mystery', 10, 'high', 2), 'low'); // desconocida = baja: 4 / 12 = 0,33
});

test('aggregate: sin temas, estructura vacía y sin NaN', () => {
  const out = aggregate([], [], { by: 'area' });
  assert.deepEqual(out.groups, []);
  assert.deepEqual(out.skipped, []);
  assert.deepEqual([out.all.topics, out.all.seen, out.all.weight, out.all.avg, out.all.pct, out.all.band, out.all.confidence], [0, 0, 0, 0, 0, 'unseen', 'low']);
  for (const v of Object.values(out.all)) assert.equal(Number.isNaN(v), false);
});

test('aggregate: más aciertos en un tema nunca bajan el % del grupo (monotonía)', () => {
  const topics = [topic('a'), topic('b', { itemCount: 7 })];
  let last = -1;
  for (const pct of [0, 1, 10, 29, 30, 59, 60, 84, 85, 100]) {
    const g = aggregate(topics, [res('a', pct), res('b', 33)], { by: 'level' }).groups[0];
    assert.ok(g.pct >= last, `${pct}: ${g.pct} < ${last}`);
    last = g.pct;
  }
});

test('aggregate: entradas inválidas lanzan un error en español', () => {
  const t = [topic('a')];
  assert.throws(() => aggregate(null, [], { by: 'level' }), /topics debe ser una lista/);
  assert.throws(() => aggregate([{ level: 'A1' }], [], { by: 'level' }), /cada tema/);
  assert.throws(() => aggregate([null], [], { by: 'level' }), /cada tema/);
  assert.throws(() => aggregate([{ id: '' }], [], { by: 'level' }), /cada tema/);
  assert.throws(() => aggregate(t, [], { by: 'nivel' }), /`by` debe ser/);
  assert.throws(() => aggregate(t, [], {}), /`by` debe ser/);
  assert.throws(() => aggregate(t, [], undefined), /`by` debe ser/);
  assert.throws(() => aggregate(t, 'nada', { by: 'level' }), /results debe ser/);
  assert.throws(() => aggregate(t, null, { by: 'level' }), /results debe ser/);
});

test('aggregate: ignora resultados mal formados sin romperse', () => {
  const g = aggregate([topic('a')], [null, 7, { pct: 50 }, res('a', 50)], { by: 'level' }).groups[0];
  assert.equal(g.pct, 50);
});

// ---------- atRisk ----------
test('atRisk: R por debajo del umbral (estricto), error recurrente o tope activo', () => {
  const topics = ['low', 'edge', 'norm', 'err', 'cap', 'nullR', 'all'].map((id) => topic(id));
  const results = [
    res('low', 50, { signals: { R: 0.69, P: null, U: null, E: 0 } }),
    res('edge', 50, { signals: { R: 0.7, P: null, U: null, E: 0 } }),
    res('norm', 50),
    res('err', 50, { signals: { R: 0.95, P: null, U: null, E: 0.25 } }),
    res('cap', 50, { caps: [{ kind: 'consecutive_fails', key: 'c#0' }] }),
    res('nullR', 50, { signals: { R: null, P: 0.2, U: null, E: 0 } }),
    res('all', 40, { signals: { R: 0.1, P: null, U: null, E: 0.5 }, caps: [{ kind: 'recurrent_error', code: 'X', inWindow: 3 }] }),
  ];
  const out = atRisk(topics, results);
  assert.deepEqual(ids(out), ['all', 'cap', 'err', 'low']); // más razones primero; con igual pct (50), por id
  assert.deepEqual(out[0].reasons, ['low_retention', 'recurrent_error', 'cap']);
  assert.deepEqual([out[1].reasons, out[2].reasons, out[3].reasons], [['cap'], ['recurrent_error'], ['low_retention']]);
  assert.deepEqual([out[2].R, out[2].E, out[2].priority], [0.95, 0.25, 3]);
});

test('atRisk: sin respuestas no hay riesgo; deprecated se excluye y draft cuenta', () => {
  const risky = { signals: { R: 0.1, P: null, U: null, E: 0 } };
  const topics = [topic('unseen'), topic('dep', { status: 'deprecated' }), topic('draft'), topic('act', { status: 'active' }), topic('nores')];
  const results = [res('unseen', 0, { ...risky, evidence: 0 }), res('dep', 30, risky), res('draft', 30, risky), res('act', 31, risky)];
  assert.deepEqual(ids(atRisk(topics, results)), ['draft', 'act']);
});

test('atRisk: el umbral sale del config y los empates se ordenan por pct y luego id', () => {
  const cfg = { ...MASTERY_CONFIG, atRisk: { retention: 0.95 } };
  const topics = [topic('b'), topic('a'), topic('c')];
  const results = [res('b', 20), res('a', 20), res('c', 10)];
  assert.deepEqual(ids(atRisk(topics, results, { config: cfg })), ['c', 'a', 'b']);
  assert.deepEqual(atRisk(topics, results), []); // con el umbral por defecto (0,7) R = 0,9 no es riesgo
});

test('atRisk: vacíos y entradas inválidas', () => {
  assert.deepEqual(atRisk([], []), []);
  assert.deepEqual(atRisk([topic('a')], []), []);
  assert.throws(() => atRisk('x', []), /topics debe ser una lista/);
  assert.throws(() => atRisk([topic('a')], 5), /results debe ser/);
  assert.deepEqual(atRisk([topic('a')], [res('a', 50, { signals: null, caps: 'x' })]), []);
});

// ---------- toStudy ----------
test('toStudy: «Sin ver», «Inicial» y «En progreso» entran; «Sólido» y «Dominado» no (bordes 59/60)', () => {
  const pcts = { u: 0, i1: 1, i29: 29, p30: 30, p59: 59, s60: 60, s84: 84, m85: 85, m100: 100 };
  const topics = Object.keys(pcts).map((id) => topic(id));
  const out = toStudy(topics, Object.entries(pcts).map(([id, p]) => res(id, p)));
  assert.deepEqual(ids(out).sort(), ['i1', 'i29', 'p30', 'p59', 'u']);
  assert.deepEqual(out.map((x) => x.band).sort(), ['initial', 'initial', 'progress', 'progress', 'unseen']);
});

test('toStudy: ordena por priority (1 primero), luego dominio ascendente y luego id', () => {
  const topics = [
    topic('p3a', { priority: 3 }), topic('p1b', { priority: 1 }), topic('p1a', { priority: 1 }),
    topic('p1low', { priority: 1 }), topic('p5', { priority: 5 }), topic('none', { priority: undefined }), topic('bad', { priority: 'x' }),
  ];
  const results = [res('p1b', 40), res('p1a', 40), res('p1low', 10), res('p3a', 5), res('p5', 0), res('none', 0), res('bad', 0)];
  assert.deepEqual(ids(toStudy(topics, results)), ['p1low', 'p1a', 'p1b', 'p3a', 'p5', 'bad', 'none']);
});

test('toStudy: sin resultado o con evidencia 0 es «Sin ver» (seen: false); deprecated no entra', () => {
  const topics = [topic('new'), topic('zero'), topic('dep', { status: 'deprecated' }), topic('seen')];
  const out = toStudy(topics, [res('zero', 80, { evidence: 0 }), res('dep', 0), res('seen', 10)]);
  assert.deepEqual(out.map((x) => x.topicId).sort(), ['new', 'seen', 'zero']);
  assert.equal(out.find((x) => x.topicId === 'new').seen, false);
  assert.equal(out.find((x) => x.topicId === 'zero').pct, 0);
  assert.equal(out.find((x) => x.topicId === 'seen').seen, true);
});

test('toStudy: el corte sale del config (maxBand) y un id de banda desconocido deja solo «Sin ver»', () => {
  const topics = [topic('u'), topic('i'), topic('p')];
  const results = [res('i', 10), res('p', 40)];
  assert.deepEqual(ids(toStudy(topics, results, { config: { ...MASTERY_CONFIG, toStudy: { maxBand: 'initial' } } })).sort(), ['i', 'u']);
  assert.deepEqual(ids(toStudy(topics, results, { config: { ...MASTERY_CONFIG, toStudy: { maxBand: 'mastered' } } })).sort(), ['i', 'p', 'u']);
  assert.deepEqual(ids(toStudy(topics, results, { config: { ...MASTERY_CONFIG, toStudy: { maxBand: 'nope' } } })), ['u']);
});

test('toStudy: vacío e inválido', () => {
  assert.deepEqual(toStudy([], []), []);
  assert.throws(() => toStudy(undefined, []), /topics debe ser una lista/);
  assert.throws(() => toStudy([topic('a')], undefined), /results debe ser/);
  assert.throws(() => toStudy([{ id: 3 }], []), /cada tema/);
});

test('las consultas no modifican lo que reciben', () => {
  const topics = [topic('a'), topic('b', { priority: 1 })];
  const results = [res('a', 10, { caps: [{ kind: 'consecutive_fails', key: 'k' }] }), res('b', 20)];
  const before = JSON.stringify([topics, results]);
  aggregate(topics, results, { by: 'level' });
  atRisk(topics, results);
  toStudy(topics, results);
  assert.equal(JSON.stringify([topics, results]), before);
});

// ---------- endurecimiento tras la tanda de roturas (4.R) ----------
test('aggregate: devuelve `by`, el redondeo es al más cercano y el techo es 100', () => {
  assert.equal(aggregate([topic('a')], [], { by: 'area' }).by, 'area');
  const three = [topic('a', { itemCount: 1 }), topic('b', { itemCount: 1 }), topic('c', { itemCount: 1 })];
  assert.equal(aggregate(three, [res('a', 40), res('b', 40), res('c', 41)], { by: 'level' }).groups[0].pct, 40); // 40,33 → 40 (no 41)
  const all100 = aggregate(three, [res('a', 100), res('b', 100), res('c', 100)], { by: 'level' }).groups[0];
  assert.deepEqual([all100.pct, all100.band], [100, 'mastered']);
  assert.equal(aggregate([topic('a')], [res('a', 1000)], { by: 'level' }).groups[0].pct, 100); // un pct fuera de rango no pasa de 100
});

test('aggregate: la confianza no pierde un escalón por el error de la coma flotante', () => {
  const topics = [topic('a', { itemCount: 0.1 }), topic('b', { itemCount: 1.1 }), topic('c', { itemCount: 0.1 })];
  const results = [res('a', 50, { confidence: 'low' }), res('b', 50, { confidence: 'mid' }), res('c', 50, { confidence: 'high' })];
  assert.equal(aggregate(topics, results, { by: 'level' }).groups[0].confidence, 'mid'); // (0 + 1,1 + 0,2) / 1,3 = 1 (0,9999999999999998 en coma flotante)
});

test('resultados con datos raros no cuentan como vistos ni contaminan el % (texto, NaN, Infinity)', () => {
  const topics = [topic('a'), topic('b'), topic('c'), topic('d')];
  const results = [res('a', 50, { evidence: '3' }), res('b', 50, { evidence: NaN }), res('c', 50, { evidence: Infinity }), res('d', 50, { pct: NaN })];
  const g = aggregate(topics, results, { by: 'level' }).groups[0];
  assert.equal(g.seen, 1); // solo d (evidence 5 válido); su pct ilegible cuenta 0
  assert.equal(Number.isNaN(g.avg), false);
  assert.deepEqual([g.avg, g.pct, g.band], [0, 1, 'initial']);
});

test('atRisk: lo ilegible se ignora (E como texto) y las salidas por defecto son null, null y 0', () => {
  const topics = [topic('txt', { priority: undefined }), topic('nullR'), topic('noE'), topic('nan')];
  const results = [
    res('txt', 50, { signals: { R: 0.9, P: null, U: null, E: '0.5' } }),
    res('nullR', 50, { signals: { R: null, P: null, U: null, E: 0 }, caps: [{ kind: 'consecutive_fails', key: 'k' }] }),
    res('noE', 50, { signals: { R: 0.1 } }),
    res('nan', 50, { pct: NaN, caps: [{ kind: 'consecutive_fails', key: 'k' }] }),
  ];
  const out = atRisk(topics, results);
  assert.deepEqual(ids(out), ['nan', 'noE', 'nullR']); // pct 0 primero; txt no es riesgo
  assert.deepEqual([out[0].pct, out[1].R, out[1].E, out[2].R, out[2].E], [0, 0.1, 0, null, 0]);
  const txt = atRisk([topic('p', { priority: undefined })], [res('p', 50, { caps: [{ kind: 'consecutive_fails', key: 'k' }] })]);
  assert.equal(txt[0].priority, null);
});
