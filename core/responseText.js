// @purpose: toResponseRaw: UNA función para armar el responseRaw de un ejercicio (cambia por espacio los controles que el evento rechaza y recorta al máximo).
// Puro (sin DOM ni almacenamiento). TRAMPA-32: todo responseRaw de un ejercicio pasa por aquí.

// Mismos caracteres que rechaza `core/eventSchema.js` (CONTROL_RE): tab (09), salto de línea (0A) y retorno (0D) SÍ valen.
// La prueba tests/responseText.test.mjs barre 0–0x9F contra validateEvent para que las dos listas no se separen.
export const EVENT_CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

// Tope de `responseRaw` en el evento (core/eventSchema.js, LIMITS.responseRaw).
export const RESPONSE_RAW_MAX = 2000;

/** Texto del ejercicio → responseRaw válido: cada carácter de control rechazado pasa a un espacio (1 a 1) y luego se recorta a `max`. Lo que no es texto da ''. */
export function toResponseRaw(text, max = RESPONSE_RAW_MAX) {
  if (typeof text !== 'string') return '';
  const limit = Number.isInteger(max) && max >= 0 ? max : RESPONSE_RAW_MAX;
  return text.replace(EVENT_CONTROL, ' ').slice(0, limit);
}
