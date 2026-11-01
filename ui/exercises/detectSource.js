// @purpose: Detector mecánico para las pantallas de texto (2.5-T4): lee el catálogo al comprobar y devuelve una función texto → hit[] que nunca lanza.
// Lo comparten las pantallas de fix_error y de transform/keyword_transform.
//   readCatalog(catalog) → catálogo | null   (acepta el catálogo o una función que lo devuelve; si lanza, null)
//   createDetectSource({ catalog?, detect?, log? }) → (text) → hit[]
//       detect    función inyectable (pruebas); si falta, se arma con `createErrorDetector` y el catálogo leído AL COMPROBAR (los servicios de estudio llegan tras el arranque).
//       Sin catálogo con `has` y `get` se usan las reglas puras (`detectRules`), sin pista. Si armar el detector falla, se avisa a `log` y se usan las reglas puras.
//       Si el detector lanza, se avisa a `log` y no hay avisos: nunca rompe la calificación. Se rearma solo si cambia el catálogo.
import { createErrorDetector, detectRules } from '../../core/errorDetect.js';

export function readCatalog(catalog) {
  try { return (typeof catalog === 'function' ? catalog() : catalog) ?? null; } catch { return null; }
}

export function createDetectSource({ catalog, detect, log } = {}) {
  const warn = typeof log === 'function' ? log : () => {};
  let built = null; // { catalog, detect } del último catálogo con el que se armó el detector
  const pick = () => {
    if (typeof detect === 'function') return detect;
    const cat = readCatalog(catalog);
    if (cat === null || typeof cat.has !== 'function' || typeof cat.get !== 'function') return detectRules;
    if (built === null || built.catalog !== cat) {
      try { built = { catalog: cat, detect: createErrorDetector({ catalog: cat }).detect }; } catch (e) { warn('detectSource: no se pudo armar el detector con el catálogo', e); built = { catalog: cat, detect: detectRules }; }
    }
    return built.detect;
  };
  return (text) => {
    try { return pick()(text); } catch (e) { warn('detectSource: falló el detector', e); return []; }
  };
}
