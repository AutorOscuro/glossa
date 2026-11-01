// @purpose: Pruebas del puente de calificación (core/gradeAnswer.js): gradeAnswer y gradeManual.
// Pruebas del puente de calificación (subparte 1.5, cuarto 3, mitad B): core/gradeAnswer.js (gradeAnswer y gradeManual).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradeAnswer, gradeManual } from '../core/gradeAnswer.js';
import { createSrs } from '../core/srsEngine.js';
import { newCard, review as fsrsReview } from '../core/srs.js';
import { createSettings } from '../core/settings.js';
import { createAnswerTimer } from '../core/answerTimer.js';
import { loadBaselines } from '../core/gradingBaseline.js';
import { defaultBaselineMs } from '../core/grading.js';
import { createEvents } from '../core/events.js';
import { validateEvent, EventError, LIMITS } from '../core/eventSchema.js';
import { createMemoryDb } from '../core/db.memory.js';
import { makeClock, makeRng } from './_helpers.mjs';

const NOW = new Date('2026-10-20T15:00:00.000Z');
const D = 86400000;
const srs = createSrs();
const TYPE = 'fix_error';
const base = defaultBaselineMs(TYPE);
const fresh = () => newCard('g.pp.0001', 0, NOW, ['gram.present_perfect.for_since']);
// Una tarjeta en repaso (ya estudiada), para que los 4 ratings den fechas distintas.
const mature = () => { let c = fresh(); c = srs.review(c, 3, NOW); return srs.review(c, 3, new Date(NOW.getTime() + 3 * D)); };
const LATER = new Date(NOW.getTime() + 10 * D);
const grade = (answer, over = {}) => gradeAnswer({ answer, card: fresh(), srs, now: NOW, exerciseType: TYPE, baselineMs: base, ...over });
const throwsEs = (fn, re) => assert.throws(fn, (e) => e instanceof Error && re.test(e.message));
const deepFreeze = (o) => { Object.values(o).forEach((v) => { if (v && typeof v === 'object') deepFreeze(v); }); return Object.freeze(o); };

// ---------- tabla de decisión de punta a punta ----------
test('gradeAnswer: acierto + tiempo → rating, y el evento y la tarjeta salen coherentes', () => {
  // [respuesta, rating, motivo, cómo se leyó el tiempo (null = Again: no lee el tiempo)]
  const table = [
    [{ result: 'wrong', ms: 1000 }, 1, 'again_wrong', null],
    [{ result: 'skipped' }, 1, 'again_skipped', null],
    [{ result: 'dont_know' }, 1, 'again_dont_know', null],
    [{ result: 'correct', ms: base }, 3, 'good_normal', 'normal'],
    [{ result: 'correct', ms: base * 0.5 }, 4, 'easy_fast', 'fast'],
    [{ result: 'correct', ms: base * 2 }, 2, 'hard_slow', 'slow'],
    [{ result: 'correct', ms: base * 0.5, hint: true }, 2, 'hard_hint', 'fast'],
    [{ result: 'almost', ms: base * 0.5 }, 2, 'hard_almost', 'fast'],
    [{ result: 'correct', ms: base * 6 }, 3, 'good_time_ignored', 'ignored'],
    [{ result: 'correct', ms: base * 0.5, interrupted: true }, 3, 'good_time_ignored', 'ignored'],
  ];
  for (const [answer, rating, reason, cls] of table) {
    const r = grade(answer);
    assert.equal(r.rating, rating, JSON.stringify(answer)); assert.equal(r.reason, reason);
    assert.equal(r.event.rating, rating); assert.equal(r.scheduled, true);
    assert.equal(r.card.reps, 1, 'la tarjeta se reprogramó'); assert.equal(r.card.last_review, NOW.toISOString());
    assert.match(r.dueLabel, /^Repaso (ahora|en )/);
    assert.equal(r.time && r.time.cls, cls, `time de ${reason}`);
  }
});

test('CA 2 de punta a punta: pestaña oculta (cronómetro) o tiempo extremo NO bajan el rating', () => {
  const clock = makeClock(); let hidden = false; const subs = new Set();
  const vis = { hidden: () => hidden, onChange: (f) => { subs.add(f); return () => subs.delete(f); } };
  const timer = createAnswerTimer({ clock, visibility: vis });
  timer.start(); clock.advance(500); hidden = true; subs.forEach((f) => f()); clock.advance(10 * 60000); hidden = false; subs.forEach((f) => f()); clock.advance(500);
  const t = timer.stop();
  assert.deepEqual(t, { ms: 1000, hiddenMs: 600000, interrupted: true });
  const r = grade({ result: 'correct', ms: t.ms, interrupted: t.interrupted });
  assert.equal(r.rating, 3, 'rápido pero interrumpido: Good, ni Easy ni Hard'); assert.equal(r.event.ms, 1000, 'se guarda el tiempo visible');
  assert.equal(grade({ result: 'correct', ms: base * 50 }).rating, 3, '50 × la mediana: se ignora, no es Hard');
});

test('CA 4: «no sé» = Again SIEMPRE, aunque venga con pista, rápido, o con result «correct»', () => {
  for (const a of [{ result: 'dont_know' }, { result: 'dont_know', hint: true, ms: 100 }, { result: 'correct', dontKnow: true, ms: 100 }, { result: 'almost', dontKnow: true }, { result: 'wrong', dontKnow: true }]) {
    const r = grade(a);
    assert.equal(r.rating, 1, JSON.stringify(a)); assert.equal(r.event.result, 'dont_know'); assert.equal(r.event.dontKnow, true);
    assert.equal(validateEvent(r.event).ok, true);
  }
  assert.equal(grade({ result: 'dont_know', dontKnow: false }).event.dontKnow, true, 'result gana sobre un dontKnow:false');
});

test('CA 3 de punta a punta: con menos de 8 datos se usa la constante; con 8, la mediana personal cambia el rating', async () => {
  const clock = makeClock(); const db = createMemoryDb(); await db.open();
  const events = createEvents({ db, clock, rng: makeRng(5) });
  const answer = { result: 'correct', ms: base };
  const none = await loadBaselines({ events, now: clock.now() });
  assert.equal(gradeAnswer({ answer, card: fresh(), srs, now: NOW, exerciseType: TYPE, baselines: none }).rating, 3, 'ms = la constante: normal');
  // 8 aciertos muy rápidos (1 s): la mediana pasa a ser personal.
  for (let i = 0; i < 8; i += 1) { await events.log({ type: 'answer', itemId: 'x.1', topics: ['t.a'], exerciseType: TYPE, result: 'correct', ms: 1000, mode: 'mech', channel: 'keyboard' }); clock.advance(60000); }
  const personal = await loadBaselines({ events, now: clock.now() });
  assert.equal(personal.forType(TYPE).source, 'personal');
  // 3 s sobre una mediana de 1 s: entre 1,8 × y 5 × → lento (Hard). Con la constante, 3 s no era lento.
  const r = gradeAnswer({ answer: { result: 'correct', ms: 3000 }, card: fresh(), srs, now: NOW, exerciseType: TYPE, baselines: personal });
  assert.equal(r.rating, 2); assert.equal(r.reason, 'hard_slow');
  assert.notEqual(gradeAnswer({ answer: { result: 'correct', ms: 3000 }, card: fresh(), srs, now: NOW, exerciseType: TYPE, baselines: none }).reason, 'hard_slow');
});

test('baselineMs manda sobre baselines; sin ninguno se usa la constante por tipo; un baselines que falla o no sabe → constante', () => {
  const ans = { result: 'correct', ms: 3000 };
  const spy = { forType: () => ({ ms: 1000 }) };
  assert.equal(gradeAnswer({ answer: ans, card: fresh(), srs, now: NOW, exerciseType: TYPE, baselines: spy }).rating, 2, 'baselines: 3 s sobre 1 s = lento');
  assert.equal(gradeAnswer({ answer: ans, card: fresh(), srs, now: NOW, exerciseType: TYPE, baselines: spy, baselineMs: 3000 }).rating, 3, 'baselineMs manda');
  assert.equal(gradeAnswer({ answer: ans, card: fresh(), srs, now: NOW, exerciseType: TYPE }).rating, grade(ans).rating, 'sin nada: constante');
  assert.equal(gradeAnswer({ answer: { result: 'correct', ms: base * 0.5 }, card: fresh(), srs, now: NOW, exerciseType: TYPE, baselines: { forType: () => ({ ms: NaN }) } }).rating, 4, 'mediana ilegible → constante');
  throwsEs(() => grade(ans, { baselineMs: 0 }), /baselineMs/); throwsEs(() => grade(ans, { baselineMs: 'rápido' }), /baselineMs/);
});

// ---------- tarjeta y motor ----------
test('el primer «Otra vez» de una tarjeta nueva no suma lapses (1.4) y no la vuelve sanguijuela', () => {
  const r = grade({ result: 'wrong', ms: 2000 });
  assert.equal(r.card.lapses, 0); assert.equal(r.card.leech, false); assert.equal(r.card.suspended, false); assert.equal(r.card.state, 2);
});

test('un fallo en una tarjeta ya aprendida sí suma un lapse; los 4 ratings dan fechas de repaso de menor a mayor', () => {
  const c = mature();
  const lapses = gradeAnswer({ answer: { result: 'wrong' }, card: c, srs, now: LATER, exerciseType: TYPE, baselineMs: base }).card.lapses;
  assert.equal(lapses, c.lapses + 1);
  const dues = [1, 2, 3, 4].map((rating) => Date.parse(gradeManual({ rating, card: c, srs, now: LATER, exerciseType: 'def_to_word' }).card.due));
  for (let i = 1; i < dues.length; i += 1) assert.ok(dues[i] > dues[i - 1], `due crece: ${dues.join(' < ')}`);
});

test('no muta la tarjeta ni la respuesta que recibe (entradas congeladas no fallan)', () => {
  const card = deepFreeze(mature()); const answer = deepFreeze({ result: 'correct', ms: 2000, errorCodes: ['TNS.SINCE_FOR'], responseRaw: 'I have lived here since 2020' });
  const r = gradeAnswer({ answer, card, srs, now: LATER, exerciseType: TYPE, baselineMs: base });
  assert.notEqual(r.card, card); assert.equal(card.reps, 2); assert.equal(r.card.reps, 3);
  assert.deepEqual(r.event.errorCodes, ['TNS.SINCE_FOR']); assert.equal(r.event.responseRaw, 'I have lived here since 2020');
});

test('tarjeta suspendida o sanguijuela: la respuesta se guarda, la tarjeta NO cambia y se explica por qué', () => {
  for (const [over, re] of [[{ suspended: true }, /suspendida/], [{ suspended: true, leech: true, lapses: 8 }, /sanguijuela/]]) {
    const card = { ...mature(), ...over };
    const r = gradeAnswer({ answer: { result: 'wrong', ms: 1000 }, card, srs, now: LATER, exerciseType: TYPE, baselineMs: base });
    assert.equal(r.scheduled, false); assert.equal(r.notScheduled.code, 'SUSPENDED'); assert.match(r.notScheduled.message, re);
    assert.deepEqual(r.card, card, 'sin cambios'); assert.notEqual(r.card, card, 'copia, no la misma referencia'); assert.equal(r.dueLabel, null);
    assert.equal(r.rating, 1); assert.equal(validateEvent(r.event).ok, true, 'el evento sale igual');
    const m = gradeManual({ rating: 3, card, srs, now: LATER, exerciseType: TYPE });
    assert.equal(m.scheduled, false); assert.equal(m.event.rating, 3);
  }
});

test('tarjeta dañada o motor que falla: no se pierde la respuesta (REVIEW_FAILED) y no lanza', () => {
  const broken = { ...fresh(), due: 'mañana' };
  const r = gradeAnswer({ answer: { result: 'correct', ms: 1000 }, card: broken, srs, now: NOW, exerciseType: TYPE, baselineMs: base });
  assert.equal(r.scheduled, false); assert.equal(r.notScheduled.code, 'REVIEW_FAILED'); assert.match(r.notScheduled.message, /due inválido/); assert.deepEqual(r.card, broken);
  const boom = { review() { throw undefined; } }; // eslint-disable-line no-throw-literal
  const r2 = gradeAnswer({ answer: { result: 'correct' }, card: fresh(), srs: boom, now: NOW, exerciseType: TYPE });
  assert.equal(r2.notScheduled.code, 'REVIEW_FAILED'); assert.match(r2.notScheduled.message, /error desconocido/);
  const noLabel = gradeAnswer({ answer: { result: 'correct' }, card: fresh(), srs: { review: srs.review }, now: NOW, exerciseType: TYPE });
  assert.equal(noLabel.scheduled, true); assert.equal(noLabel.dueLabel, null, 'un motor sin dueLabel no rompe');
  const badLabel = gradeAnswer({ answer: { result: 'correct' }, card: fresh(), srs: { review: srs.review, dueLabel() { throw new Error('x'); } }, now: NOW, exerciseType: TYPE });
  assert.equal(badLabel.dueLabel, null);
});

test('respeta el interruptor de Ajustes: con «simple» programa con el motor simple', async () => {
  const s = createSettings({}); await s.load();
  const a = createSrs({ settings: s });
  const viaFsrs = gradeAnswer({ answer: { result: 'correct', ms: base }, card: mature(), srs: a, now: LATER, exerciseType: TYPE, baselineMs: base });
  await s.set('srsEngine', 'simple');
  const viaSimple = gradeAnswer({ answer: { result: 'correct', ms: base }, card: mature(), srs: a, now: LATER, exerciseType: TYPE, baselineMs: base });
  assert.equal(a.engine(), 'simple'); assert.notEqual(viaSimple.card.due, viaFsrs.card.due, 'cada motor da su fecha');
  assert.equal(viaSimple.rating, viaFsrs.rating, 'el rating no depende del motor');
});

// ---------- el evento 8.6 ----------
test('el evento es válido para events.log, se guarda y la tarjeta sigue la regla «evento primero»', async () => {
  const clock = makeClock('2026-10-20T15:00:00.000Z'); const db = createMemoryDb(); await db.open();
  const events = createEvents({ db, clock, rng: makeRng(9) });
  const r = gradeAnswer({ answer: { result: 'correct', ms: 2500, responseRaw: 'I’ve lived here for 2 years', errorCodes: [] }, card: fresh(), srs, now: NOW, exerciseType: TYPE, baselineMs: base, sessionId: 'ses_1', channel: 'tap' });
  const saved = await events.log(r.event);
  assert.equal(saved.ts, NOW.toISOString(), 'ts = now: el evento y el repaso comparten instante');
  assert.deepEqual([saved.type, saved.cardId, saved.itemId, saved.sessionId, saved.channel, saved.mode], ['answer', 'g.pp.0001#0', 'g.pp.0001', 'ses_1', 'tap', 'mech']);
  assert.deepEqual(saved.topics, ['gram.present_perfect.for_since']); assert.equal(saved.responseRaw, 'I’ve lived here for 2 years');
  assert.equal(saved.rating, r.rating); assert.equal(saved.ms, 2500); assert.equal(saved.hint, false); assert.equal(saved.dontKnow, false);
  await db.put('cards', r.card);
  assert.equal((await db.get('cards', 'g.pp.0001#0')).reps, 1);
  assert.equal((await events.byCard('g.pp.0001#0')).length, 1);
});

test('el evento sale con topics de la tarjeta (o los que se pasen), ms limpio y sin id ni day', () => {
  const r = grade({ result: 'correct', ms: 1234.6 });
  assert.deepEqual(r.event.topics, ['gram.present_perfect.for_since']); assert.equal(r.event.ms, 1235, 'redondeado por el esquema');
  assert.equal('id' in r.event, false); assert.equal('day' in r.event, false);
  assert.deepEqual(grade({ result: 'correct' }, { topics: ['otro.tema'] }).event.topics, ['otro.tema']);
});

test('todo o nada: si el evento no es válido NO se llama a review y se lanza EventError', () => {
  let calls = 0; const spy = { review: (...a) => { calls += 1; return fsrsReview(...a); } };
  const noTopics = { ...fresh(), topics: [] }; // un evento `answer` necesita al menos un tema
  assert.throws(() => gradeAnswer({ answer: { result: 'correct', ms: 1 }, card: noTopics, srs: spy, now: NOW, exerciseType: TYPE, baselineMs: base }), (e) => e instanceof EventError && e.code === 'BAD_EVENT');
  assert.throws(() => gradeManual({ rating: 3, card: noTopics, srs: spy, now: NOW, exerciseType: TYPE }), EventError);
  assert.throws(() => grade({ result: 'correct' }, { exerciseType: 'Tipo Raro!' }), EventError);
  assert.throws(() => grade({ result: 'correct', errorCodes: ['malo'] }), EventError);
  assert.throws(() => grade({ result: 'correct', responseRaw: 'x'.repeat(LIMITS.responseRaw + 1) }), EventError);
  assert.throws(() => grade({ result: 'correct' }, { sessionId: 'con espacio' }), EventError);
  assert.equal(calls, 0, 'review nunca se llamó');
});

test('ms ilegible o raro: el evento guarda null (o el tope), y rate lo ignora (Good)', () => {
  for (const ms of [undefined, null, NaN, Infinity, -5, '3000']) {
    const r = grade({ result: 'correct', ms });
    assert.equal(r.event.ms, null, String(ms)); assert.equal(r.rating, 3); assert.equal(r.reason, 'good_time_ignored');
  }
  assert.equal(grade({ result: 'correct', ms: 0 }).event.ms, 0);
  const huge = grade({ result: 'correct', ms: LIMITS.msMax * 3 });
  assert.equal(huge.event.ms, LIMITS.msMax, 'se topa en 24 h'); assert.equal(huge.rating, 3);
});

// ---------- tarjetas de recuerdo libre: 4 botones manuales ----------
test('gradeManual: rating 1–4 directo, SIN pasar por rate (no mira tiempos ni pistas)', () => {
  const names = ['again', 'hard', 'good', 'easy'];
  [1, 2, 3, 4].forEach((rating, i) => {
    const r = gradeManual({ rating, card: fresh(), srs, now: NOW, exerciseType: 'def_to_word' });
    assert.equal(r.rating, rating); assert.equal(r.event.rating, rating); assert.equal(r.reason, `manual_${names[i]}`); assert.equal(r.time, null);
    assert.equal(r.scheduled, true); assert.equal(r.card.reps, 1);
    assert.deepEqual([r.event.type, r.event.channel, r.event.mode, r.event.hint, r.event.dontKnow, r.event.responseRaw], ['answer', 'tap', 'mech', false, false, null]);
    assert.equal(r.event.result, rating === 1 ? 'wrong' : 'correct');
    assert.equal(validateEvent(r.event).ok, true);
  });
});

test('gradeManual: el evento no guarda ms, así que una calificación manual NO entra en la mediana personal', async () => {
  const clock = makeClock(); const db = createMemoryDb(); await db.open();
  const events = createEvents({ db, clock, rng: makeRng(3) });
  for (let i = 0; i < 12; i += 1) {
    const m = gradeManual({ rating: 4, card: fresh(), srs, now: clock.now(), exerciseType: 'def_to_word' });
    assert.equal(m.event.ms, null); await events.log(m.event); clock.advance(60000);
  }
  const b = await loadBaselines({ events, now: clock.now() });
  assert.deepEqual(b.forType('def_to_word'), { ms: defaultBaselineMs('def_to_word'), source: 'default', samples: 0 });
});

test('gradeManual: «Otra vez» en una tarjeta nueva no suma lapses; en una aprendida sí', () => {
  assert.equal(gradeManual({ rating: 1, card: fresh(), srs, now: NOW, exerciseType: 'def_to_word' }).card.lapses, 0);
  const c = mature();
  assert.equal(gradeManual({ rating: 1, card: c, srs, now: LATER, exerciseType: 'def_to_word' }).card.lapses, c.lapses + 1);
});

// ---------- entradas inválidas ----------
test('entradas inválidas: mensajes claros en español y nunca un TypeError del lenguaje', () => {
  const ok = { answer: { result: 'correct' }, card: fresh(), srs, now: NOW, exerciseType: TYPE };
  const man = { rating: 3, card: fresh(), srs, now: NOW, exerciseType: TYPE };
  for (const bad of [undefined, null, 5, 'x', []]) { throwsEs(() => gradeAnswer(bad), /gradeAnswer: se necesita un objeto/); throwsEs(() => gradeManual(bad), /se necesita un objeto/); }
  const cases = [
    [{ card: null }, /falta la tarjeta/], [{ card: {} }, /falta la tarjeta/], [{ card: { id: 3, itemId: 'a' } }, /falta la tarjeta/],
    [{ srs: null }, /falta el motor de repaso/], [{ srs: {} }, /falta el motor de repaso/],
    [{ exerciseType: '' }, /exerciseType/], [{ exerciseType: undefined }, /exerciseType/], [{ exerciseType: 7 }, /exerciseType/],
    [{ now: undefined }, /now.*fecha válida/], [{ now: 'ayer' }, /now.*fecha válida/], [{ now: new Date('x') }, /now.*fecha válida/],
    [{ topics: 'tema' }, /topics debe ser una lista/],
  ];
  for (const [over, re] of cases) { throwsEs(() => gradeAnswer({ ...ok, ...over }), re); throwsEs(() => gradeManual({ ...man, ...over }), re); }
  for (const a of [undefined, null, 'correct', [], { result: 'bien' }, { result: undefined }, { result: 'CORRECT' }]) throwsEs(() => gradeAnswer({ ...ok, answer: a }), /falta la respuesta|result debe ser/);
  for (const k of ['hint', 'dontKnow', 'interrupted']) for (const v of ['sí', 1, 0]) throwsEs(() => gradeAnswer({ ...ok, answer: { result: 'correct', [k]: v } }), new RegExp(`${k} debe ser verdadero o falso`));
  for (const r of [0, 5, 2.5, '3', 'good', NaN, null, undefined, -1]) throwsEs(() => gradeManual({ ...man, rating: r }), /rating debe ser un entero de 1 a 4/);
});

test('texto con acentos, ñ, emoji y comillas curvas en la respuesta pasa tal cual al evento', () => {
  const raw = 'Ñandú ✓ “I’ve been there” 🙂';
  assert.equal(grade({ result: 'correct', responseRaw: raw }).event.responseRaw, raw);
});

test('`now` acepta Date, milisegundos o texto ISO y el evento usa el mismo instante', () => {
  for (const now of [NOW, NOW.getTime(), NOW.toISOString()]) {
    const r = gradeAnswer({ answer: { result: 'correct' }, card: fresh(), srs, now, exerciseType: TYPE, baselineMs: base });
    assert.equal(r.event.ts, NOW.toISOString());
  }
});

// ---- 2.1-T2: marca `early` en el evento de un repaso adelantado ----
test('gradeAnswer y gradeManual: una tarjeta que aún no vence marca el evento con early:true; a tiempo, vencida o nueva no llevan el campo', () => {
  const c = mature();                    // vence en el futuro respecto a su último repaso
  const before = new Date(Date.parse(c.due) - D);
  const onDue = new Date(c.due);
  const after = new Date(Date.parse(c.due) + D);
  const ga = (card, now) => gradeAnswer({ answer: { result: 'correct', ms: base }, card, srs, now, exerciseType: TYPE, baselineMs: base });
  const gm = (card, now) => gradeManual({ rating: 3, card, srs, now, exerciseType: TYPE });
  assert.equal(ga(c, before).event.early, true);
  assert.equal(gm(c, before).event.early, true);
  for (const [card, now, why] of [[c, onDue, 'justo al vencer'], [c, after, 'vencida'], [fresh(), NOW, 'nueva']]) {
    assert.equal('early' in ga(card, now).event, false, `gradeAnswer ${why}`);
    assert.equal('early' in gm(card, now).event, false, `gradeManual ${why}`);
  }
});

test('el evento adelantado es válido para events.log y vuelve con early:true', async () => {
  const c = mature();
  const g = gradeAnswer({ answer: { result: 'wrong', ms: base }, card: c, srs, now: new Date(Date.parse(c.due) - D), exerciseType: TYPE, baselineMs: base });
  const db = createMemoryDb(); await db.open();
  const events = createEvents({ db, clock: makeClock(NOW.toISOString()), rng: makeRng(2) });
  const saved = await events.log(g.event);
  assert.equal(saved.early, true);
});
