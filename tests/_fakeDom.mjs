// DOM y window FALSOS para probar con Node la capa de interfaz (subparte 0.4). No es una prueba: el nombre empieza con "_".
//
//   const env = makeEnv({ light?, clipboard?, hash?, search? })  →  { doc, win, stats, flush }
//     doc:  createElement/createElementNS/createTextNode, getElementById, querySelector(All), title, documentElement, body, head
//           elementos con: setAttribute/getAttribute/removeAttribute, classList, dataset, style.setProperty, appendChild, remove,
//           replaceChildren, after, textContent, children, addEventListener/removeEventListener/dispatchEvent, focus, outerHTML
//     win:  location {hash, search, reload}, history.replaceState, addEventListener/removeEventListener/dispatch, scrollY/scrollTo,
//           matchMedia, getComputedStyle, navigator.clipboard, back()/forward() (historial simulado)
//     stats: { added, removed, live() } cuenta TODOS los listeners (también los de nodos ya desmontados) → detecta fugas.
//   flush() espera a que terminen las promesas pendientes (microtareas).
//
// Un listener que lanza NO rompe a quien llamó a dispatchEvent: igual que en el navegador, el error va a window ('error').
// Selectores soportados: #id, .clase, etiqueta, [attr], [attr="valor"], combinados (div.a[x]) y descendientes con espacio.

const TEXT = 3;
const ELEMENT = 1;

function escText(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escAttr(s) {
  return escText(s).replace(/"/g, '&quot;');
}

function parseCompound(sel) {
  const out = { tag: null, id: null, classes: [], attrs: [] };
  const re = /^([a-zA-Z][\w-]*)|#([\w-]+)|\.([\w-]+)|\[([\w:-]+)(?:=(?:"([^"]*)"|([^\]]*)))?\]/;
  let rest = sel;
  while (rest) {
    const m = rest.match(re);
    if (!m) throw new Error(`Selector no soportado por el DOM falso: ${sel}`);
    if (m[1]) out.tag = m[1].toLowerCase();
    else if (m[2]) out.id = m[2];
    else if (m[3]) out.classes.push(m[3]);
    else out.attrs.push([m[4], m[5] ?? m[6] ?? null]);
    rest = rest.slice(m[0].length);
  }
  return out;
}

function matchesCompound(el, c) {
  if (c.tag && el.tagName.toLowerCase() !== c.tag) return false;
  if (c.id && el.getAttribute('id') !== c.id) return false;
  for (const cls of c.classes) if (!el.classList.contains(cls)) return false;
  for (const [name, val] of c.attrs) {
    if (!el.hasAttribute(name)) return false;
    if (val !== null && el.getAttribute(name) !== val) return false;
  }
  return true;
}

export function makeEnv({ light = false, clipboard, hash = '', search = '', contentSecurity } = {}) {
  void contentSecurity;
  const stats = { added: 0, removed: 0, live() { return this.added - this.removed; } };
  let win = null;

  class Target {
    constructor() { this._l = new Map(); }
    addEventListener(type, fn) {
      if (typeof fn !== 'function') return;
      if (!this._l.has(type)) this._l.set(type, new Set());
      const set = this._l.get(type);
      if (!set.has(fn)) { set.add(fn); stats.added += 1; }
    }
    removeEventListener(type, fn) {
      const set = this._l.get(type);
      if (set && set.delete(fn)) stats.removed += 1;
    }
    dispatchEvent(event) {
      event.target ??= this;
      for (const fn of [...(this._l.get(event.type) ?? [])]) {
        try { fn.call(this, event); } catch (error) { win?.dispatch('error', { error, message: String(error?.message ?? error) }); }
      }
      return true;
    }
  }

  class Node extends Target {
    constructor() { super(); this.childNodes = []; this.parentNode = null; }
    appendChild(child) {
      if (child.parentNode) child.parentNode.removeChild(child);
      child.parentNode = this;
      this.childNodes.push(child);
      return child;
    }
    removeChild(child) {
      const i = this.childNodes.indexOf(child);
      if (i === -1) throw new Error('removeChild: no es hijo');
      this.childNodes.splice(i, 1);
      child.parentNode = null;
      return child;
    }
    remove() { if (this.parentNode) this.parentNode.removeChild(this); }
    replaceChildren(...nodes) {
      for (const c of [...this.childNodes]) this.removeChild(c);
      for (const n of nodes) this.appendChild(typeof n === 'string' ? new Text(n) : n);
    }
    after(node) {
      const p = this.parentNode;
      const i = p.childNodes.indexOf(this);
      if (node.parentNode) node.parentNode.removeChild(node);
      node.parentNode = p;
      p.childNodes.splice(i + 1, 0, node);
    }
  }

  class Text extends Node {
    constructor(data) { super(); this.nodeType = TEXT; this.data = String(data); }
    get textContent() { return this.data; }
    get outerHTML() { return escText(this.data); }
  }

  class Element extends Node {
    constructor(tag, ns = null) {
      super();
      this.nodeType = ELEMENT;
      this.tagName = ns ? tag : tag.toUpperCase();
      this.namespaceURI = ns;
      this._a = new Map();
      // Igual que un navegador real: dataset.tabId <-> atributo data-tab-id.
      const kebab = (k) => `data-${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`;
      this.dataset = new Proxy({}, {
        get: (_t, k) => (typeof k === 'string' && this._a.has(kebab(k)) ? this._a.get(kebab(k)) : undefined),
        set: (_t, k, v) => { this._a.set(kebab(String(k)), String(v)); return true; },
      });
      const props = new Map();
      this.style = { setProperty: (k, v) => props.set(k, String(v)), getPropertyValue: (k) => props.get(k) ?? '', _props: props };
      const el = this;
      this.classList = {
        add: (...c) => { const s = el._classes(); c.forEach((x) => s.add(x)); el._a.set('class', [...s].join(' ')); },
        remove: (...c) => { const s = el._classes(); c.forEach((x) => s.delete(x)); el._a.set('class', [...s].join(' ')); },
        contains: (c) => el._classes().has(c),
      };
      this.value = '';
    }
    _classes() { return new Set((this._a.get('class') ?? '').split(/\s+/).filter(Boolean)); }
    setAttribute(k, v) { this._a.set(k, String(v)); }
    getAttribute(k) { return this._a.has(k) ? this._a.get(k) : null; }
    removeAttribute(k) { this._a.delete(k); }
    hasAttribute(k) { return this._a.has(k); }
    get children() { return this.childNodes.filter((n) => n.nodeType === ELEMENT); }
    get firstElementChild() { return this.children[0] ?? null; }
    get textContent() { return this.childNodes.map((n) => n.textContent).join(''); }
    set textContent(v) { this.replaceChildren(new Text(v)); }
    focus() { doc._active = this; this.dispatchEvent({ type: 'focus' }); }
    select() { this._selected = true; }
    querySelectorAll(sel) {
      const steps = sel.trim().split(/\s+/).map(parseCompound);
      const found = [];
      const walk = (node, ancestors) => {
        for (const child of node.children ?? []) {
          const chain = [...ancestors, child];
          if (matchesCompound(child, steps[steps.length - 1])) {
            let si = steps.length - 2;
            for (let k = chain.length - 2; k >= 0 && si >= 0; k -= 1) if (matchesCompound(chain[k], steps[si])) si -= 1;
            if (si < 0) found.push(child);
          }
          walk(child, chain);
        }
      };
      walk(this, []);
      return found;
    }
    querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
    get outerHTML() {
      const attrs = [...this._a].map(([k, v]) => ` ${k}="${escAttr(v)}"`).join('');
      return `<${this.tagName.toLowerCase()}${attrs}>${this.childNodes.map((n) => n.outerHTML).join('')}</${this.tagName.toLowerCase()}>`;
    }
  }

  const html = new Element('html');
  const head = new Element('head');
  const body = new Element('body');
  html.appendChild(head);
  html.appendChild(body);
  const themeMeta = new Element('meta');
  themeMeta.setAttribute('name', 'theme-color');
  themeMeta.setAttribute('content', '#000000');
  head.appendChild(themeMeta);
  const appDiv = new Element('div');
  appDiv.setAttribute('id', 'app');
  const boot = new Element('p');
  boot.setAttribute('id', 'boot');
  appDiv.appendChild(boot);
  body.appendChild(appDiv);

  const doc = {
    title: '',
    documentElement: html,
    head,
    body,
    _active: null,
    get activeElement() { return this._active; },
    createElement: (t) => new Element(t),
    createElementNS: (ns, t) => new Element(t, ns),
    createTextNode: (t) => new Text(t),
    getElementById: (id) => html.querySelector(`#${id}`),
    querySelector: (s) => html.querySelector(s),
    querySelectorAll: (s) => html.querySelectorAll(s),
  };

  const docTarget = new Target();
  doc.addEventListener = (t, f) => docTarget.addEventListener(t, f);
  doc.removeEventListener = (t, f) => docTarget.removeEventListener(t, f);
  doc.dispatch = (type, extra = {}) => docTarget.dispatchEvent({ type, ...extra });

  // ---- window con historial simulado ----
  const history = [hash];
  let index = 0;
  const winTarget = new Target();
  const clip = clipboard === undefined ? { calls: [], writeText(t) { this.calls.push(t); return Promise.resolve(); } } : clipboard;
  win = {
    document: doc,
    addEventListener: (t, f) => winTarget.addEventListener(t, f),
    removeEventListener: (t, f) => winTarget.removeEventListener(t, f),
    dispatch: (type, extra = {}) => winTarget.dispatchEvent({ type, ...extra }),
    scrollY: 0,
    scrollCalls: [],
    scrollTo(a, b) {
      const opts = typeof a === 'object' ? a : { left: a, top: b };
      this.scrollY = opts.top;
      this.scrollCalls.push(opts);
    },
    matchMedia: (q) => ({ matches: light && q.includes('light') }),
    getComputedStyle: () => ({ getPropertyValue: (k) => (k === '--bg' ? ' #070a1d ' : '') }),
    navigator: { clipboard: clip },
    reloads: 0,
    location: {
      search,
      reload() { win.reloads += 1; },
      get hash() { return history[index]; },
      set hash(v) {
        const next = String(v).startsWith('#') ? String(v) : `#${v}`;
        if (next === history[index]) return;
        history.splice(index + 1);
        history.push(next);
        index += 1;
        win.dispatch('hashchange');
      },
    },
    history: {
      replaceState(_s, _t, url) { history[index] = String(url).startsWith('#') ? String(url) : `#${url}`; },
    },
    back() { if (index > 0) { index -= 1; win.dispatch('hashchange'); } },
    forward() { if (index < history.length - 1) { index += 1; win.dispatch('hashchange'); } },
    historyEntries: () => [...history],
  };

  const flush = async () => { for (let i = 0; i < 5; i += 1) await Promise.resolve(); await new Promise((r) => setImmediate(r)); };
  return { doc, win, stats, flush, clip };
}

// Temporizadores falsos controlables: { setTimeout, clearTimeout, advance(ms), pending() }
export function makeTimers() {
  let now = 0;
  let nextId = 1;
  const items = new Map();
  return {
    setTimeout(fn, ms = 0) { const id = nextId; nextId += 1; items.set(id, { at: now + ms, fn }); return id; },
    clearTimeout(id) { items.delete(id); },
    advance(ms) {
      now += ms;
      for (const [id, t] of [...items].sort((a, b) => a[1].at - b[1].at)) {
        if (t.at <= now && items.has(id)) { items.delete(id); t.fn(); }
      }
    },
    pending: () => items.size,
  };
}
