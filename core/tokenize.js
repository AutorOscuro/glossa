// @purpose: Tokenizador de la lista blanca (1.11-T1): separa un texto en palabras, contracciones, guiones, números y siglas; ignora emoji.
// Tokenizador de la lista blanca (subparte 1.11, tramo T1). Contrato: docs/CONTRACTS.md, entrada 1.11-T1. Lo usarán el lematizador (T2) y `check` (T3).
//
//   tokenize(text) → Token[]     PURA. Nunca lanza: lo que no es texto (ni número finito) cuenta como ''. Sin tope de largo; el costo es lineal.
//   splitContraction(word) → string[]   las palabras a buscar dentro de una palabra con apóstrofo (`don't` → ['do','not']).
//   TOKEN_KINDS = ['word', 'number', 'acronym', 'alnum']
//
//   Token = {
//     text,          el trozo EXACTO del texto original (con apóstrofos curvos, invisibles, mayúsculas…): text.slice(start, end) === token.text
//     start, end,    posiciones en el texto original, en unidades UTF-16 (las de `String.prototype.slice`)
//     kind,          'word'    una o más palabras (`don't`, `well-known`, `5-year-old`)
//                    'number'  solo cifras: `42`, `3.5`, `1,000`, `10:30`, `2026-10-25`, `3rd`, `1990s`, `10am`
//                    'acronym' sigla con puntos: `U.S.`, `U.S.A.`, `e.g.`, `a.m.` (las siglas SIN puntos, `NASA` o `TV`, son palabras)
//                    'alnum'   letras mezcladas con cifras que no son número: `mp3`, `4x4`, `B2B`
//     norm,          minúsculas, NFC, sin invisibles, apóstrofo recto `'` y guion recto `-`
//     parts,         las palabras que hay que buscar en la lista: minúsculas y sin apóstrofo de contracción. Vacío si kind ≠ 'word'.
//                    `don't` → ['do','not'] · `well-known` → ['well','known'] · `5-year-old` → ['year','old'] (la cifra no cuenta)
//     hyphenated,    true si el token tenía guion entre sus partes
//     cap,           'lower' | 'title' | 'upper' | 'mixed' | 'none' (sin letras o número); `I` suelto es 'title', `NASA` es 'upper'
//     sentenceStart  true si es el primero del texto o si entre el token anterior y este hay `. ! ? …` o un salto de línea
//   }                (junto con `cap` sirve para decidir si es nombre propio; `Mr. Smith` marca `Smith` como inicio de frase: es un límite conocido)
//
// Reglas: los emoji, signos, símbolos y puntuación no son tokens (las palabras de alrededor se conservan). Las rayas `—` y `–` separan palabras; el
// guion corto `-` (y `‐ ‑ ‒ −`) las une. Los apóstrofos `’ ‘ ʼ ´ ` ′` valen como `'` (igual que `normalize`). Un apóstrofo o guion en el borde de
// una palabra (`'hello'`, `dogs'`, `well-`) se ignora. `'s` y `'d` no aportan palabra (pueden ser `is`/`has`/`would`/`had` o posesivo).
// Los caracteres invisibles (ancho cero, guion blando) dentro de una palabra se quitan de `norm` y de `parts`.

const APOSTROPHES = /[\u2019\u2018\u02BC\u00B4\u0060\u2032]/g; // mismos que core/normalize.js; cada uno se cambia por UN carácter, así las posiciones no se mueven
const HYPHENS = /[\u2010\u2011\u2012\u2212]/g;
const INVISIBLE = /[\u00AD\u200B-\u200D\u2060\uFEFF]/g;
const ALNUM = '[\\p{L}\\p{M}\\p{N}\\u00AD\\u200B-\\u200D\\u2060\\uFEFF]';
// Sigla con puntos. La guarda `.` antes impide empezar a mitad de una cadena `U.U.U.…` (sería cuadrático en textos hostiles).
const ACRONYM = '(?<![\\p{L}\\p{N}.])(?:\\p{L}\\.){2,}\\p{L}?(?![\\p{L}\\p{N}])';
// Palabra o número: letras/cifras unidas por apóstrofo o guion, o por . , : / entre dos cifras.
const CHUNK = `${ALNUM}+(?:(?:['-]|(?<=\\p{N})[.,:/](?=\\p{N}))${ALNUM}+)*`;
const TOKEN_RE = new RegExp(`(${ACRONYM})|(${CHUNK})`, 'gu');

const HAS_LETTER = /\p{L}/u;
const HAS_NUMBER = /\p{N}/u;
const HAS_ALNUM = /[\p{L}\p{N}]/u;
const NUMBER_SUFFIXED = /^\p{Nd}+(?:[.,:/]\p{Nd}+)*(?:st|nd|rd|th|s|am|pm)$/u; // 3rd, 1990s, 10am
const SENTENCE_BREAK = /[.!?\u2026\n\r]/;

export const TOKEN_KINDS = Object.freeze(['word', 'number', 'acronym', 'alnum']);

function toText(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

// Sufijos de contracción: [sufijo, palabra que añade o null]. Ninguno termina en otro, así que el orden no importa.
const SUFFIXES = [["n't", 'not'], ["'re", 'are'], ["'ve", 'have'], ["'ll", 'will'], ["'m", 'am'], ["'d", null], ["'s", null]];
const SPECIAL = {
  "ain't": ['be', 'not'], "can't": ['can', 'not'], "won't": ['will', 'not'], "shan't": ['shall', 'not'],
  "let's": ['let', 'us'], "y'all": ['you', 'all'], "o'clock": ['clock'],
};

export function splitContraction(word) {
  const w = toText(word).normalize('NFC').toLowerCase().replace(APOSTROPHES, "'");
  if (w === '') return [];
  if (!w.includes("'")) return [w];
  if (Object.hasOwn(SPECIAL, w)) return [...SPECIAL[w]];
  let rest = w;
  const tail = []; // las palabras que añaden los sufijos, en el orden en que se leen
  for (;;) {
    const hit = SUFFIXES.find(([suffix]) => rest.length > suffix.length && rest.endsWith(suffix));
    if (!hit) break;
    rest = rest.slice(0, rest.length - hit[0].length);
    if (hit[1] !== null) tail.unshift(hit[1]);
  }
  return [...rest.split("'").filter(Boolean), ...tail];
}

function segmentKind(segment) {
  if (!HAS_LETTER.test(segment)) return 'number'; // solo cifras y separadores
  if (!HAS_NUMBER.test(segment)) return 'word';
  return NUMBER_SUFFIXED.test(segment) ? 'number' : 'alnum';
}

function capOf(raw) {
  const letters = raw.replace(/[^\p{L}]/gu, '');
  if (letters === '') return 'none';
  const lower = letters.toLowerCase();
  if (letters === lower) return 'lower';
  if (letters.length > 1 && letters === letters.toUpperCase()) return 'upper';
  const first = letters.slice(0, 1);
  return first !== first.toLowerCase() && letters.slice(1) === lower.slice(1) ? 'title' : 'mixed';
}

// Clasifica una palabra o número ya localizado. Devuelve null si no tiene ni letras ni cifras (restos de emoji: marcas, ancho cero).
function describeChunk(chunk) {
  const norm = chunk.replace(INVISIBLE, '').normalize('NFC').toLowerCase();
  if (!HAS_ALNUM.test(norm)) return null;
  const segments = norm.split('-').filter((segment) => segment !== '');
  const kinds = segments.map(segmentKind);
  const words = segments.filter((_, i) => kinds[i] === 'word');
  const kind = words.length > 0 ? 'word' : kinds.includes('alnum') ? 'alnum' : 'number';
  const parts = words.flatMap((segment) => splitContraction(segment));
  return { norm, kind, parts, hyphenated: segments.length > 1 };
}

export function tokenize(text) {
  const original = toText(text);
  if (original === '') return [];
  const mapped = original.replace(APOSTROPHES, "'").replace(HYPHENS, '-');
  const tokens = [];
  let prevEnd = 0;
  for (const match of mapped.matchAll(TOKEN_RE)) {
    const start = match.index;
    const end = start + match[0].length;
    const raw = original.slice(start, end);
    let token;
    if (match[1] !== undefined) {
      token = { norm: match[0].toLowerCase(), kind: 'acronym', parts: [], hyphenated: false };
    } else {
      token = describeChunk(match[0]);
      if (token === null) continue;
    }
    const cap = token.kind === 'number' ? 'none' : capOf(raw);
    const sentenceStart = tokens.length === 0 || SENTENCE_BREAK.test(original.slice(prevEnd, start));
    tokens.push({ text: raw, start, end, kind: token.kind, norm: token.norm, parts: token.parts, hyphenated: token.hyphenated, cap, sentenceStart });
    prevEnd = end;
  }
  return tokens;
}
