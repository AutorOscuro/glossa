// @purpose: Resumen de los paquetes ya instalados, para que el validador detecte ids repetidos entre paquetes.
// Paquetes ya instalados, vistos por el validador (subparte 1.3, cuarto 3, mitad 3A, parte 2). Roadmap 1.3 (ids únicos globales, avisos por tema). Puro.
//   summarizePack(pack) → resumen | null   lo mínimo de un paquete que el resto necesita saber: nunca lanza ni modifica la entrada
//   installedIndex(resúmenes, exceptPackId?) → { items, lexicon, stories, topics }   índices para consultar rápido (nunca lanza)
// Un RESUMEN es un objeto simple y serializable (el CLI y el cargador lo guardan o lo recalculan al leer `content/packs/`):
//   { pack_id, version, items: [id…], lexicon: [id…], stories: [id…], topics: { [temaId]: { count, types: [tipo…] } } }
// `items` junta los ítems del paquete y las preguntas de sus historias (comparten espacio de ids, como en `validatePack`); `lexicon` y `stories`
// son otros espacios, porque son otras entidades. `topics` cuenta cuántos ítems usan cada tema y de qué tipos (para el aviso de ≥ 12 ítems y ≥ 3 tipos).
// El validador pasa `ctx.installed` = lista de resúmenes y usa `installedIndex(ctx.installed, pack.pack_id)`: el paquete que se está validando
// NO choca con su propia versión instalada (misma `pack_id` = reemplazo, regla de `add-pack`).
import { PACK_LIMITS, STORY_QUESTIONS_MAX, isPlain } from './contentCommon.js';

const MAX_INSTALLED = 1000; // paquetes que se consultan como máximo
const MAX_ITEMS = PACK_LIMITS.items + PACK_LIMITS.stories * STORY_QUESTIONS_MAX;

// Lee un objeto una sola vez; si es hostil (getter que falla) devuelve null.
function read(o) {
  try { return isPlain(o) ? { ...o } : null; } catch { return null; }
}
const items = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
const ids = (list, max) => {
  const out = [];
  for (const raw of items(list, max)) {
    const e = read(raw);
    if (e && typeof e.id === 'string') out.push(e.id);
  }
  return out;
};

export function summarizePack(pack) {
  try {
    const p = read(pack);
    if (!p || typeof p.pack_id !== 'string') return null;
    const stats = new Map(); // tema → { count, types:Set }
    const count = (raw) => {
      const it = read(raw);
      if (!it) return;
      const type = typeof it.type === 'string' ? it.type : null;
      for (const t of new Set(items(it.topics, 5).filter((x) => typeof x === 'string'))) {
        if (!stats.has(t)) stats.set(t, { count: 0, types: new Set() });
        const s = stats.get(t);
        s.count += 1;
        if (type) s.types.add(type);
      }
    };
    const itemIds = ids(p.items, PACK_LIMITS.items);
    items(p.items, PACK_LIMITS.items).forEach(count);
    const storyIds = [];
    for (const raw of items(p.stories, PACK_LIMITS.stories)) {
      const s = read(raw);
      if (!s) continue;
      if (typeof s.id === 'string') storyIds.push(s.id);
      itemIds.push(...ids(s.questions, STORY_QUESTIONS_MAX));
      items(s.questions, STORY_QUESTIONS_MAX).forEach(count);
    }
    const topics = {};
    for (const t of [...stats.keys()].sort()) topics[t] = { count: stats.get(t).count, types: [...stats.get(t).types].sort() };
    return {
      pack_id: p.pack_id,
      version: Number.isInteger(p.version) ? p.version : null,
      items: itemIds,
      lexicon: ids(p.lexicon, PACK_LIMITS.lexicon),
      stories: storyIds,
      topics,
    };
  } catch {
    return null; // entrada hostil: no hay resumen
  }
}

// Índices de consulta. Con un id repetido entre paquetes instalados manda el primero. Un resumen ilegible (hostil) se ignora entero; en uno legible, un tema con datos raros se salta y los demás valen.
export function installedIndex(summaries, exceptPackId = null) {
  const out = { items: new Map(), lexicon: new Map(), stories: new Map(), topics: new Map() };
  if (!Array.isArray(summaries)) return out;
  for (const raw of summaries.slice(0, MAX_INSTALLED)) {
    try {
      const s = read(raw);
      if (!s || typeof s.pack_id !== 'string' || s.pack_id === exceptPackId) continue;
      const part = { items: new Map(), lexicon: new Map(), stories: new Map(), topics: new Map() };
      for (const key of ['items', 'lexicon', 'stories']) {
        for (const id of items(s[key], MAX_ITEMS)) if (typeof id === 'string') part[key].set(id, s.pack_id);
      }
      const topics = read(s.topics) || {};
      for (const t of Object.keys(topics)) {
        const e = read(topics[t]);
        if (!e || !Number.isInteger(e.count) || e.count < 0) continue;
        part.topics.set(t, { count: e.count, types: new Set(items(e.types, 200).filter((x) => typeof x === 'string')) });
      }
      for (const key of ['items', 'lexicon', 'stories']) for (const [id, pid] of part[key]) if (!out[key].has(id)) out[key].set(id, pid);
      for (const [t, e] of part.topics) {
        const cur = out.topics.get(t);
        if (!cur) out.topics.set(t, { count: e.count, types: new Set(e.types) });
        else { cur.count += e.count; for (const ty of e.types) cur.types.add(ty); }
      }
    } catch { /* resumen hostil: se ignora entero; los demás siguen valiendo */ }
  }
  return out;
}
