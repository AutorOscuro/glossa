// @purpose: Pruebas de newCard, levelOf y dueLabel de core/srs.js.
// Pruebas de core/srs.js, cuarto 1 (subparte 1.4): newCard, levelOf, dueLabel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newCard, levelOf, dueLabel, LEVEL_CUTS_DAYS } from '../core/srs.js';
import { initialCard, cardIdOf } from '../core/contentImport.js';

const NOW = new Date('2026-10-19T12:00:00.000Z');
const at = (ms) => ({ due: new Date(NOW.getTime() + ms).toISOString() });
const MIN = 60000, H = 3600000, D = 86400000;

test('newCard: valores iniciales de 8.4 y coincide con la importación de 1.3', () => {
  const c = newCard('g.pp.0001', 0, NOW, ['gram.present_perfect.for_since']);
  assert.deepEqual(c, {
    id: 'g.pp.0001#0', itemId: 'g.pp.0001', facet: 0, topics: ['gram.present_perfect.for_since'],
    state: 0, due: '2026-10-19T12:00:00.000Z', stability: 0, difficulty: 0, reps: 0, lapses: 0, last_review: null,
    suspended: false, leech: false, fav: false, created: '2026-10-19T12:00:00.000Z',
  });
  for (const facet of [0, 1, 2]) {
    const item = { id: 'v.go.0001', facet, topics: ['verb.irregular.go'] };
    assert.deepEqual(newCard(item.id, facet, NOW, item.topics), initialCard(item, NOW));
    assert.equal(newCard(item.id, facet, NOW).id, cardIdOf(item.id, facet));
  }
});

test('newCard: facet ausente es 0, no comparte la lista de temas y rechaza entradas malas', () => {
  const topics = ['a.b'];
  const c = newCard('x.1', null, NOW, topics);
  topics.push('c.d');
  assert.equal(c.facet, 0);
  assert.deepEqual(c.topics, ['a.b']);
  assert.deepEqual(newCard('x.1', undefined, NOW).topics, []);
  for (const bad of ['', '  ', 5, null, undefined]) assert.throws(() => newCard(bad, 0, NOW), /itemId/);
  for (const bad of [3, -1, 1.5, '1', NaN]) assert.throws(() => newCard('x.1', bad, NOW), /facet/);
  assert.throws(() => newCard('x.1', 0, NOW, 'a'), /topics/);
  assert.throws(() => newCard('x.1', 0, NOW, [1]), /topics/);
  assert.throws(() => newCard('x.1', 0, 'mañana'), /toDate/);
});

test('levelOf: cortes 1 d, 4 d, 21 d y 90 d (roadmap 8.4)', () => {
  assert.deepEqual([...LEVEL_CUTS_DAYS], [1, 4, 21, 90]);
  const table = [[0, 1], [0.5, 1], [0.999, 1], [1, 2], [3.999, 2], [4, 3], [20.999, 3], [21, 4], [89.999, 4], [90, 5], [365, 5], [1e6, 5]];
  for (const [s, level] of table) assert.equal(levelOf({ stability: s }), level, `estabilidad ${s}`);
});

test('levelOf: estabilidad rara cuenta como nivel 1 y nunca da NaN', () => {
  for (const s of [-1, NaN, Infinity, -Infinity, '5', null, undefined]) assert.equal(levelOf({ stability: s }), 1, String(s));
  for (const card of [{}, null, undefined, 'x', 7]) assert.equal(levelOf(card), 1);
  assert.equal(levelOf(newCard('x.1', 0, NOW)), 1);
});

test('dueLabel: bordes de 1 min, 1 h, 1 d, 3 sem y 2 años', () => {
  assert.equal(dueLabel(at(MIN), NOW), 'Repaso en 1 min');
  assert.equal(dueLabel(at(59 * MIN + 59000), NOW), 'Repaso en 59 min');
  assert.equal(dueLabel(at(H), NOW), 'Repaso en 1 h');
  assert.equal(dueLabel(at(24 * H - 1), NOW), 'Repaso en 23 h');
  assert.equal(dueLabel(at(D), NOW), 'Repaso en 1 d');
  assert.equal(dueLabel(at(6.99 * D), NOW), 'Repaso en 6 d');
  assert.equal(dueLabel(at(7 * D), NOW), 'Repaso en 1 sem');
  assert.equal(dueLabel(at(14 * D), NOW), 'Repaso en 2 sems');
  assert.equal(dueLabel(at(21 * D), NOW), 'Repaso en 3 sems');
  assert.equal(dueLabel(at(28 * D), NOW), 'Repaso en 4 sems');
  assert.equal(dueLabel(at(55.9 * D), NOW), 'Repaso en 7 sems');
  assert.equal(dueLabel(at(56 * D), NOW), 'Repaso en 1 mes');
  assert.equal(dueLabel(at(90 * D), NOW), 'Repaso en 2 meses');
  assert.equal(dueLabel(at(364 * D), NOW), 'Repaso en 11 meses');
  assert.equal(dueLabel(at(365 * D), NOW), 'Repaso en 1 año');
  assert.equal(dueLabel(at(2 * 365.25 * D), NOW), 'Repaso en 2 años');
  assert.equal(dueLabel(at(10 * 365.25 * D), NOW), 'Repaso en 10 años');
});

test('dueLabel: menos de 1 min se redondea a 1 min; vencida o ahora dice "Repaso ahora"', () => {
  assert.equal(dueLabel(at(1), NOW), 'Repaso en 1 min');
  assert.equal(dueLabel(at(59999), NOW), 'Repaso en 1 min');
  assert.equal(dueLabel(at(0), NOW), 'Repaso ahora');
  assert.equal(dueLabel(at(-1), NOW), 'Repaso ahora');
  assert.equal(dueLabel(at(-400 * D), NOW), 'Repaso ahora');
});

test('dueLabel: reloj hacia atrás no da NaN ni etiquetas negativas, y no cambia la tarjeta', () => {
  const card = newCard('x.1', 0, NOW);
  const frozen = JSON.stringify(card);
  const back = new Date(NOW.getTime() - 3 * D);
  const label = dueLabel(card, back);
  assert.equal(label, 'Repaso en 3 d');
  assert.doesNotMatch(label, /NaN|-/);
  assert.equal(JSON.stringify(card), frozen);
  for (const ms of [-5 * D, -1, 0, 1, 40 * D, 800 * D]) assert.doesNotMatch(dueLabel(at(ms), NOW), /NaN|undefined|-\d/);
});

test('dueLabel: acepta due y now en ISO, ms o Date, y rechaza fechas inválidas', () => {
  const card = { due: '2026-10-19T12:04:00.000Z' };
  assert.equal(dueLabel(card, NOW), 'Repaso en 4 min');
  assert.equal(dueLabel(card, NOW.getTime()), 'Repaso en 4 min');
  assert.equal(dueLabel(card, '2026-10-19T12:00:00Z'), 'Repaso en 4 min');
  assert.throws(() => dueLabel({ due: 'x' }, NOW), /toDate/);
  assert.throws(() => dueLabel({}, NOW), /toDate/);
  assert.throws(() => dueLabel(null, NOW), /toDate/);
  assert.throws(() => dueLabel(card, undefined), /toDate/);
});
