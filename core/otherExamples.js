// @purpose: Otros ejemplos mecánicos (2.7-T1): frases en inglés del mismo tema desde la teoría y los ítems del paquete, sin repetir ni destripar ejercicios.
// Roadmap 2.7 («≥ 3 ejemplos del mismo tema/ítem desde el paquete») y 5.2 capa 1. Función pura: sin DOM, sin base de datos y sin azar.
//
//   collectExamples({ topicIds, topics?, items?, currentItem?, excludeItemIds?, min?, max? }) → { examples, count, min, enough, shortBy }
//     examples  [{ en, es | null, kind: 'theory' | 'item', itemId?, topicId? }], como mucho `max`, sin repetidas.
//     enough    true si hay al menos `min` (3). Si no, `shortBy` dice cuántas faltan y la pantalla lo cuenta con honestidad.
//   sentenceFromItem(item) → { en, es, itemId } | null     la frase en inglés que un ítem enseña, si enseña una.
//   sentencesFromTopic(topic) → [{ en, es, topicId }]       los ejemplos de `theory.examples` de un tema (opcional en el contrato 8.2).
//   exampleKey(texto) → clave para detectar repetidas (sin mayúsculas, tildes, contracciones ni puntuación final).
//
// Orden estable: primero la teoría del tema (en el orden de `topicIds`), luego los ítems del tema principal y después los de los demás temas, cada grupo por id.
// Nunca muestra: el ítem actual ni sus frases, ítems que la sesión aún no ha presentado (`excludeItemIds`), ítems no originales ni respuestas que no están en inglés.
// Nada de esto lanza: una entrada rota se ignora y el resultado queda más corto.
import { normalize } from './normalize.js';

export const EXAMPLES = Object.freeze({ min: 3, max: 6, minWords: 3, maxWords: 30, maxChars: 160 });

// Tipos cuya `accept` no está en inglés (translate_word responde en español cuando trae prompt_en: decisión de 2.5-T2).
const NOT_ENGLISH_ACCEPT = new Set(['translate_word']);
// Tipos cuyo `prompt_es` es la frase en español que se traduce (2.5-T3): sirve de traducción del ejemplo.
const SPANISH_PROMPT_IS_SENTENCE = new Set(['trap_translate', 'translate_bank']);

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.trim() !== '';
const clean = (s) => s.replace(/\s+/g, ' ').trim();
const wordsOf = (s) => s.split(' ').filter((w) => /\p{L}/u.test(w));

export const exampleKey = (text) => normalize(typeof text === 'string' ? text : '', { stripDiacritics: true, contractions: 'expand' });

// ¿Vale como ejemplo? Una frase (≥ 3 palabras con letras), no un párrafo, y sin marcas de hueco.
function usable(text) {
  if (!isText(text)) return null;
  const s = clean(text);
  if (s.length > EXAMPLES.maxChars) return null;
  if (/_{2,}|\[\s*\]|\{\{|\}\}/.test(s)) return null;
  const n = wordsOf(s).length;
  return n >= EXAMPLES.minWords && n <= EXAMPLES.maxWords ? s : null;
}

export function sentenceFromItem(item) {
  if (!isPlain(item) || !isText(item.id) || !isText(item.type)) return null;
  if (item.source === 'ai_generated_unverified' || item.needs_ai === true) return null;
  if (NOT_ENGLISH_ACCEPT.has(item.type) || !Array.isArray(item.accept)) return null;
  let en = null;
  for (const a of item.accept) { en = usable(a); if (en) break; }
  if (!en) return null;
  const es = SPANISH_PROMPT_IS_SENTENCE.has(item.type) && isText(item.prompt_es) ? clean(item.prompt_es) : null;
  return { en, es, itemId: item.id };
}

export function sentencesFromTopic(topic) {
  if (!isPlain(topic) || !isText(topic.id) || !isPlain(topic.theory) || !Array.isArray(topic.theory.examples)) return [];
  const out = [];
  for (const ex of topic.theory.examples) {
    if (!isPlain(ex)) continue;
    const en = usable(ex.en);
    if (en) out.push({ en, es: isText(ex.es) ? clean(ex.es) : null, topicId: topic.id });
  }
  return out;
}

// Las frases que el ítem actual ya enseña (enunciado y respuestas): no cuentan como «otro» ejemplo.
function ownKeys(item) {
  const keys = new Set();
  if (!isPlain(item)) return keys;
  for (const t of [item.prompt_en, ...(Array.isArray(item.accept) ? item.accept : [])]) if (isText(t)) keys.add(exampleKey(t));
  return keys;
}

const toSet = (v) => new Set(v && typeof v[Symbol.iterator] === 'function' && typeof v !== 'string' ? v : []);
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function collectExamples(options) {
  const { topicIds = [], topics = [], items = [], currentItem = null, excludeItemIds = [], min = EXAMPLES.min, max = EXAMPLES.max } = isPlain(options) ? options : {};
  const wantMin = Number.isInteger(min) && min >= 1 ? min : EXAMPLES.min;
  const cap = Math.max(wantMin, Number.isInteger(max) && max >= 1 ? max : EXAMPLES.max);
  const ids = Array.isArray(topicIds) ? topicIds.filter(isText) : [];
  const skipItems = toSet(excludeItemIds);
  if (isPlain(currentItem) && isText(currentItem.id)) skipItems.add(currentItem.id);
  const seen = ownKeys(currentItem);
  const examples = [];
  const add = (ex, extra) => {
    if (examples.length >= cap) return;
    const key = exampleKey(ex.en);
    if (key === '' || seen.has(key)) return;
    seen.add(key);
    examples.push({ en: ex.en, es: ex.es ?? null, ...extra });
  };

  const list = Array.isArray(topics) ? topics : [];
  for (const id of ids) {
    const topic = list.find((t) => isPlain(t) && t.id === id);
    if (topic) for (const ex of sentencesFromTopic(topic)) add(ex, { kind: 'theory', topicId: topic.id });
  }

  const wanted = new Set(ids);
  const mine = [];
  const rest = [];
  for (const it of Array.isArray(items) ? items : []) {
    if (!isPlain(it) || !isText(it.id) || skipItems.has(it.id) || !Array.isArray(it.topics)) continue;
    if (!it.topics.some((t) => wanted.has(t))) continue;
    (ids.length > 0 && it.topics.includes(ids[0]) ? mine : rest).push(it);
  }
  for (const it of [...mine.sort(byId), ...rest.sort(byId)]) {
    const s = sentenceFromItem(it);
    if (s) add(s, { kind: 'item', itemId: s.itemId });
  }

  return { examples, count: examples.length, min: wantMin, enough: examples.length >= wantMin, shortBy: Math.max(0, wantMin - examples.length) };
}
