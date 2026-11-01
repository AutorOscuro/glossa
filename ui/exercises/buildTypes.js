// @purpose: Los 2 tipos de construir con piezas (2.4-T3, punto 4b): tabla de opciones por tipo y función que los registra en el registro de ejercicios.
// Envoltorios de la familia de construir (subparte 2.4, tramo 3). Cada tipo es el componente base `buildPieces` (ui/exercises/buildPieces.js) con sus propias opciones:
//   BUILD_TYPES = { <tipo>: { …opciones de createBuildPieces que solo ese tipo cambia } }   (objeto congelado; hoy ninguno cambia nada: el componente decide «palabra» o «frase» por el tipo del ítem)
//   registerBuildTypes(registry, { rng?, log? }) → lista de los tipos registrados
//     registry  lo que devuelve createExerciseRegistry (necesita `register`). Registra los 2 tipos, cada uno con su propio createBuildPieces.
//     rng       azar con shuffle (core/rng.js); sin él cada componente usa el del sistema. Las pruebas pasan uno con semilla.
//     log       recibe los fallos al pintar la corrección.
// Un tipo ya registrado hace lanzar al registro (no se silencia).
import { createBuildPieces } from './buildPieces.js';

export const BUILD_TYPES = Object.freeze({
  unscramble_letters: Object.freeze({}),
  build_from_keywords: Object.freeze({}),
});

export function registerBuildTypes(registry, { rng, log } = {}) {
  if (registry === null || typeof registry !== 'object' || typeof registry.register !== 'function') {
    throw new Error('registerBuildTypes: falta el registro de ejercicios (createExerciseRegistry)');
  }
  const shared = {};
  if (rng !== undefined) shared.rng = rng;
  if (log !== undefined) shared.log = log;
  const done = [];
  for (const [type, own] of Object.entries(BUILD_TYPES)) {
    registry.register(type, createBuildPieces({ ...shared, ...own }));
    done.push(type);
  }
  return done;
}
