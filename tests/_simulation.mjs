// @purpose: Simulador de días de uso (2.9-T4): con los servicios de estudio reales, la base en memoria y el paquete semilla, planea, responde con azar con semilla y guarda; no contiene pruebas.
// Simulación de uso (subparte 2.9-T4, primera parte). Lo usa tests/simulation.test.mjs.
//   simulate({ days = 5, seed = 1, accuracy = 0.8, size = 20, start?, outcome? }) → Promesa { db, study, days: [{ day, planned, answered, newCards }], answers, sent, mastery, steps }
//     `outcome` (OPCIONAL, escenarios): ({ day, index, itemId, topics }) → true (acierta) | false (falla) | undefined (lo decide el azar). El azar se tira siempre, así que no cambia el resto.
//     Cada día: el reloj va a las 10:00 UTC, `study.plan({ size, items })` arma la sesión y cada entrada se responde con `gradeAnswer` (correcta con probabilidad `accuracy`, si no «wrong»)
//     y se guarda con `study.commit`. Entre días el reloj avanza 24 h. `answers` es la lista de {sessionId, cardId, result, ts} de lo que SE GUARDÓ (no duplicadas).
//     Parte 2: al fallar un ítem con `error_codes` se guarda también el error con uno de sus códigos (el del distractor si lo hay) y `sent` lista lo enviado: { cardId, itemId, code, original, ts }.
//     Al acabar cada día se calcula el dominio de cada tema del paquete: `mastery[d]` = { day, topics: { [topicId]: { pct, band, caps, answered, wrong } } } (answered/wrong = respuestas de ESE día).
//     `steps` = una entrada por respuesta y tema: { day, itemId, topic, result, before, after } con el dominio calculado ANTES y DESPUÉS en el MISMO instante (sin olvido de por medio).
//     Nada se inventa: usa el mismo código que la app; solo el azar de las respuestas es del simulador.
import fs from 'node:fs';
import { createStudyServices } from '../app/services.js';
import { createMemoryDb } from '../core/db.memory.js';
import { createErrorCatalog } from '../core/errorCatalog.js';
import { createRng } from '../core/rng.js';
import { importPackToDb } from '../core/contentImport.js';
import { gradeAnswer } from '../core/gradeAnswer.js';
import { makeClock } from './_helpers.mjs';

const read = (p) => JSON.parse(fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
export const SEED = read('content/packs/pack_seed_v1.json');
const CATALOG = createErrorCatalog(read('content/taxonomy/error_codes.json'));
const TOPICS = read('content/taxonomy/topics.json').topics;

export async function simulate({ days = 5, seed = 1, accuracy = 0.8, size = 20, start = '2026-11-02T10:00:00.000Z', outcome } = {}) {
  const db = createMemoryDb(); await db.open();
  const clock = makeClock(start);
  const imp = await importPackToDb(db, SEED, { now: clock.now() });
  if (!imp.ok) throw new Error(`simulate: no se pudo importar el paquete (${imp.error?.code ?? '?'})`);
  const study = createStudyServices({ db, settings: null, catalog: CATALOG, topics: TOPICS, clock, rng: createRng(seed), log: () => {} });
  const dice = createRng(seed + 1000);
  const byItem = new Map(SEED.items.map((it) => [it.id, it]));
  const out = []; const answers = []; const sent = []; const mastery = []; const steps = [];
  const topicIds = [...new Set(SEED.items.flatMap((it) => it.topics))];
  for (let d = 0; d < days; d += 1) {
    const plan = await study.plan({ size, items: SEED.items });
    const sessionId = `sim-${d}`;
    let newCards = 0; const today = new Map(topicIds.map((t) => [t, { answered: 0, wrong: 0 }]));
    for (const [index, entry] of plan.items.entries()) {
      const card = await db.get('cards', entry.cardId);
      const rolled = dice.next() < accuracy;
      const forced = typeof outcome === 'function' ? outcome({ day: d, index, itemId: entry.itemId, topics: card.topics }) : undefined;
      const ok = typeof forced === 'boolean' ? forced : rolled;
      const now = clock.now();
      const grade = gradeAnswer({ answer: { result: ok ? 'correct' : 'wrong', ms: 4000 }, card, srs: study.srs, now, exerciseType: byItem.get(entry.itemId).type, sessionId, topics: card.topics });
      const item = byItem.get(entry.itemId);
      const errs = [];
      if (!ok && item.error_codes?.length) {
        const code = item.error_codes[dice.int(0, item.error_codes.length - 1)];
        const original = item.distractors?.find((x) => x.code === code)?.text ?? `respuesta incorrecta ${item.id}`;
        errs.push({ code, original, itemId: item.id, topics: item.topics });
      }
      const before = {};
      for (const t of item.topics) before[t] = (await study.mastery.compute(t, now)).pct;
      const res = await study.commit({ grade, ...(errs.length ? { errors: errs } : {}) });
      if (!res.duplicate) for (const t of item.topics) steps.push({ day: d, itemId: item.id, topic: t, result: ok ? 'correct' : 'wrong', before: before[t], after: (await study.mastery.compute(t, now)).pct });
      if (!res.duplicate) for (const e of errs) sent.push({ cardId: entry.cardId, itemId: item.id, code: e.code, original: e.original, ts: now.toISOString() });
      for (const t of item.topics) { const c = today.get(t); c.answered += 1; if (!ok) c.wrong += 1; }
      if (!res.duplicate) answers.push({ sessionId, cardId: entry.cardId, result: ok ? 'correct' : 'wrong', ts: now.toISOString() });
      if (entry.kind === 'new') newCards += 1;
      clock.advance(20000);
    }
    const snap = {};
    for (const t of topicIds) { const m = await study.mastery.compute(t, clock.now()); snap[t] = { pct: m.pct, band: m.band, caps: m.caps.map((c) => c.kind), ...today.get(t) }; }
    mastery.push({ day: d, topics: snap });
    out.push({ day: d, planned: plan.items.length, answered: plan.items.length, newCards });
    clock.set(new Date(Date.parse(start) + (d + 1) * 86400000).toISOString());
  }
  return { db, study, days: out, answers, sent, mastery, steps };
}
