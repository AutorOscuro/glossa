// Pruebas de core/store.js (subparte 0.7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../core/store.js';

test('get devuelve un estado congelado y set mezcla superficialmente', () => {
  const s = createStore({ a: 1, b: 2 });
  assert.deepEqual(s.get(), { a: 1, b: 2 });
  assert.throws(() => { 'use strict'; s.get().a = 9; }, TypeError);
  assert.equal(s.set({ b: 3, c: 4 }), true);
  assert.deepEqual(s.get(), { a: 1, b: 3, c: 4 });
});

test('el estado inicial se copia: mutar el original no afecta al store', () => {
  const init = { a: 1 };
  const s = createStore(init);
  init.a = 99;
  assert.equal(s.get().a, 1);
});

test('set con función recibe el estado previo', () => {
  const s = createStore({ n: 1 });
  s.set((p) => ({ n: p.n + 1 }));
  s.set((p) => ({ n: p.n + 1 }));
  assert.equal(s.get().n, 3);
});

test('solo avisa cuando algo cambió de verdad (Object.is por campo)', () => {
  const s = createStore({ a: 1, o: { x: 1 } });
  const calls = [];
  s.subscribe((n, p) => calls.push([n, p]));
  assert.equal(s.set({ a: 1 }), false);
  assert.equal(s.set({}), false);
  assert.equal(calls.length, 0);
  assert.equal(s.set({ o: { x: 1 } }), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].a, 1);
  const nan = createStore({ v: NaN });
  assert.equal(nan.set({ v: NaN }), false);
});

test('un campo nuevo o uno puesto en undefined también cuenta como cambio', () => {
  const s = createStore({ a: 1 });
  assert.equal(s.set({ b: undefined }), true);
  assert.equal(s.set({ b: undefined }), false);
});

test('subscribe con select avisa solo si cambia el valor elegido', () => {
  const s = createStore({ tema: 'aurora', n: 0 });
  const seen = [];
  s.subscribe((v, prev, st) => seen.push([v, prev, st.n]), { select: (st) => st.tema });
  s.set({ n: 1 });
  assert.equal(seen.length, 0);
  s.set({ tema: 'noche', n: 2 });
  assert.deepEqual(seen, [['noche', 'aurora', 2]]);
});

test('unsubscribe es idempotente y también funciona durante un aviso', () => {
  const s = createStore({ n: 0 });
  const a = []; const b = [];
  let offB;
  s.subscribe(() => { a.push(1); offB(); });
  offB = s.subscribe(() => b.push(1));
  s.set({ n: 1 });
  assert.deepEqual([a.length, b.length], [1, 0]);
  offB(); offB();
  assert.equal(s.subscriberCount(), 1);
});

test('un suscriptor que lanza no impide avisar a los demás y el error se reporta', () => {
  const errs = [];
  const s = createStore({ n: 0 }, { onError: (e) => errs.push(e.message) });
  let ok = 0;
  s.subscribe(() => { throw new Error('mal'); });
  s.subscribe(() => { ok += 1; });
  s.set({ n: 1 });
  assert.deepEqual(errs, ['mal']);
  assert.equal(ok, 1);
  assert.equal(s.get().n, 1);
});

test('set dentro de un aviso se encola, mantiene el orden y no recurre sin fin', () => {
  const s = createStore({ n: 0 });
  const log = [];
  s.subscribe((st) => { log.push(st.n); if (st.n < 3) s.set({ n: st.n + 1 }); });
  s.set({ n: 1 });
  assert.deepEqual(log, [1, 2, 3]);
  assert.equal(s.get().n, 3);
});

test('reset vuelve al estado inicial y avisa solo si era distinto', () => {
  const s = createStore({ n: 0 });
  let calls = 0;
  s.subscribe(() => { calls += 1; });
  assert.equal(s.reset(), false);
  s.set({ n: 5, extra: 1 });
  assert.equal(s.reset(), true);
  assert.deepEqual(s.get(), { n: 0 });
  assert.equal(calls, 2);
});

test('entradas inválidas', () => {
  for (const bad of [null, [], 'x', 5]) assert.throws(() => createStore(bad), /objeto/);
  assert.deepEqual(createStore().get(), {});
  const s = createStore({});
  for (const bad of [null, [], 'x', 5, () => null]) assert.throws(() => s.set(bad), /objeto/);
  assert.throws(() => s.subscribe('x'), /función/);
  assert.throws(() => s.subscribe(() => {}, { select: 'x' }), /select/);
});
