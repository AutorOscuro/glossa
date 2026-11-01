// @purpose: Fuente de «Correcciones» (2.7-T2): reúne los errores propios de la persona que tocan el ítem o el tema del ejercicio y da su cuenta exacta para la insignia.
// Pegamento sin DOM entre la vista de sesión y core/errors.js. Un error cuenta UNA vez aunque case por ítem y por tema (la cuenta son registros distintos, no ocurrencias).
//
//   createCorrectionsSource({ errors, catalog? }) → { forEntry(entry) → Promesa de { corrections, count } }
//     errors    createErrors(...) de core/errors.js (usa `list`). Obligatorio.
//     catalog   createErrorCatalog(...) opcional: añade el título y la pista corta de cada código.
//     entry     el ítem del plan { itemId, topic, topics, … }. Un error entra si su `itemId` es el del ejercicio o si comparte algún tema.
//   corrections[i] = { id, original, correction, code, title, hint, count, last, own }  — `own` es true si el error es de ESTE ítem; esos van primero, luego el más reciente.
//   Si `errors.list` falla, la promesa se rechaza: la hoja lo cuenta sin culpa y el ejercicio no se toca.
export function createCorrectionsSource({ errors, catalog = null } = {}) {
  if (!errors || typeof errors.list !== 'function') throw new Error('createCorrectionsSource: errors debe tener list()');
  const text = (v) => (typeof v === 'string' && v.trim() !== '' ? v : null);
  return Object.freeze({
    async forEntry(entry) {
      const own = entry !== null && typeof entry === 'object' ? entry : {};
      const ids = new Set([...(Array.isArray(own.topics) ? own.topics : []), own.topic].filter((t) => typeof t === 'string' && t !== ''));
      const itemId = typeof own.itemId === 'string' && own.itemId !== '' ? own.itemId : null;
      if (ids.size === 0 && itemId === null) return { corrections: [], count: 0 };
      const all = await errors.list({});
      const seen = new Set();
      const corrections = [];
      for (const r of Array.isArray(all) ? all : []) {
        if (!r || typeof r !== 'object' || seen.has(r.id)) continue;
        const mine = itemId !== null && r.itemId === itemId;
        if (!mine && !(Array.isArray(r.topics) && r.topics.some((t) => ids.has(t)))) continue;
        seen.add(r.id);
        const entryCode = catalog && typeof catalog.get === 'function' ? catalog.get(r.code) : null;
        corrections.push({
          id: r.id, original: r.original, correction: text(r.correction), code: r.code,
          title: text(entryCode?.titulo_es), hint: text(entryCode?.pista_corta_es),
          count: Number.isInteger(r.count) && r.count >= 1 ? r.count : 1, last: r.ts ?? null, own: mine,
        });
      }
      // `list` ya viene del más reciente al más antiguo; el orden es estable, así que solo subimos los del propio ítem.
      corrections.sort((a, b) => Number(b.own) - Number(a.own));
      return { corrections, count: corrections.length };
    },
  });
}
