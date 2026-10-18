import { h } from '../dom.js';
import { buildHref } from '../../app/router.js';
import { createView } from './_viewBase.js';

export default createView((ctx) => {
  ctx.root.appendChild(
    h('section', { class: 'stack stack--lg view' },
      h('h1', { class: 'view__title' }, 'No encontramos esa pantalla'),
      h('div', { class: 'card stack' },
        h('p', { class: 'card__title' }, 'Puede que el enlace esté mal escrito o que esa pantalla ya no exista.'),
        ctx.params.requested ? h('p', { class: 'text-sm text-muted' }, `Dirección: ${ctx.params.requested}`) : null,
        h('a', { class: 'btn btn--primary', href: buildHref('hoy') }, 'Ir a Hoy'),
      ),
    ),
  );
});
