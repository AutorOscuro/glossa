// @purpose: Registra en el registro de ejercicios todos los tipos construidos en 2.2 a 2.5, en un solo lugar compartido por la app y las pruebas.
// Registro de todos los tipos de ejercicio (subparte 2.9-T3, punto 4). Antes vivía en línea en app/main.js; aquí se puede probar.
//   registerExerciseTypes(registry, { catalog?, log? }) → registra los tipos en `registry` (createExerciseRegistry). Lanza si un tipo ya estaba registrado.
import { createPhraseCloze } from '../ui/exercises/phraseCloze.js';
import { registerChoiceTypes } from '../ui/exercises/choiceTypes.js';
import { registerOrderTypes } from '../ui/exercises/orderTypes.js';
import { registerBuildTypes } from '../ui/exercises/buildTypes.js';
import { createMatchPairs } from '../ui/exercises/matchPairs.js';
import { createClozeBank } from '../ui/exercises/clozeBank.js';
import { registerWordTypes } from '../ui/exercises/textTypes.js';
import { registerTranslateTypes } from '../ui/exercises/translateTypes.js';
import { createThreeForms } from '../ui/exercises/threeForms.js';
import { registerFixError } from '../ui/exercises/fixError.js';
import { registerTransformTypes } from '../ui/exercises/transformTypes.js';

// `catalog` es una función (o null) que devuelve el catálogo de errores; se llama al comprobar cada respuesta.
export function registerExerciseTypes(registry, { catalog = () => null, log = console.error } = {}) {
  registry.register('phrase_cloze', createPhraseCloze());
  registerChoiceTypes(registry, { catalog, log }); // 2.3-T3: los 9 tipos de elegir
  registerOrderTypes(registry, { log }); // 2.4-T1: order_blocks y order_dialogue
  registry.register('match_pairs', createMatchPairs({ log })); // 2.4-T2
  registry.register('cloze_bank', createClozeBank({ log })); // 2.4-T2
  registerBuildTypes(registry, { log }); // 2.4-T3: unscramble_letters y build_from_keywords
  registerWordTypes(registry, { catalog, log }); // 2.5-T2: fill_verb, translate_word, first_letter, collocation_fill, def_to_word, derive_form
  registerTranslateTypes(registry, { catalog, log }); // 2.5-T3: trap_translate y translate_bank
  registry.register('three_forms', createThreeForms({ catalog, log })); // 2.5-T3: presente, pasado y participio
  registerFixError(registry, { catalog, log }); // 2.5-T4: fix_error
  registerTransformTypes(registry, { catalog, log }); // 2.5-T4: transform y keyword_transform
}
