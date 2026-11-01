// @purpose: Campo de texto con etiqueta, ayuda y error (una línea o varias).
// Campo de texto con etiqueta, ayuda y error (subparte 0.5). Usa .input de components.css.
//
//   createTextInput({ label? | ariaLabel?, value = '', placeholder?, hint?, error?, mode = 'text', multiline = false,
//                     rows = 3, maxLength?, optional = false, disabled = false, loading = false, lang?,
//                     onInput?(valor), onSubmit?(valor), doc?, … })
//     → { el, input, getValue(), setValue(t), focus(), select(), setError(texto|null), setDisabled(b), setLoading(b), destroy() }
//
//   mode (atributos del teclado móvil):
//     text      → campo normal.
//     exercise  → para RESPONDER ejercicios: autocapitalize="off" autocorrect="off" autocomplete="off"
//                 spellcheck="false" enterkeyhint="done" (el teclado no corrige ni pone mayúsculas por su cuenta).
//                 lang="en" por defecto (opción `lang` para cambiarlo, p. ej. 'es' en traducciones inversas).
//     search | email | number | password (claves: sin autocompletar, sin corrección).
//   Enter (campo de una línea, sin estar componiendo con un teclado IME) llama onSubmit con el valor.
//   Error: aria-invalid + mensaje enlazado por aria-describedby (zona aria-live siempre presente → se anuncia).
import { makeCtx, str, oneOf, flag, num, fn, fail, uid, setAttr, setFlag } from './_shared.js';
import { TEXT } from './_text.js';

const MODES = {
  text: { type: 'text' },
  exercise: { type: 'text', autocapitalize: 'off', autocorrect: 'off', autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'done', inputmode: 'text' },
  search: { type: 'search', enterkeyhint: 'search', autocomplete: 'off' },
  email: { type: 'email', autocapitalize: 'off', autocorrect: 'off', autocomplete: 'email', spellcheck: 'false', inputmode: 'email' },
  number: { type: 'text', inputmode: 'numeric', autocomplete: 'off' },
  password: { type: 'password', autocapitalize: 'off', autocorrect: 'off', autocomplete: 'off', spellcheck: 'false' },
};

export function createTextInput(opts = {}) {
  const c = makeCtx('textInput', opts);
  const label = str('textInput', 'label', opts.label, { max: 300 });
  const ariaLabel = str('textInput', 'ariaLabel', opts.ariaLabel, { max: 300 });
  if (!label && !ariaLabel) fail('textInput', 'necesita "label" o "ariaLabel" (todo campo tiene nombre accesible)');
  const mode = oneOf('textInput', 'mode', opts.mode, Object.keys(MODES), 'text');
  const multiline = flag('textInput', 'multiline', opts.multiline);
  const rows = num('textInput', 'rows', opts.rows, { min: 1, max: 30, integer: true, fallback: 3 });
  const maxLength = num('textInput', 'maxLength', opts.maxLength, { min: 1, max: 100000, integer: true });
  const placeholder = str('textInput', 'placeholder', opts.placeholder, { max: 300 });
  const hint = str('textInput', 'hint', opts.hint, { max: 600 });
  const optional = flag('textInput', 'optional', opts.optional);
  const lang = str('textInput', 'lang', opts.lang, { max: 12 }) ?? (mode === 'exercise' ? 'en' : undefined);
  const onInput = fn('textInput', 'onInput', opts.onInput);
  const onSubmit = fn('textInput', 'onSubmit', opts.onSubmit);
  const initial = str('textInput', 'value', opts.value, { max: 100000, allowEmpty: true }) ?? '';
  const state = { disabled: flag('textInput', 'disabled', opts.disabled), loading: flag('textInput', 'loading', opts.loading), error: null };

  const id = uid('field');
  const hintId = `${id}-hint`;
  const errId = `${id}-error`;
  const preset = MODES[mode];
  const { h } = c;
  const attrs = {
    id,
    class: 'input',
    placeholder,
    maxlength: maxLength,
    lang,
    'aria-label': label ? null : ariaLabel,
    ...(multiline ? { rows: String(rows) } : { type: preset.type }),
    autocapitalize: preset.autocapitalize,
    autocorrect: preset.autocorrect,
    autocomplete: preset.autocomplete,
    spellcheck: preset.spellcheck,
    enterkeyhint: preset.enterkeyhint,
    inputmode: preset.inputmode,
    value: multiline ? null : initial,
  };
  const input = h(multiline ? 'textarea' : 'input', attrs);
  input.value = initial;
  const hintEl = hint ? h('p', { class: 'field__hint', id: hintId }, hint) : null;
  const errorEl = h('p', { class: 'field__error', id: errId, 'aria-live': 'polite' });
  const labelEl = label
    ? h('label', { class: 'field__label', for: id }, label, optional ? h('span', { class: 'field__optional' }, ` ${TEXT.optional}`) : null)
    : null;
  const el = h('div', { class: 'field' }, labelEl, input, hintEl, errorEl);

  function paint() {
    if (state.disabled) input.setAttribute('disabled', '');
    else input.removeAttribute('disabled');
    if (state.loading) input.setAttribute('readonly', '');
    else input.removeAttribute('readonly');
    setAttr(input, 'aria-busy', state.loading ? true : null);
    setAttr(input, 'aria-invalid', state.error !== null ? true : null);
    setAttr(input, 'aria-describedby', [hintEl && hintId, state.error !== null && errId].filter(Boolean).join(' ') || null);
    setFlag(el, 'field--error', state.error !== null);
    setFlag(el, 'is-loading', state.loading);
    errorEl.textContent = state.error ?? '';
  }
  if (opts.error) state.error = str('textInput', 'error', opts.error, { required: true, max: 500 });
  paint();

  c.listen(input, 'input', () => onInput?.(input.value));
  if (!multiline) {
    c.listen(input, 'keydown', (e) => {
      if (e.key !== 'Enter' || e.isComposing || state.disabled || state.loading) return;
      e.preventDefault?.();
      onSubmit?.(input.value);
    });
  }

  let destroyed = false;
  return {
    el,
    input,
    getValue: () => input.value,
    setValue(text) {
      input.value = str('textInput', 'value', text, { max: 100000, allowEmpty: true }) ?? '';
    },
    focus: () => input.focus(),
    select: () => input.select?.(),
    setError(message) {
      state.error = message === null || message === undefined || message === '' ? null : str('textInput', 'error', message, { required: true, max: 500 });
      paint();
    },
    setDisabled(on) {
      state.disabled = flag('textInput', 'disabled', on);
      paint();
    },
    setLoading(on) {
      state.loading = flag('textInput', 'loading', on);
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
