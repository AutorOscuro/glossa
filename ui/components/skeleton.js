// @purpose: Esqueleto de carga accesible que marca el sitio del contenido.
// Esqueleto de carga (subparte 0.5). Marca el sitio del contenido mientras llega; la animación se apaga con
// "reducir movimiento". Lleva role="status" y aria-busy, con un texto solo para lector de pantalla.
//
//   createSkeleton({ variant = 'text', lines = 3, label = 'Cargando', doc?, … }) → { el, destroy() }
//   variant: text (líneas) | card (bloque con título y líneas) | avatar (círculo) | block (rectángulo)
import { makeCtx, str, oneOf, num } from './_shared.js';
import { TEXT } from './_text.js';

export function createSkeleton(opts = {}) {
  const c = makeCtx('skeleton', opts);
  const variant = oneOf('skeleton', 'variant', opts.variant, ['text', 'card', 'avatar', 'block'], 'text');
  const lines = num('skeleton', 'lines', opts.lines, { min: 1, max: 20, integer: true, fallback: 3 });
  const label = str('skeleton', 'label', opts.label, { max: 120 }) ?? TEXT.loading;
  const { h } = c;

  const parts = [];
  if (variant === 'text' || variant === 'card') {
    if (variant === 'card') parts.push(h('div', { class: 'skeleton__shape skeleton__shape--title', 'aria-hidden': 'true' }));
    for (let i = 0; i < lines; i += 1) {
      parts.push(h('div', { class: ['skeleton__shape', 'skeleton__shape--line', i === lines - 1 && lines > 1 && 'skeleton__shape--short'], 'aria-hidden': 'true' }));
    }
  } else {
    parts.push(h('div', { class: ['skeleton__shape', variant === 'avatar' ? 'skeleton__shape--avatar' : 'skeleton__shape--block'], 'aria-hidden': 'true' }));
  }
  const el = h('div', { class: ['skeleton', `skeleton--${variant}`], role: 'status', 'aria-busy': 'true' },
    h('span', { class: 'sr-only' }, label), parts);

  let destroyed = false;
  return {
    el,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      c.dispose();
      el.remove();
    },
  };
}
