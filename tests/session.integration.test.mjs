// @purpose: Prueba de integración del armador de sesiones con la base en memoria, el SRS real, el dominio real (createMastery.compute) y el registro de errores real.
// 1.8-T5 (verificación pendiente de T4). Nada se inventa con la forma {topicId, pct}: se calculan con los motores reales y se pasan a `build` como datos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { build } from '../core/session.js';
import { createMastery } from '../core/mastery.js';
import { createEvents } from '../core/events.js';
import { createErrors } from '../core/errors.js';
import { createErrorCatalog } from '../core/errorCatalog.js';
import { createSrs } from '../core/srsEngine.js';
import { RATING } from '../core/srs.js';
import { createMemoryDb } from '../core/db.memory.js';
import { createRng } from '../core/rng.js';
import { makeClock } from './_helpers.mjs';

const NOW = new Date('2026-10-25T12:00:00.000Z');
const DAY = 86400000;
const at = (d) => new Date(NOW.getTime() - d * DAY);
const CATALOG = createErrorCatalog(JSON.parse(fs.readFileSync(new URL('../content/taxonomy/error_codes.json', import.meta.url), 'utf8')));
const STRONG = 'gram.strong'; const WEAK = 'gram.weak';
const REC = ['mcq_en_es', 'match_pairs', 'order_blocks']; const PRD = ['translate_word', 'fix_error', 'phrase_cloze'];

async function world() {
  const db = createMemoryDb(); await db.open();
  const clock = makeClock(NOW.toISOString());
  const events = createEvents({ db, clock }); const errors = createErrors({ db, catalog: CATALOG, clock }); const srs = createSrs();
  const mastery = createMastery({ db, events, errors, srs, clock });
  const items = []; let k = 0;
  const addCard = async (topic, type, reviews, dueIn) => {
    k += 1; const itemId = `it${String(k).padStart(3, '0')}`; items.push({ id: itemId, type });
    let c = srs.newCard(itemId, 0, reviews.length ? reviews[0][1] : at(0), [topic]);
    for (const [rating, when] of reviews) c = srs.review(c, rating, when);
    if (reviews.length === 0) c = { ...c, state: 0 };
    else c = { ...c, due: new Date(NOW.getTime() + dueIn * DAY).toISOString() };
    await db.put('cards', c);
    for (const [rating, when] of reviews) await events.log({ ts: when.toISOString(), type: 'answer', sessionId: `s${when.getTime() % 3}`, cardId: c.id, itemId, topics: [topic], exerciseType: type, result: rating >= 3 ? 'correct' : 'wrong', rating, ms: 4000, hint: false, dontKnow: false, responseRaw: `r${k}-${when.getTime()}`, errorCodes: [], mode: 'mech', channel: 'keyboard' });
    return c;
  };
  return { db, errors, mastery, items, addCard };
}
const allCards = async (db) => (await db.query('cards')) ?? [];

test('el dominio real de compute entra en build: tema dominado mezcla producción; tema sin ver solo recibe producción al agotarse el reconocimiento', async () => {
  const w = await world();
  for (let i = 0; i < 6; i += 1) await w.addCard(STRONG, REC[i % 3], [[RATING.GOOD, at(20)], [RATING.GOOD, at(12)], [RATING.EASY, at(5)], [RATING.GOOD, at(2)]], 30);
  for (let i = 0; i < 6; i += 1) { await w.addCard(STRONG, PRD[i % 3], []); await w.addCard(STRONG, REC[i % 3], []); }
  for (let i = 0; i < 6; i += 1) { await w.addCard(WEAK, PRD[i % 3], []); await w.addCard(WEAK, REC[i % 3], []); }
  const strong = await w.mastery.compute(STRONG, NOW); const weak = await w.mastery.compute(WEAK, NOW);
  assert.equal(strong.band, 'mastered'); // 4 respuestas correctas y recientes en 6 tarjetas
  assert.equal(weak.band, 'unseen'); assert.equal(weak.pct, 0); // sin respuestas
  const plan = build({ now: NOW, cards: await allCards(w.db), items: w.items, rng: createRng(5), mastery: [strong, weak], size: 20, newCap: 20 });
  assert.equal(plan.stats.progression.enabled, true);
  assert.equal(plan.stats.progression.ignored, 0);
  const nuevas = (topic) => plan.items.filter((i) => i.kind === 'new' && i.topic === topic);
  // Cuentas a mano: los 20 huecos son de nuevas; el tema ya empezado (STRONG) va primero y gasta sus 12 (cuota 2/3 = 8, pero solo hay 6 de producción).
  assert.equal(nuevas(STRONG).length, 12);
  assert.equal(nuevas(STRONG).filter((i) => i.production === true).length, 6);
  // WEAK tiene 8 huecos y cuota 0: entra primero todo su reconocimiento (6) y la producción solo completa los 2 restantes.
  assert.equal(nuevas(WEAK).length, 8);
  assert.equal(nuevas(WEAK).filter((i) => i.production === true).length, 2);
  assert.equal(nuevas(WEAK).filter((i) => i.production === false).length, 6);
  assert.equal(new Set(plan.items.map((i) => i.cardId)).size, plan.count);
});

test('el registro real de errores alimenta errorFocus: primero el ítem con más puntuación', async () => {
  const w = await world();
  const bad = await w.addCard(WEAK, 'fix_error', [[RATING.AGAIN, at(4)], [RATING.HARD, at(2)]], 2);
  const ok = await w.addCard(WEAK, 'mcq_en_es', [[RATING.GOOD, at(4)], [RATING.GOOD, at(2)]], 2);
  for (let d = 5; d >= 1; d -= 1) await w.errors.record({ original: 'I live here since 2010', code: 'TNS.SINCE_FOR', topics: [WEAK], itemId: bad.itemId, ts: at(d).toISOString() });
  const list = await w.errors.list();
  const records = Array.isArray(list) ? list : list.items ?? list.records;
  assert.ok(Array.isArray(records) && records.length > 0);
  const plan = build({ now: NOW, cards: await allCards(w.db), items: w.items, rng: createRng(5), errorFocus: true, errors: records });
  assert.ok(plan.count >= 1);
  assert.equal(plan.items[0].itemId, bad.itemId);
  assert.ok(plan.items[0].errorScore > 0);
  assert.ok(plan.items.every((i) => i.why === 'error' && i.kind === 'review'));
  assert.equal(plan.rescue.active, false);
  assert.ok(ok.id);
});

test('topicFocus con tarjetas reales: solo el tema, repasos primero y práctica después', async () => {
  const w = await world();
  await w.addCard(WEAK, 'fix_error', [[RATING.AGAIN, at(8)]], -0); // vencida hoy
  await w.addCard(WEAK, 'mcq_en_es', [[RATING.GOOD, at(3)], [RATING.GOOD, at(1)]], 6);
  await w.addCard(STRONG, 'mcq_en_es', [[RATING.GOOD, at(3)], [RATING.GOOD, at(1)]], 6);
  const plan = build({ now: NOW, cards: await allCards(w.db), items: w.items, rng: createRng(5), topicFocus: WEAK });
  assert.ok(plan.count >= 2);
  assert.ok(plan.items.every((i) => i.topics.includes(WEAK)));
  const whys = plan.items.map((i) => i.why);
  assert.equal(whys[0] === 'overdue' || whys.indexOf('overdue') <= whys.indexOf('practice'), true);
});
