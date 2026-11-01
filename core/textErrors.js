// @purpose: Une el detector mecánico (1.6) con la familia de producción corta (2.5-T5): pista específica para cualquier respuesta escrita incorrecta y entradas válidas para errors.record; sin DOM.
// Detector y registro de errores de la familia de texto (subparte 2.5, tramo 5). Roadmap 2.5 y 1.6. Sin DOM, sin reloj, sin azar y sin base: solo convierte la respuesta ya calificada en datos.
//
//   detectHits(detect, typed) → hit[]   Llama a `detect(typed)` y se queda con los objetos. Nunca lanza: sin función, texto vacío o detector roto devuelven [].
//   withDetection(g, { detect }) → g'   `g` es lo que devuelve gradeText o la calificación propia del tipo.
//       Si `g.hits` ya es una lista y la respuesta es `wrong` (fix_error y transform ya corrieron el detector) devuelve `g` igual.
//       Si no, y la respuesta es `wrong` y no está vacía, corre el detector sobre lo escrito y añade { hits, hint }: `hint` es la pista del primer aviso (o null) y el código de ese aviso
//       se suma a `errorCodes` (sin repetir), igual que hace gradeFix. Con trampa conocida (`g.trap`) la trampa manda: el código de `errorCodes` es el suyo y la pista del detector solo se conserva en `hint`.
//       Un `almost` (errata de una letra) pasa a `wrong` con `promoted: true` SOLO si un aviso que NO sea de ortografía (código que no empieza por «SPELL.») cubre justo la palabra marcada en `spellingFlags`:
//       «They had came late» frente a «come» es un `have + pasado`, no una errata, y «revisa la ortografía» (con tarjeta de deletreo) enseñaría lo contrario. Al promover se vacía `spellingFlags`.
//       Una errata de verdad («writen») o un aviso de ortografía (`SPELL.*`) NO promueven. En cualquier otro caso (correct, dont_know) devuelve `g` sin tocar.
//   errorEntries(item, g, { catalog, max? }) → entrada[]   entradas para `errors.record` / `answer.errors` del conductor: { code, original, correction?, context?, topics? }.
//       Solo si `g.result === 'wrong'` y el catálogo sirve (`has` y `hint`): sin catálogo NO hay `services.errors` y el commit rechazaría la respuesta entera.
//       Primero la trampa conocida (`g.trap`, con su texto) y después los avisos del detector (`g.hits`), sin repetir código + texto. `max` por defecto 5 (el commit admite 20).
//       «Sin cambios» (g.unchanged) no es un error nuevo: no se registra nada. `original` es el trozo que escribió la persona (o la respuesta entera si el aviso no trae trozo),
//       `correction` la respuesta aceptada que coincide (o la primera), `topics` los del ítem. Todo pasa por los topes de LIMITS: nunca produce una entrada que errors.prepare rechace.
import { normalize } from './normalize.js';
import { TOPIC_ID_RE } from './contentTopic.js';
import { LIMITS } from './errors.js';
import { clean } from './choiceFeedback.js';

export const MAX_TEXT_ERRORS = 5;
const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

export function detectHits(detect, typed) {
  if (typeof detect !== 'function' || typeof typed !== 'string' || typed.trim() === '') return [];
  try {
    const out = detect(typed);
    return Array.isArray(out) ? out.filter(isPlain) : [];
  } catch {
    return [];
  }
}

const wordsOf = (t) => (typeof t === 'string' ? t.toLowerCase().split(/[^\p{L}\p{N}']+/u).filter(Boolean) : []);
const isSpellCode = (c) => typeof c === 'string' && c.startsWith('SPELL.');

// ¿Algún aviso de gramática (no de ortografía) cubre una de las palabras que `compare` tomó por errata?
function coversFlag(hits, flags) {
  const flagged = new Set((Array.isArray(flags) ? flags : []).map((f) => (isPlain(f) && typeof f.word === 'string' ? f.word.toLowerCase() : '')).filter(Boolean));
  if (flagged.size === 0) return false;
  return hits.some((h) => !isSpellCode(h.code) && wordsOf(h.text).some((w) => flagged.has(w)));
}

export function withDetection(g, options) {
  const detect = isPlain(options) ? options.detect : undefined;
  if (!isPlain(g) || g.empty === true) return g;
  if (g.result === 'almost') {
    const found = detectHits(detect, g.typed);
    return coversFlag(found, g.spellingFlags) ? finish({ ...g, result: 'wrong', promoted: true, spellingFlags: [] }, found) : g;
  }
  if (g.result !== 'wrong' || Array.isArray(g.hits)) return g;
  return finish(g, detectHits(detect, g.typed));
}

function finish(g, hits) {
  const first = hits.length > 0 ? hits[0] : null;
  const code = first !== null ? text(first.code) : null;
  const errorCodes = Array.isArray(g.errorCodes) ? g.errorCodes : [];
  return {
    ...g,
    hits,
    hint: first !== null ? text(first.hint) : null,
    errorCodes: code !== null && !isPlain(g.trap) && !errorCodes.includes(code) ? [...errorCodes, code] : errorCodes,
  };
}

function usableCatalog(catalog) {
  return isPlain(catalog) && typeof catalog.has === 'function' && typeof catalog.hint === 'function';
}

function topicsOf(item) {
  if (!isPlain(item) || !Array.isArray(item.topics)) return [];
  const ok = item.topics.filter((t) => typeof t === 'string' && t.length <= LIMITS.topicLength && TOPIC_ID_RE.test(t));
  return [...new Set(ok)].slice(0, LIMITS.topics);
}

export function errorEntries(item, g, options) {
  const { catalog, max = MAX_TEXT_ERRORS } = isPlain(options) ? options : {};
  if (!isPlain(g) || g.result !== 'wrong' || g.unchanged === true || !usableCatalog(catalog)) return [];
  const cap = Number.isInteger(max) && max > 0 ? Math.min(max, 20) : MAX_TEXT_ERRORS;
  const answers = Array.isArray(item?.accept) ? item.accept.filter((a) => typeof a === 'string' && a.trim() !== '') : [];
  const correction = clean(typeof g.matched === 'string' ? g.matched : (answers[0] ?? null), LIMITS.correction);
  const context = clean(item?.situation, LIMITS.context);
  const topics = topicsOf(item);
  const whole = clean(g.typed, LIMITS.original);
  const found = [];
  if (isPlain(g.trap)) found.push({ code: g.trap.code, text: g.trap.text });
  if (Array.isArray(g.hits)) for (const h of g.hits) if (isPlain(h)) found.push({ code: h.code, text: h.text });
  const out = [];
  const seen = new Set();
  for (const f of found) {
    if (out.length >= cap) break;
    const code = text(f.code);
    if (code === null) continue;
    let known = false;
    try { known = catalog.has(code) === true; } catch { known = false; }
    if (!known) continue;
    const original = clean(f.text, LIMITS.original) ?? whole;
    if (original === null) continue;
    const key = `${code}\u0000${normalize(original)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      code,
      original,
      ...(correction === null ? {} : { correction }),
      ...(context === null ? {} : { context }),
      ...(topics.length === 0 ? {} : { topics }),
    });
  }
  return out;
}
