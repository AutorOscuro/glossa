// @purpose: Los 9 tipos de la familia de elección (2.3-T3, parte 1): tabla de opciones por tipo y función que los registra en el registro de ejercicios.
// Envoltorios de la familia de elección (subparte 2.3, tramo 3, parte 1). Cada tipo es el componente base `choice` (ui/exercises/choice.js) con sus propias opciones:
//   CHOICE_TYPES = { <tipo>: { …opciones de createChoice que solo ese tipo cambia } }   (objeto congelado; solo `mcq_en_es` cambia algo: sus opciones están en español)
//   registerChoiceTypes(registry, { rng?, catalog?, log? }) → lista de los tipos registrados
//     registry  lo que devuelve createExerciseRegistry (necesita `register`). Registra los 9 tipos, cada uno con su propio createChoice.
//     rng       azar con shuffle (core/rng.js); sin él cada componente usa el del sistema. Las pruebas pasan uno con semilla.
//     catalog   catálogo de errores o una función que lo devuelve; app/main.js pasará `() => services.study?.catalog ?? null`, que se lee al comprobar (no al montar).
//     log       recibe los fallos al pintar la corrección.
// Esta parte NO toca app/main.js: el cableado y el guion son la parte 2 del tramo. Un tipo ya registrado hace lanzar al registro (no se silencia).
import { createChoice } from './choice.js';

export const CHOICE_TYPES = Object.freeze({
  choose_correct: Object.freeze({}),
  ab_natural: Object.freeze({}),
  mcq_en_es: Object.freeze({ optionsLang: 'es' }),
  mcq_es_en: Object.freeze({}),
  pick_fits: Object.freeze({}),
  odd_one_out: Object.freeze({}),
  choose_tense: Object.freeze({}),
  prep_pick: Object.freeze({}),
  particle_pick: Object.freeze({}),
});

export function registerChoiceTypes(registry, { rng, catalog, log } = {}) {
  if (registry === null || typeof registry !== 'object' || typeof registry.register !== 'function') {
    throw new Error('registerChoiceTypes: falta el registro de ejercicios (createExerciseRegistry)');
  }
  const shared = {};
  if (rng !== undefined) shared.rng = rng;
  if (catalog !== undefined) shared.catalog = catalog;
  if (log !== undefined) shared.log = log;
  const done = [];
  for (const [type, own] of Object.entries(CHOICE_TYPES)) {
    registry.register(type, createChoice({ ...shared, ...own }));
    done.push(type);
  }
  return done;
}
