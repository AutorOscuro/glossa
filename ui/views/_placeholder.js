// @purpose: Vista provisional con el estilo del sistema de diseño para las pestañas que aún no se han construido.
// Vista provisional con el estilo del sistema de diseño. Cada pestaña la usa hasta que llegue su subparte real.
import { h } from '../dom.js';
import { createView } from './_viewBase.js';

// opciones: { title, text, arrivesIn: 'subparte', extra?: (ctx) => Node | Node[] }
export function placeholderView({ title, text, arrivesIn, extra }) {
  return createView((ctx) => {
    ctx.root.appendChild(
      h('section', { class: 'stack stack--lg view' },
        h('h1', { class: 'view__title' }, title),
        h('div', { class: 'card stack' },
          h('p', { class: 'card__title' }, text),
          h('p', { class: 'text-sm text-muted' }, `Esta pantalla llega en la subparte ${arrivesIn}.`),
        ),
        extra ? extra(ctx) : null,
      ),
    );
  });
}
