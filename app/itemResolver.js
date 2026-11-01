// @purpose: Resolvedor de ítems: lee el índice y los paquetes de content/ (por el service worker, también sin conexión) y entrega el ítem por su id al registro de ejercicios.
// Resolvedor de ítems (subparte 2.9-T3, punto 4). Roadmap 8.10 y 17. Sin DOM; el `fetch` se inyecta.
//   createItemResolver({ fetchFn?, log? }) → { resolve(itemId) → Promesa del ítem | null, preload() → Promesa de Map, byTopics(topicIds) → Promesa de ítems, lexicon() → Promesa de LexEntry, reset() }
//     · La primera vez lee `content/index.json` y cada paquete con `loadPack` (que valida el paquete completo) y arma un mapa id → ítem. Luego sale de la memoria.
//     · Nunca rechaza en `resolve`: un id desconocido, un índice que falta o un paquete dañado dan `null` (el registro lo explica con «Saltar por ahora»).
//     · Un fallo NO se queda guardado: si el índice no cargó o algún paquete falló, la siguiente llamada vuelve a intentarlo (el resto de paquetes sí se usa mientras tanto).
//     · `byTopics` (2.9-T3, punto 5): los ítems cuyo `topics` toca alguno de esos temas (para Otros ejemplos); sin temas o con un fallo de lectura da []. Nunca rechaza.
//     · `lexicon` (2.9-T3, punto 5): el `lexicon` de todos los paquetes leídos (para el Diccionario); con un lema repetido manda el primero; un paquete sin léxico no aporta nada (el semilla no trae). Nunca rechaza.
//     · Las historias tienen otro espacio de ids y las usará 6.x. Con un id repetido manda el primero del índice.
import { loadIndex, loadPack } from '../core/content.js';

export function createItemResolver({ fetchFn = globalThis.fetch?.bind(globalThis), log = console.error } = {}) {
  let loading = null;
  let lexicon = [];

  async function build() {
    if (typeof fetchFn !== 'function') throw new Error('Sin fetch: no se puede leer el contenido');
    const idx = await loadIndex(fetchFn);
    if (!idx.ok) throw new Error(`No se pudo leer el índice de contenido (${idx.error?.code ?? 'desconocido'})`);
    const items = new Map();
    const words = new Map();
    let failed = 0;
    for (const entry of idx.index.packs ?? []) {
      const r = await loadPack(entry, fetchFn);
      if (!r.ok) { failed += 1; log(`No se pudo cargar el paquete ${entry?.pack_id}`, r.error); continue; }
      for (const it of r.pack.items ?? []) if (it && typeof it.id === 'string' && !items.has(it.id)) items.set(it.id, it);
      for (const w of r.pack.lexicon ?? []) if (w && typeof w.lemma === 'string' && !words.has(w.lemma)) words.set(w.lemma, w);
    }
    return { items, words, failed };
  }

  function preload() {
    if (!loading) {
      loading = build().then(({ items, words, failed }) => {
        lexicon = [...words.values()];
        if (failed > 0) loading = null; // se reintenta la próxima vez
        return items;
      }, (e) => { loading = null; throw e; });
    }
    return loading;
  }

  return Object.freeze({
    preload,
    reset() { loading = null; },
    async byTopics(topicIds) {
      const ids = new Set((Array.isArray(topicIds) ? topicIds : []).filter((t) => typeof t === 'string' && t !== ''));
      if (ids.size === 0) return [];
      try { return [...(await preload()).values()].filter((it) => Array.isArray(it.topics) && it.topics.some((t) => ids.has(t))); } catch (e) { log('No se pudieron leer los ítems por tema', e); return []; }
    },
    async lexicon() {
      try { await preload(); return lexicon.slice(); } catch (e) { log('No se pudo leer el léxico', e); return []; }
    },
    async resolve(itemId) {
      if (typeof itemId !== 'string' || itemId === '') return null;
      try { return (await preload()).get(itemId) ?? null; } catch (e) { log('No se pudo leer el ítem de contenido', e); return null; }
    },
  });
}
