// @purpose: Modal de confirmación de acciones peligrosas, con frase de confirmación opcional (p. ej. «Borrar todo»).
// Confirmación de acción peligrosa (subparte 0.5): un modal "danger" que, opcionalmente, exige escribir una frase.
// La 0.8 lo usa para "Borrar todo" (doble confirmación: escribe "BORRAR").
//
//   createConfirmDanger({ title, message, phrase? = 'BORRAR', requirePhrase = true, confirmLabel = 'Borrar',
//                         cancelLabel?, container?, doc?, … })
//     → { el, open() → Promise<boolean>, isOpen(), destroy() }
//   · Con requirePhrase, "Borrar" queda deshabilitado hasta que el campo contenga EXACTAMENTE la frase
//     (se ignoran espacios de los extremos; las mayúsculas cuentan).
//   · Al abrir, el campo se limpia y el foco empieza en "Cancelar". Enter en el campo confirma solo si la frase es válida.
import { makeCtx, str, flag, fail } from './_shared.js';
import { createModal } from './modal.js';
import { createTextInput } from './textInput.js';
import { TEXT } from './_text.js';

export function createConfirmDanger(opts = {}) {
  const c = makeCtx('confirmDanger', opts);
  const phrase = str('confirmDanger', 'phrase', opts.phrase, { max: 40 }) ?? 'BORRAR';
  const requirePhrase = flag('confirmDanger', 'requirePhrase', opts.requirePhrase, true);
  if (requirePhrase && phrase.trim() === '') fail('confirmDanger', '"phrase" no puede estar vacía');
  const confirmLabel = str('confirmDanger', 'confirmLabel', opts.confirmLabel, { max: 80 }) ?? 'Borrar';

  let field = null;
  let modal = null;
  const matches = () => !requirePhrase || field.getValue().trim() === phrase;
  if (requirePhrase) {
    field = createTextInput({
      doc: c.doc, win: c.win, label: `${TEXT.confirmPhrasePrompt} ${phrase}`, mode: 'exercise', lang: 'es',
      onInput: () => modal.setConfirmDisabled(!matches()),
      onSubmit: () => {
        if (matches()) modal.close(true);
      },
    });
    field.input.setAttribute('autocapitalize', 'characters');
  }
  modal = createModal({
    doc: c.doc, win: c.win, now: opts.now, timers: opts.timers, container: opts.container,
    title: str('confirmDanger', 'title', opts.title, { required: true, max: 200 }),
    message: str('confirmDanger', 'message', opts.message, { max: 2000 }),
    confirmLabel, cancelLabel: opts.cancelLabel, danger: true, children: field ? [field.el] : null,
  });
  modal.setConfirmDisabled(requirePhrase);

  let destroyed = false;
  return {
    el: modal.el,
    open() {
      field?.setValue('');
      modal.setConfirmDisabled(requirePhrase);
      return modal.open();
    },
    isOpen: () => modal.isOpen(),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      modal.destroy();
      field?.destroy();
      c.dispose();
    },
  };
}
