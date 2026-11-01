// @purpose: Simulación de 5 días de uso (2.9-T4, primera parte): sin tarjetas duplicadas, `due` coherente, eventos = respuestas y tope diario de nuevas respetado.
// Usa tests/_simulation.mjs (servicios de estudio reales + paquete semilla real). Varias semillas y niveles de acierto, incluido el peor (todo mal) y el mejor (todo bien).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulate, SEED } from './_simulation.mjs';

const CASES = [[1, 0.8], [2, 0.5], [3, 0], [4, 1], [5, 0.9]];

async function check(seed, accuracy) {
  const r = await simulate({ days: 5, seed, accuracy });
  const cards = await r.db.query('cards');
  const events = (await r.db.query('events')).filter((e) => e.type === 'answer');
  return { r, cards, events };
}

for (const [seed, accuracy] of CASES) {
  test(`simulación de 5 días (semilla ${seed}, acierto ${accuracy}): sin tarjetas duplicadas, eventos = respuestas y due coherente`, async () => {
    const { r, cards, events } = await check(seed, accuracy);
    // 1. Sin tarjetas duplicadas: una por ítem y faceta, y tantas como ítems tiene el paquete.
    assert.equal(cards.length, SEED.items.length);
    assert.equal(new Set(cards.map((c) => c.id)).size, cards.length);
    assert.equal(new Set(cards.map((c) => `${c.itemId}#${c.facet}`)).size, cards.length);
    // 2. Eventos = respuestas guardadas, una por (sesión, tarjeta), cada una con su tarjeta.
    assert.equal(events.length, r.answers.length);
    assert.equal(new Set(events.map((e) => `${e.sessionId}|${e.cardId}`)).size, events.length);
    const ids = new Set(cards.map((c) => c.id));
    for (const e of events) assert.ok(ids.has(e.cardId), `el evento ${e.id} apunta a una tarjeta que no existe`);
    // 3. due coherente: toda tarjeta respondida vence DESPUÉS de su última respuesta, su last_review es esa respuesta y sus reps cuentan sus respuestas.
    for (const c of cards) {
      const mine = events.filter((e) => e.cardId === c.id).sort((a, b) => a.ts.localeCompare(b.ts));
      if (mine.length === 0) { assert.equal(c.state, 0); assert.equal(c.reps, 0); continue; }
      assert.equal(c.last_review, mine.at(-1).ts);
      assert.ok(Date.parse(c.due) > Date.parse(c.last_review), `${c.id}: due ${c.due} no es posterior a last_review ${c.last_review}`);
      assert.ok(c.reps >= 1 && c.reps <= mine.length);
    }
    // 4. Tope diario de nuevas (10 por defecto) y sesiones que no pasan de lo pedido.
    for (const d of r.days) { assert.ok(d.newCards <= 10); assert.ok(d.planned <= 20); }
    // 5. Se estudió algo cada día y el primer día solo hay nuevas.
    assert.ok(r.days.every((d) => d.planned > 0));
    assert.equal(r.days[0].newCards, r.days[0].planned);
  });
}

test('la simulación es determinista: misma semilla, mismos resultados', async () => {
  const a = await simulate({ days: 3, seed: 7, accuracy: 0.7 });
  const b = await simulate({ days: 3, seed: 7, accuracy: 0.7 });
  assert.deepEqual(a.days, b.days);
  assert.deepEqual(a.answers, b.answers);
});

test('un día sin respuestas no inventa eventos ni tarjetas (días = 0)', async () => {
  const r = await simulate({ days: 0 });
  assert.equal(r.answers.length, 0);
  assert.equal((await r.db.query('events')).length, 0);
  assert.equal((await r.db.query('cards')).length, SEED.items.length);
});

// ---------- Parte 2 (2.9-T4): errores con su código y dominio sin bajar sin causa ----------
import fs from 'node:fs';
import { normalize } from '../core/normalize.js';
const CODES = new Set(JSON.parse(fs.readFileSync(new URL('../content/taxonomy/error_codes.json', import.meta.url), 'utf8')).codes.map((c) => c.id));
const ITEM = new Map(SEED.items.map((it) => [it.id, it]));

for (const [seed, accuracy] of CASES.concat([[6, 0.7], [7, 0.6]])) {
  test(`simulación (semilla ${seed}, acierto ${accuracy}): cada fallo guarda su error con un código real del ítem y las cuentas cuadran`, async () => {
    const r = await simulate({ days: 5, seed, accuracy });
    const recs = await r.db.query('errors');
    assert.ok(CODES.size > 50, 'el catálogo de códigos no cargó');
    for (const e of r.sent) { assert.ok(CODES.has(e.code), `código ${e.code} no está en el catálogo`); assert.ok(ITEM.get(e.itemId).error_codes.includes(e.code), `${e.code} no es un código del ítem ${e.itemId}`); }
    // Todas las ocurrencias enviadas están contadas, y los registros son los errores DISTINTOS (código + frase + ítem).
    assert.equal(recs.reduce((n, x) => n + x.count, 0), r.sent.length);
    assert.equal(recs.length, new Set(r.sent.map((e) => `${e.code}|${normalize(e.original)}|${e.itemId}`)).size);
    for (const x of recs) { assert.ok(CODES.has(x.code)); assert.ok(x.topics.length > 0); assert.ok(x.count >= 1); assert.equal(x.kind, x.count >= 3 ? 'systematic' : x.kind); }
    // Solo se envía error al FALLAR, y solo a los ítems que tienen códigos.
    const wrong = new Set(r.answers.filter((a) => a.result === 'wrong').map((a) => a.cardId));
    for (const e of r.sent) assert.ok(wrong.has(e.cardId));
    if (accuracy === 1) assert.equal(r.sent.length, 0);
  });

  test(`simulación (semilla ${seed}, acierto ${accuracy}): acertar nunca baja el dominio en el mismo instante y el dominio es coherente`, async () => {
    const r = await simulate({ days: 5, seed, accuracy });
    assert.ok(r.steps.length >= r.answers.length);
    for (const s of r.steps) if (s.result === 'correct') assert.ok(s.after >= s.before, `${s.itemId}: acertar bajó ${s.topic} de ${s.before} a ${s.after}`);
    for (const d of r.mastery) for (const [topic, m] of Object.entries(d.topics)) {
      assert.ok(Number.isInteger(m.pct) && m.pct >= 0 && m.pct <= 100, `${topic}: pct ${m.pct}`);
      assert.equal(m.pct === 0, m.band === 'unseen');
      assert.ok(m.wrong <= m.answered);
    }
    // Un día sin errores nuevos en el tema y sin topes activos no baja el dominio más que por el olvido (≤ 5 puntos; con 1.7 se midió ≤ 2).
    for (let d = 1; d < r.mastery.length; d += 1) for (const [topic, m] of Object.entries(r.mastery[d].topics)) {
      const prev = r.mastery[d - 1].topics[topic];
      if (m.wrong === 0 && m.caps.length === 0 && prev.pct > 0) assert.ok(prev.pct - m.pct <= 5, `${topic} bajó ${prev.pct - m.pct} sin causa el día ${d}`);
    }
  });
}

test('los 5 días de la simulación son consecutivos: las respuestas caen en 5 días distintos separados por 24 h', async () => {
  const r = await simulate({ days: 5, seed: 1, accuracy: 0.8 });
  const days = [...new Set(r.answers.map((a) => a.ts.slice(0, 10)))];
  assert.deepEqual(days, ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']);
});

// ---------- FIX 2.9-T4: «un solo fallo» (1.7: dominio 100 % tras un único fallo) ----------
// Escenario: el primer ejercicio del primer día se falla y todo lo demás se acierta. Antes del FIX el tema de ese ítem salía «Dominado» (100 %) con confianza baja.
const ONE_FAIL = ({ day, index }) => (day === 0 && index === 0 ? false : true);

test('simulación «un solo fallo»: tras el fallo el tema no pasa de 59 %, ni sube a «Dominado», y su confianza es baja', async () => {
  const r = await simulate({ days: 1, seed: 1, size: 1, outcome: ONE_FAIL });
  assert.equal(r.answers.length, 1);
  assert.equal(r.answers[0].result, 'wrong');
  const topics = Object.entries(r.mastery[0].topics).filter(([, m]) => m.answered > 0);
  assert.ok(topics.length >= 1);
  for (const [topic, m] of topics) {
    assert.ok(m.pct >= 1 && m.pct <= 59, `${topic}: ${m.pct} % tras un solo fallo`);
    assert.notEqual(m.band, 'mastered');
  }
  const step = r.steps[0];
  assert.ok(step.after <= 59, `después del fallo: ${step.after}`);
  const m = await r.study.mastery.compute(step.topic, new Date());
  assert.deepEqual([m.lowEvidence, m.confidence, m.signals.R], [true, 'low', 0]);
});

test('simulación «un solo fallo» en 5 días: ningún tema llega a «Dominado» con menos de 5 respuestas o 3 ítems distintos, y con práctica sí sube', async () => {
  const r = await simulate({ days: 5, seed: 2, accuracy: 1, outcome: ONE_FAIL });
  const evidence = new Map(); // tema → { respuestas, ítems } acumulados al cierre de cada día
  const byDay = Array.from({ length: 5 }, () => new Map());
  for (const s of r.steps) { const m = byDay[s.day]; if (!m.has(s.topic)) m.set(s.topic, []); m.get(s.topic).push(s.itemId); }
  for (let d = 0; d < 5; d += 1) {
    for (const [topic, items] of byDay[d]) { const e = evidence.get(topic) ?? { n: 0, set: new Set() }; e.n += items.length; items.forEach((i) => e.set.add(i)); evidence.set(topic, e); }
    for (const [topic, m] of Object.entries(r.mastery[d].topics)) {
      const e = evidence.get(topic);
      if (e && (e.n < 5 || e.set.size < 3)) assert.ok(m.pct <= 59, `${topic}: ${m.pct} % con ${e.n} respuestas y ${e.set.size} ítems el día ${d}`);
    }
  }
  const last = Object.values(r.mastery[4].topics).filter((m) => m.pct > 0);
  assert.ok(last.some((m) => m.pct > 59), 'con práctica y aciertos algún tema debe salir del tope');
});

test('simulación «un solo fallo»: el ítem fallado vuelve a pedirse y, al acertarlo, su retención deja de contar 0', async () => {
  const r = await simulate({ days: 5, seed: 3, accuracy: 1, outcome: ONE_FAIL });
  const failed = r.answers[0].cardId;
  const later = r.answers.filter((a, i) => i > 0 && a.cardId === failed);
  assert.ok(later.length >= 1, 'la tarjeta fallada no volvió');
  assert.ok(later.every((a) => a.result === 'correct'));
});

// ---------- Política de topes diarios (2.9-T5): 10 nuevas y 100 repasos por defecto ----------

test('política de topes (2.9-T5): por defecto 10 nuevas y 100 repasos; 14 días con 3 niveles de acierto nunca pasan de 10 nuevas ni de 100 en el plan, y el paquete semilla entra en 6 días', async () => {
  const { DEFS } = await import('../core/settings.js');
  assert.equal(DEFS.dailyNewCap.default, 10);
  assert.equal(DEFS.dailyReviewCap.default, 100);
  for (const accuracy of [0.6, 0.8, 0.95]) {
    const r = await simulate({ days: 14, seed: 1, accuracy });
    for (const d of r.days) {
      assert.ok(d.newCards <= 10, `acierto ${accuracy}, día ${d.day}: ${d.newCards} nuevas`);
      assert.ok(d.planned <= 100, `acierto ${accuracy}, día ${d.day}: plan de ${d.planned}`);
    }
    const introduced = r.days.slice(0, 6).reduce((s, d) => s + d.newCards, 0);
    assert.equal(introduced, SEED.items.length, `acierto ${accuracy}: las ${SEED.items.length} tarjetas entran en los 6 primeros días`);
    assert.ok(r.days.slice(6).every((d) => d.newCards === 0), 'después no hay nuevas: se acabó el paquete');
  }
});
