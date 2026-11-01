// @purpose: Store en memoria con suscripciones: estado único, sin disco ni DOM.
// Estado en memoria con suscripciones (subparte 0.7). Un único store por tema, con funciones explícitas (roadmap 4.2.2).
// No guarda nada en disco: lo persistente vive en core/db.js. Sin DOM, sin temporizadores.
//
//   const s = createStore({ tema: 'aurora', cargando: false });
//   s.get()                      → estado actual (objeto CONGELADO; no se puede mutar por accidente)
//   s.set({ cargando: true })    → mezcla superficial; avisa solo si algo cambió de verdad (Object.is por campo)
//   s.set((prev) => ({ … }))     → igual, calculando desde el estado previo
//   s.subscribe(fn)              → fn(state, prev) en cada cambio; devuelve `unsubscribe` (idempotente)
//   s.subscribe(fn, { select })  → fn(valor, valorPrevio, state) solo cuando select(state) cambia
//   s.reset()                    → vuelve al estado inicial (avisa si era distinto)
// Un suscriptor que lanza NO impide que se avise a los demás (el error va a `onError`, por defecto console.error).
// Si un suscriptor llama a set() dentro de su aviso, el cambio se aplica al terminar el aviso en curso (sin recursión infinita).

function freezeCopy(o) { return Object.freeze({ ...o }); }

export function createStore(initial = {}, { onError } = {}) {
  if (initial === null || typeof initial !== 'object' || Array.isArray(initial)) throw new Error('createStore: el estado inicial debe ser un objeto');
  const first = freezeCopy(initial);
  const report = onError ?? ((e) => console.error('store: un suscriptor falló', e));
  let state = first;
  const subs = new Set();
  const queue = [];
  let flushing = false;

  const changed = (a, b) => {
    const ka = Object.keys(a);
    if (ka.length !== Object.keys(b).length) return true;
    return ka.some((k) => !Object.prototype.hasOwnProperty.call(b, k) || !Object.is(a[k], b[k]));
  };

  function notify(next, prev) {
    for (const sub of [...subs]) {
      if (!subs.has(sub)) continue; // se dio de baja durante este aviso
      try {
        if (sub.select) {
          const nv = sub.select(next);
          if (!Object.is(nv, sub.last)) { const pv = sub.last; sub.last = nv; sub.fn(nv, pv, next); }
        } else sub.fn(next, prev);
      } catch (e) { report(e); }
    }
  }

  function apply(next) {
    if (!changed(state, next)) return false;
    const prev = state;
    state = next;
    queue.push([next, prev]);
    if (!flushing) {
      flushing = true;
      try { while (queue.length) { const [n, p] = queue.shift(); notify(n, p); } } finally { flushing = false; }
    }
    return true;
  }

  return {
    get: () => state,
    set(patch) {
      const p = typeof patch === 'function' ? patch(state) : patch;
      if (p === null || typeof p !== 'object' || Array.isArray(p)) throw new Error('store.set: el cambio debe ser un objeto');
      return apply(freezeCopy({ ...state, ...p }));
    },
    reset() { return apply(first); },
    subscribe(fn, { select } = {}) {
      if (typeof fn !== 'function') throw new Error('store.subscribe: se necesita una función');
      if (select !== undefined && typeof select !== 'function') throw new Error('store.subscribe: select debe ser una función');
      const sub = { fn, select, last: select ? select(state) : undefined };
      subs.add(sub);
      return () => { subs.delete(sub); };
    },
    subscriberCount: () => subs.size,
  };
}
