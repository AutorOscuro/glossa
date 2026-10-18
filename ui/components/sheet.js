// Hoja inferior (subparte 0.5). Usa las clases .sheet-backdrop / .sheet de components.css (0.3).
//
//   createSheet({ title, children?, dismissible = true, closeLabel?, container = document.body,
//                 ignoreBackdropMs = 300, onOpen?, onClose?(motivo), doc?, win?, timers?, now? })
//     → { el, backdrop, body, open(), close(), isOpen(), setContent(...hijos), destroy() }
//
//   · role="dialog" aria-modal, título enlazado con aria-labelledby, foco atrapado, Esc cierra, el foco vuelve al botón que abrió.
//   · Arrastre: se cierra tirando hacia abajo desde el asa (decide dragDecision, pura y probada). No es la única vía:
//     siempre hay botón "Cerrar", Esc y toque en el fondo.
//   · Los hijos son texto o nodos (nunca HTML en cadena).
import { makeCtx, str, flag, fn, uid, toNodes } from './_shared.js';
import { createOverlay } from './_overlay.js';
import { TEXT } from './_text.js';

export const DRAG = Object.freeze({ distance: 96, fraction: 0.3, velocity: 0.5, minDistance: 40 });

// ¿Se cierra la hoja al soltar? dy = píxeles arrastrados hacia abajo; ms = duración; height = alto de la hoja.
export function dragDecision({ dy, ms, height }) {
  if (!(dy > 0)) return false;
  const limit = Math.min(DRAG.distance, (Number.isFinite(height) && height > 0 ? height : Infinity) * DRAG.fraction);
  if (dy >= limit) return true;
  const speed = ms > 0 ? dy / ms : Infinity;
  return dy >= DRAG.minDistance && speed >= DRAG.velocity;
}

export function createSheet(opts = {}) {
  const c = makeCtx('sheet', opts);
  const title = str('sheet', 'title', opts.title, { required: true, max: 200 });
  const dismissible = flag('sheet', 'dismissible', opts.dismissible, true);
  const onClose = fn('sheet', 'onClose', opts.onClose);
  const onOpen = fn('sheet', 'onOpen', opts.onOpen);
  const closeLabel = str('sheet', 'closeLabel', opts.closeLabel, { max: 60 }) ?? TEXT.close;
  const container = opts.container ?? c.doc.body;
  const { h } = c;
  const titleId = uid('sheet-title');

  const backdrop = h('div', { class: 'sheet-backdrop', 'aria-hidden': 'true' });
  const grab = h('div', { class: 'sheet__grab' }, h('div', { class: 'sheet__handle', 'aria-hidden': 'true' }));
  const closeBtn = dismissible
    ? h('button', { type: 'button', class: 'btn btn--ghost btn--icon', 'aria-label': closeLabel }, '✕')
    : null;
  const header = h('div', { class: 'sheet__header' }, h('h2', { class: 'sheet__title', id: titleId }, title), closeBtn);
  const body = h('div', { class: 'sheet__body' }, toNodes(c, 'sheet', opts.children));
  const panel = h('section', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, tabindex: '-1' },
    dismissible ? grab : null, header, body);

  container.appendChild(backdrop);
  container.appendChild(panel);

  const overlay = createOverlay(c, {
    panel,
    backdrop,
    dismissible,
    ignoreBackdropMs: opts.ignoreBackdropMs ?? 300,
    initialFocus: () => closeBtn ?? panel,
    onOpen,
    onClose: (reason) => {
      panel.style.setProperty('--drag-y', '0px');
      panel.classList.remove('is-dragging');
      onClose?.(reason);
    },
  });

  if (closeBtn) c.listen(closeBtn, 'click', () => overlay.close('button'));

  // ----- arrastre desde el asa -----
  if (dismissible) {
    let drag = null;
    c.listen(grab, 'pointerdown', (e) => {
      if (!overlay.isOpen() || drag) return;
      drag = { id: e.pointerId, y0: e.clientY, t0: c.now(), dy: 0 };
      panel.classList.add('is-dragging');
      try {
        grab.setPointerCapture?.(e.pointerId);
      } catch (error) {
        console.error('sheet: no se pudo capturar el puntero', error);
      }
    });
    c.listen(grab, 'pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag.dy = Math.max(0, e.clientY - drag.y0);
      panel.style.setProperty('--drag-y', `${Math.round(drag.dy)}px`);
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const result = { dy: drag.dy, ms: c.now() - drag.t0, height: panel.offsetHeight };
      drag = null;
      panel.classList.remove('is-dragging');
      if (e.type === 'pointerup' && dragDecision(result)) overlay.close('drag');
      else panel.style.setProperty('--drag-y', '0px');
    };
    c.listen(grab, 'pointerup', end);
    c.listen(grab, 'pointercancel', end);
  }

  let destroyed = false;
  return {
    el: panel,
    backdrop,
    body,
    open: () => overlay.open(),
    close: () => overlay.close('programmatic'),
    isOpen: () => overlay.isOpen(),
    setContent(...children) {
      body.replaceChildren(...toNodes(c, 'sheet', children));
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      overlay.destroy();
      c.dispose();
      panel.remove();
      backdrop.remove();
    },
  };
}
