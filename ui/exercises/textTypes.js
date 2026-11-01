// @purpose: Los 6 tipos de palabra y colocación (2.5-T2, punto 2): envoltorio de la pantalla base con instrucción, frase con hueco, idioma de respuesta y máscara por defecto.
// Envoltorios de la familia de producción corta, tramo T2 (roadmap 2.5 y 17). Cada tipo es la pantalla base `createTextAnswer` (ui/exercises/textAnswer.js)
// con la lógica de core/textTypes.js: lo que se enseña lo decide `promptPlan`; aquí solo se pinta.
//   TT_TEXT = { gap }   texto accesible del hueco (la rayita se ve sin CSS; el lector de pantalla dice «hueco»)
//   createWordType(type, { compare?, confusables?, catalog?, detect?, log? }) → { mount(container, item, ctx) → { el, getResponse(), destroy() } }
//     type   uno de WORD_TYPES (core/textTypes.js); otro valor lanza Error en español.
//     mount  el tipo del envoltorio manda: si el ítem trae otro `type` o ninguno, se monta una copia con el del envoltorio (así nunca queda un enunciado en blanco).
//            Usa `withDefaults` (máscara de primera letra en `first_letter`) y `answerLangFor` (traducir palabra: la dirección sale de cada ítem, por eso la pantalla
//            base se crea en cada montaje). Un ítem sin `accept` lanza TypeError (el registro lo cuenta como «tipo no soportado todavía»).
//   registerWordTypes(registry, { compare?, confusables?, catalog?, detect?, log? }) → lista de los tipos registrados.
//     catalog / detect (2.5-T5): activan el detector mecánico de 1.6 sobre la respuesta incorrecta (pista `.ta__detect` y `errors` en el envío); ver ui/exercises/textAnswer.js. Sin ninguno, igual que antes.
//     registry  lo que devuelve createExerciseRegistry (necesita `register`). Un tipo ya registrado hace lanzar al registro (no se silencia).
// Marcado del enunciado: `.ta__instruction` (instrucción), `.ta__prompt` con `lang` (texto principal; el hueco es `.ta__gap`) y `.ta__aside` (apoyo en español).
import { createTextAnswer } from './textAnswer.js';
import { WORD_TYPES, answerLangFor, promptPlan, withDefaults } from '../../core/textTypes.js';

export const TT_TEXT = Object.freeze({ gap: 'hueco' });

function promptNodes(item, { h }) {
  const plan = promptPlan(item);
  const nodes = [];
  if (plan.instruction !== '') nodes.push(h('p', { class: 'ta__instruction' }, plan.instruction));
  if (plan.main !== null) {
    const parts = plan.main.parts.map((p) => (p.gap ? h('span', { class: 'ta__gap', role: 'img', 'aria-label': TT_TEXT.gap }, '_____') : p.text));
    nodes.push(h('p', { class: 'ta__prompt', lang: plan.main.lang }, ...parts));
  }
  if (plan.aside !== null) nodes.push(h('p', { class: 'ta__aside', lang: plan.aside.lang }, plan.aside.text));
  return nodes;
}

export function createWordType(type, { compare, confusables, catalog, detect, log } = {}) {
  if (!WORD_TYPES.includes(type)) throw new Error(`createWordType: tipo desconocido (${String(type).slice(0, 40)})`);
  return Object.freeze({
    mount(container, item, ctx = {}) {
      const it = withDefaults(item?.type !== type ? { ...item, type } : item);
      const base = createTextAnswer({ compare, confusables, catalog, detect, log, answerLang: answerLangFor(it), prompt: promptNodes });
      return base.mount(container, it, ctx);
    },
  });
}

export function registerWordTypes(registry, { compare, confusables, catalog, detect, log } = {}) {
  if (registry === null || typeof registry !== 'object' || typeof registry.register !== 'function') {
    throw new Error('registerWordTypes: falta el registro de ejercicios (createExerciseRegistry)');
  }
  const done = [];
  for (const type of WORD_TYPES) {
    registry.register(type, createWordType(type, { compare, confusables, catalog, detect, log }));
    done.push(type);
  }
  return done;
}
