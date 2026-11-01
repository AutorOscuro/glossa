// @purpose: Léxico básico del Diccionario (2.9-T4): convierte content/taxonomy/lemmas.json en entradas buscables (lema, banda y formas) y las mezcla con el léxico de los paquetes.
// Diccionario básico del M1 (decisión del Administrador, 2026-11-01). Sin DOM; el `fetch` se inyecta.
//   lemmaEntries(table) → LexEntry básicas { lemma, band, pos, derivation, basic: true }   (`derivation` = formas flexionadas: «went» encuentra «go»). Sin traducción: `es` = [].
//   mergeLexicon(packEntries, basicEntries) → lista: primero las de los paquetes; una básica solo entra si su lema no está ya en un paquete (la entrada con traducción manda).
//   createLemmaLexicon({ fetchFn?, log? }) → { load() → Promesa de entradas básicas }   NUNCA rechaza: sin red o con un archivo dañado da [] y lo anota; un fallo NO se queda guardado (se reintenta).
// Qué NO hace: no marca ninguna palabra como «conocida» (eso depende de `words` en 4.1) y no inventa traducciones.
import { loadLemmas } from '../core/lemmas.js';

export const BASIC_LEXICON = Object.freeze({ bandLabels: Object.freeze({ '1K': '1K', '2K': '2K', '3K': '3K' }) });

export function lemmaEntries(table) {
  if (!table || typeof table.entries !== 'function') return [];
  return table.entries().map((e) => ({ lemma: e.lemma, band: e.band, pos: e.pos, derivation: e.forms.filter((f) => f !== e.lemma), es: [], basic: true }));
}

export function mergeLexicon(packEntries, basicEntries) {
  const out = [];
  const seen = new Set();
  for (const e of Array.isArray(packEntries) ? packEntries : []) {
    if (e && typeof e.lemma === 'string') { seen.add(e.lemma.toLowerCase()); out.push(e); }
  }
  for (const e of Array.isArray(basicEntries) ? basicEntries : []) {
    if (e && typeof e.lemma === 'string' && !seen.has(e.lemma.toLowerCase())) out.push(e);
  }
  return out;
}

export function createLemmaLexicon({ fetchFn = globalThis.fetch?.bind(globalThis), log = console.error } = {}) {
  let cached = null;
  return Object.freeze({
    async load() {
      if (cached) return cached;
      try {
        const r = await loadLemmas(fetchFn);
        if (!r.ok) { log('No se pudo leer la lista de palabras del diccionario', r.error); return []; }
        cached = lemmaEntries(r.table);
        return cached;
      } catch (e) { log('No se pudo preparar el diccionario básico', e); return []; }
    },
  });
}
