// Interruptor (subparte 0.5): <button role="switch" aria-checked>. Toda la fila es el objetivo táctil (≥ 44 px).
//
//   createToggle({ label, description?, checked = false, disabled = false, loading = false, error?,
//                  onChange?(checked, evento), doc?, … })
//     → { el, button, isChecked(), setChecked(b), setDisabled(b), setLoading(b), setError(texto|null), destroy() }
//   Estados: apagado / encendido · foco · pulsado · deshabilitado · cargando (ignora toques, aria-busy) · error
//   (mensaje bajo la fila, anunciado). El nombre accesible es la etiqueta; la descripción va en aria-describedby.
import { makeCtx, str, flag, fn, uid, setAttr, setFlag } from './_shared.js';

export function createToggle(opts = {}) {
  const c = makeCtx('toggle', opts);
  const label = str('toggle', 'label', opts.label, { required: true, max: 300 });
  const description = str('toggle', 'description', opts.description, { max: 600 });
  const onChange = fn('toggle', 'onChange', opts.onChange);
  const state = { checked: flag('toggle', 'checked', opts.checked), disabled: flag('toggle', 'disabled', opts.disabled), loading: flag('toggle', 'loading', opts.loading), error: null };
  const id = uid('toggle');
  const { h } = c;

  const thumb = h('span', { class: 'toggle__thumb' });
  const button = h('button', {
    type: 'button', class: 'toggle', role: 'switch', 'aria-labelledby': `${id}-label`, 'aria-describedby': description ? `${id}-desc` : null,
  },
  h('span', { class: 'toggle__text' },
    h('span', { class: 'toggle__label', id: `${id}-label` }, label),
    description ? h('span', { class: 'toggle__desc', id: `${id}-desc` }, description) : null),
  h('span', { class: 'toggle__track', 'aria-hidden': 'true' }, thumb));
  const errorEl = h('p', { class: 'field__error', role: 'alert' });
  const el = h('div', { class: 'toggle-field' }, button, errorEl);

  function paint() {
    button.setAttribute('aria-checked', state.checked ? 'true' : 'false');
    if (state.disabled) button.setAttribute('disabled', '');
    else button.removeAttribute('disabled');
    setAttr(button, 'aria-busy', state.loading ? true : null);
    setFlag(button, 'is-loading', state.loading);
    setFlag(el, 'field--error', state.error !== null);
    errorEl.textContent = state.error ?? '';
  }
  if (opts.error) state.error = str('toggle', 'error', opts.error, { required: true, max: 500 });
  paint();

  c.listen(button, 'click', (e) => {
    if (state.disabled || state.loading) return;
    state.checked = !state.checked;
    paint();
    onChange?.(state.checked, e);
  });

  let destroyed = false;
  return {
    el,
    button,
    isChecked: () => state.checked,
    setChecked(on) {
      state.checked = flag('toggle', 'checked', on);
      paint();
    },
    setDisabled(on) {
      state.disabled = flag('toggle', 'disabled', on);
      paint();
    },
    setLoading(on) {
      state.loading = flag('toggle', 'loading', on);
      paint();
    },
    setError(message) {
      state.error = message === null || message === undefined || message === '' ? null : str('toggle', 'error', message, { required: true, max: 500 });
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
