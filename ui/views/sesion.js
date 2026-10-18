import { h } from '../dom.js';
import { createView } from './_viewBase.js';

export default createView((ctx) => {
  ctx.root.appendChild(
    h('section', { class: 'stack stack--lg view' },
      h('h1', { class: 'view__title' }, 'Sesión'),
      h('div', { class: 'card stack' },
        h('p', { class: 'card__title' }, 'Aquí practicarás una sesión.'),
        h('p', { class: 'text-sm text-muted' }, `Sesión: ${ctx.params.id ?? '—'}`),
        h('p', { class: 'text-sm text-muted' }, 'Esta pantalla llega en la subparte 2.1.'),
      ),
    ),
  );
});
