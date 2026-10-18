// Esquema de eventos (subparte 1.1, cuarto 1): validación estricta, día local e IDs. Roadmap 8.6. Puro: sin DOM ni base de datos.
// `core/events.js` (cuarto 2) lo usa para registrar; la 1.12 lo usará para validar respaldos.
//
//   validateEvent(input, { stored? }) → { ok:true, value } | { ok:false, problems:[{ path, message }] }
//     stored=false (defecto): es lo que se le entrega a log(). `id` y `day` NO se envían (los asigna log); `ts` es opcional.
//     stored=true: es un evento ya guardado (p. ej. de un respaldo). Exige `id`, `ts` y `day` bien formados.
//     Nunca lanza, ni con entradas absurdas. `value` es una COPIA normalizada con TODOS los campos (los opcionales con su valor por defecto).
//   buildEvent(input, { now, idGen }) → evento completo (ts del reloj si falta, day LOCAL de ese ts, id nuevo). Lanza EventError si no vale.
//   createIdGenerator({ rng? }) → { next(ts) → id }     makeEventId(ts, counter, rng)
//   EventError { code:'BAD_EVENT', problems, friendly }
import { toDate, toIso, localDay } from './clock.js';
import { systemRng } from './rng.js';

export const EVENT_TYPES = Object.freeze(['answer', 'session_start', 'session_end', 'tap_word', 'ai_call', 'exam_entry', 'exam_exit', 'import', 'note']);
export const RESULTS = Object.freeze(['correct', 'almost', 'wrong', 'skipped', 'dont_know']);
export const CHANNELS = Object.freeze(['keyboard', 'voice', 'tap']);
// Provisional: el contrato 8.6 muestra "mech" pero no enumera `mode`. Coincide con el modo IA / mecánico de 7.2. Ver DECISIONS.md.
export const MODES = Object.freeze(['mech', 'ai']);
// Orden estable de los campos del contrato 8.6.
export const EVENT_FIELDS = Object.freeze(['id', 'ts', 'day', 'type', 'sessionId', 'cardId', 'itemId', 'topics', 'exerciseType', 'result', 'rating', 'ms', 'hint', 'dontKnow', 'responseRaw', 'errorCodes', 'mode', 'channel']);

// Campos obligatorios (no nulos) según el tipo. El contrato no los fija; es el mínimo con que cada tipo sirve para dominio y estadísticas.
export const REQUIRED_BY_TYPE = Object.freeze({
  answer: Object.freeze(['itemId', 'topics', 'exerciseType', 'result', 'mode', 'channel']),
  session_start: Object.freeze(['sessionId']),
  session_end: Object.freeze(['sessionId']),
  tap_word: Object.freeze(['responseRaw']),
  ai_call: Object.freeze([]),
  exam_entry: Object.freeze(['topics']),
  exam_exit: Object.freeze(['topics']),
  import: Object.freeze([]),
  note: Object.freeze(['responseRaw']),
});

export const LIMITS = Object.freeze({ responseRaw: 2000, topics: 20, errorCodes: 20, msMax: 86400000, problems: 20 });

const TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^evt_\d{8}T\d{4}_[a-z0-9]{4,}$/;
const ITEM_RE = /^[a-z0-9_.]{1,100}$/; // roadmap 8.1
const TOPIC_RE = ITEM_RE;
const CARD_RE = /^[a-z0-9_.]{1,100}#\d{1,3}$/; // itemId#faceta (8.4)
const SESSION_RE = /^[A-Za-z0-9_.-]{1,80}$/;
const EXTYPE_RE = /^[a-z][a-z0-9_]{0,39}$/; // el catálogo completo lo fija 1.3; aquí solo la forma
const CODE_RE = /^[A-Z][A-Z0-9_]*\.[A-Z0-9_.-]+$/; // TNS.SINCE_FOR, PRON.-ED
// Caracteres de control salvo tabulador, salto de línea y retorno.
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
  && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

export class EventError extends Error {
  constructor(problems) {
    const list = Array.isArray(problems) ? problems : [];
    const first = list.slice(0, 5).map((p) => (p.path ? `${p.path}: ${p.message}` : p.message)).join('; ');
    super(`Evento no válido: ${first || 'sin detalle'}${list.length > 5 ? ` (y ${list.length - 5} más)` : ''}`);
    this.name = 'EventError';
    this.code = 'BAD_EVENT';
    this.problems = list;
    this.friendly = 'Hubo un problema interno al registrar tu actividad (datos no válidos). No se perdió nada de lo anterior; cuéntaselo al chat con el botón "Copiar detalle".';
  }
}

export function validateEvent(input, { stored = false } = {}) {
  const problems = [];
  const add = (path, message) => { if (problems.length < LIMITS.problems) problems.push({ path, message }); };
  let src;
  try {
    if (!isPlain(input)) { add('', 'el evento debe ser un objeto'); return { ok: false, problems }; }
    src = { ...input }; // una sola lectura: un getter o un Proxy que falle se informa como evento no válido, no como excepción
  } catch {
    add('', 'el evento no se pudo leer'); // no se inspecciona lo lanzado: también podría ser hostil
    return { ok: false, problems };
  }

  for (const k of Object.keys(src)) {
    if (!EVENT_FIELDS.includes(k)) add(k, 'campo desconocido');
    else if (!stored && (k === 'id' || k === 'day')) add(k, 'lo asigna log(); no se envía');
  }
  const get = (k) => (has(src, k) ? src[k] : undefined);

  const typeRaw = get('type');
  let type = null;
  if (typeof typeRaw === 'string' && EVENT_TYPES.includes(typeRaw)) type = typeRaw;
  else add('type', typeRaw == null ? 'es obligatorio' : typeof typeRaw !== 'string' ? 'debe ser texto' : `tipo desconocido "${typeRaw.slice(0, 30)}"`);
  const required = type ? REQUIRED_BY_TYPE[type] : [];
  const missing = (k) => { if (required.includes(k)) add(k, `es obligatorio en eventos "${type}"`); };

  // Texto con formato, nulable: ausente/null → null (y error si el tipo lo exige).
  const text = (k, re, what) => {
    const v = get(k);
    if (v == null) { missing(k); return null; }
    if (typeof v !== 'string' || !re.test(v)) { add(k, `${what} no válido`); return null; }
    return v;
  };
  const choice = (k, list) => {
    const v = get(k);
    if (v == null) { missing(k); return null; }
    if (typeof v !== 'string' || !list.includes(v)) { add(k, `debe ser uno de: ${list.join(', ')}`); return null; }
    return v;
  };
  // Lista de textos con formato: ausente → []; null/otro tipo → error; se quitan repetidos conservando el orden.
  const list = (k, re, max, what) => {
    const v = get(k);
    if (v === undefined) { if (required.includes(k)) add(k, `es obligatorio en eventos "${type}"`); return []; }
    if (!Array.isArray(v)) { add(k, 'debe ser una lista'); return []; }
    if (v.length > max) { add(k, `máximo ${max} elementos`); return []; }
    const out = [];
    v.forEach((e, i) => {
      if (typeof e !== 'string' || !re.test(e)) add(`${k}[${i}]`, `${what} no válido`);
      else if (!out.includes(e)) out.push(e);
    });
    if (required.includes(k) && v.length === 0) add(k, `necesita al menos 1 elemento en eventos "${type}"`);
    return out;
  };
  const flag = (k) => {
    const v = get(k);
    if (v === undefined) return false;
    if (typeof v !== 'boolean') { add(k, 'debe ser verdadero o falso'); return false; }
    return v;
  };

  const out = {};
  out.id = null; out.day = null;
  if (stored) {
    const id = get('id'); const day = get('day');
    out.id = typeof id === 'string' && ID_RE.test(id) ? id : (add('id', 'identificador no válido'), null);
    out.day = typeof day === 'string' && DAY_RE.test(day) ? day : (add('day', 'día no válido (AAAA-MM-DD)'), null);
  }
  const ts = get('ts');
  if (ts == null) { out.ts = null; if (stored) add('ts', 'es obligatorio en un evento guardado'); } else if (typeof ts === 'string' && TS_RE.test(ts) && isRoundTrip(ts)) out.ts = ts;
  else { add('ts', 'debe ser una fecha ISO en UTC, como 2026-10-15T14:00:00.000Z'); out.ts = null; }

  out.type = type;
  out.sessionId = text('sessionId', SESSION_RE, 'sessionId');
  out.cardId = text('cardId', CARD_RE, 'cardId');
  out.itemId = text('itemId', ITEM_RE, 'itemId');
  if (out.cardId && out.itemId && !out.cardId.startsWith(`${out.itemId}#`)) add('cardId', 'no corresponde al itemId');
  out.topics = list('topics', TOPIC_RE, LIMITS.topics, 'tema');
  out.exerciseType = text('exerciseType', EXTYPE_RE, 'exerciseType');
  out.result = choice('result', RESULTS);

  const rating = get('rating');
  if (rating == null) { out.rating = null; missing('rating'); } else if (Number.isInteger(rating) && rating >= 1 && rating <= 4) out.rating = rating;
  else { add('rating', 'debe ser un entero de 1 a 4'); out.rating = null; }

  const ms = get('ms');
  if (ms == null) { out.ms = null; missing('ms'); } else if (typeof ms === 'number' && Number.isFinite(ms) && ms >= 0 && ms <= LIMITS.msMax) out.ms = Math.round(ms);
  else { add('ms', `debe ser un número de 0 a ${LIMITS.msMax}`); out.ms = null; }

  out.hint = flag('hint');
  out.dontKnow = flag('dontKnow');
  if (out.result === 'dont_know' && get('dontKnow') === undefined) out.dontKnow = true;
  if (out.dontKnow && out.result !== 'dont_know') add('dontKnow', 'si es verdadero, result debe ser "dont_know"');
  if (!out.dontKnow && out.result === 'dont_know') add('dontKnow', 'con result "dont_know" debe ser verdadero');

  const raw = get('responseRaw');
  if (raw == null) { out.responseRaw = null; missing('responseRaw'); } else if (typeof raw !== 'string') { add('responseRaw', 'debe ser texto'); out.responseRaw = null; } else if (raw.length > LIMITS.responseRaw) { add('responseRaw', `máximo ${LIMITS.responseRaw} caracteres`); out.responseRaw = null; } else if (CONTROL_RE.test(raw)) { add('responseRaw', 'contiene caracteres de control'); out.responseRaw = null; } else out.responseRaw = raw;

  out.errorCodes = list('errorCodes', CODE_RE, LIMITS.errorCodes, 'código de error');
  out.mode = choice('mode', MODES);
  out.channel = choice('channel', CHANNELS);

  if (problems.length > 0) return { ok: false, problems };
  const value = {};
  for (const k of EVENT_FIELDS) if (stored || (k !== 'id' && k !== 'day')) value[k] = out[k];
  return { ok: true, value };
}

// "2026-02-31T…" pasa la forma pero no es una fecha real.
function isRoundTrip(ts) {
  try { return toIso(ts) === ts; } catch { return false; }
}

// ---------- IDs ----------
const B36 = '0123456789abcdefghijklmnopqrstuvwxyz';

// evt_AAAAMMDDTHHMM_<contador base 36 (≥4)><3 al azar>. La parte de tiempo es UTC al minuto (como el ejemplo de 8.6).
// El contador hace únicos los IDs de UNA instancia aunque se llame mil veces en el mismo ms; el azar separa instancias distintas
// (dos cargas de la app). La garantía final contra la base la da log() en el cuarto 2.
export function makeEventId(ts, counter, rng = systemRng) {
  if (typeof ts !== 'string' || !TS_RE.test(ts)) throw new Error('makeEventId: ts debe ser una fecha ISO en UTC');
  if (!Number.isInteger(counter) || counter < 0) throw new Error('makeEventId: el contador debe ser un entero ≥ 0');
  if (!rng || typeof rng.int !== 'function') throw new Error('makeEventId: rng no válido');
  const compact = ts.slice(0, 16).replace(/[-:]/g, '');
  let rand = '';
  for (let i = 0; i < 3; i += 1) rand += B36[rng.int(0, 35)];
  return `evt_${compact}_${counter.toString(36).padStart(4, '0')}${rand}`;
}

export function createIdGenerator({ rng = systemRng } = {}) {
  if (!rng || typeof rng.int !== 'function') throw new Error('createIdGenerator: rng no válido');
  let n = 0;
  return {
    next(ts) { const id = makeEventId(ts, n, rng); n += 1; return id; },
    peek: () => n,
  };
}

// ---------- Construcción ----------
// `now` es un Date (convención de core/clock.js). El día es el LOCAL del dispositivo en el instante `ts`.
export function buildEvent(input, { now, idGen } = {}) {
  if (!idGen || typeof idGen.next !== 'function') throw new Error('buildEvent: falta idGen');
  const v = validateEvent(input);
  if (!v.ok) throw new EventError(v.problems);
  const ts = v.value.ts ?? toIso(toDate(now));
  const day = localDay(ts);
  // Un ts de los años 0 o 9999 puede dar un día local de otro año (−1, 10000) que no cabe en AAAA-MM-DD.
  if (!DAY_RE.test(day)) throw new EventError([{ path: 'ts', message: 'fecha fuera del rango admitido' }]);
  const full = { ...v.value, id: idGen.next(ts), ts, day };
  const ordered = {};
  for (const k of EVENT_FIELDS) ordered[k] = full[k];
  return ordered;
}
