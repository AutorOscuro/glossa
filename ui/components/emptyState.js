// Estado vacío (subparte 0.5): una pantalla sin contenido es una invitación a actuar, no un error.
//
//   createEmptyState({ title, message?, icon?, actionLabel?, onAction?, headingLevel = 2, doc?, … })
//     → { el, destroy() }
//   Con actionLabel + onAction muestra un botón principal. El icono es un carácter decorativo (aria-hidden).
import { makeCtx, str, num, fn, fail } from './_shared.js';
import { createButton } from './button.js';

export function createEmptyState(opts = {}) {
  const c = makeCtx('emptyState', opts);
  const title = str('emptyState', 'title', opts.title, { required: true, max: 200 });
  const message = str('emptyState', 'message', opts.message, { max: 600 });
  const icon = str('emptyState', 'icon', opts.icon, { max: 8 });
  const actionLabel = str('emptyState', 'actionLabel', opts.actionLabel, { max: 120 });
  const onAction = fn('emptyState', 'onAction', opts.onAction);
  const level = num('emptyState', 'headingLevel', opts.headingLevel, { min: 1, max: 6, integer: true, fallback: 2 });
  if (Boolean(actionLabel) !== Boolean(onAction)) fail('emptyState', '"actionLabel" y "onAction" van juntos');

  const button = actionLabel ? createButton({ doc: c.doc, win: c.win, label: actionLabel, variant: 'primary', onClick: onAction }) : null;
  const el = c.h('section', { class: 'empty-state' },
    icon ? c.h('div', { class: 'empty-state__icon', 'aria-hidden': 'true' }, icon) : null,
    c.h(`h${level}`, { class: 'empty-state__title' }, title),
    message ? c.h('p', { class: 'empty-state__text' }, message) : null,
    button ? button.el : null);

  let destroyed = false;
  return {
    el,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      button?.destroy();
      c.dispose();
      el.remove();
    },
  };
}
