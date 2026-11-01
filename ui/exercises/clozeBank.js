// @purpose: Componente de completar huecos con banco de palabras por toques (2.4-T2, punto 5b): frase con huecos, bandeja fija, deshacer, reiniciar, «Comprobar», «No sé» siempre a la vista y corrección por hueco.
// Componente `cloze_bank` (subparte 2.4, tramo 2). Contrato del componente (roadmap 8.9 y ficha «2.1-T4» de docs/CONTRACTS.md):
//   createClozeBank(opciones).mount(container, item, ctx) → { el, destroy(), getResponse() }
//
// Este punto NO registra el tipo en app/main.js y NO trae CSS (eso es un punto aparte); sin CSS la pantalla funciona pero se ve cruda.
// Opciones de createClozeBank (todas opcionales):
//   rng    azar con shuffle (core/rng.js); por defecto el del sistema. La bandeja se baraja en CADA montaje (si no, se memorizaría la posición).
//   lang   'en'. Idioma de la frase y de las palabras (lang), para el lector de pantalla.
//   log    console.error. Recibe los fallos al pintar la corrección (la respuesta ya quedó guardada).
//
// Datos que usa: item.prompt_es (obligatorio), item.situation, item.data.{text, answers, bank} (contrato en core/clozeBank.js).
// Interacción solo por toques: tocar una palabra de la bandeja la pone en el PRIMER hueco libre; tocar un hueco lleno quita su palabra.
// No se elige el hueco de destino (decisión provisional, ver DECISIONS): quitar y deshacer cubren el error.
// Los huecos son un botón cada uno, creado una vez: poner o quitar solo cambia su texto y sus marcas. La bandeja tampoco cambia de sitio.
// «Comprobar» exige todos los huecos llenos; «No sé» está siempre a la vista mientras se responde.
// Envío: ctx.submit({ result, hint: false, responseRaw, errorCodes: [] }) con «Comprobar»; ctx.submit({ result: 'dont_know', dontKnow: true, hint: false }) con «No sé».
// Si submit devuelve error, el ejercicio se desbloquea y avisa. Todo texto entra con h() como nodo de texto (nunca HTML).
// Las marcas ✓ y ✗ llevan texto: el significado no depende solo del color.
import { makeCtx, uid, setAttr, setFlag } from '../components/_shared.js';
import { createButton } from '../components/button.js';
import {
  readClozeBank, gradeClozeBank, createClozeState, placeWord, removeFill, undoLast, resetCloze, freeWords, isClozeComplete,
} from '../../core/clozeBank.js';
import { systemRng } from '../../core/rng.js';
import { feedbackNodes } from '../feedbackPanel.js';
import { reportFor } from '../reportMenu.js';
import { whyFor } from '../whyNote.js';
import { toResponseRaw } from '../../core/responseText.js';

export const CB_TEXT = Object.freeze({
  situation: 'Situación',
  instruction: 'Toca las palabras para completar los huecos.',
  sentenceLabel: 'Frase',
  gapEmpty: '___',
  trayLabel: 'Palabras',
  undo: 'Deshacer',
  reset: 'Empezar de nuevo',
  check: 'Comprobar',
  dontKnow: 'No sé',
  incomplete: 'Llena todos los huecos o toca «No sé».',
  saveFail: 'No se pudo guardar. Inténtalo otra vez.',
  correct: '¡Bien!',
  wrong: 'Todavía no. Así queda bien:',
  dont: 'No pasa nada: así queda bien:',
  flagOff: '✗ No encaja',
  flagOk: '✓ Correcto',
  review: (list) => `Huecos por revisar: ${list}.`,
  gapEmptyName: (n) => `Hueco ${n}, vacío`,
  gapFilledName: (n, text) => `Hueco ${n}: ${text}. Toca para quitarla.`,
  gapDoneName: (n, text, flag) => `Hueco ${n}: ${text}. ${flag}`,
  trayName: (text) => text,
  usedName: (text) => `${text} (ya puesta)`,
});

function need(cond, message) {
  if (!cond) throw new TypeError(`cloze_bank: ${message}`);
}

export function createClozeBank(options = {}) {
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
      const read = readClozeBank(item);
      need(read.ok, `el ítem de huecos no es válido (${read.reason})`);

      const c = makeCtx('cloze_bank', { doc: container.ownerDocument ?? ctx.doc, win: ctx.win });
      const { h } = c;
      const promptId = uid('cb-prompt');
      let state = createClozeState(read.gaps, read.bank.length, { rng });
      const word = (i) => read.bank[i];

      // La frase se pinta UNA vez: trozos de texto y un botón por hueco, en su sitio.
      const gapEls = Array.from({ length: read.gaps }, (_, g) => h('button', {
        type: 'button', class: 'cb__gap', lang, dataset: { gap: g },
      }, CB_TEXT.gapEmpty));
      const sentenceNodes = [];
      read.parts.forEach((part, i) => {
        if (part !== '') sentenceNodes.push(h('span', { class: 'cb__part', lang }, part));
        if (i < read.gaps) sentenceNodes.push(gapEls[i]);
      });
      const sentenceEl = h('p', { class: 'cb__sentence', role: 'group', 'aria-label': CB_TEXT.sentenceLabel }, sentenceNodes);
      // La bandeja se pinta UNA vez, en su orden fijo: poner o quitar solo cambia las marcas, no el sitio.
      const trayEls = state.tray.map((i) => h('button', {
        type: 'button', class: 'cb__word', lang, dataset: { index: i },
      }, word(i)));
      const trayEl = h('div', { class: 'cb__tray', role: 'group', 'aria-label': CB_TEXT.trayLabel }, trayEls);
      const msg = h('p', { class: 'cb__msg', role: 'status', 'aria-live': 'polite' });
      const feedback = h('div', { class: 'cb__feedback', 'aria-live': 'polite' });
      const undoBtn = createButton({ doc: c.doc, label: CB_TEXT.undo, variant: 'secondary', onClick: () => act(undoLast) });
      const resetBtn = createButton({ doc: c.doc, label: CB_TEXT.reset, variant: 'secondary', onClick: () => act(resetCloze) });
      const checkBtn = createButton({ doc: c.doc, label: CB_TEXT.check, variant: 'primary', size: 'lg', onClick: () => check() });
      const dontBtn = createButton({ doc: c.doc, label: CB_TEXT.dontKnow, variant: 'ghost', size: 'lg', onClick: () => dontKnow() });
      const buttons = [undoBtn, resetBtn, checkBtn, dontBtn];
      const tools = h('div', { class: 'cb__tools' }, undoBtn.el, resetBtn.el);
      // Comprobar y «No sé» van fijos abajo mientras se responde (CSS, punto aparte); al pintar la corrección se ocultan.
      const actions = h('div', { class: 'cb__actions' }, msg, h('div', { class: 'cb__buttons' }, checkBtn.el, dontBtn.el));

      const el = h('article', { class: 'cb', dataset: { type: item.type } },
        typeof item.situation === 'string' && item.situation.trim() ? h('p', { class: 'cb__situation' }, `${CB_TEXT.situation}: ${item.situation}`) : null,
        h('p', { class: 'cb__prompt', id: promptId, lang: 'es' }, item.prompt_es),
        h('p', { class: 'cb__instruction' }, CB_TEXT.instruction),
        sentenceEl, tools, trayEl, actions, feedback);
      container.appendChild(el);

      let phase = 'answering'; // answering → sending → done
      let lastResponse = null;
      let destroyed = false;

      // Todo lo que se ve sale de `state` y `phase`: no hay un «bloquear» aparte.
      function render() {
        const live = phase === 'answering';
        gapEls.forEach((b, g) => {
          const w = state.fills[g];
          const filled = w !== null;
          b.textContent = filled ? word(w) : CB_TEXT.gapEmpty;
          setFlag(b, 'is-filled', filled);
          setAttr(b, 'aria-disabled', live && filled ? null : 'true');
          b.setAttribute('aria-label', filled ? CB_TEXT.gapFilledName(g + 1, word(w)) : CB_TEXT.gapEmptyName(g + 1));
        });
        const free = new Set(freeWords(state));
        for (const b of trayEls) {
          const i = Number(b.dataset.index);
          const used = !free.has(i);
          setFlag(b, 'is-used', used);
          setAttr(b, 'aria-disabled', used || !live ? 'true' : null);
          b.setAttribute('aria-label', used ? CB_TEXT.usedName(word(i)) : CB_TEXT.trayName(word(i)));
        }
        setFlag(el, 'is-locked', phase === 'sending');
        for (const b of [checkBtn, dontBtn]) b.setDisabled(!live);
        undoBtn.setDisabled(!live || state.history.length === 0);
        resetBtn.setDisabled(!live || state.fills.every((w) => w === null));
      }

      function act(fn) {
        if (phase !== 'answering') return;
        const next = fn(state);
        if (next === state) return;
        state = next;
        msg.textContent = '';
        render();
      }

      for (const b of trayEls) {
        c.listen(b, 'click', () => {
          const before = state;
          act((s) => placeWord(s, Number(b.dataset.index)));
          if (state !== before) {
            const nextFree = trayEls.find((e) => !e.getAttribute('aria-disabled'));
            if (nextFree && typeof nextFree.focus === 'function') nextFree.focus();
          }
        });
      }
      gapEls.forEach((b, g) => c.listen(b, 'click', () => act((s) => removeFill(s, g))));

      // La frase correcta: la primera respuesta válida de cada hueco.
      const solution = () => read.parts.reduce((out, part, i) => out + part + (i < read.gaps ? read.answers[i][0] : ''), '');

      function paintFeedback(res, dont) {
        actions.setAttribute('hidden', '');
        const bad = new Set(res.wrongGaps);
        const marked = res.complete && res.result === 'wrong';
        gapEls.forEach((b, g) => {
          const off = bad.has(g);
          setFlag(b, 'cb__gap--off', marked && off);
          setFlag(b, 'cb__gap--ok', marked && !off);
          if (marked) {
            const w = word(state.fills[g]);
            const flag = off ? CB_TEXT.flagOff : CB_TEXT.flagOk;
            b.textContent = `${w} ${off ? '✗' : '✓'}`;
            b.setAttribute('aria-label', CB_TEXT.gapDoneName(g + 1, w, flag));
          }
        });
        // Veredicto, solución y notas del ítem: panel común (2.6-T1). Huecos con banco es binario: nunca «casi».
        const verdict = dont ? CB_TEXT.dont : res.result === 'correct' ? CB_TEXT.correct : CB_TEXT.wrong;
        const answer = !dont && res.result === 'correct' ? null : h('p', { class: 'cb__correct' }, h('strong', { lang }, solution()));
        const before = !dont && res.result === 'wrong' && res.wrongGaps.length > 0
          ? h('p', { class: 'cb__review' }, CB_TEXT.review(res.wrongGaps.map((g) => g + 1).join(', '))) : null;
        feedback.replaceChildren(...feedbackNodes({ h, result: dont ? 'dont_know' : res.result, item, binary: true, verdict, before, answer, why: whyFor(h, ctx, item), report: reportFor(h, ctx, item) }));
      }

      async function send(answer, res, dont) {
        if (phase !== 'answering') return;
        phase = 'sending';
        render();
        let r;
        try { r = ctx.submit ? await ctx.submit(answer) : { status: 'ignored' }; } catch { r = { status: 'error' }; }
        if (destroyed) return;
        if (r && r.status === 'error') {
          phase = 'answering';
          render();
          msg.textContent = typeof r.message === 'string' && r.message ? r.message : CB_TEXT.saveFail;
          return;
        }
        phase = 'done';
        render();
        msg.textContent = '';
        if (r && r.status === 'ignored') return;
        try { paintFeedback(res, dont); } catch (e) { log('No se pudo mostrar la corrección del ejercicio de huecos', e); }
      }

      function check() {
        if (phase !== 'answering') return;
        if (!isClozeComplete(state)) {
          msg.textContent = CB_TEXT.incomplete;
          return;
        }
        const g = gradeClozeBank(item, state.fills);
        msg.textContent = '';
        lastResponse = toResponseRaw(g.sentence); // TRAMPA-32: todo responseRaw pasa por toResponseRaw
        send({ result: g.result, hint: false, responseRaw: lastResponse, errorCodes: [] }, g, false);
      }

      function dontKnow() {
        if (phase !== 'answering') return;
        msg.textContent = '';
        lastResponse = null;
        send({ result: 'dont_know', dontKnow: true, hint: false }, { result: 'wrong', complete: false, wrongGaps: [] }, true);
      }

      render();
      return {
        el,
        getResponse: () => {
          if (phase !== 'answering') return lastResponse;
          if (state.fills.every((w) => w === null)) return null;
          return toResponseRaw(gradeClozeBank(item, state.fills).sentence) || null;
        },
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

export default createClozeBank;
