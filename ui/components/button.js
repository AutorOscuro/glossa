// Botón (subparte 0.5). Usa .btn de components.css (0.3). Siempre es un <button> real.
//
//   createButton({ label?, ariaLabel?, icon?, variant = 'secondary', size = 'md', block = false, type = 'button',
//                  disabled = false, loading = false, lockMs = 0, busyWhilePending = false, onClick?(evento) , doc?, … })
//     → { el, setLoading(b), setDisabled(b), setLabel(texto), isBusy(), focus(), destroy() }
//   variant: primary | secondary | danger | ghost · size: md | lg.  Sin label, exige ariaLabel (botón de solo icono).
//
// Estados: normal · foco/hover (CSS) · pulsado (CSS) · deshabilitado (atributo disabled) · cargando (aria-busy, no se
// pierde el foco, los toques se ignoran) · error = variante "danger" (el rojo se reserva para errores de interfaz).
//   · lockMs > 0: ignora toques repetidos durante ese tiempo (doble toque rápido).
//   · busyWhilePending: si onClick devuelve una promesa, el botón queda "cargando" hasta que termine. Si la promesa
//     rechaza, el rechazo SE PROPAGA (lo recoge el manejador global de la 0.4); no se traga el error.
import { makeCtx, str, oneOf, flag, num, fn, fail, setFlag, setAttr } from './_shared.js';

export function createButton(opts = {}) {
  const c = makeCtx('button', opts);
  const variant = oneOf('button', 'variant', opts.variant, ['primary', 'secondary', 'danger', 'ghost'], 'secondary');
  const size = oneOf('button', 'size', opts.size, ['md', 'lg'], 'md');
  const type = oneOf('button', 'type', opts.type, ['button', 'submit', 'reset'], 'button');
  const block = flag('button', 'block', opts.block);
  const label = str('button', 'label', opts.label, { max: 300 });
  const icon = str('button', 'icon', opts.icon, { max: 8 });
  const ariaLabel = str('button', 'ariaLabel', opts.ariaLabel, { max: 200 });
  const lockMs = num('button', 'lockMs', opts.lockMs, { min: 0, max: 5000, fallback: 0 });
  const onClick = fn('button', 'onClick', opts.onClick);
  const busyWhilePending = flag('button', 'busyWhilePending', opts.busyWhilePending);
  if (!label && !ariaLabel) fail('button', 'necesita "label" o "ariaLabel" (nombre accesible)');
  if (!label && !icon) fail('button', 'un botón sin texto necesita "icon"');

  const state = { disabled: flag('button', 'disabled', opts.disabled), loading: flag('button', 'loading', opts.loading), lockedUntil: 0 };
  const labelEl = label ? c.h('span', { class: 'btn__label' }, label) : null;
  const el = c.h('button', {
    type,
    class: ['btn', `btn--${variant}`, size === 'lg' && 'btn--lg', block && 'btn--block', !label && 'btn--icon'],
    'aria-label': ariaLabel,
  },
  icon ? c.h('span', { class: 'btn__icon', 'aria-hidden': 'true' }, icon) : null,
  labelEl,
  c.h('span', { class: 'spinner', 'aria-hidden': 'true' }));

  function paint() {
    if (state.disabled) el.setAttribute('disabled', '');
    else el.removeAttribute('disabled');
    setFlag(el, 'is-loading', state.loading);
    setAttr(el, 'aria-busy', state.loading ? true : null);
    setAttr(el, 'aria-disabled', state.loading && !state.disabled ? true : null);
  }
  paint();

  function setLoading(on) {
    state.loading = flag('button', 'loading', on);
    paint();
  }

  c.listen(el, 'click', (e) => {
    if (state.disabled || state.loading) {
      e.preventDefault?.();
      return undefined;
    }
    if (lockMs > 0) {
      const t = c.now();
      if (t < state.lockedUntil) {
        e.preventDefault?.();
        return undefined;
      }
      state.lockedUntil = t + lockMs;
    }
    if (!onClick) return undefined;
    const result = onClick(e);
    if (busyWhilePending && result && typeof result.then === 'function') {
      setLoading(true);
      return result.finally(() => {
        if (c.alive) setLoading(false);
      });
    }
    return undefined;
  });

  let destroyed = false;
  return {
    el,
    setLoading,
    setDisabled(on) {
      state.disabled = flag('button', 'disabled', on);
      paint();
    },
    setLabel(text) {
      if (!labelEl) fail('button', 'este botón es de solo icono: no tiene texto que cambiar');
      labelEl.textContent = str('button', 'label', text, { required: true, max: 300 });
    },
    isBusy: () => state.loading,
    focus: () => el.focus(),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      c.dispose();
      el.remove();
    },
  };
}
