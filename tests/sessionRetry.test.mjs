// @purpose: Pruebas de startRetrySession (core/sessionDriver.js, 2.8-T3): mini-sesión con las entradas falladas, sin repetir tarjeta, en orden, con tope y sin escribir si no hay nada válido.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mk } from './_sesionHarness.mjs';
import { startRetrySession, resumeSession } from '../core/sessionDriver.js';

const realDocument = globalThis.document;
afterEach(() => { globalThis.document = realDocument; });
const entry = (n, over = {}) => ({ cardId: `c${n}#0`, itemId: `c${n}`, facet: 0, topic: 't.a', exerciseType: 'fix_error', kind: 'review', why: 'due', topics: ['t.a'], ...over });

test('arma una sesión nueva con las entradas dadas, en orden, y la guarda para retomarla', async () => {
  const t = await mk({ cards: 0 });
  const items = [entry(3), entry(1), entry(2)];
  const r = await startRetrySession({ study: t.study, items });
  assert.equal(r.status, 'started');
  assert.match(r.sessionId, /^ses_/);
  assert.deepEqual(r.items.map((e) => e.cardId), ['c3#0', 'c1#0', 'c2#0']);
  assert.equal(r.state.total, 3);
  assert.equal(r.state.phase, 'presenting');
  const again = await resumeSession({ study: t.study, sessionId: r.sessionId });
  assert.equal(again.status, 'restored');
  assert.deepEqual(again.items.map((e) => e.itemId), ['c3', 'c1', 'c2']);
});

test('no repite tarjetas, descarta entradas sin cardId/itemId y entradas que no son objetos', async () => {
  const t = await mk({ cards: 0 });
  const r = await startRetrySession({ study: t.study, items: [entry(1), entry(1), null, 'x', 7, entry(2, { itemId: '' }), { itemId: 'z' }, entry(3, { cardId: '' }), entry(4)] });
  assert.deepEqual(r.items.map((e) => e.cardId), ['c1#0', 'c4#0']);
  assert.equal(r.state.total, 2);
});

test('sin ninguna entrada válida devuelve «empty» y NO toca la sesión guardada', async () => {
  const t = await mk({ cards: 0 });
  const keep = await startRetrySession({ study: t.study, items: [entry(1)] });
  for (const bad of [[], null, undefined, 'x', [null, {}]]) {
    assert.deepEqual(await startRetrySession({ study: t.study, items: bad }), { status: 'empty' });
  }
  const now = await t.study.session.load();
  assert.equal(now.status, 'restored');
  assert.equal(now.sessionId, keep.sessionId);
});

test('respeta el tope de ejercicios por sesión', async () => {
  const t = await mk({ cards: 0 });
  const many = Array.from({ length: 130 }, (_, i) => entry(i));
  const r = await startRetrySession({ study: t.study, items: many });
  assert.equal(r.items.length, 100);
  assert.equal(r.state.total, 100);
});

test('la última sesión guardada gana: reemplaza a la anterior', async () => {
  const t = await mk({ cards: 0 });
  const a = await startRetrySession({ study: t.study, items: [entry(1)] });
  const b = await startRetrySession({ study: t.study, items: [entry(2)] });
  assert.notEqual(a.sessionId, b.sessionId);
  assert.equal((await t.study.session.load()).sessionId, b.sessionId);
});

test('sin dónde guardar (base sin abrir) lanza un Error en español; las entradas de entrada no se modifican', async () => {
  await assert.rejects(() => startRetrySession({ study: { session: null, clock: {} }, items: [entry(1)] }), /no hay dónde guardar/);
  await assert.rejects(() => startRetrySession({}), /no hay dónde guardar/);
  const t = await mk({ cards: 0 });
  const items = [entry(1)]; const frozen = JSON.stringify(items);
  await startRetrySession({ study: t.study, items });
  assert.equal(JSON.stringify(items), frozen);
});
