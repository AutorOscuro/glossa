// @purpose: Decide la reacción de la sesión a un resultado (2.6-T3): estado de la mascota Chispa; pura, sin DOM ni ajustes.
// Reacciones al resultado de una respuesta (subparte 2.6, tramo 3). Decisión del Administrador, docs/CONTRACTS.md sección «2.6».
//
//   mascotStateFor(result) → 'happy' | 'thinking' | 'neutral'
//     'correct' → 'happy' · 'wrong' y 'dont_know' (también 'dont') → 'thinking' · cualquier otro valor («almost», «skipped», raros) → 'neutral'.
//   Nunca lanza. «Pensando» no es castigo: es la cara tranquila de «vamos a mirarlo».
//   soundFor(result, enabled) → 'correct' | null     Solo acertar suena; fallar, «No sé» y lo demás: null (silencio). `enabled` debe ser `true` (el ajuste `sounds`).
//   soundForFinish(enabled)   → 'finish' | null      El tono de cierre de sesión.
//   TONES[name]               → [{ freq, at, dur, gain }]  notas suaves (seno) que toca app/soundEngine.js; sin archivos de audio.
//   vibrationFor(result, enabled) → 10 | 0          Un pulso corto (ms) solo al acertar y con el ajuste `vibration` en `true`; fallar, «No sé» y lo demás: 0 (nada).
export const MASCOT_FOR = Object.freeze({ correct: 'happy', wrong: 'thinking', dont_know: 'thinking', dont: 'thinking' });

export function mascotStateFor(result) {
  return typeof result === 'string' && Object.prototype.hasOwnProperty.call(MASCOT_FOR, result) ? MASCOT_FOR[result] : 'neutral';
}

// Notas en Hz; `at` y `dur` en segundos desde el inicio; `gain` bajo a propósito (suave, nunca estridente).
export const TONES = Object.freeze({
  correct: Object.freeze([Object.freeze({ freq: 659.25, at: 0, dur: 0.14, gain: 0.08 }), Object.freeze({ freq: 880, at: 0.1, dur: 0.18, gain: 0.08 })]),
  finish: Object.freeze([
    Object.freeze({ freq: 523.25, at: 0, dur: 0.16, gain: 0.08 }),
    Object.freeze({ freq: 659.25, at: 0.14, dur: 0.16, gain: 0.08 }),
    Object.freeze({ freq: 783.99, at: 0.28, dur: 0.3, gain: 0.08 }),
  ]),
});

export function soundFor(result, enabled) {
  return enabled === true && result === 'correct' ? 'correct' : null;
}

export function soundForFinish(enabled) {
  return enabled === true ? 'finish' : null;
}

export const PULSE_MS = 10;

export function vibrationFor(result, enabled) {
  return enabled === true && result === 'correct' ? PULSE_MS : 0;
}
