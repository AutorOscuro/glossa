// Pestañas (subparte 0.5): cambian de panel dentro de una pantalla. Patrón ARIA tablist/tab/tabpanel.
// (La navegación inferior de la app es otra cosa: ui/components/bottomNav.js, 0.4.)
//
//   createTabs({ label, tabs: [{ id, label, panel }], selected?, onChange?(id, evento), doc?, … })
//     → { el, select(id), getSelected(), destroy() }
//   · panel: un nodo, texto, o una FUNCIÓN que devuelve el contenido (se llama la primera vez que se muestra: carga perezosa).
//   · Teclado: flechas, Inicio y Fin cambian de pestaña (activación automática); tabindex itinerante.
//   · 2–8 pestañas con id único. Los paneles inactivos quedan [hidden].
import { makeCtx, str, fn, fail, uid, rovingKeys, toNodes } from './_shared.js';

export function createTabs(opts = {}) {
  const c = makeCtx('tabs', opts);
  const label = str('tabs', 'label', opts.label, { required: true, max: 300 });
  const onChange = fn('tabs', 'onChange', opts.onChange);
  if (!Array.isArray(opts.tabs) || opts.tabs.length < 2 || opts.tabs.length > 8) fail('tabs', '"tabs" debe tener entre 2 y 8 pestañas');
  const base = uid('tabs');
  const ids = new Set();
  const tabs = opts.tabs.map((t, i) => {
    if (t === null || typeof t !== 'object') fail('tabs', `tabs[${i}] debe ser un objeto { id, label, panel }`);
    const id = str('tabs', `tabs[${i}].id`, t.id, { required: true, max: 80 });
    if (ids.has(id)) fail('tabs', `el id "${id}" está repetido`);
    ids.add(id);
    if (t.panel === undefined || t.panel === null) fail('tabs', `tabs[${i}] necesita "panel"`);
    return { id, label: str('tabs', `tabs[${i}].label`, t.label, { required: true, max: 120 }), panel: t.panel, built: false, n: i };
  });
  let current = opts.selected === undefined || opts.selected === null ? tabs[0].id : str('tabs', 'selected', opts.selected, { required: true, max: 80 });
  if (!ids.has(current)) fail('tabs', `"selected" (${current}) no existe`);
  const { h } = c;

  const buttons = tabs.map((t) => h('button', { type: 'button', class: 'tabs__tab', role: 'tab', id: `${base}-tab-${t.n}`, 'aria-controls': `${base}-panel-${t.n}` }, t.label));
  const panels = tabs.map((t) => h('div', { class: 'tabs__panel', role: 'tabpanel', id: `${base}-panel-${t.n}`, 'aria-labelledby': `${base}-tab-${t.n}`, tabindex: '0', hidden: '' }));
  const list = h('div', { class: 'tabs__list', role: 'tablist', 'aria-label': label }, buttons);
  const el = h('div', { class: 'tabs' }, list, panels);

  function paint() {
    tabs.forEach((t, i) => {
      const on = t.id === current;
      buttons[i].setAttribute('aria-selected', on ? 'true' : 'false');
      buttons[i].setAttribute('tabindex', on ? '0' : '-1');
      if (on) {
        if (!t.built) {
          const content = typeof t.panel === 'function' ? t.panel() : t.panel;
          panels[i].replaceChildren(...toNodes(c, 'tabs', content));
          t.built = true;
        }
        panels[i].removeAttribute('hidden');
      } else {
        panels[i].setAttribute('hidden', '');
      }
    });
  }
  paint();

  function select(id, e) {
    if (!ids.has(id) || id === current) return;
    current = id;
    paint();
    buttons[tabs.findIndex((t) => t.id === id)].focus();
    onChange?.(id, e);
  }

  buttons.forEach((b, i) => c.listen(b, 'click', (e) => select(tabs[i].id, e)));
  rovingKeys(c, list, () => buttons, (b) => select(tabs[buttons.indexOf(b)].id, null));

  let destroyed = false;
  return {
    el,
    getSelected: () => current,
    select(id) {
      const value = str('tabs', 'id', id, { required: true, max: 80 });
      if (!ids.has(value)) fail('tabs', `la pestaña "${value}" no existe`);
      select(value, null);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      c.dispose();
      el.remove();
    },
  };
}
