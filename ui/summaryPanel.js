// @purpose: Panel del resumen de sesión (2.8-T2, punto 3): dibuja lo que decide core/summaryText.js (cifras, dominio con confianza, errores con microexplicación, repasos y acciones); no calcula nada.
// Roadmap 2.8. Toda decisión de QUÉ se dice vive en `describeSummary`; aquí solo se dibuja. Sin innerHTML: todo texto entra como nodo de texto.
//
//   createSummaryPanel({ content, onRetry?, onChat?, onBack?, doc? }) → { el, retryButton, chatButton, backButton, destroy() }
//     content   resultado de `describeSummary(...)` (core/summaryText.js). Si no lo es, se dibuja el de «sin respuestas».
//     onRetry   «Repetir los que fallé»: el botón solo existe si hay `content.actions.retry` Y se pasó `onRetry` (no se ofrece lo que no puede funcionar).
//     onChat    «Llevar al chat» (2.8-T3): async () → { status:'copied' } | { status:'manual', text } | { status:'failed' }. El botón solo existe si hay `content.actions.chat` Y se pasó `onChat`.
//               El panel dice cómo salió: «Copiado», o el bloque en un cuadro para copiarlo a mano, o un aviso sin culpa. Un segundo toque mientras se prepara se ignora.
//     onBack    «Volver a Practicar»: el botón solo existe si se pasó. Si una función lanza, se anota y el panel sigue vivo.
//   Estructura: <section class="summary"> con título (h2), mensaje, cifras (lista de definiciones), desglose, y las secciones de dominio, errores
//   y repasos solo cuando tienen algo que mostrar. Los textos en inglés llevan lang="en". Nada en el panel usa solo el color para decir algo.
import { createButton } from './components/index.js';
import { h as domH } from './dom.js';
import { describeSummary, SUMMARY_TEXT } from '../core/summaryText.js';

export const SP_TEXT = Object.freeze({
  masteryTitle: 'Tu dominio por tema',
  freshTitle: 'Nuevo hoy',
  recurrentTitle: 'Vuelve a aparecer',
  errorsTitle: 'Para afinar',
  errorsIntro: 'Cosas que conviene practicar, con la pista para cada una.',
  reviewsTitle: 'Próximos repasos',
  back: 'Volver a Practicar',
  chatWorking: 'Preparando el bloque…',
  chatCopied: 'Copiado. Pégalo en el chat.',
  chatManual: 'No se pudo copiar solo. Mantén pulsado el texto de abajo, elige «Copiar» y pégalo en el chat.',
  chatFailed: 'No pude preparar el bloque ahora. Puedes intentarlo otra vez en un momento.',
  chatBlock: 'Bloque para el chat',
  topics: 'Temas',
  group: 'Resumen de la sesión',
});

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const list = (v) => (Array.isArray(v) ? v : []);
const str = (v) => (typeof v === 'string' && v !== '' ? v : null);

export function createSummaryPanel({ content, onRetry, onChat, onBack, doc = globalThis.document } = {}) {
  if (onChat !== undefined && typeof onChat !== 'function') throw new TypeError('summaryPanel: "onChat" debe ser una función');
  if (onRetry !== undefined && typeof onRetry !== 'function') throw new TypeError('summaryPanel: "onRetry" debe ser una función');
  if (onBack !== undefined && typeof onBack !== 'function') throw new TypeError('summaryPanel: "onBack" debe ser una función');
  const { h } = domH.with(doc);
  const c = isObj(content) && str(content.kind) && isObj(content.mastery) && isObj(content.errors) && isObj(content.reviews) ? content : describeSummary(null);
  const safe = (fn) => () => { try { fn(); } catch (e) { console.error('No se pudo completar la acción del resumen', e); } };

  const section = (cls, title, ...nodes) => h('section', { class: `summary__section ${cls}` }, h('h3', { class: 'summary__heading' }, title), ...nodes);

  const stats = list(c.stats).filter((s) => isObj(s) && str(s.label) && str(s.value));
  const statsEl = stats.length === 0 ? null : h('dl', { class: 'summary__stats' }, ...stats.map((s) => h('div', { class: `summary__stat summary__stat--${s.id}` },
    h('dt', { class: 'summary__stat-label text-sm text-muted' }, s.label),
    h('dd', { class: 'summary__stat-value' }, s.value))));

  const breakdown = list(c.breakdown).filter((b) => isObj(b) && str(b.text));
  const breakdownEl = breakdown.length === 0 ? null : h('ul', { class: 'summary__breakdown text-sm' }, ...breakdown.map((b) => h('li', { class: 'summary__chip' }, b.text)));

  const mLines = list(c.mastery.lines).filter((l) => isObj(l) && str(l.text));
  const mMore = Number.isInteger(c.mastery.more) && c.mastery.more > 0 ? c.mastery.more : 0;
  const masteryEl = mLines.length === 0 ? null : section('summary__mastery', SP_TEXT.masteryTitle,
    h('ul', { class: 'summary__list' }, ...mLines.map((l) => h('li', { class: 'summary__item' }, l.text))),
    mMore > 0 ? h('p', { class: 'summary__more text-sm text-muted' }, SUMMARY_TEXT.moreTopics(mMore)) : null);

  const errorItem = (e) => h('li', { class: 'summary__error' },
    str(e.title) ? h('p', { class: 'summary__error-title' }, e.title) : null,
    h('p', { class: 'summary__error-text', lang: 'en' }, e.text),
    str(e.hint) ? h('p', { class: 'summary__error-hint text-sm', lang: 'es' }, e.hint) : null,
    str(e.note) ? h('p', { class: 'summary__error-note text-sm text-muted' }, e.note) : null,
    list(e.topics).length > 0 ? h('p', { class: 'summary__error-topics text-sm text-muted' }, `${SP_TEXT.topics}: ${list(e.topics).join(', ')}`) : null);
  const group = (title, items) => (items.length === 0 ? null : h('div', { class: 'summary__errgroup' },
    h('h4', { class: 'summary__subheading' }, title), h('ul', { class: 'summary__errors' }, ...items.map(errorItem))));
  const fresh = list(c.errors.fresh).filter((e) => isObj(e) && str(e.text));
  const recurrent = list(c.errors.recurrent).filter((e) => isObj(e) && str(e.text));
  const eMore = Number.isInteger(c.errors.more) && c.errors.more > 0 ? c.errors.more : 0;
  const errorsEl = fresh.length + recurrent.length === 0 ? null : section('summary__errsection', SP_TEXT.errorsTitle,
    h('p', { class: 'summary__intro text-sm text-muted' }, SP_TEXT.errorsIntro),
    group(SP_TEXT.recurrentTitle, recurrent), group(SP_TEXT.freshTitle, fresh),
    eMore > 0 ? h('p', { class: 'summary__more text-sm text-muted' }, SUMMARY_TEXT.moreErrors(eMore)) : null);

  const rLines = list(c.reviews.lines).filter(str);
  const rUnknown = str(c.reviews.unknown);
  const reviewsEl = rLines.length === 0 && !rUnknown ? null : section('summary__reviews', SP_TEXT.reviewsTitle,
    h('ul', { class: 'summary__list' }, ...rLines.map((t) => h('li', { class: 'summary__item' }, t)), rUnknown ? h('li', { class: 'summary__item text-muted' }, rUnknown) : null));

  const retry = isObj(c.actions) && isObj(c.actions.retry) && str(c.actions.retry.label) && onRetry ? c.actions.retry : null;
  const chat = isObj(c.actions) && isObj(c.actions.chat) && str(c.actions.chat.label) && onChat ? c.actions.chat : null;
  const retryBtn = retry ? createButton({ label: retry.label, variant: 'primary', size: 'lg', block: true, doc, onClick: safe(() => onRetry(retry.count)) }) : null;
  const chatStatus = chat ? h('p', { class: 'summary__chat-status text-sm', role: 'status' }) : null;
  const chatOut = chat ? h('div', { class: 'summary__chat-out' }) : null;
  let destroyed = false;
  let bringing = false;
  const bringToChat = async () => {
    if (destroyed || bringing) return;
    bringing = true;
    chatOut.replaceChildren();
    chatStatus.textContent = SP_TEXT.chatWorking;
    let r = null;
    try { r = await onChat(); } catch (e) { console.error('No se pudo llevar el resumen al chat', e); }
    bringing = false;
    if (destroyed) return;
    if (r?.status === 'copied') chatStatus.textContent = SP_TEXT.chatCopied;
    else if (r?.status === 'manual' && str(r.text)) {
      const box = h('textarea', { class: 'input summary__chat-block', readonly: true, rows: 8, 'aria-label': SP_TEXT.chatBlock });
      box.value = r.text;
      chatStatus.textContent = SP_TEXT.chatManual;
      chatOut.replaceChildren(box);
      if (typeof box.select === 'function') { try { box.select(); } catch (e) { console.error('No se pudo seleccionar el bloque', e); } }
    } else chatStatus.textContent = SP_TEXT.chatFailed;
  };
  const chatBtn = chat ? createButton({ label: chat.label, variant: retryBtn ? 'secondary' : 'primary', size: 'lg', block: true, doc, onClick: () => { bringToChat(); } }) : null;
  const backBtn = onBack ? createButton({ label: SP_TEXT.back, variant: retryBtn || chatBtn ? 'secondary' : 'primary', size: 'lg', block: true, doc, onClick: safe(() => onBack()) }) : null;
  const actionsEl = retryBtn || chatBtn || backBtn ? h('div', { class: 'summary__actions stack' }, retryBtn?.el, chatBtn?.el, chatStatus, chatOut, backBtn?.el) : null;

  const el = h('section', { class: `summary summary--${c.kind} stack`, 'aria-label': SP_TEXT.group },
    h('h2', { class: 'summary__title card__title' }, c.title),
    h('p', { class: 'summary__message' }, c.message),
    statsEl, breakdownEl, masteryEl, errorsEl, reviewsEl, actionsEl);

  return Object.freeze({
    el,
    retryButton: retryBtn,
    chatButton: chatBtn,
    backButton: backBtn,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const b of [retryBtn, chatBtn, backBtn]) { try { b?.destroy(); } catch (e) { console.error('No se pudo limpiar el resumen', e); } }
      el.remove();
    },
  });
}
