// Tarjeta (subparte 0.5). Usa .card de components.css (vidrio) y .card--flat.
//
//   createCard({ title?, meta?, children?, variant = 'glass', headingLevel = 3,
//                onPress? | href?, label?, disabled = false, loading = false, error?, doc?, … })
//     → { el, body, setChildren(...), setLoading(b), setError(texto|null), setDisabled(b), destroy() }
//   · Interactiva con onPress → role="button" + tabindex="0" + Enter/Espacio (no se mete un <button> alrededor de
//     contenido de bloque). Con href → <a>. No se permiten las dos a la vez. label = nombre accesible de la tarjeta.
//   · loading: muestra un esqueleto en lugar del contenido (aria-busy) y no responde a toques.
//   · error: mensaje visible (role="alert") en la tarjeta; el resto del contenido se conserva.
//   · Textos largos: se ajustan (sin recortar); nunca se desborda de la pantalla.
import { makeCtx, str, oneOf, flag, num, fn, fail, setFlag, setAttr, toNodes } from './_shared.js';
import { createSkeleton } from './skeleton.js';

export function createCard(opts = {}) {
  const c = makeCtx('card', opts);
  const title = str('card', 'title', opts.title, { max: 300 });
  const meta = str('card', 'meta', opts.meta, { max: 500 });
  const variant = oneOf('card', 'variant', opts.variant, ['glass', 'flat'], 'glass');
  const level = num('card', 'headingLevel', opts.headingLevel, { min: 2, max: 6, integer: true, fallback: 3 });
  const onPress = fn('card', 'onPress', opts.onPress);
  const href = str('card', 'href', opts.href, { max: 2000 });
  const label = str('card', 'label', opts.label, { max: 300 });
  if (onPress && href) fail('card', 'usa "onPress" o "href", no las dos');
  if ((onPress || href) && !title && !label) fail('card', 'una tarjeta interactiva necesita "title" o "label" (nombre accesible)');

  const state = { loading: flag('card', 'loading', opts.loading), disabled: flag('card', 'disabled', opts.disabled), error: null };
  const interactive = Boolean(onPress || href);
  const tag = href ? 'a' : 'div';
  const body = c.h('div', { class: 'card__body' });
  const header = title || meta
    ? c.h('div', { class: 'card__header' },
      title ? c.h(`h${level}`, { class: 'card__title' }, title) : null,
      meta ? c.h('p', { class: 'card__meta' }, meta) : null)
    : null;
  const errorEl = c.h('p', { class: 'card__error', role: 'alert', hidden: '' });
  const el = c.h(tag, {
    class: ['card', variant === 'flat' && 'card--flat', interactive && 'card--interactive'],
    href: href ?? null,
    role: onPress ? 'button' : null,
    tabindex: onPress ? '0' : null,
    'aria-label': label,
  }, header, body, errorEl);

  let kids = toNodes(c, 'card', opts.children);
  let skeleton = null;

  function render() {
    if (skeleton) {
      skeleton.destroy();
      skeleton = null;
    }
    if (state.loading) {
      skeleton = createSkeleton({ doc: c.doc, lines: 3 });
      body.replaceChildren(skeleton.el);
    } else {
      body.replaceChildren(...kids);
    }
    setAttr(el, 'aria-busy', state.loading ? true : null);
    setAttr(el, 'aria-disabled', state.disabled ? true : null);
    if (onPress) el.setAttribute('tabindex', state.disabled ? '-1' : '0');
    setFlag(el, 'is-loading', state.loading);
    setFlag(el, 'is-disabled', state.disabled);
    setFlag(el, 'card--error', state.error !== null);
    if (state.error !== null) {
      errorEl.textContent = state.error;
      errorEl.removeAttribute('hidden');
    } else {
      errorEl.textContent = '';
      errorEl.setAttribute('hidden', '');
    }
  }
  render();

  if (onPress) {
    const fire = (e) => {
      if (state.disabled || state.loading) return;
      onPress(e);
    };
    c.listen(el, 'click', fire);
    c.listen(el, 'keydown', (e) => {
      if (e.target !== el) return; // las teclas de un botón interior no activan la tarjeta
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault?.();
        fire(e);
      }
    });
  } else if (href) {
    c.listen(el, 'click', (e) => {
      if (state.disabled || state.loading) e.preventDefault?.();
    });
  }

  let destroyed = false;
  return {
    el,
    body,
    setChildren(...children) {
      kids = toNodes(c, 'card', children);
      render();
    },
    setLoading(on) {
      state.loading = flag('card', 'loading', on);
      render();
    },
    setError(message) {
      state.error = message === null || message === undefined ? null : str('card', 'error', message, { required: true, max: 500 });
      render();
    },
    setDisabled(on) {
      state.disabled = flag('card', 'disabled', on);
      render();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      skeleton?.destroy();
      c.dispose();
      el.remove();
    },
  };
}
