// @purpose: Mensajes amables en español para cada motivo de fallo del cliente de IA; nunca incluyen la clave ni el texto de la persona.
// Mensajes del cliente de IA (1.10-T2). friendlyMessage(reason) → texto corto y claro; un motivo desconocido da el genérico.
export const AI_MESSAGES = Object.freeze({
  no_ai: 'La IA está desactivada. Sigue en modo mecánico.',
  no_key: 'Falta tu clave de IA. Pégala en Ajustes.',
  no_model: 'Falta elegir el modelo de IA en Ajustes.',
  bad_endpoint: 'La dirección del servicio de IA no es válida (debe empezar por https).',
  network: 'No hay conexión con el servicio de IA. Revisa tu internet; mientras tanto sigue en modo mecánico.',
  timeout: 'La IA tardó demasiado en responder. Prueba de nuevo o sigue en modo mecánico.',
  aborted: 'Se canceló la petición a la IA.',
  auth: 'La clave de IA no es válida o no tiene permiso. Revísala en Ajustes.',
  rate_limit: 'Se acabó el cupo de IA por ahora. Sigue en modo mecánico y prueba más tarde.',
  server: 'El servicio de IA tiene problemas ahora mismo. Prueba más tarde.',
  bad_request: 'El servicio de IA rechazó la petición. Revisa el modelo en Ajustes.',
  bad_response: 'El servicio de IA respondió algo que no se pudo leer.',
  empty: 'La IA no devolvió nada. Prueba de nuevo.',
  bad_json: 'La IA no devolvió un formato válido.',
  schema: 'La IA devolvió datos incompletos.',
  queue_full: 'Hay demasiadas peticiones de IA en espera. Prueba en un momento.',
});
const GENERIC = 'No se pudo usar la IA ahora. Sigue en modo mecánico.';

export function friendlyMessage(reason) {
  return typeof reason === 'string' && Object.hasOwn(AI_MESSAGES, reason) ? AI_MESSAGES[reason] : GENERIC;
}
