// Reloj inyectable (subparte 0.7). Fija el TIPO de `now` para todo core/:
//   `now` es un objeto Date. Los datos guardados (due, ts, created…) son cadenas ISO UTC ("…Z").
//   El "día" de estudio (`day`, "AAAA-MM-DD") es el día LOCAL del dispositivo.
// Ninguna función de core/ llama a Date.now() por su cuenta: recibe `now` o un reloj creado aquí.

const MS_DAY = 86400000;

export function toDate(value) {
  let d;
  if (value instanceof Date) d = new Date(value.getTime());
  else if (typeof value === 'number') d = new Date(value);
  else if (typeof value === 'string' && value.trim() !== '') d = new Date(value);
  else throw new Error(`toDate: valor no válido: ${String(value)}`);
  if (Number.isNaN(d.getTime())) throw new Error(`toDate: fecha no válida: ${String(value)}`);
  return d;
}

export function toIso(value) {
  return toDate(value).toISOString();
}

const p2 = (n) => String(n).padStart(2, '0');

// Día local "AAAA-MM-DD" (el que ve la persona), no el día UTC.
export function localDay(value) {
  const d = toDate(value);
  return `${String(d.getFullYear()).padStart(4, '0')}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

export function addDays(value, n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new Error('addDays: n debe ser un número finito');
  return new Date(toDate(value).getTime() + n * MS_DAY);
}

// Reloj real, o uno basado en cualquier fuente `() => ms` (útil para pruebas).
export function createClock(source = Date.now) {
  if (typeof source !== 'function') throw new Error('createClock: la fuente debe ser una función');
  const ms = () => {
    const v = source();
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error('createClock: la fuente devolvió un valor no válido');
    return v;
  };
  return {
    now: () => new Date(ms()),
    nowMs: ms,
    iso: () => new Date(ms()).toISOString(),
    day: () => localDay(ms()),
  };
}

export const systemClock = createClock();
