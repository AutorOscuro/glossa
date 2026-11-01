// @purpose: Barra de insignias de la tarjeta de ejercicio (Nivel N con hoja explicativa, New, Repaso en, corazón de favorita) conectada a las acciones de tarjeta.
// Barra de insignias (subparte 2.2, tramo 3). Roadmap 7.7 y 8.4.
//
//   createCardBar({ cards, cardId, doc?, win?, timers?, now? }) → { el, refresh({ dueLabel? }?), getCard(), destroy() }
//     cards = acciones de tarjeta (app/cardActions.js: read, setFav). Lee la tarjeta UNA vez al crear y dibuja: `Nivel N (?)`, `New` (solo si la tarjeta nunca se respondió),
//     `Repaso en …` (si ya se respondió) y el corazón (botón con aria-pressed; guarda `fav`). Sin tarjeta legible, la barra se oculta y no estorba.
//     refresh({ dueLabel }) vuelve a leer la tarjeta (tras responder) y, si llega `dueLabel` de la calificación, esa es la etiqueta «Repaso en …».
//     El corazón no usa `lockMs` (un botón reutilizado ignoraría el toque siguiente): se desactiva mientras guarda y, si falla, vuelve a su estado y avisa.
//     Todo texto entra como nodo de texto; destroy() es idempotente y cierra la hoja.
import { makeCtx } from '../components/_shared.js';
import { createBadge } from '../components/badge.js';
import { createSheet } from '../components/sheet.js';
import { badgesOf, levelHelp } from '../../core/cardBadges.js';

export const BAR_TEXT = Object.freeze({
  group: 'Estado de la tarjeta',
  favOn: 'Quitar de favoritas',
  favOff: 'Marcar como favorita',
  favFail: 'No se pudo guardar la favorita. Inténtalo otra vez.',
  here: 'Tu tarjeta está aquí',
  review: (label) => label,
});

export function createCardBar(options = {}) {
  const { cards, cardId } = options;
  if (!cards || typeof cards.read !== 'function') throw new TypeError('cardBar: faltan las acciones de tarjeta');
  if (typeof cardId !== 'string' || cardId === '') throw new TypeError('cardBar: falta cardId');
  const c = makeCtx('cardBar', options);
  const { h } = c;
  const nowFn = typeof options.now === 'function' ? options.now : () => (typeof cards.now === 'function' ? cards.now() : new Date());

  const el = h('div', { class: ['pc__badges', 'pc__badges--loading'], role: 'group', 'aria-label': BAR_TEXT.group });
  const note = h('p', { class: 'pc__badges-note', role: 'status', 'aria-live': 'polite' });
  const wrap = h('div', { class: 'pc__bar' }, el, note);
  let card = null;
  let dueOverride = null;
  let destroyed = false;
  let saving = false;
  let sheet = null;
  let pieces = [];
  let heart = null;

  function dropPieces() {
    for (const p of pieces) { try { p.destroy(); } catch { /* limpieza */ } }
    pieces = [];
  }

  function openHelp() {
    const info = levelHelp();
    const current = badgesOf(card, nowFn())?.level ?? null;
    const list = h('ul', { class: 'pc__levels' }, info.levels.map((l) => h('li', { class: ['pc__level', l.level === current ? 'pc__level--now' : null] },
      h('strong', {}, `Nivel ${l.level}: `), l.text, l.level === current ? h('span', { class: 'pc__level-here' }, ` (${BAR_TEXT.here})`) : null)));
    const kids = [h('p', {}, info.intro), list];
    if (!sheet) sheet = createSheet({ doc: c.doc, win: c.win, title: info.title, children: kids, container: c.doc.body });
    else sheet.setContent(...kids);
    sheet.open();
  }

  function setHeartBusy(on) {
    if (on) heart.setAttribute('disabled', ''); else heart.removeAttribute('disabled');
  }

  function paintHeart(fav) {
    heart.setAttribute('aria-pressed', fav ? 'true' : 'false');
    heart.setAttribute('aria-label', fav ? BAR_TEXT.favOn : BAR_TEXT.favOff);
    heart.textContent = fav ? '\u2665' : '\u2661';
    if (fav) heart.classList.add('pc__fav--on'); else heart.classList.remove('pc__fav--on');
  }

  async function toggleFav() {
    if (saving || destroyed || !card) return;
    saving = true;
    setHeartBusy(true);
    note.textContent = '';
    let r;
    try { r = await cards.setFav(cardId, !(card.fav === true)); } catch { r = { status: 'error' }; }
    if (destroyed) return;
    saving = false;
    setHeartBusy(false);
    if (r && r.status === 'saved' && r.card) { card = r.card; paintHeart(card.fav === true); } else note.textContent = BAR_TEXT.favFail;
  }

  function render() {
    dropPieces();
    const b = badgesOf(card, nowFn());
    el.classList.remove('pc__badges--loading');
    if (!b) { wrap.hidden = true; return; }
    wrap.hidden = false;
    el.replaceChildren();
    const level = createBadge({ doc: c.doc, kind: 'level', level: b.level, onHelp: () => openHelp() });
    pieces.push(level);
    el.appendChild(level.el);
    const due = dueOverride ?? b.due;
    if (b.isNew && !dueOverride) {
      const nb = createBadge({ doc: c.doc, kind: 'new' });
      pieces.push(nb);
      el.appendChild(nb.el);
    } else if (due) {
      const rb = createBadge({ doc: c.doc, kind: 'review', text: BAR_TEXT.review(due) });
      pieces.push(rb);
      el.appendChild(rb.el);
    }
    heart = h('button', { type: 'button', class: 'pc__fav' });
    paintHeart(b.fav);
    c.listen(heart, 'click', () => { toggleFav(); });
    el.appendChild(heart);
  }

  async function load() {
    let read = null;
    try { read = await cards.read(cardId); } catch { read = null; }
    if (destroyed) return;
    card = read && typeof read === 'object' ? read : card;
    render();
  }
  const ready = load();

  return {
    el: wrap,
    ready,
    getCard: () => card,
    async refresh({ dueLabel } = {}) {
      await ready;
      if (destroyed) return;
      dueOverride = typeof dueLabel === 'string' && dueLabel.trim() !== '' ? dueLabel : null;
      let read = null;
      try { read = await cards.read(cardId); } catch { read = null; }
      if (destroyed) return;
      if (read && typeof read === 'object') card = read;
      render();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      dropPieces();
      if (sheet) { try { sheet.destroy(); } catch { /* limpieza */ } sheet = null; }
      c.dispose();
      if (typeof wrap.remove === 'function') wrap.remove();
    },
  };
}
