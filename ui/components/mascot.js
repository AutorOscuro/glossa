// Mascota "Chispa" (subparte 0.5): una criatura redonda con antena, dibujada en SVG ORIGINAL (sin imágenes externas).
// Los colores salen de variables del tema (--accent, --on-accent, --accent-2), así cambia con Aurora/Neo/Claro.
//
//   createMascot({ state = 'neutral', size = 'md', label?, doc?, win?, … })
//     → { el, setState(estado), getState(), destroy() }
//   state: neutral | happy | thinking · size: sm | md | lg
//   · label presente → role="img" con ese nombre; sin label es decorativa (aria-hidden).
//   · Movimiento: neutral flota suave, happy salta una vez, thinking hace pulsar los puntos. Con
//     prefers-reduced-motion: reduce (leído con matchMedia y también apagado por CSS) la mascota queda quieta.
import { makeCtx, oneOf, str, setFlag } from './_shared.js';

export const MASCOT_STATES = ['neutral', 'happy', 'thinking'];

export function createMascot(opts = {}) {
  const c = makeCtx('mascot', opts);
  const state = { value: oneOf('mascot', 'state', opts.state, MASCOT_STATES, 'neutral') };
  const size = oneOf('mascot', 'size', opts.size, ['sm', 'md', 'lg'], 'md');
  const label = str('mascot', 'label', opts.label, { max: 120 });
  const { hs } = c;

  const stroke = { class: 'mascot__line' };
  const faces = [
    hs('g', { class: 'mascot__face mascot__face--neutral' },
      hs('circle', { class: 'mascot__eye', cx: '24', cy: '34', r: '2.8' }),
      hs('circle', { class: 'mascot__eye', cx: '40', cy: '34', r: '2.8' }),
      hs('path', { ...stroke, d: 'M26 44 Q32 48 38 44' })),
    hs('g', { class: 'mascot__face mascot__face--happy' },
      hs('path', { ...stroke, d: 'M20 35 Q24 28 28 35' }),
      hs('path', { ...stroke, d: 'M36 35 Q40 28 44 35' }),
      hs('path', { class: 'mascot__mouth', d: 'M24 42 Q32 55 40 42 Z' })),
    hs('g', { class: 'mascot__face mascot__face--thinking' },
      hs('circle', { class: 'mascot__eye', cx: '26', cy: '32', r: '2.8' }),
      hs('circle', { class: 'mascot__eye', cx: '42', cy: '32', r: '2.8' }),
      hs('path', { ...stroke, d: 'M21 26 L29 24' }),
      hs('path', { ...stroke, d: 'M29 45 L37 44' }),
      hs('circle', { class: 'mascot__dot mascot__dot--1', cx: '53', cy: '14', r: '2' }),
      hs('circle', { class: 'mascot__dot mascot__dot--2', cx: '58', cy: '8', r: '2.6' })),
  ];
  const el = hs('svg', {
    class: ['mascot', `mascot--${size}`],
    viewBox: '0 0 64 64',
    focusable: 'false',
    role: label ? 'img' : null,
    'aria-label': label ?? null,
    'aria-hidden': label ? null : 'true',
    'data-state': state.value,
  },
  hs('line', { class: 'mascot__antenna', x1: '32', y1: '14', x2: '32', y2: '6' }),
  hs('circle', { class: 'mascot__bulb', cx: '32', cy: '5', r: '3.4' }),
  hs('ellipse', { class: 'mascot__foot', cx: '22', cy: '58', rx: '7', ry: '3.2' }),
  hs('ellipse', { class: 'mascot__foot', cx: '42', cy: '58', rx: '7', ry: '3.2' }),
  hs('ellipse', { class: 'mascot__body', cx: '32', cy: '36', rx: '25', ry: '22' }),
  faces);

  // Movimiento reducido: lo lee el JS (clase is-still) y además lo apaga el CSS.
  let mql = null;
  const applyMotion = () => setFlag(el, 'is-still', Boolean(mql?.matches));
  try {
    mql = c.win?.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
  } catch (error) {
    console.error('mascot: no se pudo leer prefers-reduced-motion', error);
  }
  applyMotion();
  if (mql && typeof mql.addEventListener === 'function') c.listen(mql, 'change', applyMotion);

  let destroyed = false;
  let replay = 0;
  return {
    el,
    getState: () => state.value,
    setState(next) {
      state.value = oneOf('mascot', 'state', next, MASCOT_STATES, 'neutral');
      el.setAttribute('data-state', state.value);
      // Reinicia el salto de "happy" aunque ya estuviera en ese estado: alterna entre dos animaciones gemelas.
      replay = 1 - replay;
      el.classList.remove('hop-0', 'hop-1');
      if (state.value === 'happy') el.classList.add(`hop-${replay}`);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      c.dispose();
      el.remove();
    },
  };
}
