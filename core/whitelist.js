// @purpose: Fachada de la lista blanca (1.11-T3): mide qué fracción de un texto ya se conoce (check), si cae en 90–95 % y marca las palabras nuevas para estudiar.
// Validador de lista blanca (subparte 1.11, tramo T3). Contrato: docs/CONTRACTS.md, entrada 1.11-T3. Reúne T1 (tokenize), T2 (lemas y conocidos) y T3.
//
//   createWhitelist({ table, properNouns? }) → { check, markNew, isWithinTarget }      (congelado; `table` = LemmaTable de core/lemmas.js)
//   whitelist.check(text, known, opts?) → Result            `known` = Set de lemas en minúscula (lo que da `knownLemmas`) o arreglo de textos
//   whitelist.markNew(text, known, opts?) → { marks, segments, newWords, pctKnown, total }
//   isWithinTarget(pct, { min = 0.90, max = 0.95 } = {}) → boolean     (también suelta; ambos extremos incluidos; null o NaN → false)
//   Reexporta: knownLemmas, knownLemmasDetailed (T2), createLemmaTable, loadLemmas (T2), tokenize (T1), TARGET_RANGE.
//
// Qué cuenta: cada palabra (kind 'word') del texto, UNA VEZ POR APARICIÓN (cobertura de texto corrido). Una palabra es conocida si CADA una de sus
// partes (`don't` → do, not; `well-known` → well, known) tiene algún lema en `known` (una forma con varios lemas, `left`, vale si cualquiera lo es);
// una parte que la tabla no lista también vale si ella misma está en `known` (las palabras de `words` entran tal cual). `'s` y `'d` no aportan parte.
// No cuentan ni como conocidas ni como desconocidas: números (`3rd`, `1990s`), siglas con puntos (`U.S.`), códigos (`mp3`) y nombres propios.
// Nombre propio (opts.properNouns = 'ignore', por defecto; 'count' los trata como palabras): token que la tabla no lista y no está en `known`, con
// mayúscula inicial o mezclada, NO al inicio de frase; al inicio de frase solo si el mismo texto aparece como nombre en otro lugar del texto.
//
// Result = { unknown, pctKnown, total, knownCount, unknownCount, ignored:{ numbers, acronyms, codes, names }, names }
//   pctKnown   fracción 0..1 = knownCount / total; `null` si total es 0 (texto vacío, solo emoji o solo números): no hay nada que medir
//   unknown    una entrada por palabra distinta (clave: `norm`), en orden de aparición: { text (forma original de la 1.ª aparición), norm,
//              lemma (lema probable de la 1.ª parte desconocida), lemmas (todos los candidatos de las partes desconocidas, sin repetir),
//              parts: [{ part, lemmas, listed }] (solo las partes desconocidas), listed (todas esas partes están en la tabla), count, start, end }
//   names      textos (1.ª aparición) de los nombres propios omitidos
// Pura: sin DOM, sin reloj, sin azar; nunca toca la base. Un texto que no es texto cuenta como vacío.
import { tokenize } from './tokenize.js';
import { TARGET_RANGE } from './whitelist.config.js';

export { knownLemmas, knownLemmasDetailed } from './whitelistKnown.js';
export { createLemmaTable, loadLemmas } from './lemmas.js';
export { tokenize } from './tokenize.js';
export { TARGET_RANGE } from './whitelist.config.js';

const NAME_MODES = ['ignore', 'count'];
const isFrac = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;

export function isWithinTarget(pct, range) {
  const { min, max } = { ...TARGET_RANGE, ...(range && typeof range === 'object' ? range : {}) };
  if (!isFrac(min) || !isFrac(max) || min > max) throw new Error('isWithinTarget: min y max deben ser fracciones de 0 a 1 con min ≤ max');
  return isFrac(pct) && pct >= min && pct <= max;
}

function knownSet(known) {
  if (known instanceof Set) return known;
  if (Array.isArray(known)) return new Set(known.filter((x) => typeof x === 'string').map((x) => x.trim().toLowerCase()).filter(Boolean));
  throw new Error('whitelist: `known` debe ser un Set de lemas (knownLemmas) o un arreglo de textos');
}

const looksLikeName = (tok) => tok.cap === 'title' || tok.cap === 'mixed';

// Recorre el texto una vez y deja, por cada token, su clasificación. Es la base de check y de markNew.
function scan(table, text, known, nameMode) {
  const tokens = tokenize(text);
  const rows = tokens.map((tok) => {
    if (tok.kind === 'number') return { tok, cls: 'number' };
    if (tok.kind === 'acronym') return { tok, cls: 'acronym' };
    if (tok.kind === 'alnum') return { tok, cls: 'code' };
    if (tok.parts.length === 0) return { tok, cls: 'empty' };
    const parts = tok.parts.map((part) => {
      const lemmas = table.lemmasOf(part);
      return { part, lemmas, listed: lemmas.length > 0, known: known.has(part) || lemmas.some((l) => known.has(l)) };
    });
    return { tok, cls: parts.every((p) => p.known) ? 'known' : 'unknown', parts };
  });

  if (nameMode === 'ignore') {
    const seenAsName = new Set();
    for (const r of rows) {
      if (r.cls === 'unknown' && !r.tok.sentenceStart && looksLikeName(r.tok) && r.parts.some((p) => !p.listed && !p.known)) seenAsName.add(r.tok.norm);
    }
    for (const r of rows) {
      if (r.cls !== 'unknown' || !looksLikeName(r.tok) || !r.parts.some((p) => !p.listed && !p.known)) continue;
      if (!r.tok.sentenceStart || seenAsName.has(r.tok.norm)) r.cls = 'name';
    }
  }
  return rows;
}

function summarize(rows) {
  const out = { unknown: [], pctKnown: null, total: 0, knownCount: 0, unknownCount: 0, ignored: { numbers: 0, acronyms: 0, codes: 0, names: 0 }, names: [] };
  const byNorm = new Map();
  const seenNames = new Set();
  for (const { tok, cls, parts } of rows) {
    if (cls === 'number') out.ignored.numbers += 1;
    else if (cls === 'acronym') out.ignored.acronyms += 1;
    else if (cls === 'code') out.ignored.codes += 1;
    else if (cls === 'name') {
      out.ignored.names += 1;
      if (!seenNames.has(tok.norm)) { seenNames.add(tok.norm); out.names.push(tok.text); }
    } else if (cls === 'known') {
      out.total += 1;
      out.knownCount += 1;
    } else if (cls === 'unknown') {
      out.total += 1;
      out.unknownCount += 1;
      const hit = byNorm.get(tok.norm);
      if (hit) { hit.count += 1; continue; }
      const bad = parts.filter((p) => !p.known).map(({ part, lemmas, listed }) => ({ part, lemmas, listed }));
      const lemmas = [...new Set(bad.flatMap((p) => (p.lemmas.length > 0 ? p.lemmas : [p.part])))];
      const entry = { text: tok.text, norm: tok.norm, lemma: lemmas[0], lemmas, parts: bad, listed: bad.every((p) => p.listed), count: 1, start: tok.start, end: tok.end };
      byNorm.set(tok.norm, entry);
      out.unknown.push(entry);
    }
  }
  out.pctKnown = out.total === 0 ? null : out.knownCount / out.total;
  return out;
}

export function createWhitelist(options) {
  const { table, properNouns } = options && typeof options === 'object' ? options : {};
  if (!table || typeof table.lemmasOf !== 'function' || typeof table.analyze !== 'function') throw new Error('createWhitelist: falta la tabla de lemas (opts.table)');
  const defaultNames = properNouns === undefined ? 'ignore' : properNouns;
  if (!NAME_MODES.includes(defaultNames)) throw new Error("createWhitelist: properNouns debe ser 'ignore' o 'count'");

  const modeOf = (opts) => {
    const mode = opts && opts.properNouns !== undefined ? opts.properNouns : defaultNames;
    if (!NAME_MODES.includes(mode)) throw new Error("whitelist: properNouns debe ser 'ignore' o 'count'");
    return mode;
  };

  function check(text, known, opts) {
    return summarize(scan(table, text, knownSet(known), modeOf(opts)));
  }

  // Señala las palabras nuevas: `marks` = una por aparición { start, end, text, norm, lemma }; `segments` parte el texto entero en tramos seguidos
  // { text, start, end, isNew } (para pintarlos con textContent); `newWords` = lista de estudio (las mismas entradas de `unknown`, por orden de aparición).
  function markNew(text, known, opts) {
    const rows = scan(table, text, knownSet(known), modeOf(opts));
    const sum = summarize(rows);
    const lemmaOf = new Map(sum.unknown.map((u) => [u.norm, u.lemma]));
    const marks = rows
      .filter((r) => r.cls === 'unknown')
      .map(({ tok }) => ({ start: tok.start, end: tok.end, text: tok.text, norm: tok.norm, lemma: lemmaOf.get(tok.norm) }));
    const original = typeof text === 'string' ? text : (typeof text === 'number' && Number.isFinite(text) ? String(text) : '');
    const segments = [];
    let at = 0;
    for (const m of marks) {
      if (m.start > at) segments.push({ text: original.slice(at, m.start), start: at, end: m.start, isNew: false });
      segments.push({ text: original.slice(m.start, m.end), start: m.start, end: m.end, isNew: true });
      at = m.end;
    }
    if (at < original.length) segments.push({ text: original.slice(at), start: at, end: original.length, isNew: false });
    return { marks, segments, newWords: sum.unknown, pctKnown: sum.pctKnown, total: sum.total };
  }

  return Object.freeze({ check, markNew, isWithinTarget });
}
