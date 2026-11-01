// @purpose: Búsqueda local en el léxico (2.7-T4): encuentra entradas por lema, traducción o derivados sin distinguir mayúsculas ni acentos; función pura, nunca lanza.
// Subparte 2.7-T4, primera parte. Puro: sin DOM, sin base, sin reloj. Las entradas son LexEntry (core/contentLex.js, roadmap 8.11); quién las carga (paquetes) lo cablea 2.9-T3 / 4.1.
//
//   createLexSearch(entries, { limit? = 20 }) → { size, search(query, { limit? }) → { query, found, results, reason } }
//     Se indexa una vez: lema, cada traducción `es` y cada forma de `derivation`, normalizados con core/normalize.js (minúsculas, sin acentos, espacios limpios).
//     Nota: quitar acentos también junta ñ con n («ano» encuentra «año»): es la tolerancia buscada; el orden pone antes lo exacto.
//     results[i] = { entry, match: 'exact' | 'prefix' | 'contains', via: 'lemma' | 'es' | 'derivation' }, de mejor a peor (exacto, prefijo, contiene; a igualdad, lema antes que traducción y derivado; luego orden alfabético del lema).
//     reason: null si hay resultados; 'empty' (consulta vacía), 'short' (una sola letra: no se busca por contiene), 'none' (no hay nada: ahí la hoja ofrece «añadir»).
//     Entradas que no son objetos con `lemma` de texto se ignoran sin lanzar; `entries` que no es lista da un índice vacío.
import { normalize } from './normalize.js';

export const LEX_SEARCH = Object.freeze({ limit: 20, maxQuery: 80 });
const fold = (s) => normalize(s, { stripDiacritics: true });
const VIA_ORDER = { lemma: 0, es: 1, derivation: 2 };
const MATCH_ORDER = { exact: 0, prefix: 1, contains: 2 };

export function createLexSearch(entries, { limit = LEX_SEARCH.limit } = {}) {
  const defaultLimit = Number.isInteger(limit) && limit >= 1 ? Math.min(limit, 200) : LEX_SEARCH.limit;
  const rows = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (entry === null || typeof entry !== 'object' || typeof entry.lemma !== 'string' || entry.lemma.trim() === '') continue;
    const add = (via, value) => { if (typeof value === 'string') { const key = fold(value); if (key !== '') rows.push({ entry, via, key }); } };
    add('lemma', entry.lemma);
    for (const v of Array.isArray(entry.es) ? entry.es : []) add('es', v);
    for (const v of Array.isArray(entry.derivation) ? entry.derivation : []) add('derivation', v);
  }
  const lemmaKey = (e) => fold(e.lemma);

  function search(query, { limit: own } = {}) {
    const max = Number.isInteger(own) && own >= 1 ? Math.min(own, 200) : defaultLimit;
    const q = fold(typeof query === 'string' ? query.slice(0, LEX_SEARCH.maxQuery) : '');
    const none = (reason) => ({ query: q, found: false, results: [], reason });
    if (q === '') return none('empty');
    const best = new Map(); // una entrada sale una vez, con su mejor coincidencia
    for (const r of rows) {
      let match = null;
      if (r.key === q) match = 'exact';
      else if (r.key.startsWith(q)) match = 'prefix';
      else if (q.length >= 2 && r.key.includes(q)) match = 'contains';
      if (!match) continue;
      const prev = best.get(r.entry);
      if (!prev || MATCH_ORDER[match] < MATCH_ORDER[prev.match] || (match === prev.match && VIA_ORDER[r.via] < VIA_ORDER[prev.via])) best.set(r.entry, { entry: r.entry, match, via: r.via });
    }
    if (best.size === 0) return none(q.length < 2 ? 'short' : 'none');
    const results = [...best.values()]
      .sort((a, b) => MATCH_ORDER[a.match] - MATCH_ORDER[b.match] || VIA_ORDER[a.via] - VIA_ORDER[b.via] || lemmaKey(a.entry).localeCompare(lemmaKey(b.entry)))
      .slice(0, max);
    return { query: q, found: true, results, reason: null };
  }
  return Object.freeze({ size: new Set(rows.map((r) => r.entry)).size, search });
}
