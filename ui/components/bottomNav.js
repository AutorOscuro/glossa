// @purpose: Navegación inferior de 5 pestañas: Hoy, Mapa, Practicar, Errores y Más.
// Navegación inferior de 5 pestañas (subparte 0.4): Hoy · Mapa · Practicar · Errores · Más.
//
//   createBottomNav({ doc? }) → { el, setActive(tab|null), destroy() }
//   Cada pestaña es un <a href="#/…"> real (funciona el botón atrás y "abrir en pestaña nueva").
//   La activa lleva aria-current="page" y la clase is-active; no depende solo del color (barra superior + peso).
import { h as domH } from '../dom.js';
import { buildHref } from '../../app/router.js';

export const TABS = [
  { id: 'hoy', label: 'Hoy', icon: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10' },
  { id: 'mapa', label: 'Mapa', icon: 'M9 3L3 5v16l6-2 6 2 6-2V3l-6 2-6-2zM9 3v16M15 5v16' },
  { id: 'practicar', label: 'Practicar', icon: 'M13 2L4 14h7l-1 8 9-12h-7z' },
  { id: 'errores', label: 'Errores', icon: 'M12 3l10 18H2zM12 10v5M12 18h.01' },
  { id: 'mas', label: 'Más', icon: 'M5 12h.01M12 12h.01M19 12h.01' },
];

export function createBottomNav({ doc = globalThis.document } = {}) {
  if (!doc) throw new Error('createBottomNav: no hay documento');
  const { h, hs } = domH.with(doc);

  const icon = (path) =>
    hs('svg', {
      class: 'bottom-nav__icon', viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor',
      'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false',
    }, hs('path', { d: path }));

  const items = new Map();
  const cells = TABS.map((tab) => {
    const a = h('a', { class: 'bottom-nav__item', href: buildHref(tab.id), dataset: { tab: tab.id } },
      icon(tab.icon),
      h('span', { class: 'bottom-nav__label' }, tab.label),
    );
    items.set(tab.id, a);
    return h('li', { class: 'bottom-nav__cell' }, a);
  });
  const nav = h('nav', { class: 'bottom-nav', 'aria-label': 'Navegación principal' }, h('ul', { class: 'bottom-nav__list' }, cells));

  return {
    el: nav,
    setActive(tabId) {
      for (const [id, a] of items) {
        if (id === tabId) {
          a.setAttribute('aria-current', 'page');
          a.classList.add('is-active');
        } else {
          a.removeAttribute('aria-current');
          a.classList.remove('is-active');
        }
      }
    },
    destroy() {
      nav.remove();
      items.clear();
    },
  };
}
