// @purpose: Reglas comunes de validación de contenido: áreas, niveles, límites, informe de problemas y comprobaciones básicas.
// Reglas comunes de validación de contenido (subparte 1.3, cuarto 1, mitad A). Roadmap 8.1–8.3 y 1.3. Puro: sin DOM, sin base de datos, sin archivos.
// Lo usan los validadores de Topic, Item, Pack, LexEntry y Story, el validador de línea de comandos y `add-pack`: una sola implementación.
//
// Una ESPECIFICACIÓN es un dato que describe la forma de un valor; `check` la recorre y anota cada problema con su ruta exacta
// (`items[12].accept[0]`) en un INFORME. Nunca lanza, ni con objetos hostiles (getters que fallan, Proxy).
//   Constructores:  text(max, {multiline, allowEmpty}) · int(min, max) · bool() · oneOf([...]) · idOf(regex, qué) · errorCode()
//                   list(spec, {min, max, unique}) · obj({ campo: spec }) · custom((r, path, valor, ctx) => …)
//                   optional(spec) (puede faltar) · nullable(spec) (puede ser null o faltar; ausente ≡ null)
//   Informe:        createReport(max?) → { error(path, rule, msg), warn(path, rule, msg), result() }
//                   result() → { ok, errors, warnings, errorTotal, warningTotal }  (se guardan solo los primeros `max` de cada lista)
//   `ctx.errorCodes` (opcional): un Set (o algo con `has`) con los códigos de error_codes.json; si viene, `errorCode()` exige que exista.
// Cada problema es { path, rule, message }; `rule` es un código estable (TYPE, REQUIRED, TEXT_HTML, …) que las pruebas y el CLI usan.

// Contrato 8.1.
export const AREAS = Object.freeze(['gram', 'vocab', 'verb', 'phr', 'prep', 'read', 'listen', 'speak', 'pron', 'write', 'med', 'spell']);
export const LEVELS = Object.freeze(['PreA1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

// short = títulos; text = una frase o un enunciado; long = explicaciones; list = tope de elementos por defecto.
export const LIMITS = Object.freeze({ short: 120, text: 600, long: 2000, list: 50, maxProblems: 200, idLength: 100, codeLength: 60 });

// Mismo formato que `CODE_RE` de core/eventSchema.js (TNS.SINCE_FOR, PRON.-ED).
export const CODE_RE = /^[A-Z][A-Z0-9_]*\.[A-Z0-9_.-]+$/;

// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001F\u007F-\u009F]/;
// eslint-disable-next-line no-control-regex
const CONTROL_MULTI_RE = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/; // deja pasar solo el salto de línea
const INVISIBLE_RE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u00AD\uFEFF]/;
// Etiquetas (`<b`, `</p`, `<!--`, `<?xml`) y entidades (`&amp;`, `&#39;`). "a < b" y "Tom & Jerry" son texto normal; "x<y" sí se rechaza.
const HTML_RE = /<\/?[A-Za-z!?]|&(?:#\d{1,7}|#[xX][0-9a-fA-F]{1,6}|[A-Za-z][A-Za-z0-9]{1,31});/;
const SPACES_RE = /^\s|\s$| {2,}/;
const CURLY_RE = /[\u2018\u2019\u02BC\u00B4`\u2032]/;

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
  && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

// ---------- rutas e informe ----------
export function joinPath(base, key) {
  if (typeof key === 'number') return `${base}[${key}]`;
  return base ? `${base}.${key}` : String(key);
}

// `ruta: mensaje`, o `archivo › ruta: mensaje` (la raíz se nombra "(raíz)").
export function formatProblem(p, file) {
  if (!p || typeof p !== 'object') return '';
  return `${file ? `${file} › ` : ''}${p.path || '(raíz)'}: ${p.message}`;
}

export function createReport(max = LIMITS.maxProblems) {
  const errors = [];
  const warnings = [];
  let errorTotal = 0;
  let warningTotal = 0;
  return {
    error(path, rule, message) { errorTotal += 1; if (errors.length < max) errors.push({ path, rule, message }); },
    warn(path, rule, message) { warningTotal += 1; if (warnings.length < max) warnings.push({ path, rule, message }); },
    result() { return { ok: errorTotal === 0, errors, warnings, errorTotal, warningTotal }; },
  };
}

// ---------- constructores de especificaciones ----------
export const text = (max = LIMITS.text, o = {}) => ({ kind: 'text', max, ...o });
export const int = (min, max) => ({ kind: 'int', min, max });
export const bool = () => ({ kind: 'bool' });
export const oneOf = (values) => ({ kind: 'enum', values });
export const idOf = (re, what = 'un identificador') => ({ kind: 'id', re, what });
export const errorCode = () => ({ kind: 'code' });
export const list = (of, o = {}) => ({ kind: 'list', of, ...o });
export const obj = (fields, o = {}) => ({ kind: 'obj', fields, ...o });
export const custom = (fn) => ({ kind: 'custom', fn });
export const optional = (spec) => ({ ...spec, optional: true });
export const nullable = (spec) => ({ ...spec, nullable: true, optional: true });

// ---------- comprobaciones ----------
function checkText(r, path, v, spec) {
  if (typeof v !== 'string') { r.error(path, 'TYPE', 'debe ser texto'); return; }
  if (!spec.allowEmpty && v.trim() === '') { r.error(path, 'TEXT_EMPTY', 'no puede estar vacío'); return; }
  const max = spec.max ?? LIMITS.text;
  if (v.length > max) { r.error(path, 'TEXT_TOO_LONG', `supera ${max} caracteres (tiene ${v.length})`); return; }
  if ((spec.multiline ? CONTROL_MULTI_RE : CONTROL_RE).test(v)) {
    r.error(path, 'TEXT_CONTROL', spec.multiline ? 'tiene caracteres de control (solo se permite el salto de línea)' : 'tiene caracteres de control (tabulador, salto de línea u otros)');
  }
  if (INVISIBLE_RE.test(v)) r.error(path, 'TEXT_INVISIBLE', 'tiene caracteres invisibles (ancho cero, guion blando u otros); suelen venir de copiar y pegar');
  if (HTML_RE.test(v)) r.error(path, 'TEXT_HTML', 'no puede llevar HTML (etiquetas o entidades como &amp;); escribe el texto plano');
  if (SPACES_RE.test(v)) r.warn(path, 'TEXT_SPACES', 'tiene espacios al inicio, al final o dobles');
  if (CURLY_RE.test(v)) r.warn(path, 'TEXT_CURLY_APOSTROPHE', "usa el apóstrofo recto ' (contrato 8.1)");
}

function checkInt(r, path, v, spec) {
  if (typeof v !== 'number' || !Number.isInteger(v)) { r.error(path, 'TYPE', 'debe ser un número entero'); return; }
  if (v < spec.min || v > spec.max) r.error(path, 'RANGE', `debe estar entre ${spec.min} y ${spec.max}`);
}

function checkId(r, path, v, spec) {
  if (typeof v !== 'string') { r.error(path, 'TYPE', 'debe ser texto'); return; }
  if (v.length > LIMITS.idLength || !spec.re.test(v)) r.error(path, 'FORMAT', `formato no válido: debe ser ${spec.what}`);
}

function checkCode(r, path, v, ctx) {
  if (typeof v !== 'string') { r.error(path, 'TYPE', 'debe ser texto'); return; }
  if (v.length > LIMITS.codeLength || !CODE_RE.test(v)) { r.error(path, 'FORMAT', 'formato no válido: debe ser GRUPO.CÓDIGO en mayúsculas, p. ej. TNS.SINCE_FOR'); return; }
  const known = ctx && ctx.errorCodes;
  if (known && typeof known.has === 'function' && !known.has(v)) r.error(path, 'UNKNOWN_CODE', `el código ${v} no existe en content/taxonomy/error_codes.json`);
}

function checkList(r, path, v, spec, ctx) {
  if (!Array.isArray(v)) { r.error(path, 'TYPE', 'debe ser una lista'); return; }
  const min = spec.min ?? 0;
  const max = spec.max ?? LIMITS.list;
  if (v.length < min || v.length > max) r.error(path, 'LIST_SIZE', `debe tener entre ${min} y ${max} elementos (tiene ${v.length})`);
  const seen = spec.unique ? new Set() : null;
  const n = Math.min(v.length, max); // una lista gigante no se recorre entera
  for (let i = 0; i < n; i += 1) {
    const el = v[i];
    check(r, joinPath(path, i), el, spec.of, ctx);
    if (seen && (typeof el === 'string' || typeof el === 'number')) {
      if (seen.has(el)) r.error(joinPath(path, i), 'DUPLICATE', 'está repetido');
      else seen.add(el);
    }
  }
}

function checkObj(r, path, v, spec, ctx) {
  if (!isPlain(v)) { r.error(path, 'TYPE', 'debe ser un objeto'); return; }
  const src = { ...v }; // una sola lectura: un getter que falle sale como UNREADABLE (lo atrapa `check`)
  for (const k of Object.keys(src)) if (!has(spec.fields, k)) r.error(joinPath(path, k), 'UNKNOWN_FIELD', 'campo desconocido');
  for (const [k, fieldSpec] of Object.entries(spec.fields)) {
    const val = src[k];
    if (val === undefined) {
      if (!fieldSpec.optional && !fieldSpec.nullable) r.error(joinPath(path, k), 'REQUIRED', 'falta este campo');
      continue;
    }
    check(r, joinPath(path, k), val, fieldSpec, ctx);
  }
}

// Comprueba `v` contra `spec` y anota los problemas en `r`. `path` es la ruta base ('' en la raíz). Nunca lanza.
export function check(r, path, v, spec, ctx = {}) {
  if (!spec || typeof spec !== 'object') return;
  try {
    if (v === undefined) { r.error(path, 'REQUIRED', 'falta este valor'); return; }
    if (v === null && spec.nullable) return;
    switch (spec.kind) {
      case 'text': checkText(r, path, v, spec); break;
      case 'int': checkInt(r, path, v, spec); break;
      case 'bool': if (typeof v !== 'boolean') r.error(path, 'TYPE', 'debe ser verdadero o falso'); break;
      case 'enum': if (!spec.values.includes(v)) r.error(path, 'ENUM', `debe ser uno de: ${spec.values.join(', ')}`); break;
      case 'id': checkId(r, path, v, spec); break;
      case 'code': checkCode(r, path, v, ctx); break;
      case 'list': checkList(r, path, v, spec, ctx); break;
      case 'obj': checkObj(r, path, v, spec, ctx); break;
      case 'custom': spec.fn(r, path, v, ctx); break;
      default: break;
    }
  } catch {
    r.error(path, 'UNREADABLE', 'no se pudo leer este valor'); // no se inspecciona lo lanzado: también podría ser hostil
  }
}
