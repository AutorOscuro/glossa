// @purpose: Campo de clave secreta: escribir, mostrar u ocultar, guardar y borrar.
// Campo de clave secreta (subparte 0.8, cuarto 2): escribir, mostrar/ocultar lo escrito, guardar y borrar.
//
//   createKeyField({ label, saved = false, hint?, placeholder?, disabled = false, onSave(valor) → Promesa, onClear() → Promesa,
//                    text?, doc?, … })
//     → { el, input, getValue(), isSaved(), setSaved(b), setDisabled(b), setError(texto|null), focus(), destroy() }
//
//   · La clave YA guardada NUNCA se vuelve a poner en el campo: solo se muestra "Clave guardada en este dispositivo".
//     Lo único que se ve en el campo es lo que la persona acaba de escribir; "Mostrar/Ocultar" solo afecta a eso.
//   · Al guardar bien, el campo se vacía y vuelve a ocultarse. Si guardar falla, lo escrito se conserva (para no teclearlo de nuevo)
//     y se muestra el texto amable del error (`error.friendly`); NUNCA se muestra ni se registra `error.message` ni el valor.
//   · onSave/onClear los pone la pantalla (llaman a settings.set / settings.clearSecrets). Este componente no sabe de ajustes.
//   · Doble toque: mientras hay un guardado o un borrado en curso, los toques se ignoran. Si se destruye a mitad, no toca el DOM.
//   · destroy() vacía el campo antes de quitarlo.
import { makeCtx, str, flag, fn, fail, setAttr, setFlag } from './_shared.js';
import { createTextInput } from './textInput.js';
import { createButton } from './button.js';
import { TEXT } from './_text.js';

export function createKeyField(opts = {}) {
  const c = makeCtx('keyField', opts);
  const label = str('keyField', 'label', opts.label, { required: true, max: 200 });
  const onSave = fn('keyField', 'onSave', opts.onSave);
  const onClear = fn('keyField', 'onClear', opts.onClear);
  if (!onSave) fail('keyField', 'falta "onSave"');
  if (!onClear) fail('keyField', 'falta "onClear"');
  const T = { ...TEXT.keyField, ...(opts.text ?? {}) };
  const state = { saved: flag('keyField', 'saved', opts.saved), disabled: flag('keyField', 'disabled', opts.disabled), busy: false, revealed: false, note: null };
  const shared = { doc: c.doc, win: c.win, timers: c.timers, now: c.now };

  const field = createTextInput({
    ...shared,
    label,
    mode: 'password',
    placeholder: str('keyField', 'placeholder', opts.placeholder, { max: 200 }),
    hint: str('keyField', 'hint', opts.hint, { max: 600 }) ?? T.hint,
    maxLength: 400,
    onSubmit: () => save(),
  });
  const toggleBtn = createButton({ ...shared, label: T.show, variant: 'ghost', onClick: () => reveal(!state.revealed) });
  toggleBtn.el.setAttribute('aria-pressed', 'false'); // setAttr quitaría el atributo con false; un interruptor necesita "false" explícito
  setAttr(toggleBtn.el, 'aria-label', T.showAria);
  const saveBtn = createButton({ ...shared, label: T.save, variant: 'primary', onClick: () => save() });
  const clearBtn = createButton({ ...shared, label: T.clear, variant: 'danger', onClick: () => clear() });
  const status = c.h('p', { class: 'key-field__status', 'aria-live': 'polite' });
  const el = c.h('div', { class: 'key-field' }, field.el, c.h('div', { class: 'key-field__row' }, toggleBtn.el, saveBtn.el, clearBtn.el), status);

  function reveal(on) {
    state.revealed = on;
    field.input.setAttribute('type', on ? 'text' : 'password');
    toggleBtn.setLabel(on ? T.hide : T.show);
    toggleBtn.el.setAttribute('aria-pressed', on ? 'true' : 'false');
    setAttr(toggleBtn.el, 'aria-label', on ? T.hideAria : T.showAria);
  }

  function paint() {
    const off = state.disabled || state.busy !== false;
    field.setDisabled(off);
    toggleBtn.setDisabled(state.disabled);
    saveBtn.setDisabled(state.disabled);
    clearBtn.setDisabled(state.disabled || !state.saved);
    saveBtn.setLoading(state.busy === 'save');
    clearBtn.setLoading(state.busy === 'clear');
    setFlag(el, 'is-saved', state.saved);
    status.textContent = state.note ?? (state.saved ? T.statusSaved : T.statusEmpty);
  }

  // Solo se registra el código del error (nunca el mensaje ni el valor: podrían contener la clave).
  const friendly = (e, fallback) => (typeof e?.friendly === 'string' && e.friendly ? e.friendly : fallback);
  const logFailure = (what, e) => console.error(`${what} (código: ${typeof e?.code === 'string' ? e.code : 'desconocido'})`);

  async function run(kind, task, onFail) {
    if (state.busy || state.disabled) return;
    state.busy = kind;
    paint();
    try {
      await task();
    } catch (e) {
      logFailure(kind === 'save' ? 'No se pudo guardar la clave' : 'No se pudo borrar la clave', e);
      if (c.alive) field.setError(friendly(e, onFail));
    } finally {
      state.busy = false;
      if (c.alive) paint();
    }
  }

  const save = () => run('save', async () => {
    const value = field.getValue().trim();
    if (value === '') { field.setError(T.errorEmpty); return; }
    await onSave(value);
    if (!c.alive) return;
    field.setValue('');
    field.setError(null);
    reveal(false);
    state.saved = true;
    state.note = null;
  }, T.errorSave);

  const clear = () => run('clear', async () => {
    if (!state.saved) return;
    await onClear();
    if (!c.alive) return;
    field.setValue('');
    field.setError(null);
    reveal(false);
    state.saved = false;
    state.note = T.statusCleared;
  }, T.errorClear);

  paint();

  let destroyed = false;
  return {
    el,
    input: field.input,
    getValue: () => field.getValue(),
    isSaved: () => state.saved,
    setSaved(on) {
      state.saved = flag('keyField', 'saved', on);
      state.note = null;
      paint();
    },
    setDisabled(on) {
      state.disabled = flag('keyField', 'disabled', on);
      paint();
    },
    setError: (message) => field.setError(message),
    focus: () => field.focus(),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      field.setValue('');
      c.dispose();
      field.destroy();
      toggleBtn.destroy();
      saveBtn.destroy();
      clearBtn.destroy();
      el.remove();
    },
  };
}
