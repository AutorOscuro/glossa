// @purpose: Palabras que la persona ya domina (1.11-T2): une la lista A1, las palabras marcadas known o learning y los lemas de los ítems de temas con dominio suficiente.
// Conjunto de lemas conocidos (subparte 1.11, tramo T2). Contrato: docs/CONTRACTS.md, entrada 1.11-T2. T3 lo usa en `check`.
//
//   knownLemmasDetailed(db, opts) → Promise<{ lemmas:Set<string>, bySource:{ base, words, topics }, topicsUsed:string[], topicsSkipped:[{ topic, reason }], unknown:Set<string> }>
//   knownLemmas(db, opts)         → Promise<Set<string>>        (solo el conjunto; es lo que recibe `check`)
//
//   opts = {
//     table,        OBLIGATORIO: LemmaTable de core/lemmas.js
//     mastery,      { compute(topicId, now) → { pct } } (createMastery). Sin él, la fuente «temas» no se usa.
//     items,        arreglo de ítems de los paquetes, o función (async) que lo devuelve. Un ítem trae `id`, `topics` y, si lo tiene, `prompt_en` y `accept`.
//                   Los paquetes no viven en la base: quien llama los carga con `content.loadPack`. Sin ítems, la fuente «temas» no se usa.
//     threshold,    pct mínimo de dominio de un tema (por defecto KNOWN_TOPIC_THRESHOLD = 60)
//     base,         lista A1 (por defecto A1_BASE); false la apaga
//     now,          instante para `mastery.compute`
//   }
//
// Fuentes: (1) base A1; (2) almacén `words` con estado known o learning (el id es el lema; se añade tal cual, esté o no en la tabla);
// (3) lemas de `prompt_en` y `accept` de los ítems de cada tema con dominio ≥ umbral. Los distractores no cuentan (son respuestas malas).
// Una palabra con estado `unknown` en `words` se QUITA de las tres fuentes: es lo que la persona dijo explícitamente.
// Una forma con varios lemas añade todos (`left` → leave y left). Errores de la base se propagan; un tema cuyo dominio no se pudo calcular se
// salta y queda en `topicsSkipped` (nunca se da por sabido lo que no se pudo medir).
import { tokenize } from './tokenize.js';
import { KNOWN_TOPIC_THRESHOLD, A1_BASE } from './whitelist.config.js';

const norm = (s) => (typeof s === 'string' ? s.trim().toLowerCase() : '');

function addTextLemmas(table, text, into) {
  for (const tok of tokenize(text)) for (const { lemmas } of table.analyze(tok).parts) for (const l of lemmas) into.add(l);
}
function englishOf(item) {
  const out = [];
  if (typeof item.prompt_en === 'string') out.push(item.prompt_en);
  if (Array.isArray(item.accept)) for (const a of item.accept) if (typeof a === 'string') out.push(a);
  return out;
}

export async function knownLemmasDetailed(db, opts = {}) {
  if (!db || typeof db.query !== 'function') throw new Error('knownLemmas: falta la base de datos (db.query)');
  const { table, mastery } = opts;
  if (!table || typeof table.analyze !== 'function') throw new Error('knownLemmas: falta la tabla de lemas (opts.table)');
  if (mastery !== undefined && (!mastery || typeof mastery.compute !== 'function')) throw new Error('knownLemmas: `mastery` debe tener compute()');
  const threshold = opts.threshold === undefined ? KNOWN_TOPIC_THRESHOLD : opts.threshold;
  if (typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold < 0 || threshold > 100) throw new Error('knownLemmas: el umbral debe ser un número de 0 a 100');
  const base = opts.base === false ? [] : (opts.base === undefined ? A1_BASE : opts.base);
  if (!Array.isArray(base)) throw new Error('knownLemmas: la lista base debe ser un arreglo');

  const sources = { base: new Set(), words: new Set(), topics: new Set() };
  for (const l of base) { const n = norm(l); if (n) sources.base.add(n); }

  const unknown = new Set();
  const rows = (state) => db.query('words', { index: 'state', value: state });
  for (const state of ['known', 'learning']) {
    for (const w of await rows(state)) { const id = norm(w && w.id); if (id) sources.words.add(id); }
  }
  for (const w of await rows('unknown')) { const id = norm(w && w.id); if (id) unknown.add(id); }

  const topicsUsed = [];
  const topicsSkipped = [];
  let items = opts.items;
  if (typeof items === 'function') items = await items();
  if (mastery && Array.isArray(items)) {
    const byTopic = new Map();
    for (const it of items) {
      if (!it || typeof it !== 'object' || !Array.isArray(it.topics)) continue;
      for (const t of it.topics) if (typeof t === 'string' && t !== '') { if (!byTopic.has(t)) byTopic.set(t, []); byTopic.get(t).push(it); }
    }
    for (const topic of [...byTopic.keys()].sort()) {
      let pct;
      try { ({ pct } = await mastery.compute(topic, opts.now)); } catch { topicsSkipped.push({ topic, reason: 'compute' }); continue; }
      if (typeof pct !== 'number' || !Number.isFinite(pct)) { topicsSkipped.push({ topic, reason: 'pct' }); continue; }
      if (pct < threshold) continue;
      topicsUsed.push(topic);
      for (const it of byTopic.get(topic)) for (const text of englishOf(it)) addTextLemmas(table, text, sources.topics);
    }
  }

  const lemmas = new Set();
  for (const set of [sources.base, sources.words, sources.topics]) for (const l of set) if (!unknown.has(l)) lemmas.add(l);
  return { lemmas, bySource: sources, topicsUsed, topicsSkipped, unknown };
}

export async function knownLemmas(db, opts = {}) {
  return (await knownLemmasDetailed(db, opts)).lemmas;
}
