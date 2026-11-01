// @purpose: Validación estricta de un Topic (tema) de la taxonomía.
// Validación estricta de un Topic (subparte 1.3, cuarto 1, mitad A). Roadmap 8.2. Puro.
//   validateTopic(input, ctx?) → { ok, errors, warnings, errorTotal, warningTotal }   (nunca lanza; no modifica la entrada)
//   checkTopic(report, path, input, ctx?)   escribe en un informe existente con una ruta base (`topics[3]`), para validar listas de temas.
// `ctx.errorCodes` (Set opcional): si viene, el `code` de cada error típico debe existir en error_codes.json.
// Lo que NO hace (llega en 3A, necesita ver todos los temas a la vez): ids únicos, que `prereq` exista y ciclos.
import {
  AREAS, LEVELS, LIMITS, createReport, joinPath, check,
  text, int, bool, oneOf, idOf, errorCode, list, obj, optional, nullable,
} from './contentRules.js';

// Ids de tema (8.1): `área.tema[.subtema…]`, minúsculas, dígitos y guion bajo; al menos dos tramos.
export const TOPIC_ID_RE = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/;
const TAG_RE = /^[a-z][a-z0-9_]{0,39}$/;
// El contrato 8.2 solo muestra `active`; 8.1 habla de `deprecated`. `draft` = tema sembrado que aún no tiene contenido (provisional, ver DECISIONS.md 1.3-1A).
export const TOPIC_STATUSES = Object.freeze(['active', 'draft', 'deprecated']);

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
  && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

const longText = () => text(LIMITS.long, { multiline: true });
const topicId = () => idOf(TOPIC_ID_RE, 'un id de tema como gram.present_perfect.for_since');

const EXAMPLE = obj({ en: text(), es: text() });
const TYPICAL_ERROR = obj({ wrong: text(), right: text(), why_es: longText(), code: nullable(errorCode()) });
const THEORY = obj({
  rule_es: longText(),
  form: nullable(text(LIMITS.short)),
  use_es: nullable(longText()),
  examples: list(EXAMPLE, { max: 20 }),
  typical_errors: optional(list(TYPICAL_ERROR, { max: 20 })),
  es_contrast_es: nullable(longText()),
});

const TOPIC_SPEC = obj({
  id: topicId(),
  area: oneOf(AREAS),
  level: oneOf(LEVELS),
  title_es: text(LIMITS.short),
  title_en: text(LIMITS.short),
  prereq: list(topicId(), { max: 20, unique: true }), // sugerencias, nunca candados (8.2)
  priority: int(1, 5),
  diagnosed_gap: optional(bool()), // por defecto false
  theory: nullable(THEORY), // ausente ≡ null; un tema active sin teoría da aviso
  min_items: optional(int(1, 200)), // por defecto 12 (8.10)
  tags: optional(list(idOf(TAG_RE, 'una etiqueta en minúsculas como transfer_es'), { max: 12, unique: true })),
  status: oneOf(TOPIC_STATUSES),
});

// Reglas que mezclan campos. Solo mira lo que ya tiene la forma correcta; lo demás ya lo informó `check`.
function crossChecks(r, path, v) {
  if (!isPlain(v)) return;
  const t = { ...v };
  if (typeof t.id === 'string' && TOPIC_ID_RE.test(t.id) && AREAS.includes(t.area) && t.id.split('.')[0] !== t.area) {
    r.error(joinPath(path, 'id'), 'AREA_MISMATCH', `el id debe empezar por el área ("${t.area}.")`);
  }
  if (typeof t.id === 'string' && Array.isArray(t.prereq)) {
    t.prereq.slice(0, 20).forEach((p, i) => {
      if (p === t.id) r.error(joinPath(joinPath(path, 'prereq'), i), 'SELF_REFERENCE', 'un tema no puede ser prerrequisito de sí mismo');
    });
  }
  if (t.status === 'active') {
    if (t.theory === undefined || t.theory === null) r.warn(joinPath(path, 'theory'), 'THEORY_MISSING', 'un tema activo debería traer su teoría');
    else if (isPlain(t.theory) && Array.isArray(t.theory.examples) && t.theory.examples.length === 0) {
      r.warn(joinPath(joinPath(path, 'theory'), 'examples'), 'THEORY_MISSING', 'la teoría de un tema activo debería traer al menos un ejemplo');
    }
  }
}

export function checkTopic(r, path, input, ctx = {}) {
  check(r, path, input, TOPIC_SPEC, ctx);
  try { crossChecks(r, path, input); } catch { /* entrada hostil: `check` ya informó UNREADABLE */ }
}

export function validateTopic(input, ctx = {}) {
  const r = createReport();
  checkTopic(r, '', input, ctx);
  return r.result();
}
