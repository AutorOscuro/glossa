// @purpose: Lógica pura de phrase_cloze (2.2-T2): rellenar huecos, respuestas aceptadas, pista progresiva y calificación con compare; sin DOM.
// Lógica pura de la tarjeta phrase_cloze (2.2-T2). Sin DOM, sin reloj y sin azar.
//
//   countGaps(text) → número de huecos (`___` o más guiones bajos seguidos).
//   fillGaps(text, fills) → texto con cada hueco sustituido por el relleno de su posición (relleno ausente = hueco vacío).
//   acceptList(item) → respuestas COMPLETAS aceptadas: `item.accept` si existe; si no, el producto de `data.answers` aplicado a `data.text` (tope 50).
//   hintFor(item, level) → texto de la pista: nivel 1 = primera letra de cada hueco; nivel 2 = estructura (primera letra + una raya por letra restante,
//       con el apóstrofo y los espacios visibles). Nivel fuera de 1–2 → null. Las pistas salen de `answers[i][0]` (la forma principal).
//   grade(item, fills, opts?) → { result, matched, diff, spellingFlags, errorCodes, typed, empty }.
//       Une los rellenos en la frase completa y la compara con las aceptadas con `compare` (inyectable en opts.compare; opts.confusables se reenvía).
//       `empty: true` si todos los rellenos están vacíos (la tarjeta no envía una respuesta vacía).
import { compare as defaultCompare } from './compare.js';

const GAP_RE = /_{2,}/g;
const MAX_COMBOS = 50;

export function countGaps(text) {
  return typeof text === 'string' ? (text.match(GAP_RE) ?? []).length : 0;
}

export function fillGaps(text, fills) {
  if (typeof text !== 'string') return '';
  const list = Array.isArray(fills) ? fills : [];
  let i = 0;
  return text.replace(GAP_RE, () => {
    const f = list[i];
    i += 1;
    return typeof f === 'string' ? f.trim() : '';
  });
}

function answersOf(item) {
  const a = item?.data?.answers;
  return Array.isArray(a) ? a.map((g) => (Array.isArray(g) ? g.filter((x) => typeof x === 'string' && x.trim()) : [])) : [];
}

export function acceptList(item) {
  if (Array.isArray(item?.accept)) {
    const own = item.accept.filter((x) => typeof x === 'string' && x.trim());
    if (own.length) return own;
  }
  const groups = answersOf(item);
  const text = item?.data?.text;
  if (!groups.length || groups.some((g) => g.length === 0) || typeof text !== 'string') return [];
  let combos = [[]];
  for (const g of groups) {
    const next = [];
    for (const base of combos) for (const opt of g) { if (next.length < MAX_COMBOS) next.push([...base, opt]); }
    combos = next;
  }
  return combos.map((c) => fillGaps(text, c));
}

export function hintFor(item, level) {
  if (level !== 1 && level !== 2) return null;
  const groups = answersOf(item);
  if (!groups.length) return null;
  const parts = groups.map((g) => {
    const main = g[0] ?? '';
    if (level === 1) return main ? `«${[...main][0]}…»` : '';
    return main.split(' ').map((w) => [...w].map((ch, k) => (k === 0 || ch === '\'' || ch === '’' ? ch : '_')).join(' ')).join('   ');
  }).filter(Boolean);
  if (!parts.length) return null;
  return level === 1 ? `Empieza con ${parts.join(' · ')}` : parts.join('  ·  ');
}

export function grade(item, fills, opts = {}) {
  const run = typeof opts.compare === 'function' ? opts.compare : defaultCompare;
  const list = Array.isArray(fills) ? fills.map((f) => (typeof f === 'string' ? f : '')) : [];
  const empty = list.every((f) => f.trim() === '');
  const typed = fillGaps(item?.data?.text, list);
  const r = run(typed, acceptList(item), opts.confusables ? { confusables: opts.confusables } : undefined) ?? {};
  return {
    result: r.result ?? 'wrong',
    matched: r.matched ?? null,
    diff: Array.isArray(r.diff) ? r.diff : [],
    spellingFlags: Array.isArray(r.spellingFlags) ? r.spellingFlags : [],
    errorCodes: Array.isArray(r.errorCodes) ? r.errorCodes : [],
    typed,
    empty,
  };
}
