// @purpose: Lógica pura de construir con piezas (2.4-T3, puntos 1 y 2): lee un ítem unscramble_letters o build_from_keywords (piezas y piezas de más), lleva el estado de toques y lo califica; sin DOM ni reloj.
// Lógica pura de `unscramble_letters` y `build_from_keywords` (subparte 2.4, tramo 3). Punto 1: LEER y CALIFICAR. Punto 2: ESTADO DE TOQUES (abajo del todo). El azar entra solo por `rng` (core/rng.js).
//
//   BUILD_LIMITS = { min: 2, max: 12, extraMax: 4, pieceLength: 120, acceptLength: 600 }   (mismas cotas que `data.pieces`, `data.extra_pieces` y `accept` en core/contentData.js)
//   readBuild(item) → { ok: true, pieces, extras, all, solution, accept, joiner, shuffle } | { ok: false, reason }
//       Contrato de `data` (sin cambios: es el de la familia «ordering» de 1.3, ficha «1.3-2A»):
//         item.data.pieces        2 a 12 textos en el orden CORRECTO (la app los baraja). Cada uno con contenido y ≤ 120.
//         item.data.extra_pieces  (opcional) hasta 4 piezas de más que NO van en la respuesta (distractores).
//         item.data.shuffle       false conserva el orden del contenido (pruebas y ejemplos); por defecto se baraja.
//         item.accept             (opcional) respuestas completas que también valen (otros órdenes o frases válidas). ≤ 600 cada una.
//       unscramble_letters une las piezas SIN espacio (letras o sílabas: «c»,«a»,«t» → «cat»); build_from_keywords las une con UN espacio.
//       Las piezas se identifican por su POSICIÓN, no por su texto: dos piezas «a» son distintas. Los índices 0..pieces.length-1 son las de la
//       respuesta; los siguientes (pieces.length..all.length-1) son las `extra_pieces`. `all` = pieces + extras (hasta 16).
//       solution: las piezas unidas en el orden correcto. accept: solution primero y después las de `item.accept` sin repetir (texto exacto).
//       reason ∈ no_data | bad_type | bad_pieces | bad_extra | bad_accept.
//   gradeBuild(item, placed) → { result, placed, text, matched, complete, empty, usedExtra, misplaced }   (lanza Error en español si el ítem no es válido)
//       placed     los ÍNDICES de `all` en el orden en que la persona los puso. Lo que no es un índice válido o ya está repetido se ignora (queda la
//                  primera aparición); lo que no es lista cuenta como vacío. Nunca lanza por `placed`.
//       result     'correct' si el texto unido coincide con alguna frase de `accept` según compare (core/compare.js) con result 'correct'; 'wrong' en
//                  cualquier otro caso. NUNCA 'almost': una letra o una pieza mal puesta no es una errata que perdonar (como en gradeOrder).
//       text       las piezas puestas, recortadas y unidas con el `joiner`. matched: la frase de `accept` que coincidió, o null.
//       complete   están TODAS las piezas de la respuesta (las `extra_pieces` no cuentan). empty: no se puso ninguna.
//       usedExtra  índices (de `all`) de las piezas de más que la persona puso, en el orden en que las puso.
//       misplaced  solo si result es 'wrong', está completo y no se usó ninguna pieza de más: posiciones (desde 0) donde la pieza puesta no es la del
//                  orden correcto; si no, [].
//
//   createBuildState(item, { rng }) → state   (lanza Error en español si el ítem no es válido)
//       El estado es el de `core/orderBlocks.js` (`createOrderState`, con tope de 16 piezas): { count, tray, placed, history }, con count = all.length.
//       tray: índices de `all` en el orden fijo en que se muestran (las piezas no cambian de sitio al colocarlas o quitarlas); con `data.shuffle: false` queda
//       el orden del contenido. Se usan las MISMAS acciones que ordenar (core/orderBlocks.js): placeBlock, removeBlock, undoLast, resetOrder y bankOf. Una pieza
//       no se puede colocar dos veces (doble toque: devuelve el MISMO estado) ni quitar si no está colocada: sin estados imposibles.
//   gradeBuildState(item, state) → gradeBuild(item, state.placed)
import { compare } from './compare.js';
import { createOrderState } from './orderBlocks.js';

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const goodText = (v, max) => typeof v === 'string' && v.trim() !== '' && v.length <= max;

export const BUILD_LIMITS = Object.freeze({ min: 2, max: 12, extraMax: 4, pieceLength: 120, acceptLength: 600 });
const JOINERS = Object.freeze({ unscramble_letters: '', build_from_keywords: ' ' });

export function readBuild(item) {
  const d = isPlain(item) && isPlain(item.data) ? item.data : null;
  if (d === null) return { ok: false, reason: 'no_data' };
  if (!Object.hasOwn(JOINERS, item.type)) return { ok: false, reason: 'bad_type' };
  const joiner = JOINERS[item.type];
  const p = d.pieces;
  if (!Array.isArray(p) || p.length < BUILD_LIMITS.min || p.length > BUILD_LIMITS.max || !p.every((x) => goodText(x, BUILD_LIMITS.pieceLength))) {
    return { ok: false, reason: 'bad_pieces' };
  }
  const e = d.extra_pieces;
  if (e !== undefined && e !== null && (!Array.isArray(e) || e.length > BUILD_LIMITS.extraMax || !e.every((x) => goodText(x, BUILD_LIMITS.pieceLength)))) {
    return { ok: false, reason: 'bad_extra' };
  }
  const extra = item.accept;
  if (extra !== undefined && extra !== null
    && (!Array.isArray(extra) || !extra.every((x) => goodText(x, BUILD_LIMITS.acceptLength)))) return { ok: false, reason: 'bad_accept' };
  const extras = Array.isArray(e) ? [...e] : [];
  const solution = p.map((x) => x.trim()).join(joiner);
  const accept = [solution];
  for (const x of Array.isArray(extra) ? extra : []) if (!accept.includes(x)) accept.push(x);
  return { ok: true, pieces: [...p], extras, all: [...p, ...extras], solution, accept, joiner, shuffle: d.shuffle !== false };
}

export function gradeBuild(item, placed) {
  const r = readBuild(item);
  if (!r.ok) throw new Error(`gradeBuild: el ítem de construir no es válido (${r.reason})`);
  const n = r.pieces.length;
  const total = r.all.length;
  const chosen = [];
  for (const i of Array.isArray(placed) ? placed : []) if (Number.isInteger(i) && i >= 0 && i < total && !chosen.includes(i)) chosen.push(i);
  const usedExtra = chosen.filter((i) => i >= n);
  const complete = Array.from({ length: n }, (_, i) => i).every((i) => chosen.includes(i));
  const text = chosen.map((i) => r.all[i].trim()).join(r.joiner);
  const cmp = chosen.length > 0 ? compare(text, r.accept) : null;
  const right = cmp !== null && cmp.result === 'correct';
  return {
    result: right ? 'correct' : 'wrong',
    placed: chosen,
    text,
    matched: right ? cmp.matched : null,
    complete,
    empty: chosen.length === 0,
    usedExtra,
    misplaced: !right && complete && usedExtra.length === 0 ? chosen.map((b, pos) => (b === pos ? -1 : pos)).filter((pos) => pos >= 0) : [],
  };
}

export function createBuildState(item, { rng } = {}) {
  const r = readBuild(item);
  if (!r.ok) throw new Error(`createBuildState: el ítem de construir no es válido (${r.reason})`);
  return createOrderState(r.all.length, { rng, shuffle: r.shuffle, max: BUILD_LIMITS.max + BUILD_LIMITS.extraMax });
}

export function gradeBuildState(item, state) {
  return gradeBuild(item, state !== null && typeof state === 'object' ? state.placed : []);
}
