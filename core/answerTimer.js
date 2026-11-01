// @purpose: Cronómetro de respuesta: mide lo que tardó la persona descontando el tiempo con la pestaña oculta (visibilidad inyectada).
// Cronómetro de respuesta (subparte 1.5, cuarto 3, mitad A). Roadmap 1.5: «tiempos > 5× o pausas (pestaña oculta) se recortan/ignoran».
// Mide cuánto tardó la persona en responder DESCONTANDO el tiempo con la pestaña oculta. Sin DOM, sin Date.now: reloj y visibilidad inyectados.
//
//   createAnswerTimer({ clock, visibility, config? }) → { start(), stop(), peek(), running() }
//     clock       { now() → Date } (core/clock.js `createClock()` o el reloj falso de las pruebas). Obligatorio.
//     visibility  { hidden() → boolean, onChange(fn) → desuscribir() }  (app/visibility.js lo crea con `document`). Sin él, siempre visible.
//   start()  empieza a medir (si ya está midiendo no hace nada: un doble toque no reinicia; tras stop() empieza una medición nueva).
//   peek()   → { ms, hiddenMs, interrupted } sin detener.   stop() → igual, y detiene (llamarlo otra vez devuelve lo mismo).
//   ms           entero ≥ 0, tiempo con la pestaña VISIBLE (tope LIMITS.msMax). Es lo que se guarda en el evento 8.6.
//   hiddenMs     tiempo con la pestaña oculta (descontado de ms).
//   interrupted  true si hiddenMs > config.interruptAfterHiddenMs, o si el reloj se movió hacia atrás o dio un valor ilegible
//                (tiempo no fiable). `rate` (core/grading.js) lo recibe y entonces ignora el tiempo: no baja ni sube el rating.
// Sin start(), peek/stop devuelven { ms: 0, hiddenMs: 0, interrupted: true } (no hay medición: el tiempo no es fiable).
import { GRADING } from './grading.config.js';
import { validateConfig } from './grading.js';
import { LIMITS } from './eventSchema.js';

const ALWAYS_VISIBLE = Object.freeze({ hidden: () => false, onChange: () => () => {} });

function readMs(clock) {
  try {
    const d = clock.now();
    const v = d instanceof Date ? d.getTime() : d;
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  } catch {
    return null; // un reloj que falla no debe romper la respuesta: el tiempo queda como no fiable
  }
}

export function createAnswerTimer({ clock, visibility = ALWAYS_VISIBLE, config = GRADING } = {}) {
  const v = validateConfig(config);
  if (!v.ok) throw new Error(`answerTimer: configuración no válida: ${v.problems.join('; ')}`);
  if (!clock || typeof clock.now !== 'function') throw new Error('answerTimer: se necesita un reloj con now()');
  if (!visibility || typeof visibility.hidden !== 'function' || typeof visibility.onChange !== 'function') {
    throw new Error('answerTimer: visibility debe tener hidden() y onChange(fn)');
  }

  let state = 'idle'; // idle | running | stopped
  let visibleMs = 0; let hiddenMs = 0; let lastMs = null; let hidden = false; let unreliable = false; let off = null; let final = null;

  const readHidden = () => { try { return visibility.hidden() === true; } catch { return false; } };

  // Cierra el tramo que va desde la última lectura hasta ahora y lo suma a visible u oculto según el estado de ese tramo.
  function advance() {
    const now = readMs(clock);
    if (now === null || lastMs === null) { unreliable = true; if (now !== null) lastMs = now; return; }
    const delta = now - lastMs;
    if (delta < 0) unreliable = true; // el reloj fue hacia atrás
    else if (hidden) hiddenMs += delta; else visibleMs += delta;
    lastMs = now;
  }

  function onVisibility() {
    if (state !== 'running') return;
    const nowHidden = readHidden();
    if (nowHidden === hidden) return; // aviso repetido
    advance();
    hidden = nowHidden;
  }

  function snapshot() {
    return {
      ms: Math.min(LIMITS.msMax, Math.max(0, Math.round(visibleMs))),
      hiddenMs: Math.max(0, Math.round(hiddenMs)),
      interrupted: unreliable || hiddenMs > config.interruptAfterHiddenMs,
    };
  }

  const timer = {
    start() {
      if (state === 'running') return;
      visibleMs = 0; hiddenMs = 0; unreliable = false; final = null;
      lastMs = readMs(clock); if (lastMs === null) unreliable = true;
      hidden = readHidden();
      state = 'running';
      try { off = visibility.onChange(onVisibility); } catch { off = null; }
    },
    peek() {
      if (state === 'idle') return { ms: 0, hiddenMs: 0, interrupted: true };
      if (state === 'stopped') return { ...final };
      advance();
      return snapshot();
    },
    stop() {
      if (state === 'idle') return { ms: 0, hiddenMs: 0, interrupted: true };
      if (state === 'running') {
        advance();
        final = snapshot();
        state = 'stopped';
        if (typeof off === 'function') { try { off(); } catch { /* desuscribir no debe fallar la respuesta */ } }
        off = null;
      }
      return { ...final };
    },
    running: () => state === 'running',
  };
  return Object.freeze(timer);
}
