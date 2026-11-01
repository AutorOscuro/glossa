// @purpose: Pruebas del armador de sesiones T1 (core/session.js): orden, rescate, exclusiones, cupos, planes vacíos con razón, determinismo y CA 1, 3, 5 y 6.
// 1.8-T1: candidatos y orden base. Tarjetas construidas a mano con fechas relativas a NOW; el azar es siempre createRng con semilla.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from '../core/session.js';
import { SESSION_CONFIG, EMPTY_REASONS } from '../core/session.config.js';
import { createRng } from '../core/rng.js';
import { retrievability } from '../core/srs.js';

const NOW = new Date('2026-10-25T12:00:00.000Z');
const DAY = 86400000;
const ago = (d) => new Date(NOW.getTime() - d * DAY).toISOString();
let n = 0;
const card = (over = {}) => {
  n += 1;
  const itemId = over.itemId ?? `g.t.${String(n).padStart(4, '0')}`;
  return { id: `${itemId}#${over.facet ?? 0}`, itemId, facet: 0, topics: ['gram.t.one'], state: 2, due: ago(1), stability: 5, difficulty: 5, reps: 3, lapses: 0, last_review: ago(6), suspended: false, leech: false, fav: false, created: ago(30), ...over };
};
const run = (cards, extra = {}) => build({ now: NOW, cards, rng: createRng(7), ...extra });
const ids = (plan) => plan.items.map((i) => i.cardId);

test('validación: entradas inválidas lanzan con mensaje claro', () => {
  const ok = { now: NOW, cards: [], rng: createRng(1) };
  assert.throws(() => build(), /objeto de entrada/);
  assert.throws(() => build({ ...ok, now: undefined }), /falta now/);
  assert.throws(() => build({ ...ok, now: 'no es fecha' }), /toDate/);
  assert.throws(() => build({ ...ok, cards: null }), /lista de tarjetas/);
  assert.throws(() => build({ ...ok, rng: undefined }), /rng/);
  assert.throws(() => build({ ...ok, rng: { next() {} } }), /rng/);
  for (const size of [0, -1, 1.5, '20', 101, NaN]) assert.throws(() => build({ ...ok, size }), /size/, String(size));
  for (const reviewCap of [0, 2.5, '100']) assert.throws(() => build({ ...ok, reviewCap }), /reviewCap/);
  for (const reviewsToday of [-1, 1.2, '3']) assert.throws(() => build({ ...ok, reviewsToday }), /reviewsToday/);
  assert.throws(() => build({ ...ok, leechThreshold: 0 }), /leechThreshold/);
  assert.throws(() => build({ ...ok, retrievability: 3 }), /retrievability/);
  assert.throws(() => build({ ...ok, items: 5 }), /session\.build: items debe ser/);
  assert.throws(() => build({ ...ok, topics: {} }), /session\.build: topics debe ser/);
  assert.throws(() => build({ ...ok, deprecatedItemIds: 'x' }), /deprecatedItemIds: debe ser/);
  assert.equal(build({ ...ok, reviewsToday: 0, size: 1, reviewCap: 1 }).count, 0, 'los valores límite válidos no lanzan');
});

test('orden normal: la más atrasada primero y solo las vencidas (CA 1 parcial)', () => {
  const a = card({ due: ago(1) });
  const b = card({ due: ago(5) });
  const c = card({ due: ago(3) });
  const futura = card({ due: new Date(NOW.getTime() + DAY).toISOString() });
  const plan = run([a, futura, b, c]);
  assert.deepEqual(ids(plan), [b.id, c.id, a.id]);
  assert.equal(plan.count, 3);
  assert.equal(plan.reason, null);
  assert.equal(plan.stats.notDue, 1);
  assert.ok(plan.items.every((i) => i.kind === 'review' && i.why === 'overdue'));
  assert.deepEqual(plan.items.map((i) => i.daysOverdue), [5, 3, 1]);
});

test('una tarjeta que vence justo ahora cuenta como vencida; un milisegundo después, no', () => {
  const justa = card({ due: NOW.toISOString() });
  const despues = card({ due: new Date(NOW.getTime() + 1).toISOString() });
  assert.deepEqual(ids(run([justa, despues])), [justa.id]);
});

test('tamaño: 20 por defecto, `size` configurable y nunca más de lo que hay (CA 1)', () => {
  const cards = Array.from({ length: 35 }, (_, i) => card({ due: ago(1 + i / 100) }));
  assert.equal(SESSION_CONFIG.size, 20);
  assert.equal(run(cards).count, 20);
  assert.equal(run(cards).requested, 20);
  assert.equal(run(cards, { size: 5 }).count, 5);
  assert.equal(run(cards.slice(0, 7)).count, 7);
  assert.equal(run(cards, { size: 100 }).count, 35);
  assert.equal(run(cards).stats.left, 15);
});

test('nunca duplica: ids repetidos se cuentan una vez (CA 1)', () => {
  const a = card();
  const b = card();
  const plan = run([a, b, { ...a }, a, b]);
  assert.equal(plan.count, 2);
  assert.equal(new Set(ids(plan)).size, 2);
  assert.equal(plan.stats.duplicates, 3);
});

test('misma tarjeta, otra faceta: son tarjetas distintas y ambas entran', () => {
  const p = card({ itemId: 'v.go.0001', facet: 1 });
  const q = card({ itemId: 'v.go.0001', facet: 2 });
  assert.equal(run([p, q]).count, 2);
});

test('exclusiones: suspendidas, sanguijuelas (marcadas o por fallos), ítems y temas retirados (CA 3)', () => {
  const buena = card();
  const susp = card({ suspended: true });
  const leechMarcada = card({ leech: true });
  const leechPorFallos = card({ lapses: 8 });
  const casi = card({ lapses: 7 });
  const itemRetirado = card({ itemId: 'g.old.0001' });
  const temaRetirado = card({ topics: ['gram.old.topic'] });
  const mixto = card({ topics: ['gram.old.topic', 'gram.t.one'] });
  const plan = run([buena, susp, leechMarcada, leechPorFallos, casi, itemRetirado, temaRetirado, mixto], {
    deprecatedItemIds: new Set(['g.old.0001']),
    topics: [{ id: 'gram.old.topic', status: 'deprecated' }, { id: 'gram.t.one', status: 'active' }],
  });
  assert.deepEqual(new Set(ids(plan)), new Set([buena.id, casi.id, mixto.id]));
  assert.deepEqual(plan.stats.excluded, { suspended: 1, leech: 2, deprecated_item: 1, deprecated_topic: 1 });
  assert.ok(!plan.items.some((i) => [susp, leechMarcada, leechPorFallos, itemRetirado, temaRetirado].some((c) => c.id === i.cardId)));
});

test('exclusión: una tarjeta cuenta una sola causa; el umbral de sanguijuela es configurable; deprecatedItemIds acepta lista', () => {
  const doble = card({ suspended: true, leech: true, itemId: 'g.old.0002' });
  const plan = run([doble], { deprecatedItemIds: ['g.old.0002'] });
  assert.deepEqual(plan.stats.excluded, { suspended: 1, leech: 0, deprecated_item: 0, deprecated_topic: 0 });
  const tres = card({ lapses: 3 });
  assert.equal(run([tres], { leechThreshold: 3 }).count, 0);
  assert.equal(run([tres], { leechThreshold: 4 }).count, 1);
});

test('las de fecha ilegible no entran y no rompen; las nuevas van después de los repasos (T2)', () => {
  const nueva = card({ state: 0, due: ago(2) });
  const rota = card({ due: 'no-es-fecha' });
  const sinDue = card({ due: undefined });
  const buena = card();
  const plan = run([nueva, rota, sinDue, buena, null, 5, {}, { id: '' }]);
  assert.deepEqual(ids(plan), [buena.id, nueva.id]);
  assert.equal(plan.stats.notStarted, 1);
  assert.equal(plan.stats.invalid, 2 + 4);
});

test('exerciseType sale de `items` (lista o Map) y es null si no se conoce', () => {
  const a = card({ itemId: 'g.x.0001' });
  const b = card({ itemId: 'g.x.0002' });
  const items = [{ id: 'g.x.0001', type: 'fix_error' }, { id: 'zz', type: 'otro' }, null, { id: 'g.x.0009' }];
  const tipos = Object.fromEntries(run([a, b], { items }).items.map((i) => [i.itemId, i.exerciseType]));
  assert.deepEqual(tipos, { 'g.x.0001': 'fix_error', 'g.x.0002': null });
  const map = new Map([['g.x.0002', { id: 'g.x.0002', type: 'cloze_basic' }]]);
  assert.equal(run([b], { items: map }).items[0].exerciseType, 'cloze_basic');
});

test('modo rescate: > 1,5 × tope vencidas → solo el cupo (0,5 × tope), las de menor retrievabilidad primero', () => {
  // tope 10 → umbral 15, cupo 5. 16 vencidas con estabilidades distintas: menor estabilidad = menor R.
  const cards = Array.from({ length: 16 }, (_, i) => card({ stability: 1 + i, due: ago(3), last_review: ago(10) }));
  const plan = run(cards, { reviewCap: 10, size: 20 });
  assert.equal(plan.rescue.active, true);
  assert.equal(plan.rescue.quota, 5);
  assert.equal(plan.rescue.threshold, 15);
  assert.equal(plan.rescue.overdueCount, 16);
  assert.equal(plan.count, 5);
  assert.ok(plan.items.every((i) => i.why === 'rescue'));
  const rs = plan.items.map((i) => i.r);
  assert.deepEqual(rs, [...rs].sort((x, y) => x - y));
  const pedidas = new Set(plan.items.map((i) => i.cardId));
  for (const c of cards.slice(0, 5)) assert.ok(pedidas.has(c.id), `entra la de estabilidad ${c.stability}`);
  assert.match(plan.rescue.message_es, /16 repasos pendientes/);
  assert.equal(plan.stats.left, 11);
});

test('rescate: justo en el umbral NO se activa; un repaso más, sí', () => {
  const quince = Array.from({ length: 15 }, () => card());
  assert.equal(run(quince, { reviewCap: 10 }).rescue.active, false);
  assert.equal(run([...quince, card()], { reviewCap: 10 }).rescue.active, true);
  assert.equal(run(quince, { reviewCap: 10 }).count, 10, 'sin rescate el tope diario limita a 10');
});

test('rescate: el size manda si es menor que el cupo; reviewsToday se resta del cupo', () => {
  const cards = Array.from({ length: 30 }, () => card());
  assert.equal(run(cards, { reviewCap: 10, size: 3 }).count, 3);
  assert.equal(run(cards, { reviewCap: 10, reviewsToday: 3 }).count, 2, 'cupo 5 − 3 hechos');
  assert.equal(run(cards, { reviewCap: 10, reviewsToday: 5 }).count, 0);
});

test('tope diario: reviewsToday se resta del tope y al llegar a él el plan queda vacío con razón', () => {
  const cards = Array.from({ length: 12 }, () => card());
  assert.equal(run(cards, { reviewCap: 10, reviewsToday: 4 }).count, 6);
  const vacio = run(cards, { reviewCap: 10, reviewsToday: 10 });
  assert.equal(vacio.count, 0);
  assert.equal(vacio.reason.code, 'daily_cap_reached');
  assert.equal(run(cards, { reviewCap: 10, reviewsToday: 99 }).reason.code, 'daily_cap_reached');
});

test('planes vacíos con razón: sin material, solo excluidas, tope alcanzado, nada vencido (CA 5)', () => {
  const vacio = run([]);
  assert.equal(vacio.count, 0);
  assert.deepEqual(vacio.items, []);
  assert.equal(vacio.reason.code, 'no_material');
  assert.equal(vacio.reason.message_es, 'No hay material: carga un paquete.');
  assert.equal(run([null, 3]).reason.code, 'no_material', 'solo basura = sin material');
  assert.equal(run([card({ suspended: true }), card({ leech: true })]).reason.code, 'only_excluded');
  assert.equal(run([card({ due: new Date(NOW.getTime() + DAY).toISOString() })]).reason.code, 'nothing_due');
  assert.equal(run([card({ state: 0 })], { newCap: 0 }).reason.code, 'nothing_due', 'cupo de nuevas en 0 y nada ha ocurrido hoy: nada vencido');
  assert.equal(run([card({ suspended: true }), card({ due: new Date(NOW.getTime() + DAY).toISOString() })]).reason.code, 'nothing_due');
  for (const code of Object.keys(EMPTY_REASONS)) assert.equal(typeof EMPTY_REASONS[code], 'string');
});

test('un plan con material no lleva razón; un plan vacío siempre la lleva', () => {
  assert.equal(run([card()]).reason, null);
  for (const cards of [[], [card({ suspended: true })]]) assert.ok(run(cards).reason?.message_es);
  assert.equal(run([card({ state: 0 })]).reason, null, 'solo nuevas: hay plan y no hay razón');
});

test('tono: ningún texto habla de rachas, culpa ni pérdida', () => {
  const textos = [...Object.values(EMPTY_REASONS), run(Array.from({ length: 200 }, () => card())).rescue.message_es];
  for (const t of textos) assert.doesNotMatch(t, /racha|perdiste|fallaste|atrasad|culpa|tarde|deber[ií]as/i, t);
});

test('determinismo: misma semilla y mismos datos → plan idéntico; el orden de entrada no importa (CA 6)', () => {
  const mismaFecha = ago(2);
  const cards = Array.from({ length: 40 }, (_, i) => card({ due: i % 3 === 0 ? mismaFecha : ago(1 + (i % 7)) }));
  const a = build({ now: NOW, cards, rng: createRng(42) });
  const b = build({ now: NOW, cards, rng: createRng(42) });
  const c = build({ now: NOW, cards: [...cards].reverse(), rng: createRng(42) });
  assert.deepEqual(a, b);
  assert.deepEqual(ids(a), ids(c));
  assert.deepEqual(a, c);
});

test('el azar solo desempata: con empates, otra semilla puede cambiar el orden pero no el conjunto ni la urgencia', () => {
  const mismaFecha = ago(2);
  const cards = Array.from({ length: 12 }, () => card({ due: mismaFecha }));
  const planes = [1, 2, 3, 4, 5, 6].map((s) => build({ now: NOW, cards, rng: createRng(s), size: 12 }));
  assert.ok(new Set(planes.map((p) => ids(p).join())).size > 1, 'las semillas desempatan distinto');
  for (const p of planes) assert.deepEqual(new Set(ids(p)), new Set(cards.map((c) => c.id)));
  // sin empates, la semilla no influye
  const sinEmpates = Array.from({ length: 12 }, (_, i) => card({ due: ago(1 + i) }));
  const o = [1, 2, 3].map((s) => ids(build({ now: NOW, cards: sinEmpates, rng: createRng(s), size: 12 })).join());
  assert.equal(new Set(o).size, 1);
});

test('no muta la entrada y el plan está congelado', () => {
  const cards = Array.from({ length: 5 }, () => card());
  const copia = structuredClone(cards);
  const plan = run(cards);
  assert.deepEqual(cards, copia);
  assert.ok(Object.isFrozen(plan) && Object.isFrozen(plan.items) && Object.isFrozen(plan.items[0]) && Object.isFrozen(plan.stats) && Object.isFrozen(plan.stats.excluded) && Object.isFrozen(plan.rescue));
  assert.ok(Object.isFrozen(plan.items[0].topics));
  assert.ok(Object.isFrozen(run([]).reason));
});

test('retrievability inyectable: el rescate ordena con la función que se pase; un valor ilegible cuenta como el más urgente', () => {
  const a = card({ itemId: 'g.r.0001' });
  const b = card({ itemId: 'g.r.0002' });
  const c = card({ itemId: 'g.r.0003' });
  const rows = Array.from({ length: 16 }, () => card());
  const fake = (x) => ({ [a.id]: 0.9, [b.id]: 0.2, [c.id]: NaN }[x.id] ?? 0.99);
  const plan = run([a, b, c, ...rows], { reviewCap: 10, retrievability: fake });
  assert.equal(plan.rescue.active, true);
  assert.deepEqual(ids(plan).slice(0, 3), [c.id, b.id, a.id]);
  assert.equal(plan.items[0].r, 0);
  // sin función propia usa la de FSRS
  const solo = run([a]);
  assert.equal(solo.items[0].r, Math.round(retrievability(a, NOW) * 10000) / 10000);
});

test('generatedAt es el now recibido en ISO y `now` puede ser Date, número o ISO', () => {
  const c = card();
  assert.equal(run([c]).generatedAt, NOW.toISOString());
  for (const now of [NOW.getTime(), NOW.toISOString()]) assert.equal(build({ now, cards: [c], rng: createRng(1) }).generatedAt, NOW.toISOString());
});

test('rendimiento: 5.000 tarjetas vencidas en menos de 300 ms', () => {
  const cards = Array.from({ length: 5000 }, (_, i) => card({ itemId: `g.big.${i}`, due: ago(1 + (i % 30)) }));
  const t0 = performance.now();
  const plan = run(cards, { reviewCap: 10000 });
  const ms = performance.now() - t0;
  assert.equal(plan.count, 20);
  assert.ok(ms < 300, `${ms.toFixed(0)} ms`);
});

// ---- Casos límite añadidos tras las roturas intencionales (1.8-T1) ----
test('temas: una tarjeta sin temas o con temas en borrador SÍ se ofrece; solo `deprecated` retira', () => {
  const sinTemas = card({ topics: [] });
  const borrador = card({ topics: ['gram.draft.topic'] });
  const activo = card({ topics: ['gram.active.topic'] });
  const plan = run([sinTemas, borrador, activo], { topics: [{ id: 'gram.draft.topic', status: 'draft' }, { id: 'gram.active.topic', status: 'active' }] });
  assert.equal(plan.count, 3);
  assert.equal(plan.stats.excluded.deprecated_topic, 0);
});

test('temas: una entrada de `topics` sin id no retira nada; un `items` sin id no da tipo a tarjetas sin itemId', () => {
  const rara = card({ topics: [undefined] });
  assert.equal(run([rara], { topics: [{ status: 'deprecated' }] }).count, 1);
  const sinItem = card({ itemId: undefined, id: 'sin-item#0' });
  const plan = run([sinItem], { items: [{ type: 'cloze_basic' }] });
  assert.equal(plan.items[0].exerciseType, null);
  assert.equal(plan.items[0].itemId, null);
});

test('campos del plan: facet por defecto 0, version 1, requested = size, selected = count', () => {
  const sinFacet = card({ facet: undefined, id: 'f.x.0001#0', itemId: 'f.x.0001' });
  const plan = run([sinFacet], { size: 5 });
  assert.equal(plan.items[0].facet, 0);
  assert.equal(plan.version, 1);
  assert.equal(plan.requested, 5);
  assert.equal(plan.stats.selected, plan.count);
  assert.equal(plan.stats.selected, 1);
});

test('daysOverdue: días completos hacia abajo y sin tope artificial', () => {
  const casiDos = card({ due: new Date(NOW.getTime() - 1.6 * DAY).toISOString() });
  const lejana = card({ due: ago(150) });
  const plan = run([casiDos, lejana]);
  const por = Object.fromEntries(plan.items.map((i) => [i.cardId, i.daysOverdue]));
  assert.equal(por[casiDos.id], 1);
  assert.equal(por[lejana.id], 150);
});

test('sin nada vencido y con el tope diario ya alcanzado, la razón es «nada vencido», no «tope»', () => {
  const futura = card({ due: new Date(NOW.getTime() + DAY).toISOString() });
  assert.equal(run([futura], { reviewCap: 5, reviewsToday: 5 }).reason.code, 'nothing_due');
});

test('rendimiento en rescate: 5.000 vencidas con la retrievabilidad real de FSRS, el mejor de 3 intentos en menos de 300 ms', () => {
  const cards = Array.from({ length: 5000 }, (_, i) => card({ itemId: `g.res.${i}`, due: ago(1 + (i % 30)), stability: 1 + (i % 20), last_review: ago(40) }));
  let best = Infinity;
  let plan;
  for (let k = 0; k < 3; k += 1) {
    const t0 = performance.now();
    plan = run(cards); // tope por defecto 100 → 5.000 > 150: rescate
    best = Math.min(best, performance.now() - t0);
  }
  assert.equal(plan.rescue.active, true);
  assert.equal(plan.count, 20);
  assert.ok(best < 300, `${best.toFixed(0)} ms`);
});

// ───────────── T2: nuevas, cupos y energía ─────────────
const fresh = (over = {}) => card({ state: 0, due: ago(0), stability: 0, difficulty: 0, reps: 0, last_review: null, ...over });
const TOPICS = [
  { id: 'gram.a', area: 'gram', priority: 5, status: 'draft' }, { id: 'gram.b', area: 'gram', priority: 4, status: 'draft' },
  { id: 'gram.c', area: 'gram', priority: 3, status: 'draft' }, { id: 'gram.d', area: 'gram', priority: 2, status: 'draft' },
  { id: 'vocab.a', area: 'vocab', priority: 1, status: 'draft' },
];
const freshIn = (topic, k, over = {}) => Array.from({ length: k }, (_, i) => fresh({ itemId: `${topic}.${String(i).padStart(2, '0')}`, topics: [topic], ...over }));
const newIds = (plan) => plan.items.filter((i) => i.kind === 'new').map((i) => i.cardId);

test('T2: solo nuevas → se ofrecen hasta el tope diario (10 por defecto), con kind/why «new» y r null', () => {
  const plan = run(freshIn('gram.a', 15), { topics: TOPICS });
  assert.equal(plan.count, 10);
  assert.ok(plan.items.every((i) => i.kind === 'new' && i.why === 'new' && i.r === null && i.daysOverdue === 0));
  assert.equal(plan.stats.newSelected, 10);
  assert.equal(plan.stats.newSkipped.cap, 5);
  assert.equal(plan.reason, null);
});

test('T2: los repasos van primero y las nuevas llenan solo el hueco que queda', () => {
  const rev = Array.from({ length: 15 }, (_, i) => card({ due: ago(2 + i) }));
  const plan = run([...rev, ...freshIn('gram.a', 15)], { topics: TOPICS });
  assert.equal(plan.count, 20);
  const reviews = plan.items.filter((i) => i.kind === 'review');
  assert.equal(reviews.length, 15);
  assert.deepEqual(reviews.map((i) => i.cardId), [...rev].reverse().map((c) => c.id), 'los repasos conservan su orden de urgencia (T3 solo intercala las nuevas)');
  assert.equal(plan.items[0].kind, 'review');
  assert.equal(plan.stats.newSelected, 5);
});

test('T2: newToday se descuenta del tope; con el tope gastado la razón es new_cap_reached', () => {
  const cards = freshIn('gram.a', 15);
  assert.equal(run(cards, { topics: TOPICS, newToday: 7 }).count, 3);
  const vacio = run(cards, { topics: TOPICS, newToday: 10 });
  assert.equal(vacio.count, 0);
  assert.equal(vacio.reason.code, 'new_cap_reached');
  assert.equal(run(cards, { topics: TOPICS, newToday: 99 }).newBudget, 0, 'nunca negativo');
  assert.equal(run(cards, { topics: TOPICS, newCap: 4 }).count, 4);
  assert.equal(run(cards, { topics: TOPICS, newCap: 0 }).reason.code, 'nothing_due');
});

test('T2: el modo rescate no ofrece nuevas', () => {
  const rev = Array.from({ length: 160 }, (_, i) => card({ due: ago(3 + i % 5) }));
  const plan = run([...rev, ...freshIn('gram.a', 5)], { topics: TOPICS });
  assert.equal(plan.rescue.active, true);
  assert.equal(plan.stats.newSelected, 0);
  assert.equal(plan.stats.newSkipped.rescue, 5);
});

test('T2: máximo 3 temas en curso por área; los temas de otras áreas no cuentan', () => {
  const cards = [...freshIn('gram.a', 2), ...freshIn('gram.b', 2), ...freshIn('gram.c', 2), ...freshIn('gram.d', 2), ...freshIn('vocab.a', 2)];
  const plan = run(cards, { topics: TOPICS });
  const temas = new Set(plan.items.map((i) => i.topics[0]));
  assert.deepEqual([...temas].sort(), ['gram.a', 'gram.b', 'gram.c', 'vocab.a'], 'gram.d (prioridad menor) se queda fuera');
  assert.equal(plan.stats.newSkipped.area, 2);
});

test('T2: un tema ya empezado cuenta como en curso y se llena antes de abrir otros', () => {
  const empezadas = [card({ itemId: 'gram.d.s1', topics: ['gram.d'], due: ago(-5) }), card({ itemId: 'gram.c.s1', topics: ['gram.c'], due: ago(-5) }), card({ itemId: 'gram.b.s1', topics: ['gram.b'], due: ago(-5) })];
  const cards = [...empezadas, ...freshIn('gram.a', 2), ...freshIn('gram.b', 2), ...freshIn('gram.c', 2), ...freshIn('gram.d', 2)];
  const plan = run(cards, { topics: TOPICS });
  const temas = new Set(plan.items.map((i) => i.topics[0]));
  assert.deepEqual([...temas].sort(), ['gram.b', 'gram.c', 'gram.d'], 'gram.a no se abre: ya hay 3 en curso');
  assert.equal(plan.items[0].topics[0], 'gram.b', 'entre los empezados, mayor prioridad primero');
});

test('T2: un tema empezado cuyas nuevas ya no quedan no ocupa cupo', () => {
  const hechas = ['gram.b', 'gram.c', 'gram.d'].map((t) => card({ itemId: `${t}.s1`, topics: [t], due: ago(-5) }));
  const plan = run([...hechas, ...freshIn('gram.a', 2)], { topics: TOPICS });
  assert.deepEqual(newIds(plan).length, 2, 'sin nuevas pendientes en b, c ni d, a se puede abrir');
});

test('T2: `areas` limita solo las nuevas; los repasos no se filtran', () => {
  const rev = card({ topics: ['vocab.a'], due: ago(3) });
  const plan = run([rev, ...freshIn('gram.a', 3), ...freshIn('vocab.a', 3)], { topics: TOPICS, areas: ['gram'] });
  assert.ok(ids(plan).includes(rev.id));
  assert.ok(newIds(plan).every((id) => id.startsWith('gram.a')));
  assert.equal(plan.stats.newSkipped.area_filter, 3);
  assert.equal(run(freshIn('gram.a', 3), { topics: TOPICS, areas: [] }).count, 0, 'lista vacía de áreas: ninguna nueva');
});

test('T2: tarjetas nuevas sin tema o con tema sin área no tienen límite de área', () => {
  const sueltas = Array.from({ length: 4 }, (_, i) => fresh({ itemId: `x.${i}`, topics: [] }));
  const raras = Array.from({ length: 4 }, (_, i) => fresh({ itemId: `y.${i}`, topics: [`otro.${i}`] }));
  assert.equal(run([...sueltas, ...raras]).count, 8);
});

test('T2: el tema de una tarjeta es su primer tema no retirado', () => {
  const t = [...TOPICS, { id: 'gram.old', area: 'gram', status: 'deprecated' }];
  const c = fresh({ itemId: 'm.1', topics: ['gram.old', 'vocab.a'] });
  const plan = run([c], { topics: t });
  assert.equal(plan.count, 1);
  assert.equal(run([c], { topics: t, areas: ['vocab'] }).count, 1);
  assert.equal(run([c], { topics: t, areas: ['gram'] }).count, 0);
});

test('T2: las nuevas se ordenan por ítem y faceta; las pausadas, sanguijuelas y retiradas no se ofrecen', () => {
  const a1 = fresh({ itemId: 'gram.a.02', facet: 1, topics: ['gram.a'] });
  const a0 = fresh({ itemId: 'gram.a.02', facet: 0, topics: ['gram.a'] });
  const a2 = fresh({ itemId: 'gram.a.01', topics: ['gram.a'] });
  const malas = [fresh({ itemId: 'gram.a.03', topics: ['gram.a'], suspended: true }), fresh({ itemId: 'gram.a.04', topics: ['gram.a'], leech: true }), fresh({ itemId: 'gram.a.05', topics: ['gram.a'] })];
  const plan = run([a1, a0, a2, ...malas], { topics: TOPICS, deprecatedItemIds: ['gram.a.05'] });
  assert.deepEqual(ids(plan), [a2.id, a0.id, a1.id]);
});

test('T2: energía baja = mitad de ítems, mitad de nuevas y sin cambiar el orden de los repasos', () => {
  const rev = Array.from({ length: 30 }, (_, i) => card({ due: ago(2 + i) }));
  const low = run(rev, { energy: 'low' });
  assert.equal(low.requested, 10);
  assert.equal(low.count, 10);
  assert.deepEqual(ids(low), ids(run(rev, { size: 10 })), 'mismos repasos y mismo orden que una sesión normal de 10');
  assert.equal(low.energy, 'low');
  assert.equal(run(freshIn('gram.a', 20), { topics: TOPICS, energy: 'low' }).count, 5, 'nuevas: floor(10 × 0,5)');
  assert.equal(run(freshIn('gram.a', 20), { topics: TOPICS, energy: 'low', size: 1 }).count, 1, 'tamaño mínimo 1');
});

test('T2: energía mid/high igual que sin energía; un valor desconocido se ignora', () => {
  const cards = [...Array.from({ length: 25 }, (_, i) => card({ due: ago(2 + i) })), ...freshIn('gram.a', 5)];
  const base = run(cards, { topics: TOPICS });
  for (const energy of ['mid', 'high', 'medium', 'LOW', '', null, 7, 'toString', '__proto__']) {
    const p = run(cards, { topics: TOPICS, energy });
    assert.deepEqual(ids(p), ids(base), String(energy));
    assert.equal(p.energy, ['high'].includes(energy) ? 'high' : 'mid', String(energy));
  }
});

test('T2: energía baja aplaza los ejercicios largos (repasos y nuevas) sin perderlos', () => {
  const lig = card({ itemId: 'l.1', due: ago(2) }); const pes = card({ itemId: 'p.1', due: ago(9) });
  const nl = fresh({ itemId: 'nl.1', topics: ['gram.a'] }); const np = fresh({ itemId: 'np.1', topics: ['gram.a'] });
  const items = [{ id: 'l.1', type: 'mcq_en_es' }, { id: 'p.1', type: 'write_essay' }, { id: 'nl.1', type: 'prep_pick' }, { id: 'np.1', type: 'voice_chat' }];
  const low = run([lig, pes, nl, np], { items, topics: TOPICS, energy: 'low' });
  assert.deepEqual(ids(low), [lig.id, nl.id]);
  assert.equal(low.stats.deferredHeavy, 1);
  assert.equal(low.stats.newSkipped.heavy, 1);
  assert.equal(run([lig, pes, nl, np], { items, topics: TOPICS, energy: 'mid' }).count, 4, 'con energía normal entran todos');
  const solo = run([pes], { items, energy: 'low' });
  assert.equal(solo.reason.code, 'energy_deferred');
  const sinTipo = run([card({ itemId: 'q.1' })], { items, energy: 'low' });
  assert.equal(sinTipo.count, 1, 'un ítem sin tipo conocido no se aplaza');
});

test('T2: `minutes` acota el tamaño (2 ítems por minuto) y se combina con size y energía', () => {
  const rev = Array.from({ length: 60 }, (_, i) => card({ due: ago(2 + i) }));
  assert.equal(run(rev, { minutes: 5 }).count, 10);
  assert.equal(run(rev, { minutes: 30 }).count, 20, 'size manda si es menor');
  assert.equal(run(rev, { minutes: 30, size: 50 }).count, 50);
  assert.equal(run(rev, { minutes: 10, energy: 'low' }).count, 10);
  assert.equal(run(rev, { minutes: 1, energy: 'low' }).requested, 1);
});

test('T2: validación de los parámetros nuevos', () => {
  const ok = { now: NOW, cards: [], rng: createRng(1) };
  for (const minutes of [0, 601, 1.5, '5']) assert.throws(() => build({ ...ok, minutes }), /minutes/, String(minutes));
  for (const newCap of [-1, 1.5, '10']) assert.throws(() => build({ ...ok, newCap }), /newCap/, String(newCap));
  for (const newToday of [-1, 0.5, '1']) assert.throws(() => build({ ...ok, newToday }), /newToday/, String(newToday));
  for (const areas of ['gram', [1], {}]) assert.throws(() => build({ ...ok, areas }), /areas/);
  assert.doesNotThrow(() => build({ ...ok, minutes: 600, newCap: 0, newToday: 0, areas: [] }));
});

test('T2: determinismo con nuevas y sin depender del orden de entrada', () => {
  const cards = [...Array.from({ length: 10 }, (_, i) => card({ due: ago(3 + i % 3) })), ...freshIn('gram.a', 4), ...freshIn('gram.b', 4), ...freshIn('vocab.a', 4)];
  const p1 = run(cards, { topics: TOPICS });
  assert.deepEqual(p1, run([...cards].reverse(), { topics: TOPICS }));
  assert.deepEqual(p1, run(cards, { topics: TOPICS }));
  assert.equal(new Set(ids(p1)).size, p1.count, 'sin duplicados');
});

test('T2: nunca más ítems que size y las nuevas no desplazan a repasos pendientes', () => {
  const rev = Array.from({ length: 40 }, (_, i) => card({ due: ago(2 + i) }));
  const plan = run([...rev, ...freshIn('gram.a', 10)], { topics: TOPICS });
  assert.equal(plan.count, 20);
  assert.equal(plan.stats.newSelected, 0);
  assert.equal(plan.stats.newSkipped.no_room, 10);
});

test('T2: el plan sigue congelado y los textos nuevos son neutros', () => {
  const plan = run(freshIn('gram.a', 3), { topics: TOPICS });
  assert.ok(Object.isFrozen(plan) && Object.isFrozen(plan.items[0]) && Object.isFrozen(plan.stats.newSkipped));
  for (const c of ['new_cap_reached', 'energy_deferred']) assert.doesNotMatch(EMPTY_REASONS[c], /racha|perdiste|fallaste|atrasad|culpa|tarde|deber[ií]as/i);
});

test('T2: redondeo del cupo de nuevas con energía baja (hacia abajo) y orden por prioridad, no por id', () => {
  assert.equal(run(freshIn('gram.a', 10), { topics: TOPICS, energy: 'low', newCap: 5 }).count, 2, 'floor(5 × 0,5) = 2');
  const t = [{ id: 'a.lo', area: 'x', priority: 1 }, { id: 'z.hi', area: 'y', priority: 9 }];
  const plan = run([...freshIn('a.lo', 3), ...freshIn('z.hi', 3)], { topics: t, newCap: 3 });
  assert.ok(plan.items.every((i) => i.topics[0] === 'z.hi'), 'mayor prioridad primero aunque su id sea mayor');
});

test('T2: con cupo corto, el tema ya empezado se llena antes que uno nuevo de más prioridad', () => {
  const t = [{ id: 'z.old', area: 'x', priority: 1 }, { id: 'a.new', area: 'x', priority: 9 }];
  const empezada = card({ itemId: 'z.old.s', topics: ['z.old'], due: ago(-5) });
  const plan = run([empezada, ...freshIn('z.old', 3), ...freshIn('a.new', 3)], { topics: t, newCap: 3 });
  assert.ok(plan.items.every((i) => i.topics[0] === 'z.old'));
});

test('T2: orden de nuevas: primero por ítem y solo después por faceta', () => {
  const b0 = fresh({ itemId: 'gram.a.20', facet: 0, topics: ['gram.a'] });
  const a1 = fresh({ itemId: 'gram.a.10', facet: 1, topics: ['gram.a'] });
  assert.deepEqual(ids(run([b0, a1], { topics: TOPICS })), [a1.id, b0.id]);
});
