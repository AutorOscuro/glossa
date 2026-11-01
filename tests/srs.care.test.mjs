// @purpose: Pruebas de sanguijuelas y modo rescate (core/srsLeech.js y core/srsRescue.js).
// Pruebas de sanguijuelas y modo rescate (subparte 1.4, cuarto 3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newCard, isLeech, markLeech, releaseLeech, leechList, overdueCards, rescuePlan, DEFAULT_LEECH_THRESHOLD, DEFAULT_DAILY_REVIEW_CAP, RESCUE_FACTORS } from '../core/srs.js';

const NOW = new Date('2026-10-19T12:00:00.000Z');
const D = 86400000;
const mk = (id, over = {}) => ({ ...newCard(id, 0, NOW), state: 2, ...over });
const dueAgo = (days) => new Date(NOW.getTime() - days * D).toISOString();

test('sanguijuela: 7 fallos no, 8 sí (CA 3) y el umbral es configurable', () => {
  assert.equal(DEFAULT_LEECH_THRESHOLD, 8);
  assert.equal(isLeech(mk('a', { lapses: 7 })), false);
  assert.equal(isLeech(mk('a', { lapses: 8 })), true);
  assert.equal(isLeech(mk('a', { lapses: 3 }), 3), true);
  const out = markLeech(mk('a', { lapses: 8 }));
  assert.equal(out.suspended, true); assert.equal(out.leech, true);
  assert.equal(markLeech(mk('a', { lapses: 7 })).leech, false);
});

test('sanguijuela: simulación de 8 fallos seguidos marca solo al octavo, sin mutar', () => {
  let c = mk('a'); const flags = [];
  for (let i = 1; i <= 8; i += 1) { const before = c; c = markLeech({ ...c, lapses: i }); flags.push(c.leech); assert.equal(before.leech, false); }
  assert.deepEqual(flags, [false, false, false, false, false, false, false, true]);
});

test('sanguijuela: markLeech es idempotente y releaseLeech reactiva sin borrar los fallos', () => {
  const c = markLeech(mk('a', { lapses: 9 }));
  assert.equal(markLeech(c), c);
  const r = releaseLeech(c);
  assert.deepEqual([r.suspended, r.leech, r.lapses], [false, false, 9]);
  assert.equal(releaseLeech(r), r);
  assert.equal(markLeech(r).leech, true);
  assert.equal(c.leech, true);
});

test('sanguijuela: entradas inválidas y lista ordenada', () => {
  for (const bad of [0, -1, 1.5, '8', NaN]) assert.throws(() => isLeech(mk('a'), bad), /umbral/);
  assert.throws(() => isLeech(null), /tarjeta/);
  assert.throws(() => releaseLeech(undefined), /tarjeta/);
  assert.equal(isLeech(mk('a', { lapses: NaN })), false);
  const list = leechList([mk('b', { leech: true, lapses: 9 }), mk('c'), mk('a', { leech: true, lapses: 9 }), mk('d', { leech: true, lapses: 12 })]);
  assert.deepEqual(list.map((x) => x.id), ['d#0', 'a#0', 'b#0']);
  assert.throws(() => leechList('x'), /lista/);
});

test('overdueCards: solo vistas, no suspendidas y vencidas', () => {
  const cards = [
    mk('vencida', { due: dueAgo(2) }), mk('futura', { due: new Date(NOW.getTime() + D).toISOString() }),
    newCard('nueva', 0, NOW), mk('susp', { due: dueAgo(5), suspended: true }), mk('sang', { due: dueAgo(5), leech: true }),
    mk('ahora', { due: NOW.toISOString() }),
  ];
  assert.deepEqual(overdueCards(cards, NOW).map((c) => c.itemId).sort(), ['ahora', 'vencida']);
  assert.throws(() => overdueCards(null, NOW), /lista/);
  assert.throws(() => overdueCards([], 'x'), /toDate/);
});

// Retrievabilidad de prueba: cuanto más atrasada, menor.
const retr = (c, now) => 1 / (1 + (now.getTime() - new Date(c.due).getTime()) / D);
const many = (n) => Array.from({ length: n }, (_, i) => mk(`c${String(i).padStart(3, '0')}`, { due: dueAgo(i + 1) }));

test('rescate: los factores viven en un solo sitio y el tope diario por defecto es 100', () => {
  assert.equal(DEFAULT_DAILY_REVIEW_CAP, 100);
  assert.deepEqual({ ...RESCUE_FACTORS }, { activation: 1.5, quota: 0.5 });
  assert.ok(Object.isFrozen(RESCUE_FACTORS));
});

test('rescate: con ≤ 150 vencidas (1,5 × 100) no se activa, no limita y no da mensaje', () => {
  const p = rescuePlan(many(150), NOW, { retrievability: retr });
  assert.equal(p.active, false); assert.equal(p.today.length, 150); assert.equal(p.postponed, 0); assert.equal(p.message_es, null);
  assert.equal(p.threshold, 150); assert.equal(p.quota, 50);
  assert.equal(p.queue[0].itemId, 'c149');
});

test('rescate: con 151 vencidas se activa; cupo 50 (0,5 × 100) con las de menor retrievabilidad; sin culpa', () => {
  const p = rescuePlan(many(151), NOW, { retrievability: retr });
  assert.equal(p.active, true); assert.equal(p.overdueCount, 151);
  assert.equal(p.today.length, 50); assert.equal(p.postponed, 101);
  assert.equal(p.today[0].itemId, 'c150');
  const rs = p.today.map((c) => retr(c, NOW));
  assert.deepEqual(rs, [...rs].sort((a, b) => a - b));
  assert.ok(Math.max(...rs) <= Math.min(...p.queue.slice(50).map((c) => retr(c, NOW))));
  assert.match(p.message_es, /151 repasos pendientes.*50 más importantes.*sin problema/);
  assert.doesNotMatch(p.message_es, /perdiste|racha|culpa|atrasad|tarde/i);
});

test('rescate: depende del tope diario (no son cifras fijas)', () => {
  const p20 = rescuePlan(many(31), NOW, { dailyCap: 20, retrievability: retr });
  assert.equal(p20.threshold, 30); assert.equal(p20.quota, 10);
  assert.equal(p20.active, true); assert.equal(p20.today.length, 10);
  assert.equal(rescuePlan(many(30), NOW, { dailyCap: 20, retrievability: retr }).active, false);
  const p25 = rescuePlan(many(40), NOW, { dailyCap: 25, retrievability: retr });
  assert.equal(p25.threshold, 37.5); assert.equal(p25.quota, 12);
  assert.equal(rescuePlan(many(37), NOW, { dailyCap: 25, retrievability: retr }).active, false);
  assert.equal(rescuePlan(many(38), NOW, { dailyCap: 25, retrievability: retr }).active, true);
  assert.equal(rescuePlan(many(3), NOW, { dailyCap: 1, retrievability: retr }).quota, 1);
});

test('rescate: los factores son configurables por opción, empates estables y determinismo', () => {
  const cards = [mk('b', { due: dueAgo(1) }), mk('a', { due: dueAgo(1) }), mk('c', { due: dueAgo(1) })];
  const opts = { dailyCap: 2, factors: { activation: 1, quota: 1 }, retrievability: () => 0.5 };
  const p1 = rescuePlan(cards, NOW, opts); const p2 = rescuePlan([...cards].reverse(), NOW, opts);
  assert.equal(p1.active, true);
  assert.deepEqual(p1.today.map((c) => c.itemId), ['a', 'b']);
  assert.deepEqual(p2.today.map((c) => c.itemId), ['a', 'b']);
  assert.equal(rescuePlan(cards, NOW, { ...opts, factors: { activation: 2, quota: 1 } }).active, false);
});

test('rescate: retrievabilidad no numérica cuenta como urgente; no muta; valida opciones', () => {
  const cards = [mk('a', { due: dueAgo(1) }), mk('b', { due: dueAgo(1) }), mk('c', { due: dueAgo(1) })];
  const snap = JSON.stringify(cards);
  const base = { dailyCap: 1, factors: { activation: 1, quota: 1 } };
  const p = rescuePlan(cards, NOW, { ...base, retrievability: (c) => (c.itemId === 'b' ? NaN : 0.9) });
  assert.equal(p.today[0].itemId, 'b');
  assert.equal(JSON.stringify(cards), snap);
  assert.throws(() => rescuePlan(cards, NOW, {}), /retrievability/);
  for (const bad of [0, -1, 1.5, '100']) assert.throws(() => rescuePlan(cards, NOW, { retrievability: retr, dailyCap: bad }), /dailyCap/);
  for (const bad of [{ activation: 0, quota: 0.5 }, { activation: 1.5, quota: 0 }, { activation: 1.5, quota: 1.1 }, { activation: NaN, quota: 0.5 }, { activation: '1.5', quota: 0.5 }, null]) {
    assert.throws(() => rescuePlan(cards, NOW, { retrievability: retr, factors: bad }), /factors/);
  }
  const empty = rescuePlan([], NOW, { retrievability: retr });
  assert.deepEqual([empty.active, empty.overdueCount, empty.today.length], [false, 0, 0]);
});
