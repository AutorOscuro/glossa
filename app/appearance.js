// Apariencia en vivo (subparte 0.8, cuarto 2): aplica el TEMA y el TAMAÑO DE TEXTO elegidos en Ajustes, al arrancar y cada vez que cambian.
//
//   resolveTheme(elección, win)         → nombre de tema real. 'auto' = el del sistema (initialTheme: prefers-color-scheme, o ?tema= en pruebas).
//   applyTextSize(doc, tamaño)          → pone <html data-text-size="…"> (las reglas están en ui/styles/base.css; es un porcentaje que se
//                                         SUMA al tamaño de letra del sistema). Lanza Error si el tamaño no existe.
//   createAppearance({ doc, win, settings }) → { apply(), destroy() }
//       · apply() lee settings.get('theme') y settings.get('textSize') y los aplica ya (nunca lanza: un fallo se registra y la app sigue).
//       · Se suscribe a settings.onChange('theme' | 'textSize'): el cambio se ve al instante, sin recargar.
//       · Con tema 'auto' también sigue al sistema EN VIVO (si el teléfono pasa de claro a oscuro con la app abierta).
//       · destroy() quita todas las suscripciones y el oyente del sistema (idempotente).
import { applyTheme, initialTheme, isTheme } from './theme.js';
import { DEFS } from '../core/settings.js';

export const TEXT_SIZES = DEFS.textSize.choices;
const LIGHT_QUERY = '(prefers-color-scheme: light)';

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

  // Con 'auto', el tema acompaña al sistema mientras la app está abierta. matchMedia puede no existir o no tener eventos: es un extra.
  safely('el seguimiento del tema del sistema', () => {
    const mql = typeof win.matchMedia === 'function' ? win.matchMedia(LIGHT_QUERY) : null;
    if (!mql || typeof mql.addEventListener !== 'function') return;
    const onSystemChange = () => { if (settings.get('theme') === 'auto') paintTheme(); };
    mql.addEventListener('change', onSystemChange);
    offs.push(() => mql.removeEventListener?.('change', onSystemChange));
  });

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
