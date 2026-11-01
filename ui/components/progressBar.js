// @purpose: Barra de progreso con ranura para la mascota.
// Barra de progreso con ranura para la mascota (subparte 0.5). Usa .progress / .progress__bar de components.css.
//
//   createProgressBar({ label, value = 0, max = 100, current?, total?, variant = 'accent', thin = false,
//                       showText = false, text?, mascot?, indeterminate = false, error = false, doc?, … })
//     → { el, setValue(v), setSteps(actual, total), setMascot(nodo|null), setIndeterminate(b), setError(b),
//         getValue(), destroy() }
//   · label (obligatorio): nombre accesible. role="progressbar" con aria-valuenow/min/max y aria-valuetext.
//   · Modo pasos (current/total, p. ej. sesión "7/20"): el porcentaje sale de current/total y el texto es "7/20".
//   · mascot: un nodo (p. ej. createMascot().el) que viaja sobre la barra siguiendo el avance. Es decorativo.
//   · indeterminate: animación sin valor (aria-valuenow se quita). error: variante de peligro (solo errores de interfaz).
//   · El ancho se fija con la variable CSS --value (CSSOM): compatible con la CSP.
import { makeCtx, str, oneOf, flag, num, fail, setFlag, setAttr, isNode } from './_shared.js';

const VARIANTS = ['accent', 'accent-2', 'info', 'success'];

export function createProgressBar(opts = {}) {
  const c = makeCtx('progressBar', opts);
  const label = str('progressBar', 'label', opts.label, { required: true, max: 200 });
  const variant = oneOf('progressBar', 'variant', opts.variant, VARIANTS, 'accent');
  const thin = flag('progressBar', 'thin', opts.thin);
  const showText = flag('progressBar', 'showText', opts.showText);
  const customText = str('progressBar', 'text', opts.text, { max: 60 });
  const state = { max: num('progressBar', 'max', opts.max, { min: 1, fallback: 100 }), value: 0, steps: null, indeterminate: flag('progressBar', 'indeterminate', opts.indeterminate), error: flag('progressBar', 'error', opts.error) };
  const { h } = c;

  const bar = h('div', { class: 'progress__bar' });
  const track = h('div', {
    class: ['progress', variant !== 'accent' && `progress--${variant}`, thin && 'progress--thin'],
    role: 'progressbar', 'aria-label': label, 'aria-valuemin': '0',
  }, bar);
  const mascotSlot = h('div', { class: 'progress-bar__mascot', 'aria-hidden': 'true' });
  const textEl = h('span', { class: 'progress-bar__text' });
  const trackWrap = h('div', { class: 'progress-bar__track' }, track, mascotSlot);
  const el = h('div', { class: 'progress-bar' }, trackWrap, showText ? textEl : null);

  function paint() {
    const pct = state.steps ? (state.steps.current / state.steps.total) * 100 : (state.value / state.max) * 100;
    const clamped = Math.min(100, Math.max(0, pct));
    el.style.setProperty('--value', String(Math.round(clamped * 10) / 10));
    const shown = state.steps ? state.steps.current : state.value;
    const outOf = state.steps ? state.steps.total : state.max;
    const text = customText ?? (state.steps ? `${shown}/${outOf}` : `${Math.round(clamped)} %`);
    if (state.indeterminate) {
      track.removeAttribute('aria-valuenow');
      track.removeAttribute('aria-valuetext');
    } else {
      track.setAttribute('aria-valuenow', String(shown));
      track.setAttribute('aria-valuetext', state.steps ? `${shown} de ${outOf}` : `${Math.round(clamped)} %`);
    }
    track.setAttribute('aria-valuemax', String(outOf));
    textEl.textContent = state.indeterminate ? '' : text;
    setFlag(el, 'progress-bar--indeterminate', state.indeterminate);
    setFlag(track, 'progress--danger', state.error);
    setAttr(track, 'aria-invalid', state.error ? true : null);
  }

  function setMascot(node) {
    if (node !== null && node !== undefined && !isNode(node)) fail('progressBar', '"mascot" debe ser un nodo del DOM o null');
    mascotSlot.replaceChildren(...(node ? [node] : []));
    setFlag(el, 'progress-bar--has-mascot', Boolean(node));
  }

  const initialSteps = opts.total !== undefined || opts.current !== undefined;
  if (initialSteps) {
    const total = num('progressBar', 'total', opts.total, { min: 1, integer: true });
    if (total === undefined) fail('progressBar', '"current" necesita también "total"');
    state.steps = { total, current: num('progressBar', 'current', opts.current, { min: 0, max: total, integer: true, fallback: 0 }) };
  } else {
    state.value = num('progressBar', 'value', opts.value, { min: 0, max: state.max, fallback: 0 });
  }
  if (opts.mascot !== undefined) setMascot(opts.mascot);
  paint();

  let destroyed = false;
  return {
    el,
    getValue: () => (state.steps ? state.steps.current : state.value),
    setValue(v) {
      state.steps = null;
      state.value = num('progressBar', 'value', v, { min: 0, max: state.max, fallback: 0 });
      paint();
    },
    setSteps(current, total) {
      const t = num('progressBar', 'total', total, { min: 1, integer: true });
      if (t === undefined) fail('progressBar', 'setSteps necesita "total"');
      state.steps = { total: t, current: num('progressBar', 'current', current, { min: 0, max: t, integer: true, fallback: 0 }) };
      paint();
    },
    setMascot,
    setIndeterminate(on) {
      state.indeterminate = flag('progressBar', 'indeterminate', on);
      paint();
    },
    setError(on) {
      state.error = flag('progressBar', 'error', on);
      paint();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      c.dispose();
      el.remove();
    },
  };
}
