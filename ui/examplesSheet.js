// @purpose: Hoja «Otros ejemplos» (2.7-T1): carga la lista al abrir, la muestra en inglés con traducción si la hay y avisa con honestidad si hay menos de 3.
// Va sobre createSheet: el ejercicio sigue montado debajo y no se toca (CA 1 de 2.7). Los textos viven en EX_TEXT para poder auditarlos (cadenas sin culpa, 2.6-T3).
//
//   createExamplesSheet({ load, onOpen?, onClose?(motivo), doc?, container?, log? }) → { open(), close(), isOpen(), destroy() }
//     load()   Promesa del resultado de collectExamples ({ examples, enough, count, … }). Se llama en CADA apertura; si se cierra antes de que llegue, se ignora.
//     open()   abre y pinta «Buscando…»; después la lista, el aviso de «solo hay N» o el de «no hay». Un segundo open() con la hoja abierta no hace nada.
//     Si load falla: aviso amable, el motivo va a `log` y el ejercicio queda como estaba.
import { createSheet } from './components/index.js';
import { h as domH } from './dom.js';

export const EX_TEXT = Object.freeze({
  title: 'Otros ejemplos',
  close: 'Cerrar',
  loading: 'Buscando ejemplos…',
  intro: 'Frases del mismo tema, para que veas el patrón en otros contextos.',
  none: 'Todavía no hay ejemplos de este tema en tu paquete.',
  fewOne: 'Por ahora solo hay 1 ejemplo de este tema en tu paquete.',
  fewMany: 'Por ahora solo hay {n} ejemplos de este tema en tu paquete.',
  failed: 'No pude buscar ejemplos ahora. Puedes volver a abrir esta hoja en un momento.',
  keep: 'Tu ejercicio sigue como lo dejaste.',
});

export function createExamplesSheet({ load, onOpen, onClose, doc = globalThis.document, container, log = console.error } = {}) {
  if (typeof load !== 'function') throw new TypeError('examplesSheet: "load" debe ser una función');
  const { h } = domH.with(doc);
  let token = 0;
  let destroyed = false;

  const wrap = (...nodes) => h('div', { class: 'examples stack', 'aria-live': 'polite' }, ...nodes);
  const note = (text) => h('p', { class: 'examples__note text-sm text-muted' }, text);

  const sheet = createSheet({
    title: EX_TEXT.title, closeLabel: EX_TEXT.close, doc, container,
    children: [wrap(note(EX_TEXT.loading))],
    onOpen,
    onClose: (reason) => { token += 1; onClose?.(reason); },
  });

  function paint(result) {
    const list = Array.isArray(result?.examples) ? result.examples.filter((e) => e && typeof e.en === 'string') : [];
    const nodes = [note(EX_TEXT.intro)];
    if (list.length === 0) nodes.push(h('p', { class: 'examples__empty' }, EX_TEXT.none));
    else {
      nodes.push(h('ul', { class: 'examples__list' }, ...list.map((ex) => h('li', { class: 'examples__item' },
        h('p', { class: 'examples__en', lang: 'en' }, ex.en),
        typeof ex.es === 'string' && ex.es !== '' ? h('p', { class: 'examples__es text-sm text-muted', lang: 'es' }, ex.es) : null))));
      if (result.enough === false) nodes.push(h('p', { class: 'examples__empty' }, list.length === 1 ? EX_TEXT.fewOne : EX_TEXT.fewMany.replace('{n}', String(list.length))));
    }
    sheet.setContent(wrap(...nodes));
  }

  async function open() {
    if (destroyed || sheet.isOpen()) return false;
    sheet.setContent(wrap(note(EX_TEXT.loading)));
    if (!sheet.open()) return false;
    const mine = token;
    let result;
    try { result = await load(); } catch (e) {
      log('No se pudieron buscar los ejemplos', e);
      if (!destroyed && mine === token) sheet.setContent(wrap(h('p', { class: 'examples__empty' }, EX_TEXT.failed), note(EX_TEXT.keep)));
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
