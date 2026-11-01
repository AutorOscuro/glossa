// @purpose: Aplica en vivo el tema y el tamaño de texto elegidos en Ajustes, al arrancar y cada vez que cambian.
// Apariencia en vivo (subparte 0.8, cuarto 2): aplica el TEMA y el TAMAÑO DE TEXTO elegidos en Ajustes, al arrancar y cada vez que cambian.
//
//   resolveTheme(elección, win)         → nombre de tema real: la elección si es válida; si no (p. ej. un 'auto' viejo), initialTheme (?tema= o Aurora).
//   applyTextSize(doc, tamaño)          → pone <html data-text-size="…"> (las reglas están en ui/styles/base.css; es un porcentaje que se
//                                         SUMA al tamaño de letra del sistema). Lanza Error si el tamaño no existe.
//   createAppearance({ doc, win, settings }) → { apply(), destroy() }
//       · apply() lee settings.get('theme') y settings.get('textSize') y los aplica ya (nunca lanza: un fallo se registra y la app sigue).
//       · Se suscribe a settings.onChange('theme' | 'textSize'): el cambio se ve al instante, sin recargar.
//       · destroy() quita todas las suscripciones y el oyente del sistema (idempotente).
import { applyTheme, initialTheme, isTheme } from './theme.js';
import { DEFS } from '../core/settings.js';

export const TEXT_SIZES = DEFS.textSize.choices;

export function resolveTheme(choice, win) {
  return isTheme(choice) ? choice : initialTheme(win);
}

export function applyTextSize(doc, size) {
  if (!TEXT_SIZES.includes(size)) throw new Error(`Tamaño de texto desconocido: ${String(size)}`);
  doc.documentElement.setAttribute('data-text-size', size);
}

export function createAppearance({ doc, win, settings, log = console.error } = {}) {
  if (!doc || !win || !settings) throw new Error('createAppearance: se necesitan doc, win y settings');
  const offs = [];
  let destroyed = false;

  const safely = (what, task) => {
    try { task(); } catch (e) { log(`No se pudo aplicar ${what}`, e); }
  };
  const paintTheme = () => safely('el tema', () => applyTheme(doc, win, resolveTheme(settings.get('theme'), win)));
  const paintSize = () => safely('el tamaño de texto', () => applyTextSize(doc, settings.get('textSize')));

  offs.push(settings.onChange('theme', paintTheme));
  offs.push(settings.onChange('textSize', paintSize));

  return {
    apply() {
      if (destroyed) return;
      paintTheme();
      paintSize();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const off of offs.splice(0)) safely('la baja de una suscripción', off);
    },
  };
}
