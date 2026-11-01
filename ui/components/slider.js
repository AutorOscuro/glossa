// @purpose: Deslizador accesible (range nativo) con etiqueta, valor visible y relleno.
// Deslizador (subparte 0.5): <input type="range"> nativo (teclado y lector de pantalla gratis) con etiqueta,
// valor visible y relleno de color. Sirve para tiempo disponible, retención objetivo, tope diario, etc.
//
//   createSlider({ label, min = 0, max = 100, step = 1, value?, unit = '', stops?, format?, hint?,
//                  disabled = false, error?, onInput?(valor), onChange?(valor), doc?, … })
//     → { el, input, getValue(), setValue(v), setDisabled(b), setError(texto|null), destroy() }
//   · stops: [{ value, label }] (2–12, valores ascendentes y únicos) para saltos discretos con etiqueta propia, p. ej.
//     15/30/45/60/90/120 min/"más". getValue() devuelve el `value` real del salto, no su posición.
//   · onInput se llama mientras se arrastra; onChange al soltar. El valor siempre queda dentro de [min, max] y en
//     múltiplos de `step` (funciones puras clampValue/snapValue, probadas).
//   · format(valor) → texto mostrado y leído (aria-valuetext).
import { makeCtx, str, flag, num, fn, fail, uid, setAttr, setFlag } from './_shared.js';

export function clampValue(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

const decimals = (n) => (String(n).includes('.') ? String(n).split('.')[1].length : 0);

export function snapValue(v, min, max, step) {
  const snapped = min + Math.round((v - min) / step) * step;
  return Number(clampValue(snapped, min, max).toFixed(Math.max(decimals(step), decimals(min))));
}

export function createSlider(opts = {}) {
  const c = makeCtx('slider', opts);
  const label = str('slider', 'label', opts.label, { required: true, max: 300 });
  const hint = str('slider', 'hint', opts.hint, { max: 600 });
  const unit = str('slider', 'unit', opts.unit, { max: 20 }) ?? '';
  const format = fn('slider', 'format', opts.format);
  const onInput = fn('slider', 'onInput', opts.onInput);
  const onChange = fn('slider', 'onChange', opts.onChange);
  const state = { disabled: flag('slider', 'disabled', opts.disabled), error: null };

  let stops = null;
  let min;
  let max;
  let step;
  if (opts.stops !== undefined && opts.stops !== null) {
    if (!Array.isArray(opts.stops) || opts.stops.length < 2 || opts.stops.length > 12) fail('slider', '"stops" debe tener entre 2 y 12 saltos');
    stops = opts.stops.map((s, i) => {
      if (s === null || typeof s !== 'object') fail('slider', `stops[${i}] debe ser { value, label }`);
      return { value: num('slider', `stops[${i}].value`, s.value, { fallback: undefined }), label: str('slider', `stops[${i}].label`, s.label, { required: true, max: 40 }) };
    });
    stops.forEach((s, i) => {
      if (s.value === undefined) fail('slider', `stops[${i}] necesita "value" numérico`);
      if (i > 0 && !(s.value > stops[i - 1].value)) fail('slider', 'los "stops" deben tener valores únicos y ascendentes');
    });
    min = 0;
    max = stops.length - 1;
    step = 1;
  } else {
    min = num('slider', 'min', opts.min, { fallback: 0 });
    max = num('slider', 'max', opts.max, { fallback: 100 });
    step = num('slider', 'step', opts.step, { fallback: 1 });
    if (!(max > min)) fail('slider', '"max" debe ser mayor que "min"');
    if (!(step > 0)) fail('slider', '"step" debe ser mayor que 0');
  }

  // pos = posición del control (índice en modo stops; valor real en modo numérico)
  const posOfValue = (v) => {
    if (stops) {
      const i = stops.findIndex((s) => s.value === v);
      if (i === -1) fail('slider', `el valor ${v} no es uno de los saltos (${stops.map((s) => s.value).join(', ')})`);
      return i;
    }
    return snapValue(num('slider', 'value', v, { fallback: min }), min, max, step);
  };
  const valueOfPos = (p) => (stops ? stops[p].value : p);
  let pos = opts.value === undefined || opts.value === null ? min : posOfValue(opts.value);
  if (stops && (opts.value === undefined || opts.value === null)) pos = 0;

  const textOf = (p) => (format ? String(format(valueOfPos(p))) : stops ? stops[p].label : `${p}${unit}`);

  const id = uid('slider');
  const hintId = `${id}-hint`;
  const errId = `${id}-error`;
  const { h } = c;
  const input = h('input', { id, class: 'slider__input', type: 'range', min: String(min), max: String(max), step: String(step), 'aria-labelledby': `${id}-label` });
  input.value = String(pos);
  const valueEl = h('output', { class: 'slider__value', for: id, 'aria-hidden': 'true' });
  const hintEl = hint ? h('p', { class: 'field__hint', id: hintId }, hint) : null;
  const errorEl = h('p', { class: 'field__error', id: errId, 'aria-live': 'polite' });
  const el = h('div', { class: 'slider' },
    h('div', { class: 'slider__head' }, h('label', { class: 'field__label', id: `${id}-label`, for: id }, label), valueEl),
    input, hintEl, errorEl);

  function paint() {
    const pct = ((pos - min) / (max - min)) * 100;
    el.style.setProperty('--pct', String(Math.round(pct * 10) / 10));
    valueEl.textContent = textOf(pos);
    input.setAttribute('aria-valuetext', textOf(pos));
    if (state.disabled) input.setAttribute('disabled', '');
    else input.removeAttribute('disabled');
    setAttr(input, 'aria-invalid', state.error !== null ? true : null);
    setAttr(input, 'aria-describedby', [hintEl && hintId, state.error !== null && errId].filter(Boolean).join(' ') || null);
    setFlag(el, 'field--error', state.error !== null);
    errorEl.textContent = state.error ?? '';
  }
  if (opts.error) state.error = str('slider', 'error', opts.error, { required: true, max: 500 });
  paint();

  const read = () => {
    const raw = Number(input.value);
    if (Number.isFinite(raw)) pos = stops ? Math.round(clampValue(raw, min, max)) : snapValue(raw, min, max, step);
    paint();
    return valueOfPos(pos);
  };
  // read() va ANTES: el valor y el relleno se actualizan aunque no haya callback.
  c.listen(input, 'input', () => {
    const v = read();
    onInput?.(v);
  });
  c.listen(input, 'change', () => {
    const v = read();
    onChange?.(v);
  });

  let destroyed = false;
  return {
    el,
    input,
    getValue: () => valueOfPos(pos),
    setValue(v) {
      pos = posOfValue(v);
      input.value = String(pos);
      paint();
    },
    setDisabled(on) {
      state.disabled = flag('slider', 'disabled', on);
      paint();
    },
    setError(message) {
      state.error = message === null || message === undefined || message === '' ? null : str('slider', 'error', message, { required: true, max: 500 });
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
