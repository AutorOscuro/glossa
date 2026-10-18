// Registro de eventos (subparte 1.1, cuartos 2, 3 y 4). Roadmap 1.1 y 8.6.
//
//   createEvents({ db, clock?, rng?, idGen? }) → { log, byCard, byItem, byTopic, since, countByDay, recentErrorsByCode, clearAll }
//     db     cualquier motor de core/db.js (memoria o IndexedDB). Obligatorio.
//     clock  reloj inyectable (core/clock.js); su now() da el `ts` cuando el evento no trae uno.
//     idGen  generador de IDs (core/eventSchema.js); por defecto uno nuevo con `rng`.
//   log(ev) → Promise<evento guardado>   (una COPIA con los 18 campos de 8.6, id y day incluidos)
//     Rechaza con EventError (code 'BAD_EVENT') si el evento no vale, sin tocar la base.
//     Rechaza con DbError si la base falla (QUOTA, ABORTED, CLOSED…): en ese caso no se guardó nada.
//     Escribe dentro de UNA transacción que antes comprueba que el id no exista: un evento nunca pisa a otro
//     (son inmutables). Si el id ya existe (otra pestaña, otra instancia con el mismo azar) pide otro, hasta MAX_ID_TRIES veces.
//
// Consultas (solo leen; cada una usa UN índice de `events` y devuelve copias; nunca modifican nada):
//   byCard(cardId, opts?) · byItem(itemId, opts?) · byTopic(topicId, opts?) → Promise<evento[]>
//   since(ts, opts?)                       ts = Date | número (ms) | texto ISO. INCLUSIVO: devuelve los eventos con ts ≥ el dado.
//     opts = { order: 'asc' | 'desc' (por defecto 'asc'), limit: entero ≥ 0 (por defecto sin tope) }
//     Orden: cronológico por `ts` y, si empatan, por `id`; 'desc' lo invierte exacto. `limit` se aplica DESPUÉS de ordenar
//     (order 'desc' + limit 5 = los 5 más recientes). Un evento sin cardId/itemId (null) no aparece en byCard/byItem (null no se indexa).
//     Argumentos no válidos (id vacío o no texto, ts ilegible, opción desconocida) rechazan con DbError BAD_QUERY; nunca devuelven "todo" en silencio.
//
// Conteo y errores recientes (cuarto 3, mitad B):
//   countByDay(range) → Promise<{ "AAAA-MM-DD": n }>   Cuenta TODOS los eventos (cualquier tipo) por su campo `day` (día LOCAL en que se registraron).
//     range = { from?, to? }, ambos INCLUSIVOS: un día "AAAA-MM-DD" real, o un Date / milisegundos (se pasan al día local). Obligatorio: `{}` = todo
//     el historial (hay que pedirlo a propósito). Sin días vacíos (un día sin eventos no aparece), claves en orden cronológico, objeto nuevo en cada llamada.
//     Coste: un recorrido por el índice `day` dentro del rango; lee los eventos del rango (O(eventos del rango)), no el historial entero.
//   recentErrorsByCode(code, { since, order?, limit? }) → Promise<evento[]>   Eventos con ts ≥ since cuyo `errorCodes` incluye `code`.
//     `errorCodes` NO tiene índice (8.13): usa el índice `ts` (como `since`) y filtra en memoria. Por eso `since` es OBLIGATORIO (sin cota recorrería
//     todo el historial). Coste: O(eventos desde `since`), no O(historial). Orden y limit como en `since` (limit se aplica DESPUÉS de filtrar y ordenar).
//
// Inmutabilidad (cuarto 4, mitad A): los eventos no se editan ni se borran de uno en uno. La API NO tiene update, put, delete ni remove, y el objeto
//   que devuelve createEvents está congelado (nadie puede añadirle métodos después). El ÚNICO camino para quitar eventos es:
//   clearAll() → Promise<número>   Borra TODOS los eventos en UNA transacción y devuelve cuántos había. Si la base falla (QUOTA, ABORTED, CLOSED…)
//     no se borra nada y rechaza con DbError. Solo toca el almacén `events`: tarjetas, errores, ajustes y claves quedan como estaban
//     (el borrado de todo el dispositivo es `wipeAll` de app/dataTools.js, que ya vacía también `events`). Después de clearAll, `log` y las
//     consultas siguen funcionando con normalidad sobre un registro vacío.
import { buildEvent, createIdGenerator } from './eventSchema.js';
import { DbError, classifyError } from './db.js';
import { systemClock, toIso, localDay } from './clock.js';
import { systemRng } from './rng.js';

export const MAX_ID_TRIES = 5;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function createEvents({ db, clock = systemClock, rng = systemRng, idGen } = {}) {
  if (!db || typeof db.tx !== 'function') throw new Error('createEvents: falta la base de datos (db.tx)');
  if (!clock || typeof clock.now !== 'function') throw new Error('createEvents: reloj no válido');
  const ids = idGen ?? createIdGenerator({ rng });

  async function log(input) {
    // Valida y completa ANTES de abrir la transacción: un evento malo no toca la base. Si lanza, la promesa rechaza con EventError.
    const built = buildEvent(input, { now: clock.now(), idGen: ids });
    try {
      return await db.tx(['events'], async (t) => {
        let candidate = built;
        for (let attempt = 1; attempt <= MAX_ID_TRIES; attempt += 1) {
          if (!(await t.get('events', candidate.id))) {
            await t.put('events', candidate);
            return candidate; // ya es una copia normalizada (validateEvent) y db.put guarda otra: nada se comparte con quien llama
          }
          if (attempt < MAX_ID_TRIES) candidate = { ...built, id: ids.next(built.ts) };
        }
        throw new DbError('ABORTED', `No se pudo asignar un id libre al evento tras ${MAX_ID_TRIES} intentos`, { store: 'events', retryable: true });
      });
    } catch (e) {
      throw classifyError(e, { store: 'events' });
    }
  }

  // ---------- Consultas ----------
  const badQuery = (msg) => new DbError('BAD_QUERY', `events: consulta no válida: ${msg}`, { store: 'events' });
  function readOpts(opts, extra = []) {
    const o = opts === undefined || opts === null ? {} : opts;
    if (typeof o !== 'object' || Array.isArray(o)) throw badQuery('las opciones deben ser un objeto');
    for (const k of Object.keys(o)) if (k !== 'order' && k !== 'limit' && !extra.includes(k)) throw badQuery(`opción desconocida "${k}"`);
    const order = o.order ?? 'asc';
    if (order !== 'asc' && order !== 'desc') throw badQuery('"order" debe ser "asc" o "desc"');
    if (o.limit !== undefined && (!Number.isInteger(o.limit) || o.limit < 0)) throw badQuery('"limit" debe ser un entero ≥ 0');
    return { order, limit: o.limit, since: o.since };
  }
  const byTime = (a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const shape = (rows, { order, limit }) => {
    const out = rows.slice().sort(byTime);
    if (order === 'desc') out.reverse();
    return limit === undefined ? out : out.slice(0, limit);
  };
  async function run(fn) {
    try { return await fn(); } catch (e) { throw classifyError(e, { store: 'events' }); }
  }
  const byIndex = (index, what) => (value, opts) => run(async () => {
    if (typeof value !== 'string' || value === '') throw badQuery(`${what} debe ser un texto no vacío`);
    const o = readOpts(opts);
    return shape(await db.query('events', { index, value }), o);
  });

  function since(ts, opts) {
    return run(async () => {
      let iso;
      try { iso = toIso(ts); } catch { throw badQuery('"ts" debe ser una fecha (Date, milisegundos o texto ISO)'); }
      const o = readOpts(opts);
      // El índice `ts` ya viene en orden de tiempo: se le pide el sentido y el tope al motor, que no lee de más.
      const rows = await db.query('events', { index: 'ts', range: { gte: iso }, direction: o.order === 'desc' ? 'prev' : 'next', ...(o.limit === undefined ? {} : { limit: o.limit }) });
      return rows;
    });
  }

  // Día "AAAA-MM-DD" que existe en el calendario, o un Date / milisegundos convertidos al día LOCAL.
  function dayArg(v, name) {
    if (typeof v === 'string') {
      const m = DAY_RE.exec(v);
      const [y, mo, d] = m ? v.split('-').map(Number) : [];
      const t = m ? new Date(Date.UTC(y, mo - 1, d)) : null;
      if (!t || t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) throw badQuery(`"${name}" debe ser un día real AAAA-MM-DD`);
      return v;
    }
    if (v instanceof Date || typeof v === 'number') {
      try { return localDay(v); } catch { throw badQuery(`"${name}" no es una fecha legible`); }
    }
    throw badQuery(`"${name}" debe ser un día AAAA-MM-DD, un Date o milisegundos`);
  }

  function countByDay(range) {
    return run(async () => {
      if (range === undefined || range === null || typeof range !== 'object' || Array.isArray(range)) throw badQuery('"range" debe ser un objeto { from?, to? } (usa {} para todo el historial)');
      for (const k of Object.keys(range)) if (k !== 'from' && k !== 'to') throw badQuery(`límite de rango desconocido "${k}"`);
      const from = range.from === undefined ? undefined : dayArg(range.from, 'from');
      const to = range.to === undefined ? undefined : dayArg(range.to, 'to');
      if (from !== undefined && to !== undefined && from > to) throw badQuery('"from" no puede ser posterior a "to"');
      const bounds = { ...(from === undefined ? {} : { gte: from }), ...(to === undefined ? {} : { lte: to }) };
      const rows = await db.query('events', { index: 'day', ...(from === undefined && to === undefined ? {} : { range: bounds }) });
      const tally = new Map();
      for (const e of rows) tally.set(e.day, (tally.get(e.day) ?? 0) + 1);
      const out = {};
      for (const d of [...tally.keys()].sort()) out[d] = tally.get(d);
      return out;
    });
  }

  function recentErrorsByCode(code, opts) {
    return run(async () => {
      if (typeof code !== 'string' || code === '') throw badQuery('el código de error debe ser un texto no vacío');
      const o = readOpts(opts, ['since']);
      if (o.since === undefined) throw badQuery('"since" es obligatorio: errorCodes no tiene índice y sin cota se recorrería todo el historial');
      let iso;
      try { iso = toIso(o.since); } catch { throw badQuery('"since" debe ser una fecha (Date, milisegundos o texto ISO)'); }
      const rows = await db.query('events', { index: 'ts', range: { gte: iso } });
      return shape(rows.filter((e) => Array.isArray(e.errorCodes) && e.errorCodes.includes(code)), o);
    });
  }

  // El único borrado que existe: todo o nada, en una transacción. No hay versión "de uno en uno".
  async function clearAll() {
    try {
      return await db.tx(['events'], async (t) => {
        const rows = await t.query('events');
        for (const row of rows) await t.delete('events', row.id);
        return rows.length;
      });
    } catch (e) {
      throw classifyError(e, { store: 'events' });
    }
  }

  return Object.freeze({ log, byCard: byIndex('cardId', 'cardId'), byItem: byIndex('itemId', 'itemId'), byTopic: byIndex('topics', 'topicId'), since, countByDay, recentErrorsByCode, clearAll });
}
