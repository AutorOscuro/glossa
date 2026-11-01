// @purpose: Catálogo consultable de códigos de error, construido a partir de error_codes.json.
// Catálogo de códigos de error consultable (subparte 1.6, cuarto 1). Roadmap 8.8 y 1.6. Puro: sin DOM, sin base de datos, sin archivos.
// Recibe el JSON ya leído de `content/taxonomy/error_codes.json` (quien lo carga —la app con fetch, las pruebas con fs— no es asunto de core/).
//
//   createErrorCatalog(input) → catálogo CONGELADO
//     Lanza Error en español si el archivo no pasa `validateErrorCodes` (1.3): un catálogo roto no se usa a medias.
//     catalog.size                      número de códigos
//     catalog.ids()                     ids en el orden del archivo (copia)
//     catalog.has(id) → boolean         nunca lanza (id no texto → false)
//     catalog.get(id) → entrada | null  COPIA profunda y congelada con los 9 campos (los opcionales ausentes salen como null / [])
//     catalog.all() → entrada[]         copias congeladas, en el orden del archivo
//     catalog.hint(id) → string | null  la `pista_corta_es` (microexplicación para mostrar al fallar)
//     catalog.byTopic(topicId) → id[]   códigos cuyo `temas_relacionados` incluye ese tema (orden del archivo)
//     catalog.incomplete() → [{ id, missing: [campo…] }]   códigos a los que les falta algún campo (vacío = catálogo completo)
//     catalog.isComplete() → boolean
//   COMPLETE_FIELDS: los 8 campos que debe traer cada código para considerarlo «completo» (CA 1 de la 1.6; `id` va siempre).
import { validateErrorCodes } from './contentCodes.js';

export const COMPLETE_FIELDS = Object.freeze([
  'titulo_es', 'descripcion_es', 'origen_tipico', 'impacto_defecto', 'temas_relacionados', 'ejemplo_malo', 'ejemplo_bueno', 'pista_corta_es',
]);

const blank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);

function freezeEntry(raw) {
  return Object.freeze({
    id: raw.id,
    titulo_es: raw.titulo_es,
    descripcion_es: raw.descripcion_es ?? null,
    origen_tipico: raw.origen_tipico ?? null,
    impacto_defecto: raw.impacto_defecto ?? null,
    temas_relacionados: Object.freeze([...(raw.temas_relacionados ?? [])]),
    ejemplo_malo: raw.ejemplo_malo ?? null,
    ejemplo_bueno: raw.ejemplo_bueno ?? null,
    pista_corta_es: raw.pista_corta_es ?? null,
  });
}

export function createErrorCatalog(input) {
  const v = validateErrorCodes(input);
  if (!v.ok) {
    const first = v.errors.slice(0, 3).map((e) => `${e.path || '(raíz)'}: ${e.message}`).join('; ');
    throw new Error(`createErrorCatalog: el catálogo de errores no es válido (${first}${v.errorTotal > 3 ? ` y ${v.errorTotal - 3} más` : ''})`);
  }
  const entries = input.codes.map((raw) => freezeEntry(raw));
  const byId = new Map(entries.map((e) => [e.id, e]));
  const topicIndex = new Map();
  for (const e of entries) {
    for (const t of e.temas_relacionados) {
      if (!topicIndex.has(t)) topicIndex.set(t, []);
      topicIndex.get(t).push(e.id);
    }
  }
  const missingOf = (raw) => COMPLETE_FIELDS.filter((f) => blank(raw[f]));
  const gaps = input.codes.map((raw) => ({ id: raw.id, missing: missingOf(raw) })).filter((g) => g.missing.length > 0);

  return Object.freeze({
    size: entries.length,
    ids: () => entries.map((e) => e.id),
    has: (id) => typeof id === 'string' && byId.has(id),
    get: (id) => (typeof id === 'string' ? byId.get(id) ?? null : null), // ya es inmutable: se puede compartir sin copiar
    all: () => [...entries],
    hint: (id) => (typeof id === 'string' ? byId.get(id)?.pista_corta_es ?? null : null),
    byTopic: (topicId) => (typeof topicId === 'string' ? [...(topicIndex.get(topicId) ?? [])] : []),
    incomplete: () => gaps.map((g) => ({ id: g.id, missing: [...g.missing] })),
    isComplete: () => gaps.length === 0,
  });
}
