// @purpose: Piezas compartidas por los validadores de Item, Pack, LexEntry y Story (expresiones de id, límites y ayudantes).
// Piezas compartidas por los validadores de Item, Pack, LexEntry y Story (subparte 1.3, cuarto 1, mitad B). Puro.
// Reutiliza contentRules.js (1A); aquí solo hay lo que dos o más entidades necesitan.
import { LIMITS, check, text, idOf, custom, nullable } from './contentRules.js';
import { TOPIC_ID_RE } from './contentTopic.js';

// Ids de ítem, entrada léxica y historia (8.1): `a.b[.c…]`, minúsculas, dígitos y guion bajo; al menos dos tramos.
// Nunca llevan `#` (la tarjeta es `itemId#faceta`, 8.4).
export const ID_RE = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/;
export const TAG_RE = /^[a-z][a-z0-9_]{0,39}$/;
// Rutas de medios: carpeta fija, un solo nivel, minúsculas, sin `..`, sin esquema (no hay URLs externas: la app es offline).
export const MEDIA_AUDIO_RE = /^audio\/(?!.*\.\.)[a-z0-9_][a-z0-9_.-]*\.(?:mp3|ogg|m4a|wav)$/;
export const MEDIA_IMAGE_RE = /^images\/(?!.*\.\.)[a-z0-9_][a-z0-9_.-]*\.(?:png|jpe?g|webp|svg)$/;

// Tamaños máximos de un paquete (los usan el validador de paquetes y el resumen de paquetes instalados).
export const PACK_LIMITS = Object.freeze({ topics: 100, items: 5000, lexicon: 5000, stories: 500 });
export const STORY_QUESTIONS_MAX = 30; // preguntas por historia (contentStory.js)
// Regla de calidad 8.10: un tema activo trae ≥ 12 ítems (o su `min_items`) de ≥ 3 tipos distintos.
export const DEFAULT_MIN_ITEMS = 12;
export const MIN_TYPES_PER_TOPIC = 3;

export const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
  && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
export const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

export const longText = () => text(LIMITS.long, { multiline: true });
export const audioPath = () => nullable(idOf(MEDIA_AUDIO_RE, 'una ruta como audio/g.pp.0001.mp3 (minúsculas, una sola carpeta)'));
export const imagePath = () => nullable(idOf(MEDIA_IMAGE_RE, 'una ruta como images/rodilla.webp (minúsculas, una sola carpeta)'));

// Referencia a un tema: formato de id y, si `ctx.topicIds` (un Set) viene, que exista en topics.json.
export function topicRef() {
  return custom((r, path, v, ctx) => {
    check(r, path, v, idOf(TOPIC_ID_RE, 'un id de tema como gram.present_perfect.for_since'), ctx);
    const known = ctx && ctx.topicIds;
    if (typeof v === 'string' && TOPIC_ID_RE.test(v) && v.length <= LIMITS.idLength && known && typeof known.has === 'function' && !known.has(v)) {
      r.error(path, 'UNKNOWN_TOPIC', `el tema ${v} no existe en content/taxonomy/topics.json`);
    }
  });
}
