// @purpose: Pruebas del conductor de sesión (core/sessionDriver.js, 2.1-T3): armar y retomar, un evento y una tarjeta por respuesta, doble toque, cronómetro, fallos a medias y restauración.
// 2.1-T3. Servicios de estudio reales sobre base en memoria, catálogo real, reloj falso y cronómetro con visibilidad falsa; los fallos se provocan con envoltorios.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStudyServices } from '../app/services.js';
import { createMemoryDb } from '../core/db.memory.js';
import { createErrorCatalog } from '../core/errorCatalog.js';
import { createRng } from '../core/rng.js';
import { createAnswerTimer } from '../core/answerTimer.js';
import { createSessionDriver, startSession, resumeSession, NEW_SESSION_ID } from '../core/sessionDriver.js';
import { makeClock } from './_helpers.mjs';

const read = (p) => JSON.parse(fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const CATALOG = createErrorCatalog(read('content/taxonomy/error_codes.json'));
const TOPICS = read('content/taxonomy/topics.json').topics;
const TOPIC = 'gram.be.present_forms';
const CODE = 'TNS.SINCE_FOR';

function fakeVisibility() {
  let hidden = false; const subs = new Set();
  return { hidden: () => hidden, onChange: (fn) => { subs.add(fn); return () => subs.delete(fn); }, set(v) { hidden = v; for (const f of [...subs]) f(); }, subs: () => subs.size };
}

async function world({ cards = 3, wrap = (s) => s, withCatalog = true } = {}) {
  const clock = makeClock('2026-10-26T15:00:00.000Z');
  const db = createMemoryDb(); await db.open();
  const logs = [];
  const study = createStudyServices({ db, catalog: withCatalog ? CATALOG : null, topics: TOPICS, clock, rng: createRng(3), log: (...a) => logs.push(a) });
  for (let i = 0; i < cards; i += 1) await db.put('cards', study.srs.newCard(`it00${i}`, 0, clock.now(), [TOPIC]));
  const vis = fakeVisibility();
  const timer = createAnswerTimer({ clock, visibility: vis });
  const started = await startSession({ study, rng: createRng(9) });
  const used = wrap(study);
  const driver = started.status === 'started' ? createSessionDriver({ study: used, timer, sessionId: started.sessionId, state: started.state, items: started.items, log: (...a) => logs.push(a) }) : null;
  return { clock, db, study, used, vis, timer, started, driver, logs };
}
const events = (w) => w.db.query('events', {});
const cards = (w) => w.db.query('cards', {});
const answered = { result: 'correct', exerciseType: 'fix_error', responseRaw: 'I am' };

test('startSession arma el plan real, guarda la sesión con la faceta entera y usa un identificador válido', async () => {
  const w = await world();
  assert.equal(w.started.status, 'started');
  assert.match(w.started.sessionId, /^ses_\d{8}T\d{4}_[a-z0-9]{4}$/);
  assert.equal(w.started.state.phase, 'presenting');
  assert.equal(w.started.state.total, 3);
  assert.equal(w.started.items.length, 3);
  assert.equal(w.started.items[0].facet, 0);
  const loaded = await w.study.session.load();
  assert.equal(loaded.status, 'restored');
  assert.equal(loaded.sessionId, w.started.sessionId);
  assert.equal(loaded.items[2].cardId, w.started.items[2].cardId);
});

test('startSession con un plan vacío no guarda nada y devuelve el motivo sin culpa', async () => {
  const w = await world({ cards: 0 });
  assert.equal(w.started.status, 'empty');
  assert.equal(w.started.plan.reason.code, 'no_material');
  assert.deepEqual(await w.study.session.load(), { status: 'none' });
});

test('startSession rechaza sin servicios o sin base, con mensaje en español', async () => {
  await assert.rejects(() => startSession({}), /faltan los servicios/);
  const study = createStudyServices({ db: null, log: () => {} });
  await assert.rejects(() => startSession({ study }), /no hay dónde guardar la sesión/);
});

test('una sesión completa: 3 ítems = 3 eventos y 3 tarjetas cambiadas, cada evento con el id de sesión, y al final se borra lo guardado', async () => {
  const w = await world();
  await w.driver.prepare();
  for (let i = 0; i < 3; i += 1) {
    assert.equal(w.driver.shown(), true);
    w.clock.advance(4000);
    const r = await w.driver.submit(i === 1 ? { ...answered, result: 'wrong' } : answered);
    assert.equal(r.status, 'saved');
    assert.equal(w.driver.getState().phase, 'feedback');
    assert.equal((await events(w)).length, i + 1);
    const n = await w.driver.next();
    assert.equal(n.status, i < 2 ? 'advanced' : 'finished');
  }
  const evs = await events(w);
  assert.equal(evs.length, 3);
  assert.ok(evs.every((e) => e.sessionId === w.started.sessionId && e.type === 'answer' && e.exerciseType === 'fix_error'));
  assert.deepEqual(evs.map((e) => e.result).sort(), ['correct', 'correct', 'wrong']);
  assert.ok((await cards(w)).every((c) => c.reps === 1), 'cada tarjeta se actualizó una sola vez');
  assert.equal(w.driver.getState().phase, 'summary');
  assert.deepEqual(await w.study.session.load(), { status: 'none' });
});

test('el resumen y la foto diaria salen al terminar', async () => {
  const w = await world({ cards: 1 });
  w.driver.shown(); await w.driver.submit(answered);
  const n = await w.driver.next();
  assert.equal(n.status, 'finished');
  assert.deepEqual({ total: n.summary.total, answered: n.summary.answered, correct: n.summary.correct, ended: n.summary.ended }, { total: 1, answered: 1, correct: 1, ended: 'completed' });
  assert.equal(n.finish.cleared, true);
  assert.ok(n.finish.snapshot, 'se tomó la foto diaria de dominio');
  assert.equal((await w.study.db.get('meta', 'mastery_snap:2026-10-26'))?.key ?? null, 'mastery_snap:2026-10-26');
});

test('doble toque: dos respuestas a la vez producen UN evento y UNA actualización de tarjeta', async () => {
  const w = await world();
  w.driver.shown();
  const [a, b] = await Promise.all([w.driver.submit(answered), w.driver.submit(answered)]);
  assert.deepEqual([a.status, b.status].sort(), ['ignored', 'saved']);
  assert.equal((await events(w)).length, 1);
  assert.equal((await cards(w)).filter((c) => c.reps === 1).length, 1);
  const c = await w.driver.submit(answered);
  assert.equal(c.status, 'ignored');
  assert.equal((await events(w)).length, 1);
});

test('responder antes de que el ejercicio esté a la vista, o sin ítem activo, se ignora sin tocar nada', async () => {
  const w = await world();
  assert.deepEqual(await w.driver.submit(answered), { status: 'ignored', reason: 'presenting' });
  assert.equal((await events(w)).length, 0);
  assert.equal(w.driver.shown(), true);
  assert.equal(w.driver.shown(), false, 'un segundo «ya está a la vista» no cambia nada');
});

test('continuar sin haber respondido se ignora; continuar dos veces seguidas avanza solo un ítem', async () => {
  const w = await world();
  w.driver.shown();
  assert.equal((await w.driver.next()).status, 'ignored');
  assert.equal(w.driver.getState().index, 0);
  await w.driver.submit(answered);
  const [a, b] = await Promise.all([w.driver.next(), w.driver.next()]);
  assert.deepEqual([a.status, b.status].sort(), ['advanced', 'ignored']);
  assert.equal(w.driver.getState().index, 1);
});

test('el tiempo lo mide el cronómetro y descuenta la pestaña oculta', async () => {
  const w = await world();
  w.driver.shown();
  w.clock.advance(1000);
  w.vis.set(true); w.clock.advance(2500); w.vis.set(false);
  w.clock.advance(2000);
  const r = await w.driver.submit(answered);
  assert.equal(r.event.ms, 3000, 'solo cuenta el tiempo visible');
  assert.equal(w.vis.subs(), 0, 'el cronómetro dejó de escuchar la visibilidad');
});

test('una pestaña oculta más de 3 s marca la medición como interrumpida y el tiempo no cambia la nota', async () => {
  const w = await world();
  w.driver.shown();
  w.vis.set(true); w.clock.advance(20000); w.vis.set(false);
  const r = await w.driver.submit(answered);
  assert.equal(r.event.ms, 0);
  assert.equal(r.rating, 3, 'acierto sin tiempo fiable = Bien');
});

test('el ejercicio no puede imponer el tiempo: `ms` e `interrupted` de la respuesta se descartan', async () => {
  const w = await world();
  w.driver.shown(); w.clock.advance(2000);
  const r = await w.driver.submit({ ...answered, ms: 1, interrupted: true });
  assert.equal(r.event.ms, 2000);
});

test('la respuesta puede traer «no sé» y errores: el evento dice dont_know y el error queda registrado', async () => {
  const w = await world();
  w.driver.shown();
  const r = await w.driver.submit({ result: 'wrong', dontKnow: true, exerciseType: 'fix_error', errors: [{ code: CODE, original: 'I live here since 2020', correction: 'I have lived here since 2020', topics: [TOPIC] }] });
  assert.equal(r.result, 'dont_know');
  assert.equal(r.event.dontKnow, true);
  assert.equal((await w.db.query('errors', {})).length, 1);
});

test('sin tipo de ejercicio (ni en la respuesta ni en el ítem) no se guarda nada y se puede repetir', async () => {
  const w = await world();
  w.driver.shown(); w.clock.advance(1500);
  await assert.rejects(() => w.driver.submit({ result: 'correct' }), /exerciseType/);
  assert.equal(w.driver.getState().phase, 'answering');
  assert.equal((await events(w)).length, 0);
  const r = await w.driver.submit(answered);
  assert.equal(r.status, 'saved');
  assert.equal(r.event.ms, 1500, 'el tiempo medido en el primer intento se conserva');
});

test('si la tarjeta ya no existe no se guarda nada y el estado no cambia', async () => {
  const w = await world();
  w.driver.shown();
  await w.db.delete('cards', w.started.items[0].cardId);
  await assert.rejects(() => w.driver.submit(answered), /ya no existe/);
  assert.equal(w.driver.getState().phase, 'answering');
  assert.equal((await events(w)).length, 0);
});

test('si el commit falla, el estado no avanza, no queda nada a medias y el reintento funciona', async () => {
  let fail = true;
  const w = await world({ wrap: (s) => ({ ...s, commit: async (a) => { if (fail) { fail = false; throw new Error('base llena'); } return s.commit(a); } }) });
  w.driver.shown(); w.clock.advance(2500);
  await assert.rejects(() => w.driver.submit(answered), /base llena/);
  assert.equal(w.driver.getState().phase, 'answering');
  assert.equal((await events(w)).length, 0);
  const r = await w.driver.submit(answered);
  assert.equal(r.status, 'saved');
  assert.equal(r.event.ms, 2500);
  assert.equal((await events(w)).length, 1);
});

test('si solo falla guardar la sesión, la respuesta queda guardada y se avisa (sessionSaved false)', async () => {
  const w = await world({ wrap: (s) => ({ ...s, session: { ...s.session, save: async () => { throw new Error('sin espacio'); } } }) });
  w.driver.shown();
  const r = await w.driver.submit(answered);
  assert.equal(r.status, 'saved');
  assert.equal(r.sessionSaved, false);
  assert.equal((await events(w)).length, 1);
  assert.ok(w.logs.some((l) => String(l[0]).includes('No se pudo guardar el avance')));
});

test('cerrar la app entre el commit y el guardado: al retomar se vuelve a mostrar el ítem y responder otra vez NO duplica el evento', async () => {
  const w = await world({ wrap: (s) => ({ ...s, session: { ...s.session, save: async () => { throw new Error('app cerrada'); } } }) });
  w.driver.shown(); await w.driver.submit(answered);
  assert.equal((await events(w)).length, 1);
  const back = await resumeSession({ study: w.study, sessionId: w.started.sessionId });
  assert.equal(back.status, 'restored');
  assert.equal(back.state.phase, 'presenting');
  assert.equal(back.state.index, 0);
  const d2 = createSessionDriver({ study: w.study, timer: createAnswerTimer({ clock: w.clock, visibility: w.vis }), sessionId: back.sessionId, state: back.state, items: back.items, log: () => {} });
  d2.shown(); w.clock.advance(3000);
  const r = await d2.submit(answered);
  assert.equal(r.status, 'duplicate');
  assert.equal((await events(w)).length, 1);
  assert.equal((await cards(w)).filter((c) => c.reps === 1).length, 1);
  assert.equal(d2.getState().phase, 'feedback');
});

test('retomar tras responder: la sesión vuelve en «siguiente» y next() pasa al ítem 2 sin tocar lo ya guardado', async () => {
  const w = await world();
  w.driver.shown(); await w.driver.submit(answered);
  const back = await resumeSession({ study: w.study, sessionId: w.started.sessionId });
  assert.equal(back.state.phase, 'next');
  const d2 = createSessionDriver({ study: w.study, timer: createAnswerTimer({ clock: w.clock, visibility: w.vis }), sessionId: back.sessionId, state: back.state, items: back.items, log: () => {} });
  const n = await d2.next();
  assert.equal(n.status, 'advanced');
  assert.equal(n.state.index, 1);
  assert.equal(n.state.phase, 'presenting');
  assert.equal((await events(w)).length, 1);
  assert.equal(d2.current().cardId, w.started.items[1].cardId);
});

test('retomar con el ítem a la vista pero sin responder: vuelve a presentarse el mismo ítem', async () => {
  const w = await world();
  w.driver.shown();
  const back = await resumeSession({ study: w.study, sessionId: w.started.sessionId });
  assert.equal(back.state.phase, 'presenting');
  assert.equal(back.state.index, 0);
});

test('resumeSession distingue: nada guardado, otra sesión (sin borrarla), caducada y dañada', async () => {
  const w = await world();
  assert.deepEqual(await resumeSession({ study: w.study, sessionId: 'ses_otra' }), { status: 'other' });
  assert.equal((await w.study.session.load()).status, 'restored', 'la sesión guardada sigue ahí');
  w.clock.advance(13 * 3600 * 1000);
  assert.deepEqual(await resumeSession({ study: w.study, sessionId: w.started.sessionId }), { status: 'expired' });
  assert.deepEqual(await resumeSession({ study: w.study, sessionId: w.started.sessionId }), { status: 'none' });
  await w.db.put('meta', { key: 'session_active', v: 1, sessionId: 'x', savedAt: 'no es fecha' });
  assert.deepEqual(await resumeSession({ study: w.study, sessionId: 'x' }), { status: 'invalid' });
  await assert.rejects(() => resumeSession({}), /no hay dónde leer/);
});

test('saltar un ejercicio no disponible: sin evento, sin tocar la tarjeta, cuenta como saltado y queda guardado', async () => {
  const w = await world();
  const before = await cards(w);
  w.driver.shown();
  const r = await w.driver.skipUnsupported();
  assert.equal(r.status, 'skipped');
  assert.equal((await events(w)).length, 0);
  assert.deepEqual(await cards(w), before);
  assert.equal(w.driver.getState().answers[0].result, 'skipped');
  const loaded = await w.study.session.load();
  assert.equal(loaded.state.phase, 'next');
  assert.equal((await w.driver.skipUnsupported()).status, 'ignored');
});

test('si cerrar la sesión guardada falla, se avisa y el resumen sale igual (se reintentará al reabrir)', async () => {
  const w = await world({ cards: 1, wrap: (s) => ({ ...s, finish: async () => { throw new Error('base ocupada'); } }) });
  w.driver.shown(); await w.driver.submit(answered);
  const n = await w.driver.next();
  assert.equal(n.status, 'finished');
  assert.equal(n.finish, null);
  assert.equal(n.summary.correct, 1);
  assert.ok(w.logs.some((l) => String(l[0]).includes('No se pudo cerrar la sesión guardada')));
  const back = await resumeSession({ study: w.study, sessionId: w.started.sessionId });
  assert.equal(back.state.phase, 'next', 'al reabrir, pasa al resumen y cierra');
});

test('idle() espera a las operaciones en curso', async () => {
  const w = await world();
  w.driver.shown();
  const p = w.driver.submit(answered);
  await w.driver.idle();
  assert.equal(w.driver.getState().phase, 'feedback');
  await p;
});

test('prepare() nunca rechaza aunque no se puedan leer los eventos', async () => {
  const w = await world({ wrap: (s) => ({ ...s, events: { since: async () => { throw new Error('lectura rota'); } } }) });
  await w.driver.prepare();
  assert.ok(w.logs.some((l) => String(l[0]).includes('mediana personal')));
  w.driver.shown();
  assert.equal((await w.driver.submit(answered)).status, 'saved');
});

test('current() es null en el resumen; getItems() devuelve la lista y se valida todo al crear', async () => {
  const w = await world({ cards: 1 });
  assert.equal(w.driver.getItems().length, 1);
  w.driver.shown(); await w.driver.submit(answered); await w.driver.next();
  assert.equal(w.driver.current(), null);
  const base = { study: w.study, timer: w.timer, sessionId: w.started.sessionId, state: w.started.state, items: w.started.items };
  assert.throws(() => createSessionDriver({ ...base, study: null }), /faltan los servicios/);
  assert.throws(() => createSessionDriver({ ...base, timer: {} }), /cronómetro/);
  assert.throws(() => createSessionDriver({ ...base, sessionId: '' }), /identificador/);
  assert.throws(() => createSessionDriver({ ...base, items: [] }), /no coincide/);
  assert.throws(() => createSessionDriver({ ...base, state: { v: 1 } }), /Estado de sesión no válido/);
  assert.equal(NEW_SESSION_ID, 'nueva');
});

// ---------- Roturas 4.R: pruebas añadidas para las roturas que sobrevivían ----------
test('startSession copia del plan el tema, la faceta, el tipo, el motivo y todos los temas de cada ítem', async () => {
  const saved = [];
  const study = {
    clock: makeClock('2026-10-26T15:00:00.000Z'),
    plan: async () => ({ count: 1, items: [{ cardId: 'c1', itemId: 'i1', facet: 2, topic: 'gram.x', exerciseType: 'fix_error', kind: 'review', why: 'due', topics: ['gram.x', 'gram.y'] }] }),
    session: { save: async (s) => { saved.push(s); } },
  };
  const r = await startSession({ study, rng: createRng(1) });
  const expected = { cardId: 'c1', itemId: 'i1', facet: 2, topic: 'gram.x', exerciseType: 'fix_error', kind: 'review', why: 'due', topics: ['gram.x', 'gram.y'] };
  assert.deepEqual(r.items, [expected]);
  assert.deepEqual(saved[0].items, [expected], 'lo guardado es lo mismo que se devuelve');
});

test('resumeSession le pasa a la base la hora actual (la caducidad de 12 h depende de ella)', async () => {
  const clock = makeClock('2026-10-26T15:00:00.000Z');
  const seen = [];
  const study = { clock, session: { load: async (now) => { seen.push(now); return { status: 'none' }; } } };
  await resumeSession({ study, sessionId: 'ses_x' });
  assert.equal(seen.length, 1);
  assert.equal(new Date(seen[0]).getTime(), clock.now().getTime());
});

test('createSessionDriver rechaza una «lista» que no es una lista aunque tenga la longitud correcta', async () => {
  const w = await world();
  const make = (items) => () => createSessionDriver({ study: w.used, timer: w.timer, sessionId: w.started.sessionId, state: w.started.state, items, log: () => {} });
  assert.throws(make('abc'), /lista/);
  assert.throws(make({ length: 3 }), /lista/);
  assert.doesNotThrow(make(w.started.items));
});

test('una respuesta guardada informa que la sesión también quedó guardada y trae la etiqueta del próximo repaso', async () => {
  const w = await world();
  w.driver.shown();
  const r = await w.driver.submit(answered);
  assert.equal(r.sessionSaved, true);
  assert.equal(typeof r.dueLabel, 'string');
  assert.ok(r.dueLabel.length > 0);
});

test('una sesión retomada en la fase «siguiente» sigue mostrando el ítem ya respondido como el actual', async () => {
  const w = await world();
  w.driver.shown(); await w.driver.submit(answered);
  assert.equal(w.driver.getState().phase, 'feedback');
  assert.equal(w.driver.current().cardId, w.started.items[0].cardId, 'en la corrección el ítem es el actual');
  const back = await resumeSession({ study: w.study, sessionId: w.started.sessionId });
  assert.equal(back.state.phase, 'next');
  const d2 = createSessionDriver({ study: w.study, timer: createAnswerTimer({ clock: w.clock, visibility: w.vis }), sessionId: back.sessionId, state: back.state, items: back.items, log: () => {} });
  assert.equal(d2.current().cardId, w.started.items[0].cardId, 'en «siguiente» también');
});

test('el tipo de ejercicio que declara la respuesta manda sobre el del ítem; sin él, se usa el del ítem', async () => {
  const w = await world();
  const items = w.started.items.map((i) => ({ ...i, exerciseType: 'translate_word' }));
  const mk = () => createSessionDriver({ study: w.used, timer: createAnswerTimer({ clock: w.clock, visibility: w.vis }), sessionId: w.started.sessionId, state: w.started.state, items, log: () => {} });
  const d1 = mk(); d1.shown();
  const a = await d1.submit({ result: 'correct', exerciseType: 'fix_error', responseRaw: 'x' });
  assert.equal(a.event.exerciseType, 'fix_error');
  const w2 = await world();
  const items2 = w2.started.items.map((i) => ({ ...i, exerciseType: 'translate_word' }));
  const d2 = createSessionDriver({ study: w2.used, timer: createAnswerTimer({ clock: w2.clock, visibility: w2.vis }), sessionId: w2.started.sessionId, state: w2.started.state, items: items2, log: () => {} });
  d2.shown();
  const b = await d2.submit({ result: 'correct', responseRaw: 'x' });
  assert.equal(b.event.exerciseType, 'translate_word');
});

test('una pestaña oculta más de 3 s: aunque haya tiempo visible rápido, la nota no sube por rapidez', async () => {
  const fast = await world();
  fast.driver.shown(); fast.clock.advance(150);
  const rFast = await fast.driver.submit(answered);
  const hid = await world();
  hid.driver.shown(); hid.clock.advance(150);
  hid.vis.set(true); hid.clock.advance(20000); hid.vis.set(false);
  const rHid = await hid.driver.submit(answered);
  assert.equal(rHid.event.ms, 150);
  assert.equal(rHid.rating, 3, 'medición interrumpida: Bien');
  assert.ok(rFast.rating >= rHid.rating, 'sin interrupción la rapidez nunca baja la nota');
  assert.notEqual(rFast.rating, undefined);
});

test('el estado de la sesión anota el resultado que quedó en el evento, no el que dijo el ejercicio', async () => {
  const w = await world();
  w.driver.shown();
  const r = await w.driver.submit({ result: 'wrong', dontKnow: true, exerciseType: 'fix_error', responseRaw: '' });
  assert.equal(w.driver.getState().answers[0].result, r.result);
  assert.equal(r.result, 'dont_know');
});

test('saltar un ejercicio no disponible detiene el cronómetro', async () => {
  const w = await world();
  w.driver.shown(); w.clock.advance(1000);
  await w.driver.skipUnsupported();
  w.clock.advance(9000);
  assert.equal(w.timer.peek().ms, 1000, 'el tiempo no sigue corriendo tras saltar');
  assert.equal(w.vis.subs(), 0);
});

test('al pasar al siguiente ítem se guarda el avance: lo guardado ya dice ítem 2', async () => {
  const w = await world();
  w.driver.shown(); await w.driver.submit(answered);
  await w.driver.next();
  const loaded = await w.study.session.load(w.clock.now());
  assert.equal(loaded.status, 'restored');
  assert.equal(loaded.state.index, 1);
  assert.equal(loaded.state.phase, 'presenting');
});

test('el conductor es un objeto congelado', async () => {
  const w = await world();
  assert.equal(Object.isFrozen(w.driver), true);
});

test('prepare() consulta los eventos con la fecha actual (sin ella, la mediana personal nunca se usa)', async () => {
  const w = await world();
  const calls = [];
  const spied = { ...w.study, events: { ...w.study.events, since: async (d) => { calls.push(d); return []; } } };
  const d = createSessionDriver({ study: spied, timer: w.timer, sessionId: w.started.sessionId, state: w.started.state, items: w.started.items, log: (...a) => w.logs.push(a) });
  const before = w.logs.length;
  await d.prepare();
  assert.equal(calls.length, 1, 'se pidieron los eventos');
  assert.ok(calls[0] instanceof Date && !Number.isNaN(calls[0].getTime()));
  assert.equal(w.logs.length, before, 'sin avisos de error');
});
