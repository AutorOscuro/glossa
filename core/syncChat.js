// @purpose: Puente con el chat (formato SOPHIA-EN-SYNC v1): arma bloques de texto y lee los que se pegan, con tolerancia de formato y validación estricta.
// Bloques del chat (subparte 1.12-T2). Roadmap 8.14. Funciones puras: sin base, sin reloj propio, sin DOM.
//
//   makeChatBlock(kind, payload, { now? }) → string        kind ∈ BLOCK_KINDS. Lanza ChatBlockError (en español) si el tipo o el contenido no valen.
//     === SOPHIA-EN-SYNC v1 ===  /  tipo: <kind>  /  generado: <ISO>  /  { JSON con sangría de 2 espacios }  /  === FIN ===
//   parseChatBlock(text) → { ok:true, kind, generatedAt|null, payload, others } | { ok:false, error:{ code, message } }   NUNCA lanza
//     Tolera: texto antes y después, vallas ``` (con o sin lenguaje), negritas/citas (> ** _) en las marcas, mayúsculas, espacios raros
//     (NBSP, BOM, anchos cero), saltos \r\n y comillas curvas “ ” „ « » usadas como comillas del JSON (solo si el JSON tal cual no se lee).
//     Un bloque pegado como cita (cada línea del JSON empieza por «>») no se lee: da BAD_JSON con el aviso «Parece una cita: quita los '>' y vuelve a pegar.»
//     Si hay varios bloques lee el primero y `others` dice cuántos más había. `payload` ya validado y normalizado (ver PAYLOADS).
//     Códigos: NO_TEXT, TOO_BIG, NO_BLOCK, NO_END, BAD_VERSION, NEWER_VERSION, BAD_KIND, BAD_DATE, NO_JSON, BAD_JSON, HOSTILE, BAD_PAYLOAD.
//   validateChatPayload(kind, payload) → { ok:true, payload } | { ok:false, error }   la misma validación de las dos funciones.
//
// Contenido por tipo (claves desconocidas se RECHAZAN: así no se cuelan claves ni datos que nadie pidió):
//   llevar_al_chat  { tema?, item?, respuesta?, errores?: [{ code, original, correction? }] (≤ 10), dominio?: { pct, banda? }, mensaje? }
//   errores         { errores: [ErrorRecord de 8.8 sin id/count: { original, code, correction?, context?, topics?, origin?, kind?, impact?, itemId?, ts? }] (1–200), temas?: [{ id, estado }] (≤ 200) }
//                   cada error sale normalizado con source:'chat' (lo que venga en `source` se ignora: siempre es del chat).
//   estado          { dia?, areas?: [{ area, pct }], temas?: [{ id, pct?, banda? }], notas? }
//   bitacora        { texto }
// Seguridad: se rechazan las claves __proto__, constructor y prototype en cualquier nivel, más de 12 niveles, más de 20.000 nodos, y textos > 300.000 caracteres.
export const BLOCK_KINDS = Object.freeze(['llevar_al_chat', 'errores', 'estado', 'bitacora']);
export const BLOCK_FORMAT = 'SOPHIA-EN-SYNC';
export const BLOCK_VERSION = 1;
export const LIMITS = Object.freeze({
  maxTextChars: 300_000, maxDepth: 12, maxNodes: 20_000, maxErrors: 200, maxTopics: 200, maxShortErrors: 10,
  maxString: 2_000, maxLong: 20_000, maxOriginal: 500,
});

export class ChatBlockError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ChatBlockError';
    this.code = code;
    this.friendly = message;
  }
}

const ORIGINS = ['transfer_es', 'developmental', 'unknown_pure'];
const ERR_KINDS = ['slip', 'systematic'];
const IMPACTS = ['low', 'mid', 'high'];
const BAD_KEYS = ['__proto__', 'constructor', 'prototype'];
const ID_RE = /^[A-Za-z0-9_.:-]{1,80}$/;
const CODE_RE = /^[A-Za-z0-9_.-]{1,60}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// ¿Es un día que existe? (AAAA-MM-DD: rechaza 2026-02-31, que Date.parse acepta y corre al 3 de marzo.)
export function isRealDay(s) {
  if (typeof s !== 'string' || !DAY_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const fail = (code, message) => ({ ok: false, error: { code, message } });
const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const show = (s) => `«${String(s).replace(/[\u0000-\u001f]/g, ' ').slice(0, 40)}»`;

class Bad extends Error {}
const bad = (message) => { throw new Bad(message); };

function onlyKeys(obj, allowed, where) {
  for (const k of Object.keys(obj)) if (!allowed.includes(k)) bad(`${where}: no se admite el campo ${show(k)}`);
}
function str(v, where, { max = LIMITS.maxString, min = 0, optional = false } = {}) {
  if (v === undefined && optional) return undefined;
  if (typeof v !== 'string') bad(`${where} debe ser texto`);
  const t = v.trim();
  if (t.length < min) bad(`${where} no puede estar vacío`);
  if (t.length > max) bad(`${where} es demasiado largo (máximo ${max} caracteres)`);
  return t;
}
function oneOf(v, list, where) {
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || !list.includes(v)) bad(`${where} debe ser uno de: ${list.join(', ')}`);
  return v;
}
function pct(v, where) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100) bad(`${where} debe ser un número de 0 a 100`);
  return v;
}
function list(v, where, max, optional = false) {
  if (v === undefined && optional) return undefined;
  if (!Array.isArray(v)) bad(`${where} debe ser una lista`);
  if (v.length > max) bad(`${where} tiene demasiados elementos (máximo ${max})`);
  return v;
}
function isoDate(v, where) {
  const t = str(v, where, { max: 40 });
  if (Number.isNaN(Date.parse(t))) bad(`${where} no es una fecha válida`);
  return t;
}
function strip(o) { return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)); }

function errorEntry(e, i) {
  const where = `errores[${i}]`;
  if (!isPlain(e)) bad(`${where} debe ser un objeto`);
  // `source` se admite (el roadmap dice source:"chat") pero se ignora: lo escribe esta función.
  onlyKeys(e, ['original', 'code', 'correction', 'context', 'topics', 'origin', 'kind', 'impact', 'itemId', 'ts', 'source'], where);
  const code = str(e.code, `${where}.code`, { min: 1, max: 60 });
  if (!CODE_RE.test(code)) bad(`${where}.code tiene caracteres no válidos`);
  if (e.source !== undefined && e.source !== 'chat') bad(`${where}.source solo puede ser "chat"`);
  let topics = list(e.topics, `${where}.topics`, 20, true);
  if (topics) topics = topics.map((t, j) => { const s = str(t, `${where}.topics[${j}]`, { min: 1, max: 80 }); if (!ID_RE.test(s)) bad(`${where}.topics[${j}] tiene caracteres no válidos`); return s; });
  let itemId = e.itemId;
  if (itemId !== undefined && itemId !== null) { itemId = str(itemId, `${where}.itemId`, { min: 1, max: 80 }); if (!ID_RE.test(itemId)) bad(`${where}.itemId tiene caracteres no válidos`); }
  return strip({
    original: str(e.original, `${where}.original`, { min: 1, max: LIMITS.maxOriginal }),
    code,
    correction: str(e.correction, `${where}.correction`, { optional: true }),
    context: str(e.context, `${where}.context`, { optional: true }),
    topics: topics ?? [],
    origin: oneOf(e.origin, ORIGINS, `${where}.origin`),
    kind: oneOf(e.kind, ERR_KINDS, `${where}.kind`),
    impact: oneOf(e.impact, IMPACTS, `${where}.impact`),
    itemId: itemId === undefined ? null : itemId,
    ts: e.ts === undefined ? undefined : isoDate(e.ts, `${where}.ts`),
    source: 'chat',
  });
}

const PAYLOADS = {
  llevar_al_chat(p) {
    onlyKeys(p, ['tema', 'item', 'respuesta', 'errores', 'dominio', 'mensaje'], 'llevar_al_chat');
    const errs = list(p.errores, 'errores', LIMITS.maxShortErrors, true);
    let dominio;
    if (p.dominio !== undefined) {
      if (!isPlain(p.dominio)) bad('dominio debe ser un objeto');
      onlyKeys(p.dominio, ['pct', 'banda'], 'dominio');
      dominio = strip({ pct: pct(p.dominio.pct, 'dominio.pct'), banda: str(p.dominio.banda, 'dominio.banda', { max: 40, optional: true }) });
    }
    return strip({
      tema: str(p.tema, 'tema', { max: 200, optional: true }),
      item: str(p.item, 'item', { max: LIMITS.maxString, optional: true }),
      respuesta: str(p.respuesta, 'respuesta', { max: LIMITS.maxString, optional: true }),
      errores: errs && errs.map((e, i) => {
        if (!isPlain(e)) bad(`errores[${i}] debe ser un objeto`);
        onlyKeys(e, ['code', 'original', 'correction'], `errores[${i}]`);
        return strip({ code: str(e.code, `errores[${i}].code`, { min: 1, max: 60 }), original: str(e.original, `errores[${i}].original`, { min: 1, max: LIMITS.maxOriginal }), correction: str(e.correction, `errores[${i}].correction`, { optional: true }) });
      }),
      dominio,
      mensaje: str(p.mensaje, 'mensaje', { max: LIMITS.maxLong, optional: true }),
    });
  },
  errores(p) {
    onlyKeys(p, ['errores', 'temas'], 'errores');
    const errs = list(p.errores, 'errores', LIMITS.maxErrors);
    if (errs.length === 0) bad('errores no puede venir vacío');
    const temas = list(p.temas, 'temas', LIMITS.maxTopics, true);
    return strip({
      errores: errs.map(errorEntry),
      temas: temas && temas.map((t, i) => {
        if (!isPlain(t)) bad(`temas[${i}] debe ser un objeto`);
        onlyKeys(t, ['id', 'estado'], `temas[${i}]`);
        const id = str(t.id, `temas[${i}].id`, { min: 1, max: 80 });
        if (!ID_RE.test(id)) bad(`temas[${i}].id tiene caracteres no válidos`);
        return { id, estado: str(t.estado, `temas[${i}].estado`, { min: 1, max: 40 }) };
      }),
    });
  },
  estado(p) {
    onlyKeys(p, ['dia', 'areas', 'temas', 'notas'], 'estado');
    let dia;
    if (p.dia !== undefined) { dia = str(p.dia, 'dia', { max: 10 }); if (!isRealDay(dia)) bad('dia debe tener la forma AAAA-MM-DD'); }
    const areas = list(p.areas, 'areas', 100, true);
    const temas = list(p.temas, 'temas', LIMITS.maxTopics, true);
    return strip({
      dia,
      areas: areas && areas.map((a, i) => {
        if (!isPlain(a)) bad(`areas[${i}] debe ser un objeto`);
        onlyKeys(a, ['area', 'pct'], `areas[${i}]`);
        return { area: str(a.area, `areas[${i}].area`, { min: 1, max: 80 }), pct: pct(a.pct, `areas[${i}].pct`) };
      }),
      temas: temas && temas.map((t, i) => {
        if (!isPlain(t)) bad(`temas[${i}] debe ser un objeto`);
        onlyKeys(t, ['id', 'pct', 'banda'], `temas[${i}]`);
        const id = str(t.id, `temas[${i}].id`, { min: 1, max: 80 });
        if (!ID_RE.test(id)) bad(`temas[${i}].id tiene caracteres no válidos`);
        return strip({ id, pct: t.pct === undefined ? undefined : pct(t.pct, `temas[${i}].pct`), banda: str(t.banda, `temas[${i}].banda`, { max: 40, optional: true }) });
      }),
      notas: str(p.notas, 'notas', { max: LIMITS.maxLong, optional: true }),
    });
  },
  bitacora(p) {
    onlyKeys(p, ['texto'], 'bitacora');
    return { texto: str(p.texto, 'texto', { min: 1, max: LIMITS.maxLong }) };
  },
};

export function validateChatPayload(kind, payload) {
  if (!BLOCK_KINDS.includes(kind)) return fail('BAD_KIND', `Tipo de bloque desconocido: ${show(kind)}. Los válidos son: ${BLOCK_KINDS.join(', ')}.`);
  if (!isPlain(payload)) return fail('BAD_PAYLOAD', 'El contenido del bloque debe ser un objeto.');
  try {
    return { ok: true, payload: PAYLOADS[kind](payload) };
  } catch (e) {
    if (e instanceof Bad) return fail('BAD_PAYLOAD', `El bloque «${kind}» no es válido: ${e.message}.`);
    throw e;
  }
}

export function makeChatBlock(kind, payload, { now = new Date() } = {}) {
  const v = validateChatPayload(kind, payload);
  if (!v.ok) throw new ChatBlockError(v.error.code, v.error.message);
  const when = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(when.getTime())) throw new ChatBlockError('BAD_DATE', 'La fecha del bloque no es válida.');
  return `=== ${BLOCK_FORMAT} v${BLOCK_VERSION} ===\ntipo: ${kind}\ngenerado: ${when.toISOString()}\n${JSON.stringify(v.payload, null, 2)}\n=== FIN ===`;
}

// ---- lectura -----------------------------------------------------------------------------------------------------------------------

const DECOR = '[\\s>*_`#~-]*';
const START_RE = new RegExp(`^${DECOR}={3,}\\s*SOPHIA[-\\s]?EN[-\\s]?SYNC\\s*(?:v\\s*(\\d+(?:\\.\\d+)?))?\\s*={3,}${DECOR}$`, 'i');
const END_RE = new RegExp(`^${DECOR}={3,}\\s*FIN\\s*={3,}${DECOR}$`, 'i');
const FENCE_RE = /^\s*(?:>\s*)?(?:```|~~~)[\w-]*\s*$/;

function clean(text) {
  return text.replace(/^\ufeff/, '').replace(/[\u200b-\u200d\u2060\ufeff]/g, '').replace(/[\u00a0\u2007\u202f]/g, ' ').replace(/\r\n?/g, '\n');
}

// Recorre un valor leído de JSON sin recursión (una lista de un millón de niveles no desborda la pila) y dice qué le pasa: demasiados nodos, demasiada profundidad o un nombre de campo prohibido.
// También rechaza números que JSON.parse convierte en infinito (1e999), que al guardar se volverían null. Devuelve null si está bien. Lo usan los bloques del chat (límites de LIMITS) y los respaldos (core/sync.js, con límites propios). maxNodes = Infinity no cuenta nodos.
export function scanValue(root, { maxDepth = LIMITS.maxDepth, maxNodes = LIMITS.maxNodes } = {}) {
  let nodes = 0;
  const stack = [[root, 1]];
  while (stack.length) {
    const [v, depth] = stack.pop();
    nodes += 1;
    if (nodes > maxNodes) return 'tiene demasiados elementos';
    if (typeof v === 'number' && !Number.isFinite(v)) return 'trae un número fuera de rango (por ejemplo 1e999)';
    if (v === null || typeof v !== 'object') continue;
    if (depth > maxDepth) return 'tiene demasiados niveles de anidación';
    const keys = Array.isArray(v) ? [] : Object.keys(v);
    for (const k of keys) if (BAD_KEYS.includes(k)) return `usa el nombre de campo prohibido ${show(k)}`;
    for (const child of Array.isArray(v) ? v : Object.values(v)) stack.push([child, depth + 1]);
  }
  return null;
}

// Lee una línea de cabecera («tipo: errores», «**generado:** …») en tiempo lineal. Devuelve el valor sin adornos, o null si la línea no es de ese campo.
// No usa una expresión regular con «(.*?)» seguida de un grupo opcional: con una línea larga llena de «_» y espacios tardaba minutos (ReDoS).
const LEAD_DECOR = new Set(['*', '_', '`', '>']);
const TAIL_DECOR = new Set(['*', '_', '`']);
const isBlank = (c) => /\s/.test(c);
function headerValue(line, name) {
  let a = 0;
  while (a < line.length && (isBlank(line[a]) || LEAD_DECOR.has(line[a]))) a += 1;
  if (line.slice(a, a + name.length).toLowerCase() !== name) return null;
  let i = a + name.length;
  while (i < line.length && TAIL_DECOR.has(line[i])) i += 1;
  while (i < line.length && isBlank(line[i])) i += 1;
  if (line[i] !== ':') return null;
  i += 1;
  while (i < line.length && (isBlank(line[i]) || TAIL_DECOR.has(line[i]))) i += 1;
  let z = line.length;
  while (z > i && (isBlank(line[z - 1]) || TAIL_DECOR.has(line[z - 1]))) z -= 1;
  return line.slice(i, z);
}

const QUOTE_MESSAGE = "Parece una cita: quita los '>' y vuelve a pegar.";
// Una línea de cita empieza (tras los espacios) por «>». En un JSON válido ninguna línea empieza así, y solo se mira cuando el JSON ya falló.
const isQuoteLine = (line) => line.trimStart().startsWith('>');

export function parseChatBlock(text) {
  if (typeof text !== 'string' || text.trim() === '') return fail('NO_TEXT', 'No hay nada que leer: pega el bloque completo, de «=== SOPHIA-EN-SYNC v1 ===» a «=== FIN ===».');
  if (text.length > LIMITS.maxTextChars) return fail('TOO_BIG', 'El texto es demasiado grande para ser un bloque del chat.');
  const lines = clean(text).split('\n');
  const starts = [];
  lines.forEach((l, i) => { if (START_RE.test(l)) starts.push(i); });
  if (starts.length === 0) return fail('NO_BLOCK', 'No encuentro el inicio del bloque. Debe empezar con «=== SOPHIA-EN-SYNC v1 ===».');
  const first = starts[0];
  const m = START_RE.exec(lines[first]);
  const versionText = m[1];
  let endAt = -1;
  for (let i = first + 1; i < lines.length; i += 1) if (END_RE.test(lines[i])) { endAt = i; break; }
  if (endAt < 0) return fail('NO_END', 'El bloque está cortado: falta la línea «=== FIN ===». Pégalo completo.');
  const others = starts.filter((s) => s > endAt).length;
  if (versionText === undefined) return fail('BAD_VERSION', 'Al bloque le falta la versión: debe empezar con «=== SOPHIA-EN-SYNC v1 ===».');
  const version = Number(versionText);
  if (version !== BLOCK_VERSION) {
    return version > BLOCK_VERSION
      ? fail('NEWER_VERSION', `Este bloque es de una versión más nueva del formato (v${versionText}). Actualiza la app para leerlo.`)
      : fail('BAD_VERSION', `La versión v${versionText} del formato no existe. La app lee la v${BLOCK_VERSION}.`);
  }
  const body = lines.slice(first + 1, endAt).filter((l) => !FENCE_RE.test(l));
  let kind = null;
  let generado = null;
  let rest = 0;
  for (; rest < body.length; rest += 1) {
    const line = body[rest].trim();
    if (line === '') continue;
    const vk = headerValue(line, 'tipo');
    const vg = headerValue(line, 'generado');
    if (vk !== null && kind === null) kind = vk.toLowerCase();
    else if (vg !== null && generado === null) generado = vg;
    else break;
  }
  if (kind === null) return fail('BAD_KIND', `Al bloque le falta la línea «tipo:». Los tipos válidos son: ${BLOCK_KINDS.join(', ')}.`);
  if (!BLOCK_KINDS.includes(kind)) return fail('BAD_KIND', `Tipo de bloque desconocido: ${show(kind)}. Los válidos son: ${BLOCK_KINDS.join(', ')}.`);
  let generatedAt = null;
  if (generado !== null) {
    const t = Date.parse(generado);
    if (generado === '' || Number.isNaN(t)) return fail('BAD_DATE', `La fecha «generado:» no es válida: ${show(generado)}.`);
    generatedAt = new Date(t).toISOString();
  }
  const raw = body.slice(rest).join('\n');
  const a = raw.indexOf('{');
  const z = raw.lastIndexOf('}');
  if (a < 0 || z < a) return fail('NO_JSON', 'No encuentro el contenido del bloque (el JSON entre llaves).');
  const json = raw.slice(a, z + 1);
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    try {
      data = JSON.parse(json.replace(/[\u201c\u201d\u201e\u201f\u00ab\u00bb]/g, '"'));
    } catch {
      // Un bloque pegado como cita («> » al inicio de cada línea) no se lee; se avisa con amabilidad (Administrador, 2026-10-26).
      if (raw.split('\n').some(isQuoteLine)) return fail('BAD_JSON', QUOTE_MESSAGE);
      return fail('BAD_JSON', 'El contenido del bloque no es un JSON válido. Revisa comas, llaves y comillas; pide al chat que lo escriba de nuevo.');
    }
  }
  const problem = scanValue(data);
  if (problem) return fail('HOSTILE', `El bloque no se puede leer: ${problem}.`);
  const v = validateChatPayload(kind, data);
  if (!v.ok) return v;
  return { ok: true, kind, generatedAt, payload: v.payload, others };
}
