// @purpose: Control segmentado (radiogroup) para elegir una opción entre pocas.
// Control segmentado (subparte 0.5): elegir UNA opción entre pocas. Patrón ARIA radiogroup.
//
//   createSegmented({ label, options: [{ value, label, disabled? }], value?, disabled = false, error?,
//                     onChange?(valor, evento), doc?, … })
//     → { el, getValue(), setValue(v), setDisabled(b), setError(texto|null), destroy() }
//   · Teclado: flechas mueven y seleccionan, Inicio/Fin saltan al primero/último, Tab entra al elegido (tabindex itinerante).
//   · Opciones deshabilitadas se saltan. Valores únicos (si no, lanza error). 2–8 opciones.
//   · El texto largo se ajusta a varias líneas dentro de cada segmento.
import { makeCtx, str, flag, fn, fail, rovingKeys, setFlag } from './_shared.js';

export function createSegmented(opts = {}) {
  const c = makeCtx('segmented', opts);
  const label = str('segmented', 'label', opts.label, { required: true, max: 300 });
  const onChange = fn('segmented', 'onChange', opts.onChange);
  if (!Array.isArray(opts.options) || opts.options.length < 2 || opts.options.length > 8) fail('segmented', '"options" debe tener entre 2 y 8 opciones');
  const seen = new Set();
  const options = opts.options.map((o, i) => {
    if (o === null || typeof o !== 'object') fail('segmented', `options[${i}] debe ser un objeto { value, label }`);
    const value = str('segmented', `options[${i}].value`, o.value, { required: true, max: 120 });
    if (seen.has(value)) fail('segmented', `el valor "${value}" está repetido`);
    seen.add(value);
    return { value, label: str('segmented', `options[${i}].label`, o.label, { required: true, max: 120 }), disabled: flag('segmented', `options[${i}].disabled`, o.disabled) };
  });
  const state = { value: null, disabled: flag('segmented', 'disabled', opts.disabled), error: null };
  if (opts.value !== undefined && opts.value !== null) {
    state.value = str('segmented', 'value', opts.value, { required: true, max: 120 });
    if (!seen.has(state.value)) fail('segmented', `"value" (${state.value}) no está en las opciones`);
  }
  const { h } = c;

  const buttons = options.map((o) => h('button', { type: 'button', class: 'segmented__item', role: 'radio', 'data-value': o.value }, o.label));
  const group = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label }, buttons);
  const errorEl = h('p', { class: 'field__error', role: 'alert' });
  const el = h('div', { class: 'segmented-field' }, group, errorEl);

  const enabled = () => buttons.filter((b, i) => !options[i].disabled && !state.disabled);

  function paint() {
    // Un único elemento entra por Tab: el elegido, o el primero habilitado si aún no hay elección.
    const tabStop = state.value !== null ? buttons[options.findIndex((o) => o.value === state.value)] : enabled()[0];
    buttons.forEach((b, i) => {
      const on = options[i].value === state.value;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.setAttribute('tabindex', b === tabStop ? '0' : '-1');
      if (options[i].disabled || state.disabled) b.setAttribute('disabled', '');
      else b.removeAttribute('disabled');
    });
    setFlag(el, 'field--error', state.error !== null);
    errorEl.textContent = state.error ?? '';
  }
  paint();

  function select(button, e) {
    const i = buttons.indexOf(button);
    if (i === -1 || options[i].disabled || state.disabled) return;
    if (state.value === options[i].value) return;
    state.value = options[i].value;
    paint();
    button.focus();
    onChange?.(state.value, e);
  }

  buttons.forEach((b) => c.listen(b, 'click', (e) => select(b, e)));
  rovingKeys(c, group, enabled, (b) => select(b, null));

  let destroyed = false;
  return {
    el,
    getValue: () => state.value,
    setValue(v) {
      const value = str('segmented', 'value', v, { required: true, max: 120 });
      if (!seen.has(value)) fail('segmented', `"${value}" no está en las opciones`);
      state.value = value;
      paint();
    },
    setDisabled(on) {
      state.disabled = flag('segmented', 'disabled', on);
      paint();
    },
    setError(message) {
      state.error = message === null || message === undefined || message === '' ? null : str('segmented', 'error', message, { required: true, max: 500 });
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
