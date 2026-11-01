// @purpose: Generador de la bitácora en texto plano (fecha, qué se hizo, dominio por área, errores top, tareas por hacer, decisiones) para pegar en el chat.
// Bitácora en texto plano (subparte 1.12-T3). Roadmap 1.12 y 8.14. Función pura: sin base, sin reloj propio, sin DOM.
//
//   buildLogText(data?, { now? }) → string
//     data = { day?, done?, pending?, decisions?, areas?, topErrors?, windowDays? }   (todo opcional; un campo desconocido lanza Error: es un fallo de quien programa)
//       day         'AAAA-MM-DD' (por defecto el día local de `now`)
//       done        textos de «qué se hizo»; pending: tareas por hacer; decisions: decisiones tomadas
//       areas       [{ area, pct, band? }]   dominio por área (pct 0–100; band = etiqueta ya traducida, p. ej. «Dominado»)
//       topErrors   [{ code, title?, frequency, impact? }]   errores top (impact low | mid | high); NO lleva el texto escrito por la persona
//       windowDays  días que cubre el ranking de errores (solo para el encabezado; por defecto 14, la ventana de la sección 17)
//     Salida: texto sin formato especial (sin markdown), con secciones fijas y «(nada registrado)» en las vacías, y con tope de elementos y de largo
//     por línea, de modo que nunca pasa de LOG_LIMITS.maxChars y siempre cabe en un bloque `bitacora` (core/syncChat.js, 20.000 caracteres).
//   AREA_LABELS: nombre en español de cada área de la taxonomía (clave → etiqueta). Un área desconocida se muestra con su clave.
import { localDay } from './clock.js';
import { isRealDay } from './syncChat.js';

export const LOG_LIMITS = Object.freeze({ items: 20, decisions: 15, areas: 30, topErrors: 10, line: 200, maxChars: 19_000 });
export const AREA_LABELS = Object.freeze({
  gram: 'Gramática', vocab: 'Vocabulario', verb: 'Verbos', phr: 'Phrasal verbs', prep: 'Preposiciones', read: 'Lectura',
  listen: 'Escucha', speak: 'Habla', pron: 'Pronunciación', write: 'Escritura', med: 'Mediación', spell: 'Ortografía',
});
const IMPACT_ES = Object.freeze({ low: 'bajo', mid: 'medio', high: 'alto' });
const KEYS = ['day', 'done', 'pending', 'decisions', 'areas', 'topErrors', 'windowDays'];
const NONE = '- (nada registrado)';

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Una sola línea, sin caracteres de control, con tope de largo.
function oneLine(s, max = LOG_LIMITS.line) {
  const t = String(s).replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  // no dejar medio emoji: si el corte cae entre las dos mitades de un par, se quita la primera mitad
  return `${/[\ud800-\udbff]$/.test(cut) ? cut.slice(0, -1) : cut}…`;
}

function textList(v, name) {
  if (v === undefined) return [];
  if (!Array.isArray(v)) throw new Error(`buildLogText: ${name} debe ser una lista de textos`);
  return v.map((s, i) => {
    if (typeof s !== 'string') throw new Error(`buildLogText: ${name}[${i}] debe ser un texto`);
    return oneLine(s);
  }).filter((s) => s !== '');
}

function bullets(items, max) {
  if (items.length === 0) return [NONE];
  const lines = items.slice(0, max).map((s) => `- ${s}`);
  if (items.length > max) lines.push(`- … y ${items.length - max} más`);
  return lines;
}

function areaLines(areas) {
  if (areas === undefined) return [NONE];
  if (!Array.isArray(areas)) throw new Error('buildLogText: areas debe ser una lista');
  const rows = areas.map((a, i) => {
    if (!isPlain(a) || typeof a.area !== 'string' || a.area.trim() === '') throw new Error(`buildLogText: areas[${i}] necesita el campo area (texto)`);
    if (typeof a.pct !== 'number' || !Number.isFinite(a.pct) || a.pct < 0 || a.pct > 100) throw new Error(`buildLogText: areas[${i}].pct debe ser un número de 0 a 100`);
    const name = Object.hasOwn(AREA_LABELS, a.area) ? AREA_LABELS[a.area] : oneLine(a.area, 60);
    const band = typeof a.band === 'string' && a.band.trim() !== '' ? ` (${oneLine(a.band, 40)})` : '';
    return `${name}: ${Math.round(a.pct)} %${band}`;
  });
  return bullets(rows, LOG_LIMITS.areas);
}

function errorLines(list) {
  if (list === undefined) return [NONE];
  if (!Array.isArray(list)) throw new Error('buildLogText: topErrors debe ser una lista');
  const rows = list.map((e, i) => {
    if (!isPlain(e) || typeof e.code !== 'string' || e.code.trim() === '') throw new Error(`buildLogText: topErrors[${i}] necesita el campo code (texto)`);
    if (!Number.isInteger(e.frequency) || e.frequency < 1) throw new Error(`buildLogText: topErrors[${i}].frequency debe ser un entero ≥ 1`);
    if (e.impact !== undefined && !Object.hasOwn(IMPACT_ES, e.impact)) throw new Error(`buildLogText: topErrors[${i}].impact debe ser low, mid o high`);
    const title = typeof e.title === 'string' && e.title.trim() !== '' ? ` — ${oneLine(e.title, 100)}` : '';
    const impact = e.impact === undefined ? '' : ` · impacto ${IMPACT_ES[e.impact]}`;
    return `${oneLine(e.code, 60)}${title}: ${e.frequency} ${e.frequency === 1 ? 'vez' : 'veces'}${impact}`;
  });
  if (rows.length === 0) return [NONE];
  const lines = rows.slice(0, LOG_LIMITS.topErrors).map((s, i) => `${i + 1}. ${s}`);
  if (rows.length > LOG_LIMITS.topErrors) lines.push(`… y ${rows.length - LOG_LIMITS.topErrors} más`);
  return lines;
}

export function buildLogText(data = {}, { now = new Date() } = {}) {
  if (!isPlain(data)) throw new Error('buildLogText: los datos deben ser un objeto');
  for (const k of Object.keys(data)) if (!KEYS.includes(k)) throw new Error(`buildLogText: campo desconocido «${oneLine(k, 40)}»`);
  const when = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(when.getTime())) throw new Error('buildLogText: la fecha no es válida');
  const day = data.day === undefined ? localDay(when) : data.day;
  if (!isRealDay(day)) throw new Error('buildLogText: day debe tener la forma AAAA-MM-DD');
  const windowDays = data.windowDays === undefined ? 14 : data.windowDays;
  if (!Number.isInteger(windowDays) || windowDays < 1 || windowDays > 365) throw new Error('buildLogText: windowDays debe ser un entero de 1 a 365');
  return [
    `BITÁCORA DE ESTUDIO — ${day}`,
    `Generada: ${when.toISOString()}`,
    '',
    'QUÉ SE HIZO',
    ...bullets(textList(data.done, 'done'), LOG_LIMITS.items),
    '',
    'DOMINIO POR ÁREA',
    ...areaLines(data.areas),
    '',
    `ERRORES TOP (últimos ${windowDays} días)`,
    ...errorLines(data.topErrors),
    '',
    'PENDIENTES',
    ...bullets(textList(data.pending, 'pending'), LOG_LIMITS.items),
    '',
    'DECISIONES',
    ...bullets(textList(data.decisions, 'decisions'), LOG_LIMITS.decisions),
  ].join('\n');
}
