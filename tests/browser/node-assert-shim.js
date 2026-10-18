// Reemplazo mínimo de `node:assert/strict` para el navegador (subparte 0.7B). Solo las funciones que usa la suite de contrato.
class AssertionError extends Error { constructor(m) { super(m); this.name = 'AssertionError'; } }
const show = (v) => { try { return JSON.stringify(v); } catch { return String(v); } };
function deepEq(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  if (a instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof Map) return a.size === b.size && [...a].every(([k, v]) => b.has(k) && deepEq(v, b.get(k)));
  if (a instanceof Set) return a.size === b.size && [...a].every((v) => b.has(v));
  const ka = Reflect.ownKeys(a);
  const kb = Reflect.ownKeys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEq(a[k], b[k]));
}
const fail = (m, d) => { throw new AssertionError(m || d); };
const assert = {
  AssertionError,
  ok: (v, m) => { if (!v) fail(m, `no es verdadero: ${show(v)}`); },
  equal: (a, b, m) => { if (!Object.is(a, b)) fail(m, `${show(a)} !== ${show(b)}`); },
  notEqual: (a, b, m) => { if (Object.is(a, b)) fail(m, `${show(a)} === ${show(b)}`); },
  deepEqual: (a, b, m) => { if (!deepEq(a, b)) fail(m, `${show(a)} no es igual a ${show(b)}`); },
  doesNotThrow: (fn, m) => { try { fn(); } catch (e) { fail(m, `lanzó: ${e && e.message}`); } },
  async rejects(p, check, m) {
    let err; let threw = false;
    try { await (typeof p === 'function' ? p() : p); } catch (e) { err = e; threw = true; }
    if (!threw) fail(m, 'se esperaba un rechazo y no hubo');
    if (typeof check === 'function') {
      const r = check(err);
      if (r !== true) fail(m, `el validador no aceptó el error: ${err && err.name}: ${err && err.message} (devolvió ${show(r)})`);
    }
  },
};
export default assert;
