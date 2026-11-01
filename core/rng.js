// @purpose: Azar inyectable: generador determinista con semilla para pruebas y generador del sistema.
// Azar inyectable (subparte 0.7). Misma API que tests/_helpers.mjs `makeRng`:
//   next() ∈ [0,1) · int(min,max) inclusivo · pick(arr) · shuffle(arr) → copia (no muta)
// `createRng(seed)` es determinista (mulberry32); `systemRng` usa Math.random (solo para producción).

function build(next) {
  return {
    next,
    int(min, max) {
      if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) throw new Error('rng.int: rango inválido');
      return min + Math.floor(next() * (max - min + 1));
    },
    pick(arr) {
      if (!Array.isArray(arr) || arr.length === 0) throw new Error('rng.pick: se necesita un arreglo no vacío');
      return arr[Math.floor(next() * arr.length)];
    },
    shuffle(arr) {
      if (!Array.isArray(arr)) throw new Error('rng.shuffle: se necesita un arreglo');
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}

export function createRng(seed = 1) {
  if (typeof seed !== 'number' || !Number.isFinite(seed)) throw new Error('createRng: la semilla debe ser un número finito');
  let a = seed >>> 0;
  return build(() => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  });
}

export const systemRng = build(() => Math.random());
