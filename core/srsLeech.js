// @purpose: Sanguijuelas: detecta, marca y libera las tarjetas con demasiados fallos y lista las suspendidas.
// Sanguijuelas (subparte 1.4, cuarto 3). Una tarjeta con `lapses` ≥ umbral se suspende y se marca `leech`
// (roadmap 8.4); entra a la lista "Explícamelo en el chat". Funciones puras: devuelven una tarjeta nueva.
export const DEFAULT_LEECH_THRESHOLD = 8;

function checkThreshold(threshold) {
  if (!Number.isInteger(threshold) || threshold < 1) throw new Error('umbral de sanguijuela: debe ser un entero ≥ 1');
}
function checkCard(card, who) {
  if (!card || typeof card !== 'object') throw new Error(`${who}: se necesita una tarjeta`);
}

export function isLeech(card, threshold = DEFAULT_LEECH_THRESHOLD) {
  checkThreshold(threshold);
  checkCard(card, 'isLeech');
  return Number.isFinite(card.lapses) && card.lapses >= threshold;
}

// Marca la tarjeta si llegó al umbral. Idempotente: una tarjeta ya marcada se devuelve igual (misma referencia).
export function markLeech(card, threshold = DEFAULT_LEECH_THRESHOLD) {
  if (!isLeech(card, threshold)) return card;
  if (card.suspended === true && card.leech === true) return card;
  return { ...card, suspended: true, leech: true };
}

// La persona decide volver a estudiarla: se reactiva y se quita la marca. Los fallos acumulados NO se borran
// (8.4 no tiene campo para ello), así que el siguiente fallo la marcará de nuevo: es lo esperado.
export function releaseLeech(card) {
  checkCard(card, 'releaseLeech');
  if (card.suspended !== true && card.leech !== true) return card;
  return { ...card, suspended: false, leech: false };
}

// Lista "Explícamelo en el chat": las marcadas, de más a menos fallos y luego por id (orden estable).
export function leechList(cards) {
  if (!Array.isArray(cards)) throw new Error('leechList: se necesita una lista de tarjetas');
  return cards.filter((c) => c && c.leech === true)
    .sort((a, b) => (b.lapses - a.lapses) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
