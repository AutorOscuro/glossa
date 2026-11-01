// @purpose: Adaptador de vibración de la sesión (2.6-T3): único sitio que toca navigator.vibrate; protegido, nunca lanza.
// Vibración (subparte 2.6, tramo 3, punto 3).
//   createVibration({ nav? }) → { pulse(ms) → boolean }
//     pulse(ms)  pide un pulso de `ms` milisegundos (entero de 1 a 50). Devuelve true si el navegador lo aceptó; false si `ms` no vale,
//                no existe `navigator.vibrate`, lanza o lo rechaza. Síncrono; NUNCA lanza.
export function createVibration({ nav = typeof navigator === 'undefined' ? null : navigator } = {}) {
  return Object.freeze({
    pulse(ms) {
      try {
        if (!Number.isInteger(ms) || ms < 1 || ms > 50) return false;
        if (!nav || typeof nav.vibrate !== 'function') return false;
        return nav.vibrate(ms) === true;
      } catch (e) { return false; }
    },
  });
}
