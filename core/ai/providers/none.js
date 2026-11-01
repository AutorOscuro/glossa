// @purpose: Proveedor «sin IA»: nunca sale a la red y responde que no hay IA, para que la app use el modo mecánico.
// Proveedor vacío (1.10-T1). Cumple la misma interfaz que los demás: { id, available(), complete(request) }.
export function createNoneProvider() {
  return Object.freeze({
    id: 'none',
    available: () => false,
    async complete() { return { ok: false, reason: 'no_ai' }; },
  });
}
