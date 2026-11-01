// @purpose: Pantalla de transform, keyword_transform, join_sentences y pronoun_placement (2.5-T4, puntos 4 y 5): oración base, instrucción, palabra clave o conector como etiqueta de texto, campo vacío y avisos de sin cambios, trampa, clave ausente y pista del detector.
// Envoltorios de la pantalla base `createTextAnswer` (ui/exercises/textAnswer.js) con la lógica de core/transformTypes.js. Se escribe la oración reescrita en inglés.
//   TT_TEXT = { keywordLabel, connectorLabel, unchanged, keywordMissing, connectorMissing, trapTyped, trapHint, trapGeneric, detectHint }   textos propios (el resto sale de TA_TEXT)
//   createTransformType(type, { compare?, confusables?, catalog?, detect?, log? }) → { mount(container, item, ctx) → { el, getResponse(), destroy() } }
//     type      'transform' | 'keyword_transform' | 'join_sentences' | 'pronoun_placement'; otro valor lanza Error en español. El tipo del envoltorio manda sobre el `type` del ítem.
//     mount     un ítem sin `accept` lanza TypeError (el registro lo cuenta como «tipo no soportado todavía»).
//     catalog   catálogo de errores (`has`, `get` y `hint`) o una función que lo devuelve; se lee al comprobar, no al montar. detect: ver ui/exercises/detectSource.js.
//   registerTransformTypes(registry, opts) → ['transform', 'keyword_transform', 'join_sentences', 'pronoun_placement']   (un tipo ya registrado hace lanzar al registro)
// Enunciado: instrucción en español, oración base en inglés (`.ta__prompt--source`) y, solo en keyword_transform y join_sentences con clave, la etiqueta `.ta__keyword` (TEXTO, no solo color):
//   «Palabra clave: …» en keyword_transform y «Conector: …» en join_sentences (el aviso de clave ausente también cambia de palabras). pronoun_placement no tiene etiqueta.
// Decisión del punto 4: el campo arranca VACÍO (la oración base se muestra, no se copia al campo), igual que en fix_error.
// Avisos bajo el veredicto, siempre en TEXTO (el color solo refuerza; todos `role="note"`):
//   «sin cambios» (`.ta__unchanged`) va SOLO; si no, pueden salir juntos la trampa conocida (`.ta__trap`) y «usa la palabra clave» (`.ta__kwmissing`),
//   y la pista del detector (`.ta__detect`) solo si no hay trampa. Todo lo que no acierta y no usa la clave recibe el aviso de la clave (es la regla del tipo).
// Si el detector o el catálogo fallan, la pantalla sigue: se avisa a `log` y no hay pista.
import { createTextAnswer } from './textAnswer.js';
import { createDetectSource, readCatalog } from './detectSource.js';
import { promptPlan, gradeTransform, isTransformType, TRANSFORM_TYPES } from '../../core/transformTypes.js';

export const TT_TEXT = Object.freeze({
  keywordLabel: 'Palabra clave:',
  connectorLabel: 'Conector:',
  unchanged: 'No cambiaste nada: la oración sigue igual. Reescríbela como pide la instrucción.',
  keywordMissing: 'Tu respuesta no usa la palabra clave. Úsala tal cual, sin cambiarla:',
  connectorMissing: 'Tu respuesta no usa el conector. Úsalo tal cual, sin cambiarlo:',
  trapTyped: 'Ese es un error típico: escribiste',
  trapHint: 'Pista:',
  trapGeneric: 'Revisa la corrección de abajo.',
  detectHint: 'Pista:',
});

const isText = (v) => typeof v === 'string' && v.trim() !== '';

function promptNodes(type, { h }, item) {
  const plan = promptPlan(item, type);
  const nodes = [h('p', { class: 'ta__instruction' }, plan.instruction)];
  if (plan.main !== null) nodes.push(h('p', { class: 'ta__prompt ta__prompt--source', lang: plan.main.lang }, plan.main.text));
  if (plan.keyword !== null) nodes.push(h('p', { class: 'ta__keyword' }, `${type === 'join_sentences' ? TT_TEXT.connectorLabel : TT_TEXT.keywordLabel} `, h('strong', { lang: 'en' }, plan.keyword)));
  return nodes;
}

export function createTransformType(type, { compare, confusables, catalog, detect, log } = {}) {
  if (!isTransformType(type)) throw new Error(`createTransformType: tipo desconocido (${String(type).slice(0, 40)})`);
  const warn = typeof log === 'function' ? log : () => {};
  const catalogNow = () => readCatalog(catalog);
  const detectNow = createDetectSource({ catalog, detect, log: warn });
  return Object.freeze({
    mount(container, item, ctx = {}) {
      const it = item?.type !== type ? { ...item, type } : item;
      const base = createTextAnswer({
        compare, confusables, log, answerLang: 'en', catalog,
        prompt: (i, helpers) => promptNodes(type, helpers, i),
        grade: (i, text, o) => gradeTransform(i, text, type, { ...o, detect: detectNow }),
        notes: (res, { h }) => {
          if (!res) return null;
          if (res.unchanged) return h('p', { class: 'ta__unchanged', role: 'note' }, TT_TEXT.unchanged);
          const out = [];
          if (res.trap) {
            const cat = catalogNow();
            let hint = null;
            try { if (res.trap.code !== null && cat && typeof cat.has === 'function' && typeof cat.hint === 'function' && cat.has(res.trap.code)) hint = cat.hint(res.trap.code); } catch { hint = null; }
            out.push(h('p', { class: 'ta__trap', role: 'note' }, `${TT_TEXT.trapTyped} «`, h('strong', {}, res.trap.text), `». ${isText(hint) ? `${TT_TEXT.trapHint} ${hint.trim()}` : TT_TEXT.trapGeneric}`));
          }
          if (res.keywordMissing && isText(res.keyword)) out.push(h('p', { class: 'ta__kwmissing', role: 'note' }, `${type === 'join_sentences' ? TT_TEXT.connectorMissing : TT_TEXT.keywordMissing} «`, h('strong', { lang: 'en' }, res.keyword), '».'));
          if (!res.trap && isText(res.hint)) out.push(h('p', { class: 'ta__detect', role: 'note' }, `${TT_TEXT.detectHint} ${res.hint.trim()}`));
          return out.length === 0 ? null : out;
        },
      });
      return base.mount(container, it, ctx);
    },
  });
}

export function registerTransformTypes(registry, opts = {}) {
  if (registry === null || typeof registry !== 'object' || typeof registry.register !== 'function') {
    throw new Error('registerTransformTypes: falta el registro de ejercicios (createExerciseRegistry)');
  }
  const done = [];
  for (const type of TRANSFORM_TYPES) {
    registry.register(type, createTransformType(type, opts));
    done.push(type);
  }
  return done;
}
