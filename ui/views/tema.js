import { h } from '../dom.js';
import { createView } from './_viewBase.js';

export default createView((ctx) => {
  ctx.root.appendChild(
    h('section', { class: 'stack stack--lg view' },
      h('h1', { class: 'view__title' }, 'Tema'),
      h('div', { class: 'card stack' },
        h('p', { class: 'card__title' }, 'Aquí verás el detalle de un tema.'),
        h('p', { class: 'text-sm text-muted' }, `Tema: ${ctx.params.id ?? '—'}`),
        h('p', { class: 'text-sm text-muted' }, 'Esta pantalla llega en la subparte 3.2.'),
      ),
    ),
  );
});
