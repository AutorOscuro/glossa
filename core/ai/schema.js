// @purpose: Extrae y valida el JSON que devuelve la IA contra un esquema pequeño (tipos, requeridos, rangos, enum); trata todo como no confiable.
// Validación de JSON de IA (1.10-T1). Roadmap 8.16: el contenido de la IA es NO confiable; el JSON se valida antes de usarse.
// parseJson(text) → { ok:true, value } | { ok:false, reason:'bad_json' }   (admite cercas ```json … ``` y texto alrededor de un único objeto/lista)
// validate(value, schema) → { ok:true, value } | { ok:false, errors:['ruta: motivo', …] }   (los motivos NO incluyen el valor recibido)
// Esquema: { type: 'object'|'array'|'string'|'number'|'integer'|'boolean'|'null' | [tipos], enum, required:[], properties:{}, additionalProperties:false,
//            items, minItems, maxItems, minLength, maxLength, minimum, maximum }.  Por defecto un objeto NO admite claves que el esquema no declare.
export const LIMITS = Object.freeze({ maxChars: 200000, maxDepth: 12, maxErrors: 20 });

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function stripFence(text) {
  const m = /^```[a-zA-Z]*\s*\n?([\s\S]*?)\n?```$/.exec(text.trim());
  return m ? m[1].trim() : text.trim();
}

// Busca el primer bloque { … } o [ … ] equilibrado (respeta cadenas) para tolerar «Aquí está: {…}».
function firstBalanced(text) {
  const start = text.search(/[{[]/);
  if (start < 0) return null;
  const open = text[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inStr = false;
  for (let i = start; i < text.length; i += 1) {
    const c = text[i];
    if (inStr) { if (c === '\\') i += 1; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === open) depth += 1;
    else if (c === close) { depth -= 1; if (depth === 0) return /[{[]/.test(text.slice(i + 1)) ? null : text.slice(start, i + 1); } // otro bloque después = ambiguo: no se adivina
  }
  return null;
}

function depthOf(v, d = 0) {
  if (d > LIMITS.maxDepth) return d;
  if (v === null || typeof v !== 'object') return d;
  let max = d;
  for (const x of Object.values(v)) max = Math.max(max, depthOf(x, d + 1));
  return max;
}

function hasForbiddenKey(v) {
  if (v === null || typeof v !== 'object') return false;
  if (!Array.isArray(v) && Object.keys(v).some((k) => FORBIDDEN_KEYS.has(k))) return true;
  return Object.values(v).some(hasForbiddenKey);
}

export function parseJson(text) {
  if (typeof text !== 'string' || text.trim() === '' || text.length > LIMITS.maxChars) return { ok: false, reason: 'bad_json' };
  const attempts = [stripFence(text)];
  const inner = firstBalanced(text);
  if (inner !== null) attempts.push(inner);
  for (const a of attempts) {
    try {
      const value = JSON.parse(a);
      if (value === null || typeof value !== 'object') continue; // la IA debe devolver objeto o lista, no un número suelto
      if (depthOf(value) > LIMITS.maxDepth || hasForbiddenKey(value)) return { ok: false, reason: 'bad_json' };
      return { ok: true, value };
    } catch { /* se prueba el siguiente intento */ }
  }
  return { ok: false, reason: 'bad_json' };
}

const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
function typeMatches(v, t) {
  if (t === 'integer') return typeof v === 'number' && Number.isInteger(v);
  if (t === 'number') return typeof v === 'number' && Number.isFinite(v);
  return typeOf(v) === t;
}

function check(v, s, path, errors) {
  if (errors.length >= LIMITS.maxErrors) return;
  const at = path || '(raíz)';
  const fail = (msg) => { if (errors.length < LIMITS.maxErrors) errors.push(`${at}: ${msg}`); };
  if (s.type !== undefined) {
    const types = Array.isArray(s.type) ? s.type : [s.type];
    if (!types.some((t) => typeMatches(v, t))) { fail(`se esperaba ${types.join(' o ')}`); return; }
  }
  if (s.enum !== undefined && !s.enum.some((e) => e === v)) fail('valor fuera de los permitidos');
  if (typeof v === 'string') {
    if (s.minLength !== undefined && v.length < s.minLength) fail(`mínimo ${s.minLength} caracteres`);
    if (s.maxLength !== undefined && v.length > s.maxLength) fail(`máximo ${s.maxLength} caracteres`);
  }
  if (typeof v === 'number') {
    if (s.minimum !== undefined && v < s.minimum) fail(`debe ser ≥ ${s.minimum}`);
    if (s.maximum !== undefined && v > s.maximum) fail(`debe ser ≤ ${s.maximum}`);
  }
  if (Array.isArray(v)) {
    if (s.minItems !== undefined && v.length < s.minItems) fail(`mínimo ${s.minItems} elementos`);
    if (s.maxItems !== undefined && v.length > s.maxItems) fail(`máximo ${s.maxItems} elementos`);
    if (s.items) v.forEach((x, i) => check(x, s.items, `${path}[${i}]`, errors));
  } else if (v !== null && typeof v === 'object') {
    const props = s.properties || {};
    for (const k of s.required || []) if (!Object.hasOwn(v, k)) fail(`falta «${k}»`);
    for (const [k, x] of Object.entries(v)) {
      if (Object.hasOwn(props, k)) check(x, props[k], path ? `${path}.${k}` : k, errors);
      else if (s.additionalProperties !== true) fail(`campo no permitido «${k.slice(0, 40)}»`);
    }
  }
}

export function validate(value, schema) {
  if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) throw new Error('validate: el esquema debe ser un objeto.');
  const errors = [];
  check(value, schema, '', errors);
  return errors.length ? { ok: false, errors } : { ok: true, value };
}
