// @purpose: Pantalla de fix_error (2.5-T4, punto 2): oración con error, campo vacío para escribir la versión corregida, aviso de «sin cambios», trampa conocida y pista del detector mecánico.
// Envoltorio de la pantalla base `createTextAnswer` (ui/exercises/textAnswer.js) con la lógica de core/fixError.js.
//   FX_TEXT = { unchanged, trapTyped, trapHint, trapGeneric, detectHint }   textos propios (el resto sale de TA_TEXT)
//   createFixError({ compare?, confusables?, catalog?, detect?, log? }) → { mount(container, item, ctx) → { el, getResponse(), destroy() } }
//     mount     el tipo del envoltorio manda sobre el `type` del ítem. Un ítem sin `accept` lanza TypeError (el registro lo cuenta como «tipo no soportado todavía»).
//     catalog   catálogo de errores (`has`, `get` y `hint`) o una función que lo devuelve; se lee al comprobar, no al montar (los servicios de estudio llegan tras el arranque).
//     detect    función texto → hit[] (inyectable en pruebas). Si falta, se arma con el catálogo (ui/exercises/detectSource.js); sin catálogo válido se usa detectRules, sin pista.
//   registerFixError(registry, opts) → ['fix_error']   (un tipo ya registrado hace lanzar al registro)
// Decisión del punto 2: el campo arranca VACÍO (la oración con error no se copia en el campo), para que no quede la respuesta medio hecha.
// Avisos bajo el veredicto, uno solo y siempre en TEXTO (el color solo refuerza), por prioridad:
//   1. «sin cambios» (`.ta__unchanged`, role note): dejar la oración tal cual nunca es acierto ni errata.
//   2. trampa conocida (`.ta__trap`, role note): «Ese es un error típico: escribiste «…»» + pista del catálogo si existe.
//   3. pista del detector (`.ta__detect`, role note): la del primer aviso («Parece que usaste «can to»…»).
// Si el detector o el catálogo fallan, la pantalla sigue: se avisa a `log` y no hay pista.
import { createTextAnswer } from './textAnswer.js';
import { gradeFix, promptPlan, FIX_TYPE } from '../../core/fixError.js';
import { createDetectSource, readCatalog } from './detectSource.js';

export const FX_TEXT = Object.freeze({
  unchanged: 'No cambiaste nada: la oración sigue igual. Busca el error y corrígelo.',
  trapTyped: 'Ese es un error típico: escribiste',
  trapHint: 'Pista:',
  trapGeneric: 'Revisa la corrección de abajo.',
  detectHint: 'Pista:',
});

const isText = (v) => typeof v === 'string' && v.trim() !== '';

function promptNodes({ h }, item) {
  const plan = promptPlan(item);
  const nodes = [h('p', { class: 'ta__instruction' }, plan.instruction)];
  if (plan.main !== null) nodes.push(h('p', { class: 'ta__prompt ta__prompt--error', lang: plan.main.lang }, plan.main.text));
  return nodes;
}

export function createFixError({ compare, confusables, catalog, detect, log } = {}) {
  const warn = typeof log === 'function' ? log : () => {};
  const catalogNow = () => readCatalog(catalog);
  const detectNow = createDetectSource({ catalog, detect, log: warn });
  return Object.freeze({
    mount(container, item, ctx = {}) {
      const it = item?.type !== FIX_TYPE ? { ...item, type: FIX_TYPE } : item;
      const base = createTextAnswer({
        compare, confusables, log, answerLang: 'en', catalog,
        prompt: (i, helpers) => promptNodes(helpers, i),
        grade: (i, text, o) => gradeFix(i, text, { ...o, detect: detectNow }),
        notes: (res, { h }) => {
          if (!res) return null;
          if (res.unchanged) return h('p', { class: 'ta__unchanged', role: 'note' }, FX_TEXT.unchanged);
          if (res.trap) {
            const cat = catalogNow();
            let hint = null;
            try { if (res.trap.code !== null && cat && typeof cat.has === 'function' && typeof cat.hint === 'function' && cat.has(res.trap.code)) hint = cat.hint(res.trap.code); } catch { hint = null; }
            return h('p', { class: 'ta__trap', role: 'note' }, `${FX_TEXT.trapTyped} «`, h('strong', {}, res.trap.text), `». ${isText(hint) ? `${FX_TEXT.trapHint} ${hint.trim()}` : FX_TEXT.trapGeneric}`);
          }
          if (isText(res.hint)) return h('p', { class: 'ta__detect', role: 'note' }, `${FX_TEXT.detectHint} ${res.hint.trim()}`);
          return null;
        },
      });
      return base.mount(container, it, ctx);
    },
  });
}

export function registerFixError(registry, opts = {}) {
  if (registry === null || typeof registry !== 'object' || typeof registry.register !== 'function') {
    throw new Error('registerFixError: falta el registro de ejercicios (createExerciseRegistry)');
  }
  registry.register(FIX_TYPE, createFixError(opts));
  return [FIX_TYPE];
}
