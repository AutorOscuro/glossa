// @purpose: Guarda y restaura la sesión de estudio a mitad (estado de la máquina + lista de ítems) en meta, validando todo y descartando lo caduco o dañado.
// Restauración de sesión (subparte 2.1, tramo 2). Roadmap 2.1 CA 2 y 17. Usa `validateState` de core/sessionRunner.js; no toca eventos ni tarjetas.
//
//   createSessionStore({ db, clock?, maxAgeMs? }) → objeto congelado { save, load, clear, KEY }
//     db        motor de core/db.js (solo el almacén `meta`, clave `session_active`).
//     maxAgeMs  vida máxima de una sesión guardada (por defecto 12 horas; entero > 0).
//   save({ sessionId, state, items }) → Promesa { saved, cleared }
//     Guarda UNA sola sesión activa (la última gana). `state` pasa por validateState; `items` debe tener exactamente `state.total` elementos
//     ({ cardId, itemId } de texto; facet (entero 0–999 o texto corto), topic, exerciseType, kind, why y topics opcionales, el resto se descarta). Si la fase es `idle` o
//     `summary` la sesión terminó: borra lo guardado y devuelve { saved: false, cleared: true }. Entrada mala → lanza Error sin escribir.
//     Orden pensado para 2.1-T3: primero `commit` de la respuesta, después `save`; si la app se cierra entre los dos, al reabrir se vuelve a
//     mostrar ese ítem y el doble toque de `commit` (idempotente por sesión y tarjeta) evita duplicar el evento.
//   load(now?) → Promesa { status, sessionId?, state?, items?, ageMs? }
//     status 'none' (nada guardado), 'restored' (sesión válida), 'expired' (más vieja que maxAgeMs), 'invalid' (dañada o incoherente).
//     Caduca o dañada → se BORRA para no repetir el problema. Al restaurar, la fase se normaliza: `answering` vuelve a `presenting` (el cronómetro
//     no sobrevive) y `feedback` pasa a `next` (la respuesta ya está registrada; la pantalla de comentarios no se reconstruye).
//   clear() → Promesa { cleared } (true si había algo). Si la base falla se rechaza con el error de la base.
import { validateState } from './sessionRunner.js';
import { toDate, systemClock } from './clock.js';

export const SESSION_KEY = 'session_active';
export const SESSION_VERSION = 1;
export const DEFAULT_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const MAX_TOPICS = 10;
const MAX_TEXT = 200;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v) => typeof v === 'string' && v !== '' && v.length <= MAX_TEXT;
const optText = (v) => (v === undefined || v === null ? null : text(v) ? v : false);

function cleanItem(it, i) {
  const bad = (why) => { throw new Error(`sessionStore: ítem ${i} no válido (${why})`); };
  if (!isObj(it)) bad('no es un objeto');
  if (!text(it.cardId) || !text(it.itemId)) bad('faltan cardId o itemId');
  const out = { cardId: it.cardId, itemId: it.itemId };
  for (const k of ['topic', 'exerciseType', 'kind', 'why']) {
    const v = optText(it[k]);
    if (v === false) bad(`${k} no es texto corto`);
    out[k] = v;
  }
  // La faceta llega como entero 0–999 del armador (core/session.js) y como texto corto en datos viejos o de prueba.
  const f = it.facet;
  if (f === undefined || f === null) out.facet = null;
  else if (Number.isInteger(f) && f >= 0 && f <= 999) out.facet = f;
  else if (text(f)) out.facet = f;
  else bad('facet no es un entero de 0 a 999 ni texto corto');
  if (it.topics === undefined || it.topics === null) out.topics = [];
  else if (Array.isArray(it.topics) && it.topics.length <= MAX_TOPICS && it.topics.every(text)) out.topics = [...it.topics];
  else bad('topics no es una lista de textos cortos');
  return out;
}

const pickState = (s) => ({ v: s.v, phase: s.phase, index: s.index, total: s.total, answers: s.answers.map((a) => ({ index: a.index, result: a.result })), ended: s.ended });
const deepFreeze = (s) => Object.freeze({ ...s, answers: Object.freeze(s.answers.map((a) => Object.freeze({ ...a }))) });

function restoredState(state) {
  if (state.phase === 'answering') return { ...state, phase: 'presenting' };
  if (state.phase === 'feedback') return { ...state, phase: 'next' };
  return state;
}

export function createSessionStore({ db, clock = systemClock, maxAgeMs = DEFAULT_MAX_AGE_MS } = {}) {
  if (!db || typeof db.get !== 'function' || typeof db.put !== 'function' || typeof db.delete !== 'function') throw new Error('createSessionStore: falta la base de datos');
  if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0) throw new Error('createSessionStore: maxAgeMs debe ser un número mayor que 0');
  const nowOf = (now) => toDate(now ?? clock.now()).getTime();

  async function clear() {
    const had = await db.get('meta', SESSION_KEY);
    if (had === undefined || had === null) return { cleared: false };
    await db.delete('meta', SESSION_KEY);
    return { cleared: true };
  }

  async function save({ sessionId, state, items, now } = {}) {
    if (!text(sessionId)) throw new Error('sessionStore: falta sessionId');
    validateState(state);
    if (state.phase === 'idle' || state.phase === 'summary') {
      const { cleared } = await clear();
      return { saved: false, cleared };
    }
    if (!Array.isArray(items) || items.length !== state.total) throw new Error('sessionStore: la lista de ítems no coincide con el total de la sesión');
    const clean = items.map(cleanItem);
    await db.put('meta', { key: SESSION_KEY, v: SESSION_VERSION, sessionId, savedAt: new Date(nowOf(now)).toISOString(), state: pickState(state), items: clean });
    return { saved: true, cleared: false };
  }

  async function load(now) {
    const rec = await db.get('meta', SESSION_KEY);
    if (rec === undefined || rec === null) return { status: 'none' };
    const drop = async (status) => { await db.delete('meta', SESSION_KEY); return { status }; };
    if (rec.v !== SESSION_VERSION || !text(rec.sessionId) || typeof rec.savedAt !== 'string') return drop('invalid');
    const saved = Date.parse(rec.savedAt);
    if (!Number.isFinite(saved)) return drop('invalid');
    let state; let items;
    try {
      validateState(rec.state);
      if (rec.state.phase === 'idle' || rec.state.phase === 'summary') return drop('invalid');
      if (!Array.isArray(rec.items) || rec.items.length !== rec.state.total) return drop('invalid');
      items = rec.items.map(cleanItem);
      state = restoredState(pickState(rec.state));
    } catch { return drop('invalid'); }
    const ageMs = nowOf(now) - saved;
    if (ageMs > maxAgeMs) return drop('expired');
    return { status: 'restored', sessionId: rec.sessionId, state: deepFreeze(state), items, ageMs: Math.max(0, ageMs) };
  }

  return Object.freeze({ save, load, clear, KEY: SESSION_KEY });
}
