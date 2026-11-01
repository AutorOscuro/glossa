// @purpose: Componente de construir con piezas por toques (2.4-T3, punto 3): letras desordenadas y frases con palabras clave; bandeja fija con piezas de más, deshacer, reiniciar, «No sé» siempre a la vista y corrección.
// Componente `unscramble_letters` y `build_from_keywords` (subparte 2.4, tramo 3). Contrato del componente (roadmap 8.9 y ficha «2.1-T4» de docs/CONTRACTS.md):
//   createBuildPieces(opciones).mount(container, item, ctx) → { el, destroy(), getResponse() }
//
// Este punto NO registra los tipos en app/main.js y NO trae CSS (eso es el punto 4); sin CSS la pantalla funciona pero se ve cruda.
// Opciones de createBuildPieces (todas opcionales):
//   rng    azar con shuffle (core/rng.js); por defecto el del sistema. La bandeja se baraja en CADA montaje (si no, se memorizaría la posición).
//   lang   'en'. Idioma de las piezas (lang), para el lector de pantalla.
//   log    console.error. Recibe los fallos al pintar la corrección (la respuesta ya quedó guardada).
//
// Datos que usa: item.prompt_es (obligatorio), item.situation, item.data.{pieces, extra_pieces, shuffle}, item.accept (contrato en core/buildPieces.js).
// Interacción solo por toques: tocar una pieza de la bandeja la coloca al final; tocar una pieza colocada la quita. Las piezas de la bandeja NO cambian de
// sitio al colocarse (quedan marcadas como usadas). Las piezas de más (`extra_pieces`) se muestran igual que las demás: no se distinguen a simple vista.
// «Comprobar» exige al menos tantas piezas puestas como tiene la respuesta (si no, avisa y no envía); «No sé» está siempre a la vista mientras se responde.
// Envío: ctx.submit({ result, hint: false, responseRaw, errorCodes: [] }) con «Comprobar»; ctx.submit({ result: 'dont_know', dontKnow: true, hint: false }) con «No sé».
// Si submit devuelve error, el ejercicio se desbloquea y avisa. Todo texto entra con h() como nodo de texto (nunca HTML). Las marcas ✓ y ✗ llevan texto.
import { makeCtx, uid, setAttr, setFlag } from '../components/_shared.js';
import { createButton } from '../components/button.js';
import { readBuild, gradeBuild, createBuildState } from '../../core/buildPieces.js';
import { placeBlock, removeBlock, undoLast, resetOrder, bankOf } from '../../core/orderBlocks.js';
import { systemRng } from '../../core/rng.js';
import { feedbackNodes } from '../feedbackPanel.js';
import { reportFor } from '../reportMenu.js';
import { whyFor } from '../whyNote.js';
import { toResponseRaw } from '../../core/responseText.js';

export const BP_TEXT = Object.freeze({
  situation: 'Situación',
  instructionLetters: 'Toca las piezas para formar la palabra.',
  instructionWords: 'Toca las piezas para formar la frase.',
  lineLabelLetters: 'Tu palabra',
  lineLabelWords: 'Tu frase',
  lineEmptyLetters: 'Aquí aparece tu palabra.',
  lineEmptyWords: 'Aquí aparece tu frase.',
  trayLabel: 'Piezas',
  undo: 'Deshacer',
  reset: 'Empezar de nuevo',
  check: 'Comprobar',
  dontKnow: 'No sé',
  incomplete: 'Faltan piezas. Coloca más o toca «No sé».',
  saveFail: 'No se pudo guardar. Inténtalo otra vez.',
  correct: '¡Bien!',
  wrongLetters: 'Todavía no. Así se forma la palabra:',
  wrongWords: 'Todavía no. Así va la frase:',
  dontLetters: 'No pasa nada: así se forma la palabra:',
  dontWords: 'No pasa nada: así va la frase:',
  flagOff: '✗ Fuera de lugar',
  flagOk: '✓ En su lugar',
  flagExtra: '✗ Sobra',
  misplaced: (list) => `Fuera de lugar (posición ${list}).`,
  extraUsed: (list) => `Sobra: ${list}.`,
  placedName: (n, text) => `Posición ${n}: ${text}. Toca para quitarla.`,
  usedName: (text) => `${text} (ya colocada)`,
});

function need(cond, message) {
  if (!cond) throw new TypeError(`build_pieces: ${message}`);
}

export function createBuildPieces(options = {}) {
  const opts = options && typeof options === 'object' && !Array.isArray(options) ? options : {};
  if (opts.rng !== undefined) need(opts.rng && typeof opts.rng.shuffle === 'function', 'rng debe tener una función shuffle (core/rng.js)');
  need(opts.lang === undefined || (typeof opts.lang === 'string' && /^[a-z]{2,3}$/.test(opts.lang)), 'lang debe ser un código de idioma como "en" o "es"');
  const rng = opts.rng ?? systemRng;
  const lang = opts.lang ?? 'en';
  const log = typeof opts.log === 'function' ? opts.log : console.error;

  return Object.freeze({
    mount(container, item, ctx = {}) {
      need(container && typeof container.appendChild === 'function', 'falta el contenedor');
      need(item && typeof item === 'object' && typeof item.type === 'string' && item.type !== '', 'el ítem no tiene tipo');
      need(typeof item.prompt_es === 'string' && item.prompt_es.trim() !== '', 'falta prompt_es');
      const read = readBuild(item);
      need(read.ok, `el ítem de construir no es válido (${read.reason})`);

      const letters = item.type === 'unscramble_letters';
      const c = makeCtx('build_pieces', { doc: container.ownerDocument ?? ctx.doc, win: ctx.win });
      const { h } = c;
      const promptId = uid('bp-prompt');
      let state = createBuildState(item, { rng });
      const label = (i) => read.all[i].trim();
      const textOf = (placed) => placed.map(label).join(read.joiner);

      const emptyEl = h('p', { class: 'bp__empty', 'aria-hidden': 'true' }, letters ? BP_TEXT.lineEmptyLetters : BP_TEXT.lineEmptyWords);
      const spacerEl = h('span', { class: 'bp__spacer', 'aria-hidden': 'true' }, '\u00A0');
      const lineEl = h('div', { class: ['bp__line', letters ? 'bp__line--letters' : 'bp__line--words'], role: 'group', 'aria-label': letters ? BP_TEXT.lineLabelLetters : BP_TEXT.lineLabelWords }, emptyEl, spacerEl);
      // La bandeja se pinta UNA vez, en su orden fijo: colocar o quitar solo cambia las marcas, no el sitio.
      const trayEls = state.tray.map((i) => h('button', { type: 'button', class: 'bp__piece', lang, dataset: { index: i } }, label(i)));
      const trayEl = h('div', { class: 'bp__tray', role: 'group', 'aria-label': BP_TEXT.trayLabel }, trayEls);
      const msg = h('p', { class: 'bp__msg', role: 'status', 'aria-live': 'polite' });
      const feedback = h('div', { class: 'bp__feedback', 'aria-live': 'polite' });
      const undoBtn = createButton({ doc: c.doc, label: BP_TEXT.undo, variant: 'secondary', onClick: () => act(undoLast) });
      const resetBtn = createButton({ doc: c.doc, label: BP_TEXT.reset, variant: 'secondary', onClick: () => act(resetOrder) });
      const checkBtn = createButton({ doc: c.doc, label: BP_TEXT.check, variant: 'primary', size: 'lg', onClick: () => check() });
      const dontBtn = createButton({ doc: c.doc, label: BP_TEXT.dontKnow, variant: 'ghost', size: 'lg', onClick: () => dontKnow() });
      const buttons = [undoBtn, resetBtn, checkBtn, dontBtn];
      const tools = h('div', { class: 'bp__tools' }, undoBtn.el, resetBtn.el);
      const actions = h('div', { class: 'bp__actions' }, msg, h('div', { class: 'bp__buttons' }, checkBtn.el, dontBtn.el));

      const el = h('article', { class: 'bp', dataset: { type: item.type } },
        typeof item.situation === 'string' && item.situation.trim() ? h('p', { class: 'bp__situation' }, `${BP_TEXT.situation}: ${item.situation}`) : null,
        h('p', { class: 'bp__prompt', id: promptId, lang: 'es' }, item.prompt_es),
        h('p', { class: 'bp__instruction' }, letters ? BP_TEXT.instructionLetters : BP_TEXT.instructionWords),
        lineEl, tools, trayEl, actions, feedback);
      container.appendChild(el);

      let phase = 'answering'; // answering → sending → done
      let lastResponse = null;
      let destroyed = false;
      let placedEls = [];

      function render() {
        for (const e of placedEls) { try { e.remove(); } catch { /* limpieza */ } }
        placedEls = state.placed.map((i, pos) => {
          const b = h('button', { type: 'button', class: 'bp__piece bp__piece--placed', lang, dataset: { index: i }, 'aria-label': BP_TEXT.placedName(pos + 1, label(i)) }, label(i));
          c.listen(b, 'click', () => act((s) => removeBlock(s, i)));
          lineEl.appendChild(b);
          return b;
        });
        setFlag(emptyEl, 'is-hidden', state.placed.length > 0);
        for (const e of [emptyEl, spacerEl]) { if (state.placed.length > 0) e.setAttribute('hidden', ''); else e.removeAttribute('hidden'); }
        const free = new Set(bankOf(state));
        for (const b of trayEls) {
          const idx = Number(b.dataset.index);
          const used = !free.has(idx);
          setFlag(b, 'is-used', used);
          setAttr(b, 'aria-disabled', used ? 'true' : null);
          b.setAttribute('aria-label', used ? BP_TEXT.usedName(label(idx)) : label(idx));
        }
        undoBtn.setDisabled(phase !== 'answering' || state.history.length === 0);
        resetBtn.setDisabled(phase !== 'answering' || state.placed.length === 0);
      }

      function act(fn) {
        if (phase !== 'answering') return;
        const next = fn(state);
        if (next === state) return;
        state = next;
        msg.textContent = '';
        render();
      }

      for (const b of trayEls) c.listen(b, 'click', () => {
        const i = Number(b.dataset.index);
        const before = state;
        act((s) => placeBlock(s, i));
        if (state !== before) {
          const nextFree = trayEls.find((e) => !e.getAttribute('aria-disabled'));
          if (nextFree && typeof nextFree.focus === 'function') nextFree.focus();
        }
      });

      function lock(on) {
        setFlag(el, 'is-locked', on);
        for (const b of [...trayEls, ...placedEls]) setAttr(b, 'aria-disabled', on ? 'true' : (trayEls.includes(b) && !bankOf(state).includes(Number(b.dataset.index)) ? 'true' : null));
        for (const b of [checkBtn, dontBtn]) b.setDisabled(on);
        undoBtn.setDisabled(on || state.history.length === 0);
        resetBtn.setDisabled(on || state.placed.length === 0);
      }

      function paintFeedback(res, dont) {
        actions.setAttribute('hidden', '');
        undoBtn.setDisabled(true);
        resetBtn.setDisabled(true);
        const bad = new Set(res.misplaced);
        const extra = new Set(res.usedExtra);
        const judged = !dont && res.result === 'wrong';
        placedEls.forEach((b, pos) => {
          const isExtra = judged && extra.has(state.placed[pos]);
          const off = bad.has(pos);
          setFlag(b, 'bp__piece--off', off || isExtra);
          setFlag(b, 'bp__piece--ok', judged && res.complete && res.usedExtra.length === 0 && !off);
          if (isExtra) b.setAttribute('aria-label', `${label(state.placed[pos])} ${BP_TEXT.flagExtra}`);
          else if (judged && res.complete && res.usedExtra.length === 0) b.setAttribute('aria-label', `${BP_TEXT.placedName(pos + 1, label(state.placed[pos])).replace(' Toca para quitarla.', '')} ${off ? BP_TEXT.flagOff : BP_TEXT.flagOk}`);
        });
        // Veredicto, solución y notas del ítem: panel común (2.6-T1). Construir piezas es binario: nunca «casi».
        const verdict = dont ? (letters ? BP_TEXT.dontLetters : BP_TEXT.dontWords) : res.result === 'correct' ? BP_TEXT.correct : (letters ? BP_TEXT.wrongLetters : BP_TEXT.wrongWords);
        const answer = !dont && res.result === 'correct' ? null : h('p', { class: 'bp__correct' }, h('strong', { lang }, read.solution));
        const before = [];
        if (judged && res.misplaced.length > 0) before.push(h('p', { class: 'bp__misplaced' }, BP_TEXT.misplaced(res.misplaced.map((p) => p + 1).join(', '))));
        if (judged && res.usedExtra.length > 0) before.push(h('p', { class: 'bp__misplaced' }, BP_TEXT.extraUsed(res.usedExtra.map(label).join(', '))));
        feedback.replaceChildren(...feedbackNodes({ h, result: dont ? 'dont_know' : res.result, item, binary: true, verdict, before, answer, why: whyFor(h, ctx, item), report: reportFor(h, ctx, item) }));
      }

      async function send(answer, res, dont) {
        if (phase !== 'answering') return;
        phase = 'sending';
        lock(true);
        let r;
        try { r = ctx.submit ? await ctx.submit(answer) : { status: 'ignored' }; } catch { r = { status: 'error' }; }
        if (destroyed) return;
        if (r && r.status === 'error') {
          phase = 'answering';
          lock(false);
          msg.textContent = typeof r.message === 'string' && r.message ? r.message : BP_TEXT.saveFail;
          return;
        }
        phase = 'done';
        msg.textContent = '';
        if (r && r.status === 'ignored') return;
        try { paintFeedback(res, dont); } catch (e) { log('No se pudo mostrar la corrección del ejercicio de construir', e); }
      }

      function check() {
        if (phase !== 'answering') return;
        if (state.placed.length < read.pieces.length) {
          msg.textContent = BP_TEXT.incomplete;
          return;
        }
        const g = gradeBuild(item, state.placed);
        msg.textContent = '';
        lastResponse = toResponseRaw(g.text); // TRAMPA-32
        send({ result: g.result, hint: false, responseRaw: lastResponse, errorCodes: [] }, g, false);
      }

      function dontKnow() {
        if (phase !== 'answering') return;
        msg.textContent = '';
        lastResponse = null;
        send({ result: 'dont_know', dontKnow: true, hint: false }, { result: 'wrong', complete: false, misplaced: [], usedExtra: [] }, true);
      }

      render();
      return {
        el,
        getResponse: () => (phase === 'answering' ? (toResponseRaw(textOf(state.placed)) || null) : lastResponse),
        destroy() {
          if (destroyed) return;
          destroyed = true;
          for (const b of buttons) { try { b.destroy(); } catch { /* limpieza */ } }
          c.dispose();
          if (typeof el.remove === 'function') el.remove();
        },
      };
    },
  });
}

export default createBuildPieces;
