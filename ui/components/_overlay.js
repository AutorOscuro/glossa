// Motor común de superposiciones (subparte 0.5): hoja inferior y modal.
//
//   createOverlay(ctx, { panel, backdrop, dismissible, ignoreBackdropMs, initialFocus, onOpen, onClose })
//     → { open(), close(reason), isOpen(), destroy() }
//
// Garantías (con prueba):
//   · Foco atrapado: Tab y Mayús+Tab ciclan dentro del panel; al cerrar el foco vuelve a quien abrió.
//   · Esc cierra SOLO la capa de arriba (si hay una hoja y un modal encima, Esc cierra el modal).
//   · El toque sobre el fondo oscuro se ignora durante `ignoreBackdropMs` (300 ms) tras abrir: el segundo toque
//     rápido sobre el botón que abrió la hoja cae sobre el fondo y ya no la cierra (aviso de 0.3/0.4).
//   · Bloqueo de scroll del fondo (clase no-scroll) con contador: varias capas, un solo bloqueo.
//   · close() es idempotente; onClose se llama una vez por cierre con el motivo ('escape'|'backdrop'|'button'|…).
import { contains, focusables } from './_shared.js';

const STATE = new WeakMap(); // documento → { stack: [], locks: 0 }

function stateOf(doc) {
  let s = STATE.get(doc);
  if (!s) {
    s = { stack: [], locks: 0 };
    STATE.set(doc, s);
  }
  return s;
}

function lockScroll(doc, st) {
  st.locks += 1;
  doc.documentElement.classList.add('no-scroll');
  doc.body.classList.add('no-scroll');
}

function unlockScroll(doc, st) {
  st.locks = Math.max(0, st.locks - 1);
  if (st.locks === 0) {
    doc.documentElement.classList.remove('no-scroll');
    doc.body.classList.remove('no-scroll');
  }
}

export function createOverlay(ctx, { panel, backdrop, dismissible = true, ignoreBackdropMs = 300, initialFocus, onOpen, onClose }) {
  const { doc } = ctx;
  const st = stateOf(doc);
  const self = {};
  let isOpen = false;
  let openedAt = 0;
  let opener = null;
  let removeKey = () => {};

  function onKey(e) {
    if (st.stack[st.stack.length - 1] !== self) return;
    if (e.key === 'Escape') {
      if (dismissible) {
        e.preventDefault?.();
        close('escape');
      }
      return;
    }
    if (e.key !== 'Tab') return;
    const list = focusables(panel);
    if (list.length === 0) {
      e.preventDefault?.();
      panel.focus();
      return;
    }
    const first = list[0];
    const last = list[list.length - 1];
    const active = doc.activeElement;
    const inside = Boolean(active) && contains(panel, active);
    if (e.shiftKey) {
      if (!inside || active === first || active === panel) {
        e.preventDefault?.();
        last.focus();
      }
    } else if (!inside || active === last) {
      e.preventDefault?.();
      first.focus();
    }
  }

  ctx.listen(backdrop, 'click', () => {
    if (!isOpen || !dismissible) return;
    if (ctx.now() - openedAt < ignoreBackdropMs) return;
    close('backdrop');
  });

  function open() {
    if (isOpen || !ctx.alive) return false;
    isOpen = true;
    openedAt = ctx.now();
    opener = doc.activeElement ?? null;
    st.stack.push(self);
    lockScroll(doc, st);
    panel.classList.add('is-open');
    backdrop.classList.add('is-open');
    removeKey = ctx.listen(doc, 'keydown', onKey);
    const target = initialFocus?.() ?? panel;
    target.focus();
    onOpen?.();
    return true;
  }

  function close(reason = 'programmatic') {
    if (!isOpen) return false;
    isOpen = false;
    panel.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    removeKey();
    removeKey = () => {};
    const i = st.stack.indexOf(self);
    if (i !== -1) st.stack.splice(i, 1);
    unlockScroll(doc, st);
    if (opener && typeof opener.focus === 'function' && contains(doc.documentElement, opener)) opener.focus();
    opener = null;
    onClose?.(reason);
    return true;
  }

  self.open = open;
  self.close = close;
  self.isOpen = () => isOpen;
  self.destroy = () => close('destroy');
  return self;
}
