// Chip elegible (subparte 0.5). Usa .chip de components.css. Es un <button>; si es elegible lleva aria-pressed.
//
//   createChip({ label, selected = false, selectable = true, disabled = false, truncate = false, icon?,
//                onChange?(seleccionado, evento), onPress?(evento), doc?, … })
//     → { el, isSelected(), setSelected(b), setDisabled(b), setLabel(texto), destroy() }
//   selectable: true → alterna y llama onChange · false → chip de acción: solo llama onPress (sin aria-pressed).
//   truncate: una línea con "…" y el texto completo en title. Por defecto el texto largo se ajusta a varias líneas.
// Si solo es una etiqueta que no se toca, usa createBadge.
import { makeCtx, str, flag, fn } from './_shared.js';

export function createChip(opts = {}) {
  const c = makeCtx('chip', opts);
  const label = str('chip', 'label', opts.label, { required: true, max: 300 });
  const selectable = flag('chip', 'selectable', opts.selectable, true);
  const truncate = flag('chip', 'truncate', opts.truncate);
  const icon = str('chip', 'icon', opts.icon, { max: 8 });
  const onChange = fn('chip', 'onChange', opts.onChange);
  const onPress = fn('chip', 'onPress', opts.onPress);
  const state = { selected: flag('chip', 'selected', opts.selected), disabled: flag('chip', 'disabled', opts.disabled) };

  const labelEl = c.h('span', { class: 'chip__label' }, label);
  const el = c.h('button', { type: 'button', class: ['chip', truncate && 'chip--truncate'], title: truncate ? label : null },
    icon ? c.h('span', { 'aria-hidden': 'true' }, icon) : null, labelEl);

  function paint() {
    if (selectable) el.setAttribute('aria-pressed', state.selected ? 'true' : 'false');
    if (state.disabled) el.setAttribute('disabled', '');
    else el.removeAttribute('disabled');
  }
  paint();

  c.listen(el, 'click', (e) => {
    if (state.disabled) return;
    if (selectable) {
      state.selected = !state.selected;
      paint();
      onChange?.(state.selected, e);
    } else {
      onPress?.(e);
    }
  });

  let destroyed = false;
  return {
    el,
    isSelected: () => state.selected,
    setSelected(on) {
      state.selected = flag('chip', 'selected', on);
      paint();
    },
    setDisabled(on) {
      state.disabled = flag('chip', 'disabled', on);
      paint();
    },
    setLabel(text) {
      const t = str('chip', 'label', text, { required: true, max: 300 });
      labelEl.textContent = t;
      if (truncate) el.setAttribute('title', t);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      c.dispose();
      el.remove();
    },
  };
}
