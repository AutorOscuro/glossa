// @purpose: Lógica pura de ordenar bloques y líneas de diálogo (2.4-T1, puntos 1 a 3 y 6): lee un ítem order_blocks u order_dialogue, lleva el estado de toques (barajar, colocar, quitar, deshacer, reiniciar) y califica; sin DOM.
// Lógica pura de `order_blocks` (subparte 2.4, tramo 1). Sin DOM, sin reloj y sin azar. Hasta ahora: LEER el ítem (punto 1), CALIFICAR (punto 2) y el ESTADO DE TOQUES (punto 3). El azar entra solo por `rng` (core/rng.js).
//
//   ORDER_LIMITS = { min: 2, max: 12, blockLength: 200, acceptLength: 600, history: 200 }   (CA 5 de 2.4: funciona con 2 y con 12 bloques)
//   readOrder(item) → { ok: true, blocks, solution, accept, shuffle } | { ok: false, reason }
//       Contrato de `data` (se documenta en docs/CONTRACTS.md al cerrar el tramo):
//         item.data.blocks   lista de 2 a 12 textos en el ORDEN CORRECTO (el componente los baraja al montar). Cada texto: cadena con texto, ≤ 200.
//         item.data.shuffle  false conserva el orden del contenido (para pruebas y ejemplos); por defecto se baraja.
//         item.accept        (opcional) frases completas que también valen: otros órdenes válidos. ≤ 600 cada una. La frase del orden correcto vale siempre.
//       Los bloques se identifican por su POSICIÓN en `data.blocks`, no por su texto: dos bloques con el mismo texto («very», «very») son distintos.
//       solution: los bloques unidos con un espacio, en el orden correcto. accept: solution primero y después las de `item.accept` sin repetir (comparando el texto exacto).
//       reason ∈ no_data | bad_blocks | bad_accept.
//   DIALOGUE_LIMITS = { min: 2, max: 8, speakerLength: 20 }   (tipo `order_dialogue`, punto 6; el texto de cada línea usa ORDER_LIMITS.blockLength)
//   readOrder(item) con item.type === 'order_dialogue' → { ok: true, blocks, solution, accept, shuffle, labels, speakers } | { ok: false, reason }
//       Contrato de `data` (ampliación compatible de la familia «ordering», aprobada por el Administrador; ficha «2.4-T1» al cerrar el tramo):
//         item.data.lines    lista de 2 a 8 objetos { speaker, text } en el ORDEN CORRECTO. speaker: texto con contenido, ≤ 20. text: texto con contenido, ≤ 200.
//         item.data.shuffle  igual que en order_blocks.   item.accept: igual que en order_blocks, escrito con el texto de cada línea SIN el hablante.
//       Los turnos seguidos del mismo hablante están permitidos. Solo texto (el audio llega en 7.x).
//       blocks: el texto de cada línea (lo que se compara, sin hablante); labels: «Hablante: texto» (lo que se muestra); speakers: el hablante de cada línea.
//       solution y accept se escriben con el texto, sin hablante: calificar, `matched` y `text` no cambian respecto a order_blocks.
//       reason ∈ no_data | bad_lines | bad_accept   (con tipo order_dialogue, data.blocks no se lee; con cualquier otro tipo, data.lines no se lee).
//   Estado de toques (funciones puras: cada una DEVUELVE un estado nuevo, congelado; no muta el anterior; una acción que no procede devuelve el MISMO objeto):
//     createOrderState(count, { rng, shuffle? }) → state = { count, tray, placed, history }
//         tray: índices de data.blocks en el orden en que se muestran SIN colocar; es fijo (los bloques no se mueven de sitio al colocarlos o quitarlos).
//         placed: índices colocados, en orden de izquierda a derecha. history: acciones para deshacer (máx. ORDER_LIMITS.history, se pierden las más antiguas).
//         shuffle (por defecto true) baraja `tray` con rng.shuffle y comprueba que sea una permutación; si queda en el orden original (con 2 o más bloques) prueba otra
//         vez hasta 10 veces y, si sigue igual, lo gira un lugar. shuffle: false deja el orden original. count: entero de 2 a 12; si no, lanza Error en español.
//     placeBlock(state, i)   coloca el bloque i al final. Solo si i está en la bandeja (un bloque no se puede colocar dos veces: sin estados imposibles).
//     removeBlock(state, i)  quita el bloque i de donde esté en `placed` (los de después se corren a la izquierda) y vuelve a su sitio de la bandeja.
//     undoLast(state)        deshace la última acción (colocar o quitar; quitar devuelve el bloque a su posición anterior). Sin historial, no hace nada.
//     resetOrder(state)      vacía `placed` y el historial; `tray` no cambia (no se vuelve a barajar).
//     bankOf(state) → los índices de `tray` que aún no están colocados, en orden de bandeja.   isComplete(state) → están todos colocados.
//   gradeOrder(item, placed) → { result, placed, text, matched, complete, empty, misplaced }      (lanza Error en español si el ítem no es válido, como gradeChoice)
//       placed     los ÍNDICES de data.blocks en el orden que puso la persona (no los textos). Lo que no es un índice válido o ya está repetido se ignora (queda
//                  la primera aparición); lo que no es lista cuenta como vacío. Nunca lanza por `placed`.
//       result     'correct' si están TODOS los bloques y el texto unido (con espacios) coincide con alguna frase de `accept` según compare (core/compare.js);
//                  'wrong' en cualquier otro caso. No hay 'almost': los bloques son texto fijo, no hay erratas que perdonar.
//       text       los bloques puestos, recortados y unidos con un espacio. matched: la frase de `accept` que coincidió, o null.
//       complete   están todos los bloques.   empty   no se puso ninguno.
//       misplaced  solo si result es 'wrong' y está completo: posiciones (desde 0) donde el bloque puesto no es el del orden correcto de data.blocks; si no, [].
import { compare } from './compare.js';

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const goodText = (v, max) => typeof v === 'string' && v.trim() !== '' && v.length <= max;

export const ORDER_LIMITS = Object.freeze({ min: 2, max: 12, blockLength: 200, acceptLength: 600, history: 200 });
export const DIALOGUE_LIMITS = Object.freeze({ min: 2, max: 8, speakerLength: 20 });

const goodLine = (x) => isPlain(x) && goodText(x.speaker, DIALOGUE_LIMITS.speakerLength) && goodText(x.text, ORDER_LIMITS.blockLength);

export function readOrder(item) {
  const d = isPlain(item) && isPlain(item.data) ? item.data : null;
  if (d === null) return { ok: false, reason: 'no_data' };
  const dialogue = item.type === 'order_dialogue';
  let b;
  let lines = null;
  if (dialogue) {
    lines = d.lines;
    if (!Array.isArray(lines) || lines.length < DIALOGUE_LIMITS.min || lines.length > DIALOGUE_LIMITS.max || !lines.every(goodLine)) return { ok: false, reason: 'bad_lines' };
    b = lines.map((x) => x.text);
  } else {
    b = d.blocks;
    if (!Array.isArray(b) || b.length < ORDER_LIMITS.min || b.length > ORDER_LIMITS.max
      || !b.every((x) => goodText(x, ORDER_LIMITS.blockLength))) return { ok: false, reason: 'bad_blocks' };
  }
  const extra = item.accept;
  if (extra !== undefined && extra !== null
    && (!Array.isArray(extra) || !extra.every((x) => goodText(x, ORDER_LIMITS.acceptLength)))) return { ok: false, reason: 'bad_accept' };
  const solution = b.map((x) => x.trim()).join(' ');
  const accept = [solution];
  for (const x of Array.isArray(extra) ? extra : []) if (!accept.includes(x)) accept.push(x);
  const out = { ok: true, blocks: [...b], solution, accept, shuffle: d.shuffle !== false };
  if (dialogue) {
    out.labels = lines.map((x) => `${x.speaker.trim()}: ${x.text.trim()}`);
    out.speakers = lines.map((x) => x.speaker.trim());
  }
  return out;
}

export function gradeOrder(item, placed) {
  const r = readOrder(item);
  if (!r.ok) throw new Error(`gradeOrder: el ítem de ordenar no es válido (${r.reason})`);
  const n = r.blocks.length;
  const chosen = [];
  for (const i of Array.isArray(placed) ? placed : []) if (Number.isInteger(i) && i >= 0 && i < n && !chosen.includes(i)) chosen.push(i);
  const complete = chosen.length === n;
  const text = chosen.map((i) => r.blocks[i].trim()).join(' ');
  const cmp = complete ? compare(text, r.accept) : null;
  const right = cmp !== null && cmp.result === 'correct';
  return {
    result: right ? 'correct' : 'wrong',
    placed: chosen,
    text,
    matched: right ? cmp.matched : null,
    complete,
    empty: chosen.length === 0,
    misplaced: complete && !right ? chosen.map((b, pos) => (b === pos ? -1 : pos)).filter((pos) => pos >= 0) : [],
  };
}

// ---- estado de toques (punto 3) ----
const freezeState = (count, tray, placed, history) => Object.freeze({
  count, tray: Object.freeze([...tray]), placed: Object.freeze([...placed]), history: Object.freeze(history.map((h) => Object.freeze({ ...h }))),
});
const inRange = (state, i) => Number.isInteger(i) && i >= 0 && i < state.count;
const pushHistory = (history, entry) => [...history, entry].slice(-ORDER_LIMITS.history);

// `max` (opcional, solo para construir con piezas de 2.4-T3: hasta 12 piezas + 4 de más = 16) sube el tope de `count`; un valor que no sea entero de 12 a 32 se ignora.
export const STATE_MAX_CEILING = 32;
export function createOrderState(count, { rng, shuffle = true, max } = {}) {
  const cap = Number.isInteger(max) && max >= ORDER_LIMITS.max && max <= STATE_MAX_CEILING ? max : ORDER_LIMITS.max;
  if (!Number.isInteger(count) || count < ORDER_LIMITS.min || count > cap) {
    throw new Error(`createOrderState: el número de bloques debe ser un entero de ${ORDER_LIMITS.min} a ${cap}`);
  }
  const base = Array.from({ length: count }, (_, i) => i);
  let tray = base;
  if (shuffle !== false) {
    if (!isPlain(rng) || typeof rng.shuffle !== 'function') throw new Error('createOrderState: falta un rng con shuffle (core/rng.js)');
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const out = rng.shuffle(base);
      const isPermutation = Array.isArray(out) && out.length === count && [...out].sort((a, b) => a - b).every((v, k) => v === k);
      if (!isPermutation) throw new Error('createOrderState: el rng no devolvió una permutación de los bloques');
      tray = out;
      if (tray.some((v, k) => v !== k)) break;
    }
    if (tray.every((v, k) => v === k)) tray = [...base.slice(1), base[0]];
  }
  return freezeState(count, tray, [], []);
}

export function bankOf(state) { return state.tray.filter((i) => !state.placed.includes(i)); }
export function isComplete(state) { return state.placed.length === state.count; }

export function placeBlock(state, i) {
  if (!inRange(state, i) || state.placed.includes(i)) return state;
  return freezeState(state.count, state.tray, [...state.placed, i], pushHistory(state.history, { type: 'place', block: i }));
}

export function removeBlock(state, i) {
  const pos = state.placed.indexOf(i); // `placed` solo tiene índices válidos: lo hostil da -1
  if (pos < 0) return state;
  return freezeState(state.count, state.tray, state.placed.filter((x) => x !== i), pushHistory(state.history, { type: 'remove', block: i, pos }));
}

export function undoLast(state) {
  const last = state.history[state.history.length - 1];
  if (last === undefined) return state;
  const rest = state.history.slice(0, -1);
  if (last.type === 'place') return freezeState(state.count, state.tray, state.placed.filter((x) => x !== last.block), rest);
  const placed = state.placed.filter((x) => x !== last.block);
  placed.splice(last.pos, 0, last.block);
  return freezeState(state.count, state.tray, placed, rest);
}

export function resetOrder(state) {
  if (state.placed.length === 0 && state.history.length === 0) return state;
  return freezeState(state.count, state.tray, [], []);
}
