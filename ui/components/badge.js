// Insignia (subparte 0.5). Usa .badge de components.css. Solo informa; no es un botón (salvo el "?" opcional del nivel).
//
//   createBadge({ kind = 'info', text?, level?, onHelp?, helpLabel?, doc?, … }) → { el, setText(t), setLevel(n), destroy() }
//   kind: level | new | review | success | info | accent
//     · level  → "Nivel N" (level entero 1–5, obligatorio). Con onHelp añade un botón "?" que explica el nivel (7.7).
//     · new    → "New" (o el texto dado)
//     · review → texto obligatorio, p. ej. "Repaso en 4 sems" (lo calcula srs.dueLabel en 1.4)
//   El texto largo se ajusta a varias líneas; el significado nunca depende solo del color (siempre hay texto).
import { makeCtx, str, oneOf, num, fn, fail } from './_shared.js';
import { TEXT } from './_text.js';

const KINDS = ['level', 'new', 'review', 'success', 'info', 'accent'];

export function createBadge(opts = {}) {
  const c = makeCtx('badge', opts);
  const kind = oneOf('badge', 'kind', opts.kind, KINDS, 'info');
  const onHelp = fn('badge', 'onHelp', opts.onHelp);
  const helpLabel = str('badge', 'helpLabel', opts.helpLabel, { max: 120 }) ?? TEXT.levelHelp;
  let level = null;
  let text;
  if (kind === 'level') {
    level = num('badge', 'level', opts.level, { min: 1, max: 5, integer: true });
    if (level === undefined) fail('badge', 'el tipo "level" necesita "level" (entero de 1 a 5)');
    text = `${TEXT.levelPrefix} ${level}`;
  } else if (kind === 'new') {
    text = str('badge', 'text', opts.text, { max: 60 }) ?? TEXT.newBadge;
  } else {
    text = str('badge', 'text', opts.text, { required: true, max: 200 });
  }
  if (onHelp && kind !== 'level') fail('badge', '"onHelp" solo existe en el tipo "level"');

  const textEl = c.h('span', { class: 'badge__text' }, text);
  const helpBtn = onHelp
    ? c.h('button', { type: 'button', class: 'badge__help', 'aria-label': helpLabel }, '?')
    : null;
  const el = c.h('span', { class: ['badge', `badge--${kind}`] }, textEl, helpBtn);
  if (helpBtn) c.listen(helpBtn, 'click', (e) => onHelp(e));

  let destroyed = false;
  return {
    el,
    setText(t) {
      if (kind === 'level') fail('badge', 'el texto del nivel sale de "level"; usa setLevel()');
      textEl.textContent = str('badge', 'text', t, { required: true, max: 200 });
    },
    setLevel(n) {
      if (kind !== 'level') fail('badge', 'setLevel() solo existe en el tipo "level"');
      level = num('badge', 'level', n, { min: 1, max: 5, integer: true });
      if (level === undefined) fail('badge', 'falta "level"');
      textEl.textContent = `${TEXT.levelPrefix} ${level}`;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      c.dispose();
      el.remove();
    },
  };
}
