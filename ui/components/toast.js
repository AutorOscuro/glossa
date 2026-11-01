// @purpose: Avisos temporales apilados (toasts).
// Avisos temporales (subparte 0.4). Usa las clases .toast-stack / .toast de components.css (0.3).
//
//   createToaster({ doc?, container, max = 3, duration = 4000, timers? }) → { show, dismissAll, destroy }
//   show(kind, message, { duration? }) → elemento.   kind: 'info' | 'success' | 'danger'
//   - El mensaje entra como TEXTO (nunca HTML).
//   - Máximo `max` a la vez: el más viejo se retira. Tocar un aviso lo cierra.
//   - 'danger' usa role="alert"; los demás role="status". El icono distingue el tipo sin depender del color.
//   - timers = { setTimeout, clearTimeout } inyectables para pruebas.
import { h as domH } from '../dom.js';

const ICONS = { info: 'i', success: '✓', danger: '!' };

export function createToaster({ doc = globalThis.document, container, max = 3, duration = 4000, timers } = {}) {
  if (!container) throw new Error('createToaster: falta el contenedor');
  const { h } = domH.with(doc);
  const setT = timers?.setTimeout ?? ((fn, ms) => setTimeout(fn, ms));
  const clearT = timers?.clearTimeout ?? ((id) => clearTimeout(id));
  const live = new Map(); // elemento → { id del temporizador, manejador de clic }

  const remove = (el) => {
    const entry = live.get(el);
    if (!entry) return;
    clearT(entry.timer);
    el.removeEventListener('click', entry.onClick);
    live.delete(el);
    el.remove();
  };

  return {
    show(kind, message, opts = {}) {
      const k = Object.hasOwn(ICONS, kind) ? kind : 'info';
      while (live.size >= max) remove(live.keys().next().value);
      const el = h('div', { class: `toast toast--${k}`, role: k === 'danger' ? 'alert' : 'status' },
        h('span', { class: 'toast__icon', 'aria-hidden': 'true' }, ICONS[k]),
        h('span', { class: 'grow' }, String(message ?? '')),
      );
      const onClick = () => remove(el);
      el.addEventListener('click', onClick);
      container.appendChild(el);
      live.set(el, { timer: setT(() => remove(el), opts.duration ?? duration), onClick });
      return el;
    },
    dismissAll() {
      for (const el of [...live.keys()]) remove(el);
    },
    destroy() {
      this.dismissAll();
    },
  };
}
