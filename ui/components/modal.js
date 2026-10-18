// Modal de confirmación (subparte 0.5). Reutiliza el motor de superposiciones (foco atrapado, Esc, scroll bloqueado).
//
//   createModal({ title, message?, children?, confirmLabel = 'Aceptar', cancelLabel = 'Cancelar', danger = false,
//                 hideCancel = false, container = document.body, onResult?(boolean), doc?, … })
//     → { el, backdrop, open() → Promise<boolean>, close(resultado = false), isOpen(),
//         setConfirmDisabled(b), confirmButton, cancelButton, destroy() }
//   · open() devuelve una promesa: true si confirman; false si cancelan, pulsan Esc, tocan el fondo o se destruye.
//     Llamarlo dos veces seguidas devuelve la MISMA promesa (no se abre dos veces).
//   · role="alertdialog" con título y mensaje enlazados. En modo `danger` el foco inicial cae en "Cancelar" (la
//     opción segura); si no, en "Aceptar". La confirmación se resuelve UNA vez (doble toque no repite).
import { makeCtx, str, flag, fn, uid, toNodes } from './_shared.js';
import { createOverlay } from './_overlay.js';
import { createButton } from './button.js';
import { TEXT } from './_text.js';

export function createModal(opts = {}) {
  const c = makeCtx('modal', opts);
  const title = str('modal', 'title', opts.title, { required: true, max: 200 });
  const message = str('modal', 'message', opts.message, { max: 2000 });
  const confirmLabel = str('modal', 'confirmLabel', opts.confirmLabel, { max: 80 }) ?? TEXT.accept;
  const cancelLabel = str('modal', 'cancelLabel', opts.cancelLabel, { max: 80 }) ?? TEXT.cancel;
  const danger = flag('modal', 'danger', opts.danger);
  const hideCancel = flag('modal', 'hideCancel', opts.hideCancel);
  const onResult = fn('modal', 'onResult', opts.onResult);
  const container = opts.container ?? c.doc.body;
  const { h } = c;
  const titleId = uid('modal-title');
  const textId = uid('modal-text');

  const backdrop = h('div', { class: 'sheet-backdrop', 'aria-hidden': 'true' });
  const cancelButton = hideCancel ? null : createButton({ doc: c.doc, win: c.win, label: cancelLabel, variant: 'secondary', onClick: () => finish(false, 'button') });
  const confirmButton = createButton({ doc: c.doc, win: c.win, label: confirmLabel, variant: danger ? 'danger' : 'primary', onClick: () => finish(true, 'button') });
  const panel = h('div', {
    class: ['modal', danger && 'modal--danger'], role: 'alertdialog', 'aria-modal': 'true',
    'aria-labelledby': titleId, 'aria-describedby': message ? textId : null, tabindex: '-1',
  },
  h('h2', { class: 'modal__title', id: titleId }, title),
  message ? h('p', { class: 'modal__text', id: textId }, message) : null,
  toNodes(c, 'modal', opts.children),
  h('div', { class: 'modal__actions' }, cancelButton?.el, confirmButton.el));
  container.appendChild(backdrop);
  container.appendChild(panel);

  let pending = null; // { promise, resolve }
  let settled = false;

  const overlay = createOverlay(c, {
    panel,
    backdrop,
    dismissible: true,
    initialFocus: () => (danger && cancelButton ? cancelButton.el : confirmButton.el),
    onClose: () => {
      // Cierre por Esc, fondo o destroy = cancelar. Si ya hubo resultado, no se repite.
      if (pending && !settled) settle(false);
    },
  });

  function settle(result) {
    if (settled || !pending) return;
    settled = true;
    const { resolve } = pending;
    resolve(result);
    onResult?.(result);
  }

  function finish(result, reason) {
    if (!pending || settled) return;
    settle(result);
    overlay.close(reason);
  }

  let destroyed = false;
  return {
    el: panel,
    backdrop,
    confirmButton: confirmButton.el,
    cancelButton: cancelButton?.el ?? null,
    open() {
      if (pending && !settled) return pending.promise;
      settled = false;
      let resolve;
      const promise = new Promise((r) => {
        resolve = r;
      });
      pending = { promise, resolve };
      overlay.open();
      return promise;
    },
    close(result = false) {
      finish(Boolean(result), 'programmatic');
    },
    isOpen: () => overlay.isOpen(),
    setConfirmDisabled: (on) => confirmButton.setDisabled(Boolean(on)),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      overlay.destroy();
      confirmButton.destroy();
      cancelButton?.destroy();
      c.dispose();
      panel.remove();
      backdrop.remove();
    },
  };
}
