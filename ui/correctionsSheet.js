// @purpose: Hoja «Correcciones» (2.7-T2): muestra los errores propios del ítem/tema con lo que escribió y la forma correcta, sin culpa; el ejercicio sigue montado debajo.
// Va sobre createSheet, igual que «Otros ejemplos». Los textos viven en CO_TEXT para poder auditarlos (cadenas sin culpa, 2.6-T3).
//
//   createCorrectionsSheet({ load, onOpen?, onClose?(motivo), doc?, container?, log? }) → { open(), close(), isOpen(), destroy() }
//     load()   Promesa de { corrections, count } (app/correctionsSource.js). Se llama en CADA apertura; si se cierra antes de que llegue, se ignora.
//     Si load falla: aviso amable, el motivo va a `log` y el ejercicio queda como estaba.
import { createSheet } from './components/index.js';
import { h as domH } from './dom.js';

export const CO_TEXT = Object.freeze({
  title: 'Correcciones',
  close: 'Cerrar',
  loading: 'Buscando tus correcciones…',
  intro: 'Cosas que ya trabajaste en este tema, para tenerlas a mano.',
  none: 'Todavía no tienes correcciones de este tema. Cuando aparezcan, las verás aquí.',
  wrote: 'Escribiste',
  better: 'Mejor',
  times: 'Ha salido {n} veces',
  failed: 'No pude buscar tus correcciones ahora. Puedes volver a abrir esta hoja en un momento.',
  keep: 'Tu ejercicio sigue como lo dejaste.',
});

export function createCorrectionsSheet({ load, onOpen, onClose, doc = globalThis.document, container, log = console.error } = {}) {
  if (typeof load !== 'function') throw new TypeError('correctionsSheet: "load" debe ser una función');
  const { h } = domH.with(doc);
  let token = 0;
  let destroyed = false;

  const wrap = (...nodes) => h('div', { class: 'corrections stack', 'aria-live': 'polite' }, ...nodes);
  const note = (text) => h('p', { class: 'corrections__note text-sm text-muted' }, text);

  const sheet = createSheet({
    title: CO_TEXT.title, closeLabel: CO_TEXT.close, doc, container,
    children: [wrap(note(CO_TEXT.loading))],
    onOpen,
    onClose: (reason) => { token += 1; onClose?.(reason); },
  });

  function paint(result) {
    const list = Array.isArray(result?.corrections) ? result.corrections.filter((c) => c && typeof c.original === 'string') : [];
    const nodes = [note(CO_TEXT.intro)];
    if (list.length === 0) nodes.push(h('p', { class: 'corrections__empty' }, CO_TEXT.none));
    else {
      nodes.push(h('ul', { class: 'corrections__list' }, ...list.map((c) => h('li', { class: 'corrections__item' },
        c.title ? h('p', { class: 'corrections__title' }, c.title) : null,
        h('p', { class: 'corrections__wrote', lang: 'en' }, h('span', { class: 'text-sm text-muted' }, `${CO_TEXT.wrote}: `), c.original),
        c.correction ? h('p', { class: 'corrections__better', lang: 'en' }, h('span', { class: 'text-sm text-muted' }, `${CO_TEXT.better}: `), c.correction) : null,
        c.hint ? h('p', { class: 'corrections__hint text-sm text-muted', lang: 'es' }, c.hint) : null,
        c.count > 1 ? h('p', { class: 'corrections__times text-sm text-muted' }, CO_TEXT.times.replace('{n}', String(c.count))) : null))));
    }
    sheet.setContent(wrap(...nodes));
  }

  async function open() {
    if (destroyed || sheet.isOpen()) return false;
    sheet.setContent(wrap(note(CO_TEXT.loading)));
    if (!sheet.open()) return false;
    const mine = token;
    let result;
    try { result = await load(); } catch (e) {
      log('No se pudieron buscar las correcciones', e);
      if (!destroyed && mine === token) sheet.setContent(wrap(h('p', { class: 'corrections__empty' }, CO_TEXT.failed), note(CO_TEXT.keep)));
      return true;
    }
    if (!destroyed && mine === token) paint(result);
    return true;
  }

  return Object.freeze({
    open,
    close: () => sheet.close(),
    isOpen: () => sheet.isOpen(),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      token += 1;
      sheet.destroy();
    },
  });
}
