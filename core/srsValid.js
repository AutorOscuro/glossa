// @purpose: Validación compartida de tarjetas y ratings para los dos planificadores de repaso.
// Validación compartida de la tarjeta 8.4 para los dos planificadores (srs.js y srs.simple.js).
// Devuelve las fechas ya convertidas; lanza Error con el nombre del campo malo.
export function parseCard(card, who) {
  if (!card || typeof card !== 'object') throw new Error(`${who}: se necesita una tarjeta`);
  if (!Number.isInteger(card.state) || card.state < 0 || card.state > 3) throw new Error(`${who}: state inválido`);
  for (const k of ['stability', 'difficulty']) {
    if (typeof card[k] !== 'number' || !Number.isFinite(card[k]) || card[k] < 0) throw new Error(`${who}: ${k} inválido`);
  }
  for (const k of ['reps', 'lapses']) if (!Number.isInteger(card[k]) || card[k] < 0) throw new Error(`${who}: ${k} inválido`);
  const date = (v, field) => {
    const d = new Date(v);
    if (typeof v !== 'string' || Number.isNaN(d.getTime())) throw new Error(`${who}: ${field} inválido`);
    return d;
  };
  const due = date(card.due, 'due');
  let last;
  if (card.last_review !== null && card.last_review !== undefined) last = date(card.last_review, 'last_review');
  else if (card.state !== 0) throw new Error(`${who}: una tarjeta con state ${card.state} necesita last_review`);
  return { due, last };
}

export const RATING_NAMES = Object.freeze({ again: 1, hard: 2, good: 3, easy: 4 });

export function parseRating(r) {
  const v = typeof r === 'string' ? RATING_NAMES[r.toLowerCase()] : r;
  if (!Number.isInteger(v) || v < 1 || v > 4) throw new Error('rating: debe ser 1–4 o again/hard/good/easy');
  return v;
}
