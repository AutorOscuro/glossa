// @purpose: Importa los errores de un bloque «errores» del chat sin duplicar al repetir (fecha estable por bloque) y con vista previa que no escribe.
// Importación de errores del chat (subparte 1.12-T3). Roadmap 1.12 y 8.14. Usa core/syncChat.js (lectura del bloque) y core/errors.js (registro).
//
//   createChatImport({ db, errors, catalog, clock?, topics?, board? }) → { previewErrors(text), importErrors(text) }   (objeto congelado)
//     db       cualquier motor de core/db.js (solo se LEE en la vista previa)     errors   createErrors(...) (aquí se escribe)     catalog   createErrorCatalog(...)
//     topics   (opcional) lista de temas de la taxonomía [{ id, status }]: sirve para reconocer ids y estados de `temas`
//     board    (opcional) tablero de dominio: tras importar se llama a board.invalidate(temas tocados), porque los errores no entran en su caché
//
//   previewErrors(text) → Promise< { ok:true, kind:'errores', generatedAt, items, totals, canImport, topicAdjustments, warnings, others } | { ok:false, error:{ code, message } } >
//   importErrors(text)  → Promise< { ok:true, …lo mismo, applied, stopped } | { ok:false, error } >
//     text  el bloque pegado (con texto alrededor, vallas, etc.: lo lee parseChatBlock). Texto que no sirve → { ok:false, error } con mensaje en español; NUNCA lanza por eso.
//           Un bloque de otro tipo da error WRONG_KIND. Solo lanza si falla la base al LEER (vista previa) o si faltan dependencias al crear.
//     items[i] = { index, status, code, original, ts, tsSource, topics, countAfter, message? }
//       status  'new' (error nuevo) | 'repeat' (ya existía: cuenta una ocurrencia más) | 'replay' (esa misma ocurrencia ya estaba: no cambia nada) | 'invalid' (se omite; `message` dice por qué) | 'skipped' (solo al importar: no se llegó a guardar porque la base falló)
//       ts      la fecha de la ocurrencia: la propia del error (tsSource 'own') o la `generado:` del bloque (tsSource 'block'). Sin ninguna de las dos el error es 'invalid' (NO_DATE). `warnings` suma «N errores omitidos por no traer fecha» (Administrador, 2026-10-26).
//     totals = { new, repeat, replay, invalid, skipped }     canImport = new + repeat > 0
//     IDEMPOTENCIA: la fecha de cada error no depende de la hora de importar, así que reimportar el mismo bloque da todo 'replay' y no cambia la base (CA 2 de 1.12).
//       Un bloque nuevo (otro `generado:`) con el mismo error sí cuenta otra ocurrencia. El orden de los errores dentro del bloque no cambia el resultado.
//       Dos errores iguales dentro de un mismo bloque (mismo código, texto e ítem) son UNA ocurrencia: el segundo sale 'replay'.
//     La vista previa decide con las mismas reglas que `errors.record` (validateErrorInput, errorKey, seenOf) pero sin escribir; la importación informa lo que pasó de verdad.
//     importErrors aplica los errores válidos y omite los inválidos. Cada error se guarda en su propia transacción: si la base falla a la mitad, `stopped` = { index, message }
//     dice dónde paró y repetir el mismo bloque termina el trabajo sin duplicar.
//     topicAdjustments = [{ id, estado, status: 'ok' | 'unchanged' | 'bad_status' | 'unknown_topic', current }]   SOLO SE MUESTRAN: el estado de un tema vive en el contenido
//       (topics.json) y no hay dónde guardarlo en la base; cambia al instalar un paquete. `current` es el estado actual si se conoce (o null).
import { systemClock } from './clock.js';
import { DbError } from './db.js';
import { validateErrorInput, ErrorRecordError, errorKey, seenOf, LIMITS as ERROR_LIMITS } from './errors.js';
import { TOPIC_STATUSES } from './contentTopic.js';
import { parseChatBlock } from './syncChat.js';

const fail = (code, message) => ({ ok: false, error: { code, message } });
const ms = (iso) => Date.parse(iso);

// Qué pasa con una ocurrencia (`ts`) frente a lo que la base recuerda de ese error (cur = { count, seen }, o undefined si no existe). Es la ÚNICA regla: la usan la vista previa y la importación.
// El registro solo recuerda las ERROR_LIMITS.seen ocurrencias más recientes: si ya recuerda ese máximo y esta fecha es más vieja que todas, no se puede saber si ya se contó.
// Se toma como ya contada (replay): perder una ocurrencia remota es mejor que contarla otra vez en cada reimportación.
function verdict(cur, ts) {
  if (!cur) return 'new';
  if (cur.seen.includes(ts)) return 'replay';
  if (cur.seen.length >= ERROR_LIMITS.seen && ms(ts) < ms(cur.seen[0])) return 'replay';
  return 'repeat';
}
const advance = (cur, ts) => (cur ? { count: cur.count + 1, seen: [...cur.seen, ts].sort((a, b) => ms(a) - ms(b)).slice(-ERROR_LIMITS.seen) } : { count: 1, seen: [ts] });
const memoryOf = (r) => ({ count: Number.isInteger(r.count) && r.count >= 1 ? r.count : 1, seen: seenOf(r) });
// Los problemas de una fecha que salió del bloque se nombran «generado:», que es lo que la persona ve; los demás con su ruta.
const problemText = (index, problems, tsSource) => `errores[${index}]: ${problems.slice(0, 3).map((p) => {
  const path = p.path === 'ts' && tsSource === 'block' ? '«generado:» del bloque' : p.path;
  return path ? `${path} ${p.message}` : p.message;
}).join('; ')}`;

export function createChatImport({ db, errors, catalog, clock = systemClock, topics, board } = {}) {
  if (!db || typeof db.query !== 'function') throw new Error('createChatImport: falta la base de datos (db.query)');
  if (!errors || typeof errors.record !== 'function') throw new Error('createChatImport: falta el registro de errores (errors.record)');
  if (!catalog || typeof catalog.get !== 'function') throw new Error('createChatImport: falta el catálogo de errores (core/errorCatalog.js)');
  if (!clock || typeof clock.now !== 'function') throw new Error('createChatImport: reloj no válido');
  if (topics !== undefined && !Array.isArray(topics)) throw new Error('createChatImport: topics debe ser una lista de temas');
  if (board !== undefined && typeof board.invalidate !== 'function') throw new Error('createChatImport: el tablero necesita invalidate');
  const statusOf = new Map((topics ?? []).filter((t) => t && typeof t.id === 'string').map((t) => [t.id, t.status ?? null]));

  function read(text) {
    const parsed = parseChatBlock(text);
    if (!parsed.ok) return parsed;
    if (parsed.kind !== 'errores') return fail('WRONG_KIND', `Este bloque es de tipo «${parsed.kind}». Aquí se importan los bloques de tipo «errores».`);
    return parsed;
  }

  // Valida cada error con las reglas de errors.record y les da su fecha estable. No toca la base.
  function plan(parsed) {
    const now = clock.now();
    return parsed.payload.errores.map((raw, index) => {
      const own = raw.ts !== undefined;
      const ts = own ? raw.ts : parsed.generatedAt;
      const base = { index, code: raw.code, original: raw.original, ts: null, tsSource: own ? 'own' : 'block', topics: [], countAfter: null };
      if (ts === null) return { ...base, tsSource: null, status: 'invalid', message: `errores[${index}]: no tiene fecha (ni «ts» propio ni «generado:» en el bloque); pide al chat que lo escriba de nuevo con fecha` };
      const checked = validateErrorInput({ ...raw, ts }, { catalog, now });
      if (!checked.ok) return { ...base, status: 'invalid', message: problemText(index, checked.problems, base.tsSource) };
      const v = checked.value;
      return { ...base, original: v.original, ts: v.ts, topics: v.topics, status: 'pending', input: { ...raw, ts: v.ts }, key: errorKey(v.code, v.original, v.itemId) };
    });
  }

  const totalsOf = (items) => {
    const t = { new: 0, repeat: 0, replay: 0, invalid: 0, skipped: 0 };
    for (const it of items) t[it.status] += 1;
    return t;
  };

  function adjustments(parsed) {
    return (parsed.payload.temas ?? []).map((t) => {
      const current = statusOf.has(t.id) ? statusOf.get(t.id) : null;
      let status = 'ok';
      if (!TOPIC_STATUSES.includes(t.estado)) status = 'bad_status';
      else if (topics !== undefined && !statusOf.has(t.id)) status = 'unknown_topic';
      else if (current === t.estado) status = 'unchanged';
      return { id: t.id, estado: t.estado, status, current };
    });
  }

  function warningsOf(parsed, adjusts, items) {
    const out = [];
    const noDate = items.filter((it) => it.status === 'invalid' && it.tsSource === null).length;
    if (noDate > 0) out.push(`${noDate} ${noDate === 1 ? 'error omitido' : 'errores omitidos'} por no traer fecha.`);
    if (parsed.others > 0) out.push(`El texto traía ${parsed.others} bloque${parsed.others === 1 ? '' : 's'} más: solo se lee el primero.`);
    if (adjusts.length > 0) out.push('Los cambios de estado de tema se muestran pero no se aplican: el estado de un tema vive en el contenido y cambia al instalar un paquete.');
    return out;
  }

  const strip = ({ input, key, ...visible }) => visible;
  // Los errores por aplicar, de la ocurrencia más vieja a la más nueva (a igual fecha, en el orden del bloque): así el resultado no depende del orden del bloque.
  const queue = (items) => items.filter((it) => it.status === 'pending').sort((a, b) => ms(a.ts) - ms(b.ts) || a.index - b.index);
  // Un 'replay' informa el conteo FINAL de su error al terminar el bloque (los demás, el conteo justo tras su ocurrencia).
  const settle = (items, finals) => { for (const it of items) if (it.status === 'replay' && finals.has(it.key)) it.countAfter = finals.get(it.key); };
  const currentOf = async (code) => {
    const state = new Map();
    for (const r of await db.query('errors', { index: 'code', value: code })) if (typeof r.original === 'string') state.set(errorKey(r.code, r.original, r.itemId ?? null), memoryOf(r));
    return state;
  };

  async function previewErrors(text) {
    const parsed = read(text);
    if (!parsed.ok) return parsed;
    const items = plan(parsed);
    const finals = new Map();
    const byCode = new Map(); // código → Map clave → { count, seen } (lo que hay en la base + lo que ya «aplicaron» los errores de este bloque)
    for (const it of queue(items)) {
      if (!byCode.has(it.input.code)) byCode.set(it.input.code, await currentOf(it.input.code));
      const state = byCode.get(it.input.code);
      const cur = state.get(it.key);
      it.status = verdict(cur, it.ts);
      if (it.status !== 'replay') state.set(it.key, advance(cur, it.ts));
      it.countAfter = state.get(it.key).count;
      finals.set(it.key, it.countAfter);
    }
    settle(items, finals);
    const totals = totalsOf(items);
    const adjusts = adjustments(parsed);
    return {
      ok: true, kind: 'errores', generatedAt: parsed.generatedAt, items: items.map(strip), totals, canImport: totals.new + totals.repeat > 0,
      topicAdjustments: adjusts, warnings: warningsOf(parsed, adjusts, items), others: parsed.others,
    };
  }

  async function importErrors(text) {
    const parsed = read(text);
    if (!parsed.ok) return parsed;
    const items = plan(parsed);
    const touched = new Set();
    const finals = new Map();
    let stopped = null;
    for (const it of queue(items)) {
      try {
        const cur = (await currentOf(it.input.code)).get(it.key);
        if (verdict(cur, it.ts) === 'replay') { // ya contada (o demasiado vieja para saberlo): no se llama a record
          it.status = 'replay';
          it.countAfter = cur.count;
          continue;
        }
        const res = await errors.record(it.input);
        it.status = res.created ? 'new' : res.replay ? 'replay' : 'repeat';
        it.countAfter = res.record.count;
        finals.set(it.key, it.countAfter);
        if (res.counted) for (const t of res.record.topics ?? []) touched.add(t);
      } catch (e) {
        if (e instanceof ErrorRecordError) { // no debería pasar (ya se validó), pero un error suelto no tumba el resto
          it.status = 'invalid';
          it.message = problemText(it.index, e.problems, it.tsSource);
          continue;
        }
        if (!(e instanceof DbError)) throw e;
        stopped = { index: it.index, message: e.friendly ?? e.message };
        break;
      }
    }
    settle(items, finals);
    const warnings = [];
    if (board !== undefined && touched.size > 0) {
      try { board.invalidate([...touched]); } catch { warnings.push('No se pudo refrescar el dominio de los temas tocados; reabre la pantalla para verlo al día.'); }
    }
    const adjusts = adjustments(parsed);
    const done = items.map((it) => (it.status === 'pending' ? { ...it, status: 'skipped', message: `errores[${it.index}]: no se importó porque la base falló antes; repite el bloque para terminar` } : it));
    const totals = totalsOf(done);
    return {
      ok: true, kind: 'errores', generatedAt: parsed.generatedAt, items: done.map(strip), totals, canImport: totals.new + totals.repeat > 0,
      applied: totals.new + totals.repeat, stopped, topicAdjustments: adjusts, warnings: [...warningsOf(parsed, adjusts, done), ...warnings], others: parsed.others,
    };
  }

  return Object.freeze({ previewErrors, importErrors });
}
