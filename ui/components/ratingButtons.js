// @purpose: Los 4 botones de recuerdo libre (Otra vez, Difícil, Bien, Fácil) para tarjetas sin verificación automática.
// Los 4 botones de recuerdo libre (subparte 1.5, cuarto 3, mitad B): Otra vez · Difícil · Bien · Fácil = rating 1–4 directo.
// Se usan en tarjetas SIN verificación (la persona se califica a sí misma); la calificación automática usa core/grading.js.
//
//   createRatingButtons({ label?, labels?, previews?, disabled = false, onRate?(rating, evento), doc?, win?, timers?, now? })
//     → { el, setPreviews(p | null), setDisabled(b), reset(), isLocked(), destroy() }
//   labels    { again?, hard?, good?, easy? } para cambiar los textos (por defecto «Otra vez», «Difícil», «Bien», «Fácil»).
//   previews  { again?, hard?, good?, easy? }: cada valor es un texto o { label } (lo que devuelve srs.previewIntervals(card, now)).
//             Se muestra bajo cada botón («Repaso en 4 d») para que la persona vea qué pasa con cada elección.
//   onRate(rating, evento)  rating = 1 | 2 | 3 | 4. Se llama UNA sola vez: tras el primer toque los 4 botones quedan bloqueados
//             (un doble toque no califica dos veces) hasta reset(). Si onRate devuelve una promesa, siguen bloqueados mientras
//             dura; si la promesa rechaza, se desbloquean para reintentar y el rechazo SE PROPAGA (lo recoge el manejador global).
//   reset()   desbloquea y quita la marca del botón elegido (la tarjeta siguiente).   setDisabled(true) los deshabilita (atributo disabled).
// Accesibilidad: <button> reales, ≥ 44 px (CSS), grupo con nombre, el botón elegido lleva aria-pressed. El color NUNCA es la única señal
// (hay texto y un borde inferior distinto) y ninguno es rojo: el rojo se reserva para errores de interfaz (decisión de diseño 0.3).
import { makeCtx, str, flag, fn, fail, setAttr, setFlag } from './_shared.js';
import { TEXT } from './_text.js';

export const RATING_KEYS = Object.freeze(['again', 'hard', 'good', 'easy']);
const RATING_OF = Object.freeze({ again: 1, hard: 2, good: 3, easy: 4 });

function readLabels(raw) {
  if (raw === undefined || raw === null) return { ...TEXT.rating };
  if (typeof raw !== 'object' || Array.isArray(raw)) fail('ratingButtons', '"labels" debe ser un objeto { again, hard, good, easy }');
  const out = { ...TEXT.rating };
  for (const k of Object.keys(raw)) {
    if (!RATING_KEYS.includes(k)) fail('ratingButtons', `"labels.${k}" no existe (usa again, hard, good o easy)`);
    out[k] = str('ratingButtons', `labels.${k}`, raw[k], { required: true, max: 40 });
  }
  return out;
}

// Acepta lo que devuelve srs.previewIntervals ({ again: { due, label }, … }) o textos sueltos; lo demás se ignora.
export function normalizePreviews(raw) {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) fail('ratingButtons', '"previews" debe ser un objeto { again, hard, good, easy }');
  const out = {};
  for (const k of RATING_KEYS) {
    const v = raw[k];
    const text = typeof v === 'string' ? v : v && typeof v === 'object' && typeof v.label === 'string' ? v.label : '';
    if (text.trim() !== '') out[k] = str('ratingButtons', `previews.${k}`, text.trim(), { max: 60 });
  }
  return out;
}

export function createRatingButtons(opts = {}) {
  const c = makeCtx('ratingButtons', opts);
  const label = str('ratingButtons', 'label', opts.label, { max: 200 }) ?? TEXT.rating.group;
  const labels = readLabels(opts.labels);
  const onRate = fn('ratingButtons', 'onRate', opts.onRate);
  const state = { disabled: flag('ratingButtons', 'disabled', opts.disabled), locked: false, chosen: null, previews: normalizePreviews(opts.previews) };
  const { h } = c;

  const whenEls = {};
  const buttons = RATING_KEYS.map((k) => {
    whenEls[k] = h('span', { class: 'rating-buttons__when' });
    return h('button', { type: 'button', class: `rating-buttons__btn rating-buttons__btn--${k}`, 'data-rating': String(RATING_OF[k]), 'aria-pressed': 'false' },
      h('span', { class: 'rating-buttons__label' }, labels[k]), whenEls[k]);
  });
  const el = h('div', { class: 'rating-buttons', role: 'group', 'aria-label': label }, buttons);

  function paint() {
    buttons.forEach((b, i) => {
      const k = RATING_KEYS[i];
      const off = state.disabled || state.locked;
      if (state.disabled) b.setAttribute('disabled', ''); else b.removeAttribute('disabled');
      setAttr(b, 'aria-disabled', state.locked && !state.disabled ? true : null);
      b.setAttribute('aria-pressed', state.chosen === RATING_OF[k] ? 'true' : 'false');
      setFlag(b, 'is-chosen', state.chosen === RATING_OF[k]);
      setFlag(b, 'is-off', off);
      const text = state.previews[k] ?? '';
      whenEls[k].textContent = text;
      setFlag(whenEls[k], 'is-empty', text === '');
    });
  }
  paint();

  buttons.forEach((b, i) => c.listen(b, 'click', (e) => {
    if (state.disabled || state.locked) { e.preventDefault?.(); return undefined; }
    const rating = RATING_OF[RATING_KEYS[i]];
    state.locked = true; state.chosen = rating; paint();
    if (!onRate) return undefined;
    let result;
    try {
      result = onRate(rating, e);
    } catch (err) {
      state.locked = false; state.chosen = null; if (c.alive) paint();
      throw err; // un fallo de quien escucha no se traga: se desbloquea para reintentar y el error sigue su camino
    }
    if (result && typeof result.then === 'function') {
      return result.catch((err) => {
        state.locked = false; state.chosen = null;
        if (c.alive) paint();
        throw err;
      });
    }
    return undefined;
  }));

  let destroyed = false;
  return {
    el,
    setPreviews(p) { state.previews = normalizePreviews(p); paint(); },
    setDisabled(on) { state.disabled = flag('ratingButtons', 'disabled', on); paint(); },
    reset() { state.locked = false; state.chosen = null; paint(); },
    isLocked: () => state.locked,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      c.dispose();
      el.remove();
    },
  };
}
