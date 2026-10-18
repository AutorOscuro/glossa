// Utilidades internas de los componentes (subparte 0.5). No es API pública de la app: solo la usan los componentes.
//
//   makeCtx(nombre, opciones) → contexto con doc, win, h, hs, now, timers, listen(), later(), dispose()
//       · Cada listener y cada temporizador de un componente se registra con ctx.listen/ctx.later; dispose() los quita
//         (idempotente), así destroy() no deja fugas. Después de dispose, listen/later ya no registran nada.
//       · doc/win/timers/now son inyectables (pruebas con DOM falso y reloj falso).
//   Validadores (str, oneOf, flag, num, fn, children): lanzan TypeError con mensaje en español que empieza por el
//       nombre del componente. Props inválidas se rechazan en voz alta; el texto largo NO es inválido (se ajusta con CSS).
//   DOM: contains, focusables, setFlag, setAttr, toNodes, rovingKeys.
import { h as domH } from '../dom.js';

let seq = 0;
export const uid = (prefix) => `${prefix}-${(seq += 1)}`;

export const isNode = (v) => v !== null && typeof v === 'object' && typeof v.nodeType === 'number';

export function fail(comp, message) {
  throw new TypeError(`${comp}: ${message}`);
}

export function str(comp, name, value, { required = false, max = 2000, allowEmpty = false } = {}) {
  if (value === undefined || value === null) {
    if (required) fail(comp, `falta "${name}"`);
    return undefined;
  }
  if (typeof value !== 'string' && typeof value !== 'number') fail(comp, `"${name}" debe ser texto`);
  const s = String(value);
  if (required && !allowEmpty && s.trim() === '') fail(comp, `"${name}" no puede estar vacío`);
  if (s.length > max) fail(comp, `"${name}" es demasiado largo (${s.length} > ${max} caracteres)`);
  return s;
}

export function oneOf(comp, name, value, list, fallback) {
  if (value === undefined || value === null) return fallback;
  if (!list.includes(value)) fail(comp, `"${name}" debe ser uno de: ${list.join(', ')} (recibí ${JSON.stringify(value)})`);
  return value;
}

export function flag(comp, name, value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'boolean') fail(comp, `"${name}" debe ser verdadero o falso`);
  return value;
}

export function num(comp, name, value, { min = -Infinity, max = Infinity, fallback, integer = false } = {}) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(comp, `"${name}" debe ser un número finito`);
  if (integer && !Number.isInteger(value)) fail(comp, `"${name}" debe ser un entero`);
  if (value < min || value > max) fail(comp, `"${name}" debe estar entre ${min} y ${max} (recibí ${value})`);
  return value;
}

export function fn(comp, name, value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'function') fail(comp, `"${name}" debe ser una función`);
  return value;
}

// Aplana hijos (texto, nodos, arreglos anidados) a una lista de nodos; null/false se ignoran.
export function toNodes(ctx, comp, children) {
  const out = [];
  const walk = (child) => {
    if (child === null || child === undefined || child === false || child === true) return;
    if (Array.isArray(child)) child.forEach(walk);
    else if (isNode(child)) out.push(child);
    else if (typeof child === 'string' || typeof child === 'number') out.push(ctx.doc.createTextNode(String(child)));
    else fail(comp, 'los hijos deben ser texto, nodos del DOM o arreglos de ellos');
  };
  walk(children);
  return out;
}

export function makeCtx(comp, opts = {}) {
  if (opts === null || typeof opts !== 'object' || Array.isArray(opts)) fail(comp, 'las opciones deben ser un objeto');
  const doc = opts.doc ?? globalThis.document;
  if (!doc || typeof doc.createElement !== 'function') fail(comp, 'no hay documento (en pruebas pasa { doc })');
  const win = opts.win ?? doc.defaultView ?? globalThis.window ?? null;
  const { h, hs } = domH.with(doc);
  const timers = {
    setTimeout: opts.timers?.setTimeout ?? ((f, ms) => globalThis.setTimeout(f, ms)),
    clearTimeout: opts.timers?.clearTimeout ?? ((id) => globalThis.clearTimeout(id)),
  };
  const now = typeof opts.now === 'function' ? opts.now : () => Date.now();
  const removers = new Set();
  const pending = new Set();
  let alive = true;

  return {
    comp,
    doc,
    win,
    h,
    hs,
    now,
    timers,
    get alive() {
      return alive;
    },
    listen(target, type, handler, options) {
      if (!alive || !target) return () => {};
      target.addEventListener(type, handler, options);
      let on = true;
      const remove = () => {
        if (!on) return;
        on = false;
        target.removeEventListener(type, handler, options);
        removers.delete(remove);
      };
      removers.add(remove);
      return remove;
    },
    later(f, ms) {
      if (!alive) return 0;
      const id = timers.setTimeout(() => {
        pending.delete(id);
        if (alive) f();
      }, ms);
      pending.add(id);
      return id;
    },
    cancel(id) {
      timers.clearTimeout(id);
      pending.delete(id);
    },
    dispose() {
      if (!alive) return;
      alive = false;
      for (const r of [...removers]) r();
      for (const id of pending) timers.clearTimeout(id);
      pending.clear();
    },
  };
}

// ---------- DOM ----------
export function contains(root, node) {
  for (let n = node; n; n = n.parentNode) if (n === root) return true;
  return false;
}

const NATIVE_FOCUSABLE = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A']);

function isFocusable(el) {
  if (el.hasAttribute('disabled') || el.hasAttribute('hidden')) return false;
  const tab = el.getAttribute('tabindex');
  if (tab !== null && Number(tab) < 0) return false;
  if (tab !== null && Number(tab) >= 0) return true;
  if (el.tagName === 'A') return el.hasAttribute('href');
  if (el.tagName === 'INPUT' && el.getAttribute('type') === 'hidden') return false;
  return NATIVE_FOCUSABLE.has(el.tagName);
}

// Elementos enfocables dentro de root (orden del documento); ignora subárboles con [hidden].
export function focusables(root) {
  const out = [];
  const walk = (node) => {
    for (const child of node.children ?? []) {
      if (child.hasAttribute('hidden')) continue;
      if (isFocusable(child)) out.push(child);
      walk(child);
    }
  };
  walk(root);
  return out;
}

export function setFlag(el, className, on) {
  if (on) el.classList.add(className);
  else el.classList.remove(className);
}

export function setAttr(el, name, value) {
  if (value === null || value === undefined || value === false) el.removeAttribute(name);
  else el.setAttribute(name, value === true ? 'true' : String(value));
}

// Navegación con flechas entre elementos de un grupo (radiogroup, tablist). Roving tabindex lo aplica quien llama.
//   getItems() → botones habilitados en orden; activate(item) → los selecciona/enfoca.
export function rovingKeys(ctx, container, getItems, activate, { horizontal = true } = {}) {
  ctx.listen(container, 'keydown', (e) => {
    const items = getItems();
    if (items.length === 0) return;
    const current = items.indexOf(ctx.doc.activeElement ?? e.target);
    let next = null;
    const prevKeys = horizontal ? ['ArrowLeft', 'ArrowUp'] : ['ArrowUp'];
    const nextKeys = horizontal ? ['ArrowRight', 'ArrowDown'] : ['ArrowDown'];
    if (prevKeys.includes(e.key)) next = items[(current <= 0 ? items.length : current) - 1];
    else if (nextKeys.includes(e.key)) next = items[(current + 1) % items.length];
    else if (e.key === 'Home') next = items[0];
    else if (e.key === 'End') next = items[items.length - 1];
    if (!next) return;
    e.preventDefault?.();
    activate(next);
  });
}
