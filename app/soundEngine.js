// @purpose: Motor de sonido de la sesión (2.6-T3): toca los tonos suaves de core/feedbackCues.js con Web Audio, sin archivos y sin lanzar nunca.
// Motor de sonido (subparte 2.6, tramo 3, punto 1). Único sitio que toca AudioContext.
//
//   createSoundEngine({ win? }) → { unlock() → boolean, play(name) → boolean, destroy() }
//     unlock()  crea el AudioContext. Llamar dentro de un gesto de la persona (toque o tecla); varias llamadas son inocuas.
//     play(n)   toca el tono `n` de TONES. Devuelve false (en silencio) si no hay Web Audio, el contexto no se pudo crear o `n` no existe.
//               Es síncrono, no espera nada y NUNCA lanza: «Continuar» no depende de él.
//     destroy() cierra el contexto; después play() devuelve false.
//   Si el contexto quedó suspendido (la política del navegador) intenta reanudarlo; si no se deja, no suena y no pasa nada.
import { TONES } from '../core/feedbackCues.js';

export function createSoundEngine({ win = globalThis } = {}) {
  let ctx = null;
  let dead = false;

  function ensure() {
    if (dead) return null;
    if (ctx) return ctx;
    try {
      const Ctor = win?.AudioContext ?? win?.webkitAudioContext;
      if (typeof Ctor !== 'function') return null;
      ctx = new Ctor();
    } catch (e) { ctx = null; }
    return ctx;
  }
  const resume = (c) => {
    try {
      if (c.state === 'suspended' && typeof c.resume === 'function') {
        const p = c.resume();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
    } catch (e) { /* sin permiso: en silencio */ }
  };

  return Object.freeze({
    unlock() {
      const c = ensure();
      if (!c) return false;
      resume(c);
      return true;
    },
    play(name) {
      try {
        const notes = typeof name === 'string' && Object.prototype.hasOwnProperty.call(TONES, name) ? TONES[name] : null;
        const c = notes ? ensure() : null;
        if (!c) return false;
        resume(c);
        const t0 = c.currentTime;
        for (const n of notes) {
          const osc = c.createOscillator();
          const gain = c.createGain();
          osc.type = 'sine';
          osc.frequency.value = n.freq;
          const start = t0 + n.at;
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.linearRampToValueAtTime(n.gain, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + n.dur);
          osc.connect(gain);
          gain.connect(c.destination);
          osc.start(start);
          osc.stop(start + n.dur + 0.05);
        }
        return true;
      } catch (e) { return false; }
    },
    destroy() {
      dead = true;
      try { const c = ctx; ctx = null; const p = c?.close?.(); if (p && typeof p.catch === 'function') p.catch(() => {}); } catch (e) { /* ya cerrado */ }
    },
  });
}
