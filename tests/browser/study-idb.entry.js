// @purpose: Corre en IndexedDB real (navegador) el guardado atómico, la sesión, la foto diaria y los repasos adelantados de 2.1-T2; lo abre tools/idb-check.py study.
// Subparte 2.1, tramo 2. Usa createStudyServices (app/services.js) sobre core/db.idb.js con el catálogo y los temas reales. No forma parte de `npm run check`.
// Deja los resultados en window.__sophia; cada prueba abre su propia base y la borra al terminar.
globalThis.process = { stdout: { write: (s) => { (globalThis.__sophia.log ??= []).push(String(s).trim()); } } };
globalThis.__sophia = { results: [], log: [], done: false };
const { test, runAll } = await import('./node-test-shim.js');
const assert = (await import('./node-assert-shim.js')).default;
const { createStudyServices } = await import('../../app/services.js');
const { createIdbDb } = await import('../../core/db.idb.js');
const { createErrorCatalog } = await import('../../core/errorCatalog.js');
const { createRng } = await import('../../core/rng.js');
const { createState, transition } = await import('../../core/sessionRunner.js');
const { gradeAnswer } = await import('../../core/gradeAnswer.js');
const { countToday } = await import('../../core/dailyUsage.js');
const { makeClock } = await import('../_helpers.mjs');

const CATALOG_JSON = await (await fetch('../../content/taxonomy/error_codes.json')).json();
const TOPICS_JSON = await (await fetch('../../content/taxonomy/topics.json')).json();
const CATALOG = createErrorCatalog(CATALOG_JSON);
const TOPIC = 'gram.be.present_forms';
const CODE = 'TNS.SINCE_FOR';
if (!CATALOG_JSON.codes.some((c) => c.id === CODE)) throw new Error(`el catálogo no trae ${CODE}`);
const NOW = new Date(2026, 9, 26, 15, 0, 0);
const H = 3600000; const D = 24 * H;
const names = [];
let n = 0;

async function world() {
  const name = `sophia-study-${Date.now()}-${n += 1}`; names.push(name);
  const db = createIdbDb({ name }); await db.open();
  const clock = makeClock(NOW.toISOString());
  const study = createStudyServices({ db, settings: null, catalog: CATALOG, topics: TOPICS_JSON.topics, clock, rng: createRng(3), log: () => {} });
  return { db, clock, study };
}
const count = async (db, store) => (await db.query(store, {})).length;
const answerEv = (over = {}) => ({ type: 'answer', itemId: 'it001', cardId: 'it001#0', topics: [TOPIC], exerciseType: 'fix_error', result: 'correct', rating: 3, ms: 4000, mode: 'mech', channel: 'keyboard', ...over });
const grade = (study, card, answer, over = {}) => gradeAnswer({ answer, card, srs: study.srs, now: NOW, exerciseType: 'fix_error', baselineMs: 6000, sessionId: 'ses_1', mode: 'mech', channel: 'keyboard', ...over });
// Tarjeta madura que vence dentro de semanas, repasada hace 2 h (para el fallo adelantado de menos de 24 h).
async function matureCard(w, itemId = 'it001') {
  const base = w.study.srs.newCard(itemId, 0, new Date(NOW.getTime() - 60 * D), [TOPIC]);
  const card = { ...base, state: 2, stability: 30, difficulty: 5, reps: 4, lapses: 0, scheduled_days: 40, last_review: new Date(NOW.getTime() - 2 * H).toISOString(), due: new Date(NOW.getTime() + 38 * D).toISOString() };
  await w.db.put('cards', card);
  return card;
}

test('commit: una respuesta guarda evento, tarjeta y error en la misma transacción real, y el doble toque no duplica', async () => {
  const w = await world();
  const card = w.study.srs.newCard('it001', 0, NOW, [TOPIC]); await w.db.put('cards', card);
  const g = grade(w.study, card, { result: 'wrong', ms: 4000 });
  const out = await w.study.commit({ grade: g, errors: [{ code: CODE, original: 'I am agree', correction: 'I agree', topics: [TOPIC] }] });
  assert.equal(out.duplicate, false); assert.equal(out.cardSaved, true);
  assert.equal(await count(w.db, 'events'), 1); assert.equal(await count(w.db, 'errors'), 1);
  assert.equal((await w.db.get('cards', card.id)).reps, 1);
  const again = await w.study.commit({ grade: g, errors: [{ code: CODE, original: 'I am agree', topics: [TOPIC] }] });
  assert.equal(again.duplicate, true);
  assert.equal(await count(w.db, 'events'), 1); assert.equal(await count(w.db, 'errors'), 1);
});

test('commit: si la transacción real aborta a mitad (dato no clonable) no queda NADA: ni evento ni error ni tarjeta cambiada', async () => {
  const w = await world();
  const card = w.study.srs.newCard('it001', 0, NOW, [TOPIC]); await w.db.put('cards', card);
  const g = grade(w.study, card, { result: 'correct', ms: 3000 });
  const broken = { ...g, card: { ...g.card, roto: () => 1 } };
  await assert.rejects(() => w.study.commit({ grade: broken, errors: [{ code: CODE, original: 'x', topics: [TOPIC] }] }));
  assert.equal(await count(w.db, 'events'), 0); assert.equal(await count(w.db, 'errors'), 0);
  assert.deepEqual(await w.db.get('cards', card.id), card);
});

test('session: guardar, restaurar (answering vuelve a presenting), caducar a las 12 h y borrar', async () => {
  const w = await world();
  let state = transition(createState(), { type: 'START', total: 2 }).state;
  await w.study.session.save({ sessionId: 's1', state, items: [{ cardId: 'a#0', itemId: 'a' }, { cardId: 'b#0', itemId: 'b' }] });
  const ok = await w.study.session.load();
  assert.equal(ok.status, 'restored'); assert.equal(ok.sessionId, 's1'); assert.equal(ok.items.length, 2);
  assert.equal((await w.db.get('meta', 'session_active')).key, 'session_active');
  w.clock.advance(13 * H);
  assert.equal((await w.study.session.load()).status, 'expired');
  assert.equal((await w.study.session.load()).status, 'none', 'al caducar se borra');
  await w.study.session.save({ sessionId: 's2', state, items: [{ cardId: 'a#0', itemId: 'a' }, { cardId: 'b#0', itemId: 'b' }] });
  assert.equal((await w.study.session.clear()).cleared, true);
  assert.equal((await w.study.session.load()).status, 'none');
});

test('snapshot: finish() borra la sesión y escribe UNA foto del día en meta; repetirlo no la cambia; list la devuelve', async () => {
  const w = await world();
  await w.study.events.log(answerEv());
  const state = transition(createState(), { type: 'START', total: 1 }).state;
  await w.study.session.save({ sessionId: 's1', state, items: [{ cardId: 'it001#0', itemId: 'it001' }] });
  const a = await w.study.finish();
  assert.equal(a.cleared, true); assert.equal(a.snapshot.saved, true); assert.equal(a.snapshot.count, 1);
  const rec = await w.db.get('meta', `mastery_snap:${a.snapshot.day}`);
  assert.equal(rec.results[0].topicId, TOPIC);
  const b = await w.study.finish();
  assert.equal(b.snapshot.changed, false);
  assert.equal((await w.db.query('meta', {})).filter((r) => String(r.key).startsWith('mastery_snap:')).length, 1);
  assert.equal((await w.study.snapshot.list()).length, 1);
});

test('repaso adelantado: un fallo a menos de 24 h reinicia la tarjeta guardada en IndexedDB y el evento conserva early:true', async () => {
  const w = await world();
  const card = await matureCard(w);
  const g = grade(w.study, card, { result: 'wrong', ms: 4000 });
  assert.equal(g.event.early, true);
  await w.study.commit({ grade: g });
  const saved = await w.db.get('cards', card.id);
  const left = (Date.parse(saved.due) - NOW.getTime()) / D;
  assert.ok(left >= 1 && left <= 5, `quedó a ${left} días (no a 13 ni a 40)`);
  assert.equal(saved.lapses, 1);
  const [ev] = await w.study.events.byCard(card.id);
  assert.equal(ev.early, true);
});

test('repaso adelantado: un acierto adelantado no alarga más que a tiempo y cuenta como práctica extra, no como repaso', async () => {
  const w = await world();
  const card = await matureCard(w);
  await w.study.events.log(answerEv({ ts: new Date(NOW.getTime() - 40 * D).toISOString() })); // la tarjeta ya era conocida
  const g = grade(w.study, card, { result: 'correct', ms: 3000 });
  await w.study.commit({ grade: g });
  const saved = await w.db.get('cards', card.id);
  const onTime = w.study.srs.review(card, g.rating, new Date(card.due));
  assert.ok((Date.parse(saved.due) - NOW.getTime()) / D <= (Date.parse(onTime.due) - Date.parse(card.due)) / D + 1e-9);
  const u = await countToday({ events: w.study.events, now: NOW });
  assert.deepEqual([u.newToday, u.reviewsToday, u.practiceToday], [0, 0, 1]);
});

test('repaso adelantado: la práctica extra no gasta el cupo diario de repasos del plan y el evento sigue siendo actividad del día', async () => {
  const w = await world();
  const past = new Date(NOW.getTime() - 6 * D).toISOString();
  const due = [];
  for (const id of ['v1', 'v2', 'v3']) {
    const c = { ...w.study.srs.newCard(id, 0, NOW, [TOPIC]), state: 2, stability: 5, difficulty: 5, reps: 3, due: past, last_review: past };
    await w.db.put('cards', c); due.push(c);
  }
  await w.study.events.log(answerEv({ itemId: 'v1', cardId: 'v1#0', ts: new Date(NOW.getTime() - 5 * D).toISOString() }));
  await w.study.events.log(answerEv({ itemId: 'v1', cardId: 'v1#0', ts: new Date(NOW.getTime() - H).toISOString(), early: true }));
  assert.equal((await w.study.plan({ reviewCap: 2 })).count, 2, 'cupo 2 sin gastar');
  assert.equal((await w.study.events.since(new Date(2026, 9, 26))).length, 1, 'el evento de hoy existe');
});

await runAll((r) => globalThis.__sophia.results.push(r));
await new Promise((res) => setTimeout(res, 50));
await Promise.all(names.map((id) => new Promise((res) => { const r = indexedDB.deleteDatabase(id); r.onsuccess = r.onerror = r.onblocked = () => res(); })));
globalThis.__sophia.done = true;
