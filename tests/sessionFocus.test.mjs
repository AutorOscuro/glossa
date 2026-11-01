// @purpose: Pruebas del armador de sesiones T4 (progresión reconocimiento → producción, topicFocus, errorFocus, determinismo y propiedades).
// 1.8-T4. Tarjetas hechas a mano; el azar es siempre createRng con semilla. Los oráculos (rachas, duplicados, orden) se calculan aquí, no con el código probado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from '../core/session.js';
import { EMPTY_REASONS, PROGRESSION } from '../core/session.config.js';
import { isProduction, masteryIndex, productionShare, orderByProgression } from '../core/sessionProgression.js';
import { errorTargets } from '../core/sessionFocus.js';
import { createRng } from '../core/rng.js';
import { BANDS, SIGNAL_P } from '../core/mastery.config.js';
import { FAMILIES, typesOfFamily } from '../core/contentTypes.js';

const NOW = new Date('2026-10-25T12:00:00.000Z');
const DAY = 86400000;
const ago = (d) => new Date(NOW.getTime() - d * DAY).toISOString();
const ahead = (d) => new Date(NOW.getTime() + d * DAY).toISOString();
const REC = ['mcq_en_es', 'match_pairs', 'order_blocks', 'read_tfng', 'cloze_bank']; // reconocimiento
const PROD = ['translate_word', 'fix_error', 'write_guided', 'phrase_cloze', 'transform']; // producción
let n = 0;
const mk = (over = {}, type = 'mcq_en_es') => {
  n += 1;
  const itemId = over.itemId ?? `i${String(n).padStart(4, '0')}`;
  return { card: { id: `${itemId}#0`, itemId, facet: 0, topics: ['t.a'], state: 2, due: ago(1), stability: 5, difficulty: 5, reps: 3, lapses: 0, last_review: ago(6), suspended: false, leech: false, fav: false, created: ago(30), ...over }, item: { id: itemId, type } };
};
const set = (list) => ({ cards: list.map((x) => x.card), items: list.map((x) => x.item) });
const run = (list, extra = {}) => build({ now: NOW, ...set(list), rng: createRng(7), ...extra });
const ids = (plan) => plan.items.map((i) => i.itemId);
const maxRun = (keys) => { let best = 0; let run = 0; let prev; for (const k of keys) { run = k !== null && k === prev ? run + 1 : 1; prev = k; best = Math.max(best, run); } return best; };
const newOf = (topic, type, k) => Array.from({ length: k }, () => mk({ state: 0, due: ago(0), topics: [topic], reps: 0, stability: 0 }, type));
const mix = (topic, types) => types.map((t) => mk({ state: 0, due: ago(0), topics: [topic], reps: 0, stability: 0 }, t));

test('validación de las entradas nuevas', () => {
  const ok = { now: NOW, cards: [], rng: createRng(1) };
  for (const v of ['', 5, null, []]) assert.throws(() => build({ ...ok, topicFocus: v }), /topicFocus/, String(v));
  for (const v of ['yes', 1, null]) assert.throws(() => build({ ...ok, errorFocus: v }), /errorFocus debe ser/, String(v));
  assert.throws(() => build({ ...ok, errorFocus: true }), /errorFocus necesita errors/);
  assert.throws(() => build({ ...ok, errors: 'x' }), /errors debe ser una lista/);
  assert.throws(() => build({ ...ok, errorFocus: true, errors: {} }), /errors debe ser una lista/);
  for (const v of [5, 'x', null, true]) assert.throws(() => build({ ...ok, mastery: v }), /mastery debe ser/, String(v));
  assert.doesNotThrow(() => build({ ...ok, errorFocus: false }));
  assert.doesNotThrow(() => build({ ...ok, errorFocus: true, errors: [] }));
});

test('«producción» es la definición de 1.7: una sola fuente', () => {
  const prod = new Set([...SIGNAL_P.families, ...SIGNAL_P.extraTypes]);
  for (const f of FAMILIES) for (const t of typesOfFamily(f)) assert.equal(isProduction(t), SIGNAL_P.families.includes(f) || t === 'phrase_cloze', `${f}/${t}`);
  for (const t of PROD) assert.equal(isProduction(t), true, t);
  for (const t of REC) assert.equal(isProduction(t), false, t);
  assert.equal(isProduction('cloze_bank'), false);
  assert.equal(isProduction('dictation'), false);
  for (const v of [undefined, null, 5, 'no_existe', '']) assert.equal(isProduction(v), null);
  assert.equal(prod.has('phrase_cloze'), true);
});

test('productionShare por banda y bordes', () => {
  const at = (p) => productionShare(p);
  assert.equal(at(0), 0); assert.equal(at(1), 0); assert.equal(at(29), 0); assert.equal(at(29.9), 0);
  assert.equal(at(30), 1 / 3); assert.equal(at(59), 1 / 3);
  assert.equal(at(60), 1 / 2); assert.equal(at(84), 1 / 2);
  assert.equal(at(85), 2 / 3); assert.equal(at(100), 2 / 3);
  for (const bad of [NaN, -1, 101, '50', null, undefined, Infinity]) assert.equal(at(bad), 0, String(bad));
  assert.deepEqual(Object.keys(PROGRESSION.shareByBand), BANDS.map((b) => b.id));
  let prev = -1; // sube con el dominio y nunca llega a producción pura
  for (const b of BANDS) { const s = PROGRESSION.shareByBand[b.id]; assert.ok(s >= prev && s < 1); prev = s; }
});

test('masteryIndex: Map, objeto y lista de resultados; lo ilegible se ignora y se cuenta', () => {
  assert.deepEqual([...masteryIndex(new Map([['a', 10], ['b', { pct: 70 }]])).map], [['a', 10], ['b', 70]]);
  assert.deepEqual([...masteryIndex({ a: 10, b: { pct: 70 } }).map], [['a', 10], ['b', 70]]);
  assert.deepEqual([...masteryIndex([{ topicId: 'a', pct: 10, band: 'initial' }, { id: 'b', pct: 70 }]).map], [['a', 10], ['b', 70]]);
  const r = masteryIndex({ a: 10, b: NaN, c: -5, d: 101, e: '50', f: null, g: { pct: 'x' } });
  assert.deepEqual([...r.map], [['a', 10]]); assert.equal(r.ignored, 6);
  assert.equal(masteryIndex([1, null, { topicId: '', pct: 5 }]).ignored, 3);
  assert.equal(masteryIndex({ a: 0 }).map.get('a'), 0); // 0 es un valor válido
});

test('orderByProgression: reparto exacto, estable y sin perder ni repetir', () => {
  const list = (r, p) => [...Array.from({ length: r }, (_, i) => ({ id: `r${i}`, p: false })), ...Array.from({ length: p }, (_, i) => ({ id: `p${i}`, p: true }))];
  const cls = (x) => x.p;
  const pattern = (l, s) => orderByProgression(l, cls, s).map((x) => (x.p ? 'P' : 'R')).join('');
  assert.equal(pattern(list(6, 6), 0), 'RRRRRRPPPPPP');
  assert.equal(pattern(list(6, 6), 1 / 3), 'RRPRRPRRPPPP'); // el reconocimiento (6) se agota en el puesto 9 y la producción llena el resto
  assert.equal(pattern(list(9, 3), 1 / 3), 'RRPRRPRRPRRR');
  assert.equal(pattern(list(4, 2), 1 / 3), 'RRPRRP');
  assert.equal(pattern(list(3, 3), 1 / 2), 'RPRPRP');
  assert.equal(pattern(list(2, 4), 2 / 3), 'RPPRPP');
  assert.equal(pattern(list(0, 3), 0), 'PPP'); // sin reconocimiento la producción entra igual: nunca se queda sin servir
  assert.equal(pattern(list(3, 0), 2 / 3), 'RRR');
  assert.equal(pattern([], 1 / 2), '');
  const out = orderByProgression(list(4, 4), cls, 1 / 2);
  assert.deepEqual(out.filter((x) => !x.p).map((x) => x.id), ['r0', 'r1', 'r2', 'r3']); // el orden dentro de cada clase se conserva
  assert.deepEqual(out.filter((x) => x.p).map((x) => x.id), ['p0', 'p1', 'p2', 'p3']);
  const rng = createRng(11);
  for (let k = 0; k < 200; k += 1) { // propiedad: misma colección, cualquier reparto
    const l = list(Math.floor(rng.next() * 8), Math.floor(rng.next() * 8));
    const s = [0, 1 / 3, 1 / 2, 2 / 3][Math.floor(rng.next() * 4)];
    const o = orderByProgression(l, cls, s);
    assert.deepEqual([...o].map((x) => x.id).sort(), l.map((x) => x.id).sort());
    let p = 0;
    const nRec = l.filter((y) => !y.p).length;
    o.forEach((x, i) => { if (x.p) p += 1; if (nRec > o.slice(0, i + 1).filter((y) => !y.p).length) assert.ok(p <= Math.floor((i + 1) * s + 1e-9), `en ${i}: ${p} de producción con parte ${s}`); }); // mientras quede reconocimiento, nunca más producción que su parte
  }
});

test('progresión en build: tema flojo → reconocimiento primero; tema fuerte → más producción', () => {
  const low = [...mix('t.low', ['mcq_en_es', 'translate_word', 'match_pairs', 'fix_error', 'order_blocks', 'write_guided'])];
  const plan = run(low, { newCap: 3, mastery: { 't.low': 10 } });
  assert.equal(plan.count, 3);
  assert.deepEqual(plan.items.map((i) => i.production).sort(), [false, false, false]); // solo reconocimiento mientras haya
  assert.equal(plan.stats.progression.newProduction, 0); assert.equal(plan.stats.progression.newRecognition, 3);
  const high = run(low, { newCap: 6, mastery: { 't.low': 90 } });
  assert.equal(high.stats.progression.newProduction, 3); // 6 nuevas, 3 de producción disponibles: ya no hay reparto que mejorar…
  const big = [...mix('t.x', [...REC.slice(0, 4), ...REC.slice(0, 4), ...PROD.slice(0, 4), ...PROD.slice(0, 4)])];
  const by = (pct, cap) => run(big, { newCap: cap, size: 40, mastery: { 't.x': pct } }).stats.progression;
  assert.equal(by(0, 6).newProduction, 0);
  assert.equal(by(45, 6).newProduction, 2); // 1 de cada 3
  assert.equal(by(70, 6).newProduction, 3); // 1 de cada 2
  assert.equal(by(95, 6).newProduction, 4); // 2 de cada 3
  assert.equal(by(0, 12).newProduction, 4); // con 12 y solo 8 de reconocimiento, la producción llena el resto
  assert.equal(by(0, 12).newRecognition, 8);
});

test('progresión: solo ordena, nunca excluye ni deja a la producción sin servir', () => {
  const onlyProd = mix('t.p', PROD);
  const plan = run(onlyProd, { newCap: 5, mastery: { 't.p': 0 } });
  assert.equal(plan.count, 5);
  assert.equal(plan.stats.progression.newProduction, 5);
  assert.deepEqual(ids(run(onlyProd, { newCap: 5 })).sort(), ids(plan).sort());
});

test('progresión: tema sin dato cuenta como 0; sin `mastery` no hay progresión (T3 intacto)', () => {
  const l = mix('t.q', ['translate_word', 'fix_error', 'mcq_en_es', 'match_pairs']);
  const a = run(l, { newCap: 2, mastery: {} });
  const b = run(l, { newCap: 2, mastery: { 't.q': 0 } });
  assert.deepEqual(ids(a), ids(b));
  assert.equal(a.stats.progression.newProduction, 0);
  const none = run(l, { newCap: 2 });
  assert.equal(none.stats.progression.enabled, false);
  assert.equal(none.stats.progression.ignored, 0);
  assert.deepEqual([...ids(none)].sort(), l.map((x) => x.item.id).sort().slice(0, 2)); // sin progresión: los dos primeros por id de ítem, como en T2
});

test('progresión: Map, objeto y resultados de compute dan el mismo plan', () => {
  const l = [...mix('t.m', [...REC, ...PROD, ...REC, ...PROD])];
  const base = ids(run(l, { newCap: 6, mastery: { 't.m': 65 } }));
  assert.deepEqual(ids(run(l, { newCap: 6, mastery: new Map([['t.m', 65]]) })), base);
  assert.deepEqual(ids(run(l, { newCap: 6, mastery: [{ topicId: 't.m', pct: 65, band: 'solid', confidence: 'mid' }] })), base);
});

test('progresión por tema: cada tema usa su propio dominio', () => {
  const l = [...mix('t.weak', [...REC.slice(0, 3), ...PROD.slice(0, 3)]), ...mix('t.strong', [...REC.slice(0, 3), ...PROD.slice(0, 3)])];
  const plan = run(l, { newCap: 12, size: 20, mastery: { 't.weak': 5, 't.strong': 95 } });
  const prodOf = (t) => plan.items.filter((i) => i.topic === t && i.production).length;
  assert.equal(plan.items.filter((i) => i.topic === 't.weak').length, 6);
  assert.equal(prodOf('t.weak'), 3); // con cupo para todas entran todas; lo que se mide es que el tope no deje a nadie fuera
  const tight = run(l, { newCap: 4, size: 20, mastery: { 't.weak': 5, 't.strong': 95 } });
  const tp = (t) => tight.items.filter((i) => i.topic === t && i.production).length;
  assert.ok(tp('t.weak') <= tp('t.strong'));
});

test('topicFocus: solo el tema; vencidas → nuevas → práctica', () => {
  const due = [mk({ topics: ['t.f'], due: ago(2) }), mk({ topics: ['t.f'], due: ago(1) })];
  const other = [mk({ topics: ['t.g'], due: ago(9) }), ...mix('t.g', ['mcq_en_es'])];
  const fresh = mix('t.f', ['mcq_en_es', 'match_pairs']);
  const rest = [mk({ topics: ['t.f'], due: ahead(3), stability: 2, last_review: ago(5) }, 'translate_word'), mk({ topics: ['t.f'], due: ahead(9), stability: 30, last_review: ago(1) }, 'mcq_en_es')];
  const plan = run([...other, ...rest, ...fresh, ...due], { topicFocus: 't.f', size: 20 });
  assert.equal(plan.count, 6);
  assert.ok(plan.items.every((i) => i.topics.includes('t.f')));
  assert.equal(plan.stats.outOfFocus, 2);
  assert.deepEqual(['overdue', 'new', 'practice'].map((w) => plan.items.filter((i) => i.why === w).length), [2, 2, 2]);
  const practice = plan.items.filter((i) => i.why === 'practice');
  assert.deepEqual(practice.map((i) => i.itemId).sort(), rest.map((x) => x.item.id).sort());
  assert.equal(plan.stats.practice, 2);
  assert.equal(new Set(plan.items.map((i) => i.cardId)).size, plan.count);
});

test('topicFocus: la práctica va de la que menos se recuerda a la que más, y respeta el tamaño', () => {
  const l = [1, 2, 3, 4, 5].map((k) => mk({ topics: ['t.f'], due: ahead(k), stability: 4 * k, last_review: ago(3) }));
  const plan = run(l, { topicFocus: 't.f', size: 3 });
  assert.equal(plan.count, 3);
  const r = plan.items.map((i) => i.r);
  assert.deepEqual([...r].sort((a, b) => a - b), r); // retrievabilidad ascendente
  assert.ok(plan.items.every((i) => i.why === 'practice' && i.kind === 'review'));
});

test('topicFocus: el cupo de temas por área no aplica, el tope diario de nuevas sí', () => {
  const topics = ['t.1', 't.2', 't.3', 't.4'].map((id) => ({ id, area: 'gramatica', status: 'active' }));
  const started = ['t.1', 't.2', 't.3'].flatMap((t) => [mk({ topics: [t] }), ...mix(t, ['mcq_en_es'])]);
  const target = mix('t.4', ['mcq_en_es', 'match_pairs', 'order_blocks']);
  const normal = run([...started, ...target], { topics, size: 20 });
  assert.equal(normal.items.filter((i) => i.topic === 't.4').length, 0); // sin enfoque, el cuarto tema espera
  assert.ok(normal.stats.newSkipped.area >= 3);
  const focused = run([...started, ...target], { topics, topicFocus: 't.4' });
  assert.equal(focused.count, 3);
  const capped = run([...started, ...target], { topics, topicFocus: 't.4', newCap: 5, newToday: 4 });
  assert.equal(capped.count, 1);
});

test('topicFocus: intercalado solo por tipo y sin violaciones de tema', () => {
  const l = [...mix('t.f', ['mcq_en_es', 'mcq_en_es', 'mcq_en_es', 'mcq_en_es', 'match_pairs', 'match_pairs', 'order_blocks', 'order_blocks'])];
  const plan = run(l, { topicFocus: 't.f', size: 20, newCap: 20 });
  assert.equal(plan.count, 8);
  assert.equal(maxRun(plan.items.map((i) => i.exerciseType)), 2); // 4 mcq + 4 de otros tipos: existe un orden con 2
  assert.equal(plan.stats.interleave.violations.topic, 0);
  assert.equal(plan.stats.interleave.violations.type, 0);
  assert.ok(plan.items.every((i) => i.topic === 't.f')); // los ítems conservan su tema
  assert.equal(plan.stats.interleave.maxRun, 2);
});

test('topicFocus: planes vacíos con su razón', () => {
  const a = run([mk({ topics: ['t.g'] })], { topicFocus: 't.f' });
  assert.equal(a.count, 0); assert.equal(a.reason.code, 'topic_empty'); assert.equal(a.reason.message_es, EMPTY_REASONS.topic_empty);
  assert.equal(run([], { topicFocus: 't.f' }).reason.code, 'no_material');
  const dep = run([mk({ topics: ['t.f', 't.h'] })], { topicFocus: 't.f', topics: [{ id: 't.f', status: 'deprecated' }, { id: 't.h', status: 'active' }] });
  assert.equal(dep.reason.code, 'topic_empty');
  const sus = run([mk({ topics: ['t.f'], suspended: true })], { topicFocus: 't.f' });
  assert.equal(sus.reason.code, 'only_excluded');
  const capHit = run(mix('t.f', ['mcq_en_es']), { topicFocus: 't.f', newToday: 10 });
  assert.equal(capHit.reason.code, 'new_cap_reached');
  for (const p of [a, dep, sus, capHit]) assert.doesNotMatch(p.reason.message_es, /racha|culpa|fall(a|aste)|deber(í|i)as/i);
});

test('topicFocus: el rescate y el tope de repasos se calculan sobre el tema', () => {
  const many = Array.from({ length: 160 }, () => mk({ topics: ['t.f'], due: ago(5) }));
  const noise = Array.from({ length: 300 }, () => mk({ topics: ['t.g'], due: ago(5) }));
  const plan = run([...many, ...noise], { topicFocus: 't.f', size: 20 });
  assert.equal(plan.rescue.active, true); assert.equal(plan.rescue.overdueCount, 160);
  assert.ok(plan.items.every((i) => i.topic === 't.f' && i.why === 'rescue'));
  const few = run([...many.slice(0, 20), ...noise], { topicFocus: 't.f' });
  assert.equal(few.rescue.active, false);
});

test('topicFocus: con energía baja aplaza los ejercicios largos también en la práctica', () => {
  const l = [mk({ topics: ['t.f'], due: ahead(2) }, 'write_guided'), mk({ topics: ['t.f'], due: ahead(2) }, 'mcq_en_es')];
  const low = run(l, { topicFocus: 't.f', energy: 'low' });
  assert.deepEqual(low.items.map((i) => i.exerciseType), ['mcq_en_es']);
  assert.equal(run(l, { topicFocus: 't.f' }).count, 2);
});

test('errorTargets: puntúa por veces × impacto, por ítem o por tema', () => {
  const t = errorTargets([
    { code: 'A', itemId: 'i1', impact: 'high', count: 2, topics: ['t.a'] }, // 6
    { code: 'B', itemId: 'i1', impact: 'low', count: 1, topics: ['t.a'] }, // +1
    { code: 'C', impact: 'mid', count: 3, topics: ['t.a', 't.b', 't.a'] }, // 6 a cada tema (sin duplicar)
    { code: 'D', itemId: null, impact: 'raro', topics: ['t.b'] }, // impacto ilegible pesa 1; count ilegible = 1
    { code: '', itemId: 'x', impact: 'high' }, { impact: 'high' }, null, 'x', [], { code: 'E', topics: [] }, { code: 'F', itemId: '', topics: [] },
  ]);
  assert.deepEqual([...t.byItem], [['i1', 7]]);
  assert.deepEqual([...t.byTopic].sort(), [['t.a', 6], ['t.b', 7]]);
  assert.equal(t.used, 4); assert.equal(t.ignored, 7); // A, B, C y D valen; sin código, null, texto, lista, sin temas y sin ítem ni temas, no
  assert.throws(() => errorTargets(null), /lista/);
  assert.deepEqual([...errorTargets([]).byItem], []);
  assert.equal(errorTargets([{ code: 'A', itemId: 'i', impact: 'high', count: 1.5 }]).byItem.get('i'), 3);
  assert.equal(errorTargets([{ code: 'A', itemId: 'i', impact: 'high', count: 0 }]).byItem.get('i'), 3);
});

test('errorFocus: primero los ítems con error por puntuación, luego los de temas con error sin ítem', () => {
  const a = mk({ topics: ['t.a'], due: ahead(2) }, 'mcq_en_es'); const b = mk({ topics: ['t.a'], due: ago(3) }, 'translate_word'); const c = mk({ topics: ['t.b'], due: ahead(1) }, 'order_blocks');
  const d = mk({ topics: ['t.c'] }, 'match_pairs'); const e = mk({ topics: ['t.z'] }); // tipos distintos: el intercalado no mueve nada
  const errors = [
    { code: 'X', itemId: a.item.id, impact: 'low', count: 1, topics: ['t.a'] }, // 1
    { code: 'Y', itemId: b.item.id, impact: 'high', count: 2, topics: ['t.a'] }, // 6
    { code: 'Z', impact: 'mid', count: 1, topics: ['t.b'] }, // tema t.b: 2 → c
    { code: 'W', impact: 'high', count: 1, topics: ['t.c'] }, // tema t.c: 3 → d (mejor que c)
  ];
  const plan = run([a, b, c, d, e], { errorFocus: true, errors });
  assert.deepEqual(ids(plan), [b.item.id, a.item.id, d.item.id, c.item.id]); // e no tiene error
  assert.ok(plan.items.every((i) => i.why === 'error' && i.kind === 'review'));
  assert.deepEqual(plan.items.map((i) => i.errorScore), [6, 1, 3, 2]);
  assert.equal(plan.stats.errorFocus.used, 4);
  assert.equal(plan.stats.newSelected, 0);
});

test('errorFocus: sin nuevas, sin rescate, sin suspendidas/sanguijuelas/retiradas', () => {
  const ok = mk({ topics: ['t.a'] }); const sus = mk({ topics: ['t.a'], suspended: true }); const leech = mk({ topics: ['t.a'], leech: true });
  const dep = mk({ topics: ['t.a'] }); const fresh = mk({ topics: ['t.a'], state: 0, reps: 0 });
  const backlog = Array.from({ length: 200 }, () => mk({ topics: ['t.a'], due: ago(4) }));
  const errors = [ok, sus, leech, dep, fresh, ...backlog.slice(0, 3)].map((x) => ({ code: 'X', itemId: x.item.id, impact: 'mid', count: 1, topics: ['t.a'] }));
  const plan = run([ok, sus, leech, dep, fresh, ...backlog], { errorFocus: true, errors, deprecatedItemIds: [dep.item.id], size: 20 });
  assert.equal(plan.rescue.active, false); assert.equal(plan.rescue.message_es, null);
  const got = ids(plan);
  for (const x of [sus, leech, dep, fresh]) assert.ok(!got.includes(x.item.id), x.item.id);
  assert.ok(got.includes(ok.item.id));
  assert.equal(plan.stats.newSelected, 0);
  assert.equal(new Set(got).size, got.length);
});

test('errorFocus: los repasos de hoy no se descuentan y no hace falta que estén vencidos', () => {
  const x = mk({ topics: ['t.a'], due: ahead(10) });
  const plan = run([x], { errorFocus: true, errors: [{ code: 'X', itemId: x.item.id, impact: 'high', count: 1, topics: ['t.a'] }], reviewsToday: 999 });
  assert.equal(plan.count, 1);
});

test('errorFocus: planes vacíos con su razón', () => {
  const x = mk({ topics: ['t.a'] });
  assert.equal(run([x], { errorFocus: true, errors: [] }).reason.code, 'no_errors');
  assert.equal(run([x], { errorFocus: true, errors: [{ code: 'X', itemId: 'otro', impact: 'low', count: 1, topics: [] }] }).reason.code, 'errors_no_cards');
  assert.equal(run([], { errorFocus: true, errors: [] }).reason.code, 'no_material');
  const heavy = mk({ topics: ['t.a'] }, 'write_guided');
  const lowE = run([heavy], { errorFocus: true, energy: 'low', errors: [{ code: 'X', itemId: heavy.item.id, impact: 'low', count: 1, topics: [] }] });
  assert.equal(lowE.reason.code, 'energy_deferred');
  assert.equal(run([mk({ topics: ['t.a'], suspended: true })], { errorFocus: true, errors: [] }).reason.code, 'only_excluded');
  for (const k of ['no_errors', 'errors_no_cards', 'topic_empty']) assert.doesNotMatch(EMPTY_REASONS[k], /racha|culpa|fall(a|aste)|deber(í|i)as/i);
});

test('errorFocus + topicFocus: solo errores del tema', () => {
  const a = mk({ topics: ['t.a'] }); const b = mk({ topics: ['t.b'] });
  const errors = [a, b].map((x) => ({ code: 'X', itemId: x.item.id, impact: 'high', count: 1, topics: x.card.topics }));
  const plan = run([a, b], { errorFocus: true, topicFocus: 't.a', errors });
  assert.deepEqual(ids(plan), [a.item.id]);
});

test('errorFocus: respeta el intercalado y el tamaño', () => {
  const l = [...Array.from({ length: 5 }, () => mk({ topics: ['t.a'] }, 'mcq_en_es')), ...Array.from({ length: 5 }, () => mk({ topics: ['t.b'] }, 'translate_word'))];
  const errors = l.map((x) => ({ code: 'X', itemId: x.item.id, impact: 'mid', count: 1, topics: x.card.topics }));
  const plan = run(l, { errorFocus: true, errors, size: 8 });
  assert.equal(plan.count, 8);
  assert.ok(maxRun(plan.items.map((i) => i.topic)) <= 2);
  assert.ok(maxRun(plan.items.map((i) => i.exerciseType)) <= 2);
  assert.equal(plan.stats.interleave.violations.topic + plan.stats.interleave.violations.type, 0);
});

test('CA 6: determinismo con enfoques y progresión, y no depende del orden de entrada', () => {
  const l = [...mix('t.a', [...REC, ...PROD]), ...mix('t.b', [...REC, ...PROD]), ...Array.from({ length: 6 }, (_, k) => mk({ topics: [k % 2 ? 't.a' : 't.b'], due: ago(2) }, PROD[k % 5]))];
  const errors = l.slice(0, 6).map((x) => ({ code: 'X', itemId: x.item.id, impact: 'mid', count: 2, topics: x.card.topics }));
  const modes = [{}, { mastery: { 't.a': 20, 't.b': 80 } }, { topicFocus: 't.a', mastery: { 't.a': 50 } }, { errorFocus: true, errors }, { errorFocus: true, errors, topicFocus: 't.b' }, { energy: 'low', topicFocus: 't.b' }];
  for (const m of modes) {
    const a = run(l, { ...m, newCap: 8 });
    const b = run(l, { ...m, newCap: 8 });
    assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
    const rev = build({ now: NOW, cards: [...set(l).cards].reverse(), items: [...set(l).items].reverse(), rng: createRng(7), ...m, newCap: 8 });
    assert.deepEqual(ids(rev), ids(a), JSON.stringify(Object.keys(m)));
  }
});

test('propiedades: 300 escenarios al azar en los tres modos', () => {
  const rng = createRng(2026);
  const pick = (arr) => arr[Math.floor(rng.next() * arr.length)];
  for (let k = 0; k < 300; k += 1) {
    const topics = ['t.a', 't.b', 't.c'].slice(0, 1 + Math.floor(rng.next() * 3));
    const list = Array.from({ length: Math.floor(rng.next() * 25) }, () => {
      const type = pick([...REC, ...PROD, 'write_guided']);
      const fresh = rng.next() < 0.3;
      return mk({ topics: [pick(topics)], state: fresh ? 0 : 2, reps: fresh ? 0 : 3, due: fresh ? ago(0) : rng.next() < 0.6 ? ago(1 + Math.floor(rng.next() * 8)) : ahead(1 + Math.floor(rng.next() * 8)), suspended: rng.next() < 0.1, stability: 1 + Math.floor(rng.next() * 20) }, type);
    });
    const errors = list.filter(() => rng.next() < 0.3).map((x) => ({ code: 'X', itemId: x.item.id, impact: pick(['low', 'mid', 'high']), count: 1 + Math.floor(rng.next() * 3), topics: x.card.topics }));
    const opts = { size: 1 + Math.floor(rng.next() * 25), newCap: Math.floor(rng.next() * 12), energy: pick(['low', 'mid', 'high']) };
    const mode = pick(['plain', 'plain+mastery', 'topic', 'topic+mastery', 'errors', 'errors+topic']);
    if (mode.includes('mastery')) opts.mastery = { 't.a': Math.floor(rng.next() * 101), 't.b': Math.floor(rng.next() * 101) };
    if (mode.startsWith('topic') || mode.endsWith('topic')) opts.topicFocus = pick(topics);
    if (mode.startsWith('errors')) { opts.errorFocus = true; opts.errors = errors; }
    const plan = run(list, opts);
    const label = `${k} ${mode}`;
    const byCard = new Map(list.map((x) => [x.card.id, x.card]));
    assert.ok(plan.count <= plan.requested, label);
    assert.equal(plan.count, plan.items.length, label);
    assert.equal(new Set(plan.items.map((i) => i.cardId)).size, plan.items.length, `${label} duplicados`);
    for (const i of plan.items) { const c = byCard.get(i.cardId); assert.ok(c, label); assert.equal(c.suspended, false, `${label} suspendida`); if (opts.topicFocus) assert.ok(c.topics.includes(opts.topicFocus), `${label} fuera de tema`); }
    if (opts.errorFocus) assert.ok(plan.items.every((i) => i.why === 'error' && byCard.get(i.cardId).state !== 0), `${label} detective`);
    if (!opts.errorFocus) assert.ok(plan.items.filter((i) => i.kind === 'new').length <= Math.floor((opts.newCap) * (opts.energy === 'low' ? 0.5 : 1)), `${label} cupo`);
    if (opts.energy === 'low') assert.ok(plan.items.every((i) => i.exerciseType !== 'write_guided'), `${label} energía`);
    assert.equal(maxRun(plan.items.map((i) => i.exerciseType)) <= 2 || plan.stats.interleave.violations.type > 0, true, `${label} tipo`);
    if (!opts.topicFocus) assert.equal(maxRun(plan.items.map((i) => i.topic)) <= 2 || plan.stats.interleave.violations.topic > 0, true, `${label} tema`);
    if (plan.count === 0) assert.ok(plan.reason && plan.reason.message_es, label); else assert.equal(plan.reason, null, label);
    const again = run(list, opts);
    assert.deepEqual(ids(again), ids(plan), `${label} determinismo`);
  }
});

test('orderByProgression: en listas largas el reparto es exacto en cada prefijo (sin error de coma flotante)', () => {
  const l = [...Array.from({ length: 90 }, (_, i) => ({ id: `r${i}`, p: false })), ...Array.from({ length: 90 }, (_, i) => ({ id: `p${i}`, p: true }))];
  for (const [num, den] of [[1, 3], [1, 2], [2, 3]]) {
    const out = orderByProgression(l, (x) => x.p, num / den);
    let p = 0;
    out.slice(0, 120).forEach((x, i) => { if (x.p) p += 1; assert.equal(p, Math.floor(((i + 1) * num) / den), `${num}/${den} en ${i}`); }); // aritmética entera como oráculo
  }
});

test('topicFocus: nuevas de un tema cuyo primer tema es de un área llena (tarjetas con varios temas)', () => {
  const topics = ['t.1', 't.2', 't.3', 't.4'].map((id) => ({ id, area: 'gramatica', status: 'active' }));
  const started = ['t.1', 't.2', 't.3'].flatMap((t) => [mk({ topics: [t, 't.f'], due: ahead(2) }), mk({ topics: [t, 't.f'], state: 0, reps: 0, due: ago(0) })]); // 3 temas «en curso»
  const fresh = mk({ topics: ['t.4', 't.f'], state: 0, reps: 0, due: ago(0) });
  const plan = run([...started, fresh], { topics, topicFocus: 't.f' });
  assert.ok(ids(plan).includes(fresh.item.id)); // el tema lo eligió la persona: el cupo de temas por área no lo frena
  assert.equal(plan.stats.newSkipped.area, 0);
  const normal = run([...started, fresh], { topics });
  assert.ok(!ids(normal).includes(fresh.item.id)); // sin enfoque sí lo frena
});

test('topicFocus: con rescate activo no se rellena con práctica', () => {
  const many = Array.from({ length: 160 }, () => mk({ topics: ['t.f'], due: ago(5) }));
  const calm = Array.from({ length: 5 }, () => mk({ topics: ['t.f'], due: ahead(4) }));
  const plan = run([...many, ...calm], { topicFocus: 't.f', size: 20, reviewsToday: 75 }); // cupo de rescate 50 − 75 → 0
  assert.equal(plan.rescue.active, true);
  assert.equal(plan.stats.practice, 0);
  assert.ok(plan.items.every((i) => i.why !== 'practice'));
  const part = run([...many, ...calm], { topicFocus: 't.f', size: 20, reviewsToday: 45 }); // quedan 5 del cupo
  assert.equal(part.count, 5);
  assert.ok(part.items.every((i) => i.why === 'rescue'));
});

test('topicFocus: la práctica también mezcla reconocimiento y producción según el dominio', () => {
  const l = [...Array.from({ length: 6 }, (_, k) => mk({ topics: ['t.f'], due: ahead(2 + k), stability: 3 + k, last_review: ago(2) }, REC[k % 5])), ...Array.from({ length: 6 }, (_, k) => mk({ topics: ['t.f'], due: ahead(2 + k), stability: 3 + k, last_review: ago(2) }, PROD[k % 5]))];
  const prodIn = (pct) => run(l, { topicFocus: 't.f', size: 6, mastery: { 't.f': pct } }).items.filter((i) => i.production).length;
  assert.equal(prodIn(0), 0);
  assert.equal(prodIn(95), 4);
  assert.equal(prodIn(65), 3);
});

test('stats.progression cuenta las entradas de dominio ilegibles', () => {
  const plan = run(mix('t.a', ['mcq_en_es']), { mastery: { 't.a': 40, 't.b': NaN, 't.c': 'x' } });
  assert.equal(plan.stats.progression.enabled, true);
  assert.equal(plan.stats.progression.ignored, 2);
});

test('orderByProgression: una parte editable como 0,29 también cuadra (0,29 × 100 en coma flotante es 28,999…)', () => {
  assert.ok(0.29 * 100 < 29); // el caso que justifica el redondeo defensivo
  const l = [...Array.from({ length: 120 }, (_, i) => ({ id: `r${i}`, p: false })), ...Array.from({ length: 120 }, (_, i) => ({ id: `p${i}`, p: true }))];
  const out = orderByProgression(l, (x) => x.p, 0.29);
  assert.equal(out.slice(0, 100).filter((x) => x.p).length, 29);
});
