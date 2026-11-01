// @purpose: Pruebas del dominio por tema (core/mastery.js): combinación de señales, bandas, confianza y topes por descenso.
// 1.7-T2: combinación de señales, bandas, confianza, topes por descenso y masteryToSophiaVal (CA 1–5 de la subparte).
// Los números esperados están calculados a mano con las reglas de 8.7 y 7.5, sin leer el código que se prueba.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createMastery, bandOf, combine, confidenceOf, masteryToSophiaVal } from '../core/mastery.js';
import { createEvents } from '../core/events.js';
import { createErrors } from '../core/errors.js';
import { createErrorCatalog } from '../core/errorCatalog.js';
import { createSrs } from '../core/srsEngine.js';
import { RATING } from '../core/srs.js';
import { createMemoryDb } from '../core/db.memory.js';
import { makeClock } from './_helpers.mjs';

const NOW = new Date('2026-10-20T12:00:00.000Z');
const DAY = 86400000;
const HOUR = 3600000;
const T = 'gram.present_perfect.for_since';
const at = (days) => new Date(NOW.getTime() - days * DAY);
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);
const CATALOG = createErrorCatalog(JSON.parse(fs.readFileSync(new URL('../content/taxonomy/error_codes.json', import.meta.url), 'utf8')));

async function world(extra = {}) {
  const db = createMemoryDb();
  await db.open();
  const clock = makeClock(NOW.toISOString());
  const events = createEvents({ db, clock });
  const errors = createErrors({ db, catalog: CATALOG, clock });
  const srs = createSrs();
  const mastery = createMastery({ db, events, errors, srs, clock, ...extra });
  return { db, events, errors, srs, mastery };
}
// Tarjeta del tema repasada en las fechas dadas: [[rating, Date], …].
async function card(w, itemId, reviews, topics = [T]) {
  let c = w.srs.newCard(itemId, 0, reviews[0][1], topics);
  for (const [rating, when] of reviews) c = w.srs.review(c, rating, when);
  await w.db.put('cards', c);
  return c;
}
let n = 0;
async function ans(w, { item = 'it1', result = 'correct', when = at(0), type = 'fix_error', session = 's1', topics = [T] } = {}) {
  n += 1;
  return w.events.log({
    ts: when.toISOString(), type: 'answer', sessionId: session, cardId: `${item}#0`, itemId: item, topics, exerciseType: type,
    result, rating: result === 'correct' ? 3 : 1, ms: 5000, hint: false, dontKnow: result === 'dont_know', responseRaw: `r${n}`, errorCodes: [], mode: 'mech', channel: 'keyboard',
  });
}

// ---------- funciones puras ----------
test('bandOf: bordes 0, 1, 29, 30, 59, 60, 84, 85 y 100 (CA 5)', () => {
  const cases = [[0, 'unseen'], [1, 'initial'], [29, 'initial'], [30, 'progress'], [59, 'progress'], [60, 'solid'], [84, 'solid'], [85, 'mastered'], [100, 'mastered']];
  for (const [pct, id] of cases) assert.equal(bandOf(pct).id, id, String(pct));
  assert.deepEqual([bandOf(0).label, bandOf(1).label, bandOf(30).label, bandOf(60).label, bandOf(85).label], ['Sin ver', 'Inicial', 'En progreso', 'Sólido', 'Dominado']);
  assert.deepEqual([bandOf(0).symbol, bandOf(100).symbol], ['○', '●']);
});

test('bandOf: el decimal se redondea al entero más cercano (29,49 → Inicial; 29,5 → En progreso; 84,5 → Dominado) y lo ilegible lanza', () => {
  assert.equal(bandOf(29.49).id, 'initial');
  assert.equal(bandOf(29.5).id, 'progress');
  assert.equal(bandOf(59.5).id, 'solid');
  assert.equal(bandOf(84.5).id, 'mastered');
  assert.equal(bandOf(-3).id, 'unseen');
  assert.equal(bandOf(250).id, 'mastered');
  for (const bad of [NaN, Infinity, '50', null, undefined]) assert.throws(() => bandOf(bad), /pct/);
});

test('combine: pesos 0,35 · 0,30 · 0,20 · 0,15 (todo perfecto = 100; todo malo = 0)', () => {
  close(combine({ R: 1, P: 1, U: 1, E: 0 }), 100);
  close(combine({ R: 0, P: 0, U: 0, E: 1 }), 0);
  close(combine({ R: 1, P: 0, U: 0, E: 1 }), 35);
  close(combine({ R: 0, P: 1, U: 0, E: 1 }), 30);
  close(combine({ R: 0, P: 0, U: 1, E: 1 }), 20);
  close(combine({ R: 0, P: 0, U: 0, E: 0 }), 15);
  close(combine({ R: 0.7, P: 0.4, U: 0.5, E: 0.2 }), 100 * (0.35 * 0.7 + 0.3 * 0.4 + 0.2 * 0.5 + 0.15 * 0.8));
});

test('combine: U null reparte los pesos en proporción entre R, P y E (CA 4)', () => {
  close(combine({ R: 0.5, P: 0.5, U: null, E: 0 }), (100 * (0.35 * 0.5 + 0.3 * 0.5 + 0.15)) / 0.8);
  close(combine({ R: 1, P: 1, U: null, E: 0 }), 100);
  close(combine({ R: 0, P: 0, U: null, E: 1 }), 0);
  close(combine({ R: null, P: 1, U: null, E: 0 }), 100); // sin R ni U: P y E se reparten 0,30 y 0,15
  close(combine({ R: null, P: 0, U: null, E: 0 }), (100 * 0.15) / 0.45);
});

test('combine: sin ninguna señal positiva (R, P y U nulas) no hay dominio que calcular → null', () => {
  assert.equal(combine({ R: null, P: null, U: null, E: 0 }), null);
  assert.equal(combine({ R: null, P: null, U: null, E: 1 }), null);
});

test('combine: monotonía — subir una señal positiva o bajar E nunca baja el resultado', () => {
  for (const key of ['R', 'P', 'U']) {
    let prev = -1;
    for (let v = 0; v <= 1.0001; v += 0.1) { const x = combine({ R: 0.3, P: 0.3, U: 0.3, E: 0.3, [key]: v }); assert.ok(x >= prev - 1e-9); prev = x; }
  }
  let prev = 1e9;
  for (let e = 0; e <= 1.0001; e += 0.1) { const x = combine({ R: 0.5, P: 0.5, U: 0.5, E: e }); assert.ok(x <= prev + 1e-9); prev = x; }
});

const evs = (count, { sessions = 1, days = 0, types = 1 } = {}) => Array.from({ length: count }, (_, i) => ({
  ts: new Date(NOW.getTime() - (days === 0 ? 0 : (i % (days + 1)) * DAY)).toISOString(), sessionId: `s${i % sessions}`, exerciseType: `t${i % types}`,
}));

test('confianza: baja < 8 eventos o 1 sola sesión; media ≥ 8 y ≥ 2 sesiones; alta ≥ 20, ≥ 3 sesiones en ≥ 7 días y ≥ 2 tipos (con U)', () => {
  assert.equal(confidenceOf(evs(7, { sessions: 3 }), true), 'low');
  assert.equal(confidenceOf(evs(8, { sessions: 1 }), true), 'low');
  assert.equal(confidenceOf(evs(8, { sessions: 2 }), true), 'mid');
  assert.equal(confidenceOf(evs(19, { sessions: 3, days: 7, types: 2 }), true), 'mid');
  assert.equal(confidenceOf(evs(20, { sessions: 2, days: 7, types: 2 }), true), 'mid');
  assert.equal(confidenceOf(evs(20, { sessions: 3, days: 6, types: 2 }), true), 'mid');
  assert.equal(confidenceOf(evs(20, { sessions: 3, days: 7, types: 1 }), true), 'mid');
  assert.equal(confidenceOf(evs(20, { sessions: 3, days: 7, types: 2 }), true), 'high');
});

test('confianza: sin U baja un escalón (alta → media, media → baja, baja se queda) (CA 4)', () => {
  assert.equal(confidenceOf(evs(20, { sessions: 3, days: 7, types: 2 }), false), 'mid');
  assert.equal(confidenceOf(evs(8, { sessions: 2 }), false), 'low');
  assert.equal(confidenceOf(evs(3), false), 'low');
});

test('confianza: sin sessionId, cada día local cuenta como una sesión', () => {
  const noSes = (days) => days.map((d) => ({ ts: at(d).toISOString(), exerciseType: 'a' }));
  assert.equal(confidenceOf(noSes([0, 0, 0, 0, 0, 0, 0, 0]), true), 'low');
  assert.equal(confidenceOf(noSes([0, 0, 0, 0, 2, 2, 2, 2]), true), 'mid');
});

test('masteryToSophiaVal: 0 % → 0 y 100 % → 4, redondeo a la unidad más cercana, recortado, y lo ilegible lanza', () => {
  assert.deepEqual([0, 12, 13, 37, 38, 62, 63, 87, 88, 100].map(masteryToSophiaVal), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  assert.equal(masteryToSophiaVal(150), 4);
  assert.equal(masteryToSophiaVal(-5), 0);
  assert.throws(() => masteryToSophiaVal(NaN), /pct/);
  assert.throws(() => masteryToSophiaVal('50'), /pct/);
});

// ---------- compute: escenarios ----------
test('CA 1: sin eventos → 0 % «Sin ver», confianza baja, sin evidencia (aunque haya tarjetas)', async () => {
  const w = await world();
  const out = await w.mastery.compute(T, NOW);
  assert.deepEqual([out.pct, out.rawPct, out.band, out.label, out.symbol, out.confidence, out.evidence, out.caps], [0, 0, 'unseen', 'Sin ver', '○', 'low', 0, []]);
  await card(w, 'it1', [[RATING.GOOD, at(1)]]);
  assert.equal((await w.mastery.compute(T, NOW)).pct, 0);
  await ans(w, { topics: ['otro.tema'] });
  assert.equal((await w.mastery.compute(T, NOW)).pct, 0, 'un evento de otro tema no cuenta');
});

test('estudiante nuevo: una respuesta correcta de producción y la tarjeta recién repasada → el % crudo es alto, pero el tope por evidencia lo deja en 59 con confianza BAJA (FIX 2.9-T4)', async () => {
  const w = await world();
  await card(w, 'it1', [[RATING.GOOD, at(0.01)]]);
  await ans(w, { when: at(0.01) });
  const out = await w.mastery.compute(T, NOW);
  assert.ok(out.rawPct >= 85, `raw=${out.rawPct}`); // la fórmula sola diría «Dominado»…
  assert.equal(out.pct, 59); // …pero con 1 respuesta y 1 ítem el tope por evidencia manda
  assert.equal(out.band, 'progress');
  assert.equal(out.lowEvidence, true);
  assert.equal(out.confidence, 'low');
  assert.equal(out.evidence, 1);
  assert.equal(out.signals.U, null);
  assert.equal(out.signals.E, 0);
  assert.deepEqual(out.caps, []); // el tope por evidencia no es un descenso: no entra en `caps`
});

test('estudiante que falla: repasos con «Again» y fallos de producción hace 20 días → dominio bajo (< 45 %), P = 0 y nunca 0 %', async () => {
  const w = await world();
  await card(w, 'it1', [[RATING.AGAIN, at(21)], [RATING.AGAIN, at(20)]]);
  for (let i = 0; i < 3; i += 1) await ans(w, { item: `x${i}`, result: 'wrong', when: at(20 - i * 0.1) });
  await ans(w, { item: 'it1', result: 'dont_know', when: at(20) });
  const out = await w.mastery.compute(T, NOW);
  assert.ok(out.pct >= 1 && out.pct < 45, `pct=${out.pct}`);
  assert.equal(out.signals.P, 0);
  assert.ok(out.signals.R < 0.5);
  const strong = await world();
  await card(strong, 'it1', [[RATING.GOOD, at(0.02)]]);
  await ans(strong, { when: at(0.02) });
  assert.ok(out.pct < (await strong.mastery.compute(T, NOW)).pct);
});

test('vuelve tras 3 semanas: sin eventos nuevos el dominio baja con el tiempo (R decae) y la banda no sube', async () => {
  const w = await world();
  await card(w, 'it1', [[RATING.GOOD, at(30)], [RATING.GOOD, at(29)]]);
  for (let i = 0; i < 6; i += 1) await ans(w, { item: 'it1', when: at(29 - i * 0.01) });
  const early = await w.mastery.compute(T, at(28.9));
  const late = await w.mastery.compute(T, NOW);
  assert.ok(late.signals.R < early.signals.R, `R ${late.signals.R} vs ${early.signals.R}`);
  assert.ok(late.pct <= early.pct, `${late.pct} > ${early.pct}`);
});

test('CA 2: monotonía — más aciertos seguidos nunca bajan el % (con dos fallos al principio)', async () => {
  const w = await world();
  await card(w, 'it1', [[RATING.GOOD, at(0.02)]]);
  await ans(w, { result: 'wrong', when: at(0.5) });
  await ans(w, { result: 'wrong', when: at(0.4) });
  let prev = (await w.mastery.compute(T, NOW)).pct;
  for (let i = 0; i < 6; i += 1) {
    await ans(w, { result: 'correct', when: new Date(NOW.getTime() - (5 - i) * HOUR) });
    const now = (await w.mastery.compute(T, NOW)).pct;
    assert.ok(now >= prev, `${now} < ${prev} tras el acierto ${i + 1}`);
    prev = now;
  }
});

test('CA 3: dos fallos seguidos en la misma tarjeta → tope en el máximo de la banda inferior (84); un acierto posterior lo levanta', async () => {
  const w = await world();
  await card(w, 'x', [[RATING.GOOD, at(0.02)]]);
  for (let i = 0; i < 8; i += 1) { await card(w, `ok${i}`, [[RATING.GOOD, at(0.02)]]); await ans(w, { item: `ok${i}`, when: at(1 - i * 0.05) }); }
  const before = await w.mastery.compute(T, NOW);
  assert.ok(before.rawPct >= 85 && before.pct === before.rawPct, `antes: ${before.rawPct}`);
  await ans(w, { item: 'x', result: 'wrong', when: at(0.3) });
  await ans(w, { item: 'x', result: 'dont_know', when: at(0.2) });
  const capped = await w.mastery.compute(T, NOW);
  assert.ok(capped.rawPct >= 85, `raw=${capped.rawPct}`);
  assert.equal(capped.pct, 84);
  assert.equal(capped.band, 'solid');
  assert.deepEqual(capped.caps, [{ kind: 'consecutive_fails', key: 'x#0' }]);
  await ans(w, { item: 'x', result: 'correct', when: at(0.1) });
  const lifted = await w.mastery.compute(T, NOW);
  assert.deepEqual(lifted.caps, []);
  assert.equal(lifted.pct, lifted.rawPct);
});

test('CA 3: un solo fallo, o dos fallos en tarjetas distintas, no activan el tope', async () => {
  const w = await world();
  for (let i = 0; i < 6; i += 1) { await card(w, `ok${i}`, [[RATING.GOOD, at(0.02)]]); await ans(w, { item: `ok${i}`, when: at(1 - i * 0.05) }); }
  await ans(w, { item: 'a', result: 'wrong', when: at(0.3) });
  await ans(w, { item: 'b', result: 'wrong', when: at(0.2) });
  assert.deepEqual((await w.mastery.compute(T, NOW)).caps, []);
});

test('CA 3: el mismo error 3 veces en 14 días → tope (84); un acierto del tema posterior a la última vez lo levanta; fuera de los 14 días no hay tope', async () => {
  const w = await world();
  await card(w, 'it1', [[RATING.GOOD, at(0.02)]]);
  for (let i = 0; i < 6; i += 1) await ans(w, { item: `it${1 + (i % 3)}`, when: at(10 - i) }); // 6 respuestas y 3 ítems: el tope por evidencia no interviene
  const rec = (days) => w.errors.record({ original: 'I live here since 2010', code: 'TNS.SINCE_FOR', topics: [T], ts: at(days).toISOString() });
  await rec(5); await rec(3);
  assert.deepEqual((await w.mastery.compute(T, NOW)).caps, []);
  await rec(1);
  const capped = await w.mastery.compute(T, NOW);
  assert.ok(capped.rawPct >= 85, `raw=${capped.rawPct}`);
  assert.equal(capped.pct, 84);
  assert.deepEqual(capped.caps, [{ kind: 'recurrent_error', code: 'TNS.SINCE_FOR', inWindow: 3 }]);
  assert.ok(capped.signals.E > 0);
  await ans(w, { item: 'it1', when: at(0.5) });
  const lifted = await w.mastery.compute(T, NOW);
  assert.deepEqual(lifted.caps, []);
  assert.equal(lifted.pct, lifted.rawPct);
  const later = await w.mastery.compute(T, new Date(NOW.getTime() + 20 * DAY)); // pasó la ventana de 14 días
  assert.deepEqual(later.caps, []);
  assert.equal(later.signals.E, 0);
});

test('CA 3: desde «En progreso» el tope lleva a «Inicial» (29); en «Inicial» no hay banda inferior que mostrar y el % no cambia', async () => {
  const w = await world();
  for (let i = 0; i < 3; i += 1) await card(w, `ok${i}`, [[RATING.GOOD, at(30)], [RATING.GOOD, at(18)]]);
  await card(w, 'x', [[RATING.AGAIN, at(21)], [RATING.AGAIN, at(20)]]);
  for (let i = 0; i < 3; i += 1) await ans(w, { item: `ok${i}`, when: at(18 - i * 0.1) });
  for (let i = 0; i < 3; i += 1) await ans(w, { item: `ok${i}`, result: 'wrong', when: at(12 - i * 0.1) });
  await ans(w, { item: 'x', result: 'wrong', when: at(20) });
  await ans(w, { item: 'x', result: 'wrong', when: at(19) });
  const mid = await w.mastery.compute(T, NOW);
  assert.equal(mid.lowEvidence, false); // 8 respuestas y 4 ítems
  assert.equal(mid.band, 'initial');
  assert.equal(mid.caps.length, 1);
  assert.equal(mid.pct, 29);
  assert.ok(mid.rawPct >= 30 && mid.rawPct < 60, `raw=${mid.rawPct}`);
  const low = await world(); // sin tarjetas, P = 0 y un error que reincide 6 veces: E = 1 → el % crudo es el mínimo (1)
  await ans(low, { item: 'it1', result: 'wrong', when: at(2) });
  await ans(low, { item: 'it1', result: 'wrong', when: at(1.5) });
  for (let d = 6; d >= 1; d -= 1) await low.errors.record({ original: 'I live here since 2010', code: 'TNS.SINCE_FOR', topics: [T], ts: at(d).toISOString() });
  const out = await low.mastery.compute(T, NOW);
  assert.equal(out.signals.E, 1);
  assert.equal(out.rawPct, 1);
  assert.deepEqual(out.caps.map((c) => c.kind).sort(), ['consecutive_fails', 'recurrent_error']);
  assert.equal(out.pct, 1);
  assert.equal(out.band, 'initial');
});

test('con respuestas pero sin ninguna señal positiva (sin tarjetas y solo reconocimiento) el % es 1, no 0 ni 100', async () => {
  const w = await world();
  await ans(w, { type: 'mcq_en_es' });
  const out = await w.mastery.compute(T, NOW);
  assert.equal(out.pct, 1);
  assert.equal(out.band, 'initial');
  assert.deepEqual([out.signals.R, out.signals.P], [null, null]);
});

test('CA 4: con U (función `u`) el reparto cambia y la confianza sube un escalón; U fuera de rango se recorta y lo ilegible cuenta como null', async () => {
  const base = async (u) => {
    const w = await world(u === undefined ? {} : { u });
    await card(w, 'it1', [[RATING.GOOD, at(0.02)]]);
    for (let i = 0; i < 8; i += 1) await ans(w, { item: `it${1 + (i % 3)}`, when: at(1 - i * 0.05), session: i < 4 ? 's1' : 's2' }); // 3 ítems: sin tope por evidencia
    return w.mastery.compute(T, NOW);
  };
  const noU = await base();
  assert.equal(noU.signals.U, null);
  assert.equal(noU.confidence, 'low');
  const withU = await base(async () => 1);
  assert.equal(withU.signals.U, 1);
  assert.equal(withU.confidence, 'mid');
  close(noU.pct, Math.round(combine({ ...noU.signals })));
  close(withU.pct, Math.round(combine({ ...withU.signals })));
  assert.equal((await base(async () => 7)).signals.U, 1);
  assert.equal((await base(async () => -2)).signals.U, 0);
  for (const bad of [NaN, 'x', undefined, null]) assert.equal((await base(async () => bad)).signals.U, null);
});

test('el detalle de cada señal acompaña al resultado (tarjetas, intentos, códigos)', async () => {
  const w = await world();
  await card(w, 'it1', [[RATING.GOOD, at(0.02)]]);
  await ans(w);
  const out = await w.mastery.compute(T, NOW);
  assert.deepEqual([out.detail.R.cards, out.detail.P.attempts, out.detail.E.codes], [1, 1, []]);
  assert.equal(out.topicId, T);
});

test('entradas incorrectas y fallos de la base: se rechazan con mensajes en español, sin dejar nada a medias', async () => {
  const w = await world();
  await assert.rejects(() => w.mastery.compute(''), /topicId/);
  await assert.rejects(() => w.mastery.compute(5), /topicId/);
  await assert.rejects(() => w.mastery.compute(T, 'ayer'), /now/);
  const broken = { ...w.db, query: async () => { throw new Error('disco roto'); } };
  const bad = createMastery({ db: broken, events: w.events, errors: w.errors, srs: w.srs });
  await assert.rejects(() => bad.compute(T, NOW));
  const failingU = createMastery({ db: w.db, events: w.events, errors: w.errors, srs: w.srs, u: async () => { throw new Error('IA caída'); } });
  await assert.rejects(() => failingU.compute(T, NOW));
  for (const missing of ['db', 'events', 'errors', 'srs']) {
    const deps = { db: w.db, events: w.events, errors: w.errors, srs: w.srs };
    delete deps[missing];
    assert.throws(() => createMastery(deps), new RegExp('createMastery'));
  }
  assert.throws(() => createMastery({ db: w.db, events: w.events, errors: w.errors, srs: w.srs, u: 5 }), /`u`/);
  assert.throws(() => createMastery({ db: w.db, events: w.events, errors: w.errors, srs: w.srs, clock: {} }), /reloj/);
  assert.ok(Object.isFrozen(w.mastery));
});

test('sin `now` usa el reloj inyectado', async () => {
  const w = await world();
  await card(w, 'it1', [[RATING.GOOD, at(0.01)]]);
  await ans(w, { when: at(0.01) });
  const viaClock = await w.mastery.compute(T);
  const explicit = await w.mastery.compute(T, NOW);
  assert.deepEqual(viaClock, explicit);
});

// ---------- huecos cerrados tras las roturas de 1.7-T2 ----------
async function strongTopic(base = 1) {
  const w = await world();
  for (let i = 0; i < 6; i += 1) { await card(w, `ok${i}`, [[RATING.GOOD, at(0.02)]]); await ans(w, { item: `ok${i}`, when: at(base - i * 0.05) }); }
  return w;
}

test('descenso por fallos seguidos: un intento omitido (`skipped`) no corta la racha; un «casi» (`almost`) sí', async () => {
  const w = await strongTopic();
  await ans(w, { item: 'x', result: 'wrong', when: at(0.4) });
  await ans(w, { item: 'x', result: 'skipped', when: at(0.3) });
  await ans(w, { item: 'x', result: 'wrong', when: at(0.2) });
  assert.equal((await w.mastery.compute(T, NOW)).caps.length, 1);
  const v = await strongTopic();
  await ans(v, { item: 'x', result: 'wrong', when: at(0.3) });
  await ans(v, { item: 'x', result: 'almost', when: at(0.2) });
  assert.deepEqual((await v.mastery.compute(T, NOW)).caps, []);
});

test('descenso por fallos seguidos: no depende del orden en que se guardaron los eventos', async () => {
  const w = await strongTopic();
  await ans(w, { item: 'x', result: 'wrong', when: at(0.2) }); // el más reciente primero
  await ans(w, { item: 'x', result: 'correct', when: at(0.5) });
  await ans(w, { item: 'x', result: 'wrong', when: at(0.3) });
  assert.equal((await w.mastery.compute(T, NOW)).caps.length, 1, 'correct, wrong, wrong en orden de tiempo');
});

test('los eventos que no son respuestas (p. ej. examen de entrada) no cuentan como evidencia', async () => {
  const w = await world();
  await w.events.log({ ts: at(1).toISOString(), type: 'exam_entry', topics: [T] });
  const out = await w.mastery.compute(T, NOW);
  assert.equal(out.evidence, 0);
  assert.equal(out.pct, 0);
});

test('el tope por error recurrente cuenta por CÓDIGO: 3 frases distintas con el mismo código en 14 días bastan', async () => {
  const w = await strongTopic(8);
  const rec = (days, original) => w.errors.record({ original, code: 'TNS.SINCE_FOR', topics: [T], ts: at(days).toISOString() });
  await rec(5, 'I live here since 2010'); await rec(3, 'She works here since May'); await rec(1, 'We study since two hours');
  const out = await w.mastery.compute(T, NOW);
  assert.deepEqual(out.caps.map((c) => c.kind), ['recurrent_error']);
});

test('el tope por error recurrente se levanta con un «casi» posterior, pero NO con un acierto en el mismo instante ni anterior', async () => {
  const w = await strongTopic(8);
  const rec = (days) => w.errors.record({ original: 'I live here since 2010', code: 'TNS.SINCE_FOR', topics: [T], ts: at(days).toISOString() });
  await rec(5); await rec(3); await rec(1);
  await ans(w, { item: 'ok0', result: 'correct', when: at(1) }); // mismo instante que el último error
  assert.equal((await w.mastery.compute(T, NOW)).caps.length, 1, 'mismo instante: sigue el tope');
  await ans(w, { item: 'ok0', result: 'almost', when: at(0.5) });
  assert.deepEqual((await w.mastery.compute(T, NOW)).caps, [], 'un «casi» posterior lo levanta');
});

test('compute con un tema vacío se rechaza con el mensaje de mastery.compute', async () => {
  const w = await world();
  await assert.rejects(() => w.mastery.compute(''), /mastery\.compute: topicId/);
});
