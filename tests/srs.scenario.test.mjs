// @purpose: Recorrido simulado y pruebas adversariales del motor de repaso con una persona simulada de 120 días.
// Recorrido simulado (pasada 3) y pruebas adversariales (pasada 4) del motor de repaso, subparte 1.4.
// Una persona simulada estudia 120 días con semilla fija; se prueban los dos motores, el cambio entre ellos,
// el regreso tras 40 días sin entrar (rescate), el reloj cambiado y volúmenes grandes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSrs } from '../core/srsEngine.js';
import { createSettings } from '../core/settings.js';
import { createRng } from '../core/rng.js';

const T0 = new Date('2026-10-20T08:00:00.000Z');
const D = 86400000;
const plus = (d, n) => new Date(d.getTime() + n * D);
const finite = (c) => Number.isFinite(c.stability) && c.stability >= 0 && Number.isFinite(c.difficulty) && c.difficulty >= 0;

async function simulate({ engine, days = 120, items = 40, gapFrom = -1, gapDays = 0, switchAt = -1, seed = 7 }) {
  const s = createSettings({}); await s.load();
  await s.set('srsEngine', engine);
  const srs = createSrs({ settings: s });
  const rng = createRng(seed);
  let cards = Array.from({ length: items }, (_, i) => srs.newCard(`it.${i}`, i % 3, T0, ['t.a']));
  let reviews = 0; let rescueDays = 0;
  for (let day = 0; day < days; day += 1) {
    if (day === switchAt) await s.set('srsEngine', engine === 'fsrs' ? 'simple' : 'fsrs');
    if (day >= gapFrom && day < gapFrom + gapDays) continue; // días sin entrar
    const now = plus(T0, day);
    const plan = srs.rescue(cards, now);
    if (plan.active) rescueDays += 1;
    const todo = new Set(plan.today.map((c) => c.id));
    cards = cards.map((c) => {
      const isNew = c.state === 0 && day < 20 && c.id.endsWith('#0') === (day % 2 === 0);
      if (!(todo.has(c.id) || isNew) || c.suspended) return c;
      reviews += 1;
      const r = rng.next();
      const rating = r < 0.15 ? 'again' : r < 0.3 ? 'hard' : r < 0.9 ? 'good' : 'easy';
      const n = srs.review(c, rating, now);
      assert.ok(finite(n), `${n.id} día ${day}`);
      assert.ok(new Date(n.due) > now, 'due siempre futura');
      return n;
    });
  }
  return { cards, reviews, rescueDays, srs };
}

for (const engine of ['fsrs', 'simple']) {
  test(`recorrido de 120 días con el motor ${engine}: todo finito, vencimientos futuros, niveles 1–5`, async () => {
    const { cards, reviews, srs } = await simulate({ engine });
    assert.ok(reviews > 200, `repasos: ${reviews}`);
    const seen = cards.filter((c) => c.state !== 0);
    assert.ok(seen.length >= 30);
    for (const c of seen) {
      assert.ok(finite(c)); const lv = srs.levelOf(c); assert.ok(lv >= 1 && lv <= 5);
      assert.match(srs.dueLabel(c, plus(T0, 120)), /^Repaso (ahora|en \d+ (min|h|d|sem|sems|mes|meses|año|años))$/);
      const r = srs.retrievability(c, plus(T0, 120)); assert.ok(r >= 0 && r <= 1);
    }
    assert.ok(Math.max(...seen.map((c) => srs.levelOf(c))) >= 3, 'alguna tarjeta sube de nivel');
  });
}

test('el recorrido es determinista: misma semilla, mismo resultado', async () => {
  const a = await simulate({ engine: 'fsrs', days: 60 }); const b = await simulate({ engine: 'fsrs', days: 60 });
  assert.deepEqual(a.cards, b.cards);
});

test('cambiar de motor a mitad del recorrido no rompe ninguna tarjeta', async () => {
  for (const engine of ['fsrs', 'simple']) {
    const { cards } = await simulate({ engine, switchAt: 45 });
    for (const c of cards.filter((x) => x.state !== 0)) assert.ok(finite(c));
  }
});

test('40 días sin entrar: se activa el rescate sin culpa y el cupo es 0,5 × tope; después se recupera', async () => {
  const s = createSettings({}); await s.load();
  await s.set('dailyReviewCap', 20);
  const srs = createSrs({ settings: s });
  let cards = Array.from({ length: 80 }, (_, i) => srs.review(srs.newCard(`it.${i}`, 0, T0), 'good', T0));
  const back = plus(T0, 40);
  const p = srs.rescue(cards, back);
  assert.equal(p.active, true); assert.equal(p.overdueCount, 80); assert.equal(p.today.length, 10);
  assert.doesNotMatch(p.message_es, /perdiste|racha|culpa|atrasad|tarde/i);
  let rescueDays = 0; let day = 0;
  while (day < 40) {
    const now = plus(back, day); const plan = srs.rescue(cards, now);
    if (plan.active) rescueDays += 1;
    const ids = new Set(plan.today.slice(0, 20).map((c) => c.id));
    cards = cards.map((c) => (ids.has(c.id) ? srs.review(c, 'good', now) : c));
    if (!srs.rescue(cards, now).queue.length) break;
    day += 1;
  }
  assert.ok(rescueDays >= 2 && rescueDays <= 12, `días de rescate: ${rescueDays}`);
  assert.equal(srs.rescue(cards, plus(back, day)).active, false);
});

test('adversarial: reloj cambiado a pasado y a futuro lejano no corrompe nada', () => {
  for (const engine of ['fsrs', 'simple']) {
    const s = { get: (k) => (k === 'srsEngine' ? engine : undefined) };
    const srs = createSrs({ settings: s });
    let c = srs.review(srs.newCard('a.1', 0, T0), 'good', T0);
    c = srs.review(c, 'good', plus(T0, 30));
    for (const odd of [plus(T0, -3650), plus(T0, 1), plus(T0, 20000), new Date('1971-01-01T00:00:00Z')]) {
      for (const r of ['again', 'hard', 'good', 'easy']) { const n = srs.review(c, r, odd); assert.ok(finite(n)); assert.ok(new Date(n.due) >= new Date(c.last_review)); }
      const q = srs.retrievability(c, odd); assert.ok(q >= 0 && q <= 1);
      for (const v of Object.values(srs.previewIntervals(c, odd))) assert.doesNotMatch(v.label, /NaN|undefined|-\d/);
    }
  }
});

test('adversarial: ids con acentos, emoji y 1000 caracteres; temas raros; tarjetas dañadas fallan con elegancia', () => {
  const srs = createSrs();
  for (const id of ['canción.ñandú', '😀 emoji · “comillas”', 'x'.repeat(1000), '  espacios  ']) {
    const c = srs.review(srs.newCard(id, 0, T0, ['tema ñ']), 'good', T0);
    assert.ok(c.id.startsWith(id)); assert.ok(finite(c));
  }
  for (const bad of [{}, { state: 2 }, { ...srs.newCard('a', 0, T0), stability: 'x' }, { ...srs.newCard('a', 0, T0), due: 12345 }]) {
    assert.throws(() => srs.review(bad, 'good', T0), Error);
    assert.throws(() => srs.retrievability(bad, T0), Error);
  }
});

test('adversarial: 0, 1 y 5000 tarjetas; el rescate de 5000 tarda menos de 200 ms en ordenarse', () => {
  for (const engine of ['fsrs', 'simple']) {
    const srs = createSrs({ settings: { get: (k) => (k === 'srsEngine' ? engine : undefined) } });
    assert.equal(srs.rescue([], T0).queue.length, 0);
    const one = [srs.review(srs.newCard('a', 0, T0), 'good', T0)];
    assert.equal(srs.rescue(one, plus(T0, 9)).today.length, 1);
    const big = Array.from({ length: 5000 }, (_, i) => srs.review(srs.newCard(`c${i}`, 0, T0), i % 4 ? 'good' : 'easy', plus(T0, i % 30)));
    const t = performance.now();
    const p = srs.rescue(big, plus(T0, 500));
    const ms = performance.now() - t;
    assert.equal(p.active, true); assert.equal(p.today.length, 50);
    assert.ok(ms < 200, `${engine}: ${ms.toFixed(0)} ms`);
  }
});
