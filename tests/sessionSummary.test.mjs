// @purpose: Pruebas de core/sessionSummary.js (2.8-T1): cifras contra un recuento independiente, parcial, vacío sin NaN, dominio, errores nuevos y recurrentes, próximos repasos, fallos y entradas hostiles.
// 2.8-T1. Datos fabricados a mano (los servicios reales se usan en tests/sessionSummary.cross.test.mjs). Cada prueba nombra lo que protege.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSessionSummary, SUMMARY_VERSION } from '../core/sessionSummary.js';
import { makeEvent } from './_helpers.mjs';

const SID = 'ses_20261031T1000_abcd';
const T = (n) => new Date(Date.UTC(2026, 9, 31, 10, 0, n)).toISOString();
let k = 0;
const ev = (over = {}) => { k += 1; return makeEvent({ id: `evt_20261031T1000_${String(k).padStart(4, '0')}`, sessionId: SID, ts: T(k), day: '2026-10-31', ...over }); };
const walk = (v, fn, path = '') => { fn(v, path); if (v && typeof v === 'object') for (const [key, x] of Object.entries(v)) walk(x, fn, `${path}.${key}`); };
const noBadNumbers = (summary) => walk(summary, (v, p) => {
  if (typeof v === 'number') assert.ok(Number.isFinite(v), `número no finito en ${p}`);
  assert.notEqual(v, undefined, `undefined en ${p}`);
});

test('versión del formato y objeto congelado en profundidad', () => {
  const s = buildSessionSummary({ events: [ev()], sessionId: SID });
  assert.equal(s.v, SUMMARY_VERSION);
  assert.ok(Object.isFrozen(s) && Object.isFrozen(s.counts) && Object.isFrozen(s.byTopic) && Object.isFrozen(s.byTopic[0]));
  assert.throws(() => { 'use strict'; s.counts.correct = 99; }, TypeError);
});

test('CA 4: con 0 respuestas no hay NaN, Infinity ni undefined, y la precisión es null', () => {
  for (const input of [undefined, null, {}, { events: [] }, { events: [], sessionId: SID, state: { v: 1, phase: 'summary', index: 0, total: 0, answers: [], ended: 'empty' } }]) {
    const s = buildSessionSummary(input);
    noBadNumbers(s);
    assert.equal(s.empty, true);
    assert.equal(s.answered, 0);
    assert.equal(s.accuracy, null);
    assert.equal(s.accuracyPct, null);
    assert.deepEqual(s.counts, { correct: 0, almost: 0, wrong: 0, dontKnow: 0, skipped: 0 });
    assert.deepEqual(s.time, { ms: 0, avgMs: null, counted: 0 });
    assert.equal(s.partial, false);
    assert.deepEqual(s.failed, []);
    assert.equal(s.degraded, false);
  }
});

test('CA 4: sesión vacía por el ejecutor conserva el motivo de cierre y 0 planeados', () => {
  const s = buildSessionSummary({ events: [], state: { v: 1, phase: 'summary', index: 0, total: 0, answers: [], ended: 'empty' } });
  assert.equal(s.ended, 'empty');
  assert.equal(s.planned, 0);
  assert.equal(s.pending, 0);
});

test('CA 1: las cifras coinciden con un recuento independiente sobre 40 sesiones generadas', () => {
  let seed = 12345;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const results = ['correct', 'correct', 'correct', 'almost', 'wrong', 'dont_know', 'skipped'];
  const topics = ['gram.a', 'gram.b', 'gram.c'];
  for (let run = 0; run < 40; run += 1) {
    const n = Math.floor(rnd() * 25);
    const events = [];
    for (let i = 0; i < n; i += 1) {
      events.push(ev({ cardId: `it${run}_${i}#0`, itemId: `it${run}_${i}`, result: results[Math.floor(rnd() * results.length)], ms: rnd() < 0.15 ? null : Math.floor(rnd() * 20000), topics: [topics[Math.floor(rnd() * 3)]] }));
    }
    const s = buildSessionSummary({ events, sessionId: SID });
    // Oráculo: recuento a mano, sin reutilizar nada del módulo.
    let c = 0; let a = 0; let w = 0; let d = 0; let sk = 0; let ms = 0; let withMs = 0;
    for (const e of events) {
      if (e.result === 'correct') c += 1; else if (e.result === 'almost') a += 1; else if (e.result === 'wrong') w += 1; else if (e.result === 'dont_know') d += 1; else sk += 1;
      if (e.ms !== null) { ms += e.ms; withMs += 1; }
    }
    assert.equal(s.answered, n);
    assert.deepEqual(s.counts, { correct: c, almost: a, wrong: w, dontKnow: d, skipped: sk });
    assert.equal(s.counts.correct + s.counts.almost + s.counts.wrong + s.counts.dontKnow + s.counts.skipped, s.answered);
    assert.equal(s.accuracy, n === 0 ? null : c / n);
    assert.equal(s.time.ms, ms);
    assert.equal(s.time.counted, withMs);
    assert.equal(s.time.avgMs, withMs === 0 ? null : Math.round(ms / withMs));
    assert.equal(s.byTopic.reduce((sum, t) => sum + t.answered, 0), n); // cada respuesta tiene un solo tema aquí
    noBadNumbers(s);
  }
});

test('el porcentaje es el redondeo de aciertos / respondidas, sin contar «casi» como acierto', () => {
  const events = [ev({ result: 'correct' }), ev({ result: 'correct' }), ev({ result: 'almost' })];
  const s = buildSessionSummary({ events, sessionId: SID });
  assert.equal(s.accuracyPct, 67);
  assert.equal(s.accuracy, 2 / 3);
});

test('solo cuentan las respuestas (`answer`) de la sesión pedida y un id repetido cuenta una vez', () => {
  const dup = ev({ result: 'wrong' });
  const events = [
    dup, dup, structuredClone(dup),
    ev({ result: 'correct' }),
    ev({ type: 'session_start', result: null, topics: [] }),
    ev({ sessionId: 'ses_otra', result: 'correct' }),
    ev({ type: 'note', responseRaw: 'x', result: null }),
    'basura', null, 42, { type: 'answer', result: 'invento' },
  ];
  const s = buildSessionSummary({ events, sessionId: SID });
  assert.equal(s.answered, 2);
  assert.equal(s.counts.wrong, 1);
  assert.equal(s.counts.correct, 1);
});

test('sin sessionId se cuentan todos los `answer` que lleguen', () => {
  const s = buildSessionSummary({ events: [ev(), ev({ sessionId: 'ses_otra' })] });
  assert.equal(s.answered, 2);
  assert.equal(s.sessionId, null);
});

test('tiempo: ignora ms nulos, negativos y no finitos, y topa cada respuesta en 24 h', () => {
  const events = [ev({ ms: 1000 }), ev({ ms: 3000 }), ev({ ms: null }), ev({ ms: -5 }), ev({ ms: Infinity }), ev({ ms: NaN }), ev({ ms: 999999999 })];
  const s = buildSessionSummary({ events, sessionId: SID });
  assert.equal(s.time.counted, 3);
  assert.equal(s.time.ms, 1000 + 3000 + 86400000);
  assert.equal(s.time.avgMs, Math.round((4000 + 86400000) / 3));
  noBadNumbers(s);
});

test('CA 2: abandonar a mitad da resumen parcial con lo respondido y lo pendiente', () => {
  const events = [ev({ result: 'correct' }), ev({ result: 'wrong' }), ev({ result: 'correct' })];
  const state = { v: 1, phase: 'summary', index: 2, total: 8, answers: [{ index: 0, result: 'correct' }, { index: 1, result: 'wrong' }, { index: 2, result: 'correct' }], ended: 'quit' };
  const s = buildSessionSummary({ events, sessionId: SID, state });
  assert.equal(s.partial, true);
  assert.equal(s.ended, 'quit');
  assert.equal(s.planned, 8);
  assert.equal(s.answered, 3);
  assert.equal(s.pending, 5);
  assert.equal(s.accuracyPct, 67);
});

test('CA 2: un estado a mitad de sesión (aún sin cerrar) con ítems por responder ya es parcial', () => {
  const events = [ev(), ev()];
  const state = { v: 1, phase: 'answering', index: 2, total: 6, answers: [{ index: 0, result: 'correct' }, { index: 1, result: 'correct' }], ended: null };
  const s = buildSessionSummary({ events, sessionId: SID, state });
  assert.equal(s.ended, null);
  assert.equal(s.partial, true);
  assert.equal(s.pending, 4);
});

test('una sesión completa no es parcial y no deja pendientes', () => {
  const events = [ev(), ev()];
  const state = { v: 1, phase: 'summary', index: 1, total: 2, answers: [{ index: 0, result: 'correct' }, { index: 1, result: 'correct' }], ended: 'completed' };
  const s = buildSessionSummary({ events, sessionId: SID, state });
  assert.equal(s.partial, false);
  assert.equal(s.pending, 0);
  assert.equal(s.planned, 2);
});

test('abandonar sin responder nada es vacío, no parcial (no hay nada que resumir a medias)', () => {
  const state = { v: 1, phase: 'summary', index: 0, total: 5, answers: [], ended: 'quit' };
  const s = buildSessionSummary({ events: [], sessionId: SID, state });
  assert.equal(s.empty, true);
  assert.equal(s.partial, false);
  assert.equal(s.pending, 5);
  assert.equal(s.ended, 'quit');
});

test('los ítems saltados sin evento (ejercicio aún no disponible) no cuentan como fallo ni como respuesta', () => {
  const events = [ev({ result: 'correct' })];
  const state = { v: 1, phase: 'summary', index: 2, total: 3, answers: [{ index: 0, result: 'correct' }, { index: 1, result: 'skipped' }, { index: 2, result: 'skipped' }], ended: 'completed' };
  const s = buildSessionSummary({ events, sessionId: SID, state });
  assert.equal(s.answered, 1);
  assert.equal(s.skippedWithoutEvent, 2);
  assert.equal(s.counts.skipped, 0);
  assert.equal(s.accuracyPct, 100);
  assert.deepEqual(s.failed, []);
});

test('por tema: cuenta cada respuesta en cada uno de sus temas y ordena por más respondidas', () => {
  const events = [
    ev({ topics: ['t.b'], result: 'correct' }), ev({ topics: ['t.b', 't.a'], result: 'wrong' }),
    ev({ topics: ['t.a'], result: 'almost' }), ev({ topics: ['t.b'], result: 'dont_know' }), ev({ topics: ['t.c', 't.c'], result: 'skipped' }),
  ];
  const s = buildSessionSummary({ events, sessionId: SID });
  assert.deepEqual(s.byTopic.map((t) => t.topicId), ['t.b', 't.a', 't.c']);
  assert.deepEqual(s.byTopic[0], { topicId: 't.b', answered: 3, correct: 1, almost: 0, wrong: 1, dontKnow: 1, skipped: 0 });
  assert.deepEqual(s.byTopic[2], { topicId: 't.c', answered: 1, correct: 0, almost: 0, wrong: 0, dontKnow: 0, skipped: 1 });
});

test('dominio: sube, baja, igual y primera evidencia; solo temas practicados; confianza de «después»', () => {
  const events = [ev({ topics: ['t.up'] }), ev({ topics: ['t.down'] }), ev({ topics: ['t.same'] }), ev({ topics: ['t.new'] }), ev({ topics: ['t.nodata'] })];
  const before = [{ topicId: 't.up', pct: 40 }, { topicId: 't.down', pct: 60 }, { topicId: 't.same', pct: 50.4 }, { topicId: 't.ajeno', pct: 10 }];
  const after = [
    { topicId: 't.up', pct: 52.6, band: 'progress', confidence: 'low' }, { topicId: 't.down', pct: 55, band: 'progress', confidence: 'high' },
    { topicId: 't.same', pct: 50.2, band: 'progress', confidence: 'mid' }, { topicId: 't.new', pct: 18, band: 'initial', confidence: 'weird' },
    { topicId: 't.ajeno', pct: 99, band: 'mastered', confidence: 'high' },
  ];
  const m = buildSessionSummary({ events, sessionId: SID, masteryBefore: before, masteryAfter: after }).mastery;
  assert.deepEqual(m.changes.map((c) => [c.topicId, c.direction]), [['t.new', 'new'], ['t.up', 'up'], ['t.same', 'same'], ['t.down', 'down']]);
  const up = m.changes.find((c) => c.topicId === 't.up');
  assert.deepEqual(up, { topicId: 't.up', before: 40, after: 53, delta: 13, direction: 'up', band: 'progress', confidence: 'low', lowEvidence: false });
  assert.equal(m.changes.find((c) => c.topicId === 't.new').confidence, null);
  assert.equal(m.changes.find((c) => c.topicId === 't.new').before, null);
  assert.equal(m.changes.find((c) => c.topicId === 't.down').delta, -5);
  assert.equal(m.changes.find((c) => c.topicId === 't.same').delta, 0);
  assert.equal(m.improved, 1); assert.equal(m.declined, 1); assert.equal(m.newTopics, 1);
  assert.ok(!m.changes.some((c) => c.topicId === 't.ajeno' || c.topicId === 't.nodata'));
});

test('dominio (FIX 2.9-T4): `lowEvidence` pasa del dominio al cambio; solo `true` cuenta y lo raro se toma como false', () => {
  const events = [ev({ topics: ['t.a'] }), ev({ topics: ['t.b'] }), ev({ topics: ['t.c'] })];
  const after = [{ topicId: 't.a', pct: 59, band: 'progress', confidence: 'low', lowEvidence: true }, { topicId: 't.b', pct: 59, lowEvidence: 'yes' }, { topicId: 't.c', pct: 90, confidence: 'mid' }];
  const m = buildSessionSummary({ events, sessionId: SID, masteryAfter: after }).mastery;
  assert.deepEqual(m.changes.map((c) => [c.topicId, c.lowEvidence]), [['t.a', true], ['t.b', false], ['t.c', false]]);
});

test('dominio: sin lista «después» no hay cambios; valores raros se descartan o se acotan a 0–100', () => {
  const events = [ev({ topics: ['t.a'] }), ev({ topics: ['t.b'] })];
  assert.deepEqual(buildSessionSummary({ events, sessionId: SID }).mastery.changes, []);
  const m = buildSessionSummary({ events, sessionId: SID, masteryBefore: [{ topicId: 't.a', pct: -20 }], masteryAfter: [{ topicId: 't.a', pct: 180 }, { topicId: 't.b', pct: NaN }, null, 'x'] }).mastery;
  assert.equal(m.changes.length, 1);
  assert.equal(m.changes[0].before, 0);
  assert.equal(m.changes[0].after, 100);
});

const CATALOG = { get: (id) => (id === 'TNS.SINCE_FOR' ? { titulo_es: 'since / for', pista_corta_es: 'Usa for con duración y since con un punto de partida.' } : null) };
const rec = (over = {}) => ({ id: 'err_1', ts: T(1), day: '2026-10-31', original: 'since two years', correction: 'for two years', context: '', topics: ['t.a'], code: 'TNS.SINCE_FOR', origin: 'transfer_es', kind: 'slip', impact: 'mid', count: 1, source: 'app', itemId: 'it1', seen: [T(1)], ...over });

test('errores: nuevo (priorCount 0) y recurrente (había antes), con título y microexplicación del catálogo', () => {
  const events = [ev({ itemId: 'it1', ts: T(1), result: 'wrong' }), ev({ itemId: 'it2', ts: T(2), result: 'wrong' })];
  const records = [
    rec({ id: 'err_n', itemId: 'it1', seen: [T(1)], count: 1 }),
    rec({ id: 'err_r', itemId: 'it2', seen: [T(-500), T(-100), T(2)], count: 3, kind: 'systematic', original: 'leaved' }),
  ];
  const e = buildSessionSummary({ events, sessionId: SID, errors: records, catalog: CATALOG }).errors;
  assert.equal(e.total, 2);
  assert.deepEqual(e.fresh.map((x) => x.id), ['err_n']);
  assert.deepEqual(e.recurrent.map((x) => x.id), ['err_r']);
  assert.equal(e.fresh[0].priorCount, 0);
  assert.equal(e.fresh[0].times, 1);
  assert.equal(e.fresh[0].title, 'since / for');
  assert.equal(e.fresh[0].hint, 'Usa for con duración y since con un punto de partida.');
  assert.equal(e.recurrent[0].priorCount, 2);
  assert.equal(e.recurrent[0].count, 3);
  assert.equal(e.recurrent[0].kind, 'systematic');
});

test('errores: un registro con ocurrencias viejas pero ninguna de esta sesión no aparece', () => {
  const events = [ev({ itemId: 'it1', ts: T(1) })];
  const records = [rec({ id: 'viejo', itemId: 'it1', seen: [T(-9999)], count: 4 }), rec({ id: 'otroItem', itemId: 'it9', seen: [T(1)] }), rec({ id: 'sinItem', itemId: null, seen: [T(1)] })];
  assert.equal(buildSessionSummary({ events, sessionId: SID, errors: records, catalog: CATALOG }).errors.total, 0);
});

test('errores: el mismo error dos veces en la sesión es nuevo con times 2; el conteo nunca baja de lo visto', () => {
  const events = [ev({ itemId: 'it1', ts: T(1) }), ev({ itemId: 'it1', ts: T(5) })];
  const same = rec({ id: 'dos', itemId: 'it1', seen: [T(1), T(5)], count: 2 });
  const e = buildSessionSummary({ events, sessionId: SID, errors: [same] }).errors;
  assert.equal(e.fresh[0].times, 2);
  assert.equal(e.fresh[0].priorCount, 0);
  const odd = buildSessionSummary({ events, sessionId: SID, errors: [rec({ id: 'raro', itemId: 'it1', seen: [T(1)], count: 0 })] }).errors;
  assert.equal(odd.fresh[0].count, 1); // count incoherente: se toma lo visto, nunca negativo
  assert.equal(odd.fresh[0].priorCount, 0);
});

test('errores: sin catálogo (o catálogo que falla) título y pista quedan en null; el registro repetido cuenta una vez', () => {
  const events = [ev({ itemId: 'it1', ts: T(1) })];
  const r = rec({ id: 'x', itemId: 'it1' });
  const a = buildSessionSummary({ events, sessionId: SID, errors: [r, r] }).errors;
  assert.equal(a.total, 1);
  assert.equal(a.fresh[0].title, null);
  assert.equal(a.fresh[0].hint, null);
  const b = buildSessionSummary({ events, sessionId: SID, errors: [r], catalog: { get() { throw new Error('roto'); } } }).errors;
  assert.equal(b.fresh[0].hint, null);
});

test('errores: orden por veces en la sesión, luego sistemáticos primero', () => {
  const events = [ev({ itemId: 'a', ts: T(1) }), ev({ itemId: 'b', ts: T(2) }), ev({ itemId: 'c', ts: T(3) }), ev({ itemId: 'c', ts: T(4) })];
  const records = [
    rec({ id: 'e_a', itemId: 'a', seen: [T(1)], count: 1, kind: 'slip' }),
    rec({ id: 'e_b', itemId: 'b', seen: [T(2)], count: 1, kind: 'systematic' }),
    rec({ id: 'e_c', itemId: 'c', seen: [T(3), T(4)], count: 2, kind: 'slip' }),
  ];
  assert.deepEqual(buildSessionSummary({ events, sessionId: SID, errors: records }).errors.fresh.map((x) => x.id), ['e_c', 'e_b', 'e_a']);
});

test('próximos repasos: hoy, mañana, semana y más adelante por día LOCAL; vencida cuenta como hoy', () => {
  const now = new Date(2026, 9, 31, 12, 0, 0); // mediodía local
  const at = (days, h = 9) => new Date(2026, 9, 31 + days, h, 0, 0).toISOString();
  const answered = ['c0', 'c1', 'c2', 'c3', 'c4', 'c5'];
  const events = answered.map((id) => ev({ cardId: `${id}#0`, itemId: id }));
  const cards = [
    { id: 'c0#0', due: at(-3) }, { id: 'c1#0', due: at(0, 23) }, { id: 'c2#0', due: at(1, 0) },
    { id: 'c3#0', due: at(7) }, { id: 'c4#0', due: at(8) }, { id: 'c5#0', due: 'no es fecha' }, { id: 'ajena#0', due: at(0) },
  ];
  const r = buildSessionSummary({ events, sessionId: SID, cards, now }).nextReviews;
  assert.deepEqual(r.groups, { today: 2, tomorrow: 1, week: 1, later: 1 });
  assert.equal(r.unknown, 1);
  assert.deepEqual(r.items.map((i) => [i.cardId, i.days, i.bucket]), [['c0#0', 0, 'today'], ['c1#0', 0, 'today'], ['c2#0', 1, 'tomorrow'], ['c3#0', 7, 'week'], ['c4#0', 8, 'later']]);
  assert.equal(r.earliest, at(-3));
  assert.ok(r.items.every((i) => i.itemId === i.cardId.slice(0, 2)));
  noBadNumbers(buildSessionSummary({ events, sessionId: SID, cards, now }));
});

test('próximos repasos: sin `now` usa el último evento; sin evento ni tarjetas no inventa fechas', () => {
  const e1 = ev({ cardId: 'z#0', itemId: 'z', ts: '2026-10-31T10:00:00.000Z' });
  const future = new Date(new Date('2026-10-31T10:00:00.000Z').getTime() + 3 * 86400000).toISOString();
  const r = buildSessionSummary({ events: [e1], sessionId: SID, cards: [{ id: 'z#0', due: future }] }).nextReviews;
  assert.equal(r.items[0].days, 3);
  const none = buildSessionSummary({ events: [e1], sessionId: SID }).nextReviews;
  assert.equal(none.unknown, 1);
  assert.deepEqual(none.items, []);
  assert.equal(none.earliest, null);
  assert.deepEqual(buildSessionSummary({ events: [] }).nextReviews.groups, { today: 0, tomorrow: 0, week: 0, later: 0 });
});

test('fallos: decide la última respuesta de cada tarjeta; «casi» no es fallo; orden de respuesta', () => {
  const events = [
    ev({ cardId: 'a#0', itemId: 'a', result: 'wrong' }),
    ev({ cardId: 'b#0', itemId: 'b', result: 'dont_know' }),
    ev({ cardId: 'c#0', itemId: 'c', result: 'almost' }),
    ev({ cardId: 'a#0', itemId: 'a', result: 'correct' }), // la repitió y acertó: ya no es fallo
    ev({ cardId: 'd#1', itemId: 'd', result: 'wrong' }),
    ev({ cardId: 'e#0', itemId: 'e', result: 'skipped' }),
  ];
  assert.deepEqual(buildSessionSummary({ events, sessionId: SID }).failed, [
    { cardId: 'b#0', itemId: 'b', result: 'dont_know' }, { cardId: 'd#1', itemId: 'd', result: 'wrong' },
  ]);
});

test('no modifica lo que recibe (entradas congeladas en profundidad)', () => {
  const freeze = (o) => { if (o && typeof o === 'object') { Object.freeze(o); Object.values(o).forEach(freeze); } return o; };
  const input = freeze({
    events: [ev({ itemId: 'it1', ts: T(1), result: 'wrong', cardId: 'it1#0' })], sessionId: SID,
    errors: [rec({ id: 'x', itemId: 'it1' })], masteryBefore: [{ topicId: 'gram.be.present_forms', pct: 10 }], masteryAfter: [{ topicId: 'gram.be.present_forms', pct: 20 }],
    cards: [{ id: 'it1#0', due: T(100) }], now: T(10),
  });
  const s = buildSessionSummary(input);
  assert.equal(s.degraded, false);
  assert.equal(s.errors.total, 1);
});

test('entradas hostiles nunca lanzan: getters que fallan, proxies y claves peligrosas', () => {
  const boom = { get events() { throw new Error('no lo leas'); } };
  const s1 = buildSessionSummary(boom);
  assert.equal(s1.degraded, true);
  assert.equal(s1.empty, true);
  noBadNumbers(s1);
  const proxy = new Proxy({}, { get() { throw new Error('proxy hostil'); }, has() { throw new Error('proxy hostil'); }, ownKeys() { throw new Error('proxy hostil'); } });
  assert.doesNotThrow(() => buildSessionSummary({ events: [proxy, ev()], sessionId: SID, state: proxy }));
  const hostileState = { get total() { throw new Error('x'); } };
  assert.equal(buildSessionSummary({ events: [ev()], sessionId: SID, state: hostileState }).degraded, true);
  const evil = JSON.parse('{"__proto__":{"polluted":true},"constructor":{"prototype":{"p":1}}}');
  assert.doesNotThrow(() => buildSessionSummary({ events: [evil, ev({ topics: ['__proto__', 'constructor'] })], sessionId: SID, errors: [evil], masteryAfter: [evil], cards: [evil] }));
  assert.equal({}.polluted, undefined);
  for (const bad of ['texto', 7, true, [], () => 1, Symbol('x')]) assert.doesNotThrow(() => buildSessionSummary(bad));
  for (const bad of ['x', 3, {}, null]) assert.doesNotThrow(() => buildSessionSummary({ events: bad, errors: bad, cards: bad, masteryBefore: bad, masteryAfter: bad, state: bad, catalog: bad, now: bad }));
});
