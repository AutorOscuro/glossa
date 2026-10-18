// Aviso persistente de actualización (subparte 0.6, mitad B). Usa las clases .toast de components.css (0.3).
//
//   createUpdateNotice({ doc?, container }) → { show({ message, actionLabel, dismissLabel?, onAction, onDismiss? }), hide(), isVisible(), destroy() }
//   - A diferencia de createToaster, NO se cierra solo ni al tocarlo: se queda hasta que la persona elija.
//   - Dos botones reales: la acción ("Actualizar") y, si se pasa dismissLabel, "Ahora no".
//   - role="status": se anuncia sin interrumpir. El mensaje entra como TEXTO (nunca HTML). Un solo aviso a la vez.
import { h as domH } from '../dom.js';

export function createUpdateNotice({ doc = globalThis.document, container } = {}) {
  if (!container) throw new Error('createUpdateNotice: falta el contenedor');
  const { h } = domH.with(doc);
  let current = null; // { el, cleanup }

  function hide() {
    if (!current) return;
    const { el, cleanup } = current;
    current = null;
    cleanup();
    el.remove();
  }

  function show({ message, actionLabel, dismissLabel, onAction, onDismiss } = {}) {
    if (typeof message !== 'string' || !message) throw new TypeError('createUpdateNotice.show: falta "message"');
    if (typeof actionLabel !== 'string' || !actionLabel) throw new TypeError('createUpdateNotice.show: falta "actionLabel"');
    hide();
    const action = h('button', { type: 'button', class: 'btn btn--primary' }, actionLabel);
    const dismiss = dismissLabel ? h('button', { type: 'button', class: 'btn btn--ghost' }, dismissLabel) : null;
    const el = h('div', { class: 'toast toast--info update-notice', role: 'status' },
      h('span', { class: 'toast__icon', 'aria-hidden': 'true' }, 'i'),
      h('span', { class: 'grow' }, message),
      dismiss, action);
    const onActionClick = () => { if (typeof onAction === 'function') onAction(); };
    const onDismissClick = () => { hide(); if (typeof onDismiss === 'function') onDismiss(); };
    action.addEventListener('click', onActionClick);
    dismiss?.addEventListener('click', onDismissClick);
    container.appendChild(el);
    current = {
      el,
      cleanup: () => { action.removeEventListener('click', onActionClick); dismiss?.removeEventListener('click', onDismissClick); },
    };
    return el;
  }

  return { show, hide, isVisible: () => current !== null, destroy: hide };
}
