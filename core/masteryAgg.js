// @purpose: Agrega el dominio por nivel y por área y responde «en riesgo» y «a estudiar»: funciones puras sobre temas y resultados ya calculados.
// Agregación y consultas del dominio (subparte 1.7, tramo 3). Roadmap 7.5, 8.7 y 17. Sin lectura de datos: reciben la lista de temas
// (como en content/taxonomy/topics.json: { id, area, level, priority, min_items, status }, más `itemCount` opcional) y los resultados de `compute`.
//   weightOf(topic) → peso del tema en la media: `itemCount` si es un número ≥ 0; si no, `min_items`; si tampoco, 0. Peso 0 = no pesa.
//   aggregate(topics, results, { by: 'level'|'area', config? }) → { by, groups: [grupo], all: grupo, skipped: [id] }
//     grupo = { key, topics, seen, weight, avg, pct, band, label, symbol, confidence }
//     avg = media ponderada (decimal) de los `pct` de los temas; los «Sin ver» entran con 0. pct = 0 si no se ha visto ninguno; si no, max(1, round(avg)).
//     seen = temas con respuestas. confidence = nivel medio (bajo 0, medio 1, alto 2) de los temas vistos con peso, ponderado, redondeado hacia abajo.
//     skipped = ids de temas sin el campo de agrupación (level o area); no entran en `groups` pero sí en `all`.
//   atRisk(topics, results, { config? }) → [{ topicId, reasons, pct, band, priority, R, E }] (razones: low_retention, recurrent_error, cap)
//   toStudy(topics, results, { config? }) → [{ topicId, pct, band, priority, seen }] ordenado por priority (1 = más urgente), pct y id
// `results` = lista de resultados de `mastery.compute` o un Map topicId → resultado. Un tema sin resultado cuenta como «Sin ver».
import { MASTERY_CONFIG } from './mastery.config.js';
import { bandOf, bandIndex } from './mastery.js';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const validNum = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const LEVEL_OF = { low: 0, mid: 1, high: 2 };
const CONF = ['low', 'mid', 'high'];
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function assertTopics(topics, who) {
  if (!Array.isArray(topics)) throw new Error(`${who}: topics debe ser una lista`);
  for (const t of topics) if (!isObj(t) || typeof t.id !== 'string' || t.id === '') throw new Error(`${who}: cada tema debe ser un objeto con id de texto`);
}
function resultMap(results, who) {
  if (results instanceof Map) return results;
  if (!Array.isArray(results)) throw new Error(`${who}: results debe ser una lista o un Map`);
  return new Map(results.filter((r) => isObj(r) && typeof r.topicId === 'string').map((r) => [r.topicId, r]));
}
const seenOf = (r) => isObj(r) && Number.isFinite(r.evidence) && r.evidence > 0;
const pctOf = (r) => (seenOf(r) && Number.isFinite(r.pct) ? r.pct : 0);

export function weightOf(topic) {
  if (!isObj(topic)) return 0;
  if (validNum(topic.itemCount)) return topic.itemCount;
  return validNum(topic.min_items) ? topic.min_items : 0;
}

function summarize(key, list, map, config) {
  let weight = 0, sum = 0, seen = 0, cw = 0, cs = 0;
  for (const t of list) {
    const r = map.get(t.id);
    const w = weightOf(t);
    weight += w;
    sum += w * pctOf(r);
    if (seenOf(r)) {
      seen += 1;
      cw += w;
      cs += w * (LEVEL_OF[r.confidence] ?? 0);
    }
  }
  const avg = weight > 0 ? sum / weight : 0;
  const pct = seen === 0 ? 0 : Math.max(1, Math.min(100, Math.round(avg)));
  const band = bandOf(pct, config);
  const confidence = cw > 0 ? CONF[Math.floor(cs / cw + 1e-9)] : 'low';
  return { key, topics: list.length, seen, weight, avg, pct, band: band.id, label: band.label, symbol: band.symbol, confidence };
}

function orderKeys(keys, by, config) {
  if (by === 'area') return keys; // áreas: orden de primera aparición en la lista de temas
  const rank = (k) => { const i = config.levels.indexOf(k); return i === -1 ? Infinity : i; };
  return keys.slice().sort((a, b) => cmp(rank(a), rank(b)) || cmp(a, b));
}

export function aggregate(topics, results, { by, config = MASTERY_CONFIG } = {}) {
  assertTopics(topics, 'aggregate');
  if (by !== 'level' && by !== 'area') throw new Error("aggregate: `by` debe ser 'level' o 'area'");
  const map = resultMap(results, 'aggregate');
  const groups = new Map();
  const skipped = [];
  for (const t of topics) {
    const k = t[by];
    if (typeof k !== 'string' || k === '') { skipped.push(t.id); continue; }
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(t);
  }
  return {
    by,
    groups: orderKeys([...groups.keys()], by, config).map((k) => summarize(k, groups.get(k), map, config)),
    all: summarize('all', topics, map, config),
    skipped,
  };
}

const usable = (t) => t.status !== 'deprecated';
const prioOf = (p) => (Number.isFinite(p) ? p : Infinity);

export function atRisk(topics, results, { config = MASTERY_CONFIG } = {}) {
  assertTopics(topics, 'atRisk');
  const map = resultMap(results, 'atRisk');
  const out = [];
  for (const t of topics) {
    const r = map.get(t.id);
    if (!usable(t) || !seenOf(r)) continue;
    const s = isObj(r.signals) ? r.signals : {};
    const reasons = [];
    if (typeof s.R === 'number' && s.R < config.atRisk.retention) reasons.push('low_retention');
    if (typeof s.E === 'number' && s.E > 0) reasons.push('recurrent_error');
    if (Array.isArray(r.caps) && r.caps.length > 0) reasons.push('cap');
    if (reasons.length > 0) out.push({ topicId: t.id, reasons, pct: pctOf(r), band: r.band, priority: t.priority ?? null, R: s.R ?? null, E: s.E ?? 0 });
  }
  return out.sort((a, b) => (b.reasons.length - a.reasons.length) || (a.pct - b.pct) || cmp(a.topicId, b.topicId));
}

export function toStudy(topics, results, { config = MASTERY_CONFIG } = {}) {
  assertTopics(topics, 'toStudy');
  const map = resultMap(results, 'toStudy');
  const top = bandIndex(config.bands.find((b) => b.id === config.toStudy.maxBand)?.max ?? 0, config);
  const out = [];
  for (const t of topics) {
    if (!usable(t)) continue;
    const r = map.get(t.id);
    const pct = pctOf(r);
    if (bandIndex(pct, config) > top) continue;
    out.push({ topicId: t.id, pct, band: bandOf(pct, config).id, priority: t.priority ?? null, seen: seenOf(r) });
  }
  return out.sort((a, b) => cmp(prioOf(a.priority), prioOf(b.priority)) || (a.pct - b.pct) || cmp(a.topicId, b.topicId));
}
