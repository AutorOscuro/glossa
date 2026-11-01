// @purpose: Plan de la tarjeta de deletreo (spell) que nace de un «casi» con errata: id, tarjeta nueva y evento de nota; lógica pura sin DOM ni base.
// Tarjeta de deletreo (subparte 2.2, tramo 3). Roadmap 4.7, 8.4 y 8.6. Puro: sin DOM ni base de datos.
//
//   spellKey(word) → 'career' | null          la palabra CORRECTA en minúsculas a–z (4 a 40 letras); con apóstrofo, acento, cifras o muy corta → null
//   spellCardPlan(flag, { now, topic? }) → { ok:true, word, itemId:'spell.<word>', cardId:'spell.<word>#0', card, event }
//                                         | { ok:false, reason:'no_flag' | 'bad_word' | 'bad_time' }
//     `flag` es una marca de `spellingFlags` ({ word, expected, index }); la clave natural es `expected` (la misma palabra no repite tarjeta).
//     `card` es una tarjeta nueva de 8.4 (srs.newCard) con el tema de ortografía; `event` es un evento `note` (no cuenta como respuesta en estadísticas ni dominio).
//     Provisional: el tema es siempre `spell.common_misspellings`; 4.7-T1 podrá elegir homófonos, apóstrofos, etc.
import { newCard } from './srs.js';

export const SPELL_TOPIC = 'spell.common_misspellings';
const WORD_RE = /^[a-z]{4,40}$/;

export function spellKey(word) {
  if (typeof word !== 'string') return null;
  const w = word.trim().toLowerCase();
  return WORD_RE.test(w) ? w : null;
}

// Texto corto y seguro para el evento: solo letras, cifras, apóstrofo, guion y espacio (el esquema rechaza caracteres de control).
const clean = (s) => (typeof s === 'string' ? s.replace(/[^\p{L}\p{N}' -]/gu, '').slice(0, 40) : '');

export function spellCardPlan(flag, { now, topic = SPELL_TOPIC } = {}) {
  if (flag === null || typeof flag !== 'object') return { ok: false, reason: 'no_flag' };
  const word = spellKey(flag.expected);
  if (word === null) return { ok: false, reason: 'bad_word' };
  let card;
  try { card = newCard(`spell.${word}`, 0, now, [topic]); } catch { return { ok: false, reason: 'bad_time' }; }
  const event = {
    type: 'note', itemId: card.itemId, cardId: card.id, topics: [topic],
    responseRaw: `spell_card ${word} <- ${clean(flag.word)}`,
  };
  return { ok: true, word, itemId: card.itemId, cardId: card.id, card, event };
}
