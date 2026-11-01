// @purpose: Limpia y escapa el texto que devuelve la IA antes de mostrarlo: quita caracteres de control y convierte los símbolos de marcado en entidades.
// Escape del texto de la IA (1.10-T3). Todo lo que llega de un modelo es no confiable: nunca se pone en la página tal cual.
//   cleanText(s) → texto sin caracteres de control (salvo tab, salto de línea y retorno) y sin marcas de dirección ocultas.
//   escapeHtml(s) → cleanText + & < > " ' ` / convertidos en entidades. Un valor que no es texto da ''.
//   escapeDeep(v) → copia del valor con cada texto (también las claves) escapado; límites de profundidad y de tamaño; nunca lanza.
// La interfaz debe mostrar `result.safe.*` o usar textContent; nunca pegar `result.text` en la página.
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;', '/': '&#47;' };
const MAX_DEPTH = 12;
const MAX_NODES = 5000;

export function cleanText(value) {
  return typeof value === 'string' ? value.replace(CONTROL_RE, '') : '';
}

export function escapeHtml(value) {
  return cleanText(value).replace(/[&<>"'`/]/g, (c) => ENTITIES[c]);
}

export function escapeDeep(value) {
  let nodes = 0;
  const walk = (v, depth) => {
    nodes += 1;
    if (nodes > MAX_NODES || depth > MAX_DEPTH) return null;
    if (typeof v === 'string') return escapeHtml(v);
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'boolean' || v === null) return v;
    if (Array.isArray(v)) return v.map((e) => walk(e, depth + 1));
    if (typeof v === 'object') return Object.fromEntries(Object.keys(v).map((k) => [escapeHtml(k), walk(v[k], depth + 1)]));
    return null;
  };
  try { return walk(value, 0); } catch { return null; }
}
