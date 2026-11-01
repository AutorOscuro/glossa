// @purpose: Lógica pura de cloze_bank (2.4-T2, punto 5): lee el ítem con banco de palabras, lleva el estado de toques (poner, quitar, deshacer, reiniciar) y califica; sin DOM.
// Lógica pura de `cloze_bank` (subparte 2.4, tramo 2). Sin DOM, sin reloj y sin azar. El azar entra solo por `rng` (core/rng.js).
//
//   CLOZE_BANK_LIMITS = { minGaps: 1, maxGaps: 6, bankMax: 20, textLength: 120, answersMax: 10, history: 200 }   (maxGaps, bankMax, answersMax y textLength son los de la especificación `cloze` de core/contentData.js)
//   readClozeBank(item) → { ok: true, parts, gaps, answers, bank } | { ok: false, reason }
//       Contrato de `data` (YA validado por core/contentData.js, familia `cloze`; 8.3; no se añade ningún campo):
//         item.data.text     la frase con los huecos marcados con `___` (BLANK de contentData.js; así los cuenta también el validador). 1 a 6 huecos.
//         item.data.answers  una lista por hueco, en el orden del texto, con las respuestas válidas de ese hueco (1 a 10 textos, cada uno con contenido y ≤ 120).
//         item.data.bank     el banco de palabras: de 1 a 20 textos con contenido y ≤ 120. OBLIGATORIO aquí (en la familia `cloze` es opcional). Puede traer distractores.
//       Las palabras del banco se identifican por su POSICIÓN en `data.bank`, no por su texto: dos palabras iguales («the», «the») son dos fichas distintas.
//       parts: los trozos de texto entre huecos (gaps + 1 trozos, tal cual, sin recortar). gaps: número de huecos. answers: las listas recortadas. bank: los textos recortados.
//       Más estricto que el validador en dos puntos que él no mira (hueco conocido, igual que en match_pairs): (1) cada hueco debe poder llenarse con una ficha DISTINTA
//       (si dos huecos solo aceptan «the» y el banco trae un solo «the», es `unsolvable`; el validador solo mira cada hueco por separado) y (2) el banco no puede ser más corto que los huecos.
//       reason ∈ no_data | bad_text | bad_answers | bad_bank | unsolvable.
//       Una respuesta cuenta si, tras `normalize` (core/normalize.js: minúsculas, apóstrofos y espacios), coincide con la de la ficha.
//   Estado de toques (funciones puras: cada una DEVUELVE un estado nuevo, congelado; no muta el anterior; una acción que no procede devuelve el MISMO objeto):
//     createClozeState(gapCount, bankCount, { rng, shuffle? }) → state = { gapCount, bankCount, tray, fills, history }
//         tray: índices de data.bank en el orden en que se muestran; fijo (las fichas no se mueven de sitio al poner o quitar). fills: una entrada por hueco, null o el índice de la ficha puesta.
//         history: acciones para deshacer (máx. CLOZE_BANK_LIMITS.history, se pierden las más antiguas).
//         shuffle (por defecto true) baraja `tray` con rng.shuffle y comprueba que sea una permutación; si queda en el orden original (con 2 o más fichas) prueba otra vez hasta 10 veces
//         y después lo gira un lugar. gapCount: entero de 1 a 6; bankCount: entero de gapCount a 20; si no, lanza Error en español.
//     placeWord(state, w, gap?)  pone la ficha w en el hueco `gap` (debe estar vacío) o, sin `gap`, en el primer hueco vacío. Solo si w no está ya puesta y hay sitio (sin estados imposibles).
//     removeFill(state, gap)     vacía el hueco `gap`; la ficha vuelve a su sitio de la bandeja.
//     undoLast(state)            deshace la última acción (poner o quitar; quitar vuelve a poner la ficha en su hueco). Sin historial no hace nada.
//     resetCloze(state)          vacía todos los huecos y el historial; `tray` no cambia (no se vuelve a barajar).
//     freeWords(state) → los índices de `tray` que aún no están puestos, en orden de bandeja.   isClozeComplete(state) → todos los huecos tienen ficha.
//   gradeClozeBank(item, fills) → { result, fills, filled, complete, empty, wrongGaps, sentence }      (lanza Error en español si el ítem no es válido, como gradeOrder)
//       fills   una entrada por hueco: el ÍNDICE de la ficha de data.bank (no el texto). Lo que no es un índice válido o ya está repetido se ignora (queda la primera aparición); lo que no es lista cuenta como vacío.
//       result  'correct' si todos los huecos están llenos y cada ficha coincide con alguna respuesta de SU hueco; 'wrong' en cualquier otro caso. No hay 'almost': las fichas son texto fijo.
//       filled  número de huecos con ficha.   complete: todos llenos.   empty: ninguno.   fills: la lista ya limpia (gaps entradas, null donde no hay ficha).
//       wrongGaps  solo si está completo y es 'wrong': los huecos (desde 0) cuya ficha no vale; si no, [].
//       sentence   el texto con cada ficha en su hueco (un hueco vacío queda como `___`); para responseRaw (la UI lo pasa por toResponseRaw).
import { normalize } from './normalize.js';
import { BLANK } from './contentData.js';

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const LIM = { minGaps: 1, maxGaps: 6, bankMax: 20, textLength: 120, answersMax: 10, history: 200 };
export const CLOZE_BANK_LIMITS = Object.freeze({ ...LIM });
const goodText = (v) => typeof v === 'string' && v.trim() !== '' && v.length <= LIM.textLength;
const same = (a, b) => normalize(a) === normalize(b);

// ¿Se puede dar a cada hueco una ficha distinta que valga? Emparejamiento por caminos de aumento (pocos huecos: 6 como mucho).
function solvable(answers, bank) {
  const options = answers.map((list) => bank.map((w, k) => (list.some((a) => same(a, w)) ? k : -1)).filter((k) => k >= 0));
  const owner = new Array(bank.length).fill(-1);
  const assign = (g, seen) => {
    for (const k of options[g]) {
      if (seen[k]) continue;
      seen[k] = true;
      if (owner[k] === -1 || assign(owner[k], seen)) { owner[k] = g; return true; }
    }
    return false;
  };
  return answers.every((_, g) => assign(g, new Array(bank.length).fill(false)));
}

export function readClozeBank(item) {
  const d = isPlain(item) && isPlain(item.data) ? item.data : null;
  if (d === null) return { ok: false, reason: 'no_data' };
  if (typeof d.text !== 'string') return { ok: false, reason: 'bad_text' };
  const parts = d.text.split(BLANK);
  const gaps = parts.length - 1;
  if (gaps < LIM.minGaps || gaps > LIM.maxGaps) return { ok: false, reason: 'bad_text' };
  if (!Array.isArray(d.answers) || d.answers.length !== gaps
    || !d.answers.every((l) => Array.isArray(l) && l.length >= 1 && l.length <= LIM.answersMax && l.every(goodText))) return { ok: false, reason: 'bad_answers' };
  if (!Array.isArray(d.bank) || d.bank.length < gaps || d.bank.length > LIM.bankMax || !d.bank.every(goodText)) return { ok: false, reason: 'bad_bank' };
  const answers = d.answers.map((l) => l.map((a) => a.trim()));
  const bank = d.bank.map((w) => w.trim());
  if (!solvable(answers, bank)) return { ok: false, reason: 'unsolvable' };
  return { ok: true, parts, gaps, answers, bank };
}

function need(item) {
  const r = readClozeBank(item);
  if (!r.ok) throw new Error(`gradeClozeBank: el ítem no es un cloze_bank válido (${r.reason})`);
  return r;
}

export function gradeClozeBank(item, fills) {
  const r = need(item);
  const seen = new Set();
  const clean = Array.from({ length: r.gaps }, (_, g) => {
    const w = Array.isArray(fills) ? fills[g] : null;
    if (!Number.isInteger(w) || w < 0 || w >= r.bank.length || seen.has(w)) return null;
    seen.add(w);
    return w;
  });
  const filled = clean.filter((w) => w !== null).length;
  const complete = filled === r.gaps;
  const wrongGaps = complete ? clean.map((w, g) => (r.answers[g].some((a) => same(a, r.bank[w])) ? -1 : g)).filter((g) => g >= 0) : [];
  const sentence = r.parts.reduce((out, part, i) => out + part + (i < r.gaps ? (clean[i] === null ? BLANK : r.bank[clean[i]]) : ''), '');
  return { result: complete && wrongGaps.length === 0 ? 'correct' : 'wrong', fills: clean, filled, complete, empty: filled === 0, wrongGaps, sentence };
}

// ---- estado de toques ----
const freezeState = (gapCount, bankCount, tray, fills, history) => Object.freeze({
  gapCount, bankCount, tray: Object.freeze([...tray]), fills: Object.freeze([...fills]), history: Object.freeze(history.map((h) => Object.freeze({ ...h }))),
});
const pushHistory = (history, entry) => [...history, entry].slice(-LIM.history);
const wordOk = (state, w) => Number.isInteger(w) && w >= 0 && w < state.bankCount;
const gapOk = (state, g) => Number.isInteger(g) && g >= 0 && g < state.gapCount;

export function createClozeState(gapCount, bankCount, { rng, shuffle = true } = {}) {
  if (!Number.isInteger(gapCount) || gapCount < LIM.minGaps || gapCount > LIM.maxGaps) {
    throw new Error(`createClozeState: el número de huecos debe ser un entero de ${LIM.minGaps} a ${LIM.maxGaps}`);
  }
  if (!Number.isInteger(bankCount) || bankCount < gapCount || bankCount > LIM.bankMax) {
    throw new Error(`createClozeState: el banco debe tener un entero de ${gapCount} a ${LIM.bankMax} palabras`);
  }
  const base = Array.from({ length: bankCount }, (_, i) => i);
  let tray = base;
  if (shuffle !== false) {
    if (!isPlain(rng) || typeof rng.shuffle !== 'function') throw new Error('createClozeState: falta un rng con shuffle (core/rng.js)');
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const out = rng.shuffle(base);
      const isPermutation = Array.isArray(out) && out.length === bankCount && [...out].sort((a, b) => a - b).every((v, k) => v === k);
      if (!isPermutation) throw new Error('createClozeState: el rng no devolvió una permutación de las palabras');
      tray = out;
      if (tray.some((v, k) => v !== k)) break;
    }
    if (bankCount > 1 && tray.every((v, k) => v === k)) tray = [...base.slice(1), base[0]];
  }
  return freezeState(gapCount, bankCount, tray, new Array(gapCount).fill(null), []);
}

export function freeWords(state) { return state.tray.filter((w) => !state.fills.includes(w)); }
export function isClozeComplete(state) { return state.fills.every((w) => w !== null); }

export function placeWord(state, w, gap) {
  if (!wordOk(state, w) || state.fills.includes(w)) return state;
  const g = gap === undefined ? state.fills.indexOf(null) : gap;
  if (!gapOk(state, g) || state.fills[g] !== null) return state;
  const fills = [...state.fills];
  fills[g] = w;
  return freezeState(state.gapCount, state.bankCount, state.tray, fills, pushHistory(state.history, { type: 'place', word: w, gap: g }));
}

export function removeFill(state, gap) {
  if (!gapOk(state, gap) || state.fills[gap] === null) return state;
  const fills = [...state.fills];
  const w = fills[gap];
  fills[gap] = null;
  return freezeState(state.gapCount, state.bankCount, state.tray, fills, pushHistory(state.history, { type: 'remove', word: w, gap }));
}

export function undoLast(state) {
  const last = state.history[state.history.length - 1];
  if (last === undefined) return state;
  const fills = [...state.fills];
  fills[last.gap] = last.type === 'place' ? null : last.word;
  return freezeState(state.gapCount, state.bankCount, state.tray, fills, state.history.slice(0, -1));
}

export function resetCloze(state) {
  if (state.history.length === 0 && state.fills.every((w) => w === null)) return state;
  return freezeState(state.gapCount, state.bankCount, state.tray, new Array(state.gapCount).fill(null), []);
}
