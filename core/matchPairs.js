// @purpose: Lógica pura de emparejar (2.4-T2, puntos 1 y 2): lee un ítem match_pairs, lleva el estado de toques con feedback inmediato por pareja y califica; sin DOM.
// Lógica pura de `match_pairs` (subparte 2.4, tramo 2). Sin DOM, sin reloj y sin azar. Hasta ahora: LEER el ítem (punto 1), el ESTADO DE TOQUES y CALIFICAR (punto 2). El azar entra solo por `rng` (core/rng.js).
//
//   MATCH_LIMITS = { min: 2, max: 10, textLength: 120, extraMax: 4, attempts: 400 }   (min, max, textLength y extraMax son los mismos topes que la especificación `matching` de core/contentData.js; una prueba los compara; `attempts` es solo del estado de toques)
//   readMatch(item) → { ok: true, pairs, lefts, rights, extra } | { ok: false, reason }
//       Contrato de `data` (YA validado por core/contentData.js, familia `matching`; 8.3):
//         item.data.pairs        lista de 2 a 10 objetos { left, right }; cada texto con contenido y ≤ 120. Cada pareja es la solución: `left` va con SU `right`.
//         item.data.extra_right  (opcional) hasta 4 textos más para el lado derecho que NO son pareja de nadie (distractores); cada uno con contenido, ≤ 120.
//       Las parejas se identifican por su POSICIÓN en `data.pairs`. Ningún `left` se repite y ningún `right` se repite (si no, habría dos soluciones para una misma
//       tarjeta); tampoco un `extra_right` puede ser igual a un `right` de pareja (la persona no podría distinguir la correcta). La comparación es por el texto recortado.
//       pairs: [{ left, right }] con los textos recortados. lefts: los `left` en orden. rights: los `right` de las parejas en el mismo orden. extra: los distractores (o []).
//       reason ∈ no_data | bad_pairs | bad_extra.
//   Estado de toques (funciones puras: cada una DEVUELVE un estado nuevo, congelado; no muta el anterior; una acción que no procede devuelve el MISMO objeto):
//     Tarjetas de la derecha: el índice k < pairCount es el `right` de la pareja k; k ≥ pairCount es un distractor (`extra_right`). La pareja k es lefts[k] con la tarjeta k.
//     createMatchState(pairCount, extraCount, { rng, shuffle? }) → state = { pairCount, cardCount, tray, solved, selected, attempts, last }
//         tray: índices de las tarjetas de la derecha en el orden en que se muestran; fijo (no se mueven al emparejar). Las de la izquierda salen en el orden del contenido.
//         shuffle (por defecto true) baraja `tray` con rng.shuffle, comprueba que sea una permutación y, si queda en el orden original, prueba otra vez hasta 10 veces y después lo gira un lugar.
//         solved: parejas resueltas (índice de `left`), en el orden en que se acertaron. selected: null o { side: 'left' | 'right', index }.
//         attempts: los intentos resueltos, en orden, [{ left, right }] (right = índice de tarjeta); los fallos se guardan hasta MATCH_LIMITS.attempts - pairCount y los demás se descartan.
//         last: el último intento resuelto { left, right, ok } o null (para pintar el acierto o el fallo al instante). pairCount: entero de 2 a 10; extraCount: de 0 a 4; si no, lanza Error en español.
//     pickMatch(state, side, index)  un toque. Sin selección: selecciona. Con selección del MISMO lado: cambia la selección (el mismo índice la quita). Con selección del lado contrario:
//         resuelve el intento al instante: acierto si left === tarjeta (la pareja queda resuelta y bloqueada), fallo si no (nada queda resuelto). En ambos casos la selección se limpia.
//         Una pareja ya resuelta (su `left` o su tarjeta) no se puede volver a tocar: devuelve el mismo estado, así que el doble toque nunca crea un estado imposible.
//     isMatchComplete(state) → están resueltas todas las parejas.   Sin deshacer: el feedback inmediato es definitivo (decisión provisional, ver DECISIONS.md).
//   gradeMatch(item, attempts) → { result, complete, empty, solved, mistakes, firstTry, wrongLefts, text }      (lanza Error en español si el ítem no es válido, como gradeOrder)
//       attempts   lista de { left, right } (índices) en el orden en que se hicieron; lo que no es lista cuenta como vacío y lo que no es un intento válido (índice fuera de rango, o sobre una pareja ya resuelta) se ignora. Nunca lanza por `attempts`.
//       result     'correct' si están resueltas TODAS las parejas y no hubo ningún fallo; 'wrong' en cualquier otro caso. No hay 'almost'.
//       solved     los índices de `left` resueltos, en orden.   mistakes: intentos fallidos.   firstTry: parejas acertadas sin fallo previo en su `left`.   wrongLefts: índices de `left` con algún fallo, sin repetir y en orden creciente.
//       complete   están todas resueltas.   empty   no hay ningún intento válido.   text: los intentos «left = tarjeta» unidos con «; » (para responseRaw; la UI lo pasa por toResponseRaw).
//   Nota: el «5–6 pares» del roadmap (2.4) es una guía de contenido para `match_pairs`, no un tope: el contrato de la familia admite 2 a 10 (ver DECISIONS.md, 2.4-T2).

export const MATCH_LIMITS = Object.freeze({ min: 2, max: 10, textLength: 120, extraMax: 4, attempts: 400 });

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const goodText = (v) => typeof v === 'string' && v.trim() !== '' && v.length <= MATCH_LIMITS.textLength;
const goodPair = (p) => isPlain(p) && goodText(p.left) && goodText(p.right);
const distinct = (list) => new Set(list).size === list.length;

export function readMatch(item) {
  const d = isPlain(item) && isPlain(item.data) ? item.data : null;
  if (d === null) return { ok: false, reason: 'no_data' };
  const p = d.pairs;
  if (!Array.isArray(p) || p.length < MATCH_LIMITS.min || p.length > MATCH_LIMITS.max || !p.every(goodPair)) return { ok: false, reason: 'bad_pairs' };
  const pairs = p.map((x) => ({ left: x.left.trim(), right: x.right.trim() }));
  const lefts = pairs.map((x) => x.left);
  const rights = pairs.map((x) => x.right);
  if (!distinct(lefts) || !distinct(rights)) return { ok: false, reason: 'bad_pairs' };
  let extra = [];
  const e = d.extra_right;
  if (e !== undefined && e !== null) {
    if (!Array.isArray(e) || e.length > MATCH_LIMITS.extraMax || !e.every(goodText)) return { ok: false, reason: 'bad_extra' };
    extra = e.map((x) => x.trim());
    if (!distinct(extra) || extra.some((x) => rights.includes(x))) return { ok: false, reason: 'bad_extra' };
  }
  return { ok: true, pairs, lefts, rights, extra };
}

// ---- estado de toques y calificación (punto 2) ----
const SIDES = ['left', 'right'];
const freezeMatch = (m) => Object.freeze({
  pairCount: m.pairCount, cardCount: m.cardCount, tray: Object.freeze([...m.tray]), solved: Object.freeze([...m.solved]),
  selected: m.selected === null ? null : Object.freeze({ ...m.selected }),
  attempts: Object.freeze(m.attempts.map((a) => Object.freeze({ ...a }))),
  last: m.last === null ? null : Object.freeze({ ...m.last }),
});

export function createMatchState(pairCount, extraCount, { rng, shuffle = true } = {}) {
  if (!Number.isInteger(pairCount) || pairCount < MATCH_LIMITS.min || pairCount > MATCH_LIMITS.max) {
    throw new Error(`createMatchState: el número de parejas debe ser un entero de ${MATCH_LIMITS.min} a ${MATCH_LIMITS.max}`);
  }
  if (!Number.isInteger(extraCount) || extraCount < 0 || extraCount > MATCH_LIMITS.extraMax) {
    throw new Error(`createMatchState: los distractores deben ser un entero de 0 a ${MATCH_LIMITS.extraMax}`);
  }
  const cardCount = pairCount + extraCount;
  const base = Array.from({ length: cardCount }, (_, i) => i);
  let tray = base;
  if (shuffle !== false) {
    if (rng === null || typeof rng !== 'object' || typeof rng.shuffle !== 'function') throw new Error('createMatchState: falta un rng con shuffle (core/rng.js)');
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const out = rng.shuffle(base);
      const isPermutation = Array.isArray(out) && out.length === cardCount && [...out].sort((a, b) => a - b).every((v, k) => v === k);
      if (!isPermutation) throw new Error('createMatchState: el rng no devolvió una permutación de las tarjetas');
      tray = out;
      if (tray.some((v, k) => v !== k)) break;
    }
    if (tray.every((v, k) => v === k)) tray = [...base.slice(1), base[0]];
  }
  return freezeMatch({ pairCount, cardCount, tray, solved: [], selected: null, attempts: [], last: null });
}

export function isMatchComplete(state) { return state.solved.length === state.pairCount; }

const sideLimit = (state, side) => (side === 'left' ? state.pairCount : state.cardCount);
const isLocked = (state, side, index) => index < state.pairCount && state.solved.includes(index) && SIDES.includes(side);

export function pickMatch(state, side, index) {
  if (!SIDES.includes(side) || !Number.isInteger(index) || index < 0 || index >= sideLimit(state, side)) return state;
  if (isLocked(state, side, index)) return state;
  const sel = state.selected;
  if (sel === null) return freezeMatch({ ...state, selected: { side, index } });
  if (sel.side === side) return freezeMatch({ ...state, selected: sel.index === index ? null : { side, index } });
  const left = side === 'left' ? index : sel.index;
  const right = side === 'right' ? index : sel.index;
  const ok = left === right;
  const wrongKept = state.attempts.filter((a) => a.left !== a.right).length;
  const keep = ok || wrongKept < MATCH_LIMITS.attempts - state.pairCount;
  return freezeMatch({
    ...state,
    selected: null,
    solved: ok ? [...state.solved, left] : state.solved,
    attempts: keep ? [...state.attempts, { left, right }] : state.attempts,
    last: { left, right, ok },
  });
}

export function gradeMatch(item, attempts) {
  const r = readMatch(item);
  if (!r.ok) throw new Error(`gradeMatch: el ítem de emparejar no es válido (${r.reason})`);
  const n = r.pairs.length;
  const cards = [...r.rights, ...r.extra];
  const solved = [];
  const wrong = new Set();
  const used = [];
  let mistakes = 0;
  let firstTry = 0;
  for (const a of Array.isArray(attempts) ? attempts : []) {
    const l = a !== null && typeof a === 'object' ? a.left : undefined;
    const c = a !== null && typeof a === 'object' ? a.right : undefined;
    if (!Number.isInteger(l) || !Number.isInteger(c) || l < 0 || l >= n || c < 0 || c >= cards.length) continue;
    if (solved.includes(l) || (c < n && solved.includes(c))) continue;
    used.push(`${r.lefts[l]} = ${cards[c]}`);
    if (l === c) {
      solved.push(l);
      if (!wrong.has(l)) firstTry += 1;
    } else {
      mistakes += 1;
      wrong.add(l);
    }
  }
  const complete = solved.length === n;
  return {
    result: complete && mistakes === 0 ? 'correct' : 'wrong',
    complete,
    empty: used.length === 0,
    solved,
    mistakes,
    firstTry,
    wrongLefts: [...wrong].sort((x, y) => x - y),
    text: used.join('; '),
  };
}
