// @purpose: Pruebas de cierre del armador de sesiones (1.8-T5): los 12 escenarios y los CA 1–6 de la 1.8 con oráculos calculados aquí, sin usar el código probado.
// 1.8-T5. Tarjetas hechas a mano; el azar es siempre createRng con semilla. Cada oráculo (conteos, rachas, exclusiones, cupos) se calcula a partir de los datos de entrada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from '../core/session.js';
import { SESSION_CONFIG } from '../core/session.config.js';
import { createRng } from '../core/rng.js';

const NOW = new Date('2026-10-25T12:00:00.000Z');
const DAY = 86400000;
const ago = (d) => new Date(NOW.getTime() - d * DAY).toISOString();
const ahead = (d) => new Date(NOW.getTime() + d * DAY).toISOString();
const TYPES = ['mcq_en_es', 'match_pairs', 'order_blocks', 'read_tfng', 'cloze_bank', 'translate_word', 'fix_error', 'phrase_cloze'];
const HEAVY = ['write_guided']; // familia «writing»: con energía baja se aplaza
let n = 0;
const mk = (over = {}, type = TYPES[n % TYPES.length]) => {
  n += 1;
  const itemId = over.itemId ?? `i${String(n).padStart(4, '0')}`;
  return { card: { id: `${itemId}#0`, itemId, facet: 0, topics: ['t.a'], state: 2, due: ago(1), stability: 5, difficulty: 5, reps: 3, lapses: 0, last_review: ago(6), suspended: false, leech: false, fav: false, created: ago(30), ...over }, item: { id: itemId, type } };
};
const due = (k, topics = (i) => [`t.${'abcdef'[i % 6]}`]) => Array.from({ length: k }, (_, i) => mk({ topics: topics(i), due: ago(1 + (i % 4)) }));
const fresh = (k, topic, type) => Array.from({ length: k }, () => mk({ state: 0, due: ago(0), topics: [topic], reps: 0, stability: 0 }, type));
const set = (list) => ({ cards: list.map((x) => x.card), items: list.map((x) => x.item) });
const run = (list, extra = {}) => build({ now: NOW, ...set(list), rng: createRng(11), ...extra });
const cardOf = (list) => new Map(list.map((x) => [x.card.id, x.card]));
const maxRun = (keys) => { let best = 0; let r = 0; let prev; for (const k of keys) { r = k !== null && k === prev ? r + 1 : 1; prev = k; best = Math.max(best, r); } return best; };
const topicsAreas = ['a', 'b', 'c', 'd', 'e', 'f'].map((s) => ({ id: `t.${s}`, status: 'active', area: 'gram', priority: 0 }));

// ── Los 12 escenarios ────────────────────────────────────────────────────────────────────────────
test('E1 persona nueva: solo tarjetas nuevas, tope diario de 10 y sin culpa', () => {
  const list = [...fresh(8, 't.a'), ...fresh(8, 't.b'), ...fresh(8, 't.c')];
  const plan = run(list);
  assert.equal(plan.count, 10);
  assert.ok(plan.items.every((i) => i.kind === 'new' && i.why === 'new'));
  assert.equal(plan.reason, null);
  assert.equal(plan.rescue.active, false);
});

test('E2 muy atrasada: modo rescate, cupo de 50, sin nuevas y mensaje sin culpa', () => {
  const list = [...due(160), ...fresh(5, 't.z')];
  const plan = run(list, { size: 60 });
  assert.equal(plan.rescue.active, true);
  assert.equal(plan.rescue.quota, 50);
  assert.equal(plan.count, 50);
  assert.ok(plan.items.every((i) => i.kind === 'review' && i.why === 'rescue'));
  assert.doesNotMatch(plan.rescue.message_es ?? '', /racha|culpa|fallaste|perdiste/i);
});

test('E3 un solo tema: 20 ítems y los tipos no pasan de 2 seguidos', () => {
  const list = Array.from({ length: 30 }, (_, i) => mk({ topics: ['t.a'], due: ago(1 + (i % 5)) }, TYPES[i % 4]));
  const plan = run(list);
  assert.equal(plan.count, 20);
  assert.ok(maxRun(plan.items.map((i) => i.exerciseType)) <= 2);
});

test('E4 energía baja: mitad de ítems, sin ejercicios largos y sin ser un modo especial', () => {
  const list = [...due(12), ...Array.from({ length: 6 }, () => mk({ due: ago(2) }, HEAVY[0]))];
  const plan = run(list, { energy: 'low' });
  assert.equal(plan.count, 10);
  assert.ok(plan.items.every((i) => !HEAVY.includes(i.exerciseType)));
  assert.equal(plan.items.every((i) => i.kind === 'review'), true);
  // Las nuevas largas también se aplazan, y las ligeras sí entran (cupo de nuevas a la mitad: 5 de 10).
  const nuevas = run([...fresh(4, 't.a', HEAVY[0]), ...fresh(8, 't.b', 'mcq_en_es')], { energy: 'low' });
  assert.equal(nuevas.count, 5);
  assert.ok(nuevas.items.every((i) => i.kind === 'new' && !HEAVY.includes(i.exerciseType)));
});

test('E5 sin contenido: plan vacío con razón «no hay material»', () => {
  const plan = run([]);
  assert.equal(plan.count, 0);
  assert.equal(plan.reason.code, 'no_material');
  assert.match(plan.reason.message_es, /No hay material: carga un paquete/);
});

test('E6 todo pausado o sanguijuela: plan vacío «only_excluded»', () => {
  const list = [mk({ suspended: true }), mk({ leech: true }), mk({ lapses: 9 })];
  const plan = run(list);
  assert.equal(plan.count, 0);
  assert.equal(plan.reason.code, 'only_excluded');
});

test('E7 repasos y nuevas: los repasos van primero y las nuevas llenan el hueco', () => {
  const list = [...due(6), ...fresh(20, 't.n')];
  const plan = run(list);
  assert.equal(plan.count, 16);
  const kinds = plan.items.map((i) => i.kind);
  assert.equal(kinds.filter((k) => k === 'review').length, 6);
  assert.equal(kinds.filter((k) => k === 'new').length, 10);
});

test('E8 tope de nuevas ya usado hoy: plan vacío «new_cap_reached»', () => {
  const plan = run(fresh(5, 't.a'), { newToday: 10 });
  assert.equal(plan.count, 0);
  assert.equal(plan.reason.code, 'new_cap_reached');
});

test('E9 poco material y entradas repetidas: nunca duplica', () => {
  const base = due(7);
  const list = [...base, base[0], base[1]];
  const plan = run(list);
  assert.equal(plan.count, 7);
  assert.equal(new Set(plan.items.map((i) => i.cardId)).size, 7);
});

test('E10 topicFocus: solo ese tema; vencidas primero y luego práctica', () => {
  const list = [...due(30), ...Array.from({ length: 4 }, () => mk({ topics: ['t.q'], due: ago(2) })), ...Array.from({ length: 6 }, () => mk({ topics: ['t.q'], due: ahead(3) }))];
  const plan = run(list, { topicFocus: 't.q' });
  assert.equal(plan.count, 10);
  assert.ok(plan.items.every((i) => i.topics.includes('t.q')));
  assert.equal(plan.items.filter((i) => i.why === 'overdue').length, 4);
  assert.equal(plan.items.filter((i) => i.why === 'practice').length, 6);
});

test('E11 errorFocus: solo ítems con errores propios y sin nuevas', () => {
  const list = due(10);
  const bad = list[3].card.itemId;
  const errors = [{ id: 'e1', itemId: bad, code: 'x', topics: ['t.a'], count: 3, impact: 2, createdAt: ago(1) }];
  const plan = run([...list, ...fresh(5, 't.n')], { errorFocus: true, errors });
  assert.ok(plan.count >= 1);
  assert.equal(plan.items[0].itemId, bad);
  assert.ok(plan.items.every((i) => i.kind === 'review' && i.why === 'error'));
  assert.equal(plan.rescue.active, false);
});

test('E12 con dominio: el reconocimiento va antes que la producción en un tema nuevo', () => {
  const list = [...fresh(4, 't.a', 'mcq_en_es'), ...fresh(4, 't.a', 'translate_word')];
  const plan = run(list, { mastery: { 't.a': 0 }, size: 4 });
  assert.equal(plan.count, 4);
  assert.ok(plan.items.every((i) => i.production === false));
});

// ── CA 1–6 (oráculos independientes) ─────────────────────────────────────────────────────────────
test('CA1 20 ítems exactos si hay material, menos si no hay, nunca duplica', () => {
  for (const k of [0, 1, 7, 19, 20, 21, 35, 60]) {
    const list = due(k);
    const plan = run(list);
    assert.equal(plan.count, Math.min(20, k), `k=${k}`);
    assert.equal(plan.items.length, plan.count);
    assert.equal(new Set(plan.items.map((i) => i.cardId)).size, plan.items.length, `dup k=${k}`);
  }
  for (const size of [1, 5, 33]) assert.equal(run(due(40), { size }).count, size);
  assert.equal(SESSION_CONFIG.size, 20);
});

test('CA2 intercalado: nunca más de 2 seguidos del mismo tema ni tipo cuando hay opciones', () => {
  for (let seed = 1; seed <= 25; seed += 1) {
    const list = Array.from({ length: 36 }, (_, i) => mk({ topics: [`t.${'abcd'[i % 4]}`], due: ago(1 + (i % 7)) }, TYPES[(i * 3 + seed) % 6]));
    const plan = build({ now: NOW, ...set(list), rng: createRng(seed), size: 24 });
    assert.equal(plan.count, 24);
    assert.ok(maxRun(plan.items.map((i) => i.topic)) <= 2, `tema seed=${seed}`);
    assert.ok(maxRun(plan.items.map((i) => i.exerciseType)) <= 2, `tipo seed=${seed}`);
  }
});

test('CA3 sin ítems suspendidos, sanguijuelas ni retirados', () => {
  const ok = due(12);
  const bad = [mk({ suspended: true }), mk({ leech: true }), mk({ lapses: 12 }), mk({ topics: ['t.old'] }), mk({})];
  const topics = [{ id: 't.old', status: 'deprecated' }, { id: 't.a', status: 'active' }];
  const plan = run([...ok, ...bad], { topics, deprecatedItemIds: [bad[4].card.itemId] });
  const byId = cardOf([...ok, ...bad]);
  assert.equal(plan.count, 12);
  for (const it of plan.items) {
    const c = byId.get(it.cardId);
    assert.notEqual(c.suspended, true); assert.notEqual(c.leech, true); assert.ok(c.lapses < 8);
    assert.notEqual(it.itemId, bad[4].card.itemId); assert.ok(!it.topics.includes('t.old'));
  }
});

test('CA4 cupos: tope diario de nuevas, máx. 3 temas en curso por área, tope de repasos', () => {
  const a = run(fresh(30, 't.a'), { newCap: 6, newToday: 2 });
  assert.equal(a.items.filter((i) => i.kind === 'new').length, 4);
  const list = ['a', 'b', 'c', 'd', 'e', 'f'].flatMap((s) => fresh(3, `t.${s}`));
  const b = run(list, { topics: topicsAreas, size: 18, newCap: 18 });
  const opened = new Set(b.items.filter((i) => i.kind === 'new').map((i) => i.topic));
  assert.equal(opened.size, 3);
  const c = run(due(40), { reviewCap: 100, reviewsToday: 95 });
  assert.equal(c.count, 5);
  assert.equal(run(fresh(30, 't.a'), { newCap: 0 }).count, 0);
});

test('CA5 con 0 ítems devuelve plan vacío con razón en texto neutro', () => {
  const plan = run([]);
  assert.equal(plan.count, 0);
  assert.deepEqual(plan.items, []);
  assert.equal(plan.reason.code, 'no_material');
  const causes = [run([mk({ suspended: true })]), run(fresh(3, 't.a'), { newToday: 10 }), run(due(3), { reviewsToday: 100 }), run([mk({ due: ahead(5) })])];
  for (const p of causes) {
    assert.equal(p.count, 0);
    assert.ok(p.reason && typeof p.reason.code === 'string' && p.reason.message_es.length > 10);
    assert.doesNotMatch(p.reason.message_es, /racha|culpa|fallaste|perdiste|vergüenza/i);
  }
});

test('CA6 determinismo: misma semilla, mismo plan; no depende del orden de entrada', () => {
  const list = [...due(40), ...fresh(12, 't.n')];
  const a = run(list);
  const b = run(list);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  const rev = build({ now: NOW, cards: set(list).cards.reverse(), items: set(list).items.reverse(), rng: createRng(11) });
  assert.deepEqual(rev.items.map((i) => i.cardId), a.items.map((i) => i.cardId));
  assert.equal(a.generatedAt, NOW.toISOString());
});
