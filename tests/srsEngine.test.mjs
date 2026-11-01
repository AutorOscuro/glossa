// @purpose: Pruebas de la fachada del motor de repaso (core/srsEngine.js).
// Pruebas de la fachada core/srsEngine.js (subparte 1.4, cuarto 4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSrs, ENGINES } from '../core/srsEngine.js';
import { createSettings, DEFS, validateSetting } from '../core/settings.js';
import { createMemoryDb, createMemoryDisk } from '../core/db.memory.js';

const T0 = new Date('2026-10-20T10:00:00.000Z');
const D = 86400000;
const plus = (d, n) => new Date(d.getTime() + n * D);

test('ajuste srsEngine: por defecto fsrs, solo acepta fsrs o simple', async () => {
  assert.equal(DEFS.srsEngine.default, 'fsrs');
  assert.equal(validateSetting('srsEngine', 'simple').ok, true);
  for (const bad of ['Simple', 'leitner', '', null, 1, true]) assert.equal(validateSetting('srsEngine', bad).ok, false);
  const s = createSettings({}); await s.load();
  assert.equal(s.get('srsEngine'), 'fsrs');
});

test('sin ajustes usa FSRS con valores por defecto', () => {
  const srs = createSrs();
  assert.equal(srs.engine(), 'fsrs');
  const c = srs.review(srs.newCard('a.1', 0, T0), 'good', T0);
  assert.ok(Math.abs(c.stability - 2.3065) < 1e-6);
  assert.equal(createSrs({ settings: null }).engine(), 'fsrs');
  assert.equal(createSrs({ settings: { get: () => undefined } }).engine(), 'fsrs');
});

test('el interruptor de Ajustes cambia de motor en vivo, sin recrear la fachada', async () => {
  const s = createSettings({}); await s.load();
  const srs = createSrs({ settings: s });
  const n = srs.newCard('a.1', 0, T0);
  assert.equal(srs.review(n, 'good', T0).stability.toFixed(4), '2.3065');
  await s.set('srsEngine', 'simple');
  assert.equal(srs.engine(), 'simple');
  const c = srs.review(n, 'good', T0);
  assert.equal(c.stability, 3); assert.equal(srs.previewIntervals(n, T0).good.label, 'Repaso en 3 d');
  await s.set('srsEngine', 'fsrs');
  assert.equal(srs.engine(), 'fsrs');
  assert.equal(srs.review(n, 'good', T0).stability.toFixed(4), '2.3065');
  assert.equal(ENGINES.simple.review(n, 'good', T0).stability, 3);
});

test('las tarjetas de un motor las sigue el otro sin romperse (cambio de ida y vuelta)', async () => {
  const s = createSettings({}); await s.load();
  const srs = createSrs({ settings: s });
  let c = srs.newCard('a.1', 0, T0); let now = T0;
  for (let i = 0; i < 12; i += 1) {
    await s.set('srsEngine', i % 2 ? 'simple' : 'fsrs');
    c = srs.review(c, i % 5 === 4 ? 'again' : 'good', now);
    for (const k of ['stability', 'difficulty']) assert.ok(Number.isFinite(c[k]) && c[k] >= 0, `${i} ${k}`);
    assert.ok(new Date(c.due) > now, `due futura en ${i}`);
    const r = srs.retrievability(c, plus(now, 1)); assert.ok(r >= 0 && r <= 1);
    now = new Date(c.due);
  }
});

test('retención y umbral de sanguijuela salen de los ajustes', async () => {
  const s = createSettings({}); await s.load();
  const srs = createSrs({ settings: s });
  let c = srs.review(srs.newCard('a.1', 0, T0), 'good', T0);
  for (let i = 0; i < 2; i += 1) c = srs.review(c, 'good', new Date(c.due));
  const at = new Date(c.due);
  const days = (x) => (new Date(x.due) - new Date(x.last_review)) / D;
  const d90 = days(srs.review(c, 'good', at));
  await s.set('retention', 0.8); const d80 = days(srs.review(c, 'good', at));
  await s.set('retention', 0.95); const d95 = days(srs.review(c, 'good', at));
  assert.ok(d80 > d90 && d90 > d95, `${d80} ${d90} ${d95}`);
  await s.set('leechThreshold', 3);
  let k = srs.review(srs.newCard('a.2', 0, T0), 'good', T0);
  for (let i = 0; i < 3; i += 1) k = srs.review(k, 'again', plus(new Date(k.last_review), 1));
  assert.equal(k.leech, true);
});

test('rescue usa el tope diario de Ajustes y la retrievabilidad del motor activo', async () => {
  const s = createSettings({}); await s.load();
  const srs = createSrs({ settings: s });
  const cards = Array.from({ length: 60 }, (_, i) => ({ ...srs.review(srs.newCard(`c${i}`, 0, T0), 'good', T0) }));
  const later = plus(T0, 400);
  assert.equal(srs.rescue(cards, later).active, false);
  await s.set('dailyReviewCap', 20);
  const p = srs.rescue(cards, later);
  assert.equal(p.threshold, 30); assert.equal(p.quota, 10);
  assert.equal(p.active, true); assert.equal(p.today.length, 10); assert.equal(p.postponed, 50);
  await s.set('srsEngine', 'simple');
  assert.equal(srs.rescue(cards, later).today.length, 10);
  assert.deepEqual(srs.leechList([{ id: 'a', leech: true, lapses: 9 }, { id: 'b', leech: false }]).map((c) => c.id), ['a']);
  assert.equal(srs.levelOf({ stability: 25 }), 4);
  assert.equal(srs.dueLabel({ due: plus(T0, 28).toISOString() }, T0), 'Repaso en 4 sems');
});

test('adversarial: un motor corrupto en disco (o de una versión futura) cae a FSRS y no rompe el repaso', async () => {
  const db = createMemoryDb({ disk: createMemoryDisk() }); await db.open();
  for (const bad of ['banana', 'SIMPLE', 7, null, { a: 1 }]) {
    await db.put('settings', { key: 'srsEngine', value: bad });
    const s = createSettings({ db }); await s.load();
    assert.equal(s.get('srsEngine'), 'fsrs');
    const srs = createSrs({ settings: s });
    assert.equal(srs.engine(), 'fsrs');
    assert.equal(srs.review(srs.newCard('a.1', 0, T0), 'good', T0).state, 2);
  }
  await db.put('settings', { key: 'srsEngine', value: 'simple' });
  const ok = createSettings({ db }); await ok.load();
  assert.equal(createSrs({ settings: ok }).engine(), 'simple');
  // Una fachada con ajustes raros (valor que no es 'simple') nunca elige un motor inexistente.
  assert.equal(createSrs({ settings: { get: () => 'leitner' } }).engine(), 'fsrs');
});
