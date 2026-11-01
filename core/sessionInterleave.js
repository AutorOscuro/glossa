// @purpose: Intercalado del armador de sesiones (T3): reordena un plan para que no haya más de 2 ítems seguidos del mismo tema ni del mismo tipo de ejercicio, cambiando lo mínimo y de forma determinista.
// Intercalado y variedad (subparte 1.8, tramo 3). Roadmap 1.8 regla 3 y 4. Función PURA, sin azar: el resultado depende solo del orden de entrada.
//   interleave(items, { maxRun = 2, windows = [6, Infinity], budget = 50000 }) → { items, moved, window, maxRun, violations: { topic, type } }
//     items[i]  { topic: string|null, exerciseType: string|null, … }. Un `topic` o `exerciseType` nulo no cuenta como repetido con nada.
//     Se busca (primero en profundidad, con poda) el orden más parecido al de entrada que cumpla «nunca más de maxRun seguidos» en tema Y en tipo.
//     Cada paso mira solo los primeros `window` pendientes (6, y si no hay solución, todos); entre los válidos prefiere el que no repite tipo con el
//     último ítem de su mismo tema (variedad de formato) y después el más temprano, así que la urgencia casi no se altera.
//     «Si hay opciones»: si no existe ningún orden con maxRun, se sube el máximo seguido al menor valor posible (nunca se pierden ni se duplican ítems).
//     `violations` cuenta los ítems que exceden 2 seguidos en el orden FINAL (0 si había solución); `window` = ventana usada (0 si no se pudo reordenar).
//     `budget` limita los nodos explorados; si se agota, se devuelve el orden de entrada.
const keyOf = (v) => (typeof v === 'string' && v !== '' ? v : null);

function counts(keys) {
  const m = new Map();
  for (const k of keys) if (k !== null) m.set(k, (m.get(k) ?? 0) + 1);
  return m;
}

// Menor máximo de seguidos que permite alguna disposición, mirando solo esa dimensión: ceil(r / (n − r + 1)) para el grupo más grande.
function minRun(keys) {
  const n = keys.length;
  let m = 1;
  for (const r of counts(keys).values()) m = Math.max(m, Math.ceil(r / (n - r + 1)));
  return m;
}

// Ítems que exceden `limit` seguidos (una racha de 4 con límite 2 aporta 2).
export function runExcess(keys, limit = 2) {
  let excess = 0;
  let run = 0;
  let prev = null;
  for (const k of keys) {
    run = k !== null && k === prev ? run + 1 : k === null ? 0 : 1;
    prev = k;
    if (run > limit) excess += 1;
  }
  return excess;
}

export function interleave(items, opts = {}) {
  if (!Array.isArray(items)) throw new Error('interleave: items debe ser una lista');
  const maxRun = opts.maxRun ?? 2;
  const windows = opts.windows ?? [6, Infinity];
  if (!Number.isInteger(maxRun) || maxRun < 1) throw new Error('interleave: maxRun debe ser un entero ≥ 1');
  let budget = opts.budget ?? 50000;
  const n = items.length;
  const topic = items.map((i) => keyOf(i?.topic));
  const type = items.map((i) => keyOf(i?.exerciseType));

  const finish = (order, m, window) => {
    const out = order.map((i) => items[i]);
    const tk = out.map((i) => keyOf(i?.topic));
    const yk = out.map((i) => keyOf(i?.exerciseType));
    return { items: out, moved: out.filter((x, p) => x !== items[p]).length, window, maxRun: m, violations: { topic: runExcess(tk, 2), type: runExcess(yk, 2) } };
  };
  const identity = [...items.keys()];
  if (n <= 1) return finish(identity, maxRun, 0);

  function search(m, w) {
    const remaining = [...identity];
    const tc = counts(topic);
    const yc = counts(type);
    const lastTypeOf = new Map();
    const placed = [];
    const feasible = (nRem, lt, rt, ly, ry) => {
      for (const [k, r] of tc) if (r > 0 && r > (lt === k ? m - rt : m) + m * (nRem - r)) return false;
      for (const [k, r] of yc) if (r > 0 && r > (ly === k ? m - ry : m) + m * (nRem - r)) return false;
      return true;
    };
    const go = (lt, rt, ly, ry) => {
      if (remaining.length === 0) return true;
      if (budget <= 0) return false;
      budget -= 1;
      if (!feasible(remaining.length, lt, rt, ly, ry)) return false;
      const cand = [];
      for (let p = 0, lim = Math.min(w, remaining.length); p < lim; p += 1) {
        const i = remaining[p];
        if (topic[i] !== null && topic[i] === lt && rt >= m) continue;
        if (type[i] !== null && type[i] === ly && ry >= m) continue;
        cand.push({ p, i, pen: topic[i] !== null && type[i] !== null && lastTypeOf.get(topic[i]) === type[i] ? 1 : 0 });
      }
      cand.sort((a, b) => a.pen - b.pen || a.p - b.p);
      for (const { p, i } of cand) {
        const t = topic[i];
        const y = type[i];
        remaining.splice(p, 1);
        placed.push(i);
        if (t !== null) tc.set(t, tc.get(t) - 1);
        if (y !== null) yc.set(y, yc.get(y) - 1);
        const prevLast = t !== null && y !== null ? lastTypeOf.get(t) : undefined;
        if (t !== null && y !== null) lastTypeOf.set(t, y);
        const ok = go(t, t === null ? 0 : t === lt ? rt + 1 : 1, y, y === null ? 0 : y === ly ? ry + 1 : 1);
        if (ok) return true;
        if (t !== null && y !== null) { if (prevLast === undefined) lastTypeOf.delete(t); else lastTypeOf.set(t, prevLast); }
        if (t !== null) tc.set(t, tc.get(t) + 1);
        if (y !== null) yc.set(y, yc.get(y) + 1);
        placed.pop();
        remaining.splice(p, 0, i);
        if (budget <= 0) return false;
      }
      return false;
    };
    return go(null, 0, null, 0) ? placed : null;
  }

  for (let m = Math.max(maxRun, minRun(topic), minRun(type)); m <= n; m += 1) {
    for (const w of windows) {
      const order = search(m, w);
      if (order) return finish(order, m, w);
      if (budget <= 0) return finish(identity, null, 0);
    }
  }
  return finish(identity, null, 0);
}
