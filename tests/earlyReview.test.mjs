// @purpose: Pruebas de los repasos adelantados (core/earlyReview.js, 2.1-T2): detección del adelanto, aciertos que no alargan de más, fallos que reinician y la ruta completa gradeAnswer → commit.
// 2.1-T2. Motores FSRS y simple reales, calificación, base en memoria y eventos reales.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { earlyInfo, withEarlyReview, DAY_MS } from '../core/earlyReview.js';
import { createSrs } from '../core/srsEngine.js';
import { gradeAnswer } from '../core/gradeAnswer.js';
import { createAnswerCommit } from '../core/answerCommit.js';
import { createEvents } from '../core/events.js';
import { createMemoryDb } from '../core/db.memory.js';
import { countToday } from '../core/dailyUsage.js';
import { createRng } from '../core/rng.js';
import { makeClock } from './_helpers.mjs';

const H = 3600000;
const T0 = new Date('2026-01-01T10:00:00.000Z');
const engineSrs = (engine) => createSrs({ settings: { get: (k) => (k === 'srsEngine' ? engine : undefined) } });
const days = (card, at) => (Date.parse(card.due) - at.getTime()) / DAY_MS;
function mature(srs, goods = 3) {
  let c = srs.newCard('it', 0, T0, ['t']); let now = T0;
  for (let i = 0; i < goods; i++) { c = srs.review(c, 3, now); now = new Date(c.due); }
  return c; // tarjeta madura: último repaso en c.last_review, vence en c.due
}
const at = (card, hours) => new Date(Date.parse(card.last_review) + hours * H);

test('earlyInfo: adelantada solo si ya tiene historia y su due es posterior a ahora', () => {
  const srs = createSrs(); const c = mature(srs);
  const mid = at(c, 5);
  const info = earlyInfo(c, mid);
  assert.equal(info.early, true);
  assert.equal(info.daysEarly, Math.round(((Date.parse(c.due) - mid.getTime()) / DAY_MS) * 100) / 100);
  assert.deepEqual(earlyInfo(c, new Date(c.due)), { early: false, daysEarly: 0 });
  assert.deepEqual(earlyInfo(c, new Date(Date.parse(c.due) + 1)), { early: false, daysEarly: 0 });
  assert.deepEqual(earlyInfo(c, new Date(Date.parse(c.due) - 1)).early, true);
  const fresh = srs.newCard('x', 0, T0, ['t']);
  assert.deepEqual(earlyInfo({ ...fresh, due: '2030-01-01T00:00:00.000Z' }, T0), { early: false, daysEarly: 0 });
});

test('earlyInfo no lanza con datos raros', () => {
  for (const bad of [null, undefined, {}, { state: 2 }, { state: 2, due: 'x', last_review: 'y' }, { state: 2, due: '2030-01-01T00:00:00.000Z' }, 5, 'x']) {
    assert.deepEqual(earlyInfo(bad, T0), { early: false, daysEarly: 0 });
  }
  const c = mature(createSrs());
  assert.deepEqual(earlyInfo(c, 'no es fecha'), { early: false, daysEarly: 0 });
  assert.deepEqual(earlyInfo(c, NaN), { early: false, daysEarly: 0 });
});

test('un acierto adelantado nunca alarga más que a tiempo y, desde 24 h, crece con el tiempo transcurrido (FSRS)', () => {
  const srs = withEarlyReview(createSrs()); const c = mature(srs);
  const onTime = new Date(c.due);
  for (const rating of [2, 3, 4]) {
    const ref = days(srs.review(c, rating, onTime), onTime);
    let prev = 0;
    for (const h of [1, 6, 23, 24, 48, 24 * 7, 24 * 30, (Date.parse(c.due) - Date.parse(c.last_review)) / H * 0.9]) {
      const t = at(c, h);
      const d = days(srs.review(c, rating, t), t);
      assert.ok(d <= ref + 1e-9, `rating ${rating} a ${h} h: ${d} > ${ref}`);
      if (h >= 24) { assert.ok(d >= prev - 1e-9, `rating ${rating} a ${h} h: no crece (${d} < ${prev})`); prev = d; } // en menos de 24 h FSRS usa otra fórmula (easy a 1 h da más que a 23 h)
    }
  }
});

test('un acierto adelantado tampoco acorta por debajo de lo que faltaba (la tarjeta no se castiga por acertar)', () => {
  const srs = withEarlyReview(createSrs()); const c = mature(srs);
  for (const h of [1, 24, 24 * 10, 24 * 40]) {
    const t = at(c, h);
    assert.ok(Date.parse(srs.review(c, 3, t).due) >= Date.parse(c.due) - 1, `a ${h} h acortó el plazo`);
  }
});

test('un fallo adelantado reinicia a un intervalo corto a cualquier hora, también en menos de 24 h', () => {
  const srs = withEarlyReview(createSrs()); const c = mature(srs);
  const normal = days(c, new Date(c.last_review));
  assert.ok(normal > 30);
  for (const h of [0.01, 1, 6, 12, 23, 23.99, 24, 25, 48, 24 * 7, 24 * 30]) {
    const t = at(c, h);
    const n = srs.review(c, 1, t);
    assert.equal(n.lapses, c.lapses + 1, `h ${h}`);
    assert.ok(days(n, t) <= 5, `a ${h} h el fallo dejó ${days(n, t)} días`);
    assert.ok(days(n, t) >= 1, `a ${h} h el fallo dejó ${days(n, t)} días`);
    assert.equal(n.last_review, t.toISOString(), `h ${h}`);
    assert.equal(n.reps, c.reps + 1);
  }
});

test('fallo en menos de 24 h = mismo resultado que el fallo a 24 h, contado desde ahora (estabilidad y plazo)', () => {
  const srs = withEarlyReview(createSrs()); const c = mature(srs);
  const ref = srs.review(c, 1, at(c, 24));
  const early = srs.review(c, 1, at(c, 2));
  assert.equal(early.stability, ref.stability); assert.equal(early.difficulty, ref.difficulty);
  assert.equal(days(early, at(c, 2)), days(ref, at(c, 24)));
});

test('sin la protección, un fallo en menos de 24 h solo encogía la tarjeta (el motivo de la capa)', () => {
  const raw = createSrs(); const c = mature(raw); const t = at(c, 2);
  assert.ok(days(raw.review(c, 1, t), t) > 10);
  assert.ok(days(withEarlyReview(raw).review(c, 1, t), t) <= 5);
});

test('lo que no es un fallo adelantado en menos de 24 h delega tal cual', () => {
  const raw = createSrs(); const srs = withEarlyReview(raw); const c = mature(raw);
  for (const [rating, h] of [[3, 2], [2, 2], [4, 2], [1, 30], [1, 24 * 40], [1, (Date.parse(c.due) - Date.parse(c.last_review)) / H], [1, (Date.parse(c.due) - Date.parse(c.last_review)) / H + 5]]) {
    assert.deepEqual(srs.review(c, rating, at(c, h)), raw.review(c, rating, at(c, h)), `${rating} a ${h} h`);
  }
  const fresh = raw.newCard('n', 0, T0, ['t']);
  assert.deepEqual(srs.review(fresh, 1, T0), raw.review(fresh, 1, T0));
  assert.deepEqual(srs.review(c, 1, new Date(Date.parse(c.last_review) - H)), raw.review(c, 1, new Date(Date.parse(c.last_review) - H)));
});

test('los ratings se leen igual que en el motor: nombre, número y texto', () => {
  const srs = withEarlyReview(createSrs()); const c = mature(srs); const t = at(c, 3);
  const a = srs.review(c, 1, t);
  assert.deepEqual(srs.review(c, 'again', t), a);
  assert.throws(() => srs.review(c, 9, t));
});

test('motor simple (Leitner): no se toca; acierto adelantado no alarga más y fallo reinicia', () => {
  const raw = engineSrs('simple'); const srs = withEarlyReview(raw); const c = mature(raw, 4);
  assert.equal(srs.engine(), 'simple');
  for (const h of [1, 12, 30, 24 * 20]) {
    const t = at(c, h);
    for (const rating of [1, 2, 3, 4]) assert.deepEqual(srs.review(c, rating, t), raw.review(c, rating, t));
    assert.ok(days(srs.review(c, 3, t), t) <= days(srs.review(c, 3, new Date(c.due)), new Date(c.due)) + 1e-9);
    assert.ok(days(srs.review(c, 1, t), t) <= 1 + 1e-9);
  }
});

test('previewIntervals muestra lo mismo que se guardará al fallar y no toca el resto', () => {
  const raw = createSrs(); const srs = withEarlyReview(raw); const c = mature(raw); const t = at(c, 2);
  const p = srs.previewIntervals(c, t); const r = raw.previewIntervals(c, t);
  assert.equal(p.again.due, srs.review(c, 1, t).due);
  assert.equal(p.again.label, 'Repaso en 3 d');
  assert.deepEqual([p.hard, p.good, p.easy], [r.hard, r.good, r.easy]);
  const later = at(c, 30);
  assert.deepEqual(srs.previewIntervals(c, later), raw.previewIntervals(c, later));
});

test('previewIntervals sobre una tarjeta suspendida no lanza y se comporta como el motor', () => {
  const raw = createSrs(); const srs = withEarlyReview(raw); const c = { ...mature(raw), suspended: true }; const t = at(c, 2);
  assert.deepEqual(srs.previewIntervals(c, t).again.due, srs.review({ ...c, suspended: false }, 1, t).due);
});

test('withEarlyReview conserva el resto de métodos, queda congelado y exige srs.review', () => {
  const raw = createSrs(); const srs = withEarlyReview(raw);
  for (const k of Object.keys(raw)) assert.equal(typeof srs[k], 'function', k);
  assert.ok(Object.isFrozen(srs));
  assert.equal(srs.engine(), 'fsrs');
  const c = mature(raw);
  assert.equal(srs.retrievability(c, at(c, 5)), raw.retrievability(c, at(c, 5)));
  assert.throws(() => withEarlyReview(null), /srs\.review/);
  assert.throws(() => withEarlyReview({}), /srs\.review/);
  const min = withEarlyReview({ review: raw.review });
  assert.equal(min.previewIntervals, undefined);
});

test('no muta la tarjeta recibida', () => {
  const srs = withEarlyReview(createSrs()); const c = mature(srs); const copy = JSON.parse(JSON.stringify(c));
  srs.review(c, 1, at(c, 2)); srs.previewIntervals(c, at(c, 2));
  assert.deepEqual(c, copy);
});

// ---------- ruta completa: calificar y guardar un repaso adelantado ----------
async function pipeline() {
  const clock = makeClock('2026-10-26T15:00:00.000Z');
  const db = createMemoryDb(); await db.open();
  const events = createEvents({ db, clock, rng: createRng(5) });
  const { commit } = createAnswerCommit({ db, events });
  const srs = withEarlyReview(createSrs());
  // tarjeta madura repasada ayer a las 15:00 y que vence dentro de semanas
  let c = srs.newCard('g.0001', 0, new Date('2026-08-01T15:00:00.000Z'), ['t']); let now = new Date('2026-08-01T15:00:00.000Z');
  for (let i = 0; i < 3; i++) { c = srs.review(c, 3, now); now = new Date(c.due); }
  c = { ...c, last_review: '2026-10-26T09:00:00.000Z', due: '2026-12-20T09:00:00.000Z' };
  await db.put('cards', c);
  return { clock, db, events, commit, srs, card: c };
}
const gradeEarly = (w, answer, over = {}) => gradeAnswer({ answer, card: w.card, srs: w.srs, now: w.clock.now(), exerciseType: 'fix_error', baselineMs: 6000, sessionId: 's1', mode: 'mech', channel: 'keyboard', ...over });

test('ruta completa: un fallo adelantado reinicia y se guarda con su evento en una transacción', async () => {
  const w = await pipeline();
  const g = gradeEarly(w, { result: 'wrong', ms: 4000 });
  assert.equal(g.scheduled, true);
  const out = await w.commit({ grade: g });
  assert.equal(out.cardSaved, true);
  const saved = await w.db.get('cards', w.card.id);
  const left = days(saved, w.clock.now());
  assert.ok(left >= 1 && left <= 5, `quedó a ${left} días`);
  assert.equal(saved.lapses, w.card.lapses + 1);
  assert.equal((await w.db.query('events', {})).length, 1);
});

test('ruta completa: un acierto adelantado guarda la tarjeta y no la deja más lejos que el acierto a tiempo', async () => {
  const w = await pipeline();
  const g = gradeEarly(w, { result: 'correct', ms: 3000 });
  await w.commit({ grade: g });
  const saved = await w.db.get('cards', w.card.id);
  const onTime = w.srs.review(w.card, g.rating, new Date(w.card.due));
  assert.ok(days(saved, w.clock.now()) <= days(onTime, new Date(w.card.due)) + 1e-9);
  assert.equal(saved.reps, w.card.reps + 1);
  assert.equal(saved.suspended, false);
});

test('ruta completa: un repaso adelantado es práctica extra (no gasta el cupo de repasos) y tampoco es tarjeta nueva', async () => {
  const w = await pipeline();
  // la primera respuesta de la historia debe ser anterior a hoy para que la tarjeta sea conocida
  await w.events.log({ type: 'answer', itemId: 'g.0001', cardId: 'g.0001#0', topics: ['t'], exerciseType: 'fix_error', result: 'correct', rating: 3, ms: 3000, mode: 'mech', channel: 'keyboard', ts: '2026-09-01T10:00:00.000Z' });
  const g = gradeEarly(w, { result: 'correct', ms: 3000 });
  assert.equal(g.event.early, true, 'gradeAnswer marca la respuesta como adelantada');
  const out = await w.commit({ grade: g });
  assert.equal(out.event.early, true, 'y el evento guardado conserva la marca');
  const u = await countToday({ events: w.events, now: w.clock.now() });
  assert.deepEqual([u.newToday, u.reviewsToday, u.practiceToday], [0, 0, 1]);
  assert.equal((await w.events.byCard(w.card.id)).filter((e) => e.type === 'answer').length, 2, 'sigue siendo actividad del día: el evento existe para estadísticas y dominio');
});

test('ruta completa: un repaso a tiempo no lleva la marca y sí gasta el cupo de repasos', async () => {
  const w = await pipeline();
  await w.events.log({ type: 'answer', itemId: 'g.0001', cardId: 'g.0001#0', topics: ['t'], exerciseType: 'fix_error', result: 'correct', rating: 3, ms: 3000, mode: 'mech', channel: 'keyboard', ts: '2026-09-01T10:00:00.000Z' });
  const g = gradeAnswer({ answer: { result: 'correct', ms: 3000 }, card: w.card, srs: w.srs, exerciseType: 'fix_error', topics: ['t'], now: new Date(w.card.due), mode: 'mech', channel: 'keyboard' });
  assert.equal('early' in g.event, false, 'a tiempo: el evento no trae el campo');
  await w.commit({ grade: g });
  const u = await countToday({ events: w.events, now: new Date(w.card.due) });
  assert.deepEqual([u.newToday, u.reviewsToday, u.practiceToday], [0, 1, 0]);
});

test('ruta completa: una tarjeta suspendida adelantada guarda el evento y no se reprograma', async () => {
  const w = await pipeline();
  w.card = { ...w.card, suspended: true }; await w.db.put('cards', w.card);
  const g = gradeEarly(w, { result: 'wrong', ms: 4000 });
  assert.equal(g.scheduled, false);
  const out = await w.commit({ grade: g });
  assert.equal(out.cardSaved, false);
  assert.deepEqual(await w.db.get('cards', w.card.id), w.card);
  assert.equal((await w.db.query('events', {})).length, 1);
});

test('una tarjeta con state 0 nunca es adelantada ni se protege, aunque traiga fechas', () => {
  const raw = createSrs(); const srs = withEarlyReview(raw); const c = mature(raw);
  const weird = { ...c, state: 0 };
  const t = at(c, 2);
  assert.deepEqual(earlyInfo(weird, t), { early: false, daysEarly: 0 });
  const outcome = (f) => { try { return { ok: f() }; } catch (e) { return { err: e.message }; } };
  assert.deepEqual(outcome(() => srs.review(weird, 1, t)), outcome(() => raw.review(weird, 1, t)));
});

test('una tarjeta ya vencida (due antes de ahora) no se protege aunque hayan pasado menos de 24 h', () => {
  const raw = createSrs(); const srs = withEarlyReview(raw); const c = mature(raw);
  const odd = { ...c, due: new Date(Date.parse(c.last_review) + H).toISOString() }; // vence 1 h después del último repaso
  const t = at(c, 3);
  assert.equal(earlyInfo(odd, t).early, false);
  assert.deepEqual(srs.review(odd, 1, t), raw.review(odd, 1, t));
});

test('un rating inválido da el mismo error que el motor (no se traga ni se cambia)', () => {
  const raw = createSrs(); const srs = withEarlyReview(raw); const c = mature(raw); const t = at(c, 2);
  let msg; try { raw.review(c, 9, t); } catch (e) { msg = e.message; }
  assert.ok(msg);
  assert.throws(() => srs.review(c, 9, t), (e) => e.message === msg);
});

test('los argumentos extra llegan al motor, tanto en la ruta protegida como en la normal', () => {
  const seen = [];
  const fake = { engine: () => 'fsrs', review: (card, rating, now, ...rest) => { seen.push([rating, new Date(now).toISOString(), ...rest]); return { ...card, due: new Date(Date.parse(card.due) + DAY_MS).toISOString() }; } };
  const srs = withEarlyReview(fake);
  const card = { state: 2, due: '2026-03-01T00:00:00.000Z', last_review: '2026-02-01T00:00:00.000Z' };
  srs.review(card, 1, new Date('2026-02-01T05:00:00.000Z'), { opcion: 1 });   // protegida
  srs.review(card, 3, new Date('2026-02-01T05:00:00.000Z'), { opcion: 2 });   // normal
  assert.deepEqual(seen[0], [1, '2026-02-02T00:00:00.000Z', { opcion: 1 }]);
  assert.deepEqual(seen[1], [3, '2026-02-01T05:00:00.000Z', { opcion: 2 }]);
});
