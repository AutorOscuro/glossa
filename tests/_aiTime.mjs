// @purpose: Ayudante de pruebas de la IA: reloj y temporizadores falsos que avanzan a mano, sin esperas reales.
// fakeTime() → { timers, clock, advance(ms), pending(), flush() }. Los temporizadores se disparan en orden de hora; advance deja correr los microtareas entre uno y otro.
export const flush = async (n = 6) => { for (let i = 0; i < n; i += 1) await new Promise((r) => setImmediate(r)); };

export function fakeTime() {
  let now = 0;
  let id = 0;
  const q = [];
  const timers = {
    setTimeout(f, ms) { id += 1; q.push({ id, at: now + ms, f }); return id; },
    clearTimeout(h) { const i = q.findIndex((x) => x.id === h); if (i >= 0) q.splice(i, 1); },
  };
  const clock = { nowMs: () => now };
  async function advance(ms) {
    const end = now + ms;
    for (;;) {
      await flush();
      q.sort((a, b) => a.at - b.at || a.id - b.id);
      const next = q[0];
      if (!next || next.at > end) break;
      q.shift();
      now = next.at;
      next.f();
    }
    now = end;
    await flush();
  }
  return { timers, clock, advance, pending: () => q.length, flush };
}
