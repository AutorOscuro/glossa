// @purpose: Registro de errores de la persona: guarda, consulta, agrupa por tema y detecta errores recurrentes.
// Registro de errores (subparte 1.6, cuarto 1). Roadmap 8.8 y 1.6.
//
//   createErrors({ db, catalog, clock? }) → { record, prepare, applyIn, get, list, count, byTopic, recurrent, top }   (objeto congelado)
//     db       cualquier motor de core/db.js (memoria o IndexedDB). Obligatorio. Usa solo el almacén `errors` (8.13).
//     catalog  un catálogo de core/errorCatalog.js. Obligatorio: sin él no se sabe qué códigos existen.
//     clock    reloj inyectable (core/clock.js); su now() da el `ts` cuando la entrada no trae uno.
//
//   record(input) → Promise<{ record, created, counted, replay }>
//     input = { original, code, correction?, context?, topics?, origin?, kind?, impact?, source?, itemId?, ts? }
//       original   lo que escribió la persona (1–500 caracteres tras recortar espacios; sin caracteres de control salvo el salto de línea)
//       code       un código del catálogo (obligatorio y debe existir)
//       topics     por defecto los `temas_relacionados` del código; [] también cuenta como «los del código»
//       origin / impact   por defecto `origen_tipico` / `impacto_defecto` del código
//       kind       'slip' | 'systematic' (por defecto 'slip'); pasa a 'systematic' desde la 3.ª ocurrencia (count ≥ RECURRENCE.times = 3) o si la entrada lo pide; nunca baja
//       source     'app' | 'chat' | 'ai' (por defecto 'app'); itemId texto | null
//       ts         Date | ms | ISO. Por defecto el reloj. Más de 24 h en el futuro se rechaza (reloj mal puesto, dato corrupto).
//     Rechaza con ErrorRecordError (code 'BAD_ERROR_RECORD') si no vale, sin tocar la base; con DbError si la base falla (no se guardó nada).
//     MISMO ERROR = mismo código + mismo `original` normalizado (core/normalize.js: minúsculas, apóstrofos, espacios, sin puntuación final) + mismo itemId.
//       · Primera vez  → crea el registro (count 1) → { created: true, counted: true, replay: false }.
//       · Otra vez     → NO crea otro: count + 1, `ts`/`day` pasan a la ocurrencia más reciente, `kind` → 'systematic' si count ≥ 3 (o si ya lo era / la entrada lo pide), se rellenan `correction`/`context`
//                        si estaban vacíos y `impact` toma el mayor → { created: false, counted: true, replay: false }.
//       · REPETICIÓN DE LA MISMA OCURRENCIA (idempotencia) → mismo `ts` ya contado: no cambia nada → { created: false, counted: false, replay: true }.
//         Así reenviar o reimportar el mismo aviso no duplica; una ocurrencia nueva trae otro `ts` y sí cuenta.
//     Todo ocurre en UNA transacción (buscar + escribir): dos avisos seguidos nunca se pisan.
//   get(id) → Promise<registro | null>
//   list({ code?, topic?, day?, order?, limit? }) → Promise<registro[]>   copias; orden por `ts` ('desc' por defecto) y, si empatan, por id. Opción desconocida → DbError BAD_QUERY.
//   count({ code? }) → Promise<número>   cantidad de REGISTROS (errores distintos), no de ocurrencias (para eso se suma `count`).
//   byTopic(topicId) → Promise<registro[]>   los errores de un tema (= list({ topic })), el más reciente primero.
//
// Cuarto 2 — reincidencia y ranking (todo se calcula de `seen`/`count`; nada se guarda aparte):
//   recurrence(rec, now) → { inWindow, recurrent, last }   FUNCIÓN PURA: cuántas ocurrencias FECHADAS del registro caen en los últimos 14 días (ts ∈ [now − 14 d, now]; las futuras no cuentan)
//                                                          y si llegan a 3 (RECURRENCE). Las ocurrencias sin fecha (count > |seen|, p. ej. un registro del chat) NO cuentan: no se sabe si caen en la ventana.
//   recurrent({ by?, topic?, code?, now? }) → Promise<entrada[]>   los errores que reinciden ahora. by 'error' (por defecto: la misma frase) | 'code' (el mismo código, frases distintas).
//                                                          Orden: más ocurrencias en la ventana, luego la más reciente, luego la clave. Entrada = { key, by, code, record|null, records, topics, inWindow, last }.
//   top(n, range, { by? }) → Promise<entrada[]>   ranking por frecuencia × impacto (peso low 1, mid 2, high 3). range = { from?, to? } como events.countByDay: días locales AAAA-MM-DD, Date o ms, INCLUSIVOS;
//                                                          `{}` = todo. by 'code' (por defecto: cada código con todas sus frases) | 'error' (cada frase). Sin rango la frecuencia es `count`; con rango son las ocurrencias
//                                                          FECHADAS dentro (el registro recuerda las 10 más recientes: tope aceptado). Entrada = { key, by, code, record|null, records, topics, frequency, impact, weight, score, last }.
//                                                          Orden: score ↓, frecuencia ↓, más reciente ↓, clave ↑ (determinista; con score y frecuencia iguales el peso también lo es).
//
// Ampliación del contrato 8.8 (optativa, ver CONTRACTS 1.6-1): `seen` = hasta 10 `ts` (ISO, ascendentes) de las ocurrencias más recientes. Sirve para la
// idempotencia y para la regla de reincidencia (3 veces en 14 días, cuarto 2). Un registro sin `seen` (p. ej. venido del chat) se lee como `[ts]`.
import { systemClock, toDate, toIso, localDay } from './clock.js';
import { DbError, classifyError } from './db.js';
import { normalize } from './normalize.js';
import { TOPIC_ID_RE } from './contentTopic.js';

export const ERROR_KINDS = Object.freeze(['slip', 'systematic']);
export const ERROR_SOURCES = Object.freeze(['app', 'chat', 'ai']);
export const ORIGINS = Object.freeze(['transfer_es', 'developmental', 'unknown_pure']);
export const IMPACTS = Object.freeze(['low', 'mid', 'high']);
// Regla de reincidencia (8.7): el mismo error 3 veces en 14 días. El MISMO umbral (3) decide cuándo un `kind` pasa de 'slip' a 'systematic' (decisión del Administrador, 1.6 cuarto 2).
export const RECURRENCE = Object.freeze({ times: 3, days: 14 });
const MS_DAY = 86400000;
export const IMPACT_RANK = Object.freeze({ low: 1, mid: 2, high: 3 });
export const ERROR_FIELDS = Object.freeze(['id', 'ts', 'day', 'original', 'correction', 'context', 'topics', 'code', 'origin', 'kind', 'impact', 'count', 'source', 'itemId', 'seen']);
export const LIMITS = Object.freeze({ original: 500, correction: 500, context: 200, topics: 10, topicLength: 100, itemId: 200, seen: 10, futureMs: 86400000, idTries: 20 });
const INPUT_KEYS = Object.freeze(['original', 'code', 'correction', 'context', 'topics', 'origin', 'kind', 'impact', 'source', 'itemId', 'ts']);
const CONTROL_RE = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export class ErrorRecordError extends Error {
  constructor(problems) {
    const list = Array.isArray(problems) ? problems : [];
    const first = list.slice(0, 5).map((p) => (p.path ? `${p.path}: ${p.message}` : p.message)).join('; ');
    super(`Error registrado no válido: ${first || 'sin detalle'}${list.length > 5 ? ` (y ${list.length - 5} más)` : ''}`);
    this.name = 'ErrorRecordError';
    this.code = 'BAD_ERROR_RECORD';
    this.problems = list;
    this.friendly = 'Hubo un problema interno al anotar tu error (datos no válidos). No se perdió nada de lo anterior; cuéntaselo al chat con el botón "Copiar detalle".';
  }
}

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// ---------- Identidad: «el mismo error» ----------
export function errorKey(code, original, itemId) {
  return `${code}\u0000${normalize(original)}\u0000${itemId ?? ''}`;
}

// Hash de 53 bits (cyrb53) en base 36: id estable para un mismo error. Las colisiones se resuelven mirando la clave real (no se confía en el hash).
function hashId(key) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < key.length; i += 1) {
    const ch = key.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `err_${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36).padStart(11, '0')}`;
}

// ---------- Validación de la entrada ----------
function textField(v, path, max, problems, { required = false } = {}) {
  if (v === undefined || v === null) { if (required) problems.push({ path, message: 'es obligatorio' }); return null; }
  if (typeof v !== 'string') { problems.push({ path, message: 'debe ser un texto' }); return null; }
  const t = v.trim();
  if (t === '') { if (required) problems.push({ path, message: 'no puede estar vacío' }); return null; }
  if (t.length > max) { problems.push({ path, message: `tiene más de ${max} caracteres` }); return null; }
  if (CONTROL_RE.test(t)) { problems.push({ path, message: 'tiene caracteres de control' }); return null; }
  return t;
}

export function validateErrorInput(input, { catalog, now }) {
  const problems = [];
  if (!isPlain(input)) return { ok: false, problems: [{ path: '', message: 'la entrada debe ser un objeto' }], value: null };
  for (const k of Object.keys(input)) if (!INPUT_KEYS.includes(k)) problems.push({ path: k, message: 'campo desconocido' });

  const original = textField(input.original, 'original', LIMITS.original, problems, { required: true });
  const correction = textField(input.correction, 'correction', LIMITS.correction, problems);
  const context = textField(input.context, 'context', LIMITS.context, problems);
  if (original !== null && correction !== null && normalize(original) === normalize(correction)) {
    problems.push({ path: 'correction', message: 'es igual al original: no hay nada que corregir' });
  }

  let entry = null;
  if (typeof input.code !== 'string' || input.code === '') problems.push({ path: 'code', message: 'es obligatorio (un código del catálogo)' });
  else {
    entry = catalog.get(input.code);
    if (!entry) problems.push({ path: 'code', message: `el código ${input.code.slice(0, 60)} no está en el catálogo` });
  }

  let topics = null;
  if (input.topics !== undefined) {
    if (!Array.isArray(input.topics)) problems.push({ path: 'topics', message: 'debe ser una lista' });
    else if (input.topics.length > LIMITS.topics) problems.push({ path: 'topics', message: `no puede tener más de ${LIMITS.topics} temas` });
    else {
      const out = [];
      input.topics.forEach((t, i) => {
        if (typeof t !== 'string' || t.length > LIMITS.topicLength || !TOPIC_ID_RE.test(t)) problems.push({ path: `topics[${i}]`, message: 'debe ser un id de tema como gram.present_perfect.for_since' });
        else if (!out.includes(t)) out.push(t);
      });
      topics = out;
    }
  }

  const pick = (key, allowed, fallback) => {
    const v = input[key];
    if (v === undefined || v === null) return fallback;
    if (!allowed.includes(v)) { problems.push({ path: key, message: `debe ser uno de: ${allowed.join(', ')}` }); return fallback; }
    return v;
  };
  const origin = pick('origin', ORIGINS, entry?.origen_tipico ?? 'unknown_pure');
  const impact = pick('impact', IMPACTS, entry?.impacto_defecto ?? 'mid');
  const kind = pick('kind', ERROR_KINDS, 'slip');
  const source = pick('source', ERROR_SOURCES, 'app');

  let itemId = null;
  if (input.itemId !== undefined && input.itemId !== null) {
    if (typeof input.itemId !== 'string' || input.itemId.trim() === '' || input.itemId.length > LIMITS.itemId || CONTROL_RE.test(input.itemId)) problems.push({ path: 'itemId', message: 'debe ser un texto no vacío o null' });
    else itemId = input.itemId;
  }

  let ts = null;
  if (input.ts === undefined || input.ts === null) ts = toIso(now);
  else {
    try { ts = toIso(input.ts); } catch { problems.push({ path: 'ts', message: 'debe ser una fecha (Date, milisegundos o texto ISO)' }); }
    if (ts !== null && toDate(ts).getTime() > toDate(now).getTime() + LIMITS.futureMs) { problems.push({ path: 'ts', message: 'está más de 24 h en el futuro' }); ts = null; }
    if (ts !== null && !DAY_RE.test(localDay(ts))) { problems.push({ path: 'ts', message: 'fecha fuera del rango admitido' }); ts = null; }
  }
  if (problems.length > 0) return { ok: false, problems, value: null };
  return {
    ok: true,
    problems: [],
    value: {
      original, correction, context, code: input.code, origin, kind, impact, source, itemId, ts,
      topics: topics !== null && topics.length > 0 ? topics : [...entry.temas_relacionados],
    },
  };
}

// ---------- Mezcla con un registro existente ----------
const tsMs = (s) => Date.parse(s);
const validIso = (s) => typeof s === 'string' && !Number.isNaN(Date.parse(s));

// Las ocurrencias recordadas de un registro guardado (puede venir del chat sin `seen`, o con basura): ISO normalizados, ascendentes, sin repetir.
export function seenOf(rec) {
  const raw = Array.isArray(rec.seen) ? rec.seen : [];
  const list = [...raw, rec.ts].filter(validIso).map((s) => new Date(s).toISOString());
  return [...new Set(list)].sort((a, b) => tsMs(a) - tsMs(b)).slice(-LIMITS.seen);
}

function mergeInto(existing, v) {
  const seen = [...new Set([...seenOf(existing), v.ts])].sort((a, b) => tsMs(a) - tsMs(b)).slice(-LIMITS.seen);
  const ts = seen[seen.length - 1];
  const count = (Number.isInteger(existing.count) && existing.count >= 1 ? existing.count : 1) + 1;
  const impact = IMPACT_RANK[v.impact] > (IMPACT_RANK[existing.impact] ?? 0) ? v.impact : existing.impact; // un impacto guardado ilegible pierde
  return {
    ...existing,
    ts, day: localDay(ts), seen, count, impact,
    // 'slip' hasta la 3.ª ocurrencia (RECURRENCE.times); si ya era 'systematic' o la entrada lo pide, se respeta; y nunca baja
    kind: existing.kind === 'systematic' || v.kind === 'systematic' || count >= RECURRENCE.times ? 'systematic' : 'slip',
    correction: existing.correction ?? v.correction,
    context: existing.context ?? v.context,
  };
}

function build(v, id) {
  const out = {
    id, ts: v.ts, day: localDay(v.ts), original: v.original, correction: v.correction, context: v.context, topics: v.topics, code: v.code,
    origin: v.origin, kind: v.kind, impact: v.impact, count: 1, source: v.source, itemId: v.itemId, seen: [v.ts],
  };
  const ordered = {};
  for (const k of ERROR_FIELDS) ordered[k] = out[k];
  return ordered;
}

// ---------- Reincidencia y ranking (cuarto 2): funciones puras sobre registros ya leídos ----------
const impactWeight = (impact) => IMPACT_RANK[impact] ?? IMPACT_RANK.low; // un impacto ilegible pesa lo mínimo: no infla el ranking

export function recurrence(rec, now) {
  const nowMs = toDate(now).getTime();
  const from = nowMs - RECURRENCE.days * MS_DAY;
  const inside = isPlain(rec) ? seenOf(rec).filter((iso) => { const t = tsMs(iso); return t >= from && t <= nowMs; }) : [];
  return { inWindow: inside.length, recurrent: inside.length >= RECURRENCE.times, last: inside.length > 0 ? inside[inside.length - 1] : null };
}

// Agrupa registros por error (id) o por código y reúne sus ocurrencias fechadas. Una frase con dos errores a la vez da dos registros con el mismo ts: son dos ocurrencias, no se deduplican.
function groupRows(rows, by) {
  const groups = new Map();
  for (const rec of rows) {
    if (!isPlain(rec) || typeof rec.code !== 'string') continue;
    const key = by === 'code' ? rec.code : rec.id; // el id es la clave del almacén: siempre existe; el código sí puede faltar en un registro dañado
    if (!groups.has(key)) groups.set(key, { key, by, code: rec.code, recs: [], dated: [], total: 0, weight: 0, topics: new Set() });
    const g = groups.get(key);
    const dated = seenOf(rec);
    g.recs.push(rec);
    g.dated.push(...dated);
    g.total += Math.max(Number.isInteger(rec.count) && rec.count >= 1 ? rec.count : 1, dated.length);
    g.weight = Math.max(g.weight, impactWeight(rec.impact));
    if (Array.isArray(rec.topics)) for (const t of rec.topics) if (typeof t === 'string') g.topics.add(t);
  }
  return [...groups.values()].map((g) => ({ ...g, dated: g.dated.sort((a, b) => tsMs(a) - tsMs(b)), topics: [...g.topics].sort() }));
}

const IMPACT_OF_WEIGHT = Object.freeze({ 1: 'low', 2: 'mid', 3: 'high' });
const baseEntry = (g) => ({ key: g.key, by: g.by, code: g.code, record: g.by === 'error' ? clone(g.recs[0]) : null, records: g.recs.length, topics: g.topics });
const lastOf = (list) => (list.length > 0 ? list[list.length - 1] : null);
const cmpText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function rankErrors(rows, { by = 'code', from, to } = {}) {
  const ranged = from !== undefined || to !== undefined;
  const out = [];
  for (const g of groupRows(rows, by)) {
    const inRange = ranged ? g.dated.filter((iso) => { const d = localDay(iso); return (from === undefined || d >= from) && (to === undefined || d <= to); }) : g.dated;
    const frequency = ranged ? inRange.length : g.total;
    if (frequency === 0) continue;
    const weight = g.weight;
    out.push({ ...baseEntry(g), frequency, impact: IMPACT_OF_WEIGHT[weight], weight, score: frequency * weight, last: lastOf(inRange) });
  }
  return out.sort((a, b) => b.score - a.score || b.frequency - a.frequency || cmpText(b.last ?? '', a.last ?? '') || cmpText(a.key, b.key));
}

export function recurringErrors(rows, now, { by = 'error' } = {}) {
  const nowMs = toDate(now).getTime();
  const from = nowMs - RECURRENCE.days * MS_DAY;
  const out = [];
  for (const g of groupRows(rows, by)) {
    const inside = g.dated.filter((iso) => { const t = tsMs(iso); return t >= from && t <= nowMs; });
    if (inside.length >= RECURRENCE.times) out.push({ ...baseEntry(g), inWindow: inside.length, last: lastOf(inside) });
  }
  return out.sort((a, b) => b.inWindow - a.inWindow || cmpText(b.last, a.last) || cmpText(a.key, b.key));
}

const clone = (rec) => JSON.parse(JSON.stringify(rec));
const sameError = (rec, key) => typeof rec.original === 'string' && errorKey(rec.code, rec.original, rec.itemId ?? null) === key;

export function createErrors({ db, catalog, clock = systemClock } = {}) {
  if (!db || typeof db.tx !== 'function') throw new Error('createErrors: falta la base de datos (db.tx)');
  if (!catalog || typeof catalog.get !== 'function' || typeof catalog.has !== 'function') throw new Error('createErrors: falta el catálogo de errores (core/errorCatalog.js)');
  if (!clock || typeof clock.now !== 'function') throw new Error('createErrors: reloj no válido');

  // Valida la entrada SIN tocar la base: { v, key } listo para applyIn. Lanza ErrorRecordError si no vale.
  function prepare(input) {
    let checked;
    try {
      checked = validateErrorInput(input, { catalog, now: clock.now() }); // ANTES de abrir la transacción: una entrada mala no toca la base
    } catch (e) {
      throw new ErrorRecordError([{ path: '', message: `la entrada no se pudo leer (${e instanceof Error ? e.message : 'error desconocido'})` }]); // getter hostil, Proxy…
    }
    if (!checked.ok) throw new ErrorRecordError(checked.problems);
    const v = checked.value;
    return { v, key: errorKey(v.code, v.original, v.itemId) };
  }

  // Busca y escribe dentro de una transacción YA abierta (`t` de db.tx con 'errors'). No abre ni cierra nada.
  async function applyIn(t, { v, key }) {
    const rows = await t.query('errors', { index: 'code', value: v.code });
    const found = rows.find((r) => sameError(r, key));
    if (found) {
      if (seenOf(found).includes(v.ts)) return { record: clone(found), created: false, counted: false, replay: true };
      const merged = mergeInto(found, v);
      await t.put('errors', merged);
      return { record: clone(merged), created: false, counted: true, replay: false };
    }
    const base = hashId(key);
    for (let i = 0; i < LIMITS.idTries; i += 1) {
      const id = i === 0 ? base : `${base}_${i}`;
      if (!(await t.get('errors', id))) {
        const rec = build(v, id);
        await t.put('errors', rec);
        return { record: clone(rec), created: true, counted: true, replay: false };
      }
    }
    throw new DbError('ABORTED', `No se pudo asignar un id libre al error tras ${LIMITS.idTries} intentos`, { store: 'errors', retryable: true });
  }

  async function record(input) {
    const prepared = prepare(input);
    try {
      return await db.tx(['errors'], (t) => applyIn(t, prepared));
    } catch (e) {
      throw classifyError(e, { store: 'errors' });
    }
  }

  const badQuery = (msg) => new DbError('BAD_QUERY', `errors: consulta no válida: ${msg}`, { store: 'errors' });
  const run = async (fn) => { try { return await fn(); } catch (e) { throw classifyError(e, { store: 'errors' }); } };

  const get = (id) => run(async () => {
    if (typeof id !== 'string' || id === '') throw badQuery('el id debe ser un texto no vacío');
    const rec = await db.get('errors', id);
    return rec ? clone(rec) : null;
  });

  const byTime = (a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const list = (opts) => run(async () => {
    const o = opts === undefined || opts === null ? {} : opts;
    if (!isPlain(o)) throw badQuery('las opciones deben ser un objeto');
    for (const k of Object.keys(o)) if (!['code', 'topic', 'day', 'order', 'limit'].includes(k)) throw badQuery(`opción desconocida "${k}"`);
    for (const k of ['code', 'topic', 'day']) if (o[k] !== undefined && (typeof o[k] !== 'string' || o[k] === '')) throw badQuery(`"${k}" debe ser un texto no vacío`);
    if (o.order !== undefined && o.order !== 'asc' && o.order !== 'desc') throw badQuery('"order" debe ser "asc" o "desc"');
    if (o.limit !== undefined && (!Number.isInteger(o.limit) || o.limit < 0)) throw badQuery('"limit" debe ser un entero ≥ 0');
    const index = o.code !== undefined ? 'code' : o.topic !== undefined ? 'topics' : o.day !== undefined ? 'day' : null;
    const value = index === 'code' ? o.code : index === 'topics' ? o.topic : o.day;
    let rows = index === null ? await db.query('errors', {}) : await db.query('errors', { index, value });
    if (o.code !== undefined) rows = rows.filter((r) => r.code === o.code);
    if (o.topic !== undefined) rows = rows.filter((r) => Array.isArray(r.topics) && r.topics.includes(o.topic));
    if (o.day !== undefined) rows = rows.filter((r) => r.day === o.day);
    rows = rows.slice().sort(byTime);
    if ((o.order ?? 'desc') === 'desc') rows.reverse();
    return (o.limit === undefined ? rows : rows.slice(0, o.limit)).map(clone);
  });

  const count = (opts) => run(async () => {
    const o = opts === undefined || opts === null ? {} : opts;
    if (!isPlain(o)) throw badQuery('las opciones deben ser un objeto');
    for (const k of Object.keys(o)) if (k !== 'code') throw badQuery(`opción desconocida "${k}"`);
    if (o.code !== undefined && (typeof o.code !== 'string' || o.code === '')) throw badQuery('"code" debe ser un texto no vacío');
    return o.code === undefined ? db.count('errors', {}) : db.count('errors', { index: 'code', value: o.code });
  });

  const byTopic = (topicId) => {
    if (typeof topicId !== 'string') return run(async () => { throw badQuery('el id de tema debe ser un texto no vacío'); });
    return list({ topic: topicId });
  };

  const readOpts = (opts, allowed) => {
    const o = opts === undefined || opts === null ? {} : opts;
    if (!isPlain(o)) throw badQuery('las opciones deben ser un objeto');
    for (const k of Object.keys(o)) if (!allowed.includes(k)) throw badQuery(`opción desconocida "${k}"`);
    if (o.by !== undefined && o.by !== 'error' && o.by !== 'code') throw badQuery('"by" debe ser "error" o "code"');
    return o;
  };

  // Día local «AAAA-MM-DD» real, o un Date / milisegundos convertidos al día local (igual que events.countByDay).
  const dayArg = (v, name) => {
    if (typeof v === 'string') {
      const m = DAY_RE.exec(v);
      const [y, mo, d] = m ? v.split('-').map(Number) : [];
      const t = m ? new Date(Date.UTC(y, mo - 1, d)) : null;
      if (!t || t.getUTCFullYear() !== y || t.getUTCDate() !== d) throw badQuery(`"${name}" debe ser un día real AAAA-MM-DD`); // un mes o día imposible desborda el año o el día
      return v;
    }
    if (v instanceof Date || typeof v === 'number') {
      try { return localDay(v); } catch { throw badQuery(`"${name}" no es una fecha legible`); }
    }
    throw badQuery(`"${name}" debe ser un día AAAA-MM-DD, un Date o milisegundos`);
  };

  const recurrent = (opts) => run(async () => {
    const o = readOpts(opts, ['by', 'topic', 'code', 'now']);
    for (const k of ['code', 'topic']) if (o[k] !== undefined && (typeof o[k] !== 'string' || o[k] === '')) throw badQuery(`"${k}" debe ser un texto no vacío`);
    let nowDate;
    try { nowDate = toDate(o.now === undefined ? clock.now() : o.now); } catch { throw badQuery('"now" debe ser una fecha (Date, milisegundos o texto ISO)'); }
    const index = o.code !== undefined ? 'code' : o.topic !== undefined ? 'topics' : null;
    let rows = index === null ? await db.query('errors', {}) : await db.query('errors', { index, value: index === 'code' ? o.code : o.topic });
    if (o.code !== undefined) rows = rows.filter((r) => r.code === o.code);
    if (o.topic !== undefined) rows = rows.filter((r) => Array.isArray(r.topics) && r.topics.includes(o.topic));
    return recurringErrors(rows, nowDate, { by: o.by ?? 'error' });
  });

  const top = (n, range, opts) => run(async () => {
    if (!Number.isInteger(n) || n < 0) throw badQuery('"n" debe ser un entero ≥ 0');
    if (!isPlain(range)) throw badQuery('"range" debe ser un objeto { from?, to? } (usa {} para todo el historial)');
    for (const k of Object.keys(range)) if (k !== 'from' && k !== 'to') throw badQuery(`límite de rango desconocido "${k}"`);
    const o = readOpts(opts, ['by']);
    const from = range.from === undefined ? undefined : dayArg(range.from, 'from');
    const to = range.to === undefined ? undefined : dayArg(range.to, 'to');
    if (from !== undefined && to !== undefined && from > to) throw badQuery('"from" no puede ser posterior a "to"');
    const rows = await db.query('errors', {});
    return rankErrors(rows, { by: o.by ?? 'code', from, to }).slice(0, n);
  });

  return Object.freeze({ record, prepare, applyIn, get, list, count, byTopic, recurrent, top });
}
