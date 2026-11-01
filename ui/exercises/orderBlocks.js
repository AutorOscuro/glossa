// @purpose: Componente de ordenar bloques por toques (2.4-T1, punto 4a): bandeja fija, frase armada, deshacer, reiniciar, «No sé» siempre a la vista y corrección con las posiciones mal puestas.
// Componente `order_blocks` (subparte 2.4, tramo 1). Contrato del componente (roadmap 8.9 y ficha «2.1-T4» de docs/CONTRACTS.md):
//   createOrderBlocks(opciones).mount(container, item, ctx) → { el, destroy(), getResponse() }
//
// Este punto NO registra el tipo en app/main.js y NO trae CSS (eso es el punto 4b); sin CSS la pantalla funciona pero se ve cruda.
// Opciones de createOrderBlocks (todas opcionales):
//   rng    azar con shuffle (core/rng.js); por defecto el del sistema. La bandeja se baraja en CADA montaje (si no, se memorizaría la posición).
//   lang   'en'. Idioma de los bloques (lang), para el lector de pantalla.
//   log    console.error. Recibe los fallos al pintar la corrección (la respuesta ya quedó guardada).
//
// Datos que usa: item.prompt_es (obligatorio), item.situation, item.data.{blocks | lines, shuffle}, item.accept (contrato en core/orderBlocks.js).
// Sirve para `order_blocks` y para `order_dialogue` (2.4-T1, punto 7): en el diálogo cada bloque se muestra «Hablante: texto», pero se compara y se envía
// solo el texto (sin hablante), igual que `accept`; la corrección muestra cada línea en su renglón con su hablante.
// Interacción solo por toques: tocar un bloque de la bandeja lo coloca al final de la frase; tocar un bloque de la frase lo quita.
// Los bloques de la bandeja NO cambian de sitio al colocarse (quedan marcados como usados), así la persona no pierde el lugar.
// «Comprobar» exige todos los bloques puestos; «No sé» está siempre a la vista mientras se responde.
// Envío: ctx.submit({ result, hint: false, responseRaw, errorCodes: [] }) con «Comprobar»; ctx.submit({ result: 'dont_know', dontKnow: true, hint: false }) con «No sé».
// Si submit devuelve error, el ejercicio se desbloquea y avisa. Todo texto entra con h() como nodo de texto (nunca HTML).
// Las marcas ✓ y ✗ llevan texto: el significado no depende solo del color.
import { makeCtx, uid, setAttr, setFlag } from '../components/_shared.js';
import { createButton } from '../components/button.js';
import { readOrder, gradeOrder, createOrderState, placeBlock, removeBlock, undoLast, resetOrder, bankOf, isComplete } from '../../core/orderBlocks.js';
import { systemRng } from '../../core/rng.js';
import { feedbackNodes } from '../feedbackPanel.js';
import { reportFor } from '../reportMenu.js';
import { whyFor } from '../whyNote.js';
import { toResponseRaw } from '../../core/responseText.js';

export const OB_TEXT = Object.freeze({
  situation: 'Situación',
  instruction: 'Toca los bloques en el orden correcto.',
  lineLabel: 'Tu frase',
  lineEmpty: 'Aquí aparece tu frase.',
  trayLabel: 'Bloques',
  undo: 'Deshacer',
  reset: 'Empezar de nuevo',
  check: 'Comprobar',
  dontKnow: 'No sé',
  incomplete: 'Coloca todos los bloques o toca «No sé».',
  saveFail: 'No se pudo guardar. Inténtalo otra vez.',
  correct: '¡Bien!',
  wrong: 'Todavía no. Así va en orden correcto:',
  dont: 'No pasa nada: así va en orden correcto:',
  flagOff: '✗ Fuera de lugar',
  flagOk: '✓ En su lugar',
  misplaced: (list) => `Fuera de lugar (posición ${list}).`,
  placedName: (n, text) => `Posición ${n}: ${text}. Toca para quitarlo.`,
  trayName: (text) => text,
  usedName: (text) => `${text} (ya colocado)`,
});


function need(cond, message) {
  if (!cond) throw new TypeError(`order_blocks: ${message}`);
}

export function createOrderBlocks(options = {}) {
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
      const read = readOrder(item);
      need(read.ok, `el ítem de ordenar no es válido (${read.reason})`);

      const c = makeCtx('order_blocks', { doc: container.ownerDocument ?? ctx.doc, win: ctx.win });
      const { h } = c;
      const promptId = uid('ob-prompt');
      let state = createOrderState(read.blocks.length, { rng, shuffle: read.shuffle });
      const text = (i) => read.blocks[i].trim(); // lo que se compara y se envía (sin hablante)
      // Lo que se MUESTRA: en `order_dialogue`, «Hablante: texto»; en `order_blocks`, el mismo texto.
      const labels = read.labels ?? read.blocks.map((x) => x.trim());
      const label = (i) => labels[i];

      // El texto de «frase vacía» vive DENTRO del recuadro y se coloca encima (CSS): así, al colocar el primer bloque, nada se mueve.
      const emptyEl = h('p', { class: 'ob__empty', 'aria-hidden': 'true' }, OB_TEXT.lineEmpty);
      // El espaciador mide lo mismo que un bloque (mismo texto, relleno y borde, también con «Muy grande»): con la frase vacía reserva su alto.
      const spacerEl = h('span', { class: 'ob__spacer', 'aria-hidden': 'true' }, '\u00A0');
      const lineEl = h('div', { class: 'ob__line', role: 'group', 'aria-label': OB_TEXT.lineLabel }, emptyEl, spacerEl);
      // La bandeja se pinta UNA vez, en su orden fijo: colocar o quitar solo cambia las marcas, no el sitio.
      const trayEls = state.tray.map((i) => h('button', {
        type: 'button', class: 'ob__block', lang, dataset: { index: i },
      }, label(i)));
      const trayEl = h('div', { class: 'ob__tray', role: 'group', 'aria-label': OB_TEXT.trayLabel }, trayEls);
      const msg = h('p', { class: 'ob__msg', role: 'status', 'aria-live': 'polite' });
      const feedback = h('div', { class: 'ob__feedback', 'aria-live': 'polite' });
      const undoBtn = createButton({ doc: c.doc, label: OB_TEXT.undo, variant: 'secondary', onClick: () => act(undoLast) });
      const resetBtn = createButton({ doc: c.doc, label: OB_TEXT.reset, variant: 'secondary', onClick: () => act(resetOrder) });
      const checkBtn = createButton({ doc: c.doc, label: OB_TEXT.check, variant: 'primary', size: 'lg', onClick: () => check() });
      const dontBtn = createButton({ doc: c.doc, label: OB_TEXT.dontKnow, variant: 'ghost', size: 'lg', onClick: () => dontKnow() });
      const buttons = [undoBtn, resetBtn, checkBtn, dontBtn];
      const tools = h('div', { class: 'ob__tools' }, undoBtn.el, resetBtn.el);
      // Comprobar y «No sé» van fijos abajo mientras se responde (CSS sticky, punto 4b); al pintar la corrección se ocultan.
      const actions = h('div', { class: 'ob__actions' }, msg, h('div', { class: 'ob__buttons' }, checkBtn.el, dontBtn.el));

      const el = h('article', { class: 'ob', dataset: { type: item.type } },
        typeof item.situation === 'string' && item.situation.trim() ? h('p', { class: 'ob__situation' }, `${OB_TEXT.situation}: ${item.situation}`) : null,
        h('p', { class: 'ob__prompt', id: promptId, lang: 'es' }, item.prompt_es),
        h('p', { class: 'ob__instruction' }, OB_TEXT.instruction),
        lineEl, tools, trayEl, actions, feedback);
      container.appendChild(el);

      let phase = 'answering'; // answering → sending → done
      let lastResponse = null;
      let destroyed = false;
      let placedEls = [];

      function render() {
        for (const e of placedEls) { try { e.remove(); } catch { /* limpieza */ } }
        placedEls = state.placed.map((i, pos) => {
          const b = h('button', { type: 'button', class: 'ob__block ob__block--placed', lang, dataset: { index: i }, 'aria-label': OB_TEXT.placedName(pos + 1, label(i)) }, label(i));
          c.listen(b, 'click', () => act((s) => removeBlock(s, i)));
          lineEl.appendChild(b);
          return b;
        });
        setFlag(emptyEl, 'is-hidden', state.placed.length > 0);
        for (const e of [emptyEl, spacerEl]) { if (state.placed.length > 0) e.setAttribute('hidden', ''); else e.removeAttribute('hidden'); }
        const free = new Set(bankOf(state));
        for (const b of trayEls) {
          const used = !free.has(Number(b.dataset.index));
          setFlag(b, 'is-used', used);
          setAttr(b, 'aria-disabled', used ? 'true' : null);
          b.setAttribute('aria-label', used ? OB_TEXT.usedName(label(Number(b.dataset.index))) : OB_TEXT.trayName(label(Number(b.dataset.index))));
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
        placedEls.forEach((b, pos) => {
          const off = bad.has(pos);
          setFlag(b, 'ob__block--off', off);
          setFlag(b, 'ob__block--ok', res.complete && !off && res.result === 'wrong');
          if (res.complete && res.result === 'wrong') b.setAttribute('aria-label', `${OB_TEXT.placedName(pos + 1, label(state.placed[pos])).replace(' Toca para quitarlo.', '')} ${off ? OB_TEXT.flagOff : OB_TEXT.flagOk}`);
        });
        // Veredicto, respuesta correcta y notas del ítem: panel común (2.6-T1). Ordenar es binario: nunca «casi».
        const verdict = dont ? OB_TEXT.dont : res.result === 'correct' ? OB_TEXT.correct : OB_TEXT.wrong;
        // En un diálogo cada línea va en su renglón, con su hablante; en `order_blocks`, la frase completa.
        const answer = !dont && res.result === 'correct' ? null : (read.labels
          ? h('p', { class: 'ob__correct ob__correct--lines' }, read.labels.flatMap((l, i) => [i > 0 ? h('br') : null, h('strong', { lang }, l)]))
          : h('p', { class: 'ob__correct' }, h('strong', { lang }, read.solution)));
        const before = !dont && res.result === 'wrong' && res.misplaced.length > 0
          ? h('p', { class: 'ob__misplaced' }, OB_TEXT.misplaced(res.misplaced.map((p) => p + 1).join(', '))) : null;
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
          msg.textContent = typeof r.message === 'string' && r.message ? r.message : OB_TEXT.saveFail;
          return;
        }
        phase = 'done';
        msg.textContent = '';
        if (r && r.status === 'ignored') return;
        try { paintFeedback(res, dont); } catch (e) { log('No se pudo mostrar la corrección del ejercicio de ordenar', e); }
      }

      function check() {
        if (phase !== 'answering') return;
        if (!isComplete(state)) {
          msg.textContent = OB_TEXT.incomplete;
          return;
        }
        const g = gradeOrder(item, state.placed);
        msg.textContent = '';
        lastResponse = toResponseRaw(g.text); // FIX 2.4-T1 (cierre): también U+0080–U+009F (TRAMPA-32)
        send({ result: g.result, hint: false, responseRaw: lastResponse, errorCodes: [] }, g, false);
      }

      function dontKnow() {
        if (phase !== 'answering') return;
        msg.textContent = '';
        lastResponse = null;
        send({ result: 'dont_know', dontKnow: true, hint: false }, { result: 'wrong', complete: false, misplaced: [] }, true);
      }

      render();
      return {
        el,
        getResponse: () => (phase === 'answering'
          ? (toResponseRaw(state.placed.map(text).join(' ')) || null)
          : lastResponse),
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

export default createOrderBlocks;
