// @purpose: Arma el bloque «Llevar al chat» de Preguntas IA (2.7-T3): recorta lo que llega a los límites de 8.14 y reúsa makeChatBlock; nunca lanza.
// Subparte 2.7-T3. Función pura: sin DOM, sin reloj propio. El formato del bloque vive en core/syncChat.js (tipo `llevar_al_chat`); aquí solo se prepara el contenido.
//
//   buildAskBlock({ topic?, item?, answer?, errors?, mastery?, message? }, { now? }) → { ok:true, text, payload } | { ok:false, error:{ code, message } }
//     topic     id o nombre del tema.     item      texto del ítem (la frase o la consigna).     answer  lo que la persona escribió o eligió (texto; otra cosa se ignora).
//     errors    [{ code, original, correction? }] recientes; se toman los 10 primeros válidos.     mastery  { pct, band|label? }; sin número válido se omite.
//     message   la duda en palabras de la persona. Sin duda se pone una frase por defecto, para que el chat sepa qué hacer.
//   Todo texto se recorta a los máximos de LIMITS (con «…»). Lo que no sirve se omite en silencio; el bloque siempre sale si hay al menos tema, ítem o mensaje.
import { makeChatBlock, LIMITS } from './syncChat.js';

export const ASK_DEFAULT_MESSAGE = 'Tengo una duda sobre este ejercicio. ¿Me lo explicas paso a paso?';

const clip = (v, max) => {
  if (typeof v !== 'string') return undefined;
  const t = v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').trim();
  if (t === '') return undefined;
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

// El texto de una respuesta: una cadena, o un objeto con `text`/`value`. Otra cosa no se lleva.
export function answerText(v) {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && !Array.isArray(v)) { for (const k of ['text', 'value', 'answer']) if (typeof v[k] === 'string') return v[k]; }
  return undefined;
}

export function buildAskBlock(input = {}, { now } = {}) {
  const src = input !== null && typeof input === 'object' ? input : {};
  const errors = [];
  for (const e of Array.isArray(src.errors) ? src.errors : []) {
    if (errors.length >= LIMITS.maxShortErrors) break;
    const code = clip(e?.code, 60);
    const original = clip(e?.original, LIMITS.maxOriginal);
    if (!code || !original) continue;
    const correction = clip(e?.correction, LIMITS.maxString);
    errors.push(correction ? { code, original, correction } : { code, original });
  }
  let dominio;
  const m = src.mastery;
  if (m && typeof m === 'object' && typeof m.pct === 'number' && Number.isFinite(m.pct)) {
    const band = clip(typeof m.band === 'string' ? m.band : m.label, 40);
    dominio = { pct: Math.min(100, Math.max(0, Math.round(m.pct))), ...(band ? { banda: band } : {}) };
  }
  const payload = {};
  const tema = clip(src.topic, 200); if (tema) payload.tema = tema;
  const item = clip(src.item, LIMITS.maxString); if (item) payload.item = item;
  const respuesta = clip(answerText(src.answer), LIMITS.maxString); if (respuesta) payload.respuesta = respuesta;
  if (errors.length > 0) payload.errores = errors;
  if (dominio) payload.dominio = dominio;
  payload.mensaje = clip(src.message, LIMITS.maxLong) ?? ASK_DEFAULT_MESSAGE;
  try {
    return { ok: true, text: makeChatBlock('llevar_al_chat', payload, now === undefined ? undefined : { now }), payload };
  } catch (e) {
    return { ok: false, error: { code: typeof e?.code === 'string' ? e.code : 'BAD_PAYLOAD', message: typeof e?.friendly === 'string' ? e.friendly : 'No pude armar el bloque.' } };
  }
}
