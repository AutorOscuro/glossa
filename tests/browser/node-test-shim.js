// Reemplazo mínimo de `node:test` para correr la suite de contrato en el navegador (subparte 0.7B). Solo el navegador lo usa.
export const registered = [];
export function test(name, a, b) {
  const fn = typeof a === 'function' ? a : b;
  const opts = typeof a === 'object' && a !== null ? a : {};
  registered.push({ name, skip: Boolean(opts.skip), fn });
}
export default test;
export async function runAll(report) {
  for (const t of registered) {
    if (t.skip) { report({ name: t.name, status: 'skip' }); continue; }
    try { await t.fn(); report({ name: t.name, status: 'pass' }); } catch (e) {
      report({ name: t.name, status: 'fail', error: String((e && e.stack) || e) });
    }
  }
}
