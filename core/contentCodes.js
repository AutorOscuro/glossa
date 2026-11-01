// @purpose: Validador del catálogo de códigos de error (error_codes.json) y conjunto de códigos válidos.
// Catálogo de códigos de error (subparte 1.3, cuarto 3, mitad 3A, parte 1). Roadmap 8.8 y 1.3. Puro: sin DOM, sin base de datos, sin archivos.
//   validateErrorCodes(input) → { ok, errors, warnings, errorTotal, warningTotal }   valida `content/taxonomy/error_codes.json` (nunca lanza)
//   errorCodeSet(input) → Set<string>    los ids del catálogo, para `ctx.errorCodes` de los validadores de contenido (nunca lanza; no valida)
// Archivo: `{ schema: 1, codes: [{ id, titulo_es, … }] }`. En la 1.3 cada código solo trae `id` y `titulo_es`; la 1.6 y el lote C1 completan el resto
// (campos opcionales con forma, para que no haya que tocar el validador): descripcion_es, origen_tipico, impacto_defecto, temas_relacionados,
// ejemplo_malo, ejemplo_bueno, pista_corta_es.
import { LIMITS, createReport, check, text, oneOf, errorCode, list, obj, custom, optional } from './contentRules.js';
import { topicRef } from './contentCommon.js';

export const ERROR_CODES_SCHEMA = 1;
export const MAX_ERROR_CODES = 500;
export const ERROR_ORIGINS = Object.freeze(['transfer_es', 'developmental', 'unknown_pure']); // 8.8 `origin`
export const ERROR_IMPACTS = Object.freeze(['low', 'mid', 'high']); // 8.8 `impact`

const ENTRY = obj({
  id: errorCode(), // solo el formato: el catálogo es quien define qué códigos existen
  titulo_es: text(LIMITS.short),
  descripcion_es: optional(text()),
  origen_tipico: optional(oneOf(ERROR_ORIGINS)),
  impacto_defecto: optional(oneOf(ERROR_IMPACTS)),
  temas_relacionados: optional(list(topicRef(), { max: 10, unique: true })),
  ejemplo_malo: optional(text()),
  ejemplo_bueno: optional(text()),
  pista_corta_es: optional(text()),
});

const CODES = custom((r, path, v, ctx) => {
  check(r, path, v, list(ENTRY, { min: 1, max: MAX_ERROR_CODES }), ctx);
  if (!Array.isArray(v)) return;
  const seen = new Set();
  for (let i = 0; i < Math.min(v.length, MAX_ERROR_CODES); i += 1) {
    const id = v[i] !== null && typeof v[i] === 'object' ? v[i].id : undefined;
    if (typeof id !== 'string') continue;
    if (seen.has(id)) r.error(`${path}[${i}].id`, 'DUPLICATE', `el código ${id} está repetido`);
    else seen.add(id);
  }
});

const FILE = obj({ schema: oneOf([ERROR_CODES_SCHEMA]), codes: CODES });

export function validateErrorCodes(input) {
  const r = createReport();
  check(r, '', input, FILE, {});
  return r.result();
}

export function errorCodeSet(input) {
  const out = new Set();
  try {
    const codes = input !== null && typeof input === 'object' ? input.codes : undefined;
    if (!Array.isArray(codes)) return out;
    for (let i = 0; i < Math.min(codes.length, MAX_ERROR_CODES); i += 1) {
      const e = codes[i];
      if (e !== null && typeof e === 'object' && typeof e.id === 'string') out.add(e.id);
    }
    return out;
  } catch {
    return new Set(); // entrada hostil: nada es válido
  }
}
