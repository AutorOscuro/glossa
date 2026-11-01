// @purpose: Pruebas del FIX de 1.7 en 2.9-T4: tope por evidencia (menos de 5 respuestas o de 3 ítems) y señal R = 0 tras un fallo; deben fallar con el código anterior.
// FIX 2.9-T4 (decisión del Administrador, 2026-11-01): «un solo fallo daba 100 % Dominado».
//   a) Tope por evidencia: < 5 respuestas o < 3 ítems distintos → pct ≤ 59, banda máxima «En progreso», confianza baja, `lowEvidence`.
//   b) Señal R: una tarjeta cuyo último resultado fue fallo aporta R = 0 hasta que acierte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createMastery } from '../core/mastery.js';
import { MASTERY_CONFIG, EVIDENCE_CAP, SIGNAL_R } from '../core/mastery.config.js';
import { createEvents } from '../core/events.js';
import { createErrors } from '../core/errors.js';
import { createErrorCatalog } from '../core/errorCatalog.js';
import { createSrs } from '../core/srsEngine.js';
import { RATING } from '../core/srs.js';
import { createMemoryDb } from '../core/db.memory.js';
import { makeClock } from './_helpers.mjs';

const NOW = new Date('2026-10-20T12:00:00.000Z');
const DAY = 86400000;
const T = 'gram.present_perfect.for_since';
const at = (days) => new Date(NOW.getTime() - days * DAY);
const CATALOG = createErrorCatalog(JSON.parse(fs.readFileSync(new URL('../content/taxonomy/error_codes.json', import.meta.url), 'utf8')));

async function world(extra = {}) {
  const db = createMemoryDb(); await db.open();
  const clock = makeClock(NOW.toISOString());
  const events = createEvents({ db, clock });
  const errors = createErrors({ db, catalog: CATALOG, clock });
  const srs = createSrs();
  return { db, events, errors, srs, mastery: createMastery({ db, events, errors, srs, clock, ...extra }) };
}
// Repasa la tarjeta del ítem con el resultado dado (como hace la app: la tarjeta se actualiza y se guarda el evento).
let n = 0;
async function study(w, item, result, when, type = 'fix_error') {
  const prev = await w.db.get('cards', `${item}#0`);
  const rating = result === 'correct' ? RATING.GOOD : RATING.AGAIN;
  let c = prev ?? w.srs.newCard(item, 0, when, [T]);
  c = w.srs.review(c, rating, when);
  await w.db.put('cards', c);
  n += 1;
  await w.events.log({
    ts: when.toISOString(), type: 'answer', sessionId: 's1', cardId: `${item}#0`, itemId: item, topics: [T], exerciseType: type,
    result, rating, ms: 5000, hint: false, dontKnow: result === 'dont_know', responseRaw: `r${n}`, errorCodes: [], mode: 'mech', channel: 'keyboard',
  });
}

test('constantes: viven en mastery.config.js y el tope por evidencia es 5 respuestas, 3 ítems y la banda «En progreso»', () => {
  assert.deepEqual({ ...EVIDENCE_CAP }, { minAnswers: 5, minItems: 3, maxBand: 'progress' });
  assert.equal(SIGNAL_R.zeroAfterFail, true);
  assert.equal(MASTERY_CONFIG.evidence, EVIDENCE_CAP);
  assert.ok(Object.isFrozen(EVIDENCE_CAP));
});

test('un solo fallo como primera respuesta: ya no sale «Dominado» (R = 0, pct ≤ 59, confianza baja, poca evidencia)', async () => {
  const w = await world();
  await study(w, 'it1', 'wrong', at(0.01));
  const out = await w.mastery.compute(T, NOW);
  assert.equal(out.signals.R, 0);
  assert.ok(out.pct >= 1 && out.pct <= 59, `pct=${out.pct}`);
  assert.notEqual(out.band, 'mastered');
  assert.equal(out.lowEvidence, true);
  assert.equal(out.confidence, 'low');
  assert.equal(out.detail.R.failed, 1);
});

test('señal R: fallar un ítem la baja a 0 y volver a acertarlo la recupera', async () => {
  const w = await world();
  await study(w, 'it1', 'correct', at(0.2));
  assert.ok((await w.mastery.compute(T, NOW)).signals.R > 0.9);
  await study(w, 'it1', 'dont_know', at(0.1));
  assert.equal((await w.mastery.compute(T, NOW)).signals.R, 0); // `dont_know` también es fallo
  await study(w, 'it1', 'correct', at(0.05));
  assert.ok((await w.mastery.compute(T, NOW)).signals.R > 0.9);
});

test('señal R: solo cuenta la ÚLTIMA vez de cada tarjeta; las demás tarjetas no se tocan', async () => {
  const w = await world();
  await study(w, 'a', 'correct', at(0.3));
  await study(w, 'b', 'wrong', at(0.2));
  const out = await w.mastery.compute(T, NOW);
  assert.ok(out.signals.R > 0.4 && out.signals.R < 0.55, `R=${out.signals.R}`); // (≈1 + 0) / 2
  assert.equal(out.detail.R.failed, 1);
});

test('tope por evidencia: 4 respuestas en 4 ítems → tope; 5 respuestas en 5 ítems → sin tope (borde exacto)', async () => {
  const four = await world();
  for (let i = 0; i < 4; i += 1) await study(four, `it${i}`, 'correct', at(0.4 - i * 0.05), 'phrase_cloze');
  const a = await four.mastery.compute(T, NOW);
  assert.deepEqual([a.lowEvidence, a.pct <= 59, a.confidence], [true, true, 'low']);
  const five = await world();
  for (let i = 0; i < 5; i += 1) await study(five, `it${i}`, 'correct', at(0.4 - i * 0.05), 'phrase_cloze');
  const b = await five.mastery.compute(T, NOW);
  assert.equal(b.lowEvidence, false);
  assert.equal(b.pct, b.rawPct);
  assert.ok(b.pct >= 85, `pct=${b.pct}`); // con evidencia suficiente un buen tema sí llega a «Dominado»
});

test('tope por evidencia: 6 respuestas en 2 ítems → tope; 3 ítems → sin tope (borde exacto de ítems distintos)', async () => {
  const two = await world();
  for (let i = 0; i < 6; i += 1) await study(two, `it${i % 2}`, 'correct', at(0.4 - i * 0.05), 'phrase_cloze');
  const a = await two.mastery.compute(T, NOW);
  assert.deepEqual([a.lowEvidence, a.pct <= 59, a.confidence, a.evidence], [true, true, 'low', 6]);
  const three = await world();
  for (let i = 0; i < 6; i += 1) await study(three, `it${i % 3}`, 'correct', at(0.4 - i * 0.05), 'phrase_cloze');
  assert.equal((await three.mastery.compute(T, NOW)).lowEvidence, false);
});

test('tope por evidencia: la confianza queda baja aunque haya 8 respuestas en 2 sesiones sobre 2 ítems (sin el tope sería «Media»)', async () => {
  const w = await world();
  for (let i = 0; i < 8; i += 1) {
    n += 1;
    await w.events.log({ ts: at(1 - i * 0.05).toISOString(), type: 'answer', sessionId: i < 4 ? 's1' : 's2', cardId: `it${i % 2}#0`, itemId: `it${i % 2}`, topics: [T], exerciseType: 'fix_error', result: 'correct', rating: 3, ms: 5000, hint: false, dontKnow: false, responseRaw: `q${n}`, errorCodes: [], mode: 'mech', channel: 'keyboard' });
  }
  const out = await w.mastery.compute(T, NOW, undefined);
  assert.equal(out.lowEvidence, true);
  assert.equal(out.confidence, 'low');
});

test('sin respuestas sigue siendo «Sin ver» (0 %) y lowEvidence = false: el tope no inventa un número', async () => {
  const w = await world();
  const out = await w.mastery.compute(T, NOW);
  assert.deepEqual([out.pct, out.band, out.lowEvidence], [0, 'unseen', false]);
});

test('el tope por evidencia y el descenso por fallos se combinan: gana el más bajo y `caps` solo lleva el descenso', async () => {
  const w = await world();
  await study(w, 'x', 'wrong', at(0.3));
  await study(w, 'x', 'wrong', at(0.2));
  const out = await w.mastery.compute(T, NOW);
  assert.equal(out.lowEvidence, true);
  assert.deepEqual(out.caps.map((c) => c.kind), ['consecutive_fails']);
  assert.ok(out.pct <= 29, `pct=${out.pct}`);
});

test('las constantes mandan: con minAnswers 1 y minItems 1 el tope desaparece; con zeroAfterFail apagado R vuelve a ser la retención', async () => {
  const cfg = { ...MASTERY_CONFIG, evidence: { ...EVIDENCE_CAP, minAnswers: 1, minItems: 1 }, R: { ...SIGNAL_R, zeroAfterFail: false } };
  const w = await world({ config: cfg });
  await study(w, 'it1', 'wrong', at(0.01));
  const out = await w.mastery.compute(T, NOW);
  assert.equal(out.lowEvidence, false);
  assert.ok(out.signals.R > 0.8);
});
