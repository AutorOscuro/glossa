// @purpose: Pestaña Más: acceso a Ajustes, datos de la versión y zona de pruebas de avisos y errores.
import { h } from '../dom.js';
import { buildHref } from '../../app/router.js';
import { createView } from './_viewBase.js';

// "Más": acceso a Ajustes + datos de la versión + zona de pruebas (útil para comprobar avisos y la pantalla de error
// en el teléfono; se puede retirar en 9.2).
export default createView((ctx) => {
  const { toast, version } = ctx.services;

  const testToast = h('button', { type: 'button', class: 'btn btn--secondary' }, 'Probar un aviso');
  const testError = h('button', { type: 'button', class: 'btn btn--danger' }, 'Simular un error');

  ctx.on(testToast, 'click', () => { if (toast) toast.show('success', 'Los avisos funcionan.'); });
  ctx.on(testError, 'click', () => { throw new Error('Error de prueba lanzado desde "Más"'); });

  ctx.root.appendChild(
    h('section', { class: 'stack stack--lg view' },
      h('h1', { class: 'view__title' }, 'Más'),
      h('div', { class: 'card stack' },
        h('p', { class: 'card__title' }, 'Ajustes y más opciones'),
        h('a', { class: 'btn btn--secondary', href: buildHref('ajustes') }, 'Abrir Ajustes'),
        h('p', { class: 'text-sm text-muted' }, `Versión de la app: ${version ?? '—'}`),
      ),
      h('div', { class: 'card stack' },
        h('p', { class: 'card__title' }, 'Zona de pruebas'),
        h('p', { class: 'text-sm text-muted' }, 'Sirve para comprobar que los avisos y la pantalla de error funcionan.'),
        h('div', { class: 'row' }, testToast, testError),
      ),
    ),
  );
});
