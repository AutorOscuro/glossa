// @purpose: Enfoque «detective de errores» del armador de sesiones (T4): puntúa los errores propios y los convierte en pesos por ítem y por tema.
// Enfoque en errores (subparte 1.8, tramo 4). Roadmap 1.8 regla 8. Función PURA.
//   errorTargets(errors) → { byItem: Map<itemId, score>, byTopic: Map<tema, score>, used, ignored }
//     errors: registros de core/errors.js (los que da `errors` de la base). score = veces (`count`, ≥ 1) × peso del impacto (low 1, mid 2, high 3).
//     Un registro con `itemId` puntúa a ese ítem; uno SIN `itemId` (p. ej. venido del chat) puntúa a cada uno de sus temas. Un registro ilegible se ignora.
import { IMPACT_RANK } from './errors.js';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function errorTargets(errors) {
  if (!Array.isArray(errors)) throw new Error('session.build: errors debe ser una lista de registros de errores');
  const byItem = new Map();
  const byTopic = new Map();
  let used = 0;
  let ignored = 0;
  for (const rec of errors) {
    if (!isObj(rec) || typeof rec.code !== 'string' || rec.code === '') { ignored += 1; continue; }
    const times = Number.isInteger(rec.count) && rec.count >= 1 ? rec.count : 1;
    const score = times * (IMPACT_RANK[rec.impact] ?? IMPACT_RANK.low);
    if (typeof rec.itemId === 'string' && rec.itemId !== '') { byItem.set(rec.itemId, (byItem.get(rec.itemId) ?? 0) + score); used += 1; continue; }
    const topics = Array.isArray(rec.topics) ? rec.topics.filter((t) => typeof t === 'string' && t !== '') : [];
    if (topics.length === 0) { ignored += 1; continue; }
    for (const t of new Set(topics)) byTopic.set(t, (byTopic.get(t) ?? 0) + score);
    used += 1;
  }
  return { byItem, byTopic, used, ignored };
}
