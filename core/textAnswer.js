// @purpose: Lógica pura de la entrada de texto de la familia text_input (2.5-T1): lectura del ítem, respuesta vacía, opciones de compare por tipo, pista de máscara y calificación; sin DOM.
// Base común de los tipos de producción corta (2.5). Sin DOM, sin reloj y sin azar. La pantalla (2.5-T1, punto 2) usará estas funciones.
//
//   readText(item) → { ok: true, type, accept, hint, mask } | { ok: false, reason }
//       reason: 'no_item' (el ítem no es un objeto) · 'no_accept' (accept ausente, vacío o sin textos útiles).
//       accept = las respuestas COMPLETAS del ítem (`item.accept`, solo textos no vacíos; las variantes y las dos formas de 's/'d van ahí).
//       hint = data.hint (texto o null); mask = 'none' | 'first_letter' | 'length' (cualquier otro valor cuenta como 'none').
//   isBlank(text) → true si no es texto o solo trae espacios (también NBSP, caracteres de ancho cero y de control): una respuesta vacía NO se envía.
//   optionsFor(type, extra?) → opciones para compare: las del tipo (TYPE_OPTIONS) y las de `extra` (confusables, lang 'es', keepFinalPunctuation, almostAtWordEnd).
//   maskHint(item) → ayuda visual de la respuesta principal (accept[0]): 'first_letter' deja la primera letra y una raya por cada otra; 'length' una raya por letra.
//       Las palabras se separan con tres espacios y el apóstrofo queda visible. Sin máscara, sin respuesta o con ítem inválido → null.
//   gradeText(item, text, opts?) → { result, matched, diff, spellingFlags, errorCodes, typed, empty }
//       Compara lo escrito con las aceptadas con `compare` (inyectable en opts.compare). Un ítem inválido lanza Error en español.
//       `typed` es lo escrito sin espacios en los bordes; `empty: true` si no hay nada (la pantalla no envía).
//       Las opciones de compare salen de optionsFor(item.type, opts): `almostAtWordEnd: true` solo donde aplica (traducir palabra, decisión del Administrador, 1.2-2B).
import { compare as defaultCompare } from './compare.js';

export const MASKS = Object.freeze(['none', 'first_letter', 'length']);

// Tipos que pasan opciones propias a compare. Ortografía y traducir palabra: el error en la última letra sí puede ser un «casi» (ver CONTRACTS 1.2-2B).
export const TYPE_OPTIONS = Object.freeze({
  translate_word: Object.freeze({ almostAtWordEnd: true }),
});

// Blanco = espacios, NBSP, ancho cero y caracteres de control (no se ven: la persona ve el campo vacío; hallazgo del fuzz de 2.5-T1, punto 3).
const BLANK_RE = /^[\s\u0000-\u001F\u007F-\u009F\u200B-\u200D\u2060\uFEFF]*$/u;

export function isBlank(text) {
  return typeof text !== 'string' || BLANK_RE.test(text);
}

function acceptOf(item) {
  return Array.isArray(item?.accept) ? item.accept.filter((a) => typeof a === 'string' && !isBlank(a)) : [];
}

export function readText(item) {
  if (item === null || typeof item !== 'object' || Array.isArray(item)) return { ok: false, reason: 'no_item' };
  const accept = acceptOf(item);
  if (accept.length === 0) return { ok: false, reason: 'no_accept' };
  const data = item.data !== null && typeof item.data === 'object' && !Array.isArray(item.data) ? item.data : {};
  return {
    ok: true,
    type: typeof item.type === 'string' ? item.type : '',
    accept,
    hint: typeof data.hint === 'string' && !isBlank(data.hint) ? data.hint.trim() : null,
    mask: MASKS.includes(data.mask) ? data.mask : 'none',
  };
}

export function optionsFor(type, extra) {
  const base = Object.hasOwn(TYPE_OPTIONS, type) ? TYPE_OPTIONS[type] : {};
  const out = { ...base };
  const e = extra !== null && typeof extra === 'object' ? extra : {};
  if (e.confusables) out.confusables = e.confusables;
  if (e.lang === 'es') out.lang = 'es';
  if (e.keepFinalPunctuation === true) out.keepFinalPunctuation = true;
  if (e.almostAtWordEnd === true || e.almostAtWordEnd === false) out.almostAtWordEnd = e.almostAtWordEnd;
  return out;
}

export function maskHint(item) {
  const r = readText(item);
  if (!r.ok || r.mask === 'none') return null;
  const main = r.accept[0].trim();
  const keepFirst = r.mask === 'first_letter';
  return main.split(/\s+/u).map((word) => [...word].map((ch, k) => {
    if (ch === '\'' || ch === '’') return ch;
    return keepFirst && k === 0 ? ch : '_';
  }).join(' ')).join('   ');
}

export function gradeText(item, text, opts = {}) {
  const r = readText(item);
  if (!r.ok) throw new Error(r.reason === 'no_item' ? 'gradeText: el ítem no es un objeto' : 'gradeText: el ítem no tiene respuestas aceptadas (accept)');
  const run = typeof opts?.compare === 'function' ? opts.compare : defaultCompare;
  const typed = typeof text === 'string' ? text.trim() : '';
  const out = run(typed, r.accept, optionsFor(r.type, opts)) ?? {};
  return {
    result: out.result ?? 'wrong',
    matched: out.matched ?? null,
    diff: Array.isArray(out.diff) ? out.diff : [],
    spellingFlags: Array.isArray(out.spellingFlags) ? out.spellingFlags : [],
    errorCodes: Array.isArray(out.errorCodes) ? out.errorCodes : [],
    typed,
    empty: isBlank(text),
  };
}
