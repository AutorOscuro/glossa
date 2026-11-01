// @purpose: Validación estricta del Item común (ejercicio) de los paquetes de contenido.
// Validación estricta del Item común (subparte 1.3, cuarto 1, mitad B). Roadmap 8.3 y 8.9. Puro.
//   validateItem(input, ctx?) → { ok, errors, warnings, errorTotal, warningTotal }   (nunca lanza; no modifica la entrada)
//   checkItem(report, path, input, ctx?)   escribe en un informe existente con una ruta base (`items[12]`), para paquetes e historias.
//   ambiguousContractionGaps(lista) → índices de las respuestas con 's / 'd que no tienen su forma expandida (lo reutilizan los `data` del cuarto 2).
// `ctx` (todo opcional): errorCodes (Set de error_codes.json), topicIds (Set de topics.json), dataSpecs ({ familia: especificación };
// por defecto DATA_SPECS de `contentData.js`; un `ctx.dataSpecs` propio lo reemplaza entero).
// Lo que hace el Item común: forma y textos de TODOS los campos, `type` ∈ catálogo (los integradores se rechazan), `accept` obligatorio en los tipos
// que se escriben, distractor ≠ respuesta, `needs_ai` en los tipos solo-IA, regla de las contracciones ambiguas. El contenido de `data` lo comprueba
// la especificación de su familia (cuarto 2, `contentData.js`); si `ctx.dataSpecs` no trae esa familia, solo se exige que sea un objeto.
import {
  LEVELS, createReport, joinPath, check,
  text, int, bool, oneOf, idOf, errorCode, list, obj, custom, optional, nullable,
} from './contentRules.js';
import { ID_RE, MEDIA_AUDIO_RE, MEDIA_IMAGE_RE, isPlain, own, longText, audioPath, imagePath, topicRef } from './contentCommon.js';
import { typeInfo, isItemType, isIntegratorType, suggestType } from './contentTypes.js';
import { normalize } from './normalize.js';
import { DATA_SPECS, checkChoiceDistractors, checkAudioItem, checkTypedItem, checkPhraseClozeItem, checkOrderItem, checkFormsItem } from './contentData.js';

export { MEDIA_AUDIO_RE, MEDIA_IMAGE_RE };
export const ITEM_ID_RE = ID_RE;
export const ITEM_SOURCES = Object.freeze(['original', 'ai_generated_unverified']);

const MAX_ACCEPT = 50;
const TYPED_FAMILIES = Object.freeze(['speak', 'reading', 'writing', 'mediation', 'open_ai']);

// ---------- contracciones ambiguas ('s = is/has, 'd = would/had) ----------
// `normalize` no las expande (1.2-1B): el contenido debe listar las dos formas en `accept` (decisión del Administrador).
const S_SUBJECTS = 'he|she|it|that|there|here|what|who|where|how|when|why';
const D_SUBJECTS = 'i|you|he|she|it|we|they|who|there|that|what|where|how';
const AMBIGUOUS_RE = new RegExp(`\\b(?:(${S_SUBJECTS})'s|(${D_SUBJECTS})'d)\\b`, 'g');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Un patrón que acepta la respuesta con cada contracción ambigua escrita completa, o null si no tiene ninguna.
function expansionPattern(norm) {
  let last = 0;
  let src = '';
  let found = false;
  for (const m of norm.matchAll(AMBIGUOUS_RE)) {
    found = true;
    src += escapeRe(norm.slice(last, m.index));
    src += m[1] ? `${m[1]} (?:is|has)` : `${m[2]} (?:would|had)`;
    last = m.index + m[0].length;
  }
  if (!found) return null;
  return new RegExp(`^${src}${escapeRe(norm.slice(last))}$`);
}

export function ambiguousContractionGaps(accept) {
  if (!Array.isArray(accept)) return [];
  const norms = accept.slice(0, MAX_ACCEPT).map((a) => (typeof a === 'string' ? normalize(a) : null));
  const gaps = [];
  norms.forEach((n, i) => {
    if (n === null) return;
    const pattern = expansionPattern(n);
    if (!pattern) return;
    // una respuesta nunca coincide con su propia expansión (lleva la contracción escrita), así que no hace falta excluirla
    if (!norms.some((o) => o !== null && pattern.test(o))) gaps.push(i);
  });
  return gaps;
}

// ---------- especificación ----------
const typeSpec = custom((r, path, v) => {
  if (typeof v !== 'string') { r.error(path, 'TYPE', 'debe ser texto'); return; }
  if (isIntegratorType(v)) { r.error(path, 'INTEGRATOR_TYPE', `"${v}" es una sesión que arma la app, no un ejercicio: no va como ítem`); return; }
  if (!isItemType(v)) {
    const near = suggestType(v);
    r.error(path, 'UNKNOWN_TYPE', `"${v.length > 40 ? `${v.slice(0, 40)}…` : v}" no es un tipo del catálogo (8.9)${near ? `; ¿quisiste decir "${near}"?` : ''}`);
  }
});

const dataSpec = custom((r, path, v) => { if (!isPlain(v)) r.error(path, 'TYPE', 'debe ser un objeto'); });

const ITEM_SPEC = obj({
  id: idOf(ITEM_ID_RE, 'un id como g.pp.0001 (minúsculas, dígitos, _ y puntos; sin #)'),
  type: typeSpec,
  topics: list(topicRef(), { min: 1, max: 5, unique: true }),
  level: oneOf(LEVELS),
  facet: nullable(int(0, 2)), // 0=presente, 1=pasado, 2=participio en verbos (8.4); null en el resto
  prompt_es: text(),
  prompt_en: nullable(text()),
  data: dataSpec,
  accept: nullable(list(text(), { max: MAX_ACCEPT, unique: true })),
  distractors: optional(list(obj({ text: text(), code: nullable(errorCode()) }), { max: 20 })),
  explain_es: longText(),
  grammar_note_es: nullable(longText()),
  nuance_es: nullable(longText()),
  situation: nullable(text()),
  error_codes: optional(list(errorCode(), { max: 10, unique: true })),
  audio: audioPath(),
  image: imagePath(),
  needs_ai: optional(bool()),
  source: oneOf(ITEM_SOURCES),
  version: int(1, 9999),
});

// ---------- reglas que mezclan campos ----------
const norm = (s) => normalize(s);
const normExpanded = (s) => normalize(s, { contractions: 'expand' });
const strings = (a) => (Array.isArray(a) ? a.slice(0, MAX_ACCEPT).map((x) => (typeof x === 'string' ? x : null)) : []);

function crossChecks(r, path, v, ctx) {
  if (!isPlain(v)) return;
  const it = { ...v };
  const info = typeInfo(it.type);
  const acceptPath = joinPath(path, 'accept');
  const accept = strings(it.accept);
  const acceptMissing = it.accept === undefined || it.accept === null || (Array.isArray(it.accept) && it.accept.length === 0); // un tipo equivocado ya lo informa `check`

  if (info && info.acceptRequired && acceptMissing) {
    r.error(acceptPath, 'ACCEPT_REQUIRED', `el tipo ${it.type} se escribe: necesita al menos una respuesta válida en accept`);
  }
  if (info && !info.auto && it.needs_ai !== true && (it.needs_ai === undefined || typeof it.needs_ai === 'boolean')) {
    r.error(joinPath(path, 'needs_ai'), 'AI_REQUIRED', `el tipo ${it.type} solo se califica con IA: needs_ai debe ser true`);
  }

  // Respuestas repetidas al normalizar (las idénticas ya las informa `unique`).
  const seen = new Map();
  accept.forEach((a, i) => {
    if (a === null) return;
    const n = norm(a);
    if (seen.has(n)) { if (accept[seen.get(n)] !== a) r.warn(joinPath(acceptPath, i), 'ACCEPT_DUPLICATE', 'es la misma respuesta que otra de la lista al normalizar (mayúsculas, puntuación final)'); } else seen.set(n, i);
  });

  ambiguousContractionGaps(accept).forEach((i) => {
    const m = [...norm(accept[i]).matchAll(AMBIGUOUS_RE)][0];
    const full = m ? (m[1] ? `"${m[1]} is" o "${m[1]} has"` : `"${m[2]} would" o "${m[2]} had"`) : 'la forma completa';
    r.error(joinPath(acceptPath, i), 'CONTRACTION_PAIR_MISSING', `tiene una contracción ambigua ('s o 'd): agrega también la forma expandida, p. ej. ${full}`);
  });

  // Un distractor no puede ser una respuesta válida: se marcaría como error algo correcto.
  if (Array.isArray(it.distractors) && accept.length > 0) {
    const valid = new Set(accept.filter((a) => a !== null).map(normExpanded));
    it.distractors.slice(0, 20).forEach((d, i) => {
      if (isPlain(d) && typeof d.text === 'string' && valid.has(normExpanded(d.text))) {
        r.error(joinPath(joinPath(joinPath(path, 'distractors'), i), 'text'), 'DISTRACTOR_IS_ANSWER', 'es igual a una respuesta válida de accept');
      }
    });
  }

  // `data` según la especificación de su familia: `ctx.dataSpecs` si viene, y si no DATA_SPECS (cuarto 2).
  const given = ctx && ctx.dataSpecs;
  const specs = given && typeof given === 'object' ? given : DATA_SPECS;
  if (info && own(specs, info.family) && isPlain(it.data)) {
    const before = r.result().errorTotal;
    check(r, joinPath(path, 'data'), it.data, specs[info.family], ctx);
    // Con las especificaciones oficiales y `data` sin errores: elección → cada opción incorrecta lleva su distractor con code (8.10); audio → contestable.
    if (r.result().errorTotal === before) {
      if (info.family === 'choice' && specs.choice === DATA_SPECS.choice) checkChoiceDistractors(r, path, it);
      if (info.family === 'audio' && specs.audio === DATA_SPECS.audio) checkAudioItem(r, path, it); // audio: contestable y cloze_audio con hueco (2B)
      if (info.family === 'cloze' && specs.cloze === DATA_SPECS.cloze) checkPhraseClozeItem(r, path, it); // key_es, key_en y turns solo en phrase_cloze (2.2)
      if (info.family === 'ordering' && specs.ordering === DATA_SPECS.ordering) checkOrderItem(r, path, it); // blocks, lines y pieces según el tipo (2.4-T1)
      if (info.family === 'text_input' && specs.text_input === DATA_SPECS.text_input) checkFormsItem(r, path, it); // data.forms: three_forms sí, los demás no (2.5-T3)
      if (TYPED_FAMILIES.includes(info.family) && specs[info.family] === DATA_SPECS[info.family]) checkTypedItem(r, path, it); // obligatorios por tipo (2B)
    }
  }
}

export function checkItem(r, path, input, ctx = {}) {
  check(r, path, input, ITEM_SPEC, ctx);
  try { crossChecks(r, path, input, ctx); } catch { /* entrada hostil: `check` ya informó UNREADABLE */ }
}

export function validateItem(input, ctx = {}) {
  const r = createReport();
  checkItem(r, '', input, ctx);
  return r.result();
}

