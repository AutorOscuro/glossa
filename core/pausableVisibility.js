// @purpose: Visibilidad con pausa (2.7-T1): suma una pausa propia a la visibilidad de la pestaña para que el cronómetro no cuente el tiempo en una ayuda.
// Sin DOM: recibe la visibilidad base ya creada (app/visibility.js) y devuelve la misma forma que entiende core/answerTimer.js.
//
//   createPausableVisibility(base?) → { hidden(), onChange(fn) → desuscribir, setPaused(bool), paused() }
//     hidden()    true si la pestaña está oculta O la pausa está puesta.
//     onChange    avisa cuando cambia la base y cuando cambia la pausa (un aviso repetido no se reenvía a nadie).
//   Sin base, la pestaña se considera siempre visible. Una base que lanza se trata como visible: la ayuda nunca debe romper la respuesta.
const ALWAYS_VISIBLE = Object.freeze({ hidden: () => false, onChange: () => () => {} });

export function createPausableVisibility(base = ALWAYS_VISIBLE) {
  const src = base && typeof base.hidden === 'function' && typeof base.onChange === 'function' ? base : ALWAYS_VISIBLE;
  let paused = false;
  const subs = new Set();
  const baseHidden = () => { try { return src.hidden() === true; } catch { return false; } };
  const notify = () => { for (const fn of [...subs]) { try { fn(); } catch (e) { console.error('pausableVisibility: un oyente falló', e); } } };
  let off = null;
  const attach = () => { if (off === null) { try { off = src.onChange(notify) ?? (() => {}); } catch { off = () => {}; } } };
  const detach = () => { if (off !== null) { try { off(); } catch { /* quitar el aviso no debe romper nada */ } off = null; } };
  return Object.freeze({
    hidden: () => paused || baseHidden(),
    onChange(fn) {
      if (typeof fn !== 'function') throw new Error('pausableVisibility: onChange necesita una función');
      subs.add(fn);
      attach();
      return () => { subs.delete(fn); if (subs.size === 0) detach(); };
    },
    setPaused(on) {
      const next = on === true;
      if (next === paused) return;
      paused = next;
      notify();
    },
    paused: () => paused,
  });
}
