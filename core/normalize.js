// @purpose: Normalización de respuestas (contracciones, mayúsculas, apóstrofos, espacios) y distancia de edición Damerau-Levenshtein.
// Normalización de respuestas (subparte 1.2, cuartos 1A y 1B). Contrato: docs/CONTRACTS.md 8.5 (paso 1 y regla 5) y Parte 2 (1.2-1A, 1.2-1B).
//
//   normalize(text, opts?) → string      PURA. Nunca lanza: null, undefined, números, objetos o emoji devuelven texto seguro.
//     Hace, en este orden: (1) corta a 10.000 caracteres; (2) borra invisibles (ancho cero…) y `’ ‘ ʼ ´ \`` → `'`;
//     (3) minúsculas y NFC (recompone lo que las minúsculas descomponen, así es idempotente); (4) SOLO con opción: quitar diacríticos;
//     (5) todo espacio raro (tab, salto, NBSP…) → espacio normal, colapsar y trim; (6) SOLO con opción: expandir contracciones;
//     (7) quitar puntuación FINAL (. , ! ? …) y los espacios que la rodean, salvo `opts.keepFinalPunctuation`.
//   Opciones (todas apagadas por defecto, así el comportamiento de la 1A no cambia):
//     keepFinalPunctuation  conserva la puntuación final.
//     contractions: 'expand' escribe cada contracción como las dos palabras (`don't` → `do not`, `can't` y `can not` → `cannot`).
//                          Es la forma CANÓNICA: si se aplica a las dos partes, `I've` ≡ `I have`. No se "contrae" nunca.
//     stripDiacritics       quita tildes y diéresis (también `ñ` → `n`); solo para comparar respuestas en español.
//   damerauLevenshtein(a, b, max?) → número   distancia de edición con transposición (cuarto 2A): insertar, borrar, sustituir o
//                          intercambiar dos letras vecinas cuesta 1 (`form`↔`from` = 1). Cuenta puntos de código (un emoji = 1).
//                          Si pasas `max`, devuelve `max + 1` en cuanto se sabe que lo supera (más rápido). Entradas que no son texto
//                          cuentan como ''. Si una palabra pasa de 200 puntos de código devuelve Infinity (no es una palabra).
//   hasLowercaseI(text) → boolean   ¿hay un `i` suelto en minúscula (`i`, `i'm`, `i've`…)? Es el error MECH.CAP_I (8.5, regla 5):
//                          se evalúa con el texto ORIGINAL (normalize ya pasó todo a minúsculas) y NO invalida la respuesta.
//
// Sin dependencias ni DOM: corre en Node y en el navegador.

const MAX_LENGTH = 10000; // tope defensivo: una respuesta más larga se corta (nadie escribe 10.000 caracteres)

const APOSTROPHES = /[\u2019\u2018\u02BC\u00B4\u0060\u2032]/g;
// Caracteres invisibles (ancho cero, guion blando, BOM): se ELIMINAN, no se vuelven espacio, porque no se ven al escribir.
const INVISIBLE = /[\u200B\u200C\u200D\u2060\u00AD\uFEFF]/g;
// \s cubre tab, saltos de línea, NBSP y espacios Unicode: todos pasan a un espacio normal.
const ODD_SPACES = /\s+/g;
const FINAL_PUNCTUATION = /[\s.,!?\u2026]+$/u;

// ---- Contracciones (1B). Solo las que NO son ambiguas. `'s` (is/has/posesivo) y `'d` (would/had) se dejan tal cual:
// no se pueden expandir sin adivinar; el contenido debe listar ambas variantes en `accept` (ver CONTRACTS 1.2-1B).
const NOT_STEMS = new Set(['do', 'does', 'did', 'is', 'are', 'was', 'were', 'has', 'have', 'had', 'could', 'should', 'would', 'must', 'need', 'might']);
const ARE_SUBJECTS = new Set(['you', 'we', 'they', 'who', 'what', 'there']);
const HAVE_SUBJECTS = new Set(['i', 'you', 'we', 'they', 'could', 'would', 'should', 'might', 'must', 'who', 'what']);
const WILL_SUBJECTS = new Set(['i', 'you', 'he', 'she', 'it', 'we', 'they', 'that', 'there', 'who', 'what']);
const CONTRACTION = /(?<![\p{L}\p{N}'])(\p{L}+)'(\p{L}+)(?![\p{L}\p{N}'])/gu;
const CAN_NOT = /(?<![\p{L}\p{N}'])can not(?![\p{L}\p{N}'])/gu;

function expandOne(match, a, b) {
  if (b === 't' && a.endsWith('n')) {
    const stem = a.slice(0, -1);
    if (stem === 'ca') return 'cannot';
    if (stem === 'wo') return 'will not';
    if (stem === 'sha') return 'shall not';
    return NOT_STEMS.has(stem) ? `${stem} not` : match;
  }
  if (b === 're' && ARE_SUBJECTS.has(a)) return `${a} are`;
  if (b === 'm' && a === 'i') return 'i am';
  if (b === 've' && HAVE_SUBJECTS.has(a)) return `${a} have`;
  if (b === 'll' && WILL_SUBJECTS.has(a)) return `${a} will`;
  if (a === 'let' && b === 's') return 'let us';
  return match;
}

export function expandContractions(text) {
  return toText(text).replace(CONTRACTION, expandOne).replace(CAN_NOT, 'cannot');
}

function toText(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

export function normalize(text, opts) {
  const keepFinal = Boolean(opts && typeof opts === 'object' && opts.keepFinalPunctuation === true);
  let out = toText(text);
  if (out.length > MAX_LENGTH) out = out.slice(0, MAX_LENGTH);
  out = out.replace(INVISIBLE, '').replace(APOSTROPHES, "'");
  out = out.toLowerCase().normalize('NFC'); // minúsculas puede descomponer (İ → i + punto): se recompone para ser idempotente
  // Los diacríticos se quitan ANTES de colapsar espacios: una marca suelta tras un espacio dejaría un espacio final.
  if (opts && typeof opts === 'object' && opts.stripDiacritics === true) out = out.normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC');
  out = out.replace(ODD_SPACES, ' ').trim();
  if (opts && typeof opts === 'object' && opts.contractions === 'expand') out = expandContractions(out);
  if (!keepFinal) out = out.replace(FINAL_PUNCTUATION, '');
  return out;
}

// `i` minúscula suelta: antes y después no hay letra/número, o sigue una contracción (`i'm`, `i've`, `i'll`, `i'd`).
const LOWER_I = /(?<![\p{L}\p{N}'])i(?=$|[^\p{L}\p{N}']|'(?:m|ve|ll|d)(?![\p{L}\p{N}]))/u;

export function hasLowercaseI(text) {
  let t = toText(text);
  if (t.length > MAX_LENGTH) t = t.slice(0, MAX_LENGTH);
  return LOWER_I.test(t.replace(APOSTROPHES, "'"));
}

// ---- Distancia de Damerau-Levenshtein (algoritmo completo de Lowrance-Wagner, no la variante restringida) ----
const MAX_WORD = 200;

export function damerauLevenshtein(a, b, max) {
  const A = Array.from(toText(a));
  const B = Array.from(toText(b));
  const limit = Number.isFinite(max) && max >= 0 ? Math.floor(max) : Infinity;
  if (A.length > MAX_WORD || B.length > MAX_WORD) return Infinity;
  if (A.length === 0) return limit < B.length ? limit + 1 : B.length;
  if (B.length === 0) return limit < A.length ? limit + 1 : A.length;
  if (Math.abs(A.length - B.length) > limit) return limit + 1;
  const n = A.length;
  const m = B.length;
  const inf = n + m;
  const d = Array.from({ length: n + 2 }, () => new Array(m + 2).fill(0));
  d[0][0] = inf;
  for (let i = 0; i <= n; i += 1) { d[i + 1][0] = inf; d[i + 1][1] = i; }
  for (let j = 0; j <= m; j += 1) { d[0][j + 1] = inf; d[1][j + 1] = j; }
  const lastRow = new Map();
  for (let i = 1; i <= n; i += 1) {
    let lastMatchCol = 0;
    for (let j = 1; j <= m; j += 1) {
      const i1 = lastRow.get(B[j - 1]) || 0;
      const j1 = lastMatchCol;
      let cost = 1;
      if (A[i - 1] === B[j - 1]) { cost = 0; lastMatchCol = j; }
      d[i + 1][j + 1] = Math.min(
        d[i][j] + cost, // sustituir (o igual)
        d[i + 1][j] + 1, // insertar
        d[i][j + 1] + 1, // borrar
        d[i1][j1] + (i - i1 - 1) + 1 + (j - j1 - 1), // intercambiar vecinas
      );
    }
    lastRow.set(A[i - 1], i);
  }
  const dist = d[n + 1][m + 1];
  return dist > limit ? limit + 1 : dist;
}
