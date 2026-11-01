// @purpose: Barra fija inferior de ayudas del ejercicio (2.7-T1): ejemplos, correcciones, preguntas IA y diccionario, con insignia; dibuja solo las que recibe.
// Roadmap 2.7 y 7.7. Cada tramo de 2.7 añade su acción; la barra no inventa botones que todavía no hacen nada.
//
//   createActionBar({ actions, onOpen?, doc? }) → { el, ids, has(id), setBadge(id, n | null), focus(id), destroy() }
//     actions   ids de ACTION_IDS (subconjunto, sin repetir). Se dibujan siempre en el orden fijo de 7.7. Vacía: la barra queda oculta.
//     onOpen    (id, botón) al tocar una acción. Si lanza, se anota y la barra sigue viva.
//     setBadge  n entero ≥ 1 muestra la insignia (99+ si pasa de 99); 0 o null la quita. El nombre accesible del botón lleva la cuenta.
//   Estructura: <div class="actionbar" role="group"> con un botón por acción (objetivo táctil ≥ 44 px, texto siempre visible).
import { createButton } from './components/index.js';
import { h as domH } from './dom.js';

export const ACTION_IDS = Object.freeze(['examples', 'corrections', 'ai', 'dictionary']);
export const ACTION_TEXT = Object.freeze({
  group: 'Ayudas para este ejercicio',
  examples: 'Otros ejemplos',
  corrections: 'Correcciones',
  ai: 'Preguntas IA',
  dictionary: 'Diccionario',
  countSuffix: 'en total',
});
const ICONS = Object.freeze({ examples: '≡', corrections: '✎', ai: '✦', dictionary: 'Aa' });
const BADGE_MAX = 99;

export function createActionBar({ actions, onOpen, doc = globalThis.document } = {}) {
  if (!Array.isArray(actions)) throw new TypeError('actionBar: "actions" debe ser una lista');
  for (const id of actions) if (!ACTION_IDS.includes(id)) throw new TypeError(`actionBar: acción desconocida ${JSON.stringify(id)}`);
  if (new Set(actions).size !== actions.length) throw new TypeError('actionBar: hay una acción repetida');
  if (onOpen !== undefined && typeof onOpen !== 'function') throw new TypeError('actionBar: "onOpen" debe ser una función');
  const { h } = domH.with(doc);

  const ids = ACTION_IDS.filter((id) => actions.includes(id));
  const parts = new Map();
  const buttons = ids.map((id) => {
    const badge = h('span', { class: 'actionbar__badge', 'aria-hidden': 'true', hidden: true });
    const btn = createButton({
      label: ACTION_TEXT[id], icon: ICONS[id], variant: 'ghost', doc,
      onClick: () => {
        try { onOpen?.(id, btn.el); } catch (e) { console.error('No se pudo abrir la ayuda', id, e); }
      },
    });
    btn.el.classList.add('actionbar__btn');
    btn.el.appendChild(badge);
    parts.set(id, { btn, badge });
    return btn;
  });
  const el = h('div', { class: 'actionbar', role: 'group', 'aria-label': ACTION_TEXT.group, hidden: ids.length === 0 }, ...buttons.map((b) => b.el));

  let destroyed = false;
  return Object.freeze({
    el,
    ids: Object.freeze([...ids]),
    has: (id) => parts.has(id),
    setBadge(id, n) {
      const p = parts.get(id);
      if (!p) return;
      const count = Number.isInteger(n) && n >= 1 ? n : 0;
      if (count === 0) {
        p.badge.setAttribute('hidden', '');
        p.badge.textContent = '';
        p.btn.el.removeAttribute('aria-label');
        return;
      }
      p.badge.textContent = count > BADGE_MAX ? `${BADGE_MAX}+` : String(count);
      p.badge.removeAttribute('hidden');
      p.btn.el.setAttribute('aria-label', `${ACTION_TEXT[id]}: ${count} ${ACTION_TEXT.countSuffix}`);
    },
    focus(id) { parts.get(id)?.btn.focus(); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const { btn } of parts.values()) { try { btn.destroy(); } catch (e) { console.error('No se pudo limpiar la barra de ayudas', e); } }
      el.remove();
    },
  });
}
