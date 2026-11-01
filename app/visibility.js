// @purpose: Adaptador de visibilidad de la pestaña: único sitio que toca document para el cronómetro de respuesta.
// Adaptador de visibilidad de la pestaña para el cronómetro de respuesta (subparte 1.5, cuarto 3, mitad A).
// Es el ÚNICO sitio que toca `document`: core/answerTimer.js recibe esto inyectado y se prueba sin navegador.
//   createDocumentVisibility(doc?) → { hidden() → boolean, onChange(fn) → desuscribir() }
// `hidden()` es verdadero cuando la pestaña no se ve (otra pestaña, otra app, pantalla apagada). Sin `document`, siempre visible.
export function createDocumentVisibility(doc = typeof document === 'undefined' ? null : document) {
  const ok = doc && typeof doc.addEventListener === 'function' && typeof doc.removeEventListener === 'function';
  return Object.freeze({
    hidden: () => Boolean(doc) && doc.visibilityState === 'hidden',
    onChange(fn) {
      if (!ok || typeof fn !== 'function') return () => {};
      doc.addEventListener('visibilitychange', fn);
      return () => doc.removeEventListener('visibilitychange', fn);
    },
  });
}
