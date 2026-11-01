// @purpose: Pruebas de la máquina de estados del ejecutor de sesión (core/sessionRunner.js, 2.1-T1): tabla, flujo, doble toque, validación, restauración y secuencias al azar.
// 2.1-T1. Los oráculos de la tabla se escriben aquí a mano (no se leen de TRANSITIONS para decidir lo esperado).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIONS, ENDINGS, MAX_ITEMS, PHASES, STATE_VERSION, TRANSITIONS, canDo, createState, progress, summarize, transition, validateState,
} from '../core/sessionRunner.js';
import { RESULTS } from '../core/eventSchema.js';
import { makeRng } from './_helpers.mjs';

// Tabla esperada, escrita a mano: fase → acciones permitidas con su fase destino (ADVANCE y START tienen destino alternativo).
const EXPECTED = {
  idle: { START: ['presenting', 'summary'] },
  presenting: { SHOWN: ['answering'], QUIT: ['summary'] },
  answering: { SUBMIT: ['feedback'], QUIT: ['summary'] },
  feedback: { CONTINUE: ['next'], QUIT: ['summary'] },
  next: { ADVANCE: ['presenting', 'summary'], QUIT: ['summary'] },
  summary: { RESET: ['idle'] },
};

const run = (state, ...actions) => actions.reduce((s, a) => transition(s, a).state, state);
const to = (phase, total = 3) => {
  let s = run(createState(), { type: 'START', total });
  if (phase === 'presenting') return s;
  s = run(s, 'SHOWN'); if (phase === 'answering') return s;
  s = run(s, { type: 'SUBMIT', result: 'correct' }); if (phase === 'feedback') return s;
  s = run(s, 'CONTINUE'); if (phase === 'next') return s;
  throw new Error(`fase ${phase}`);
};
const argsFor = (type) => (type === 'START' ? { type, total: 5 } : type === 'SUBMIT' ? { type, result: 'wrong' } : { type });

test('las constantes públicas son las del contrato', () => {
  assert.deepEqual([...PHASES], ['idle', 'presenting', 'answering', 'feedback', 'next', 'summary']);
  assert.deepEqual([...ACTIONS], ['START', 'SHOWN', 'SUBMIT', 'CONTINUE', 'ADVANCE', 'QUIT', 'RESET']);
  assert.deepEqual([...ENDINGS], ['completed', 'quit', 'empty']);
  assert.equal(MAX_ITEMS, 100);
  assert.equal(STATE_VERSION, 1);
  assert.ok(Object.isFrozen(TRANSITIONS) && Object.isFrozen(TRANSITIONS.idle));
});

test('TABLA: cada fase × cada acción permitida llega a la fase esperada; las demás se ignoran sin cambiar nada', () => {
  const phases = ['idle', 'presenting', 'answering', 'feedback', 'next', 'summary'];
  for (const phase of phases) {
    for (const type of ACTIONS) {
      const base = phase === 'idle' ? createState() : phase === 'summary' ? run(to('presenting'), 'QUIT') : to(phase);
      const out = transition(base, argsFor(type));
      const allowed = EXPECTED[phase][type];
      if (allowed) {
        assert.equal(out.changed, true, `${phase}+${type} debe cambiar`);
        assert.equal(out.ignored, null);
        assert.ok(allowed.includes(out.state.phase), `${phase}+${type} → ${out.state.phase}`);
        assert.equal(canDo(base, type), true);
      } else {
        assert.equal(out.changed, false, `${phase}+${type} debe ignorarse`);
        assert.equal(out.ignored, 'not_allowed');
        assert.equal(out.state, base, 'el estado devuelto es el mismo objeto');
        assert.equal(canDo(base, type), false);
      }
    }
  }
  // Y la tabla exportada dice exactamente lo mismo que el oráculo (nombres de acción por fase).
  for (const phase of phases) assert.deepEqual(Object.keys(TRANSITIONS[phase]).sort(), Object.keys(EXPECTED[phase]).sort());
});

test('flujo completo de 3 ítems: cada respuesta suma una y al final queda el resumen', () => {
  let s = createState();
  assert.equal(s.phase, 'idle');
  s = run(s, { type: 'START', total: 3 });
  const results = ['correct', 'wrong', 'almost'];
  for (let i = 0; i < 3; i += 1) {
    assert.equal(s.phase, 'presenting'); assert.equal(s.index, i);
    s = run(s, 'SHOWN'); assert.equal(s.phase, 'answering');
    s = run(s, { type: 'SUBMIT', result: results[i] }); assert.equal(s.phase, 'feedback'); assert.equal(s.answers.length, i + 1);
    s = run(s, 'CONTINUE'); assert.equal(s.phase, 'next');
    s = run(s, 'ADVANCE');
  }
  assert.equal(s.phase, 'summary'); assert.equal(s.ended, 'completed'); assert.equal(s.index, 2);
  assert.deepEqual(s.answers.map((a) => a.result), results);
  assert.deepEqual(summarize(s), { total: 3, answered: 3, correct: 1, almost: 1, wrong: 1, dontKnow: 0, skipped: 0, accuracy: 1 / 3, ended: 'completed' });
  s = run(s, 'RESET');
  assert.deepEqual(s, createState());
});

test('un ítem solo: el primer ADVANCE ya cierra; 100 ítems es el máximo y 101 se rechaza', () => {
  let s = run(createState(), { type: 'START', total: 1 }, 'SHOWN', { type: 'SUBMIT', result: 'correct' }, 'CONTINUE', 'ADVANCE');
  assert.equal(s.phase, 'summary'); assert.equal(s.ended, 'completed');
  assert.equal(transition(createState(), { type: 'START', total: 100 }).state.total, 100);
  assert.throws(() => transition(createState(), { type: 'START', total: 101 }), /total/);
});

test('START con 0 ítems va directo al resumen con motivo «empty»', () => {
  const out = transition(createState(), { type: 'START', total: 0 });
  assert.equal(out.state.phase, 'summary'); assert.equal(out.state.ended, 'empty');
  assert.deepEqual(summarize(out.state), { total: 0, answered: 0, correct: 0, almost: 0, wrong: 0, dontKnow: 0, skipped: 0, accuracy: null, ended: 'empty' });
});

test('DOBLE TOQUE: un segundo SUBMIT (o SHOWN, CONTINUE…) no suma una respuesta ni cambia el estado', () => {
  const fb = to('feedback');
  const again = transition(fb, { type: 'SUBMIT', result: 'wrong' });
  assert.equal(again.changed, false); assert.equal(again.state, fb); assert.equal(fb.answers.length, 1);
  assert.equal(transition(to('answering'), 'SHOWN').changed, false);
  const nx = to('next'); assert.equal(transition(nx, 'CONTINUE').state, nx);
  // La primera respuesta manda: queda «correct», no «wrong».
  assert.equal(again.state.answers[0].result, 'correct');
});

test('QUIT desde cada fase activa: conserva lo ya respondido y cierra con «quit»', () => {
  const answeredCounts = { presenting: 0, answering: 0, feedback: 1, next: 1 };
  for (const phase of ['presenting', 'answering', 'feedback', 'next']) {
    const out = transition(to(phase), 'QUIT');
    assert.equal(out.state.phase, 'summary'); assert.equal(out.state.ended, 'quit');
    assert.equal(out.state.answers.length, answeredCounts[phase], phase);
  }
  assert.equal(transition(createState(), 'QUIT').changed, false); // nada que salir
  const done = run(to('presenting'), 'QUIT');
  assert.equal(transition(done, 'QUIT').changed, false); // ya está en el resumen
});

test('los 5 resultados se aceptan y se cuentan; uno desconocido o ausente lanza', () => {
  for (const result of RESULTS) assert.equal(transition(to('answering'), { type: 'SUBMIT', result }).state.answers[0].result, result);
  const s = to('answering');
  assert.throws(() => transition(s, { type: 'SUBMIT', result: 'perfect' }), /resultado/);
  assert.throws(() => transition(s, { type: 'SUBMIT' }), /resultado/);
  assert.throws(() => transition(s, 'SUBMIT'), /resultado/);
  const sum = summarize(run(createState(), { type: 'START', total: 5 }, ...RESULTS.flatMap((result) => ['SHOWN', { type: 'SUBMIT', result }, 'CONTINUE', 'ADVANCE'])));
  assert.deepEqual([sum.correct, sum.almost, sum.wrong, sum.dontKnow, sum.skipped, sum.answered], [1, 1, 1, 1, 1, 5]);
});

test('acciones mal formadas lanzan Error en español; una acción fuera de la fase no lanza aunque le falten datos', () => {
  for (const bad of [undefined, null, 5, {}, { type: 5 }, { type: 'DANCE' }, 'start', ['START'], { type: '__proto__' }, { type: 'constructor' }]) {
    assert.throws(() => transition(createState(), bad), /Acción de sesión desconocida/, String(JSON.stringify(bad)));
  }
  for (const total of [undefined, -1, 1.5, '3', NaN, Infinity, null]) assert.throws(() => transition(createState(), { type: 'START', total }), /START: total/);
  // SUBMIT sin resultado estando en idle: no es de esa fase → se ignora (no se mira su contenido).
  assert.equal(transition(createState(), { type: 'SUBMIT' }).ignored, 'not_allowed');
});

test('validateState: acepta todos los estados que produce transition y rechaza los incoherentes', () => {
  for (const phase of ['presenting', 'answering', 'feedback', 'next']) assert.doesNotThrow(() => validateState(to(phase)));
  assert.doesNotThrow(() => validateState(createState()));
  const ok = to('feedback');
  const mutate = (patch) => ({ ...JSON.parse(JSON.stringify(ok)), ...patch });
  const cases = {
    'no objeto': 7, 'lista': [], 'versión': mutate({ v: 2 }), 'fase': mutate({ phase: 'dancing' }), 'total negativo': mutate({ total: -1 }),
    'total enorme': mutate({ total: 101 }), 'total decimal': mutate({ total: 2.5 }), 'índice fuera': mutate({ index: 3 }), 'índice negativo': mutate({ index: -1 }),
    'respuestas no lista': mutate({ answers: {} }), 'respuesta repetida': mutate({ answers: [{ index: 0, result: 'correct' }, { index: 0, result: 'wrong' }] }),
    'resultado raro': mutate({ answers: [{ index: 0, result: 'bien' }] }), 'respuesta de ítem inexistente': mutate({ answers: [{ index: 0, result: 'correct' }, { index: 9, result: 'wrong' }] }),
    'feedback sin respuesta': mutate({ answers: [] }), 'ended fuera del resumen': mutate({ ended: 'quit' }),
    'respuesta futura': mutate({ answers: [{ index: 0, result: 'correct' }, { index: 2, result: 'wrong' }] }),
    'idle con datos': { ...createState(), total: 3 }, 'resumen sin motivo': { ...createState(), phase: 'summary', total: 3, ended: null },
    'vacío con ítems': { ...createState(), phase: 'summary', total: 2, ended: 'empty' }, 'motivo raro': { ...createState(), phase: 'summary', total: 2, ended: 'solved' },
    'answering con respuesta ya dada': { ...to('answering'), answers: [{ index: 0, result: 'correct' }] },
  };
  for (const [name, bad] of Object.entries(cases)) assert.throws(() => validateState(bad), /Estado de sesión no válido/, name);
  // transition, canDo, progress y summarize también validan.
  const corrupt = mutate({ index: 99 });
  for (const fn of [() => transition(corrupt, 'SHOWN'), () => canDo(corrupt, 'SHOWN'), () => progress(corrupt), () => summarize(corrupt)]) assert.throws(fn, /Estado de sesión no válido/);
});

test('el estado es serializable y se restaura tal cual desde JSON (ida y vuelta) en cada fase', () => {
  for (const phase of ['presenting', 'answering', 'feedback', 'next']) {
    const s = to(phase);
    const back = JSON.parse(JSON.stringify(s));
    assert.doesNotThrow(() => validateState(back));
    // Un estado restaurado sigue funcionando: la siguiente transición da el mismo resultado que con el original.
    const next = { presenting: 'SHOWN', answering: { type: 'SUBMIT', result: 'wrong' }, feedback: 'CONTINUE', next: 'ADVANCE' }[phase];
    assert.deepEqual(transition(back, next).state, transition(s, next).state);
  }
});

test('inmutabilidad: el estado y sus respuestas están congelados y transition no modifica el de entrada', () => {
  const s = to('feedback');
  assert.ok(Object.isFrozen(s) && Object.isFrozen(s.answers) && Object.isFrozen(s.answers[0]));
  const before = JSON.stringify(s);
  transition(s, 'CONTINUE'); transition(s, 'QUIT');
  assert.equal(JSON.stringify(s), before);
  assert.throws(() => { 'use strict'; s.answers.push({ index: 1, result: 'wrong' }); }, TypeError);
  // Una entrada con respuestas sin congelar no queda compartida con la salida.
  const loose = JSON.parse(JSON.stringify(s));
  const out = transition(loose, 'CONTINUE').state;
  assert.ok(Object.isFrozen(out.answers));
  assert.notEqual(out.answers, loose.answers);
});

test('progress: posición, respondidas y fracción en cada fase', () => {
  assert.deepEqual(progress(createState()), { index: 0, total: 0, answered: 0, position: 0, fraction: 0 });
  assert.deepEqual(progress(to('presenting', 20)), { index: 0, total: 20, answered: 0, position: 1, fraction: 0 });
  assert.deepEqual(progress(to('feedback', 20)), { index: 0, total: 20, answered: 1, position: 1, fraction: 0.05 });
  const second = run(to('next', 4), 'ADVANCE');
  assert.deepEqual(progress(second), { index: 1, total: 4, answered: 1, position: 2, fraction: 0.25 });
  const end = run(createState(), { type: 'START', total: 1 }, 'SHOWN', { type: 'SUBMIT', result: 'correct' }, 'CONTINUE', 'ADVANCE');
  assert.deepEqual(progress(end), { index: 0, total: 1, answered: 1, position: 1, fraction: 1 });
  assert.deepEqual(progress(transition(createState(), { type: 'START', total: 0 }).state), { index: 0, total: 0, answered: 0, position: 0, fraction: 0 });
});

test('PROPIEDAD: 3.000 secuencias al azar de acciones (válidas e inválidas) nunca dejan un estado incoherente ni suman más de una respuesta por ítem', () => {
  const rng = makeRng(20261026);
  for (let n = 0; n < 3000; n += 1) {
    let s = createState();
    const total = rng.int(0, 6);
    for (let step = 0; step < 40; step += 1) {
      const type = rng.pick(ACTIONS);
      const action = type === 'START' ? { type, total } : type === 'SUBMIT' ? { type, result: rng.pick(RESULTS) } : { type };
      const before = s;
      const out = transition(s, action);
      s = out.state;
      assert.doesNotThrow(() => validateState(s));
      if (!out.changed) assert.equal(s, before);
      const idx = s.answers.map((a) => a.index);
      assert.equal(new Set(idx).size, idx.length, 'una respuesta por ítem');
      assert.ok(s.answers.length <= s.total);
      if (s.phase === 'summary') assert.ok(ENDINGS.includes(s.ended));
    }
  }
});

// ---- Huecos cerrados tras la ronda de roturas de 4.R (2.1-T1) ----
test('la tabla exportada apunta a la misma fase que el comportamiento real', () => {
  for (const [phase, acts] of Object.entries(EXPECTED)) {
    for (const [type, dests] of Object.entries(acts)) assert.equal(TRANSITIONS[phase][type], dests[0], `${phase}+${type}`);
  }
});

test('validateState: casos que solo cae una regla concreta', () => {
  const pres = to('presenting');
  const sum = (over) => ({ ...JSON.parse(JSON.stringify(run(to('presenting'), 'QUIT'))), ...over });
  const bad = {
    'fase desconocida con estado por lo demás válido': { ...pres, phase: 'dancing' },
    'índice negativo sin respuestas': { ...pres, index: -1 },
    'índice igual al total (activo)': { ...pres, index: 3 },
    'idle con motivo de cierre': { ...createState(), ended: 'quit' },
    'resumen con índice fuera': sum({ index: 5 }),
    'resumen vacío con índice 1': { ...createState(), phase: 'summary', ended: 'empty', index: 1 },
    'respuesta del ítem n = total en un resumen': sum({ ended: 'completed', index: 2, answers: [{ index: 3, result: 'wrong' }] }),
  };
  for (const [name, s] of Object.entries(bad)) assert.throws(() => validateState(s), /Estado de sesión no válido/, name);
  assert.doesNotThrow(() => validateState(transition(createState(), { type: 'START', total: 100 }).state));
});

test('canDo no confunde nombres heredados de Object con acciones', () => {
  for (const name of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) assert.equal(canDo(createState(), name), false, name);
});

test('summarize: precisión sobre lo respondido (no sobre el total) y cada contador por separado', () => {
  const s = run(createState(), { type: 'START', total: 10 },
    ...['correct', 'almost', 'almost', 'skipped', 'skipped', 'skipped', 'dont_know'].flatMap((result) => ['SHOWN', { type: 'SUBMIT', result }, 'CONTINUE', 'ADVANCE']), 'QUIT');
  assert.deepEqual(summarize(s), { total: 10, answered: 7, correct: 1, almost: 2, wrong: 0, dontKnow: 1, skipped: 3, accuracy: 1 / 7, ended: 'quit' });
  const half = run(createState(), { type: 'START', total: 5 }, 'SHOWN', { type: 'SUBMIT', result: 'correct' }, 'CONTINUE', 'ADVANCE', 'SHOWN', { type: 'SUBMIT', result: 'wrong' }, 'QUIT');
  assert.equal(summarize(half).accuracy, 0.5);
});
