// @purpose: Máquina de estados pura del ejecutor de sesión: fases, tabla de transiciones, avance por ítem, validación del estado y resumen; sin DOM, base ni reloj.
// Ejecutor de sesión (subparte 2.1, tramo 1). Roadmap 2.1 y 17. Función PURA: no lee la base, el reloj ni el azar.
// La persistencia atómica y la restauración llegan en 2.1-T2; aquí solo vive la tabla de transiciones y el estado, que ya es serializable.
//
//   Fases:  idle → presenting → answering → feedback → next → (presenting | summary)
//   createState() → estado inicial (idle).
//   transition(state, action) → { state, changed, ignored }
//     action = 'TIPO' o { type: 'TIPO', ...datos }. Tipos y destino (TRANSITIONS):
//       START    { total }    idle → presenting (ítem 0). total 0 → summary con ended 'empty'. total entero 0–100.
//       SHOWN                 presenting → answering   (el ítem ya está en pantalla)
//       SUBMIT   { result }   answering → feedback     (registra UNA respuesta: correct | almost | wrong | skipped | dont_know)
//       CONTINUE              feedback → next
//       ADVANCE               next → presenting (ítem siguiente) o, si era el último, → summary con ended 'completed'
//       QUIT                  cualquier fase salvo idle y summary → summary con ended 'quit' (lo ya respondido se conserva)
//       RESET                 summary → idle
//     Una acción válida pero no permitida en la fase actual (p. ej. un segundo SUBMIT por doble toque) NO cambia nada:
//       devuelve el MISMO objeto `state`, changed false e ignored 'not_allowed'. Un tipo desconocido o datos mal formados LANZAN Error en español.
//   validateState(state) → state | lanza Error: comprueba todas las reglas de coherencia (sirve para restaurar un estado guardado en 2.1-T2).
//   progress(state) → { index, total, answered, position, fraction } para la barra X/N (position = ítem actual de 1 a total; fraction = answered / total).
//   summarize(state) → { total, answered, correct, almost, wrong, dontKnow, skipped, accuracy, ended } (accuracy = correct / answered, o null sin respuestas).
//   canDo(state, type) → boolean.
// Estado: { v: 1, phase, index, total, answers: [{ index, result }], ended } congelado en profundidad.
import { RESULTS } from './eventSchema.js';

export const STATE_VERSION = 1;
export const MAX_ITEMS = 100;
export const PHASES = Object.freeze(['idle', 'presenting', 'answering', 'feedback', 'next', 'summary']);
export const ACTIONS = Object.freeze(['START', 'SHOWN', 'SUBMIT', 'CONTINUE', 'ADVANCE', 'QUIT', 'RESET']);
export const ENDINGS = Object.freeze(['completed', 'quit', 'empty']);

// Tabla de transiciones: fase → { acción: fase destino }. ADVANCE y START tienen un destino alternativo que decide el estado (ver transition).
export const TRANSITIONS = Object.freeze({
  idle: Object.freeze({ START: 'presenting' }),
  presenting: Object.freeze({ SHOWN: 'answering', QUIT: 'summary' }),
  answering: Object.freeze({ SUBMIT: 'feedback', QUIT: 'summary' }),
  feedback: Object.freeze({ CONTINUE: 'next', QUIT: 'summary' }),
  next: Object.freeze({ ADVANCE: 'presenting', QUIT: 'summary' }),
  summary: Object.freeze({ RESET: 'idle' }),
});

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const freezeState = (s) => Object.freeze({ ...s, answers: Object.freeze(s.answers.map((a) => Object.freeze({ index: a.index, result: a.result }))) });

export function createState() {
  return freezeState({ v: STATE_VERSION, phase: 'idle', index: 0, total: 0, answers: [], ended: null });
}

export function validateState(state) {
  const bad = (why) => { throw new Error(`Estado de sesión no válido: ${why}`); };
  if (!isObj(state)) bad('no es un objeto');
  if (state.v !== STATE_VERSION) bad('versión desconocida');
  if (!PHASES.includes(state.phase)) bad('fase desconocida');
  if (!Number.isInteger(state.total) || state.total < 0 || state.total > MAX_ITEMS) bad('total fuera de rango');
  if (!Number.isInteger(state.index) || state.index < 0) bad('índice fuera de rango');
  if (!Array.isArray(state.answers)) bad('las respuestas no son una lista');
  let last = -1;
  for (const a of state.answers) {
    if (!isObj(a) || !Number.isInteger(a.index) || !RESULTS.includes(a.result)) bad('respuesta mal formada');
    if (a.index <= last) bad('respuestas repetidas o desordenadas');
    if (a.index >= state.total) bad('respuesta de un ítem que no existe');
    last = a.index;
  }
  const { phase, index, total, answers, ended } = state;
  const hasCurrent = answers.some((a) => a.index === index);
  if (phase === 'idle') {
    if (total !== 0 || index !== 0 || answers.length || ended !== null) bad('idle debe estar vacío');
  } else if (phase === 'summary') {
    if (!ENDINGS.includes(ended)) bad('el resumen necesita un motivo de cierre');
    if (ended === 'empty' && (total !== 0 || answers.length)) bad('una sesión vacía no tiene ítems');
    if (total === 0 ? index !== 0 : index >= total) bad('índice fuera de rango');
  } else {
    if (ended !== null) bad('solo el resumen lleva motivo de cierre');
    if (total < 1 || index >= total) bad('índice fuera de rango');
    if (phase === 'feedback' || phase === 'next') { if (!hasCurrent) bad('falta la respuesta del ítem actual'); }
    else if (hasCurrent) bad('el ítem actual ya está respondido');
    if (answers.some((a) => a.index > index)) bad('respuesta de un ítem futuro');
  }
  return state;
}

export function canDo(state, type) {
  validateState(state);
  return Object.hasOwn(TRANSITIONS[state.phase], type);
}

function readAction(action) {
  const a = typeof action === 'string' ? { type: action } : action;
  if (!isObj(a) || typeof a.type !== 'string' || !ACTIONS.includes(a.type)) throw new Error('Acción de sesión desconocida');
  return a;
}

export function transition(state, action) {
  validateState(state);
  const a = readAction(action);
  if (!Object.hasOwn(TRANSITIONS[state.phase], a.type)) return { state, changed: false, ignored: 'not_allowed' };
  const next = (patch) => ({ state: freezeState({ ...state, ...patch }), changed: true, ignored: null });
  switch (a.type) {
    case 'START': {
      if (!Number.isInteger(a.total) || a.total < 0 || a.total > MAX_ITEMS) throw new Error(`START: total debe ser un entero de 0 a ${MAX_ITEMS}`);
      if (a.total === 0) return next({ phase: 'summary', total: 0, index: 0, answers: [], ended: 'empty' });
      return next({ phase: 'presenting', total: a.total, index: 0, answers: [], ended: null });
    }
    case 'SHOWN': return next({ phase: 'answering' });
    case 'SUBMIT': {
      if (!RESULTS.includes(a.result)) throw new Error('SUBMIT: el resultado no es válido');
      return next({ phase: 'feedback', answers: [...state.answers, { index: state.index, result: a.result }] });
    }
    case 'CONTINUE': return next({ phase: 'next' });
    case 'ADVANCE':
      return state.index + 1 < state.total ? next({ phase: 'presenting', index: state.index + 1 }) : next({ phase: 'summary', ended: 'completed' });
    case 'QUIT': return next({ phase: 'summary', ended: 'quit' });
    default: return next({ ...createState() }); // RESET
  }
}

export function progress(state) {
  validateState(state);
  const answered = state.answers.length;
  const position = state.total === 0 ? 0 : Math.min(state.index + 1, state.total);
  return { index: state.index, total: state.total, answered, position, fraction: state.total === 0 ? 0 : answered / state.total };
}

export function summarize(state) {
  validateState(state);
  const count = (r) => state.answers.filter((a) => a.result === r).length;
  const answered = state.answers.length;
  return {
    total: state.total, answered, correct: count('correct'), almost: count('almost'), wrong: count('wrong'),
    dontKnow: count('dont_know'), skipped: count('skipped'), accuracy: answered === 0 ? null : count('correct') / answered, ended: state.ended,
  };
}
