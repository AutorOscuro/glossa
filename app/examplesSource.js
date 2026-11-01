// @purpose: Fuente de «Otros ejemplos» (2.7-T1): pide al cargador los ítems del tema del ejercicio y arma la lista con core/otherExamples.js.
// Pegamento sin DOM entre la vista de sesión y el contenido. El cargador real de ítems llega con 2.9-T3 (`importPacksToDb` y el resolvedor de ítems); hasta entonces nadie crea esta fuente en la app.
//
//   createExamplesSource({ loadItems, topics? }) → { forEntry(entry, { excludeItemIds? }) → Promesa del resultado de collectExamples }
//     loadItems(topicIds) → Promesa de la lista de ítems de contenido que traen alguno de esos temas (puede incluir el ítem actual).
//     topics              la taxonomía (`topics.json`): de ahí salen los ejemplos de teoría (`theory.examples`) cuando el tema los trae.
//     entry               el ítem del plan de la sesión { itemId, topic, topics, … }; sin temas devuelve un resultado vacío.
//   Si loadItems falla, la promesa se rechaza con ese error: la hoja lo cuenta sin culpa y el ejercicio no se toca.
import { collectExamples } from '../core/otherExamples.js';

export function createExamplesSource({ loadItems, topics = [] } = {}) {
  if (typeof loadItems !== 'function') throw new Error('createExamplesSource: loadItems debe ser una función');
  const taxonomy = Array.isArray(topics) ? topics : [];
  return Object.freeze({
    async forEntry(entry, { excludeItemIds = [] } = {}) {
      const own = entry !== null && typeof entry === 'object' ? entry : {};
      const ids = [...new Set([...(Array.isArray(own.topics) ? own.topics : []), own.topic].filter((t) => typeof t === 'string' && t !== ''))];
      if (ids.length === 0) return collectExamples({});
      const loaded = await loadItems(ids);
      const items = Array.isArray(loaded) ? loaded : [];
      const currentItem = items.find((i) => i !== null && typeof i === 'object' && i.id === own.itemId) ?? null;
      return collectExamples({ topicIds: ids, topics: taxonomy.filter((t) => ids.includes(t?.id)), items, currentItem, excludeItemIds });
    },
  });
}
