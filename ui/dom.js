// @purpose: Ayudantes seguros de DOM: crear elementos (h, hs), escapar texto y enlazar eventos; todo texto entra como nodo de texto.
// Ayudantes seguros de DOM (subparte 0.4). Regla del proyecto: nada de innerHTML con texto variable.
// Todo texto (de la persona, de paquetes, de la IA) entra como NODO DE TEXTO, nunca como HTML.
//
//   h(tag, props?, ...children)  crea un elemento. props: class/className, dataset, style (objeto → CSSOM),
//                                aria-*/data-*/atributos normales, onClick-style con función (on + evento en minúsculas
//                                o camelCase: onClick, onclick). Hijos: texto, nodos, arreglos anidados; null/false se ignoran.
//   hs(tag, props?, ...children) igual que h() pero para SVG (espacio de nombres SVG).
//   esc(valor)                   escapa & < > " ' para el raro caso de construir una cadena de texto (no para HTML dinámico).
//   on(el, tipo, fn, opciones)   añade un listener y devuelve una función que lo quita.
//   qs(selector, raíz?)          document.querySelector con raíz opcional.
//
// h()/hs() RECHAZAN (lanzan Error): props html/innerHTML/outerHTML, atributos on* con texto, y URLs javascript:.
// Para pruebas con DOM falso se puede pasar el documento: h.with(doc) → { h, hs } ligados a ese documento.

const SVG_NS = 'http://www.w3.org/2000/svg';
const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'xlink:href']);
const FORBIDDEN_PROPS = new Set(['html', 'innerhtml', 'outerhtml', 'srcdoc']);

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isDangerousUrl(v) {
  // Quita espacios y caracteres de control que los navegadores ignoran al interpretar el esquema.
  const compact = String(v).replace(/[\u0000-\u0020\u007f-\u009f]/g, '').toLowerCase();
  return /^(javascript|vbscript|data:text\/html)/.test(compact);
}

function applyProps(el, props) {
  for (const [rawKey, value] of Object.entries(props)) {
    const key = rawKey.toLowerCase();
    if (FORBIDDEN_PROPS.has(key)) throw new Error(`h(): la propiedad "${rawKey}" no está permitida; usa hijos de texto o nodos.`);
    if (value === null || value === undefined || value === false) continue;

    if (key === 'class' || key === 'classname') {
      el.setAttribute('class', Array.isArray(value) ? value.filter(Boolean).join(' ') : String(value));
    } else if (key === 'dataset') {
      for (const [k, v] of Object.entries(value)) if (v !== null && v !== undefined) el.dataset[k] = String(v);
    } else if (key === 'style') {
      if (typeof value !== 'object') throw new Error('h(): style debe ser un objeto { propiedad: valor } (la CSP bloquea style="…").');
      for (const [k, v] of Object.entries(value)) el.style.setProperty(k, String(v));
    } else if (key.startsWith('on')) {
      if (typeof value !== 'function') throw new Error(`h(): "${rawKey}" debe ser una función, no texto.`);
      el.addEventListener(key.slice(2), value);
    } else {
      if (URL_ATTRS.has(key) && isDangerousUrl(value)) throw new Error(`h(): URL no permitida en "${rawKey}".`);
      el.setAttribute(rawKey, value === true ? '' : String(value));
    }
  }
}

function appendChildren(doc, el, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false || child === true) continue;
    if (Array.isArray(child)) appendChildren(doc, el, child);
    else if (typeof child === 'object' && typeof child.nodeType === 'number') el.appendChild(child);
    else el.appendChild(doc.createTextNode(String(child)));
  }
}

function build(doc, ns, tag, props, children) {
  if (typeof tag !== 'string' || !/^[a-zA-Z][a-zA-Z0-9-]*$/.test(tag)) throw new Error(`h(): nombre de etiqueta inválido: ${String(tag)}`);
  const el = ns ? doc.createElementNS(ns, tag) : doc.createElement(tag);
  let kids = children;
  let attrs = props;
  // Permite h('p', 'texto') y h('p', [hijos]) sin objeto de propiedades.
  if (props === null || props === undefined) attrs = {};
  else if (typeof props !== 'object' || Array.isArray(props) || typeof props.nodeType === 'number') {
    kids = [props, ...children];
    attrs = {};
  }
  applyProps(el, attrs);
  appendChildren(doc, el, kids);
  return el;
}

function withDocument(doc) {
  return {
    h: (tag, props, ...children) => build(doc, null, tag, props, children),
    hs: (tag, props, ...children) => build(doc, SVG_NS, tag, props, children),
  };
}

export function h(tag, props, ...children) {
  return build(document, null, tag, props, children);
}

export function hs(tag, props, ...children) {
  return build(document, SVG_NS, tag, props, children);
}

h.with = withDocument;

export function on(el, type, fn, options) {
  if (!el || typeof el.addEventListener !== 'function') throw new Error('on(): el no es un elemento');
  if (typeof fn !== 'function') throw new Error('on(): el manejador debe ser una función');
  el.addEventListener(type, fn, options);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    el.removeEventListener(type, fn, options);
  };
}

export function qs(selector, root) {
  return (root ?? document).querySelector(selector);
}
