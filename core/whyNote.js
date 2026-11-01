// @purpose: Guarda la nota «¿por qué lo pensaste?» de un ítem como evento `note` (itemId, temas y texto en responseRaw), sin tocar dominio ni estadísticas.
// Nota de «por qué lo pensaste» (subparte 2.6, tramo 2, punto 4). Contrato en docs/CONTRACTS.md, sección «2.6-T2 (punto 4)».
//
//   createWhyNote({ events }) → objeto congelado { save(entry, item, text), MAX }
//     events  el de core/events.js (usa `log`). Sin él lanza Error (error de programación).
//   save(entry, item, text) → Promesa { status: 'saved', event } | { status: 'empty' } | { status: 'error' }   (NUNCA rechaza)
//     entry  entrada del plan { itemId, cardId?, topics?, exerciseType? }; item  el ítem de contenido { id?, topics?, type? } (rellena lo que falte).
//     text   lo que escribió la persona: se le quitan los caracteres de control (salvo tabulador y saltos de línea), se recortan los espacios de los extremos
//            y se corta a MAX (2000). Si queda vacío → 'empty' y no se escribe nada.
//     Evento: { type: 'note', itemId, cardId?, topics, exerciseType?, responseRaw }. Solo entran los campos con forma válida; lo demás se omite en vez de perder la nota.
//     Sin itemId válido → 'error' (la nota no tendría a qué ítem asociarse). Si la base falla → 'error'.
// Las notas NO cuentan como respuestas: estadísticas, dominio, uso diario y armador solo leen eventos `answer`.
import { LIMITS } from './eventSchema.js';

export const WHY_MAX = LIMITS.responseRaw;
const ITEM_RE = /^[a-z0-9_.]{1,100}$/;
const CARD_RE = /^[a-z0-9_.]{1,100}#\d{1,3}$/;
const EXTYPE_RE = /^[a-z][a-z0-9_]{0,39}$/;
// eslint-disable-next-line no-control-regex
const CONTROL_G = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
const isObj = (v) => v !== null && typeof v === 'object';
const pick = (...vals) => vals.find((v) => typeof v === 'string' && v !== '');

export function createWhyNote({ events } = {}) {
  if (!events || typeof events.log !== 'function') throw new Error('createWhyNote: falta el registro de eventos');

  async function save(entry, item, text) {
    try {
      const e = isObj(entry) ? entry : {};
      const it = isObj(item) ? item : {};
      const body = typeof text === 'string' ? text.replace(CONTROL_G, '').trim().slice(0, WHY_MAX).trim() : '';
      if (body === '') return { status: 'empty' };
      const itemId = pick(e.itemId, it.id);
      if (itemId === undefined || !ITEM_RE.test(itemId)) return { status: 'error' };
      const topicsSrc = Array.isArray(e.topics) ? e.topics : (Array.isArray(it.topics) ? it.topics : []);
      const topics = topicsSrc.filter((t) => typeof t === 'string' && ITEM_RE.test(t)).slice(0, LIMITS.topics);
      const event = { type: 'note', itemId, topics, responseRaw: body };
      if (typeof e.cardId === 'string' && CARD_RE.test(e.cardId) && e.cardId.startsWith(`${itemId}#`)) event.cardId = e.cardId;
      const ex = pick(e.exerciseType, it.type);
      if (ex !== undefined && EXTYPE_RE.test(ex)) event.exerciseType = ex;
      return { status: 'saved', event: await events.log(event) };
    } catch {
      return { status: 'error' };
    }
  }

  return Object.freeze({ save, MAX: WHY_MAX });
}
