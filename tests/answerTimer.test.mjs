// @purpose: Pruebas del cronómetro de respuesta (core/answerTimer.js) y del adaptador de visibilidad (app/visibility.js).
// Pruebas del cronómetro de respuesta (subparte 1.5, cuarto 3, mitad A): core/answerTimer.js + app/visibility.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAnswerTimer } from '../core/answerTimer.js';
import { createDocumentVisibility } from '../app/visibility.js';
import { rate } from '../core/grading.js';
import { GRADING } from '../core/grading.config.js';
import { LIMITS } from '../core/eventSchema.js';
import { makeClock } from './_helpers.mjs';

// Visibilidad falsa: set(true) = pestaña oculta; avisa a quien esté suscrito.
function fakeVisibility(initialHidden = false) {
  let hidden = initialHidden; const subs = new Set();
  return {
    hidden: () => hidden,
    onChange(fn) { subs.add(fn); return () => subs.delete(fn); },
    set(v, { notify = true } = {}) { hidden = v; if (notify) for (const f of [...subs]) f(); },
    subs: () => subs.size,
  };
}
const setup = (hidden = false, config) => {
  const clock = makeClock(); const vis = fakeVisibility(hidden);
  return { clock, vis, timer: createAnswerTimer({ clock, visibility: vis, config }) };
};

test('mide el tiempo con la pestaña visible', () => {
  const { clock, timer } = setup();
  timer.start(); clock.advance(4321);
  assert.deepEqual(timer.stop(), { ms: 4321, hiddenMs: 0, interrupted: false });
});

test('CA 2: el tiempo con la pestaña oculta se descuenta y, si pasa de 3 s, marca interrupted', () => {
  const { clock, vis, timer } = setup();
  timer.start(); clock.advance(2000); vis.set(true); clock.advance(60000); vis.set(false); clock.advance(1000);
  assert.deepEqual(timer.stop(), { ms: 3000, hiddenMs: 60000, interrupted: true });
});

test('un vistazo corto a otra pestaña (≤ 3 s) se descuenta pero NO interrumpe', () => {
  const { clock, vis, timer } = setup();
  timer.start(); clock.advance(5000); vis.set(true); clock.advance(3000); vis.set(false); clock.advance(2000);
  assert.deepEqual(timer.stop(), { ms: 7000, hiddenMs: 3000, interrupted: false }); // 3000 exactos no pasan del umbral
  const b = setup(); b.timer.start(); b.vis.set(true); b.clock.advance(3001); b.vis.set(false);
  assert.equal(b.timer.stop().interrupted, true);
});

test('varias salidas y regresos se suman', () => {
  const { clock, vis, timer } = setup();
  timer.start();
  for (let i = 0; i < 5; i += 1) { clock.advance(1000); vis.set(true); clock.advance(2000); vis.set(false); }
  clock.advance(500);
  assert.deepEqual(timer.stop(), { ms: 5500, hiddenMs: 10000, interrupted: true });
});

test('empieza con la pestaña ya oculta: ese tiempo cuenta como oculto', () => {
  const { clock, vis, timer } = setup(true);
  timer.start(); clock.advance(5000); vis.set(false); clock.advance(1000);
  assert.deepEqual(timer.stop(), { ms: 1000, hiddenMs: 5000, interrupted: true });
});

test('se responde con la pestaña oculta (p. ej. por voz): el tramo final cuenta como oculto', () => {
  const { clock, vis, timer } = setup();
  timer.start(); clock.advance(1000); vis.set(true); clock.advance(9000);
  assert.deepEqual(timer.stop(), { ms: 1000, hiddenMs: 9000, interrupted: true });
});

test('avisos repetidos o sin cambio real de estado no alteran la medición', () => {
  const { clock, vis, timer } = setup();
  timer.start(); clock.advance(1000);
  vis.set(false); vis.set(false); clock.advance(1000); // "cambió" sin cambiar
  vis.set(true); vis.set(true); clock.advance(500); vis.set(false); clock.advance(500);
  assert.deepEqual(timer.stop(), { ms: 2500, hiddenMs: 500, interrupted: false });
  // El estado cambia pero no llega el aviso: se lee al pedir el siguiente cambio / al parar; no hay NaN ni excepción.
  const c = setup(); c.timer.start(); c.vis.set(true, { notify: false }); c.clock.advance(1000);
  const r = c.timer.stop(); assert.ok(Number.isInteger(r.ms) && r.ms >= 0);
});

test('doble toque: start() con el cronómetro en marcha no reinicia, y stop() repetido devuelve lo mismo', () => {
  const { clock, timer } = setup();
  timer.start(); clock.advance(1000); timer.start(); clock.advance(1000);
  assert.equal(timer.running(), true);
  const a = timer.stop(); clock.advance(99999); const b = timer.stop();
  assert.deepEqual(a, { ms: 2000, hiddenMs: 0, interrupted: false }); assert.deepEqual(b, a); assert.equal(timer.running(), false);
  assert.notEqual(a, b); // copias: modificar una no cambia la otra
  b.ms = 1; assert.equal(timer.stop().ms, 2000);
});

test('tras stop(), start() empieza una medición nueva desde cero', () => {
  const { clock, vis, timer } = setup();
  timer.start(); vis.set(true); clock.advance(9000); timer.stop(); vis.set(false);
  timer.start(); clock.advance(700);
  assert.deepEqual(timer.stop(), { ms: 700, hiddenMs: 0, interrupted: false });
});

test('peek() lee sin detener; stop() no se ve afectado', () => {
  const { clock, timer } = setup();
  timer.start(); clock.advance(1000); assert.equal(timer.peek().ms, 1000); clock.advance(1000); assert.equal(timer.peek().ms, 2000);
  assert.equal(timer.running(), true); assert.equal(timer.stop().ms, 2000);
  clock.advance(5000); assert.equal(timer.peek().ms, 2000); // detenido: congelado
});

test('sin start(): no hay medición y el tiempo se marca como no fiable', () => {
  const { timer } = setup();
  const none = { ms: 0, hiddenMs: 0, interrupted: true };
  assert.deepEqual(timer.peek(), none); assert.deepEqual(timer.stop(), none); assert.equal(timer.running(), false);
});

test('CA 5 (reloj): hacia atrás no da negativos ni NaN y marca interrupted; hacia adelante enorme se topa en 24 h', () => {
  const a = setup(); a.timer.start(); a.clock.advance(2000); assert.equal(a.timer.peek().ms, 2000); a.clock.advance(-10 * 365 * 86400000); a.clock.advance(1000);
  const r = a.timer.stop(); assert.deepEqual(r, { ms: 2000, hiddenMs: 0, interrupted: true }); // el salto atrás no suma ni resta lo ya medido: solo marca no fiable
  const b = setup(); b.timer.start(); b.clock.advance(55 * 365 * 86400000);
  assert.deepEqual(b.timer.stop(), { ms: LIMITS.msMax, hiddenMs: 0, interrupted: false }); // lo extremo lo ignora rate (> 5 × mediana)
});

test('un reloj que falla o devuelve basura no rompe la respuesta: tiempo no fiable', () => {
  for (const bad of [() => { throw new Error('x'); }, () => NaN, () => 'hoy', () => null, () => new Date('x')]) {
    const t = createAnswerTimer({ clock: { now: bad } });
    t.start(); const r = t.stop();
    assert.equal(r.interrupted, true); assert.ok(Number.isInteger(r.ms) && r.ms >= 0 && Number.isInteger(r.hiddenMs));
  }
  let calls = 0; // falla solo la segunda lectura
  const flaky = { now: () => { calls += 1; if (calls === 2) throw new Error('x'); return new Date(1e12 + calls * 1000); } };
  const t = createAnswerTimer({ clock: flaky }); t.start(); assert.equal(t.stop().interrupted, true);
});

test('una visibilidad que lanza se trata como "visible" y no rompe nada', () => {
  const boom = { hidden: () => { throw new Error('x'); }, onChange: () => { throw new Error('y'); } };
  const clock = makeClock(); const t = createAnswerTimer({ clock, visibility: boom });
  t.start(); clock.advance(1500);
  assert.deepEqual(t.stop(), { ms: 1500, hiddenMs: 0, interrupted: false });
});

test('se suscribe al empezar y se desuscribe al parar (sin fugas, ni con 100 respuestas)', () => {
  const clock = makeClock(); const vis = fakeVisibility();
  const t = createAnswerTimer({ clock, visibility: vis });
  assert.equal(vis.subs(), 0); t.start(); assert.equal(vis.subs(), 1); t.start(); assert.equal(vis.subs(), 1); t.stop(); assert.equal(vis.subs(), 0); t.stop();
  for (let i = 0; i < 100; i += 1) { t.start(); clock.advance(10); t.stop(); }
  assert.equal(vis.subs(), 0);
  vis.set(true); // avisos después de parar no cambian el resultado
  assert.equal(t.stop().hiddenMs, 0);
});

test('sin visibility usa "siempre visible"; entradas inválidas lanzan un error claro', () => {
  const clock = makeClock(); const t = createAnswerTimer({ clock }); t.start(); clock.advance(800);
  assert.equal(t.stop().ms, 800);
  for (const x of [undefined, {}, { now: 5 }, null]) assert.throws(() => createAnswerTimer({ clock: x }), /se necesita un reloj con now\(\)/);
  assert.throws(() => createAnswerTimer(), /se necesita un reloj/);
  for (const v of [{}, { hidden: () => false }, { onChange: () => {} }, 5, null]) assert.throws(() => createAnswerTimer({ clock, visibility: v }), /hidden\(\) y onChange/);
  assert.throws(() => createAnswerTimer({ clock, config: { ...GRADING, interruptAfterHiddenMs: -1 } }), /configuración no válida/);
});

test('el umbral sale de la config', () => {
  const { clock, vis, timer } = setup(false, { ...GRADING, interruptAfterHiddenMs: 0 });
  timer.start(); vis.set(true); clock.advance(1); vis.set(false);
  assert.equal(timer.stop().interrupted, true);
  const b = setup(false, { ...GRADING, interruptAfterHiddenMs: 60000 }); b.timer.start(); b.vis.set(true); b.clock.advance(59000); b.vis.set(false);
  assert.equal(b.timer.stop().interrupted, false);
});

test('el objeto está congelado y el resultado es entero y dentro del contrato 8.6', () => {
  const { clock, timer } = setup();
  assert.ok(Object.isFrozen(timer)); assert.throws(() => { 'use strict'; timer.start = () => {}; }, TypeError);
  timer.start(); clock.advance(1234.6); const r = timer.stop();
  assert.ok(Number.isInteger(r.ms) && r.ms >= 0 && r.ms <= LIMITS.msMax);
});

test('con rate: pestaña oculta mucho rato NO baja el rating; sin interrupción, un acierto lento sí es Hard', () => {
  const base = 10000;
  const away = setup(); away.timer.start(); away.vis.set(true); away.clock.advance(120000); away.vis.set(false); away.clock.advance(4000);
  const t1 = away.timer.stop(); assert.equal(t1.ms, 4000);
  assert.equal(rate({ result: 'correct', ...t1 }, base), 3); // interrumpida → tiempo ignorado → Good (no Easy aunque ms sea 4 s)
  const slow = setup(); slow.timer.start(); slow.clock.advance(25000);
  assert.equal(rate({ result: 'correct', ...slow.timer.stop() }, base), 2);
  const fast = setup(); fast.timer.start(); fast.clock.advance(2500);
  assert.equal(rate({ result: 'correct', ...fast.timer.stop() }, base), 4);
});

// ---- app/visibility.js ----
function fakeDoc(state = 'visible') {
  const l = new Map();
  return {
    visibilityState: state,
    addEventListener(t, f) { l.set(t, (l.get(t) ?? new Set()).add(f)); },
    removeEventListener(t, f) { l.get(t)?.delete(f); },
    fire(t) { for (const f of [...(l.get(t) ?? [])]) f(); },
    count: (t) => l.get(t)?.size ?? 0,
  };
}

test('createDocumentVisibility: lee visibilityState y escucha visibilitychange', () => {
  const doc = fakeDoc(); const v = createDocumentVisibility(doc);
  assert.equal(v.hidden(), false); doc.visibilityState = 'hidden'; assert.equal(v.hidden(), true);
  let n = 0; const off = v.onChange(() => { n += 1; });
  doc.fire('visibilitychange'); doc.fire('otra'); assert.equal(n, 1); assert.equal(doc.count('visibilitychange'), 1);
  off(); doc.fire('visibilitychange'); assert.equal(n, 1); assert.equal(doc.count('visibilitychange'), 0);
  assert.ok(Object.isFrozen(v));
});

test('createDocumentVisibility sin document, o con uno incompleto: siempre visible y sin errores', () => {
  for (const d of [null, undefined, {}, { visibilityState: 'hidden' }]) {
    const v = createDocumentVisibility(d === undefined ? null : d);
    assert.doesNotThrow(() => v.onChange(() => {})()); assert.doesNotThrow(() => v.onChange('no es función')());
    assert.equal(v.hidden(), d?.visibilityState === 'hidden');
  }
  assert.equal(createDocumentVisibility().hidden(), false); // en Node no hay document
});

test('integración: cronómetro + adaptador con un documento falso', () => {
  const doc = fakeDoc(); const clock = makeClock();
  const t = createAnswerTimer({ clock, visibility: createDocumentVisibility(doc) });
  t.start(); clock.advance(1000); doc.visibilityState = 'hidden'; doc.fire('visibilitychange');
  clock.advance(8000); doc.visibilityState = 'visible'; doc.fire('visibilitychange'); clock.advance(500);
  assert.deepEqual(t.stop(), { ms: 1500, hiddenMs: 8000, interrupted: true }); assert.equal(doc.count('visibilitychange'), 0);
});
