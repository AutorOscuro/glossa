// @purpose: Validación estricta de un Pack de contenido completo (temas, ítems, léxico e historias).
// Validación estricta de un Pack de contenido (subparte 1.3, cuarto 1, mitad B). Roadmap 8.10. Puro: no lee archivos.
//   validatePack(input, ctx?) → { ok, errors, warnings, errorTotal, warningTotal }   (nunca lanza; no modifica la entrada)
//   checkPack(report, path, input, ctx?)   escribe en un informe existente (el CLI usa `archivo.json` como ruta base).
// `ctx` (todo opcional; lo pasa a cada ítem, entrada y historia): errorCodes (Set), topicIds (Set), dataSpecs ({ familia: especificación }), y para
// las reglas que miran fuera del paquete: topicInfo (Map de `topicInfo(topics.json)`) e installed (lista de `summarizePack` de los paquetes instalados).
// Dentro de un paquete: forma, ítems, léxico, historias, ids únicos y que cada ítem use un tema del paquete.
// Con `ctx.installed`: ids únicos GLOBALES (`DUPLICATE_INSTALLED`; el paquete no choca con su propia versión instalada, misma pack_id = reemplazo).
// Con `ctx.topicInfo`: por cada tema `active` que el paquete usa, aviso si entre este paquete y los instalados no suma `min_items` (12) ítems
// (`TOPIC_FEW_ITEMS`) o ≥ 3 tipos distintos (`TOPIC_FEW_TYPES`). Son avisos, no errores: un paquete parcial es legítimo (8.10, 1.3).
// Los ciclos de prerrequisitos y los ids de temas son del archivo de temas (`contentTaxonomy.js`), no del paquete.
import { LIMITS, createReport, joinPath, check, text, int, oneOf, idOf, list, obj, custom, optional } from './contentRules.js';
import { PACK_LIMITS, STORY_QUESTIONS_MAX, DEFAULT_MIN_ITEMS, MIN_TYPES_PER_TOPIC, isPlain, topicRef } from './contentCommon.js';
import { checkItem } from './contentItem.js';
import { checkLexEntry } from './contentLex.js';
import { checkStory } from './contentStory.js';
import { installedIndex } from './contentInstalled.js';

// `pack_id` va en el nombre del archivo: minúsculas, dígitos y guion bajo, empieza por letra (add-pack, 1.3).
export const PACK_ID_RE = /^[a-z][a-z0-9_]{2,59}$/;
export { PACK_LIMITS };
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const dateSpec = custom((r, path, v) => {
  if (typeof v !== 'string') { r.error(path, 'TYPE', 'debe ser texto'); return; }
  const m = DATE_RE.exec(v);
  const y = m ? Number(m[1]) : 0;
  const mo = m ? Number(m[2]) : 0;
  const d = m ? Number(m[3]) : 0;
  const iso = m ? new Date(Date.UTC(y, mo - 1, d)).toISOString().slice(0, 10) : '';
  if (!m || y < 2000 || iso !== v) { // ida y vuelta: 2026-02-30 se vuelve 2026-03-02 y no coincide
    r.error(path, 'FORMAT', 'formato no válido: debe ser una fecha real AAAA-MM-DD, p. ej. 2026-10-20');
  }
});

const PACK_SPEC = obj({
  schema: oneOf([1]),
  pack_id: idOf(PACK_ID_RE, 'un id de paquete como gram_perfect_tenses_v1 (minúsculas, dígitos y _; 3 a 60 caracteres)'),
  version: int(1, 9999),
  title_es: text(LIMITS.short),
  created: dateSpec,
  authors: text(LIMITS.short),
  license_note: text(LIMITS.short),
  topics: list(topicRef(), { min: 1, max: PACK_LIMITS.topics, unique: true }),
  items: list(custom((r, path, v, ctx) => checkItem(r, path, v, ctx)), { max: PACK_LIMITS.items }),
  lexicon: optional(list(custom((r, path, v, ctx) => checkLexEntry(r, path, v, ctx)), { max: PACK_LIMITS.lexicon })),
  stories: optional(list(custom((r, path, v, ctx) => checkStory(r, path, v, ctx)), { max: PACK_LIMITS.stories })),
});

// Lee un objeto una sola vez; si es hostil (getter que falla) devuelve null y la comprobación de forma ya informó UNREADABLE.
function read(o) {
  try { return isPlain(o) ? { ...o } : null; } catch { return null; }
}
const arr = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);

function crossChecks(r, path, v, ctx) {
  const p = read(v);
  if (!p) return;
  const topics = arr(p.topics, PACK_LIMITS.topics).filter((t) => typeof t === 'string');
  const inPack = new Set(topics);
  const used = new Set();
  const ids = new Map(); // id de ítem → dónde apareció primero ({ at, group })
  const inst = installedIndex(ctx && ctx.installed, typeof p.pack_id === 'string' ? p.pack_id : null);
  const stats = new Map(); // tema → { count, types:Set } de ESTE paquete (ítems y preguntas de historia)
  const installedDup = (map, id, at) => {
    if (map.has(id)) r.error(joinPath(at, 'id'), 'DUPLICATE_INSTALLED', `ya existe en el paquete instalado ${map.get(id)}`);
  };

  // Un ítem del paquete, o una pregunta de historia (group = la historia, para no repetir lo que ya informa checkStory).
  const examine = (raw, itemPath, group) => {
    const it = read(raw);
    if (!it) return;
    if (typeof it.id === 'string') {
      const first = ids.get(it.id);
      if (!first) { ids.set(it.id, { at: itemPath, group }); installedDup(inst.items, it.id, itemPath); }
      else if (group === null || first.group !== group) r.error(joinPath(itemPath, 'id'), 'DUPLICATE', `ya existe en ${first.at}`);
    }
    const seenTopics = new Set();
    arr(it.topics, 5).forEach((t, j) => {
      if (typeof t !== 'string') return;
      used.add(t);
      if (!seenTopics.has(t)) {
        seenTopics.add(t);
        if (!stats.has(t)) stats.set(t, { count: 0, types: new Set() });
        const st = stats.get(t);
        st.count += 1;
        if (typeof it.type === 'string') st.types.add(it.type);
      }
      if (!inPack.has(t)) r.error(joinPath(joinPath(itemPath, 'topics'), j), 'ITEM_TOPIC_NOT_IN_PACK', `el tema ${t} no está en la lista topics del paquete`);
    });
    if (it.source === 'ai_generated_unverified') r.warn(joinPath(itemPath, 'source'), 'AI_SOURCE_IN_PACK', 'un paquete debería traer contenido original; ai_generated_unverified es para lo creado en vivo por la IA');
  };

  let itemCount = 0;
  arr(p.items, PACK_LIMITS.items).forEach((it, i) => { itemCount += 1; examine(it, joinPath(joinPath(path, 'items'), i), null); });

  const lexSeen = new Map();
  arr(p.lexicon, PACK_LIMITS.lexicon).forEach((raw, i) => {
    const e = read(raw);
    if (!e || typeof e.id !== 'string') return;
    const ePath = joinPath(joinPath(path, 'lexicon'), i);
    if (lexSeen.has(e.id)) r.error(joinPath(ePath, 'id'), 'DUPLICATE', `ya existe en lexicon[${lexSeen.get(e.id)}]`);
    else { lexSeen.set(e.id, i); installedDup(inst.lexicon, e.id, ePath); }
  });

  const storySeen = new Map();
  let storyQuestions = 0;
  arr(p.stories, PACK_LIMITS.stories).forEach((raw, i) => {
    const s = read(raw);
    if (!s) return;
    const sPath = joinPath(joinPath(path, 'stories'), i);
    if (typeof s.id === 'string') {
      if (storySeen.has(s.id)) r.error(joinPath(sPath, 'id'), 'DUPLICATE', `ya existe en stories[${storySeen.get(s.id)}]`);
      else { storySeen.set(s.id, i); installedDup(inst.stories, s.id, sPath); }
    }
    arr(s.questions, STORY_QUESTIONS_MAX).forEach((q, j) => { storyQuestions += 1; examine(q, joinPath(joinPath(sPath, 'questions'), j), i); });
  });

  const empty = (x) => !Array.isArray(x) || x.length === 0;
  if (empty(p.items) && empty(p.lexicon) && empty(p.stories)) {
    r.error(path, 'PACK_EMPTY', 'el paquete no trae ejercicios, palabras ni historias');
  }
  if (itemCount + storyQuestions > 0) {
    topics.forEach((t, k) => {
      if (!used.has(t)) r.warn(joinPath(joinPath(path, 'topics'), k), 'TOPIC_WITHOUT_ITEMS', `ningún ítem del paquete usa el tema ${t}`);
    });
    topicQuality(r, path, topics, used, stats, inst, ctx);
  }
}

// Regla de calidad 8.10 para los temas `active` que el paquete usa. Suma los ítems de los paquetes instalados (sin el propio, si lo reemplaza).
function topicQuality(r, path, topics, used, stats, inst, ctx) {
  const info = ctx && ctx.topicInfo;
  if (!info || typeof info.get !== 'function') return;
  topics.forEach((t, k) => {
    const meta = info.get(t);
    if (!meta || meta.status !== 'active' || !used.has(t)) return; // sin ítems en el paquete ya avisa TOPIC_WITHOUT_ITEMS
    const mine = stats.get(t) || { count: 0, types: new Set() };
    const other = inst.topics.get(t);
    const count = mine.count + (other ? other.count : 0);
    const types = new Set([...mine.types, ...(other ? other.types : [])]);
    const min = Number.isInteger(meta.min_items) ? meta.min_items : DEFAULT_MIN_ITEMS;
    const where = other ? 'entre este paquete y los instalados' : 'en este paquete';
    const at = joinPath(joinPath(path, 'topics'), k);
    if (count < min) r.warn(at, 'TOPIC_FEW_ITEMS', `el tema activo ${t} suma ${count} ítems ${where} (mínimo ${min})`);
    if (types.size < MIN_TYPES_PER_TOPIC) r.warn(at, 'TOPIC_FEW_TYPES', `el tema activo ${t} suma ${types.size} tipos de ejercicio ${where} (mínimo ${MIN_TYPES_PER_TOPIC})`);
  });
}

export function checkPack(r, path, input, ctx = {}) {
  check(r, path, input, PACK_SPEC, ctx);
  try { crossChecks(r, path, input, ctx); } catch { /* entrada hostil: `check` ya informó UNREADABLE */ }
}

export function validatePack(input, ctx = {}) {
  const r = createReport();
  checkPack(r, '', input, ctx);
  return r.result();
}
