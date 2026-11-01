// @purpose: Tabla y lógica pura de los 6 tipos de palabra y colocación (2.5-T2): instrucción, frase con hueco, idioma de la respuesta y máscara por defecto; sin DOM.
// Familia de producción corta, tramo T2 (roadmap 2.5 y 17). Se apoya en el ítem común (`prompt_es`, `prompt_en`) y en `data.hint` / `data.mask`; NO añade campos al contenido.
//
//   WORD_TYPES = ['fill_verb', 'translate_word', 'first_letter', 'collocation_fill', 'def_to_word', 'derive_form']
//   textTypeInfo(type) → { type, family, defaultMask } | null   (null si el tipo no es de esta tabla)
//   answerLangFor(item) → 'en'. Siempre inglés: `translate_word` es español → inglés (respuesta del Administrador a 2.5, pregunta 8); la dirección contraria se hace con mcq_en_es o def_to_word. Se mantiene la función por el contrato.
//   instructionFor(item) → instrucción corta en español para el tipo (traducir palabra: «Traduce al inglés.»); '' si el tipo no es de la tabla.
//   promptLines(item) → { es, en } textos a mostrar: `es` = prompt_es; `en` = prompt_en o null (sin espacios en los bordes; vacío cuenta como null).
//   gapParts(text) → [{ text, gap }]: parte el texto por cada hueco `___` (dos o más rayas); el hueco es { text: '', gap: true }. Sin hueco, un solo trozo.
//   withDefaults(item) → copia del ítem con `data.mask` por defecto del tipo (solo si falta; un `none` explícito se respeta). No muta la entrada; lo que no es ítem se devuelve igual.
//   promptPlan(item) → { instruction, main, aside }   qué enseña la pantalla (2.5-T2, punto 2):
//       instruction  instructionFor(item).
//       main         { lang: 'en' | 'es', parts: gapParts(texto) } | null: lo que se lee primero. Es `prompt_en` cuando existe; si no, `prompt_es`.
//       aside        { lang: 'es', text } | null: `prompt_es` como apoyo (traducción o contexto) cuando `prompt_en` es el texto principal.
//       Excepción: en `translate_word` NUNCA se muestra `prompt_en` (sería la respuesta); se enseña `prompt_es`, la palabra española. Un tipo que no es de la tabla da { '', null, null }.
export const WORD_TYPES = Object.freeze(['fill_verb', 'translate_word', 'first_letter', 'collocation_fill', 'def_to_word', 'derive_form']);

const TABLE = Object.freeze({
  fill_verb: Object.freeze({ family: 'grammar', defaultMask: 'none' }),
  translate_word: Object.freeze({ family: 'vocab', defaultMask: 'none' }),
  first_letter: Object.freeze({ family: 'vocab', defaultMask: 'first_letter' }),
  collocation_fill: Object.freeze({ family: 'vocab', defaultMask: 'none' }),
  def_to_word: Object.freeze({ family: 'vocab', defaultMask: 'none' }),
  derive_form: Object.freeze({ family: 'vocab', defaultMask: 'none' }),
});

const INSTRUCTIONS = Object.freeze({
  fill_verb: 'Escribe el verbo en la forma correcta.',
  first_letter: 'Completa la palabra.',
  collocation_fill: 'Completa la expresión.',
  def_to_word: '¿Qué palabra es?',
  derive_form: 'Escribe la forma que falta.',
});
const TO_EN = 'Traduce al inglés.';

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const clean = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

export function textTypeInfo(type) {
  return typeof type === 'string' && Object.hasOwn(TABLE, type) ? { type, ...TABLE[type] } : null;
}

export function answerLangFor() {
  return 'en';
}

export function instructionFor(item) {
  if (!isPlain(item) || textTypeInfo(item.type) === null) return '';
  if (item.type === 'translate_word') return TO_EN;
  return INSTRUCTIONS[item.type];
}

export function promptLines(item) {
  if (!isPlain(item)) return { es: null, en: null };
  return { es: clean(item.prompt_es), en: clean(item.prompt_en) };
}

export function gapParts(text) {
  if (typeof text !== 'string' || text === '') return [];
  const out = [];
  let last = 0;
  for (const m of text.matchAll(/_{2,}/g)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), gap: false });
    out.push({ text: '', gap: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), gap: false });
  return out;
}

export function withDefaults(item) {
  const info = isPlain(item) ? textTypeInfo(item.type) : null;
  if (info === null) return item;
  const data = isPlain(item.data) ? item.data : {};
  if (data.mask !== undefined || info.defaultMask === 'none') return item;
  return { ...item, data: { ...data, mask: info.defaultMask } };
}

export function promptPlan(item) {
  const empty = { instruction: '', main: null, aside: null };
  if (!isPlain(item) || textTypeInfo(item.type) === null) return empty;
  const { es, en } = promptLines(item);
  const instruction = instructionFor(item);
  // En `translate_word` el `prompt_en` (si el ítem lo trae) sería la RESPUESTA: nunca se muestra, se enseña la palabra española.
  if (en !== null && item.type !== 'translate_word') return { instruction, main: { lang: 'en', parts: gapParts(en) }, aside: es !== null ? { lang: 'es', text: es } : null };
  if (es !== null) return { instruction, main: { lang: 'es', parts: gapParts(es) }, aside: null };
  return { ...empty, instruction };
}
