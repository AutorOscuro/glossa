// @purpose: Validación del archivo de temas de la taxonomía y consulta de sus ids.
// Archivo de temas (subparte 1.3, cuarto 3, mitad 3A, parte 2). Roadmap 8.2 y 1.3. Puro: sin DOM, sin base de datos, sin archivos.
//   validateTopics(input, ctx?) → { ok, errors, warnings, errorTotal, warningTotal }   valida `content/taxonomy/topics.json` (nunca lanza)
//   topicIdSet(input) → Set<string>   los ids de tema, para `ctx.topicIds` de los validadores de contenido (nunca lanza; no valida)
//   topicInfo(input) → Map<id, { status, min_items }>   lo que necesita `validatePack` para los avisos por tema (nunca lanza; no valida)
// Archivo: `{ schema: 1, topics: [Topic…] }`. Cada tema pasa por `checkTopic` (1A); aquí está lo que solo se ve con todos los temas a la vez:
//   ids únicos (`DUPLICATE`), `prereq` que existan (`UNKNOWN_PREREQ`) y sin ciclos (`PREREQ_CYCLE`). Los prerrequisitos son sugerencias (8.2),
//   pero un ciclo no tiene orden posible y un id inexistente es casi siempre una errata. `ctx.errorCodes` (Set) se pasa a cada tema.
import { LIMITS, createReport, joinPath, check, oneOf, list, obj, custom } from './contentRules.js';
import { checkTopic, TOPIC_ID_RE } from './contentTopic.js';
import { isPlain, DEFAULT_MIN_ITEMS } from './contentCommon.js';

export const TOPICS_SCHEMA = 1;
export const MAX_TOPICS = 2000;

const TOPICS = custom((r, path, v, ctx) => {
  check(r, path, v, list(custom((rr, p, t, c) => checkTopic(rr, p, t, c)), { min: 1, max: MAX_TOPICS }), ctx);
  if (Array.isArray(v)) { try { crossChecks(r, path, v); } catch { /* entrada hostil: `check` ya informó UNREADABLE */ } }
});

const FILE = obj({ schema: oneOf([TOPICS_SCHEMA]), topics: TOPICS });

// Lee un objeto una sola vez; si es hostil (getter que falla) devuelve null y `check` ya informó UNREADABLE.
function read(o) {
  try { return isPlain(o) ? { ...o } : null; } catch { return null; }
}

const prereqPath = (path, at, j) => joinPath(joinPath(joinPath(path, at), 'prereq'), j);

function crossChecks(r, path, topics) {
  const rows = []; // { at, id, prereq } de cada tema legible, en el orden del archivo
  const first = new Map(); // id → índice del primero con ese id
  topics.slice(0, MAX_TOPICS).forEach((raw, i) => {
    const t = read(raw);
    if (!t) return;
    const id = typeof t.id === 'string' ? t.id : null;
    const prereq = Array.isArray(t.prereq) ? t.prereq.slice(0, 20).map((p) => (typeof p === 'string' ? p : null)) : [];
    rows.push({ at: i, id, prereq });
    if (id === null) return;
    if (first.has(id)) r.error(joinPath(joinPath(path, i), 'id'), 'DUPLICATE', `ya existe en ${joinPath(path, first.get(id))}`);
    else first.set(id, i);
  });

  const edges = new Map(); // id → [{ to, at, j }] solo hacia temas que existen y que no son él mismo (el autorreferido ya lo informa checkTopic)
  for (const row of rows) {
    row.prereq.forEach((p, j) => {
      if (p === null) return; // el tipo ya lo informó `check`
      if (!first.has(p)) {
        // un id con formato roto ya tiene su FORMAT; aquí solo el que tiene forma de id pero no existe
        if (p.length <= LIMITS.idLength && TOPIC_ID_RE.test(p)) r.error(prereqPath(path, row.at, j), 'UNKNOWN_PREREQ', `el tema ${p} no existe en topics.json`);
        return;
      }
      if (row.id === null || p === row.id || first.get(row.id) !== row.at) return; // un id repetido no suma aristas: cuenta el primero
      if (!edges.has(row.id)) edges.set(row.id, []);
      edges.get(row.id).push({ to: p, at: row.at, j });
    });
  }
  findCycles(r, path, edges);
}

// Búsqueda en profundidad sin recursión (hasta 2.000 temas): cada arista que vuelve a un tema aún abierto cierra un ciclo y se informa una vez.
function findCycles(r, path, edges) {
  const state = new Map(); // id → 1 (abierto) | 2 (cerrado)
  for (const start of edges.keys()) {
    if (state.has(start)) continue;
    const stack = [{ id: start, k: 0 }];
    state.set(start, 1);
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      const out = edges.get(top.id) || [];
      if (top.k >= out.length) { state.set(top.id, 2); stack.pop(); continue; }
      const e = out[top.k];
      top.k += 1;
      const s = state.get(e.to);
      if (s === 2) continue;
      if (s === 1) {
        const from = stack.findIndex((f) => f.id === e.to);
        const ring = [...stack.slice(from).map((f) => f.id), e.to];
        r.error(prereqPath(path, e.at, e.j), 'PREREQ_CYCLE', `cierra un ciclo de prerrequisitos: ${ring.join(' → ')}`);
        continue;
      }
      state.set(e.to, 1);
      stack.push({ id: e.to, k: 0 });
    }
  }
}

export function validateTopics(input, ctx = {}) {
  const r = createReport();
  check(r, '', input, FILE, ctx);
  return r.result();
}

export function topicInfo(input) {
  const out = new Map();
  try {
    const topics = input !== null && typeof input === 'object' ? input.topics : undefined;
    if (!Array.isArray(topics)) return out;
    for (let i = 0; i < Math.min(topics.length, MAX_TOPICS); i += 1) {
      const t = topics[i];
      if (t === null || typeof t !== 'object' || typeof t.id !== 'string' || out.has(t.id)) continue; // con un id repetido manda el primero
      out.set(t.id, { status: typeof t.status === 'string' ? t.status : null, min_items: Number.isInteger(t.min_items) ? t.min_items : DEFAULT_MIN_ITEMS });
    }
    return out;
  } catch {
    return new Map(); // entrada hostil: nada es válido
  }
}

export function topicIdSet(input) {
  return new Set(topicInfo(input).keys());
}
