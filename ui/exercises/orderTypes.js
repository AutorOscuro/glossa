// @purpose: Los 2 tipos de ordenar (2.4-T1, punto 7): tabla de opciones por tipo y función que los registra en el registro de ejercicios.
// Envoltorios de la familia de ordenar (subparte 2.4, tramo 1). Cada tipo es el componente base `orderBlocks` (ui/exercises/orderBlocks.js) con sus propias opciones:
//   ORDER_TYPES = { <tipo>: { …opciones de createOrderBlocks que solo ese tipo cambia } }   (objeto congelado; hoy ninguno cambia nada: `order_dialogue` se distingue por su dato `data.lines`)
//   registerOrderTypes(registry, { rng?, log? }) → lista de los tipos registrados
//     registry  lo que devuelve createExerciseRegistry (necesita `register`). Registra los 2 tipos, cada uno con su propio createOrderBlocks.
//     rng       azar con shuffle (core/rng.js); sin él cada componente usa el del sistema. Las pruebas pasan uno con semilla.
//     log       recibe los fallos al pintar la corrección.
// Un tipo ya registrado hace lanzar al registro (no se silencia). Más tipos de ordenar (p. ej. `order_paragraphs`) se añaden a la tabla.
import { createOrderBlocks } from './orderBlocks.js';

export const ORDER_TYPES = Object.freeze({
  order_blocks: Object.freeze({}),
  order_dialogue: Object.freeze({}),
});

export function registerOrderTypes(registry, { rng, log } = {}) {
  if (registry === null || typeof registry !== 'object' || typeof registry.register !== 'function') {
    throw new Error('registerOrderTypes: falta el registro de ejercicios (createExerciseRegistry)');
  }
  const shared = {};
  if (rng !== undefined) shared.rng = rng;
  if (log !== undefined) shared.log = log;
  const done = [];
  for (const [type, own] of Object.entries(ORDER_TYPES)) {
    registry.register(type, createOrderBlocks({ ...shared, ...own }));
    done.push(type);
  }
  return done;
}
