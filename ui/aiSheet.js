// @purpose: Hoja «Preguntas IA» (2.7-T3): sin IA invita a conectar la clave en Ajustes y ofrece «Llevar al chat», que copia el bloque o, si el portapapeles falla, lo muestra para copiarlo a mano.
// Va sobre createSheet, igual que las otras hojas: el ejercicio sigue montado debajo. Los textos viven en AI_TEXT para poder auditarlos (cadenas sin culpa, 2.6-T3).
// No implementa la IA (parte 5): con IA conectada avisa con honestidad que las preguntas dentro de la app llegan después y deja el mismo camino al chat.
//
//   createAiSheet({ source, getAnswer?, clipboard?, onOpen?, onClose?(motivo), doc?, container?, log? }) → { open(), close(), isOpen(), destroy() }
//     source      app/aiHelpSource.js: `status()` y `prepare(entry, { answer, message })`. El `entry` lo pone `getEntry`.
//     getEntry    () → el ítem del plan en pantalla.      getAnswer  () → lo que la persona lleva escrito o elegido (puede ser null).
//     clipboard   { writeText(texto) }; sin él o si falla se usa el cuadro seleccionable. Nunca un error mudo.
import { createSheet } from './components/index.js';
import { h as domH } from './dom.js';

export const AI_TEXT = Object.freeze({
  title: 'Preguntas IA',
  close: 'Cerrar',
  noKey: 'Conecta tu clave en Ajustes',
  noKeyMore: 'Así podrás preguntar aquí mismo. Mientras tanto, puedes llevar tu duda al chat.',
  busy: 'La IA no está disponible ahora mismo. Puedes llevar tu duda al chat.',
  ready: 'Tu IA está conectada. Las preguntas dentro de la app llegan en una próxima versión; por ahora puedes llevar tu duda al chat.',
  doubtLabel: 'Tu duda (opcional)',
  doubtHint: 'Escribe lo que quieres preguntar',
  bring: 'Llevar al chat',
  working: 'Preparando el bloque…',
  copied: 'Copiado. Pégalo en el chat.',
  manual: 'No se pudo copiar solo. Mantén pulsado el texto de abajo, elige «Copiar» y pégalo en el chat.',
  blockLabel: 'Bloque para el chat',
  failed: 'No pude preparar el bloque ahora. Puedes intentarlo otra vez en un momento.',
  keep: 'Tu ejercicio sigue como lo dejaste.',
});

export function createAiSheet({ source, getEntry, getAnswer, clipboard, onOpen, onClose, doc = globalThis.document, container, log = console.error } = {}) {
  if (!source || typeof source.status !== 'function' || typeof source.prepare !== 'function') throw new TypeError('aiSheet: "source" debe tener status() y prepare()');
  const { h } = domH.with(doc);
  let token = 0;
  let destroyed = false;
  let busy = false;

  const note = (text, extra = '') => h('p', { class: `ai__note text-sm text-muted ${extra}`.trim() }, text);
  const wrap = (...nodes) => h('div', { class: 'ai stack', 'aria-live': 'polite' }, ...nodes);

  const sheet = createSheet({
    title: AI_TEXT.title, closeLabel: AI_TEXT.close, doc, container,
    children: [wrap()],
    onOpen,
    onClose: (reason) => { token += 1; busy = false; onClose?.(reason); },
  });

  const safeStatus = () => { try { return source.status() ?? { available: false, reason: 'no_ai' }; } catch (e) { log('No se pudo leer el estado de la IA', e); return { available: false, reason: 'no_ai' }; } };

  function paint() {
    const st = safeStatus();
    const noKey = st.available !== true && (st.reason === 'no_ai' || st.reason === 'no_key' || st.reason === undefined || st.reason === null);
    const lead = st.available === true ? [note(AI_TEXT.ready)]
      : noKey ? [h('p', { class: 'ai__connect card__title' }, AI_TEXT.noKey), note(AI_TEXT.noKeyMore)]
        : [note(AI_TEXT.busy)];
    const field = h('textarea', { class: 'input ai__doubt', rows: 3, 'aria-label': AI_TEXT.doubtLabel, placeholder: AI_TEXT.doubtHint });
    const status = h('p', { class: 'ai__status text-sm', role: 'status' });
    const out = h('div', { class: 'ai__out' });
    const bring = h('button', { type: 'button', class: 'btn btn--primary btn--lg btn--block ai__bring', onClick: () => bringToChat({ field, status, out, bring }) }, AI_TEXT.bring);
    sheet.setContent(wrap(...lead, h('label', { class: 'ai__label text-sm' }, AI_TEXT.doubtLabel), field, bring, status, out));
  }

  async function bringToChat({ field, status, out, bring }) {
    if (destroyed || busy) return;
    busy = true;
    const mine = token;
    const live = () => !destroyed && mine === token;
    status.textContent = AI_TEXT.working;
    out.replaceChildren();
    try {
      let answer = null;
      try { answer = typeof getAnswer === 'function' ? getAnswer() : null; } catch (e) { log('No se pudo leer la respuesta del ejercicio', e); }
      const doubt = typeof field.value === 'string' ? field.value : '';
      const made = await source.prepare(typeof getEntry === 'function' ? getEntry() : null, { answer, message: doubt });
      if (!live()) return;
      if (!made?.ok || typeof made.text !== 'string') {
        log('No se pudo armar el bloque para el chat', made?.error);
        status.textContent = `${AI_TEXT.failed} ${AI_TEXT.keep}`;
        return;
      }
      try {
        if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('Portapapeles no disponible');
        await clipboard.writeText(made.text);
        if (live()) status.textContent = AI_TEXT.copied;
      } catch (e) {
        log('No se pudo copiar el bloque', e);
        if (!live()) return;
        const box = h('textarea', { class: 'input ai__block', readonly: true, rows: 8, 'aria-label': AI_TEXT.blockLabel });
        box.value = made.text;
        status.textContent = AI_TEXT.manual;
        out.replaceChildren(box);
        if (typeof box.select === 'function') { try { box.select(); } catch (err) { log('No se pudo seleccionar el bloque', err); } }
      }
    } catch (e) {
      log('No se pudo llevar al chat', e);
      if (live()) status.textContent = `${AI_TEXT.failed} ${AI_TEXT.keep}`;
    } finally {
      busy = false;
    }
  }

  function open() {
    if (destroyed || sheet.isOpen()) return false;
    paint();
    return sheet.open();
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
