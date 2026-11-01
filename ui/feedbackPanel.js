// @purpose: Panel de feedback común (2.6-T1): veredicto con 4 estados, respuesta correcta y notas del ítem (explain_es, grammar_note_es, nuance_es) en el mismo orden para todos los tipos.
// Panel de feedback común (roadmap 2.6, tramo 1). Sin estado y sin DOM propio: recibe `h` (ui/dom.js o el de la pantalla) y devuelve nodos.
//
//   feedbackState(result, { binary? }) → 'correct' | 'almost' | 'wrong' | 'dont'
//       `dont_know` y `dont` → 'dont'. `almost` solo si `binary` no es true (elegir, ordenar y emparejar son binarios y nunca lo muestran: pasa a 'wrong'). Cualquier otro valor → 'wrong'.
//   feedbackNodes({ h, result, item, binary?, tail?, verdict?, before?, answer?, after?, why?, report? }) → Node[]
//       Orden fijo: veredicto · `before` · respuesta correcta (si no acertó) · notas del ítem · `after`.
//       Veredicto: `verdict` (texto completo, para pantallas con un texto propio) o FB_TEXT[estado] + ' ' + `tail` (lo que cada tipo añade: «Fíjate en la corrección:»).
//       `before` y `after`: Node | Node[] | null, extras propios del tipo (diferencia de palabras, pista del detector, tarjeta de deletreo, trampa…). Un nodo nulo se ignora.
//       `answer`: texto (se pinta «Respuesta: <strong>texto</strong>») o Node | Node[] ya hecho (ordenar, emparejar… pintan su propia corrección). Solo si NO acertó: tras fallar la respuesta correcta siempre está visible (CA 3).
//       `why` (2.6-T2, punto 4): Node | null con «¿Por qué lo pensaste?» (ui/whyNote.js, `whyFor`); solo se pinta con los estados «wrong» y «dont» (nunca al acertar ni en «casi»), justo antes de `report`.
//       `report` (2.6-T2, punto 3): Node | null con el menú «⋯» de ui/reportMenu.js (`reportFor`); va SIEMPRE el último, en cualquier estado. Un valor que no es nodo se ignora.
//       Notas (CA 1, decisión del Administrador): al fallar, «explain_es», «grammar_note_es» y «nuance_es» (los que existan y no estén en blanco), en todos los tipos y en todos los estados que no son «correct»;
//       al acertar, solo `nuance_es` y solo si es breve (≤ NUANCE_SHORT_MAX caracteres).
//   Nunca lanza por un ítem raro: sin `item`, o con campos que no son texto, no pinta notas. Sin `h` función lanza TypeError (error de programación, no de datos).
export const NUANCE_SHORT_MAX = 160;

export const FB_TEXT = Object.freeze({
  correct: '¡Bien!',
  almost: 'Casi: revisa la ortografía de la palabra marcada.',
  wrong: 'Todavía no.',
  dont: 'No pasa nada:',
  answerIs: 'Respuesta:',
  grammar: 'Gramática',
  nuance: 'Matiz',
});

const isText = (v) => typeof v === 'string' && v.trim() !== '';
const isNode = (v) => v !== null && typeof v === 'object' && typeof v.nodeType === 'number';
const list = (v) => (Array.isArray(v) ? v : [v]).filter((n) => n !== null && n !== undefined && n !== false);

export function feedbackState(result, options) {
  const binary = options !== null && typeof options === 'object' && options.binary === true;
  if (result === 'correct') return 'correct';
  if (result === 'dont_know' || result === 'dont') return 'dont';
  if (result === 'almost' && !binary) return 'almost';
  return 'wrong';
}

export function feedbackNodes(options) {
  const o = options !== null && typeof options === 'object' ? options : {};
  const { h } = o;
  if (typeof h !== 'function') throw new TypeError('feedbackNodes: falta la función `h`');
  const state = feedbackState(o.result, o);
  const item = o.item !== null && typeof o.item === 'object' ? o.item : {};
  const tail = isText(o.tail) ? ` ${o.tail.trim()}` : '';
  const text = isText(o.verdict) ? o.verdict.trim() : `${FB_TEXT[state]}${tail}`;
  const box = (cls, label, body) => h('div', { class: `fb__box ${cls}` }, h('p', { class: 'fb__box-label' }, label), h('p', { class: 'fb__box-text' }, body.trim()));
  const nodes = [h('p', { class: ['fb__verdict', `fb__verdict--${state}`] }, text), ...list(o.before)];
  if (state === 'correct') {
    if (isText(item.nuance_es) && item.nuance_es.trim().length <= NUANCE_SHORT_MAX) nodes.push(box('fb__nuance', FB_TEXT.nuance, item.nuance_es));
  } else {
    const a = o.answer;
    if (isText(a)) nodes.push(h('p', { class: 'fb__correct' }, `${FB_TEXT.answerIs} `, h('strong', {}, a.trim())));
    else if (isNode(a) || Array.isArray(a)) nodes.push(...list(a));
    if (isText(item.explain_es)) nodes.push(h('p', { class: 'fb__explain' }, item.explain_es.trim()));
    if (isText(item.grammar_note_es)) nodes.push(box('fb__grammar callout', FB_TEXT.grammar, item.grammar_note_es));
    if (isText(item.nuance_es)) nodes.push(box('fb__nuance', FB_TEXT.nuance, item.nuance_es));
  }
  nodes.push(...list(o.after));
  if ((state === 'wrong' || state === 'dont') && isNode(o.why)) nodes.push(o.why);
  if (isNode(o.report)) nodes.push(o.report);
  return nodes;
}
